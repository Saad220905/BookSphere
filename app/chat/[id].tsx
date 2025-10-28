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
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Firestore,
  Timestamp,
} from 'firebase/firestore';
import { UserProfile } from '../../utils/userProfile';

interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: Timestamp | null;
}

// Color Palette
const Colors = {
  background: '#F8F5EE',
  primaryBlue: '#2A3C52',
  accentGold: '#FFD700',
  textLight: '#F8F5EE',
  textDark: '#2A3C52',
  inputBorder: '#B0C4DE',
  bubbleLight: '#D4E0F0',
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

  const getConversationId = (uid1: string | undefined, uid2: string | undefined) => {
    if (!uid1 || !uid2) return '';
    return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
  };

  const conversationId = getConversationId(user?.uid, otherUserId);

  useEffect(() => {
    const fetchOtherUser = async () => {
      if (!firestoreDb || !otherUserId) return;
      try {
        const userDoc = await getDoc(doc(firestoreDb, 'users', otherUserId));
        if (userDoc.exists()) {
          setOtherUser(userDoc.data() as UserProfile);
        }
      } catch (error) {
        console.error("Error fetching other user:", error);
      }
    };
    fetchOtherUser();
  }, [otherUserId, firestoreDb]);

  useEffect(() => {
    if (!firestoreDb || !conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const messagesCollection = collection(firestoreDb, 'conversations', conversationId, 'messages');
    const q = query(messagesCollection, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[];
      setMessages(messagesList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching messages:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [conversationId, firestoreDb]);

  const handleSend = async () => {
    if (newMessage.trim() === '' || !user || !firestoreDb || !conversationId) return;

    const messagesCollection = collection(firestoreDb, 'conversations', conversationId, 'messages');
    try {
      await addDoc(messagesCollection, {
        text: newMessage.trim(),
        senderId: user.uid,
        createdAt: serverTimestamp(),
      });
      setNewMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome name="arrow-left" size={24} color={Colors.accentGold} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {otherUser?.displayName || otherUserName || 'Chat'}
        </Text>
      </View>
      
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
            />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesContainer}
          inverted
          ListEmptyComponent={
            <Text style={styles.emptyText}>Be the first  send a message!</Text>
          }
        />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
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
  },
  backButton: {
    paddingRight: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textLight,
    marginLeft: 10,
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
    color: '#666',
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
    backgroundColor: Colors.accentGold,
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
});

