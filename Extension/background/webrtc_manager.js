// extension/background/webrtc_manager.js

// Chrome's strict policy: Forces WebRTC to only route through proxies. 
// If no proxy exists, it hides the local and public IP entirely.
const WEBRTC_POLICY_STRICT = "disable_non_proxied_udp";
const WEBRTC_POLICY_DEFAULT = "default";


async function initializeWebRTC() {
    const data = await chrome.storage.local.get(['webrtcMaskingEnabled']);
    
    const isEnabled = data.webrtcMaskingEnabled !== false;

    applyWebRTCPolicy(isEnabled);
}

function applyWebRTCPolicy(enableMasking) {
    const policy = enableMasking ? WEBRTC_POLICY_STRICT : WEBRTC_POLICY_DEFAULT;

    // This requires the "privacy" permission we added to manifest.json
    chrome.privacy.network.webRTCIPHandlingPolicy.set({
        value: policy
    }, () => {
        if (chrome.runtime.lastError) {
            console.error("[WebRTC Manager] Error setting policy:", chrome.runtime.lastError);
        } else {
            console.log(`[WebRTC Manager] IP Leak Masking is now: ${enableMasking ? 'ACTIVE' : 'INACTIVE'}`);
        }
    });
}

// listens user toggle

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.webrtcMaskingEnabled) {
        console.log("[WebRTC Manager] User toggled setting. Applying new policy...");
        applyWebRTCPolicy(changes.webrtcMaskingEnabled.newValue);
    }
});

// Run immediately when the service worker wakes up
initializeWebRTC();