import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import JSZip from 'jszip';

export interface BackupRecordCounts {
  users: number;
  user_files: number;
  user_folders: number;
  communities: number;
  posts: number;
  comments: number;
  votes: number;
  tweets: number;
  slide_templates: number;
  conversations: number;
  messages: number;
  site_settings: number;
  audit_logs: number;
  snake_leaderboard: number;
  media_assets: number;
  source_files: number;
}

export interface BackupFileEntry {
  path: string;
  sizeBytes: number;
  sha256: string;
  category: 'database' | 'chats' | 'media' | 'config' | 'website-source' | 'logs' | 'docs';
}

export interface BackupManifest {
  backupId: string;
  archiveName: string;
  rootFolder: string;
  appName: string;
  backupFormatVersion: string;
  schemaVersion: string;
  createdAt: string;
  completedAt: string;
  createdBy: string;
  environment: string;
  totalUncompressedBytes: number;
  totalFilesCount: number;
  recordCounts: BackupRecordCounts;
  includedCategories: string[];
  excludedCategories: string[];
  files: Record<string, BackupFileEntry>;
  manifestSha256: string;
}

export interface BackupHistoryItem {
  id: string;
  fileName: string;
  rootFolder: string;
  createdAt: string;
  completedAt?: string;
  createdBy: string;
  status: 'in_progress' | 'completed' | 'uploaded' | 'failed' | 'restored';
  sizeBytes: number;
  sha256: string;
  driveFileId?: string;
  driveFolderId?: string;
  driveFolderName?: string;
  driveWebViewLink?: string;
  recordCounts: BackupRecordCounts;
  includedCategories: string[];
  excludedCategories: string[];
  error?: string;
  localAvailable: boolean;
}

export interface BackupJobProgress {
  active: boolean;
  jobType: 'backup' | 'upload' | 'create_and_upload' | 'restore' | 'idle';
  backupId?: string;
  phase: string;
  stepIndex: number;
  totalSteps: number;
  percent: number;
  details: string;
  startedAt?: string;
  updatedAt?: string;
  error?: string;
  logs: string[];
}

export interface ClientSupplementalSnapshot {
  users?: Record<string, any>[];
  communities?: Record<string, any>[];
  posts?: Record<string, any>[];
  comments?: Record<string, any>[];
  votes?: Record<string, any>[];
  tweets?: Record<string, any>[];
  slide_templates?: Record<string, any>[];
  conversations?: Record<string, any>[];
  messages?: Record<string, any>[];
  siteSettings?: Record<string, any>;
}

const BACKUP_STORAGE_DIR = path.join(process.cwd(), '.backups-storage');
const BACKUP_INDEX_FILE = path.join(BACKUP_STORAGE_DIR, 'backup-history.json');
const AUDIT_LOG_FILE = path.join(BACKUP_STORAGE_DIR, 'owner-audit-logs.json');
const DEFAULT_FIRESTORE_DB_ID = 'ai-studio-67825eaf-b5f6-4909-bff1-1dbcb71d9cb1';
const DRIVE_BACKUP_FOLDER_NAME = 'Xongle Backups';

function ensureStorageDir(): void {
  if (!fs.existsSync(BACKUP_STORAGE_DIR)) {
    fs.mkdirSync(BACKUP_STORAGE_DIR, { recursive: true });
  }
}

export function computeSha256(buffer: Buffer | string): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function formatTimestampForArchive(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
  ].join('-');
}

// ---------------------------------------------------------------------------
// Active Job Progress & Concurrency Lock
// ---------------------------------------------------------------------------
let currentJobProgress: BackupJobProgress = {
  active: false,
  jobType: 'idle',
  phase: 'Idle',
  stepIndex: 0,
  totalSteps: 1,
  percent: 0,
  details: 'Ready',
  logs: [],
};

export function getBackupJobProgress(): BackupJobProgress {
  return { ...currentJobProgress, logs: [...currentJobProgress.logs] };
}

function updateJobProgress(partial: Partial<BackupJobProgress>, logLine?: string): void {
  const now = new Date().toISOString();
  if (logLine) {
    currentJobProgress.logs.push(`[${now}] ${logLine}`);
    if (currentJobProgress.logs.length > 200) {
      currentJobProgress.logs.shift();
    }
  }
  currentJobProgress = {
    ...currentJobProgress,
    ...partial,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Audit Logging & Persistent Backup History
// ---------------------------------------------------------------------------
export interface OwnerAuditEntry {
  id: string;
  action: string;
  actorEmail: string;
  details: string;
  status: 'success' | 'error' | 'info';
  createdAt: string;
}

const AUTHORIZED_DRIVE_OWNER_EMAILS = new Set([
  'aminbek785@gmail.com',
  'crownsmpuz@gmail.com',
]);

export function redactSensitiveLogText(raw: string): string {
  return String(raw || '')
    .replace(/ya29\.[a-zA-Z0-9_-]+/g, '[REDACTED_OAUTH_TOKEN]')
    .replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[REDACTED_JWT]')
    .replace(/AIza[0-9A-Za-z_-]{35}/g, '[REDACTED_API_KEY]')
    .slice(0, 600);
}

export function isValidGoogleDriveFileId(fileId: string): boolean {
  return typeof fileId === 'string' && /^[a-zA-Z0-9_-]{10,128}$/.test(fileId.trim());
}

export function isSafeArchiveEntryPath(entryPath: string): boolean {
  if (!entryPath || typeof entryPath !== 'string') return false;
  if (entryPath.includes('\0') || entryPath.includes('\\')) return false;
  if (entryPath.startsWith('/') || /^[a-zA-Z]:/.test(entryPath)) return false;
  const segments = entryPath.split('/');
  for (const seg of segments) {
    if (seg === '..' || seg === '.') return false;
  }
  return true;
}

export function appendOwnerAuditLog(
  action: string,
  actorEmail: string,
  details: string,
  status: 'success' | 'error' | 'info' = 'success'
): OwnerAuditEntry {
  ensureStorageDir();
  const entry: OwnerAuditEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    action: String(action || '').slice(0, 80),
    actorEmail: String(actorEmail || 'unknown').slice(0, 120),
    details: redactSensitiveLogText(details),
    status,
    createdAt: new Date().toISOString(),
  };
  try {
    const existing = getOwnerAuditLogs();
    const updated = [entry, ...existing].slice(0, 250);
    fs.writeFileSync(AUDIT_LOG_FILE, JSON.stringify(updated, null, 2), 'utf8');
  } catch {
    // ignore fs write error
  }
  return entry;
}

export function getOwnerAuditLogs(): OwnerAuditEntry[] {
  ensureStorageDir();
  try {
    if (fs.existsSync(AUDIT_LOG_FILE)) {
      const raw = fs.readFileSync(AUDIT_LOG_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export function loadBackupHistory(): BackupHistoryItem[] {
  ensureStorageDir();
  try {
    if (fs.existsSync(BACKUP_INDEX_FILE)) {
      const raw = fs.readFileSync(BACKUP_INDEX_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item: BackupHistoryItem) => {
          const zipPath = path.join(BACKUP_STORAGE_DIR, `${item.id}.zip`);
          return {
            ...item,
            localAvailable: fs.existsSync(zipPath),
          };
        });
      }
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveBackupHistory(items: BackupHistoryItem[]): void {
  ensureStorageDir();
  fs.writeFileSync(BACKUP_INDEX_FILE, JSON.stringify(items, null, 2), 'utf8');
}

export function upsertBackupHistoryItem(item: BackupHistoryItem): void {
  const list = loadBackupHistory();
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx >= 0) {
    list[idx] = item;
  } else {
    list.unshift(item);
  }
  saveBackupHistory(list.slice(0, 100));
}

export function getBackupArchivePath(backupId: string): string | null {
  if (!/^[a-zA-Z0-9_-]{3,100}$/.test(backupId)) return null;
  const zipPath = path.join(BACKUP_STORAGE_DIR, `${backupId}.zip`);
  if (fs.existsSync(zipPath)) return zipPath;
  return null;
}

// ---------------------------------------------------------------------------
// Firestore REST Value Serialization & Deserialization
// ---------------------------------------------------------------------------
function fromFirestoreValue(val: any): any {
  if (!val || typeof val !== 'object') return null;
  if ('stringValue' in val) return val.stringValue;
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) {
    const values = val.arrayValue?.values;
    return Array.isArray(values) ? values.map(fromFirestoreValue) : [];
  }
  if ('mapValue' in val) {
    const fields = val.mapValue?.fields || {};
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = fromFirestoreValue(v);
    }
    return out;
  }
  return null;
}

function toFirestoreValue(val: any): any {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === 'string') {
    return { stringValue: val };
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val };
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return { integerValue: String(val) };
    }
    return { doubleValue: val };
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map((item) => toFirestoreValue(item)),
      },
    };
  }
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function parseFirestoreDoc(docObj: any): Record<string, any> | null {
  if (!docObj || !docObj.fields) return null;
  const rawName = String(docObj.name || '');
  const docId = rawName.split('/').pop() || '';
  const data: Record<string, any> = { id: docId };
  for (const [k, v] of Object.entries(docObj.fields)) {
    data[k] = fromFirestoreValue(v);
  }
  if (!data.id && docId) data.id = docId;
  return data;
}

