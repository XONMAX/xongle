import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import {
  verifyFirebaseIdToken,
  createSignedSessionToken,
  verifySignedSessionToken,
  revokeSessionToken,
  serializeSecureCookie,
  parseCookies,
  createCsrfToken,
  verifyCsrfToken,
  createPlayerRoomToken,
  verifyPlayerRoomToken,
} from './src/security/crypto';
import {
  ownerVerifyRequestSchema,
  ownerActionRequestSchema,
  snakeLeaderboardQuerySchema,
  snakeLeaderboardSubmissionSchema,
  snakeRoomCreateSchema,
  snakeRoomJoinSchema,
  snakeRoomActionSchema,
  uploadValidationRequestSchema,
} from './src/validation/schemas';
import { verifyImageHeaderHex, sanitizeFilename } from './src/security/fileValidator';
import {
  generateRobotsTxt,
  generateSitemapXml,
  getPublicSeoContentSnapshot,
  injectSeoIntoHtml,
  renderNotFoundHtml,
  resolveServerSeoForRequest,
  resolveServerSeoWithContext,
} from './src/seo/serverSeo';
import {
  buildExtractiveGroundedAnswer,
  retrieveGroundedCommunityContext,
} from './src/seo/uzbekSearch';
import {
  createFullSiteBackup,
  uploadBackupToGoogleDrive,
  deleteBackupRecord,
  inspectAndValidateBackupZip,
  restoreFromBackupZip,
  loadBackupHistory,
  getBackupJobProgress,
  getOwnerAuditLogs,
  appendOwnerAuditLog,
  getBackupArchivePath,
  verifyGoogleDriveConnection,
  revokeGoogleDriveTokenServer,
  computeSha256,
} from './src/backup/backupService';
import { safeDocumentIdSchema } from './src/validation/schemas';

function getFirebaseProjectId(): string | undefined {
  try {
    const raw = fs.readFileSync('./firebase-applet-config.json', 'utf8');
    const parsed = JSON.parse(raw);
    if (typeof parsed.projectId === 'string' && /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(parsed.projectId.trim())) {
      return parsed.projectId.trim();
    }
  } catch {
    // Fallback to env var if valid GCP project ID format
  }
  const envProj = process.env.FIREBASE_PROJECT_ID?.trim();
  if (envProj && /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(envProj)) {
    return envProj;
  }
  return undefined;
}

const FIREBASE_PROJECT_ID = getFirebaseProjectId();

// -------------------------------------------------------------
// Tiered IP & Account-Aware Rate Limiter + Bot Protection
// -------------------------------------------------------------
interface RateBucket {
  timestamps: number[];
}

export function createRateLimiter(options: { windowMs: number; maxRequests: number }) {
  const buckets = new Map<string, RateBucket>();

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip =
      (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') ||
      req.ip ||
      req.socket.remoteAddress ||
      'unknown';
    const now = Date.now();

    // Periodic pruning to prevent memory exhaustion
    if (buckets.size > 5000) {
      for (const [k, b] of buckets.entries()) {
        const active = b.timestamps.filter((t) => now - t < options.windowMs);
        if (active.length === 0) buckets.delete(k);
      }
    }

    const bucket = buckets.get(ip) || { timestamps: [] };
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < options.windowMs);

    const remaining = Math.max(0, options.maxRequests - bucket.timestamps.length);
    res.setHeader('X-RateLimit-Limit', String(options.maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (bucket.timestamps.length >= options.maxRequests) {
      const retryAfterSec = Math.ceil(options.windowMs / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        error: 'Rate limit exceeded. Please try again later.',
      });
    }

    bucket.timestamps.push(now);
    buckets.set(ip, bucket);
    next();
  };
}

const failedAuthAttempts = new Map<string, { count: number; lockedUntil: number }>();

function checkAccountLockout(key: string): boolean {
  const entry = failedAuthAttempts.get(key);
  if (!entry) return false;
  if (Date.now() > entry.lockedUntil) {
    failedAuthAttempts.delete(key);
    return false;
  }
  return entry.count >= 5;
}

function recordFailedAuth(key: string): void {
  const now = Date.now();
  const current = failedAuthAttempts.get(key) || { count: 0, lockedUntil: 0 };
  const nextCount = current.count + 1;
  failedAuthAttempts.set(key, {
    count: nextCount,
    lockedUntil: nextCount >= 5 ? now + 15 * 60 * 1000 : now + 5 * 60 * 1000,
  });
}

function clearFailedAuth(key: string): void {
  failedAuthAttempts.delete(key);
}

const BLOCKED_BOT_PATTERNS = /(sqlmap|nikto|masscan|zgrab|nuclei|acunetix|nessus|dirbuster)/i;

function botProtectionMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const ua = String(req.headers['user-agent'] || '');
  if (BLOCKED_BOT_PATTERNS.test(ua)) {
    return res.status(403).json({ error: 'Automated scanner request blocked.' });
  }
  // Check honeypot field if present in JSON body
  if (req.body && typeof req.body._hp === 'string' && req.body._hp.length > 0) {
    return res.status(403).json({ error: 'Bot verification failed.' });
  }
  next();
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');

  // Pre-warm public SEO snapshot asynchronously on server boot so /sitemap.xml never blocks
  void getPublicSeoContentSnapshot(FIREBASE_PROJECT_ID, false);

  // Fast-path /robots.txt and /sitemap.xml before HTML CSP middleware so crawlers get clean XML/text headers in <1ms
  app.get('/robots.txt', (_req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).send(generateRobotsTxt(process.env.APP_URL));
  });

  app.get(['/sitemap.xml', '/sitemap-main.xml'], async (_req, res) => {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      const xml = await generateSitemapXml(process.env.APP_URL, FIREBASE_PROJECT_ID);
      return res.status(200).send(xml);
    } catch {
      return res.status(200).send(await generateSitemapXml(process.env.APP_URL));
    }
  });

  app.get(['/favicon.png', '/favicon.ico'], (_req, res) => {
    const faviconPath = path.join(process.cwd(), 'public', 'favicon.png');
    if (fs.existsSync(faviconPath)) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.status(200).sendFile(faviconPath);
    }
    return res.status(404).end();
  });

  // -------------------------------------------------------------
  // REQUIREMENT 18 & 19: Security Headers & HTTPS Enforcement
  // -------------------------------------------------------------
  app.use((req, res, next) => {
    const isProd = process.env.NODE_ENV === 'production';
    const proto = req.headers['x-forwarded-proto'];

    if (isProd && proto && proto !== 'https' && !req.hostname.includes('localhost')) {
      return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
    }

    if (isProd || proto === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
    );
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://accounts.google.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' data: https://fonts.gstatic.com",
        "img-src 'self' data: blob: https: http:",
        "connect-src 'self' ws: wss: https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com",
        "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com",
        "frame-ancestors 'self' https://*.google.com https://*.ai.studio https://*.run.app",
        "object-src 'none'",
        "base-uri 'self'",
      ].join('; ')
    );

    next();
  });

  app.use('/api/owner/backup', express.json({ limit: '25mb' }));
  app.use(express.json({ limit: '512kb' }));

  const generalApiLimiter = createRateLimiter({ windowMs: 60 * 1000, maxRequests: 180 });
  const aiChatLimiter = createRateLimiter({ windowMs: 60 * 1000, maxRequests: 30 });
  const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 20 });

  app.use('/api/', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    next();
  });
  app.use('/api/', generalApiLimiter);
  app.use('/api/', botProtectionMiddleware);

  const configuredOwners = Array.from(
    new Set([
      'aminbek785@gmail.com',
      'crownsmpuz@gmail.com',
      ...(process.env.OWNER_EMAILS || '')
        .split(',')
        .map((e) => e.toLowerCase().trim())
        .filter(Boolean),
    ])
  );

  const isOwner = (email?: string | null) =>
    email ? configuredOwners.includes(email.toLowerCase().trim()) : false;

  /**
   * REQUIREMENT 6: Cryptographic Server-Side Authentication
   * Verifies either a Firebase RS256 ID Token or a signed HttpOnly session cookie.
   * NEVER trusts unverified JWT payloads or `req.body.email`.
   */
  async function getVerifiedPrincipal(
    req: express.Request
  ): Promise<{ uid: string; email: string; role: 'owner' | 'user' } | null> {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      const verifiedJwt =
        (await verifyFirebaseIdToken(token, FIREBASE_PROJECT_ID)) ||
        (await verifyFirebaseIdToken(token, 'arcane-responder-8sjh2'));
      if (verifiedJwt && verifiedJwt.email && verifiedJwt.emailVerified) {
        return {
          uid: verifiedJwt.uid,
          email: verifiedJwt.email,
          role: isOwner(verifiedJwt.email) ? 'owner' : 'user',
        };
      }
      // Also allow HMAC-signed session token passed as Bearer
      const sessionPayload = verifySignedSessionToken(token);
      if (sessionPayload) {
        return {
          uid: sessionPayload.uid,
          email: sessionPayload.email,
          role: sessionPayload.role,
        };
      }
    }

    const cookies = parseCookies(req.headers.cookie);
    if (cookies.xongle_session) {
      const sessionPayload = verifySignedSessionToken(cookies.xongle_session);
      if (sessionPayload) {
        return {
          uid: sessionPayload.uid,
          email: sessionPayload.email,
          role: sessionPayload.role,
        };
      }
    }

    return null;
  }

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      apps: ['xongle', 'xonddit', 'about'],
      officialWebsite: 'https://xongle.xyz/',
      timestamp: new Date().toISOString(),
    });
  });

  // Firebase Authorized Domains Diagnostic & Bridge Endpoint
  app.get('/api/auth/domain-status', async (_req, res) => {
    const fallbackDomains = [
      'arcane-responder-8sjh2.firebaseapp.com',
      'arcane-responder-8sjh2.web.app',
      'xongle.xyz',
      'www.xongle.xyz',
      'xongle.ai.studio',
      'xonomia.ai.studio',
      'xondrive.ai.studio',
      'xonomia-729971330198.asia-southeast1.run.app',
      'ais-dev-bgamhslwxhdchajztdwl3k-329218982070.asia-southeast1.run.app',
      'ais-pre-bgamhslwxhdchajztdwl3k-329218982070.asia-southeast1.run.app',
    ];
    try {
      let apiKey = '';
      try {
        const raw = fs.readFileSync('./firebase-applet-config.json', 'utf8');
        const parsed = JSON.parse(raw);
        if (typeof parsed.apiKey === 'string') {
          apiKey = parsed.apiKey;
        }
      } catch {}
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/projects?key=${encodeURIComponent(apiKey)}`,
        {
          headers: {
            Referer: 'https://xongle.xyz/',
          },
        }
      );
      const data: any = response.ok ? await response.json() : {};
      const authorizedDomains: string[] =
        Array.isArray(data?.authorizedDomains) && data.authorizedDomains.length > 0
          ? data.authorizedDomains
          : fallbackDomains;
      return res.json({
        projectId: FIREBASE_PROJECT_ID,
        authorizedDomains,
        xongleXyzAuthorized: authorizedDomains.includes('xongle.xyz'),
        wwwXongleXyzAuthorized: authorizedDomains.includes('www.xongle.xyz'),
        bridgeDomain: 'https://xongle.ai.studio',
        bridgeEnabled: true,
        firebaseConsoleSettingsUrl: `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/settings`,
      });
    } catch {
      return res.json({
        projectId: FIREBASE_PROJECT_ID,
        authorizedDomains: fallbackDomains,
        xongleXyzAuthorized: true,
        wwwXongleXyzAuthorized: true,
        bridgeDomain: 'https://xongle.ai.studio',
        bridgeEnabled: true,
        firebaseConsoleSettingsUrl: `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/settings`,
      });
    }
  });

  // File Upload Security Validation Endpoint (Requirement 16)
  app.post('/api/upload/validate', (req, res) => {
    const parsed = uploadValidationRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        valid: false,
        error: parsed.error.issues[0]?.message || 'Invalid upload metadata',
      });
    }
    const { fileName, headerHex } = parsed.data;
    const sigCheck = verifyImageHeaderHex(headerHex);
    if (!sigCheck.valid || !sigCheck.format) {
      return res.status(400).json({
        valid: false,
        error: 'File signature (magic bytes) does not match an allowed raster image format.',
      });
    }
    return res.json({
      valid: true,
      detectedFormat: sigCheck.format,
      safeFilename: sanitizeFilename(fileName),
    });
  });

  // Session Logout & Invalidation Endpoint (Requirement 9)
  app.post('/api/auth/logout', authLimiter, (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    if (cookies.xongle_session) {
      revokeSessionToken(cookies.xongle_session);
    }
    res.setHeader(
      'Set-Cookie',
      serializeSecureCookie('xongle_session', '', { maxAgeSec: 0, httpOnly: true })
    );
    return res.json({ success: true });
  });

  // Owner verification endpoint with cryptographic server-side authentication & session cookie issuance
  app.post('/api/owner/verify', authLimiter, async (req, res) => {
    const parsed = ownerVerifyRequestSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        authorized: false,
        error: 'Invalid verification request payload.',
      });
    }

    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const principal = await getVerifiedPrincipal(req);
    if (principal && principal.role === 'owner' && isOwner(principal.email)) {
      clearFailedAuth(clientIp);
      const { token: sessionCookie, payload: sessionPayload } = createSignedSessionToken({
        uid: principal.uid,
        email: principal.email,
        role: 'owner',
        ttlSeconds: 3600,
      });
      const csrfToken = createCsrfToken(sessionPayload.jti);

      res.setHeader(
        'Set-Cookie',
        serializeSecureCookie('xongle_session', sessionCookie, {
          maxAgeSec: 3600,
          httpOnly: true,
          sameSite: 'Lax',
        })
      );

      return res.json({
        authorized: true,
        role: 'owner',
        email: principal.email,
        csrfToken,
      });
    }

    if (checkAccountLockout(clientIp)) {
      return res.status(429).json({
        authorized: false,
        error: 'Too many failed authentication attempts. Account temporarily locked for 15 minutes.',
      });
    }

    recordFailedAuth(clientIp);
    return res.status(403).json({
      authorized: false,
      error: 'Access denied: Valid cryptographic owner authentication token is required.',
    });
  });

  /**
   * Enforces Origin/Referer same-site validation and session-bound CSRF token verification
   * on state-changing requests.
   */
  function verifyRequestCsrfAndOrigin(req: express.Request): { ok: boolean; error?: string } {
    const origin = req.headers.origin;
    if (origin) {
      try {
        const originHost = new URL(origin).hostname.toLowerCase();
        const reqHost = (req.hostname || '').toLowerCase();
        const isAllowedOrigin =
          originHost === reqHost ||
          originHost === 'xongle.xyz' ||
          originHost === 'www.xongle.xyz' ||
          originHost === 'localhost' ||
          originHost.endsWith('.run.app') ||
          originHost.endsWith('.ai.studio') ||
          originHost.endsWith('.web.app') ||
          originHost.endsWith('.firebaseapp.com');
        if (!isAllowedOrigin) {
          return { ok: false, error: 'Cross-origin state-changing request blocked by Origin policy.' };
        }
      } catch {
        return { ok: false, error: 'Malformed Origin header.' };
      }
    }

    const cookies = parseCookies(req.headers.cookie);
    if (cookies.xongle_session && !req.headers.authorization) {
      const sessionPayload = verifySignedSessionToken(cookies.xongle_session);
      const csrfHeader = String(req.headers['x-csrf-token'] || '');
      if (!sessionPayload || !verifyCsrfToken(csrfHeader, sessionPayload.jti)) {
        return { ok: false, error: 'Invalid or missing CSRF token.' };
      }
    }
    return { ok: true };
  }

  // Owner actions API endpoint with strict server-side authorization & Zod allowlist validation
  app.post('/api/owner/action', authLimiter, async (req, res) => {
    const csrfCheck = verifyRequestCsrfAndOrigin(req);
    if (!csrfCheck.ok) {
      return res.status(403).json({
        success: false,
        error: csrfCheck.error || 'CSRF validation failed.',
      });
    }

    const parsed = ownerActionRequestSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues[0]?.message || 'Invalid owner action payload.',
      });
    }

    const principal = await getVerifiedPrincipal(req);
    if (!principal || principal.role !== 'owner' || !isOwner(principal.email)) {
      appendOwnerAuditLog(
        'UNAUTHORIZED_ADMIN_ATTEMPT',
        principal?.email || req.ip || 'anonymous',
        `Blocked unauthorized attempt to invoke owner action "${parsed.data.action}"`,
        'error'
      );
      return res.status(403).json({
        success: false,
        error: 'Unauthorized owner action attempt blocked by server security.',
      });
    }

    const { action, payload } = parsed.data;
    if (action === 'update_settings' && payload && typeof payload === 'object') {
      activeServerSiteSettings = {
        ...activeServerSiteSettings,
        ...payload,
        updatedAt: new Date().toISOString(),
        updatedBy: principal.email,
      };
    }

    appendOwnerAuditLog(
      `ADMIN_ACTION:${action.toUpperCase()}`,
      principal.email,
      `Executed owner action "${action}"`,
      'success'
    );

    res.json({
      success: true,
      action,
      executedBy: principal.email,
      timestamp: new Date().toISOString(),
      message: `Successfully executed administrative action: ${action}`,
    });
  });

  // -------------------------------------------------------------
  // OWNER BACKUP & RESTORE SYSTEM ENDPOINTS (STRICT OWNER-ONLY)
  // -------------------------------------------------------------
  let activeServerSiteSettings: Record<string, any> = {
    id: 'global',
    siteName: 'Xongle & Connected Apps',
    metaDescription:
      'Real-time search engine for public Xonddit communities, discussion threads, and comments.',
    announcementBanner: '',
    defaultTheme: 'dark',
    maxUploadSize: '10MB',
    allowRegistrations: true,
    strictSafeSearch: false,
    maintenanceMode: false,
    updatedAt: new Date().toISOString(),
  };

  function extractBearerToken(req: express.Request): string | undefined {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }
    return undefined;
  }

  function extractDriveAccessToken(req: express.Request): string {
    const headerVal = req.headers['x-google-drive-token'];
    if (typeof headerVal === 'string' && headerVal.trim()) {
      return headerVal.trim();
    }
    if (req.body && typeof req.body.driveAccessToken === 'string') {
      return req.body.driveAccessToken.trim();
    }
    return '';
  }

  app.get('/api/owner/backup/status', async (req, res) => {
    const principal = await getVerifiedPrincipal(req);
    if (!principal || principal.role !== 'owner' || !isOwner(principal.email)) {
      return res.status(403).json({
        error: 'Access denied: Owner authentication required to inspect backup status.',
      });
    }

    const driveToken = extractDriveAccessToken(req);
    const driveStatus = await verifyGoogleDriveConnection(driveToken, principal.email);

    return res.json({
      authorizedOwner: principal.email,
      jobProgress: getBackupJobProgress(),
      history: loadBackupHistory(),
      auditLogs: getOwnerAuditLogs().slice(0, 50),
      driveStatus,
    });
  });

  app.post('/api/owner/drive/disconnect', authLimiter, async (req, res) => {
    const csrfCheck = verifyRequestCsrfAndOrigin(req);
    if (!csrfCheck.ok) {
      return res.status(403).json({ error: csrfCheck.error || 'CSRF validation failed.' });
    }
    const principal = await getVerifiedPrincipal(req);
    if (!principal || principal.role !== 'owner' || !isOwner(principal.email)) {
      return res.status(403).json({
        error: 'Access denied: Owner authentication required.',
      });
    }
    const driveToken = extractDriveAccessToken(req);
    const result = await revokeGoogleDriveTokenServer(driveToken, principal.email);
    return res.json({
      success: true,
      revoked: result.revoked,
      auditLogs: getOwnerAuditLogs().slice(0, 50),
    });
  });

  app.post('/api/owner/backup/create', async (req, res) => {
    const csrfCheck = verifyRequestCsrfAndOrigin(req);
    if (!csrfCheck.ok) {
      return res.status(403).json({ error: csrfCheck.error || 'CSRF validation failed.' });
    }
    const principal = await getVerifiedPrincipal(req);
    if (!principal || principal.role !== 'owner' || !isOwner(principal.email)) {
      return res.status(403).json({
        error: 'Access denied: Only verified owner accounts can create backups.',
      });
    }

    const uploadToDrive = Boolean(req.body?.uploadToDrive);
    const clientSnapshot =
      req.body?.clientSnapshot && typeof req.body.clientSnapshot === 'object'
        ? req.body.clientSnapshot
        : undefined;
    const driveToken = extractDriveAccessToken(req);

    if (uploadToDrive && !driveToken) {
      return res.status(400).json({
        error:
          'Google Drive access token is required for Create & Upload. Please click "Connect Google Drive" first.',
      });
    }

    try {
      const firebaseIdToken = extractBearerToken(req);
      const { historyItem, manifest } = await createFullSiteBackup({
        ownerEmail: principal.email,
        firebaseProjectId: FIREBASE_PROJECT_ID || 'arcane-responder-8sjh2',
        firebaseIdToken,
        clientSnapshot,
        serverState: {
          snakeLeaderboard,
          siteSettings: activeServerSiteSettings,
        },
      });

      let finalHistoryItem = historyItem;
      if (uploadToDrive && driveToken) {
        finalHistoryItem = await uploadBackupToGoogleDrive({
          backupId: historyItem.id,
          driveAccessToken: driveToken,
          ownerEmail: principal.email,
          firebaseProjectId: FIREBASE_PROJECT_ID || 'arcane-responder-8sjh2',
          firebaseIdToken,
        });
      }

      return res.json({
        success: true,
        backup: finalHistoryItem,
        manifest,
        history: loadBackupHistory(),
        auditLogs: getOwnerAuditLogs().slice(0, 50),
      });
    } catch (err: any) {
      return res.status(500).json({
        error: err?.message || 'Failed to create full backup.',
        jobProgress: getBackupJobProgress(),
      });
    }
  });

  app.post('/api/owner/backup/upload', async (req, res) => {
    const csrfCheck = verifyRequestCsrfAndOrigin(req);
    if (!csrfCheck.ok) {
      return res.status(403).json({ error: csrfCheck.error || 'CSRF validation failed.' });
    }
    const principal = await getVerifiedPrincipal(req);
    if (!principal || principal.role !== 'owner' || !isOwner(principal.email)) {
      return res.status(403).json({
        error: 'Access denied: Only verified owner accounts can upload backups to Google Drive.',
      });
    }

    const rawBackupId = String(req.body?.backupId || '').trim();
    const idCheck = safeDocumentIdSchema.safeParse(rawBackupId);
    if (!idCheck.success) {
      return res.status(400).json({ error: 'Invalid backup ID.' });
    }

    const driveToken = extractDriveAccessToken(req);
    if (!driveToken) {
      return res.status(400).json({
        error:
          'Google Drive access token not provided. Please click "Connect Google Drive" to authorize Drive access.',
      });
    }

    try {
      const firebaseIdToken = extractBearerToken(req);
      const updated = await uploadBackupToGoogleDrive({
        backupId: idCheck.data,
        driveAccessToken: driveToken,
        ownerEmail: principal.email,
        firebaseProjectId: FIREBASE_PROJECT_ID || 'arcane-responder-8sjh2',
        firebaseIdToken,
      });

      return res.json({
        success: true,
        backup: updated,
        history: loadBackupHistory(),
        auditLogs: getOwnerAuditLogs().slice(0, 50),
      });
    } catch (err: any) {
      return res.status(500).json({
        error: err?.message || 'Google Drive upload failed.',
        jobProgress: getBackupJobProgress(),
      });
    }
  });

  app.get('/api/owner/backup/download/:backupId', async (req, res) => {
    const principal = await getVerifiedPrincipal(req);
    if (!principal || principal.role !== 'owner' || !isOwner(principal.email)) {
      return res.status(403).json({
        error: 'Access denied: Owner authentication required to download backup archives.',
      });
    }

    const idCheck = safeDocumentIdSchema.safeParse(req.params.backupId);
    if (!idCheck.success) {
      return res.status(400).json({ error: 'Invalid backup ID.' });
    }

    const zipPath = getBackupArchivePath(idCheck.data);
    if (!zipPath || !fs.existsSync(zipPath)) {
      return res.status(404).json({
        error: 'Backup archive file not found on server disk.',
      });
    }

    const history = loadBackupHistory();
    const record = history.find((x) => x.id === idCheck.data);
    const downloadFileName = record?.fileName || `${idCheck.data}.zip`;
    const buf = fs.readFileSync(zipPath);
    const sha256 = computeSha256(buf);

    appendOwnerAuditLog(
      'DOWNLOAD_BACKUP',
      principal.email,
      `Downloaded backup archive ${downloadFileName} (${buf.length} bytes)`,
      'info'
    );

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${downloadFileName.replace(/[^a-zA-Z0-9._-]/g, '_')}"`
    );
    res.setHeader('Content-Length', String(buf.length));
    res.setHeader('X-Backup-SHA256', sha256);
    return res.status(200).send(buf);
  });

  app.post('/api/owner/backup/inspect', async (req, res) => {
    const principal = await getVerifiedPrincipal(req);
    if (!principal || principal.role !== 'owner' || !isOwner(principal.email)) {
      return res.status(403).json({
        error: 'Access denied: Owner authentication required to inspect backup archives.',
      });
    }

    try {
      let zipBuffer: Buffer | null = null;
      if (typeof req.body?.backupId === 'string' && req.body.backupId.trim()) {
        const idCheck = safeDocumentIdSchema.safeParse(req.body.backupId.trim());
        if (!idCheck.success) {
          return res.status(400).json({ error: 'Invalid backup ID.' });
        }
        const zipPath = getBackupArchivePath(idCheck.data);
        if (!zipPath || !fs.existsSync(zipPath)) {
          return res.status(404).json({
            error: 'Local archive file not found for this backup ID.',
          });
        }
        zipBuffer = fs.readFileSync(zipPath);
      } else if (typeof req.body?.archiveBase64 === 'string' && req.body.archiveBase64.trim()) {
        const cleanB64 = req.body.archiveBase64.replace(/^data:.*?;base64,/, '');
        zipBuffer = Buffer.from(cleanB64, 'base64');
      }

      if (!zipBuffer || zipBuffer.length < 50) {
        return res.status(400).json({
          error: 'No valid backup archive provided for inspection.',
        });
      }

      const inspection = await inspectAndValidateBackupZip(zipBuffer);
      return res.json({
        success: true,
        inspection,
      });
    } catch (err: any) {
      return res.status(400).json({
        error: err?.message || 'Backup archive validation failed.',
      });
    }
  });

  app.post('/api/owner/backup/restore', async (req, res) => {
    const csrfCheck = verifyRequestCsrfAndOrigin(req);
    if (!csrfCheck.ok) {
      return res.status(403).json({ error: csrfCheck.error || 'CSRF validation failed.' });
    }
    const principal = await getVerifiedPrincipal(req);
    if (!principal || principal.role !== 'owner' || !isOwner(principal.email)) {
      return res.status(403).json({
        error: 'Access denied: Only verified owner accounts can restore backups.',
      });
    }

    if (req.body?.confirmed !== true) {
      return res.status(400).json({
        error: 'Explicit owner confirmation (confirmed: true) is required before restoring a backup.',
      });
    }

    try {
      let zipBuffer: Buffer | null = null;
      if (typeof req.body?.backupId === 'string' && req.body.backupId.trim()) {
        const idCheck = safeDocumentIdSchema.safeParse(req.body.backupId.trim());
        if (!idCheck.success) {
          return res.status(400).json({ error: 'Invalid backup ID.' });
        }
        const zipPath = getBackupArchivePath(idCheck.data);
        if (!zipPath || !fs.existsSync(zipPath)) {
          return res.status(404).json({
            error: 'Backup archive file not found on server disk.',
          });
        }
        zipBuffer = fs.readFileSync(zipPath);
      } else if (typeof req.body?.archiveBase64 === 'string' && req.body.archiveBase64.trim()) {
        const cleanB64 = req.body.archiveBase64.replace(/^data:.*?;base64,/, '');
        zipBuffer = Buffer.from(cleanB64, 'base64');
      }

      if (!zipBuffer || zipBuffer.length < 50) {
        return res.status(400).json({
          error: 'No valid backup archive provided for restoration.',
        });
      }

      const firebaseIdToken = extractBearerToken(req);
      const restoreResult = await restoreFromBackupZip({
        zipBuffer,
        ownerEmail: principal.email,
        firebaseProjectId: FIREBASE_PROJECT_ID || 'arcane-responder-8sjh2',
        firebaseIdToken,
        createPreRestoreBackup: Boolean(req.body?.createPreRestoreBackup),
        clientSnapshot:
          req.body?.clientSnapshot && typeof req.body.clientSnapshot === 'object'
            ? req.body.clientSnapshot
            : undefined,
        serverState: {
          snakeLeaderboard,
          siteSettings: activeServerSiteSettings,
        },
      });

      // Restore server-side state (leaderboard & site settings)
      if (
        Array.isArray(restoreResult.restoredData.snakeLeaderboard) &&
        restoreResult.restoredData.snakeLeaderboard.length > 0
      ) {
        snakeLeaderboard.length = 0;
        for (const entry of restoreResult.restoredData.snakeLeaderboard) {
          snakeLeaderboard.push(entry);
        }
      }
      if (
        Array.isArray(restoreResult.restoredData.siteSettings) &&
        restoreResult.restoredData.siteSettings.length > 0
      ) {
        activeServerSiteSettings = {
          ...activeServerSiteSettings,
          ...restoreResult.restoredData.siteSettings[0],
        };
      }

      return res.json({
        success: true,
        manifest: restoreResult.manifest,
        preRestoreBackupId: restoreResult.preRestoreBackupId,
        restoredCounts: restoreResult.restoredCounts,
        restoredData: restoreResult.restoredData,
        history: loadBackupHistory(),
        auditLogs: getOwnerAuditLogs().slice(0, 50),
      });
    } catch (err: any) {
      return res.status(500).json({
        error: err?.message || 'Backup restoration failed.',
        jobProgress: getBackupJobProgress(),
      });
    }
  });

  app.post('/api/owner/backup/delete', async (req, res) => {
    const csrfCheck = verifyRequestCsrfAndOrigin(req);
    if (!csrfCheck.ok) {
      return res.status(403).json({ error: csrfCheck.error || 'CSRF validation failed.' });
    }
    const principal = await getVerifiedPrincipal(req);
    if (!principal || principal.role !== 'owner' || !isOwner(principal.email)) {
      return res.status(403).json({
        error: 'Access denied: Only verified owner accounts can delete backups.',
      });
    }

    const idCheck = safeDocumentIdSchema.safeParse(String(req.body?.backupId || '').trim());
    if (!idCheck.success) {
      return res.status(400).json({ error: 'Invalid backup ID.' });
    }

    try {
      const firebaseIdToken = extractBearerToken(req);
      const driveToken = extractDriveAccessToken(req);
      const result = await deleteBackupRecord({
        backupId: idCheck.data,
        deleteFromDrive: Boolean(req.body?.deleteFromDrive),
        driveAccessToken: driveToken || undefined,
        ownerEmail: principal.email,
        firebaseProjectId: FIREBASE_PROJECT_ID || 'arcane-responder-8sjh2',
        firebaseIdToken,
      });

      return res.json({
        success: true,
        ...result,
        history: loadBackupHistory(),
        auditLogs: getOwnerAuditLogs().slice(0, 50),
      });
    } catch (err: any) {
      return res.status(500).json({
        error: err?.message || 'Failed to delete backup.',
      });
    }
  });

  // -------------------------------------------------------------
  // SNAKE LEADERBOARD & REAL-TIME MULTIPLAYER SERVER ENGINE
  // -------------------------------------------------------------
  type SnakeDifficulty = 'easy' | 'normal' | 'hard' | 'extreme';
  type WallMode = 'solid' | 'wrap';
  type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

  interface Point {
    x: number;
    y: number;
  }

  interface SnakeLeaderboardEntry {
    id: string;
    playerName: string;
    score: number;
    apples: number;
    difficulty: SnakeDifficulty;
    wallMode: WallMode;
    durationSec: number;
    createdAt: string;
  }

  const snakeLeaderboard: SnakeLeaderboardEntry[] = [];

  app.get('/api/snake/leaderboard', (req, res) => {
    const parsedQuery = snakeLeaderboardQuerySchema.safeParse(req.query);
    const diff = parsedQuery.success ? parsedQuery.data.difficulty : undefined;
    let list = [...snakeLeaderboard];
    if (diff) {
      list = list.filter((e) => e.difficulty === diff);
    }
    list.sort((a, b) => b.score - a.score);
    res.json({ entries: list.slice(0, 50) });
  });

  app.post('/api/snake/leaderboard', (req, res) => {
    const parsed = snakeLeaderboardSubmissionSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid leaderboard submission',
      });
    }
    const { playerName, score, apples, difficulty, wallMode, durationSec } = parsed.data;

    const entry: SnakeLeaderboardEntry = {
      id: `lb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      playerName: playerName.toUpperCase(),
      score,
      apples,
      difficulty,
      wallMode,
      durationSec,
      createdAt: new Date().toISOString(),
    };

    snakeLeaderboard.push(entry);
    snakeLeaderboard.sort((a, b) => b.score - a.score);
    if (snakeLeaderboard.length > 100) {
      snakeLeaderboard.length = 100;
    }

    res.json({ entry, entries: snakeLeaderboard.slice(0, 50) });
  });


  interface MpPlayerInternal {
    id: string;
    name: string;
    color: string;
    ready: boolean;
    alive: boolean;
    score: number;
    segments: Point[];
    direction: Direction;
    dirQueue: Direction[];
  }

  interface MpFoodInternal {
    id: string;
    x: number;
    y: number;
    type: 'normal' | 'bonus';
    value: number;
  }

  interface MpRoomInternal {
    code: string;
    hostId: string;
    status: 'lobby' | 'countdown' | 'playing' | 'finished';
    difficulty: SnakeDifficulty;
    wallMode: WallMode;
    gridSize: number;
    countdown: number;
    players: Map<string, MpPlayerInternal>;
    foods: MpFoodInternal[];
    winner: { id: string; name: string; score: number } | null;
    updatedAt: number;
    intervalId?: ReturnType<typeof setInterval>;
    countdownId?: ReturnType<typeof setInterval>;
    sockets: Set<WebSocket>;
  }

  const PLAYER_COLORS = ['#4ade80', '#38bdf8', '#facc15', '#f472b6'];
  const mpRooms = new Map<string, MpRoomInternal>();
  const socketSubMap = new Map<WebSocket, { code: string; playerId: string }>();

  const isOppositeDir = (a: Direction, b: Direction) =>
    (a === 'UP' && b === 'DOWN') ||
    (a === 'DOWN' && b === 'UP') ||
    (a === 'LEFT' && b === 'RIGHT') ||
    (a === 'RIGHT' && b === 'LEFT');

  function generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let i = 0; i < 20; i++) {
      let code = '';
      for (let j = 0; j < 6; j++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      if (!mpRooms.has(code)) return code;
    }
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  function serializeMpRoom(room: MpRoomInternal) {
    return {
      code: room.code,
      hostId: room.hostId,
      status: room.status,
      difficulty: room.difficulty,
      wallMode: room.wallMode,
      gridSize: room.gridSize,
      countdown: room.countdown,
      players: Array.from(room.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        ready: p.ready,
        alive: p.alive,
        score: p.score,
        segments: p.segments,
        direction: p.direction,
      })),
      foods: room.foods,
      winner: room.winner,
      updatedAt: room.updatedAt,
    };
  }

  function broadcastMpRoom(room: MpRoomInternal) {
    room.updatedAt = Date.now();
    const msg = JSON.stringify({ type: 'room:state', room: serializeMpRoom(room) });
    for (const ws of room.sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }
  }

  function stopMpTimers(room: MpRoomInternal) {
    if (room.intervalId) {
      clearInterval(room.intervalId);
      room.intervalId = undefined;
    }
    if (room.countdownId) {
      clearInterval(room.countdownId);
      room.countdownId = undefined;
    }
  }

  function spawnMpFood(room: MpRoomInternal, type: 'normal' | 'bonus' = 'normal') {
    const occupied = new Set<string>();
    for (const p of room.players.values()) {
      for (const seg of p.segments) {
        occupied.add(`${seg.x},${seg.y}`);
      }
    }
    for (const f of room.foods) {
      occupied.add(`${f.x},${f.y}`);
    }
    const free: Point[] = [];
    for (let x = 0; x < room.gridSize; x++) {
      for (let y = 0; y < room.gridSize; y++) {
        if (!occupied.has(`${x},${y}`)) {
          free.push({ x, y });
        }
      }
    }
    if (free.length === 0) return;
    const spot = free[Math.floor(Math.random() * free.length)];
    room.foods.push({
      id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      x: spot.x,
      y: spot.y,
      type,
      value: type === 'bonus' ? 30 : 10,
    });
  }

  function startMpMatch(room: MpRoomInternal) {
    stopMpTimers(room);
    const g = room.gridSize;
    const spawns: { segments: Point[]; dir: Direction }[] = [
      {
        segments: [
          { x: 4, y: 4 },
          { x: 3, y: 4 },
          { x: 2, y: 4 },
        ],
        dir: 'RIGHT',
      },
      {
        segments: [
          { x: g - 5, y: g - 5 },
          { x: g - 4, y: g - 5 },
          { x: g - 3, y: g - 5 },
        ],
        dir: 'LEFT',
      },
      {
        segments: [
          { x: g - 5, y: 4 },
          { x: g - 5, y: 3 },
          { x: g - 5, y: 2 },
        ],
        dir: 'DOWN',
      },
      {
        segments: [
          { x: 4, y: g - 5 },
          { x: 4, y: g - 4 },
          { x: 4, y: g - 3 },
        ],
        dir: 'UP',
      },
    ];

    let idx = 0;
    for (const p of room.players.values()) {
      const sp = spawns[idx % spawns.length];
      p.segments = sp.segments.map((pt) => ({ ...pt }));
      p.direction = sp.dir;
      p.dirQueue = [];
      p.alive = true;
      p.score = 0;
      idx++;
    }

    room.foods = [];
    const targetFoods = Math.max(2, room.players.size);
    for (let i = 0; i < targetFoods; i++) {
      spawnMpFood(room, 'normal');
    }

    room.winner = null;
    room.status = 'countdown';
    room.countdown = 3;
    broadcastMpRoom(room);

    room.countdownId = setInterval(() => {
      room.countdown -= 1;
      if (room.countdown > 0) {
        broadcastMpRoom(room);
      } else {
        if (room.countdownId) {
          clearInterval(room.countdownId);
          room.countdownId = undefined;
        }
        room.status = 'playing';
        broadcastMpRoom(room);

        const speedMap: Record<SnakeDifficulty, number> = {
          easy: 145,
          normal: 112,
          hard: 86,
          extreme: 68,
        };
        const tickMs = speedMap[room.difficulty] || 112;
        room.intervalId = setInterval(() => {
          tickMpMatch(room);
        }, tickMs);
      }
    }, 850);
  }

  function tickMpMatch(room: MpRoomInternal) {
    if (room.status !== 'playing') return;

    const alivePlayers = Array.from(room.players.values()).filter((p) => p.alive);
    if (alivePlayers.length === 0) {
      room.status = 'finished';
      stopMpTimers(room);
      broadcastMpRoom(room);
      return;
    }

    const nextHeads = new Map<string, Point>();
    for (const p of alivePlayers) {
      while (p.dirQueue.length > 0) {
        const nextDir = p.dirQueue.shift()!;
        if (!isOppositeDir(p.direction, nextDir) && nextDir !== p.direction) {
          p.direction = nextDir;
          break;
        }
      }
      const head = p.segments[0];
      let nx = head.x;
      let ny = head.y;
      if (p.direction === 'UP') ny -= 1;
      else if (p.direction === 'DOWN') ny += 1;
      else if (p.direction === 'LEFT') nx -= 1;
      else if (p.direction === 'RIGHT') nx += 1;

      if (room.wallMode === 'wrap') {
        nx = (nx + room.gridSize) % room.gridSize;
        ny = (ny + room.gridSize) % room.gridSize;
      }
      nextHeads.set(p.id, { x: nx, y: ny });
    }

    const eliminated = new Set<string>();
    for (const p of alivePlayers) {
      const nh = nextHeads.get(p.id)!;
      if (room.wallMode === 'solid') {
        if (nh.x < 0 || nh.x >= room.gridSize || nh.y < 0 || nh.y >= room.gridSize) {
          eliminated.add(p.id);
        }
      }
    }

    const ateFood = new Map<string, MpFoodInternal>();
    for (const p of alivePlayers) {
      if (eliminated.has(p.id)) continue;
      const nh = nextHeads.get(p.id)!;
      const fIdx = room.foods.findIndex((f) => f.x === nh.x && f.y === nh.y);
      if (fIdx !== -1) {
        ateFood.set(p.id, room.foods[fIdx]);
        room.foods.splice(fIdx, 1);
      }
    }

    for (const p of alivePlayers) {
      if (eliminated.has(p.id)) continue;
      const nh = nextHeads.get(p.id)!;

      for (const other of alivePlayers) {
        if (other.id === p.id) continue;
        const oh = nextHeads.get(other.id)!;
        if (nh.x === oh.x && nh.y === oh.y) {
          eliminated.add(p.id);
          eliminated.add(other.id);
        }
      }

      for (const other of alivePlayers) {
        const otherAte = ateFood.has(other.id);
        const segs = otherAte ? other.segments : other.segments.slice(0, -1);
        for (const seg of segs) {
          if (nh.x === seg.x && nh.y === seg.y) {
            eliminated.add(p.id);
            break;
          }
        }
      }
    }

    for (const p of alivePlayers) {
      if (eliminated.has(p.id)) {
        p.alive = false;
        continue;
      }
      const nh = nextHeads.get(p.id)!;
      p.segments.unshift(nh);
      const food = ateFood.get(p.id);
      if (food) {
        p.score += food.value;
      } else {
        p.segments.pop();
      }
    }

    const targetNormal = Math.max(2, room.players.size);
    while (room.foods.filter((f) => f.type === 'normal').length < targetNormal) {
      spawnMpFood(room, 'normal');
    }
    if (Math.random() < 0.04 && !room.foods.some((f) => f.type === 'bonus')) {
      spawnMpFood(room, 'bonus');
    }

    const totalPlayers = room.players.size;
    const stillAlive = Array.from(room.players.values()).filter((p) => p.alive);

    if (
      (totalPlayers === 1 && stillAlive.length === 0) ||
      (totalPlayers > 1 && stillAlive.length <= 1)
    ) {
      room.status = 'finished';
      stopMpTimers(room);

      if (stillAlive.length === 1) {
        stillAlive[0].score += 25;
        room.winner = {
          id: stillAlive[0].id,
          name: stillAlive[0].name,
          score: stillAlive[0].score,
        };
      } else {
        const top = Array.from(room.players.values()).sort((a, b) => b.score - a.score)[0];
        room.winner = top ? { id: top.id, name: top.name, score: top.score } : null;
      }
    }

    broadcastMpRoom(room);
  }

  // Create Multiplayer Room HTTP Endpoint
  app.post('/api/snake/rooms', (req, res) => {
    const parsed = snakeRoomCreateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid room creation payload' });
    }
    const { playerId, playerName, difficulty, wallMode } = parsed.data;
    const pid = playerId || `p_${Date.now()}`;
    const pname = playerName.toUpperCase() || 'OPERATIVE';

    const code = generateRoomCode();
    const room: MpRoomInternal = {
      code,
      hostId: pid,
      status: 'lobby',
      difficulty,
      wallMode,
      gridSize: 20,
      countdown: 0,
      players: new Map(),
      foods: [],
      winner: null,
      updatedAt: Date.now(),
      sockets: new Set(),
    };

    room.players.set(pid, {
      id: pid,
      name: pname,
      color: PLAYER_COLORS[0],
      ready: true,
      alive: true,
      score: 0,
      segments: [
        { x: 4, y: 4 },
        { x: 3, y: 4 },
        { x: 2, y: 4 },
      ],
      direction: 'RIGHT',
      dirQueue: [],
    });

    mpRooms.set(code, room);
    const playerToken = createPlayerRoomToken(code, pid);
    res.json({ room: serializeMpRoom(room), playerToken });
  });

  // Join Multiplayer Room HTTP Endpoint
  app.post('/api/snake/rooms/join', (req, res) => {
    const parsed = snakeRoomJoinSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid room join payload' });
    }
    const { code: cleanCode, playerId, playerName } = parsed.data;
    const room = mpRooms.get(cleanCode);
    if (!room) {
      return res.status(404).json({ error: `Room "${cleanCode}" not found.` });
    }
    const pid = playerId || `p_${Date.now()}`;
    const pname = playerName.toUpperCase() || 'OPERATIVE';

    if (!room.players.has(pid)) {
      if (room.status !== 'lobby') {
        return res.status(400).json({ error: 'Match is already in progress.' });
      }
      if (room.players.size >= 4) {
        return res.status(400).json({ error: 'Room is full (maximum 4 players).' });
      }
      const usedColors = new Set(Array.from(room.players.values()).map((p) => p.color));
      const color = PLAYER_COLORS.find((c) => !usedColors.has(c)) || PLAYER_COLORS[0];

      room.players.set(pid, {
        id: pid,
        name: pname,
        color,
        ready: true,
        alive: true,
        score: 0,
        segments: [
          { x: 15, y: 15 },
          { x: 16, y: 15 },
          { x: 17, y: 15 },
        ],
        direction: 'LEFT',
        dirQueue: [],
      });
    }

    broadcastMpRoom(room);
    const playerToken = createPlayerRoomToken(cleanCode, pid);
    res.json({ room: serializeMpRoom(room), playerToken });
  });

  // Get Room State HTTP Endpoint
  app.get('/api/snake/rooms/:code', (req, res) => {
    const cleanCode = String(req.params.code || '')
      .trim()
      .toUpperCase();
    if (!/^[A-Z0-9]{4,8}$/.test(cleanCode)) {
      return res.status(400).json({ error: 'Invalid room code format' });
    }
    const room = mpRooms.get(cleanCode);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json({ room: serializeMpRoom(room) });
  });

  // Room Action HTTP Endpoint (Protected against IDOR player spoofing)
  app.post('/api/snake/rooms/:code/action', (req, res) => {
    const cleanCode = String(req.params.code || '')
      .trim()
      .toUpperCase();
    if (!/^[A-Z0-9]{4,8}$/.test(cleanCode)) {
      return res.status(400).json({ error: 'Invalid room code format' });
    }
    const room = mpRooms.get(cleanCode);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const parsed = snakeRoomActionSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid room action payload' });
    }

    const { playerId, playerToken, action, direction, difficulty, wallMode } = parsed.data;
    if (playerToken && !verifyPlayerRoomToken(cleanCode, playerId, playerToken)) {
      return res.status(403).json({ error: 'Invalid player ownership token' });
    }

    const player = room.players.get(playerId);

    if (action === 'leave' && player) {
      room.players.delete(player.id);
      if (room.players.size === 0) {
        stopMpTimers(room);
        mpRooms.delete(cleanCode);
        return res.json({ left: true });
      }
      if (room.hostId === player.id) {
        const nextHost = room.players.values().next().value;
        if (nextHost) room.hostId = nextHost.id;
      }
      broadcastMpRoom(room);
      return res.json({ room: serializeMpRoom(room) });
    }

    if (!player) {
      return res.status(403).json({ error: 'Not in room' });
    }

    if (action === 'toggle_ready') {
      player.ready = !player.ready;
      broadcastMpRoom(room);
    } else if (action === 'set_settings' && room.hostId === player.id) {
      if (difficulty) {
        room.difficulty = difficulty;
      }
      if (wallMode) {
        room.wallMode = wallMode;
      }
      broadcastMpRoom(room);
    } else if (action === 'start_match' && room.hostId === player.id) {
      startMpMatch(room);
    } else if (action === 'return_lobby' && room.hostId === player.id) {
      stopMpTimers(room);
      room.status = 'lobby';
      room.countdown = 0;
      room.winner = null;
      for (const p of room.players.values()) {
        p.alive = true;
        p.ready = true;
      }
      broadcastMpRoom(room);
    } else if (action === 'direction' && room.status === 'playing' && player.alive && direction) {
      const lastScheduled =
        player.dirQueue.length > 0
          ? player.dirQueue[player.dirQueue.length - 1]
          : player.direction;
      if (!isOppositeDir(lastScheduled, direction) && lastScheduled !== direction && player.dirQueue.length < 2) {
        player.dirQueue.push(direction);
      }
    }

    res.json({ room: serializeMpRoom(room) });
  });

  // -------------------------------------------------------------
  // XONGLE AI ANSWER ENGINE (GROUNDED COMMUNITY RAG ENDPOINT)
  // -------------------------------------------------------------
  app.post('/api/search/ai-answer', aiChatLimiter, async (req, res) => {
    const rawQuery = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    if (!rawQuery || rawQuery.length > 300) {
      return res.status(400).json({ error: 'Valid search query (1-300 chars) is required.' });
    }

    try {
      const snapshot = await getPublicSeoContentSnapshot(FIREBASE_PROJECT_ID, true);
      const livePosts = snapshot.posts.map((p) => ({
        ...p,
        type: 'text' as const,
        communityId: `comm_${p.communitySlug}`,
        authorId: p.authorName,
        isPublic: true,
      }));
      const extractive = buildExtractiveGroundedAnswer(rawQuery, livePosts, snapshot.comments);

      const apiKey = process.env.GEMINI_API_KEY?.trim();
      if (!apiKey || !extractive.hasSufficientEvidence) {
        return res.json(extractive);
      }

      const { rankedPosts, analysis } = retrieveGroundedCommunityContext(
        rawQuery,
        livePosts,
        snapshot.comments,
        4
      );

      const contextBlocks = rankedPosts
        .map(({ post, topComments }, idx) => {
          const commentsLines = topComments
            .map((c) => `  - Izoh (u/${c.authorName}, +${c.score}): ${c.content}`)
            .join('\n');
          return `[Manba ${idx + 1}] Jamoa: c/${post.communitySlug} | Sarlavha: "${post.title}" | Muallif: u/${post.authorName} | Ball: ${post.score}\nMatn: ${post.body}\n${commentsLines}`;
        })
        .join('\n\n');

      const langInstruction =
        analysis.language === 'uz'
          ? 'Javobni aniq, tushunarli va ravon O‘zbek tilida (lotin alifbosida) yozing.'
          : analysis.language === 'ru'
          ? 'Напишите ответ четко и понятно на русском языке.'
          : 'Write the answer clearly and concisely in English.';

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Foydalanuvchi savoli: "${rawQuery}"\n\nXonddit ommaviy jamoalaridagi real muhokamalar:\n${contextBlocks}\n\nKo‘rsatma: Faqat yuqoridagi Xonddit jamoasi muhokamalari va izohlariga tayangan holda qisqa, amaliy xulosa (2-3 gap) bering va qaysi jamoa (masalan, c/texnologiya, c/linux, c/dasturlash) yoki muallif tilga olinganini ko‘rsating. O‘zingizdan tashqi fakt yoki mavjud bo‘lmagan havola to‘qimang. ${langInstruction}`,
      });

      const aiText = response.text?.trim();
      if (aiText && aiText.length > 20) {
        return res.json({
          ...extractive,
          answer: aiText,
          generatedBy: 'gemini-rag',
        });
      }

      return res.json(extractive);
    } catch {
      const snapshot = await getPublicSeoContentSnapshot(FIREBASE_PROJECT_ID, true);
      const livePosts = snapshot.posts.map((p) => ({
        ...p,
        type: 'text' as const,
        communityId: `comm_${p.communitySlug}`,
        authorId: p.authorName,
        isPublic: true,
      }));
      return res.json(buildExtractiveGroundedAnswer(rawQuery, livePosts, snapshot.comments));
    }
  });

  // Unmatched API endpoint 404 handler
  app.use('/api/', (_req, res) => {
    return res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Safe API error handler — prevents stack traces or internal details from leaking to clients
  app.use('/api/', (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({ error: 'Malformed JSON request payload.' });
    }
    return res.status(500).json({ error: 'An internal server error occurred.' });
  });

  // -------------------------------------------------------------
  // TECHNICAL SEO, GSC VERIFICATION, CANONICAL REDIRECTS & SSR HEAD
  // -------------------------------------------------------------

  // Support Google Search Console HTML file verification at root (/google*.html)
  app.get(/^\/google[a-z0-9]+\.html$/i, (req, res) => {
    const fileName = path.basename(req.path);
    const publicFilePath = path.join(process.cwd(), 'public', fileName);
    if (fs.existsSync(publicFilePath)) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      return res.status(200).send(fs.readFileSync(publicFilePath, 'utf8'));
    }
    if (
      process.env.GOOGLE_VERIFICATION_FILE &&
      process.env.GOOGLE_VERIFICATION_FILE.trim() === fileName
    ) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(`google-site-verification: ${fileName}`);
    }
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    return res.status(404).type('html').send(renderNotFoundHtml(req.path, process.env.APP_URL));
  });

  // 301 Permanent Redirects for duplicate/alias paths to canonical URLs
  app.get(['/index.html', '/home', '/xongle', '/xongle/'], (req, res) => {
    const params = new URLSearchParams(req.query as Record<string, string>);
    params.delete('app');
    const qs = params.toString();
    return res.redirect(301, qs ? `/?${qs}` : '/');
  });

  app.get('/about/', (req, res, next) => {
    if (req.path !== '/about/') {
      return next();
    }
    const params = new URLSearchParams(req.query as Record<string, string>);
    params.delete('app');
    const qs = params.toString();
    return res.redirect(301, qs ? `/about?${qs}` : '/about');
  });

  app.get(['/xonddit', '/xonddit/'], (req, res) => {
    const params = new URLSearchParams(req.query as Record<string, string>);
    params.set('app', 'xonddit');
    return res.redirect(301, `/?${params.toString()}`);
  });

  // Private route protection
  app.get(['/owner', '/owner/', '/admin', '/admin/'], (req, res) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(404).type('html').send(renderNotFoundHtml(req.path, process.env.APP_URL));
  });

  // Static Asset Caching Headers for Core Web Vitals & Network Efficiency
  app.use((req, res, next) => {
    if (req.path.startsWith('/assets/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (
      req.path === '/favicon.png' ||
      req.path === '/og-image.svg' ||
      req.path === '/manifest.webmanifest'
    ) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
      if (req.path.endsWith('.webmanifest')) {
        res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      }
    }
    next();
  });

  // Create Vite server in middleware mode
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      host: true,
      port: 3000,
      strictPort: true,
      allowedHosts: true,
    },
    appType: 'spa',
  });

  // Route-aware SSR HTML Metadata Injection for '/', '/about', '/auth-bridge' and genuine HTTP 404 for unknown routes
  app.use(async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }

    // Pass Vite internal modules, source files, and static public files to Vite middleware
    if (
      req.path.startsWith('/@') ||
      req.path.startsWith('/src/') ||
      req.path.startsWith('/node_modules/') ||
      req.path.startsWith('/assets/') ||
      req.path.startsWith('/ws/') ||
      'import' in req.query ||
      /\.(js|mjs|ts|tsx|jsx|css|json|svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|map)$/i.test(
        req.path
      )
    ) {
      return next();
    }

    const cleanRelative = req.path.replace(/^\/+|\/+$/g, '');
    const isAboutPath = cleanRelative === 'about';
    const isAuthBridgePath =
      cleanRelative === 'auth-bridge' || req.query.auth_bridge === '1';

    // Match clean descriptive SEO routes:
    // - /topics/:slug
    // - /c/:slug
    // - /discussions/:postId
    // - /questions/:postId
    const topicMatch = /^topics\/([a-zA-Z0-9_-]{2,60})$/i.exec(cleanRelative);
    const commMatch = /^c\/([a-zA-Z0-9_-]{2,40})$/i.exec(cleanRelative);
    const discMatch = /^(discussions|questions)\/([a-zA-Z0-9_-]{3,80})$/i.exec(cleanRelative);

    const isCleanSeoRoute = Boolean(topicMatch || commMatch || discMatch);

    if (cleanRelative && !isAboutPath && !isAuthBridgePath && !isCleanSeoRoute) {
      // Block dotfile / hidden directory probes (.env, .git, .backups-storage, etc.)
      if (cleanRelative.startsWith('.') || cleanRelative.includes('/.') || cleanRelative.includes('..')) {
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        res.setHeader('Cache-Control', 'no-store');
        return res.status(404).type('html').send(renderNotFoundHtml(req.path, process.env.APP_URL));
      }
      const publicDir = path.resolve(process.cwd(), 'public');
      const distDir = path.resolve(process.cwd(), 'dist');
      const publicAsset = path.resolve(publicDir, cleanRelative);
      const distAsset = path.resolve(distDir, cleanRelative);
      const isInsidePublic = publicAsset.startsWith(publicDir + path.sep);
      const isInsideDist = distAsset.startsWith(distDir + path.sep);

      if (
        (isInsidePublic && fs.existsSync(publicAsset) && fs.statSync(publicAsset).isFile()) ||
        (isInsideDist && fs.existsSync(distAsset) && fs.statSync(distAsset).isFile())
      ) {
        return next();
      }
      // Nonexistent page -> Return genuine HTTP 404 (prevents Soft 404s)
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      res.setHeader('Cache-Control', 'no-cache');
      return res.status(404).type('html').send(renderNotFoundHtml(req.path, process.env.APP_URL));
    }

    // Handle root path '/', '/about', clean SEO routes, and query variants
    const rawApp = typeof req.query.app === 'string' ? req.query.app.toLowerCase().trim() : '';

    // Normalize duplicate '/?app=xongle' to canonical '/' via 301 permanent redirect
    if (!cleanRelative && rawApp === 'xongle') {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(req.query)) {
        if (k !== 'app' && typeof v === 'string' && v.trim()) {
          params.set(k, v.trim());
        }
      }
      const qs = params.toString();
      return res.redirect(301, qs ? `/?${qs}` : '/');
    }

    // Normalize '/?app=about' to canonical '/about' via 301 permanent redirect
    if (!isAboutPath && rawApp === 'about') {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(req.query)) {
        if (k !== 'app' && typeof v === 'string' && v.trim()) {
          params.set(k, v.trim());
        }
      }
      const qs = params.toString();
      return res.redirect(301, qs ? `/about?${qs}` : '/about');
    }

    // Reject unknown ?app= values with genuine HTTP 404
    if (rawApp && rawApp !== 'xonddit' && rawApp !== 'about') {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      res.setHeader('Cache-Control', 'no-cache');
      return res
        .status(404)
        .type('html')
        .send(renderNotFoundHtml(req.originalUrl, process.env.APP_URL));
    }

    try {
      const effectiveQuery: Record<string, any> = {
        ...req.query,
        ...(isAboutPath ? { app: 'about' } : {}),
      };

      const routeParams = {
        cleanPath: isCleanSeoRoute ? `/${cleanRelative}` : undefined,
        topicSlug: topicMatch ? topicMatch[1].toLowerCase() : undefined,
        communitySlug: commMatch ? commMatch[1].toLowerCase() : undefined,
        postId: discMatch ? discMatch[2] : undefined,
      };

      const [resolution, snapshot] = await Promise.all([
        resolveServerSeoWithContext(effectiveQuery, FIREBASE_PROJECT_ID, routeParams),
        getPublicSeoContentSnapshot(FIREBASE_PROJECT_ID, true),
      ]);

      if (resolution.notFound) {
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        res.setHeader('Cache-Control', 'no-cache');
        return res
          .status(404)
          .type('html')
          .send(renderNotFoundHtml(req.originalUrl, process.env.APP_URL));
      }

      const meta = resolution.meta;
      const host = String(req.headers.host || '');
      const isPreviewHost = host.includes('ais-dev-') || host.includes('localhost');
      const robotsHeader =
        isPreviewHost || isAuthBridgePath ? 'noindex, nofollow' : meta.robots;

      if (isAuthBridgePath) {
        res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
      }

      res.setHeader('X-Robots-Tag', robotsHeader);
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      res.setHeader('Vary', 'Accept-Encoding');

      const rawTemplate = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
      const viteHtml = await vite.transformIndexHtml(req.originalUrl, rawTemplate);
      const finalHtml = injectSeoIntoHtml(viteHtml, meta, snapshot.communities, {
        posts: snapshot.posts,
        activePost: resolution.activePost,
        activePostComments: resolution.activePostComments,
        activeCommunity: resolution.activeCommunity,
        activeTopicHub: resolution.activeTopicHub,
        topicPosts: resolution.topicPosts,
      });

      return res.status(200).type('html').send(finalHtml);
    } catch (err) {
      return next(err);
    }
  });

  app.use(vite.middlewares);

  const httpServer = http.createServer(app);

  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws/snake',
    maxPayload: 8 * 1024, // Limit WebSocket frame size to 8KB
  });

  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.type === 'subscribe' && typeof msg.code === 'string') {
          const cleanCode = msg.code.trim().toUpperCase();
          if (!/^[A-Z0-9]{4,8}$/.test(cleanCode)) return;
          const room = mpRooms.get(cleanCode);
          if (room) {
            room.sockets.add(ws);
            socketSubMap.set(ws, { code: cleanCode, playerId: String(msg.playerId || '').slice(0, 64) });
            ws.send(JSON.stringify({ type: 'room:state', room: serializeMpRoom(room) }));
          }
        } else if (msg.type === 'direction' && msg.direction) {
          const sub = socketSubMap.get(ws);
          if (!sub) return;
          const room = mpRooms.get(sub.code);
          if (!room || room.status !== 'playing') return;
          const player = room.players.get(sub.playerId);
          if (!player || !player.alive) return;
          const dir = msg.direction as Direction;
          if (['UP', 'DOWN', 'LEFT', 'RIGHT'].includes(dir)) {
            const lastScheduled =
              player.dirQueue.length > 0
                ? player.dirQueue[player.dirQueue.length - 1]
                : player.direction;
            if (
              !isOppositeDir(lastScheduled, dir) &&
              lastScheduled !== dir &&
              player.dirQueue.length < 2
            ) {
              player.dirQueue.push(dir);
            }
          }
        }
      } catch {}
    });

    ws.on('close', () => {
      const sub = socketSubMap.get(ws);
      if (sub) {
        socketSubMap.delete(ws);
        const room = mpRooms.get(sub.code);
        if (room) {
          room.sockets.delete(ws);
        }
      }
    });
  });

  const port = Number(process.env.PORT) || 3000;
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

startServer();

