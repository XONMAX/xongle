import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Link as LinkIcon,
  Image as ImageIcon,
  Eye,
  Send,
  UploadCloud,
  AlertCircle,
} from 'lucide-react';
import { Community, PostType, Post } from '../types';
import { dbService } from '../services/db';
import { validateImageUploadFile } from '../security/fileValidator';
import { isSafeHttpUrl, isSafeImageSource, getSafeHref, getSafeImageSrc } from '../validation/schemas';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  communities: Community[];
  initialCommunitySlug?: string;
  authorName: string;
  currentUser?: any;
  onGoogleSignIn?: () => void;
  onPostCreated: (post: Post) => void;
  onOpenCreateCommunity: () => void;
}

const FLAIR_OPTIONS = ['Discussion', 'News', 'Question', 'Guide', 'Media', 'Meta'];

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  onClose,
  communities,
  initialCommunitySlug,
  authorName,
  currentUser,
  onGoogleSignIn,
  onPostCreated,
  onOpenCreateCommunity,
}) => {
  const [selectedSlug, setSelectedSlug] = useState(
    initialCommunitySlug || (communities[0] ? communities[0].slug : '')
  );

  useEffect(() => {
    if (isOpen) {
      if (initialCommunitySlug) {
        setSelectedSlug(initialCommunitySlug);
      } else if (!selectedSlug && communities.length > 0) {
        setSelectedSlug(communities[0].slug);
      }
    }
  }, [isOpen, initialCommunitySlug, communities]);
  const [postType, setPostType] = useState<PostType>('text');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [flair, setFlair] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const isGoogleAuth = currentUser && !currentUser.isAnonymous;
  const currentCommunity = communities.find((c) => c.slug === selectedSlug) || communities[0];

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = await validateImageUploadFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid image file');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(reader.result as string);
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentCommunity) {
      setError('Please select or create a community first');
      return;
    }

    const cleanTitle = title.trim();
    if (cleanTitle.length < 3 || cleanTitle.length > 300) {
      setError('Title must be between 3 and 300 characters');
      return;
    }

    if (postType === 'link') {
      if (!linkUrl.trim() || !isSafeHttpUrl(linkUrl.trim())) {
        setError('Please provide a valid HTTP or HTTPS link URL');
        return;
      }
    }

    if (postType === 'image') {
      if (!imageUrl.trim() || !isSafeImageSource(imageUrl.trim())) {
        setError('Please upload a valid raster image (PNG, JPG, WebP, GIF) or provide an HTTPS image URL');
        return;
      }
    }

    if (!currentUser) {
      if (onGoogleSignIn) {
        onGoogleSignIn();
        return;
      }
      setError('Sign in with Google required to publish');
      return;
    }


    setSubmitting(true);
    setError('');

    try {
      const created = await dbService.createPost({
        title: cleanTitle,
        body: postType === 'text' ? body : undefined,
        type: postType,
        linkUrl: postType === 'link' ? linkUrl.trim() : undefined,
        imageUrl: postType === 'image' ? imageUrl : undefined,
        communityId: currentCommunity.id,
        communitySlug: currentCommunity.slug,
        communityName: currentCommunity.name,
        authorName,
        flair: flair || undefined,
      });

      onPostCreated(created);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to publish post');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">Create a Post</h2>
            <span className="text-xs text-neutral-400">as {authorName}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Community Selector */}
          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
              Choose Community
            </label>
            <div className="flex items-center gap-2">
              {communities.length > 0 ? (
                <select
                  value={selectedSlug}
                  onChange={(e) => setSelectedSlug(e.target.value)}
                  className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white font-medium focus:outline-hidden focus:border-orange-500"
                >
                  {communities.map((c) => (
                    <option key={c.id} value={c.slug}>
                      c/{c.slug} — {c.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex-1 px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-sm text-neutral-400">
                  No communities exist yet.
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCreateCommunity();
                }}
                className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold rounded-lg text-orange-400 whitespace-nowrap cursor-pointer"
              >
                + New Community
              </button>
            </div>
          </div>

          {/* Post Type Tabs */}
          <div className="flex border-b border-neutral-800">
            <button
              type="button"
              onClick={() => {
                setPostType('text');
                setPreviewMode(false);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 cursor-pointer ${
                postType === 'text'
                  ? 'border-orange-500 text-white'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <FileText size={15} /> Post
            </button>
            <button
              type="button"
              onClick={() => {
                setPostType('image');
                setPreviewMode(false);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 cursor-pointer ${
                postType === 'image'
                  ? 'border-orange-500 text-white'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <ImageIcon size={15} /> Images
            </button>
            <button
              type="button"
              onClick={() => {
                setPostType('link');
                setPreviewMode(false);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 cursor-pointer ${
                postType === 'link'
                  ? 'border-orange-500 text-white'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <LinkIcon size={15} /> Link
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode(!previewMode)}
              className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 my-1 text-xs rounded-md font-medium cursor-pointer ${
                previewMode
                  ? 'bg-orange-600/20 text-orange-400 border border-orange-500/30'
                  : 'text-neutral-400 hover:text-white bg-neutral-950'
              }`}
            >
              <Eye size={13} /> {previewMode ? 'Edit Mode' : 'Preview'}
            </button>
          </div>

          {previewMode ? (
            /* Live Preview Box */
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
              <div className="text-xs text-neutral-400">
                Previewing for <span className="font-semibold text-white">c/{currentCommunity?.slug}</span>
              </div>
              <h3 className="text-lg font-bold text-white">{title || '(Untitled Post)'}</h3>
              {flair && (
                <span className="inline-block text-[10px] px-2 py-0.5 rounded-full font-medium bg-neutral-800 text-orange-400 border border-neutral-700">
                  {flair}
                </span>
              )}
              {postType === 'text' && (
                <p className="text-sm text-neutral-300 whitespace-pre-line leading-relaxed">
                  {body || '(No body text)'}
                </p>
              )}
              {postType === 'link' && getSafeHref(linkUrl) && (
                <a
                  href={getSafeHref(linkUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 underline block"
                >
                  {getSafeHref(linkUrl)}
                </a>
              )}
              {postType === 'image' && getSafeImageSrc(imageUrl) && (
                <div className="max-h-64 flex justify-center bg-black/40 rounded-lg overflow-hidden">
                  <img src={getSafeImageSrc(imageUrl)} alt="preview" className="max-h-64 object-contain" />
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Title */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                    Title
                  </label>
                  <span className="text-[11px] font-mono text-neutral-500">{title.length}/300</span>
                </div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Interesting title for your post..."
                  className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-medium text-sm focus:outline-hidden focus:border-orange-500"
                  maxLength={300}
                  required
                />
              </div>

              {/* Flair Picker */}
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Optional Flair
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {FLAIR_OPTIONS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFlair(flair === f ? '' : f)}
                      className={`px-2.5 py-1 text-xs rounded-full font-medium cursor-pointer ${
                        flair === f
                          ? 'bg-orange-600 text-white'
                          : 'bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Post Body */}
              {postType === 'text' && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                      Body (Optional)
                    </label>
                    <span className="text-[11px] font-mono text-neutral-500">{body.length}/20000</span>
                  </div>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Provide details, background story, discussion questions..."
                    rows={5}
                    className="w-full p-3 bg-neutral-950 border border-neutral-800 rounded-lg text-white text-sm focus:outline-hidden focus:border-orange-500 resize-y leading-relaxed"
                    maxLength={20000}
                  />
                </div>
              )}

              {/* Link Post URL */}
              {postType === 'link' && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                    URL Destination
                  </label>
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://example.com/article"
                    className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white text-sm focus:outline-hidden focus:border-orange-500"
                  />
                </div>
              )}

              {/* Image Post File / URL */}
              {postType === 'image' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                      Upload Image File
                    </label>
                    <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-neutral-800 hover:border-neutral-700 bg-neutral-950 rounded-xl cursor-pointer">
                      <UploadCloud size={28} className="text-neutral-500 mb-2" />
                      <span className="text-xs font-medium text-neutral-300">
                        Click to select image (PNG, JPG, WebP)
                      </span>
                      <span className="text-[11px] text-neutral-500 mt-1">Max 2MB</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="text-center text-xs text-neutral-500 font-mono">OR IMAGE URL</div>

                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/photo-..."
                    className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white text-sm focus:outline-hidden focus:border-orange-500"
                  />

                  {imageUrl && (
                    <div className="relative rounded-lg overflow-hidden border border-neutral-800 bg-black/40 p-2 flex justify-center">
                      <img src={imageUrl} alt="preview" className="max-h-48 object-contain rounded-md" />
                      <button
                        type="button"
                        onClick={() => setImageUrl('')}
                        className="absolute top-3 right-3 p-1 rounded-full bg-black/80 text-white hover:bg-red-600"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-800 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-neutral-800 flex items-center justify-between">
            <span className="text-xs text-neutral-500">
              Content is immediately indexed and searchable via Xongle.
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !title.trim()}
                className="px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:pointer-events-none text-white text-sm font-bold flex items-center gap-2 cursor-pointer"
              >
                <Send size={15} />
                <span>{submitting ? 'Publishing...' : 'Publish Post'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
