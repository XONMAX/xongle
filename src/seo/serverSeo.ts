import {
  DEFAULT_GSC_VERIFICATION_TOKEN,
  ResolvedSeoMetadata,
  SeoRouteInput,
  normalizeSupportedLanguage,
  resolveProductionBaseUrl,
  resolveSeoMetadata,
  safeSerializeJsonLd,
} from './seoConfig';
import { SupportedApp, Comment, Post } from '../types';
import {
  BASELINE_PUBLIC_COMMUNITIES,
  BASELINE_PUBLIC_POSTS,
  BASELINE_PUBLIC_COMMENTS,
  CURATED_TOPIC_HUBS,
  TopicHubDefinition,
  getTopicHubBySlug,
  retrieveGroundedCommunityContext,
} from './uzbekSearch';

export interface SitemapCommunityEntry {
  slug: string;
  name: string;
  description: string;
  lastmod: string;
}

export interface SitemapPostEntry {
  id: string;
  title: string;
  snippet: string;
  body: string;
  communitySlug: string;
  communityName: string;
  authorName: string;
  score: number;
  commentCount: number;
  createdAt: string;
  lastmod: string;
}

export interface SeoContentSnapshot {
  communities: SitemapCommunityEntry[];
  posts: SitemapPostEntry[];
  comments: Comment[];
  fetchedAt: number;
}

export interface ServerSeoResolution {
  meta: ResolvedSeoMetadata;
  notFound?: boolean;
  activePost?: SitemapPostEntry;
  activePostComments?: Comment[];
  activeCommunity?: SitemapCommunityEntry;
  activeTopicHub?: TopicHubDefinition;
  topicPosts?: SitemapPostEntry[];
}

let cachedSnapshot: SeoContentSnapshot | null = null;
let refreshInFlight: Promise<SeoContentSnapshot> | null = null;
const SNAPSHOT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_FIRESTORE_DB_ID = 'ai-studio-67825eaf-b5f6-4909-bff1-1dbcb71d9cb1';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toValidIsoDate(raw?: string): string {
  if (!raw) return '2025-02-16';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '2025-02-16';
  return d.toISOString().split('T')[0];
}

function readFirestoreString(fields: Record<string, any> | undefined, key: string): string {
  const val = fields?.[key];
  if (!val) return '';
  if (typeof val.stringValue === 'string') return val.stringValue;
  if (typeof val.timestampValue === 'string') return val.timestampValue;
  return '';
}

function readFirestoreInt(fields: Record<string, any> | undefined, key: string, fallback = 0): number {
  const val = fields?.[key];
  if (!val) return fallback;
  if (typeof val.integerValue === 'string' || typeof val.integerValue === 'number') {
    return Number(val.integerValue) || fallback;
  }
  if (typeof val.doubleValue === 'number') return val.doubleValue;
  return fallback;
}

function readFirestoreBool(
  fields: Record<string, any> | undefined,
  key: string,
  fallback = true
): boolean {
  const val = fields?.[key];
  if (!val) return fallback;
  if (typeof val.booleanValue === 'boolean') return val.booleanValue;
  return fallback;
}

function buildBaselineSnapshot(): SeoContentSnapshot {
  const communities: SitemapCommunityEntry[] = BASELINE_PUBLIC_COMMUNITIES.map((c) => ({
    slug: c.slug,
    name: c.name,
    description: c.description || c.title,
    lastmod: toValidIsoDate(c.createdAt),
  }));

  const posts: SitemapPostEntry[] = BASELINE_PUBLIC_POSTS.map((p) => ({
    id: p.id,
    title: p.title,
    snippet: (p.body || p.title).slice(0, 220),
    body: p.body || p.title,
    communitySlug: p.communitySlug,
    communityName: p.communityName,
    authorName: p.authorName,
    score: p.score,
    commentCount: p.commentCount,
    createdAt: p.createdAt,
    lastmod: toValidIsoDate(p.createdAt),
  }));

  return {
    communities,
    posts,
    comments: [...BASELINE_PUBLIC_COMMENTS],
    fetchedAt: Date.now(),
  };
}

