import crypto from 'crypto';

// Runtime secret used for HMAC-SHA256 session cookies, CSRF tokens, and player tokens.
// Uses SESSION_SECRET from env if provided, or generates a strong 256-bit random key per server boot.
const FALLBACK_RUNTIME_SECRET = crypto.randomBytes(32).toString('hex');

export function getSessionSecret(): string {
  const envSecret = process.env.SESSION_SECRET;
  if (envSecret && envSecret.length >= 32 && !envSecret.includes('REPLACE_WITH')) {
    return envSecret;
  }
  return FALLBACK_RUNTIME_SECRET;
}

// -------------------------------------------------------------
// REQUIREMENT 10: Memory-Hard Password & Passphrase Hashing (scrypt + timingSafeEqual)
// -------------------------------------------------------------
const SCRYPT_PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
  keylen: 64,
  maxmem: 32 * 1024 * 1024,
};

/**
 * Hashes a plaintext password using memory-hard scrypt with a unique 16-byte cryptographic salt.
 * Output format: `scrypt$N$r$p$<saltHex>$<derivedKeyHex>`
 */
export async function hashPassword(plaintext: string): Promise<string> {
  if (typeof plaintext !== 'string' || plaintext.length < 8 || plaintext.length > 256) {
    throw new Error('Password must be between 8 and 256 characters');
  }
  const salt = crypto.randomBytes(16);
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(
      plaintext.normalize('NFKC'),
      salt,
      SCRYPT_PARAMS.keylen,
      { N: SCRYPT_PARAMS.N, r: SCRYPT_PARAMS.r, p: SCRYPT_PARAMS.p, maxmem: SCRYPT_PARAMS.maxmem },
      (err, key) => (err ? reject(err) : resolve(key))
    );
  });
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

/**
 * Verifies a plaintext password against a stored scrypt hash using constant-time comparison.
 */
export async function verifyPassword(plaintext: string, storedHash: string): Promise<boolean> {
  try {
    if (!plaintext || !storedHash || typeof plaintext !== 'string' || typeof storedHash !== 'string') {
      return false;
    }
    const parts = storedHash.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') {
      return false;
    }
    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    const salt = Buffer.from(parts[4], 'hex');
    const expectedKey = Buffer.from(parts[5], 'hex');
    if (salt.length < 16 || expectedKey.length !== SCRYPT_PARAMS.keylen) {
      return false;
    }

    const derivedKey = await new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(
        plaintext.normalize('NFKC'),
        salt,
        expectedKey.length,
        { N, r, p, maxmem: SCRYPT_PARAMS.maxmem },
        (err, key) => (err ? reject(err) : resolve(key))
      );
    });

    if (derivedKey.length !== expectedKey.length) return false;
    return crypto.timingSafeEqual(derivedKey, expectedKey);
  } catch {
    return false;
  }
}

// -------------------------------------------------------------
// REQUIREMENT 9: Secure Session Tokens, Cookies & CSRF Protection
// -------------------------------------------------------------
export interface SessionPayload {
  jti: string;
  uid: string;
  email: string;
  role: 'owner' | 'user';
  iat: number;
  exp: number;
}

const revokedSessionIds = new Map<string, number>();

function pruneRevokedSessions() {
  const nowSec = Math.floor(Date.now() / 1000);
  for (const [jti, exp] of revokedSessionIds.entries()) {
    if (exp < nowSec) {
      revokedSessionIds.delete(jti);
    }
  }
}

