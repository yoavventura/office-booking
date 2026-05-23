require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./src/routes/auth');
const roomRoutes = require('./src/routes/rooms');
const bookingRoutes = require('./src/routes/bookings');
const notificationRoutes = require('./src/routes/notifications');
const userRoutes = require('./src/routes/users');
const salesforceRoutes = require('./src/routes/salesforce');
const settingsRoutes = require('./src/routes/settings');
const { initializeDatabase } = require('./src/database/db');
const { startNotificationJobs } = require('./src/services/notificationService');

const app = express();
const PORT = process.env.PORT || 3001;

const FRONTEND_DIST = path.resolve(__dirname, '..', 'frontend', 'dist');
const isProduction = fs.existsSync(path.join(FRONTEND_DIST, 'index.html'));

console.log('Frontend dist path:', FRONTEND_DIST);
console.log('Production mode (serving built frontend):', isProduction);

app.set('trust proxy', 1); // trust Cloudflare / reverse proxy headers

app.use(cors({
  origin: isProduction ? false : (process.env.FRONTEND_URL || 'http://localhost:5173'),
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Serve static frontend files FIRST (before API routes grab everything)
if (isProduction) {
  app.use(express.static(FRONTEND_DIST));
}

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/salesforce', salesforceRoutes);
app.use('/api/settings', settingsRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Catch-all: send index.html for any unknown route (React Router handles it client-side)
if (isProduction) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

initializeDatabase();
startNotificationJobs();

app.listen(PORT, () => {
  console.log(`Office Booking API running on http://localhost:${PORT}`);
});
