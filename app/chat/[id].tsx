import { FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState, useRef, useCallback } from 'react';
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
  Animated,
  Easing,
  Keyboard,
  Dimensions,
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
  // --- ADDED/HIGHLIGHTED TYPES FOR FIXING TS(7006) ERRORS ---
  QuerySnapshot, 
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { UserProfile } from '../../utils/userProfile';

// --- UPDATED INTERFACE ---
interface BookRecommendation {
  title: string;
  author: string;
  rating: number; // New field for book rating (e.g., 4.5)
  availability: string; // New field for where to get it (e.g., "Free to read", "Amazon, B&N")
}
// --- END UPDATED INTERFACE ---

interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: Timestamp | null;
}

const Colors = {
  background: '#ffffffff',
  primaryBlue: '#0a7ea4',
  accentGold: '#fafafaff',
  textLight: '#fcfbf8ff',
  textDark: '#2A3C52',
  inputBorder: '#B0C4DE',
  bubbleLight: '#e4e5f2ff',
};

const { height } = Dimensions.get('window');

export default function PrivateChatScreen() {
  const router = useRouter();
  const { id: otherUserId, otherUserName } = useLocalSearchParams<{ id: string; otherUserName?: string }>();
  const { user } = useAuth();
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<BookRecommendation[]>([]);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const firestoreDb = db as Firestore;

  // Animation refs
  const aiButtonScale = useRef(new Animated.Value(1)).current;
  const sendButtonScale = useRef(new Animated.Value(1)).current;
  const inputBorderAnim = useRef(new Animated.Value(0)).current;
  const modalAnim = useRef(new Animated.Value(0)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  // Store animation values for each message
  const messageAnimValues = useRef<Map<string, Animated.Value>>(new Map());

  const getConversationId = (uid1: string | undefined, uid2: string | undefined) => {
    if (!uid1 || !uid2) return '';
    return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
  };

  const conversationId = getConversationId(user?.uid, otherUserId);

  // Pulse AI button
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(aiButtonScale, {
          toValue: 1.12,
          duration: 1000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(aiButtonScale, {
          toValue: 1,
          duration: 1000,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [aiButtonScale]);

  // Send button pulse
  useEffect(() => {
    if (newMessage.trim()) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(sendButtonScale, {
            toValue: 1.15,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(sendButtonScale, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      sendButtonScale.setValue(1);
    }
  }, [newMessage, sendButtonScale]);

  // Input glow
  useEffect(() => {
    Animated.timing(inputBorderAnim, {
      toValue: isInputFocused ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isInputFocused, inputBorderAnim]);

  const inputBorderColor = inputBorderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.inputBorder, Colors.primaryBlue],
  });

  const inputShadowOpacity = inputBorderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.3],
  });

  // Modal animations
  const openModal = () => {
    setModalVisible(true);
    Animated.parallel([
      Animated.timing(backdropAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(modalAnim, {
        toValue: 1,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeModal = () => {
    Animated.parallel([
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(modalAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setModalVisible(false));
  };

  // Scroll handler
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false }
  );

  const fabOpacity = scrollY.interpolate({
    inputRange: [0, 400],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const fabTranslateY = scrollY.interpolate({
    inputRange: [0, 400],
    outputRange: [100, 0],
    extrapolate: 'clamp',
  });

  const scrollToBottom = () => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  // Fetch other user
  useEffect(() => {
    const fetchOtherUser = async () => {
      if (!firestoreDb || !otherUserId) return;
      try {
        const userDoc = await getDoc(doc(firestoreDb, 'users', otherUserId));
        if (userDoc.exists()) {
          setOtherUser(userDoc.data() as UserProfile);
        }
      } catch (error) {
        console.error('Error fetching other user:', error);
      }
    };
    fetchOtherUser();
  }, [otherUserId, firestoreDb]);

  // Listen to messages and animate new ones
  useEffect(() => {
    if (!firestoreDb || !conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const messagesCollection = collection(firestoreDb, 'conversations', conversationId, 'messages');
    const q = query(messagesCollection, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      // --- FIX: Explicitly type snapshot ---
      (snapshot: QuerySnapshot<DocumentData>) => {
        const messagesList = snapshot.docs.map(
          // --- FIX: Explicitly type doc ---
          (doc: QueryDocumentSnapshot<DocumentData>) => ({
            id: doc.id,
            ...doc.data(),
          })
        ) as Message[];

        // Animate new messages
        const newMessages = messagesList.filter(
          (msg) => !messages.some((m) => m.id === msg.id)
        );

        newMessages.forEach((msg, idx) => {
          const anim = new Animated.Value(0);
          messageAnimValues.current.set(msg.id, anim);

          Animated.sequence([
            Animated.delay(idx * 60),
            Animated.timing(anim, {
              toValue: 1,
              duration: 400,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]).start();
        });

        setMessages(messagesList);
        setLoading(false);
        setTimeout(scrollToBottom, 100);
      },
      // --- FIX: Explicitly type error ---
      (error: Error) => {
        console.error('Error fetching messages:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [conversationId, firestoreDb]);

  const handleSend = async () => {
    if (newMessage.trim() === '' || !user || !firestoreDb || !conversationId) return;

    const textToSend = newMessage.trim();
    setNewMessage('');
    Keyboard.dismiss();

    const messagesCollection = collection(firestoreDb, 'conversations', conversationId, 'messages');
    try {
      await addDoc(messagesCollection, {
        text: textToSend,
        senderId: user.uid,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleUnsend = (messageId: string) => {
    if (!firestoreDb || !conversationId || !messageId) return;

    Alert.alert(
      'Unsend Message?',
      'This will permanently delete this message for everyone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unsend',
          style: 'destructive',
          onPress: async () => {
            try {
              const messageRef = doc(firestoreDb, 'conversations', conversationId, 'messages', messageId);
              await deleteDoc(messageRef);
            } catch (error) {
              console.error('Error unsending message:', error);
              Alert.alert('Error', 'Could not unsend message.');
            }
          },
        },
      ]
    );
  };

  const formatConversationHistory = (
    chatMessages: Message[],
    currentUserId: string,
    otherUserName: string
  ): string => {
    return chatMessages
      .map((msg) => {
        const speaker = msg.senderId === currentUserId ? 'Me' : otherUserName;
        return `${speaker}: ${msg.text}`;
      })
      .join('\n');
  };

  const getAiRecommendations = async () => {
    if (!user || !firestoreDb || !conversationId) {
      Alert.alert('Error', 'Cannot get recommendations at this time.');
      return;
    }

    openModal();
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
        setApiError('No recent messages found. Chat a bit more!');
        setApiLoading(false);
        return;
      }

      const recentMessages = snapshot.docs.map((doc) => doc.data() as Message);

      const conversationHistory = formatConversationHistory(
        recentMessages,
        user.uid,
        otherUser?.displayName || 'Friend'
      );

      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        setApiError('Gemini API Key missing. Add it to your .env file.');
        setApiLoading(false);
        return;
      }

      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
      
      // --- UPDATED SYSTEM PROMPT ---
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


      // --- UPDATED RESPONSE SCHEMA ---
      const schema = {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING' },
            author: { type: 'STRING' },
            rating: { type: 'NUMBER' }, // Updated to NUMBER for rating
            availability: { type: 'STRING' }, // New property
          },
          required: ['title', 'author', 'rating', 'availability'], // Added required fields
        },
      };
      // --- END UPDATED RESPONSE SCHEMA ---

      const payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!jsonText) throw new Error('Invalid response');
      const parsedJson = JSON.parse(jsonText);
      setRecommendations(parsedJson);
    } catch (error: any) {
      console.error(error);
      setApiError(error.message || 'Failed to get recommendations');
    } finally {
      setApiLoading(false);
    }
  };

  // SAFE renderMessage — NO useEffect inside
  const renderMessage = useCallback(({ item }: { item: Message }) => {
    const isCurrentUser = item.senderId === user?.uid;
    const anim = messageAnimValues.current.get(item.id) || new Animated.Value(1);

    const animatedStyle = {
      opacity: anim,
      transform: [
        {
          translateY: anim.interpolate({
            inputRange: [0, 1],
            outputRange: [30, 0],
          }),
        },
      ],
    };

    return (
      <Animated.View style={animatedStyle}>
        <ChatMessage
          message={item}
          isCurrentUser={isCurrentUser}
          currentUserBubbleColor={Colors.primaryBlue}
          currentUserTextColor={Colors.textLight}
          otherUserBubbleColor={Colors.bubbleLight}
          otherUserTextColor={Colors.textDark}
          onUnsend={handleUnsend}
        />
      </Animated.View>
    );
  }, [user?.uid]);

  // --- UPDATED COMPONENT RENDER (within the Modal FlatList) ---
  const renderRecommendationItem = ({ item }: { item: BookRecommendation }) => (
    <View style={styles.recItem}>
      <FontAwesome name="book" size={20} color={Colors.primaryBlue} style={{ alignSelf: 'flex-start' }} />
      <View style={styles.recTextContainer}>
        <Text style={styles.recTitle}>{item.title}</Text>
        <Text style={styles.recAuthor}>by {item.author}</Text>
        <View style={styles.recRatingContainer}>
          <FontAwesome name="star" size={14} color="#FFD700" />
          <Text style={styles.recRatingText}>{item.rating.toFixed(1)} / 5.0</Text>
        </View>
        <Text style={styles.recAvailabilityText}>{item.availability}</Text>
      </View>
    </View>
  );
  // --- END UPDATED COMPONENT RENDER ---

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome name="arrow-left" size={24} color={Colors.accentGold} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {otherUser?.displayName || otherUserName || 'Chat'}
        </Text>
        <Animated.View style={{ transform: [{ scale: aiButtonScale }] }}>
          <TouchableOpacity onPress={getAiRecommendations} style={styles.aiButton}>
            <FontAwesome name="magic" size={22} color={Colors.accentGold} />
            <Text style={styles.aiButtonText}>AI Book Recs</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="small" color={Colors.primaryBlue} />
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesContainer}
            inverted
            onScroll={handleScroll}
            scrollEventThrottle={16}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Be the first to send a message!</Text>
            }
          />
        )}

        {/* Scroll to Bottom FAB */}
        <Animated.View
          style={[
            styles.scrollToBottomButton,
            {
              opacity: fabOpacity,
              transform: [{ translateY: fabTranslateY }],
            },
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity onPress={scrollToBottom} style={styles.fabInner}>
            <FontAwesome name="arrow-down" size={20} color={Colors.textLight} />
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.inputContainer}>
          <Animated.View
            style={[
              styles.inputWrapper,
              {
                borderColor: inputBorderColor,
                shadowOpacity: inputShadowOpacity,
              },
            ]}
          >
            <TextInput
              style={styles.input}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Type a message..."
              placeholderTextColor={Colors.inputBorder}
              onSubmitEditing={handleSend}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
            />
          </Animated.View>
          <Animated.View style={{ transform: [{ scale: sendButtonScale }] }}>
            <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
              <FontAwesome name="send" size={20} color={Colors.textLight} />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={modalVisible} transparent animationType="none">
        <Animated.View style={[styles.modalBackdrop, { opacity: backdropAnim }]}>
          <Animated.View
            style={[
              styles.modalContainer,
              {
                transform: [
                  {
                    translateY: modalAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [height, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>AI Book Recommendations</Text>
              <TouchableOpacity onPress={closeModal}>
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
                  // --- UPDATED RENDER ITEM CALL ---
                  renderItem={renderRecommendationItem}
                  // --- END UPDATED RENDER ITEM CALL ---
                  ItemSeparatorComponent={() => <View style={styles.recSeparator} />}
                />
              )}
            </View>

            <TouchableOpacity style={styles.modalCloseButton} onPress={closeModal}>
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.inputBorder,
    backgroundColor: Colors.primaryBlue,
    elevation: 4,
  },
  backButton: { padding: 4 },
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
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: Colors.accentGold,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  aiButtonText: {
    color: Colors.accentGold,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: Colors.primaryBlue, fontSize: 16 },
  messagesContainer: { padding: 16, paddingBottom: 24, flexGrow: 1 },
  emptyText: { textAlign: 'center', marginTop: 20, fontSize: 16, color: '#868484ff' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.inputBorder,
    backgroundColor: Colors.background,
  },
  inputWrapper: {
    flex: 1,
    borderWidth: 3,
    borderRadius: 28,
    backgroundColor: '#fff',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  input: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.textDark,
  },
  sendButton: {
    backgroundColor: Colors.primaryBlue,
    borderRadius: 28,
    width: 56,
    height: 56,
    marginLeft: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: Colors.primaryBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  scrollToBottomButton: {
    position: 'absolute',
    right: 20,
    bottom: 90,
    width: 48,
    height: 48,
    borderRadius: 24,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabInner: {
    flex: 1,
    backgroundColor: Colors.primaryBlue,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 12,
    marginBottom: 8,
  },
  modalTitle: { fontSize: 19, fontWeight: '700', color: Colors.primaryBlue },
  modalBody: { paddingVertical: 10, maxHeight: 400 },
  centerContent: { justifyContent: 'center', alignItems: 'center', minHeight: 120 },
  modalStatusText: { textAlign: 'center', fontSize: 16, color: '#555', marginTop: 15 },
  modalErrorText: { textAlign: 'center', fontSize: 16, color: '#D9534F', marginTop: 15 },
  recItem: { 
    flexDirection: 'row', 
    alignItems: 'flex-start',
    paddingVertical: 12, 
  },
  recTextContainer: { flex: 1, marginLeft: 15 },
  recTitle: { fontSize: 16, fontWeight: '600', color: Colors.textDark },
  recAuthor: { fontSize: 14, color: '#666', marginBottom: 5 },
  recRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  }, 
  recRatingText: { 
    fontSize: 14, 
    color: Colors.textDark, 
    marginLeft: 5, 
    fontWeight: '600',
  }, 
  recAvailabilityText: {
    fontSize: 13,
    color: Colors.primaryBlue,
    fontStyle: 'italic',
  }, 
  recSeparator: { height: 1, backgroundColor: '#eee', marginLeft: 35 },
  modalCloseButton: {
    backgroundColor: Colors.primaryBlue,
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    elevation: 4,
  },
  modalCloseButtonText: { color: 'white', textAlign: 'center', fontSize: 16, fontWeight: '600' },
});
