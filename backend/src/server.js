require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const geoip = require('geoip-lite');
const cookie = require('cookie');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const User = require('./models/User');
const Session = require('./models/Session');
const { secret: jwtSecret, algorithms: jwtAlgorithms } = require('./utils/jwtConfig');
const { createOriginGuard } = require('./middleware/originGuard');
const limits = require('./middleware/rateLimiters');

// In-memory live stats
const liveStats = {
  activeConnections: 0,
  totalVisitorsToday: 0,
  loggedStudents: 0,
  countries: {}
};
global.liveStats = liveStats;

// Active connected student sockets: Map of userId -> Set of socket IDs
const activeStudentSockets = new Map();
global.activeStudentSockets = activeStudentSockets;

global.isStudentOnline = (userId) => {
  if (!userId) return false;
  const set = activeStudentSockets.get(userId.toString());
  return !!(set && set.size > 0);
};


mongoose.plugin((schema) => {
  if (schema.options && schema.options.skipDataUpdated) return;

  const emitChange = function () {
    const modelName = this?.constructor?.modelName || this?.model?.modelName;
    if (modelName === 'DailyVisitor') return;
    if (global.io) {
      global.io.emit('data_updated', { message: 'Database changed' });
    }
  };

  schema.post('save', emitChange);
  schema.post('findOneAndUpdate', emitChange);
  schema.post('findOneAndDelete', emitChange);
  schema.post('deleteOne', emitChange);
  schema.post('deleteMany', emitChange);
  schema.post('updateOne', emitChange);
  schema.post('updateMany', emitChange);
  schema.post('insertMany', emitChange);
});
const path = require('path');
const cookieParser = require('cookie-parser');
const { renderErrorPage } = require('./utils/errorPage');

const app = express();
if (process.env.TRUST_PROXY_HOPS) {
  const proxyHops = Number(process.env.TRUST_PROXY_HOPS);
  if (!Number.isInteger(proxyHops) || proxyHops < 1 || proxyHops > 10) {
    throw new Error('TRUST_PROXY_HOPS must be an integer from 1 to 10 when configured.');
  }
  app.set('trust proxy', proxyHops);
}
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const { parseAllowedOrigins, isOriginAllowed } = require('./utils/corsOrigins');
const { getRequestEndpoint } = require('./utils/requestHelper');

const allowedOrigins = parseAllowedOrigins(process.env.CLIENT_URL, process.env.ADMIN_URL);

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin, allowedOrigins)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true
};

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: process.env.NODE_ENV === 'production' ? undefined : false
}));
app.use(cors(corsOptions));
app.use(createOriginGuard(isOriginAllowed, allowedOrigins));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb', parameterLimit: 1000 }));
app.use(cookieParser());

// Centralized Audit Logging & Security Monitoring Middleware
const auditMiddleware = require('./middleware/auditMiddleware');
app.use(auditMiddleware);

// Static uploads
app.use('/uploads/tmp', (_req, res) => res.sendStatus(404));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), {
  dotfiles: 'deny',
  index: false,
  setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff')
}));

// Base route - Public without any protection or auth
app.get('/', (req, res) => {
  res.status(200).send('hello server');
});

