import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  isSafeHttpUrl,
  isSafeImageSource,
  getSafeHref,
  communityCreationSchema,
  postCreationSchema,
  commentCreationSchema,
  userProfileUpdateSchema,
  ownerActionRequestSchema,
  xonminiChatRequestSchema,
  safeDocumentIdSchema,
} from '../src/validation/schemas';
import {
  hashPassword,
  verifyPassword,
  createSignedSessionToken,
  verifySignedSessionToken,
  revokeSessionToken,
  serializeSecureCookie,
  createCsrfToken,
  verifyCsrfToken,
  verifyFirebaseIdToken,
  createPlayerRoomToken,
  verifyPlayerRoomToken,
} from '../src/security/crypto';
import {
  verifyImageMagicBytes,
  verifyImageHeaderHex,
  sanitizeFilename,
} from '../src/security/fileValidator';

describe('Security Controls Verification Suite', () => {
  describe('1. XSS & Malicious URL Prevention (Req 14, 15)', () => {
    it('blocks javascript:, data:text/html, vbscript:, and SVG XSS vectors in URLs', () => {
      assert.equal(isSafeHttpUrl('javascript:alert(document.cookie)'), false);
      assert.equal(isSafeHttpUrl('JAVASCRIPT:alert(1)'), false);
      assert.equal(isSafeHttpUrl('data:text/html,<script>alert(1)</script>'), false);
      assert.equal(isSafeHttpUrl('vbscript:msgbox(1)'), false);
      assert.equal(getSafeHref('javascript:void(0)'), undefined);
      assert.equal(isSafeHttpUrl('https://xongle.web.app/search?q=test'), true);
    });

    it('blocks SVG data URLs while allowing safe raster image data URLs', () => {
      assert.equal(
        isSafeImageSource('data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIj48L3N2Zz4='),
        false
      );
      assert.equal(
        isSafeImageSource('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),
        true
      );
    });
  });

  describe('2. Field Tampering & Mass Assignment Prevention (Req 8, 14)', () => {
    it('rejects injected privileged fields on community creation', () => {
      const payloadWithInjectedFields = {
        name: 'SecOps',
        slug: 'secops',
        title: 'Application Security',
        description: 'Security engineering discussions',
        creatorName: 'u/alice',
        isVerified: true, // Tampered field
        postCount: 9999, // Tampered field
      };
      const res = communityCreationSchema.safeParse(payloadWithInjectedFields);
      assert.equal(res.success, false);
    });

    it('rejects injected score or authorId tampering on post creation', () => {
      const tamperedPost = {
        title: 'Valid Post Title',
        type: 'text',
        communityId: 'comm_secops_1',
        communitySlug: 'secops',
        communityName: 'SecOps',
        authorName: 'u/alice',
        score: 999999, // Mass-assignment attempt
        authorId: 'spoofed_uid', // Identity spoofing attempt
      };
      const res = postCreationSchema.safeParse(tamperedPost);
      assert.equal(res.success, false);
    });

    it('rejects unauthorized owner actions not on the strict allowlist', () => {
      const invalidAction = ownerActionRequestSchema.safeParse({
        action: 'drop_all_tables',
        payload: {},
      });
      assert.equal(invalidAction.success, false);

      const validAction = ownerActionRequestSchema.safeParse({
        action: 'clear_cache',
        payload: {},
      });
      assert.equal(validAction.success, true);
    });

    it('rejects bot honeypot payloads on chat endpoint', () => {
      const botPayload = xonminiChatRequestSchema.safeParse({
        prompt: 'hello',
        _hp: 'filled-by-automated-bot',
      });
      assert.equal(botPayload.success, false);
    });

    it('blocks path traversal and NoSQL injection characters in document IDs (Req 7, 13)', () => {
      assert.equal(safeDocumentIdSchema.safeParse('../../../admin_root').success, false);
      assert.equal(safeDocumentIdSchema.safeParse('post_123$ne').success, false);
      assert.equal(safeDocumentIdSchema.safeParse('post_170000_abc12').success, true);
    });
  });

  describe('3. Password Hashing & Timing-Safe Verification (Req 10)', () => {
    it('hashes passwords with unique salts using memory-hard scrypt and verifies accurately', async () => {
      const hash1 = await hashPassword('CorrectHorseBatteryStaple!99');
      const hash2 = await hashPassword('CorrectHorseBatteryStaple!99');
      assert.notEqual(hash1, hash2, 'Salts must be unique per hash');
      assert.equal(hash1.startsWith('scrypt$16384$8$1$'), true);

      const valid = await verifyPassword('CorrectHorseBatteryStaple!99', hash1);
      const invalid = await verifyPassword('WrongPassword!99', hash1);
      assert.equal(valid, true);
      assert.equal(invalid, false);
    });
  });

  describe('4. Session Cookies, CSRF & JWT Authentication Verification (Req 6, 7, 9)', () => {
    it('signs, verifies, and revokes HttpOnly session tokens and rejects tampered tokens', () => {
      const { token, payload } = createSignedSessionToken({
        uid: 'user_123',
        email: 'aminbek785@gmail.com',
        role: 'owner',
        ttlSeconds: 3600,
      });

      const verified = verifySignedSessionToken(token);
      assert.ok(verified);
      assert.equal(verified.email, 'aminbek785@gmail.com');

      // Tamper with payload
      const tampered = token.replace(token.split('.')[0], Buffer.from('{"role":"owner","email":"hacker@evil.com","exp":9999999999}').toString('base64url'));
      assert.equal(verifySignedSessionToken(tampered), null);

      // Revoke token on logout
      revokeSessionToken(token);
      assert.equal(verifySignedSessionToken(token), null);

      // Check cookie attributes
      const cookieHeader = serializeSecureCookie('xongle_session', token, {
        maxAgeSec: 3600,
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      });
      assert.ok(cookieHeader.includes('HttpOnly'));
      assert.ok(cookieHeader.includes('Secure'));
      assert.ok(cookieHeader.includes('SameSite=Lax'));
      assert.ok(cookieHeader.includes('Max-Age=3600'));

      // Check CSRF token bound to session jti
      const csrf = createCsrfToken(payload.jti);
      assert.equal(verifyCsrfToken(csrf, payload.jti), true);
      assert.equal(verifyCsrfToken(csrf, 'different_session_jti'), false);
    });

    it('rejects unsigned or forged Firebase JWT tokens', async () => {
      const fakeHeader = Buffer.from(JSON.stringify({ alg: 'none', kid: 'fake' })).toString('base64url');
      const fakePayload = Buffer.from(
        JSON.stringify({
          sub: 'owner_uid',
          email: 'aminbek785@gmail.com',
          email_verified: true,
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        })
      ).toString('base64url');
      const forgedToken = `${fakeHeader}.${fakePayload}.fakesignature`;

      const verified = await verifyFirebaseIdToken(forgedToken, 'test-project');
      assert.equal(verified, null);
    });

    it('prevents multiplayer room player IDOR via HMAC player tokens', () => {
      const token = createPlayerRoomToken('ABCD12', 'player_1');
      assert.equal(verifyPlayerRoomToken('ABCD12', 'player_1', token), true);
      assert.equal(verifyPlayerRoomToken('ABCD12', 'player_2', token), false);
    });
  });

  describe('5. File Upload Magic-Byte & Path Traversal Protection (Req 16)', () => {
    it('validates real PNG/JPEG magic bytes and rejects spoofed executables or SVGs', () => {
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
      const pngRes = verifyImageMagicBytes(pngBytes);
      assert.equal(pngRes.valid, true);
      assert.equal(pngRes.format, 'png');

      // SVG / HTML text file disguised as .png
      const svgBytes = new TextEncoder().encode('<svg onload="alert(1)"></svg>');
      const svgRes = verifyImageMagicBytes(svgBytes);
      assert.equal(svgRes.valid, false);

      assert.equal(verifyImageHeaderHex('ffd8ffe000104a4649460001').valid, true);
      assert.equal(verifyImageHeaderHex('4d5a90000300000004000000').valid, false); // MZ Windows EXE
    });

    it('sanitizes filenames against path traversal sequences', () => {
      const safe = sanitizeFilename('../../../etc/passwd\0.png');
      assert.equal(safe.includes('..'), false);
      assert.equal(safe.includes('/'), false);
      assert.equal(safe.includes('\0'), false);
      assert.ok(safe.endsWith('.png'));
    });
  });

  describe('6. Firestore & Storage RLS Rules Invariant Audit (Req 4, 7)', () => {
    it('enforces deny-by-default and contains no unrestricted allow read, write: if true rules', () => {
      const firestoreRules = fs.readFileSync('./firestore.rules', 'utf8');
      const storageRules = fs.readFileSync('./storage.rules', 'utf8');

      assert.ok(firestoreRules.includes('allow read, write: if false;'));
      assert.ok(storageRules.includes('allow read, write: if false;'));
      assert.equal(/allow\s+read\s*,\s*write\s*:\s*if\s+true\s*;/.test(firestoreRules), false);
      assert.equal(/allow\s+read\s*,\s*write\s*:\s*if\s+true\s*;/.test(storageRules), false);
      assert.ok(firestoreRules.includes('exists(/databases/$(database)/documents/communities/$(data.communityId))'));
      assert.ok(firestoreRules.includes("voteId == (request.auth.uid + '_' + data.targetId)"));
      assert.ok(firestoreRules.includes('request.auth.token.email_verified == true'));
      assert.ok(firestoreRules.includes('isValidConversation(incoming())'));
      assert.ok(firestoreRules.includes('isValidMessage(incoming())'));
    });
  });

  describe('7. Google Drive OAuth Least-Privilege, Zip Slip & Backup Security', () => {
    it('does not request Google Drive scope on standard user sign-in in firebase/config.ts or AuthBridgePopup.tsx', () => {
      const firebaseConfigSrc = fs.readFileSync('./src/firebase/config.ts', 'utf8');
      const authBridgeSrc = fs.readFileSync('./src/components/AuthBridgePopup.tsx', 'utf8');

      // Standard signInWithGoogle must use requireDriveScope: false
      assert.equal(
        firebaseConfigSrc.includes('signInViaAuthorizedBridge({ requireDriveScope: false })'),
        true
      );
      // AuthBridgePopup must default to basic scope unless scope === 'drive'
      assert.equal(
        authBridgeSrc.includes("const scopeMode = params.get('scope') === 'drive' ? 'drive' : 'basic';"),
        true
      );
    });

    it('blocks Zip Slip path traversal entries and validates Google Drive file IDs & log redaction', async () => {
      const {
        isSafeArchiveEntryPath,
        isValidGoogleDriveFileId,
        redactSensitiveLogText,
        inspectAndValidateBackupZip,
      } = await import('../src/backup/backupService');
      const JSZip = (await import('jszip')).default;

      assert.equal(isSafeArchiveEntryPath('Xongle-Backup-2026/manifest.json'), true);
      assert.equal(isSafeArchiveEntryPath('../../../etc/passwd'), false);
      assert.equal(isSafeArchiveEntryPath('/etc/shadow'), false);
      assert.equal(isSafeArchiveEntryPath('folder/../../secret.env'), false);
      assert.equal(isSafeArchiveEntryPath('C:\\Windows\\System32\\cmd.exe'), false);

      assert.equal(isValidGoogleDriveFileId('1aBcDeFgHiJkLmNoPqRsTuVwXyZ_012345'), true);
      assert.equal(isValidGoogleDriveFileId('../invalid/file/id'), false);
      assert.equal(isValidGoogleDriveFileId('short'), false);

      const redacted = redactSensitiveLogText(
        'Error with token ya29.a0AfH6SMBx1234567890 and key AIzaSyB12345678901234567890123456789012'
      );
      assert.equal(redacted.includes('ya29.a0AfH6SMBx1234567890'), false);
      assert.equal(redacted.includes('[REDACTED_OAUTH_TOKEN]'), true);
      assert.equal(redacted.includes('[REDACTED_API_KEY]'), true);

      // Verify malicious Zip Slip archive is rejected during inspection
      const maliciousZip = new JSZip();
      maliciousZip.file('../../etc/passwd', 'root:x:0:0:root:/root:/bin/bash');
      maliciousZip.file('manifest.json', JSON.stringify({ appName: 'Xongle', files: {} }));
      const zipBuf = await maliciousZip.generateAsync({ type: 'nodebuffer' });

      await assert.rejects(
        async () => {
          await inspectAndValidateBackupZip(zipBuf);
        },
        /Unsafe archive path detected in ZIP/
      );
    });
  });

  describe('8. Zero-Animation & Pre-Publish Audit Invariants', () => {
    it('enforces zero animations, transitions, keyframes, and framer-motion across all src files and package.json', () => {
      const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
      assert.equal(Boolean(pkg.dependencies?.['framer-motion']), false);
      assert.equal(Boolean(pkg.dependencies?.['motion']), false);

      const walkSrc = (dir: string, list: string[] = []): string[] => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = `${dir}/${entry.name}`;
          if (entry.isDirectory()) walkSrc(full, list);
          else if (/\.(ts|tsx|css)$/i.test(entry.name)) list.push(full);
        }
        return list;
      };

      const srcFiles = walkSrc('./src');
      const forbiddenPatterns = [
        { label: 'framer-motion import', regex: /from\s+['"]framer-motion['"]/ },
        { label: 'motion package import', regex: /from\s+['"]motion(\/react)?['"]/ },
        { label: 'CSS @keyframes', regex: /@keyframes\s+/ },
        { label: 'Tailwind animate-* class', regex: /\banimate-(spin|pulse|bounce|ping|fade-up)\b/ },
        { label: 'Tailwind transition-* class', regex: /\btransition-(all|colors|transform|opacity|shadow)\b/ },
        { label: 'Smooth scroll behavior', regex: /scroll-behavior\s*:\s*smooth|behavior\s*:\s*['"]smooth['"]/ },
      ];

      for (const file of srcFiles) {
        const content = fs.readFileSync(file, 'utf8');
        for (const rule of forbiddenPatterns) {
          assert.equal(
            rule.regex.test(content),
            false,
            `Forbidden animation pattern (${rule.label}) found in ${file}`
          );
        }
      }

      const indexCss = fs.readFileSync('./src/index.css', 'utf8');
      assert.ok(indexCss.includes('animation: none !important;'));
      assert.ok(indexCss.includes('transition: none !important;'));
    });

    it('verifies SEO and publishing readiness artifacts (index.html, robots.txt, sitemap.xml)', () => {
      const indexHtml = fs.readFileSync('./index.html', 'utf8');
      const robotsTxt = fs.readFileSync('./public/robots.txt', 'utf8');
      const sitemapXml = fs.readFileSync('./public/sitemap.xml', 'utf8');

      assert.ok(indexHtml.includes('rel="canonical"'));
      assert.ok(indexHtml.includes('href="https://xongle.xyz/"'));
      assert.ok(indexHtml.includes('property="og:title"'));
      assert.ok(indexHtml.includes('application/ld+json'));
      assert.ok(robotsTxt.includes('Sitemap: https://xongle.xyz/sitemap.xml'));
      assert.ok(robotsTxt.includes('Disallow: /api/'));
      assert.ok(sitemapXml.includes('<loc>https://xongle.xyz/</loc>'));
    });
  });

  describe('9. Google SEO, Uzbek Search, SSR Discussion Rendering & AI Answer Engine', () => {
    it('matches Uzbek queries across Latin, Cyrillic, apostrophe variants, and target search intents', async () => {
      const {
        uzbekCyrillicToLatin,
        analyzeAndExpandQuery,
        scoreUzbekAwareMatch,
        BASELINE_PUBLIC_POSTS,
      } = await import('../src/seo/uzbekSearch');
      const { searchService } = await import('../src/services/search');

      assert.equal(
        uzbekCyrillicToLatin('Компьютер муаммосини қандай ҳал қилиш').includes('kompyuter'),
        true
      );

      const cyrillicAnalysis = analyzeAndExpandQuery('Линукс қандай ўрганилади');
      const linuxPost = BASELINE_PUBLIC_POSTS.find(
        (p) => p.id === 'post_uz_linux_qanday_organiladi'
      )!;
      assert.ok(scoreUzbekAwareMatch(linuxPost.title, cyrillicAnalysis) >= 8);

      const targetQueries = [
        'O‘zbekcha forum',
        'O‘zbek tilida savol-javob',
        'Kompyuter muammosini qanday hal qilish',
        'Компьютер муаммосини қандай ҳал қилиш',
        'Linux qanday o‘rganiladi',
        'Telefon muammosiga yechim',
        'Dasturlashni qayerdan o‘rganish mumkin',
        'Odamlar bu mahsulot haqida nima deydi',
      ];

      for (const q of targetQueries) {
        const res = searchService.search({ query: q });
        assert.ok(
          res.totalCount > 0,
          `Expected search results for target query "${q}", got 0`
        );
      }
    });

    it('synthesizes grounded AI answers with citations and refuses to hallucinate when evidence is missing', async () => {
      const {
        buildExtractiveGroundedAnswer,
        BASELINE_PUBLIC_POSTS,
        BASELINE_PUBLIC_COMMENTS,
      } = await import('../src/seo/uzbekSearch');

      const grounded = buildExtractiveGroundedAnswer(
        'Kompyuter muammosini qanday hal qilish',
        BASELINE_PUBLIC_POSTS,
        BASELINE_PUBLIC_COMMENTS
      );
      assert.equal(grounded.hasSufficientEvidence, true);
      assert.equal(grounded.detectedLanguage, 'uz');
      assert.ok(grounded.citations.length > 0);
      assert.equal(grounded.citations[0].postId, 'post_uz_kompyuter_muammo_yechim');
      assert.ok(grounded.keyPoints.length > 0);

      const missing = buildExtractiveGroundedAnswer(
        'zxqv99182_nonexistent_quantum_submarine_repair',
        BASELINE_PUBLIC_POSTS,
        BASELINE_PUBLIC_COMMENTS
      );
      assert.equal(missing.hasSufficientEvidence, false);
      assert.equal(missing.citations.length, 0);
    });

    it('renders full DiscussionForumPosting SSR HTML, Topic Hub SSR, valid Sitemap XML with lastmod, and 404 detection', async () => {
      const {
        resolveServerSeoWithContext,
        injectSeoIntoHtml,
        generateSitemapXml,
      } = await import('../src/seo/serverSeo');

      const templateHtml = fs.readFileSync('./index.html', 'utf8');

      // 1. Valid discussion route SSR
      const discRes = await resolveServerSeoWithContext({}, undefined, {
        cleanPath: '/discussions/post_uz_linux_qanday_organiladi',
        postId: 'post_uz_linux_qanday_organiladi',
      });
      assert.equal(discRes.notFound, false);
      assert.ok(discRes.activePost);
      assert.ok((discRes.activePostComments?.length || 0) >= 2);

      const renderedDiscHtml = injectSeoIntoHtml(templateHtml, discRes.meta, [], {
        activePost: discRes.activePost,
        activePostComments: discRes.activePostComments,
      });
      assert.ok(renderedDiscHtml.includes('https://schema.org/DiscussionForumPosting'));
      assert.ok(renderedDiscHtml.includes('Linux qanday o‘rganiladi?'));
      assert.ok(renderedDiscHtml.includes('Linux Mint Cinnamon'));
      assert.ok(
        renderedDiscHtml.includes(
          '<link rel="canonical" href="https://xongle.xyz/discussions/post_uz_linux_qanday_organiladi" />'
        )
      );

      // 2. Non-existent discussion route -> notFound: true (prevents Soft 404)
      const missingDisc = await resolveServerSeoWithContext({}, undefined, {
        cleanPath: '/discussions/nonexistent_post_99999',
        postId: 'nonexistent_post_99999',
      });
      assert.equal(missingDisc.notFound, true);

      // 3. Valid Topic Hub SSR
      const topicRes = await resolveServerSeoWithContext({}, undefined, {
        cleanPath: '/topics/dasturlash-organish',
        topicSlug: 'dasturlash-organish',
      });
      assert.equal(topicRes.notFound, false);
      assert.ok(topicRes.activeTopicHub);
      assert.ok((topicRes.topicPosts?.length || 0) > 0);

      // 4. Dynamic Sitemap XML with lastmod
      const sitemap = await generateSitemapXml('https://xongle.xyz');
      assert.ok(sitemap.includes('<lastmod>'));
      assert.ok(sitemap.includes('https://xongle.xyz/topics/uzbek-forum'));
      assert.ok(
        sitemap.includes('https://xongle.xyz/discussions/post_uz_kompyuter_muammo_yechim')
      );
    });
  });
});



