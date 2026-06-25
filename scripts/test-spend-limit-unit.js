#!/usr/bin/env node
// Unit test for spendLimit middleware — no server or Firebase token needed.
// Uses an in-memory store to mock Firestore transaction logic.

process.env.GEMINI_DAILY_LIMIT_PER_USER = '3';

const store = {};

const mockFirestore = () => ({
  doc: (path) => ({ path }),
  runTransaction: async (fn) => {
    const t = {
      get: async ({ path }) => {
        const d = store[path];
        return d ? { exists: true, data: () => d } : { exists: false };
      },
      set: ({ path }, data) => {
        store[path] = { ...(store[path] || {}), ...data };
      }
    };
    return fn(t);
  }
});

// Inject mock before requiring spendLimit
require.cache[require.resolve('../server/src/services/firebaseAdmin')] = {
  id: require.resolve('../server/src/services/firebaseAdmin'),
  filename: require.resolve('../server/src/services/firebaseAdmin'),
  loaded: true,
  exports: { admin: { firestore: mockFirestore } }
};

const { spendLimit } = require('../server/src/middleware/spendLimit');

const LIMIT = 3;
const uid = 'test-user-123';

function makeRes() {
  const r = { headers: {}, code: null, body: null };
  r.res = {
    setHeader: (k, v) => { r.headers[k] = v; },
    status: (c) => { r.code = c; return r.res; },
    json: (b) => { r.body = b; }
  };
  return r;
}

async function run() {
  console.log(`\n=== spendLimit unit test (limit=${LIMIT}) ===\n`);
  let passed = 0;
  let failed = 0;

  for (let i = 1; i <= LIMIT + 2; i++) {
    const req = { user: { uid, role: 'user' } };
    const r = makeRes();
    let nextCalled = false;

    await spendLimit(req, r.res, () => { nextCalled = true; });

    if (i <= LIMIT) {
      if (nextCalled && r.headers['X-Spend-Count'] == i) {
        console.log(`  [${i}] PASS — allowed (X-Spend-Count: ${r.headers['X-Spend-Count']})`);
        passed++;
      } else {
        console.log(`  [${i}] FAIL — expected allowed, got code=${r.code} next=${nextCalled}`);
        failed++;
      }
    } else {
      if (r.code === 429 && r.body?.error) {
        console.log(`  [${i}] PASS — 429 blocked: "${r.body.error}"`);
        passed++;
      } else {
        console.log(`  [${i}] FAIL — expected 429, got code=${r.code} next=${nextCalled}`);
        failed++;
      }
    }
  }

  console.log('\n--- Admin bypass test ---');
  const adminReq = { user: { uid: 'admin-uid', role: 'admin' } };
  const adminR = makeRes();
  let adminNext = false;
  await spendLimit(adminReq, adminR.res, () => { adminNext = true; });
  if (adminNext) {
    console.log('  PASS — admin bypasses limit');
    passed++;
  } else {
    console.log('  FAIL — admin was blocked');
    failed++;
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
