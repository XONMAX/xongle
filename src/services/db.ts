import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';
import { db, auth, ensureAuth, setUserProfile } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errors';
import { Community, Post, Comment, Vote, FeedSort, UserProfile } from '../types';
import { searchService } from './search';
import {
  communityCreationSchema,
  postCreationSchema,
  commentCreationSchema,
  userProfileUpdateSchema,
  safeDocumentIdSchema,
} from '../validation/schemas';
import {
  BASELINE_PUBLIC_COMMUNITIES,
  BASELINE_PUBLIC_POSTS,
  BASELINE_PUBLIC_COMMENTS,
  mergeWithBaselineCommunities,
  mergeWithBaselinePosts,
  mergeWithBaselineComments,
} from '../seo/uzbekSearch';

function sanitizePublicUserProfile(raw: Record<string, any>): UserProfile {
  return {
    uid: typeof raw.uid === 'string' ? raw.uid : undefined,
    username: typeof raw.username === 'string' ? raw.username : 'user',
    displayName: typeof raw.displayName === 'string' ? raw.displayName : 'User',
    bio: typeof raw.bio === 'string' ? raw.bio.slice(0, 300) : '',
    photoURL: typeof raw.photoURL === 'string' ? raw.photoURL : '',
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
  };
}


function stripUndefined<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined && val !== null) {
      clean[key] = val;
    }
  }
  return clean;
}

// -----------------------------------------------------------------
// High-Performance In-Memory Query & Entity Cache (SWR + In-Flight Deduplication)
// -----------------------------------------------------------------
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

let communitiesCache: CacheEntry<Community[]> | null = null;
const COMMUNITIES_TTL = 60000; // 60 seconds

const postsQueryCache = new Map<string, CacheEntry<Post[]>>();
const POSTS_TTL = 45000; // 45 seconds

// Master cache of all loaded posts to allow instant 0ms in-memory sorting
const masterPostsMap = new Map<string, Post>();

const singlePostCache = new Map<string, CacheEntry<Post>>();
const commentsCache = new Map<string, CacheEntry<Comment[]>>();
const COMMENTS_TTL = 45000;

let recentCommentsCache: CacheEntry<Comment[]> | null = null;
const RECENT_COMMENTS_TTL = 45000;

let userVotesCache: { userId: string; data: Record<string, number>; timestamp: number } | null = null;
const VOTES_TTL = 60000;

let allUsersCache: CacheEntry<UserProfile[]> | null = null;
const USERS_TTL = 60000;

// In-flight promise pooling: prevents duplicate simultaneous network requests
const inFlightRequests = new Map<string, Promise<any>>();

