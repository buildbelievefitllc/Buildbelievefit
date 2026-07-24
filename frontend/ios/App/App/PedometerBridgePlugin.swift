import Foundation
import Capacitor
import CoreMotion

/**
 * Live hardware pedometer bridge (iOS) — the CMPedometer / Core Motion counterpart to
 * the Android TYPE_STEP_COUNTER `PedometerBridgePlugin.kt`. Streams live step deltas to
 * JS while the app is active. Auto-exposed on `window.Capacitor.Plugins.PedometerBridge`
 * (pure-Swift CAPBridgedPlugin registration — no .m macro file needed on Capacitor 6).
 *
 * CMPedometer.startUpdates(from:) reports steps SINCE the given start date, so
 * `numberOfSteps` is naturally the per-session delta — matching Android's sessionSteps.
 * DAILY progress is composed on the JS side (session delta + the day's Health Connect /
 * manual baseline) — see frontend/src/lib/stepTracker.js.
 *
 * Events: notifyListeners("stepUpdate", data: ["sessionSteps": Int, "at": Double]).
 * Requires NSMotionUsageDescription (Info.plist); the motion prompt fires on first use.
 */
@objc(PedometerBridgePlugin)
public class PedometerBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PedometerBridgePlugin"
    public let jsName = "PedometerBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSteps", returnType: CAPPluginReturnPromise),
    ]

    private let pedometer = CMPedometer()
    private var listening = false
    private var sessionSteps = 0

    private func authorized() -> Bool {
        return CMPedometer.authorizationStatus() == .authorized
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve([
            "available": CMPedometer.isStepCountingAvailable(),
            "hasPermission": authorized(),
        ])
    }

    @objc override public func requestPermissions(_ call: CAPPluginCall) {
        guard CMPedometer.isStepCountingAvailable() else {
            call.resolve(["granted": false])
            return
        }
        // A tiny historical query triggers the Core Motion permission prompt on first
        // use; resolve with the resulting authorization status.
        let now = Date()
        pedometer.queryPedometerData(from: now.addingTimeInterval(-1), to: now) { [weak self] _, _ in
            DispatchQueue.main.async {
                call.resolve(["granted": self?.authorized() ?? false])
            }
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        guard CMPedometer.isStepCountingAvailable() else {
            call.reject("sensor_unavailable")
            return
        }
        if !listening {
            sessionSteps = 0
            listening = true
            // startUpdates(from:) counts strictly forward from now → sessionSteps.
            pedometer.startUpdates(from: Date()) { [weak self] data, error in
                guard let self = self, error == nil, let steps = data?.numberOfSteps.intValue else { return }
                self.sessionSteps = steps
                DispatchQueue.main.async {
                    self.notifyListeners("stepUpdate", data: [
                        "sessionSteps": steps,
                        "at": Date().timeIntervalSince1970 * 1000,
                    ])
                }
            }
        }
        call.resolve(["started": true])
    }

    @objc func stop(_ call: CAPPluginCall) {
        stopUpdates()
        call.resolve(["stopped": true])
    }

    @objc func getSteps(_ call: CAPPluginCall) {
        call.resolve([
            "sessionSteps": sessionSteps,
            "listening": listening,
        ])
    }

    private func stopUpdates() {
        if listening {
            pedometer.stopUpdates()
            listening = false
        }
    }

    deinit {
        pedometer.stopUpdates()
    }
}
