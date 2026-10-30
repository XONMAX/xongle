import React, { useEffect, useState } from 'react';
import {
  Search,
  Flame,
  ShieldCheck,
  Globe,
  ExternalLink,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  HelpCircle,
  ArrowLeft,
  Lock,
} from 'lucide-react';
import { SupportedApp } from '../types';
import { XongleLogo } from '../xongle/XongleLogo';
import { XondditLogo } from '../xonddit/XondditLogo';
import {
  fetchFirebaseDomainStatus,
  FirebaseDomainStatus,
  FIREBASE_CONSOLE_AUTH_SETTINGS_URL,
} from '../firebase/config';
import {
  CURATED_TOPIC_HUBS,
  BASELINE_PUBLIC_POSTS,
  BASELINE_PUBLIC_COMMUNITIES,
} from '../seo/uzbekSearch';
import type { LegalTab } from './LegalPrivacyModal';

interface AboutXonglePageProps {
  onSwitchApp: (app: SupportedApp, extraParams?: Record<string, string>) => void;
  onOpenLegal: (tab?: LegalTab) => void;
  onGoogleSignIn: () => void;
  isSignedIn: boolean;
  userEmail?: string | null;
}

export const XONGLE_FAQ_ITEMS = [
  {
    question: 'Xongle nima? (Xongle haqida / xongle.xyz haqida / What is Xongle?)',
    answer:
      'Xongle (xongle.xyz) — bu ommaviy Xonddit jamoalari (c/), muhokama mavzulari (tredlar) va sharhlarni real vaqt rejimida qidirish imkonini beruvchi rasmiy qidiruv tizimidir. Xongle — foydalanuvchilarga kerakli ommaviy materiallarni topishga yordam beruvchi markaziy kashfiyot platformasi va raqamli loyihalar arxivi. Ushbu platformaning asosiy xususiyatlari: 1) Real vaqtda indekslash: Platforma Xonddit tizimidagi ommaviy postlar va sharhlarni real vaqt rejimida indekslab boradi. 2) Erkin qidiruv: Foydalanuvchilar tizimga kirmasdan (akkountsiz) mavzularni dolzarbligi, yangiligi yoki ommabopligi bo‘yicha qidirishlari mumkin. 3) Mavjud jamoalar: Saytda turli jamoalar (masalan, c/xonddit, c/xongle, c/tor, c/nftscam) mavjud bo‘lib, ular doirasida qidiruv va muhokamalar olib boriladi.',
  },
  {
    question: 'Xongle platformasidagi qidiruv mexanizmlari qanday ishlaydi? (How do Xongle search mechanisms work?)',
    answer:
      'Xongle qidiruv mexanizmi Xonddit tizimidagi barcha ommaviy jamoalar (c/), postlar va izohlarni real vaqt rejimida indekslaydi. Foydalanuvchilar akkountsiz (tizimga kirmasdan) kalit so‘zlar orqali qidiruv berishlari, natijalarni Barchasi (All), Postlar (Posts), Jamoalar (Communities) yoki Izohlar (Comments) bo‘yicha filtrlashlari hamda Dolzarbligi (Relevance), Ommabopligi (Top) yoki Yangiligi (Newest) bo‘yicha saralashlari mumkin.',
  },
  {
    question: 'Xongle va Xonddit jamoalari o‘rtasidagi bog‘liqlik qanday? (How does Xongle relate to Xonddit communities?)',
    answer:
      'Xongle (https://xongle.xyz/) va Xonddit (https://xongle.xyz/?app=xonddit) yagona raqamli platformaning o‘zaro bog‘langan tizimlaridir: Xongle markaziy kashfiyot va real vaqtda qidiruv tizimi vazifasini bajaradi, Xonddit esa c/xonddit, c/xongle, c/tor, c/nftscam kabi mavzuli jamoalar, muhokama tredlari, ovoz berish va sharhlar joylashadigan ommaviy forum platformasidir.',
  },
  {
    question: 'Xongle platformasining boshqa qidiruv tizimlaridan va Wikipedia maqolalaridan farqi nimada?',
    answer:
      'Xongle (https://xongle.xyz/) — bu mustaqil veb-ilova va real vaqtda ishlovchi jamoaviy qidiruv tizimidir (Wikipedia maqolasi yoki lug‘aviy atama emas). Boshqa umumiy qidiruv tizimlaridan farqli o‘laroq, Xongle maxsus ravishda Xonddit ommaviy jamoalari (c/), muhokama mavzulari (tredlar) va foydalanuvchi sharhlarini bir zumda, reklamasiz va tizimga kirmasdan (erkin qidiruv) topishga ixtisoslashgan.',
  },
  {
    question: 'Do I need an account to use Xongle Search or browse Xonddit?',
    answer:
      'No login is required (Erkin qidiruv). Users can search public content on Xongle by relevance, recency, or popularity and read public Xonddit communities (such as c/xonddit, c/xongle, c/tor, c/nftscam) without an account.',
  },
  {
    question: 'How does Xongle protect user privacy and private data?',
    answer:
      'Xongle indexes only public communities, posts, and comments explicitly published on Xonddit. Private credentials, authentication tokens, email addresses, administrative controls, and owner backups are protected by strict Cloud Firestore security rules and server-side cryptographic verification.',
  },
];

