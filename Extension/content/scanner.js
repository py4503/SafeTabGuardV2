// Listen for the background script requesting a scan
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "PERFORM_SMART_SCAN") {
        const scanData = analyzeAndSanitizeDOM();
        sendResponse(scanData);
    }
    return true;
});

function analyzeAndSanitizeDOM() {
    const localThreats = [];

    // --- 1. LOCAL THREAT HUNTING ---
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
        const style = window.getComputedStyle(iframe);
        if (style.opacity === '0' || style.display === 'none' || style.visibility === 'hidden' || iframe.width === '0' || iframe.height === '0') {
            localThreats.push(`Hidden iframe detected pointing to: ${iframe.src || 'unknown source'}`);
        }
    });

    // Detect password fields on non-HTTPS pages
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    if (passwordInputs.length > 0 && window.location.protocol !== 'https:') {
        localThreats.push("Password field detected on an insecure HTTP connection.");
    }


    // --- 2. DOM SANITIZATION (Save AI Tokens) ---
    // Clone the document so we don't accidentally delete elements from the user's actual screen
    const clonedDoc = document.documentElement.cloneNode(true);

    // Remove elements that are useless to the AI but consume massive amounts of tokens
    const elementsToRemove = clonedDoc.querySelectorAll('svg, style, video, audio');
    elementsToRemove.forEach(el => el.remove());

    // Strip massive Base64 strings from images, but keep the <img> tag for context
    const images = clonedDoc.querySelectorAll('img');
    images.forEach(img => {
        if (img.src && img.src.startsWith('data:image')) {
            img.src = "[BASE-64-IMAGE-REMOVED-FOR-SCAN]";
        }
    });

    // Return the heavily optimized HTML and any local threats we found
    return {
        url: window.location.href,
        cleanHtml: clonedDoc.innerHTML,
        clientSideThreats: localThreats
    };
}