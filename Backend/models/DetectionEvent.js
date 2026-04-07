const mongoose = require('mongoose');

const detectionEventSchema = new mongoose.Schema({
    threatId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ThreatIntelligence',
        required: true
    },
    deviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Device',
        required: true
    },
    eventType: {
        type: String,
        enum: ['Blocked_by_Heuristics', 'Blocked_by_AI', 'Tracker_Blocked', 'WebRTC_Masked'],
        required: true
    },
    recordedThreatType: {
        type: String,
        required: true
    },
    actionTaken: {
        type: String,
        default: 'Blocked'
    }
}, { timestamps: true });

module.exports = mongoose.model('DetectionEvent', detectionEventSchema);