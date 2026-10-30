import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { getFirestore, doc, getDoc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserProfile } from '../types';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = getFirestore(
  app,
  (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId ||
    'ai-studio-67825eaf-b5f6-4909-bff1-1dbcb71d9cb1'
);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
// Least-privilege OAuth: Standard user sign-in requests only basic identity (openid, email, profile).
// The restricted drive.file scope is requested exclusively via connectGoogleDrive() in the Owner Panel.
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const FIREBASE_CONSOLE_AUTH_SETTINGS_URL = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`;

const AUTHORIZED_BRIDGE_ORIGINS = [
  'https://xongle.ai.studio',
  'https://xonomia-729971330198.asia-southeast1.run.app',
];

export interface FirebaseDomainStatus {
  projectId: string;
  currentHostname: string;
  authorizedDomains: string[];
  isCurrentDomainAuthorized: boolean;
  isXongleXyzAuthorized: boolean;
  isWwwXongleXyzAuthorized: boolean;
  bridgeOrigin: string;
  consoleUrl: string;
}

let cachedAuthorizedDomains: string[] | null = null;
let isCurrentHostnameAuthorizedCache: boolean | null = null;

function doesDomainMatch(hostname: string, authorizedPattern: string): boolean {
  const cleanHost = hostname.toLowerCase().trim();
  const cleanPattern = authorizedPattern.toLowerCase().trim();
  return cleanHost === cleanPattern || cleanHost.endsWith(`.${cleanPattern}`);
}

export async function fetchFirebaseDomainStatus(forceRefresh = false): Promise<FirebaseDomainStatus> {
  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : 'xongle.xyz';

  if (!forceRefresh && cachedAuthorizedDomains) {
    const isAuth = cachedAuthorizedDomains.some((d) => doesDomainMatch(currentHostname, d));
    isCurrentHostnameAuthorizedCache = isAuth;
    return {
      projectId: firebaseConfig.projectId,
      currentHostname,
      authorizedDomains: cachedAuthorizedDomains,
      isCurrentDomainAuthorized: isAuth,
      isXongleXyzAuthorized: cachedAuthorizedDomains.some((d) => doesDomainMatch('xongle.xyz', d)),
      isWwwXongleXyzAuthorized: cachedAuthorizedDomains.some((d) =>
        doesDomainMatch('www.xongle.xyz', d)
      ),
      bridgeOrigin: AUTHORIZED_BRIDGE_ORIGINS[0],
      consoleUrl: FIREBASE_CONSOLE_AUTH_SETTINGS_URL,
    };
  }

  let domains: string[] = [];
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects?key=${encodeURIComponent(
        firebaseConfig.apiKey
      )}`
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.authorizedDomains) && data.authorizedDomains.length > 0) {
        domains = data.authorizedDomains;
      }
    }
  } catch {}

  if (domains.length === 0) {
    try {
      const serverRes = await fetch('/api/auth/domain-status');
      if (serverRes.ok) {
        const serverData = await serverRes.json();
        if (Array.isArray(serverData.authorizedDomains)) {
          domains = serverData.authorizedDomains;
        }
      }
    } catch {}
  }

  if (domains.length === 0) {
    domains = [
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
  }

  cachedAuthorizedDomains = domains;
  isCurrentHostnameAuthorizedCache = domains.some((d) => doesDomainMatch(currentHostname, d));

  const isAuth = isCurrentHostnameAuthorizedCache;

  return {
    projectId: firebaseConfig.projectId,
    currentHostname,
    authorizedDomains: domains,
    isCurrentDomainAuthorized: isAuth,
    isXongleXyzAuthorized: domains.some((d) => doesDomainMatch('xongle.xyz', d)),
    isWwwXongleXyzAuthorized: domains.some((d) => doesDomainMatch('www.xongle.xyz', d)),
    bridgeOrigin: AUTHORIZED_BRIDGE_ORIGINS[0],
    consoleUrl: FIREBASE_CONSOLE_AUTH_SETTINGS_URL,
  };
}

// Pre-warm domain check in browser so sign-in click handlers know synchronously whether to use the bridge
if (typeof window !== 'undefined') {
  void fetchFirebaseDomainStatus(false);
}

// Store Google OAuth access token strictly in memory (never in localStorage) per security best practices
let cachedDriveAccessToken: string | null = null;

export function getCachedDriveAccessToken(): string | null {
  return cachedDriveAccessToken;
}

export function setCachedDriveAccessToken(token: string | null): void {
  cachedDriveAccessToken = token;
}

