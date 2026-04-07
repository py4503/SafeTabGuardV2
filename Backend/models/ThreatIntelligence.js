const mongoose = require('mongoose');

const threatIntelligenceSchema = new mongoose.Schema({
    url: { 
        type: String, 
        required: true, 
        unique: true,
        index: true 
    },
    threatType: { 
        type: String, 
        // Added "None" for safe sites, and "Unknown" as a fallback
        enum: ["Phishing", "Malware", "Scam", "Tracker", "Suspicious", "None", "Unknown", "IP_Leak_Risk"],
        default: 'Unknown'
    },
    score: {  // CHANGED from 'riskScore' to match API
        type: Number, 
        min: 0,
        max: 100,
        default: 0 
    },
    safe: {   // CHANGED from 'isSafe' to match API
        type: Boolean, 
        required: true 
    },
    vulnerabilities: { // NEW: To store the AI's explanation and confidence
        type: Array,
        default: []
    },
    lastAnalyzedAt: { 
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('ThreatIntelligence', threatIntelligenceSchema);