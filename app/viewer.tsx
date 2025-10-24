import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../components/Themed';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams , Stack } from 'expo-router';
import PdfViewer from '../components/Pdfviewer';

export default function ViewerScreen() {
  const { pdf_url , book_id , book_title } = useLocalSearchParams<{ pdf_url: string; book_id: string ; book_title?: string }>();
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
  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: headerTitle , headerShown: true, }} />
      <PdfViewer source={pdfSource} bookId={book_id} />
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