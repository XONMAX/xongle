import React, { useState, useEffect, useRef, useDeferredValue } from 'react';
import { User } from 'firebase/auth';
import {
  Search,
  X,
  Clock,
  Flame,
  Bookmark,
  ExternalLink,
  MessageSquare,
  Users,
  FileText,
  Crown,
  SlidersHorizontal,
  ArrowUpRight,
  Sparkles,
  CheckCircle2,
  BookOpen,
  HelpCircle,
} from 'lucide-react';
import {
  SearchContentType,
  SearchSourceFilter,
  SearchSort,
  UserProfile,
  SupportedApp,
  Post,
  Comment,
} from '../types';
import { searchService, SearchResponse, SearchSuggestion } from '../services/search';
import { dbService } from '../services/db';
import {
  CURATED_TOPIC_HUBS,
  GroundedAiAnswerResponse,
  buildExtractiveGroundedAnswer,
  getTopicHubBySlug,
  retrieveGroundedCommunityContext,
} from '../seo/uzbekSearch';
import { XongleLogo } from './XongleLogo';
import { XondditLogo } from '../xonddit/XondditLogo';

interface XongleAppProps {
  initialQuery?: string;
  activeTopicSlug?: string;
  onSelectTopicSlug?: (slug?: string) => void;
  onNavigateToXonddit: (params?: { postId?: string; communitySlug?: string }) => void;
  currentUser: User | null;
  userProfile?: UserProfile;
  onGoogleSignIn: () => void;
  onOpenUserModal: () => void;
  onOpenOwnerPanel: () => void;
  onOpenLegal?: (page: any) => void;
  onSwitchApp?: (app: SupportedApp, extraParams?: Record<string, string>) => void;
}

const OWNER_EMAILS = ['aminbek785@gmail.com', 'crownsmpuz@gmail.com'];

