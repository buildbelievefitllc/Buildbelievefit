package fitness.buildbelievefit.twa

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.aggregate.AggregateMetric
import androidx.health.connect.client.aggregate.AggregationResult
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.BasalMetabolicRateRecord
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlin.reflect.KClass

/**
 * Pure Health Connect logic — no Capacitor types here so it stays unit-testable and
 * framework-agnostic. Reads the most recent HRV (RMSSD), the last sleep session, and
 * the day's activity load, then builds the canonical recovery JSON the React trigger
 * maps onto the `manual` bbf-wearable-ingest payload.
 *
 * ACTIVITY METRICS USE THE AGGREGATE API (solidified fix): steps and calories come
 * from hc.aggregate(...), which DEDUPLICATES overlapping data origins (watch + phone
 * both writing StepsRecord) — raw readRecords + sumOf double-counted and inflated
 * the step total. Activity is anchored to the LOCAL DAY (midnight → now), so the
 * figures match what the athlete sees in Samsung Health's "today" view, never a
 * rolling-24h hybrid of yesterday evening + today.
 *
 * Uses the real androidx.health.connect.client API — nothing is mocked.
 */
class HealthConnectManager(private val context: Context) {

    companion object {
        // READ scopes. HRV + SLEEP are the ordered scopes; ACTIVE_CALORIES_BURNED
        // supplies the daily load `strain` is derived from (bbf_wearable_readings.strain
        // is NOT NULL — see _shared/wearable-core.mjs + the ACWR migration); STEPS
        // feeds bbf_daily_biometrics.daily_steps on the Sovereign biometric ledger.
        //
        // TOTAL_CALORIES_BURNED + BASAL_METABOLIC_RATE back the calorie FALLBACK:
        // Samsung Health (and some others) write TotalCaloriesBurnedRecord and leave
        // ActiveCaloriesBurnedRecord empty, so active burn read 0 despite a logged
        // burn. With these scopes we derive active = total − basal. They are part of
        // the required set so the consent sheet always offers them; a denial surfaces
        // as `permissions_required` (visible in the Check-In diagnostic), never silent.
        val PERMISSIONS: Set<String> = setOf(
            HealthPermission.getReadPermission(HeartRateVariabilityRmssdRecord::class),
            HealthPermission.getReadPermission(SleepSessionRecord::class),
            HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
            HealthPermission.getReadPermission(StepsRecord::class),
            HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),
            HealthPermission.getReadPermission(BasalMetabolicRateRecord::class),
        )

