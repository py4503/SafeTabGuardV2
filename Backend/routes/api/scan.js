// backend/routes/api.js
require('dotenv').config();

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const ThreatIntelligence = require('../../models/ThreatIntelligence');
const AiAnalysisLog = require('../../models/AiAnalysisLog');

// Configuration 
const domainBlacklist = ['malicious-example.com', 'phishing-site.net'];
// const suspiciousTokens = ['login', 'verify', 'update', 'secure', 'account', 'banking'];

// Initialize gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Check 1: VirusTotal API
const checkVirusTotal = async (url) => {
    const apiKey = process.env.VIRUSTOTAL_API_KEY;
    if (!apiKey) return { isUnsafe: false, reason: null };

    try {
        const urlId = Buffer.from(url).toString('base64').replace(/=/g, '');
        const apiUrl = `https://www.virustotal.com/api/v3/urls/${urlId}`;
        const response = await axios.get(apiUrl, { headers: { 'x-apikey': apiKey } });
        const maliciousCount = response.data.data.attributes.last_analysis_stats.malicious;

        if (maliciousCount > 0) {
            return { isUnsafe: true, reason: `Flagged as malicious by ${maliciousCount} vendors on VirusTotal.` };
        }
        return { isUnsafe: false, reason: null };
    } catch (error) {
        if (error.response && error.response.status === 404) return { isUnsafe: false, reason: null };
        console.error(' [Backend] Error calling VirusTotal API:', error.message);
        return { isUnsafe: false, reason: null };
    }
};

// Check - 2: Rule based checking

const checkUrlHeuristics = (url) => {
    const reasons = [];
    let score = 0; // We can still use a simple score or just collect reasons

    try {
        const parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname || '';
        const pathAndQuery = (parsedUrl.pathname + parsedUrl.search).toLowerCase();

        // --- Optimized Checks ---

        // 1. Extremely Long URL (less likely for legitimate root pages)
        if (url.length > 150) {
            score += 1;
            reasons.push("URL is unusually long (> 150 chars).");
        }

        // 2. Suspicious Keywords (only in path/query, multiple are worse)
        const suspiciousKeywords = ['login', 'verify', 'account', 'password', 'update', 'secure', 'signin', 'banking', 'confirm', 'credential'];
        let keywordCount = 0;
        suspiciousKeywords.forEach(keyword => {
            if (pathAndQuery.includes(keyword)) {
                keywordCount++;
            }
        });
        if (keywordCount > 1) {
            score += 2;
            reasons.push("URL path/parameters contain multiple suspicious keywords.");
        } else if (keywordCount === 1) {
            score += 1;
            reasons.push("URL path/parameters contain a suspicious keyword.");
        }

        // 3. Excessive Dots in Hostname (higher threshold)
        if ((hostname.match(/\./g) || []).length > 4) {
            score += 1;
            reasons.push("Excessive dots in domain name.");
        }

        // 4. Excessive Hyphens in Hostname (higher threshold)
        if ((hostname.match(/-/g) || []).length > 3) {
            score += 1;
            reasons.push("Excessive hyphens in domain name.");
        }

        // 5. Missing HTTPS (clear penalty)
        if (parsedUrl.protocol !== 'https:') {
            score += 2;
            reasons.push("Connection is not secure (No HTTPS).");
        }

        // 6. Contains '@' Symbol (Strong indicator)
        if (url.includes('@')) {
            score += 3;
            reasons.push("URL contains '@' symbol, often used to obscure the real domain.");
        }

        // 7. Hostname is an IP Address (Very strong indicator)
        const ipRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
        if (ipRegex.test(hostname)) {
            score += 4;
            reasons.push("Domain is a raw IP address, uncommon for legitimate sites.");
        }

        // --- Decision ---
        // We can base the decision purely on accumulating reasons or a score threshold
        const isSuspicious = score >= 4; // Example threshold, adjust as needed

        return {
            isSuspicious: isSuspicious,
            reasons: isSuspicious ? reasons : []
        };

    } catch (error) {
        // If URL parsing fails, assume it's potentially suspicious but don't crash
        console.warn(`[Heuristic Check] Failed to parse URL: ${url}`, error.message);
        return { isSuspicious: false, reasons: [] }; // Fail relatively safe
    }
};

