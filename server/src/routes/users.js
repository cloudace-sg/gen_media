const express = require('express');
const router = express.Router();
const { admin } = require('../services/firebaseAdmin');
const { authenticate, requireAdmin } = require('../middleware/auth');
let firestore = null;

try {
  firestore = require('firebase-admin/firestore');
} catch (_) {}

// Public endpoint to check if user exists (for pre-sign-in validation)
router.get('/check/:email', async (req, res) => {
  try {
    const { email } = req.params;
    if (!email) return res.status(400).json({ error: 'Email required' });
    
    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      // User exists - check if disabled
      res.json({ exists: true, disabled: userRecord.disabled || false });
    } catch (e) {
      // User doesn't exist
      if (e.code === 'auth/user-not-found') {
        res.json({ exists: false });
      } else {
        throw e;
      }
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { query = '', role = '', pageToken = '' } = req.query;
    const list = await admin.auth().listUsers(1000, pageToken || undefined);
    let users = list.users.map(u => ({
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      disabled: u.disabled,
      providers: u.providerData.map(p => p.providerId),
      lastSignIn: u.metadata.lastSignInTime,
      created: u.metadata.creationTime,
      role: (u.customClaims && u.customClaims.role) || null,
    }));
    if (query) {
      const q = String(query).toLowerCase();
      users = users.filter(u => (u.email || '').toLowerCase().includes(q) || (u.displayName || '').toLowerCase().includes(q));
    }
    if (role && role !== 'all') {
      users = users.filter(u => u.role === role);
    }
    res.json({ users, nextPageToken: list.pageToken || null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/role', requireAdmin, async (req, res) => {
  try {
    const { uid, role } = req.body || {};
    if (!uid || !['admin', 'editor'].includes(role)) return res.status(400).json({ error: 'Invalid payload' });
    await admin.auth().setCustomUserClaims(uid, { role });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/disable', requireAdmin, async (req, res) => {
  try {
    const { uid, disabled } = req.body || {};
    if (!uid) return res.status(400).json({ error: 'Invalid payload' });
    await admin.auth().updateUser(uid, { disabled: !!disabled });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:uid', requireAdmin, async (req, res) => {
  try {
    const { uid } = req.params;
    await admin.auth().deleteUser(uid);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/invite', requireAdmin, async (req, res) => {
  try {
    const { email, role = 'editor', displayName = '' } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email required' });

    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
    } catch (e) {
      userRecord = await admin.auth().createUser({ email, displayName, emailVerified: false, disabled: false });
    }

    if (displayName && userRecord.displayName !== displayName) {
      await admin.auth().updateUser(userRecord.uid, { displayName });
    }

    await admin.auth().setCustomUserClaims(userRecord.uid, { role });

    const actionCodeSettings = {
      url: process.env.EMAIL_SIGNIN_CONTINUE_URL || (process.env.PUBLIC_APP_URL || ''),
      handleCodeInApp: true,
    };

    let link;
    if (typeof admin.auth().generateSignInWithEmailLink === 'function') {
      try {
        link = await admin.auth().generateSignInWithEmailLink(email, actionCodeSettings);
      } catch (e) {
        link = await admin.auth().generatePasswordResetLink(email);
      }
    } else {
      link = await admin.auth().generatePasswordResetLink(email);
    }

    res.json({ ok: true, link, uid: userRecord.uid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/allowlist', requireAdmin, async (req, res) => {
  try {
    if (!firestore) return res.json({ allowedDomains: [], defaultRole: 'editor', exceptions: [] });
    const { getFirestore } = firestore;
    const db = getFirestore();
    const doc = await db.collection('settings').doc('auth').get();
    res.json(doc.exists ? doc.data() : { allowedDomains: [], defaultRole: 'editor', exceptions: [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/allowlist', requireAdmin, async (req, res) => {
  try {
    if (!firestore) return res.status(200).json({ ok: true });
    const { getFirestore } = firestore;
    const db = getFirestore();
    const { allowedDomains = [], defaultRole = 'editor', exceptions = [] } = req.body || {};
    await db.collection('settings').doc('auth').set({ allowedDomains, defaultRole, exceptions }, { merge: true });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;


