// backend/routes/api/analytics.js

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Import the V2 Models
const DetectionEvent = require('../../models/DetectionEvent');
const ThreatIntelligence = require('../../models/ThreatIntelligence');
const Device = require('../../models/Device');

/**
 * @route   POST /api/analytics/log
 * @desc    Logs a new blocked threat (Called silently by background.js)
 * @access  Public
 */

router.post('/log', async (req, res) => {
    const { deviceId, url, eventType, actionTaken, threatType } = req.body;

    // FAIL-SAFE 1: Strict payload validation
    if (!deviceId || !url || !eventType) {
        return res.status(400).json({ error: 'Missing required fields for logging.' });
    }

    // FAIL-SAFE 2: Prevent Mongoose CastErrors from crashing the Render server
    if (!mongoose.Types.ObjectId.isValid(deviceId)) {
        return res.status(400).json({ error: 'Invalid device ID format.' });
    }

    try {
        // FAIL-SAFE 3: Ensure the device actually exists in the DB
        const device = await Device.findById(deviceId);
        if (!device) {
            console.warn(`[Analytics] Unregistered device attempted to log: ${deviceId}`);
            return res.status(404).json({ error: 'Device not registered.' });
        }

        // 1. Find or Create the Global Threat Intelligence
        let threat = await ThreatIntelligence.findOne({ url: url });
        let resolvedThreatType = threatType || 'Suspicious';
        
        if (!threat) {
            // New threat detected globally
            threat = new ThreatIntelligence({
                url: url,
                threatType: resolvedThreatType, 
                safe: false, 
                score: (resolvedThreatType === 'Malware' || resolvedThreatType === 'Phishing') ? 95 : 80    
            });
            await threat.save();
        } else {
            // OPTIMIZATION: Escalate global risk if AI finds something worse
            if ((resolvedThreatType === 'Malware' || resolvedThreatType === 'Phishing') && threat.threatType !== resolvedThreatType) {
                threat.threatType = resolvedThreatType;
                threat.score = 95; 
                await threat.save();
            } else {
                // If we aren't escalating, make sure our local variable matches the DB
                resolvedThreatType = threat.threatType; 
            }
        }

        // 2. THE DEDUPLICATION FIX: 2-Minute Time-Windowed Upsert
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
        const existingEvent = await DetectionEvent.findOne({
            deviceId: device._id,
            threatId: threat._id,
            timestamp: { $gte: twoMinutesAgo }
        });

        if (existingEvent) {
            // UPGRADE the existing heuristic log to the smarter AI log
            existingEvent.eventType = eventType; // e.g., Upgrades to 'Blocked_by_AI'
            existingEvent.recordedThreatType = resolvedThreatType; // Fixes the Dashboard Pie Chart!
            existingEvent.actionTaken = actionTaken || existingEvent.actionTaken;
            
            await existingEvent.save();
            return res.status(200).json({ message: 'Existing event upgraded with AI categorization.' });
        }

        // 3. Create a brand new event if no recent duplicate exists
        const newEvent = new DetectionEvent({
            threatId: threat._id,
            deviceId: device._id,
            eventType: eventType, 
            actionTaken: actionTaken || 'Blocked',
            recordedThreatType: resolvedThreatType, // The Point-In-Time Snapshot for the Pie Chart
            timestamp: new Date()
        });
        
        await newEvent.save();
        return res.status(201).json({ message: 'New threat logged successfully.' });

    } catch (error) {
        console.error('[Analytics] Error logging event:', error);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

/**
 * @route   GET /api/analytics/summary
 * @desc    Fetches the big numbers AND the 7-day trend for the React Dashboard
 * @access  Public
 */
router.get('/summary', async (req, res) => {
    const { deviceId } = req.query;
    if (!deviceId) return res.status(400).json({ error: 'Device ID required.' });

    try {
        // --- PART 1: The Big Numbers (Your existing logic) ---
        const allEvents = await DetectionEvent.find({ deviceId: deviceId }).populate('threatId');
        
        const totalEvents = allEvents.length;
        const trackers = allEvents.filter(e => e.recordedThreatType === 'Tracker').length;
        const phishing = allEvents.filter(e => e.recordedThreatType === 'Phishing').length;
        const malware = allEvents.filter(e => e.recordedThreatType === 'Malware').length;
        const webrtc = allEvents.filter(e => e.eventType === 'WebRTC_Masked').length;


        // --- PART 2: The 7-Day Trend Aggregation ---
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // Get last 7 days (including today)
        sevenDaysAgo.setHours(0, 0, 0, 0); // Start at midnight

        // Ask MongoDB to group events by day and count them
        const rawWeeklyData = await DetectionEvent.aggregate([
            { 
                $match: { 
                    deviceId: new mongoose.Types.ObjectId(deviceId), // Safely cast to ObjectId
                    createdAt: { $gte: sevenDaysAgo } 
                } 
            },
            {
                $group: {
                    // Group by the Year-Month-Day formatted string
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    threats: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } } // Sort chronologically
        ]);

        // --- PART 3: The Zero-Filling Loop ---
        // Fill in the empty days where the user didn't encounter any threats
        const weeklyTrend = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateString = d.toISOString().split('T')[0]; // Format: YYYY-MM-DD
            
            const found = rawWeeklyData.find(item => item._id === dateString);
            
            weeklyTrend.push({
                // Formats to "Apr 07" for a sleek UI
                date: d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
                threats: found ? found.threats : 0
            });
        }

        // --- PART 4: Send the combined payload ---
        return res.status(200).json({
            totalThreatsMitigated: totalEvents,
            trackersBlocked: trackers,
            phishingPrevented: phishing,
            malwareStopped: malware,
            webrtcLeaksMasked: webrtc,
            weeklyTrend: weeklyTrend // <--- Attach the new trend data!
        });
        
    } catch (error) {
        console.error('[Analytics] Summary Error:', error);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

/**
 * @route   GET /api/analytics/recent
 * @desc    Fetches the last 50 threats to display in the Dashboard table
 * @access  Public
 */
router.get('/recent', async (req, res) => {
    const { deviceId } = req.query;
    if (!deviceId) return res.status(400).json({ error: 'Device ID required.' });

    try {
        // Filter by deviceId here as well
        const recentLogs = await DetectionEvent.find({ deviceId: deviceId })
            .sort({ createdAt: -1 })
            .limit(50)
            // FIXED: 'riskScore' changed to 'score', added 'vulnerabilities' in case UI needs them
            .populate({ path: 'threatId', select: 'url threatType score vulnerabilities' })
            .select('-deviceId');

        return res.status(200).json(recentLogs);
    } catch (error) {
        console.error('[Analytics] Recent Error:', error);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

module.exports = router;