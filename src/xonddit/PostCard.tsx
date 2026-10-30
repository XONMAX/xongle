import React, { useState, memo } from 'react';
import {
  ArrowBigUp,
  ArrowBigDown,
  MessageSquare,
  Share2,
  ExternalLink,
  Trash2,
  Image as ImageIcon,
  Check,
} from 'lucide-react';
import { Post } from '../types';
import { getSafeHref, getSafeImageSrc } from '../validation/schemas';

interface PostCardProps {
  post: Post;
  index?: number;
  userVote?: number;
  currentUserId?: string;
  onVote: (postId: string, direction: 1 | -1) => void;
  onSelectPost: (postId: string) => void;
  onSelectCommunity: (slug: string) => void;
  onDeletePost?: (postId: string) => void;
}

export const PostCard: React.FC<PostCardProps> = memo(({
  post,
  userVote = 0,
  currentUserId,
  onVote,
  onSelectPost,
  onSelectCommunity,
  onDeletePost,
}) => {
  const [copied, setCopied] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const safeLinkHref = getSafeHref(post.linkUrl);
  const safeImageSrc = getSafeImageSrc(post.imageUrl);

  const formatRelativeTime = (isoString: string) => {
    try {
      const now = Date.now();
      const past = new Date(isoString).getTime();
      const diffSec = Math.floor((now - past) / 1000);
      if (diffSec < 60) return 'just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      const diffDay = Math.floor(diffHr / 24);
      return `${diffDay}d ago`;
    } catch {
      return '';
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}?app=xonddit&p=${encodeURIComponent(post.id)}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isAuthor = currentUserId === post.authorId;

  return (
    <article
      className="bg-neutral-900 hover:bg-neutral-900/90 border border-neutral-800 hover:border-neutral-700/80 rounded-xl overflow-hidden flex group hover:shadow-xl hover:shadow-black/40"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 180px' }}
    >
      {/* Vote Bar */}
      <div className="w-10 sm:w-12 bg-neutral-950/60 p-1.5 sm:p-2 flex flex-col items-center gap-1 shrink-0 select-none border-r border-neutral-800/60">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onVote(post.id, 1);
          }}
          className={`p-1 rounded-md cursor-pointer ${
            userVote === 1
              ? 'text-orange-500 bg-orange-500/15'
              : 'text-neutral-400 hover:text-orange-500 hover:bg-neutral-800'
          }`}
          aria-label="Upvote"
        >
          <ArrowBigUp size={20} className={userVote === 1 ? 'fill-current' : ''} />
        </button>

        <span
          className={`text-[11px] sm:text-xs font-bold font-mono tracking-tight tabular-nums ${
            userVote === 1 ? 'text-orange-500' : userVote === -1 ? 'text-blue-500' : 'text-neutral-300'
          }`}
        >
          {post.score}
        </span>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onVote(post.id, -1);
          }}
          className={`p-1 rounded-md cursor-pointer ${
            userVote === -1
              ? 'text-blue-500 bg-blue-500/15'
              : 'text-neutral-400 hover:text-blue-500 hover:bg-neutral-800'
          }`}
          aria-label="Downvote"
        >
          <ArrowBigDown size={20} className={userVote === -1 ? 'fill-current' : ''} />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-3 sm:p-4 cursor-pointer min-w-0" onClick={() => onSelectPost(post.id)}>
        {/* Header Metadata (Zero-Pill Discipline: clean unboxed inline text) */}
        <div className="flex items-center flex-wrap gap-1.5 text-[11px] sm:text-xs mb-1.5 text-neutral-400">
          <a
            href={`/?app=xonddit&c=${encodeURIComponent(post.communitySlug)}`}
            onClick={(e) => {
              e.stopPropagation();
              if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                e.preventDefault();
                onSelectCommunity(post.communitySlug);
              }
            }}
            className="font-mono font-semibold text-neutral-200 hover:text-orange-400 hover:underline cursor-pointer"
          >
            c/{post.communitySlug}
          </a>
          <span aria-hidden="true" className="text-neutral-600">·</span>
          <span className="truncate max-w-[140px] sm:max-w-none">
            Posted by <span className="font-mono text-neutral-300">{post.authorName}</span>
          </span>
          <span aria-hidden="true" className="text-neutral-600">·</span>
          <span>{formatRelativeTime(post.createdAt)}</span>

          {post.flair && (
            <>
              <span aria-hidden="true" className="text-neutral-600">·</span>
              <span className="text-orange-400 font-medium">{post.flair}</span>
            </>
          )}
        </div>

        {/* Title with Crawlable Anchor Link */}
        <h3 className="text-sm sm:text-lg font-semibold text-white group-hover:text-neutral-100 mb-1.5 sm:mb-2 leading-snug break-words">
          <a
            href={`/?app=xonddit&p=${encodeURIComponent(post.id)}`}
            onClick={(e) => {
              e.stopPropagation();
              if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                e.preventDefault();
                onSelectPost(post.id);
              }
            }}
            className="hover:underline"
          >
            {post.title}
          </a>
        </h3>

        {/* Post Body / Media / Link Preview */}
        {post.body && (
          <p className="text-xs sm:text-sm text-neutral-300 line-clamp-2 sm:line-clamp-3 mb-2.5 sm:mb-3 leading-relaxed whitespace-pre-line break-words">
            {post.body}
          </p>
        )}

        {safeLinkHref && (
          <div className="mb-2.5 sm:mb-3">
            <a
              href={safeLinkHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-950 border border-neutral-800 hover:border-neutral-700 text-[11px] sm:text-xs text-blue-400 hover:underline max-w-full truncate"
            >
              <ExternalLink size={12} className="shrink-0" />
              <span className="truncate">{safeLinkHref}</span>
            </a>
          </div>
        )}

        {safeImageSrc && !imageError && (
          <div className="mb-2.5 sm:mb-3 rounded-lg overflow-hidden max-h-64 sm:max-h-96 min-h-[140px] bg-neutral-950 flex items-center justify-center border border-neutral-800/80 relative">
            <img
              src={safeImageSrc}
              alt={post.title}
              width={640}
              height={360}
              className="max-h-64 sm:max-h-96 w-auto object-contain"
              loading="lazy"
              decoding="async"
              onError={() => setImageError(true)}
            />
          </div>
        )}

        {post.type === 'image' && imageError && (
          <div className="mb-2.5 sm:mb-3 p-2.5 rounded-lg bg-neutral-950 border border-neutral-800 text-[11px] sm:text-xs text-neutral-500 flex items-center gap-2">
            <ImageIcon size={14} />
            <span>Image could not be loaded</span>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs text-neutral-400 pt-1">
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-neutral-950/70 hover:bg-neutral-800 text-neutral-300">
            <MessageSquare size={13} />
            <span>{post.commentCount || 0}</span>
            <span className="hidden sm:inline">comments</span>
          </div>

          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-neutral-950/70 hover:bg-neutral-800 text-neutral-300 cursor-pointer"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Share2 size={13} />}
            <span>{copied ? 'Copied' : 'Share'}</span>
          </button>

          {isAuthor && onDeletePost && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!confirmDelete) {
                  setConfirmDelete(true);
                  setTimeout(() => setConfirmDelete(false), 3000);
                } else {
                  onDeletePost(post.id);
                }
              }}
              className={`ml-auto flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer ${
                confirmDelete
                  ? 'bg-red-500/20 text-red-400 border border-red-500/40 font-semibold'
                  : 'text-neutral-500 hover:text-red-400 hover:bg-neutral-800'
              }`}
              title={confirmDelete ? 'Click again to confirm deletion' : 'Delete post'}
            >
              <Trash2 size={13} />
              <span className="hidden sm:inline">{confirmDelete ? 'Confirm?' : 'Delete'}</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
});

PostCard.displayName = 'PostCard';
