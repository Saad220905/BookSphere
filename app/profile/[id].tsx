import { FontAwesome } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { collection, doc, getDocs, orderBy, query, where, onSnapshot } from 'firebase/firestore'; 
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../../components/Themed';
import UserAvatar from '../../components/UserAvatar';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { createMockUser, createMockProfile, createMockPosts } from '../../utils/mockData'; 
import { Alert } from 'react-native'; 

// --- Interface Definitions ---
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

export default function TargetProfileScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const targetId = params.id as string; 
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'videos' | 'books'>('posts');

  const isViewingSelf = targetId === user?.uid;

  useEffect(() => {
    if (!db || !targetId) {
        setProfile(createMockProfile() as UserProfile); 
        setIsLoading(false);
        return;
    }
    
    const userRef = doc(db, 'users', targetId);
    
    const unsubscribe = onSnapshot(userRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
            setProfile(docSnapshot.data() as UserProfile);
        } else {
            setProfile(createMockProfile() as UserProfile);
        }
        setIsLoading(false); 
    }, (error) => {
        console.error("Error fetching target profile:", error);
        setProfile(createMockProfile() as UserProfile);
        setIsLoading(false);
    });

    return () => unsubscribe();
    
  }, [targetId, db]);

  const loadUserPosts = useCallback(async () => {
    try {
      if (!db || !targetId) {
        setUserPosts(createMockPosts(5) as UserPost[]);
        return;
      }

      const postsQuery = query(
        collection(db, 'posts'),
        where('userId', '==', targetId), 
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
      setUserPosts(createMockPosts(5) as UserPost[]);
    }
  }, [targetId]);

  useEffect(() => {
    if (targetId) {
        loadUserPosts();
        setActiveTab('posts');
    }
  }, [targetId, loadUserPosts]);

  const navigateToSendRecommendation = () => {
      if (!profile?.displayName) {
          Alert.alert("Error", "Profile data missing.");
          return;
      }
      router.push({
          pathname: '/recommendation/send',
          params: {
              recipientId: targetId,
              recipientName: profile.displayName,
          }
      });
  };

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

  if (isLoading || !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading {profile?.displayName || 'profile'}...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!targetId || isViewingSelf) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
        <Text style={{color: '#ff4444'}}>Error: Profile not found or incorrect route.</Text>
          <TouchableOpacity onPress={() => router.back()} style={{marginTop: 20}}>
            <Text style={{color: '#0a7ea4'}}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const friendDisplayName = profile?.displayName || 'Friend Profile';
  const friendPhotoURL = profile?.photoURL;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <FontAwesome name="arrow-left" size={24} color="#666" />
          </TouchableOpacity>

          <Text style={styles.title}>{friendDisplayName}</Text>
            
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={navigateToSendRecommendation}>
              <FontAwesome name="send" size={24} color="#0a7ea4" />
            </TouchableOpacity>
                
            <TouchableOpacity onPress={() => {
              router.push({
                pathname: `/chat/${targetId}`,
                params: { otherUserName: friendDisplayName }
              });
            }}>
              <FontAwesome name="comment" size={24} color="#0a7ea4" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.profileSection}>
          <UserAvatar
            photoUrl={friendPhotoURL || undefined}
            displayName={friendDisplayName}
            size={100}
          />
          <Text style={styles.displayName}>{friendDisplayName}</Text>
          <Text style={styles.email}>{profile.bio || 'No bio set.'}</Text> 

          <View style={styles.stats}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{userPosts?.length || 0}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            
            <View style={styles.statItem}>
                <Text style={styles.statNumber}>{profile.friends?.length || 0}</Text> 
                <Text style={styles.statLabel}>Friends</Text>
            </View>
          </View>

          {profile.favoriteGenres && profile.favoriteGenres.length > 0 && (
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
	loadingContainer: { 
		flex: 1, 
		alignItems: 'center', 
		justifyContent: 'center' 
	},
	activeTab: { 
		borderBottomColor: '#0a7ea4', 
		borderBottomWidth: 2 
	},
	activeTabText: { 
		color: '#0a7ea4', 
		fontWeight: '600' 
	},
	bio: { 
		color: '#333', 
		fontSize: 16, 
		lineHeight: 24, 
		marginTop: 12, 
		textAlign: 'center' 
	},
	bookInfo: { 
		alignItems: 'center', 
		flexDirection: 'row', 
		marginBottom: 8 
	},
	bookText: { 
		color: '#0a7ea4', 
		fontSize: 14, 
		marginLeft: 8 
	},
	container: { 
		backgroundColor: '#fff', 
		flex: 1 
	},
	displayName: { 
		fontSize: 24, 
		fontWeight: '600', 
		marginTop: 12 
	},
	email: { 
		color: '#666', 
		fontSize: 14, 
		marginTop: 4 
	},
	genreTag: { 
		backgroundColor: '#f0f8ff', 
		borderRadius: 16, 
		paddingHorizontal: 12, 
		paddingVertical: 6 
	},
	genreText: { 
		color: '#0a7ea4', 
		fontSize: 12, 
		fontWeight: '500' 
	},
	genresList: { 
		flexDirection: 'row', 
		flexWrap: 'wrap', 
		gap: 8 
	},
	genresSection: { 
		marginTop: 20, 
		width: '100%' 
	},
	header: { 
		alignItems: 'center', 
		flexDirection: 'row', 
		padding: 16, 
		justifyContent: 'space-between' 
	},
	headerActions: { 
		flexDirection: 'row', 
		alignItems: 'center', 
		gap: 15 
	},
	backButton: { 
		marginRight: 15 
	},
	postCard: { 
		backgroundColor: '#f8f9fa', 
		borderRadius: 12, 
		marginBottom: 12, 
		padding: 16 
	},
	postContent: { 
		fontSize: 16, 
		lineHeight: 24, 
		marginBottom: 8 
	},
	postStats: { 
		flexDirection: 'row', 
		gap: 16 
	},
	stat: { 
		alignItems: 'center', 
		flexDirection: 'row', 
		gap: 4 
	},
	statText: { 
		color: '#666', 
		fontSize: 12 
	},
	postsList: { 
		padding: 16 
	},
	profileSection: { 
		alignItems: 'center', 
		padding: 20 
	},
	scrollView: { 
		flex: 1 
	},
	sectionTitle: { 
		fontSize: 18, 
		fontWeight: '600', 
		marginBottom: 12 
	},
	statItem: { 
		alignItems: 'center' 
	},
	statLabel: { 
		color: '#666', 
		fontSize: 12, 
		marginTop: 4 
	},
	statNumber: { 
		fontSize: 20, 
		fontWeight: 'bold' 
	},
	stats: { 
		flexDirection: 'row', 
		justifyContent: 'space-around', 
		marginTop: 20, 
		width: '100%' 
	},
	tab: { 
		flex: 1, 
		paddingVertical: 12 
	},
	tabText: { 
		color: '#666', 
		fontSize: 16, 
		textAlign: 'center' 
	},
	tabs: { 
		flexDirection: 'row', 
		marginTop: 20 
	},
	title: { 
		fontSize: 24, 
		fontWeight: 'bold', 
		flex: 1, 
		textAlign: 'center' 
	},
});