export const XongleApp: React.FC<XongleAppProps> = ({
  initialQuery = '',
  activeTopicSlug,
  onSelectTopicSlug,
  onNavigateToXonddit,
  currentUser,
  userProfile,
  onGoogleSignIn,
  onOpenUserModal,
  onOpenOwnerPanel,
  onSwitchApp,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const deferredQuery = useDeferredValue(query);
  const [activeQuery, setActiveQuery] = useState(initialQuery);
  const [sourceFilter] = useState<SearchSourceFilter>('all');
  const [filterType, setFilterType] = useState<SearchContentType>('all');
  const [sort, setSort] = useState<SearchSort>('relevance');
  const [resultsResponse, setResultsResponse] = useState<SearchResponse | null>(null);
  const [aiAnswer, setAiAnswer] = useState<GroundedAiAnswerResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [, setRecentSearches] = useState<string[]>([]);
  const [savedSearches, setSavedSearches] = useState<string[]>([]);
  const [feedPosts, setFeedPosts] = useState<Post[]>(() => dbService.getCachedPosts({ sort: 'hot' }));
  const [recentComments, setRecentComments] = useState<Comment[]>(() =>
    dbService.getCachedRecentComments()
  );
  const [loadingFeed, setLoadingFeed] = useState<boolean>(
    () => dbService.getCachedPosts({ sort: 'hot' }).length === 0
  );
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const searchBoxRef = useRef<HTMLFormElement>(null);

  const isOwner = Boolean(
    currentUser?.email && OWNER_EMAILS.includes(currentUser.email.toLowerCase().trim())
  );

  const activeTopicHub = React.useMemo(
    () => (activeTopicSlug ? getTopicHubBySlug(activeTopicSlug) : null),
    [activeTopicSlug]
  );

  // Sync initialQuery if updated via URL navigation
  useEffect(() => {
    if (initialQuery !== undefined) {
      setQuery(initialQuery);
      setActiveQuery(initialQuery);
    }
  }, [initialQuery]);

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const renderUserAvatarWidget = () => {
    const customPfp = userProfile?.photoURL;
    const initial = (
      userProfile?.displayName ||
      userProfile?.username ||
      currentUser?.displayName ||
      'U'
    )
      .replace(/^u\//, '')
      .trim()[0]
      ?.toUpperCase() || 'U';

    return (
      <div className="flex items-center gap-2">
        {(!currentUser || currentUser.isAnonymous) && (
          <button
            onClick={onGoogleSignIn}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs cursor-pointer"
          >
            <span>Sign in</span>
          </button>
        )}
        <button
          onClick={onOpenUserModal}
          className="flex items-center gap-2 group cursor-pointer"
          title="Open Profile Page"
        >
          {customPfp ? (
            <img
              src={customPfp}
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover border border-blue-500/50 shadow-xs"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center text-xs shadow-xs">
              {initial}
            </div>
          )}
        </button>
      </div>
    );
  };

  // Load recent searches, saved searches, and index Xonddit communities, posts, and comments
  useEffect(() => {
    setRecentSearches(searchService.getRecentSearches());
    setSavedSearches(searchService.getSavedSearches());
    syncDatabaseToIndex();
  }, []);

  const syncDatabaseToIndex = async () => {
    if (feedPosts.length === 0) {
      setLoadingFeed(true);
    }
    try {
      const [comms, posts, comments] = await Promise.all([
        dbService.getCommunities(),
        dbService.getPosts({ sort: 'hot' }),
        dbService.getRecentComments(80),
      ]);
      searchService.indexCommunitiesBatch(comms);
      searchService.indexPostsBatch(posts);
      searchService.indexCommentsBatch(comments);
      setFeedPosts(posts);
      setRecentComments(comments);
      if (activeQuery.trim()) {
        executeSearch(activeQuery, sourceFilter, filterType, sort);
      }
    } catch (err) {
      console.warn('Index background sync notice:', err);
    } finally {
      setLoadingFeed(false);
    }
  };

  // Format relative time cleanly
  const formatRelativeTime = (isoDate: string) => {
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const mins = Math.max(1, Math.floor(diffMs / 60000));
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(isoDate).toLocaleDateString();
  };

  // Solid recommended & popular Xonddit chats
  const recommendedChats = React.useMemo(() => {
    return [...feedPosts]
      .sort((a, b) => {
        const scoreA = (a.score || 0) * 2 + (a.commentCount || 0) * 3;
        const scoreB = (b.score || 0) * 2 + (b.commentCount || 0) * 3;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, 8);
  }, [feedPosts]);

  // Map latest comment per post for live chat preview
  const latestCommentByPost = React.useMemo(() => {
    const map = new Map<string, Comment>();
    for (const c of recentComments) {
      const existing = map.get(c.postId);
      if (!existing || new Date(c.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
        map.set(c.postId, c);
      }
    }
    return map;
  }, [recentComments]);

  // Update live suggestions when deferred query changes (keeps input INP at 0ms)
  useEffect(() => {
    if (deferredQuery.trim()) {
      setSuggestions(searchService.getSuggestions(deferredQuery, 6));
    } else {
      setSuggestions([]);
    }
  }, [deferredQuery]);

  const handleToggleSaveSearch = (q: string) => {
    const clean = q.trim();
    if (!clean) return;
    searchService.toggleSavedSearch(clean);
    setSavedSearches(searchService.getSavedSearches());
  };

  useEffect(() => {
    if (activeQuery.trim()) {
      setIsSearching(true);
      executeSearch(activeQuery, sourceFilter, filterType, sort);
    } else {
      setResultsResponse(null);
      setAiAnswer(null);
    }
  }, [activeQuery, sourceFilter, filterType, sort]);

  const executeSearch = (
    q: string,
    src: SearchSourceFilter,
    type: SearchContentType,
    s: SearchSort
  ) => {
    searchService.addRecentSearch(q);
    setRecentSearches(searchService.getRecentSearches());

    const response = searchService.search({
      query: q,
      source: src,
      type,
      sort: s,
      page: 1,
      pageSize: 30,
    });

    setResultsResponse(response);
    setIsSearching(false);

    // 1. Immediate grounded extractive community synthesis (0ms latency)
    const localGrounded = buildExtractiveGroundedAnswer(
      q,
      searchService.getAllIndexedPosts(),
      searchService.getAllIndexedComments()
    );
    setAiAnswer(localGrounded);

    // 2. Async server-side Gemini RAG upgrade (if GEMINI_API_KEY configured on server)
    fetch('/api/search/ai-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: GroundedAiAnswerResponse | null) => {
        if (data && data.query === q && data.answer) {
          setAiAnswer(data);
        }
      })
      .catch(() => {
        // Keep local grounded extractive answer
      });
  };

  const runDirectQuery = (newQuery: string) => {
    const clean = newQuery.trim();
    if (!clean) return;
    setShowSuggestions(false);
    if (onSelectTopicSlug && activeTopicSlug) {
      onSelectTopicSlug(undefined);
    }
    setQuery(clean);
    setActiveQuery(clean);
    if (onSwitchApp) {
      onSwitchApp('xongle', { q: clean });
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    runDirectQuery(query.trim());
  };

  const handleSuggestionClick = (s: SearchSuggestion) => {
    setShowSuggestions(false);
    if (s.kind === 'app' && s.targetApp && onSwitchApp) {
      onSwitchApp(s.targetApp);
    } else if (s.kind === 'community' && s.communitySlug) {
      onNavigateToXonddit({ communitySlug: s.communitySlug });
    } else if (s.kind === 'post' && s.postId) {
      onNavigateToXonddit({ postId: s.postId, communitySlug: s.communitySlug });
    } else {
      runDirectQuery(s.label);
    }
  };

  const renderHighlightedText = (text: string, queryStr: string) => {
    if (!queryStr.trim()) return text;
    const tokens = queryStr
      .toLowerCase()
      .replace(/^c\//, '')
      .split(/\s+/)
      .filter((t) => t.length > 1);
    if (tokens.length === 0) return text;
    const regex = new RegExp(
      `(${tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
      'gi'
    );
    const parts = text.split(regex);

    return (
      <>
        {parts.map((part, i) =>
          tokens.includes(part.toLowerCase()) ? (
            <span key={i} className="font-bold text-neutral-900 bg-yellow-200 px-0.5 rounded-xs">
              {part}
            </span>
          ) : (
            part
          )
        )}
      </>
    );
  };

  const renderSuggestionsDropdown = () => {
    const visible = showSuggestions && Boolean(query.trim()) && suggestions.length > 0;
    if (!visible) return null;
    return (
      <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-neutral-200 rounded-2xl shadow-xl z-50 overflow-hidden py-1.5">
        {suggestions.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => handleSuggestionClick(s)}
            className="w-full px-4 py-2 text-left hover:bg-neutral-100 flex items-center justify-between gap-3 cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {s.kind === 'community' ? (
                <Users size={15} className="text-orange-600 shrink-0" />
              ) : s.kind === 'post' ? (
                <FileText size={15} className="text-blue-600 shrink-0" />
              ) : (
                <Clock size={15} className="text-neutral-400 shrink-0" />
              )}
              <div className="truncate">
                <div className="text-xs sm:text-sm font-medium text-neutral-900 truncate">
                  {s.label}
                </div>
                {s.sublabel && (
                  <div className="text-[11px] text-neutral-500 truncate">{s.sublabel}</div>
                )}
              </div>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 shrink-0">
              {s.kind === 'community' ? 'Open c/' : s.kind === 'post' ? 'Open Post' : 'Search'}
            </span>
          </button>
        ))}
      </div>
    );
  };

  // -------------------------------------------------------------
  // VIEW 0: TOPIC HUB PAGE (/topics/:slug)
  // -------------------------------------------------------------
  if (activeTopicHub && !activeQuery) {
    const hubContext = retrieveGroundedCommunityContext(
      `${activeTopicHub.titleUz} ${activeTopicHub.keywords.join(' ')}`,
      feedPosts,
      recentComments,
      10
    );

    return (
      <div className="min-h-screen bg-white text-neutral-900 flex flex-col font-sans">
        <header className="border-b border-neutral-200 bg-white sticky top-0 z-30 px-4 sm:px-8 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <a
                href="/"
                onClick={(e) => {
                  if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                    e.preventDefault();
                    if (onSelectTopicSlug) onSelectTopicSlug(undefined);
                  }
                }}
                className="flex items-center gap-2 font-bold text-xl tracking-tighter cursor-pointer"
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
              <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-md">
                Mavzu Markazi (Topic Hub)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigateToXonddit()}
                className="px-3 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <XondditLogo size={14} />
                <span>Xonddit</span>
              </button>
              {renderUserAvatarWidget()}
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-8 py-8 space-y-8">
          <nav aria-label="Breadcrumb" className="text-xs text-neutral-500 flex items-center gap-2">
            <a
              href="/"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                  e.preventDefault();
                  if (onSelectTopicSlug) onSelectTopicSlug(undefined);
                }
              }}
              className="text-blue-600 hover:underline font-medium"
            >
              Xongle Bosh Sahifa
            </a>
            <span>&rsaquo;</span>
            <span className="text-neutral-800 font-semibold">{activeTopicHub.titleUz}</span>
          </nav>

          <section className="p-6 rounded-2xl border border-neutral-200 bg-neutral-50/70 space-y-4">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-100/80 text-blue-800 text-xs font-semibold">
              <BookOpen size={13} />
              <span>Xongle Tasdiqlangan Mavzu Arxivi · /topics/{activeTopicHub.slug}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">
              {activeTopicHub.titleUz}
            </h1>
            <p className="text-sm sm:text-base text-neutral-700 leading-relaxed">
              {activeTopicHub.descriptionUz}
            </p>
            <p className="text-xs text-neutral-500 leading-relaxed">
              {activeTopicHub.descriptionEn}
            </p>

            {/* Related Communities & Quick Searches */}
            <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-neutral-700">Tegishli jamoalar:</span>
              {activeTopicHub.communitySlugs.map((cSlug) => (
                <a
                  key={cSlug}
                  href={`/c/${cSlug}`}
                  onClick={(e) => {
                    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                      e.preventDefault();
                      onNavigateToXonddit({ communitySlug: cSlug });
                    }
                  }}
                  className="px-2.5 py-1 rounded-md bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 font-mono font-semibold"
                >
                  c/{cSlug}
                </a>
              ))}
            </div>

            <div className="pt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-neutral-700">Tezkor AI qidiruv:</span>
              {activeTopicHub.featuredQueries.map((fq) => (
                <button
                  key={fq}
                  type="button"
                  onClick={() => runDirectQuery(fq)}
                  className="px-3 py-1 rounded-md bg-white hover:bg-blue-50 border border-neutral-300 hover:border-blue-300 text-neutral-800 font-medium cursor-pointer"
                >
                  {fq}
                </button>
              ))}
            </div>
          </section>

          {/* Verified Discussions in this Topic Hub */}
          <section className="space-y-4" aria-label="Topic Discussions">
            <h2 className="text-lg font-bold text-neutral-900">
              Ushbu mavzudagi eng foydali muhokamalar va yechimlar ({hubContext.rankedPosts.length})
            </h2>

            <div className="space-y-4">
              {hubContext.rankedPosts.map(({ post, topComments }) => (
                <article
                  key={post.id}
                  onClick={() =>
                    onNavigateToXonddit({
                      postId: post.id,
                      communitySlug: post.communitySlug,
                    })
                  }
                  className="p-5 rounded-xl border border-neutral-200 hover:border-blue-400 bg-white cursor-pointer space-y-3"
                >
                  <div className="flex items-center gap-2 text-xs text-neutral-500 flex-wrap">
                    <span className="font-mono font-semibold text-orange-600">
                      c/{post.communitySlug}
                    </span>
                    <span>·</span>
                    <span>Muallif: u/{post.authorName.replace(/^u\//, '')}</span>
                    <span>·</span>
                    <span className="font-semibold text-neutral-700">{post.score} ball</span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-blue-700 hover:underline">
                    {post.title}
                  </h3>

                  {post.body && (
                    <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed whitespace-pre-line line-clamp-4">
                      {post.body}
                    </p>
                  )}

                  {topComments.length > 0 && (
                    <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200 text-xs text-neutral-700 space-y-1">
                      <div className="font-semibold text-neutral-900 flex items-center gap-1.5">
                        <CheckCircle2 size={13} className="text-emerald-600" />
                        <span>
                          Eng ko‘p ovoz olgan javob (u/{topComments[0].authorName.replace(/^u\//, '')} · +{topComments[0].score}):
                        </span>
                      </div>
                      <p className="leading-relaxed">"{topComments[0].content}"</p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>

          {/* Other Topic Hubs */}
          <section className="pt-4 border-t border-neutral-200 space-y-3">
            <h2 className="text-sm font-bold text-neutral-800">
              Boshqa O‘zbekcha Mavzu Markazlari (Topic Hubs)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {CURATED_TOPIC_HUBS.filter((h) => h.slug !== activeTopicHub.slug).map((hub) => (
                <a
                  key={hub.slug}
                  href={`/topics/${hub.slug}`}
                  onClick={(e) => {
                    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                      e.preventDefault();
                      if (onSelectTopicSlug) onSelectTopicSlug(hub.slug);
                    }
                  }}
                  className="p-3 rounded-lg border border-neutral-200 hover:border-blue-300 bg-neutral-50/60 hover:bg-blue-50/30 font-semibold text-neutral-800 flex items-center justify-between"
                >
                  <span>{hub.titleUz}</span>
                  <ArrowUpRight size={14} className="text-blue-600 shrink-0" />
                </a>
              ))}
            </div>
          </section>
        </main>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 1: XONGLE SEARCH RESULTS PAGE
  // -------------------------------------------------------------
  if (activeQuery) {
    const counts = resultsResponse?.countsByType || {
      all: 0,
      post: 0,
      community: 0,
      comment: 0,
    };

    return (
      <div className="min-h-screen bg-white text-neutral-900 flex flex-col font-sans">
        {/* Results Top Header Bar */}
        <header className="border-b border-neutral-200 bg-white sticky top-0 z-30 px-3 sm:px-6 pt-2.5 shadow-2xs shrink-0">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-3 pb-2.5">
            {/* Logo and Mobile App Switchers */}
            <div className="flex items-center justify-between w-full md:w-auto">
              <button
                onClick={() => {
                  setActiveQuery('');
                  setQuery('');
                  setResultsResponse(null);
                  setAiAnswer(null);
                  if (onSwitchApp) onSwitchApp('xongle');
                }}
                className="flex items-center gap-2 font-bold text-2xl tracking-tighter select-none cursor-pointer group"
              >
                <XongleLogo size={32} />
                <div className="flex items-center">
                  <span className="text-[#4285F4]">X</span>
                  <span className="text-[#EA4335]">o</span>
                  <span className="text-[#FBBC05]">n</span>
                  <span className="text-[#4285F4]">g</span>
                  <span className="text-[#34A853]">l</span>
                  <span className="text-[#EA4335]">e</span>
                </div>
              </button>

              <div className="flex items-center gap-1.5 md:hidden">
                <button
                  onClick={() => onNavigateToXonddit()}
                  className="px-2.5 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-200 text-xs font-medium cursor-pointer"
                >
                  Xonddit
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <form
              ref={searchBoxRef}
              onSubmit={handleSearchSubmit}
              className="flex-1 w-full max-w-2xl relative"
            >
              <div className="relative flex items-center bg-white border border-neutral-200 hover:shadow-md focus-within:shadow-md rounded-full px-4 py-2">
                <Search size={18} className="text-neutral-400 mr-2.5 shrink-0" />
                <input
                  type="text"
                  value={query}
                  onFocus={() => setShowSuggestions(true)}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  placeholder="O‘zbek yoki ingliz tilida savol yozing (masalan: Linux qanday o‘rganiladi)..."
                  className="w-full text-sm sm:text-base text-neutral-900 placeholder-neutral-400 focus:outline-hidden bg-transparent"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="p-1 text-neutral-400 hover:text-neutral-700 cursor-pointer mr-2"
                  >
                    <X size={16} />
                  </button>
                )}
                <div className="flex items-center pl-2 border-l border-neutral-200 text-neutral-500">
                  <button
                    type="submit"
                    className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full cursor-pointer"
                    aria-label="Search"
                  >
                    <Search size={13} />
                  </button>
                </div>
              </div>
              {renderSuggestionsDropdown()}
            </form>

            {/* Right Side Navigation Tools */}
            <div className="hidden md:flex items-center gap-2.5 shrink-0">
              {isOwner && (
                <button
                  onClick={onOpenOwnerPanel}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-semibold text-xs cursor-pointer"
                  title="Open Owner Panel"
                >
                  <Crown size={13} className="text-amber-600" />
                  <span>Owner</span>
                </button>
              )}
              <button
                onClick={() => onNavigateToXonddit()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 font-semibold text-xs cursor-pointer"
              >
                <XondditLogo size={15} />
                <span>Xonddit</span>
              </button>
              {renderUserAvatarWidget()}
            </div>
          </div>

          {/* Filter & Sort Sub-bar */}
          <div className="max-w-7xl mx-auto md:pl-32 flex items-center justify-between gap-4 overflow-x-auto no-scrollbar text-xs">
            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'all', label: 'All', count: counts.all },
                  { id: 'post', label: 'Posts', count: counts.post },
                  { id: 'community', label: 'Communities', count: counts.community },
                  { id: 'comment', label: 'Comments', count: counts.comment },
                ] as { id: SearchContentType; label: string; count: number }[]
              ).map((tab) => {
                const active = filterType === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterType(tab.id)}
                    className={`relative flex items-center gap-1.5 px-3 py-2 font-medium whitespace-nowrap cursor-pointer ${
                      active
                        ? 'text-blue-600 font-semibold'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        active ? 'bg-blue-50 text-blue-700' : 'bg-neutral-100 text-neutral-500'
                      }`}
                    >
                      {tab.count}
                    </span>
                    {active && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5 py-1.5 shrink-0">
              <SlidersHorizontal size={12} className="text-neutral-400" />
              <span className="text-neutral-500 hidden sm:inline">Sort:</span>
              {(['relevance', 'top', 'newest'] as SearchSort[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSort(s)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium capitalize cursor-pointer ${
                    sort === s
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Scrollable Results Body */}
        <div className="flex-1">
          <main className="max-w-3xl mx-auto px-4 sm:px-6 py-5 w-full md:ml-32 pb-24">
            {/* Metadata Count & Save Search Action */}
            {resultsResponse && (
              <div className="text-xs text-neutral-500 mb-4 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
                  <div>
                    About{' '}
                    <span className="font-semibold text-neutral-800">
                      {resultsResponse.totalCount}
                    </span>{' '}
                    results on <span className="font-medium text-neutral-700">Xonddit</span> (
                    {resultsResponse.executionTimeMs} ms)
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleSaveSearch(activeQuery)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium cursor-pointer shadow-2xs hover:shadow-xs ${
                      savedSearches.some(
                        (s) => s.toLowerCase() === activeQuery.toLowerCase().trim()
                      )
                        ? 'bg-amber-100 hover:bg-amber-200/80 text-amber-900 border border-amber-300 font-semibold'
                        : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-300 hover:border-neutral-400'
                    }`}
                  >
                    <Bookmark
                      size={12}
                      className={
                        savedSearches.some(
                          (s) => s.toLowerCase() === activeQuery.toLowerCase().trim()
                        )
                          ? 'fill-amber-600 text-amber-600'
                          : 'text-neutral-500'
                      }
                    />
                    <span>
                      {savedSearches.some(
                        (s) => s.toLowerCase() === activeQuery.toLowerCase().trim()
                      )
                        ? 'Saved'
                        : 'Save Search'}
                    </span>
                  </button>
                </div>
                <div className="text-[11px] text-blue-600 font-mono">🔒 Xonddit Live Index</div>
              </div>
            )}

            {/* ========================================================= */}
            {/* XONGLE AI ANSWER ENGINE (GROUNDED IN COMMUNITY THREADS)   */}
            {/* ========================================================= */}
            {aiAnswer && (
              <section
                aria-label="Xongle AI Community Answer"
                className="mb-6 p-4 sm:p-5 rounded-2xl border border-blue-200 bg-blue-50/40 space-y-3.5"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-600 text-white text-xs font-bold">
                      <Sparkles size={12} />
                      <span>Xongle AI Xulosasi</span>
                    </span>
                    <span className="text-xs text-neutral-600 font-medium">
                      Haqiqiy Xonddit jamoasi muhokamalari asosida
                    </span>
                  </div>
                  {aiAnswer.matchedTopicHub && (
                    <a
                      href={aiAnswer.matchedTopicHub.url}
                      onClick={(e) => {
                        if (
                          !e.metaKey &&
                          !e.ctrlKey &&
                          !e.shiftKey &&
                          !e.altKey &&
                          e.button === 0 &&
                          onSelectTopicSlug
                        ) {
                          e.preventDefault();
                          setActiveQuery('');
                          onSelectTopicSlug(aiAnswer.matchedTopicHub!.slug);
                        }
                      }}
                      className="text-xs font-semibold text-blue-700 hover:underline flex items-center gap-1"
                    >
                      <span>Mavzu markazi: {aiAnswer.matchedTopicHub.title}</span>
                      <ArrowUpRight size={12} />
                    </a>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-neutral-800 leading-relaxed font-medium">
                  {aiAnswer.answer}
                </p>

                {aiAnswer.keyPoints.length > 0 && (
                  <ul className="space-y-1.5 text-xs sm:text-sm text-neutral-700 list-disc pl-5">
                    {aiAnswer.keyPoints.map((pt, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {pt}
                      </li>
                    ))}
                  </ul>
                )}

                {aiAnswer.citations.length > 0 && (
                  <div className="pt-2 border-t border-blue-200/70 space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-600">
                      Foydalanilgan Xonddit Manbalari ({aiAnswer.citations.length}):
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {aiAnswer.citations.map((cit) => (
                        <button
                          key={cit.postId}
                          type="button"
                          onClick={() =>
                            onNavigateToXonddit({
                              postId: cit.postId,
                              communitySlug: cit.communitySlug,
                            })
                          }
                          className="p-2.5 rounded-xl bg-white hover:bg-blue-50/60 border border-neutral-200 hover:border-blue-300 text-left flex flex-col justify-between gap-1 cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px] text-neutral-500">
                            <span className="font-mono font-bold text-orange-600">
                              c/{cit.communitySlug}
                            </span>
                            <span className="tabular-nums">
                              +{cit.score} · {cit.commentCount} izoh
                            </span>
                          </div>
                          <div className="text-xs font-semibold text-blue-700 line-clamp-1">
                            {cit.title}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {aiAnswer.relatedQuestions.length > 0 && (
                  <div className="pt-2 border-t border-blue-200/70 flex items-center gap-1.5 flex-wrap text-xs">
                    <span className="text-neutral-600 font-semibold flex items-center gap-1">
                      <HelpCircle size={12} />
                      <span>O‘xshash savollar:</span>
                    </span>
                    {aiAnswer.relatedQuestions.map((rq) => (
                      <button
                        key={rq}
                        type="button"
                        onClick={() => runDirectQuery(rq)}
                        className="px-2.5 py-0.5 rounded-md bg-white hover:bg-blue-100 border border-neutral-200 text-neutral-700 cursor-pointer"
                      >
                        {rq}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}

            {isSearching ? (
              <div className="space-y-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-3 w-56 bg-neutral-200 rounded-sm" />
                    <div className="h-5 w-72 bg-neutral-300 rounded-sm" />
                    <div className="h-4 w-full bg-neutral-100 rounded-sm" />
                  </div>
                ))}
              </div>
            ) : resultsResponse && resultsResponse.results.length === 0 ? (
              <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-8 sm:p-12 text-center max-w-lg mx-auto space-y-4">
                <div className="w-12 h-12 rounded-full bg-white border border-neutral-200 mx-auto flex items-center justify-center text-neutral-500 shadow-xs">
                  <Search size={24} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-neutral-900">
                    No matching content found
                  </h2>
                  <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
                    No {filterType === 'all' ? 'results' : `${filterType}s`} matched{' '}
                    <span className="font-mono text-neutral-800">"{activeQuery}"</span> on Xonddit.
                  </p>
                </div>

                <div className="text-left bg-white p-4 rounded-xl border border-neutral-200 text-xs text-neutral-600 space-y-1.5 shadow-xs">
                  <span className="font-semibold text-neutral-800 block mb-1">
                    Search suggestions:
                  </span>
                  <p>• Switch filter to "All" to search across posts, communities, and comments.</p>
                  <p>• Try broader keywords in Uzbek (Latin or Cyrillic) or English.</p>
                  <p>• Browse or start a new discussion directly on Xonddit.</p>
                </div>

                <div className="flex items-center justify-center gap-2 pt-2">
                  {filterType !== 'all' && (
                    <button
                      onClick={() => setFilterType('all')}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs cursor-pointer"
                    >
                      Show All Types
                    </button>
                  )}
                  <button
                    onClick={() => onNavigateToXonddit()}
                    className="px-4 py-2 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 font-semibold text-xs cursor-pointer"
                  >
                    Go to Xonddit →
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {resultsResponse?.results.map((item) => {
                  const handleItemClick = () => {
                    if (item.type === 'community' && item.communitySlug) {
                      onNavigateToXonddit({ communitySlug: item.communitySlug });
                    } else if (item.targetPostId) {
                      onNavigateToXonddit({
                        postId: item.targetPostId,
                        communitySlug: item.communitySlug,
                      });
                    } else {
                      onNavigateToXonddit({ postId: item.id.replace('xonddit-post-', '') });
                    }
                  };

                  return (
                    <article
                      key={item.id}
                      onClick={handleItemClick}
                      className="group cursor-pointer p-3 -mx-3 rounded-xl hover:bg-neutral-50 border border-transparent hover:border-neutral-200"
                    >
                      {/* Platform Source Breadcrumb & Badge */}
                      <div className="flex items-center gap-2 text-xs mb-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 font-semibold text-[11px]">
                          <XondditLogo size={13} />
                          <span>Xonddit</span>
                        </span>

                        <span className="text-neutral-400">›</span>

                        {item.communitySlug && (
                          <span className="font-mono text-neutral-700 font-medium">
                            c/{item.communitySlug}
                          </span>
                        )}

                        <span className="text-neutral-300">·</span>
                        <span className="text-neutral-500 capitalize">{item.type}</span>

                        {item.flair && (
                          <span className="px-2 py-0.2 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200 text-[10px] font-medium">
                            {item.flair}
                          </span>
                        )}
                      </div>

                      {/* Result Title */}
                      <h3 className="text-base sm:text-lg font-normal leading-snug mb-1">
                        <span className="text-[#1a0dab] group-hover:underline text-left">
                          {item.title}
                        </span>
                      </h3>

                      {/* Snippet */}
                      <p className="text-sm text-[#4d5156] leading-relaxed mb-2 font-normal">
                        {renderHighlightedText(item.snippet, activeQuery)}
                      </p>

                      {/* Media preview if available */}
                      {item.mediaUrl && (
                        <div className="mb-2 max-w-sm rounded-lg overflow-hidden border border-neutral-200 max-h-48 bg-neutral-100">
                          <img
                            src={item.mediaUrl}
                            alt="Result preview"
                            className="w-full h-auto max-h-48 object-cover"
                            loading="lazy"
                            decoding="async"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}

                      {/* Footer Metadata & Platform Stats */}
                      <div className="flex items-center flex-wrap gap-3 text-xs text-[#70757a]">
                        {item.authorName && (
                          <span>
                            By <span className="font-semibold text-neutral-700">{item.authorName}</span>
                          </span>
                        )}

                        {item.score !== undefined && (
                          <span>
                            • <span className="font-semibold text-neutral-700">{item.score}</span>{' '}
                            {item.type === 'community' ? 'posts' : 'points'}
                          </span>
                        )}
                        {item.commentCount !== undefined && (
                          <span className="inline-flex items-center gap-1">
                            • <MessageSquare size={11} /> {item.commentCount} comments
                          </span>
                        )}

                        <span>• {new Date(item.createdAt).toLocaleDateString()}</span>

                        <span className="ml-auto text-blue-600 font-medium group-hover:underline inline-flex items-center gap-1">
                          <span>Open in Xonddit</span>
                          <ExternalLink size={11} />
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: XONGLE HOMEPAGE
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-white text-neutral-800 flex flex-col font-sans select-none">
      {/* Top Header - Platform Links & Profile */}
      <header className="p-3 sm:px-8 flex justify-between items-center text-xs">
        <nav aria-label="Xongle Primary Links" className="flex items-center gap-3 text-neutral-600 font-medium">
          <a
            href="/about"
            onClick={(e) => {
              if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0 && onSwitchApp) {
                e.preventDefault();
                onSwitchApp('about');
              }
            }}
            className="opacity-0 pointer-events-auto cursor-pointer select-none"
          >
            About Xongle
          </a>
          <a
            href="/?app=xonddit"
            onClick={(e) => {
              if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                e.preventDefault();
                onNavigateToXonddit();
              }
            }}
            className="opacity-0 pointer-events-auto cursor-pointer select-none"
          >
            Xonddit
          </a>
        </nav>

        <div className="flex items-center gap-2.5">
          {isOwner && (
            <button
              onClick={onOpenOwnerPanel}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-semibold text-xs cursor-pointer"
              title="Open Owner Panel"
            >
              <Crown size={13} className="text-amber-600" />
              <span>Owner</span>
            </button>
          )}
          {renderUserAvatarWidget()}
        </div>
      </header>

      {/* Main Content Canvas - Search Moved Higher + Solid Recommendations Below */}
      <main className="flex-1 flex flex-col items-center px-4 sm:px-6 pt-3 sm:pt-8 pb-20 max-w-3xl mx-auto w-full">
        {/* Xongle Logo & Wordmark */}
        <div className="mb-4 sm:mb-5 text-center flex flex-col items-center">
          <div className="mb-2">
            <XongleLogo size={56} />
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight flex items-center justify-center select-none">
            <span className="text-[#4285F4]">X</span>
            <span className="text-[#EA4335]">o</span>
            <span className="text-[#FBBC05]">n</span>
            <span className="text-[#4285F4]">g</span>
            <span className="text-[#34A853]">l</span>
            <span className="text-[#EA4335]">e</span>
          </h1>
          <p className="sr-only">
            Official real-time search engine at{' '}
            <a href="https://xongle.xyz/">
              xongle.xyz
            </a>{' '}
            for public Xonddit communities, Uzbek Q&amp;A threads, and AI-grounded discussions.
          </p>
        </div>

        {/* Search Input Box */}
        <form
          ref={searchBoxRef}
          onSubmit={handleSearchSubmit}
          className="w-full max-w-xl relative mb-5"
        >
          <div className="relative flex items-center bg-white border border-neutral-200 hover:border-neutral-300 hover:shadow-lg focus-within:shadow-xl focus-within:border-blue-500/80 rounded-full px-4 py-3 group">
            <Search
              size={18}
              className="text-neutral-400 group-focus-within:text-blue-600 mr-3 shrink-0"
            />
            <input
              type="text"
              value={query}
              onFocus={() => setShowSuggestions(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
              }}
              placeholder="Search Xonddit..."
              className="w-full text-sm sm:text-base text-neutral-900 placeholder-neutral-400 focus:outline-hidden bg-transparent"
              autoFocus
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="p-1 text-neutral-400 hover:text-neutral-700 cursor-pointer mr-1"
              >
                <X size={16} />
              </button>
            )}
          </div>
          {renderSuggestionsDropdown()}
        </form>

        {/* Crawlable Uzbek & Tech Topic Hubs Directory (kept in DOM via sr-only and moved visibly to /about) */}
        <section
          aria-label="O‘zbekcha Mavzular va Savol-Javob Yo‘nalishlari"
          className="sr-only"
        >
          <div>
            <span>
              Dolzarb Mavzular va AI Javoblar (Topic Hubs)
            </span>
            <a
              href="/?app=xonddit"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                  e.preventDefault();
                  onNavigateToXonddit();
                }
              }}
            >
              Barcha c/ jamoalar &rarr;
            </a>
          </div>
          <div>
            {CURATED_TOPIC_HUBS.map((hub) => (
              <a
                key={hub.slug}
                href={`/topics/${hub.slug}`}
                onClick={(e) => {
                  if (
                    !e.metaKey &&
                    !e.ctrlKey &&
                    !e.shiftKey &&
                    !e.altKey &&
                    e.button === 0 &&
                    onSelectTopicSlug
                  ) {
                    e.preventDefault();
                    onSelectTopicSlug(hub.slug);
                  }
                }}
                title={hub.titleUz}
              >
                {hub.titleUz.split('—')[0].trim()}
              </a>
            ))}
          </div>
        </section>

        {/* Solid Recommended Xonddit Chats */}
        <section className="w-full max-w-xl" aria-label="Popular Xonddit Discussions">
          {loadingFeed ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <div
                  key={n}
                  className="p-4 rounded-xl border border-neutral-200 bg-white space-y-2.5"
                >
                  <div className="h-3 w-36 bg-neutral-200 rounded-sm" />
                  <div className="h-4 w-5/6 bg-neutral-300 rounded-sm" />
                  <div className="h-3 w-full bg-neutral-100 rounded-sm" />
                  <div className="h-3 w-24 bg-neutral-200 rounded-sm" />
                </div>
              ))}
            </div>
          ) : recommendedChats.length > 0 ? (
            <div className="flex flex-col gap-3">
              {recommendedChats.map((post) => {
                const latestComment = latestCommentByPost.get(post.id);
                return (
                  <article
                    key={post.id}
                    onClick={() =>
                      onNavigateToXonddit({
                        postId: post.id,
                        communitySlug: post.communitySlug,
                      })
                    }
                    style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 132px' }}
                    className="group p-4 rounded-xl border border-neutral-200 hover:border-blue-300/80 bg-white hover:bg-neutral-50/70 hover:shadow-md cursor-pointer flex flex-col justify-between gap-2.5"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs text-neutral-500 flex-wrap">
                        <a
                          href={`/c/${post.communitySlug}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                              e.preventDefault();
                              onNavigateToXonddit({ communitySlug: post.communitySlug });
                            }
                          }}
                          className="font-mono font-semibold text-orange-600 hover:text-orange-700 hover:underline cursor-pointer"
                        >
                          c/{post.communitySlug}
                        </a>
                        <span aria-hidden="true">·</span>
                        <span className="truncate max-w-[140px]">u/{post.authorName}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{formatRelativeTime(post.createdAt)}</span>
                      </div>

                      <h3 className="text-sm sm:text-base font-semibold text-neutral-900 group-hover:text-blue-600 line-clamp-2 leading-snug">
                        <a
                          href={`/discussions/${post.id}`}
                          onClick={(e) => {
                            if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                              e.preventDefault();
                            }
                          }}
                        >
                          {post.title}
                        </a>
                      </h3>

                      {latestComment ? (
                        <div className="pt-0.5 text-xs text-neutral-600 line-clamp-2 leading-relaxed">
                          <span className="font-semibold text-neutral-800">
                            u/{latestComment.authorName}:
                          </span>{' '}
                          "{latestComment.content}"
                        </div>
                      ) : post.body ? (
                        <p className="text-xs text-neutral-600 line-clamp-2 leading-relaxed">
                          {post.body}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-neutral-100 text-xs text-neutral-500 tabular-nums">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1 font-medium text-neutral-700">
                          <Flame size={13} className="text-orange-500" />
                          <span>{post.score}</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare size={13} className="text-neutral-400" />
                          <span>{post.commentCount || 0}</span>
                        </span>
                      </div>

                      <ArrowUpRight
                        size={14}
                        className="text-neutral-400 group-hover:text-blue-600"
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>
      </main>

      {/* Official Identity & Internal Link Footer (visually hidden on homepage, visible on /about) */}
      <footer className="sr-only">
        <div>
          <div>
            <strong>Xongle</strong> (
            <a href="https://xongle.xyz/">
              https://xongle.xyz/
            </a>
            ) — Real-time community &amp; discussion search engine for Xonddit.
          </div>
          <nav aria-label="Footer Navigation">
            <a
              href="/about"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0 && onSwitchApp) {
                  e.preventDefault();
                  onSwitchApp('about');
                }
              }}
            >
              About Xongle &amp; FAQ
            </a>
            <a
              href="/?app=xonddit"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                  e.preventDefault();
                  onNavigateToXonddit();
                }
              }}
            >
              Xonddit Communities
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
};
