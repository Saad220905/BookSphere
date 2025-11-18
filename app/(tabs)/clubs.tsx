import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { FlatList, Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../../components/Themed';
import { db } from '../../config/firebase';

interface BookClub {
  id: string;
  name: string;
  description: string;
  coverImage?: string;
  memberCount: number;
  currentBook?: {
    title: string;
    author: string;
    coverUrl?: string;
  };
  createdAt: any;
  createdBy: string;
  createdByDisplayName: string;
}

export default function ClubsScreen() {
  const [clubs, setClubs] = useState<BookClub[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClubs();
  }, []);

  const loadClubs = async () => {
    try {
      setLoading(true);
      if (!db) return;

      const clubsQuery = query(
        collection(db, 'clubs'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(clubsQuery);
      const clubsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as BookClub[];
      
      setClubs(clubsData);
    } catch (error) {
      console.error('Error loading clubs:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderClub = ({ item }: { item: BookClub }) => (
    <TouchableOpacity
      style={styles.clubCard}
      onPress={() => router.push(`/clubs/${item.id}`)}
    >
      <View style={styles.clubHeader}>
        <Image
          source={{ 
            uri: item.coverImage || 'https://via.placeholder.com/60x60/0a7ea4/ffffff?text=📚'
          }}
          style={styles.clubImage}
        />
        <View style={styles.clubInfo}>
          <Text style={styles.clubName}>{item.name}</Text>
          <Text style={styles.clubCreator}>by {item.createdByDisplayName}</Text>
          <View style={styles.clubStats}>
            <FontAwesome name="users" size={14} color="#666" />
            <Text style={styles.memberCount}>{item.memberCount} members</Text>
          </View>
        </View>
      </View>

      <Text style={styles.clubDescription}>{item.description}</Text>

      {item.currentBook && (
        <View style={styles.currentBook}>
          <Text style={styles.currentBookLabel}>Currently Reading:</Text>
          <View style={styles.bookInfo}>
            <Image
              source={{ 
                uri: item.currentBook.coverUrl || 'https://via.placeholder.com/40x50/eee/999?text=📖'
              }}
              style={styles.bookCover}
            />
            <View style={styles.bookDetails}>
              <Text style={styles.bookTitle}>{item.currentBook.title}</Text>
              <Text style={styles.bookAuthor}>by {item.currentBook.author}</Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.clubActions}>
        <TouchableOpacity style={styles.joinButton}>
          <FontAwesome name="plus" size={14} color="#0a7ea4" />
          <Text style={styles.joinButtonText}>Join Club</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Book Clubs</Text>
        <TouchableOpacity onPress={() => router.push('/create/club')}>
          <FontAwesome name="plus" size={24} color="#0a7ea4" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={clubs}
        renderItem={renderClub}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.clubsList}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={loadClubs}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <FontAwesome name="book" size={48} color="#ccc" />
            <Text style={styles.emptyTitle}>No Book Clubs Yet</Text>
            <Text style={styles.emptySubtitle}>
              Join or create a book club to start reading together!
            </Text>
            <TouchableOpacity
              style={styles.createClubButton}
              onPress={() => router.push('/create/club')}
            >
              <Text style={styles.createClubButtonText}>Create Your First Club</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bookAuthor: {
    color: '#666',
    fontSize: 12,
  },
  bookCover: {
    borderRadius: 4,
    height: 40,
    width: 30,
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
  },
  clubCard: {
    backgroundColor: '#fff',
    borderColor: '#eee',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
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
  },
  clubHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 12,
  },
  clubImage: {
    borderRadius: 8,
    height: 60,
    width: 60,
  },
  clubInfo: {
    flex: 1,
    marginLeft: 12,
  },
  clubName: {
    fontSize: 18,
    fontWeight: '600',
  },
  clubStats: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 4,
  },
  clubsList: {
    padding: 16,
  },
  container: {
    backgroundColor: '#fff',
    flex: 1,
  },
  createClubButton: {
    backgroundColor: '#0a7ea4',
    borderRadius: 24,
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  createClubButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  currentBook: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 12,
    padding: 12,
  },
  currentBookLabel: {
    color: '#666',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptySubtitle: {
    color: '#666',
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 20,
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
  joinButton: {
    alignItems: 'center',
    borderColor: '#0a7ea4',
    borderRadius: 20,
    borderWidth: 1,
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
  memberCount: {
    color: '#666',
    fontSize: 12,
    marginLeft: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
}); 