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
import UserAvatar from '../../components/UserAvatar';
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
  QuerySnapshot, 
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { UserProfile } from '../../utils/userProfile';

// --- CONSTANTS ---
// Threshold for grouping messages (2 hours in milliseconds)
const TIME_GROUP_THRESHOLD_MS = 2 * 60 * 60 * 1000; 

// Width reserved for the Avatar/Padding in the row (for fragmentation fix)
const AVATAR_WIDTH = 30;
// Note: TIME_WIDTH is removed from the layout calculation since time is hidden
const PADDING_WIDTH = 12;
const { width, height } = Dimensions.get('window');
const MAX_BUBBLE_WIDTH = width * 0.75; // Safer general max width

// --- INTERFACES ---
interface BookRecommendation {
  title: string;
  author: string;
  rating: number; 
  availability: string;
}

interface AiRecommendationResponse {
    mood: string;
    recommendations: BookRecommendation[];
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: Timestamp | null;
}
// --- END INTERFACES ---

const Colors = {
  background: '#ffffffff',
  primaryBlue: '#0a7ea4',
  accentGold: '#fafafaff',
  textLight: '#fcfbf8ff',
  textDark: '#2A3C52',
  inputBorder: '#B0C4DE',
  bubbleLight: '#e4e5f2ff',
};

// --- UTILITY FUNCTIONS ---
const isSameDay = (t1: Date | null, t2: Date | null): boolean => {
  if (!t1 || !t2) return false;
  return t1.getFullYear() === t2.getFullYear() &&
         t1.getMonth() === t2.getMonth() &&
         t1.getDate() === t2.getDate();
};

const formatChatDate = (date: Date | null): string => {
  if (!date) return '';
  const now = new Date();
  
  if (isSameDay(date, now)) {
    return 'Today';
  } else if (isSameDay(date, new Date(now.setDate(now.getDate() - 1)))) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
};

// Removed formatChatTime as timestamps are no longer displayed