export function clearCachedDriveAccessToken(): void {
  cachedDriveAccessToken = null;
}

/**
 * Safe Google Drive OAuth account disconnection and token revocation.
 * Clears the in-memory token and revokes it against Google's OAuth 2.0 revocation endpoint.
 */
export async function revokeGoogleDriveAccessToken(): Promise<boolean> {
  const token = cachedDriveAccessToken;
  cachedDriveAccessToken = null;
  if (!token) return true;
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Signs in via the Authorized Firebase Bridge (`https://xongle.ai.studio/?auth_bridge=1`)
 * when the user is on a custom domain (`xongle.xyz` / `www.xongle.xyz`) that has not yet been
 * added to the Firebase Console Authorized Domains list.
 * Once the bridge popup obtains the Google OAuth idToken & accessToken on the authorized host,
 * it posts them back and we complete sign-in locally using `signInWithCredential`, which does
 * not trigger `_validateOrigin` (`auth/unauthorized-domain`).
 */
export async function signInViaAuthorizedBridge(options?: {
  requireDriveScope?: boolean;
}): Promise<{ user: User; accessToken: string | null }> {
  if (typeof window === 'undefined') {
    throw new Error('Bridge sign-in requires a browser environment.');
  }

  const bridgeBase = AUTHORIZED_BRIDGE_ORIGINS[0];
  const scopeParam = options?.requireDriveScope ? 'drive' : 'basic';
  const bridgeUrl = `${bridgeBase}/?auth_bridge=1&origin=${encodeURIComponent(
    window.location.origin
  )}&scope=${scopeParam}`;

  const width = 500;
  const height = 620;
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));

  const popup = window.open(
    bridgeUrl,
    'xongle_firebase_auth_bridge',
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
  );

  if (!popup) {
    const err = new Error(
      `Popup blocked while signing in on ${window.location.hostname}. Please allow popups for ${window.location.hostname} or add ${window.location.hostname} to Firebase Authorized Domains.`
    ) as Error & { code?: string };
    err.code = 'auth/unauthorized-domain';
    throw err;
  }

  return new Promise<{ user: User; accessToken: string | null }>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      clearInterval(closeTimer);
    };

    const onMessage = async (event: MessageEvent) => {
      if (!AUTHORIZED_BRIDGE_ORIGINS.includes(event.origin)) return;
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'XONGLE_AUTH_BRIDGE_SUCCESS') {
        settled = true;
        cleanup();
        try {
          const { idToken, accessToken } = data;
          if (!idToken && !accessToken) {
            throw new Error('No OAuth credentials returned from bridge.');
          }
          const credential = GoogleAuthProvider.credential(
            idToken || null,
            accessToken || undefined
          );
          const userCred = await signInWithCredential(auth, credential);
          if (accessToken && options?.requireDriveScope) {
            cachedDriveAccessToken = accessToken;
          }
          resolve({ user: userCred.user, accessToken: accessToken || null });
        } catch (credErr) {
          reject(credErr);
        }
      } else if (data.type === 'XONGLE_AUTH_BRIDGE_ERROR') {
        settled = true;
        cleanup();
        const err = new Error(data.error || 'Authentication cancelled.') as Error & {
          code?: string;
        };
        err.code = data.code || 'auth/popup-closed-by-user';
        reject(err);
      }
    };

    window.addEventListener('message', onMessage);

    const closeTimer = setInterval(() => {
      if (popup.closed && !settled) {
        settled = true;
        cleanup();
        const err = new Error('Sign in window was closed.') as Error & { code?: string };
        err.code = 'auth/popup-closed-by-user';
        reject(err);
      }
    }, 600);
  });
}

