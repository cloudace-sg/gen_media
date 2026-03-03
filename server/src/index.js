const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const searchRoutes = require('./routes/search');
const generateRoutes = require('./routes/generate');
const remixRoutes = require('./routes/remix');
const uploadsRoutes = require('./routes/uploads');
const videoRoutes = require('./routes/video');
const brandkitRoutes = require('./routes/brandkit');
const filesRoutes = require('./routes/files');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
// CORS: support multiple allowed origins via ALLOWED_ORIGINS (comma-separated) or fallback to single CLIENT_URL
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
const clientUrlEnv = process.env.CLIENT_URL || 'http://localhost:3000';
const allowedOrigins = (allowedOriginsEnv ? allowedOriginsEnv.split(',') : [clientUrlEnv])
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g., curl) or server-to-server
    if (!origin) return callback(null, true);
    // Allow explicitly configured origins
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Allow Cloud Run hostnames (*.run.app)
    try {
      const { host, protocol } = new URL(origin);
      if (host.endsWith('.run.app') && (protocol === 'https:' || protocol === 'http:')) {
        return callback(null, true);
      }
    } catch (_) {}
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/search', searchRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/remix', remixRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/brandkit', brandkitRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/prompt', require('./routes/prompt'));
app.use('/api/files', filesRoutes);
app.use('/api/styles', require('./routes/styles'));
app.use('/api/billing', require('./routes/billing'));
app.use('/api/users', require('./routes/users'));
app.use('/api/auth', require('./routes/auth'));

// Static serving for uploaded files with permissive CORS so assets can be used cross-origin in canvas
const uploadsDir = path.join(__dirname, '..', 'uploads');
app.use('/uploads', cors({ origin: true, credentials: false, maxAge: 86400 }));
app.use('/uploads', express.static(uploadsDir));

// Serve static files from React build
const buildDir = path.join(__dirname, '..', '..', 'client', 'build');
app.use(express.static(buildDir));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Catch-all handler: send back React's index.html file for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(buildDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
});
