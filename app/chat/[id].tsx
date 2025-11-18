import { FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ChatMessage from '../../components/ChatMessage';
import { Text } from '../../components/Themed';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs, 
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Firestore,
  Timestamp,
  where,
  deleteDoc,
} from 'firebase/firestore';
import { UserProfile } from '../../utils/userProfile';

// --- MODIFICATION: Updated Interface for API response with new fields ---
interface BookRecommendation {
  title: string;
  author: string;
  rating: string; // e.g., "4.5/5.0"
  is_free: boolean; // true/false
  buy_link: string; // e.g., "Amazon" or "Online Stores"
}
// -------------------------------------------------------------------

interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: Timestamp | null;
}

// Color Palette (Your existing palette)
const Colors = {
  background: '#ffffffff',
  primaryBlue: '#0a7ea4',
  accentGold: '#fafafaff',
  textLight: '#fcfbf8ff',
  textDark: '#2A3C52',
  inputBorder: '#B0C4DE',
  bubbleLight: '#e4e5f2ff',
};

export default function PrivateChatScreen() {
  const router = useRouter();
  const { id: otherUserId, otherUserName } = useLocalSearchParams<{ id: string, otherUserName?: string }>();
  const { user } = useAuth();
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const firestoreDb = db as Firestore;

  const [modalVisible, setModalVisible] = useState(false);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<BookRecommendation[]>([]);

  const getConversationId = (uid1: string | undefined, uid2: string | undefined) => {
    if (!uid1 || !uid2) return '';
    return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
  };
  const conversationId = getConversationId(user?.uid, otherUserId);

  useEffect(() => { /* ... fetchOtherUser ... */ }, [otherUserId, firestoreDb]);
  useEffect(() => { /* ... onSnapshot messages ... */ }, [conversationId, firestoreDb]);
  const handleSend = async () => { /* ... */ };
  const handleUnsend = (messageId: string) => { /* ... */ };

  const formatConversationHistory = (
    chatMessages: Message[],
    currentUserId: string,
    otherUserName: string
  ): string => {
    return chatMessages
      .map((msg) => {
        const speaker = msg.senderId === currentUserId ? "Me" : otherUserName;
        return `${speaker}: ${msg.text}`;
      })
      .join('\n');
  };

  const getAiRecommendations = async () => {
    if (!user || !firestoreDb || !conversationId) {
      Alert.alert("Error", "Cannot get recommendations at this time.");
      return;
    }

    setModalVisible(true);
    setApiLoading(true);
    setApiError(null);
    setRecommendations([]);

    try {
      const oneHourAgo = Timestamp.fromMillis(Date.now() - 60 * 60 * 1000);
      const messagesCollection = collection(firestoreDb, 'conversations', conversationId, 'messages');
      const recentMessagesQuery = query(
        messagesCollection,
        where('createdAt', '>=', oneHourAgo),
        orderBy('createdAt', 'asc')
      );

      const snapshot = await getDocs(recentMessagesQuery);
      if (snapshot.empty) {
        setApiError("No recent messages found. Chat a bit more!");
        setApiLoading(false);
        return;
      }

      const recentMessages = snapshot.docs.map((doc) => doc.data() as Message);

      const conversationHistory = formatConversationHistory(
        recentMessages,
        user.uid,
        otherUser?.displayName || "Friend"
      );

      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        console.error("Gemini API Key is missing. Please update your .env file.");
        setApiError("AI feature is not configured. Please add a valid Gemini API key.");
        setApiLoading(false);
        return;
      }

      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
      
      // --- MODIFICATION: Updated System Prompt ---
      const systemPrompt = `
  You are a highly specialized AI Book Recommender for a social media app.
  Your task:
  1. Analyze the user's recent chat conversation to detect their current mood and sentiment.
  2. Recommend exactly 5 books that best match or uplift that mood.
  3. For each book, provide its average rating, and first try to find the free one, specify if it's currently free (e.g., public domain), and suggest a purchase point (e.g., Amazon, local bookstore).
  4. Only choose books that are: Highly rated (4.0★+), widely recommended, and easily available.
  5. Respond only with the specified JSON structure.`;
      // ------------------------------------------
      
      const userPrompt = `Analyze the following private chat conversation from the last hour and recommend exactly 5 book titles. CONVERSATION:\n${conversationHistory}`;

      // --- MODIFICATION: Updated Schema with new properties ---
      const schema = {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING", description: "The full title of the recommended book." },
            author: { type: "STRING", description: "The author's full name." },
            rating: { type: "STRING", description: "The book's average rating (e.g., 4.3/5.0)." },
            is_free: { type: "BOOLEAN", description: "True if a free, legal version (e.g., public domain e-book) is easily accessible." },
            buy_link: { type: "STRING", description: "A generalized link or place where the book can be purchased (e.g., Amazon, local bookstore)." },
          }
        }
      };
      // --------------------------------------------------------

      const payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorBody = await response.json();
        console.error("API Error Response:", JSON.stringify(errorBody, null, 2));
        throw new Error(`API request failed: ${errorBody?.error?.message || response.statusText}`);
      }

      const result = await response.json();
      
      const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!jsonText) {
        throw new Error("Invalid response structure from API.");
      }

      const parsedJson = JSON.parse(jsonText);
      // Basic check to ensure the data is iterable
      if (!Array.isArray(parsedJson)) {
         throw new Error("API provided malformed data structure (expected an array).");
      }
      setRecommendations(parsedJson as BookRecommendation[]); // Cast to the correct interface
      
    } catch (error: any) {
      console.error("Error in getAiRecommendations:", error);
      setApiError(`Failed to get recommendations: ${error.message}`);
    } finally {
      setApiLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome name="arrow-left" size={24} color={Colors.accentGold} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {otherUser?.displayName || otherUserName || 'Chat'}
        </Text>
        <TouchableOpacity
          onPress={getAiRecommendations}
          style={styles.aiButton}
          testID="recommendation-btn"
        >
          <FontAwesome name="magic" size={22} color={Colors.accentGold} />
          <Text style={styles.aiButtonText}>AI Book Recs</Text>
        </TouchableOpacity>
      </View>

      {/* --- MODIFICATION: KeyboardAvoidingView wraps BOTH the list AND the input --- */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView} // Added a style with flex: 1
        // Removed fixed offset, relying on 'padding' behavior and list structure
      >
        {loading ? (
          <ActivityIndicator style={styles.loader} size="large" color={Colors.primaryBlue} />
        ) : (
          <FlatList
            data={messages}
            renderItem={({ item }) => (
              <ChatMessage 
                message={item} 
                isCurrentUser={item.senderId === user?.uid}
                currentUserBubbleColor={Colors.primaryBlue}
                currentUserTextColor={Colors.textLight}
                otherUserBubbleColor={Colors.bubbleLight}
                otherUserTextColor={Colors.textDark}
                onUnsend={handleUnsend}
              />
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesContainer}
            inverted
            ListEmptyComponent={
              <Text style={styles.emptyText}>Be the first to send a message!</Text>
            }
          />
        )}

        {/* Input container must be INSIDE the KeyboardAvoidingView */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            placeholderTextColor={Colors.inputBorder}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
            <FontAwesome name="send" size={20} color={Colors.textLight} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      {/* --- END KEYBOARD AVOIDING VIEW --- */}


      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>AI Book Recommendations</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <FontAwesome name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {apiLoading ? (
                 <View style={styles.centerContent}>
                   <ActivityIndicator size="large" color={Colors.primaryBlue} />
                   <Text style={styles.modalStatusText}>Analyzing your recent mood...</Text>
                 </View>
              ) : apiError ? (
                 <View style={styles.centerContent}>
                   <FontAwesome name="exclamation-triangle" size={30} color="#D9534F" />
                   <Text style={styles.modalErrorText}>{apiError}</Text>
                 </View>
              ) : (
                <FlatList
                  data={recommendations}
                  keyExtractor={(item, index) => `${item.title}-${index}`}
                  renderItem={({ item }) => (
                    <View style={styles.recItem}>
                      <FontAwesome name="book" size={20} color={Colors.primaryBlue} />
                      <View style={styles.recTextContainer}>
                        <Text style={styles.recTitle}>{item.title}</Text>
                        <Text style={styles.recAuthor}>by {item.author}</Text>
                        {/* --- MODIFICATION: Display Rating, Buy, and Free Info --- */}
                        <Text style={styles.recDetail}>⭐ Rating: {item.rating || 'N/A'}</Text>
                        <Text style={styles.recDetail}>💰 Free: {item.is_free ? 'Yes (Public Domain/Trial)' : 'No'}</Text>
                        <Text style={styles.recDetail}>🛒 Buy: {item.buy_link || 'Online Stores'}</Text>
                        {/* ---------------------------------------------------------- */}
                      </View>
                    </View>
                  )}
                  ItemSeparatorComponent={() => <View style={styles.recSeparator} />}
                />
              )}
            </View>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, 
    backgroundColor: Colors.background,
  },
  keyboardAvoidingView: {
    flex: 1, // CRUCIAL: Allows KAV to calculate space correctly
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.inputBorder,
    backgroundColor: Colors.primaryBlue,
  },
  backButton: {
    paddingRight: 10,
  },
  headerTitle: {
    flex: 1, 
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textLight,
    marginLeft: 10,
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginLeft: 10,
  },
  aiButtonText: {
    color: Colors.accentGold,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  loader: {
    flex: 1, 
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesContainer: {
    padding: 16,
    flexGrow: 1, 
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#868484ff',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.inputBorder,
    backgroundColor: Colors.background,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: Colors.textDark,
    backgroundColor: Colors.background,
  },
  sendButton: {
    backgroundColor: Colors.primaryBlue,
    borderRadius: 25,
    width: 50,
    height: 50,
    marginLeft: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primaryBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.primaryBlue,
  },
  modalBody: {
    paddingVertical: 20,
    minHeight: 150,
    justifyContent: 'center',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalStatusText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#555',
    marginTop: 15,
  },
  modalErrorText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#D9534F',
    marginTop: 15,
  },
  recItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  recTextContainer: {
    flex: 1,
    marginLeft: 15,
  },
  recTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textDark,
  },
  recAuthor: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  recDetail: { // Style for the new detail lines
    fontSize: 12,
    color: '#333',
    lineHeight: 18,
  },
  recSeparator: {
    height: 1,
    backgroundColor: '#eee',
    marginLeft: 35,
  },
  modalCloseButton: {
    backgroundColor: Colors.primaryBlue,
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  modalCloseButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
});
