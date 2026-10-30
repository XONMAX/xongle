import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, FileText, Cookie, Trash2, Check } from 'lucide-react';
import { searchService } from '../services/search';

export type LegalTab = 'privacy' | 'terms' | 'cookies';

interface LegalPrivacyModalProps {
  isOpen: boolean;
  initialTab?: LegalTab;
  onClose: () => void;
}

export const LegalPrivacyModal: React.FC<LegalPrivacyModalProps> = ({
  isOpen,
  initialTab = 'privacy',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<LegalTab>(initialTab);
  const [clearedHistory, setClearedHistory] = useState(false);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
      setClearedHistory(false);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleClearLocalSearchData = () => {
    searchService.clearRecentSearches();
    setClearedHistory(true);
    setTimeout(() => setClearedHistory(false), 3000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-[#111318] border border-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-neutral-200"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h2 id="legal-modal-title" className="text-base font-bold text-white tracking-tight">
              Trust, Privacy & Terms of Use
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Xongle Search · Xonddit Communities
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Segmented Navigation */}
        <div className="px-6 pt-3 border-b border-neutral-800 bg-[#0d0f13] flex items-center gap-2 overflow-x-auto">
          {(
            [
              { id: 'privacy', label: 'Privacy Policy', Icon: ShieldCheck },
              { id: 'terms', label: 'Terms of Service', Icon: FileText },
              { id: 'cookies', label: 'Cookies & Local Data', Icon: Cookie },
            ] as { id: LegalTab; label: string; Icon: any }[]
          ).map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 cursor-pointer whitespace-nowrap ${
                  active
                    ? 'border-orange-500 text-white'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Icon size={14} className={active ? 'text-orange-500' : 'text-neutral-500'} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs sm:text-sm text-neutral-300 leading-relaxed">
          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">
                  1. Data Stored in Cloud Firestore
                </h3>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  Xonddit and Xongle operate on a shared Cloud Firestore database protected by
                  deny-by-default Row-Level Security (RLS) rules. When you create a community,
                  publish a post, write a comment, or cast a vote, only the public fields required
                  to render that content (`title`, `body`, `communitySlug`, `authorName`, `score`,
                  `createdAt`) are stored and indexed.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white mb-1">
                  2. Authentication & Profile Privacy
                </h3>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  You may browse and participate using an anonymous Firebase session or sign in
                  with Google Authentication. Public user profiles (<code>/users/:uid</code>) expose only
                  your chosen display name, username (<code>u/handle</code>), bio, and avatar. Email
                  addresses and authentication tokens are never exposed in public Firestore
                  documents or client API responses.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white mb-1">
                  3. Content Deletion & Control
                </h3>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  Authors can permanently delete their own published posts directly from any post
                  card or detail page. Deleting a post removes it from both Xonddit and the Xongle
                  search index.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'terms' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">
                  1. Acceptable Use & Community Standards
                </h3>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  By publishing content on Xonddit, you agree not to submit unlawful, abusive, or
                  deceptive material, automated spam, or malicious scripts. All user-submitted
                  inputs are validated against strict server and database schemas.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white mb-1">
                  2. Safe Links & Media Upload Restrictions
                </h3>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  External links must use standard `http://` or `https://` protocols. Uploaded
                  images are restricted to verified raster formats (`JPEG`, `PNG`, `WebP`, `GIF`)
                  under 2 MB and are inspected via magic-byte file signatures before acceptance.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white mb-1">
                  3. Rate Limits & Automated Access
                </h3>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  API endpoints enforce IP-aware and account-aware rate limiting to maintain
                  service reliability. Automated scraping or unauthorized mutation attempts are
                  blocked.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'cookies' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">
                  1. Essential Security Cookies
                </h3>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  We do not use third-party advertising or cross-site tracking cookies. An
                  `HttpOnly`, `SameSite=Lax`, `Secure` session cookie (`xongle_session`) is issued
                  only when an authorized administrator verifies access to the Owner Panel, and is
                  invalidated upon sign-out.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white mb-1">
                  2. Local Browser Storage Controls
                </h3>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  Recent Xongle searches and bookmarked searches
                  are stored locally in your browser&apos;s `localStorage` for convenience. You
                  can purge this local history at any time using the control below.
                </p>
              </div>

              <div className="pt-2 border-t border-neutral-800 flex items-center justify-between gap-4">
                <div className="text-xs text-neutral-400">
                  Clear recent Xongle searches from this browser:
                </div>
                <button
                  type="button"
                  onClick={handleClearLocalSearchData}
                  className="px-3.5 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  {clearedHistory ? (
                    <>
                      <Check size={14} className="text-emerald-400" />
                      <span>Local Data Cleared</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} className="text-neutral-400" />
                      <span>Clear Local History</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-800 bg-[#0d0f13] flex items-center justify-between text-xs text-neutral-500">
          <span>Xongle &amp; Xonddit Platform</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
