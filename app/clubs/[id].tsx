import { FontAwesome } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Text } from '../../components/Themed';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { calculateOverallBookSentiment } from '../../utils/bookComments';

interface ClubDetails {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  coverImage?: string;
  bookId?: string;
  memberCount?: number;
  createdBy?: string;
  createdByDisplayName?: string;
}

interface BookDetails {
  id: string;
  title?: string;
  author?: string;
  coverUrl?: string;
  cover_url?: string;
  pdfUrl?: string;
  pdf_url?: string;
}

interface ClubPost {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: Date | null;
  pageNumber?: number | null;
}

export default function ClubDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, userProfile } = useAuth();
  const router = useRouter();

  const [club, setClub] = useState<ClubDetails | null>(null);
  const [book, setBook] = useState<BookDetails | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [forumPosts, setForumPosts] = useState<ClubPost[]>([]);
  const [newPost, setNewPost] = useState('');
  const [draftPageContext, setDraftPageContext] = useState<number | null>(null);
  const [overallSentiment, setOverallSentiment] = useState<'Positive' | 'Negative' | 'Neutral' | 'Mixed' | 'No Comments' | 'AnalysisError' | 'Loading...'>('Loading...');

  const isAuthenticated = Boolean(user);
  const firestore = db as Firestore | null;

  const bookCover = useMemo(() => {
    if (!book) return null;
    return book.coverUrl || book.cover_url || null;
  }, [book]);

  const fetchClub = useCallback(async () => {
    if (!firestore || !id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const clubRef = doc(firestore, 'clubs', id);
      const clubSnap = await getDoc(clubRef);

      if (!clubSnap.exists()) {
        setError('Book club not found');
        setClub(null);
        setBook(null);
        return;
      }

      const clubData = { ...(clubSnap.data() as ClubDetails), id: clubSnap.id };
      setClub(clubData);

      if (clubData.bookId) {
        const bookRef = doc(firestore, 'books', clubData.bookId);
        const bookSnap = await getDoc(bookRef);
        if (bookSnap.exists()) {
          setBook({ ...(bookSnap.data() as BookDetails), id: bookSnap.id });
        } else {
          setBook(null);
        }
      } else {
        setBook(null);
      }
    } catch (err) {
      console.error('Error loading club:', err);
      setError('Failed to load club');
      setClub(null);
      setBook(null);
    } finally {
      setLoading(false);
    }
  }, [firestore, id]);

  const refreshMembership = useCallback(async () => {
    if (!firestore || !id || !user) {
      setIsMember(false);
      return;
    }

    try {
      const membersQuery = query(
        collection(firestore, 'club_members'),
        where('clubId', '==', id),
        where('userId', '==', user.uid),
        limit(1)
      );
      const snapshot = await getDocs(membersQuery);
      setIsMember(!snapshot.empty);
    } catch (err) {
      console.error('Error checking membership:', err);
      setIsMember(false);
    }
  }, [firestore, id, user]);

  useEffect(() => {
    fetchClub();
  }, [fetchClub]);

  useEffect(() => {
    refreshMembership();
  }, [refreshMembership]);

  useEffect(() => {
    const fetchSentiment = async () => {
      if (book?.id) {
        try {
          const result = await calculateOverallBookSentiment(book.id);
          setOverallSentiment(result);
        } catch (error) {
          console.error('Error calculating sentiment:', error);
          setOverallSentiment('AnalysisError');
        }
      } else {
        setOverallSentiment('Loading...');
      }
    };
    fetchSentiment();
  }, [book?.id]);

  useEffect(() => {
    if (!firestore || !id) return;
    const postsRef = collection(firestore, 'clubs', id, 'posts');
    const postsQuery = query(postsRef, orderBy('createdAt', 'desc'), limit(50));

    const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
      const posts: ClubPost[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          body: data.body ?? '',
          authorId: data.authorId ?? '',
          authorName: data.authorName ?? 'Club member',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
          pageNumber: data.pageNumber ?? null,
        };
      });
      setForumPosts(posts);
    });

    return unsubscribe;
  }, [firestore, id]);

  const handleJoinClub = useCallback(async () => {
    if (!firestore || !id) {
      Alert.alert('Unavailable', 'Database is not initialized.');
      return;
    }
    if (!user) {
      Alert.alert('Sign in required', 'Please log in to join this club.');
      return;
    }

    try {
      const membersRef = collection(firestore, 'club_members');
      const membershipQuery = query(
        membersRef,
        where('clubId', '==', id),
        where('userId', '==', user.uid),
        limit(1)
      );
      const membershipSnap = await getDocs(membershipQuery);
      if (!membershipSnap.empty) {
        setIsMember(true);
        return;
      }

      await addDoc(membersRef, {
        clubId: id,
        userId: user.uid,
        role: 'member',
        joinedAt: serverTimestamp(),
      });

      await updateDoc(doc(firestore, 'clubs', id), {
        memberCount: increment(1),
      });

      setIsMember(true);
    } catch (err) {
      console.error('Error joining club:', err);
      Alert.alert('Error', 'Unable to join club. Please try again.');
    }
  }, [firestore, id, user]);

  const handleLeaveClub = useCallback(async () => {
    if (!firestore || !id) {
      Alert.alert('Unavailable', 'Database is not initialized.');
      return;
    }
    if (!user) {
      Alert.alert('Error', 'You are not signed in.');
      return;
    }

    try {
      const membersRef = collection(firestore, 'club_members');
      const membershipQuery = query(
        membersRef,
        where('clubId', '==', id),
        where('userId', '==', user.uid)
      );
      const membershipSnap = await getDocs(membershipQuery);
      if (membershipSnap.empty) {
        setIsMember(false);
        return;
      }

      await Promise.all(membershipSnap.docs.map((docSnap) => deleteDoc(docSnap.ref)));

      await updateDoc(doc(firestore, 'clubs', id), {
        memberCount: increment(-1),
      });

      setIsMember(false);
    } catch (err) {
      console.error('Error leaving club:', err);
      Alert.alert('Error', 'Unable to leave club. Please try again.');
    }
  }, [firestore, id, user]);

  const handleCreatePost = useCallback(async () => {
    if (!firestore || !id) {
      Alert.alert('Unavailable', 'Database is not initialized.');
      return;
    }
    if (!user) {
      Alert.alert('Sign in required', 'Log in to participate in the forum.');
      return;
    }
    if (!isMember) {
      Alert.alert('Join required', 'Join this club before posting.');
      return;
    }
    if (!newPost.trim()) {
      return;
    }

    try {
      const postsRef = collection(firestore, 'clubs', id, 'posts');
      await addDoc(postsRef, {
        body: newPost.trim(),
        pageNumber: draftPageContext ?? null,
        authorId: user.uid,
        authorName: userProfile?.displayName || user.email || 'Club member',
        createdAt: serverTimestamp(),
      });
      setNewPost('');
    } catch (err) {
      console.error('Error creating post:', err);
      Alert.alert('Error', 'Unable to publish your message right now.');
    }
  }, [draftPageContext, firestore, id, isMember, newPost, user, userProfile]);

  const handleOpenReadingRoom = useCallback((pageNumber?: number) => {
    if (!book) return;
    const pdfUrl = book.pdfUrl || book.pdf_url;
    if (!pdfUrl) return;
    
    const params: Record<string, string> = {
      pdf_url: pdfUrl,
      book_id: book.id,
    };
    
    if (book.title) {
      params.book_title = book.title;
    }
    
    if (pageNumber) {
      params.initial_page = pageNumber.toString();
    }
    
    router.push({
      pathname: '/viewer',
      params,
    });
  }, [router, book]);

  const getSentimentStyle = (sentiment: string) => {
    switch (sentiment) {
      case 'Positive': return { color: '#1B5E20', backgroundColor: '#C8E6C9', emoji: '😊' };
      case 'Negative': return { color: '#B71C1C', backgroundColor: '#FFCDD2', emoji: '😔' };
      case 'Mixed': return { color: '#37474F', backgroundColor: '#CFD8DC', emoji: '🤨' };
      case 'Neutral':
      case 'No Comments':
      case 'AnalysisError':
        return { color: '#5D4037', backgroundColor: '#FFF9C4', emoji: '😐' };
      case 'Loading...':
      default:
        return { color: '#777', backgroundColor: '#F0F0F0', emoji: '...' };
    }
  };

  const formatPostTimestamp = (date: Date | null) => {
    if (!date) return 'Just now';
    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const renderForumPosts = () => (
    <View style={styles.forumSection}>
      {forumPosts.length === 0 ? (
        <View style={styles.emptyForum}>
          <FontAwesome name="comments" size={36} color="#ccc" />
          <Text style={styles.emptyForumTitle}>No discussions yet</Text>
          <Text style={styles.emptyForumSubtitle}>
            Be the first to start a conversation with your club!
          </Text>
        </View>
      ) : (
        forumPosts.map((post) => (
          <View key={post.id} style={styles.postCard}>
            <View style={styles.postHeader}>
              <Text style={styles.postAuthor}>{post.authorName}</Text>
              {post.pageNumber ? (
                <TouchableOpacity
                  style={styles.pageBadge}
                  onPress={() => {
                    if (book && post.pageNumber) {
                      handleOpenReadingRoom(post.pageNumber);
                    } else {
                      Alert.alert('No PDF', 'This book does not have a PDF available.');
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <FontAwesome name="file-text" size={12} color="#0a7ea4" />
                  <Text style={styles.pageBadgeText}>Page {post.pageNumber}</Text>
                  <FontAwesome name="external-link" size={10} color="#0a7ea4" style={styles.pageLinkIcon} />
                </TouchableOpacity>
              ) : null}
            </View>
            <Text style={styles.postBody}>{post.body}</Text>
            <Text style={styles.postTimestamp}>{formatPostTimestamp(post.createdAt)}</Text>
          </View>
        ))
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
        style={styles.postComposer}
      >
        <View style={styles.pageContextRow}>
          {draftPageContext ? (
            <View style={styles.pageContextBadge}>
              <FontAwesome name="file-text" size={12} color="#0a7ea4" />
              <Text style={styles.pageContextText}>Page {draftPageContext}</Text>
              <TouchableOpacity 
                onPress={() => setDraftPageContext(null)}
                style={styles.removePageButton}
              >
                <FontAwesome name="times" size={12} color="#666" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.pageContextActions}>
              <TouchableOpacity
                style={styles.linkPageButton}
                onPress={() => {
                  Alert.prompt(
                    'Link Page',
                    'Enter the page number you want to reference:',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Link',
                        onPress: (pageText) => {
                          const pageNum = parseInt(pageText || '0', 10);
                          if (pageNum > 0) {
                            setDraftPageContext(pageNum);
                          } else {
                            Alert.alert('Invalid', 'Please enter a valid page number.');
                          }
                        },
                      },
                    ],
                    'plain-text',
                    '',
                    'numeric'
                  );
                }}
              >
                <FontAwesome name="link" size={12} color="#0a7ea4" />
                <Text style={styles.linkPageText}>Link Page</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.composerRow}>
          <TextInput
            style={styles.postInput}
            value={newPost}
            onChangeText={setNewPost}
            placeholder={isMember ? 'Share a thought...' : 'Join to start chatting'}
            placeholderTextColor="#8e8e93"
            editable={isMember && isAuthenticated}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, (!newPost.trim() || !isMember) && styles.sendButtonDisabled]}
            onPress={handleCreatePost}
            disabled={!newPost.trim() || !isMember}
          >
            <FontAwesome name="send" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );


  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Book Club', headerShown: true }} />
        <LoadingSpinner message="Loading club..." />
      </SafeAreaView>
    );
  }

  if (error || !club) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Book Club', headerShown: true }} />
        <View style={styles.centered}>
          <FontAwesome name="exclamation-circle" size={32} color="#999" />
          <Text style={styles.errorTitle}>{error ?? 'Book club unavailable'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchClub}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: club.name, headerShown: true }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerCard}>
          <Image
            source={{
              uri:
                club.imageUrl ||
                club.coverImage ||
                bookCover ||
                'https://via.placeholder.com/90x90/0a7ea4/ffffff?text=📚',
            }}
            style={styles.clubImage}
          />
          <View style={styles.headerInfo}>
            <Text style={styles.clubName}>{club.name}</Text>
            {club.description ? (
              <Text style={styles.clubDescription}>{club.description}</Text>
            ) : null}
            <View style={styles.headerMeta}>
              <View style={styles.metaItem}>
                <FontAwesome name="users" size={14} color="#666" />
                <Text style={styles.metaText}>{club.memberCount ?? 0} members</Text>
              </View>
              {club.createdByDisplayName ? (
                <View style={styles.metaItem}>
                  <FontAwesome name="user" size={14} color="#666" />
                  <Text style={styles.metaText}>by {club.createdByDisplayName}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.actionRow}>
          {isMember ? (
            <TouchableOpacity style={styles.secondaryButton} onPress={handleLeaveClub}>
              <FontAwesome name="sign-out" size={16} color="#0a7ea4" />
              <Text style={styles.secondaryButtonText}>Leave club</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.primaryButton} onPress={handleJoinClub}>
              <FontAwesome name="plus" size={16} color="#fff" />
              <Text style={styles.primaryButtonText}>Join club</Text>
            </TouchableOpacity>
          )}
          {isMember && (
            <View style={styles.memberBadge}>
              <FontAwesome name="check" size={14} color="#2ecc71" />
              <Text style={styles.memberBadgeText}>Member</Text>
            </View>
          )}
        </View>

        {book && (
          <>
            <View style={styles.bookCard}>
              <Image
                source={{
                  uri:
                    bookCover ||
                    'https://via.placeholder.com/70x100/eeeeee/999999?text=Book',
                }}
                style={styles.bookCover}
              />
              <View style={styles.bookInfo}>
                <Text style={styles.bookTitle}>{book.title ?? 'Current book'}</Text>
                {book.author ? <Text style={styles.bookAuthor}>{book.author}</Text> : null}
                {(book.pdfUrl || book.pdf_url) ? (
                  <Text style={styles.bookSubtitle}>Shared public PDF available</Text>
                ) : (
                  <Text style={styles.bookSubtitleMuted}>PDF not attached</Text>
                )}
              </View>
            </View>
            {book.id && (
              <View style={[styles.sentimentBanner, { backgroundColor: getSentimentStyle(overallSentiment).backgroundColor }]}>
                {overallSentiment === 'Loading...' ? (
                  <ActivityIndicator size="small" color={getSentimentStyle(overallSentiment).color} />
                ) : overallSentiment === 'No Comments' ? (
                  <Text style={[styles.sentimentText, { color: getSentimentStyle(overallSentiment).color }]}>
                    No Comments Yet — Be the first to share your thoughts!
                  </Text>
                ) : overallSentiment === 'AnalysisError' ? (
                  <Text style={[styles.sentimentText, { color: getSentimentStyle(overallSentiment).color }]}>
                    Analysis Error
                  </Text>
                ) : (
                  <Text style={[styles.sentimentText, { color: getSentimentStyle(overallSentiment).color }]}>
                    Overall Reader Sentiment: {getSentimentStyle(overallSentiment).emoji} {overallSentiment}
                  </Text>
                )}
              </View>
            )}
          </>
        )}

        {(book?.pdfUrl || book?.pdf_url) && (
          <TouchableOpacity style={styles.readingRoomButton} onPress={handleOpenReadingRoom}>
            <FontAwesome name="book" size={20} color="#fff" />
            <Text style={styles.readingRoomButtonText}>Open Reading Room</Text>
          </TouchableOpacity>
        )}

        {renderForumPosts()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  bookAuthor: {
    color: '#666',
    fontSize: 14,
    marginTop: 2,
  },
  bookCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  bookCover: {
    borderRadius: 8,
    height: 100,
    width: 70,
  },
  bookInfo: {
    flex: 1,
  },
  bookSubtitle: {
    color: '#0a7ea4',
    fontSize: 13,
    marginTop: 6,
  },
  bookSubtitleMuted: {
    color: '#999',
    fontSize: 13,
    marginTop: 6,
  },
  bookTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  clubDescription: {
    color: '#444',
    marginTop: 4,
  },
  clubImage: {
    borderRadius: 12,
    height: 90,
    width: 90,
  },
  clubName: {
    fontSize: 22,
    fontWeight: '700',
  },
  composerRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  container: {
    backgroundColor: '#f5f6f8',
    flex: 1,
  },
  emptyForum: {
    alignItems: 'center',
    borderColor: '#eee',
    borderRadius: 12,
    borderWidth: 1,
    padding: 32,
  },
  emptyForumSubtitle: {
    color: '#777',
    marginTop: 6,
    textAlign: 'center',
  },
  emptyForumTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  errorTitle: {
    color: '#222',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
  },
  forumSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
    padding: 16,
  },
  headerInfo: {
    flex: 1,
  },
  headerMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  memberBadge: {
    alignItems: 'center',
    backgroundColor: '#e9f8f1',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  memberBadgeText: {
    color: '#2ecc71',
    fontWeight: '600',
  },
  metaItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  metaText: {
    color: '#666',
  },
  pageBadge: {
    alignItems: 'center',
    backgroundColor: '#e6f4fb',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pageBadgeText: {
    color: '#0a7ea4',
    fontSize: 12,
    fontWeight: '600',
  },
  pageLinkIcon: {
    marginLeft: 2,
  },
  pageContextRow: {
    marginBottom: 8,
  },
  pageContextBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#e6f4fb',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pageContextText: {
    color: '#0a7ea4',
    fontSize: 13,
    fontWeight: '600',
  },
  removePageButton: {
    marginLeft: 4,
    padding: 2,
  },
  pageContextActions: {
    flexDirection: 'row',
  },
  linkPageButton: {
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  linkPageText: {
    color: '#0a7ea4',
    fontSize: 13,
    fontWeight: '600',
  },
  postBody: {
    color: '#333',
    fontSize: 15,
    lineHeight: 22,
  },
  postCard: {
    borderBottomColor: '#f0f0f0',
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
  postComposer: {
    marginTop: 16,
  },
  postHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  postInput: {
    borderColor: '#e0e0e0',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    maxHeight: 120,
    minHeight: 60,
    padding: 12,
  },
  postTimestamp: {
    color: '#999',
    fontSize: 12,
    marginTop: 6,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#0a7ea4',
    borderRadius: 24,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  readingRoomButton: {
    alignItems: 'center',
    backgroundColor: '#0a7ea4',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  readingRoomButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: '#0a7ea4',
    borderRadius: 20,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#e7f3f8',
    borderRadius: 24,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: '#0a7ea4',
    fontSize: 16,
    fontWeight: '600',
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: '#0a7ea4',
    borderRadius: 12,
    justifyContent: 'center',
    padding: 14,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  postAuthor: {
    color: '#111',
    fontSize: 15,
    fontWeight: '600',
  },
  sentimentBanner: {
    borderRadius: 12,
    marginBottom: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sentimentText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});

