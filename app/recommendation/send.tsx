import { FontAwesome } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { addDoc, collection, Firestore, serverTimestamp } from 'firebase/firestore'; 
import React, { useState, useEffect, useCallback } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View, TextInput, ActivityIndicator } from 'react-native'; 
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../../components/Themed';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext'; 

// --- Interface Definitions ---
interface Book {
  id: string;
  title: string;
  author: string;
}

const RECOMMENDATION_COLLECTION = 'recommendations';
const OPEN_LIBRARY_SEARCH_URL = 'https://openlibrary.org/search.json?'; 

export default function SendRecommendationScreen() {
  const { user } = useAuth();
  const { createNotification } = useNotifications();
  const firestoreDb = db as Firestore;
  const params = useLocalSearchParams();
  
  const recipientId = params.recipientId as string;
  const recipientName = params.recipientName as string || 'Friend';
  
  const [books, setBooks] = useState<Book[]>([]); 
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [note, setNote] = useState(''); 
  const [isSending, setIsSending] = useState(false);
  const [isSearching, setIsSearching] = useState(false); 
  const [searchTerm, setSearchTerm] = useState(''); 

  const searchOpenLibrary = useCallback(async (queryTerm: string) => {
    if (queryTerm.length === 0) {
      setBooks([]);
      setSelectedBook(null);
      return;
    }
    
    setIsSearching(true);

    try {
      const url = `${OPEN_LIBRARY_SEARCH_URL}q=${encodeURIComponent(queryTerm)}&limit=15&subject=public_domain`;
      const response = await fetch(url);
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();

      let newBooks: Book[] = data.docs
        .filter((doc: any) => doc.author_name && doc.title && doc.key)
        .map((doc: any) => ({
          id: doc.key, 
          title: doc.title,
          author: doc.author_name[0] || 'Unknown Author', 
        }));
        
      newBooks.sort((a, b) => a.title.localeCompare(b.title));

      setBooks(newBooks);
      setSelectedBook(newBooks[0] || null); 

    } catch (error) {
      console.error("Error searching OpenLibrary:", error);
      Alert.alert("Error", "Failed to search books.");
      setBooks([]);
      setSelectedBook(null);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    let queryToUse = searchTerm.length > 0 ? searchTerm : "classic"; 
    const controller = new AbortController();
    const executeSearch = async () => {
        if (queryToUse.length === 0) {
            setBooks([]);
            setSelectedBook(null);
            return;
        }
        
        setIsSearching(true);
        
        try {
            const url = `${OPEN_LIBRARY_SEARCH_URL}q=${encodeURIComponent(queryToUse)}&limit=15&subject=public_domain`;
            const response = await fetch(url, { signal: controller.signal }); // Use signal for cleanup
            
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const data = await response.json();

            let newBooks: Book[] = data.docs
                .filter((doc: any) => doc.author_name && doc.title && doc.key)
                .map((doc: any) => ({
                    id: doc.key, 
                    title: doc.title,
                    author: doc.author_name[0] || 'Unknown Author', 
                }));
                
            newBooks.sort((a, b) => a.title.localeCompare(b.title));

            setBooks(newBooks);
            setSelectedBook(newBooks[0] || null); 

        } catch (error: any) {
            if (error.name !== 'AbortError') {
                 console.error("Error fetching books:", error);
            }
        } finally {
            setIsSearching(false);
        }
    };
    
    executeSearch();

    return () => {
        controller.abort();
    };

  }, [searchTerm]);

  const handleSendRecommendation = async () => {
    if (isSending || !selectedBook || !user?.uid || !recipientId) {
      Alert.alert("Missing Info", "Please ensure a book is selected and you are logged in.");
      return;
    }
    
    if (!firestoreDb || !user || !user.uid) {
      Alert.alert("Authentication Error", "Your user ID is missing.");
      return;
    }

    setIsSending(true);

    try {
      const recommenderName = user.displayName || 'Anonymous';

      await addDoc(collection(firestoreDb, RECOMMENDATION_COLLECTION), {
        recipientId,
        recommenderId: user.uid,
        recommenderName: recommenderName,
        bookTitle: selectedBook.title,
        bookAuthor: selectedBook.author,
        note: note.trim() || null,
        recommendedAt: serverTimestamp(),
      });

      await createNotification({
          type: 'new_recommendation',
          title: 'New Book Recommendation!',
          message: `${recommenderName} recommended "${selectedBook.title}" to you.`,
          userId: recipientId,
          targetType: 'book',
          targetId: selectedBook.id,
          fromUserId: user.uid,
          fromUserDisplayName: recommenderName,
          fromUserPhotoURL: user.photoURL || null,
      });

      Alert.alert("Success!", `Recommendation sent to ${recipientName}.`, [{ text: "OK", onPress: router.back }]);

    } catch (error) {
      console.error("Error sending recommendation:", error);
      Alert.alert("Error", "Failed to send recommendation to Firestore. Check permissions.");
    } finally {
      setIsSending(false);
    }
  };

  const renderBookListContent = () => {
    if (isSearching) {
        return <ActivityIndicator style={styles.loadingIndicator} size="small" color="#0a7ea4" />;
    }
    
    if (books.length === 0) {
        const text = searchTerm.length === 0
            ? "Showing initial popular titles. Start typing to search!"
            : "No results found. Try a different query.";
        
        return <Text style={styles.emptyListText}>{text}</Text>;
    }
    
    return (
        <ScrollView style={styles.bookListScrollView} nestedScrollEnabled={true}> 
            {books.map(book => (
            <TouchableOpacity
                key={book.id}
                style={[styles.itemButton, selectedBook?.id === book.id && styles.selectedItem]}
                onPress={() => setSelectedBook(book)}
            >
                <Text style={selectedBook?.id === book.id && styles.selectedText}>
                {book.title} ({book.author})
                </Text>
            </TouchableOpacity>
            ))}
        </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} nestedScrollEnabled={true}>
        <View style={styles.header}>
          <TouchableOpacity onPress={router.back} style={styles.backButton}>
            <FontAwesome name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Recommend to {recipientName}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Select Book</Text>
          
          <TextInput
            style={styles.searchInput}
            onChangeText={setSearchTerm}
            value={searchTerm}
            placeholder="Search by title or author..."
            placeholderTextColor="#999"
          />
          
          <View style={styles.pickerContainer}>
            {renderBookListContent()}
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Your Personal Note (Optional)</Text>
          <TextInput
            style={styles.noteInput}
            onChangeText={setNote}
            value={note}
            placeholder={`Write a message...`}
            multiline={true}
            numberOfLines={4}
          />
        </View>
        
        <View style={styles.confirmationBox}>
          <Text style={styles.confirmationText}>
            Send "{selectedBook?.title || 'No Book Selected'}" to {recipientName}.
          </Text>
          {note.length > 0 && (
            <Text style={styles.notePreview}>
              Note: "{note.trim()}"
            </Text>
          )}
          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleSendRecommendation}
            disabled={isSending || !selectedBook}
          >
            <Text style={styles.sendButtonText}>
              {isSending ? <ActivityIndicator color="#fff" /> : 'Send Recommendation'}
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
		backgroundColor: '#fff' 
	},
	scrollView: { 
		flex: 1 
	}, 
	scrollContent: { 
		padding: 20, 
		flexGrow: 1, 
		paddingBottom: 40 
	},
	header: { 
		flexDirection: 'row', 
		alignItems: 'center', 
		marginBottom: 20, 
		marginTop: 10 
	},
	backButton: { 
		paddingRight: 15 
	},
	title: { 
		fontSize: 24, 
		fontWeight: 'bold', 
		flex: 1 
	},
  section: { 
		marginBottom: 30 
	},
  sectionTitle: { 
		fontSize: 18, 
		fontWeight: '600', 
		marginBottom: 10 
	},
  searchInput: {
    height: 40,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  pickerContainer: {
  	backgroundColor: '#f8f9fa',
  	borderRadius: 10,
  	padding: 10,
  	maxHeight: 250, 
  	borderWidth: 1,
  	borderColor: '#f0f0f0',
  },
  bookListScrollView: { 
  	maxHeight: 230,
  },
  loadingIndicator: { 
  	padding: 20 
  },
  itemButton: { 
		padding: 12, 
		borderBottomWidth: 1, 
		borderBottomColor: '#eee' 
	},
  selectedItem: { 
		backgroundColor: '#e6f7ff', 
		borderRadius: 5 
	},
  selectedText: { 
		color: '#0a7ea4', 
		fontWeight: 'bold' 
	},
  emptyListText: { 
		padding: 12, 
		textAlign: 'center', 
		color: '#666' 
	},
  noteInput: {
  	height: 100,
  	borderColor: '#ccc',
  	borderWidth: 1,
  	borderRadius: 8,
  	padding: 10,
  	textAlignVertical: 'top',
  	fontSize: 16,
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
		fontSize: 16, 
		marginBottom: 10, 
		lineHeight: 24 
	},
  notePreview: { 
		fontSize: 14, 
		fontStyle: 'italic', 
		color: '#333', 
		marginBottom: 15 
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
		fontWeight: 'bold' 
	},
  loadingContainer: { 
		flex: 1, 
		justifyContent: 'center', 
		alignItems: 'center' 
	},
  goBackButton: { 
		backgroundColor: '#0a7ea4', 
		padding: 10, 
		borderRadius: 8 
	},
  goBackText: { 
		color: '#fff', 
		fontWeight: '600' 
	},
});