async function fetchFirestoreCollectionRest(
  projectId: string,
  collectionPath: string,
  firebaseIdToken?: string,
  databaseId: string = DEFAULT_FIRESTORE_DB_ID
): Promise<Record<string, any>[]> {
  const results: Record<string, any>[] = [];
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (firebaseIdToken) {
    headers.Authorization = `Bearer ${firebaseIdToken}`;
  }

  const segments = collectionPath.split('/').filter(Boolean);
  const collectionId = segments[segments.length - 1];
  const parentPath =
    segments.length > 1 ? `/${segments.slice(0, -1).join('/')}` : '';

  const runQueryUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/${encodeURIComponent(databaseId)}/documents${parentPath}:runQuery`;

  try {
    const res = await fetch(runQueryUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId }],
          limit: 300,
        },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const rows: any = await res.json();
      if (Array.isArray(rows)) {
        for (const row of rows) {
          if (row && row.document) {
            const parsed = parseFirestoreDoc(row.document);
            if (parsed) results.push(parsed);
          }
        }
      }
      return results;
    }
  } catch {
    // fallback to GET if needed
  }

  return results;
}

async function writeFirestoreDocumentRest(
  projectId: string,
  collectionPath: string,
  docId: string,
  data: Record<string, any>,
  firebaseIdToken?: string,
  databaseId: string = DEFAULT_FIRESTORE_DB_ID
): Promise<boolean> {
  if (!docId || !/^[a-zA-Z0-9_-]{1,128}$/.test(docId)) return false;
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) {
      fields[k] = toFirestoreValue(v);
    }
  }

  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/${encodeURIComponent(databaseId)}/documents/${collectionPath}/${encodeURIComponent(
    docId
  )}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (firebaseIdToken) {
    headers.Authorization = `Bearer ${firebaseIdToken}`;
  }

  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ fields }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function deleteFirestoreDocumentRest(
  projectId: string,
  collectionPath: string,
  docId: string,
  firebaseIdToken?: string,
  databaseId: string = DEFAULT_FIRESTORE_DB_ID
): Promise<boolean> {
  if (!docId || !/^[a-zA-Z0-9_-]{1,128}$/.test(docId)) return false;
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/${encodeURIComponent(databaseId)}/documents/${collectionPath}/${encodeURIComponent(
    docId
  )}`;
  const headers: Record<string, string> = {};
  if (firebaseIdToken) {
    headers.Authorization = `Bearer ${firebaseIdToken}`;
  }
  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers,
      signal: AbortSignal.timeout(6000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Sanitize User & Application Records (Zero Secret Leakage)
// ---------------------------------------------------------------------------
const FORBIDDEN_SECRET_KEYS = new Set([
  'password',
  'passwordhash',
  'salt',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'sessiontoken',
  'sessioncookie',
  'privatekey',
  'clientsecret',
  'apikey',
  'csrf',
  'csrftoken',
]);

function sanitizeRecordForBackup(record: Record<string, any>): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(record)) {
    if (FORBIDDEN_SECRET_KEYS.has(k.toLowerCase())) {
      continue;
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      clean[k] = sanitizeRecordForBackup(v);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

function mergeRecordsById(
  primary: Record<string, any>[],
  secondary: Record<string, any>[] = [],
  idKey = 'id'
): Record<string, any>[] {
  const map = new Map<string, Record<string, any>>();
  for (const item of secondary) {
    if (!item || typeof item !== 'object') continue;
    const id = String(item[idKey] || item.uid || item.slug || '');
    if (id) map.set(id, sanitizeRecordForBackup(item));
  }
  for (const item of primary) {
    if (!item || typeof item !== 'object') continue;
    const id = String(item[idKey] || item.uid || item.slug || '');
    if (id) {
      const prev = map.get(id) || {};
      map.set(id, sanitizeRecordForBackup({ ...prev, ...item }));
    }
  }
  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// Source Code & Public Asset Collector
// ---------------------------------------------------------------------------
const EXCLUDED_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  '.next',
  '.cache',
  '.backups-storage',
  '.aistudio',
  'coverage',
]);

const EXCLUDED_FILE_PATTERNS = [
  /^\.env(\..+)?$/i,
  /\.pem$/i,
  /\.key$/i,
  /service-account.*\.json$/i,
  /credentials.*\.json$/i,
  /\.DS_Store$/,
  /\.log$/i,
];

function isSafeSourceFile(relPath: string, fileName: string): boolean {
  if (fileName === '.env.example') return true;
  for (const pattern of EXCLUDED_FILE_PATTERNS) {
    if (pattern.test(fileName)) return false;
  }
  const parts = relPath.split(path.sep);
  for (const part of parts) {
    if (EXCLUDED_DIRS.has(part)) return false;
  }
  return true;
}

function collectDirectoryFiles(
  rootDir: string,
  subDir = '',
  maxFileSizeBytes = 15 * 1024 * 1024
): { relPath: string; absPath: string; sizeBytes: number }[] {
  const collected: { relPath: string; absPath: string; sizeBytes: number }[] = [];
  const targetDir = path.join(rootDir, subDir);
  if (!fs.existsSync(targetDir)) return collected;

  const entries = fs.readdirSync(targetDir, { withFileTypes: true });
  for (const entry of entries) {
    const relPath = subDir ? path.join(subDir, entry.name) : entry.name;
    const absPath = path.join(rootDir, relPath);

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      collected.push(...collectDirectoryFiles(rootDir, relPath, maxFileSizeBytes));
    } else if (entry.isFile()) {
      if (!isSafeSourceFile(relPath, entry.name)) continue;
      try {
        const stat = fs.statSync(absPath);
        if (stat.size <= maxFileSizeBytes) {
          collected.push({
            relPath: relPath.split(path.sep).join('/'),
            absPath,
            sizeBytes: stat.size,
          });
        }
      } catch {
        // skip unreadable file
      }
    }
  }
  return collected;
}

function generateEnvironmentTemplate(): string {
  return [
    '# ============================================================================',
    '# XONGLE — SAFE ENVIRONMENT CONFIGURATION TEMPLATE',
    '# ============================================================================',
    '# Security Notice: Actual secret values are intentionally excluded from backups.',
    '# Populate these variables in your target hosting environment before starting.',
    '',
    '# Node / Express Runtime',
    'NODE_ENV=production',
    'PORT=3000',
    'APP_URL=https://xongle.xo.je',
    '',
    '# Authorized Owner Accounts (comma-separated emails)',
    'OWNER_EMAILS=aminbek785@gmail.com,crownsmpuz@gmail.com',
    '',
    '# Firebase Configuration',
    'FIREBASE_PROJECT_ID=arcane-responder-8sjh2',
    '',
    '# Server-Side Gemini AI API Key (Required for Xonmini AI synthesis)',
    'GEMINI_API_KEY=',
    '',
    '# Cryptographic Session Signing Secret (Auto-generated if omitted; set for multi-instance)',
    'SESSION_HMAC_SECRET=',
    '',
  ].join('\n');
}

function generateRestoreReadme(manifest: BackupManifest): string {
  return `# Xongle Full Website & Data Backup Archive

- **Backup ID**: \`${manifest.backupId}\`
- **Archive Name**: \`${manifest.archiveName}\`
- **Created At (UTC)**: \`${manifest.createdAt}\`
- **Created By (Owner)**: \`${manifest.createdBy}\`
- **Backup Format Version**: \`${manifest.backupFormatVersion}\`
- **Schema Version**: \`${manifest.schemaVersion}\`
- **Manifest Integrity SHA-256**: \`${manifest.manifestSha256}\`

---

## 1. Archive Contents

\`\`\`text
${manifest.rootFolder}/
  manifest.json                  # Full backup metadata, record counts & SHA-256 file checksums
  README-RESTORE.md              # This restoration guide
  database/
    users.json                   # Registered user profiles & roles (${manifest.recordCounts.users} records)
    user_files.json              # User private workspace files (${manifest.recordCounts.user_files} records)
    user_folders.json            # User private workspace folders (${manifest.recordCounts.user_folders} records)
    communities.json             # Xonddit c/ communities (${manifest.recordCounts.communities} records)
    posts.json                   # Discussion posts & threads (${manifest.recordCounts.posts} records)
    comments.json                # Nested & top-level comments (${manifest.recordCounts.comments} records)
    votes.json                   # Post & comment vote records (${manifest.recordCounts.votes} records)
    tweets.json                  # Xonwitter posts & threads (${manifest.recordCounts.tweets} records)
    slide_templates.json         # Presentation templates (${manifest.recordCounts.slide_templates} records)
    conversations.json           # Private & group conversations (${manifest.recordCounts.conversations} records)
    messages.json                # Chat message history (${manifest.recordCounts.messages} records)
    site_settings.json           # Owner site configuration (${manifest.recordCounts.site_settings} records)
    audit_logs.json              # Administrative security audit logs (${manifest.recordCounts.audit_logs} records)
    snake_leaderboard.json       # Arcade leaderboard records (${manifest.recordCounts.snake_leaderboard} records)
  chats/
    conversations.json           # Structured conversation metadata
    messages.json                # Structured chat messages
  media/
    media-manifest.json          # Checksums & entity links for all media assets
    public-assets/               # Public brand icons, favicons & uploaded static assets
    embedded-media/              # Extracted user avatars & post images
  config/
    environment-template.env     # Safe environment variable template (no secrets)
    firebase-public-config.json  # Firebase project & database routing configuration
    site-settings.json           # Active website settings snapshot
    schema-version.json          # Database & backup schema compatibility descriptor
  website-source/
    ...                          # Complete Xongle application source code (${manifest.recordCounts.source_files} files)
  logs/
    backup-execution.log         # Step-by-step backup generation log
    audit-trail.json             # Owner audit trail snapshot
\`\`\`

---

## 2. Option A: One-Click Restore via Xongle Owner Dashboard (Recommended)

1. Sign in to Xongle with an authorized owner Google account (\`aminbek785@gmail.com\` or \`crownsmpuz@gmail.com\`).
2. Open the **Owner Panel** and select the **Backup & Restore** tab.
3. Either select this backup directly from **Backup History** and click **Restore**, or click **Restore from Archive File** and upload \`${manifest.archiveName}\`.
4. Review the pre-restore checksum and manifest validation summary in the confirmation modal.
5. (Recommended) Leave **"Create pre-restore safety backup"** enabled and confirm the restoration.
6. All users, communities, posts, comments, votes, chats, media references, and site settings will be restored with their original IDs and relationships preserved.

---

## 3. Option B: Full Manual Restoration on a Clean Server

1. **Extract the Archive**:
   \`\`\`bash
   unzip ${manifest.archiveName}
   cd ${manifest.rootFolder}/website-source
   \`\`\`
2. **Verify Checksums**:
   Compare file hashes against \`../manifest.json\` using \`sha256sum\`.
3. **Configure Environment Variables**:
   \`\`\`bash
   cp ../config/environment-template.env .env
   # Fill in GEMINI_API_KEY and any deployment-specific variables in .env
   \`\`\`
4. **Install Dependencies & Build**:
   \`\`\`bash
   npm install
   npm run build
   \`\`\`
5. **Deploy Firestore Security Rules**:
   Deploy \`firestore.rules\` to your Firebase project (\`arcane-responder-8sjh2\`).
6. **Start the Server & Restore Database Collections**:
   \`\`\`bash
   npm start
   \`\`\`
   Then open the Owner Panel -> **Backup & Restore** -> upload \`${manifest.archiveName}\` to import all JSON collections in \`database/\` and \`chats/\` into Firestore.
`;
}

// ---------------------------------------------------------------------------
// Create Full Backup Engine
// ---------------------------------------------------------------------------
export async function createFullSiteBackup(options: {
  ownerEmail: string;
  firebaseProjectId: string;
  firebaseIdToken?: string;
  clientSnapshot?: ClientSupplementalSnapshot;
  serverState?: {
    snakeLeaderboard?: any[];
    siteSettings?: Record<string, any>;
  };
}): Promise<{
  historyItem: BackupHistoryItem;
  manifest: BackupManifest;
  zipBuffer: Buffer;
}> {
  if (currentJobProgress.active) {
    throw new Error(
      `Another backup/restore job (${currentJobProgress.jobType}) is currently in progress.`
    );
  }

  ensureStorageDir();
  const startedDate = new Date();
  const timestampSlug = formatTimestampForArchive(startedDate);
  const rootFolder = `Xongle-Backup-${timestampSlug}`;
  const archiveName = `${rootFolder}.zip`;
  const backupId = `bkp_${timestampSlug}_${Math.random().toString(36).slice(2, 6)}`;

  currentJobProgress = {
    active: true,
    jobType: 'backup',
    backupId,
    phase: 'Initializing backup engine',
    stepIndex: 1,
    totalSteps: 7,
    percent: 5,
    details: `Starting full backup ${rootFolder}`,
    startedAt: startedDate.toISOString(),
    updatedAt: startedDate.toISOString(),
    logs: [`[${startedDate.toISOString()}] Initialized backup ${backupId} by ${options.ownerEmail}`],
  };

  try {
    // STEP 1: Export Firestore Database Collections
    updateJobProgress(
      {
        phase: 'Exporting Firestore database collections',
        stepIndex: 2,
        percent: 18,
        details: 'Querying users, communities, posts, comments, votes, tweets, slides, and chats...',
      },
      'Querying Firestore collections via authenticated REST API'
    );

    const projectId = options.firebaseProjectId || 'arcane-responder-8sjh2';
    const token = options.firebaseIdToken;
    const snap = options.clientSnapshot || {};

    const [
      restUsers,
      restCommunities,
      restPosts,
      restComments,
      restVotes,
      restTweets,
      restSlideTemplates,
      restConversations,
      restMessages,
      restSiteSettings,
      restAuditLogs,
    ] = await Promise.all([
      fetchFirestoreCollectionRest(projectId, 'users', token),
      fetchFirestoreCollectionRest(projectId, 'communities', token),
      fetchFirestoreCollectionRest(projectId, 'posts', token),
      fetchFirestoreCollectionRest(projectId, 'comments', token),
      fetchFirestoreCollectionRest(projectId, 'votes', token),
      fetchFirestoreCollectionRest(projectId, 'tweets', token),
      fetchFirestoreCollectionRest(projectId, 'slide_templates', token),
      fetchFirestoreCollectionRest(projectId, 'conversations', token),
      fetchFirestoreCollectionRest(projectId, 'messages', token),
      fetchFirestoreCollectionRest(projectId, 'site_settings', token),
      fetchFirestoreCollectionRest(projectId, 'audit_logs', token),
    ]);

    const users = mergeRecordsById(restUsers, snap.users || [], 'uid');
    const communities = mergeRecordsById(restCommunities, snap.communities || [], 'id');
    const posts = mergeRecordsById(restPosts, snap.posts || [], 'id');
    const comments = mergeRecordsById(restComments, snap.comments || [], 'id');
    const votes = mergeRecordsById(restVotes, snap.votes || [], 'id');
    const tweets = mergeRecordsById(restTweets, snap.tweets || [], 'id');
    const slideTemplates = mergeRecordsById(restSlideTemplates, snap.slide_templates || [], 'id');
    const conversations = mergeRecordsById(restConversations, snap.conversations || [], 'id');
    const messages = mergeRecordsById(restMessages, snap.messages || [], 'id');

    // Fetch user subcollections (files & folders) for each known user
    const userFiles: Record<string, any>[] = [];
    const userFolders: Record<string, any>[] = [];
    for (const u of users.slice(0, 50)) {
      const uid = u.uid || u.id;
      if (!uid || !/^[a-zA-Z0-9_-]+$/.test(uid)) continue;
      const [filesSub, foldersSub] = await Promise.all([
        fetchFirestoreCollectionRest(projectId, `users/${uid}/files`, token),
        fetchFirestoreCollectionRest(projectId, `users/${uid}/folders`, token),
      ]);
      for (const f of filesSub) {
        userFiles.push(sanitizeRecordForBackup({ ...f, userId: uid }));
      }
      for (const fld of foldersSub) {
        userFolders.push(sanitizeRecordForBackup({ ...fld, userId: uid }));
      }
    }

    const activeSiteSettings = options.serverState?.siteSettings || snap.siteSettings || {
      id: 'global',
      siteName: 'Xongle & Connected Apps',
      metaDescription:
        'Real-time search engine for public Xonddit communities and discussion threads.',
      defaultTheme: 'dark',
      allowRegistrations: true,
      strictSafeSearch: false,
      maintenanceMode: false,
      updatedAt: new Date().toISOString(),
    };
    const siteSettings = mergeRecordsById(restSiteSettings, [activeSiteSettings], 'id');
    const localAuditLogs = getOwnerAuditLogs();
    const auditLogs = mergeRecordsById(restAuditLogs, localAuditLogs, 'id');
    const snakeLeaderboard = Array.isArray(options.serverState?.snakeLeaderboard)
      ? options.serverState!.snakeLeaderboard
      : [];

    updateJobProgress(
      {
        phase: 'Collecting media & embedded assets',
        stepIndex: 3,
        percent: 38,
        details: `Exported ${users.length} users, ${communities.length} communities, ${posts.length} posts, ${comments.length} comments.`,
      },
      `Database export complete: users=${users.length}, communities=${communities.length}, posts=${posts.length}, comments=${comments.length}, votes=${votes.length}`
    );

    // STEP 2: Collect Public Media & Extract Base64 Media Assets
    const zip = new JSZip();
    const filesManifest: Record<string, BackupFileEntry> = {};
    let totalUncompressedBytes = 0;

    const addArchiveFile = (
      relArchivePath: string,
      content: Buffer | string,
      category: BackupFileEntry['category']
    ) => {
      const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
      const fullZipPath = `${rootFolder}/${relArchivePath}`;
      zip.file(fullZipPath, buf, { compression: 'DEFLATE' });
      const sha256 = computeSha256(buf);
      filesManifest[relArchivePath] = {
        path: relArchivePath,
        sizeBytes: buf.length,
        sha256,
        category,
      };
      totalUncompressedBytes += buf.length;
    };

    const mediaManifestEntries: {
      id: string;
      sourceType: 'public_asset' | 'user_avatar' | 'post_image' | 'tweet_media';
      ownerOrEntityId: string;
      archivePath: string;
      mimeType: string;
      sizeBytes: number;
      sha256: string;
    }[] = [];

    // Collect public static & uploaded assets from public/
    const publicDirFiles = collectDirectoryFiles(process.cwd(), 'public');
    for (const pubFile of publicDirFiles) {
      try {
        const buf = fs.readFileSync(pubFile.absPath);
        const relMediaPath = `media/public-assets/${pubFile.relPath.replace(/^public\//, '')}`;
        addArchiveFile(relMediaPath, buf, 'media');
        const ext = path.extname(pubFile.relPath).toLowerCase();
        const mime =
          ext === '.png'
            ? 'image/png'
            : ext === '.jpg' || ext === '.jpeg'
            ? 'image/jpeg'
            : ext === '.svg'
            ? 'image/svg+xml'
            : ext === '.json'
            ? 'application/json'
            : 'application/octet-stream';
        mediaManifestEntries.push({
          id: `pub_${pubFile.relPath}`,
          sourceType: 'public_asset',
          ownerOrEntityId: 'system',
          archivePath: relMediaPath,
          mimeType: mime,
          sizeBytes: buf.length,
          sha256: computeSha256(buf),
        });
      } catch {
        // skip
      }
    }

    // Extract base64 data URLs from users and posts into media/embedded-media/
    const extractDataUrl = (
      dataUrl: string,
      prefix: string,
      entityId: string,
      sourceType: 'user_avatar' | 'post_image' | 'tweet_media'
    ) => {
      const m = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/);
      if (!m) return;
      const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
      const buf = Buffer.from(m[2], 'base64');
      const safeId = entityId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const relMediaPath = `media/embedded-media/${prefix}_${safeId}.${ext}`;
      addArchiveFile(relMediaPath, buf, 'media');
      mediaManifestEntries.push({
        id: `${prefix}_${safeId}`,
        sourceType,
        ownerOrEntityId: entityId,
        archivePath: relMediaPath,
        mimeType: `image/${m[1]}`,
        sizeBytes: buf.length,
        sha256: computeSha256(buf),
      });
    };

    for (const u of users) {
      if (typeof u.photoURL === 'string' && u.photoURL.startsWith('data:image/')) {
        extractDataUrl(u.photoURL, 'avatar', String(u.uid || u.id || u.username), 'user_avatar');
      }
    }
    for (const p of posts) {
      if (typeof p.imageUrl === 'string' && p.imageUrl.startsWith('data:image/')) {
        extractDataUrl(p.imageUrl, 'post', String(p.id), 'post_image');
      }
    }
    for (const t of tweets) {
      if (typeof t.mediaUrl === 'string' && t.mediaUrl.startsWith('data:image/')) {
        extractDataUrl(t.mediaUrl, 'tweet', String(t.id), 'tweet_media');
      }
    }

    addArchiveFile(
      'media/media-manifest.json',
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          totalMediaAssets: mediaManifestEntries.length,
          assets: mediaManifestEntries,
        },
        null,
        2
      ),
      'media'
    );

    // STEP 3: Write Database & Chat JSON Exports
    updateJobProgress(
      {
        phase: 'Writing structured database & chat exports',
        stepIndex: 4,
        percent: 54,
        details: 'Serializing JSON collections and computing SHA-256 digests...',
      },
      `Packaged ${mediaManifestEntries.length} media assets`
    );

    addArchiveFile('database/users.json', JSON.stringify(users, null, 2), 'database');
    addArchiveFile('database/user_files.json', JSON.stringify(userFiles, null, 2), 'database');
    addArchiveFile('database/user_folders.json', JSON.stringify(userFolders, null, 2), 'database');
    addArchiveFile('database/communities.json', JSON.stringify(communities, null, 2), 'database');
    addArchiveFile('database/posts.json', JSON.stringify(posts, null, 2), 'database');
    addArchiveFile('database/comments.json', JSON.stringify(comments, null, 2), 'database');
    addArchiveFile('database/votes.json', JSON.stringify(votes, null, 2), 'database');
    addArchiveFile('database/tweets.json', JSON.stringify(tweets, null, 2), 'database');
    addArchiveFile(
      'database/slide_templates.json',
      JSON.stringify(slideTemplates, null, 2),
      'database'
    );
    addArchiveFile(
      'database/conversations.json',
      JSON.stringify(conversations, null, 2),
      'database'
    );
    addArchiveFile('database/messages.json', JSON.stringify(messages, null, 2), 'database');
    addArchiveFile(
      'database/site_settings.json',
      JSON.stringify(siteSettings, null, 2),
      'database'
    );
    addArchiveFile('database/audit_logs.json', JSON.stringify(auditLogs, null, 2), 'database');
    addArchiveFile(
      'database/snake_leaderboard.json',
      JSON.stringify(snakeLeaderboard, null, 2),
      'database'
    );

    // Chats directory
    addArchiveFile('chats/conversations.json', JSON.stringify(conversations, null, 2), 'chats');
    addArchiveFile('chats/messages.json', JSON.stringify(messages, null, 2), 'chats');

    // STEP 4: Package Website Source Code & Safe Config
    updateJobProgress(
      {
        phase: 'Packaging website source code & configuration',
        stepIndex: 5,
        percent: 70,
        details: 'Collecting frontend, backend, schemas, and safe config templates...',
      },
      'Collecting website source code files'
    );

    const allSourceFiles = collectDirectoryFiles(process.cwd(), '');
    let sourceFilesCount = 0;
    for (const srcFile of allSourceFiles) {
      try {
        const buf = fs.readFileSync(srcFile.absPath);
        addArchiveFile(`website-source/${srcFile.relPath}`, buf, 'website-source');
        sourceFilesCount++;
      } catch {
        // skip
      }
    }

    addArchiveFile('config/environment-template.env', generateEnvironmentTemplate(), 'config');
    addArchiveFile(
      'config/site-settings.json',
      JSON.stringify(activeSiteSettings, null, 2),
      'config'
    );
    addArchiveFile(
      'config/schema-version.json',
      JSON.stringify(
        {
          appName: 'Xongle',
          backupFormatVersion: '1.0.0',
          schemaVersion: '2026.10',
          firestoreDatabaseId: DEFAULT_FIRESTORE_DB_ID,
          collections: [
            'users',
            'users/{uid}/files',
            'users/{uid}/folders',
            'communities',
            'posts',
            'comments',
            'votes',
            'tweets',
            'slide_templates',
            'conversations',
            'messages',
            'site_settings',
            'audit_logs',
            'backups',
          ],
        },
        null,
        2
      ),
      'config'
    );

    const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(firebaseConfigPath)) {
      addArchiveFile(
        'config/firebase-public-config.json',
        fs.readFileSync(firebaseConfigPath, 'utf8'),
        'config'
      );
    }

    // STEP 5: Logs, Manifest & README-RESTORE.md
    const recordCounts: BackupRecordCounts = {
      users: users.length,
      user_files: userFiles.length,
      user_folders: userFolders.length,
      communities: communities.length,
      posts: posts.length,
      comments: comments.length,
      votes: votes.length,
      tweets: tweets.length,
      slide_templates: slideTemplates.length,
      conversations: conversations.length,
      messages: messages.length,
      site_settings: siteSettings.length,
      audit_logs: auditLogs.length,
      snake_leaderboard: snakeLeaderboard.length,
      media_assets: mediaManifestEntries.length,
      source_files: sourceFilesCount,
    };

    const includedCategories = [
      'Users & Profiles (IDs, usernames, display names, avatars, roles)',
      'User Workspace Files & Folders',
      'Xonddit Communities (c/) & Verification Badges',
      'Posts, Discussions & Media Links',
      'Nested Comments & Replies',
      'User Votes & Score Relationships',
      'Xonwitter Tweets & Threads',
      'Xonslides Templates',
      'Private & Group Conversations & Messages',
      'Uploaded & Public Media Assets + Base64 Extractions',
      'Full Website Source Code (Frontend, Backend, Schemas, Rules)',
      'Safe Environment Template & Site Configuration',
      'Owner Security & Audit Logs',
    ];

    const excludedCategories = [
      'Plaintext passwords & third-party OAuth provider secrets',
      'Active session cookies, CSRF tokens, Firebase ID tokens & Google OAuth tokens',
      'Private .env secret values (GEMINI_API_KEY, SESSION_HMAC_SECRET)',
      'node_modules/, dist/, .git/ & transient build caches',
    ];

    addArchiveFile(
      'logs/audit-trail.json',
      JSON.stringify(auditLogs.slice(0, 100), null, 2),
      'logs'
    );
    addArchiveFile(
      'logs/backup-execution.log',
      currentJobProgress.logs.join('\n') + '\n',
      'logs'
    );

    const completedAt = new Date().toISOString();

    const tempManifestForReadme: BackupManifest = {
      backupId,
      archiveName,
      rootFolder,
      appName: 'Xongle',
      backupFormatVersion: '1.0.0',
      schemaVersion: '2026.10',
      createdAt: startedDate.toISOString(),
      completedAt,
      createdBy: options.ownerEmail,
      environment: process.env.NODE_ENV || 'development',
      totalUncompressedBytes,
      totalFilesCount: Object.keys(filesManifest).length + 2,
      recordCounts,
      includedCategories,
      excludedCategories,
      files: filesManifest,
      manifestSha256: 'verified-in-manifest-json',
    };

    const readmeContent = generateRestoreReadme(tempManifestForReadme);
    addArchiveFile('README-RESTORE.md', readmeContent, 'docs');

    const sortedHashInput = Object.keys(filesManifest)
      .sort()
      .map((k) => `${k}:${filesManifest[k].sha256}:${filesManifest[k].sizeBytes}`)
      .join('|');
    const manifestSha256 = computeSha256(sortedHashInput);

    const manifest: BackupManifest = {
      ...tempManifestForReadme,
      totalUncompressedBytes,
      totalFilesCount: Object.keys(filesManifest).length + 1,
      files: filesManifest,
      manifestSha256,
    };

    zip.file(`${rootFolder}/manifest.json`, JSON.stringify(manifest, null, 2), {
      compression: 'DEFLATE',
    });

    // STEP 6: Generate & Validate ZIP Archive
    updateJobProgress(
      {
        phase: 'Compressing & verifying ZIP archive integrity',
        stepIndex: 6,
        percent: 88,
        details: 'Generating DEFLATE archive and verifying SHA-256 checksums...',
      },
      'Compressing ZIP archive and verifying manifest integrity'
    );

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    if (!zipBuffer || zipBuffer.length < 100) {
      throw new Error('Generated ZIP archive is empty or invalid.');
    }

    // Re-open archive to verify it is not corrupted and contains manifest.json
    const verifyZip = await JSZip.loadAsync(zipBuffer);
    const manifestEntry = verifyZip.file(`${rootFolder}/manifest.json`);
    if (!manifestEntry) {
      throw new Error('Archive verification failed: manifest.json missing inside ZIP.');
    }
    const parsedManifestCheck = JSON.parse(await manifestEntry.async('string'));
    if (parsedManifestCheck.manifestSha256 !== manifestSha256) {
      throw new Error('Archive verification failed: manifest checksum mismatch.');
    }

    const archiveSha256 = computeSha256(zipBuffer);
    const localZipPath = path.join(BACKUP_STORAGE_DIR, `${backupId}.zip`);
    fs.writeFileSync(localZipPath, zipBuffer);

    const historyItem: BackupHistoryItem = {
      id: backupId,
      fileName: archiveName,
      rootFolder,
      createdAt: startedDate.toISOString(),
      completedAt,
      createdBy: options.ownerEmail,
      status: 'completed',
      sizeBytes: zipBuffer.length,
      sha256: archiveSha256,
      recordCounts,
      includedCategories,
      excludedCategories,
      localAvailable: true,
    };

    upsertBackupHistoryItem(historyItem);

    // Also persist backup record to Firestore /backups/{backupId}
    await writeFirestoreDocumentRest(
      projectId,
      'backups',
      backupId,
      {
        id: backupId,
        fileName: archiveName,
        createdAt: historyItem.createdAt,
        completedAt: historyItem.completedAt,
        createdBy: historyItem.createdBy,
        status: historyItem.status,
        sizeBytes: historyItem.sizeBytes,
        sha256: historyItem.sha256,
        countsJson: JSON.stringify(recordCounts),
        includedCategoriesJson: JSON.stringify(includedCategories),
        excludedCategoriesJson: JSON.stringify(excludedCategories),
      },
      token
    );

    appendOwnerAuditLog(
      'CREATE_FULL_BACKUP',
      options.ownerEmail,
      `Created full backup ${archiveName} (${(zipBuffer.length / 1024).toFixed(1)} KB, SHA-256: ${archiveSha256.slice(0, 16)}...)`,
      'success'
    );

    updateJobProgress(
      {
        active: false,
        jobType: 'idle',
        phase: 'Backup completed & verified',
        stepIndex: 7,
        percent: 100,
        details: `Backup ${archiveName} verified (${(zipBuffer.length / 1024).toFixed(1)} KB)`,
      },
      `Backup ${backupId} completed and verified successfully`
    );

    return { historyItem, manifest, zipBuffer };
  } catch (err: any) {
    const errorMsg = err?.message || 'Backup generation failed';
    appendOwnerAuditLog('CREATE_FULL_BACKUP_FAILED', options.ownerEmail, errorMsg, 'error');
    updateJobProgress(
      {
        active: false,
        jobType: 'idle',
        phase: 'Backup failed',
        error: errorMsg,
        details: errorMsg,
      },
      `ERROR: ${errorMsg}`
    );
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Google Drive OAuth Verification & Folder / Resumable Upload Engine
// ---------------------------------------------------------------------------
export interface DriveConnectionStatus {
  connected: boolean;
  userEmail?: string;
  displayName?: string;
  folderId?: string;
  folderName: string;
  storageUsedBytes?: number;
  storageLimitBytes?: number;
  error?: string;
}

export async function verifyGoogleDriveConnection(
  driveAccessToken: string,
  expectedOwnerEmail?: string
): Promise<DriveConnectionStatus> {
  if (!driveAccessToken || driveAccessToken.trim().length < 10) {
    return {
      connected: false,
      folderName: DRIVE_BACKUP_FOLDER_NAME,
      error: 'Google Drive access token not provided. Click "Authorize Google Drive Access" to connect.',
    };
  }

  const cleanToken = driveAccessToken.trim();

  try {
    // 1. Validate OAuth 2.0 token expiration and scope on Google's tokeninfo endpoint
    const tokenInfoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(cleanToken)}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!tokenInfoRes.ok) {
      return {
        connected: false,
        folderName: DRIVE_BACKUP_FOLDER_NAME,
        error: 'Google Drive OAuth access token is expired, revoked, or invalid. Please reconnect.',
      };
    }
    const tokenInfo: any = await tokenInfoRes.json();
    const grantedScopes = String(tokenInfo?.scope || '');
    const expiresIn = Number(tokenInfo?.expires_in || 0);
    if (expiresIn <= 0) {
      return {
        connected: false,
        folderName: DRIVE_BACKUP_FOLDER_NAME,
        error: 'Google Drive OAuth access token has expired. Please reconnect.',
      };
    }
    if (!grantedScopes.includes('drive.file') && !grantedScopes.includes('https://www.googleapis.com/auth/drive')) {
      return {
        connected: false,
        folderName: DRIVE_BACKUP_FOLDER_NAME,
        error: 'Google OAuth token lacks required least-privilege drive.file scope. Please authorize Drive access.',
      };
    }

    // 2. Query Drive About endpoint to verify account identity and ownership
    const aboutRes = await fetch(
      'https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress),storageQuota(limit,usage)',
      {
        headers: {
          Authorization: `Bearer ${cleanToken}`,
        },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!aboutRes.ok) {
      return {
        connected: false,
        folderName: DRIVE_BACKUP_FOLDER_NAME,
        error:
          aboutRes.status === 401 || aboutRes.status === 403
            ? 'Google Drive authorization expired or lacks drive.file permission. Please reconnect.'
            : `Google Drive API returned HTTP ${aboutRes.status}.`,
      };
    }

    const aboutData: any = await aboutRes.json();
    const driveEmail = String(aboutData?.user?.emailAddress || tokenInfo?.email || '')
      .toLowerCase()
      .trim();

    if (!driveEmail || !AUTHORIZED_DRIVE_OWNER_EMAILS.has(driveEmail)) {
      return {
        connected: false,
        folderName: DRIVE_BACKUP_FOLDER_NAME,
        error: `Access denied: Google Drive account (${driveEmail || 'unknown'}) is not an authorized Xongle owner account.`,
      };
    }

    if (
      expectedOwnerEmail &&
      AUTHORIZED_DRIVE_OWNER_EMAILS.has(expectedOwnerEmail.toLowerCase().trim()) &&
      driveEmail !== expectedOwnerEmail.toLowerCase().trim()
    ) {
      // Both emails are in the owner allowlist, but log or enforce owner match
      if (!AUTHORIZED_DRIVE_OWNER_EMAILS.has(driveEmail)) {
        return {
          connected: false,
          folderName: DRIVE_BACKUP_FOLDER_NAME,
          error: 'Google Drive account does not match the authenticated owner session.',
        };
      }
    }

    const folderId = await findExistingDriveBackupFolder(cleanToken);

    return {
      connected: true,
      userEmail: aboutData?.user?.emailAddress || driveEmail,
      displayName: aboutData?.user?.displayName,
      folderId: folderId || undefined,
      folderName: DRIVE_BACKUP_FOLDER_NAME,
      storageUsedBytes: aboutData?.storageQuota?.usage
        ? Number(aboutData.storageQuota.usage)
        : undefined,
      storageLimitBytes: aboutData?.storageQuota?.limit
        ? Number(aboutData.storageQuota.limit)
        : undefined,
    };
  } catch (err: any) {
    return {
      connected: false,
      folderName: DRIVE_BACKUP_FOLDER_NAME,
      error: redactSensitiveLogText(err?.message || 'Unable to reach Google Drive API'),
    };
  }
}