// Error page preview route
app.get('/error', (req, res) => {
  res.status(500).send(renderErrorPage({
    status: 500,
    title: '500 - Server Error',
    message: 'This is a demo error page to verify that the error handling works.',
    subMessage: 'Server Error Page Preview'
  }));
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'API is running' }));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/courses', require('./routes/courseRoutes'));
app.use('/api/tracks', require('./routes/trackRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/account', require('./routes/accountRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/trainer-certificates', require('./routes/trainerCertificateRoutes'));
app.use('/api/certificates', require('./routes/certificateRoutes'));
app.use('/api/reviews', require('./routes/reviewRoutes'));
app.use('/api/admin', require('./routes/auditRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.put('/api/enrollments/:id/expiry', require('./middleware/admin'), require('./controllers/studentController').updateEnrollmentExpiry);
app.delete('/api/enrollments/:id', require('./middleware/admin'), require('./controllers/studentController').deleteEnrollment);

// Legacy subscription route (kept for backward compat)
app.use('/api/subscriptions', require('./routes/subscriptionRoutes'));

const DailyVisitor = require('./models/DailyVisitor');
const crypto = require('crypto');

function getCairoDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
}

let currentDateStr = getCairoDateString();
const todayVisitedDevices = new Set();
const MAX_TRACKED_DEVICES_PER_DAY = 100000;

// Function to initialize today's visitors from DB on boot or date rollover
async function initTodayVisitors() {
  try {
    const today = getCairoDateString();
    currentDateStr = today;
    todayVisitedDevices.clear();

    const devices = await DailyVisitor.find({ date: today }).distinct('deviceId');
    for (const d of devices) {
      if (d) todayVisitedDevices.add(d);
    }

    liveStats.totalVisitorsToday = todayVisitedDevices.size;
    if (global.io) {
      global.io.emit('live_stats', liveStats);
    }
    console.log(`📊 [Visitors] Initialized for ${today}: ${liveStats.totalVisitorsToday} unique visitors today.`);
  } catch (err) {
    console.error('❌ Error initializing today visitors:', err);
  }
}

async function registerDeviceVisit(deviceId, ip, country, userAgent) {
  if (typeof deviceId !== 'string' || !deviceId.trim() || deviceId.length > 128) return false;

  const today = getCairoDateString();
  if (today !== currentDateStr) {
    await initTodayVisitors();
  }

  // Already visited today
  if (todayVisitedDevices.has(deviceId)) {
    return false;
  }
  if (todayVisitedDevices.size >= MAX_TRACKED_DEVICES_PER_DAY) return false;

  // First visit for this device today
  todayVisitedDevices.add(deviceId);
  liveStats.totalVisitorsToday = todayVisitedDevices.size;

  try {
    await DailyVisitor.collection.updateOne(
      { date: today, deviceId },
      {
        $setOnInsert: {
          date: today,
          deviceId,
          ip: ip || '',
          country: country || 'غير معروف',
          userAgent: userAgent || '',
          visitedAt: new Date(),
          created_at: new Date(),
          updated_at: new Date()
        }
      },
      { upsert: true }
    );
  } catch (err) {
    if (err.code !== 11000) {
      console.error('Error saving daily visitor:', err);
    }
  }

  if (global.io) {
    global.io.emit('live_stats', liveStats);
  }
  return true;
}

global.registerDeviceVisit = registerDeviceVisit;

// Check date rollover every 30 seconds
setInterval(() => {
  const today = getCairoDateString();
  if (today !== currentDateStr) {
    console.log(`🌅 [Visitors] Date rolled over from ${currentDateStr} to ${today}`);
    initTodayVisitors();
  }
}, 30000);

// Optional HTTP visit tracking endpoint
app.post('/api/track-visit', limits.publicWrite, async (req, res) => {
  try {
    let ip = req.ip || req.socket?.remoteAddress || '';
    const userAgent = String(req.headers['user-agent'] || '').slice(0, 512);
    const clientDeviceId = req.body?.deviceId || req.headers['x-device-id'];
    const deviceId = (clientDeviceId && typeof clientDeviceId === 'string' && clientDeviceId.trim() && clientDeviceId.trim().length <= 128)
      ? clientDeviceId.trim()
      : ('ip_' + crypto.createHash('sha256').update(`${ip}_${userAgent}`).digest('hex'));

    await registerDeviceVisit(deviceId, ip, 'غير معروف', userAgent);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false });
  }
});

// MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    await initTodayVisitors();
    try {
      const securityEngine = require('./services/securityEngine');
      await securityEngine.initDefaultRules();
      console.log('🛡️ [Security] Security rules initialized successfully');
    } catch (e) {
      console.error('Failed to init security rules:', e.message);
    }
    try {
      const { syncAllTracksEnrollments } = require('./utils/trackEnrollmentHelper');
      await syncAllTracksEnrollments();
    } catch (e) {
      console.error('Failed to sync track enrollments on startup:', e.message);
    }
  })
  .catch(err => console.error('❌ MongoDB connection error:', err));

