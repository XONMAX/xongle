import React from 'react';
import { Users, Plus, Compass } from 'lucide-react';
import { Community } from '../types';
import { LegalTab } from '../components/LegalPrivacyModal';
import { XongleLogo } from '../xongle/XongleLogo';
import { XondditLogo } from './XondditLogo';

interface CommunitySidebarProps {
  communities: Community[];
  activeCommunity: Community | null;
  currentUser?: any;
  onGoogleSignIn?: () => void;
  onSelectCommunity: (slug: string | null) => void;
  onOpenCreatePost: () => void;
  onOpenCreateCommunity: () => void;
  onOpenXongle: (query?: string) => void;
  onOpenLegal?: (tab?: LegalTab) => void;
}

export const CommunitySidebar: React.FC<CommunitySidebarProps> = ({
  communities,
  activeCommunity,
  onSelectCommunity,
  onOpenCreatePost,
  onOpenCreateCommunity,
  onOpenXongle,
  onOpenLegal,
}) => {
  return (
    <aside className="space-y-4">
      {/* Active Community Card */}
      {activeCommunity ? (
        <div className="bg-[#12151a] border border-neutral-800 rounded-xl p-4 sm:p-5">
          <div className="flex items-center gap-3 mb-3">
            {activeCommunity.iconUrl ? (
              <img
                src={activeCommunity.iconUrl}
                alt={`${activeCommunity.name} community icon`}
                width={40}
                height={40}
                className="w-10 h-10 rounded-lg object-cover border border-neutral-700 shrink-0"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-orange-600/15 text-orange-400 font-bold flex items-center justify-center text-sm border border-orange-500/30 shrink-0">
                c/
              </div>
            )}
            <div>
              <h2 className="font-bold text-white text-base">c/{activeCommunity.slug}</h2>
              <p className="text-xs text-neutral-400">{activeCommunity.name}</p>
            </div>
          </div>

          <p className="text-xs text-neutral-300 mb-4 leading-relaxed">
            {activeCommunity.description || 'Welcome to this Xonddit discussion community.'}
          </p>

          <div className="grid grid-cols-2 gap-2 py-2.5 px-3 rounded-lg bg-[#0b0d10] border border-neutral-800 text-xs mb-4">
            <div>
              <span className="block font-bold text-white font-mono tabular-nums">
                {activeCommunity.postCount}
              </span>
              <span className="text-[11px] text-neutral-500">Published Posts</span>
            </div>
            <div>
              <span className="block font-semibold text-neutral-300 text-xs truncate">
                {activeCommunity.creatorName}
              </span>
              <span className="text-[11px] text-neutral-500">Creator</span>
            </div>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={onOpenCreatePost}
              className="w-full py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} /> Create Post in c/{activeCommunity.slug}
            </button>
            <button
              type="button"
              onClick={() => onSelectCommunity(null)}
              className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium cursor-pointer"
            >
              View All Communities Feed
            </button>
          </div>
        </div>
      ) : (
        /* Home Feed Card */
        <div className="bg-[#12151a] border border-neutral-800 rounded-xl p-4 sm:p-5">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-lg bg-orange-600/15 text-orange-400 flex items-center justify-center">
              <XondditLogo size={20} />
            </div>
            <div>
              <h2 className="font-bold text-white text-sm">Xonddit Home Feed</h2>
              <p className="text-xs text-neutral-400">Community Discussions</p>
            </div>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed mb-4">
            Browse published posts across all communities. Vote, discuss, and publish your own contributions.
          </p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={onOpenCreatePost}
              className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus size={15} /> Create Post
            </button>
            <button
              type="button"
              onClick={onOpenCreateCommunity}
              className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Users size={14} /> Create Community
            </button>
          </div>
        </div>
      )}

      {/* Communities Directory */}
      <div className="bg-[#12151a] border border-neutral-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-neutral-800">
          <h2 className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
            <Users size={14} className="text-orange-400" />
            <span>Communities ({communities.length})</span>
          </h2>
          <button
            type="button"
            onClick={onOpenCreateCommunity}
            className="text-xs text-orange-400 hover:text-orange-300 font-semibold cursor-pointer"
          >
            + New
          </button>
        </div>

        {communities.length === 0 ? (
          <div className="py-4 text-center text-xs text-neutral-500">
            No communities created yet.
            <button
              type="button"
              onClick={onOpenCreateCommunity}
              className="block mx-auto mt-2 text-orange-400 font-semibold hover:underline cursor-pointer"
            >
              Create the first one
            </button>
          </div>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
            {communities.map((comm) => {
              const isSelected = activeCommunity?.slug === comm.slug;
              return (
                <a
                  key={comm.id}
                  href={`/?app=xonddit&c=${encodeURIComponent(comm.slug)}`}
                  onClick={(e) => {
                    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                      e.preventDefault();
                      onSelectCommunity(comm.slug);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer text-left ${
                    isSelected
                      ? 'bg-neutral-800 text-orange-400 font-semibold'
                      : 'text-neutral-300 hover:bg-neutral-800/60 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-mono text-neutral-500 text-[11px]">c/</span>
                    <span className="truncate">{comm.slug}</span>
                  </div>
                  <span className="font-mono text-[11px] tabular-nums text-neutral-500 shrink-0">
                    {comm.postCount}
                  </span>
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* Search Engine Sync Card */}
      <div className="bg-[#12151a] border border-neutral-800 rounded-xl p-4 text-xs">
        <h3 className="flex items-center gap-2 mb-1.5 text-neutral-200 font-semibold text-xs">
          <XongleLogo size={16} />
          <span>Indexed on Xongle</span>
        </h3>
        <p className="text-neutral-400 leading-relaxed mb-3 text-xs">
          Every public community, post, and comment is indexed in Xongle for instant search.
        </p>
        <a
          href="/"
          onClick={(e) => {
            if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
              e.preventDefault();
              onOpenXongle();
            }
          }}
          className="w-full py-2 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <XongleLogo size={14} />
          <span>Open Xongle Search</span>
        </a>
      </div>

      {/* Quiet Legal & Trust Links */}
      {onOpenLegal && (
        <div className="px-2 pt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500">
          <button
            type="button"
            onClick={() => onOpenLegal('privacy')}
            className="hover:text-neutral-300 hover:underline cursor-pointer"
          >
            Privacy Policy
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => onOpenLegal('terms')}
            className="hover:text-neutral-300 hover:underline cursor-pointer"
          >
            Terms of Service
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => onOpenLegal('cookies')}
            className="hover:text-neutral-300 hover:underline cursor-pointer"
          >
            Cookies &amp; Data
          </button>
        </div>
      )}
    </aside>
  );
};

