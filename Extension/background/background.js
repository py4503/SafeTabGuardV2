// extension/background/background.js

importScripts('webrtc_manager.js');

// API Endpoints
const API_BASE = 'https://safetabguardv2.onrender.com/api'; // Change to Render URL in production
const FAST_CHECK_URL = `${API_BASE}/scan/check-url-fast`;
const AI_ANALYSIS_URL = `${API_BASE}/scan/analyze-content-ai`;
const REGISTER_DEVICE_URL = `${API_BASE}/devices/register`;
const LOG_ANALYTICS_URL = `${API_BASE}/analytics/log`;

// --- V2: DEVICE REGISTRATION & SYNC ---

async function getOrRegisterDevice() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['installationId', 'mongoDeviceId'], async (data) => {
            
            // 1. If we already have the DB ID, we are good to go!
            if (data.mongoDeviceId) {
                return resolve(data.mongoDeviceId);
            }

            // 2. We don't have a DB ID. Ensure we have a local UUID first.
            let installId = data.installationId;
            if (!installId) {
                installId = crypto.randomUUID();
                await chrome.storage.local.set({ 
                    installationId: installId, 
                    strictAiMode: false 
                });
            }

            // 3. Attempt the network sync
            try {
                const response = await fetch(REGISTER_DEVICE_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ deviceId: installId, extensionVersion: '2.0.0' })
                });

                if (response.ok) {
                    const result = await response.json();
                    await chrome.storage.local.set({
                        isSyncedWithBackend: true,
                        mongoDeviceId: result.deviceId // Save the MongoDB _id!
                    });
                    
                    console.log('[V2] Device synced to MongoDB:', result.deviceId);
                    chrome.alarms.clear("retryRegistration"); // Success! Kill the retry alarm.
                    resolve(result.deviceId);
                } else {
                    throw new Error("Server rejected registration");
                }
            } catch (error) {
                console.warn('[V2] Sync failed (Offline/Server down). Retrying later.');
                resolve(null); // Return null so the caller knows it failed
            }
        });
    });
}

// 1. Initial Install Trigger
chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === "install") {
        const mongoId = await getOrRegisterDevice();
        
        // If it failed (offline), set an alarm to retry every 5 minutes automatically
        if (!mongoId) {
            chrome.alarms.create("retryRegistration", { delayInMinutes: 1, periodInMinutes: 5 });
        }
    }
});

// 2. The Alarm Listener (Catches users when they finally connect to Wi-Fi)
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === "retryRegistration") {
        console.log("[V2] Alarm waking up to retry DB registration...");
        await getOrRegisterDevice();
    }
});

// --- V2: TELEMETRY LOGGING (WITH JIT FAILSAFE) ---
async function logThreatToBackend(url, eventType, threatType = 'Unknown') {
    // JUST-IN-TIME (JIT) FIX: Try to get the ID. If it's missing, it forces a registration attempt right now.
    const mongoDeviceId = await getOrRegisterDevice();

    // If it's STILL null, the user is completely offline. We abort the log to prevent DB errors.
    if (!mongoDeviceId) {
        console.log("[V2] Threat blocked, but cannot log to DB (Device Offline).");
        return; 
    }

    try {
        await fetch(LOG_ANALYTICS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deviceId: mongoDeviceId, 
                url: url,
                eventType: eventType,
                actionTaken: 'Blocked',
                threatType: threatType
            })
        });
        console.log(`[V2] Logged to Dashboard: ${threatType}`);
    } catch (error) {
        console.error('[V2] Analytics logging failed:', error);
    }
}

// --- CORE NAVIGATION LISTENER ---
chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.type === 'proceedToUrl' && message.url && sender.tab?.id) {
        chrome.storage.local.set({ bypassUrl: message.url }, () => {
            chrome.tabs.update(sender.tab.id, { url: message.url });
        });
    }
});

chrome.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId === 0 && details.url && (details.url.startsWith('http:') || details.url.startsWith('https:'))) {
        chrome.storage.local.get(['protectionEnabled', 'bypassUrl', 'strictAiMode'], (result) => {
            const isEnabled = result.protectionEnabled !== false;
            const strictAiMode = result.strictAiMode === true; // V2 Feature

            if (result.bypassUrl && details.url === result.bypassUrl) {
                chrome.storage.local.remove('bypassUrl');
                return;
            }

            if (isEnabled) {
                initiateSecurityCheck(details.url, details.tabId, strictAiMode);
            }
        });
    }
});

