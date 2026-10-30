import React, {
  useState,
  useEffect,
  useCallback,
  useTransition,
  useMemo,
  useDeferredValue,
  lazy,
  Suspense,
} from 'react';
import { User } from 'firebase/auth';
import {
  Flame,
  Clock,
  TrendingUp,
  Award,
  Plus,
  Search,
  Users,
  RefreshCw,
  X,
  Compass,
  MessageSquare,
  ArrowLeft,
  Filter,
  Crown,
  CheckCircle2,
} from 'lucide-react';
import { Community, Post, FeedSort, UserProfile, SupportedApp } from '../types';
import { XongleLogo } from '../xongle/XongleLogo';
import { dbService } from '../services/db';
import { XondditLogo } from './XondditLogo';
import { CommunitySidebar } from './CommunitySidebar';
import { PostCard } from './PostCard';
import type { LegalTab } from '../components/LegalPrivacyModal';
import { normalizeSupportedLanguage, syncDocumentHead } from '../seo/seoConfig';

const PostDetail = lazy(() =>
  import('./PostDetail').then((m) => ({ default: m.PostDetail }))
);
const CreatePostModal = lazy(() =>
  import('./CreatePostModal').then((m) => ({ default: m.CreatePostModal }))
);
const CreateCommunityModal = lazy(() =>
  import('./CreateCommunityModal').then((m) => ({ default: m.CreateCommunityModal }))
);

export interface XondditAppProps {
  currentUser: User | null;
  userProfile?: UserProfile;
  onGoogleSignIn: () => void;
  onOpenUserModal: () => void;
  onOpenOwnerPanel: () => void;
  onOpenLegal?: (tab?: LegalTab) => void;
  onSwitchApp?: (
    app: SupportedApp,
    extraParams?: Record<string, string>
  ) => void;
  initialPostId?: string;
  initialCommunitySlug?: string;
}

const FLAIR_OPTIONS = ['All', 'Discussion', 'News', 'Question', 'Guide', 'Media', 'Meta'];
const OWNER_EMAILS = ['aminbek785@gmail.com', 'crownsmpuz@gmail.com'];

