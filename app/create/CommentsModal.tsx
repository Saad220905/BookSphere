import { FontAwesome } from '@expo/vector-icons';
import { 
  addDoc, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  orderBy, 
  query, 
  serverTimestamp,
  updateDoc,
  Timestamp 
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../../components/Themed';
import UserAvatar from '../../components/UserAvatar';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';

interface Comment {
  id: string;
  content: string;
  userId: string;
  userDisplayName: string;
  userPhotoURL?: string;
  createdAt: any;
}

interface Post {
  id: string;
  content: string;
  userId: string;
  userDisplayName: string;
  userPhotoURL?: string;
  bookTitle?: string;
  bookAuthor?: string;
  likes: number;
  comments: number;
  createdAt: any;
  likedBy: string[];
}

interface CommentsModalProps {
  visible: boolean;
  postId: string;
  onClose: () => void;
}

export default function CommentsModal({ visible, postId, onClose }: CommentsModalProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [post, setPost] = useState<Post | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (visible && postId) {
      loadPost();
      loadComments();
    }
  }, [visible, postId]);

  const loadPost = async () => {
    if (!db || !postId) return;

    try {
      const postRef = doc(db, 'posts', postId);
      const postDoc = await getDoc(postRef);
      
      if (postDoc.exists()) {
        setPost({
          id: postDoc.id,
          ...postDoc.data(),
        } as Post);
      }
    } catch (error) {
      console.error('Error loading post:', error);
    }
  };

  const loadComments = async () => {
    if (!db || !postId) return;

    try {
      setIsLoading(true);
      const commentsQuery = query(
        collection(db, 'posts', postId, 'comments'),
        orderBy('createdAt', 'asc')
      );
      const snapshot = await getDocs(commentsQuery);
      const commentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Comment[];
      
      setComments(commentsData);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendComment = async () => {
    if (!user || !commentText.trim() || !db || !postId) return;

    try {
      setIsSending(true);

      const commentData = {
        content: commentText.trim(),
        userId: user.uid,
        userDisplayName: user.displayName || 'Anonymous',
        userPhotoURL: user.photoURL,
        createdAt: serverTimestamp(),
      };

      // Add comment to subcollection
      await addDoc(collection(db, 'posts', postId, 'comments'), commentData);

      // Update comment count on post
      const postRef = doc(db, 'posts', postId);
      const postDoc = await getDoc(postRef);
      if (postDoc.exists()) {
        const currentCount = postDoc.data().comments || 0;
        await updateDoc(postRef, {
          comments: currentCount + 1,
        });
      }

      setCommentText('');
      loadComments();
    } catch (error) {
      console.error('Error sending comment:', error);
      Alert.alert('Error', 'Failed to send comment. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    setCommentText('');
    setPost(null);
    onClose();
  };

  const renderComment = ({ item }: { item: Comment }) => (
    <View style={styles.commentItem}>
      <UserAvatar
        photoUrl={item.userPhotoURL}
        displayName={item.userDisplayName}
        size={32}
      />
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentUserName}>{item.userDisplayName}</Text>
          <Text style={styles.commentTime}>
            {item.createdAt && (item.createdAt instanceof Timestamp || typeof item.createdAt?.toDate === 'function') 
              ? item.createdAt.toDate().toLocaleDateString() 
              : item.createdAt instanceof Date 
                ? item.createdAt.toLocaleDateString()
                : 'Unknown date'}
          </Text>
        </View>
        <Text style={styles.commentText}>{item.content}</Text>
      </View>
    </View>
  );

  const renderHeader = () => {
    if (!post) return null;

    return (
      <View style={styles.postContainer}>
        <View style={styles.postHeader}>
          <UserAvatar
            photoUrl={post.userPhotoURL}
            displayName={post.userDisplayName}
            size={40}
          />
          <View style={styles.postInfo}>
            <Text style={styles.postUserName}>{post.userDisplayName}</Text>
            <Text style={styles.postTime}>
              {post.createdAt && (post.createdAt instanceof Timestamp || typeof post.createdAt?.toDate === 'function') 
                ? post.createdAt.toDate().toLocaleDateString() 
                : post.createdAt instanceof Date 
                  ? post.createdAt.toLocaleDateString()
                  : 'Unknown date'}
            </Text>
          </View>
        </View>

        <Text style={styles.postContent}>{post.content}</Text>

        {post.bookTitle && (
          <View style={styles.bookInfo}>
            <View style={styles.bookDetails}>
              <Text style={styles.bookTitle}>{post.bookTitle}</Text>
              <Text style={styles.bookAuthor}>by {post.bookAuthor}</Text>
            </View>
          </View>
        )}

        <View style={styles.postStats}>
          <Text style={styles.statsText}>
            {post.likes} {post.likes === 1 ? 'like' : 'likes'}
          </Text>
          <Text style={styles.statsText}>•</Text>
          <Text style={styles.statsText}>
            {post.comments} {post.comments === 1 ? 'comment' : 'comments'}
          </Text>
        </View>

        <View style={styles.divider} />
        
        <Text style={styles.commentsTitle}>Comments</Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose}>
              <FontAwesome name="arrow-left" size={20} color="#666" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Post</Text>
            <View style={{ width: 24 }} />
          </View>

          <FlatList
            data={comments}
            renderItem={renderComment}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={renderHeader}
            contentContainerStyle={styles.commentsList}
            showsVerticalScrollIndicator={false}
            refreshing={isLoading}
            onRefresh={() => {
              loadPost();
              loadComments();
            }}
            ListEmptyComponent={
              post ? (
                <View style={styles.emptyState}>
                  <FontAwesome name="comment-o" size={48} color="#ccc" />
                  <Text style={styles.emptyText}>No comments yet</Text>
                  <Text style={styles.emptySubtext}>Be the first to comment!</Text>
                </View>
              ) : null
            }
          />

          <View style={styles.inputContainer}>
            <UserAvatar
              photoUrl={user?.photoURL || undefined}
              displayName={user?.displayName || 'User'}
              size={32}
            />
            <TextInput
              style={styles.input}
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Write a comment..."
              placeholderTextColor="#999"
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!commentText.trim() || isSending) && styles.sendButtonDisabled]}
              onPress={handleSendComment}
              disabled={!commentText.trim() || isSending}
            >
              <FontAwesome
                name="send"
                size={18}
                color={commentText.trim() && !isSending ? '#0a7ea4' : '#ccc'}
              />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bookAuthor: {
    color: '#666',
    fontSize: 12,
  },
  bookDetails: {
    flex: 1,
  },
  bookInfo: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 12,
    padding: 12,
  },
  bookTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  commentContent: {
    flex: 1,
    marginLeft: 12,
  },
  commentHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  commentText: {
    fontSize: 15,
    lineHeight: 20,
  },
  commentTime: {
    color: '#999',
    fontSize: 12,
  },
  commentUserName: {
    fontSize: 14,
    fontWeight: '600',
  },
  commentsList: {
    flexGrow: 1,
    paddingVertical: 16,
  },
  commentsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  container: {
    backgroundColor: '#fff',
    flex: 1,
  },
  divider: {
    backgroundColor: '#eee',
    height: 1,
    marginVertical: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptySubtext: {
    color: '#999',
    fontSize: 14,
    marginTop: 4,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: '#eee',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  input: {
    flex: 1,
    fontSize: 15,
    marginHorizontal: 12,
    maxHeight: 100,
  },
  inputContainer: {
    alignItems: 'center',
    borderTopColor: '#eee',
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  keyboardView: {
    flex: 1,
  },
  postContainer: {
    borderBottomColor: '#eee',
    borderBottomWidth: 1,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  postContent: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
  },
  postHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 12,
  },
  postInfo: {
    flex: 1,
    marginLeft: 12,
  },
  postStats: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  postTime: {
    color: '#666',
    fontSize: 12,
  },
  postUserName: {
    fontSize: 16,
    fontWeight: '600',
  },
  sendButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  statsText: {
    color: '#666',
    fontSize: 13,
  },
});