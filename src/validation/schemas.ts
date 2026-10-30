import { z } from 'zod';

/**
 * Validates that a URL is strictly http:// or https:// and does not contain
 * dangerous XSS schemes (javascript:, data:, vbscript:, file:).
 */
export function isSafeHttpUrl(val?: string | null): boolean {
  if (!val || val.trim() === '') return true;
  const clean = val.trim();
  if (clean.length > 2048) return false;
  try {
    const parsed = new URL(clean);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      !/[\s<>"]/.test(clean)
    );
  } catch {
    return false;
  }
}

/**
 * Returns a safe HTTP/HTTPS URL or undefined if unsafe/invalid.
 * Used in React components before rendering <a href="..."> to prevent XSS.
 */
export function getSafeHref(val?: string | null): string | undefined {
  if (!val || !isSafeHttpUrl(val)) return undefined;
  return val.trim();
}

/**
 * Validates that an image URL is either a safe HTTP(S) URL or a raster base64 data URL
 * (explicitly rejecting data:image/svg+xml which can embed executable <script> tags).
 */
export function isSafeImageSource(val?: string | null): boolean {
  if (!val || val.trim() === '') return true;
  const clean = val.trim();
  if (clean.length > 200000) return false;
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(clean)) {
    return true;
  }
  return isSafeHttpUrl(clean);
}

export function getSafeImageSrc(val?: string | null): string | undefined {
  if (!val || !isSafeImageSource(val)) return undefined;
  return val.trim();
}

/**
 * Validates safe Firestore document IDs / query identifiers to prevent
 * path traversal (../) and NoSQL injection.
 */
export const safeDocumentIdSchema = z
  .string()
  .trim()
  .min(1, 'Identifier is required')
  .max(128, 'Identifier must not exceed 128 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Identifier contains invalid characters');

export const optionalSafeHttpUrl = z
  .string()
  .trim()
  .max(2048, 'URL must not exceed 2048 characters')
  .optional()
  .refine((val) => isSafeHttpUrl(val), {
    message: 'Must be a valid HTTP or HTTPS URL',
  })
  .transform((val) => (val && val !== '' ? val : undefined));

export const optionalSafeImageUrl = z
  .string()
  .trim()
  .max(200000, 'Image data must not exceed 200KB')
  .optional()
  .refine((val) => isSafeImageSource(val), {
    message: 'Must be a valid HTTPS image URL or raster base64 image (PNG, JPEG, WebP, GIF)',
  })
  .transform((val) => (val && val !== '' ? val : undefined));

// -------------------------------------------------------------
// 1. COMMUNITY CREATION SCHEMA (Strict Field Allowlist)
// -------------------------------------------------------------
export const communityCreationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Community name must be at least 2 characters')
      .max(30, 'Community name must be at most 30 characters'),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(2, 'Slug must be at least 2 characters')
      .max(30, 'Slug must be at most 30 characters')
      .regex(/^[a-z0-9_]+$/, 'Slug can only contain lowercase alphanumeric characters and underscores'),
    title: z
      .string()
      .trim()
      .min(2, 'Title headline must be at least 2 characters')
      .max(80, 'Title headline must be at most 80 characters'),
    description: z
      .string()
      .trim()
      .max(500, 'Description must not exceed 500 characters')
      .default(''),
    iconUrl: optionalSafeHttpUrl,
    bannerUrl: optionalSafeHttpUrl,
    creatorName: z
      .string()
      .trim()
      .min(1, 'Creator name is required')
      .max(50, 'Creator name must be at most 50 characters'),
  })
  .strict();

// -------------------------------------------------------------
// 2. POST CREATION SCHEMA (Strict Field Allowlist - Blocks score/authorId tampering)
// -------------------------------------------------------------
export const postCreationSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Title must be at least 3 characters')
      .max(300, 'Title must be at most 300 characters'),
    body: z
      .string()
      .trim()
      .max(20000, 'Post body must not exceed 20,000 characters')
      .optional(),
    type: z.enum(['text', 'link', 'image']),
    linkUrl: optionalSafeHttpUrl,
    imageUrl: optionalSafeImageUrl,
    communityId: safeDocumentIdSchema,
    communitySlug: z
      .string()
      .trim()
      .toLowerCase()
      .min(2)
      .max(50)
      .regex(/^[a-z0-9_]+$/, 'Invalid community slug'),
    communityName: z.string().trim().min(1).max(50),
    authorName: z.string().trim().min(1).max(50),
    flair: z.string().trim().max(30).optional(),
  })
  .strict();

// -------------------------------------------------------------
// 3. COMMENT CREATION SCHEMA (Strict Field Allowlist)
// -------------------------------------------------------------
export const commentCreationSchema = z
  .object({
    postId: safeDocumentIdSchema,
    communityId: safeDocumentIdSchema,
    content: z
      .string()
      .trim()
      .min(1, 'Comment cannot be empty')
      .max(5000, 'Comment must not exceed 5000 characters'),
    authorName: z.string().trim().min(1).max(50),
    parentId: safeDocumentIdSchema.optional(),
  })
  .strict();

