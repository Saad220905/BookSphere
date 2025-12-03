import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import { collection, doc, getDoc, getDocs, orderBy, query, where, onSnapshot } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../../components/Themed';
import UserAvatar from '../../components/UserAvatar';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { createMockUser, createMockProfile, createMockPosts } from '../../utils/mockData';
import { Alert } from 'react-native'; // Import Alert

interface UserProfile {
  bio?: string;
  favoriteGenres?: string[];
  readingGoal?: number;
  booksRead?: number;
  friends?: number;
  joinDate?: string;
  displayName?: string;
  photoURL?: string;
}

interface UserPost {
  id: string;
  content: string;
  createdAt: any;
  likes: number;
  comments: number;
  bookTitle?: string;
  bookAuthor?: string;
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'videos' | 'books'>('posts');
  const { user, signOut } = useAuth();
  const { unreadCount } = useNotifications();

  // Load profile (Firestore or mock)
  // const loadProfile = useCallback(async () => {
  //   try {
  //     if (!db || !user) {
  //       const mockProfile = createMockProfile();
  //       setProfile(mockProfile);
  //       setIsLoading(false);
  //       return;
  //     }

  //     const profileDoc = await getDoc(doc(db, 'users', user.uid));
  //     if (profileDoc.exists()) {
  //       setProfile(profileDoc.data() as UserProfile);
  //     } else {
  //       setProfile(createMockProfile());
  //     }
  //   } catch (error) {
  //     console.warn('Using mock profile due to error:', error);
  //     setProfile(createMockProfile());
  //   } finally {
  //     setIsLoading(false);
  //   }
  // }, [user]);

  useEffect(() => {
    if (!db || !user) {
        setProfile(createMockProfile());
        setIsLoading(false);
        return;
    }
    
    const userRef = doc(db, 'users', user.uid);
    
    const unsubscribe = onSnapshot(userRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        setProfile(docSnapshot.data() as UserProfile);
      } else {
        setProfile(createMockProfile());
      }
      setIsLoading(false); 
    }, (error) => {
      console.error("Error fetching real-time profile:", error);
      setProfile(createMockProfile());
      setIsLoading(false);
    });