export default function PrivateChatScreen() {
  const router = useRouter();
  const { id: otherUserId, otherUserName } = useLocalSearchParams<{ id: string; otherUserName?: string }>();
  const { user } = useAuth();
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null); 
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [apiLoading, setLoadingApi] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  
  const [aiResponse, setAiResponse] = useState<AiRecommendationResponse | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  
  // visibleTimeMessageId state and handler removed as requested

  const flatListRef = useRef<FlatList>(null);
  const firestoreDb = db as Firestore;

  // Animation refs 
  const aiButtonScale = useRef(new Animated.Value(1)).current;
  const sendButtonScale = useRef(new Animated.Value(1)).current;
  const inputBorderAnim = useRef(new Animated.Value(0)).current;
  const modalAnim = useRef(new Animated.Value(0)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const messageAnimValues = useRef<Map<string, Animated.Value>>(new Map());

  const getConversationId = (uid1: string | undefined, uid2: string | undefined) => {
    if (!uid1 || !uid2) return '';
    return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
  };

  const conversationId = getConversationId(user?.uid, otherUserId);
  
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


  // Pulse AI button (unchanged logic)
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

  // Send button pulse (unchanged logic)
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

  // Input glow (unchanged logic)
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

  // Fetch user profiles
  useEffect(() => {
    const fetchUsers = async () => {
      if (!firestoreDb || !otherUserId || !user?.uid) return;
      
      try {
        // Fetch Other User
        const otherUserDoc = await getDoc(doc(firestoreDb, 'users', otherUserId));
        if (otherUserDoc.exists()) {
          setOtherUser(otherUserDoc.data() as UserProfile);
        }
        
        // Fetch Current User Profile
        const currentUserDoc = await getDoc(doc(firestoreDb, 'users', user.uid));
        if (currentUserDoc.exists()) {
          setCurrentUserProfile(currentUserDoc.data() as UserProfile);
        }
      } catch (error) {
        console.error('Error fetching user profiles:', error);
      }
    };
    fetchUsers();
  }, [otherUserId, user?.uid, firestoreDb]);

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
      (snapshot: QuerySnapshot<DocumentData>) => {
        const messagesList = snapshot.docs.map(
          (doc: QueryDocumentSnapshot<DocumentData>) => ({ 
            id: doc.id,
            ...doc.data(),
          })
        ) as Message[];

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

  // UPDATED postAiNotificationMessage
  const postAiNotificationMessage = async () => {
    if (!user || !firestoreDb || !conversationId) return;
    
    const messagesCollection = collection(firestoreDb, 'conversations', conversationId, 'messages');
    const senderName = currentUserProfile?.displayName || user.email?.split('@')[0] || 'User';
    
    // NEW improved notification text
    const notificationText = `✨ AI Analysis in Progress: ${senderName} initiated a book recommendation request. Our system is analyzing recent chat history to find your perfect reads.`;

    try {
        await addDoc(messagesCollection, {
            text: notificationText,
            senderId: user.uid,
            createdAt: serverTimestamp(),
        });
    } catch (error) {
        console.error("Error posting AI notification:", error);
    }
  };


  const getAiRecommendations = async () => {
    if (!user || !firestoreDb || !conversationId) {
      Alert.alert('Error', 'Cannot get recommendations at this time.');
      return;
    }
    
    postAiNotificationMessage();

    openModal();
    setLoadingApi(true);
    setApiError(null);
    setAiResponse(null); 

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
        setLoadingApi(false);
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
        setLoadingApi(false);
        return;
      }

      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

      const systemPrompt = `
  You are a highly specialized AI Book Recommender for a social media app.
  Your task:
  1. Analyze the user's recent chat conversation to detect their current mood and sentiment.
  2. Recommend exactly 5 books that best match or uplift that mood.
  3. For each book, provide its average rating, and first try to find the free one, specify if it's currently free (e.g., public domain), and suggest a purchase point (e.g., Amazon, local bookstore).
  4. Only choose books that are: Highly rated (4.0★+), widely recommended, and easily available.
  5. Respond only with the specified JSON structure.`;

      const userPrompt = `Analyze the following private chat conversation from the last hour and determine the mood and recommend 5 book titles. CONVERSATION:\n${conversationHistory}`;


      const schema = {
        type: 'OBJECT',
        properties: {
          mood: { 
            type: 'STRING', 
            description: 'The dominant emotion or mood detected in the conversation (e.g., angry, sad, bored).'
          },
          recommendations: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                title: { type: 'STRING' },
                author: { type: 'STRING' },
                rating: { type: 'NUMBER' },
                availability: { type: 'STRING' },
              },
              required: ['title', 'author', 'rating', 'availability'],
            },
          }
        },
        required: ['mood', 'recommendations'],
      };

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
      setAiResponse(parsedJson);
    } catch (error: any) {
      console.error(error);
      setApiError(error.message || 'Failed to get recommendations');
    } finally {
      setLoadingApi(false);
    }
  };
  
  // Compiles and sends the formatted recommendation list
  const handleSendRecommendation = async () => {
    if (!aiResponse || !user || !firestoreDb || !conversationId) return;

    // 1. Compile the list of recommendations
    const bookList = aiResponse.recommendations.map(book => {
        return `* "${book.title}" by ${book.author} (${book.rating.toFixed(1)}★, ${book.availability})`;
    }).join('\n');

    // 2. Format the introductory message
    const introName = otherUser?.displayName || otherUserName || 'friend';
    const capitalizedMood = aiResponse.mood.charAt(0).toUpperCase() + aiResponse.mood.slice(1);
    
    const header = `Hey ${introName}, I think you should read these books according to your mood (${capitalizedMood}):\n\n`;
    const fullText = header + bookList;
    
    const messagesCollection = collection(firestoreDb, 'conversations', conversationId, 'messages');

    try {
        await addDoc(messagesCollection, {
            text: fullText,
            senderId: user.uid,
            createdAt: serverTimestamp(),
        });
        
        closeModal();
        Alert.alert("Sent!", "Book recommendations have been shared in the chat.");
    } catch (error) {
        console.error("Error sending compiled message:", error);
        Alert.alert("Error", "Could not send recommendation message.");
    }
  };


  // --- MODIFIED renderMessage: Time removed, Avatar (Friend Only) remains, Grouping remains ---
  const renderMessage = useCallback(({ item, index }: { item: Message, index: number }) => {
    const isCurrentUser = item.senderId === user?.uid;
    const anim = messageAnimValues.current.get(item.id) || new Animated.Value(1);
    
    const currentMessageDate = item.createdAt && (item.createdAt instanceof Timestamp || typeof item.createdAt?.toDate === 'function')
      ? item.createdAt.toDate()
      : item.createdAt instanceof Date
        ? item.createdAt
        : null;
    const nextItem = messages[index + 1];
    const previousMessageDate = nextItem?.createdAt && (nextItem.createdAt instanceof Timestamp || typeof nextItem.createdAt?.toDate === 'function')
      ? nextItem.createdAt.toDate()
      : nextItem?.createdAt instanceof Date
        ? nextItem.createdAt
        : null;
    
    // Logic for showing Date Header only on initial message or time gap > 2 hours.
    let showDateHeader = index === messages.length - 1; 
    if (currentMessageDate && previousMessageDate) {
        const timeDiff = currentMessageDate.getTime() - previousMessageDate.getTime();
        if (!isSameDay(currentMessageDate, previousMessageDate) || timeDiff > TIME_GROUP_THRESHOLD_MS) {
            showDateHeader = true;
        }
    }
    
    const photoURL = otherUser?.photoURL;
    const fallbackName = 'User';
    const displayName = otherUser?.displayName ?? fallbackName; 
    
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

    // --- Message Row Layout ---
    return (
      <Animated.View style={animatedStyle}>
        {/* Date Header */}
        {showDateHeader && (
          <View style={styles.dateHeaderContainer}>
            <Text style={styles.dateHeaderText}>{formatChatDate(currentMessageDate)}</Text>
          </View>
        )}

        {/* Current User Row: [Bubble] (No Avatar, No Time) */}
        {isCurrentUser && (
            <View style={[styles.messageRow, styles.currentUserRow]}>
                {/* Bubble Container (Takes up required width based on content) */}
                <View style={styles.messageBubbleContainer}> 
                  <ChatMessage
                      message={item}
                      isCurrentUser={isCurrentUser}
                      currentUserBubbleColor={Colors.primaryBlue}
                      currentUserTextColor={Colors.textLight}
                      otherUserBubbleColor={Colors.bubbleLight}
                      otherUserTextColor={Colors.textDark}
                      onUnsend={handleUnsend}
                  />
                </View>
            </View>
        )}

        {/* Other User Row: [Avatar, Bubble] (Avatar on left, No Time) */}
        {!isCurrentUser && (
            <View style={[styles.messageRow, styles.otherUserRow]}>
                
                {/* Avatar (Left side for Other User) */}
                <View style={styles.avatarWrapperLeft}>
                    <UserAvatar 
                        photoUrl={photoURL} 
                        displayName={displayName} 
                        size={30} 
                    />
                </View>

                {/* Bubble Container (Takes up required width based on content) */}
                <View style={styles.messageBubbleContainer}>
                  <ChatMessage
                      message={item}
                      isCurrentUser={isCurrentUser}
                      currentUserBubbleColor={Colors.primaryBlue}
                      currentUserTextColor={Colors.textLight}
                      otherUserBubbleColor={Colors.bubbleLight}
                      otherUserTextColor={Colors.textDark}
                      onUnsend={handleUnsend}
                  />
                </View>
            </View>
        )}
      </Animated.View>
    );
  }, [user?.uid, messages, otherUser]);
  // --- END MODIFIED renderMessage ---


  // --- AI Recommendation Modal Render ---
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
  // --- END AI Recommendation Modal Render ---

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
            renderItem={({ item, index }) => renderMessage({ item, index })}
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
                <>
                {/* Display Mood if available */}
                {aiResponse?.mood && (
                    <View style={styles.moodContainer}>
                        <Text style={styles.moodLabel}>Detected Mood:</Text>
                        <Text style={styles.moodText}>{aiResponse.mood.toUpperCase()}</Text>
                    </View>
                )}
                
                <FlatList
                  data={aiResponse?.recommendations || []}
                  keyExtractor={(item, index) => `${item.title}-${index}`}
                  renderItem={renderRecommendationItem}
                  ItemSeparatorComponent={() => <View style={styles.recSeparator} />}
                />

                {/* Send Recommendation Button */}
                {(aiResponse?.recommendations?.length ?? 0) > 0 && (
                    <TouchableOpacity 
                        style={styles.sendRecButton} 
                        onPress={handleSendRecommendation}
                    >
                        <FontAwesome name="share" size={18} color={Colors.textLight} />
                        <Text style={styles.sendRecButtonText}>Send Book Reco to {otherUser?.displayName || 'Friend'}</Text>
                    </TouchableOpacity>
                )}
                </>
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

// --- MODIFIED STYLES ---
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

  // --- MESSAGE RENDERING STYLES ---
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  currentUserRow: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end', 
  },
  otherUserRow: {
    alignSelf: 'flex-start',
  },
  messageBubbleContainer: {
    flexShrink: 1, 
    maxWidth: width - AVATAR_WIDTH - PADDING_WIDTH * 2, 
  },
  // Removed timeText styles

  avatarWrapperLeft: {
    marginRight: 6,
    width: AVATAR_WIDTH, 
    justifyContent: 'flex-end',
  },
  dateHeaderContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  dateHeaderText: {
    fontSize: 12,
    color: '#888',
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    fontWeight: '500',
  },
  // --- END MESSAGE RENDERING STYLES ---

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
  
  // NEW MODAL STYLES
  moodContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    backgroundColor: Colors.bubbleLight,
    borderRadius: 10,
    marginBottom: 15,
  },
  moodLabel: {
    fontSize: 14,
    color: Colors.textDark,
    marginRight: 5,
  },
  moodText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primaryBlue,
  },
  sendRecButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0e425dff', // Green send button
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
    elevation: 4,
  },
  sendRecButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  // END NEW MODAL STYLES

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







