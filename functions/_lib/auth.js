const enc = new TextEncoder();
const dec = new TextDecoder();

function bufToB64url(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function strToB64url(str) {
  return bufToB64url(enc.encode(str));
}

function b64urlToStr(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/')
    .padEnd(str.length + (4 - (str.length % 4)) % 4, '=');
  return dec.decode(Uint8Array.from(atob(padded), c => c.charCodeAt(0)));
}

async function hmacKey(secret, usage) {
  return crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]
  );
}

export async function signJWT(payload, secret) {
  const header = strToB64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body   = strToB64url(JSON.stringify(payload));
  const key = await hmacKey(secret, 'sign');
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${header}.${body}`));
  return `${header}.${body}.${bufToB64url(sig)}`;
}

export async function verifyJWT(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  try {
    const padded = sig.replace(/-/g, '+').replace(/_/g, '/')
      .padEnd(sig.length + (4 - (sig.length % 4)) % 4, '=');
    const sigBytes = Uint8Array.from(atob(padded), c => c.charCodeAt(0));
    const key   = await hmacKey(secret, 'verify');
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(`${header}.${body}`));
    if (!valid) return null;
    const payload = JSON.parse(b64urlToStr(body));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getSessionFromRequest(request, secret) {
  const cookie = request.headers.get('Cookie') ?? '';
  const match  = cookie.match(/(?:^|;\s*)session=([^;]+)/);
  if (!match) return null;
  return verifyJWT(match[1], secret);
}

export async function isEmailAllowed(email, db) {
  const normalized = email.toLowerCase();
  if (normalized.endsWith('@carolinasda.org')) return true;
  if (!db) return false;
  const row = await db.prepare('SELECT 1 FROM allowed_emails WHERE email = ?').bind(normalized).first();
  return !!row;
}

export function isAdmin(email, env) {
  const admins = (env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  return admins.includes(email.toLowerCase());
}

export function sessionCookieHeader(token, expiresEpoch, isLocalhost) {
  const expires = new Date(expiresEpoch * 1000).toUTCString();
  const secure  = isLocalhost ? '' : '; Secure';
  return `session=${token}; HttpOnly${secure}; SameSite=Lax; Path=/; Expires=${expires}`;
}