    return () => unsubscribe();
    
  }, [user, db]);

  const navigateToFriendsList = () => {
    const friendUids = Array.isArray(profile?.friends) ? profile.friends : [];
    
    if (friendUids.length === 0) {
      Alert.alert("No Friends Yet", "You need to add friends through the Chat screen first!");
      return;
    }

    router.push({
      pathname: '/profile/friends',
      params: { uids: JSON.stringify(friendUids) }
    });
  };

  // Load posts (Firestore or mock)
  const loadUserPosts = useCallback(async () => {
    try {
      if (!db || !user) {
        setUserPosts(createMockPosts(5));
        return;
      }

      const postsQuery = query(
        collection(db, 'posts'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(postsQuery);
      const postsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as UserPost[];

      setUserPosts(postsData);
    } catch (error) {
      console.warn('Using mock posts due to error:', error);
      setUserPosts(createMockPosts(5));
    }
  }, [user]);

  // Initialize profile + posts
  useEffect(() => {
    if (!user) {
      const mockUser = createMockUser();
      console.warn('Using mock user:', mockUser.displayName);
      setProfile(createMockProfile());
      setUserPosts(createMockPosts(5));
      setIsLoading(false);
      return;
    }

    // loadProfile();
    loadUserPosts();
  }, [user, loadUserPosts]);

  const renderPost = ({ item }: { item: UserPost }) => (
    <View style={styles.postCard}>
      <Text style={styles.postContent}>{item.content}</Text>
      {item.bookTitle && (
        <View style={styles.bookInfo}>
          <FontAwesome name="book" size={16} color="#0a7ea4" />
          <Text style={styles.bookText}>
            {item.bookTitle} by {item.bookAuthor}
          </Text>
        </View>
      )}
      <View style={styles.postStats}>
        <View style={styles.stat}>
          <FontAwesome name="heart" size={14} color="#666" />
          <Text style={styles.statText}>{item.likes}</Text>
        </View>
        <View style={styles.stat}>
          <FontAwesome name="comment" size={14} color="#666" />
          <Text style={styles.statText}>{item.comments}</Text>
        </View>
      </View>
    </View>
  );

  const renderGenreTag = (genre: string) => (
    <View key={genre} style={styles.genreTag}>
      <Text style={styles.genreText}>{genre}</Text>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentDisplayName = profile?.displayName || "User Profile";
  const currentPhotoUrl = profile?.photoURL;

  if (!user && !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Please sign in to view your profile</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <View style={styles.actionGroup}> 
            <TouchableOpacity 
              onPress={() => router.push('/notifications')}
              style={styles.notificationButton}
            >
              <FontAwesome name="bell" size={24} color="#666" />
              {unreadCount > 0 && (
                <View style={styles.badgeContainer}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/profile/edit')}>
              <FontAwesome name="cog" size={24} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.profileSection}>
          <UserAvatar
            photoUrl={currentPhotoUrl || undefined} // Must be null or undefined to trigger fallback
            displayName={currentDisplayName}      // Must be a non-empty string
            size={100}
          />
          <Text style={styles.displayName}>{user?.displayName || createMockUser().displayName}</Text>
          <Text style={styles.email}>{user?.email || createMockUser().email}</Text>

          {profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}

          <View style={styles.stats}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{userPosts?.length || 0}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            {/* <View style={styles.statItem}>
              <Text style={styles.statNumber}>{profile?.friends || 0}</Text>
              <Text style={styles.statLabel}>Friends</Text>
            </View> */}
            <TouchableOpacity 
              style={styles.statItem} 
              onPress={navigateToFriendsList}
            >
            <Text style={styles.statNumber}>
              {Array.isArray(profile?.friends) 
              ? profile.friends.length 
              : (typeof profile?.friends === 'number' ? profile.friends : 0)
              }
            </Text>              
            <Text style={styles.statLabel}>Friends</Text>
            </TouchableOpacity>
          </View>

          {profile?.favoriteGenres && profile.favoriteGenres.length > 0 && (
            <View style={styles.genresSection}>
              <Text style={styles.sectionTitle}>Favorite Genres</Text>
              <View style={styles.genresList}>{profile.favoriteGenres.map(renderGenreTag)}</View>
            </View>
          )}
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'posts' && styles.activeTab]}
            onPress={() => setActiveTab('posts')}
          >
            <Text style={[styles.tabText, activeTab === 'posts' && styles.activeTabText]}>Posts</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'books' && styles.activeTab]}
            onPress={() => setActiveTab('books')}
          >
            <Text style={[styles.tabText, activeTab === 'books' && styles.activeTabText]}>Books</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'posts' && (
          <FlatList
            data={userPosts}
            renderItem={renderPost}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            contentContainerStyle={styles.postsList}
          />
        )}

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <FontAwesome name="sign-out" size={20} color="#ff4444" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTab: {
    borderBottomColor: '#0a7ea4',
    borderBottomWidth: 2,
  },
  activeTabText: {
    color: '#0a7ea4',
    fontWeight: '600',
  },
  bio: {
    color: '#333',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
    textAlign: 'center',
  },
  bookInfo: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 8,
  },
  bookText: {
    color: '#0a7ea4',
    fontSize: 14,
    marginLeft: 8,
  },
  container: {
    backgroundColor: '#fff',
    flex: 1,
  },
  displayName: {
    fontSize: 24,
    fontWeight: '600',
    marginTop: 12,
  },
  email: {
    color: '#666',
    fontSize: 14,
    marginTop: 4,
  },
  genreTag: {
    backgroundColor: '#f0f8ff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  genreText: {
    color: '#0a7ea4',
    fontSize: 12,
    fontWeight: '500',
  },
  genresList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genresSection: {
    marginTop: 20,
    width: '100%',
  },
  goalProgress: {
    alignItems: 'center',
  },
  goalText: {
    color: '#666',
    fontSize: 14,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  notificationButton: {
    position: 'relative',
  },
  badgeContainer: {
    position: 'absolute',
    top: -5,
    right: -10,
    backgroundColor: '#ff4444',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  postCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
  },
  postContent: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 8,
  },
  postStats: {
    flexDirection: 'row',
    gap: 16,
  },
  postsList: {
    padding: 16,
  },
  profileSection: {
    alignItems: 'center',
    padding: 20,
  },
  progressBar: {
    backgroundColor: '#eee',
    borderRadius: 10,
    height: 8,
    marginBottom: 8,
    width: '100%',
  },
  progressFill: {
    backgroundColor: '#0a7ea4',
    borderRadius: 10,
    height: '100%',
  },
  readingGoalSection: {
    marginTop: 20,
    width: '100%',
  },
  scrollView: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  signOutButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 40,
    marginTop: 20,
    padding: 16,
  },
  signOutText: {
    color: '#ff4444',
    fontSize: 16,
    fontWeight: '600',
  },
  stat: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statText: {
    color: '#666',
    fontSize: 12,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    width: '100%',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
  },
  tabText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
  tabs: {
    flexDirection: 'row',
    marginTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#eee',
    borderRadius: 8,
    padding: 8,
    marginVertical: 10,
  },
  actionButton: {
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 10,
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 5,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyList: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
  },
});