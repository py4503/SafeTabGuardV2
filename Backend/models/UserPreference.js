const mongoose = require('mongoose');

const userPreferenceSchema = new mongoose.Schema({
    deviceId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Device', // Links back to the Device table
        required: true,
        unique: true 
    },
    webrtcMaskingEnabled: { 
        type: Boolean, 
        default: true // Privacy features should be opt-out, not opt-in!
    },
    canvasNoiseEnabled: { 
        type: Boolean, 
        default: true 
    },
    strictAiMode: { 
        type: Boolean, 
        default: false // Default to false for faster browsing
    }
}, { timestamps: true });

module.exports = mongoose.model('UserPreference', userPreferenceSchema);