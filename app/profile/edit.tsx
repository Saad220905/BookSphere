import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../../components/Themed';
import UserAvatar from '../../components/UserAvatar';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';

const GENRES = [
  'Fiction', 'Non-Fiction', 'Mystery', 'Romance', 'Sci-Fi', 'Fantasy',
  'Thriller', 'Biography', 'History', 'Self-Help', 'Poetry', 'Young Adult',
  'Children', 'Classics', 'Contemporary', 'Horror', 'Adventure', 'Comedy'
];

export default function EditProfileScreen() {
  const [bio, setBio] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [readingGoal, setReadingGoal] = useState('');
  const [booksRead, setBooksRead] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  const loadProfile = useCallback(async () => {
    try {
      if (!db || !user) return;

      const profileDoc = await getDoc(doc(db, 'users', user.uid));
      if (profileDoc.exists()) {
        const data = profileDoc.data();
        setBio(data.bio || '');
        setSelectedGenres(data.favoriteGenres || []); // Loads favorite genres
        setReadingGoal(data.readingGoal?.toString() || '');
        setBooksRead(data.booksRead?.toString() || '');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  }, [user]); // Dependency array only needs user

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user, loadProfile]);

  const handleSaveProfile = async () => {
    if (!user || !db) return;

    try {
      setIsLoading(true);

      const profileData = {
        bio: bio.trim(),
        favoriteGenres: selectedGenres, // Saves selected genres
        readingGoal: readingGoal ? parseInt(readingGoal) : null,
        booksRead: booksRead ? parseInt(booksRead) : 0,
        // REMOVED: Saving lastReadBook
        updatedAt: new Date(), // Consider using serverTimestamp() from 'firebase/firestore'
      };

      await setDoc(doc(db, 'users', user.uid), profileData, { merge: true });

      Alert.alert('Success', 'Profile updated successfully!');
      router.back();
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre)
        ? prev.filter(g => g !== genre)
        : [...prev, genre]
    );
  };

  const renderGenreTag = (genre: string) => {
    const isSelected = selectedGenres.includes(genre);

    return (
      <TouchableOpacity
        key={genre}
        style={[styles.genreTag, isSelected && styles.genreTagSelected]}
        onPress={() => toggleGenre(genre)}
      >
        <Text style={[styles.genreText, isSelected && styles.genreTextSelected]}>
          {genre}
        </Text>
        {isSelected && (
          <FontAwesome name="check" size={12} color="#fff" style={styles.checkIcon} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <FontAwesome name="times" size={24} color="#666" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity
          style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
          onPress={handleSaveProfile}
          disabled={isLoading}
        >
          <Text style={[styles.saveButtonText, isLoading && styles.saveButtonTextDisabled]}>
            {isLoading ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.profileSection}>
          <UserAvatar
            photoUrl={user?.photoURL || undefined}
            displayName={user?.displayName || 'Anonymous'}
            size={80}
          />
          <Text style={styles.displayName}>{user?.displayName || 'Anonymous'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bio</Text>
          <TextInput
            style={styles.bioInput}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell us about yourself and your reading journey..."
            placeholderTextColor="#999"
            multiline
            maxLength={500}
            textAlignVertical="top"
          />
          <Text style={styles.characterCount}>{bio.length}/500</Text>
        </View>


        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Favorite Genres</Text>
          <Text style={styles.sectionSubtitle}>
            Select up to 5 genres you love (tap to select/deselect)
          </Text>
          <View style={styles.genresList}>
            {GENRES.map(renderGenreTag)}
          </View>
          {selectedGenres.length > 5 && (
            <Text style={styles.warningText}>
              Please select no more than 5 genres
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reading Goals</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Books to read this year</Text>
            <TextInput
              style={styles.numberInput}
              value={readingGoal}
              onChangeText={setReadingGoal}
              placeholder="e.g., 24"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Books read so far</Text>
            <TextInput
              style={styles.numberInput}
              value={booksRead}
              onChangeText={setBooksRead}
              placeholder="e.g., 12"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bioInput: {
    borderColor: '#eee',
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlignVertical: 'top',
  },
  characterCount: {
    color: '#666',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'right',
  },
  checkIcon: {
    marginLeft: 4,
  },
  container: {
    backgroundColor: '#fff',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  displayName: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 12,
  },
  email: {
    color: '#666',
    fontSize: 14,
    marginTop: 4,
  },
  genreTag: {
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    borderRadius: 16,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  genreTagSelected: {
    backgroundColor: '#0a7ea4',
  },
  genreText: {
    color: '#0a7ea4',
    fontSize: 12,
    fontWeight: '500',
  },
  genreTextSelected: {
    color: '#fff',
  },
  genresList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: '#eee',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#666',
    fontSize: 14,
    marginBottom: 8,
  },
  numberInput: {
    borderColor: '#eee',
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  profileSection: {
    alignItems: 'center',
    padding: 20,
  },
  saveButton: {
    backgroundColor: '#0a7ea4',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButtonTextDisabled: {
    color: '#999',
  },
  section: {
    borderTopColor: '#eee',
    borderTopWidth: 1,
    padding: 16,
  },
  sectionSubtitle: {
    color: '#666',
    fontSize: 14,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  warningText: {
    color: '#ff4444',
    fontSize: 12,
    marginTop: 8,
  },
});