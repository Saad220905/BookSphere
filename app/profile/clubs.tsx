import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Firestore, collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    FlatList,
    Image,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../../components/Themed';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';

interface Club {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  currentBook: string;
  bookAuthor: string;
  memberCount: number;
  createdAt: string;
}

export default function UserClubsScreen() {
  const { user } = useAuth();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setClubs([]);
      setIsLoading(false);
      return;
    }

    if (!db) {
      setError('Database is not initialized');
      setIsLoading(false);
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const q = query(
        collection(db as Firestore, 'clubs'),
        where('members', 'array-contains', user.uid),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          try {
            const clubList: Club[] = [];
            snapshot.forEach((doc) => {
              clubList.push({ id: doc.id, ...doc.data() } as Club);
            });
            setClubs(clubList);
            setError(null);
          } catch (err) {
            console.error('Error processing clubs data:', err);
            setError('Error processing clubs data');
            setClubs([]);
          } finally {
            setIsLoading(false);
          }
        },
        (err) => {
          console.error('Error in clubs snapshot:', err);
          setError('Failed to load clubs');
          setClubs([]);
          setIsLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error('Error setting up clubs listener:', err);
      setError('Failed to initialize clubs');
      setIsLoading(false);
    }
  }, [user]);

  const handleClubPress = (clubId: string) => {
    router.push(`/clubs/${clubId}`);
  };

  const renderClubItem = ({ item }: { item: Club }) => (
    <TouchableOpacity
      style={styles.clubItem}
      onPress={() => handleClubPress(item.id)}>
      <Image source={{ uri: item.imageUrl }} style={styles.clubImage} />
      <View style={styles.clubInfo}>
        <Text style={styles.clubName}>{item.name}</Text>
        <Text style={styles.bookInfo}>
          Currently reading: {item.currentBook} by {item.bookAuthor}
        </Text>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <FontAwesome name="users" size={16} color="#666" />
            <Text style={styles.statText}>{item.memberCount} members</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading clubs...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <FontAwesome name="exclamation-circle" size={48} color="#ff4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => setError(null)}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome name="arrow-left" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>My Clubs</Text>
      </View>

      {clubs.length === 0 ? (
        <View style={styles.emptyState}>
          <FontAwesome name="book" size={48} color="#ccc" />
          <Text style={styles.emptyText}>
            You haven&apos;t joined any clubs yet.
          </Text>
          <TouchableOpacity style={styles.createButton} onPress={() => router.push('/create/club')}>
            <FontAwesome name="plus" size={16} color="#fff" />
            <Text style={styles.createButtonText}>Create Your First Club</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={clubs}
          renderItem={renderClubItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.clubsList}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backButton: {
    marginRight: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginVertical: 16,
  },
  retryButton: {
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bookInfo: {
    color: '#666',
    fontSize: 14,
    marginBottom: 8,
  },
  clubImage: {
    height: 150,
    width: '100%',
  },
  clubInfo: {
    padding: 12,
  },
  clubItem: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  clubName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  clubsList: {
    padding: 16,
  },
  container: {
    backgroundColor: '#fff',
    flex: 1,
  },
  createButton: {
    alignItems: 'center',
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    padding: 16,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    color: '#666',
    fontSize: 18,
    marginBottom: 24,
    marginTop: 16,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: '#eee',
    borderBottomWidth: 1,
    flexDirection: 'row',
    padding: 16,
  },
  stat: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  statText: {
    color: '#666',
    fontSize: 14,
  },
  stats: {
    flexDirection: 'row',
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
}); 