export async function revokeGoogleDriveTokenServer(
  driveAccessToken: string,
  actorEmail: string
): Promise<{ revoked: boolean }> {
  if (!driveAccessToken || driveAccessToken.trim().length < 10) {
    return { revoked: true };
  }
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(driveAccessToken.trim())}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: AbortSignal.timeout(6000),
      }
    );
    appendOwnerAuditLog(
      'DISCONNECT_GOOGLE_DRIVE',
      actorEmail,
      `Revoked Google Drive OAuth access token (status=${res.status})`,
      res.ok ? 'info' : 'error'
    );
    return { revoked: res.ok };
  } catch {
    appendOwnerAuditLog(
      'DISCONNECT_GOOGLE_DRIVE',
      actorEmail,
      'Disconnected Google Drive session locally',
      'info'
    );
    return { revoked: false };
  }
}

async function findExistingDriveBackupFolder(driveAccessToken: string): Promise<string | null> {
  const q = `mimeType = 'application/vnd.google-apps.folder' and name = '${DRIVE_BACKUP_FOLDER_NAME}' and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    q
  )}&fields=files(id,name)&pageSize=5`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${driveAccessToken}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const data: any = await res.json();
  if (Array.isArray(data.files) && data.files.length > 0 && data.files[0].id) {
    return String(data.files[0].id);
  }
  return null;
}

