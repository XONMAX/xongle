import React, { useState, useEffect, useId, useRef } from 'react';
import {
  X,
  Check,
  LogOut,
  AlertCircle,
  Dices,
  Loader2,
  AtSign,
  IdCard,
  Camera,
  Trash2,
  Flame,
  Search,
  MessageSquare,
  Users,
  Bookmark,
  Clock,
  ExternalLink,
  Crown,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { UserProfile, Post, Community, SupportedApp } from '../types';
import { XongleLogo } from '../xongle/XongleLogo';
import {
  getUserProfile,
  signInWithGoogle,
  signOutUser,
  generateRandomIdentity,
  getAvatarInitial,
} from '../firebase/config';
import { dbService } from '../services/db';
import { searchService } from '../services/search';
import { validateImageUploadFile } from '../security/fileValidator';
import { LegalTab } from './LegalPrivacyModal';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onProfileUpdated?: (newProfile: UserProfile) => void;
  onUpdate?: (newName: string) => void;
  onSwitchApp?: (app: SupportedApp, extraParams?: Record<string, string>) => void;
  onOpenOwnerPanel?: () => void;
  onOpenLegal?: (tab?: LegalTab) => void;
}

const OWNER_EMAILS = ['aminbek785@gmail.com', 'crownsmpuz@gmail.com'];

/**
 * Resizes and center-crops an uploaded image file into a crisp 256x256 JPEG data URL
 * so custom PFPs load fast and fit cleanly in Firestore & localStorage.
 */