// Check-3 : AI Content Analysis
const analyzeContentWithAi = async (htmlContent) => {
    // 1. Fixed Model Version (use 1.5 or 2.0 depending on your SDK version)
    const model = genAI.getGenerativeModel({
        model: "gemini-flash-latest",
        generationConfig: {
            // Excellent use of JSON mode!
            responseMimeType: "application/json"
        }
    });

    // 2. Fixed Prompt: The JSON keys now EXACTLY match what background.js expects
    const prompt = `You are a senior cybersecurity analyst. Analyze the following HTML/JS code for security vulnerabilities.
    Provide a single JSON object with exactly these three keys:
    1. "safe": A boolean. true if safe, false if malicious or highly suspicious.
    2. "threatType": A string. MUST be exactly one of these: "Phishing", "Malware", "Scam", "Tracker", or "Suspicious". Pick the closest match.
    3. "score": An integer between 0 (safe) and 100 (malicious).
    4. "vulnerabilities": A JSON array of objects, where each object has "vulnerability", "confidence", "explanation", and "recommendation".
    
    If no vulnerabilities are found, return {"safe": true, "score": 0, threatType: "None", "vulnerabilities": []}.

    Code to analyze: <code>${htmlContent}</code>`;

    console.log("API KEY CHECK:", process.env.GEMINI_API_KEY ? "✅ KEY IS LOADED" : "❌ KEY IS MISSING");

    try {
        const startTime = Date.now();

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const latencyMs = Date.now() - startTime;

        // Your robust parsing function from the previous step
        const parsedData = safelyParseAIResponse(text);

        // Telemetry extraction
        const promptTokens = response.usageMetadata?.promptTokenCount || 0;
        const completionTokens = response.usageMetadata?.candidatesTokenCount || 0;

        parsedData.telemetry = {
            latencyMs,
            promptTokens,
            completionTokens
        };

        return parsedData;

    } catch (error) {
        console.error("[Backend] Error in Ai analysis:", error);
        return {
            safe: true,
            score: 0,
            threatType: "None", // FIXED
            vulnerabilities: [], // FIXED: Keep empty so the router doesn't block the user
            telemetry: null
        };
    }
};

/**
 * Safely extracts and cleans JSON from an AI response string.
 * It strips Markdown blocks and fixes common escaping issues.
 */
function safelyParseAIResponse(rawText) {
    try {
        // 1. Strip Markdown code blocks (```json ... ```)
        let cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

        // 2. Remove problematic invisible control characters that break JSON.parse
        // This removes raw newlines and tabs that aren't properly escaped
        cleanedText = cleanedText.replace(/[\u0000-\u001F]+/g, " ");

        // 3. Attempt to parse
        return JSON.parse(cleanedText);
    } catch (error) {
        console.error("[Backend] CRITICAL PARSING ERROR. Raw AI Output was:", rawText);
        console.error("[Backend] Parse Error Details:", error.message);
        return {
            safe: true,
            score: 0,
            threatType: "None",
            vulnerabilities: [], // FIXED: Keep empty 
            error: "JSON Parsing Failed"
        };
    }
}

// Instant Scan (VirusTotal + Heuristics + Blacklist)
router.post('/check-url-fast', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required.' });

    const simpleReasons = new Set();

    try {
        // Runs VirusTotal and heuristic check at the same time
        const [virusTotalResult, heuristicResult] = await Promise.all([
            checkVirusTotal(url),
            checkUrlHeuristics(url)
        ]);

        // __results__
        // A) Add VirusTotal reasons
        if (virusTotalResult.isUnsafe) {
            simpleReasons.add(virusTotalResult.reason);
        }

        // B) Add Heuristic reasons
        if (heuristicResult.isSuspicious) {
            heuristicResult.reasons.forEach(reason => simpleReasons.add(`[Heuristic] ${reason}`));
        }

        // C) Add Local Blacklist check
        try {
            const urlObject = new URL(url);
            if (domainBlacklist.includes(urlObject.hostname)) {
                simpleReasons.add('Domain is on a known local blacklist.');
            }
        } catch (e) { /* Ignore invalid URL format */ }

        // __Final Decision__       
        const reasonsArray = Array.from(simpleReasons);
        if (reasonsArray.length > 0) {
            console.log(`[Fast Check] Unsafe URL detected: ${url}. Reasons:`, reasonsArray);

            let determinedThreatType = "Suspicious";
            if (virusTotalResult.isUnsafe) determinedThreatType = "Malware";
            if (reasonsArray.some(r => r.includes('blacklist'))) determinedThreatType = "Phishing";

            return res.json({ safe: false, simple_reasons: reasonsArray, threatType: determinedThreatType });
        }

        console.log(`[Fast Check] URL passed initial checks: ${url}`);
        return res.json({ safe: true, simple_reasons: [] });

    } catch (error) {
        console.error("[Backend] Error during fast check:", error);
        // Fail safe in case of unexpected errors during the fast check
        return res.status(500).json({ safe: true, simple_reasons: ["Fast analysis inconclusive due to server error."] });
    }
});

