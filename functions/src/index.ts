// functions/src/index.ts (Using 1st Generation functions for simpler config access)

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { GoogleGenAI } from '@google/genai';

// 1. Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

// --- Cloud Function for Sentiment Analysis ---

export const analyzeCommentSentiment = functions.firestore
  // Trigger on any new document in the collection
  .document('books/{bookId}/comments/{commentId}')
  .onCreate(async (snapshot, context) => {
    
    const commentData = snapshot.data();
    const commentText = commentData?.text as string | undefined;
    const commentRef = snapshot.ref; 

    // 2. Get the API Key from the legacy config object
    // This is the billing-free alternative!
    const config = functions.config();
    const GEMINI_API_KEY = config.gemini.apikey;

    if (!commentText || commentText.length < 5) {
      console.log('Comment too short or missing text. Skipping analysis.');
      await commentRef.update({ sentiment: 'Neutral' });
      return null; // Must return null for 1st Gen onCreate success
    }

    try {
      // 3. Initialize Gemini SDK
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

      // 4. Define the Prompt and enforce JSON Output for reliability
      const prompt = `Analyze the sentiment of the following book comment. Respond ONLY with a single JSON object in the format: {"sentiment": "Positive" | "Negative" | "Neutral"}.
      
      Comment: "${commentText}"`;

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

      // 5. Parse and Sanitize the result
      // --- FIX: Add a check for response.text existence before trimming/parsing ---
      const responseText = response.text;
      if (!responseText) {
          throw new Error('Gemini API returned an empty response text.');
      }
      // Remove backticks and 'json' markers if the model adds them
      const resultText = response.text.trim().replace(/^```json|```$/g, '').trim();
      const parsedContent = JSON.parse(resultText);
      const sentiment = parsedContent.sentiment as 'Positive' | 'Negative' | 'Neutral';

      // 6. Update the Firestore document with the result
      await commentRef.update({
        sentiment: sentiment, 
        analysisTimestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`Sentiment for comment ${commentRef.path} set to: ${sentiment}`);
    } catch (error) {
      console.error('Gemini API call or Firestore update failed:', error);
      await commentRef.update({ sentiment: 'AnalysisError' });
    }
    return null; // Successful exit
  });