export async function connectGoogleDrive(): Promise<{ user: User; accessToken: string }> {
  const needsBridge = isCurrentHostnameAuthorizedCache === false;

  if (needsBridge) {
    const bridged = await signInViaAuthorizedBridge({ requireDriveScope: true });
    if (!bridged.accessToken) {
      throw new Error(
        'No Google Drive OAuth access token returned. Please grant Google Drive permission in the popup.'
      );
    }
    return { user: bridged.user, accessToken: bridged.accessToken };
  }

  const driveProvider = new GoogleAuthProvider();
  driveProvider.addScope('https://www.googleapis.com/auth/drive.file');
  driveProvider.setCustomParameters({
    prompt: 'consent select_account',
    include_granted_scopes: 'true',
  });

  try {
    const result = await signInWithPopup(auth, driveProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken || null;
    if (!token) {
      throw new Error(
        'No Google Drive OAuth access token returned. Please grant Google Drive permission in the popup.'
      );
    }
    cachedDriveAccessToken = token;
    return { user: result.user, accessToken: token };
  } catch (err: any) {
    if (err?.code === 'auth/unauthorized-domain') {
      isCurrentHostnameAuthorizedCache = false;
      const bridged = await signInViaAuthorizedBridge({ requireDriveScope: true });
      if (!bridged.accessToken) {
        throw new Error(
          'No Google Drive OAuth access token returned. Please grant Google Drive permission in the popup.'
        );
      }
      return { user: bridged.user, accessToken: bridged.accessToken };
    }
    throw err;
  }
}

export async function ensureAuth(): Promise<User | null> {
  if (auth.currentUser) return auth.currentUser;
  try {
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch {
    return null;
  }
}

const ADJECTIVES = ['Swift', 'Cosmic', 'Solar', 'Velvet', 'Nova', 'Cyber', 'Echo', 'Frost', 'Lunar', 'Neon', 'Stellar', 'Quantum', 'Pixel', 'Aura'];
const NOUNS = ['Falcon', 'Voyager', 'Otter', 'Pioneer', 'Fox', 'Horizon', 'Phoenix', 'Comet', 'Atlas', 'Ranger', 'Knight', 'Pilot', 'Nomad', 'Oracle'];

export function generateRandomIdentity(): { username: string; displayName: string } {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return {
    username: `${adj.toLowerCase()}_${noun.toLowerCase()}_${num}`,
    displayName: `${adj} ${noun}`,
  };
}

function getStoredRawProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem('xonddit_user_profile') || localStorage.getItem('xonwitter_user_profile');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.username === 'string' && typeof parsed.displayName === 'string') {
        // Ignore external Google photoURLs so only custom uploaded PFPs (data:image/...) are used,
        // otherwise default to first letter of nickname/username as requested
        if (parsed.photoURL && !parsed.photoURL.startsWith('data:image/')) {
          parsed.photoURL = '';
        }
        return parsed as UserProfile;
      }
    }
  } catch {
    // fallback if JSON corrupt
  }
  return null;
}

