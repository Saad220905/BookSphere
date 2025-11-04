import { collection, query, where, onSnapshot, addDoc, serverTimestamp, Firestore, doc, runTransaction, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { db } from '../config/firebase'; 
import { GoogleGenAI } from '@google/genai';
import { geminiConfig } from 'config/environment';

export interface Comment {
  id: string;
  bookId: string; 
  page: number;
  text: string;
  userId: string;
  createdAt: any; 
  likeCount: number; 
  likedBy: string[];  
  sentiment: 'Positive' | 'Negative' | 'Neutral' | 'AnalysisError';
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

// New function to calculate the overall sentiment score per page
function calculatePageSentiment(comments: Comment[]): 'Positive' | 'Negative' | 'Neutral' | 'Mixed' {
  if (comments.length === 0) {
    return 'Neutral'; // No comments means neutral mood
  }

  // 1. Assign numerical weights
  let totalScore = 0;
  let validCount = 0;

  const sentimentWeights: { [key: string]: number } = {
    'Positive': 2,
    'Neutral': 0,
    'Negative': -2,
    'AnalysisError': 0, // Errors don't influence the page score
  };

  comments.forEach(comment => {
    const sentiment = comment.sentiment || 'AnalysisError';
    totalScore += sentimentWeights[sentiment];
    if (sentiment !== 'AnalysisError') {
        validCount++;
    }
  });

  if (validCount === 0) {
      return 'Neutral'; // All comments were errors
  }

  // 2. Determine the average score
  const averageScore = totalScore / validCount;

  // 3. Map score to final sentiment string
  if (averageScore > 1.0) {
    return 'Positive';
  } else if (averageScore < -1.0) {
    return 'Negative';
  } else if (Math.abs(averageScore) <= 0.5) {
    return 'Neutral';
  } else {
    return 'Mixed'; // A mix of strong positive and negative comments
  }
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
        sentiment: data.sentiment as Comment['sentiment'] || 'AnalysisError',
      } as Comment);
    });
    // Sort by likes then creation time
    comments.sort((a, b) => (b.likeCount - a.likeCount) || (b.createdAt?.seconds - a.createdAt?.seconds));

    //Modification/Addition for overall page scoring
    // Calculate the overall sentiment
    const pageSentiment = calculatePageSentiment(comments);

    // Pass BOTH the comments and the new pageSentiment to the frontend
    callback(comments, pageSentiment);
    //callback(comments);
  }, (error) => {
    console.error("Error listening for comments: ", error);
  });
  return unsubscribe;
}

//////////////////////////////////////////////////////////////////////////////////////////////
export async function addComment(bookId: string, page: number, text: string, userId: string) {
  const firestore = getFirestoreInstance();
  const commentsRef = collection(firestore, `books/${bookId}/comments`);

  //---1. SENTIMENT VARIABLE ---
  let sentimentResult: 'Positive' | 'Negative' | 'Neutral' | 'AnalysisError' = 'AnalysisError';

  try {
    // --- 2. RUN SENTIMENT ANALYSIS ON DEVICE ---
    const ai = new GoogleGenAI({ apiKey: geminiConfig.apiKey });

    const prompt = `Analyze the sentiment of the following book comment. Respond ONLY with a single JSON object in the format: {"sentiment": "Positive" | "Negative" | "Neutral"}.
    
    Comment: "${text}"`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            sentiment: {
              type: 'string',
              enum: ['Positive', 'Negative', 'Neutral'],
            },
          },
          required: ['sentiment'],
        },
      },
    });

    // Parse and sanitize the result
    const responseText = response.text;
    if (!responseText) {
        throw new Error('Gemini API returned an empty response text.');
    }
    const resultText = responseText.trim().replace(/^```json|```$/g, '').trim();
    const parsedContent = JSON.parse(resultText);
    sentimentResult = parsedContent.sentiment as 'Positive' | 'Negative' | 'Neutral';

  } catch (error) {
    console.error('Gemini API call failed during comment submission:', error);
    sentimentResult = 'AnalysisError';
  }

  

  await addDoc(commentsRef, {
    page,
    text,
    userId,
    createdAt: serverTimestamp(),
    likeCount: 0,
    likedBy: [],
    // --- 3. SAVE COMMENT AND SENTIMENT TO FIRESTORE ---
    sentiment: sentimentResult,
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