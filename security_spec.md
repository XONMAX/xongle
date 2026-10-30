# Security Specification & Threat Model for Xonddit & Xongle

## 1. Data Invariants

1. **Identity Integrity**: `authorId` on Posts and Comments and `creatorId` on Communities must strictly match the authenticated user's `request.auth.uid`. A user cannot forge another user's identity.
2. **Community Existence**: A post cannot be created in a non-existent community.
3. **Immutability of Core Fields**: `createdAt`, `authorId`, `creatorId`, `communityId`, and document identifiers cannot be altered after document creation.
4. **Controlled Voting**: A user can only vote on their own behalf (`userId == request.auth.uid`). Vote directions are strictly bounded to `1` (upvote) or `-1` (downvote). Target type must be `post` or `comment`.
5. **No Negative Scores on Creation**: Initial post/comment scores must start at authorized baseline values (`score == 0` or `1` if creator self-upvotes).
6. **Bounded Sizes**: String fields must have strict boundaries (post titles <= 300 chars, post body <= 20,000 chars, comments <= 5,000 chars, community slugs <= 30 alphanumeric/underscore characters).
7. **Read Access**: Only public content is queryable. Ineligible/deleted content cannot be read or indexed.
8. **Deletion Privilege**: Only the original author/creator can delete their post or community.

## 2. The "Dirty Dozen" Threat Payloads

1. **Payload 1 (Identity Spoofing on Post)**: User A creates a post with `authorId: "user_B"`.
2. **Payload 2 (Ghost Fields / Shadow Update)**: Update post with injected `{ isVerified: true, isAdmin: true }`.
3. **Payload 3 (Arbitrary Vote Manipulation)**: Injected write setting `score: 999999` directly on post document.
4. **Payload 4 (Oversized Payload / Denial of Wallet)**: Post creation with a 10MB malicious buffer in `title`.
5. **Payload 5 (ID Injection / Poisoning)**: Malicious document ID `../../../admin_root` containing illegal path characters.
6. **Payload 6 (Vote Direction Escaping)**: Vote record with `direction: 100` instead of `1` or `-1`.
7. **Payload 7 (Foreign Vote Forgery)**: User A writes to `/votes/user_B_post123` with `userId: "user_B"`.
8. **Payload 8 (Community Slug Hijacking)**: Creating a community with slug containing special punctuation `../../hack`.
9. **Payload 9 (Created Timestamp Forgery on Update)**: Updating a post and changing `createdAt` from 2026 to 2010.
10. **Payload 10 (Comment Orphan Injection)**: Creating a comment pointing to an invalid / empty `postId`.
11. **Payload 11 (Blanket Collection Scrape)**: Unauthenticated user attempting to write or read private collections.
12. **Payload 12 (Author Alteration)**: User B attempts to change the `authorId` or `creatorId` of an existing post or community.

## 3. Test Runner Invariant Checks
All 12 payloads must be explicitly rejected with `PERMISSION_DENIED` by the Firestore ruleset.
