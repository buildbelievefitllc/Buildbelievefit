package fitness.buildbelievefit.twa

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.BasalMetabolicRateRecord
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlin.reflect.KClass

/**
 * Pure Health Connect logic — no Capacitor types here so it stays unit-testable and
 * framework-agnostic. Reads the most recent HRV (RMSSD), the last sleep session, and
 * the trailing active-calorie load, then builds the canonical recovery JSON the React
 * trigger maps onto the `manual` bbf-wearable-ingest payload.
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
        // burn. With these scopes we derive active = total − BMR. They are part of
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
        private const val LOAD_WINDOW_HOURS = 24L     // active-calorie load → daily strain
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
     * Reads the latest HRV (48h), the most recent sleep session (48h) and the active
     * calories burned (24h), and returns the canonical recovery payload. Real data.
     */
    suspend fun readRecovery(): JSONObject = withContext(Dispatchers.IO) {
        val hc = client()
        val now = Instant.now()
        val recoveryWindow =
            TimeRangeFilter.between(now.minus(Duration.ofHours(RECOVERY_WINDOW_HOURS)), now)
        val loadWindow =
            TimeRangeFilter.between(now.minus(Duration.ofHours(LOAD_WINDOW_HOURS)), now)

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

        // ── Active energy (kcal) — 24h. ActiveCaloriesBurnedRecord first; on devices
        //    that only write TotalCaloriesBurnedRecord (Samsung Health), fall back to
        //    total − BMR, then total direct. `kcal` is null ONLY when nothing logged. ──
        val cal = resolveActiveKcal(hc, loadWindow)

        // ── Steps — last 24h summed → daily_steps on the biometric ledger ──
        val stepRecords = hc.readRecords(
            ReadRecordsRequest(
                StepsRecord::class,
                timeRangeFilter = loadWindow,
            ),
        ).records
        val dailySteps: Long? = if (stepRecords.isEmpty()) null else stepRecords.sumOf { it.count }

        // reading_date = local day of the HRV sample (fallback: sleep end, then now).
        val zone = ZoneId.systemDefault()
        val anchor = latestHrv?.time ?: latestSleep?.endTime ?: now
        val readingDate = DateTimeFormatter.ISO_LOCAL_DATE.format(anchor.atZone(zone).toLocalDate())

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
                    put("active_calorie_records", cal.records)
                    put("active_calorie_source", cal.source)
                    put("step_records", stepRecords.size)
                    put("hrv_recorded_at", latestHrv?.time?.toString() ?: JSONObject.NULL)
                    put("sleep_start", latestSleep?.startTime?.toString() ?: JSONObject.NULL)
                    put("sleep_end", latestSleep?.endTime?.toString() ?: JSONObject.NULL)
                },
            )
        }
    }

    /** Active-calorie resolution result + provenance (surfaced in samples for diagnostics). */
    private data class KcalResult(val kcal: Double?, val source: String, val records: Int)

    /**
     * Resolve active kilocalories over `window`, manufacturer-tolerant:
     *   1) ActiveCaloriesBurnedRecord summed (Whoop / Fitbit / Google Fit / Garmin).
     *   2) Samsung Health fallback — it writes TotalCaloriesBurnedRecord, so derive
     *      active = total − BMR (BMR scaled to the window from kcal/day); if BMR is
     *      unavailable, report total directly.
     *   3) Nothing logged anywhere → null (null-integrity; never a fabricated 0).
     *      Active records that genuinely sum to 0 (sedentary day) report 0, not null.
     * Every read is wrapped so a missing optional grant degrades gracefully.
     */
    private suspend fun resolveActiveKcal(hc: HealthConnectClient, window: TimeRangeFilter): KcalResult {
        val active = readSafe(ActiveCaloriesBurnedRecord::class, hc, window)
        val activeSum = active.sumOf { it.energy.inKilocalories }
        if (activeSum > 0.0) return KcalResult(activeSum, "active", active.size)

        val total = readSafe(TotalCaloriesBurnedRecord::class, hc, window)
        val totalSum = total.sumOf { it.energy.inKilocalories }
        if (totalSum > 0.0) {
            val bmrDay = readSafe(BasalMetabolicRateRecord::class, hc, window)
                .maxByOrNull { it.time }
                ?.basalMetabolicRate
                ?.inKilocaloriesPerDay
            if (bmrDay != null && bmrDay > 0.0) {
                val bmrWindow = bmrDay * (LOAD_WINDOW_HOURS.toDouble() / 24.0)
                val derived = (totalSum - bmrWindow).coerceAtLeast(0.0)
                return KcalResult(derived, "total_minus_bmr", total.size)
            }
            return KcalResult(totalSum, "total_direct", total.size)
        }

        // No active AND no total records → honest null. An empty active sum WITH
        // records present is a real sedentary 0.
        val anyRecords = active.isNotEmpty() || total.isNotEmpty()
        return KcalResult(if (anyRecords) 0.0 else null, "none", active.size)
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