// -------------------------------------------------------------
// 4. USER PROFILE UPDATE SCHEMA (Strict Field Allowlist - Blocks role/uid tampering)
// -------------------------------------------------------------
export const userProfileUpdateSchema = z
  .object({
    username: z
      .string()
      .trim()
      .transform((val) => val.replace(/^u\//, '').toLowerCase())
      .refine((val) => /^[a-z0-9_]{3,25}$/.test(val), {
        message: 'Username must be 3-25 lowercase alphanumeric or underscore characters',
      }),
    displayName: z
      .string()
      .trim()
      .min(1, 'Display name is required')
      .max(40, 'Display name must be at most 40 characters'),
    bio: z.string().trim().max(300, 'Bio must not exceed 300 characters').optional().default(''),
    photoURL: z
      .string()
      .trim()
      .max(200000, 'Profile photo exceeds maximum size')
      .optional()
      .refine((val) => isSafeImageSource(val), {
        message: 'Invalid profile image format',
      })
      .default(''),
  })
  .strict();

// -------------------------------------------------------------
// 5. SERVER API SCHEMAS (Zod Validation for Express Endpoints)
// -------------------------------------------------------------
export const xondditMatchItemSchema = z
  .object({
    id: z.string().max(160),
    type: z.enum(['post', 'community', 'comment']),
    title: z.string().max(400),
    snippet: z.string().max(2000).default(''),
    communitySlug: z.string().max(60).optional(),
    targetCommunitySlug: z.string().max(60).optional(),
    targetPostId: z.string().max(160).optional(),
    author: z.string().max(100).optional(),
    authorName: z.string().max(100).optional(),
    score: z.number().optional(),
    commentCount: z.number().optional(),
    source: z.string().max(40).optional(),
    url: z.string().max(500).optional(),
    createdAt: z.string().max(80).optional(),
    matchScore: z.number().optional(),
  })
  .strip();

export const xonminiChatRequestSchema = z
  .object({
    messages: z
      .array(
        z
          .object({
            id: z.string().max(100).optional(),
            role: z.enum(['user', 'model']),
            text: z.string().trim().min(1).max(4000),
            createdAt: z.string().max(80).optional(),
            sources: z.array(z.any()).optional(),
          })
          .strip()
      )
      .max(50)
      .optional(),
    prompt: z.string().trim().max(4000).optional(),
    mode: z.enum(['balanced', 'deep', 'creative']).default('balanced'),
    platformContext: z.string().max(30000).default(''),
    xondditMatches: z.array(xondditMatchItemSchema).max(25).default([]),
    _hp: z.string().max(0, 'Bot honeypot triggered').optional(),
  })
  .strict();

export const ALLOWED_OWNER_ACTIONS = [
  'clear_cache',
  'sync_search_index',
  'delete_post',
  'toggle_community_verification',
  'toggle_maintenance',
  'update_settings',
  'broadcast_notification',
  'export_backup',
  'run_security_audit',
  'rotate_session_keys',
  'purge_inactive_sessions',
  'ban_user',
  'suspend_user',
  'verify_user',
] as const;

export const ownerVerifyRequestSchema = z
  .object({
    email: z.string().email().max(160).optional(),
    _hp: z.string().max(0).optional(),
  })
  .strict();

export const ownerActionRequestSchema = z
  .object({
    email: z.string().email().max(160).optional(),
    action: z.enum(ALLOWED_OWNER_ACTIONS),
    payload: z
      .record(z.string(), z.union([z.string().max(500), z.number(), z.boolean(), z.null()]))
      .optional()
      .default({}),
    _hp: z.string().max(0).optional(),
  })
  .strict();

export const snakeLeaderboardQuerySchema = z.object({
  difficulty: z.enum(['easy', 'normal', 'hard', 'extreme']).optional(),
});

export const snakeLeaderboardSubmissionSchema = z
  .object({
    playerName: z
      .string()
      .trim()
      .min(1)
      .max(16)
      .regex(/^[a-zA-Z0-9_-]+$/, 'Player name must be alphanumeric'),
    score: z.number().int().min(1).max(999999),
    apples: z.number().int().min(0).max(10000).default(0),
    difficulty: z.enum(['easy', 'normal', 'hard', 'extreme']).default('normal'),
    wallMode: z.enum(['solid', 'wrap']).default('solid'),
    durationSec: z.number().int().min(1).max(86400).default(1),
    _hp: z.string().max(0).optional(),
  })
  .strict();

export const snakeRoomCreateSchema = z
  .object({
    playerId: safeDocumentIdSchema.optional(),
    playerName: z.string().trim().min(1).max(16).default('OPERATIVE'),
    difficulty: z.enum(['easy', 'normal', 'hard', 'extreme']).default('normal'),
    wallMode: z.enum(['solid', 'wrap']).default('solid'),
  })
  .strict();

export const snakeRoomJoinSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{4,8}$/, 'Invalid room code'),
    playerId: safeDocumentIdSchema.optional(),
    playerName: z.string().trim().min(1).max(16).default('OPERATIVE'),
  })
  .strict();

export const snakeRoomActionSchema = z
  .object({
    playerId: safeDocumentIdSchema,
    playerToken: z.string().max(256).optional(),
    action: z.enum(['leave', 'toggle_ready', 'set_settings', 'start_match', 'return_lobby', 'direction']),
    direction: z.enum(['UP', 'DOWN', 'LEFT', 'RIGHT']).optional(),
    difficulty: z.enum(['easy', 'normal', 'hard', 'extreme']).optional(),
    wallMode: z.enum(['solid', 'wrap']).optional(),
  })
  .strict();

export const uploadValidationRequestSchema = z
  .object({
    fileName: z.string().trim().min(1).max(120),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
    sizeBytes: z.number().int().min(1).max(2 * 1024 * 1024),
    headerHex: z.string().trim().min(8).max(64).regex(/^[0-9a-fA-F]+$/),
  })
  .strict();