        private const val RECOVERY_WINDOW_HOURS = 48L // HRV + sleep look-back (the order)
    }

    fun sdkStatus(): Int = HealthConnectClient.getSdkStatus(context)

    fun isAvailable(): Boolean = sdkStatus() == HealthConnectClient.SDK_AVAILABLE

    private fun client(): HealthConnectClient = HealthConnectClient.getOrCreate(context)

    suspend fun hasAllPermissions(): Boolean {
        if (!isAvailable()) return false
        val granted = client().permissionController.getGrantedPermissions()
        return granted.containsAll(PERMISSIONS)
    }

    /**
     * Reads the latest HRV (48h) + the most recent sleep session (48h) via record
     * reads, and the LOCAL DAY's steps + active calories via deduplicating
     * aggregates, then returns the canonical recovery payload. Real data only.
     */
    suspend fun readRecovery(): JSONObject = withContext(Dispatchers.IO) {
        val hc = client()
        val now = Instant.now()
        val zone = ZoneId.systemDefault()
        val recoveryWindow =
            TimeRangeFilter.between(now.minus(Duration.ofHours(RECOVERY_WINDOW_HOURS)), now)
        // Activity is DAY-ANCHORED: local midnight → now. This is the same boundary
        // Samsung Health renders, so the dashboard and the watch app agree.
        val dayStart = LocalDate.now(zone).atStartOfDay(zone).toInstant()
        val dayWindow = TimeRangeFilter.between(dayStart, now)
        val dayHours = Duration.between(dayStart, now).toMillis() / 3_600_000.0

        // ── HRV (RMSSD, ms) — most recent sample in the 48h window ──
        val hrvRecords = hc.readRecords(
            ReadRecordsRequest(
                HeartRateVariabilityRmssdRecord::class,
                timeRangeFilter = recoveryWindow,
            ),
        ).records
        val latestHrv = hrvRecords.maxByOrNull { it.time }
        val hrvMs: Double? = latestHrv?.heartRateVariabilityMillis

        // ── Sleep — most recent session; minutes asleep (stages) or in-bed fallback ──
        val sleepRecords = hc.readRecords(
            ReadRecordsRequest(
                SleepSessionRecord::class,
                timeRangeFilter = recoveryWindow,
            ),
        ).records
        val latestSleep = sleepRecords.maxByOrNull { it.endTime }
        val sleepMinutes: Long? = latestSleep?.let { asleepMinutes(it) }

        // ── Active energy (kcal) — today, deduplicated aggregate + Samsung fallback ──
        val cal = resolveActiveKcal(hc, dayWindow, dayHours)

        // ── Steps — today's deduplicated aggregate total (null = nothing recorded;
        //    the COUNT_TOTAL aggregate merges overlapping watch+phone origins) ──
        val dailySteps: Long? = aggregateSafe(hc, setOf(StepsRecord.COUNT_TOTAL), dayWindow)
            ?.get(StepsRecord.COUNT_TOTAL)

        // reading_date = the LOCAL TODAY. Activity is day-anchored, so the row must
        // be too — anchoring to the HRV sample's day (the old behavior) wrote
        // TODAY's steps onto YESTERDAY's ledger row whenever the freshest HRV in
        // the 48h window came from a prior night.
        val readingDate = DateTimeFormatter.ISO_LOCAL_DATE.format(LocalDate.now(zone))

        JSONObject().apply {
            put("ok", true)
            put("reading_date", readingDate)
            put("recorded_at", now.toString())
            put("hrv_ms", hrvMs ?: JSONObject.NULL)
            put("sleep_minutes", sleepMinutes ?: JSONObject.NULL)
            put("active_kcal", cal.kcal ?: JSONObject.NULL)
            put("daily_steps", dailySteps ?: JSONObject.NULL)
            put("resting_hr", JSONObject.NULL) // out of scope — left null (allowed downstream)
            put(
                "samples",
                JSONObject().apply {
                    put("hrv_count", hrvRecords.size)
                    put("sleep_sessions", sleepRecords.size)
                    put("active_calorie_source", cal.source)
                    put("activity_window_start", dayStart.toString())
                    put("hrv_recorded_at", latestHrv?.time?.toString() ?: JSONObject.NULL)
                    put("sleep_start", latestSleep?.startTime?.toString() ?: JSONObject.NULL)
                    put("sleep_end", latestSleep?.endTime?.toString() ?: JSONObject.NULL)
                },
            )
        }
    }

    /** Active-calorie resolution result + provenance (surfaced in samples for diagnostics). */
    private data class KcalResult(val kcal: Double?, val source: String)

    /**
     * Resolve today's active kilocalories, manufacturer-tolerant, via aggregates:
     *   1) ACTIVE_CALORIES_TOTAL (Whoop / Fitbit / Google Fit / Garmin write active).
     *   2) Samsung fallback — ENERGY_TOTAL (total burn) minus BASAL_CALORIES_TOTAL
     *      (basal energy integrated over the SAME window by Health Connect itself);
     *      if the basal aggregate is absent, scale the latest BMR record (kcal/day)
     *      to the window; if that is absent too, report total directly.
     *   3) Nothing recorded anywhere → null (null-integrity; never a fabricated 0).
     * Aggregates deduplicate overlapping origins; every call degrades to null on
     * failure instead of throwing the whole sync.
     */
    private suspend fun resolveActiveKcal(
        hc: HealthConnectClient,
        window: TimeRangeFilter,
        windowHours: Double,
    ): KcalResult {
        val agg = aggregateSafe(
            hc,
            setOf(
                ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL,
                TotalCaloriesBurnedRecord.ENERGY_TOTAL,
                BasalMetabolicRateRecord.BASAL_CALORIES_TOTAL,
            ),
            window,
        )
        val active = agg?.get(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL)?.inKilocalories
        if (active != null && active > 0.0) return KcalResult(active, "active_aggregate")

        val total = agg?.get(TotalCaloriesBurnedRecord.ENERGY_TOTAL)?.inKilocalories
        if (total != null && total > 0.0) {
            val basal = agg.get(BasalMetabolicRateRecord.BASAL_CALORIES_TOTAL)?.inKilocalories
            if (basal != null && basal > 0.0) {
                return KcalResult((total - basal).coerceAtLeast(0.0), "total_minus_basal_aggregate")
            }
            val bmrDay = readSafe(BasalMetabolicRateRecord::class, hc, window)
                .maxByOrNull { it.time }
                ?.basalMetabolicRate
                ?.inKilocaloriesPerDay
            if (bmrDay != null && bmrDay > 0.0) {
                val derived = (total - bmrDay * (windowHours / 24.0)).coerceAtLeast(0.0)
                return KcalResult(derived, "total_minus_bmr_record")
            }
            return KcalResult(total, "total_direct")
        }

        // active was 0-with-data → honest 0; both aggregates absent → honest null.
        return if (active != null) KcalResult(0.0, "active_aggregate_zero")
        else KcalResult(null, "none")
    }

    /** Aggregate `metrics` over `window`, returning null on any failure so the
     *  fallback chain degrades instead of aborting the whole sync. */
    private suspend fun aggregateSafe(
        hc: HealthConnectClient,
        metrics: Set<AggregateMetric<*>>,
        window: TimeRangeFilter,
    ): AggregationResult? = try {
        hc.aggregate(AggregateRequest(metrics, timeRangeFilter = window))
    } catch (e: Exception) {
        null
    }

    /** Read records of `type`, returning an empty list on any failure (e.g. an
     *  ungranted optional scope) so the fallback chain degrades instead of throwing. */
    private suspend fun <T : Record> readSafe(
        type: KClass<T>,
        hc: HealthConnectClient,
        window: TimeRangeFilter,
    ): List<T> = try {
        hc.readRecords(ReadRecordsRequest(type, timeRangeFilter = window)).records
    } catch (e: Exception) {
        emptyList()
    }

    // Minutes actually asleep: sum non-awake stages when present, else in-bed duration.
    private fun asleepMinutes(session: SleepSessionRecord): Long {
        val awake = setOf(
            SleepSessionRecord.STAGE_TYPE_UNKNOWN,
            SleepSessionRecord.STAGE_TYPE_AWAKE,
            SleepSessionRecord.STAGE_TYPE_AWAKE_IN_BED,
            SleepSessionRecord.STAGE_TYPE_OUT_OF_BED,
        )
        if (session.stages.isNotEmpty()) {
            val asleep = session.stages
                .filter { it.stage !in awake }
                .sumOf { Duration.between(it.startTime, it.endTime).toMinutes() }
            if (asleep > 0) return asleep
        }
        return Duration.between(session.startTime, session.endTime).toMinutes()
    }
}