async function fetchFirestoreSnapshot(
  firebaseProjectId: string,
  databaseId: string = DEFAULT_FIRESTORE_DB_ID
): Promise<SeoContentSnapshot> {
  const now = Date.now();
  const commBySlug = new Map<string, SitemapCommunityEntry>();
  const postById = new Map<string, SitemapPostEntry>();
  const commentById = new Map<string, Comment>();

  const baseline = buildBaselineSnapshot();
  for (const c of baseline.communities) commBySlug.set(c.slug, c);
  for (const p of baseline.posts) postById.set(p.id, p);
  for (const cm of baseline.comments) commentById.set(cm.id, cm);

  try {
    const runQueryUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      firebaseProjectId
    )}/databases/${encodeURIComponent(databaseId)}/documents:runQuery`;

    const [commRes, postRes, commentRes] = await Promise.allSettled([
      fetch(runQueryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'communities' }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'isPublic' },
                op: 'EQUAL',
                value: { booleanValue: true },
              },
            },
            limit: 60,
          },
        }),
        signal: AbortSignal.timeout(1500),
      }),
      fetch(runQueryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'posts' }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'isPublic' },
                op: 'EQUAL',
                value: { booleanValue: true },
              },
            },
            limit: 80,
          },
        }),
        signal: AbortSignal.timeout(1500),
      }),
      fetch(runQueryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'comments' }],
            limit: 120,
          },
        }),
        signal: AbortSignal.timeout(1500),
      }),
    ]);

    if (commRes.status === 'fulfilled' && commRes.value.ok) {
      const rows: any = await commRes.value.json();
      if (Array.isArray(rows)) {
        for (const row of rows) {
          const doc = row?.document;
          if (!doc?.fields) continue;
          const fields = doc.fields;
          const isPublic = readFirestoreBool(fields, 'isPublic', true);
          const slug = readFirestoreString(fields, 'slug').toLowerCase().trim();
          if (!isPublic || !slug || !/^[a-z0-9_-]{2,40}$/.test(slug)) continue;
          const name = readFirestoreString(fields, 'name') || `c/${slug}`;
          const description =
            readFirestoreString(fields, 'description') ||
            readFirestoreString(fields, 'title') ||
            `Public discussions in c/${slug} on Xonddit.`;
          const createdAt = readFirestoreString(fields, 'createdAt');
          commBySlug.set(slug, {
            slug,
            name,
            description,
            lastmod: toValidIsoDate(createdAt),
          });
        }
      }
    }

    if (postRes.status === 'fulfilled' && postRes.value.ok) {
      const rows: any = await postRes.value.json();
      if (Array.isArray(rows)) {
        for (const row of rows) {
          const doc = row?.document;
          if (!doc?.fields) continue;
          const fields = doc.fields;
          const rawDocName = String(doc.name || '');
          const docId =
            readFirestoreString(fields, 'id') || rawDocName.split('/').pop() || '';
          const title = readFirestoreString(fields, 'title').trim();
          const communitySlug = readFirestoreString(fields, 'communitySlug')
            .toLowerCase()
            .trim();
          if (!docId || !title || !/^[a-zA-Z0-9_-]{3,80}$/.test(docId)) continue;
          const body =
            readFirestoreString(fields, 'body') ||
            readFirestoreString(fields, 'linkUrl') ||
            title;
          const authorName = readFirestoreString(fields, 'authorName') || 'user';
          const createdAt =
            readFirestoreString(fields, 'createdAt') || '2025-02-16T10:00:00.000Z';
          const score = readFirestoreInt(fields, 'score', 1);
          const commentCount = readFirestoreInt(fields, 'commentCount', 0);
          postById.set(docId, {
            id: docId,
            title,
            snippet: body.slice(0, 220),
            body,
            communitySlug: communitySlug || 'xonddit',
            communityName:
              readFirestoreString(fields, 'communityName') || `c/${communitySlug || 'xonddit'}`,
            authorName,
            score,
            commentCount,
            createdAt,
            lastmod: toValidIsoDate(createdAt),
          });
        }
      }
    }

    if (commentRes.status === 'fulfilled' && commentRes.value.ok) {
      const rows: any = await commentRes.value.json();
      if (Array.isArray(rows)) {
        for (const row of rows) {
          const doc = row?.document;
          if (!doc?.fields) continue;
          const fields = doc.fields;
          const rawDocName = String(doc.name || '');
          const docId =
            readFirestoreString(fields, 'id') || rawDocName.split('/').pop() || '';
          const postId = readFirestoreString(fields, 'postId').trim();
          const content = readFirestoreString(fields, 'content').trim();
          if (!docId || !postId || !content) continue;
          commentById.set(docId, {
            id: docId,
            postId,
            communityId: readFirestoreString(fields, 'communityId') || 'comm_xonddit_official',
            authorId: readFirestoreString(fields, 'authorId') || 'user',
            authorName: readFirestoreString(fields, 'authorName') || 'user',
            content,
            score: readFirestoreInt(fields, 'score', 1),
            createdAt: readFirestoreString(fields, 'createdAt') || '2025-02-16T12:00:00.000Z',
          });
        }
      }
    }
  } catch {
    // Non-fatal fallback to baseline snapshot if network/Firestore is unavailable
  }

  cachedSnapshot = {
    communities: Array.from(commBySlug.values()),
    posts: Array.from(postById.values()),
    comments: Array.from(commentById.values()),
    fetchedAt: now,
  };
  return cachedSnapshot;
}

export async function getPublicSeoContentSnapshot(
  firebaseProjectId?: string,
  nonBlocking = false
): Promise<SeoContentSnapshot> {
  const now = Date.now();
  if (cachedSnapshot && now - cachedSnapshot.fetchedAt < SNAPSHOT_TTL_MS) {
    return cachedSnapshot;
  }

  if (!firebaseProjectId) {
    if (!cachedSnapshot) {
      cachedSnapshot = buildBaselineSnapshot();
    }
    return cachedSnapshot;
  }

  if (!refreshInFlight) {
    refreshInFlight = fetchFirestoreSnapshot(firebaseProjectId).finally(() => {
      refreshInFlight = null;
    });
  }

  if (nonBlocking) {
    return cachedSnapshot || buildBaselineSnapshot();
  }

  return refreshInFlight;
}

export function generateRobotsTxt(envAppUrl?: string): string {
  const baseUrl = resolveProductionBaseUrl(envAppUrl);
  return [
    'User-agent: *',
    'Allow: /',
    'Allow: /about',
    'Allow: /topics/',
    'Allow: /c/',
    'Allow: /discussions/',
    'Allow: /questions/',
    'Disallow: /api/',
    'Disallow: /owner',
    'Disallow: /admin',
    'Disallow: /ws/',
    'Disallow: /auth-bridge',
    '',
    `Sitemap: ${baseUrl}/sitemap.xml`,
    '',
  ].join('\n');
}

export async function generateSitemapXml(
  envAppUrl?: string,
  firebaseProjectId?: string
): Promise<string> {
  const baseUrl = resolveProductionBaseUrl(envAppUrl);
  const snapshot = await getPublicSeoContentSnapshot(firebaseProjectId, true);

  const entries: { loc: string; lastmod?: string }[] = [
    { loc: `${baseUrl}/`, lastmod: '2025-02-16' },
    { loc: `${baseUrl}/about`, lastmod: '2025-02-16' },
    { loc: `${baseUrl}/?app=xonddit`, lastmod: '2025-02-16' },
  ];

  // Curated Uzbek & Tech Topic Hubs (only topics backed by real discussions)
  for (const hub of CURATED_TOPIC_HUBS) {
    entries.push({
      loc: `${baseUrl}/topics/${encodeURIComponent(hub.slug)}`,
      lastmod: '2025-02-16',
    });
  }

  // Public Communities (both clean /c/:slug and query route)
  for (const comm of snapshot.communities.slice(0, 40)) {
    entries.push({
      loc: `${baseUrl}/c/${encodeURIComponent(comm.slug)}`,
      lastmod: comm.lastmod || '2025-02-16',
    });
    entries.push({
      loc: `${baseUrl}/?app=xonddit&c=${encodeURIComponent(comm.slug)}`,
      lastmod: comm.lastmod || '2025-02-16',
    });
  }

  // Public Discussions / Questions (clean /discussions/:id and query route)
  for (const post of snapshot.posts.slice(0, 60)) {
    entries.push({
      loc: `${baseUrl}/discussions/${encodeURIComponent(post.id)}`,
      lastmod: post.lastmod || '2025-02-16',
    });
    entries.push({
      loc: `${baseUrl}/?app=xonddit&p=${encodeURIComponent(post.id)}`,
      lastmod: post.lastmod || '2025-02-16',
    });
  }

  const seen = new Set<string>();
  const urlBlocks: string[] = [];
  for (const entry of entries) {
    if (seen.has(entry.loc)) continue;
    seen.add(entry.loc);
    urlBlocks.push(
      [
        '  <url>',
        `    <loc>${escapeXml(entry.loc)}</loc>`,
        entry.lastmod ? `    <lastmod>${escapeXml(entry.lastmod)}</lastmod>` : '',
        '  </url>',
      ]
        .filter(Boolean)
        .join('\n')
    );
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urlBlocks,
    '</urlset>',
    '',
  ].join('\n');
}

export function resolveGscVerificationToken(): string {
  const fromEnv =
    process.env.GOOGLE_SITE_VERIFICATION ||
    process.env.VITE_GOOGLE_SITE_VERIFICATION ||
    DEFAULT_GSC_VERIFICATION_TOKEN;
  const trimmed = String(fromEnv || '')
    .trim()
    .replace(/^google-site-verification=/i, '')
    .trim();
  if (!trimmed || trimmed.includes('YOUR_') || trimmed.includes('PLACEHOLDER')) {
    return DEFAULT_GSC_VERIFICATION_TOKEN;
  }
  return trimmed;
}

export async function resolveServerSeoWithContext(
  query: Record<string, any>,
  firebaseProjectId?: string,
  routeParams?: {
    cleanPath?: string;
    topicSlug?: string;
    communitySlug?: string;
    postId?: string;
  }
): Promise<ServerSeoResolution> {
  const rawApp = typeof query.app === 'string' ? query.app.toLowerCase().trim() : '';
  let app: SupportedApp =
    rawApp === 'about'
      ? 'about'
      : rawApp === 'xonddit' || routeParams?.communitySlug || routeParams?.postId
      ? 'xonddit'
      : 'xongle';

  const lang = normalizeSupportedLanguage(
    typeof query.lang === 'string' ? query.lang : 'en'
  );
  const searchQ = typeof query.q === 'string' ? query.q.trim() : undefined;
  const topicSlug =
    routeParams?.topicSlug ||
    (typeof query.topic === 'string' ? query.topic.trim().toLowerCase() : undefined);
  const communitySlug =
    routeParams?.communitySlug ||
    (typeof query.c === 'string' && /^[a-zA-Z0-9_-]{1,40}$/.test(query.c.trim())
      ? query.c.trim().toLowerCase()
      : undefined);
  const postId =
    routeParams?.postId ||
    (typeof query.p === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(query.p.trim())
      ? query.p.trim()
      : undefined);

  const snapshot = await getPublicSeoContentSnapshot(firebaseProjectId);

  const seoInput: SeoRouteInput = {
    app,
    lang,
    query: searchQ,
    communitySlug,
    postId,
    cleanPath: routeParams?.cleanPath,
    baseUrl: process.env.APP_URL,
  };

  let activePost: SitemapPostEntry | undefined;
  let activePostComments: Comment[] | undefined;
  let activeCommunity: SitemapCommunityEntry | undefined;
  let activeTopicHub: TopicHubDefinition | undefined;
  let topicPosts: SitemapPostEntry[] | undefined;

  if (topicSlug) {
    const hub = getTopicHubBySlug(topicSlug);
    if (!hub) {
      return {
        meta: resolveSeoMetadata(seoInput),
        notFound: true,
      };
    }
    activeTopicHub = hub;
    const context = retrieveGroundedCommunityContext(
      `${hub.titleUz} ${hub.keywords.join(' ')}`,
      snapshot.posts.map((p) => ({
        ...p,
        type: 'text' as const,
        communityId: `comm_${p.communitySlug}`,
        authorId: p.authorName,
        isPublic: true,
      })),
      snapshot.comments,
      10
    );
    topicPosts = context.rankedPosts.map((r) => {
      const found = snapshot.posts.find((sp) => sp.id === r.post.id);
      return (
        found || {
          id: r.post.id,
          title: r.post.title,
          snippet: (r.post.body || r.post.title).slice(0, 220),
          body: r.post.body || r.post.title,
          communitySlug: r.post.communitySlug,
          communityName: r.post.communityName,
          authorName: r.post.authorName,
          score: r.post.score,
          commentCount: r.post.commentCount,
          createdAt: r.post.createdAt,
          lastmod: toValidIsoDate(r.post.createdAt),
        }
      );
    });
    seoInput.topicHub = hub;
    seoInput.topicPosts = context.rankedPosts.map((r) => r.post);
  } else if (app === 'xonddit' && (communitySlug || postId)) {
    if (postId) {
      const foundPost = snapshot.posts.find((p) => p.id === postId);
      if (!foundPost) {
        return {
          meta: resolveSeoMetadata(seoInput),
          notFound: true,
        };
      }
      activePost = foundPost;
      activePostComments = snapshot.comments.filter((c) => c.postId === foundPost.id);
      seoInput.postTitle = foundPost.title;
      seoInput.postSnippet = foundPost.snippet;
      seoInput.postBody = foundPost.body;
      seoInput.postAuthor = foundPost.authorName;
      seoInput.postCreatedAt = foundPost.createdAt;
      seoInput.postScore = foundPost.score;
      seoInput.postCommentCount = Math.max(
        foundPost.commentCount,
        activePostComments.length
      );
      seoInput.postComments = activePostComments;
      seoInput.communitySlug = foundPost.communitySlug;
    } else if (communitySlug) {
      const foundComm = snapshot.communities.find((c) => c.slug === communitySlug);
      if (foundComm) {
        activeCommunity = foundComm;
        seoInput.communityName = foundComm.name;
        seoInput.communityDescription = foundComm.description;
      }
    }
  }

  return {
    meta: resolveSeoMetadata(seoInput),
    notFound: false,
    activePost,
    activePostComments,
    activeCommunity,
    activeTopicHub,
    topicPosts,
  };
}

export async function resolveServerSeoForRequest(
  query: Record<string, any>,
  firebaseProjectId?: string
): Promise<ResolvedSeoMetadata> {
  const res = await resolveServerSeoWithContext(query, firebaseProjectId);
  return res.meta;
}

export function injectSeoIntoHtml(
  templateHtml: string,
  meta: ResolvedSeoMetadata,
  communities: SitemapCommunityEntry[] = [],
  ssrContext?: {
    posts?: SitemapPostEntry[];
    activePost?: SitemapPostEntry;
    activePostComments?: Comment[];
    activeCommunity?: SitemapCommunityEntry;
    activeTopicHub?: TopicHubDefinition;
    topicPosts?: SitemapPostEntry[];
  }
): string {
  const gscToken = resolveGscVerificationToken();

  const hreflangTags = meta.hreflangs
    .map(
      (hl) =>
        `    <link rel="alternate" hreflang="${escapeHtml(hl.hreflang)}" href="${escapeHtml(
          hl.href
        )}" />`
    )
    .join('\n');

  const headBlock = [
    `<title>${escapeHtml(meta.title)}</title>`,
    `    <meta name="description" content="${escapeHtml(meta.description)}" />`,
    `    <meta name="application-name" content="Xongle" />`,
    `    <meta name="apple-mobile-web-app-title" content="Xongle" />`,
    `    <meta name="author" content="Xongle" />`,
    `    <meta name="publisher" content="Xongle (xongle.xyz)" />`,
    `    <meta name="keywords" content="Xongle, xongle, xongle haqida, xongle.xyz, xongle.xyz haqida, Xongle — Raqamli loyihalar arxivi, O‘zbekcha forum, O‘zbek tilida savol-javob, Kompyuter muammosini qanday hal qilish, Linux qanday o‘rganiladi, Dasturlashni qayerdan o‘rganish mumkin, Telefon muammosiga yechim, Xonddit" />`,
    `    <meta name="robots" content="${escapeHtml(meta.robots)}" />`,
    gscToken
      ? `    <meta name="google-site-verification" content="${escapeHtml(gscToken)}" />`
      : '',
    `    <link rel="canonical" href="${escapeHtml(meta.canonicalUrl)}" />`,
    hreflangTags,
    `    <meta property="og:type" content="${escapeHtml(meta.ogType)}" />`,
    `    <meta property="og:url" content="${escapeHtml(meta.canonicalUrl)}" />`,
    `    <meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    `    <meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `    <meta property="og:site_name" content="${escapeHtml(meta.ogSiteName)}" />`,
    `    <meta property="og:locale" content="${escapeHtml(meta.locale)}" />`,
    `    <meta property="og:image" content="${escapeHtml(meta.ogImageUrl)}" />`,
    `    <meta property="og:image:alt" content="${escapeHtml(meta.ogImageAlt)}" />`,
    `    <meta property="og:image:width" content="1200" />`,
    `    <meta property="og:image:height" content="630" />`,
    `    <meta name="twitter:card" content="summary_large_image" />`,
    `    <meta name="twitter:title" content="${escapeHtml(meta.title)}" />`,
    `    <meta name="twitter:description" content="${escapeHtml(meta.description)}" />`,
    `    <meta name="twitter:image" content="${escapeHtml(meta.ogImageUrl)}" />`,
    `    <meta name="twitter:image:alt" content="${escapeHtml(meta.ogImageAlt)}" />`,
    `    <script id="seo-json-ld" type="application/ld+json">${safeSerializeJsonLd(
      meta.jsonLd
    )}</script>`,
  ]
    .filter(Boolean)
    .join('\n');

  let html = templateHtml.replace(
    /<html[^>]*>/i,
    `<html lang="${escapeHtml(meta.lang)}" dir="${escapeHtml(meta.dir)}">`
  );

  // Strip static default SEO tags from template before injecting route-accurate tags
  html = html
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\s+name=["']description["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']application-name["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']apple-mobile-web-app-title["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']author["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']publisher["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']keywords["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']robots["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']google-site-verification["'][^>]*>/gi, '')
    .replace(/<link\s+rel=["']canonical["'][^>]*>/gi, '')
    .replace(/<link\s+rel=["']alternate["']\s+hreflang=[^>]*>/gi, '')
    .replace(/<meta\s+property=["']og:[^"']+["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']twitter:[^"']+["'][^>]*>/gi, '')
    .replace(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, '');

  const allPosts = ssrContext?.posts || buildBaselineSnapshot().posts;
  const activePost = ssrContext?.activePost;
  const activePostComments = ssrContext?.activePostComments || [];
  const activeCommunity = ssrContext?.activeCommunity;
  const activeTopicHub = ssrContext?.activeTopicHub;
  const topicPosts = ssrContext?.topicPosts || [];

  const topicHubsHtml = `<h3>O‘zbekcha Mavzular va Yo‘nalishlar (Topic Hubs)</h3><ul>${CURATED_TOPIC_HUBS.map(
    (hub) =>
      `<li><a href="/topics/${escapeHtml(hub.slug)}">${escapeHtml(
        hub.titleUz
      )}</a> — ${escapeHtml(hub.descriptionUz)}</li>`
  ).join('')}</ul>`;

  const commLinksHtml =
    communities.length > 0
      ? `<h3>Mavjud Ochiq Jamoalar (Public Communities)</h3><ul>${communities
          .slice(0, 12)
          .map(
            (c) =>
              `<li><a href="/c/${escapeHtml(c.slug)}">c/${escapeHtml(
                c.slug
              )} — ${escapeHtml(c.name)}</a>: ${escapeHtml(c.description.slice(0, 140))}</li>`
          )
          .join('')}</ul>`
      : '';

  const featuredDiscussionsHtml =
    allPosts.length > 0
      ? `<h3>Dolzarb O‘zbekcha Savol-Javob va Muhokamalar (Featured Discussions)</h3><ul>${allPosts
          .slice(0, 10)
          .map(
            (p) =>
              `<li><a href="/discussions/${escapeHtml(p.id)}">${escapeHtml(
                p.title
              )}</a> (<code>c/${escapeHtml(p.communitySlug)}</code> · muallif: <code>u/${escapeHtml(
                p.authorName.replace(/^u\//, '')
              )}</code> · ${p.score} ball): ${escapeHtml(p.snippet.slice(0, 150))}</li>`
          )
          .join('')}</ul>`
      : '';

  let ssrMainInner = '';

  if (activePost) {
    // 1. SSR FOR INDIVIDUAL DISCUSSION / QUESTION PAGE
    const bodyParagraphs = activePost.body
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join('');

    const commentsHtml =
      activePostComments.length > 0
        ? `<section aria-label="Community Answers and Comments"><h2>Hamjamiyat Javoblari va Izohlar (${
            activePostComments.length
          })</h2><ul>${activePostComments
            .map(
              (cm) =>
                `<li itemProp="comment" itemScope itemType="https://schema.org/Comment"><strong itemProp="author">u/${escapeHtml(
                  cm.authorName.replace(/^u\//, '')
                )}</strong> (<time itemProp="datePublished" dateTime="${escapeHtml(
                  cm.createdAt
                )}">${escapeHtml(toValidIsoDate(cm.createdAt))}</time> · ${
                  cm.score
                } ball): <span itemProp="text">${escapeHtml(cm.content)}</span></li>`
            )
            .join('')}</ul></section>`
        : '<section aria-label="Community Answers and Comments"><p>Ushbu muhokamada hozircha izohlar yo‘q. Xonddit orqali birinchi bo‘lib javob yozishingiz mumkin.</p></section>';

    const relatedInCommunity = allPosts
      .filter((p) => p.id !== activePost.id)
      .slice(0, 6);
    const relatedHtml =
      relatedInCommunity.length > 0
        ? `<section aria-label="Related Discussions"><h2>O‘xshash Savol-Javob va Muhokamalar</h2><ul>${relatedInCommunity
            .map(
              (rp) =>
                `<li><a href="/discussions/${escapeHtml(rp.id)}">${escapeHtml(
                  rp.title
                )}</a> (c/${escapeHtml(rp.communitySlug)})</li>`
            )
            .join('')}</ul></section>`
        : '';

    ssrMainInner = `<nav aria-label="Breadcrumb"><a href="/">Xongle</a> &rsaquo; <a href="/?app=xonddit">Xonddit</a> &rsaquo; <a href="/c/${escapeHtml(
      activePost.communitySlug
    )}">c/${escapeHtml(activePost.communitySlug)}</a> &rsaquo; <span>${escapeHtml(
      activePost.title
    )}</span></nav><article itemScope itemType="https://schema.org/DiscussionForumPosting"><header><h1 itemProp="headline">${escapeHtml(
      activePost.title
    )}</h1><p>Jamoa: <a href="/c/${escapeHtml(activePost.communitySlug)}">c/${escapeHtml(
      activePost.communitySlug
    )}</a> · Muallif: <span itemProp="author">u/${escapeHtml(
      activePost.authorName.replace(/^u\//, '')
    )}</span> · Sana: <time itemProp="datePublished" dateTime="${escapeHtml(
      activePost.createdAt
    )}">${escapeHtml(toValidIsoDate(activePost.createdAt))}</time> · Reyting: ${
      activePost.score
    } ball</p></header><div itemProp="articleBody">${bodyParagraphs}</div>${commentsHtml}</article>${relatedHtml}${topicHubsHtml}`;
  } else if (activeTopicHub) {
    // 2. SSR FOR TOPIC HUB PAGE (/topics/:slug)
    const hubDiscussionsHtml =
      topicPosts.length > 0
        ? `<section aria-label="Topic Discussions"><h2>Mavzuga Oid Tekshirilgan Muhokamalar va Yechimlar</h2><ul>${topicPosts
            .map(
              (tp) =>
                `<li><h3><a href="/discussions/${escapeHtml(tp.id)}">${escapeHtml(
                  tp.title
                )}</a></h3><p>Jamoa: <a href="/c/${escapeHtml(tp.communitySlug)}">c/${escapeHtml(
                  tp.communitySlug
                )}</a> · Muallif: u/${escapeHtml(
                  tp.authorName.replace(/^u\//, '')
                )} · ${tp.score} ball</p><p>${escapeHtml(tp.body.slice(0, 260))}...</p></li>`
            )
            .join('')}</ul></section>`
        : '';

    const hubQueriesHtml = `<section aria-label="Featured Topic Searches"><h2>Tez-tez beriladigan qidiruv so‘rovlari</h2><ul>${activeTopicHub.featuredQueries
      .map(
        (fq) =>
          `<li><a href="/?q=${encodeURIComponent(fq)}">${escapeHtml(fq)}</a></li>`
      )
      .join('')}</ul></section>`;

    ssrMainInner = `<nav aria-label="Breadcrumb"><a href="/">Xongle</a> &rsaquo; <span>${escapeHtml(
      activeTopicHub.titleUz
    )}</span></nav><header><h1>${escapeHtml(activeTopicHub.titleUz)}</h1><p>${escapeHtml(
      activeTopicHub.descriptionUz
    )}</p><p>${escapeHtml(
      activeTopicHub.descriptionEn
    )}</p></header>${hubDiscussionsHtml}${hubQueriesHtml}${topicHubsHtml}${commLinksHtml}`;
  } else if (activeCommunity) {
    // 3. SSR FOR COMMUNITY PAGE (/c/:slug)
    const commPosts = allPosts.filter(
      (p) => p.communitySlug.toLowerCase() === activeCommunity.slug.toLowerCase()
    );
    const commPostsHtml =
      commPosts.length > 0
        ? `<section aria-label="Community Discussions"><h2>c/${escapeHtml(
            activeCommunity.slug
          )} jamoasidagi muhokamalar</h2><ul>${commPosts
            .map(
              (cp) =>
                `<li><h3><a href="/discussions/${escapeHtml(cp.id)}">${escapeHtml(
                  cp.title
                )}</a></h3><p>Muallif: u/${escapeHtml(
                  cp.authorName.replace(/^u\//, '')
                )} · ${cp.score} ball · ${escapeHtml(cp.snippet)}</p></li>`
            )
            .join('')}</ul></section>`
        : '';

    ssrMainInner = `<nav aria-label="Breadcrumb"><a href="/">Xongle</a> &rsaquo; <a href="/?app=xonddit">Xonddit</a> &rsaquo; <span>c/${escapeHtml(
      activeCommunity.slug
    )}</span></nav><header><h1>c/${escapeHtml(activeCommunity.slug)} — ${escapeHtml(
      activeCommunity.name
    )}</h1><p>${escapeHtml(
      activeCommunity.description
    )}</p></header>${commPostsHtml}${topicHubsHtml}${commLinksHtml}`;
  } else {
    // 4. SSR FOR HOMEPAGE (/), /about, AND GENERAL ROUTES
    ssrMainInner = `<header><h1 itemProp="name">${escapeHtml(
      meta.h1
    )}</h1><p itemProp="description">${escapeHtml(
      meta.description
    )}</p><p><strong>Xongle — Raqamli loyihalar arxivi</strong> (<a itemProp="url" href="https://xongle.xyz/">https://xongle.xyz/</a>). <strong>Xongle</strong> — foydalanuvchilarga kerakli ommaviy materiallarni topishga yordam beruvchi markaziy kashfiyot platformasi.</p><nav aria-label="Xongle Platform Navigation"><a href="/">Xongle</a> | <a href="/about">About Xongle &amp; FAQ</a> | <a href="/?app=xonddit">Xonddit Communities</a></nav></header><section><h2>Xongle haqida (xongle.xyz haqida) — AI Xulosasi va Asosiy Xususiyatlari</h2><p><strong>Xongle (xongle.xyz)</strong> — bu ommaviy Xonddit jamoalari (<code>c/</code>), muhokama mavzulari (tredlar) va sharhlarni real vaqt rejimida qidirish imkonini beruvchi rasmiy qidiruv tizimidir.</p><p>Ushbu platformaning asosiy xususiyatlari:</p><ul><li><strong>Real vaqtda indekslash:</strong> Platforma Xonddit tizimidagi ommaviy postlar va sharhlarni real vaqt rejimida indekslab boradi.</li><li><strong>Erkin qidiruv va O‘zbekcha AI Javob Tizimi:</strong> Foydalanuvchilar tizimga kirmasdan (akkountsiz) o‘zbek (lotin va kirill), rus hamda ingliz tillarida savol berishlari, mavzularni dolzarbligi, yangiligi yoki ommabopligi bo‘yicha qidirishlari va manbalarga asoslangan AI xulosalarini olishlari mumkin.</li><li><strong>Mavjud jamoalar:</strong> Saytda turli jamoalar (masalan, <code>c/xonddit</code>, <code>c/xongle</code>, <code>c/dasturlash</code>, <code>c/linux</code>, <code>c/texnologiya</code>, <code>c/tor</code>, <code>c/nftscam</code>) mavjud bo‘lib, ular doirasida qidiruv va muhokamalar olib boriladi.</li></ul><h3>Xongle platformasi haqida qo‘shimcha ma’lumotlar</h3><ul><li><strong>Undagi qidiruv mexanizmlari qanday ishlashi:</strong> Xongle qidiruv tizimi Xonddit jamoalaridagi ommaviy postlar va sharhlarni bir zumda qidiradi hamda natijalarni dolzarbligi (Relevance), ommabopligi (Top) yoki yangiligi (Newest) bo‘yicha saralaydi.</li><li><strong>Xonddit jamoalari bilan bog‘liqligi:</strong> Xongle va Xonddit yagona platforma bo‘lib, Xongle qidiruv tizimi Xonddit (<code>/?app=xonddit</code>) dagi barcha ommaviy <code>c/</code> jamoalar va muhokama tredlarini bog‘laydi.</li><li><strong>Platformaning boshqa qidiruv tizimlaridan farqi:</strong> Xongle (https://xongle.xyz/) mustaqil veb-ilova va jamoaviy qidiruv tizimi bo‘lib (Wikipedia maqolasi emas), foydalanuvchilarga akkountsiz erkin qidiruv va real vaqtda jamoaviy muhokamalarni topish imkonini beradi.</li></ul>${topicHubsHtml}${featuredDiscussionsHtml}${commLinksHtml}</section>`;
  }

  const ssrCrawlableContent = `<div id="root"><main itemScope itemType="https://schema.org/WebApplication" style="max-width:768px;margin:0 auto;padding:32px 16px;font-family:system-ui,-apple-system,sans-serif;background:#ffffff;color:#171717;">${ssrMainInner}</main></div>`;

  html = html.replace('</head>', `${headBlock}\n  </head>`);
  html = html.replace(/<div id="root">[\s\S]*?<\/div>/i, ssrCrawlableContent);

  return html;
}

export function renderNotFoundHtml(requestedPath: string, envAppUrl?: string): string {
  const baseUrl = resolveProductionBaseUrl(envAppUrl);
  const safePath = escapeHtml(requestedPath.slice(0, 120));
  return `<!doctype html>
<html lang="en" dir="ltr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>404 — Page Not Found | Xongle</title>
    <meta name="description" content="The requested page could not be found on Xongle (https://xongle.xyz/)." />
    <meta name="robots" content="noindex, nofollow" />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <style>
      body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #090b0e; color: #f3f4f6; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
      main { max-width: 520px; width: 100%; background: #12151c; border: 1px solid #262b36; border-radius: 16px; padding: 32px; }
      h1 { margin: 0 0 8px; font-size: 24px; font-weight: 800; }
      p { margin: 0 0 20px; font-size: 14px; color: #9ca3af; line-height: 1.6; }
      nav { display: flex; flex-wrap: wrap; gap: 10px; }
      a { display: inline-block; padding: 9px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; text-decoration: none; background: #1f2430; color: #fff; border: 1px solid #2e3646; }
      a.primary { background: #ea580c; border-color: #ea580c; }
    </style>
  </head>
  <body>
    <main>
      <h1>404 — Page Not Found</h1>
      <p>The path <code>${safePath}</code> does not exist on Xongle (https://xongle.xyz/). Choose a destination below to continue:</p>
      <nav aria-label="Error recovery navigation">
        <a class="primary" href="${escapeHtml(baseUrl)}/">Open Xongle Search</a>
        <a href="/about">About Xongle &amp; FAQ</a>
        <a href="/?app=xonddit">Browse Xonddit Communities</a>
      </nav>
    </main>
  </body>
</html>`;
}
