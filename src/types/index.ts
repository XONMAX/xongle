export type PostType = 'text' | 'link' | 'image';

export interface Community {
  id: string;
  name: string;
  slug: string;
  title: string;
  description: string;
  iconUrl?: string;
  bannerUrl?: string;
  creatorId: string;
  creatorName: string;
  createdAt: string;
  postCount: number;
  memberCount?: number;
  isVerified?: boolean;
  isPublic: boolean;
}

export interface Post {
  id: string;
  title: string;
  body?: string;
  type: PostType;
  linkUrl?: string;
  imageUrl?: string;
  communityId: string;
  communitySlug: string;
  communityName: string;
  authorId: string;
  authorName: string;
  score: number;
  upvotes?: number;
  downvotes?: number;
  commentCount: number;
  flair?: string;
  createdAt: string;
  isPublic: boolean;
}

export interface Comment {
  id: string;
  postId: string;
  communityId: string;
  authorId: string;
  authorName: string;
  content: string;
  parentId?: string;
  score: number;
  createdAt: string;
}

export interface Vote {
  id: string;
  targetId: string;
  targetType: 'post' | 'comment';
  userId: string;
  direction: 1 | -1 | 0;
  updatedAt: string;
}

export type FeedSort = 'best' | 'hot' | 'new' | 'top';

export type SupportedApp = 'xonddit' | 'xongle' | 'about';

export interface UserProfile {
  uid?: string;
  username: string; // alphanumeric handle without u/ or @, e.g. "swift_falcon"
  displayName: string; // display name, e.g. "Swift Falcon"
  bio?: string;
  photoURL?: string;
  updatedAt?: string;
}

export type SearchContentType = 'all' | 'post' | 'community' | 'comment';
export type SearchSourceFilter = 'all' | 'xonddit';
export type SearchSort = 'relevance' | 'newest' | 'top';

export interface SearchResultItem {
  id: string;
  source: 'xonddit';
  type: 'community' | 'post' | 'comment';
  title: string;
  snippet: string;
  url: string;
  authorName?: string;
  createdAt: string;
  score?: number;
  commentCount?: number;
  mediaUrl?: string;
  flair?: string;
  communitySlug?: string;
  communityName?: string;
  matchScore: number;
  targetPostId?: string;
  targetCommunitySlug?: string;
  targetApp?: SupportedApp;
}
