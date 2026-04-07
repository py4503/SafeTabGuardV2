const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
    anonymousInstallId: { 
        type: String, 
        required: true, 
        unique: true,
        index: true // Indexed because we will look this up constantly when syncing
    },
    extensionVersion: { 
        type: String, 
        default: '2.0.0' 
    }
}, { timestamps: true }); // Automatically adds 'createdAt' and 'updatedAt'

module.exports = mongoose.model('Device', deviceSchema);