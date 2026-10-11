// The local development accounts have a password printed to the terminal and
// every permission. They must never reach a shared or production database.
const UNLOCK_VALUE = 'local-only';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function devAccountRefusal(env) {
  if (env.NODE_ENV === 'production' || env.VERCEL_ENV) {
    return 'Refusing to create development accounts: this is a deployed environment.';
  }
  if (env.VERITAS_ALLOW_DEV_ACCOUNT !== UNLOCK_VALUE) {
    return `Refusing to create development accounts: they get every permission and a password printed here. Set VERITAS_ALLOW_DEV_ACCOUNT=${UNLOCK_VALUE} to run it against your own local database.`;
  }
  let host;
  try {
    host = new URL(env.DATABASE_URL ?? '').hostname;
  } catch {
    return 'Refusing to create development accounts: DATABASE_URL is missing or not a URL.';
  }
  if (!LOCAL_HOSTS.has(host)) {
    return `Refusing to create development accounts: DATABASE_URL points at ${host || 'no host'}, not a database on this machine.`;
  }
  return null;
}

module.exports = { devAccountRefusal, UNLOCK_VALUE };