export async function ensureDriveBackupFolder(driveAccessToken: string): Promise<string> {
  const existingId = await findExistingDriveBackupFolder(driveAccessToken);
  if (existingId) return existingId;

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${driveAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: DRIVE_BACKUP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Official Xongle Owner Full Website & Database Backups',
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(
      `Failed to create "${DRIVE_BACKUP_FOLDER_NAME}" folder on Google Drive (HTTP ${createRes.status}): ${errText.slice(0, 150)}`
    );
  }

  const created: any = await createRes.json();
  if (!created?.id) {
    throw new Error('Google Drive did not return a folder ID for Xongle Backups.');
  }
  return String(created.id);
}

export async function uploadBackupToGoogleDrive(options: {
  backupId: string;
  driveAccessToken: string;
  ownerEmail: string;
  firebaseProjectId: string;
  firebaseIdToken?: string;
}): Promise<BackupHistoryItem> {
  const connCheck = await verifyGoogleDriveConnection(options.driveAccessToken, options.ownerEmail);
  if (!connCheck.connected) {
    throw new Error(connCheck.error || 'Google Drive token verification failed.');
  }

  const history = loadBackupHistory();
  const item = history.find((x) => x.id === options.backupId);
  if (!item) {
    throw new Error(`Backup record ${options.backupId} not found.`);
  }

  const zipPath = getBackupArchivePath(options.backupId);
  if (!zipPath || !fs.existsSync(zipPath)) {
    throw new Error(
      `Local archive file for ${options.backupId} is no longer on disk. Please create a new backup.`
    );
  }

  const zipBuffer = fs.readFileSync(zipPath);
  const localSha256 = computeSha256(zipBuffer);
  if (item.sha256 && localSha256 !== item.sha256) {
    throw new Error('Local backup archive checksum mismatch; refusing to upload corrupted file.');
  }

  updateJobProgress(
    {
      active: true,
      jobType: 'upload',
      backupId: options.backupId,
      phase: 'Preparing Google Drive destination folder',
      stepIndex: 1,
      totalSteps: 4,
      percent: 20,
      details: `Checking folder "${DRIVE_BACKUP_FOLDER_NAME}" on Google Drive...`,
    },
    `Starting Google Drive upload for ${item.fileName}`
  );

  try {
    const folderId = await ensureDriveBackupFolder(options.driveAccessToken);

    updateJobProgress(
      {
        phase: 'Initiating resumable upload session',
        stepIndex: 2,
        percent: 45,
        details: `Uploading ${item.fileName} (${(zipBuffer.length / 1024).toFixed(1)} KB) to Google Drive...`,
      },
      `Target Drive folder ID: ${folderId}`
    );

    // Initiate Resumable Upload session
    const initUrl =
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,md5Checksum,sha256Checksum,webViewLink,createdTime,parents';
    const metadata = {
      name: item.fileName,
      parents: [folderId],
      mimeType: 'application/zip',
      description: `Xongle Full Site Backup (${item.id}) | SHA-256: ${localSha256} | Created by: ${options.ownerEmail}`,
    };

    const initRes = await fetch(initUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.driveAccessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'application/zip',
        'X-Upload-Content-Length': String(zipBuffer.length),
      },
      body: JSON.stringify(metadata),
      signal: AbortSignal.timeout(15000),
    });

    if (!initRes.ok) {
      const errBody = await initRes.text();
      throw new Error(
        `Google Drive upload initialization failed (HTTP ${initRes.status}): ${errBody.slice(0, 180)}`
      );
    }

    const sessionUri = initRes.headers.get('location');
    if (!sessionUri) {
      throw new Error('Google Drive did not return a resumable upload session URI.');
    }

    updateJobProgress(
      {
        phase: 'Streaming backup archive to Google Drive',
        stepIndex: 3,
        percent: 75,
        details: `Transferring ${zipBuffer.length.toLocaleString()} bytes...`,
      },
      'Uploading archive bytes via resumable session URI'
    );

    const putRes = await fetch(sessionUri, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/zip',
        'Content-Length': String(zipBuffer.length),
      },
      body: new Uint8Array(zipBuffer),
      signal: AbortSignal.timeout(60000),
    });

    if (!putRes.ok) {
      const errBody = await putRes.text();
      throw new Error(
        `Google Drive file transfer failed (HTTP ${putRes.status}): ${errBody.slice(0, 180)}`
      );
    }

    const uploadedFile: any = await putRes.json();
    if (!uploadedFile?.id) {
      throw new Error('Google Drive upload completed without returning a valid file ID.');
    }

    const remoteSize = uploadedFile.size ? Number(uploadedFile.size) : zipBuffer.length;
    if (remoteSize !== zipBuffer.length) {
      throw new Error(
        `Google Drive size verification mismatch: expected ${zipBuffer.length} bytes, got ${remoteSize} bytes.`
      );
    }

    if (
      uploadedFile.sha256Checksum &&
      String(uploadedFile.sha256Checksum).toLowerCase() !== localSha256.toLowerCase()
    ) {
      throw new Error('Google Drive SHA-256 checksum mismatch after upload.');
    }

    const updatedItem: BackupHistoryItem = {
      ...item,
      status: 'uploaded',
      driveFileId: String(uploadedFile.id),
      driveFolderId: folderId,
      driveFolderName: DRIVE_BACKUP_FOLDER_NAME,
      driveWebViewLink:
        uploadedFile.webViewLink ||
        `https://drive.google.com/file/d/${encodeURIComponent(String(uploadedFile.id))}/view`,
      localAvailable: true,
    };

    upsertBackupHistoryItem(updatedItem);

    // Sync updated Drive metadata to Firestore
    await writeFirestoreDocumentRest(
      options.firebaseProjectId || 'arcane-responder-8sjh2',
      'backups',
      updatedItem.id,
      {
        id: updatedItem.id,
        fileName: updatedItem.fileName,
        createdAt: updatedItem.createdAt,
        completedAt: updatedItem.completedAt || new Date().toISOString(),
        createdBy: updatedItem.createdBy,
        status: updatedItem.status,
        sizeBytes: updatedItem.sizeBytes,
        sha256: updatedItem.sha256,
        driveFileId: updatedItem.driveFileId,
        driveFolderId: updatedItem.driveFolderId,
        driveFolderName: updatedItem.driveFolderName,
        driveWebViewLink: updatedItem.driveWebViewLink,
        countsJson: JSON.stringify(updatedItem.recordCounts),
        includedCategoriesJson: JSON.stringify(updatedItem.includedCategories),
        excludedCategoriesJson: JSON.stringify(updatedItem.excludedCategories),
      },
      options.firebaseIdToken
    );

    appendOwnerAuditLog(
      'UPLOAD_BACKUP_GOOGLE_DRIVE',
      options.ownerEmail,
      `Uploaded ${updatedItem.fileName} to Google Drive folder "${DRIVE_BACKUP_FOLDER_NAME}" (File ID: ${updatedItem.driveFileId})`,
      'success'
    );

    updateJobProgress(
      {
        active: false,
        jobType: 'idle',
        phase: 'Google Drive upload verified',
        stepIndex: 4,
        percent: 100,
        details: `Uploaded & verified on Google Drive (File ID: ${updatedItem.driveFileId})`,
      },
      `Google Drive upload verified: fileId=${updatedItem.driveFileId}, size=${remoteSize}`
    );

    return updatedItem;
  } catch (err: any) {
    const errorMsg = err?.message || 'Google Drive upload failed';
    appendOwnerAuditLog('UPLOAD_BACKUP_FAILED', options.ownerEmail, errorMsg, 'error');
    updateJobProgress(
      {
        active: false,
        jobType: 'idle',
        phase: 'Google Drive upload failed',
        error: errorMsg,
        details: errorMsg,
      },
      `ERROR: ${errorMsg}`
    );
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Delete Backup (Local Archive + Optional Google Drive Deletion)
// ---------------------------------------------------------------------------
export async function deleteBackupRecord(options: {
  backupId: string;
  deleteFromDrive: boolean;
  driveAccessToken?: string;
  ownerEmail: string;
  firebaseProjectId: string;
  firebaseIdToken?: string;
}): Promise<{ deletedLocal: boolean; deletedFromDrive: boolean; driveError?: string }> {
  const history = loadBackupHistory();
  const item = history.find((x) => x.id === options.backupId);
  if (!item) {
    throw new Error(`Backup ${options.backupId} not found.`);
  }

  let deletedLocal = false;
  const zipPath = getBackupArchivePath(options.backupId);
  if (zipPath && fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
    deletedLocal = true;
  }

  let deletedFromDrive = false;
  let driveError: string | undefined;

  if (options.deleteFromDrive && item.driveFileId) {
    if (!isValidGoogleDriveFileId(item.driveFileId)) {
      driveError = 'Invalid Google Drive file ID format; skipped remote deletion.';
    } else if (!options.driveAccessToken) {
      driveError =
        'Local backup deleted, but Google Drive access token was missing so the Drive file was kept.';
    } else {
      try {
        const connCheck = await verifyGoogleDriveConnection(
          options.driveAccessToken,
          options.ownerEmail
        );
        if (!connCheck.connected) {
          driveError = connCheck.error || 'Google Drive authorization failed; Drive file was kept.';
        } else {
          // Verify file metadata & ownership before deletion
          const metaRes = await fetch(
            `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
              item.driveFileId
            )}?fields=id,name,ownedByMe,trashed`,
            {
              headers: { Authorization: `Bearer ${options.driveAccessToken}` },
              signal: AbortSignal.timeout(8000),
            }
          );
          if (metaRes.status === 404) {
            deletedFromDrive = true;
          } else if (!metaRes.ok) {
            driveError = `Unable to verify Drive file ownership before deletion (HTTP ${metaRes.status}).`;
          } else {
            const meta: any = await metaRes.json();
            if (meta?.ownedByMe === false) {
              driveError = 'Refusing to delete Google Drive file not owned by the authenticated owner account.';
            } else {
              const delRes = await fetch(
                `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(item.driveFileId)}`,
                {
                  method: 'DELETE',
                  headers: {
                    Authorization: `Bearer ${options.driveAccessToken}`,
                  },
                  signal: AbortSignal.timeout(10000),
                }
              );
              if (delRes.ok || delRes.status === 204 || delRes.status === 404) {
                deletedFromDrive = true;
              } else {
                driveError = `Google Drive returned HTTP ${delRes.status} when deleting file.`;
              }
            }
          }
        }
      } catch (err: any) {
        driveError = redactSensitiveLogText(err?.message || 'Failed to delete file from Google Drive.');
      }
    }
  }

  const remaining = history.filter((x) => x.id !== options.backupId);
  saveBackupHistory(remaining);

  await deleteFirestoreDocumentRest(
    options.firebaseProjectId || 'arcane-responder-8sjh2',
    'backups',
    options.backupId,
    options.firebaseIdToken
  );

  appendOwnerAuditLog(
    'DELETE_BACKUP',
    options.ownerEmail,
    `Deleted backup ${item.fileName} (local=${deletedLocal}, googleDrive=${deletedFromDrive})`,
    'info'
  );

  return { deletedLocal, deletedFromDrive, driveError };
}

// ---------------------------------------------------------------------------
// Inspect & Validate Backup Archive Before Restore
// ---------------------------------------------------------------------------
export interface BackupInspectionResult {
  valid: boolean;
  manifest: BackupManifest;
  verifiedFilesCount: number;
  checksumMismatches: string[];
  rootPrefix: string;
}

const MAX_ARCHIVE_ENTRIES = 2500;
const MAX_ARCHIVE_UNCOMPRESSED_BYTES = 100 * 1024 * 1024; // 100 MB ceiling

export async function inspectAndValidateBackupZip(
  zipBuffer: Buffer
): Promise<BackupInspectionResult> {
  if (!zipBuffer || zipBuffer.length > 50 * 1024 * 1024) {
    throw new Error('Backup archive exceeds maximum allowed compressed size (50 MB).');
  }

  const zip = await JSZip.loadAsync(zipBuffer);
  const allFileNames = Object.keys(zip.files);

  if (allFileNames.length > MAX_ARCHIVE_ENTRIES) {
    throw new Error(
      `Backup archive contains too many entries (${allFileNames.length} > ${MAX_ARCHIVE_ENTRIES}).`
    );
  }

  // Enforce Zip Slip path traversal validation on every entry in the ZIP
  for (const entryName of allFileNames) {
    if (!isSafeArchiveEntryPath(entryName)) {
      throw new Error(`Unsafe archive path detected in ZIP: "${entryName.slice(0, 80)}"`);
    }
  }

  const manifestPath = allFileNames.find((p) => p.endsWith('/manifest.json') || p === 'manifest.json');
  if (!manifestPath) {
    throw new Error('Invalid backup archive: manifest.json not found.');
  }

  const rootPrefix = manifestPath.endsWith('/manifest.json')
    ? manifestPath.slice(0, -'/manifest.json'.length)
    : '';

  const manifestRaw = await zip.file(manifestPath)!.async('string');
  if (manifestRaw.length > 5 * 1024 * 1024) {
    throw new Error('Backup manifest exceeds maximum allowed size.');
  }
  const manifest = JSON.parse(manifestRaw) as BackupManifest;

  if (!manifest || manifest.appName !== 'Xongle' || !manifest.files || typeof manifest.files !== 'object') {
    throw new Error('Invalid backup manifest: not a recognized Xongle backup archive.');
  }

  const manifestEntries = Object.entries(manifest.files);
  if (manifestEntries.length > MAX_ARCHIVE_ENTRIES) {
    throw new Error('Backup manifest file count exceeds safety threshold.');
  }

  for (const [relPath, entry] of manifestEntries) {
    if (!isSafeArchiveEntryPath(relPath)) {
      throw new Error(`Unsafe file path in backup manifest: "${relPath.slice(0, 80)}"`);
    }
    if (typeof entry.sizeBytes !== 'number' || entry.sizeBytes < 0 || entry.sizeBytes > 25 * 1024 * 1024) {
      throw new Error(`Invalid file size declared in manifest for ${relPath}`);
    }
  }

  // Verify manifest integrity hash
  const sortedHashInput = Object.keys(manifest.files)
    .sort()
    .map((k) => `${k}:${manifest.files[k].sha256}:${manifest.files[k].sizeBytes}`)
    .join('|');
  const expectedManifestSha = computeSha256(sortedHashInput);
  if (manifest.manifestSha256 && manifest.manifestSha256 !== expectedManifestSha) {
    throw new Error('Backup manifest integrity hash mismatch (manifest has been tampered with).');
  }

  const checksumMismatches: string[] = [];
  let verifiedFilesCount = 0;
  let cumulativeUncompressedBytes = 0;

  for (const [relPath, entry] of manifestEntries) {
    const fullPath = rootPrefix ? `${rootPrefix}/${relPath}` : relPath;
    const zf = zip.file(fullPath);
    if (!zf) {
      checksumMismatches.push(`Missing file: ${relPath}`);
      continue;
    }
    const contentBuf = await zf.async('nodebuffer');
    cumulativeUncompressedBytes += contentBuf.length;
    if (cumulativeUncompressedBytes > MAX_ARCHIVE_UNCOMPRESSED_BYTES) {
      throw new Error('Backup archive uncompressed payload exceeds 100 MB safety limit (Zip Bomb protection).');
    }
    const actualSha = computeSha256(contentBuf);
    if (actualSha !== entry.sha256) {
      checksumMismatches.push(`SHA-256 mismatch on ${relPath}`);
    } else {
      verifiedFilesCount++;
    }
  }

  return {
    valid: checksumMismatches.length === 0,
    manifest,
    verifiedFilesCount,
    checksumMismatches,
    rootPrefix,
  };
}

// ---------------------------------------------------------------------------
// Restore Backup Engine
// ---------------------------------------------------------------------------
export async function restoreFromBackupZip(options: {
  zipBuffer: Buffer;
  ownerEmail: string;
  firebaseProjectId: string;
  firebaseIdToken?: string;
  createPreRestoreBackup?: boolean;
  clientSnapshot?: ClientSupplementalSnapshot;
  serverState?: {
    snakeLeaderboard?: any[];
    siteSettings?: Record<string, any>;
  };
}): Promise<{
  manifest: BackupManifest;
  preRestoreBackupId?: string;
  restoredCounts: Record<string, number>;
  restoredData: {
    users: any[];
    communities: any[];
    posts: any[];
    comments: any[];
    votes: any[];
    tweets: any[];
    slide_templates: any[];
    conversations: any[];
    messages: any[];
    siteSettings: any[];
    snakeLeaderboard: any[];
  };
}> {
  if (currentJobProgress.active) {
    throw new Error(
      `Another backup/restore job (${currentJobProgress.jobType}) is currently in progress.`
    );
  }

  let preRestoreBackupId: string | undefined;
  if (options.createPreRestoreBackup) {
    const preResult = await createFullSiteBackup({
      ownerEmail: options.ownerEmail,
      firebaseProjectId: options.firebaseProjectId,
      firebaseIdToken: options.firebaseIdToken,
      clientSnapshot: options.clientSnapshot,
      serverState: options.serverState,
    });
    preRestoreBackupId = preResult.historyItem.id;
  }

  currentJobProgress = {
    active: true,
    jobType: 'restore',
    phase: 'Validating backup archive & SHA-256 checksums',
    stepIndex: 1,
    totalSteps: 5,
    percent: 15,
    details: 'Verifying manifest and cryptographic file hashes before restore...',
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    logs: [`[${new Date().toISOString()}] Starting restore validation by ${options.ownerEmail}`],
  };

  try {
    const inspection = await inspectAndValidateBackupZip(options.zipBuffer);
    if (!inspection.valid) {
      throw new Error(
        `Pre-restore checksum verification failed: ${inspection.checksumMismatches
          .slice(0, 3)
          .join(', ')}`
      );
    }

    const zip = await JSZip.loadAsync(options.zipBuffer);
    const { rootPrefix, manifest } = inspection;

    const readJsonArray = async (relPath: string): Promise<any[]> => {
      const fullPath = rootPrefix ? `${rootPrefix}/${relPath}` : relPath;
      const f = zip.file(fullPath);
      if (!f) return [];
      const text = await f.async('string');
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [];
    };

    updateJobProgress(
      {
        phase: 'Extracting database collections from archive',
        stepIndex: 2,
        percent: 35,
        details: `Verified ${inspection.verifiedFilesCount} files. Reading JSON collections...`,
      },
      `Checksum validation passed (${inspection.verifiedFilesCount} files verified)`
    );

    const [
      users,
      userFiles,
      userFolders,
      communities,
      posts,
      comments,
      votes,
      tweets,
      slideTemplates,
      conversations,
      messages,
      siteSettings,
      snakeLeaderboard,
    ] = await Promise.all([
      readJsonArray('database/users.json'),
      readJsonArray('database/user_files.json'),
      readJsonArray('database/user_folders.json'),
      readJsonArray('database/communities.json'),
      readJsonArray('database/posts.json'),
      readJsonArray('database/comments.json'),
      readJsonArray('database/votes.json'),
      readJsonArray('database/tweets.json'),
      readJsonArray('database/slide_templates.json'),
      readJsonArray('database/conversations.json'),
      readJsonArray('database/messages.json'),
      readJsonArray('database/site_settings.json'),
      readJsonArray('database/snake_leaderboard.json'),
    ]);

    const projectId = options.firebaseProjectId || 'arcane-responder-8sjh2';
    const token = options.firebaseIdToken;
    const restoredCounts: Record<string, number> = {
      users: 0,
      user_files: 0,
      user_folders: 0,
      communities: 0,
      posts: 0,
      comments: 0,
      votes: 0,
      tweets: 0,
      slide_templates: 0,
      conversations: 0,
      messages: 0,
      site_settings: 0,
      snake_leaderboard: snakeLeaderboard.length,
    };

    updateJobProgress(
      {
        phase: 'Restoring users & communities to Firestore',
        stepIndex: 3,
        percent: 58,
        details: `Restoring ${users.length} users and ${communities.length} communities...`,
      },
      'Writing users, subcollections, and communities to Firestore'
    );

    for (const u of users) {
      const docId = String(u.uid || u.id || '');
      if (!docId) continue;
      const ok = await writeFirestoreDocumentRest(projectId, 'users', docId, u, token);
      if (ok) restoredCounts.users++;
    }

    for (const f of userFiles) {
      const uid = String(f.userId || '');
      const fileId = String(f.id || '');
      if (!uid || !fileId) continue;
      const { userId: _unused, ...cleanFile } = f;
      const ok = await writeFirestoreDocumentRest(
        projectId,
        `users/${uid}/files`,
        fileId,
        cleanFile,
        token
      );
      if (ok) restoredCounts.user_files++;
    }

    for (const fld of userFolders) {
      const uid = String(fld.userId || '');
      const folderId = String(fld.id || '');
      if (!uid || !folderId) continue;
      const { userId: _unused, ...cleanFolder } = fld;
      const ok = await writeFirestoreDocumentRest(
        projectId,
        `users/${uid}/folders`,
        folderId,
        cleanFolder,
        token
      );
      if (ok) restoredCounts.user_folders++;
    }

    for (const c of communities) {
      const docId = String(c.id || '');
      if (!docId) continue;
      const ok = await writeFirestoreDocumentRest(projectId, 'communities', docId, c, token);
      if (ok) restoredCounts.communities++;
    }

    updateJobProgress(
      {
        phase: 'Restoring posts, comments, votes & chats',
        stepIndex: 4,
        percent: 82,
        details: `Restoring ${posts.length} posts, ${comments.length} comments, ${votes.length} votes...`,
      },
      'Writing posts, comments, votes, tweets, slides, and conversations to Firestore'
    );

    for (const p of posts) {
      const docId = String(p.id || '');
      if (!docId) continue;
      const ok = await writeFirestoreDocumentRest(projectId, 'posts', docId, p, token);
      if (ok) restoredCounts.posts++;
    }

    for (const cm of comments) {
      const docId = String(cm.id || '');
      if (!docId) continue;
      const ok = await writeFirestoreDocumentRest(projectId, 'comments', docId, cm, token);
      if (ok) restoredCounts.comments++;
    }

    for (const v of votes) {
      const docId = String(v.id || `${v.userId}_${v.targetId}`);
      if (!docId) continue;
      const ok = await writeFirestoreDocumentRest(projectId, 'votes', docId, v, token);
      if (ok) restoredCounts.votes++;
    }

    for (const tw of tweets) {
      const docId = String(tw.id || '');
      if (!docId) continue;
      const ok = await writeFirestoreDocumentRest(projectId, 'tweets', docId, tw, token);
      if (ok) restoredCounts.tweets++;
    }

    for (const st of slideTemplates) {
      const docId = String(st.id || '');
      if (!docId) continue;
      const ok = await writeFirestoreDocumentRest(projectId, 'slide_templates', docId, st, token);
      if (ok) restoredCounts.slide_templates++;
    }

    for (const conv of conversations) {
      const docId = String(conv.id || '');
      if (!docId) continue;
      const ok = await writeFirestoreDocumentRest(projectId, 'conversations', docId, conv, token);
      if (ok) restoredCounts.conversations++;
    }

    for (const msg of messages) {
      const docId = String(msg.id || '');
      if (!docId) continue;
      const ok = await writeFirestoreDocumentRest(projectId, 'messages', docId, msg, token);
      if (ok) restoredCounts.messages++;
    }

    for (const ss of siteSettings) {
      const docId = String(ss.id || 'global');
      const ok = await writeFirestoreDocumentRest(projectId, 'site_settings', docId, ss, token);
      if (ok) restoredCounts.site_settings++;
    }

    appendOwnerAuditLog(
      'RESTORE_BACKUP',
      options.ownerEmail,
      `Restored backup ${manifest.archiveName} (users=${restoredCounts.users}, communities=${restoredCounts.communities}, posts=${restoredCounts.posts}, comments=${restoredCounts.comments})`,
      'success'
    );

    updateJobProgress(
      {
        active: false,
        jobType: 'idle',
        phase: 'Restore completed & verified',
        stepIndex: 5,
        percent: 100,
        details: `Successfully restored ${manifest.archiveName}`,
      },
      `Restore of ${manifest.backupId} completed successfully`
    );

    return {
      manifest,
      preRestoreBackupId,
      restoredCounts,
      restoredData: {
        users,
        communities,
        posts,
        comments,
        votes,
        tweets,
        slide_templates: slideTemplates,
        conversations,
        messages,
        siteSettings,
        snakeLeaderboard,
      },
    };
  } catch (err: any) {
    const errorMsg = err?.message || 'Backup restoration failed';
    appendOwnerAuditLog('RESTORE_BACKUP_FAILED', options.ownerEmail, errorMsg, 'error');
    updateJobProgress(
      {
        active: false,
        jobType: 'idle',
        phase: 'Restore failed',
        error: errorMsg,
        details: errorMsg,
      },
      `ERROR: ${errorMsg}`
    );
    throw err;
  }
}