export function createSignedSessionToken(params: {
  uid: string;
  email: string;
  role: 'owner' | 'user';
  ttlSeconds?: number;
}): { token: string; payload: SessionPayload } {
  const nowSec = Math.floor(Date.now() / 1000);
  const ttl = params.ttlSeconds || 3600; // 1 hour default session lifetime
  const payload: SessionPayload = {
    jti: crypto.randomBytes(16).toString('hex'),
    uid: params.uid,
    email: params.email.toLowerCase().trim(),
    role: params.role,
    iat: nowSec,
    exp: nowSec + ttl,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');
  return {
    token: `${encodedPayload}.${signature}`,
    payload,
  };
}

export function verifySignedSessionToken(token?: string | null): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, providedSig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');

  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as SessionPayload;
    const nowSec = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < nowSec) {
      return null;
    }
    if (revokedSessionIds.has(payload.jti)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function revokeSessionToken(token?: string | null): void {
  const payload = verifySignedSessionToken(token);
  if (payload) {
    pruneRevokedSessions();
    revokedSessionIds.set(payload.jti, payload.exp);
  }
}

export function serializeSecureCookie(
  name: string,
  value: string,
  options: {
    maxAgeSec?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
    path?: string;
  } = {}
): string {
  const isProd = process.env.NODE_ENV === 'production';
  const httpOnly = options.httpOnly !== false;
  const sameSite = options.sameSite || 'Lax';
  const secure = options.secure !== undefined ? options.secure : isProd || sameSite === 'None';
  const cookiePath = options.path || '/';

  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${cookiePath}`, `SameSite=${sameSite}`];
  if (options.maxAgeSec !== undefined) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAgeSec))}`);
  }
  if (httpOnly) {
    parts.push('HttpOnly');
  }
  if (secure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

export function parseCookies(cookieHeader?: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

export function createCsrfToken(sessionId = 'anon'): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(`${sessionId}:${nonce}`)
    .digest('base64url');
  return `${nonce}.${sig}`;
}

export function verifyCsrfToken(csrfToken?: string | null, sessionId = 'anon'): boolean {
  if (!csrfToken || typeof csrfToken !== 'string') return false;
  const parts = csrfToken.split('.');
  if (parts.length !== 2) return false;
  const [nonce, sig] = parts;
  const expected = crypto
    .createHmac('sha256', getSessionSecret())
    .update(`${sessionId}:${nonce}`)
    .digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Generates an HMAC-authenticated token for multiplayer room players to prevent IDOR spoofing.
 */
export function createPlayerRoomToken(roomCode: string, playerId: string): string {
  return crypto
    .createHmac('sha256', getSessionSecret())
    .update(`room:${roomCode.toUpperCase()}:player:${playerId}`)
    .digest('base64url');
}

export function verifyPlayerRoomToken(
  roomCode: string,
  playerId: string,
  token?: string | null
): boolean {
  if (!token) return false;
  const expected = createPlayerRoomToken(roomCode, playerId);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// -------------------------------------------------------------
// REQUIREMENT 6: Cryptographic Firebase ID Token JWT Verification
// -------------------------------------------------------------
const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let cachedGoogleCerts: { certs: Record<string, string>; expiresAt: number } | null = null;

async function getGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedGoogleCerts && now < cachedGoogleCerts.expiresAt) {
    return cachedGoogleCerts.certs;
  }

  const res = await fetch(GOOGLE_CERTS_URL);
  if (!res.ok) {
    throw new Error('Failed to fetch Google SecureToken public certificates');
  }
  const certs = (await res.json()) as Record<string, string>;
  cachedGoogleCerts = {
    certs,
    expiresAt: now + 50 * 60 * 1000, // Cache for 50 minutes
  };
  return certs;
}

export interface VerifiedFirebaseToken {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  exp: number;
  iat: number;
}

/**
 * Verifies a Firebase Auth ID Token (RS256 JWT) cryptographically against Google's X.509 public keys.
 * Rejects unsigned tokens, alg:none, tampered payloads, expired tokens, and wrong project audiences.
 */
export async function verifyFirebaseIdToken(
  idToken: string,
  expectedProjectId?: string
): Promise<VerifiedFirebaseToken | null> {
  try {
    if (!idToken || typeof idToken !== 'string') return null;
    const parts = idToken.trim().split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));

    // Strictly require RS256 and a key ID
    if (header.alg !== 'RS256' || !header.kid || typeof header.kid !== 'string') {
      return null;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp <= nowSec) {
      return null;
    }
    if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) {
      return null;
    }
    if (typeof payload.sub !== 'string' || payload.sub.length === 0 || payload.sub.length > 128) {
      return null;
    }

    if (expectedProjectId) {
      if (payload.aud !== expectedProjectId) return null;
      if (payload.iss !== `https://securetoken.google.com/${expectedProjectId}`) return null;
    }

    const certs = await getGooglePublicCerts();
    const certPem = certs[header.kid];
    if (!certPem) {
      return null;
    }

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${encodedHeader}.${encodedPayload}`);
    verifier.end();

    const signatureBuffer = Buffer.from(encodedSignature, 'base64url');
    const isValidSignature = verifier.verify(certPem, signatureBuffer);
    if (!isValidSignature) {
      return null;
    }

    return {
      uid: payload.sub,
      email: typeof payload.email === 'string' ? payload.email.toLowerCase().trim() : undefined,
      emailVerified: Boolean(payload.email_verified),
      exp: payload.exp,
      iat: payload.iat,
    };
  } catch {
    return null;
  }
}
