chrome.storage.local.get(['canvasNoiseEnabled'], (result) => {
    // If the user explicitly disabled it, send the kill switch to the MAIN world
    if (result.canvasNoiseEnabled === false) {
        window.postMessage({ type: "STG_DISABLE_POISON" }, "*");
    }
});