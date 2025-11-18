import { FontAwesome } from '@expo/vector-icons';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import React, { useState } from 'react';
import { 
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  View 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from './Themed';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';

interface CreatePostModalProps {
  visible: boolean;
  onClose: () => void;
  onPostCreated: () => void;
}

export default function CreatePostModal({ visible, onClose, onPostCreated }: CreatePostModalProps) {
  const [content, setContent] = useState('');
  const [bookTitle, setBookTitle] = useState('');
  const [bookAuthor, setBookAuthor] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  const handleClose = () => {
    if (!isLoading) {
      setContent('');
      setBookTitle('');
      setBookAuthor('');
      onClose();
    }
  };

  const handleCreatePost = async () => {
    if (!user || !content.trim() || !db) return;

    try {
      setIsLoading(true);

      const postData = {
        content: content.trim(),
        userId: user.uid,
        userDisplayName: user.displayName || 'Anonymous',
        userPhotoURL: user.photoURL,
        bookTitle: bookTitle.trim() || null,
        bookAuthor: bookAuthor.trim() || null,
        likes: 0,
        comments: 0,
        likedBy: [],
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'posts'), postData);
      
      Alert.alert('Success', 'Your post has been created!');
      handleClose();
      onPostCreated();
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Error', 'Failed to create post. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const characterCount = content.length;
  const maxCharacters = 280;
  const isOverLimit = characterCount > maxCharacters;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView 
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} disabled={isLoading}>
              <FontAwesome name="times" size={24} color="#666" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>New Post</Text>
            <TouchableOpacity
              style={[styles.postButton, (!content.trim() || isOverLimit || isLoading) && styles.postButtonDisabled]}
              onPress={handleCreatePost}
              disabled={!content.trim() || isOverLimit || isLoading}
            >
              <Text style={[styles.postButtonText, (!content.trim() || isOverLimit || isLoading) && styles.postButtonTextDisabled]}>
                {isLoading ? 'Posting...' : 'Post'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.postSection}>
              <TextInput
                style={styles.contentInput}
                value={content}
                onChangeText={setContent}
                placeholder="What are you thinking about? Share your thoughts about books..."
                placeholderTextColor="#999"
                multiline
                maxLength={maxCharacters}
                textAlignVertical="top"
              />
              
              <View style={styles.characterCount}>
                <Text style={[styles.characterText, isOverLimit && styles.characterTextOverLimit]}>
                  {characterCount}/{maxCharacters}
                </Text>
              </View>
            </View>

            <View style={styles.bookSection}>
              <Text style={styles.sectionTitle}>Book Information (Optional)</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Book Title</Text>
                <TextInput
                  style={styles.bookInput}
                  value={bookTitle}
                  onChangeText={setBookTitle}
                  placeholder="Enter book title"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Author</Text>
                <TextInput
                  style={styles.bookInput}
                  value={bookAuthor}
                  onChangeText={setBookAuthor}
                  placeholder="Enter author name"
                  placeholderTextColor="#999"
                />
              </View>
            </View>

            <View style={styles.tipsSection}>
              <Text style={styles.tipsTitle}>💡 Tips for great posts:</Text>
              <Text style={styles.tipText}>• Share what you&apos;re currently reading</Text>
              <Text style={styles.tipText}>• Discuss your favorite characters</Text>
              <Text style={styles.tipText}>• Recommend books to others</Text>
              <Text style={styles.tipText}>• Share quotes that moved you</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bookInput: {
    borderColor: '#eee',
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bookSection: {
    borderTopColor: '#eee',
    borderTopWidth: 1,
    padding: 16,
  },
  characterCount: {
    alignItems: 'flex-end',
    marginTop: 8,
  },
  characterText: {
    color: '#666',
    fontSize: 12,
  },
  characterTextOverLimit: {
    color: '#ff4444',
  },
  container: {
    backgroundColor: '#fff',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentInput: {
    fontSize: 18,
    lineHeight: 24,
    minHeight: 120,
    textAlignVertical: 'top',
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
  keyboardView: {
    flex: 1,
  },
  postButton: {
    backgroundColor: '#0a7ea4',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  postButtonDisabled: {
    backgroundColor: '#ccc',
  },
  postButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  postButtonTextDisabled: {
    color: '#999',
  },
  postSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  tipText: {
    color: '#666',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  tipsSection: {
    backgroundColor: '#f8f9fa',
    borderTopColor: '#eee',
    borderTopWidth: 1,
    padding: 16,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
});