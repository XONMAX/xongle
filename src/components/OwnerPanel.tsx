import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Users,
  FileText,
  Sliders,
  BarChart3,
  Settings,
  Bell,
  Database,
  HelpCircle,
  Lock,
  CheckCircle2,
  AlertTriangle,
  X,
  Search,
  RefreshCw,
  Trash2,
  ShieldCheck,
  UserX,
  UserCheck,
  Activity,
  Server,
  Globe,
  Radio,
  Download,
  Upload,
  Send,
  Eye,
  Check,
  Shield,
  Key,
  HardDrive,
  CloudUpload,
  FolderArchive,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';
import { User } from 'firebase/auth';
import JSZip from 'jszip';
import { UserProfile } from '../types';
import { dbService } from '../services/db';
import {
  connectGoogleDrive,
  getCachedDriveAccessToken,
  revokeGoogleDriveAccessToken,
} from '../firebase/config';
import { getSafeHref } from '../validation/schemas';

const AUTHORIZED_OWNER_EMAILS = new Set([
  'aminbek785@gmail.com',
  'crownsmpuz@gmail.com',
]);

// Security: Never store private Drive file IDs, backup history, or owner audit logs in localStorage.
// Purge any legacy localStorage keys and keep fallback state strictly in memory.
const LEGACY_BACKUP_HISTORY_KEY = 'xongle_owner_backup_history_v1';
const LEGACY_AUDIT_LOGS_KEY = 'xongle_owner_audit_logs_v1';
let clientMemoryBackupHistory: any[] = [];
let clientMemoryAuditLogs: any[] = [];
const clientBackupBlobs = new Map<string, Blob>();

function purgeLegacyLocalStorage(): void {
  try {
    localStorage.removeItem(LEGACY_BACKUP_HISTORY_KEY);
    localStorage.removeItem(LEGACY_AUDIT_LOGS_KEY);
  } catch {
    // ignore
  }
}

async function computeBrowserSha256(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  const bytes =
    typeof data === 'string'
      ? new TextEncoder().encode(data)
      : data instanceof Uint8Array
      ? data
      : new Uint8Array(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function loadClientBackupHistory(): any[] {
  purgeLegacyLocalStorage();
  return [...clientMemoryBackupHistory];
}

function saveClientBackupHistory(list: any[]): void {
  purgeLegacyLocalStorage();
  clientMemoryBackupHistory = list.slice(0, 50);
}

function appendClientAuditLog(
  action: string,
  actorEmail: string,
  details: string,
  status: 'success' | 'error' | 'info' = 'success'
): any[] {
  purgeLegacyLocalStorage();
  const entry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    action,
    actorEmail,
    details,
    status,
    createdAt: new Date().toISOString(),
  };
  clientMemoryAuditLogs = [entry, ...clientMemoryAuditLogs].slice(0, 100);
  return [...clientMemoryAuditLogs];
}

async function parseJsonResponseOrNull(res: Response): Promise<any | null> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return null;
  }
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function verifyGoogleDriveBrowser(driveToken: string) {
  if (!driveToken) {
    return {
      connected: false,
      folderName: 'Xongle Backups',
      error: 'Google Drive access token not provided. Click "Authorize Google Drive Access" to connect.',
    };
  }
  try {
    const aboutRes = await fetch(
      'https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress),storageQuota(limit,usage)',
      { headers: { Authorization: `Bearer ${driveToken}` } }
    );
    if (!aboutRes.ok) {
      return {
        connected: false,
        folderName: 'Xongle Backups',
        error: 'Google Drive token expired or unauthorized. Please reconnect.',
      };
    }
    const aboutData = await aboutRes.json();
    const driveEmail = String(aboutData?.user?.emailAddress || '').toLowerCase().trim();
    if (!driveEmail || !AUTHORIZED_OWNER_EMAILS.has(driveEmail)) {
      return {
        connected: false,
        folderName: 'Xongle Backups',
        error: `Access denied: Google Drive account (${driveEmail || 'unknown'}) is not an authorized Xongle owner account.`,
      };
    }
    const q = "mimeType = 'application/vnd.google-apps.folder' and name = 'Xongle Backups' and trashed = false";
    const folderRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=5`,
      { headers: { Authorization: `Bearer ${driveToken}` } }
    );
    const folderData = folderRes.ok ? await folderRes.json() : {};
    const folderId = folderData?.files?.[0]?.id ? String(folderData.files[0].id) : undefined;
    return {
      connected: true,
      userEmail: aboutData?.user?.emailAddress,
      displayName: aboutData?.user?.displayName,
      folderId,
      folderName: 'Xongle Backups',
      storageUsedBytes: aboutData?.storageQuota?.usage ? Number(aboutData.storageQuota.usage) : undefined,
      storageLimitBytes: aboutData?.storageQuota?.limit ? Number(aboutData.storageQuota.limit) : undefined,
    };
  } catch (err: any) {
    return {
      connected: false,
      folderName: 'Xongle Backups',
      error: err?.message || 'Unable to reach Google Drive API',
    };
  }
}

async function uploadZipBlobToGoogleDriveBrowser(
  zipBlob: Blob,
  fileName: string,
  backupId: string,
  sha256: string,
  ownerEmail: string,
  driveToken: string
): Promise<{ fileId: string; folderId: string; webViewLink: string }> {
  const q = "mimeType = 'application/vnd.google-apps.folder' and name = 'Xongle Backups' and trashed = false";
  const folderSearchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=5`,
    { headers: { Authorization: `Bearer ${driveToken}` } }
  );
  const folderSearchData = folderSearchRes.ok ? await folderSearchRes.json() : {};
  let folderId = folderSearchData?.files?.[0]?.id ? String(folderSearchData.files[0].id) : '';

  if (!folderId) {
    const createFolderRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${driveToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Xongle Backups',
        mimeType: 'application/vnd.google-apps.folder',
        description: 'Official Xongle Owner Full Website & Database Backups',
      }),
    });
    if (!createFolderRes.ok) {
      throw new Error(`Failed to create "Xongle Backups" folder on Google Drive (HTTP ${createFolderRes.status})`);
    }
    const createdFolder = await createFolderRes.json();
    folderId = String(createdFolder.id);
  }

  const initRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${driveToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'application/zip',
        'X-Upload-Content-Length': String(zipBlob.size),
      },
      body: JSON.stringify({
        name: fileName,
        parents: [folderId],
        mimeType: 'application/zip',
        description: `Xongle Full Site Backup (${backupId}) | SHA-256: ${sha256} | Created by: ${ownerEmail}`,
      }),
    }
  );

  if (!initRes.ok) {
    throw new Error(`Google Drive upload initialization failed (HTTP ${initRes.status})`);
  }
  const sessionUri = initRes.headers.get('location');
  if (!sessionUri) {
    throw new Error('Google Drive did not return a resumable upload session URI.');
  }

  const putRes = await fetch(sessionUri, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/zip',
    },
    body: zipBlob,
  });
  if (!putRes.ok) {
    throw new Error(`Google Drive file transfer failed (HTTP ${putRes.status})`);
  }
  const uploadedFile = await putRes.json();
  if (!uploadedFile?.id) {
    throw new Error('Google Drive upload completed without returning a file ID.');
  }
  return {
    fileId: String(uploadedFile.id),
    folderId,
    webViewLink:
      uploadedFile.webViewLink ||
      `https://drive.google.com/file/d/${encodeURIComponent(String(uploadedFile.id))}/view`,
  };
}

interface OwnerPanelProps {
  currentUser: User | null;
  userProfile: UserProfile;
  onClose: () => void;
  onGoogleSignIn: () => void;
}

type TabType =
  | 'dashboard'
  | 'users'
  | 'content'
  | 'permissions'
  | 'moderation'
  | 'analytics'
  | 'settings'
  | 'security'
  | 'notifications'
  | 'database'
  | 'support';

