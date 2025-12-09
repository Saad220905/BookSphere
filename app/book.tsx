import { FontAwesome } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Firestore, collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import EmptyState from '../components/EmptyState';
//import ErrorState from '../components/ErrorState';
import LoadingSpinner from '../components/LoadingSpinner';
import { Text } from '../components/Themed';
import UserAvatar from '../components/UserAvatar';
import { db } from '../config/firebase';

interface Book {
  id: string;
  title: string;
  author: string;
  coverUrl?: string;
  description?: string;
  genre?: string;
  publishedYear?: number;
  isbn?: string;
  rating?: number;
  reviewCount?: number;
}

interface RelatedVideo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  userDisplayName: string;
  userPhotoURL?: string;
  likes: number;
  comments: number;
  createdAt: any;
}

interface RelatedClub {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  memberCount: number;
  createdBy: string;
}

export default function BookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [relatedVideos, setRelatedVideos] = useState<RelatedVideo[]>([]);
  const [relatedClubs, setRelatedClubs] = useState<RelatedClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBookData = useCallback(async () => {
    if (!db) {
      setError('Database is not initialized');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Load book details
      const bookDoc = await getDoc(doc(db as Firestore, 'books', id));
      if (!bookDoc.exists()) {
        setError('Book not found');
        setLoading(false);
        return;
      }
      setBook({ id: bookDoc.id, ...bookDoc.data() } as Book);

      // Load related content in parallel
      await Promise.all([
        // Load related videos
        getDocs(query(
          collection(db as Firestore, 'videos'),
          where('bookId', '==', id),
          orderBy('createdAt', 'desc'),
          limit(10)
        )).then(snapshot => {
          const videos = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          })) as RelatedVideo[];
          setRelatedVideos(videos);
        }).catch(err => {
          console.error('Error loading related videos:', err);
          setRelatedVideos([]);
        }),

        // Load related clubs
        getDocs(query(
          collection(db as Firestore, 'clubs'),
          where('bookId', '==', id),
          orderBy('memberCount', 'desc'),
          limit(10)
        )).then(snapshot => {
          const clubs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          })) as RelatedClub[];
          setRelatedClubs(clubs);
        }).catch(err => {
          console.error('Error loading related clubs:', err);
          setRelatedClubs([]);
        })
      ]);

    } catch (err) {
      console.error('Error loading book data:', err);
      setError('Failed to load book data');
      setBook(null);
      setRelatedVideos([]);
      setRelatedClubs([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadBookData();
    }
  }, [id, loadBookData]);

  const handleVideoPress = (videoId: string) => {
    router.push({
      pathname: '/(tabs)/videos',
      params: { id: videoId }
    });
  };

  const handleClubPress = (clubId: string) => {
    router.push(`/clubs/${clubId}`);
  };

  const handleCreateVideo = () => {
    router.push({
      pathname: '/create/video',
      params: { bookId: id }
    });
  };

  const handleCreateClub = () => {
    router.push({
      pathname: '/clubs/create',
      params: { bookId: id }
    });
  };

  const renderVideoItem = ({ item }: { item: RelatedVideo }) => (
    <TouchableOpacity
      style={styles.videoCard}
      onPress={() => handleVideoPress(item.id)}
    >
      <Image
        source={{ uri: item.thumbnailUrl }}
        style={styles.videoThumbnail}
        resizeMode="cover"
      />
      <View style={styles.videoInfo}>
        <View style={styles.videoHeader}>
          <UserAvatar
            photoUrl={item.userPhotoURL}
            displayName={item.userDisplayName}
            size={32}
          />
          <View style={styles.videoDetails}>
            <Text style={styles.videoTitle}>{item.title}</Text>
            <Text style={styles.videoAuthor}>{item.userDisplayName}</Text>
          </View>
        </View>
        <Text style={styles.videoDescription} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={styles.videoStats}>
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
    </TouchableOpacity>
  );

  const renderClubItem = ({ item }: { item: RelatedClub }) => (
    <TouchableOpacity
      style={styles.clubCard}
      onPress={() => handleClubPress(item.id)}
    >
      <Image
        source={{ uri: item.imageUrl }}
        style={styles.clubImage}
        resizeMode="cover"
      />
      <View style={styles.clubInfo}>
        <Text style={styles.clubName}>{item.name}</Text>
        <Text style={styles.clubDescription} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={styles.clubStats}>
          <View style={styles.stat}>
            <FontAwesome name="users" size={14} color="#666" />
            <Text style={styles.statText}>{item.memberCount} members</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="exclamation-triangle"
          title="Error"
          message={error}
        />
      </SafeAreaView>
    );
  }

  if (!book) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="book"
          title="Book not found"
          message="The book you're looking for doesn't exist or has been removed."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <FontAwesome name="arrow-left" size={24} color="#000" />
          </TouchableOpacity>
        </View>

        <View style={styles.bookSection}>
          <View style={styles.bookHeader}>
            <Image
              source={{ uri: book.coverUrl }}
              style={styles.bookCover}
              resizeMode="cover"
            />
            <View style={styles.bookInfo}>
              <Text style={styles.bookTitle}>{book.title}</Text>
              <Text style={styles.bookAuthor}>by {book.author}</Text>
              {book.genre && (
                <Text style={styles.bookGenre}>{book.genre}</Text>
              )}
              {book.publishedYear && (
                <Text style={styles.bookYear}>Published {book.publishedYear}</Text>
              )}
              {book.rating && (
                <View style={styles.ratingContainer}>
                  <FontAwesome name="star" size={16} color="#FFD700" />
                  <Text style={styles.ratingText}>{book.rating.toFixed(1)}</Text>
                  {book.reviewCount && (
                    <Text style={styles.reviewCount}>({book.reviewCount} reviews)</Text>
                  )}
                </View>
              )}
            </View>
          </View>

          {book.description && (
            <View style={styles.descriptionSection}>
              <Text style={styles.sectionTitle}>About this book</Text>
              <Text style={styles.bookDescription}>{book.description}</Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Video Reviews</Text>
            <FlatList
              data={relatedVideos}
              renderItem={renderVideoItem}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Book Clubs</Text>
            <FlatList
              data={relatedClubs}
              renderItem={renderClubItem}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            />
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionButton} onPress={handleCreateVideo}>
              <FontAwesome name="video-camera" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Create Video Review</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleCreateClub}>
              <FontAwesome name="users" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Create Book Club</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    padding: 12,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  backButton: {
    marginRight: 16,
  },
  bookAuthor: {
    color: '#666',
    fontSize: 16,
    marginBottom: 8,
  },
  bookCover: {
    borderRadius: 8,
    height: 120,
    width: 80,
  },
  bookDescription: {
    color: '#333',
    fontSize: 16,
    lineHeight: 24,
  },
  bookGenre: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    color: '#666',
    fontSize: 12,
    marginBottom: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  bookHeader: {
    flexDirection: 'row',
    gap: 16,
  },
  bookInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  bookSection: {
    padding: 16,
  },
  bookTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  bookYear: {
    color: '#666',
    fontSize: 14,
    marginBottom: 8,
  },
  clubCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 2,
    marginRight: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    width: 200,
  },
  clubDescription: {
    color: '#666',
    fontSize: 14,
    marginBottom: 8,
  },
  clubImage: {
    height: 100,
    width: '100%',
  },
  clubInfo: {
    padding: 12,
  },
  clubName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  clubStats: {
    flexDirection: 'row',
    gap: 16,
  },
  container: {
    backgroundColor: '#fff',
    flex: 1,
  },
  descriptionSection: {
    marginTop: 16,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: '#eee',
    borderBottomWidth: 1,
    flexDirection: 'row',
    padding: 16,
  },
  horizontalList: {
    paddingHorizontal: 16,
  },
  ratingContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  ratingText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  reviewCount: {
    color: '#666',
    fontSize: 14,
  },
  scrollView: {
    backgroundColor: '#fff',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  stat: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  statText: {
    color: '#666',
    fontSize: 12,
  },
  videoAuthor: {
    color: '#666',
    fontSize: 12,
  },
  videoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 2,
    marginRight: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    width: 280,
  },
  videoDescription: {
    color: '#666',
    fontSize: 14,
    marginBottom: 8,
  },
  videoDetails: {
    flex: 1,
    marginLeft: 8,
  },
  videoHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 8,
  },
  videoInfo: {
    padding: 12,
  },
  videoStats: {
    flexDirection: 'row',
    gap: 16,
  },
  videoThumbnail: {
    height: 120,
    width: '100%',
  },
  videoTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
}); 