import React, {useEffect, useState} from 'react';
import { StyleSheet, View, Text, Button, Image, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { calculateOverallBookSentiment } from '../utils/bookComments'; // IMPORT FOR BOOK OVERALL ANALYSIS

// Placeholder cover image
const PLACEHOLDER_COVER = 'https://placehold.co/200x300/1c1c1e/cccccc?text=No+Cover';

export default function BookSummaryScreen() {
  const params = useLocalSearchParams<{
    title: string;
    author: string;
    publish_year: any; 
    cover_url: any;
    pdf_url: string;
    book_id: string; 
  }>();
  const router = useRouter();
  const [coverLoading, setCoverLoading] = React.useState(true); 
  //New State for Sentiment (BOOK OVERALL)
  const [overallSentiment, setOverallSentiment] = useState<'Positive' | 'Negative' | 'Neutral' | 'Mixed' | 'No Comments' | 'Analysis Error' | 'Loading...'>('Loading...');

  const { title, author, publish_year, cover_url, pdf_url, book_id } = params;

  //NEW useEffect HOOK TO FETCH SENTIMENT
  useEffect(() => {
    const fetchSentiment = async () => {
        if (book_id) {
            const result = await calculateOverallBookSentiment(book_id);
            setOverallSentiment(result as any); 
        } else {
            setOverallSentiment('Analysis Error');
        }
    };
    fetchSentiment();
  }, [book_id]);




  if (!title || !pdf_url || !book_id) {
    return (
      <SafeAreaView style={styles.container}>
         <Stack.Screen options={{ title: "Error" }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: Missing essential book information.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const finalCoverUrl = cover_url || PLACEHOLDER_COVER;

  const handleReadNow = () => {
    // Navigate to the PDF viewer
    router.push({
      pathname: '/viewer',
      params: { pdf_url: pdf_url, book_id: book_id, book_title: title },
    });
  };

  // Helper to determine the color/icon
  const getSentimentStyle = (sentiment: string) => {
    switch (sentiment) {
      case 'Positive': return { color: '#4CAF50', emoji: '😊' }; // Green
      case 'Negative': return { color: '#F44336', emoji: '😔' }; // Red
      case 'Mixed': return { color: '#FF9800', emoji: '🤨' }; // Orange
      case 'Neutral': return { color: '#2196F3', emoji: '😐' }; // Blue
      default: return { color: '#777', emoji: '...' };
    }
  };

  const sentimentDisplay = getSentimentStyle(overallSentiment);




  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: "Book Details", headerShown: true }} />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.coverContainer}>
          {coverLoading && <ActivityIndicator style={StyleSheet.absoluteFill} color="#ccc" />}
          <Image
            source={{ uri: finalCoverUrl }}
            style={styles.coverImage}
            resizeMode="contain"
            onLoadStart={() => setCoverLoading(true)}
            onLoadEnd={() => setCoverLoading(false)} 
            onError={(e) => {
              console.log('Failed to load cover image:', e.nativeEvent.error);
              setCoverLoading(false);
            }}
          />
        </View>
        {/* Book metadata */}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.author}>by {author || 'Unknown Author'}</Text>
        <Text style={styles.publishYear}>First published: {publish_year || 'N/A'}</Text>

        {/* NEW SENTIMENT DISPLAY SECTION */}
        <View style={styles.sentimentBox}>
            <Text style={styles.sentimentLabel}>Overall Reader Sentiment:</Text>
            {overallSentiment === 'Loading...' ? (
                <ActivityIndicator size="small" color="#0000ff" />
            ) : overallSentiment === 'No Comments' ? (
                <Text style={styles.noCommentsText}>No Comments Yet</Text>
            ) : (
                <Text style={[styles.sentimentText, { color: sentimentDisplay.color }]}>
                    {sentimentDisplay.emoji} {overallSentiment}
                </Text>
            )}
        </View>

        {/* Read button */}
        <View style={styles.buttonContainer}>
          <Button title="Read Now" onPress={handleReadNow} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff2c', 
  },
  scrollContainer: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  coverContainer: {
    width: 335,
    height: 530,
    backgroundColor: '#333', 
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 10,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 27,
    fontWeight: 'bold',
    color: '#000000ff',
    textAlign: 'center',
    // marginBottom: 1,
  },
  author: {
    fontSize: 16,
    color: '#252525ff',
    textAlign: 'center',
    marginBottom: 10,
  },
  publishYear: {
    fontSize: 14,
    color: '#2b2929ff',
    marginBottom: 10,
  },
  buttonContainer: { 
    width: '60%', 
    marginTop: 10,
  },
  errorContainer: { 
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ff4d4f',
    textAlign: 'center',
    fontSize: 16,
  },
  // NEW SENTIMENT STYLES
  sentimentBox: {
    padding: 15,
    borderRadius: 8,
    backgroundColor: '#fff',
    width: '100%',
    alignItems: 'center',
    marginVertical: 15,
    borderWidth: 1,
    borderColor: '#eee',
  },
  sentimentLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sentimentText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  noCommentsText: {
    fontSize: 16,
    color: '#999',
  }
});