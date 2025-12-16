import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  Firestore,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Text } from '../../components/Themed';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';

interface BookClub {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  coverImage?: string;
  bookId?: string;
  memberCount?: number;
  createdAt: any;
  createdBy?: string;
  createdByDisplayName?: string;
  book?: {
    id: string;
    title?: string;
    author?: string;
    coverUrl?: string;
    cover_url?: string;
  };
  isMember?: boolean;
}

export default function ClubsScreen() {
  const { user } = useAuth();
  const [clubs, setClubs] = useState<BookClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [membershipStatus, setMembershipStatus] = useState<Record<string, boolean>>({});

  const firestore = db as Firestore | null;

  const checkMembership = useCallback(async (clubId: string): Promise<boolean> => {
    if (!firestore || !user) return false;

    try {
      const membersQuery = query(
        collection(firestore, 'club_members'),
        where('clubId', '==', clubId),
        where('userId', '==', user.uid),
        limit(1)
      );
      const snapshot = await getDocs(membersQuery);
      return !snapshot.empty;
    } catch (err) {
      console.error('Error checking membership:', err);
      return false;
    }
  }, [firestore, user]);

  const loadBookData = useCallback(async (bookId: string) => {
    if (!firestore || !bookId) return null;

    try {
      const bookRef = doc(firestore, 'books', bookId);
      const bookSnap = await getDoc(bookRef);
      if (bookSnap.exists()) {
        const data = bookSnap.data();
        return {
          id: bookSnap.id,
          title: data.title,
          author: data.author,
          coverUrl: data.coverUrl || data.cover_url,
        };
      }
    } catch (err) {
      console.error('Error loading book:', err);
    }
    return null;
  }, [firestore]);

  const loadClubs = useCallback(async () => {
    if (!firestore) {
      setError('Database is not initialized');
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const clubsQuery = query(
        collection(firestore, 'clubs'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(clubsQuery);
      
      const clubsData: BookClub[] = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          const club: BookClub = {
            id: docSnap.id,
            name: data.name || 'Unnamed Club',
            description: data.description,
            imageUrl: data.imageUrl || data.coverImage,
            coverImage: data.coverImage || data.imageUrl,
            bookId: data.bookId,
            memberCount: data.memberCount || 0,
            createdAt: data.createdAt,
            createdBy: data.createdBy,
            createdByDisplayName: data.createdByDisplayName || 'Unknown',
          };

          // Load book data if bookId exists
          if (club.bookId) {
            const book = await loadBookData(club.bookId);
            if (book) {
              club.book = book;
            }
          }

          // Check membership status
          if (user) {
            club.isMember = await checkMembership(club.id);
          }

          return club;
        })
      );

      setClubs(clubsData);
    } catch (err) {
      console.error('Error loading clubs:', err);
      setError('Failed to load clubs. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [firestore, user, checkMembership, loadBookData]);

  useEffect(() => {
    loadClubs();
  }, [loadClubs]);

  // Set up real-time listener for clubs
  useEffect(() => {
    if (!firestore) return;

    const clubsQuery = query(
      collection(firestore, 'clubs'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      clubsQuery,
      async (snapshot) => {
        const clubsData: BookClub[] = await Promise.all(
          snapshot.docs.map(async (docSnap) => {
            const data = docSnap.data();
            const club: BookClub = {
              id: docSnap.id,
              name: data.name || 'Unnamed Club',
              description: data.description,
              imageUrl: data.imageUrl || data.coverImage,
              coverImage: data.coverImage || data.imageUrl,
              bookId: data.bookId,
              memberCount: data.memberCount || 0,
              createdAt: data.createdAt,
              createdBy: data.createdBy,
              createdByDisplayName: data.createdByDisplayName || 'Unknown',
            };

            if (club.bookId) {
              const book = await loadBookData(club.bookId);
              if (book) {
                club.book = book;
              }
            }

            if (user) {
              club.isMember = await checkMembership(club.id);
            }

            return club;
          })
        );

        setClubs(clubsData);
        setLoading(false);
      },
      (err) => {
        console.error('Error in clubs snapshot:', err);
        setError('Failed to load clubs');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firestore, user, checkMembership, loadBookData]);

  const handleJoinClub = useCallback(async (clubId: string) => {
    if (!firestore || !user) {
      Alert.alert('Sign in required', 'Please log in to join this club.');
      return;
    }

    try {
      // Check if already a member
      const membersRef = collection(firestore, 'club_members');
      const membershipQuery = query(
        membersRef,
        where('clubId', '==', clubId),
        where('userId', '==', user.uid),
        limit(1)
      );
      const membershipSnap = await getDocs(membershipQuery);
      
      if (!membershipSnap.empty) {
        Alert.alert('Already a member', 'You are already a member of this club.');
        return;
      }

      // Add membership
      await addDoc(membersRef, {
        clubId,
        userId: user.uid,
        role: 'member',
        joinedAt: serverTimestamp(),
      });

      // Update member count
      await updateDoc(doc(firestore, 'clubs', clubId), {
        memberCount: increment(1),
      });

      // Update local state
      setMembershipStatus((prev) => ({ ...prev, [clubId]: true }));
      setClubs((prev) =>
        prev.map((club) =>
          club.id === clubId
            ? { ...club, isMember: true, memberCount: (club.memberCount || 0) + 1 }
            : club
        )
      );

      Alert.alert('Success', 'You have joined the club!');
    } catch (err) {
      console.error('Error joining club:', err);
      Alert.alert('Error', 'Unable to join club. Please try again.');
    }
  }, [firestore, user]);

  const handleLeaveClub = useCallback(async (clubId: string) => {
    if (!firestore || !user) {
      return;
    }

    Alert.alert(
      'Leave Club',
      'Are you sure you want to leave this club?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              const membersRef = collection(firestore, 'club_members');
              const membershipQuery = query(
                membersRef,
                where('clubId', '==', clubId),
                where('userId', '==', user.uid)
              );
              const membershipSnap = await getDocs(membershipQuery);

              if (!membershipSnap.empty) {
                await Promise.all(
                  membershipSnap.docs.map((docSnap) => deleteDoc(docSnap.ref))
                );

                await updateDoc(doc(firestore, 'clubs', clubId), {
                  memberCount: increment(-1),
                });

                setMembershipStatus((prev) => ({ ...prev, [clubId]: false }));
                setClubs((prev) =>
                  prev.map((club) =>
                    club.id === clubId
                      ? { ...club, isMember: false, memberCount: Math.max(0, (club.memberCount || 0) - 1) }
                      : club
                  )
                );
              }
            } catch (err) {
              console.error('Error leaving club:', err);
              Alert.alert('Error', 'Unable to leave club. Please try again.');
            }
          },
        },
      ]
    );
  }, [firestore, user]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadClubs();
  }, [loadClubs]);

  const renderClub = ({ item }: { item: BookClub }) => {
    const clubImage = item.imageUrl || item.coverImage;
    const bookCover = item.book?.coverUrl || item.book?.cover_url;
    const isMember = item.isMember || membershipStatus[item.id] || false;

    return (
      <TouchableOpacity
        style={styles.clubCard}
        onPress={() => router.push(`/clubs/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.clubHeader}>
          <Image
            source={{
              uri: clubImage || 'https://via.placeholder.com/80x80/0a7ea4/ffffff?text=📚',
            }}
            style={styles.clubImage}
            resizeMode="cover"
          />
          <View style={styles.clubInfo}>
            <Text style={styles.clubName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.clubCreator} numberOfLines={1}>
              by {item.createdByDisplayName}
            </Text>
            <View style={styles.clubStats}>
              <FontAwesome name="users" size={12} color="#666" />
              <Text style={styles.memberCount}>
                {item.memberCount || 0} {item.memberCount === 1 ? 'member' : 'members'}
              </Text>
            </View>
          </View>
        </View>

        {item.description && (
          <Text style={styles.clubDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        {item.book && (
          <View style={styles.currentBook}>
            <Text style={styles.currentBookLabel}>Currently Reading</Text>
            <View style={styles.bookInfo}>
              {bookCover && (
                <Image
                  source={{ uri: bookCover }}
                  style={styles.bookCover}
                  resizeMode="cover"
                />
              )}
              <View style={styles.bookDetails}>
                <Text style={styles.bookTitle} numberOfLines={1}>
                  {item.book.title || 'Unknown Book'}
                </Text>
                {item.book.author && (
                  <Text style={styles.bookAuthor} numberOfLines={1}>
                    by {item.book.author}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        <View style={styles.clubActions}>
          {isMember ? (
            <TouchableOpacity
              style={styles.leaveButton}
              onPress={(e) => {
                e.stopPropagation();
                handleLeaveClub(item.id);
              }}
            >
              <FontAwesome name="check" size={14} color="#2ecc71" />
              <Text style={styles.leaveButtonText}>Member</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.joinButton}
              onPress={(e) => {
                e.stopPropagation();
                handleJoinClub(item.id);
              }}
            >
              <FontAwesome name="plus" size={14} color="#0a7ea4" />
              <Text style={styles.joinButtonText}>Join Club</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && clubs.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Book Clubs</Text>
          <TouchableOpacity onPress={() => router.push('/create/club')}>
            <FontAwesome name="plus" size={24} color="#0a7ea4" />
          </TouchableOpacity>
        </View>
        <LoadingSpinner message="Loading clubs..." />
      </SafeAreaView>
    );
  }

  if (error && clubs.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Book Clubs</Text>
          <TouchableOpacity onPress={() => router.push('/create/club')}>
            <FontAwesome name="plus" size={24} color="#0a7ea4" />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <FontAwesome name="exclamation-circle" size={48} color="#ff4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadClubs}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Book Clubs</Text>
        <TouchableOpacity
          onPress={() => router.push('/create/club')}
          style={styles.createButton}
        >
          <FontAwesome name="plus" size={20} color="#0a7ea4" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={clubs}
        renderItem={renderClub}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.clubsList,
          clubs.length === 0 && styles.emptyList,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="book"
            title="No Book Clubs Yet"
            message="Join or create a book club to start reading together!"
            actionLabel="Create Your First Club"
            onAction={() => router.push('/create/club')}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bookAuthor: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  bookCover: {
    borderRadius: 6,
    height: 50,
    width: 35,
  },
  bookDetails: {
    flex: 1,
    marginLeft: 12,
  },
  bookInfo: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  bookTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  clubActions: {
    alignItems: 'flex-end',
    marginTop: 12,
  },
  clubCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  clubCreator: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  clubDescription: {
    color: '#333',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
    marginTop: 8,
  },
  clubHeader: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  clubImage: {
    borderRadius: 12,
    height: 80,
    width: 80,
  },
  clubInfo: {
    flex: 1,
    marginLeft: 12,
  },
  clubName: {
    fontSize: 18,
    fontWeight: '700',
  },
  clubStats: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  clubsList: {
    padding: 16,
  },
  container: {
    backgroundColor: '#f5f6f8',
    flex: 1,
  },
  createButton: {
    alignItems: 'center',
    backgroundColor: '#e7f3f8',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  currentBook: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginTop: 12,
    padding: 12,
  },
  currentBookLabel: {
    color: '#666',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  emptyList: {
    flexGrow: 1,
  },
  errorContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    color: '#222',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  header: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomColor: '#eee',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  joinButton: {
    alignItems: 'center',
    backgroundColor: '#e7f3f8',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  joinButtonText: {
    color: '#0a7ea4',
    fontSize: 14,
    fontWeight: '600',
  },
  leaveButton: {
    alignItems: 'center',
    backgroundColor: '#e9f8f1',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  leaveButtonText: {
    color: '#2ecc71',
    fontSize: 14,
    fontWeight: '600',
  },
  memberCount: {
    color: '#666',
    fontSize: 12,
  },
  retryButton: {
    backgroundColor: '#0a7ea4',
    borderRadius: 20,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});
