import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../components/Themed';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import PdfViewer from '../../components/Pdfviewer';

export default function ViewerScreen() {
  const { url , bookId } = useLocalSearchParams<{ url: string; bookId: string }>();
  if (!url || !bookId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text>Missing book information</Text>
        </View>
      </SafeAreaView>
    );
  }

  const pdfSource = { uri : url, cache: true };
  return (
    <SafeAreaView style={styles.container}>
      <PdfViewer source={pdfSource} bookId={bookId} />
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