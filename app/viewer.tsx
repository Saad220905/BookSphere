import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../components/Themed';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams , Stack } from 'expo-router';
import PdfViewer from '../components/Pdfviewer';

export default function ViewerScreen() {
  const { pdf_url , book_id , book_title, initial_page } = useLocalSearchParams<{ 
    pdf_url: string; 
    book_id: string; 
    book_title?: string;
    initial_page?: string;
  }>();
  const [isNightMode, setIsNightMode] = useState(false);
  
  if (!pdf_url || !book_id) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: "Error" , headerShown: true, }} />
        <View style={styles.errorContainer}>
          <Text>Missing book information</Text>
        </View>
      </SafeAreaView>
    );
  }
  const headerTitle = book_title || "Loading...";
  const pdfSource = { uri : pdf_url, cache: true };
  const headerBgColor = isNightMode ? '#1c1c1e' : '#fff';
  const headerTextColor = isNightMode ? '#ffffff' : '#000000';
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: headerBgColor }]}>
      <Stack.Screen options={{ 
        title: headerTitle, 
        headerShown: true,
        headerStyle: {
          backgroundColor: headerBgColor, 
        },
        headerTintColor: headerTextColor, 
      }} />
      <PdfViewer 
        source={pdfSource} 
        bookId={book_id}
        isNightMode={isNightMode} 
        setIsNightMode={setIsNightMode}
        initialPage={initial_page ? parseInt(initial_page, 10) : undefined}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorContainer : {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});