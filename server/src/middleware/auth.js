const { admin } = require('../services/firebaseAdmin');

async function authenticate(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireAdmin(req, res, next) {
  const role = req.user?.role || req.user?.claims?.role;
  if (role === 'admin') return next();
  return res.status(403).json({ error: 'Admin only' });
}

module.exports = { authenticate, requireAdmin };


