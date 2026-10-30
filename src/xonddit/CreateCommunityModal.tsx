import React, { useState } from 'react';
import { X, Users, AlertCircle, Plus, Check } from 'lucide-react';
import { Community } from '../types';
import { dbService } from '../services/db';
import { communityCreationSchema } from '../validation/communitySchema';

interface CreateCommunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  creatorName: string;
  currentUser?: any;
  onGoogleSignIn?: () => void;
  onCommunityCreated: (community: Community) => void;
}

export const CreateCommunityModal: React.FC<CreateCommunityModalProps> = ({
  isOpen,
  onClose,
  creatorName,
  currentUser,
  onGoogleSignIn,
  onCommunityCreated,
}) => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const isGoogleAuth = currentUser && !currentUser.isAnonymous;

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    // Auto generate clean slug
    const generatedSlug = val
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 30);
    setSlug(generatedSlug);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Pre-validate and sanitize through Zod schema
    const validationResult = communityCreationSchema.safeParse({
      name,
      slug,
      title,
      description,
      iconUrl: iconUrl.trim() || undefined,
      bannerUrl: bannerUrl.trim() || undefined,
      creatorName,
    });

    if (!validationResult.success) {
      const issue = validationResult.error.issues[0];
      setError(issue ? `${issue.path.join('.') ? `${issue.path.join('.')}: ` : ''}${issue.message}` : 'Validation failed');
      return;
    }

    const validData = validationResult.data;

    if (!currentUser) {
      if (onGoogleSignIn) {
        onGoogleSignIn();
        return;
      }
      setError('Sign in with Google required to create a community');
      return;
    }

    setSubmitting(true);

    try {
      const created = await dbService.createCommunity({
        name: validData.name,
        slug: validData.slug,
        title: validData.title,
        description: validData.description,
        iconUrl: validData.iconUrl,
        bannerUrl: validData.bannerUrl,
        creatorName: validData.creatorName,
      });

      onCommunityCreated(created);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create community');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden my-auto">
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-600/20 text-orange-400 flex items-center justify-center">
              <Users size={16} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Create a Community</h2>
              <p className="text-xs text-neutral-400">Launch a new topic hub on Xonddit</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
              Community Name
            </label>
            <input
              type="text"
              value={name}
              onChange={handleNameChange}
              placeholder="e.g. Indie Hackers, Retro Tech, SciFi"
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-medium text-sm focus:outline-hidden focus:border-orange-500"
              maxLength={30}
              required
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                Community URL Slug
              </label>
              <span className="text-[11px] font-mono text-neutral-500">c/{slug || '...'}</span>
            </div>
            <div className="relative flex items-center">
              <span className="absolute left-3 font-mono text-neutral-500 text-sm select-none">c/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="indie_hackers"
                className="w-full pl-8 pr-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono text-sm focus:outline-hidden focus:border-orange-500"
                maxLength={30}
                required
              />
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">
              Names cannot be changed after creation. Lowercase letters, numbers, and underscores only.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
              Headline Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Builders sharing products and revenue"
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white text-sm focus:outline-hidden focus:border-orange-500"
              maxLength={80}
              required
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                Description & Rules
              </label>
              <span className="text-[11px] font-mono text-neutral-500">{description.length}/500</span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this community is about, community norms, guidelines..."
              rows={3}
              className="w-full p-3 bg-neutral-950 border border-neutral-800 rounded-lg text-white text-sm focus:outline-hidden focus:border-orange-500 resize-none"
              maxLength={500}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                Icon URL (Optional)
              </label>
              <input
                type="url"
                value={iconUrl}
                onChange={(e) => setIconUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white text-xs focus:outline-hidden focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                Banner URL (Optional)
              </label>
              <input
                type="url"
                value={bannerUrl}
                onChange={(e) => setBannerUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white text-xs focus:outline-hidden focus:border-orange-500"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-800 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-3 border-t border-neutral-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim() || !slug.trim()}
              className="px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:pointer-events-none text-white text-sm font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={16} />
              <span>{submitting ? 'Creating...' : 'Create Community'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
