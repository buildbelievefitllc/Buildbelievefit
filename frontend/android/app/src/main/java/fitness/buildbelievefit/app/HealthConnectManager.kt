package fitness.buildbelievefit.twa

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

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
        val PERMISSIONS: Set<String> = setOf(
            HealthPermission.getReadPermission(HeartRateVariabilityRmssdRecord::class),
            HealthPermission.getReadPermission(SleepSessionRecord::class),
            HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
            HealthPermission.getReadPermission(StepsRecord::class),
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

        // ── Active energy (kcal) — last 24h summed → strain (ULU) on the web side ──
        val calRecords = hc.readRecords(
            ReadRecordsRequest(
                ActiveCaloriesBurnedRecord::class,
                timeRangeFilter = loadWindow,
            ),
        ).records
        val activeKcal: Double = calRecords.sumOf { it.energy.inKilocalories }

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
            put("active_kcal", activeKcal)
            put("daily_steps", dailySteps ?: JSONObject.NULL)
            put("resting_hr", JSONObject.NULL) // out of scope — left null (allowed downstream)
            put(
                "samples",
                JSONObject().apply {
                    put("hrv_count", hrvRecords.size)
                    put("sleep_sessions", sleepRecords.size)
                    put("active_calorie_records", calRecords.size)
                    put("step_records", stepRecords.size)
                    put("hrv_recorded_at", latestHrv?.time?.toString() ?: JSONObject.NULL)
                    put("sleep_start", latestSleep?.startTime?.toString() ?: JSONObject.NULL)
                    put("sleep_end", latestSleep?.endTime?.toString() ?: JSONObject.NULL)
                },
            )
        }
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
