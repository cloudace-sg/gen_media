const express = require('express');
const router = express.Router();
const { admin } = require('../services/firebaseAdmin');
let firestore = null;
try { firestore = require('firebase-admin/firestore'); } catch (_) {}

const { authenticate } = require('../middleware/auth');

router.post('/postSignIn', authenticate, async (req, res) => {
  try {
    const email = req.user?.email || '';
    const uid = req.user?.uid;
    if (!uid) return res.json({ ok: true });

    // If user already has a role, allow them
    const roleFromToken = req.user.role;
    if (roleFromToken) return res.json({ ok: true, role: roleFromToken });

    // User doesn't have a role - check if they're in exceptions allowlist
    let exceptions = [];
    let defaultRole = 'editor';
    if (firestore) {
      const { getFirestore } = firestore;
      const db = getFirestore();
      const doc = await db.collection('settings').doc('auth').get();
      if (doc.exists) {
        const data = doc.data() || {};
        exceptions = Array.isArray(data.exceptions) ? data.exceptions : [];
        defaultRole = data.defaultRole || 'editor';
      }
    }

    // If this email is explicitly in exceptions, set role and allow
    const exception = exceptions.find(x => (x.email || '').toLowerCase() === email.toLowerCase());
    if (exception?.role) {
      await admin.auth().setCustomUserClaims(uid, { role: exception.role });
      return res.json({ ok: true, role: exception.role });
    }

    // Trusted domains get the default role automatically
    const trustedDomains = ['cloud-ace.com'];
    const domain = email.split('@')[1]?.toLowerCase();
    if (trustedDomains.includes(domain)) {
      await admin.auth().setCustomUserClaims(uid, { role: defaultRole });
      return res.json({ ok: true, role: defaultRole });
    }

    // No role and not in exceptions → reject (invite-only)
    return res.status(403).json({ error: 'Not invited. Contact an administrator.' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;


