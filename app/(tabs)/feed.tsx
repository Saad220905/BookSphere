import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import { collection, doc, getDoc, getDocs, orderBy, query, updateDoc, addDoc, serverTimestamp, setDoc, Firestore, Timestamp } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View, Modal, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../../components/Themed';
import UserAvatar from '../../components/UserAvatar';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { getUserProfile, UserProfile } from '../../utils/userProfile';
import { rankPosts, FeedPost as RankedFeedPost } from '../../utils/postRanking';
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
  genre?: string;
  likes: number;
  comments: number;
  createdAt: any;
  likedBy: string[];
  score?: number;
}

export default function FeedScreen() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const { user } = useAuth();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isCommentsModalVisible, setIsCommentsModalVisible] = useState(false);
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [selectedPostForShare, setSelectedPostForShare] = useState<FeedPost | null>(null);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  useEffect(() => {
    if (currentUserProfile && user) {
      loadPosts();
    }
  }, [currentUserProfile, user]);

  const loadUserProfile = async () => {
    if (!user) return;
    try {
      const profile = await getUserProfile(user.uid);
      setCurrentUserProfile(profile);
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadPosts = async () => {
    try {
      setLoading(true);
      if (!db) return;

      // Load posts (limit to 100 for performance, rank them)
      const postsQuery = query(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(postsQuery);
      let postsData = snapshot.docs
        .slice(0, 100) // Limit to 100 posts for performance
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as FeedPost[];

      // Rank posts using the recommendation algorithm
      if (user && currentUserProfile) {
        const friendIds = currentUserProfile.friends || [];
        const ranked = await rankPosts(
          postsData as RankedFeedPost[],
          currentUserProfile,
          friendIds
        );

        postsData = ranked as FeedPost[];
      }
      
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

  const loadFriends = async () => {
    if (!user || !db) {
      setFriends([]);
      return;
    }

    try {
      setLoadingFriends(true);
      const currentUserProfile = await getUserProfile(user.uid);
      const friendIds = currentUserProfile?.friends || [];

      if (friendIds.length > 0) {
        const friendPromises = friendIds.map(id => getUserProfile(id));
        const friendProfiles = (await Promise.all(friendPromises)).filter(p => p !== null) as UserProfile[];
        setFriends(friendProfiles);
      } else {
        setFriends([]);
      }
    } catch (error) {
      console.error('Error loading friends:', error);
      setFriends([]);
    } finally {
      setLoadingFriends(false);
    }
  };

  const getConversationId = (uid1: string, uid2: string) => {
    return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
  };

  const handleSharePost = async (friend: UserProfile) => {
    if (!user || !db || !selectedPostForShare) return;

    try {
      const conversationId = getConversationId(user.uid, friend.uid);
      const firestoreDb = db as Firestore;

      // Ensure conversation document exists
      const conversationRef = doc(firestoreDb, 'conversations', conversationId);
      const conversationDoc = await getDoc(conversationRef);
      
      if (!conversationDoc.exists()) {
        await setDoc(conversationRef, {
          participants: [user.uid, friend.uid],
          createdAt: serverTimestamp(),
        });
      }

      // Format the shared post message
      let shareMessage = `📖 Shared post from ${selectedPostForShare.userDisplayName}:\n\n${selectedPostForShare.content}`;
      
      if (selectedPostForShare.bookTitle) {
        shareMessage += `\n\n📚 Book: ${selectedPostForShare.bookTitle}`;
        if (selectedPostForShare.bookAuthor) {
          shareMessage += ` by ${selectedPostForShare.bookAuthor}`;
        }
      }

      // Send the message
      const messagesCollection = collection(firestoreDb, 'conversations', conversationId, 'messages');
      await addDoc(messagesCollection, {
        text: shareMessage,
        senderId: user.uid,
        createdAt: serverTimestamp(),
      });

      setIsShareModalVisible(false);
      setSelectedPostForShare(null);
      Alert.alert('Shared!', `Post shared with ${friend.displayName}`);
    } catch (error) {
      console.error('Error sharing post:', error);
      Alert.alert('Error', 'Failed to share post. Please try again.');
    }
  };

  const handleOpenShare = (post: FeedPost) => {
    setSelectedPostForShare(post);
    setIsShareModalVisible(true);
    loadFriends();
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
              {item.createdAt && (item.createdAt instanceof Timestamp || typeof item.createdAt?.toDate === 'function') 
                ? item.createdAt.toDate().toLocaleDateString() 
                : item.createdAt instanceof Date 
                  ? item.createdAt.toLocaleDateString()
                  : 'Unknown date'}
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

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleOpenShare(item)}
          >
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

      <Modal
        visible={isShareModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setIsShareModalVisible(false);
          setSelectedPostForShare(null);
        }}
      >
        <View style={styles.shareModalBackdrop}>
          <View style={styles.shareModalContent}>
            <View style={styles.shareModalHeader}>
              <Text style={styles.shareModalTitle}>Share Post</Text>
              <TouchableOpacity
                onPress={() => {
                  setIsShareModalVisible(false);
                  setSelectedPostForShare(null);
                }}
              >
                <FontAwesome name="times" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {loadingFriends ? (
              <View style={styles.shareModalLoading}>
                <ActivityIndicator size="large" color="#0a7ea4" />
                <Text style={styles.shareModalLoadingText}>Loading friends...</Text>
              </View>
            ) : friends.length === 0 ? (
              <View style={styles.shareModalEmpty}>
                <FontAwesome name="map" size={48} color="#ccc" />
                <Text style={styles.shareModalEmptyText}>No friends yet</Text>
                <Text style={styles.shareModalEmptySubtext}>
                  Add friends to share posts with them
                </Text>
                <TouchableOpacity
                  style={styles.shareModalAddFriendsButton}
                  onPress={() => {
                    setIsShareModalVisible(false);
                    router.push('/(tabs)/chat');
                  }}
                >
                  <Text style={styles.shareModalAddFriendsButtonText}>Go to Friends</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={friends}
                keyExtractor={(item) => item.uid}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.shareModalFriendItem}
                    onPress={() => handleSharePost(item)}
                  >
                    <UserAvatar
                      photoUrl={item.photoURL}
                      displayName={item.displayName || 'Friend'}
                      size={50}
                    />
                    <View style={styles.shareModalFriendInfo}>
                      <Text style={styles.shareModalFriendName}>
                        {item.displayName || 'Friend'}
                      </Text>
                    </View>
                    <FontAwesome name="chevron-right" size={16} color="#ccc" />
                  </TouchableOpacity>
                )}
                contentContainerStyle={styles.shareModalFriendsList}
              />
            )}
          </View>
        </View>
      </Modal>

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
  shareModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  shareModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  shareModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  shareModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  shareModalLoading: {
    padding: 40,
    alignItems: 'center',
  },
  shareModalLoadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
  },
  shareModalEmpty: {
    padding: 40,
    alignItems: 'center',
  },
  shareModalEmptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    color: '#333',
  },
  shareModalEmptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  shareModalAddFriendsButton: {
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 20,
  },
  shareModalAddFriendsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  shareModalFriendsList: {
    padding: 16,
  },
  shareModalFriendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  shareModalFriendInfo: {
    flex: 1,
    marginLeft: 12,
  },
  shareModalFriendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
});