// 404 Handler - Page and handler for not found routes
app.use((req, res) => {
  res.status(404);
  if (req.accepts('html')) {
    return res.send(renderErrorPage({
      status: 404,
      title: '404 - Page Not Found',
      message: 'The requested route or page could not be found or has been moved.',
      subMessage: 'The requested URL was not found on this server.'
    }));
  }
  return res.json({ status: 404, message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  const endpoint = getRequestEndpoint(req);

  try {
    const auditService = require('./services/auditService');
    auditService.log({
      request_id: req.id || 'err_' + Date.now(),
      category: 'ERROR',
      severity: (err.status >= 500 || !err.status) ? 'high' : 'medium',
      action: 'unhandled_exception',
      actor: req.user?.userId || null,
      actor_role: req.user?.role || 'anonymous',
      ip: req.clientIp || req.socket?.remoteAddress || '127.0.0.1',
      method: req.method,
      endpoint,
      url: endpoint,
      status_code: err.status || 500,
      summary: `Server exception error: ${err.message || 'Something went wrong'}`,
      details: {
        message: err.message,
        stack: err.stack ? err.stack.split('\n').slice(0, 5).join('\n') : null
      }
    });
  } catch (e) { }

  const status = err.status >= 400 && err.status < 500 ? err.status : 500;
  res.status(status);

  if (req.accepts('html') && !req.path.startsWith('/api/')) {
    return res.send(renderErrorPage({
      status,
      title: status === 500 ? '500 - Server Error' : `${status} - Error`,
      message: status === 500 ? 'An unexpected server error occurred, please try again later.' : (err.message || 'Bad Request'),
      subMessage: status === 500 ? 'Internal Server Error' : err.message
    }));
  }

  return res.json({ message: status === 500 ? 'Internal server error' : (err.message || 'Bad request') });
});

const io = new Server(server, {
  cors: corsOptions
});

const socketConnectionsByIp = new Map();
io.use((socket, next) => {
  const ip = socket.handshake.address || socket.request.connection?.remoteAddress || 'unknown';
  const now = Date.now();
  const current = socketConnectionsByIp.get(ip);
  if (!current || now - current.startedAt >= 10 * 60 * 1000) {
    socketConnectionsByIp.set(ip, { count: 1, startedAt: now });
    return next();
  }
  if (current.count >= 100) return next(new Error('Connection rate limit exceeded'));
  current.count++;
  next();
});
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [ip, entry] of socketConnectionsByIp) {
    if (entry.startedAt < cutoff) socketConnectionsByIp.delete(ip);
  }
}, 10 * 60 * 1000).unref();

app.set('io', io);
global.io = io;

async function authenticateSocket(socket) {
  try {
    const cookies = cookie.parse(socket.request.headers.cookie || '');
    if (!cookies.token) return null;
    const decoded = jwt.verify(cookies.token, jwtSecret, { algorithms: jwtAlgorithms });
    if (!decoded.userId || !decoded.sessionToken) return null;
    const user = await User.findById(decoded.userId).select('_id role is_active session_token').lean();
    if (!user || !user.is_active || user.role !== decoded.role || user.session_token !== decoded.sessionToken) return null;
    if (user.role !== 'admin') {
      const session = await Session.exists({ user: user._id, session_token: decoded.sessionToken });
      if (!session) return null;
    }
    return { userId: user._id.toString(), role: user.role };
  } catch (_err) {
    return null;
  }
}

