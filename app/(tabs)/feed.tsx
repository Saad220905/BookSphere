import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import { addDoc, collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { FlatList, Image, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../../components/Themed';
import UserAvatar from '../../components/UserAvatar';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';

interface FeedPost {
  id: string;
  content: string;
  userId: string;
  userDisplayName: string;
  userPhotoURL?: string;
  bookTitle?: string;
  bookAuthor?: string;
  bookCoverUrl?: string;
  likes: number;
  comments: number;
  createdAt: any;
  likedBy: string[];
}

export default function FeedScreen() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

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

  const handleCreatePost = async () => {
    if (!user || !newPost.trim() || !db) return;

    try {
      const postData = {
        content: newPost.trim(),
        userId: user.uid,
        userDisplayName: user.displayName || 'Anonymous',
        userPhotoURL: user.photoURL,
        likes: 0,
        comments: 0,
        likedBy: [],
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'posts'), postData);
      setNewPost('');
      loadPosts(); // Refresh the feed
    } catch (error) {
      console.error('Error creating post:', error);
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
            <Image
              source={{ uri: item.bookCoverUrl || 'https://via.placeholder.com/60x80' }}
              style={styles.bookCover}
            />
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

          <TouchableOpacity style={styles.actionButton}>
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
        <TouchableOpacity onPress={() => router.push('/create/post')}>
          <FontAwesome name="plus" size={24} color="#0a7ea4" />
        </TouchableOpacity>
      </View>

      <View style={styles.createPost}>
        <UserAvatar
          photoUrl={user?.photoURL || undefined}
          displayName={user?.displayName || 'Anonymous'}
          size={40}
        />
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.postInput}
            value={newPost}
            onChangeText={setNewPost}
            placeholder="What are you reading?"
            placeholderTextColor="#999"
            multiline
            maxLength={280}
          />
          <TouchableOpacity
            style={[styles.postButton, !newPost.trim() && styles.postButtonDisabled]}
            onPress={handleCreatePost}
            disabled={!newPost.trim()}
          >
            <Text style={styles.postButtonText}>Post</Text>
          </TouchableOpacity>
        </View>
      </View>

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
  bookCover: {
    borderRadius: 4,
    height: 60,
    width: 40,
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
  createPost: {
    borderBottomColor: '#eee',
    borderBottomWidth: 1,
    flexDirection: 'row',
    padding: 16,
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
  inputContainer: {
    flex: 1,
    marginLeft: 12,
  },
  likedText: {
    color: '#ff4444',
  },
  postActions: {
    flexDirection: 'row',
    gap: 24,
  },
  postButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#0a7ea4',
    borderRadius: 20,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  postButtonDisabled: {
    backgroundColor: '#ccc',
  },
  postButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  postInput: {
    borderColor: '#eee',
    borderRadius: 20,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 40,
    paddingHorizontal: 16,
    paddingVertical: 8,
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