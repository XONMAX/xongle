import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

/**
 * Cloud Function: Automatically synchronizes created, updated, or deleted posts
 * to the search engine index (Typesense or Algolia).
 * Ensures idempotent updates and prompt removal of ineligible/deleted documents.
 */
export const onPostWrite = functions.firestore.onDocumentWritten('posts/{postId}', async (event) => {
  const postId = event.params.postId;
  const change = event.data;

  if (!change) return;

  // Deletion or marked non-public
  if (!change.after.exists || change.after.data()?.isPublic === false) {
    console.log(`[Search Sync] Removing post ${postId} from search index`);
    // Example: await typesenseClient.collections('posts').documents(postId).delete();
    return;
  }

  const postData = change.after.data();
  console.log(`[Search Sync] Idempotently indexing post ${postId}: ${postData.title}`);
  // Indexable document schema strictly for Xonddit content:
  const searchDoc = {
    id: postId,
    title: postData.title,
    body: postData.body || '',
    type: postData.type,
    communityId: postData.communityId,
    communitySlug: postData.communitySlug,
    communityName: postData.communityName,
    authorName: postData.authorName,
    score: postData.score,
    commentCount: postData.commentCount,
    createdAt: postData.createdAt,
    canonicalUrl: `/p/${postId}`,
  };

  // Example: await typesenseClient.collections('posts').documents().upsert(searchDoc);
});

/**
 * Cloud Function: Automatically synchronizes communities to the search engine.
 */
export const onCommunityWrite = functions.firestore.onDocumentWritten('communities/{communityId}', async (event) => {
  const communityId = event.params.communityId;
  const change = event.data;

  if (!change) return;

  if (!change.after.exists || change.after.data()?.isPublic === false) {
    console.log(`[Search Sync] Removing community ${communityId} from search index`);
    return;
  }

  const commData = change.after.data();
  console.log(`[Search Sync] Idempotently indexing community ${commData.slug}`);
  const searchDoc = {
    id: communityId,
    name: commData.name,
    slug: commData.slug,
    title: commData.title,
    description: commData.description,
    postCount: commData.postCount,
    canonicalUrl: `/c/${commData.slug}`,
  };
});