io.on('connection', async (socket) => {
  const identity = await authenticateSocket(socket);
  socket.isAdmin = identity?.role === 'admin';

  // Send current liveStats immediately to the connected client
  socket.emit('live_stats', liveStats);

  // If admin dashboard connected, do not count as public website visitor or active user connection
  if (socket.isAdmin) {
    return;
  }

  liveStats.activeConnections++;
  if (identity?.role === 'student') {
    socket.studentId = identity.userId;
    if (!activeStudentSockets.has(identity.userId)) activeStudentSockets.set(identity.userId, new Set());
    activeStudentSockets.get(identity.userId).add(socket.id);
    liveStats.loggedStudents = activeStudentSockets.size;
    io.emit('data_updated');
  }

  // Get IP
  const ip = socket.handshake.address || socket.request.connection?.remoteAddress || '';
  const userAgent = String(socket.handshake.headers['user-agent'] || '').slice(0, 512);

  let country = 'غير معروف';
  if (ip && ip !== '127.0.0.1' && ip !== '::1' && ip !== '::ffff:127.0.0.1') {
    const geo = geoip.lookup(ip);
    if (geo && geo.country) country = geo.country;
  }

  if (!liveStats.countries[country]) liveStats.countries[country] = 0;
  liveStats.countries[country]++;

  // Resolve device ID
  let rawDeviceId = socket.handshake.auth?.deviceId;
  if (!rawDeviceId || typeof rawDeviceId !== 'string' || !rawDeviceId.trim() || rawDeviceId.trim().length > 128) {
    rawDeviceId = 'ip_' + crypto.createHash('sha256').update(`${ip}_${userAgent}`).digest('hex');
  }
  const deviceId = rawDeviceId.trim();
  socket.deviceId = deviceId;
  socket.detectedCountry = country;

  // Register device visit (only counts once per device per day)
  await registerDeviceVisit(deviceId, ip, country, userAgent);

  // Broadcast current stats
  io.emit('live_stats', liveStats);

  let identified = false;
  let deviceIdIdentified = false;
  socket.on('identify', async (data) => {
    if (!identified && /^[A-Za-z]{2}$/.test(data?.countryCode || '')) {
      const currentC = socket.detectedCountry || country;
      if (liveStats.countries[currentC] > 0) liveStats.countries[currentC]--;
      if (liveStats.countries[currentC] === 0) delete liveStats.countries[currentC];

      socket.detectedCountry = data.countryCode.toUpperCase();
      if (!liveStats.countries[socket.detectedCountry]) liveStats.countries[socket.detectedCountry] = 0;
      liveStats.countries[socket.detectedCountry]++;
      io.emit('live_stats', liveStats);
      identified = true;
    }

    if (!deviceIdIdentified && data?.deviceId && typeof data.deviceId === 'string' && data.deviceId.trim() && data.deviceId.trim().length <= 128) {
      const newDevId = data.deviceId.trim();
      if (newDevId !== socket.deviceId) {
        socket.deviceId = newDevId;
        await registerDeviceVisit(newDevId, ip, socket.detectedCountry || country, userAgent);
      }
      deviceIdIdentified = true;
    }
  });

  socket.on('disconnect', () => {
    if (socket.isAdmin) return;

    liveStats.activeConnections--;
    const currentC = socket.detectedCountry || country;
    if (liveStats.countries[currentC] > 0) liveStats.countries[currentC]--;
    if (liveStats.countries[currentC] === 0) delete liveStats.countries[currentC];

    if (socket.studentId && activeStudentSockets.has(socket.studentId)) {
      const userSockets = activeStudentSockets.get(socket.studentId);
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        activeStudentSockets.delete(socket.studentId);
        io.emit('data_updated');
      }
    }
    liveStats.loggedStudents = activeStudentSockets.size;

    io.emit('live_stats', liveStats);
  });
});

process.on('uncaughtException', (err) => {
  console.error('❌ [Uncaught Exception]:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ [Unhandled Rejection]:', reason);
});

const PORT = process.env.PORT || 5000;

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ [Server Error] Port ${PORT} is already in use by another process.`);
    console.error(`💡 Solution: Close the application using port ${PORT} or change PORT in your .env file.\n`);
  } else {
    console.error('❌ [Unexpected Server Error]:', err);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 Server is running on: http://localhost:${PORT}`);
  console.log(`📡 Root route (hello server): http://localhost:${PORT}/`);
  console.log(`⚠️  Error page preview: http://localhost:${PORT}/error`);
  console.log(`==================================================\n`);
});
