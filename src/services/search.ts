import {
  Post,
  Community,
  Comment,
  SearchResultItem,
  SearchContentType,
  SearchSourceFilter,
  SearchSort,
  SupportedApp,
} from '../types';
import {
  BASELINE_PUBLIC_COMMUNITIES,
  BASELINE_PUBLIC_POSTS,
  BASELINE_PUBLIC_COMMENTS,
  analyzeAndExpandQuery,
  scoreUzbekAwareMatch,
  normalizeUzbekSearchText,
} from '../seo/uzbekSearch';

export interface SearchOptions {
  query: string;
  source?: SearchSourceFilter;
  type?: SearchContentType;
  sort?: SearchSort;
  page?: number;
  pageSize?: number;
}

export interface SearchResponse {
  results: SearchResultItem[];
  totalCount: number;
  countsBySource: {
    xonddit: number;
  };
  countsByType: {
    all: number;
    post: number;
    community: number;
    comment: number;
  };
  query: string;
  executionTimeMs: number;
}

export interface SearchSuggestion {
  id: string;
  kind: 'app' | 'community' | 'post' | 'recent';
  label: string;
  sublabel?: string;
  communitySlug?: string;
  postId?: string;
  targetApp?: SupportedApp;
  prompt?: string;
}

class SearchService {
  private indexedPosts = new Map<string, Post>();
  private indexedCommunities = new Map<string, Community>();
  private indexedComments = new Map<string, Comment>();
  private searchCache = new Map<string, SearchResponse>();

  constructor() {
    // Seed baseline public communities, discussions, and comments so Uzbek/English search is always rich
    for (const c of BASELINE_PUBLIC_COMMUNITIES) {
      this.indexedCommunities.set(c.id, c);
    }
    for (const p of BASELINE_PUBLIC_POSTS) {
      this.indexedPosts.set(p.id, p);
    }
    for (const cm of BASELINE_PUBLIC_COMMENTS) {
      this.indexedComments.set(cm.id, cm);
    }

    if (typeof window !== 'undefined') {
      const storedRecent = localStorage.getItem('xongle_recent_searches');
      if (!storedRecent) {
        localStorage.setItem('xongle_recent_searches', JSON.stringify([]));
      }
    }
  }

  public indexPostsBatch(posts: Post[]): void {
    this.searchCache.clear();
    for (const p of BASELINE_PUBLIC_POSTS) {
      if (!this.indexedPosts.has(p.id)) {
        this.indexedPosts.set(p.id, p);
      }
    }
    for (const p of posts) {
      this.indexedPosts.set(p.id, p);
    }
  }

  public indexPost(post: Post): void {
    if (!post?.id) return;
    this.searchCache.clear();
    this.indexedPosts.set(post.id, post);
  }

  public removePost(postId: string): void {
    if (!postId) return;
    this.searchCache.clear();
    this.indexedPosts.delete(postId);
  }

  public indexCommunitiesBatch(communities: Community[]): void {
    this.searchCache.clear();
    for (const c of BASELINE_PUBLIC_COMMUNITIES) {
      if (!this.indexedCommunities.has(c.id)) {
        this.indexedCommunities.set(c.id, c);
      }
    }
    for (const c of communities) {
      this.indexedCommunities.set(c.id, c);
    }
  }

  public indexCommunity(comm: Community): void {
    if (!comm?.id) return;
    this.searchCache.clear();
    this.indexedCommunities.set(comm.id, comm);
  }

  public indexCommentsBatch(comments: Comment[]): void {
    this.searchCache.clear();
    for (const cm of BASELINE_PUBLIC_COMMENTS) {
      if (!this.indexedComments.has(cm.id)) {
        this.indexedComments.set(cm.id, cm);
      }
    }
    for (const c of comments) {
      this.indexedComments.set(c.id, c);
    }
  }

  public indexComment(comment: Comment): void {
    if (!comment?.id) return;
    this.searchCache.clear();
    this.indexedComments.set(comment.id, comment);
  }

  public getAllIndexedPosts(): Post[] {
    return Array.from(this.indexedPosts.values());
  }

  public getAllIndexedComments(): Comment[] {
    return Array.from(this.indexedComments.values());
  }

  public getIndexedStats(): { posts: number; communities: number; comments: number } {
    return {
      posts: this.indexedPosts.size,
      communities: this.indexedCommunities.size,
      comments: this.indexedComments.size,
    };
  }