// Endpoint for ai

// Endpoint for ai
router.post('/analyze-content-ai', async (req, res) => {
    const { url, htmlContent } = req.body;
    if (!url || !htmlContent) return res.status(400).json({ error: 'URL and htmlContent are required.' });

    try {
        // ==========================================
        // OPTIMIZATION: CHECK CACHE FIRST
        // ==========================================
        const cachedThreat = await ThreatIntelligence.findOne({ url: url });
        
        if (cachedThreat) {
            console.log(`[AI Scan] Cache Hit! Skipping LLM for: ${url}`);
            
            // Return exactly the format the frontend expects, but instantly!
            return res.json({
                safe: cachedThreat.safe,
                vulnerabilities: cachedThreat.vulnerabilities || [],
                score: cachedThreat.score || 0,
                threatType: cachedThreat.threatType || (cachedThreat.safe ? "None" : "Suspicious"),
                telemetry: null // No tokens used, so telemetry is null
            });
        }

        // ==========================================
        // CACHE MISS: PROCEED WITH AI ANALYSIS
        // ==========================================
        console.log(`[AI Scan] Cache Miss. Triggering LLM for: ${url}`);
        
        const aiResult = await analyzeContentWithAi(htmlContent);
        const aiVulnerabilities = aiResult.vulnerabilities || [];
        const aiScore = aiResult.score || 0;

        // Extract the threatType we forced the AI to generate
        const aiThreatType = aiResult.threatType || "Suspicious";
        const scoreThreshold = 50;

        let decision;
        
        // ==========================================
        // 1. SAVE TELEMETRY TO MONGODB FIRST
        // ==========================================
        if (aiResult.telemetry) {
            try {
                const newLog = new AiAnalysisLog({
                    url: url,
                    latencyMs: aiResult.telemetry.latencyMs,
                    promptTokens: aiResult.telemetry.promptTokens,
                    completionTokens: aiResult.telemetry.completionTokens,
                    vulnerabilitiesFound: aiVulnerabilities
                });
                await newLog.save();
            } catch (err) {
                console.error("[Backend] Failed to save AI telemetry", err);
            }
        }

        // Updated check to include aiResult.safe
        if (aiVulnerabilities.length > 0 || aiScore >= scoreThreshold || aiResult.safe === false) {
            decision = {
                safe: false,
                vulnerabilities: aiVulnerabilities,
                score: aiScore,
                threatType: aiThreatType, 
                telemetry: aiResult.telemetry 
            };

            // ==========================================
            // 2. SAVE THREAT INTELLIGENCE TO MONGODB
            // ==========================================
            try {
                await ThreatIntelligence.findOneAndUpdate(
                    { url: url },
                    {
                        threatType: aiThreatType,
                        score: aiScore,
                        safe: false,
                        vulnerabilities: aiVulnerabilities,
                        lastAnalyzedAt: Date.now()
                    },
                    { upsert: true, new: true }
                );
            } catch (err) {
                console.error("[Backend] Failed to save Threat Intel", err);
            }

        } else {
            decision = {
                safe: true,
                vulnerabilities: [],
                score: aiScore,
                threatType: "None",
                telemetry: aiResult.telemetry
            };
        }

        return res.json(decision);

    } catch (error) {
        console.error("[Backend] Unexpected error in /analyze-content-ai:", error);
        return res.status(500).json({ error: 'Internal server error during analysis.' });
    }
});

module.exports = router;