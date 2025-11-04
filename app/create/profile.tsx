import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import { doc, setDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
    Image,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../../components/Themed';
import { db, auth } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';

const GENRES = [
  'Fiction', 'Non-Fiction', 'Mystery', 'Romance', 'Sci-Fi', 'Fantasy',
  'Thriller', 'Biography', 'History', 'Self-Help', 'Poetry', 'Young Adult',
  'Children', 'Classics', 'Contemporary', 'Horror', 'Adventure', 'Comedy'
];

export default function CreateProfile() {
  const [displayName, setDisplayName] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [readingGoal, setReadingGoal] = useState('');
  const [booksRead, setBooksRead] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const { user } = useAuth();

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photos to set a profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled) {
        setAvatarUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const handleCreateProfile = async () => {
    if (!user || !db) return;

    // Validation
    if (!displayName.trim()) {
      Alert.alert('Missing Information', 'Please enter your display name.');
      return;
    }

    if (displayName.trim().length < 2) {
      Alert.alert('Invalid Name', 'Display name must be at least 2 characters.');
      return;
    }

    if (selectedGenres.length === 0) {
      Alert.alert('Missing Information', 'Please select at least one favorite genre.');
      return;
    }

    if (selectedGenres.length > 5) {
      Alert.alert('Too Many Genres', 'Please select no more than 5 genres.');
      return;
    }

    try {
      setIsLoading(true);

      // Update Firebase Auth profile with display name
      await updateProfile(user, {
        displayName: displayName.trim(),
        photoURL: avatarUri || null,
      });

      // Create Firestore user document
      const profileData = {
        displayName: displayName.trim(),
        photoURL: avatarUri || null,
        bio: bio.trim(),
        favoriteGenres: selectedGenres,
        readingGoal: readingGoal ? parseInt(readingGoal) : null,
        booksRead: booksRead ? parseInt(booksRead) : 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        isProfileComplete: true,
      };

      await setDoc(doc(db, 'users', user.uid), profileData, { merge: true });
      
      Alert.alert(
        'Welcome!', 
        'Your profile has been created successfully!',
        [{ text: 'Get Started', onPress: () => router.replace('/(tabs)/feed') }]
      );
    } catch (error) {
      console.error('Error creating profile:', error);
      Alert.alert('Error', 'Failed to create profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev => 
      prev.includes(genre) 
        ? prev.filter(g => g !== genre)
        : prev.length < 5 
          ? [...prev, genre]
          : prev
    );
  };

  const renderGenreTag = (genre: string) => {
    const isSelected = selectedGenres.includes(genre);
    const isDisabled = !isSelected && selectedGenres.length >= 5;
    
    return (
      <TouchableOpacity
        key={genre}
        style={[
          styles.genreTag, 
          isSelected && styles.genreTagSelected,
          isDisabled && styles.genreTagDisabled
        ]}
        onPress={() => toggleGenre(genre)}
        disabled={isDisabled}
      >
        <Text style={[
          styles.genreText, 
          isSelected && styles.genreTextSelected,
          isDisabled && styles.genreTextDisabled
        ]}>
          {genre}
        </Text>
        {isSelected && (
          <FontAwesome name="check" size={12} color="#fff" style={styles.checkIcon} />
        )}
      </TouchableOpacity>
    );
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <FontAwesome name="book" size={24} color="#0a7ea4" />
        </View>
        <Text style={styles.headerTitle}>Create Your Profile</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>Welcome to BookSphere!</Text>
          <Text style={styles.welcomeSubtitle}>
            Let's set up your reading profile
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <FontAwesome name="user" size={16} color="#0a7ea4" />
            <Text style={styles.sectionTitle}>Profile Photo</Text>
          </View>
          <Text style={styles.sectionSubtitle}>Optional - Add a profile picture</Text>
          
          <View style={styles.avatarContainer}>
            <TouchableOpacity 
              style={styles.avatarButton}
              onPress={pickImage}
              disabled={isUploadingImage}
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  {displayName ? (
                    <Text style={styles.avatarInitials}>{getInitials(displayName)}</Text>
                  ) : (
                    <FontAwesome name="camera" size={32} color="#999" />
                  )}
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <FontAwesome name="camera" size={12} color="#fff" />
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarHint}>Tap to upload photo</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <FontAwesome name="id-card" size={16} color="#0a7ea4" />
            <Text style={styles.sectionTitle}>Display Name</Text>
            <View style={styles.requiredBadge}>
              <Text style={styles.requiredText}>Required</Text>
            </View>
          </View>
          <Text style={styles.sectionSubtitle}>How should other readers know you?</Text>
          <TextInput
            style={styles.nameInput}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Enter your name"
            placeholderTextColor="#999"
            maxLength={8}
          />
          {displayName.length > 0 && (
            <Text style={styles.characterCount}>{displayName.length}/8</Text>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <FontAwesome name="quote-left" size={16} color="#0a7ea4" />
            <Text style={styles.sectionTitle}>Bio</Text>
          </View>
          <Text style={styles.sectionSubtitle}>Optional - Share your reading journey</Text>
          <TextInput
            style={styles.bioInput}
            value={bio}
            onChangeText={setBio}
            placeholder="I love reading because..."
            placeholderTextColor="#999"
            multiline
            maxLength={100}
            textAlignVertical="top"
          />
          <Text style={styles.characterCount}>{bio.length}/100</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <FontAwesome name="heart" size={16} color="#ff6b6b" />
            <Text style={styles.sectionTitle}>Favorite Genres</Text>
            <View style={styles.requiredBadge}>
              <Text style={styles.requiredText}>Required</Text>
            </View>
          </View>
          <Text style={styles.sectionSubtitle}>
            Select 1-5 genres you enjoy reading
          </Text>
          <View style={styles.genresList}>
            {GENRES.map(renderGenreTag)}
          </View>
          <View style={styles.genreCounter}>
            <Text style={[
              styles.genreCounterText,
              selectedGenres.length > 0 && styles.genreCounterActive
            ]}>
              {selectedGenres.length}/5 selected
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <FontAwesome name="calendar" size={16} color="#0a7ea4" />
            <Text style={styles.sectionTitle}>Reading Goals</Text>
          </View>
          <Text style={styles.sectionSubtitle}>Optional - Track your progress</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>📚 Books to read this year</Text>
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
            <Text style={styles.inputLabel}>✓ Books read so far</Text>
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

        <View style={styles.bottomPadding} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.createButton,
            (isLoading || !displayName.trim() || selectedGenres.length === 0) && styles.createButtonDisabled
          ]}
          onPress={handleCreateProfile}
          disabled={isLoading || !displayName.trim() || selectedGenres.length === 0}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[
              styles.createButtonText,
              (!displayName.trim() || selectedGenres.length === 0) && styles.createButtonTextDisabled
            ]}>
              Complete Profile
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: 60,
    height: 120,
    width: 120,
  },
  avatarButton: {
    position: 'relative',
  },
  avatarContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  avatarEditBadge: {
    alignItems: 'center',
    backgroundColor: '#0a7ea4',
    borderRadius: 16,
    borderColor: '#fff',
    borderWidth: 2,
    bottom: 4,
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    right: 4,
    width: 32,
  },
  avatarHint: {
    color: '#999',
    fontSize: 13,
    marginTop: 12,
  },
  avatarInitials: {
    color: '#0a7ea4',
    fontSize: 40,
    fontWeight: '600',
  },
  avatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    borderRadius: 60,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    borderWidth: 2,
    height: 120,
    justifyContent: 'center',
    width: 120,
  },
  bioInput: {
    backgroundColor: '#fafafa',
    borderColor: '#eee',
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  bottomPadding: {
    height: 20,
  },
  characterCount: {
    color: '#999',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'right',
  },
  checkIcon: {
    marginLeft: 6,
  },
  container: {
    backgroundColor: '#fff',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  createButton: {
    backgroundColor: '#0a7ea4',
    borderRadius: 12,
    paddingVertical: 16,
    width: '100%',
  },
  createButtonDisabled: {
    backgroundColor: '#e0e0e0',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  createButtonTextDisabled: {
    color: '#999',
  },
  footer: {
    backgroundColor: '#fff',
    borderTopColor: '#eee',
    borderTopWidth: 1,
    padding: 16,
    paddingBottom: 20,
  },
  genreCounter: {
    alignItems: 'center',
    marginTop: 12,
  },
  genreCounterActive: {
    color: '#0a7ea4',
    fontWeight: '600',
  },
  genreCounterText: {
    color: '#999',
    fontSize: 14,
  },
  genreTag: {
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    borderRadius: 20,
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  genreTagDisabled: {
    backgroundColor: '#f5f5f5',
    opacity: 0.5,
  },
  genreTagSelected: {
    backgroundColor: '#0a7ea4',
  },
  genreText: {
    color: '#0a7ea4',
    fontSize: 13,
    fontWeight: '500',
  },
  genreTextDisabled: {
    color: '#ccc',
  },
  genreTextSelected: {
    color: '#fff',
  },
  genresList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: '#eee',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  headerLeft: {
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#333',
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 8,
  },
  nameInput: {
    backgroundColor: '#fafafa',
    borderColor: '#eee',
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  numberInput: {
    backgroundColor: '#fafafa',
    borderColor: '#eee',
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  requiredBadge: {
    backgroundColor: '#ff6b6b',
    borderRadius: 10,
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  requiredText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  section: {
    borderTopColor: '#f5f5f5',
    borderTopWidth: 1,
    padding: 20,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 8,
  },
  sectionSubtitle: {
    color: '#666',
    fontSize: 14,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  skipButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: 40,
  },
  skipText: {
    color: '#999',
    fontSize: 14,
  },
  welcomeSection: {
    alignItems: 'center',
    paddingBottom: 16,
    paddingTop: 24,
  },
  welcomeSubtitle: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
});