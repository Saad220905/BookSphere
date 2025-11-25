import { FontAwesome } from '@expo/vector-icons';
import { collection, doc, getDoc, getDocs, orderBy, query, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../../components/Themed';
import UserAvatar from '../../components/UserAvatar';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import CreatePostModal from '../create/CreatePostModal';
import CommentsModal from '../create/CommentsModal';

interface FeedPost {
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

export default function FeedScreen() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isCommentsModalVisible, setIsCommentsModalVisible] = useState(false);

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      setLoading(true);
      if (!db) return;

      const postsQuery = query(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(postsQuery);
      const postsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as FeedPost[];
      
      setPosts(postsData);
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (postId: string) => {
    if (!user || !db) return;

    try {
      const postRef = doc(db, 'posts', postId);
      const postDoc = await getDoc(postRef);
      
      if (!postDoc.exists()) return;
      
      const postData = postDoc.data() as FeedPost;
      const isLiked = postData.likedBy.includes(user.uid);
      
      const newLikedBy = isLiked 
        ? postData.likedBy.filter(id => id !== user.uid)
        : [...postData.likedBy, user.uid];
      
      await updateDoc(postRef, {
        likes: newLikedBy.length,
        likedBy: newLikedBy,
      });
      
      loadPosts(); // Refresh the feed
    } catch (error) {
      console.error('Error updating like:', error);
    }
  };

  const handleOpenComments = (postId: string) => {
    setSelectedPostId(postId);
    setIsCommentsModalVisible(true);
  };

  const handleCloseComments = () => {
    setIsCommentsModalVisible(false);
    setSelectedPostId(null);
    loadPosts(); // Refresh to update comment counts
  };

  const renderPost = ({ item }: { item: FeedPost }) => {
    const isLiked = item.likedBy.includes(user?.uid || '');
    
    return (
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <UserAvatar
            photoUrl={item.userPhotoURL}
            displayName={item.userDisplayName}
            size={40}
          />
          <View style={styles.postInfo}>
            <Text style={styles.userName}>{item.userDisplayName}</Text>
            <Text style={styles.postTime}>
              {item.createdAt?.toDate().toLocaleDateString()}
            </Text>
          </View>
        </View>

        <Text style={styles.postContent}>{item.content}</Text>

        {item.bookTitle && (
          <View style={styles.bookInfo}>
            <View style={styles.bookDetails}>
              <Text style={styles.bookTitle}>{item.bookTitle}</Text>
              <Text style={styles.bookAuthor}>by {item.bookAuthor}</Text>
            </View>
          </View>
        )}

        <View style={styles.postActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleLike(item.id)}
          >
            <FontAwesome
              name={isLiked ? 'heart' : 'heart-o'}
              size={20}
              color={isLiked ? '#ff4444' : '#666'}
            />
            <Text style={[styles.actionText, isLiked && styles.likedText]}>
              {item.likes}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleOpenComments(item.id)}
          >
            <FontAwesome name="comment-o" size={20} color="#666" />
            <Text style={styles.actionText}>{item.comments}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <FontAwesome name="share" size={20} color="#666" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>BookFeed</Text>
        <TouchableOpacity onPress={() => setIsModalVisible(true)}>
          <FontAwesome name="plus" size={24} color="#0a7ea4" />
        </TouchableOpacity>
      </View>

      <CreatePostModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onPostCreated={() => {
          loadPosts();
          setIsModalVisible(false);
        }}
      />

      {selectedPostId && (
        <CommentsModal
          visible={isCommentsModalVisible}
          postId={selectedPostId}
          onClose={handleCloseComments}
        />
      )}

      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.feedList}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={loadPosts}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  actionText: {
    color: '#666',
    fontSize: 14,
  },
  bookAuthor: {
    color: '#666',
    fontSize: 12,
  },
  bookDetails: {
    flex: 1,
    marginLeft: 12,
  },
  bookInfo: {
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    flexDirection: 'row',
    marginBottom: 12,
    padding: 12,
  },
  bookTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  container: {
    backgroundColor: '#fff',
    flex: 1,
  },
  feedList: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: '#eee',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  likedText: {
    color: '#ff4444',
  },
  postActions: {
    flexDirection: 'row',
    gap: 24,
  },
  postCard: {
    backgroundColor: '#fff',
    borderColor: '#eee',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
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
  postTime: {
    color: '#666',
    fontSize: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
});