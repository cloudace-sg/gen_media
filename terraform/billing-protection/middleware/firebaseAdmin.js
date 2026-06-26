const admin = require('firebase-admin');

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  } catch (e) {
    console.warn('Firebase Admin initialization skipped or failed:', e.message);
  }
}

module.exports = { admin };
