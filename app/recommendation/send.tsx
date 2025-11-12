import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import { addDoc, collection } from 'firebase/firestore';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../../components/Themed'; // Assuming this path is correct
import { db } from '../../config/firebase'; // Assuming this path is correct
import { useAuth } from '../../contexts/AuthContext'; // Assuming this path is correct

// --- Mock Data for Selection ---
const mockBooks = [
  { id: '1', title: 'The Martian', author: 'Andy Weir' },
  { id: '2', title: 'Project Hail Mary', author: 'Andy Weir' },
  { id: '3', title: 'Mistborn: The Final Empire', author: 'Brandon Sanderson' },
];

const mockFriends = [
  { id: 'FRIEND_USER_ID_A', name: 'John Doe' },
  { id: 'FRIEND_USER_ID_B', name: 'Alice Smith' },
  { id: 'FRIEND_USER_ID_C', name: 'Bob Johnson' },
];
// -------------------------------

export default function SendRecommendationScreen() {
  const { user } = useAuth();
  const [selectedBook, setSelectedBook] = useState(mockBooks[0]);
  const [selectedFriend, setSelectedFriend] = useState(mockFriends[0]);
  const [isSending, setIsSending] = useState(false);

  /**
   * Handles the Firestore write operation and subsequent navigation/alert.
   */
  const handleSendRecommendation = async () => {
    if (isSending) return;
    
    if (!db || !user) {
      Alert.alert("Error", "Authentication required to send recommendation.");
      return;
    }

    setIsSending(true);

    try {
      const newRecommendation = {
        recipientId: selectedFriend.id,
        recommenderId: user.uid,
        recommenderName: user.displayName || 'Anonymous',
        bookTitle: selectedBook.title,
        bookAuthor: selectedBook.author,
        note: `I thought of you when reading '${selectedBook.title}'!`,
        recommendedAt: new Date(),
      };

      await addDoc(collection(db, 'recommendations'), newRecommendation);

      // Success message and navigation back
      Alert.alert(
        "Success!",
        `Recommendation for '${selectedBook.title}' sent to ${selectedFriend.name}.`,
        [{ text: "OK", onPress: () => router.back() }]
      );

    } catch (error) {
      console.error("Error sending recommendation:", error);
      Alert.alert("Error", "Failed to send recommendation to Firestore. Check permissions.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <FontAwesome name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Send Recommendation</Text>
        </View>

        {/* --- 📚 Select Book Section --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Select Book</Text>
          <View style={styles.pickerContainer}>
            {mockBooks.map(book => (
              <TouchableOpacity
                key={book.id}
                style={[styles.itemButton, selectedBook.id === book.id && styles.selectedItem]}
                onPress={() => setSelectedBook(book)}
              >
                <Text style={selectedBook.id === book.id && styles.selectedText}>
                  {book.title} ({book.author})
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        {/* --- 🧑‍🤝‍🧑 Select Friend Section --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Select Friend</Text>
          <View style={styles.pickerContainer}>
            {mockFriends.map(friend => (
              <TouchableOpacity
                key={friend.id}
                style={[styles.itemButton, selectedFriend.id === friend.id && styles.selectedItem]}
                onPress={() => setSelectedFriend(friend)}
              >
                <Text style={selectedFriend.id === friend.id && styles.selectedText}>
                  {friend.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* --- 🚀 Confirmation & Send Button --- */}
        <View style={styles.confirmationBox}>
            <Text style={styles.confirmationText}>
                You are recommending "{selectedBook.title}" to {selectedFriend.name}.
            </Text>
            <TouchableOpacity
                style={styles.sendButton}
                onPress={handleSendRecommendation}
                disabled={isSending}
            >
                <Text style={styles.sendButtonText}>
                    {isSending ? 'Sending...' : 'Send Recommendation'}
                </Text>
                {!isSending && <FontAwesome name="send" size={20} color="#fff" style={{ marginLeft: 10 }} />}
            </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  backButton: {
    paddingRight: 15,
  },
  title: {
    color: '#000',
    fontSize: 24,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    color: '#000',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  pickerContainer: {
    backgroundColor: '#000',
    borderRadius: 10,
    padding: 10,
  },
  itemButton: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedItem: {
    backgroundColor: '#e6f7ff',
    borderRadius: 5,
  },
  selectedText: {
    color: '#0a7ea4',
    fontWeight: 'bold',
  },
  confirmationBox: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f0f8ff',
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#0a7ea4',
  },
  confirmationText: {
    color: '#000',
    fontSize: 16,
    marginBottom: 15,
    lineHeight: 24,
  },
  sendButton: {
    backgroundColor: '#0a7ea4',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});