export function getUserProfile(): UserProfile {
  const existing = getStoredRawProfile();
  if (existing) {
    if (!existing.uid) {
      existing.uid = 'u_' + existing.username;
      try {
        localStorage.setItem('xonddit_user_profile', JSON.stringify(existing));
      } catch {}
    }
    return existing;
  }

  let username = '';
  let displayName = '';
  try {
    const legacy = localStorage.getItem('xonddit_user_name') || localStorage.getItem('xonwitter_user_name');
    if (legacy) {
      const clean = legacy.replace(/^u\//, '').replace(/^@/, '');
      username = clean.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'user_100';
      displayName = clean.replace(/_/g, ' ');
    }
  } catch {
    // ignore
  }

  if (!username || !displayName) {
    const generated = generateRandomIdentity();
    username = generated.username;
    displayName = generated.displayName;
  }

  const newProfile: UserProfile = {
    uid: 'u_' + username,
    username,
    displayName,
    photoURL: '',
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem('xonddit_user_profile', JSON.stringify(newProfile));
    localStorage.setItem('xonddit_user_name', `u/${newProfile.username}`);
  } catch {
    // ignore
  }

  return newProfile;
}

export function setUserProfile(profile: Partial<UserProfile> & { username?: string; displayName?: string }): UserProfile {
  const current = getStoredRawProfile() || {
    username: 'user_100',
    displayName: 'User 100',
    photoURL: '',
  };
  const cleanUsername = (profile.username || current.username || '')
    .replace(/^u\//, '')
    .replace(/^@/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 25);

  const cleanDisplayName = (profile.displayName !== undefined ? profile.displayName : current.displayName)
    .trim()
    .slice(0, 35) || cleanUsername || 'User';

  const nextPhoto = profile.photoURL !== undefined ? profile.photoURL : (current.photoURL || '');

  const updated: UserProfile = {
    uid: profile.uid || current.uid,
    username: cleanUsername || 'xonddit_user',
    displayName: cleanDisplayName,
    bio: profile.bio !== undefined ? profile.bio : current.bio,
    photoURL: nextPhoto,
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem('xonddit_user_profile', JSON.stringify(updated));
    localStorage.setItem('xonwitter_user_profile', JSON.stringify(updated));
    localStorage.setItem('xonddit_user_name', `u/${updated.username}`);
  } catch {
    // ignore local storage quota exceptions
  }

  return updated;
}

export function getAvatarInitial(profile?: UserProfile | null, fallbackName?: string | null): string {
  const raw = (profile?.displayName || profile?.username || fallbackName || 'U').replace(/^u\//, '').trim();
  return (raw[0] || 'U').toUpperCase();
}

export function formatAuthorName(displayName: string, username: string): string {
  const cleanUser = username.replace(/^u\//, '').trim().slice(0, 16);
  const cleanDisplay = displayName.trim().slice(0, 26);
  if (cleanDisplay && cleanDisplay.toLowerCase() !== cleanUser.toLowerCase()) {
    return `${cleanDisplay} (u/${cleanUser})`;
  }
  return `u/${cleanUser}`;
}

export function parseAuthorString(raw: string): { displayName: string; username: string } {
  if (!raw) return { displayName: 'Anonymous', username: 'anonymous' };
  const match = raw.match(/^(.*?)\s*\(u\/([a-zA-Z0-9_]+)\)$/);
  if (match) {
    return {
      displayName: match[1].trim(),
      username: match[2].trim(),
    };
  }
  if (raw.startsWith('u/')) {
    const handle = raw.slice(2);
    return {
      displayName: handle,
      username: handle,
    };
  }
  return {
    displayName: raw,
    username: raw.toLowerCase().replace(/[^a-z0-9_]/g, ''),
  };
}

export function getStoredDisplayName(): string {
  return getUserProfile().displayName;
}

export function getStoredUsername(): string {
  return getUserProfile().username;
}

export function setStoredDisplayName(name: string): void {
  setUserProfile({ displayName: name });
}

function applySignedInUserProfile(user: User): void {
  const currentProfile = getUserProfile();
  const googleDisplay = user.displayName?.trim() || '';
  const cleanUsername = googleDisplay
    ? googleDisplay.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 20)
    : (user.email?.split('@')[0] || currentProfile.username).slice(0, 20);

  setUserProfile({
    uid: user.uid,
    displayName: currentProfile.displayName || googleDisplay,
    username: currentProfile.username || cleanUsername,
    photoURL: currentProfile.photoURL || '',
  });
}

// Sign in with Google Popup (does NOT overwrite custom PFP with Google photoURL, and does NOT request Drive scope)
export async function signInWithGoogle(): Promise<User> {
  const needsBridge = isCurrentHostnameAuthorizedCache === false;

  if (needsBridge) {
    const bridged = await signInViaAuthorizedBridge({ requireDriveScope: false });
    if (bridged.user) {
      applySignedInUserProfile(bridged.user);
    }
    return bridged.user;
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    if (user) {
      applySignedInUserProfile(user);
    }
    return user;
  } catch (err: any) {
    if (err?.code === 'auth/unauthorized-domain') {
      isCurrentHostnameAuthorizedCache = false;
      const bridged = await signInViaAuthorizedBridge({ requireDriveScope: false });
      if (bridged.user) {
        applySignedInUserProfile(bridged.user);
      }
      return bridged.user;
    }
    throw err;
  }
}

export async function signOutUser(): Promise<void> {
  await revokeGoogleDriveAccessToken();
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } catch {
    // ignore network error on logout
  }
  await signOut(auth);
  try {
    await signInAnonymously(auth);
  } catch (err) {
    console.warn('Error signing back anonymously:', err);
  }
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline notice. Please check network/config.');
    }
    return false;
  }
}

export function initAuth(onUserReady: (user: User | null, profile: UserProfile) => void): () => void {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (!user) {
      try {
        const anonCred = await signInAnonymously(auth);
        user = anonCred.user;
      } catch (err) {
        console.warn('Anonymous sign-in auto-init note:', err);
      }
    }

    if (user) {
      const current = getUserProfile();
      // Try fetching remote profile from Firestore if it exists
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const remote = snap.data() as UserProfile;
          const customPfp =
            remote.photoURL && remote.photoURL.startsWith('data:image/')
              ? remote.photoURL
              : current.photoURL || '';
          setUserProfile({
            uid: user.uid,
            displayName: remote.displayName || current.displayName,
            username: remote.username || current.username,
            bio: remote.bio !== undefined ? remote.bio : current.bio,
            photoURL: customPfp,
          });
        } else if (user.displayName && !user.isAnonymous) {
          setUserProfile({
            uid: user.uid,
            displayName: current.displayName || user.displayName,
            username:
              current.username ||
              user.displayName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 20),
            photoURL: current.photoURL || '',
          });
        }
      } catch {
        // Fallback to local profile
      }
    }

    const profile = getUserProfile();
    onUserReady(user, profile);
  });

  return unsubscribe;
}
