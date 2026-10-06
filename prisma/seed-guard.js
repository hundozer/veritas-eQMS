// The demo seed inserts fictional tenants, users, documents, audit rows and a
// signature manifest nobody signed. It must never reach a real database.
const UNLOCK_VALUE = 'fictional-demo-data';

function seedRefusal(env) {
  if (env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production') {
    return 'Refusing to seed: this is a production environment.';
  }
  if (env.VERITAS_ALLOW_DEMO_SEED !== UNLOCK_VALUE) {
    return `Refusing to seed: it writes fictional records, including an unsigned signature manifest. Set VERITAS_ALLOW_DEMO_SEED=${UNLOCK_VALUE} to run it against an empty disposable database.`;
  }
  return null;
}

module.exports = { seedRefusal, UNLOCK_VALUE };
