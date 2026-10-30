import React, { useState, useEffect, lazy, Suspense } from 'react';
import { User } from 'firebase/auth';
import {
  initAuth,
  testConnection,
  getUserProfile,
  signInWithGoogle,
} from './firebase/config';
import { UserProfile, SupportedApp } from './types';
import type { LegalTab } from './components/LegalPrivacyModal';
import {
  normalizeSupportedLanguage,
  syncDocumentHead,
} from './seo/seoConfig';
import { getTopicHubBySlug } from './seo/uzbekSearch';
import type { SupportedLanguage } from './i18n/translations';

// Code-split top-level apps & modals to minimize initial main-thread JS bundle (LCP / INP optimization)
const XongleApp = lazy(() =>
  import('./xongle/XongleApp').then((m) => ({ default: m.XongleApp }))
);
const XondditApp = lazy(() =>
  import('./xonddit/XondditApp').then((m) => ({ default: m.XondditApp }))
);
const AboutXonglePage = lazy(() =>
  import('./components/AboutXonglePage').then((m) => ({ default: m.AboutXonglePage }))
);
const AuthBridgePopup = lazy(() =>
  import('./components/AuthBridgePopup').then((m) => ({ default: m.AuthBridgePopup }))
);
const UserModal = lazy(() =>
  import('./components/UserModal').then((m) => ({ default: m.UserModal }))
);
const LegalPrivacyModal = lazy(() =>
  import('./components/LegalPrivacyModal').then((m) => ({ default: m.LegalPrivacyModal }))
);
const OwnerPanel = lazy(() =>
  import('./components/OwnerPanel').then((m) => ({ default: m.OwnerPanel }))
);

import { XongleLogo } from './xongle/XongleLogo';
import { XondditLogo } from './xonddit/XondditLogo';

const AppViewLoader: React.FC<{ isDark?: boolean }> = ({ isDark = true }) => (
  <div
    role="status"
    aria-live="polite"
    className={`flex-1 flex flex-col items-center justify-center min-h-[50vh] ${
      isDark ? 'bg-[#090b0e] text-neutral-400' : 'bg-white text-neutral-500'
    }`}
  >
    <XongleLogo size={40} className="mb-3" />
    <span className="text-xs font-medium tracking-wide opacity-80">Loading workspace...</span>
  </div>
);

function parseInitialRouteState(): {
  app: SupportedApp;
  query: string;
  postId?: string;
  communitySlug?: string;
  topicSlug?: string;
} {
  if (typeof window === 'undefined') {
    return { app: 'xongle', query: '' };
  }
  const cleanRel = window.location.pathname.replace(/^\/+|\/+$/g, '');
  const params = new URLSearchParams(window.location.search);

  if (cleanRel === 'about' || params.get('app') === 'about') {
    return { app: 'about', query: '' };
  }

  const topicMatch = /^topics\/([a-zA-Z0-9_-]{2,60})$/i.exec(cleanRel);
  if (topicMatch) {
    return {
      app: 'xongle',
      query: params.get('q') || '',
      topicSlug: topicMatch[1].toLowerCase(),
    };
  }

  const commMatch = /^c\/([a-zA-Z0-9_-]{2,40})$/i.exec(cleanRel);
  if (commMatch) {
    return {
      app: 'xonddit',
      query: '',
      communitySlug: commMatch[1].toLowerCase(),
    };
  }

  const discMatch = /^(discussions|questions)\/([a-zA-Z0-9_-]{3,80})$/i.exec(cleanRel);
  if (discMatch) {
    return {
      app: 'xonddit',
      query: '',
      postId: discMatch[2],
      communitySlug: params.get('c') || undefined,
    };
  }

  if (params.get('app') === 'xonddit') {
    return {
      app: 'xonddit',
      query: '',
      postId: params.get('p') || undefined,
      communitySlug: params.get('c') || undefined,
    };
  }

  const topicQueryParam = params.get('topic');
  return {
    app: 'xongle',
    query: params.get('q') || '',
    topicSlug: topicQueryParam ? topicQueryParam.toLowerCase() : undefined,
  };
}

