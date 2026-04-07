const mongoose = require('mongoose');

const aiAnalysisLogSchema = new mongoose.Schema({
    url: { // CHANGED from threatId to url for easier, independent logging
        type: String,
        required: true,
        index: true
    },
    aiModelUsed: { 
        type: String, 
        default: 'Gemini 2.5 Flash' // UPDATED to reflect your new V2 stack
    },
    promptTokens: { 
        type: Number 
    },
    completionTokens: { 
        type: Number 
    },
    vulnerabilitiesFound: [{ 
        type: mongoose.Schema.Types.Mixed // CHANGED: Allows storing complex JSON objects instead of just strings
    }],
    latencyMs: { 
        type: Number 
    }
}, { timestamps: true });

module.exports = mongoose.model('AIAnalysisLog', aiAnalysisLogSchema);