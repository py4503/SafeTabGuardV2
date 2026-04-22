
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

// Connect to MongoDB
connectDB();

app.use(cors());

app.use(express.json({limit:'10mb'}));

app.use(express.urlencoded({ limit: '10mb', extended: true }));

// API Routes
const scanRoutes = require('./routes/api/scan');
const deviceRoutes = require('./routes/api/devices');
const analyticsRoutes = require('./routes/api/analytics');

app.use('/api/scan', scanRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/analytics', analyticsRoutes);

app.get('/health', (req, res) => {
    res.status(200).json({ status: "Awake", timestamp: Date.now() });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`SafeTabGuard V2 Backend running on port ${PORT}`));