function resizeImageToDataUrl(file: File, maxSize = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        // Center crop square
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, maxSize, maxSize);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export const UserModal: React.FC<UserModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onProfileUpdated,
  onUpdate,
  onSwitchApp,
  onOpenOwnerPanel,
  onOpenLegal,
}) => {
  const currentProfile = getUserProfile();

  const [activeTab, setActiveTab] = useState<'profile' | 'xonddit' | 'xongle'>('profile');
  const [displayName, setDisplayName] = useState(currentProfile.displayName || '');
  const [username, setUsername] = useState(currentProfile.username || '');
  const [bio, setBio] = useState(currentProfile.bio || '');
  const [customPhotoURL, setCustomPhotoURL] = useState(currentProfile.photoURL || '');

  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'available' | 'taken' | 'invalid' | 'current'>('current');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  // User activity data for Xonddit & Xongle tabs
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [userCommunities, setUserCommunities] = useState<Community[]>([]);
  const [savedSearches, setSavedSearches] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const displayNameInputId = useId();
  const usernameInputId = useId();
  const bioInputId = useId();

  const isOwner = Boolean(
    currentUser?.email && OWNER_EMAILS.includes(currentUser.email.toLowerCase().trim())
  );

  // Reset form and load user activity when modal opens
  useEffect(() => {
    if (isOpen) {
      const p = getUserProfile();
      setDisplayName(p.displayName || '');
      setUsername(p.username || '');
      setBio(p.bio || '');
      setCustomPhotoURL(p.photoURL || '');
      setError('');
      setSuccessMsg('');
      setUsernameStatus('current');
      setSavedSearches(searchService.getSavedSearches());
      setRecentSearches(searchService.getRecentSearches());

      // Load user's Xonddit posts & communities
      Promise.all([dbService.getPosts({ sort: 'new' }), dbService.getCommunities()]).then(
        ([posts, comms]) => {
          const uid = currentUser?.uid || p.uid;
          const myHandle = p.username.toLowerCase();
          const myDisplay = p.displayName.toLowerCase();

          const filteredPosts = posts.filter(
            (post) =>
              (uid && post.authorId === uid) ||
              post.authorName.toLowerCase() === myDisplay ||
              post.authorName.toLowerCase().includes(myHandle)
          );
          const filteredComms = comms.filter(
            (c) =>
              (uid && c.creatorId === uid) ||
              c.creatorName.toLowerCase() === myDisplay ||
              c.creatorName.toLowerCase().includes(myHandle)
          );
          setUserPosts(filteredPosts);
          setUserCommunities(filteredComms);
        }
      );
    }
  }, [isOpen, currentUser?.uid]);

  // Debounced username availability check
  useEffect(() => {
    const clean = username.replace(/^u\//, '').toLowerCase().trim();
    if (clean === currentProfile.username) {
      setUsernameStatus('current');
      return;
    }

    if (clean.length < 3 || clean.length > 25 || !/^[a-z0-9_]+$/.test(clean)) {
      setUsernameStatus('invalid');
      return;
    }

    setIsCheckingUsername(true);
    const timer = setTimeout(async () => {
      try {
        const available = await dbService.checkUsernameAvailable(clean, currentUser?.uid);
        setUsernameStatus(available ? 'available' : 'taken');
      } catch {
        setUsernameStatus('available');
      } finally {
        setIsCheckingUsername(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [username, currentProfile.username, currentUser?.uid]);

  if (!isOpen) return null;

  const avatarLetter = getAvatarInitial({ displayName, username }, 'U');

  const handlePfpFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = await validateImageUploadFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Please select a valid raster image file (PNG, JPG, WebP, GIF).');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    try {
      setError('');
      const resizedDataUrl = await resizeImageToDataUrl(file, 256);
      setCustomPhotoURL(resizedDataUrl);
      setSuccessMsg('Custom profile picture ready! Click "Save Profile" to apply.');
    } catch (err: any) {
      setError(err?.message || 'Could not process image file');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePfp = () => {
    setCustomPhotoURL('');
    setSuccessMsg(`Reverted to "${avatarLetter}" first-letter avatar. Click "Save Profile" to apply.`);
  };

  const handleRandomize = () => {
    const identity = generateRandomIdentity();
    setDisplayName(identity.displayName);
    setUsername(identity.username);
    setError('');
  };

  const handleGoogleSignIn = async () => {
    setLoadingGoogle(true);
    setError('');
    try {
      await signInWithGoogle();
      const updated = getUserProfile();
      setDisplayName(updated.displayName);
      setUsername(updated.username);
      setCustomPhotoURL(updated.photoURL || '');
      if (onProfileUpdated) onProfileUpdated(updated);
      if (onUpdate) onUpdate(`u/${updated.username}`);
      setSuccessMsg('Signed in with Google!');
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign in popup was closed.');
      } else {
        setError(err.message || 'Failed to sign in with Google');
      }
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      const updated = getUserProfile();
      if (onProfileUpdated) onProfileUpdated(updated);
      if (onUpdate) onUpdate(`u/${updated.username}`);
      setSuccessMsg('Signed out. Switched to guest mode.');
    } catch (err: any) {
      setError(err.message || 'Failed to sign out');
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanUsername = username.replace(/^u\//, '').toLowerCase().replace(/[^a-z0-9_]/g, '');
    const cleanDisplayName = displayName.trim();

    if (cleanUsername.length < 3 || cleanUsername.length > 25) {
      setError('Username must be between 3 and 25 characters (lowercase letters, numbers, and underscores).');
      return;
    }

    if (cleanDisplayName.length < 1 || cleanDisplayName.length > 35) {
      setError('Nickname / Display name must be between 1 and 35 characters.');
      return;
    }

    if (usernameStatus === 'taken') {
      setError(`Username "u/${cleanUsername}" is already taken. Please choose another.`);
      return;
    }

    setIsSaving(true);
    try {
      const savedProfile = await dbService.saveUserProfile({
        username: cleanUsername,
        displayName: cleanDisplayName,
        bio: bio.trim(),
        photoURL: customPhotoURL,
      });

      if (onProfileUpdated) {
        onProfileUpdated(savedProfile);
      }
      if (onUpdate) {
        onUpdate(`u/${savedProfile.username}`);
      }

      setSuccessMsg('Profile & avatar saved successfully!');
      setTimeout(() => {
        onClose();
      }, 450);
    } catch (err: any) {
      setError(err?.message || 'Failed to save profile changes');
    } finally {
      setIsSaving(false);
    }
  };

  const totalKarma = userPosts.reduce((sum, p) => sum + (p.score || 0), 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="User Profile and Settings"
      className="fixed inset-0 z-50 bg-neutral-950 text-neutral-100 flex flex-col overflow-y-auto"
    >
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-neutral-900/95 backdrop-blur-md border-b border-neutral-800 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
            aria-label="Back / Close"
          >
            <X size={18} />
            <span className="hidden sm:inline">Close</span>
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold shrink-0 border border-orange-500/30">
              <IdCard size={18} />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-white">
                Xongle & Xonddit Profile Page
              </h3>
              <p className="text-xs text-neutral-400 hidden sm:block">
                First-letter avatar or custom PFP · Unified identity across Xongle & Xonddit
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onSwitchApp && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onSwitchApp('xongle');
              }}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 flex items-center gap-1.5 cursor-pointer"
              title="Go to Xongle Search"
            >
              <XongleLogo size={15} />
              <span className="hidden sm:inline">Xongle</span>
            </button>
          )}
          {isOwner && onOpenOwnerPanel && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenOwnerPanel();
              }}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 flex items-center gap-1.5 cursor-pointer"
            >
              <Crown size={14} className="text-amber-400" />
              <span className="hidden sm:inline">Owner Panel</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => handleSave()}
            disabled={isSaving || usernameStatus === 'taken' || isCheckingUsername}
            className="px-5 py-2 text-xs sm:text-sm font-bold rounded-xl bg-orange-600 hover:bg-orange-500 text-white flex items-center gap-1.5 shadow-lg shadow-orange-600/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <Loader2 size={16} /> Saving...
              </>
            ) : (
              <>
                <Check size={16} /> Save Profile
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-3xl mx-auto w-full p-4 sm:p-8 space-y-6">
        {/* Profile Hero Banner & Avatar Card */}
        <div className="rounded-2xl bg-neutral-900 border border-neutral-800 overflow-hidden shadow-xl">
          <div className="h-20 sm:h-24 bg-neutral-950 border-b border-neutral-800/80 relative" />
          <div className="px-5 sm:px-6 pb-5 relative">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 mb-4">
              {/* Avatar with Upload Overlay */}
              <div className="flex items-end gap-4">
                <div className="relative group shrink-0">
                  {customPhotoURL ? (
                    <img
                      src={customPhotoURL}
                      alt={displayName || username}
                      className="w-24 h-24 rounded-full object-cover border-4 border-neutral-950 bg-neutral-900 shadow-2xl"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-orange-600 text-white flex items-center justify-center font-black text-4xl border-4 border-neutral-950 shadow-2xl select-none">
                      {avatarLetter}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 rounded-full bg-black/55 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[10px] font-bold cursor-pointer border-4 border-transparent"
                    title="Upload custom PFP"
                  >
                    <Camera size={18} className="mb-0.5" />
                    <span>Upload PFP</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePfpFileChange}
                    className="hidden"
                  />
                </div>

                <div className="pb-1 min-w-0">
                  <div className="flex items-baseline gap-2.5 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-extrabold text-white truncate tracking-tight">
                      {displayName || username || 'User'}
                    </h1>
                    <span className="text-orange-400 font-mono text-xs font-medium">
                      u/{username.replace(/^u\//, '') || 'user'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
                    {bio || 'No bio added yet.'}
                  </p>
                </div>
              </div>

              {/* PFP Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer border border-neutral-700"
                >
                  <Camera size={14} className="text-orange-400" />
                  <span>{customPhotoURL ? 'Change PFP' : 'Upload PFP'}</span>
                </button>
                {customPhotoURL && (
                  <button
                    type="button"
                    onClick={handleRemovePfp}
                    className="px-3 py-2 rounded-xl bg-red-950/40 hover:bg-red-950/70 text-red-300 border border-red-800/60 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    title="Remove custom PFP and show first-letter avatar"
                  >
                    <Trash2 size={14} />
                    <span>Use "{avatarLetter}" Letter</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Stats Row */}
            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-neutral-800/80 text-center">
              <div className="p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800/70">
                <div className="text-base sm:text-lg font-extrabold text-orange-400 font-mono tabular-nums">
                  {userPosts.length}
                </div>
                <div className="text-[11px] text-neutral-400">Xonddit Posts</div>
              </div>
              <div className="p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800/70">
                <div className="text-base sm:text-lg font-extrabold text-emerald-400 font-mono tabular-nums">
                  {totalKarma}
                </div>
                <div className="text-[11px] text-neutral-400">Post Karma</div>
              </div>
              <div className="p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800/70">
                <div className="text-base sm:text-lg font-extrabold text-blue-400 font-mono tabular-nums">
                  {savedSearches.length}
                </div>
                <div className="text-[11px] text-neutral-400">Saved Searches</div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-neutral-800 pb-2 overflow-x-auto">
          {(
            [
              {
                id: 'profile',
                label: 'Edit Profile & PFP',
                Icon: IdCard,
                activeBg: 'bg-orange-600 shadow-orange-600/20',
              },
              {
                id: 'xonddit',
                label: `Xonddit Posts (${userPosts.length})`,
                Icon: Flame,
                activeBg: 'bg-orange-600 shadow-orange-600/20',
              },
              {
                id: 'xongle',
                label: `Xongle Searches (${savedSearches.length + recentSearches.length})`,
                Icon: Search,
                activeBg: 'bg-blue-600 shadow-blue-600/20',
              },
            ] as const
          ).map(({ id, label, Icon, activeBg }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`relative px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  isActive
                    ? `text-white shadow-md ${activeBg}`
                    : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                }`}
              >
                <Icon size={14} className="relative z-10" />
                <span className="relative z-10">{label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: EDIT PROFILE & PFP */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <form onSubmit={handleSave} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
              {/* Nickname / Display Name Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor={displayNameInputId}
                    className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider"
                  >
                    Nickname / Display Name
                  </label>
                  <span className="text-[11px] text-neutral-500 font-mono">
                    {displayName.length}/35
                  </span>
                </div>
                <input
                  id={displayNameInputId}
                  type="text"
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    setError('');
                    setSuccessMsg('');
                  }}
                  className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white font-medium text-sm focus:outline-hidden focus:border-orange-500 focus:ring-1 focus:ring-orange-500 placeholder:text-neutral-600"
                  placeholder="e.g. Swift Falcon"
                  maxLength={35}
                />
                <p className="text-[11px] text-neutral-500 mt-1">
                  When no custom PFP is uploaded, your avatar displays the first letter (
                  <strong className="text-neutral-300">{avatarLetter}</strong>) of your nickname or username.
                </p>
              </div>

              {/* Username (Handle) Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor={usernameInputId}
                    className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider"
                  >
                    Username (Unique Handle)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRandomize}
                      className="text-[11px] text-orange-400 hover:text-orange-300 flex items-center gap-1 cursor-pointer"
                      title="Generate unique random identity"
                    >
                      <Dices size={12} /> Randomize
                    </button>
                    <span className="text-[11px] text-neutral-500 font-mono">
                      {username.replace(/^u\//, '').length}/25
                    </span>
                  </div>
                </div>

                <div className="relative flex items-center">
                  <div className="absolute left-3.5 flex items-center pointer-events-none text-neutral-500 font-mono text-sm">
                    <AtSign size={14} className="mr-0.5 text-neutral-500" />
                    <span>u/</span>
                  </div>
                  <input
                    id={usernameInputId}
                    type="text"
                    value={username.replace(/^u\//, '')}
                    onChange={(e) => {
                      const clean = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                      setUsername(clean);
                      setError('');
                      setSuccessMsg('');
                    }}
                    className="w-full pl-14 pr-24 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white font-mono text-sm focus:outline-hidden focus:border-orange-500 focus:ring-1 focus:ring-orange-500 placeholder:text-neutral-600"
                    placeholder="swift_falcon"
                    maxLength={25}
                  />

                  <div className="absolute right-3 flex items-center text-xs">
                    {isCheckingUsername ? (
                      <span className="text-neutral-400 flex items-center gap-1 text-[11px]">
                        Checking...
                      </span>
                    ) : usernameStatus === 'available' ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-semibold text-[11px]">
                        <Check size={13} /> Available
                      </span>
                    ) : usernameStatus === 'taken' ? (
                      <span className="text-red-400 flex items-center gap-1 font-semibold text-[11px]">
                        <AlertCircle size={13} /> Taken
                      </span>
                    ) : usernameStatus === 'current' ? (
                      <span className="text-neutral-500 text-[11px]">Current</span>
                    ) : (
                      <span className="text-amber-500 text-[11px]">Min 3 chars</span>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-neutral-500 mt-1">
                  Unique identifier across Xonddit & Xongle. Lowercase letters, numbers, and underscores only.
                </p>
              </div>

              {/* Bio Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor={bioInputId}
                    className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider"
                  >
                    Bio <span className="text-neutral-500 font-normal">(Optional)</span>
                  </label>
                  <span className="text-[11px] text-neutral-500 font-mono">{bio.length}/150</span>
                </div>
                <input
                  id={bioInputId}
                  type="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs sm:text-sm focus:outline-hidden focus:border-orange-500 placeholder:text-neutral-600"
                  placeholder="A few words about yourself..."
                  maxLength={150}
                />
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
                  <Check size={14} className="shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || usernameStatus === 'taken' || isCheckingUsername}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-orange-600 hover:bg-orange-500 text-white flex items-center gap-1.5 shadow-md shadow-orange-600/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={14} /> Saving...
                    </>
                  ) : (
                    <>
                      <Check size={14} /> Save Profile
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Account Authentication Section */}
            <div>
              {currentUser && !currentUser.isAnonymous ? (
                <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <span>Linked to Google Account</span>
                    </div>
                    <p className="text-xs text-neutral-300 font-medium truncate mt-0.5">
                      {currentUser.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-red-400 hover:text-red-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <LogOut size={13} /> Sign Out
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-300">Guest Mode</span>
                    <span className="text-[11px] text-neutral-500">Local Identity</span>
                  </div>
                  <p className="text-xs text-neutral-400">
                    Connect your Google account to sync your custom PFP, nickname, and username across devices.
                  </p>
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loadingGoogle}
                    className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-neutral-100 text-neutral-900 font-semibold text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-60"
                  >
                    <span>{loadingGoogle ? 'Connecting...' : 'Sign in with Google'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: XONDDIT ACTIVITY */}
        {activeTab === 'xonddit' && (
          <div className="space-y-6">
            {/* Communities Created */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                  <Users size={14} className="text-orange-400" />
                  <span>Communities Created ({userCommunities.length})</span>
                </h4>
              </div>
              {userCommunities.length === 0 ? (
                <p className="text-xs text-neutral-500">
                  You haven't created any communities on Xonddit yet.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {userCommunities.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        onClose();
                        if (onSwitchApp) onSwitchApp('xonddit', { c: c.slug });
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-xs text-white cursor-pointer"
                    >
                      <span className="font-mono font-bold text-orange-400">c/{c.slug}</span>
                      <span className="text-neutral-400">{c.name}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-neutral-900 text-neutral-400">
                        {c.postCount} posts
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Posts Published */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                  <MessageSquare size={14} className="text-orange-400" />
                  <span>Published Posts ({userPosts.length})</span>
                </h4>
              </div>
              {userPosts.length === 0 ? (
                <p className="text-xs text-neutral-500">
                  No posts published yet. Head to Xonddit to share a post!
                </p>
              ) : (
                <div className="space-y-2.5">
                  {userPosts.map((post) => (
                    <div
                      key={post.id}
                      onClick={() => {
                        onClose();
                        if (onSwitchApp) {
                          onSwitchApp('xonddit', { p: post.id, c: post.communitySlug });
                        }
                      }}
                      className="p-3.5 rounded-xl bg-neutral-950 hover:bg-neutral-900 border border-neutral-800/80 hover:border-orange-500/40 cursor-pointer flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-[11px] text-neutral-400 mb-1">
                          <span className="font-mono font-bold text-orange-400">
                            c/{post.communitySlug}
                          </span>
                          <span>•</span>
                          <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="text-sm font-semibold text-white truncate">
                          {post.title}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-neutral-400 shrink-0">
                        <span className="font-mono font-bold text-orange-400">
                          {post.score} pts
                        </span>
                        <span>{post.commentCount || 0} comments</span>
                        <ExternalLink size={13} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: XONGLE ACTIVITY */}
        {activeTab === 'xongle' && (
          <div className="space-y-6">
            {/* Saved Searches */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                  <Bookmark size={14} className="text-amber-400" />
                  <span>Saved Xongle Searches ({savedSearches.length})</span>
                </h4>
              </div>
              {savedSearches.length === 0 ? (
                <p className="text-xs text-neutral-500">
                  No saved searches on Xongle yet. Click "Save Search" on any Xongle results page to bookmark it here.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {savedSearches.map((term, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        onClose();
                        if (onSwitchApp) onSwitchApp('xongle', { q: term });
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs text-amber-300 font-medium cursor-pointer"
                    >
                      <Bookmark size={12} className="fill-amber-400 text-amber-400" />
                      <span>{term}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Searches */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                  <Clock size={14} className="text-blue-400" />
                  <span>Recent Xongle Searches ({recentSearches.length})</span>
                </h4>
              </div>
              {recentSearches.length === 0 ? (
                <p className="text-xs text-neutral-500">No recent search history.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((term, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        onClose();
                        if (onSwitchApp) onSwitchApp('xongle', { q: term });
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-xs text-neutral-300 cursor-pointer"
                    >
                      <Search size={12} className="text-blue-400" />
                      <span>{term}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Legal, Privacy & Cookie Controls Footer */}
        {onOpenLegal && (
          <footer className="pt-6 border-t border-neutral-900 flex flex-wrap items-center justify-between gap-4 text-xs text-neutral-500">
            <span>Xongle &amp; Xonddit Unified Identity</span>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => onOpenLegal('privacy')}
                className="hover:text-neutral-300 cursor-pointer"
              >
                Privacy Policy
              </button>
              <button
                type="button"
                onClick={() => onOpenLegal('terms')}
                className="hover:text-neutral-300 cursor-pointer"
              >
                Terms of Service
              </button>
              <button
                type="button"
                onClick={() => onOpenLegal('cookies')}
                className="hover:text-neutral-300 cursor-pointer"
              >
                Cookie &amp; Data Settings
              </button>
            </div>
          </footer>
        )}
      </main>
    </div>
  );
};
