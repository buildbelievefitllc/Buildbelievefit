package fitness.buildbelievefit.twa

import android.os.Bundle
import com.getcapacitor.BridgeActivity

/**
 * Capacitor host Activity. The only customization over the generated default is
 * registering the custom native plugins so they are exposed to the WebView/JS:
 *   • HealthConnectBridge — Health Connect recovery reads (HRV / sleep / activity).
 *   • PedometerBridge      — live TYPE_STEP_COUNTER hardware step stream.
 */
class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(HealthConnectBridgePlugin::class.java)
        registerPlugin(PedometerBridgePlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
