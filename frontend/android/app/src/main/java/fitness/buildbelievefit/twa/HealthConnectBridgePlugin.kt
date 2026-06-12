package fitness.buildbelievefit.twa

import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Capacitor custom plugin — the web→native bridge. Registered in MainActivity, it is
 * auto-exposed to JS on `window.Capacitor.Plugins.HealthConnectBridge` (Capacitor uses
 * an @JavascriptInterface message channel under the hood).
 *
 * Methods (all resolve/reject a Capacitor PluginCall):
 *   isAvailable()        → { available, status }
 *   requestPermissions() → { granted }        (launches the Health Connect consent UI)
 *   readRecovery()       → canonical recovery JSON (HRV / sleep / active-calorie load)
 */
@CapacitorPlugin(name = "HealthConnectBridge")
class HealthConnectBridgePlugin : Plugin() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val manager by lazy { HealthConnectManager(context) }

    override fun handleOnDestroy() {
        super.handleOnDestroy()
        scope.cancel()
    }

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val status = manager.sdkStatus()
        val result = JSObject()
        result.put("available", status == HealthConnectClient.SDK_AVAILABLE)
        result.put("status", statusName(status))
        call.resolve(result)
    }

    @PluginMethod
    fun requestPermissions(call: PluginCall) {
        if (!manager.isAvailable()) {
            call.reject("health_connect_unavailable")
            return
        }
        scope.launch {
            try {
                if (manager.hasAllPermissions()) {
                    call.resolve(JSObject().put("granted", true))
                    return@launch
                }
                // Health Connect permissions use a dedicated ActivityResult contract,
                // NOT standard runtime permissions — launch it and parse in the callback.
                val contract = PermissionController.createRequestPermissionResultContract()
                val intent = contract.createIntent(context, HealthConnectManager.PERMISSIONS)
                startActivityForResult(call, intent, "permissionCallback")
            } catch (e: Exception) {
                call.reject("permission_request_failed", e)
            }
        }
    }

    @ActivityCallback
    fun permissionCallback(call: PluginCall, result: ActivityResult) {
        val contract = PermissionController.createRequestPermissionResultContract()
        val granted = contract.parseResult(result.resultCode, result.data)
        call.resolve(JSObject().put("granted", granted.containsAll(HealthConnectManager.PERMISSIONS)))
    }

    @PluginMethod
    fun readRecovery(call: PluginCall) {
        if (!manager.isAvailable()) {
            call.reject("health_connect_unavailable")
            return
        }
        scope.launch {
            try {
                if (!manager.hasAllPermissions()) {
                    call.reject("permissions_required")
                    return@launch
                }
                call.resolve(JSObject.fromJSONObject(manager.readRecovery()))
            } catch (e: Exception) {
                call.reject("read_failed", e)
            }
        }
    }

    private fun statusName(status: Int): String = when (status) {
        HealthConnectClient.SDK_AVAILABLE -> "available"
        HealthConnectClient.SDK_UNAVAILABLE -> "unavailable"
        HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "update_required"
        else -> "unknown"
    }
}