  public getSuggestions(rawQuery: string, maxResults = 7): SearchSuggestion[] {
    const q = rawQuery.trim().toLowerCase();
    const normQ = normalizeUzbekSearchText(rawQuery);
    const analysis = analyzeAndExpandQuery(rawQuery);
    const suggestions: SearchSuggestion[] = [];

    if (!q) {
      suggestions.push({
        id: 'app-xonddit-default',
        kind: 'app',
        label: 'Xonddit',
        sublabel: 'Open Xonddit — browse c/ communities, posts & discussions',
        targetApp: 'xonddit',
      });

      const recent = this.getRecentSearches().slice(0, 3);
      for (const r of recent) {
        suggestions.push({
          id: `recent-${r}`,
          kind: 'recent',
          label: r,
          sublabel: 'Recent search',
        });
      }
      for (const comm of Array.from(this.indexedCommunities.values()).slice(0, 3)) {
        if (suggestions.length >= maxResults) break;
        suggestions.push({
          id: `comm-${comm.id}`,
          kind: 'community',
          label: `c/${comm.slug}`,
          sublabel: `${comm.name} · ${comm.postCount} posts`,
          communitySlug: comm.slug,
        });
      }
      return suggestions.slice(0, maxResults);
    }

    // Direct platform app matches when user searches for Xonddit or Forum
    const matchesXonddit =
      'xonddit'.includes(normQ) ||
      normQ.includes('xonddit') ||
      normQ === 'xon' ||
      normQ.includes('reddit') ||
      normQ.includes('communit') ||
      normQ.includes('forum') ||
      normQ.includes('jamoa');

    if (matchesXonddit) {
      suggestions.push({
        id: 'app-xonddit',
        kind: 'app',
        label: 'Xonddit — Communities & Discussions',
        sublabel: 'Go directly to Xonddit front page and c/ communities',
        targetApp: 'xonddit',
      });
    }

    // Match communities using Uzbek-aware normalization
    for (const comm of this.indexedCommunities.values()) {
      const commScore = scoreUzbekAwareMatch(
        `${comm.slug} ${comm.name} ${comm.title} ${comm.description}`,
        analysis
      );
      if (
        comm.slug.toLowerCase().includes(normQ.replace(/^c\//, '')) ||
        commScore >= 4
      ) {
        suggestions.push({
          id: `comm-${comm.id}`,
          kind: 'community',
          label: `c/${comm.slug}`,
          sublabel: `${comm.name} — ${comm.title}`,
          communitySlug: comm.slug,
        });
      }
      if (suggestions.length >= 4) break;
    }

    // Match posts using Uzbek-aware normalization
    for (const post of this.indexedPosts.values()) {
      if (suggestions.length >= maxResults) break;
      const postScore = scoreUzbekAwareMatch(
        `${post.title} ${post.flair || ''}`,
        analysis
      );
      if (postScore >= 4) {
        suggestions.push({
          id: `post-${post.id}`,
          kind: 'post',
          label: post.title,
          sublabel: `c/${post.communitySlug} · ${post.score} points`,
          postId: post.id,
          communitySlug: post.communitySlug,
        });
      }
    }

    return suggestions.slice(0, maxResults);
  }

  public getRecentSearches(): string[] {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('xongle_recent_searches');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  public addRecentSearch(query: string): void {
    const q = query.trim();
    if (!q || typeof window === 'undefined') return;
    try {
      const recent = this.getRecentSearches().filter((s) => s.toLowerCase() !== q.toLowerCase());
      recent.unshift(q);
      localStorage.setItem('xongle_recent_searches', JSON.stringify(recent.slice(0, 8)));
    } catch {
      // Ignore
    }
  }

  public clearRecentSearches(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('xongle_recent_searches', JSON.stringify([]));
  }

  public getSavedSearches(): string[] {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('xongle_saved_searches');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  public toggleSavedSearch(query: string): boolean {
    const q = query.trim();
    if (!q || typeof window === 'undefined') return false;
    try {
      const saved = this.getSavedSearches();
      const existingIdx = saved.findIndex((s) => s.toLowerCase() === q.toLowerCase());
      if (existingIdx !== -1) {
        saved.splice(existingIdx, 1);
        localStorage.setItem('xongle_saved_searches', JSON.stringify(saved));
        return false;
      } else {
        saved.unshift(q);
        localStorage.setItem('xongle_saved_searches', JSON.stringify(saved.slice(0, 30)));
        return true;
      }
    } catch {
      return false;
    }
  }

  public isSavedSearch(query: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q || typeof window === 'undefined') return false;
    return this.getSavedSearches().some((s) => s.toLowerCase() === q);
  }

  public removeSavedSearch(query: string): void {
    const q = query.trim().toLowerCase();
    if (!q || typeof window === 'undefined') return;
    try {
      const saved = this.getSavedSearches().filter((s) => s.toLowerCase() !== q);
      localStorage.setItem('xongle_saved_searches', JSON.stringify(saved));
    } catch {
      // Ignore
    }
  }

  public clearSavedSearches(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('xongle_saved_searches', JSON.stringify([]));
    } catch {
      // Ignore
    }
  }

  public search(options: SearchOptions): SearchResponse {
    const startTime = performance.now();
    const cleanQuery = options.query.trim().toLowerCase();
    const filterType = options.type || 'all';
    const sort = options.sort || 'relevance';
    const page = options.page || 1;
    const pageSize = options.pageSize || 25;
    const cacheKey = `${cleanQuery}_type:${filterType}_sort:${sort}_p:${page}_sz:${pageSize}`;

    if (!cleanQuery) {
      return {
        results: [],
        totalCount: 0,
        countsBySource: { xonddit: 0 },
        countsByType: { all: 0, post: 0, community: 0, comment: 0 },
        query: options.query,
        executionTimeMs: 0,
      };
    }

    const cached = this.searchCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const analysis = analyzeAndExpandQuery(options.query);
    const queryTokens = analysis.coreTokens.length > 0 ? analysis.coreTokens : [analysis.normalizedLatin];

    const matchedItems: (SearchResultItem & { matchScore: number })[] = [];

    // 0. Official Platform Destination Results (Xonddit)
    const isXondditQuery =
      analysis.normalizedLatin.includes('xonddit') ||
      'xonddit'.includes(analysis.normalizedLatin) ||
      analysis.normalizedLatin === 'xon' ||
      analysis.normalizedLatin.includes('reddit') ||
      analysis.normalizedLatin.includes('communities') ||
      analysis.normalizedLatin.includes('community') ||
      analysis.normalizedLatin.includes('forum') ||
      analysis.normalizedLatin.includes('savol-javob') ||
      analysis.normalizedLatin.includes('feed');

    if (isXondditQuery) {
      const exactBoost =
        analysis.normalizedLatin.includes('xonddit') ||
        'xonddit'.startsWith(analysis.normalizedLatin)
          ? 1000
          : 45;
      matchedItems.push({
        id: 'platform-app-xonddit',
        source: 'xonddit',
        type: 'community',
        title: 'Xonddit — O‘zbekcha Forum, Ochiq Jamoalar (c/) va Savol-Javob Muhokamalari',
        snippet:
          'Xonddit platformasida c/ jamoalariga qo‘shiling, savol bering, postlar ulashing va real vaqtda muhokamalarda qatnashing.',
        url: '?app=xonddit',
        authorName: 'Xongle Platform',
        createdAt: new Date().toISOString(),
        score: this.indexedCommunities.size,
        commentCount: this.indexedComments.size,
        flair: 'Official App',
        communitySlug: 'xonddit',
        communityName: 'Xonddit',
        targetApp: 'xonddit',
        matchScore: exactBoost,
      });
    }

    // 1. Search Posts (Uzbek Latin + Cyrillic + Stem + Synonym aware)
    for (const post of this.indexedPosts.values()) {
      const titleMatch = scoreUzbekAwareMatch(post.title, analysis);
      const bodyMatch = scoreUzbekAwareMatch(post.body || '', analysis);
      const commMatch = scoreUzbekAwareMatch(
        `${post.communitySlug} ${post.communityName || ''}`,
        analysis
      );
      const flairMatch = scoreUzbekAwareMatch(post.flair || '', analysis);
      const authorMatch = scoreUzbekAwareMatch(post.authorName || '', analysis);

      const score =
        titleMatch * 5 + bodyMatch * 2 + commMatch * 2 + flairMatch * 2 + authorMatch * 1;
      if (score >= 3) {
        matchedItems.push({
          id: `xonddit-post-${post.id}`,
          source: 'xonddit',
          type: 'post',
          title: post.title,
          snippet: this.extractSnippet(post.body || post.title, queryTokens),
          url: `/discussions/${encodeURIComponent(post.id)}`,
          authorName: post.authorName,
          createdAt: post.createdAt,
          score: post.score,
          commentCount: post.commentCount,
          mediaUrl: post.imageUrl,
          flair: post.flair,
          targetPostId: post.id,
          communitySlug: post.communitySlug,
          communityName: post.communityName,
          matchScore: score + (post.score > 0 ? Math.log10(post.score + 1) * 2 : 0),
        });
      }
    }

    // 2. Search Communities
    for (const comm of this.indexedCommunities.values()) {
      const slugMatch = scoreUzbekAwareMatch(comm.slug, analysis);
      const nameMatch = scoreUzbekAwareMatch(comm.name, analysis);
      const titleMatch = scoreUzbekAwareMatch(comm.title, analysis);
      const descMatch = scoreUzbekAwareMatch(comm.description, analysis);

      const score = slugMatch * 6 + nameMatch * 5 + titleMatch * 4 + descMatch * 2;
      if (score >= 4) {
        matchedItems.push({
          id: `xonddit-comm-${comm.id}`,
          source: 'xonddit',
          type: 'community',
          title: `c/${comm.slug} — ${comm.name}: ${comm.title}`,
          snippet: comm.description || `Official Xonddit community c/${comm.slug}`,
          url: `/c/${encodeURIComponent(comm.slug)}`,
          authorName: comm.creatorName,
          createdAt: comm.createdAt,
          score: comm.postCount,
          communitySlug: comm.slug,
          communityName: comm.name,
          matchScore: score + 5,
        });
      }
    }

    // 3. Search Comments
    for (const comment of this.indexedComments.values()) {
      const contentMatch = scoreUzbekAwareMatch(comment.content, analysis);
      const authorMatch = scoreUzbekAwareMatch(comment.authorName || '', analysis);
      const score = contentMatch * 3 + authorMatch * 1;

      if (score >= 3) {
        const parentPost = this.indexedPosts.get(comment.postId);
        matchedItems.push({
          id: `xonddit-comment-${comment.id}`,
          source: 'xonddit',
          type: 'comment',
          title: parentPost
            ? `Javob / Izoh: "${parentPost.title}"`
            : `Comment by ${comment.authorName}`,
          snippet: this.extractSnippet(comment.content, queryTokens),
          url: `/discussions/${encodeURIComponent(comment.postId)}`,
          authorName: comment.authorName,
          createdAt: comment.createdAt,
          score: comment.score,
          targetPostId: comment.postId,
          communitySlug: parentPost?.communitySlug,
          matchScore: score,
        });
      }
    }

    const countsByType = {
      all: matchedItems.length,
      post: matchedItems.filter((i) => i.type === 'post').length,
      community: matchedItems.filter((i) => i.type === 'community').length,
      comment: matchedItems.filter((i) => i.type === 'comment').length,
    };

    const filteredItems =
      filterType === 'all'
        ? matchedItems
        : matchedItems.filter((item) => item.type === filterType);

    if (sort === 'newest') {
      filteredItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sort === 'top') {
      filteredItems.sort((a, b) => (b.score || 0) - (a.score || 0));
    } else {
      filteredItems.sort((a, b) => b.matchScore - a.matchScore);
    }

    const totalCount = filteredItems.length;
    const startIndex = (page - 1) * pageSize;
    const paginatedResults = filteredItems.slice(startIndex, startIndex + pageSize);

    const response: SearchResponse = {
      results: paginatedResults,
      totalCount,
      countsBySource: {
        xonddit: countsByType.all,
      },
      countsByType,
      query: options.query,
      executionTimeMs: Math.max(1, Math.round(performance.now() - startTime)),
    };

    if (this.searchCache.size >= 100) {
      const oldestKey = this.searchCache.keys().next().value;
      if (oldestKey !== undefined) {
        this.searchCache.delete(oldestKey);
      }
    }
    this.searchCache.set(cacheKey, response);
    return response;
  }

  private extractSnippet(text: string, queryTokens: string[]): string {
    if (!text) return '';
    const normLower = normalizeUzbekSearchText(text);
    let bestIdx = -1;
    for (const t of queryTokens) {
      const idx = normLower.indexOf(t);
      if (idx !== -1) {
        bestIdx = idx;
        break;
      }
    }

    if (bestIdx === -1) {
      return text.length > 200 ? text.slice(0, 200) + '...' : text;
    }

    const start = Math.max(0, bestIdx - 60);
    const end = Math.min(text.length, bestIdx + 140);
    let snippet = text.slice(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';
    return snippet;
  }
}

export const searchService = new SearchService();