// --- V2: OPTIMIZED ORCHESTRATION ---
async function initiateSecurityCheck(url, tabId, strictAiMode) {
    try {
        chrome.action.setBadgeText({ text: 'SCAN', tabId: tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#FDBA74', tabId: tabId });

        const fastResponse = await fetch(FAST_CHECK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
        });
        const fastResult = await fastResponse.json();

        if (fastResult.safe === false) {
            updateLocalStats();
            logThreatToBackend(url, "Blocked_by_Heuristics", fastResult.threatType || "Suspicious"); // V2 Logging

            const scanData = await new Promise((resolve) => {
                chrome.tabs.sendMessage(tabId, { action: "PERFORM_SMART_SCAN" }, (response) => {
                    // Handle cases where the content script hasn't loaded properly
                    if (chrome.runtime.lastError) resolve(null);
                    else resolve(response);
                });
            });

            const dataToStore = {
                blockedUrl: url,
                simpleReasons: fastResult.simple_reasons || [],
                aiVulnerabilities: [],
                score: fastResult.score || 0,
                isAiScanning: true,
                lastBlockedSite: { url: url, timestamp: new Date().toISOString() },
            };
            chrome.storage.local.set(dataToStore, () => {
                const warningPageUrl = chrome.runtime.getURL('warning.html'); // Updated path
                chrome.tabs.update(tabId, { url: warningPageUrl });
                
                const preFetchedHtml = scanData ? scanData.cleanHtml : null;
                if (preFetchedHtml) {
                    performAiAnalysis(url, tabId, preFetchedHtml);
                }
            });
            return;
        }

        // V2 Feature: Only run AI if strict mode is ON, saving tokens and speeding up browsing
        if (strictAiMode) {
            await performAiAnalysis(url, tabId);
        } else {
            chrome.action.setBadgeText({ text: '', tabId: tabId }); // Clear badge if safe
        }

    } catch (error) {
        console.error('[SafeTabGuard] Error during instant scan:', error);
        chrome.action.setBadgeText({ text: 'ERR', tabId: tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#F87171', tabId: tabId });
    }
}

// --- AI ANALYSIS ---
async function performAiAnalysis(url, tabId, preFetchedHtml = null) {
    try {
        let htmlContent = preFetchedHtml;

        if (!htmlContent) {
            const scanData = await new Promise((resolve) => {
                chrome.tabs.sendMessage(tabId, { action: "PERFORM_SMART_SCAN" }, (response) => {
                    if (chrome.runtime.lastError) resolve(null);
                    else resolve(response);
                });
            });

            if (!scanData || !scanData.cleanHtml) {
                chrome.action.setBadgeText({ text: '', tabId: tabId });
                return;
            }
            htmlContent = scanData.cleanHtml;
        }

        const aiResponse = await fetch(AI_ANALYSIS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, htmlContent }),
        });
        const aiResult = await aiResponse.json();

        chrome.storage.local.get(null, (currentData) => {
            const dataToStore = {
                ...currentData,
                aiVulnerabilities: aiResult.vulnerabilities || [],
                score: aiResult.safe === false ? (aiResult.score || currentData.score) : currentData.score,
                isAiScanning: false,
                threatType: aiResult.threatType
            };
            chrome.storage.local.set(dataToStore);
        });

        chrome.tabs.sendMessage(tabId, {
            type: 'aiAnalysisComplete',
            payload: aiResult
        }).catch(() => { });

        const tab = await chrome.tabs.get(tabId);
        const isTabOnWarningPage = tab.url.includes('warning.html');

        if (aiResult.safe === false && !isTabOnWarningPage) {
            updateLocalStats();
            logThreatToBackend(url, "Blocked_by_AI", aiResult.threatType || "Suspicious"); 

            const warningPageUrl = chrome.runtime.getURL('warning.html'); // Kept exactly as requested
            chrome.tabs.update(tabId, { url: warningPageUrl });
        } else {
            chrome.action.setBadgeText({ text: '', tabId: tabId });
        }
    } catch (error) {
        console.error('[SafeTabGuard] Error during AI scan:', error);
    }
}

function updateLocalStats() {
    const today = new Date().toLocaleDateString();
    chrome.storage.local.get('blockedStats', (result) => {
        let stats = result.blockedStats || { count: 0, date: today };
        if (stats.date === today) {
            stats.count++;
        } else {
            stats = { count: 1, date: today };
        }
        chrome.storage.local.set({ blockedStats: stats });
    });
}