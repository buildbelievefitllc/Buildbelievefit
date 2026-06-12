package fitness.buildbelievefit.twa

import android.os.Bundle
import com.getcapacitor.BridgeActivity

/**
 * Capacitor host Activity. The only customization over the generated default is
 * registering the HealthConnectBridge plugin so it is exposed to the WebView/JS.
 */
class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(HealthConnectBridgePlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
