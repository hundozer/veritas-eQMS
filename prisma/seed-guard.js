// The demo seed deletes every row in the regulated tables (documents, signatures,
// audit log, users, tenants) before inserting fictional data, including a signature
// manifest nobody signed. It must never reach a real database.
const UNLOCK_VALUE = 'wipe-this-database';

function seedRefusal(env) {
  if (env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production') {
    return 'Refusing to seed: this is a production environment.';
  }
  if (env.VERITAS_ALLOW_DEMO_SEED !== UNLOCK_VALUE) {
    return `Refusing to seed: it deletes all data in the target database. Set VERITAS_ALLOW_DEMO_SEED=${UNLOCK_VALUE} to run it against a disposable local database.`;
  }
  return null;
}

module.exports = { seedRefusal, UNLOCK_VALUE };
