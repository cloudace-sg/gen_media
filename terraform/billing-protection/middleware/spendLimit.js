const { admin } = require('./firebaseAdmin');

const DAILY_LIMIT = parseInt(process.env.GEMINI_DAILY_LIMIT_PER_USER || '50', 10);

// Firestore path: userSpend/{uid}/daily/{YYYY-MM-DD} → { count, updatedAt }
async function spendLimit(req, res, next) {
  const role = req.user?.role || req.user?.claims?.role;
  if (role === 'admin') return next();

  const uid = req.user?.uid;
  if (!uid) return next();

  const today = new Date().toISOString().slice(0, 10);
  const ref = admin.firestore().doc(`userSpend/${uid}/daily/${today}`);

  try {
    const result = await admin.firestore().runTransaction(async t => {
      const doc = await t.get(ref);
      const count = doc.exists ? doc.data().count : 0;
      if (count >= DAILY_LIMIT) return { blocked: true, count };
      t.set(ref, { count: count + 1, updatedAt: new Date() }, { merge: true });
      return { blocked: false, count: count + 1 };
    });

    if (result.blocked) {
      return res.status(429).json({
        error: 'Daily generation limit reached. Try again tomorrow.',
        limit: DAILY_LIMIT,
        resetAt: `${today}T00:00:00Z (next day UTC)`
      });
    }

    res.setHeader('X-Spend-Count', result.count);
    res.setHeader('X-Spend-Limit', DAILY_LIMIT);
    next();
  } catch (err) {
    // Fail open — Firestore errors must never block legitimate users
    console.error('[spendLimit] fail open:', err.message);
    next();
  }
}

module.exports = { spendLimit };