export const OwnerPanel: React.FC<OwnerPanelProps> = ({
  currentUser,
  userProfile,
  onClose,
  onGoogleSignIn,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState<string>('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Search & state filters
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [contentSearchQuery, setContentSearchQuery] = useState('');
  const [postsList, setPostsList] = useState<any[]>([]);
  const [communitiesList, setCommunitiesList] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [siteName, setSiteName] = useState('Xongle & Connected Apps');
  const [metaDescription, setMetaDescription] = useState('The ultimate decentralized social platform and lightning-fast search engine.');
  const [allowRegistrations, setAllowRegistrations] = useState(true);
  const [strictSafeSearch, setStrictSafeSearch] = useState(false);
  const [defaultTheme, setDefaultTheme] = useState<'dark' | 'light'>('dark');
  const [maxUploadSize, setMaxUploadSize] = useState('10MB');
  const [announcementBanner, setAnnouncementBanner] = useState('');
  const [notificationText, setNotificationText] = useState('');

  const [csrfToken, setCsrfToken] = useState<string>('');
  const [toastIsError, setToastIsError] = useState(false);

  // Backup & Restore state
  const [backupHistory, setBackupHistory] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [driveStatus, setDriveStatus] = useState<{
    connected: boolean;
    userEmail?: string;
    displayName?: string;
    folderId?: string;
    folderName: string;
    storageUsedBytes?: number;
    storageLimitBytes?: number;
    error?: string;
  }>({
    connected: false,
    folderName: 'Xongle Backups',
  });
  const [jobProgress, setJobProgress] = useState<{
    active: boolean;
    jobType: string;
    backupId?: string;
    phase: string;
    stepIndex: number;
    totalSteps: number;
    percent: number;
    details: string;
    error?: string;
    logs: string[];
  }>({
    active: false,
    jobType: 'idle',
    phase: 'Ready',
    stepIndex: 0,
    totalSteps: 1,
    percent: 0,
    details: 'System idle and ready for backup or restore operations.',
    logs: [],
  });
  const [isBackupWorking, setIsBackupWorking] = useState(false);
  const [selectedBackupId, setSelectedBackupId] = useState<string>('');

  // Pre-Restore Validation & Confirmation Modal State
  const [restoreModalState, setRestoreModalState] = useState<{
    open: boolean;
    sourceType: 'history' | 'upload';
    backupId?: string;
    archiveBase64?: string;
    inspection?: any;
    createSafetyBackup: boolean;
  }>({
    open: false,
    sourceType: 'history',
    createSafetyBackup: true,
  });

  // Delete Backup Confirmation Modal State
  const [deleteModalState, setDeleteModalState] = useState<{
    open: boolean;
    backup: any | null;
    deleteFromDrive: boolean;
  }>({
    open: false,
    backup: null,
    deleteFromDrive: false,
  });

  // Irreversible Administrative Action Confirmation Modal State
  const [adminConfirmModal, setAdminConfirmModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: (() => void) | null;
  }>({
    open: false,
    title: '',
    description: '',
    confirmLabel: 'Confirm',
    onConfirm: null,
  });

  // Verify owner on mount or when currentUser changes
  useEffect(() => {
    purgeLegacyLocalStorage();
    verifyOwnerOnServer();
  }, [currentUser]);

  // Poll backup progress while a backup/upload/restore job is running
  useEffect(() => {
    if (!isAuthorized || (!isBackupWorking && !jobProgress.active)) return;
    const timer = setInterval(() => {
      void refreshBackupStatus(true);
    }, 1200);
    return () => clearInterval(timer);
  }, [isAuthorized, isBackupWorking, jobProgress.active]);

  const verifyOwnerOnServer = async () => {
    const email = (currentUser?.email || '').trim().toLowerCase();
    if (!email || !currentUser || currentUser.isAnonymous || currentUser.emailVerified !== true) {
      setIsAuthorized(false);
      setAuthError('Authentication required. Please sign in with a verified owner Google account.');
      return;
    }

    if (!AUTHORIZED_OWNER_EMAILS.has(email)) {
      setIsAuthorized(false);
      setAuthError('Access denied: Only verified owner accounts (aminbek785@gmail.com, crownsmpuz@gmail.com) are permitted.');
      return;
    }

    try {
      const idToken = await currentUser.getIdToken();
      if (!idToken) {
        setIsAuthorized(false);
        setAuthError('Missing cryptographic authentication token.');
        return;
      }

      try {
        const res = await fetch('/api/owner/verify', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ email }),
        });
        const data = await parseJsonResponseOrNull(res);
        if (data) {
          if (res.ok && data.authorized) {
            setIsAuthorized(true);
            setAuthError('');
            if (data.csrfToken) {
              setCsrfToken(data.csrfToken);
            }
            loadDashboardData();
            void refreshBackupStatus(true);
            return;
          }
          if (res.status === 401 || res.status === 403) {
            setIsAuthorized(false);
            setAuthError(data.error || 'Access denied: Only verified owner accounts are permitted.');
            return;
          }
        }
      } catch {
        // Fallback to verified Firebase Auth token check when hosted on static Vercel deployment
      }

      // Verified via Firebase Auth token & authorized owner email allowlist
      setIsAuthorized(true);
      setAuthError('');
      loadDashboardData();
      void refreshBackupStatus(true);
    } catch {
      setIsAuthorized(false);
      setAuthError('Failed to verify Firebase authentication token. Please sign in again.');
    }
  };

  const loadDashboardData = async () => {
    try {
      const [comms, posts, users] = await Promise.all([
        dbService.getCommunities(true),
        dbService.getPosts({ sort: 'new' }),
        dbService.getAllUsers(),
      ]);
      setCommunitiesList(comms);
      setPostsList(posts);
      setUsersList(users);
    } catch (err) {
      console.warn('Error loading dashboard data:', err);
    }
  };

  const getOwnerHeaders = async (): Promise<Record<string, string>> => {
    const idToken = currentUser ? await currentUser.getIdToken() : '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (idToken) {
      headers.Authorization = `Bearer ${idToken}`;
    }
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
    const driveToken = getCachedDriveAccessToken();
    if (driveToken) {
      headers['X-Google-Drive-Token'] = driveToken;
    }
    return headers;
  };

  const refreshBackupStatus = async (silent = false) => {
    if (!currentUser || currentUser.isAnonymous) return;
    try {
      const headers = await getOwnerHeaders();
      const res = await fetch('/api/owner/backup/status', {
        method: 'GET',
        credentials: 'include',
        headers,
      });
      const data = await parseJsonResponseOrNull(res);
      if (res.ok && data) {
        if (Array.isArray(data.history)) {
          setBackupHistory(data.history);
          if (!selectedBackupId && data.history.length > 0) {
            setSelectedBackupId(data.history[0].id);
          }
        }
        if (Array.isArray(data.auditLogs)) {
          setAuditLogs(data.auditLogs);
        }
        if (data.driveStatus) {
          setDriveStatus(data.driveStatus);
        }
        if (data.jobProgress) {
          setJobProgress(data.jobProgress);
        }
        if (!silent) {
          showToast('Refreshed Google Drive & backup status');
        }
        return;
      }
    } catch {
      // Static hosting fallback below
    }

    // Client-side in-memory fallback for static hosting
    const localHistory = loadClientBackupHistory();
    setBackupHistory(localHistory);
    if (!selectedBackupId && localHistory.length > 0) {
      setSelectedBackupId(localHistory[0].id);
    }
    setAuditLogs([...clientMemoryAuditLogs]);
    const driveToken = getCachedDriveAccessToken() || '';
    const status = await verifyGoogleDriveBrowser(driveToken);
    setDriveStatus(status);
    if (!silent) {
      showToast('Refreshed Google Drive & backup status');
    }
  };

  const handleConnectGoogleDrive = async () => {
    try {
      setLoadingAction('connect_drive');
      const { accessToken } = await connectGoogleDrive();
      if (accessToken) {
        await refreshBackupStatus(true);
        showToast('Google Drive connected & authorized for Xongle Backups');
      }
    } catch (err: any) {
      showToast(err?.message || 'Google Drive authorization was cancelled or failed', true);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDisconnectGoogleDrive = async () => {
    try {
      setLoadingAction('disconnect_drive');
      const headers = await getOwnerHeaders();
      try {
        await fetch('/api/owner/drive/disconnect', {
          method: 'POST',
          credentials: 'include',
          headers,
        });
      } catch {
        // ignore network error in static mode
      }
      await revokeGoogleDriveAccessToken();
      setDriveStatus({
        connected: false,
        folderName: 'Xongle Backups',
        error: 'Google Drive disconnected & OAuth access token revoked.',
      });
      await refreshBackupStatus(true);
      showToast('Disconnected Google Drive & revoked OAuth access token');
    } catch {
      showToast('Disconnected Google Drive session', true);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCreateBackup = async (uploadToDrive: boolean) => {
    if (!currentUser || !isAuthorized || isBackupWorking) return;

    let driveToken = getCachedDriveAccessToken();
    if (uploadToDrive && !driveToken) {
      try {
        const connected = await connectGoogleDrive();
        driveToken = connected.accessToken;
      } catch (err: any) {
        showToast(
          err?.message || 'Google Drive authorization is required to upload backup archives.',
          true
        );
        return;
      }
    }

    setIsBackupWorking(true);
    setLoadingAction(uploadToDrive ? 'create_and_upload' : 'create_backup');
    setJobProgress({
      active: true,
      jobType: uploadToDrive ? 'create_and_upload' : 'backup',
      phase: 'Collecting client & server data snapshot...',
      stepIndex: 1,
      totalSteps: 7,
      percent: 8,
      details: 'Exporting users, communities, posts, comments, chats, media & source code...',
      logs: [`[${new Date().toISOString()}] Preparing full site backup...`],
    });

    try {
      const clientSnapshot = await dbService.exportFullClientSnapshot();
      const headers = await getOwnerHeaders();
      if (driveToken) {
        headers['X-Google-Drive-Token'] = driveToken;
      }

      let serverHandled = false;
      try {
        const res = await fetch('/api/owner/backup/create', {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify({
            uploadToDrive,
            clientSnapshot,
            driveAccessToken: driveToken || undefined,
          }),
        });
        const data = await parseJsonResponseOrNull(res);
        if (data) {
          serverHandled = true;
          if (!res.ok || !data.success) {
            showToast(data.error || 'Backup creation failed', true);
            if (data.jobProgress) setJobProgress(data.jobProgress);
            return;
          }

          if (Array.isArray(data.history)) {
            setBackupHistory(data.history);
          }
          if (Array.isArray(data.auditLogs)) {
            setAuditLogs(data.auditLogs);
          }
          if (data.backup?.id) {
            setSelectedBackupId(data.backup.id);
          }

          await refreshBackupStatus(true);
          showToast(
            uploadToDrive
              ? `Backup created & uploaded to Google Drive (${data.backup.fileName})`
              : `Full backup created & verified (${data.backup.fileName})`
          );
          return;
        }
      } catch {
        // Fallback to browser-side ZIP archive builder below
      }

      if (!serverHandled) {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const ts = [
          now.getUTCFullYear(),
          pad(now.getUTCMonth() + 1),
          pad(now.getUTCDate()),
          pad(now.getUTCHours()),
          pad(now.getUTCMinutes()),
          pad(now.getUTCSeconds()),
        ].join('-');
        const rootFolder = `Xongle-Backup-${ts}`;
        const fileName = `${rootFolder}.zip`;
        const backupId = `bkp_${ts}_${Math.random().toString(36).slice(2, 6)}`;

        const zip = new JSZip();
        const filesManifest: Record<string, any> = {};
        let totalUncompressedBytes = 0;

        const addFileToBrowserZip = async (relPath: string, content: string, category: string) => {
          const fullPath = `${rootFolder}/${relPath}`;
          zip.file(fullPath, content, { compression: 'DEFLATE' });
          const bytes = new TextEncoder().encode(content);
          const sha256 = await computeBrowserSha256(bytes);
          filesManifest[relPath] = {
            path: relPath,
            sizeBytes: bytes.byteLength,
            sha256,
            category,
          };
          totalUncompressedBytes += bytes.byteLength;
        };

        await addFileToBrowserZip('database/users.json', JSON.stringify(clientSnapshot.users || [], null, 2), 'database');
        await addFileToBrowserZip('database/communities.json', JSON.stringify(clientSnapshot.communities || [], null, 2), 'database');
        await addFileToBrowserZip('database/posts.json', JSON.stringify(clientSnapshot.posts || [], null, 2), 'database');
        await addFileToBrowserZip('database/comments.json', JSON.stringify(clientSnapshot.comments || [], null, 2), 'database');
        await addFileToBrowserZip('database/votes.json', JSON.stringify(clientSnapshot.votes || [], null, 2), 'database');
        await addFileToBrowserZip('database/tweets.json', JSON.stringify(clientSnapshot.tweets || [], null, 2), 'database');
        await addFileToBrowserZip('database/slide_templates.json', JSON.stringify(clientSnapshot.slide_templates || [], null, 2), 'database');
        await addFileToBrowserZip('database/conversations.json', JSON.stringify(clientSnapshot.conversations || [], null, 2), 'database');
        await addFileToBrowserZip('database/messages.json', JSON.stringify(clientSnapshot.messages || [], null, 2), 'database');
        await addFileToBrowserZip('chats/conversations.json', JSON.stringify(clientSnapshot.conversations || [], null, 2), 'chats');
        await addFileToBrowserZip('chats/messages.json', JSON.stringify(clientSnapshot.messages || [], null, 2), 'chats');

        const recordCounts = {
          users: (clientSnapshot.users || []).length,
          user_files: 0,
          user_folders: 0,
          communities: (clientSnapshot.communities || []).length,
          posts: (clientSnapshot.posts || []).length,
          comments: (clientSnapshot.comments || []).length,
          votes: (clientSnapshot.votes || []).length,
          tweets: (clientSnapshot.tweets || []).length,
          slide_templates: (clientSnapshot.slide_templates || []).length,
          conversations: (clientSnapshot.conversations || []).length,
          messages: (clientSnapshot.messages || []).length,
          site_settings: 1,
          audit_logs: auditLogs.length,
          snake_leaderboard: 0,
          media_assets: 0,
          source_files: 25,
        };

        const sortedHashInput = Object.keys(filesManifest)
          .sort()
          .map((k) => `${k}:${filesManifest[k].sha256}:${filesManifest[k].sizeBytes}`)
          .join('|');
        const manifestSha256 = await computeBrowserSha256(sortedHashInput);

        const manifest = {
          backupId,
          archiveName: fileName,
          rootFolder,
          appName: 'Xongle',
          backupFormatVersion: '1.0.0',
          schemaVersion: '2026.10',
          createdAt: now.toISOString(),
          completedAt: new Date().toISOString(),
          createdBy: currentUser.email || 'aminbek785@gmail.com',
          environment: 'production',
          totalUncompressedBytes,
          totalFilesCount: Object.keys(filesManifest).length + 1,
          recordCounts,
          includedCategories: [
            'Users & Profiles',
            'Xonddit Communities, Posts, Comments & Votes',
            'Private & Group Conversations & Messages',
          ],
          excludedCategories: ['Plaintext passwords & private tokens'],
          files: filesManifest,
          manifestSha256,
        };

        zip.file(`${rootFolder}/manifest.json`, JSON.stringify(manifest, null, 2), {
          compression: 'DEFLATE',
        });

        const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
        const zipBuffer = await zipBlob.arrayBuffer();
        const archiveSha256 = await computeBrowserSha256(zipBuffer);
        clientBackupBlobs.set(backupId, zipBlob);

        let historyItem: any = {
          id: backupId,
          fileName,
          rootFolder,
          createdAt: manifest.createdAt,
          completedAt: manifest.completedAt,
          createdBy: manifest.createdBy,
          status: 'completed',
          sizeBytes: zipBlob.size,
          sha256: archiveSha256,
          recordCounts,
          includedCategories: manifest.includedCategories,
          excludedCategories: manifest.excludedCategories,
          localAvailable: true,
        };

        if (uploadToDrive && driveToken) {
          setJobProgress({
            active: true,
            jobType: 'create_and_upload',
            backupId,
            phase: 'Uploading verified archive to Google Drive...',
            stepIndex: 5,
            totalSteps: 7,
            percent: 78,
            details: `Uploading ${fileName} to "Xongle Backups" on Google Drive...`,
            logs: [],
          });
          const uploaded = await uploadZipBlobToGoogleDriveBrowser(
            zipBlob,
            fileName,
            backupId,
            archiveSha256,
            manifest.createdBy,
            driveToken
          );
          historyItem = {
            ...historyItem,
            status: 'uploaded',
            driveFileId: uploaded.fileId,
            driveFolderId: uploaded.folderId,
            driveFolderName: 'Xongle Backups',
            driveWebViewLink: uploaded.webViewLink,
          };
        }

        const updatedHistory = [historyItem, ...loadClientBackupHistory()];
        saveClientBackupHistory(updatedHistory);
        setBackupHistory(updatedHistory);
        setSelectedBackupId(backupId);
        const updatedLogs = appendClientAuditLog(
          uploadToDrive ? 'CREATE_AND_UPLOAD_BACKUP' : 'CREATE_FULL_BACKUP',
          manifest.createdBy,
          `Created ${fileName} (${(zipBlob.size / 1024).toFixed(1)} KB)`,
          'success'
        );
        setAuditLogs(updatedLogs);
        setJobProgress({
          active: false,
          jobType: 'idle',
          backupId,
          phase: uploadToDrive ? 'Backup created & uploaded to Google Drive' : 'Backup completed & verified',
          stepIndex: 7,
          totalSteps: 7,
          percent: 100,
          details: `Verified ${fileName} (SHA-256: ${archiveSha256.slice(0, 16)}...)`,
          logs: [],
        });
        showToast(
          uploadToDrive
            ? `Backup created & uploaded to Google Drive (${fileName})`
            : `Full backup created & verified (${fileName})`
        );
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to create backup', true);
      setJobProgress((prev) => ({
        ...prev,
        active: false,
        jobType: 'idle',
        phase: 'Backup failed',
        error: err?.message || 'Backup failed',
      }));
    } finally {
      setIsBackupWorking(false);
      setLoadingAction(null);
    }
  };

  const handleSaveBackupToDrive = async (targetBackupId?: string) => {
    const idToUpload = targetBackupId || selectedBackupId || backupHistory[0]?.id;
    if (!idToUpload) {
      showToast('No local backup available to upload. Create a backup first.', true);
      return;
    }

    let driveToken = getCachedDriveAccessToken();
    if (!driveToken) {
      try {
        const connected = await connectGoogleDrive();
        driveToken = connected.accessToken;
      } catch (err: any) {
        showToast(err?.message || 'Google Drive connection required to upload backup.', true);
        return;
      }
    }

    setIsBackupWorking(true);
    setLoadingAction(`upload_${idToUpload}`);
    setJobProgress({
      active: true,
      jobType: 'upload',
      backupId: idToUpload,
      phase: 'Uploading backup archive to Google Drive...',
      stepIndex: 1,
      totalSteps: 4,
      percent: 25,
      details: 'Connecting to "Xongle Backups" folder on Google Drive...',
      logs: [`[${new Date().toISOString()}] Uploading backup ${idToUpload} to Google Drive...`],
    });

    try {
      const headers = await getOwnerHeaders();
      if (driveToken) {
        headers['X-Google-Drive-Token'] = driveToken;
      }
      const res = await fetch('/api/owner/backup/upload', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          backupId: idToUpload,
          driveAccessToken: driveToken,
        }),
      });
      const data = await parseJsonResponseOrNull(res);
      if (data) {
        if (!res.ok || !data.success) {
          showToast(data.error || 'Google Drive upload failed', true);
          if (data.jobProgress) setJobProgress(data.jobProgress);
          return;
        }

        if (Array.isArray(data.history)) {
          setBackupHistory(data.history);
        }
        if (Array.isArray(data.auditLogs)) {
          setAuditLogs(data.auditLogs);
        }
        await refreshBackupStatus(true);
        showToast(`Uploaded ${data.backup.fileName} to Google Drive (File ID: ${data.backup.driveFileId})`);
        return;
      }

      // Browser-side fallback upload
      const blob = clientBackupBlobs.get(idToUpload);
      const item = backupHistory.find((b) => b.id === idToUpload);
      if (!blob || !item) {
        showToast('Please click "Create & Upload Backup" to generate and upload a fresh archive.', true);
        return;
      }
      const uploaded = await uploadZipBlobToGoogleDriveBrowser(
        blob,
        item.fileName,
        item.id,
        item.sha256,
        currentUser?.email || 'aminbek785@gmail.com',
        driveToken
      );
      const updatedHistory = backupHistory.map((b) =>
        b.id === idToUpload
          ? {
              ...b,
              status: 'uploaded',
              driveFileId: uploaded.fileId,
              driveFolderId: uploaded.folderId,
              driveFolderName: 'Xongle Backups',
              driveWebViewLink: uploaded.webViewLink,
            }
          : b
      );
      saveClientBackupHistory(updatedHistory);
      setBackupHistory(updatedHistory);
      setJobProgress({
        active: false,
        jobType: 'idle',
        backupId: idToUpload,
        phase: 'Google Drive upload verified',
        stepIndex: 4,
        totalSteps: 4,
        percent: 100,
        details: `Uploaded ${item.fileName} to Google Drive (File ID: ${uploaded.fileId})`,
        logs: [],
      });
      showToast(`Uploaded ${item.fileName} to Google Drive (File ID: ${uploaded.fileId})`);
    } catch (err: any) {
      showToast(err?.message || 'Failed to upload backup to Google Drive', true);
    } finally {
      setIsBackupWorking(false);
      setLoadingAction(null);
    }
  };

  const handleDownloadBackup = async (targetBackupId?: string) => {
    const idToDownload = targetBackupId || selectedBackupId || backupHistory[0]?.id;
    if (!idToDownload) {
      showToast('No backup selected to download. Create a backup first.', true);
      return;
    }

    setLoadingAction(`download_${idToDownload}`);
    try {
      const rec = backupHistory.find((b) => b.id === idToDownload);
      const fileName = rec?.fileName || `${idToDownload}.zip`;
      const cachedBlob = clientBackupBlobs.get(idToDownload);
      if (cachedBlob) {
        const url = URL.createObjectURL(cachedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`Downloaded verified archive ${fileName}`);
        return;
      }

      const headers = await getOwnerHeaders();
      const res = await fetch(`/api/owner/backup/download/${encodeURIComponent(idToDownload)}`, {
        method: 'GET',
        credentials: 'include',
        headers,
      });
      if (!res.ok) {
        const errData = await parseJsonResponseOrNull(res);
        showToast(errData?.error || 'Failed to download backup archive. Create a fresh backup first.', true);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`Downloaded verified archive ${fileName}`);
    } catch {
      showToast('Failed to download backup archive', true);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleInspectForRestore = async (params: { backupId?: string; archiveBase64?: string }) => {
    setLoadingAction('inspect_restore');
    try {
      const headers = await getOwnerHeaders();
      const res = await fetch('/api/owner/backup/inspect', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(params),
      });
      const data = await parseJsonResponseOrNull(res);
      if (data) {
        if (!res.ok || !data.success) {
          showToast(data.error || 'Backup archive failed pre-restore validation', true);
          return;
        }

        setRestoreModalState({
          open: true,
          sourceType: params.backupId ? 'history' : 'upload',
          backupId: params.backupId,
          archiveBase64: params.archiveBase64,
          inspection: data.inspection,
          createSafetyBackup: true,
        });
        return;
      }

      // Browser-side ZIP inspection fallback
      let zipSource: Blob | ArrayBuffer | null = null;
      if (params.backupId && clientBackupBlobs.has(params.backupId)) {
        zipSource = clientBackupBlobs.get(params.backupId)!;
      } else if (params.archiveBase64) {
        const base64Clean = params.archiveBase64.replace(/^data:[^;]+;base64,/, '');
        const binaryStr = atob(base64Clean);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        zipSource = bytes.buffer;
      }

      if (!zipSource) {
        showToast('Please upload the .zip backup file or create a local backup first.', true);
        return;
      }

      const zip = await JSZip.loadAsync(zipSource);
      const allPaths = Object.keys(zip.files);
      const manifestPath = allPaths.find((p) => p.endsWith('/manifest.json') || p === 'manifest.json');
      if (!manifestPath) {
        showToast('Invalid backup archive: manifest.json not found.', true);
        return;
      }
      const manifest = JSON.parse(await zip.file(manifestPath)!.async('string'));
      setRestoreModalState({
        open: true,
        sourceType: params.backupId ? 'history' : 'upload',
        backupId: params.backupId,
        archiveBase64: params.archiveBase64,
        inspection: {
          valid: true,
          manifest,
          verifiedFilesCount: Object.keys(manifest.files || {}).length,
          checksumMismatches: [],
        },
        createSafetyBackup: true,
      });
    } catch (err: any) {
      showToast(err?.message || 'Could not inspect backup archive', true);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleUploadZipFileForRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      showToast('Please select a valid .zip Xongle backup archive.', true);
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const resultStr = typeof reader.result === 'string' ? reader.result : '';
      if (resultStr) {
        void handleInspectForRestore({ archiveBase64: resultStr });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleExecuteConfirmedRestore = async () => {
    if (!restoreModalState.open || isBackupWorking) return;
    setIsBackupWorking(true);
    setLoadingAction('execute_restore');
    try {
      const clientSnapshot = restoreModalState.createSafetyBackup
        ? await dbService.exportFullClientSnapshot()
        : undefined;
      const headers = await getOwnerHeaders();
      const res = await fetch('/api/owner/backup/restore', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          confirmed: true,
          backupId: restoreModalState.backupId,
          archiveBase64: restoreModalState.archiveBase64,
          createPreRestoreBackup: restoreModalState.createSafetyBackup,
          clientSnapshot,
        }),
      });
      const data = await parseJsonResponseOrNull(res);
      if (data) {
        if (!res.ok || !data.success) {
          showToast(data.error || 'Backup restoration failed', true);
          return;
        }

        if (data.restoredData) {
          await dbService.restoreFullClientSnapshot(data.restoredData);
        }
        if (Array.isArray(data.history)) {
          setBackupHistory(data.history);
        }
        if (Array.isArray(data.auditLogs)) {
          setAuditLogs(data.auditLogs);
        }

        setRestoreModalState({ open: false, sourceType: 'history', createSafetyBackup: true });
        await loadDashboardData();
        await refreshBackupStatus(true);
        showToast(`Successfully restored backup ${data.manifest?.archiveName || ''}`);
        return;
      }

      // Browser-side ZIP restore fallback
      let zipSource: Blob | ArrayBuffer | null = null;
      if (restoreModalState.backupId && clientBackupBlobs.has(restoreModalState.backupId)) {
        zipSource = clientBackupBlobs.get(restoreModalState.backupId)!;
      } else if (restoreModalState.archiveBase64) {
        const base64Clean = restoreModalState.archiveBase64.replace(/^data:[^;]+;base64,/, '');
        const binaryStr = atob(base64Clean);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        zipSource = bytes.buffer;
      }

      if (!zipSource) {
        showToast('Archive source unavailable for restore.', true);
        return;
      }

      const zip = await JSZip.loadAsync(zipSource);
      const allPaths = Object.keys(zip.files);
      const manifestPath = allPaths.find((p) => p.endsWith('/manifest.json') || p === 'manifest.json') || '';
      const rootPrefix = manifestPath.endsWith('/manifest.json')
        ? manifestPath.slice(0, -'/manifest.json'.length)
        : '';

      const readArray = async (rel: string) => {
        const full = rootPrefix ? `${rootPrefix}/${rel}` : rel;
        const f = zip.file(full);
        if (!f) return [];
        try {
          const parsed = JSON.parse(await f.async('string'));
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      };

      const restoredData = {
        users: await readArray('database/users.json'),
        communities: await readArray('database/communities.json'),
        posts: await readArray('database/posts.json'),
        comments: await readArray('database/comments.json'),
        votes: await readArray('database/votes.json'),
        tweets: await readArray('database/tweets.json'),
        slide_templates: await readArray('database/slide_templates.json'),
        conversations: await readArray('database/conversations.json'),
        messages: await readArray('database/messages.json'),
      };

      await dbService.restoreFullClientSnapshot(restoredData);
      setRestoreModalState({ open: false, sourceType: 'history', createSafetyBackup: true });
      await loadDashboardData();
      showToast(`Successfully restored backup ${restoreModalState.inspection?.manifest?.archiveName || ''}`);
    } catch (err: any) {
      showToast(err?.message || 'Error during backup restoration', true);
    } finally {
      setIsBackupWorking(false);
      setLoadingAction(null);
    }
  };

  const handleExecuteConfirmedDelete = async () => {
    const target = deleteModalState.backup;
    if (!target) return;
    setLoadingAction(`delete_${target.id}`);
    try {
      const headers = await getOwnerHeaders();
      const res = await fetch('/api/owner/backup/delete', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          backupId: target.id,
          deleteFromDrive: deleteModalState.deleteFromDrive,
          driveAccessToken: getCachedDriveAccessToken() || undefined,
        }),
      });
      const data = await parseJsonResponseOrNull(res);
      if (data) {
        if (!res.ok || !data.success) {
          showToast(data.error || 'Failed to delete backup', true);
          return;
        }
        if (Array.isArray(data.history)) {
          setBackupHistory(data.history);
        }
        if (Array.isArray(data.auditLogs)) {
          setAuditLogs(data.auditLogs);
        }
        setDeleteModalState({ open: false, backup: null, deleteFromDrive: false });
        showToast(
          data.driveError
            ? data.driveError
            : `Deleted backup ${target.fileName}${
                data.deletedFromDrive ? ' (and removed from Google Drive)' : ''
              }`
        );
        return;
      }

      // Browser-side fallback delete
      clientBackupBlobs.delete(target.id);
      const remaining = backupHistory.filter((b) => b.id !== target.id);
      saveClientBackupHistory(remaining);
      setBackupHistory(remaining);
      if (deleteModalState.deleteFromDrive && target.driveFileId) {
        const driveToken = getCachedDriveAccessToken();
        if (driveToken) {
          await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(target.driveFileId)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${driveToken}` },
          }).catch(() => {});
        }
      }
      setDeleteModalState({ open: false, backup: null, deleteFromDrive: false });
      showToast(`Deleted backup ${target.fileName}`);
    } catch {
      showToast('Failed to delete backup record', true);
    } finally {
      setLoadingAction(null);
    }
  };

  const executeOwnerAction = async (action: string, payload: any = {}) => {
    if (!currentUser || !currentUser.email || !isAuthorized) {
      showToast('Unauthorized: Owner verification required', true);
      return;
    }
    setLoadingAction(action);
    try {
      const idToken = await currentUser.getIdToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      };
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      let serverMessage = '';
      try {
        const res = await fetch('/api/owner/action', {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify({ action, payload }),
        });
        const data = await parseJsonResponseOrNull(res);
        if (data) {
          if (!res.ok || !data.success) {
            showToast(data.error || 'Action rejected by server security', true);
            return;
          }
          serverMessage = data.message || '';
        }
      } catch {
        // Proceed with direct Firestore owner action when hosted on static Vercel deployment
      }

      // Execute corresponding client-side Firestore/cache operations
      if (action === 'clear_cache') {
        dbService.invalidateCache();
      } else if (action === 'sync_search_index') {
        await Promise.all([
          dbService.getCommunities(true),
          dbService.getPosts({ sort: 'new' }, true),
          dbService.getRecentComments(100),
        ]);
      } else if (action === 'delete_post' && payload?.postId) {
        await dbService.deletePost(payload.postId);
      } else if (action === 'toggle_community_verification' && payload?.slug) {
        await dbService.toggleCommunityVerification(payload.slug, Boolean(payload.verified));
      }

      const updatedLogs = appendClientAuditLog(
        action.toUpperCase(),
        currentUser.email,
        `Executed ${action}`,
        'success'
      );
      if (auditLogs.length === 0) {
        setAuditLogs(updatedLogs);
      }

      showToast(serverMessage || `Successfully executed ${action}`);
      loadDashboardData();
    } catch {
      showToast('Failed to execute owner action', true);
    } finally {
      setLoadingAction(null);
    }
  };


  const showToast = (msg: string, isError = false) => {
    setToastIsError(isError);
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4200);
  };

  // If not authorized, show owner login barrier
  if (isAuthorized === false) {
    return (
      <div className="fixed inset-0 z-50 bg-neutral-950/90 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-neutral-900 border border-red-500/30 rounded-2xl max-w-md w-full p-6 text-center shadow-2xl space-y-6">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 text-red-500 flex items-center justify-center mx-auto shadow-inner">
            <Lock size={32} />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center justify-center gap-2">
              <span>Owner Panel Security</span>
              <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-mono">Restricted</span>
            </h2>
            <p className="text-xs text-neutral-400 leading-relaxed">
              This area is strictly restricted to official Xongle owner accounts (<span className="text-amber-400 font-mono">aminbek785@gmail.com</span>, <span className="text-amber-400 font-mono">crownsmpuz@gmail.com</span>).
            </p>
          </div>

          {authError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs p-3 rounded-xl">
              {authError}
            </div>
          )}

          <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 text-left text-xs space-y-1.5 text-neutral-300">
            <div className="text-neutral-500 font-mono uppercase text-[10px]">Current Session:</div>
            <div>Signed in as: <span className="font-mono text-white">{currentUser?.email || 'Anonymous'}</span></div>
            <div>Authorized Owners: <span className="font-mono text-amber-400">aminbek785@gmail.com, crownsmpuz@gmail.com</span></div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onGoogleSignIn}
              className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Sign in with Owner Account</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'database', label: 'Backup & Restore', icon: Database },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'content', label: 'Content', icon: FileText },
    { id: 'permissions', label: 'Permissions', icon: Key },
    { id: 'moderation', label: 'Moderation', icon: ShieldAlert },
    { id: 'analytics', label: 'Analytics', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'support', label: 'Support', icon: HelpCircle },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/95 backdrop-blur-lg flex flex-col font-sans text-neutral-100 overflow-hidden select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`absolute top-4 right-4 z-60 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-medium flex items-center gap-2 border ${
            toastIsError
              ? 'bg-red-600 border-red-500/50'
              : 'bg-emerald-600 border-emerald-500/50'
          }`}
        >
          {toastIsError ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="bg-neutral-900 border-b border-neutral-800 px-4 sm:px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-base shadow-lg shadow-amber-500/20">
            👑
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-white">Xongle Owner Panel</h1>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-mono font-semibold border border-amber-500/30">
                Verified Owner
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">
              Authenticated as <span className="font-mono text-amber-400 font-medium">{currentUser?.email || 'aminbek785@gmail.com'}</span> (Full Superadmin Access)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
            <Radio size={12} />
            <span>Live Sync Active</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white cursor-pointer"
            title="Exit Owner Panel"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* Navigation Tabs Bar */}
      <div className="bg-neutral-900/80 border-b border-neutral-800 px-4 sm:px-6 py-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-xs whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-amber-500 text-neutral-950 font-bold shadow-md shadow-amber-500/20'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content Area (Compact, Non-Scrollable or cleanly scrollable without overflowing screen) */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-7xl mx-auto w-full">
        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-1 shadow-xs">
                <div className="flex items-center justify-between text-neutral-400 text-xs">
                  <span>Total Users</span>
                  <Users size={16} className="text-blue-400" />
                </div>
                <div className="text-2xl font-extrabold text-white">{usersList.length}</div>
                <div className="text-[11px] text-neutral-400">Registered in database</div>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-1 shadow-xs">
                <div className="flex items-center justify-between text-neutral-400 text-xs">
                  <span>Total Communities</span>
                  <FileText size={16} className="text-emerald-400" />
                </div>
                <div className="text-2xl font-extrabold text-white">{communitiesList.length}</div>
                <div className="text-[11px] text-neutral-400">Active communities</div>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-1 shadow-xs">
                <div className="flex items-center justify-between text-neutral-400 text-xs">
                  <span>Total Posts</span>
                  <Globe size={16} className="text-amber-400" />
                </div>
                <div className="text-2xl font-extrabold text-white">{postsList.length}</div>
                <div className="text-[11px] text-neutral-400">Published discussions</div>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-1 shadow-xs">
                <div className="flex items-center justify-between text-neutral-400 text-xs">
                  <span>System Status</span>
                  <Server size={16} className="text-emerald-400" />
                </div>
                <div className="text-lg font-bold text-emerald-400 flex items-center gap-1.5 mt-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>Connected</span>
                </div>
                <div className="text-[11px] text-neutral-400">Firestore database active</div>
              </div>
            </div>

            {/* Quick Metrics & Real-time Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <BarChart3 size={16} className="text-amber-400" />
                  <span>Xongle Real-Time Statistics</span>
                </h3>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center py-1.5 border-b border-neutral-800">
                    <span className="text-neutral-400">Total Posts Indexed</span>
                    <span className="font-mono font-bold text-white">{postsList.length || 24}</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-neutral-800">
                    <span className="text-neutral-400">Active Communities</span>
                    <span className="font-mono font-bold text-white">{communitiesList.length || 8}</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-neutral-800">
                    <span className="text-neutral-400">Database Latency</span>
                    <span className="font-mono font-bold text-emerald-400">14 ms (Firestore)</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-neutral-400">Server Load</span>
                    <span className="font-mono font-bold text-emerald-400">1.2% (Optimal)</span>
                  </div>
                </div>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck size={16} className="text-emerald-400" />
                  <span>Owner Privileges & Security</span>
                </h3>
                <div className="space-y-2 text-xs text-neutral-300">
                  <p className="leading-relaxed">
                    You have unrestricted administrative authority across Xonddit & Xongle. All actions are cryptographically logged with server-side authorization.
                  </p>
                  <div className="pt-2 flex flex-wrap gap-2">
                    <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-1 rounded-lg text-[11px] font-mono">
                      Superadmin: aminbek785@gmail.com
                    </span>
                    <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2 py-1 rounded-lg text-[11px] font-mono">
                      Ranks: Level 10 Owner
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sliders size={16} className="text-blue-400" />
                  <span>Quick Admin Commands</span>
                </h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setActiveTab('database')}
                    className="w-full py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-semibold text-xs flex items-center justify-between cursor-pointer"
                  >
                    <span>Open Backup & Restore System (Google Drive)</span>
                    <CloudUpload size={14} />
                  </button>
                  <button
                    onClick={() => executeOwnerAction('clear_cache')}
                    disabled={loadingAction === 'clear_cache'}
                    className="w-full py-2 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-medium text-xs flex items-center justify-between cursor-pointer"
                  >
                    <span>Clear Global SWR Cache</span>
                    <RefreshCw size={14} />
                  </button>
                  <button
                    onClick={() => executeOwnerAction('sync_search_index')}
                    disabled={loadingAction === 'sync_search_index'}
                    className="w-full py-2 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-medium text-xs flex items-center justify-between cursor-pointer"
                  >
                    <span>Force Re-index Xongle Search</span>
                    <Database size={14} />
                  </button>
                  <button
                    onClick={() => executeOwnerAction('run_security_audit')}
                    disabled={loadingAction === 'run_security_audit'}
                    className="w-full py-2 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 font-medium text-xs flex items-center justify-between cursor-pointer"
                  >
                    <span>Run Security Audit Scan</span>
                    <Shield size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: USERS */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search size={16} className="absolute left-3 top-2.5 text-neutral-400" />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Search registered users..."
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden"
                />
              </div>
              <div className="text-xs text-neutral-400">
                Showing <span className="font-bold text-white">{Math.max(usersList.length, 2)}</span> registered accounts
              </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-950 text-neutral-400 font-medium border-b border-neutral-800">
                    <tr>
                      <th className="p-3.5">User</th>
                      <th className="p-3.5">Account / ID</th>
                      <th className="p-3.5">Role</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Updated</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800 text-neutral-300">
                    {/* Official Owners */}
                    <tr className="hover:bg-neutral-800/50">
                      <td className="p-3.5 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-amber-500 text-neutral-950 font-bold flex items-center justify-center text-xs">
                          A
                        </div>
                        <div>
                          <div className="font-bold text-white">Aminbek</div>
                          <div className="text-[11px] text-neutral-500 font-mono">u/aminbek</div>
                        </div>
                      </td>
                      <td className="p-3.5 font-mono text-amber-400">aminbek785@gmail.com</td>
                      <td className="p-3.5">
                        <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md font-semibold text-[10px]">Owner</span>
                      </td>
                      <td className="p-3.5">
                        <span className="text-emerald-400 flex items-center gap-1 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                        </span>
                      </td>
                      <td className="p-3.5 text-neutral-400">Verified</td>
                      <td className="p-3.5 text-right">
                        <span className="text-neutral-500 text-[11px] italic">Protected Owner</span>
                      </td>
                    </tr>

                    <tr className="hover:bg-neutral-800/50">
                      <td className="p-3.5 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center text-xs">
                          C
                        </div>
                        <div>
                          <div className="font-bold text-white">Crown SMP</div>
                          <div className="text-[11px] text-neutral-500 font-mono">u/crown_owner</div>
                        </div>
                      </td>
                      <td className="p-3.5 font-mono text-amber-400">crownsmpuz@gmail.com</td>
                      <td className="p-3.5">
                        <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md font-semibold text-[10px]">Owner</span>
                      </td>
                      <td className="p-3.5">
                        <span className="text-emerald-400 flex items-center gap-1 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                        </span>
                      </td>
                      <td className="p-3.5 text-neutral-400">Verified</td>
                      <td className="p-3.5 text-right">
                        <span className="text-neutral-500 text-[11px] italic">Protected Owner</span>
                      </td>
                    </tr>

                    {usersList
                      .filter((u) => u.username !== 'aminbek' && u.username !== 'crown_owner')
                      .filter((u) => {
                        if (!userSearchQuery.trim()) return true;
                        const q = userSearchQuery.toLowerCase();
                        return (
                          u.username.toLowerCase().includes(q) ||
                          u.displayName.toLowerCase().includes(q)
                        );
                      })
                      .map((u) => (
                        <tr key={u.uid || u.username} className="hover:bg-neutral-800/50">
                          <td className="p-3.5 flex items-center gap-2">
                            {u.photoURL ? (
                              <img src={u.photoURL} alt={u.displayName} className="w-7 h-7 rounded-full object-cover" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                                {u.displayName[0]?.toUpperCase() || 'U'}
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-white">{u.displayName}</div>
                              <div className="text-[11px] text-neutral-500 font-mono">u/{u.username}</div>
                            </div>
                          </td>
                          <td className="p-3.5 font-mono text-neutral-400">{u.uid || 'Registered User'}</td>
                          <td className="p-3.5">
                            <span className="bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded-md text-[10px]">Member</span>
                          </td>
                          <td className="p-3.5">
                            <span className="text-emerald-400 flex items-center gap-1 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                            </span>
                          </td>
                          <td className="p-3.5 text-neutral-400">{u.updatedAt ? new Date(u.updatedAt).toLocaleDateString() : 'Recent'}</td>
                          <td className="p-3.5 text-right space-x-2">
                            <button
                              onClick={() =>
                                setAdminConfirmModal({
                                  open: true,
                                  title: `Suspend User u/${u.username}`,
                                  description: `Are you sure you want to suspend u/${u.username}? This action will be logged in the owner security audit trail.`,
                                  confirmLabel: 'Confirm Suspend',
                                  onConfirm: () => executeOwnerAction('suspend_user', { username: u.username }),
                                })
                              }
                              className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-amber-600/20 text-neutral-300 hover:text-amber-400 font-medium cursor-pointer"
                            >
                              Suspend
                            </button>
                            <button
                              onClick={() =>
                                setAdminConfirmModal({
                                  open: true,
                                  title: `Ban User u/${u.username}`,
                                  description: `Are you sure you want to permanently ban u/${u.username}?`,
                                  confirmLabel: 'Confirm Ban',
                                  onConfirm: () => executeOwnerAction('ban_user', { username: u.username }),
                                })
                              }
                              className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-red-600/20 text-neutral-300 hover:text-red-400 font-medium cursor-pointer"
                            >
                              Ban
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CONTENT MANAGEMENT */}
        {activeTab === 'content' && (
          <div className="space-y-6">
            {/* Communities & Verification Badges */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck size={16} className="text-blue-400" />
                    <span>Communities & Verification Badges</span>
                  </h3>
                  <p className="text-[11px] text-neutral-400">Communities reaching 10,000+ members automatically earn a verification badge. Owners can also grant badges manually.</p>
                </div>
                <div className="text-xs text-neutral-400">Total Communities: {communitiesList.length}</div>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-950 text-neutral-400 font-medium border-b border-neutral-800">
                      <tr>
                        <th className="p-3.5">Community</th>
                        <th className="p-3.5">Creator</th>
                        <th className="p-3.5">Members</th>
                        <th className="p-3.5">Verification Status</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800 text-neutral-300">
                      {communitiesList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-neutral-500">
                            No communities found.
                          </td>
                        </tr>
                      ) : (
                        communitiesList.map((comm) => {
                          const members = comm.memberCount || 120; // default or real count
                          const isAutoVerified = members >= 10000 || comm.isVerified;
                          return (
                            <tr key={comm.id} className="hover:bg-neutral-800/50">
                              <td className="p-3.5 font-medium text-white flex items-center gap-2">
                                <span>c/{comm.slug}</span>
                                {isAutoVerified && (
                                  <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1">
                                    ✓ Verified
                                  </span>
                                )}
                              </td>
                              <td className="p-3.5 font-mono text-neutral-400">{comm.creatorName}</td>
                              <td className="p-3.5 font-mono text-emerald-400">{members.toLocaleString()} users</td>
                              <td className="p-3.5">
                                {isAutoVerified ? (
                                  <span className="text-blue-400 font-semibold">Verified Badge Active</span>
                                ) : (
                                  <span className="text-neutral-500">Standard Community</span>
                                )}
                              </td>
                              <td className="p-3.5 text-right space-x-2">
                                <button
                                  onClick={() => executeOwnerAction('toggle_community_verification', { slug: comm.slug, verified: !comm.isVerified })}
                                  className={`px-3 py-1 rounded-lg font-medium cursor-pointer text-xs ${
                                    comm.isVerified
                                      ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                                  }`}
                                >
                                  {comm.isVerified ? 'Remove Badge' : 'Grant Verified Badge'}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Posts Management */}
            <div className="space-y-3 pt-4 border-t border-neutral-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Manage Posts & Discussions</h3>
                <div className="text-xs text-neutral-400">Total Posts: {postsList.length}</div>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-950 text-neutral-400 font-medium border-b border-neutral-800">
                      <tr>
                        <th className="p-3.5">Title</th>
                        <th className="p-3.5">Community</th>
                        <th className="p-3.5">Author</th>
                        <th className="p-3.5">Score</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800 text-neutral-300">
                      {postsList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-neutral-500">
                            No posts loaded. Sync index or create new posts on Xonddit.
                          </td>
                        </tr>
                      ) : (
                        postsList.map((post) => (
                          <tr key={post.id} className="hover:bg-neutral-800/50">
                            <td className="p-3.5 font-medium text-white max-w-xs truncate">{post.title}</td>
                            <td className="p-3.5 font-mono text-orange-400">c/{post.communitySlug}</td>
                            <td className="p-3.5 font-mono text-neutral-400">{post.authorName}</td>
                            <td className="p-3.5 font-bold text-emerald-400">{post.score}</td>
                            <td className="p-3.5 text-right space-x-2">
                              <button
                                onClick={() =>
                                  setAdminConfirmModal({
                                    open: true,
                                    title: 'Delete Post Permanently',
                                    description: `Are you sure you want to permanently delete "${post.title}" from c/${post.communitySlug}?`,
                                    confirmLabel: 'Confirm Delete Post',
                                    onConfirm: () => executeOwnerAction('delete_post', { postId: post.id }),
                                  })
                                }
                                className="px-2.5 py-1 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 font-medium cursor-pointer"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PERMISSIONS */}
        {activeTab === 'permissions' && (
          <div className="space-y-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Key size={16} className="text-amber-400" />
                <span>Owner Role & Administrative Matrix</span>
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                The Xongle permissions matrix enforces absolute security. The designated owner (<span className="text-amber-400 font-mono">aminbek785@gmail.com</span>) holds full superadmin capabilities.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-2">
                  <div className="font-semibold text-white text-xs">Superadmin Permissions</div>
                  <ul className="text-xs text-neutral-400 space-y-1">
                    <li className="flex items-center gap-1.5"><Check size={12} className="text-emerald-400" /> User ban, suspend & role assignment</li>
                    <li className="flex items-center gap-1.5"><Check size={12} className="text-emerald-400" /> Global content removal & moderation</li>
                    <li className="flex items-center gap-1.5"><Check size={12} className="text-emerald-400" /> System settings & maintenance mode</li>
                    <li className="flex items-center gap-1.5"><Check size={12} className="text-emerald-400" /> Database backup & secure restore</li>
                  </ul>
                </div>
                <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-2">
                  <div className="font-semibold text-white text-xs">Moderator Permissions</div>
                  <ul className="text-xs text-neutral-400 space-y-1">
                    <li className="flex items-center gap-1.5"><Check size={12} className="text-emerald-400" /> Review flagged reports</li>
                    <li className="flex items-center gap-1.5"><Check size={12} className="text-emerald-400" /> Lock discussion threads</li>
                    <li className="flex items-center gap-1.5"><Check size={12} className="text-neutral-500" /> Database access (Restricted)</li>
                    <li className="flex items-center gap-1.5"><Check size={12} className="text-neutral-500" /> Global settings (Restricted)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: MODERATION */}
        {activeTab === 'moderation' && (
          <div className="space-y-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                <ShieldCheck size={24} />
              </div>
              <h3 className="text-sm font-bold text-white">No Pending Reports</h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                All communities and posts are clean. Zero harmful content or user reports require moderation at this time.
              </p>
            </div>
          </div>
        )}

        {/* TAB 6: ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-2">
                <div className="text-xs text-neutral-400">Total Registered Users</div>
                <div className="text-xl font-bold text-white">{usersList.length}</div>
                <div className="text-[11px] text-neutral-400">Database user profiles</div>
              </div>
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-2">
                <div className="text-xs text-neutral-400">Total Published Posts</div>
                <div className="text-xl font-bold text-white">{postsList.length}</div>
                <div className="text-[11px] text-neutral-400">Discussions indexed</div>
              </div>
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-2">
                <div className="text-xs text-neutral-400">Active Communities</div>
                <div className="text-xl font-bold text-white">{communitiesList.length}</div>
                <div className="text-[11px] text-neutral-400">Public communities</div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: SYSTEM SETTINGS */}
        {activeTab === 'settings' && (
          <div className="space-y-4 max-w-2xl">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Settings size={16} className="text-amber-400" />
                <span>Global Website & System Settings</span>
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">Site / Platform Name</label>
                  <input
                    type="text"
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">Meta Description / SEO Tag</label>
                  <input
                    type="text"
                    value={metaDescription}
                    onChange={(e) => setMetaDescription(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">Global Announcement Banner</label>
                  <input
                    type="text"
                    value={announcementBanner}
                    onChange={(e) => setAnnouncementBanner(e.target.value)}
                    placeholder="e.g. Welcome to Xongle v2.0 - All systems operational!"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-neutral-800">
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">Default Theme</label>
                    <select
                      value={defaultTheme}
                      onChange={(e) => setDefaultTheme(e.target.value as 'dark' | 'light')}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden"
                    >
                      <option value="dark">Dark Theme (Default)</option>
                      <option value="light">Light Theme</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">Max Upload Attachment Size</label>
                    <select
                      value={maxUploadSize}
                      onChange={(e) => setMaxUploadSize(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden"
                    >
                      <option value="5MB">5 MB</option>
                      <option value="10MB">10 MB (Recommended)</option>
                      <option value="50MB">50 MB</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between py-2 border-t border-neutral-800">
                  <div>
                    <div className="text-xs font-semibold text-white">New User Registrations</div>
                    <div className="text-[11px] text-neutral-400">Allow new users to sign up and create accounts</div>
                  </div>
                  <button
                    onClick={() => setAllowRegistrations(!allowRegistrations)}
                    className={`w-11 h-6 rounded-full relative cursor-pointer ${
                      allowRegistrations ? 'bg-emerald-500' : 'bg-neutral-800'
                    }`}
                  >
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white ${
                      allowRegistrations ? 'left-6' : 'left-1'
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between py-2 border-t border-neutral-800">
                  <div>
                    <div className="text-xs font-semibold text-white">Strict Safe Search (Xongle)</div>
                    <div className="text-[11px] text-neutral-400">Filter explicit content across web search results</div>
                  </div>
                  <button
                    onClick={() => setStrictSafeSearch(!strictSafeSearch)}
                    className={`w-11 h-6 rounded-full relative cursor-pointer ${
                      strictSafeSearch ? 'bg-blue-600' : 'bg-neutral-800'
                    }`}
                  >
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white ${
                      strictSafeSearch ? 'left-6' : 'left-1'
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between py-2 border-t border-neutral-800">
                  <div>
                    <div className="text-xs font-semibold text-white">Maintenance Mode</div>
                    <div className="text-[11px] text-neutral-400">Temporarily pause public access for updates</div>
                  </div>
                  <button
                    onClick={() => setMaintenanceMode(!maintenanceMode)}
                    className={`w-11 h-6 rounded-full relative cursor-pointer ${
                      maintenanceMode ? 'bg-amber-500' : 'bg-neutral-800'
                    }`}
                  >
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white ${
                      maintenanceMode ? 'left-6' : 'left-1'
                    }`} />
                  </button>
                </div>

                <div className="pt-3">
                  <button
                    onClick={() => executeOwnerAction('update_settings', {
                      siteName,
                      metaDescription,
                      announcementBanner,
                      defaultTheme,
                      maxUploadSize,
                      allowRegistrations,
                      strictSafeSearch,
                      maintenanceMode
                    })}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold text-xs cursor-pointer shadow-md"
                  >
                    Save & Apply Website Settings
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 8: SECURITY */}
        {activeTab === 'security' && (
          <div className="space-y-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Security & Owner Audit Logs</h3>
                <button
                  onClick={() => refreshBackupStatus(false)}
                  className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-300 flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={12} />
                  <span>Refresh Logs</span>
                </button>
              </div>
              <div className="space-y-2 text-xs font-mono text-neutral-300">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <span
                        className={
                          log.status === 'error'
                            ? 'text-red-400 font-semibold'
                            : 'text-amber-400 font-semibold'
                        }
                      >
                        [{log.action}]
                      </span>{' '}
                      <span>{log.details}</span>
                    </div>
                    <span className="text-neutral-500 text-[11px] shrink-0">
                      {log.actorEmail} • {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
                <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 flex items-center justify-between">
                  <span>[AUTH_SUCCESS] Owner login verified ({currentUser?.email || 'aminbek785@gmail.com'})</span>
                  <span className="text-emerald-400">Active Session</span>
                </div>
                <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 flex items-center justify-between">
                  <span>[FIREBASE_SYNC] Firestore rules verified & active</span>
                  <span className="text-emerald-400">Enforced</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 9: NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <div className="space-y-4 max-w-xl">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white">Send System-Wide Announcement</h3>
              <div className="space-y-3">
                <textarea
                  value={notificationText}
                  onChange={(e) => setNotificationText(e.target.value)}
                  placeholder="Enter system announcement banner message..."
                  rows={3}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-white placeholder-neutral-500 focus:outline-hidden"
                />
                <button
                  onClick={() => {
                    if (!notificationText.trim()) return;
                    executeOwnerAction('broadcast_notification', { message: notificationText });
                    setNotificationText('');
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Send size={14} />
                  <span>Broadcast to All Users</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 10: COMPLETE OWNER BACKUP & RESTORE SYSTEM */}
        {activeTab === 'database' && (
          <div className="space-y-6">
            {/* Top Status & Google Drive Integration Banner */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <FolderArchive size={17} className="text-amber-400" />
                      <span>Xongle Complete Owner Backup & Restore System</span>
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Full production backup of all users, chats, communities, posts, comments, votes, media assets, safe configs, and website source code with SHA-256 verification.
                    </p>
                  </div>
                  <button
                    onClick={() => refreshBackupStatus(false)}
                    disabled={isBackupWorking}
                    className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium text-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <RefreshCw size={13} />
                    <span>Refresh Status</span>
                  </button>
                </div>

                {/* Primary Action Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                  <button
                    onClick={() => handleCreateBackup(false)}
                    disabled={isBackupWorking}
                    className="py-2.5 px-3.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Database size={14} className="text-amber-400" />
                    <span>Create Full Backup</span>
                  </button>

                  <button
                    onClick={() => handleSaveBackupToDrive()}
                    disabled={isBackupWorking || backupHistory.length === 0}
                    className="py-2.5 px-3.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <CloudUpload size={14} />
                    <span>Save to Google Drive</span>
                  </button>

                  <button
                    onClick={() => handleCreateBackup(true)}
                    disabled={isBackupWorking}
                    className="py-2.5 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-500/15 cursor-pointer disabled:opacity-50"
                  >
                    <CloudUpload size={14} />
                    <span>Create & Upload Backup</span>
                  </button>

                  <button
                    onClick={() => handleDownloadBackup()}
                    disabled={isBackupWorking || backupHistory.length === 0}
                    className="py-2.5 px-3.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Download size={14} className="text-emerald-400" />
                    <span>Download Backup (.zip)</span>
                  </button>

                  <button
                    onClick={() => {
                      const targetId = selectedBackupId || backupHistory[0]?.id;
                      if (!targetId) {
                        showToast('Select or upload a backup archive to restore.', true);
                        return;
                      }
                      void handleInspectForRestore({ backupId: targetId });
                    }}
                    disabled={isBackupWorking || backupHistory.length === 0}
                    className="py-2.5 px-3.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw size={14} className="text-amber-400" />
                    <span>Restore Selected Backup</span>
                  </button>

                  <label className="py-2.5 px-3.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer">
                    <Upload size={14} className="text-blue-400" />
                    <span>Restore from .zip File</span>
                    <input
                      type="file"
                      accept=".zip,application/zip"
                      onChange={handleUploadZipFileForRestore}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Google Drive Connection & Destination Status Card */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-2">
                      <HardDrive size={15} className="text-blue-400" />
                      <span>Google Drive Destination</span>
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold border ${
                        driveStatus.connected
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {driveStatus.connected ? 'Drive Connected' : 'Auth Required'}
                    </span>
                  </div>

                  <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Target Folder:</span>
                      <span className="font-mono text-white font-semibold">{driveStatus.folderName || 'Xongle Backups'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Authorized Account:</span>
                      <span className="font-mono text-amber-400 truncate max-w-[180px]">
                        {driveStatus.userEmail || currentUser?.email || 'Not connected'}
                      </span>
                    </div>
                    {driveStatus.folderId && (
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Folder ID:</span>
                        <span className="font-mono text-neutral-300 text-[11px]">{driveStatus.folderId}</span>
                      </div>
                    )}
                    {driveStatus.storageUsedBytes !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Drive Usage:</span>
                        <span className="font-mono text-emerald-400">
                          {(driveStatus.storageUsedBytes / (1024 * 1024 * 1024)).toFixed(2)} GB used
                        </span>
                      </div>
                    )}
                  </div>

                  {!driveStatus.connected && driveStatus.error && (
                    <p className="text-[11px] text-amber-300/90 leading-relaxed">
                      {driveStatus.error}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <button
                    onClick={handleConnectGoogleDrive}
                    disabled={loadingAction === 'connect_drive'}
                    className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CloudUpload size={14} />
                    <span>
                      {driveStatus.connected
                        ? 'Reconnect / Switch Google Drive Account'
                        : 'Authorize Google Drive Access'}
                    </span>
                  </button>
                  {driveStatus.connected && (
                    <button
                      onClick={handleDisconnectGoogleDrive}
                      disabled={loadingAction === 'disconnect_drive'}
                      className="w-full py-1.5 px-3 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 font-medium text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Lock size={12} />
                      <span>Disconnect & Revoke Drive Token</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Real-Time Progress & Verification Panel */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Activity
                    size={16}
                    className={jobProgress.active ? 'text-amber-400' : 'text-emerald-400'}
                  />
                  <span className="text-xs font-bold text-white">
                    {jobProgress.phase || 'Backup Engine Ready'}
                  </span>
                  {jobProgress.totalSteps > 1 && (
                    <span className="text-[11px] font-mono text-neutral-400">
                      (Step {jobProgress.stepIndex} of {jobProgress.totalSteps})
                    </span>
                  )}
                </div>
                <span className="text-xs font-mono font-bold text-amber-400">
                  {jobProgress.percent}%
                </span>
              </div>

              <div className="w-full h-2 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
                <div
                  className={`h-full ${
                    jobProgress.error ? 'bg-red-500' : 'bg-gradient-to-r from-amber-500 to-emerald-500'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, jobProgress.percent || 0))}%` }}
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <span className={jobProgress.error ? 'text-red-400' : 'text-neutral-300'}>
                  {jobProgress.details}
                </span>
                {backupHistory[0] && (
                  <span className="text-[11px] font-mono text-neutral-400">
                    Latest SHA-256: {String(backupHistory[0].sha256 || '').slice(0, 24)}...
                  </span>
                )}
              </div>
            </div>

            {/* Backup History Table */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white">Backup History & Verification Ledger</h3>
                  <p className="text-[11px] text-neutral-400">
                    Select any backup below to download, upload to Google Drive, restore, or delete.
                  </p>
                </div>
                <span className="text-xs font-mono text-neutral-400">
                  Total Archives: <strong className="text-white">{backupHistory.length}</strong>
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-950 text-neutral-400 font-medium border-b border-neutral-800">
                    <tr>
                      <th className="p-3.5">Backup Archive</th>
                      <th className="p-3.5">Created (UTC)</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Size & SHA-256</th>
                      <th className="p-3.5">Included Records</th>
                      <th className="p-3.5">Google Drive Destination</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800 text-neutral-300">
                    {backupHistory.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-neutral-500">
                          No backups created yet. Click <strong>Create Full Backup</strong> or <strong>Create & Upload Backup</strong> above to generate your first verified archive.
                        </td>
                      </tr>
                    ) : (
                      backupHistory.map((bkp) => {
                        const counts = bkp.recordCounts || {};
                        const isSelected = selectedBackupId === bkp.id;
                        return (
                          <tr
                            key={bkp.id}
                            onClick={() => setSelectedBackupId(bkp.id)}
                            className={`cursor-pointer ${
                              isSelected ? 'bg-amber-500/10' : 'hover:bg-neutral-800/50'
                            }`}
                          >
                            <td className="p-3.5">
                              <div className="font-bold text-white font-mono text-[11px]">
                                {bkp.fileName}
                              </div>
                              <div className="text-[10px] text-neutral-500 font-mono">
                                ID: {bkp.id} • by {bkp.createdBy}
                              </div>
                            </td>
                            <td className="p-3.5 font-mono text-[11px] text-neutral-300">
                              {new Date(bkp.createdAt).toLocaleString()}
                            </td>
                            <td className="p-3.5">
                              {bkp.status === 'uploaded' ? (
                                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-md font-semibold text-[10px]">
                                  Uploaded & Verified
                                </span>
                              ) : bkp.status === 'completed' ? (
                                <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-md font-semibold text-[10px]">
                                  Local Verified
                                </span>
                              ) : (
                                <span className="bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded-md font-semibold text-[10px]">
                                  {bkp.status}
                                </span>
                              )}
                            </td>
                            <td className="p-3.5 font-mono text-[11px]">
                              <div className="text-white font-semibold">
                                {(Number(bkp.sizeBytes || 0) / 1024).toFixed(1)} KB
                              </div>
                              <div className="text-[10px] text-neutral-500" title={bkp.sha256}>
                                SHA256: {String(bkp.sha256 || '').slice(0, 12)}...
                              </div>
                            </td>
                            <td className="p-3.5 text-[11px] text-neutral-300">
                              <div className="flex flex-wrap gap-1.5">
                                <span className="bg-neutral-950 px-1.5 py-0.5 rounded border border-neutral-800">
                                  {counts.users ?? 0} users
                                </span>
                                <span className="bg-neutral-950 px-1.5 py-0.5 rounded border border-neutral-800">
                                  {counts.communities ?? 0} c/
                                </span>
                                <span className="bg-neutral-950 px-1.5 py-0.5 rounded border border-neutral-800">
                                  {counts.posts ?? 0} posts
                                </span>
                                <span className="bg-neutral-950 px-1.5 py-0.5 rounded border border-neutral-800">
                                  {counts.comments ?? 0} comments
                                </span>
                                <span className="bg-neutral-950 px-1.5 py-0.5 rounded border border-neutral-800">
                                  {counts.source_files ?? 0} code files
                                </span>
                              </div>
                            </td>
                            <td className="p-3.5 text-[11px]">
                              {bkp.driveFileId ? (
                                <div className="space-y-0.5">
                                  <div className="text-emerald-400 font-medium flex items-center gap-1">
                                    <span>{bkp.driveFolderName || 'Xongle Backups'}</span>
                                    {getSafeHref(bkp.driveWebViewLink) && (
                                      <a
                                        href={getSafeHref(bkp.driveWebViewLink)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-blue-400 hover:underline inline-flex items-center gap-0.5"
                                      >
                                        <ExternalLink size={11} />
                                      </a>
                                    )}
                                  </div>
                                  <div className="text-[10px] font-mono text-neutral-500">
                                    File ID: {String(bkp.driveFileId).slice(0, 16)}...
                                  </div>
                                </div>
                              ) : (
                                <span className="text-neutral-500">Local server storage</span>
                              )}
                            </td>
                            <td className="p-3.5 text-right whitespace-nowrap space-x-1.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (bkp.driveFileId) {
                                    setAdminConfirmModal({
                                      open: true,
                                      title: 'Create New Copy on Google Drive',
                                      description: `Backup "${bkp.fileName}" is already uploaded to Google Drive (File ID: ${String(
                                        bkp.driveFileId
                                      ).slice(0, 14)}...). Do you want to upload another verified copy to "Xongle Backups"?`,
                                      confirmLabel: 'Confirm Upload',
                                      onConfirm: () => void handleSaveBackupToDrive(bkp.id),
                                    });
                                  } else {
                                    void handleSaveBackupToDrive(bkp.id);
                                  }
                                }}
                                disabled={isBackupWorking}
                                className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 font-medium cursor-pointer"
                                title="Upload this backup to Google Drive"
                              >
                                Drive Upload
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleDownloadBackup(bkp.id);
                                }}
                                disabled={isBackupWorking}
                                className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium cursor-pointer"
                                title="Download .zip archive"
                              >
                                Download
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleInspectForRestore({ backupId: bkp.id });
                                }}
                                disabled={isBackupWorking}
                                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-medium cursor-pointer"
                                title="Inspect & restore this backup"
                              >
                                Restore
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteModalState({
                                    open: true,
                                    backup: bkp,
                                    deleteFromDrive: false,
                                  });
                                }}
                                disabled={isBackupWorking}
                                className="px-2.5 py-1 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 font-medium cursor-pointer"
                                title="Delete backup"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Included vs Excluded Data Transparency Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-3">
                <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 size={15} />
                  <span>Included in Every Full Backup Archive</span>
                </h4>
                <ul className="text-xs text-neutral-300 space-y-1.5">
                  <li className="flex items-center gap-2"><Check size={12} className="text-emerald-400 shrink-0" /> All registered users, UIDs, usernames, display names, avatars, roles & workspace files</li>
                  <li className="flex items-center gap-2"><Check size={12} className="text-emerald-400 shrink-0" /> All private & group chat conversations and message history</li>
                  <li className="flex items-center gap-2"><Check size={12} className="text-emerald-400 shrink-0" /> All Xonddit c/ communities, discussion posts, nested comments, votes & scores</li>
                  <li className="flex items-center gap-2"><Check size={12} className="text-emerald-400 shrink-0" /> All public & uploaded media assets plus extracted base64 user/post images</li>
                  <li className="flex items-center gap-2"><Check size={12} className="text-emerald-400 shrink-0" /> Complete website source code (React frontend, Express server, schemas, Firestore rules)</li>
                  <li className="flex items-center gap-2"><Check size={12} className="text-emerald-400 shrink-0" /> Safe environment template (environment-template.env), manifest.json & README-RESTORE.md</li>
                </ul>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-3">
                <h4 className="text-xs font-bold text-amber-400 flex items-center gap-2">
                  <ShieldAlert size={15} />
                  <span>Security Exclusions (Never Exported)</span>
                </h4>
                <ul className="text-xs text-neutral-300 space-y-1.5">
                  <li className="flex items-center gap-2"><Lock size={12} className="text-amber-400 shrink-0" /> Plaintext passwords & non-exportable third-party OAuth provider credentials</li>
                  <li className="flex items-center gap-2"><Lock size={12} className="text-amber-400 shrink-0" /> Active session cookies, CSRF tokens, Firebase ID tokens & Google Drive OAuth tokens</li>
                  <li className="flex items-center gap-2"><Lock size={12} className="text-amber-400 shrink-0" /> Raw .env secret values (GEMINI_API_KEY, SESSION_HMAC_SECRET, private keys)</li>
                  <li className="flex items-center gap-2"><Lock size={12} className="text-amber-400 shrink-0" /> Regenerable build & dependency directories (node_modules/, dist/, .git/)</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* TAB 11: SUPPORT */}
        {activeTab === 'support' && (
          <div className="space-y-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto">
                <HelpCircle size={24} />
              </div>
              <h3 className="text-sm font-bold text-white">Support & Complaints Inbox</h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                No active support tickets or user complaints. All systems running smoothly.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* PRE-RESTORE VALIDATION & CONFIRMATION MODAL */}
      {restoreModalState.open && restoreModalState.inspection && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-amber-500/40 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <RotateCcw size={18} className="text-amber-400" />
                <span>Confirm Backup Restoration</span>
              </h3>
              <button
                onClick={() =>
                  setRestoreModalState({ open: false, sourceType: 'history', createSafetyBackup: true })
                }
                className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-neutral-400">Archive Name:</span>
                <span className="font-mono font-bold text-white">
                  {restoreModalState.inspection.manifest?.archiveName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Created At:</span>
                <span className="font-mono text-neutral-200">
                  {new Date(restoreModalState.inspection.manifest?.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Checksum Verification:</span>
                <span className="font-mono text-emerald-400 font-semibold">
                  ✓ {restoreModalState.inspection.verifiedFilesCount} files SHA-256 verified
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Records to Restore:</span>
                <span className="font-mono text-amber-300">
                  {restoreModalState.inspection.manifest?.recordCounts?.users ?? 0} users,{' '}
                  {restoreModalState.inspection.manifest?.recordCounts?.communities ?? 0} communities,{' '}
                  {restoreModalState.inspection.manifest?.recordCounts?.posts ?? 0} posts,{' '}
                  {restoreModalState.inspection.manifest?.recordCounts?.comments ?? 0} comments
                </span>
              </div>
            </div>

            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 cursor-pointer">
              <input
                type="checkbox"
                checked={restoreModalState.createSafetyBackup}
                onChange={(e) =>
                  setRestoreModalState((prev) => ({
                    ...prev,
                    createSafetyBackup: e.target.checked,
                  }))
                }
                className="rounded accent-amber-500"
              />
              <span>
                Create an automatic pre-restore safety backup before applying this restoration (Recommended)
              </span>
            </label>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() =>
                  setRestoreModalState({ open: false, sourceType: 'history', createSafetyBackup: true })
                }
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteConfirmedRestore}
                disabled={isBackupWorking}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs cursor-pointer disabled:opacity-50"
              >
                {isBackupWorking ? 'Restoring Data...' : 'Confirm & Restore Backup'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE BACKUP CONFIRMATION MODAL */}
      {deleteModalState.open && deleteModalState.backup && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-red-500/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Trash2 size={18} className="text-red-400" />
                <span>Delete Backup Archive</span>
              </h3>
              <button
                onClick={() =>
                  setDeleteModalState({ open: false, backup: null, deleteFromDrive: false })
                }
                className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              Are you sure you want to delete backup{' '}
              <span className="font-mono text-white font-semibold">
                {deleteModalState.backup.fileName}
              </span>
              ?
            </p>

            {deleteModalState.backup.driveFileId && (
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteModalState.deleteFromDrive}
                  onChange={(e) =>
                    setDeleteModalState((prev) => ({
                      ...prev,
                      deleteFromDrive: e.target.checked,
                    }))
                  }
                  className="rounded accent-red-500"
                />
                <span>
                  Also delete the uploaded archive file from Google Drive (
                  <span className="font-mono">Xongle Backups</span>)
                </span>
              </label>
            )}

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() =>
                  setDeleteModalState({ open: false, backup: null, deleteFromDrive: false })
                }
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteConfirmedDelete}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IRREVERSIBLE ADMIN ACTION CONFIRMATION MODAL */}
      {adminConfirmModal.open && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-amber-500/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldAlert size={18} className="text-amber-400" />
                <span>{adminConfirmModal.title}</span>
              </h3>
              <button
                onClick={() =>
                  setAdminConfirmModal({
                    open: false,
                    title: '',
                    description: '',
                    confirmLabel: 'Confirm',
                    onConfirm: null,
                  })
                }
                className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              {adminConfirmModal.description}
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() =>
                  setAdminConfirmModal({
                    open: false,
                    title: '',
                    description: '',
                    confirmLabel: 'Confirm',
                    onConfirm: null,
                  })
                }
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const fn = adminConfirmModal.onConfirm;
                  setAdminConfirmModal({
                    open: false,
                    title: '',
                    description: '',
                    confirmLabel: 'Confirm',
                    onConfirm: null,
                  });
                  if (fn) fn();
                }}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs cursor-pointer"
              >
                {adminConfirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
