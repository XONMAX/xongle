# Xongle Security Architecture & Incident Response Procedure

## 1. Security Overview
Xongle (`xongle.xyz` / `xongle.ai.studio`) enforces defense-in-depth across its React SPA frontend, Express API server (`server.ts`), Firebase Authentication & Firestore/Storage security rules (`firestore.rules`, `storage.rules`), and Google Drive Owner Backup integration (`src/backup/backupService.ts`).

### Core Security Controls
- **Least-Privilege Google OAuth 2.0**:
  - Standard user sign-in (`signInWithGoogle` and `AuthBridgePopup` in `basic` mode) requests only OpenID identity scopes (`openid`, `email`, `profile`).
  - The restricted `https://www.googleapis.com/auth/drive.file` scope is requested **exclusively** when an authenticated Owner (`aminbek785@gmail.com` or `crownsmpuz@gmail.com`) clicks **Authorize Google Drive Access** in the Owner Panel.
  - OAuth access tokens are held strictly in volatile memory (`cachedDriveAccessToken`) and are never written to `localStorage`, `sessionStorage`, cookies, or backup archives.
- **Server-Side Google Drive Token & Ownership Verification**:
  - Every Drive operation (`verifyGoogleDriveConnection`, `uploadBackupToGoogleDrive`, `deleteBackupRecord`) validates the token against `https://oauth2.googleapis.com/tokeninfo` (checking expiration and `drive.file` scope) and `https://www.googleapis.com/drive/v3/about` (verifying the Google account email belongs to an authorized Owner).
  - Before deleting a Drive backup file, the server validates the `driveFileId` format (`/^[a-zA-Z0-9_-]{10,128}$/`) and queries Drive file metadata (`ownedByMe`) to prevent arbitrary file deletion.
- **Cryptographic Owner Authentication & Session Protection**:
  - All `/api/owner/*` routes verify either a Google-signed RS256 Firebase ID token (`email_verified == true`) or an HMAC-SHA256 signed `HttpOnly; Secure; SameSite=Lax` session cookie (`xongle_session`).
  - All state-changing `/api/owner/*` endpoints enforce Origin allowlist validation and session-bound HMAC CSRF tokens (`X-CSRF-Token`).
- **Database & Storage Access Control (RBAC & IDOR Prevention)**:
  - `firestore.rules` and `storage.rules` enforce deny-by-default (`allow read, write: if false;`), strict schema/type/length validation (`hasOnly`), immutable `authorId`/`userId`/`createdAt` fields, deterministic vote IDs (`{uid}_{targetId}`), participant-only access to `conversations` and `messages`, and verified owner checks (`email_verified == true`).
- **Archive & Upload Hardening**:
  - Backup inspection (`inspectAndValidateBackupZip`) blocks Zip Slip path traversal (`..`, leading `/`, `\`), enforces a 2,500-entry ceiling and 100 MB uncompressed size limit (Zip Bomb protection), and verifies per-file and manifest SHA-256 checksums before restore.
  - Image uploads validate magic-byte file signatures (PNG, JPEG, GIF, WEBP) and reject SVG/HTML/executable payloads.

---

## 2. Incident Response & Recovery Procedure

### Phase 1: Detection & Triage
1. **Monitor Security Audit Logs**:
   - Inspect `.backups-storage/owner-audit-logs.json` or the **Owner Panel → Security** tab for `UNAUTHORIZED_ADMIN_ATTEMPT`, `UPLOAD_BACKUP_FAILED`, `RESTORE_BACKUP_FAILED`, or repeated failed `/api/owner/verify` lockouts.
   - Note that all audit logs automatically redact OAuth tokens (`ya29.*`), JWTs (`eyJ*`), and API keys (`AIza*`).
2. **Identify Scope of Compromise**:
   - Determine whether the incident involves:
     - (A) Exposed Google OAuth token or unauthorized Google Drive access
     - (B) Compromised user or owner session
     - (C) Data corruption / unauthorized Firestore modification
     - (D) Exposed server environment secret (`GEMINI_API_KEY`, `SESSION_HMAC_SECRET`)

### Phase 2: Containment & Revocation
1. **Revoke Google Drive OAuth Access**:
   - In **Owner Panel → Backup & Restore**, click **Disconnect & Revoke Drive Token** (calls `POST /api/owner/drive/disconnect` and `https://oauth2.googleapis.com/revoke`).
   - Additionally, visit [Google Account Third-Party Connections](https://myaccount.google.com/connections) for the owner Google account and revoke access for the Xongle OAuth app.
2. **Invalidate Active Sessions**:
   - Rotate `SESSION_HMAC_SECRET` in the server environment and restart the server. This immediately invalidates all active `xongle_session` cookies and CSRF tokens.
   - In the Firebase Console → Authentication → Users, disable or revoke refresh tokens for any compromised user UID.
3. **Lock Down Database Rules (Emergency Read-Only Mode)**:
   - If active database abuse is underway, deploy temporary read-only rules or enable Maintenance Mode via **Owner Panel → Settings**.

### Phase 3: Credential Rotation (Manual Cloud Steps)
1. **Rotate `GEMINI_API_KEY`**:
   - Open Google Cloud Console → APIs & Services → Credentials.
   - Delete or regenerate the restricted Gemini API key and update `GEMINI_API_KEY` in the server environment secrets manager.
2. **Verify Firebase API Key Restrictions**:
   - Open Google Cloud Console → APIs & Services → Credentials → Browser key (auto-created by Firebase).
   - Under **Application restrictions**, select **HTTP referrers (web sites)** and restrict to:
     - `https://xongle.xyz/*`
     - `https://www.xongle.xyz/*`
     - `https://xongle.ai.studio/*`
     - `https://arcane-responder-8sjh2.firebaseapp.com/*`
     - `https://arcane-responder-8sjh2.web.app/*`
   - Under **API restrictions**, restrict the key to: Identity Toolkit API, Token Service API, Cloud Firestore API, and Cloud Storage for Firebase API.

### Phase 4: Verified Recovery & Restoration
1. **Locate Last Known-Good Backup**:
   - Retrieve the latest verified `Xongle-Backup-YYYY-MM-DD-HH-MM-SS.zip` from the **Xongle Backups** folder on the Owner's Google Drive or local `.backups-storage/`.
2. **Inspect & Verify SHA-256 Checksums**:
   - Upload or select the archive in **Owner Panel → Backup & Restore → Restore Selected Backup**.
   - Confirm that the pre-restore inspection modal reports `✓ N files SHA-256 verified` and `0 checksum mismatches`.
3. **Execute Restore with Pre-Restore Safety Snapshot**:
   - Keep **"Create an automatic pre-restore safety backup"** enabled and click **Confirm & Restore Backup**.
4. **Post-Incident Verification**:
   - Run automated security verification:
     ```bash
     npm run test:security
     npm run security:scan
     ```
