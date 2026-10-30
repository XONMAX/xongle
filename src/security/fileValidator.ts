/**
 * File Upload Security & Magic-Byte Signature Verification (Requirement 16)
 *
 * Enforces:
 * 1. Maximum file size <= 2 MB (2,097,152 bytes)
 * 2. Strict extension allowlist (.jpg, .jpeg, .png, .webp, .gif)
 * 3. Strict MIME type allowlist (image/jpeg, image/png, image/webp, image/gif) — blocks SVG & HTML
 * 4. Binary file header (magic bytes) verification to prevent spoofed extensions
 * 5. Filename sanitization to prevent path traversal (../, \, null bytes)
 */

export const MAX_IMAGE_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export const ALLOWED_IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
]);

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  detectedFormat?: 'jpeg' | 'png' | 'webp' | 'gif';
  safeFilename?: string;
  headerHex?: string;
}

/**
 * Sanitizes an untrusted filename, stripping path traversal sequences, directory separators,
 * null bytes, and special characters, and generating a safe alphanumeric filename.
 */
export function sanitizeFilename(rawName: string): string {
  const base = String(rawName || 'upload')
    .replace(/\0/g, '')
    .split(/[/\\]/)
    .pop() || 'upload';

  const extMatch = base.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif)$/);
  const ext = extMatch ? `.${extMatch[1]}` : '.jpg';
  const stem = base
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 40) || 'image';

  return `${stem}_${Date.now()}${ext}`;
}

/**
 * Inspects the first 12 bytes (or hex representation) of a file buffer to verify
 * that its binary magic bytes match an allowed raster image format (JPEG, PNG, GIF, WebP).
 */
export function verifyImageMagicBytes(bytes: Uint8Array): {
  valid: boolean;
  format?: 'jpeg' | 'png' | 'webp' | 'gif';
  headerHex: string;
} {
  const slice = bytes.slice(0, 12);
  const headerHex = Array.from(slice)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toLowerCase();

  if (slice.length < 4) {
    return { valid: false, headerHex };
  }

  // JPEG: FF D8 FF
  if (slice[0] === 0xff && slice[1] === 0xd8 && slice[2] === 0xff) {
    return { valid: true, format: 'jpeg', headerHex };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    slice.length >= 8 &&
    slice[0] === 0x89 &&
    slice[1] === 0x50 &&
    slice[2] === 0x4e &&
    slice[3] === 0x47 &&
    slice[4] === 0x0d &&
    slice[5] === 0x0a &&
    slice[6] === 0x1a &&
    slice[7] === 0x0a
  ) {
    return { valid: true, format: 'png', headerHex };
  }

  // GIF87a / GIF89a: 47 49 46 38 (37|39) 61
  if (
    slice.length >= 6 &&
    slice[0] === 0x47 &&
    slice[1] === 0x49 &&
    slice[2] === 0x46 &&
    slice[3] === 0x38 &&
    (slice[4] === 0x37 || slice[4] === 0x39) &&
    slice[5] === 0x61
  ) {
    return { valid: true, format: 'gif', headerHex };
  }

  // WebP: RIFF....WEBP -> 52 49 46 46 xx xx xx xx 57 45 42 50
  if (
    slice.length >= 12 &&
    slice[0] === 0x52 &&
    slice[1] === 0x49 &&
    slice[2] === 0x46 &&
    slice[3] === 0x46 &&
    slice[8] === 0x57 &&
    slice[9] === 0x45 &&
    slice[10] === 0x42 &&
    slice[11] === 0x50
  ) {
    return { valid: true, format: 'webp', headerHex };
  }

  return { valid: false, headerHex };
}

export function verifyImageHeaderHex(headerHex: string): {
  valid: boolean;
  format?: 'jpeg' | 'png' | 'webp' | 'gif';
} {
  const clean = headerHex.trim().replace(/[^0-9a-fA-F]/g, '');
  if (clean.length < 8) return { valid: false };
  const bytes = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  const res = verifyImageMagicBytes(bytes);
  return { valid: res.valid, format: res.format };
}

/**
 * Validates a browser `File` object (extension, MIME type, size, and binary magic bytes).
 */
export async function validateImageUploadFile(
  file: File,
  maxBytes = MAX_IMAGE_UPLOAD_BYTES
): Promise<FileValidationResult> {
  if (!file) {
    return { valid: false, error: 'No file provided.' };
  }

  if (file.size <= 0) {
    return { valid: false, error: 'Uploaded file is empty.' };
  }

  if (file.size > maxBytes) {
    const maxMb = (maxBytes / (1024 * 1024)).toFixed(1);
    return { valid: false, error: `File size exceeds maximum limit of ${maxMb}MB.` };
  }

  const lowerName = file.name.toLowerCase();
  const extMatch = lowerName.match(/\.[a-z0-9]+$/);
  const ext = extMatch ? extMatch[0] : '';

  if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: 'Unsupported file extension. Allowed: .jpg, .jpeg, .png, .webp, .gif (SVG and executables are blocked).',
    };
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    return {
      valid: false,
      error: 'Unsupported MIME type. Only JPEG, PNG, WebP, and GIF raster images are allowed.',
    };
  }

  try {
    const headerBuffer = await file.slice(0, 12).arrayBuffer();
    const headerBytes = new Uint8Array(headerBuffer);
    const sigCheck = verifyImageMagicBytes(headerBytes);

    if (!sigCheck.valid || !sigCheck.format) {
      return {
        valid: false,
        error: 'File signature (magic bytes) does not match a valid image file.',
      };
    }

    return {
      valid: true,
      detectedFormat: sigCheck.format,
      safeFilename: sanitizeFilename(file.name),
      headerHex: sigCheck.headerHex,
    };
  } catch {
    return {
      valid: false,
      error: 'Failed to inspect file binary signature.',
    };
  }
}