export const XondditApp: React.FC<XondditAppProps> = ({
  currentUser,
  userProfile,
  onGoogleSignIn,
  onOpenUserModal,
  onOpenOwnerPanel,
  onOpenLegal,
  onSwitchApp,
  initialPostId,
  initialCommunitySlug,
}) => {
  const [, startTransition] = useTransition();

  // Navigation & view states
  const [activeCommunitySlug, setActiveCommunitySlug] = useState<string | null>(
    initialCommunitySlug || null
  );
  const [selectedPostId, setSelectedPostId] = useState<string | null>(initialPostId || null);
  const [directPost, setDirectPost] = useState<Post | null>(() =>
    initialPostId ? dbService.getCachedPostById(initialPostId) : null
  );
  const [loadingDirectPost, setLoadingDirectPost] = useState(false);
  const [sort, setSort] = useState<FeedSort>('hot');
  const [selectedFlair, setSelectedFlair] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Modals
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [isCreateCommunityOpen, setIsCreateCommunityOpen] = useState(false);

  // Data states — hydrate synchronously from in-memory cache for 0ms transitions
  const [communities, setCommunities] = useState<Community[]>(() =>
    dbService.getCachedCommunities()
  );
  const [posts, setPosts] = useState<Post[]>(() =>
    dbService.getCachedPosts({
      communitySlug: initialCommunitySlug || undefined,
      sort: 'hot',
    })
  );
  const [userVotes, setUserVotes] = useState<Record<string, number>>({});
  const [loadingPosts, setLoadingPosts] = useState<boolean>(
    () =>
      dbService.getCachedPosts({
        communitySlug: initialCommunitySlug || undefined,
        sort: 'hot',
      }).length === 0
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isOwner = Boolean(
    currentUser?.email && OWNER_EMAILS.includes(currentUser.email.toLowerCase().trim())
  );

  // Sync initial params if they change from external navigation
  useEffect(() => {
    setSelectedPostId(initialPostId || null);
    if (initialPostId) {
      const cached = dbService.getCachedPostById(initialPostId);
      if (cached) {
        setDirectPost(cached);
        setLoadingDirectPost(false);
      }
    }
  }, [initialPostId]);

  useEffect(() => {
    setActiveCommunitySlug(initialCommunitySlug || null);
  }, [initialCommunitySlug]);

  // Load Communities on mount
  const loadCommunities = useCallback(async (force = false) => {
    try {
      const list = await dbService.getCommunities(force);
      setCommunities(list);
    } catch (err) {
      console.error('Failed to load communities:', err);
    }
  }, []);

  useEffect(() => {
    loadCommunities();
  }, [loadCommunities]);

  // Load User Votes when user changes
  useEffect(() => {
    if (!currentUser) {
      setUserVotes({});
      return;
    }
    let isMounted = true;
    dbService.getUserVotes().then((votes) => {
      if (isMounted) setUserVotes(votes);
    });
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  // Load Posts based on active community and sort
  const loadPosts = useCallback(
    async (force = false) => {
      const immediateCached = !force
        ? dbService.getCachedPosts({
            communitySlug: activeCommunitySlug || undefined,
            sort,
            flair: selectedFlair !== 'All' ? selectedFlair : undefined,
          })
        : [];
      if (immediateCached.length > 0) {
        setPosts(immediateCached);
        setLoadingPosts(false);
      } else {
        setLoadingPosts(true);
      }

      try {
        const list = await dbService.getPosts(
          {
            communitySlug: activeCommunitySlug || undefined,
            sort,
            flair: selectedFlair !== 'All' ? selectedFlair : undefined,
          },
          force
        );
        startTransition(() => {
          setPosts(list);
          setLoadingPosts(false);
          setIsRefreshing(false);
        });
      } catch (err) {
        console.error('Failed to load posts:', err);
        setLoadingPosts(false);
        setIsRefreshing(false);
      }
    },
    [activeCommunitySlug, sort, selectedFlair]
  );

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  // Fetch single post directly if selectedPostId is not in current posts array
  useEffect(() => {
    if (!selectedPostId) {
      setDirectPost(null);
      setLoadingDirectPost(false);
      return;
    }
    const foundInFeed =
      posts.find((p) => p.id === selectedPostId) ||
      dbService.getCachedPostById(selectedPostId);
    if (foundInFeed) {
      setDirectPost(foundInFeed);
      setLoadingDirectPost(false);
      return;
    }
    let isMounted = true;
    setLoadingDirectPost(true);
    dbService
      .getPostById(selectedPostId)
      .then((fetched) => {
        if (isMounted) {
          setDirectPost(fetched);
          setLoadingDirectPost(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoadingDirectPost(false);
      });
    return () => {
      isMounted = false;
    };
  }, [selectedPostId, posts]);

  // Active Community object
  const activeCommunity = useMemo(() => {
    if (!activeCommunitySlug) return null;
    return communities.find((c) => c.slug.toLowerCase() === activeCommunitySlug.toLowerCase()) || null;
  }, [communities, activeCommunitySlug]);

  // Selected post object for detail view
  const selectedPost = useMemo(() => {
    if (!selectedPostId) return null;
    return (
      posts.find((p) => p.id === selectedPostId) ||
      directPost ||
      dbService.getCachedPostById(selectedPostId) ||
      null
    );
  }, [posts, selectedPostId, directPost]);

  // Synchronize dynamic community/post metadata into <head> when loaded
  useEffect(() => {
    const langParam = new URLSearchParams(window.location.search).get('lang');
    const savedLang = (() => {
      try {
        return localStorage.getItem('xongle_language');
      } catch {
        return null;
      }
    })();
    const lang = normalizeSupportedLanguage(langParam || savedLang);

    syncDocumentHead({
      app: 'xonddit',
      lang,
      communitySlug: selectedPost?.communitySlug || activeCommunity?.slug || activeCommunitySlug || undefined,
      communityName: activeCommunity?.name,
      communityDescription: activeCommunity?.description || activeCommunity?.title,
      postId: selectedPost?.id || selectedPostId || undefined,
      postTitle: selectedPost?.title,
      postSnippet: selectedPost?.body || selectedPost?.linkUrl || selectedPost?.title,
      postAuthor: selectedPost?.authorName,
    });
  }, [activeCommunity, activeCommunitySlug, selectedPost, selectedPostId]);

  // Filter posts by deferred search query (keeps input INP fast)
  const displayedPosts = useMemo(() => {
    if (!deferredSearchQuery.trim()) return posts;
    const q = deferredSearchQuery.toLowerCase().trim();
    return posts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.body && p.body.toLowerCase().includes(q)) ||
        p.authorName.toLowerCase().includes(q) ||
        p.communitySlug.toLowerCase().includes(q)
    );
  }, [posts, deferredSearchQuery]);

  // Update browser URL query params smoothly without full reloads
  const updateUrl = useCallback((postId?: string | null, communitySlug?: string | null) => {
    const params = new URLSearchParams(window.location.search);
    params.set('app', 'xonddit');
    if (postId) {
      params.set('p', postId);
    } else {
      params.delete('p');
    }
    if (communitySlug) {
      params.set('c', communitySlug);
    } else {
      params.delete('c');
    }
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, '', newUrl);
  }, []);

  const handleSelectCommunity = (slug: string | null) => {
    setActiveCommunitySlug(slug);
    setSelectedPostId(null);
    updateUrl(null, slug);
  };

  const handleSelectPost = (postId: string) => {
    setSelectedPostId(postId);
    updateUrl(postId, activeCommunitySlug);
  };

  const handleBackToFeed = () => {
    setSelectedPostId(null);
    updateUrl(null, activeCommunitySlug);
  };

  // Optimistic Vote Handler
  const handleVote = async (postId: string, direction: 1 | -1) => {
    const currentDirection = (userVotes[postId] || 0) as 1 | -1 | 0;
    const newDirection = currentDirection === direction ? 0 : direction;
    const delta = newDirection - currentDirection;

    setUserVotes((prev) => ({ ...prev, [postId]: newDirection }));
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        return {
          ...p,
          score: p.score + delta,
          upvotes: (p.upvotes || 0) + (newDirection === 1 ? 1 : currentDirection === 1 ? -1 : 0),
          downvotes: (p.downvotes || 0) + (newDirection === -1 ? 1 : currentDirection === -1 ? -1 : 0),
        };
      })
    );
    if (directPost && directPost.id === postId) {
      setDirectPost({ ...directPost, score: directPost.score + delta });
    }

    try {
      await dbService.votePost(postId, direction);
    } catch (err) {
      console.warn('Voting error:', err);
      setUserVotes((prev) => ({ ...prev, [postId]: currentDirection }));
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          return { ...p, score: p.score - delta };
        })
      );
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await dbService.deletePost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      if (selectedPostId === postId) {
        handleBackToFeed();
      }
    } catch (err) {
      console.error('Failed to delete post:', err);
    }
  };

  const handlePostCreated = (newPost: Post) => {
    setPosts((prev) => [newPost, ...prev]);
    setIsCreatePostOpen(false);
    if (activeCommunitySlug && activeCommunitySlug !== newPost.communitySlug) {
      handleSelectCommunity(newPost.communitySlug);
    }
    handleSelectPost(newPost.id);
  };

  const handleCommunityCreated = (newCommunity: Community) => {
    setCommunities((prev) => [newCommunity, ...prev]);
    setIsCreateCommunityOpen(false);
    handleSelectCommunity(newCommunity.slug);
  };

  const currentUserName = userProfile?.displayName || currentUser?.displayName || 'User';

  return (
    <div className="min-h-screen bg-[#0b0d10] text-neutral-100 flex flex-col font-sans selection:bg-orange-500/25 selection:text-orange-200">
      {/* ========================================================= */}
      {/* TOP HEADER / APP BAR                                      */}
      {/* ========================================================= */}
      <header className="sticky top-0 z-40 bg-[#0b0d10]/95 backdrop-blur-md border-b border-neutral-800/90 text-neutral-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-4 text-xs">
          {/* Left: Brand + Community Switcher / Home */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <a
              href="/?app=xonddit"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                  e.preventDefault();
                  handleSelectCommunity(null);
                }
              }}
              className="flex items-center gap-2.5 group cursor-pointer"
              title="Xonddit Home"
            >
              <XondditLogo size={30} />
              <span className="font-extrabold text-lg tracking-tight text-white hidden sm:inline">
                Xonddit
              </span>
            </a>

            {/* Quick Community Selector Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => handleSelectCommunity(null)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                  activeCommunity
                    ? 'bg-neutral-900 border-orange-500/40 text-orange-400'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                }`}
              >
                <Compass size={14} className={activeCommunity ? 'text-orange-400' : 'text-neutral-400'} />
                <span className="max-w-[110px] sm:max-w-[150px] truncate">
                  {activeCommunity ? `c/${activeCommunity.slug}` : 'Home Feed'}
                </span>
              </button>
            </div>
          </div>

          {/* Center: Search input */}
          <div className="flex-1 max-w-md mx-1 sm:mx-4">
            <div className="relative flex items-center">
              <Search
                size={14}
                className="absolute left-3 text-neutral-500 pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim() && onSwitchApp) {
                    onSwitchApp('xongle', { q: searchQuery.trim() });
                  }
                }}
                placeholder={
                  activeCommunity
                    ? `Filter c/${activeCommunity.slug} or press Enter for Xongle...`
                    : 'Filter feed or press Enter to search in Xongle...'
                }
                aria-label="Filter feed or search in Xongle"
                className="w-full bg-[#12151a] focus:bg-[#151920] border border-neutral-800 focus:border-orange-500/70 rounded-lg pl-9 pr-8 py-1.5 text-xs text-neutral-100 placeholder-neutral-500 outline-hidden"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear filter"
                  className="absolute right-2.5 text-neutral-500 hover:text-white p-0.5 cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Right: Actions & User Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {onSwitchApp && (
              <a
                href="/"
                onClick={(e) => {
                  if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                    e.preventDefault();
                    onSwitchApp('xongle');
                  }
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 font-semibold text-xs cursor-pointer"
                title="Open Xongle Search"
              >
                <XongleLogo size={15} />
                <span>Xongle</span>
              </a>
            )}
            {isOwner && (
              <button
                type="button"
                onClick={onOpenOwnerPanel}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/12 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-semibold text-xs cursor-pointer"
                title="Open Owner Panel"
              >
                <Crown size={13} className="text-amber-400" />
                <span className="hidden lg:inline">Owner</span>
              </button>
            )}

            {/* Create Post Button */}
            <button
              type="button"
              onClick={() => setIsCreatePostOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs cursor-pointer"
            >
              <Plus size={15} />
              <span className="hidden md:inline">Create Post</span>
            </button>

            {/* Create Community Button */}
            <button
              type="button"
              onClick={() => setIsCreateCommunityOpen(true)}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 font-semibold text-xs cursor-pointer"
              title="Create Community"
            >
              <Users size={14} className="text-orange-400" />
              <span>New Community</span>
            </button>

            {/* User Profile Button (always accessible) + Google Sign In if guest */}
            {(!currentUser || currentUser.isAnonymous) && (
              <button
                type="button"
                onClick={onGoogleSignIn}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-neutral-200 text-neutral-950 font-semibold text-xs cursor-pointer"
              >
                <span>Sign in</span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenUserModal}
              className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-lg hover:bg-neutral-900 border border-neutral-800 hover:border-neutral-700 cursor-pointer group"
              title="Open Profile Page"
            >
              {userProfile?.photoURL ? (
                <img
                  src={userProfile.photoURL}
                  alt="User profile avatar"
                  width={28}
                  height={28}
                  className="w-7 h-7 rounded-full object-cover border border-neutral-700"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-orange-600 text-white font-bold flex items-center justify-center text-xs">
                  {((userProfile?.displayName || userProfile?.username || 'U').replace(/^u\//, '').trim()[0] || 'U').toUpperCase()}
                </div>
              )}
              <span className="hidden xl:inline text-xs font-mono font-medium text-neutral-300 group-hover:text-white">
                u/{userProfile?.username || 'user'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================= */}
      {/* ACTIVE COMMUNITY BANNER (if community selected)           */}
      {/* ========================================================= */}
      {activeCommunity && !selectedPostId && (
        <div
          key={`banner-${activeCommunity.slug}`}
          className="bg-[#111419] border-b border-neutral-800 relative overflow-hidden"
        >
          <div
            className="h-24 sm:h-32 w-full bg-[#161a22] relative"
            style={
              activeCommunity.bannerUrl
                ? {
                    backgroundImage: `url(${activeCommunity.bannerUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : undefined
            }
          >
            <div className="absolute inset-0 bg-black/50" />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 relative -mt-7 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex items-end gap-3.5">
              {activeCommunity.iconUrl ? (
                <img
                  src={activeCommunity.iconUrl}
                  alt={`${activeCommunity.name} community icon`}
                  width={64}
                  height={64}
                  className="w-16 h-16 sm:w-18 sm:h-18 rounded-xl object-cover border-4 border-[#111419] bg-neutral-900 shrink-0"
                />
              ) : (
                <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-xl bg-orange-600 text-white font-extrabold flex items-center justify-center text-xl border-4 border-[#111419] shrink-0">
                  c/
                </div>
              )}
              <div className="mb-0.5">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                    c/{activeCommunity.slug}
                  </h1>
                  {(activeCommunity.isVerified || (activeCommunity.memberCount || 0) >= 10000) && (
                    <span
                      className="inline-flex items-center gap-1 text-blue-400 text-xs font-medium"
                      title="Verified Xonddit Community"
                    >
                      <CheckCircle2 size={14} />
                      <span>Verified</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-400 font-medium tabular-nums">
                  {activeCommunity.name} · <span className="font-mono">{activeCommunity.postCount}</span> posts
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCreatePostOpen(true)}
                className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs cursor-pointer flex items-center gap-1.5"
              >
                <Plus size={15} /> Create Post
              </button>
              <button
                type="button"
                onClick={() => handleSelectCommunity(null)}
                className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium text-xs cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft size={14} /> All Feed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MAIN CONTAINER: FEED & SIDEBAR                             */}
      {/* ========================================================= */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Column: Posts or PostDetail */}
          <div className="lg:col-span-8 min-w-0">
            {selectedPostId ? (
              <div key={`post-detail-${selectedPostId}`}>
                {loadingDirectPost || (loadingPosts && !selectedPost) ? (
                  <div className="bg-[#12151a] border border-neutral-800 rounded-xl p-8 space-y-4">
                    <div className="w-32 h-4 bg-neutral-800 rounded-xs" />
                    <div className="w-3/4 h-7 bg-neutral-800 rounded-xs" />
                    <div className="w-full h-24 bg-neutral-800/60 rounded-xs" />
                  </div>
                ) : selectedPost ? (
                  <Suspense
                    fallback={
                      <div className="bg-[#12151a] border border-neutral-800 rounded-xl p-8 space-y-4">
                        <div className="w-32 h-4 bg-neutral-800 rounded-xs" />
                        <div className="w-3/4 h-7 bg-neutral-800 rounded-xs" />
                        <div className="w-full h-24 bg-neutral-800/60 rounded-xs" />
                      </div>
                    }
                  >
                    <PostDetail
                      post={selectedPost}
                      currentUserId={currentUser?.uid}
                      currentUserName={currentUserName}
                      currentUser={currentUser}
                      onGoogleSignIn={onGoogleSignIn}
                      userVotes={userVotes}
                      onVotePost={handleVote}
                      onBack={handleBackToFeed}
                      onSelectCommunity={handleSelectCommunity}
                      onDeletePost={handleDeletePost}
                    />
                  </Suspense>
                ) : (
                  <div className="bg-[#12151a] border border-neutral-800 rounded-xl p-8 text-center space-y-4">
                    <h1 className="text-base font-bold text-white">Post not found</h1>
                    <p className="text-sm text-neutral-400">Post not found or has been removed.</p>
                    <button
                      type="button"
                      onClick={handleBackToFeed}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Return to feed
                    </button>
                  </div>
                )}
              </div>
            ) : (
              // -------------------------------------------------------
              // FEED VIEW
              // -------------------------------------------------------
              <div
                key={`feed-${activeCommunitySlug || 'all'}`}
                className="space-y-4"
              >
                {!activeCommunity && (
                  <h1 className="sr-only">Xonddit Public Communities &amp; Discussions</h1>
                )}
                <h2 className="sr-only">Community Feed Discussions</h2>
                {/* SORT & FILTER BAR */}
                <div className="bg-[#12151a] border border-neutral-800 rounded-xl p-2 sm:p-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    {(
                      [
                        { id: 'hot', label: 'Hot', Icon: Flame },
                        { id: 'new', label: 'New', Icon: Clock },
                        { id: 'top', label: 'Top', Icon: TrendingUp },
                        { id: 'best', label: 'Best', Icon: Award },
                      ] as { id: FeedSort; label: string; Icon: any }[]
                    ).map(({ id, label, Icon }) => {
                      const isActive = sort === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setSort(id)}
                          className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                            isActive
                              ? 'text-orange-400 bg-orange-500/15 border border-orange-500/30'
                              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
                          }`}
                        >
                          <Icon size={14} className="relative z-10" />
                          <span className="relative z-10">{label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Refresh Button */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsRefreshing(true);
                        loadPosts(true);
                        loadCommunities(true);
                      }}
                      disabled={isRefreshing}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
                      title="Refresh Feed"
                      aria-label="Refresh Feed"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </div>

                {/* FLAIR FILTERS BAR (Interactive Filter Buttons) */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
                  <span className="text-[11px] font-medium text-neutral-500 flex items-center gap-1 px-1">
                    <Filter size={11} />
                    Topic:
                  </span>
                  {FLAIR_OPTIONS.map((flair) => {
                    const isFlairActive = selectedFlair === flair;
                    return (
                      <button
                        key={flair}
                        type="button"
                        onClick={() => setSelectedFlair(flair)}
                        className={`relative px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap cursor-pointer ${
                          isFlairActive
                            ? 'bg-orange-600 text-white font-semibold'
                            : 'bg-[#12151a] border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
                        }`}
                      >
                        <span className="relative z-10">{flair}</span>
                      </button>
                    );
                  })}
                </div>

                {/* ACTIVE FILTER / COMMUNITY SUMMARY NOTICE */}
                {activeCommunity && (
                  <div className="flex items-center justify-between px-3.5 py-2 bg-[#12151a] border border-neutral-800 rounded-lg text-xs">
                    <div className="flex items-center gap-2 text-neutral-300">
                      <span>
                        Showing discussions in <strong className="font-mono text-orange-400">c/{activeCommunity.slug}</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectCommunity(null)}
                      className="text-orange-400 hover:text-orange-300 font-medium hover:underline cursor-pointer"
                    >
                      Clear filter
                    </button>
                  </div>
                )}

                {/* POSTS LIST */}
                {loadingPosts ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="bg-[#12151a] border border-neutral-800 rounded-xl p-5 space-y-3"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-28 h-3 rounded-xs bg-neutral-800" />
                          <div className="w-16 h-3 rounded-xs bg-neutral-800" />
                        </div>
                        <div className="w-3/4 h-5 rounded-xs bg-neutral-800" />
                        <div className="w-full h-12 rounded-xs bg-neutral-800/60" />
                      </div>
                    ))}
                  </div>
                ) : displayedPosts.length === 0 ? (
                  <div className="bg-[#12151a] border border-neutral-800 rounded-xl p-8 sm:p-10 text-center space-y-4">
                    <div className="w-12 h-12 mx-auto rounded-xl bg-neutral-900 text-orange-500 flex items-center justify-center border border-neutral-800">
                      <MessageSquare size={22} />
                    </div>
                    <div className="max-w-md mx-auto space-y-1">
                      <h3 className="text-base font-bold text-white">No discussions published yet</h3>
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        {searchQuery
                          ? `No posts matched "${searchQuery}". Try another keyword or run a full search on Xongle.`
                          : activeCommunity
                          ? `Start the first thread in c/${activeCommunity.slug}.`
                          : 'Start the first discussion thread on Xonddit.'}
                      </p>
                    </div>
                    <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsCreatePostOpen(true)}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1.5"
                      >
                        <Plus size={15} /> Create Post
                      </button>
                      {searchQuery && onSwitchApp && (
                        <button
                          type="button"
                          onClick={() => onSwitchApp('xongle', { q: searchQuery })}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Search &ldquo;{searchQuery}&rdquo; on Xongle
                        </button>
                      )}
                      {activeCommunity && (
                        <button
                          type="button"
                          onClick={() => handleSelectCommunity(null)}
                          className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Show All Communities
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {displayedPosts.map((post, idx) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        index={idx}
                        userVote={userVotes[post.id] || 0}
                        currentUserId={currentUser?.uid}
                        onVote={handleVote}
                        onSelectPost={handleSelectPost}
                        onSelectCommunity={handleSelectCommunity}
                        onDeletePost={handleDeletePost}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Community Sidebar */}
          <div className="lg:col-span-4 space-y-4">
            <CommunitySidebar
              communities={communities}
              activeCommunity={activeCommunity}
              currentUser={currentUser}
              onGoogleSignIn={onGoogleSignIn}
              onSelectCommunity={handleSelectCommunity}
              onOpenCreatePost={() => setIsCreatePostOpen(true)}
              onOpenCreateCommunity={() => setIsCreateCommunityOpen(true)}
              onOpenXongle={(q) => {
                if (onSwitchApp) onSwitchApp('xongle', q ? { q } : {});
              }}
              onOpenLegal={onOpenLegal}
            />
          </div>
        </div>
      </main>

      {/* ========================================================= */}
      {/* LAZY-LOADED MODALS                                        */}
      {/* ========================================================= */}
      {isCreatePostOpen && (
        <Suspense fallback={null}>
          <CreatePostModal
            isOpen={isCreatePostOpen}
            onClose={() => setIsCreatePostOpen(false)}
            communities={communities}
            initialCommunitySlug={activeCommunitySlug || undefined}
            authorName={currentUserName}
            currentUser={currentUser}
            onGoogleSignIn={onGoogleSignIn}
            onPostCreated={handlePostCreated}
            onOpenCreateCommunity={() => {
              setIsCreatePostOpen(false);
              setIsCreateCommunityOpen(true);
            }}
          />
        </Suspense>
      )}

      {isCreateCommunityOpen && (
        <Suspense fallback={null}>
          <CreateCommunityModal
            isOpen={isCreateCommunityOpen}
            onClose={() => setIsCreateCommunityOpen(false)}
            creatorName={currentUserName}
            currentUser={currentUser}
            onGoogleSignIn={onGoogleSignIn}
            onCommunityCreated={handleCommunityCreated}
          />
        </Suspense>
      )}
    </div>
  );
};