export const AboutXonglePage: React.FC<AboutXonglePageProps> = ({
  onSwitchApp,
  onOpenLegal,
  onGoogleSignIn,
  isSignedIn,
  userEmail,
}) => {
  const [domainStatus, setDomainStatus] = useState<FirebaseDomainStatus | null>(null);
  const [checkingDomains, setCheckingDomains] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState<string | null>(null);

  const loadDomainStatus = async (force = false) => {
    setCheckingDomains(true);
    try {
      const status = await fetchFirebaseDomainStatus(force);
      setDomainStatus(status);
    } finally {
      setCheckingDomains(false);
    }
  };

  useEffect(() => {
    void loadDomainStatus(false);
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedDomain(text);
    setTimeout(() => setCopiedDomain(null), 2000);
  };

  const handleAnchorNav = (e: React.MouseEvent<HTMLAnchorElement>, app: SupportedApp) => {
    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
      e.preventDefault();
      onSwitchApp(app);
    }
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900 flex flex-col font-sans">
      {/* Top Navigation Header */}
      <header className="border-b border-neutral-200 bg-white/95 backdrop-blur-xs sticky top-0 z-30 px-4 sm:px-8 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <a
              href="/"
              onClick={(e) => handleAnchorNav(e, 'xongle')}
              className="flex items-center gap-2 font-bold text-xl tracking-tight text-neutral-900 hover:opacity-90"
            >
              <XongleLogo size={30} />
              <span className="flex items-center">
                <span className="text-[#4285F4]">X</span>
                <span className="text-[#EA4335]">o</span>
                <span className="text-[#FBBC05]">n</span>
                <span className="text-[#4285F4]">g</span>
                <span className="text-[#34A853]">l</span>
                <span className="text-[#EA4335]">e</span>
              </span>
            </a>
            <span className="text-neutral-300">/</span>
            <span className="text-xs sm:text-sm font-semibold text-neutral-600">
              About &amp; Official Documentation
            </span>
          </div>

          <nav aria-label="Primary Platform Links" className="flex items-center gap-2 text-xs font-semibold">
            <a
              href="/"
              onClick={(e) => handleAnchorNav(e, 'xongle')}
              className="px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 flex items-center gap-1.5"
            >
              <ArrowLeft size={13} />
              <span>Xongle Search</span>
            </a>
            <a
              href="/?app=xonddit"
              onClick={(e) => handleAnchorNav(e, 'xonddit')}
              className="px-3 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 flex items-center gap-1.5"
            >
              <XondditLogo size={14} />
              <span>Xonddit</span>
            </a>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-8 py-8 sm:py-12 space-y-10">
        {/* Hero / Official Identity Section */}
        <section aria-labelledby="about-xongle-heading" className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold">
            <Globe size={13} />
            <span>Official Website: https://xongle.xyz/</span>
          </div>

          <h1
            id="about-xongle-heading"
            className="text-2xl sm:text-4xl font-extrabold tracking-tight text-neutral-900"
          >
            Xongle — Raqamli loyihalar arxivi (xongle.xyz haqida)
          </h1>

          <p className="text-sm sm:text-base text-neutral-700 leading-relaxed">
            <strong>Xongle (xongle.xyz)</strong> — bu ommaviy <strong>Xonddit</strong> jamoalari (<code>c/</code>), muhokama mavzulari (tredlar) va sharhlarni real vaqt rejimida qidirish imkonini beruvchi rasmiy qidiruv tizimidir. <strong>Xongle</strong> — foydalanuvchilarga kerakli ommaviy materiallarni topishga yordam beruvchi markaziy kashfiyot platformasi.
          </p>

          <div className="p-4 sm:p-5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs sm:text-sm text-neutral-700 leading-relaxed space-y-2.5">
            <strong className="text-neutral-900 block">
              Ushbu platformaning asosiy xususiyatlari:
            </strong>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Real vaqtda indekslash:</strong> Platforma Xonddit tizimidagi ommaviy postlar va sharhlarni real vaqt rejimida indekslab boradi.
              </li>
              <li>
                <strong>Erkin qidiruv:</strong> Foydalanuvchilar tizimga kirmasdan (akkountsiz) mavzularni dolzarbligi, yangiligi yoki ommabopligi bo‘yicha qidirishlari mumkin.
              </li>
              <li>
                <strong>Mavjud jamoalar:</strong> Saytda turli jamoalar (masalan, <code>c/xonddit</code>, <code>c/xongle</code>, <code>c/tor</code>, <code>c/nftscam</code>) mavjud bo‘lib, ular doirasida qidiruv va muhokamalar olib boriladi.
              </li>
            </ul>
          </div>
        </section>

        {/* Core Platform Applications & Working Features */}
        <section aria-labelledby="platform-apps-heading" className="space-y-4">
          <h2
            id="platform-apps-heading"
            className="text-lg sm:text-xl font-bold text-neutral-900 tracking-tight"
          >
            Available Applications &amp; Working Features on Xongle.xyz
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Xongle Search Card */}
            <article className="p-5 rounded-xl border border-neutral-200 bg-white flex flex-col justify-between space-y-4">
              <div className="space-y-2.5">
                <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
                  <Search size={18} />
                </div>
                <h3 className="text-base font-bold text-neutral-900">1. Xongle Search Engine</h3>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  Instant full-text search across public Xonddit communities, posts, and comments. Supports filtering by content type (<em>All</em>, <em>Posts</em>, <em>Communities</em>, <em>Comments</em>), sorting by <em>Relevance</em>, <em>Top</em>, or <em>Newest</em>, live autocomplete suggestions, and saved search bookmarks.
                </p>
              </div>
              <a
                href="/"
                onClick={(e) => handleAnchorNav(e, 'xongle')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700"
              >
                <span>Open Xongle Search (/)</span>
                <ExternalLink size={12} />
              </a>
            </article>

            {/* Xonddit Communities Card */}
            <article className="p-5 rounded-xl border border-neutral-200 bg-white flex flex-col justify-between space-y-4">
              <div className="space-y-2.5">
                <div className="w-9 h-9 rounded-lg bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center">
                  <XondditLogo size={22} />
                </div>
                <h3 className="text-base font-bold text-neutral-900">2. Xonddit Communities</h3>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  Public topic forum platform organized into <code>c/</code> communities. Users can create communities, publish text, link, or verified image posts, participate in nested comment discussions, upvote or downvote content, and play the built-in single-player or multiplayer Snake arcade game.
                </p>
              </div>
              <a
                href="/?app=xonddit"
                onClick={(e) => handleAnchorNav(e, 'xonddit')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 hover:text-orange-700"
              >
                <span>Browse Xonddit (/?app=xonddit)</span>
                <ExternalLink size={12} />
              </a>
            </article>
          </div>
        </section>

        {/* Moved Directory: Topic Hubs, Featured Discussions & Public Communities */}
        <section aria-labelledby="topic-hubs-directory-heading" className="space-y-6">
          <div className="space-y-3">
            <h2
              id="topic-hubs-directory-heading"
              className="text-lg sm:text-xl font-bold text-neutral-900 tracking-tight"
            >
              O‘zbekcha Mavzular va Yo‘nalishlar (Topic Hubs)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {CURATED_TOPIC_HUBS.map((hub) => (
                <a
                  key={hub.slug}
                  href={`/topics/${hub.slug}`}
                  onClick={(e) => {
                    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                      e.preventDefault();
                      onSwitchApp('xongle', { topic: hub.slug });
                    }
                  }}
                  className="p-3.5 rounded-xl border border-neutral-200 hover:border-blue-300 bg-neutral-50/70 block space-y-1"
                >
                  <div className="font-bold text-neutral-900">{hub.titleUz}</div>
                  <p className="text-neutral-600 leading-relaxed">{hub.descriptionUz}</p>
                </a>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight">
              Dolzarb O‘zbekcha Savol-Javob va Muhokamalar (Featured Discussions)
            </h3>
            <ul className="space-y-2 text-xs text-neutral-700">
              {BASELINE_PUBLIC_POSTS.map((post) => (
                <li
                  key={post.id}
                  className="p-3 rounded-xl border border-neutral-200 bg-white leading-relaxed"
                >
                  <a
                    href={`/discussions/${post.id}`}
                    onClick={(e) => {
                      if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                        e.preventDefault();
                        onSwitchApp('xonddit', { p: post.id, c: post.communitySlug });
                      }
                    }}
                    className="font-bold text-blue-700 hover:underline"
                  >
                    {post.title}
                  </a>{' '}
                  <span className="text-neutral-500">
                    (<code>c/{post.communitySlug}</code> · muallif: <code>u/{post.authorName}</code> ·{' '}
                    {post.score} ball)
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight">
              Mavjud Ochiq Jamoalar (Public Communities)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {BASELINE_PUBLIC_COMMUNITIES.map((comm) => (
                <a
                  key={comm.slug}
                  href={`/c/${comm.slug}`}
                  onClick={(e) => {
                    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                      e.preventDefault();
                      onSwitchApp('xonddit', { c: comm.slug });
                    }
                  }}
                  className="p-3 rounded-xl border border-neutral-200 bg-neutral-50/60 hover:border-orange-300 block"
                >
                  <span className="font-mono font-bold text-orange-700">c/{comm.slug}</span> —{' '}
                  <strong className="text-neutral-900">{comm.name}:</strong>{' '}
                  <span className="text-neutral-600">{comm.description}</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Frequently Asked Questions (FAQ) — Matches FAQPage Schema */}
        <section aria-labelledby="faq-heading" className="space-y-4">
          <div className="flex items-center gap-2">
            <HelpCircle size={18} className="text-blue-600" />
            <h2 id="faq-heading" className="text-lg sm:text-xl font-bold text-neutral-900 tracking-tight">
              Frequently Asked Questions (FAQ)
            </h2>
          </div>

          <div className="space-y-3">
            {XONGLE_FAQ_ITEMS.map((item, idx) => (
              <article
                key={idx}
                className="p-4 sm:p-5 rounded-xl border border-neutral-200 bg-neutral-50/60 space-y-1.5"
              >
                <h3 className="text-sm sm:text-base font-bold text-neutral-900">
                  {item.question}
                </h3>
                <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed">
                  {item.answer}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Firebase Domain & Authentication Status for xongle.xyz */}
        <section
          aria-labelledby="firebase-auth-domain-heading"
          className="p-5 sm:p-6 rounded-xl border border-blue-200 bg-blue-50/40 space-y-4"
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Lock size={16} className="text-blue-600" />
                <h2
                  id="firebase-auth-domain-heading"
                  className="text-base sm:text-lg font-bold text-neutral-900"
                >
                  Firebase Authentication &amp; Domain Status (xongle.xyz)
                </h2>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed max-w-2xl">
                Xongle includes an automatic <strong>Authorized Domain Sign-In Bridge</strong> so Google Sign-In works immediately on{' '}
                <code>xongle.xyz</code> and <code>www.xongle.xyz</code> via <code>signInWithCredential</code>, even before custom domains are manually added to Firebase Console.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadDomainStatus(true)}
                disabled={checkingDomains}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-neutral-100 border border-neutral-300 text-neutral-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw size={13} />
                <span>{checkingDomains ? 'Checking...' : 'Refresh Status'}</span>
              </button>
              {!isSignedIn ? (
                <button
                  type="button"
                  onClick={onGoogleSignIn}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Test Google Sign-In
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-semibold">
                  <CheckCircle2 size={13} />
                  <span>Signed in{userEmail ? ` (${userEmail})` : ''}</span>
                </span>
              )}
            </div>
          </div>

          {domainStatus && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-lg bg-white border border-neutral-200 space-y-2">
                <div className="font-bold text-neutral-800 flex items-center justify-between">
                  <span>Custom Domain Authorization Status</span>
                  <span className="font-mono text-[11px] text-neutral-500">
                    {domainStatus.projectId}
                  </span>
                </div>

                {(['xongle.xyz', 'www.xongle.xyz'] as const).map((dom) => {
                  const isAuth =
                    dom === 'xongle.xyz'
                      ? domainStatus.isXongleXyzAuthorized
                      : domainStatus.isWwwXongleXyzAuthorized;
                  return (
                    <div
                      key={dom}
                      className="flex items-center justify-between py-1.5 px-2.5 rounded bg-neutral-50 border border-neutral-200"
                    >
                      <div className="flex items-center gap-2">
                        <code className="font-mono font-semibold text-neutral-900">{dom}</code>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            isAuth
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {isAuth ? 'Direct Popup Active' : 'Bridge Active (Add in Console for Direct)'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(dom)}
                        className="text-neutral-500 hover:text-neutral-900 flex items-center gap-1 cursor-pointer"
                        title={`Copy ${dom}`}
                      >
                        {copiedDomain === dom ? (
                          <Check size={13} className="text-emerald-600" />
                        ) : (
                          <Copy size={13} />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="p-3.5 rounded-lg bg-white border border-neutral-200 space-y-2 flex flex-col justify-between">
                <div className="space-y-1">
                  <div className="font-bold text-neutral-800">
                    Optional Owner Step: Direct Firebase Console Allowlist
                  </div>
                  <p className="text-neutral-600 leading-relaxed">
                    To enable single-window native Firebase popups on <code>xongle.xyz</code> without using the automatic bridge, add <code>xongle.xyz</code> and <code>www.xongle.xyz</code> under <strong>Authentication &rarr; Settings &rarr; Authorized domains</strong>.
                  </p>
                </div>
                <a
                  href={FIREBASE_CONSOLE_AUTH_SETTINGS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-bold"
                >
                  <span>Open Firebase Auth Settings ({domainStatus.projectId})</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          )}
        </section>

        {/* Privacy, Security & Crawling Transparency */}
        <section className="pt-4 border-t border-neutral-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <ShieldCheck size={15} className="text-emerald-600 shrink-0" />
            <span>
              Official Xongle Platform (<a href="https://xongle.xyz/" className="underline text-neutral-700">https://xongle.xyz/</a>) · Public Content Only Indexed
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => onOpenLegal('privacy')}
              className="hover:text-neutral-900 underline cursor-pointer"
            >
              Privacy Policy
            </button>
            <button
              type="button"
              onClick={() => onOpenLegal('terms')}
              className="hover:text-neutral-900 underline cursor-pointer"
            >
              Terms of Service
            </button>
            <button
              type="button"
              onClick={() => onOpenLegal('cookies')}
              className="hover:text-neutral-900 underline cursor-pointer"
            >
              Cookies &amp; Local Data
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};
