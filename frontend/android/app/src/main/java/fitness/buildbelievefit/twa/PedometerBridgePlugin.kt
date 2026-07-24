package fitness.buildbelievefit.twa

import android.Manifest
import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

/**
 * Live hardware pedometer bridge — registers the device TYPE_STEP_COUNTER sensor (the
 * low-power hardware step counter) and streams live step deltas to JS while the app is
 * in the foreground. Mirrors the HealthConnectBridge plugin conventions: registered in
 * MainActivity, auto-exposed on `window.Capacitor.Plugins.PedometerBridge`.
 *
 * TYPE_STEP_COUNTER reports CUMULATIVE steps since the last device reboot, so a
 * per-session baseline is captured on the first event and every emission carries the
 * delta since `start()` (`sessionSteps`) plus the raw `sinceBoot` counter. DAILY
 * progress is composed on the JS side (session delta + the day's Health Connect steps
 * baseline) — see frontend/src/lib/stepTracker.js — because TYPE_STEP_COUNTER is
 * since-boot, not since-midnight, and Health Connect owns the authoritative day total.
 *
 * Events: notifyListeners("stepUpdate", { sessionSteps, sinceBoot, at }).
 * Requires ACTIVITY_RECOGNITION (API 29+); older APIs grant it implicitly.
 */
@CapacitorPlugin(
    name = "PedometerBridge",
    permissions = [
        Permission(alias = "activity", strings = [Manifest.permission.ACTIVITY_RECOGNITION]),
    ],
)
class PedometerBridgePlugin : Plugin(), SensorEventListener {

    private companion object {
        const val ACTIVITY_ALIAS = "activity"
    }

    private val sensorManager: SensorManager? by lazy {
        context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
    }
    private val stepSensor: Sensor? by lazy {
        sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
    }

    private var listening = false
    private var baselineSinceBoot: Float? = null // captured on the first event after start()
    private var lastSinceBoot: Float = 0f

    // ACTIVITY_RECOGNITION is a runtime permission only on API 29+ (Android 10). On
    // older releases the step counter needs no grant, so we treat it as always held.
    private fun needsRuntimePermission(): Boolean = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q

    private fun hasActivityPermission(): Boolean =
        !needsRuntimePermission() || getPermissionState(ACTIVITY_ALIAS) == PermissionState.GRANTED

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        call.resolve(
            JSObject()
                .put("available", stepSensor != null)
                .put("hasPermission", hasActivityPermission()),
        )
    }

    @PluginMethod
    override fun requestPermissions(call: PluginCall) {
        if (!needsRuntimePermission() || hasActivityPermission()) {
            call.resolve(JSObject().put("granted", true))
            return
        }
        requestPermissionForAlias(ACTIVITY_ALIAS, call, "activityPermCallback")
    }

    @PermissionCallback
    fun activityPermCallback(call: PluginCall) {
        call.resolve(JSObject().put("granted", hasActivityPermission()))
    }

    @PluginMethod
    fun start(call: PluginCall) {
        val sensor = stepSensor
        if (sensor == null) {
            call.reject("sensor_unavailable")
            return
        }
        if (!hasActivityPermission()) {
            call.reject("permission_required")
            return
        }
        if (!listening) {
            // Reset the session baseline — the first onSensorChanged captures it, so
            // sessionSteps counts strictly from this start() forward.
            baselineSinceBoot = null
            val ok = sensorManager?.registerListener(this, sensor, SensorManager.SENSOR_DELAY_NORMAL) ?: false
            if (!ok) {
                call.reject("listener_register_failed")
                return
            }
            listening = true
        }
        call.resolve(JSObject().put("started", true))
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        stopListening()
        call.resolve(JSObject().put("stopped", true))
    }

    @PluginMethod
    fun getSteps(call: PluginCall) {
        call.resolve(
            JSObject()
                .put("sessionSteps", sessionSteps())
                .put("sinceBoot", lastSinceBoot.toDouble())
                .put("listening", listening),
        )
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null || event.sensor?.type != Sensor.TYPE_STEP_COUNTER) return
        val value = event.values.firstOrNull() ?: return
        lastSinceBoot = value
        if (baselineSinceBoot == null) baselineSinceBoot = value
        notifyListeners(
            "stepUpdate",
            JSObject()
                .put("sessionSteps", sessionSteps())
                .put("sinceBoot", value.toDouble())
                .put("at", System.currentTimeMillis()),
        )
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) { /* no-op */ }

    override fun handleOnDestroy() {
        super.handleOnDestroy()
        stopListening()
    }

    // Delta since start(); guards a reboot mid-session (counter resets low → clamp 0).
    private fun sessionSteps(): Int {
        val base = baselineSinceBoot ?: return 0
        return (lastSinceBoot - base).toInt().coerceAtLeast(0)
    }

    private fun stopListening() {
        if (listening) {
            sensorManager?.unregisterListener(this)
            listening = false
        }
    }
}
