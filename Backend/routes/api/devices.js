// backend/routes/api/devices.js

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); // NEW: Required to validate ObjectIds

// Import the V2 Models
const Device = require('../../models/Device');
const UserPreference = require('../../models/UserPreference');

/**
 * @route   POST /api/devices/register
 * @desc    Registers a new anonymous device install (Called by background.js)
 * @access  Public
 */
router.post('/register', async (req, res) => {
    const { deviceId, extensionVersion } = req.body;

    if (!deviceId) {
        return res.status(400).json({ error: 'Device ID is required.' });
    }

    try {
        // 1. Check if the device already synced previously
        let device = await Device.findOne({ anonymousInstallId: deviceId });

        if (device) {
            return res.status(200).json({ message: 'Device already registered.', deviceId: device._id });
        }

        // 2. Create the new Device record
        device = new Device({
            anonymousInstallId: deviceId,
            extensionVersion: extensionVersion || '2.0.0'
        });
        const savedDevice = await device.save();

        // 3. Immediately create default User Preferences
        const defaultPreferences = new UserPreference({
            deviceId: savedDevice._id,
            webrtcMaskingEnabled: true,
            canvasNoiseEnabled: true,
            strictAiMode: false
        });
        await defaultPreferences.save();

        console.log(`[Devices] New extension install registered: ${deviceId}`);
        return res.status(201).json({ 
            message: 'Device registered successfully.', 
            deviceId: savedDevice._id 
        });

    } catch (error) {
        console.error('[Devices] Error registering device:', error);
        return res.status(500).json({ error: 'Internal server error during registration.' });
    }
});

/**
 * Helper Function: Find device by either Mongo _id or UUID
 */
async function findDeviceFlexibly(idString) {
    if (mongoose.Types.ObjectId.isValid(idString)) {
        const device = await Device.findById(idString);
        if (device) return device;
    }
    return await Device.findOne({ anonymousInstallId: idString });
}

/**
 * @route   POST /api/devices/settings
 * @desc    Updates the user's toggle preferences (Called by popup.js)
 * @access  Public
 */
router.post('/settings', async (req, res) => {
    const { deviceId, webrtcMaskingEnabled, canvasNoiseEnabled, strictAiMode } = req.body;

    if (!deviceId) {
        return res.status(400).json({ error: 'Device ID is required.' });
    }

    try {
        // 1. FIXED: Find the device using the flexible helper
        const device = await findDeviceFlexibly(deviceId);
        
        if (!device) {
            return res.status(404).json({ error: 'Device not found. Please register first.' });
        }

        // 2. FIXED: Build a dynamic update object to prevent erasing missing fields
        const updatePayload = {};
        if (webrtcMaskingEnabled !== undefined) updatePayload.webrtcMaskingEnabled = webrtcMaskingEnabled;
        if (canvasNoiseEnabled !== undefined) updatePayload.canvasNoiseEnabled = canvasNoiseEnabled;
        if (strictAiMode !== undefined) updatePayload.strictAiMode = strictAiMode;

        // 3. Find and update the user's preferences
        const updatedPreferences = await UserPreference.findOneAndUpdate(
            { deviceId: device._id },
            { $set: updatePayload },
            { new: true } // Returns the updated document
        );

        if (!updatedPreferences) {
            return res.status(404).json({ error: 'Preferences not found for this device.' });
        }

        console.log(`[Devices] Settings updated for device: ${device._id}`);
        return res.status(200).json({ 
            message: 'Settings updated successfully.', 
            settings: updatedPreferences 
        });

    } catch (error) {
        console.error('[Devices] Error updating settings:', error);
        return res.status(500).json({ error: 'Internal server error updating settings.' });
    }
});

/**
 * @route   GET /api/devices/settings/:deviceId
 * @desc    Fetches current settings to load into the UI
 * @access  Public
 */
router.get('/settings/:deviceId', async (req, res) => {
    try {
        // FIXED: Find the device using the flexible helper
        const device = await findDeviceFlexibly(req.params.deviceId);
        
        if (!device) {
            return res.status(404).json({ error: 'Device not found.' });
        }

        const preferences = await UserPreference.findOne({ deviceId: device._id });
        return res.status(200).json(preferences);

    } catch (error) {
        console.error('[Devices] Error fetching settings:', error);
        return res.status(500).json({ error: 'Internal server error fetching settings.' });
    }
});

module.exports = router;