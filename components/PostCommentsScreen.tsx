import { FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../components/Themed';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import UserAvatar from '../components/UserAvatar';

interface Comment {
  id: string;
  userId: string;
  userDisplayName: string;
  userPhotoURL?: string;
  content: string;
  createdAt: any;
}

export default function CommentsScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    if (postId) {
      fetchComments();
    }
  }, [postId]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const commentsRef = collection(db, 'posts', postId!, 'comments');
      const commentsQuery = query(commentsRef, orderBy('createdAt', 'asc'));
      const snapshot = await getDocs(commentsQuery);

      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Comment[];

      setComments(data);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!user || !newComment.trim() || !postId) return;

    try {
      const commentsRef = collection(db, 'posts', postId, 'comments');
      await addDoc(commentsRef, {
        userId: user.uid,
        userDisplayName: user.displayName || 'Anonymous',
        userPhotoURL: user.photoURL || null,
        content: newComment.trim(),
        createdAt: serverTimestamp(),
      });

      setNewComment('');
      fetchComments(); // refresh
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const renderComment = ({ item }: { item: Comment }) => (
    <View style={styles.commentCard}>
      <UserAvatar
        photoUrl={item.userPhotoURL}
        displayName={item.userDisplayName}
        size={36}
      />
      <View style={styles.commentContent}>
        <Text style={styles.commentUser}>{item.userDisplayName}</Text>
        <Text style={styles.commentText}>{item.content}</Text>
        <Text style={styles.commentTime}>
          {item.createdAt?.toDate?.().toLocaleString?.() || 'Just now'}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <FontAwesome name="chevron-left" size={20} color="#0a7ea4" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Comments</Text>
        <View style={{ width: 24 }} /> 
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#0a7ea4" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={comments}
          renderItem={renderComment}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.commentsList}
        />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Add a comment..."
            value={newComment}
            onChangeText={setNewComment}
            placeholderTextColor="#888"
          />
          <TouchableOpacity
            style={[styles.sendButton, !newComment.trim() && { opacity: 0.4 }]}
            onPress={handleAddComment}
            disabled={!newComment.trim()}
          >
            <FontAwesome name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    flex: 1,
  },
  commentsList: {
    padding: 16,
  },
  commentCard: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  commentContent: {
    flex: 1,
    marginLeft: 12,
  },
  commentUser: {
    fontWeight: '600',
    fontSize: 14,
  },
  commentText: {
    fontSize: 14,
    color: '#333',
    marginVertical: 2,
  },
  commentTime: {
    fontSize: 11,
    color: '#999',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopColor: '#eee',
    borderTopWidth: 1,
    padding: 12,
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 20,
  },
  sendButton: {
    backgroundColor: '#0a7ea4',
    borderRadius: 20,
    padding: 10,
    marginLeft: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomColor: '#eee',
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
});