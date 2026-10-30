# Xonddit & Xongle: Deployment & Architecture Guide

## 1. Overview
Xonddit and Xongle are two connected web applications sharing a unified Cloud Firestore database, security rules, and real-time search indexing engine:
- **Xonddit**: Reddit-inspired community platform for creating communities, publishing posts (text, link, image), commenting, and voting.
- **Xongle**: Google-inspired search engine designed strictly to search actual content published on Xonddit. It never queries or returns outside web results.

## 2. Shared Database Model
Cloud Firestore Collections:
- `/communities/{communityId}`: Communities created by users with slug, title, description, post count.
- `/posts/{postId}`: Posts with title, body, media/link, community metadata, author name, vote score, and comment count.
- `/comments/{commentId}`: Threaded comments associated with posts.
- `/votes/{voteId}`: User vote records (`{userId}_{targetId}`) ensuring single vote per user with atomic score updating.

## 3. Strict Search Architecture (Xongle)
- Searches exclusively through eligible Xonddit Firestore documents.
- Includes relevance scoring, keyword highlighting, content type filtering (`All`, `Posts`, `Communities`, `Comments`), and sorting (`Relevance`, `Newest`, `Top`).
- If no results exist: returns "No results found on Xonddit." No fake content is generated.
- Results link directly to their canonical Xonddit URLs.

## 4. Firebase Hosting Setup (Multi-Site)
In production, both applications can be deployed to separate Firebase Hosting sites or domains:

1. Register two hosting sites in Firebase Console:
   - `xonddit-app`
   - `xongle-app`
2. Link them in the Firebase CLI:
   ```bash
   firebase target:apply hosting xonddit xonddit-app
   firebase target:apply hosting xongle xongle-app
   ```
3. Deploy hosting targets and Firestore rules:
   ```bash
   npm run build
   firebase deploy --only firestore:rules,firestore:indexes,hosting
   ```

## 5. Cloud Functions Search Synchronization
The `functions/` directory contains event triggers (`onPostWrite`, `onCommunityWrite`) that can be deployed to automatically sync updates directly to an external search provider (Typesense or Algolia):
```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```
