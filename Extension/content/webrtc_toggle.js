// extension/content/webrtc_toggle.js

chrome.storage.local.get(['webrtcMaskingEnabled'], (result) => {
    // If the user explicitly disabled it in the dashboard, send the kill switch
    if (result.webrtcMaskingEnabled === false) {
        window.postMessage({ type: "STG_DISABLE_WEBRTC" }, "*");
    }
});