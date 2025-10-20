import { collection, query, where, onSnapshot, addDoc, serverTimestamp, Firestore, doc, runTransaction, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { db } from '../config/firebase'; 

export interface Comment {
  id: string;
  bookId: string; 
  page: number;
  text: string;
  userId: string;
  createdAt: any; 
  likeCount: number; 
  likedBy: string[];  
}

class CommentError extends Error {
  constructor(message: string) {
  super(message);
  this.name = 'CommentError';
 }
}

function getFirestoreInstance(): Firestore {
  if (!db) {
  throw new CommentError('Firestore is not initialized.');
}
  return db;
}

export function listenForComments(bookId: string, page: number, callback: (comments: Comment[]) => void) {
  const firestore = getFirestoreInstance();
  const commentsRef = collection(firestore, `books/${bookId}/comments`);
  const q = query(commentsRef, where('page', '==', page));

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const comments: Comment[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      comments.push({
        id: doc.id,
        bookId: data.bookId,
        page: data.page,
        text: data.text,
        userId: data.userId,
        createdAt: data.createdAt,
        likeCount: data.likeCount || 0,
        likedBy: data.likedBy || [],
      } as Comment);
    });
    // Sort by likes then creation time
    comments.sort((a, b) => (b.likeCount - a.likeCount) || (b.createdAt?.seconds - a.createdAt?.seconds));
    callback(comments);
  }, (error) => {
    console.error("Error listening for comments: ", error);
  });
  return unsubscribe;
}

export async function addComment(bookId: string, page: number, text: string, userId: string) {
  const firestore = getFirestoreInstance();
  const commentsRef = collection(firestore, `books/${bookId}/comments`);

  await addDoc(commentsRef, {
    page,
    text,
    userId,
    createdAt: serverTimestamp(),
    likeCount: 0,
    likedBy: [],
  });
}

export async function toggleLike(bookId:string, commentId: string, userId: string) {
  const firestore = getFirestoreInstance();
  const commentRef = doc(firestore, `books/${bookId}/comments`, commentId);

  try {
    await runTransaction(firestore, async (transaction) => {
      const commentDoc = await transaction.get(commentRef);
      if (!commentDoc.exists()) {
        throw "Comment does not exist";
      }

      const data = commentDoc.data();
      const likedBy = data.likedBy || [];
      const hasLiked = likedBy.includes(userId);

      if (hasLiked) {
        transaction.update(commentRef, {
          likedBy: arrayRemove(userId),
          likeCount: increment(-1)
        });
      } else {
        transaction.update(commentRef, {
          likedBy: arrayUnion(userId),
          likeCount: increment(1)
        });
      }
    });
  } catch (e) {
    console.error("Like transaction failed: ", e);
    throw new CommentError("Could not update like status.");
  }
}