function sortPostsInMemory(posts: Post[], sortType: FeedSort): Post[] {
  const sorted = [...posts];
  const now = Date.now();
  if (sortType === 'new') {
    sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else if (sortType === 'top') {
    sorted.sort((a, b) => b.score - a.score);
  } else if (sortType === 'hot') {
    sorted.sort((a, b) => {
      const ageA = Math.max(0, (now - new Date(a.createdAt).getTime()) / (1000 * 3600));
      const ageB = Math.max(0, (now - new Date(b.createdAt).getTime()) / (1000 * 3600));
      const hotA = (a.score + 1) / Math.pow(ageA + 2, 1.5);
      const hotB = (b.score + 1) / Math.pow(ageB + 2, 1.5);
      return hotB - hotA;
    });
  } else if (sortType === 'best') {
    sorted.sort((a, b) => {
      const scoreA = a.score * 1.5 + (a.commentCount || 0) * 2;
      const scoreB = b.score * 1.5 + (b.commentCount || 0) * 2;
      return scoreB - scoreA;
    });
  }
  return sorted;
}

export const dbService = {
  invalidateCache() {
    communitiesCache = null;
    postsQueryCache.clear();
    singlePostCache.clear();
    commentsCache.clear();
    recentCommentsCache = null;
    userVotesCache = null;
    allUsersCache = null;
    masterPostsMap.clear();
    inFlightRequests.clear();
  },

  getCachedCommunities(): Community[] {
    return communitiesCache ? communitiesCache.data : BASELINE_PUBLIC_COMMUNITIES;
  },

  getCachedPosts(options: { communitySlug?: string | null; sort?: FeedSort; flair?: string } = {}): Post[] {
    let pool =
      masterPostsMap.size > 0
        ? mergeWithBaselinePosts(Array.from(masterPostsMap.values()))
        : [...BASELINE_PUBLIC_POSTS];
    if (options.communitySlug) {
      const targetSlug = options.communitySlug.toLowerCase().trim();
      pool = pool.filter((p) => (p.communitySlug || '').toLowerCase() === targetSlug);
    }
    if (options.flair && options.flair !== 'All') {
      const targetFlair = options.flair.toLowerCase().trim();
      pool = pool.filter((p) => (p.flair || '').toLowerCase() === targetFlair);
    }
    return sortPostsInMemory(pool, options.sort || 'hot');
  },

  getCachedRecentComments(_limit?: number): Comment[] {
    return recentCommentsCache ? recentCommentsCache.data : BASELINE_PUBLIC_COMMENTS;
  },

  // -------------------------------------------------------------
  // COMMUNITIES
  // -------------------------------------------------------------
  async getCommunities(forceRefresh = false): Promise<Community[]> {
    const collPath = 'communities';
    const now = Date.now();

    if (!forceRefresh && communitiesCache && now - communitiesCache.timestamp < COMMUNITIES_TTL) {
      return communitiesCache.data;
    }

    const reqKey = 'getCommunities';
    if (!forceRefresh && inFlightRequests.has(reqKey)) {
      return inFlightRequests.get(reqKey)!;
    }

    const fetchPromise = (async () => {
      try {
        const q = query(collection(db, collPath), where('isPublic', '==', true), limit(60));
        const snap = await getDocs(q);
        const list = mergeWithBaselineCommunities(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as Community))
        );
        const sorted = list.sort((a, b) => b.postCount - a.postCount || a.name.localeCompare(b.name));
        communitiesCache = { data: sorted, timestamp: Date.now() };
        searchService.indexCommunitiesBatch(sorted);
        return sorted;
      } catch (err) {
        if (communitiesCache) return communitiesCache.data;
        handleFirestoreError(err, OperationType.GET, collPath);
        return BASELINE_PUBLIC_COMMUNITIES;
      } finally {
        inFlightRequests.delete(reqKey);
      }
    })();

    inFlightRequests.set(reqKey, fetchPromise);
    return fetchPromise;
  },

  async getCommunityBySlug(slug: string): Promise<Community | null> {
    const cleanSlug = slug.toLowerCase().trim();
    if (communitiesCache) {
      const found = communitiesCache.data.find((c) => c.slug.toLowerCase() === cleanSlug);
      if (found) return found;
    }

    const collPath = 'communities';
    try {
      const q = query(
        collection(db, collPath),
        where('slug', '==', cleanSlug),
        limit(1)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        const baselineComm = BASELINE_PUBLIC_COMMUNITIES.find(
          (c) => c.slug.toLowerCase() === cleanSlug
        );
        return baselineComm || null;
      }
      const d = snap.docs[0];
      const comm = { id: d.id, ...d.data() } as Community;
      searchService.indexCommunity(comm);
      return comm;
    } catch (err) {
      const baselineComm = BASELINE_PUBLIC_COMMUNITIES.find(
        (c) => c.slug.toLowerCase() === cleanSlug
      );
      if (baselineComm) return baselineComm;
      handleFirestoreError(err, OperationType.GET, collPath);
      return null;
    }
  },

  async createCommunity(params: {
    name: string;
    slug: string;
    title: string;
    description: string;
    iconUrl?: string;
    bannerUrl?: string;
    creatorName: string;
  }): Promise<Community> {
    const collPath = 'communities';
    const currentUser = auth.currentUser || (await ensureAuth());
    if (!currentUser) throw new Error('Authentication required');

    const validation = communityCreationSchema.safeParse(params);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Invalid community data';
      throw new Error(firstError);
    }

    const validData = validation.data;
    const cleanSlug = validData.slug;

    const existing = await this.getCommunityBySlug(cleanSlug);
    if (existing) {
      throw new Error(`A community with slug "c/${cleanSlug}" already exists.`);
    }

    const docId = `comm_${cleanSlug}_${Date.now()}`;

    const firestoreData: Record<string, any> = {
      id: docId,
      name: validData.name,
      slug: cleanSlug,
      title: validData.title,
      description: validData.description || '',
      creatorId: currentUser.uid,
      creatorName: validData.creatorName,
      createdAt: new Date().toISOString(),
      postCount: 0,
      isPublic: true,
    };

    if (validData.iconUrl) {
      firestoreData.iconUrl = validData.iconUrl;
    }
    if (validData.bannerUrl) {
      firestoreData.bannerUrl = validData.bannerUrl;
    }

    const newCommunity: Community = {
      id: docId,
      name: validData.name,
      slug: cleanSlug,
      title: validData.title,
      description: validData.description || '',
      creatorId: currentUser.uid,
      creatorName: validData.creatorName,
      createdAt: firestoreData.createdAt,
      postCount: 0,
      isPublic: true,
      ...(validData.iconUrl ? { iconUrl: validData.iconUrl } : {}),
      ...(validData.bannerUrl ? { bannerUrl: validData.bannerUrl } : {}),
    };

    try {
      const communityRef = doc(db, collPath, docId);
      await setDoc(communityRef, stripUndefined(firestoreData));
      if (communitiesCache) {
        communitiesCache.data = [newCommunity, ...communitiesCache.data];
      }
      searchService.indexCommunity(newCommunity);
      return newCommunity;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `${collPath}/${docId}`);
    }
  },

  async toggleCommunityVerification(slug: string, isVerified: boolean): Promise<void> {
    const comm = await this.getCommunityBySlug(slug);
    if (!comm) return;
    if (communitiesCache) {
      communitiesCache.data = communitiesCache.data.map((c) =>
        c.id === comm.id ? { ...c, isVerified } : c
      );
    }
    try {
      await updateDoc(doc(db, 'communities', comm.id), { isVerified });
    } catch {
      // Ignore if rules restrict non-creator update; local cache updated
    }
  },

  // -------------------------------------------------------------
  // POSTS
  // -------------------------------------------------------------
  async getPosts(
    options: {
      communityId?: string;
      communitySlug?: string;
      sort?: FeedSort;
      flair?: string;
    } = {},
    forceRefresh = false
  ): Promise<Post[]> {
    const collPath = 'posts';
    const sortType = options.sort || 'hot';
    const cacheKey = `${options.communityId || ''}_${options.communitySlug || ''}_${sortType}_${options.flair || ''}`;
    const now = Date.now();

    if (!forceRefresh) {
      const cached = postsQueryCache.get(cacheKey);
      if (cached && now - cached.timestamp < POSTS_TTL) {
        return cached.data;
      }

      if (masterPostsMap.size > 0 && !options.communityId) {
        let pool = Array.from(masterPostsMap.values());
        if (options.communitySlug) {
          const targetSlug = options.communitySlug.toLowerCase().trim();
          pool = pool.filter((p) => (p.communitySlug || '').toLowerCase() === targetSlug);
        }
        if (options.flair) {
          pool = pool.filter((p) => p.flair?.toLowerCase() === options.flair?.toLowerCase());
        }
        if (pool.length > 0) {
          const sorted = sortPostsInMemory(pool, sortType);
          postsQueryCache.set(cacheKey, { data: sorted, timestamp: now });
          return sorted;
        }
      }
    }

    const inFlightKey = `getPosts_${options.communityId || ''}_${options.communitySlug || ''}_${options.flair || ''}`;
    if (!forceRefresh && inFlightRequests.has(inFlightKey)) {
      const rawPosts = (await inFlightRequests.get(inFlightKey)!) as Post[];
      const sorted = sortPostsInMemory(rawPosts, sortType);
      postsQueryCache.set(cacheKey, { data: sorted, timestamp: Date.now() });
      return sorted;
    }

    const fetchPromise = (async () => {
      try {
        let q = query(
          collection(db, collPath),
          where('isPublic', '==', true),
          limit(60)
        );

        if (options.communityId) {
          q = query(
            collection(db, collPath),
            where('isPublic', '==', true),
            where('communityId', '==', options.communityId),
            limit(60)
          );
        }

        const snap = await getDocs(q);
        let rawPosts = mergeWithBaselinePosts(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post))
        );

        if (options.flair) {
          rawPosts = rawPosts.filter((p) => p.flair?.toLowerCase() === options.flair?.toLowerCase());
        }

        if (options.communitySlug && !options.communityId) {
          const targetSlug = options.communitySlug.toLowerCase().trim();
          rawPosts = rawPosts.filter((p) => (p.communitySlug || '').toLowerCase() === targetSlug);
        }

        const fetchTime = Date.now();
        rawPosts.forEach((p) => {
          singlePostCache.set(p.id, { data: p, timestamp: fetchTime });
          masterPostsMap.set(p.id, p);
        });

        searchService.indexPostsBatch(rawPosts);

        return rawPosts;
      } catch (err) {
        const fallback = postsQueryCache.get(cacheKey);
        if (fallback) return fallback.data;
        handleFirestoreError(err, OperationType.GET, collPath);
        return [...BASELINE_PUBLIC_POSTS];
      } finally {
        inFlightRequests.delete(inFlightKey);
      }
    })();

    inFlightRequests.set(inFlightKey, fetchPromise);
    const rawFetched = await fetchPromise;
    const sorted = sortPostsInMemory(rawFetched, sortType);
    postsQueryCache.set(cacheKey, { data: sorted, timestamp: Date.now() });
    return sorted;
  },

  getCachedPostById(postId?: string | null): Post | null {
    if (!postId) return null;
    const clean = postId.trim();
    const fromMaster = masterPostsMap.get(clean);
    if (fromMaster) return fromMaster;
    const fromSingle = singlePostCache.get(clean);
    if (fromSingle) return fromSingle.data;
    const fromBaseline = BASELINE_PUBLIC_POSTS.find((p) => p.id === clean);
    if (fromBaseline) return fromBaseline;
    return null;
  },

  async getPostById(postId: string): Promise<Post | null> {
    const idCheck = safeDocumentIdSchema.safeParse(postId);
    if (!idCheck.success) return null;
    const cleanPostId = idCheck.data;

    const now = Date.now();
    const cached = singlePostCache.get(cleanPostId);
    if (cached && now - cached.timestamp < POSTS_TTL * 2) {
      return cached.data;
    }
    const masterCached = masterPostsMap.get(cleanPostId);
    if (masterCached) {
      return masterCached;
    }

    const collPath = 'posts';
    try {
      const snap = await getDoc(doc(db, collPath, cleanPostId));
      if (!snap.exists()) {
        const baselinePost = BASELINE_PUBLIC_POSTS.find((p) => p.id === cleanPostId);
        return baselinePost || null;
      }
      const data = { id: snap.id, ...snap.data() } as Post;
      singlePostCache.set(cleanPostId, { data, timestamp: now });
      masterPostsMap.set(cleanPostId, data);
      searchService.indexPost(data);
      return data;
    } catch (err) {
      if (cached) return cached.data;
      const baselinePost = BASELINE_PUBLIC_POSTS.find((p) => p.id === cleanPostId);
      if (baselinePost) return baselinePost;
      handleFirestoreError(err, OperationType.GET, `${collPath}/${cleanPostId}`);
      return null;
    }
  },

  async createPost(params: {
    title: string;
    body?: string;
    type: 'text' | 'link' | 'image';
    linkUrl?: string;
    imageUrl?: string;
    communityId: string;
    communitySlug: string;
    communityName: string;
    authorName: string;
    flair?: string;
  }): Promise<Post> {
    const collPath = 'posts';
    const currentUser = auth.currentUser || (await ensureAuth());
    if (!currentUser) throw new Error('Authentication required');

    const validation = postCreationSchema.safeParse(params);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Invalid post data';
      throw new Error(firstError);
    }

    const validData = validation.data;
    const docId = `post_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newPost: Post = {
      id: docId,
      title: validData.title,
      type: validData.type,
      communityId: validData.communityId,
      communitySlug: validData.communitySlug,
      communityName: validData.communityName,
      authorId: currentUser.uid,
      authorName: validData.authorName,
      score: 1,
      upvotes: 1,
      downvotes: 0,
      commentCount: 0,
      createdAt: new Date().toISOString(),
      isPublic: true,
      ...(validData.body ? { body: validData.body } : {}),
      ...(validData.linkUrl ? { linkUrl: validData.linkUrl } : {}),
      ...(validData.imageUrl ? { imageUrl: validData.imageUrl } : {}),
      ...(validData.flair ? { flair: validData.flair } : {}),
    };

    try {
      const postRef = doc(db, collPath, docId);
      const commRef = doc(db, 'communities', validData.communityId);
      const voteRef = doc(db, 'votes', `${currentUser.uid}_${docId}`);

      const batch = writeBatch(db);
      batch.set(postRef, stripUndefined(newPost));
      const commSnap = await getDoc(commRef);
      if (commSnap.exists()) {
        const curCount = commSnap.data().postCount || 0;
        batch.update(commRef, { postCount: curCount + 1 });
      }
      const authorVote: Vote = {
        id: `${currentUser.uid}_${docId}`,
        targetId: docId,
        targetType: 'post',
        userId: currentUser.uid,
        direction: 1,
        updatedAt: new Date().toISOString(),
      };
      batch.set(voteRef, authorVote);

      await batch.commit();

      singlePostCache.set(docId, { data: newPost, timestamp: Date.now() });
      masterPostsMap.set(docId, newPost);
      postsQueryCache.clear();
      if (userVotesCache && userVotesCache.userId === currentUser.uid) {
        userVotesCache.data[docId] = 1;
      }
      if (communitiesCache) {
        const comm = communitiesCache.data.find((c) => c.id === validData.communityId);
        if (comm) comm.postCount += 1;
      }

      searchService.indexPost(newPost);
      return newPost;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `${collPath}/${docId}`);
    }
  },

  async deletePost(postId: string): Promise<void> {
    const collPath = 'posts';
    const idCheck = safeDocumentIdSchema.safeParse(postId);
    if (!idCheck.success) throw new Error('Invalid post ID');
    const cleanPostId = idCheck.data;

    const currentUser = auth.currentUser || (await ensureAuth());
    if (!currentUser) throw new Error('Authentication required');

    try {
      const postRef = doc(db, collPath, cleanPostId);
      const snap = await getDoc(postRef);
      if (!snap.exists()) return;
      const isOwnerEmail =
        currentUser.email &&
        ['aminbek785@gmail.com', 'crownsmpuz@gmail.com'].includes(currentUser.email.toLowerCase());
      if (snap.data().authorId !== currentUser.uid && !isOwnerEmail) {
        throw new Error('Unauthorized: only author or owner can delete post');
      }

      await deleteDoc(postRef);
      singlePostCache.delete(cleanPostId);
      masterPostsMap.delete(cleanPostId);
      postsQueryCache.clear();
      searchService.removePost(cleanPostId);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${collPath}/${cleanPostId}`);
    }
  },

  // -------------------------------------------------------------
  // COMMENTS
  // -------------------------------------------------------------
  async getRecentComments(limitCount = 80, forceRefresh = false): Promise<Comment[]> {
    const collPath = 'comments';
    const now = Date.now();

    if (
      !forceRefresh &&
      recentCommentsCache &&
      now - recentCommentsCache.timestamp < RECENT_COMMENTS_TTL
    ) {
      return recentCommentsCache.data;
    }

    const reqKey = 'getRecentComments';
    if (!forceRefresh && inFlightRequests.has(reqKey)) {
      return inFlightRequests.get(reqKey)!;
    }

    const fetchPromise = (async () => {
      try {
        const safeLimit = Math.max(1, Math.min(100, Math.floor(limitCount)));
        const q = query(collection(db, collPath), limit(safeLimit));
        const snap = await getDocs(q);
        const list = mergeWithBaselineComments(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as Comment))
        );
        recentCommentsCache = { data: list, timestamp: Date.now() };
        searchService.indexCommentsBatch(list);
        return list;
      } catch {
        return recentCommentsCache ? recentCommentsCache.data : BASELINE_PUBLIC_COMMENTS;
      } finally {
        inFlightRequests.delete(reqKey);
      }
    })();

    inFlightRequests.set(reqKey, fetchPromise);
    return fetchPromise;
  },

  async getComments(postId: string, forceRefresh = false): Promise<Comment[]> {
    const idCheck = safeDocumentIdSchema.safeParse(postId);
    if (!idCheck.success) return [];
    const cleanPostId = idCheck.data;

    const collPath = 'comments';
    const now = Date.now();
    if (!forceRefresh) {
      const cached = commentsCache.get(cleanPostId);
      if (cached && now - cached.timestamp < COMMENTS_TTL) {
        return cached.data;
      }
    }

    const reqKey = `getComments_${cleanPostId}`;
    if (!forceRefresh && inFlightRequests.has(reqKey)) {
      return inFlightRequests.get(reqKey)!;
    }

    const fetchPromise = (async () => {
      const baselineForPost = BASELINE_PUBLIC_COMMENTS.filter((c) => c.postId === cleanPostId);
      try {
        const q = query(
          collection(db, collPath),
          where('postId', '==', cleanPostId),
          limit(100)
        );
        const snap = await getDocs(q);
        const liveList = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Comment));
        const byId = new Map<string, Comment>();
        for (const b of baselineForPost) byId.set(b.id, b);
        for (const l of liveList) byId.set(l.id, l);
        const list = Array.from(byId.values());
        searchService.indexCommentsBatch(list);
        const sorted = list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        commentsCache.set(cleanPostId, { data: sorted, timestamp: Date.now() });
        return sorted;
      } catch (err) {
        const fallback = commentsCache.get(cleanPostId);
        if (fallback) return fallback.data;
        if (baselineForPost.length > 0) return baselineForPost;
        handleFirestoreError(err, OperationType.GET, collPath);
        return [];
      } finally {
        inFlightRequests.delete(reqKey);
      }
    })();

    inFlightRequests.set(reqKey, fetchPromise);
    return fetchPromise;
  },

  async createComment(params: {
    postId: string;
    communityId: string;
    content: string;
    authorName: string;
    parentId?: string;
  }): Promise<Comment> {
    const collPath = 'comments';
    const currentUser = auth.currentUser || (await ensureAuth());
    if (!currentUser) throw new Error('Authentication required');

    const validation = commentCreationSchema.safeParse(params);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Invalid comment data';
      throw new Error(firstError);
    }

    const validData = validation.data;
    const docId = `comment_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newComment: Comment = {
      id: docId,
      postId: validData.postId,
      communityId: validData.communityId,
      authorId: currentUser.uid,
      authorName: validData.authorName,
      content: validData.content,
      score: 1,
      createdAt: new Date().toISOString(),
      ...(validData.parentId ? { parentId: validData.parentId } : {}),
    };

    try {
      const commentRef = doc(db, collPath, docId);
      const postRef = doc(db, 'posts', validData.postId);

      await runTransaction(db, async (tx) => {
        const postSnap = await tx.get(postRef);
        if (!postSnap.exists()) {
          throw new Error('Target post does not exist');
        }
        const currentCount = postSnap.data().commentCount || 0;
        tx.set(commentRef, stripUndefined(newComment));
        tx.update(postRef, { commentCount: currentCount + 1 });
      });

      // Update caches
      const cachedComments = commentsCache.get(validData.postId);
      if (cachedComments) {
        cachedComments.data = [...cachedComments.data, newComment];
      }
      if (recentCommentsCache) {
        recentCommentsCache.data = [newComment, ...recentCommentsCache.data];
      }
      const cachedPost = singlePostCache.get(validData.postId);
      if (cachedPost) {
        cachedPost.data.commentCount = (cachedPost.data.commentCount || 0) + 1;
      }
      const masterPost = masterPostsMap.get(validData.postId);
      if (masterPost) {
        masterPost.commentCount = (masterPost.commentCount || 0) + 1;
      }

      searchService.indexComment(newComment);
      return newComment;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `${collPath}/${docId}`);
    }
  },

  // -------------------------------------------------------------
  // VOTING
  // -------------------------------------------------------------
  async castVote(targetId: string, targetType: 'post' | 'comment', direction: 1 | -1): Promise<{ newScore: number; direction: number }> {
    const idCheck = safeDocumentIdSchema.safeParse(targetId);
    if (!idCheck.success) throw new Error('Invalid vote target ID');
    const cleanTargetId = idCheck.data;

    if (direction !== 1 && direction !== -1) {
      throw new Error('Invalid vote direction');
    }

    const currentUser = auth.currentUser || (await ensureAuth());
    if (!currentUser) throw new Error('Authentication required');

    const voteDocId = `${currentUser.uid}_${cleanTargetId}`;
    const voteRef = doc(db, 'votes', voteDocId);
    const targetColl = targetType === 'post' ? 'posts' : 'comments';
    const targetRef = doc(db, targetColl, cleanTargetId);

    try {
      return await runTransaction(db, async (tx) => {
        const targetSnap = await tx.get(targetRef);
        if (!targetSnap.exists()) throw new Error('Item not found');

        const voteSnap = await tx.get(voteRef);
        const currentScore = targetSnap.data().score || 0;
        let delta = 0;
        let finalDirection: 1 | -1 | 0 = 0;

        if (voteSnap.exists()) {
          const oldVote = voteSnap.data() as Vote;
          if (oldVote.direction === direction) {
            delta = -direction;
            finalDirection = 0;
            tx.delete(voteRef);
          } else {
            delta = direction - oldVote.direction;
            finalDirection = direction;
            tx.update(voteRef, {
              direction,
              updatedAt: new Date().toISOString(),
            });
          }
        } else {
          delta = direction;
          finalDirection = direction;
          tx.set(voteRef, {
            id: voteDocId,
            targetId: cleanTargetId,
            targetType,
            userId: currentUser.uid,
            direction,
            updatedAt: new Date().toISOString(),
          });
        }

        const newScore = currentScore + delta;
        tx.update(targetRef, { score: newScore });

        if (targetType === 'post') {
          const cached = singlePostCache.get(cleanTargetId);
          if (cached) {
            cached.data.score = newScore;
          }
          const master = masterPostsMap.get(cleanTargetId);
          if (master) {
            master.score = newScore;
          }
        }
        if (userVotesCache && userVotesCache.userId === currentUser.uid) {
          userVotesCache.data[cleanTargetId] = finalDirection;
        }

        return { newScore, direction: finalDirection };
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `votes/${voteDocId}`);
    }
  },

  async votePost(postId: string, direction: 1 | -1): Promise<{ newScore: number; direction: number } | undefined> {
    return this.castVote(postId, 'post', direction);
  },

  async getUserVotes(forceRefresh = false): Promise<Record<string, number>> {
    const currentUser = auth.currentUser || (await ensureAuth());
    if (!currentUser) {
      try {
        const local = localStorage.getItem('xonddit_user_votes');
        return local ? JSON.parse(local) : {};
      } catch {
        return {};
      }
    }
    const now = Date.now();
    if (
      !forceRefresh &&
      userVotesCache &&
      userVotesCache.userId === currentUser.uid &&
      now - userVotesCache.timestamp < VOTES_TTL
    ) {
      return { ...userVotesCache.data };
    }

    const collPath = 'votes';
    try {
      const q = query(collection(db, collPath), where('userId', '==', currentUser.uid), limit(200));
      const snap = await getDocs(q);
      const voteMap: Record<string, number> = {};
      snap.docs.forEach((d) => {
        const v = d.data() as Vote;
        voteMap[v.targetId] = v.direction;
      });
      userVotesCache = { userId: currentUser.uid, data: voteMap, timestamp: now };
      return voteMap;
    } catch {
      if (userVotesCache && userVotesCache.userId === currentUser.uid) {
        return userVotesCache.data;
      }
      return {};
    }
  },

  // -------------------------------------------------------------
  // USER PROFILES & USERNAMES
  // -------------------------------------------------------------
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const idCheck = safeDocumentIdSchema.safeParse(userId);
    if (!idCheck.success) return null;
    const collPath = 'users';
    try {
      const snap = await getDoc(doc(db, collPath, idCheck.data));
      if (!snap.exists()) return null;
      return sanitizePublicUserProfile(snap.data());
    } catch {
      return null;
    }
  },

  async checkUsernameAvailable(username: string, currentUserId?: string): Promise<boolean> {
    const clean = username.replace(/^u\//, '').toLowerCase().trim();
    if (!/^[a-z0-9_]{3,30}$/.test(clean)) return false;

    try {
      const q = query(
        collection(db, 'users'),
        where('username', '==', clean),
        limit(2)
      );
      const snap = await getDocs(q);
      if (snap.empty) return true;

      const otherUser = snap.docs.find((d) => d.id !== currentUserId && d.data().uid !== currentUserId);
      return !otherUser;
    } catch {
      return true;
    }
  },

  async saveUserProfile(params: {
    username: string;
    displayName: string;
    bio?: string;
    photoURL?: string;
  }): Promise<UserProfile> {
    const validation = userProfileUpdateSchema.safeParse(params);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Invalid profile data';
      throw new Error(firstError);
    }

    const validData = validation.data;
    const currentUser = auth.currentUser;

    const updatedProfile: UserProfile = {
      uid: currentUser?.uid,
      username: validData.username,
      displayName: validData.displayName,
      bio: validData.bio,
      photoURL: validData.photoURL,
      updatedAt: new Date().toISOString(),
    };

    setUserProfile(updatedProfile);

    if (currentUser) {
      const collPath = 'users';
      try {
        const userRef = doc(db, collPath, currentUser.uid);
        await setDoc(userRef, stripUndefined({
          id: currentUser.uid,
          uid: currentUser.uid,
          username: validData.username,
          displayName: validData.displayName,
          bio: updatedProfile.bio || '',
          photoURL: updatedProfile.photoURL || '',
          updatedAt: updatedProfile.updatedAt,
        }));
      } catch (err) {
        console.warn('Could not sync user profile to remote database:', err);
      }
    }

    return updatedProfile;
  },

  async getAllUsers(forceRefresh = false): Promise<UserProfile[]> {
    const collPath = 'users';
    const now = Date.now();
    if (!forceRefresh && allUsersCache && now - allUsersCache.timestamp < USERS_TTL) {
      return allUsersCache.data;
    }

    const reqKey = 'getAllUsers';
    if (!forceRefresh && inFlightRequests.has(reqKey)) {
      return inFlightRequests.get(reqKey)!;
    }

    const fetchPromise = (async () => {
      try {
        const snap = await getDocs(query(collection(db, collPath), limit(100)));
        const users = snap.docs.map((d) => sanitizePublicUserProfile(d.data()));
        allUsersCache = { data: users, timestamp: Date.now() };
        return users;
      } catch {
        if (allUsersCache) return allUsersCache.data;
        return [];
      } finally {
        inFlightRequests.delete(reqKey);
      }
    })();

    inFlightRequests.set(reqKey, fetchPromise);
    return fetchPromise;
  },

  // -------------------------------------------------------------
  // OWNER FULL SNAPSHOT EXPORT & RESTORE HELPERS
  // -------------------------------------------------------------
  async exportFullClientSnapshot(): Promise<Record<string, any>> {
    const safeFetchCollection = async (collName: string, maxDocs = 300) => {
      try {
        const snap = await getDocs(query(collection(db, collName), limit(maxDocs)));
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch {
        return [];
      }
    };

    const [
      users,
      communities,
      posts,
      comments,
      votes,
      tweets,
      slide_templates,
      conversations,
      messages,
    ] = await Promise.all([
      safeFetchCollection('users', 300),
      safeFetchCollection('communities', 200),
      safeFetchCollection('posts', 300),
      safeFetchCollection('comments', 500),
      safeFetchCollection('votes', 500),
      safeFetchCollection('tweets', 200),
      safeFetchCollection('slide_templates', 100),
      safeFetchCollection('conversations', 200),
      safeFetchCollection('messages', 500),
    ]);

    return {
      users,
      communities,
      posts,
      comments,
      votes,
      tweets,
      slide_templates,
      conversations,
      messages,
    };
  },

  async restoreFullClientSnapshot(restoredData: Record<string, any>): Promise<void> {
    if (!restoredData || typeof restoredData !== 'object') return;
    const writeCollectionItems = async (collName: string, items: any[], idField = 'id') => {
      if (!Array.isArray(items) || items.length === 0) return;
      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const docId = String(item[idField] || item.id || item.uid || '');
        if (!docId || !/^[a-zA-Z0-9_-]{1,128}$/.test(docId)) continue;
        try {
          await setDoc(doc(db, collName, docId), stripUndefined(item), { merge: true });
        } catch {
          // Handled by server-side REST or owner rules
        }
      }
    };

    await Promise.all([
      writeCollectionItems('users', restoredData.users || [], 'uid'),
      writeCollectionItems('communities', restoredData.communities || [], 'id'),
      writeCollectionItems('posts', restoredData.posts || [], 'id'),
      writeCollectionItems('comments', restoredData.comments || [], 'id'),
      writeCollectionItems('votes', restoredData.votes || [], 'id'),
      writeCollectionItems('tweets', restoredData.tweets || [], 'id'),
      writeCollectionItems('slide_templates', restoredData.slide_templates || [], 'id'),
      writeCollectionItems('conversations', restoredData.conversations || [], 'id'),
      writeCollectionItems('messages', restoredData.messages || [], 'id'),
    ]);

    this.invalidateCache();
  },
};

