import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowBigUp,
  ArrowBigDown,
  MessageSquare,
  Share2,
  Send,
  CornerDownRight,
  Check,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { Post, Comment } from '../types';
import { dbService } from '../services/db';
import { getSafeHref, getSafeImageSrc } from '../validation/schemas';

interface PostDetailProps {
  post: Post;
  currentUserId?: string;
  currentUserName: string;
  currentUser?: any;
  onGoogleSignIn?: () => void;
  userVotes: Record<string, number>;
  onVotePost: (postId: string, direction: 1 | -1) => void;
  onBack: () => void;
  onSelectCommunity: (slug: string) => void;
  onDeletePost?: (postId: string) => void;
}

export const PostDetail: React.FC<PostDetailProps> = ({
  post,
  currentUserId,
  currentUserName,
  currentUser,
  onGoogleSignIn,
  userVotes,
  onVotePost,
  onBack,
  onSelectCommunity,
  onDeletePost,
}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [newCommentText, setNewCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [imageError, setImageError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const safeLinkHref = getSafeHref(post.linkUrl);
  const safeImageSrc = getSafeImageSrc(post.imageUrl);
  const postVote = userVotes[post.id] || 0;

  useEffect(() => {
    loadComments();
  }, [post.id]);

  const loadComments = async () => {
    setLoadingComments(true);
    try {
      const data = await dbService.getComments(post.id);
      setComments(data);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent, parentId?: string) => {
    e.preventDefault();
    const text = parentId ? replyText.trim() : newCommentText.trim();
    if (!text) return;

    if (!currentUser) {
      if (onGoogleSignIn) {
        onGoogleSignIn();
        return;
      }
      setErrorMsg('Please sign in with Google to post comments');
      return;
    }

    setSubmittingComment(true);
    setErrorMsg('');
    try {
      const created = await dbService.createComment({
        postId: post.id,
        communityId: post.communityId,
        content: text,
        authorName: currentUserName,
        parentId,
      });
      setComments((prev) => [...prev, created]);
      if (parentId) {
        setReplyText('');
        setReplyingToId(null);
      } else {
        setNewCommentText('');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to submit comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleVoteComment = async (commentId: string, direction: 1 | -1) => {
    try {
      const res = await dbService.castVote(commentId, 'comment', direction);
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, score: res.newScore } : c))
      );
    } catch (err) {
      console.error('Failed to vote comment:', err);
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}${window.location.pathname}?app=xonddit&p=${encodeURIComponent(post.id)}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isAuthor = currentUserId === post.authorId;

  // Group comments: top-level comments and replies
  const rootComments = comments.filter((c) => !c.parentId);
  const repliesByParent = comments.reduce<Record<string, Comment[]>>((acc, c) => {
    if (c.parentId) {
      acc[c.parentId] = acc[c.parentId] || [];
      acc[c.parentId].push(c);
    }
    return acc;
  }, {});

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Back Button */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-medium text-neutral-400 hover:text-white cursor-pointer py-1"
      >
        <ArrowLeft size={16} />
        <span>Back to feed</span>
      </button>

      {/* Main Post Document */}
      <article className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-xl">
        <div className="flex">
          {/* Vote gutter */}
          <div className="w-12 bg-neutral-950/60 p-2 flex flex-col items-center gap-1 shrink-0 select-none border-r border-neutral-800/60">
            <button
              type="button"
              onClick={() => onVotePost(post.id, 1)}
              aria-label="Upvote post"
              className={`p-1 rounded-md cursor-pointer ${
                postVote === 1
                  ? 'text-orange-500 bg-orange-500/10'
                  : 'text-neutral-400 hover:text-orange-500 hover:bg-neutral-800'
              }`}
            >
              <ArrowBigUp size={24} className={postVote === 1 ? 'fill-current' : ''} />
            </button>
            <span
              className={`text-xs font-bold font-mono tabular-nums ${
                postVote === 1 ? 'text-orange-500' : postVote === -1 ? 'text-blue-500' : 'text-neutral-200'
              }`}
            >
              {post.score}
            </span>
            <button
              type="button"
              onClick={() => onVotePost(post.id, -1)}
              aria-label="Downvote post"
              className={`p-1 rounded-md cursor-pointer ${
                postVote === -1
                  ? 'text-blue-500 bg-blue-500/10'
                  : 'text-neutral-400 hover:text-blue-500 hover:bg-neutral-800'
              }`}
            >
              <ArrowBigDown size={24} className={postVote === -1 ? 'fill-current' : ''} />
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-4 sm:p-6 min-w-0">
            <div className="flex items-center flex-wrap gap-2 text-xs mb-3 text-neutral-400">
              <button
                type="button"
                onClick={() => onSelectCommunity(post.communitySlug)}
                className="font-bold text-neutral-200 hover:text-orange-400 hover:underline cursor-pointer"
              >
                c/{post.communitySlug}
              </button>
              <span className="text-neutral-600">·</span>
              <span>Posted by <span className="font-mono text-neutral-300">{post.authorName}</span></span>
              <span className="text-neutral-600">·</span>
              <span>{new Date(post.createdAt).toLocaleString()}</span>
              {post.flair && (
                <>
                  <span className="text-neutral-600">·</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-orange-400">
                    {post.flair}
                  </span>
                </>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-white mb-4 leading-tight break-words">
              {post.title}
            </h1>

            {post.body && (
              <div className="text-neutral-200 text-sm sm:text-base leading-relaxed whitespace-pre-line mb-6 font-normal break-words">
                {post.body}
              </div>
            )}

            {safeLinkHref && (
              <div className="mb-6 p-4 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between gap-3">
                <div className="truncate">
                  <span className="text-xs text-neutral-500 uppercase tracking-wider block mb-1">Outbound Link</span>
                  <a
                    href={safeLinkHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-blue-400 hover:underline truncate block"
                  >
                    {safeLinkHref}
                  </a>
                </div>
                <a
                  href={safeLinkHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 shrink-0"
                >
                  <ExternalLink size={13} /> Open
                </a>
              </div>
            )}

            {safeImageSrc && !imageError && (
              <div className="mb-6 rounded-xl overflow-hidden bg-neutral-950 border border-neutral-800 flex justify-center min-h-[220px] relative">
                <img
                  src={safeImageSrc}
                  alt={post.title}
                  className="max-h-[600px] w-auto object-contain"
                  loading="lazy"
                  decoding="async"
                  onError={() => setImageError(true)}
                />
              </div>
            )}

            {/* Post actions */}
            <div className="flex items-center flex-wrap gap-3 text-xs pt-4 border-t border-neutral-800 text-neutral-400">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-950 text-neutral-300">
                <MessageSquare size={14} />
                <span>{comments.length} comments</span>
              </span>

              <button
                type="button"
                onClick={handleShare}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-neutral-300 cursor-pointer"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
                <span>{copied ? 'Link Copied!' : 'Share Post'}</span>
              </button>

              {isAuthor && onDeletePost && (
                <button
                  type="button"
                  onClick={() => {
                    if (!confirmDelete) {
                      setConfirmDelete(true);
                      setTimeout(() => setConfirmDelete(false), 3000);
                    } else {
                      onDeletePost(post.id);
                    }
                  }}
                  className={`ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-pointer ${
                    confirmDelete
                      ? 'bg-red-500/20 text-red-400 border border-red-500/40 font-semibold'
                      : 'text-neutral-500 hover:text-red-400 hover:bg-neutral-800'
                  }`}
                  title={confirmDelete ? 'Click again to confirm permanent deletion' : 'Delete Post'}
                >
                  <Trash2 size={14} />
                  <span>{confirmDelete ? 'Confirm Delete?' : 'Delete Post'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </article>

      {/* Comment Creation Box */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-neutral-300">
            Comment as <span className="font-mono text-orange-400">{currentUserName}</span>
          </h3>
        </div>
        <form onSubmit={(e) => handleAddComment(e)}>
          <textarea
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            placeholder="What are your thoughts on this discussion?"
            rows={3}
            className="w-full p-3 bg-neutral-950 border border-neutral-800 rounded-lg text-white text-sm focus:outline-hidden focus:border-orange-500 resize-y leading-relaxed"
            maxLength={5000}
          />
          {errorMsg && <p className="text-red-400 text-xs mt-1.5">{errorMsg}</p>}
          <div className="flex justify-between items-center mt-2.5">
            <span className="text-[11px] text-neutral-500">
              {newCommentText.length}/5000 characters • Synchronized to Xongle
            </span>
            <button
              type="submit"
              disabled={submittingComment || !newCommentText.trim()}
              className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:pointer-events-none text-white text-sm font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Send size={14} />
              <span>{submittingComment ? 'Posting...' : 'Comment'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Comments List */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-neutral-300 uppercase tracking-wider px-1">
          Discussion ({comments.length})
        </h3>

        {loadingComments ? (
          <div className="p-8 text-center text-neutral-500 bg-neutral-900/50 rounded-xl border border-neutral-800">
            Loading comments...
          </div>
        ) : rootComments.length === 0 ? (
          <div className="p-10 text-center bg-neutral-900/40 border border-neutral-800/80 rounded-xl">
            <MessageSquare size={32} className="mx-auto text-neutral-600 mb-2" />
            <p className="text-neutral-300 font-medium">No comments yet</p>
            <p className="text-xs text-neutral-500 mt-1">
              Be the first to share your thoughts on this discussion!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rootComments.map((comment) => (
              <div
                key={comment.id}
                className="bg-neutral-900 border border-neutral-800/90 rounded-xl p-4 space-y-3"
              >
                {/* Comment Header */}
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium text-neutral-200">{comment.authorName}</span>
                    <span className="text-neutral-600">•</span>
                    <span>{new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono text-xs">
                    <button
                      type="button"
                      onClick={() => handleVoteComment(comment.id, 1)}
                      aria-label="Upvote comment"
                      className="p-1 text-neutral-400 hover:text-orange-400 hover:bg-neutral-800 rounded-md cursor-pointer"
                    >
                      <ArrowBigUp size={16} />
                    </button>
                    <span className="px-1 text-neutral-300 font-bold">{comment.score}</span>
                    <button
                      type="button"
                      onClick={() => handleVoteComment(comment.id, -1)}
                      aria-label="Downvote comment"
                      className="p-1 text-neutral-400 hover:text-blue-400 hover:bg-neutral-800 rounded-md cursor-pointer"
                    >
                      <ArrowBigDown size={16} />
                    </button>
                  </div>
                </div>

                {/* Comment Content */}
                <p className="text-sm text-neutral-200 whitespace-pre-line leading-relaxed break-words">
                  {comment.content}
                </p>

                {/* Comment Actions */}
                <div className="flex items-center gap-2 pt-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setReplyingToId(replyingToId === comment.id ? null : comment.id)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
                  >
                    <CornerDownRight size={13} />
                    <span>Reply</span>
                  </button>
                </div>

                {/* Reply Form */}
                {replyingToId === comment.id && (
                  <form
                    onSubmit={(e) => handleAddComment(e, comment.id)}
                    className="pl-4 pt-2 border-l-2 border-neutral-800 space-y-2"
                  >
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={`Reply to ${comment.authorName}...`}
                      rows={2}
                      className="w-full p-2.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white text-xs focus:outline-hidden focus:border-orange-500 resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingToId(null);
                          setReplyText('');
                        }}
                        className="px-3 py-1 text-xs rounded-md bg-neutral-800 text-neutral-300 hover:bg-neutral-700 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!replyText.trim() || submittingComment}
                        className="px-3 py-1 text-xs rounded-md bg-orange-600 hover:bg-orange-500 text-white font-medium disabled:opacity-50 cursor-pointer"
                      >
                        Send Reply
                      </button>
                    </div>
                  </form>
                )}

                {/* Nested Replies */}
                {repliesByParent[comment.id]?.map((reply) => (
                  <div
                    key={reply.id}
                    className="mt-3 pl-4 border-l-2 border-neutral-800 space-y-2 bg-neutral-950/40 p-3 rounded-r-lg"
                  >
                    <div className="flex items-center justify-between text-xs text-neutral-400">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-neutral-300 font-medium">{reply.authorName}</span>
                        <span className="text-neutral-600">•</span>
                        <span>{new Date(reply.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="flex items-center gap-1 font-mono text-xs">
                        <button
                          type="button"
                          onClick={() => handleVoteComment(reply.id, 1)}
                          aria-label="Upvote reply"
                          className="p-0.5 text-neutral-400 hover:text-orange-400 cursor-pointer"
                        >
                          <ArrowBigUp size={15} />
                        </button>
                        <span className="px-1 text-neutral-300">{reply.score}</span>
                        <button
                          type="button"
                          onClick={() => handleVoteComment(reply.id, -1)}
                          aria-label="Downvote reply"
                          className="p-0.5 text-neutral-400 hover:text-blue-400 cursor-pointer"
                        >
                          <ArrowBigDown size={15} />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-neutral-200 whitespace-pre-line leading-relaxed break-words">
                      {reply.content}
                    </p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