export default function App() {
  const isAuthBridgeMode =
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).get('auth_bridge') === '1' ||
      window.location.pathname === '/auth-bridge');

  const initialRoute = parseInitialRouteState();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfileState] = useState<UserProfile>(getUserProfile());
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isOwnerPanelOpen, setIsOwnerPanelOpen] = useState(false);
  const [legalModalState, setLegalModalState] = useState<{ open: boolean; tab: LegalTab }>({
    open: false,
    tab: 'privacy',
  });
  const [, setConnectionOk] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  // App routing state — default to Xongle search engine
  const [currentApp, setCurrentApp] = useState<SupportedApp>(initialRoute.app);
  const [activeLang, setActiveLang] = useState<SupportedLanguage>(() => {
    if (typeof window !== 'undefined') {
      const urlLang = new URLSearchParams(window.location.search).get('lang');
      if (urlLang) return normalizeSupportedLanguage(urlLang);
      try {
        const saved = localStorage.getItem('xongle_language');
        if (saved) return normalizeSupportedLanguage(saved);
      } catch {}
    }
    return 'en';
  });
  const [xongleQuery, setXongleQuery] = useState(initialRoute.query);
  const [activeTopicSlug, setActiveTopicSlug] = useState<string | undefined>(
    initialRoute.topicSlug
  );
  const [targetPostId, setTargetPostId] = useState<string | undefined>(initialRoute.postId);
  const [targetCommunitySlug, setTargetCommunitySlug] = useState<string | undefined>(
    initialRoute.communitySlug
  );

  const handleOpenLegal = (tab: LegalTab = 'privacy') => {
    setLegalModalState({ open: true, tab });
  };

  // Parse URL search params and clean paths on boot and popstate
  useEffect(() => {
    const parseUrl = () => {
      const parsed = parseInitialRouteState();
      const params = new URLSearchParams(window.location.search);
      const langParam = params.get('lang');

      if (langParam) {
        const normalized = normalizeSupportedLanguage(langParam);
        setActiveLang(normalized);
        try {
          localStorage.setItem('xongle_language', normalized);
        } catch {}
      }

      setCurrentApp(parsed.app);
      setXongleQuery(parsed.query);
      setActiveTopicSlug(parsed.topicSlug);
      setTargetPostId(parsed.postId);
      setTargetCommunitySlug(parsed.communitySlug);
    };

    parseUrl();
    window.addEventListener('popstate', parseUrl);
    return () => window.removeEventListener('popstate', parseUrl);
  }, []);

  // Synchronize HTML <head> SEO metadata, canonical URL, hreflang, and JSON-LD on route/query change
  useEffect(() => {
    if (isAuthBridgeMode) return;
    const topicHub = activeTopicSlug ? getTopicHubBySlug(activeTopicSlug) || undefined : undefined;
    syncDocumentHead({
      app: currentApp,
      lang: activeLang,
      query: currentApp === 'xongle' ? xongleQuery : undefined,
      topicHub: currentApp === 'xongle' ? topicHub : undefined,
      communitySlug: currentApp === 'xonddit' ? targetCommunitySlug : undefined,
      postId: currentApp === 'xonddit' ? targetPostId : undefined,
    });
  }, [
    currentApp,
    activeLang,
    xongleQuery,
    activeTopicSlug,
    targetCommunitySlug,
    targetPostId,
    isAuthBridgeMode,
  ]);

  // Initialize Auth & test connection on boot
  useEffect(() => {
    if (isAuthBridgeMode) return;
    testConnection().then((ok) => setConnectionOk(ok));

    const unsubscribe = initAuth((user, profile) => {
      setCurrentUser(user);
      setUserProfileState(profile);
    });

    return () => unsubscribe();
  }, [isAuthBridgeMode]);

  if (isAuthBridgeMode) {
    return (
      <Suspense fallback={<AppViewLoader isDark={true} />}>
        <AuthBridgePopup />
      </Suspense>
    );
  }

  const handleGoogleSignIn = async () => {
    try {
      const user = await signInWithGoogle();
      setCurrentUser(user);
      setUserProfileState(getUserProfile());
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setAuthNotice(err.message || 'Failed to sign in with Google');
        setTimeout(() => setAuthNotice(null), 6000);
      }
    }
  };

  // Switch between applications and update canonical URL cleanly
  const handleSwitchApp = (
    app: SupportedApp,
    extraParams: Record<string, string> = {}
  ) => {
    setCurrentApp(app);
    const params = new URLSearchParams();

    let basePath = app === 'about' ? '/about' : '/';
    if (app === 'xongle' && extraParams.topic) {
      basePath = `/topics/${encodeURIComponent(extraParams.topic.toLowerCase())}`;
    } else if (app !== 'xongle' && app !== 'about') {
      params.set('app', app);
    }

    for (const [key, value] of Object.entries(extraParams)) {
      if (key === 'topic') continue;
      if (value) params.set(key, value);
    }

    if (activeLang && activeLang !== 'en') {
      params.set('lang', activeLang);
    }

    const qs = params.toString();
    const newUrl = qs ? `${basePath}?${qs}` : basePath;
    window.history.pushState({}, '', newUrl);

    if (app === 'xongle') {
      setXongleQuery(extraParams.q || '');
      setActiveTopicSlug(extraParams.topic ? extraParams.topic.toLowerCase() : undefined);
      setTargetPostId(undefined);
      setTargetCommunitySlug(undefined);
    } else if (app === 'xonddit') {
      setActiveTopicSlug(undefined);
      setTargetPostId(extraParams.p || undefined);
      setTargetCommunitySlug(extraParams.c || undefined);
    } else {
      setActiveTopicSlug(undefined);
    }

    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  const handleNavigateToXonddit = (params?: { postId?: string; communitySlug?: string }) => {
    const extras: Record<string, string> = {};
    if (params?.postId) extras.p = params.postId;
    if (params?.communitySlug) extras.c = params.communitySlug;
    handleSwitchApp('xonddit', extras);
  };

  const handleAnchorSwitch = (
    e: React.MouseEvent<HTMLAnchorElement>,
    app: SupportedApp
  ) => {
    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
      e.preventDefault();
      handleSwitchApp(app);
    }
  };

  return (
    <div
      className={`min-h-dvh ${
        currentApp === 'xongle' || currentApp === 'about'
          ? 'bg-white text-neutral-900'
          : 'bg-[#090b0e] text-neutral-100'
      } flex flex-col font-sans selection:bg-orange-500/25 selection:text-orange-200 overflow-x-hidden`}
    >
      {/* Non-blocking Static Toast Banner */}
      {authNotice && (
        <div
          role="alert"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-950 text-white border border-red-800 px-4 py-2 rounded-lg text-xs font-medium shadow-xl flex items-center gap-2 max-w-md"
        >
          <span>{authNotice}</span>
          <button
            onClick={() => {
              setAuthNotice(null);
              handleSwitchApp('about');
            }}
            className="px-2 py-0.5 rounded bg-red-800 hover:bg-red-700 text-white text-[11px] font-semibold shrink-0 cursor-pointer"
          >
            Fix Domain
          </button>
          <button
            onClick={() => setAuthNotice(null)}
            aria-label="Dismiss notification"
            className="ml-1 text-red-300 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Render Current Application Immediately Without Animation */}
      <div className="flex-1 flex flex-col relative pb-20 md:pb-0">
        {currentApp === 'about' ? (
          <div className="flex-1 flex flex-col">
            <Suspense fallback={<AppViewLoader isDark={false} />}>
              <AboutXonglePage
                onSwitchApp={(app, extras) => handleSwitchApp(app, extras)}
                onOpenLegal={handleOpenLegal}
                onGoogleSignIn={handleGoogleSignIn}
                isSignedIn={Boolean(currentUser && !currentUser.isAnonymous)}
                userEmail={currentUser?.email}
              />
            </Suspense>
          </div>
        ) : currentApp === 'xonddit' ? (
          <div className="flex-1 flex flex-col">
            <Suspense fallback={<AppViewLoader isDark={true} />}>
              <XondditApp
                currentUser={currentUser}
                userProfile={userProfile}
                onGoogleSignIn={handleGoogleSignIn}
                onOpenUserModal={() => setIsUserModalOpen(true)}
                onOpenOwnerPanel={() => setIsOwnerPanelOpen(true)}
                onOpenLegal={handleOpenLegal}
                onSwitchApp={(app, extras) => handleSwitchApp(app, extras)}
                initialPostId={targetPostId}
                initialCommunitySlug={targetCommunitySlug}
              />
            </Suspense>
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            <Suspense fallback={<AppViewLoader isDark={false} />}>
              <XongleApp
                initialQuery={xongleQuery}
                activeTopicSlug={activeTopicSlug}
                onSelectTopicSlug={(slug) =>
                  handleSwitchApp('xongle', slug ? { topic: slug } : {})
                }
                onNavigateToXonddit={handleNavigateToXonddit}
                currentUser={currentUser}
                userProfile={userProfile}
                onGoogleSignIn={handleGoogleSignIn}
                onOpenUserModal={() => setIsUserModalOpen(true)}
                onOpenOwnerPanel={() => setIsOwnerPanelOpen(true)}
                onOpenLegal={handleOpenLegal}
                onSwitchApp={(app, extras) => handleSwitchApp(app, extras)}
              />
            </Suspense>
          </div>
        )}
      </div>

      {/* Mobile Bottom Navigation Bar with Crawlable Anchor Links */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0b0d11]/95 backdrop-blur-md border-t border-neutral-800 px-2 py-1 pb-[max(0.375rem,env(safe-area-inset-bottom))] flex items-center justify-around"
      >
        <a
          href="/"
          onClick={(e) => handleAnchorSwitch(e, 'xongle')}
          className={`relative min-h-[44px] min-w-[68px] flex flex-col items-center justify-center gap-1 px-3 rounded-lg cursor-pointer ${
            currentApp === 'xongle'
              ? 'text-blue-400 font-semibold'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          {currentApp === 'xongle' && (
            <div className="absolute inset-0 rounded-lg bg-blue-500/12 border border-blue-500/25" />
          )}
          <XongleLogo size={20} className="relative z-10" />
          <span className="text-[11px] tracking-tight relative z-10">Xongle</span>
        </a>

        <a
          href="/?app=xonddit"
          onClick={(e) => handleAnchorSwitch(e, 'xonddit')}
          className={`relative min-h-[44px] min-w-[68px] flex flex-col items-center justify-center gap-1 px-3 rounded-lg cursor-pointer ${
            currentApp === 'xonddit'
              ? 'text-orange-500 font-semibold'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          {currentApp === 'xonddit' && (
            <div className="absolute inset-0 rounded-lg bg-orange-500/12 border border-orange-500/25" />
          )}
          <XondditLogo size={20} className="relative z-10" />
          <span className="text-[11px] tracking-tight relative z-10">Xonddit</span>
        </a>

        <button
          type="button"
          onClick={() => setIsUserModalOpen(true)}
          className="min-h-[44px] min-w-[68px] flex flex-col items-center justify-center gap-1 px-3 rounded-lg text-neutral-400 hover:text-white cursor-pointer"
        >
          {userProfile.photoURL ? (
            <img
              src={userProfile.photoURL}
              alt="User profile avatar"
              width={20}
              height={20}
              referrerPolicy="no-referrer"
              className="w-5 h-5 rounded-full object-cover border border-neutral-700"
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold text-[10px]">
              {((userProfile.displayName || userProfile.username || 'U').replace(/^u\//, '').trim()[0] || 'U').toUpperCase()}
            </div>
          )}
          <span className="text-[11px] tracking-tight">Profile</span>
        </button>
      </nav>

      {/* Lazy-Loaded User Profile & Settings Modal */}
      {isUserModalOpen && (
        <Suspense fallback={null}>
          <UserModal
            isOpen={isUserModalOpen}
            onClose={() => setIsUserModalOpen(false)}
            onProfileUpdated={(updated) => setUserProfileState(updated)}
            currentUser={currentUser}
            onSwitchApp={(app, extras) => handleSwitchApp(app, extras)}
            onOpenOwnerPanel={() => setIsOwnerPanelOpen(true)}
            onOpenLegal={(tab) => {
              setIsUserModalOpen(false);
              handleOpenLegal(tab);
            }}
          />
        </Suspense>
      )}

      {/* Lazy-Loaded Legal, Privacy & Cookie Controls Modal */}
      {legalModalState.open && (
        <Suspense fallback={null}>
          <LegalPrivacyModal
            isOpen={legalModalState.open}
            initialTab={legalModalState.tab}
            onClose={() => setLegalModalState((prev) => ({ ...prev, open: false }))}
          />
        </Suspense>
      )}

      {/* Lazy-Loaded Owner Panel Modal */}
      {isOwnerPanelOpen && (
        <Suspense fallback={null}>
          <OwnerPanel
            currentUser={currentUser}
            userProfile={userProfile}
            onClose={() => setIsOwnerPanelOpen(false)}
            onGoogleSignIn={handleGoogleSignIn}
          />
        </Suspense>
      )}
    </div>
  );
}
