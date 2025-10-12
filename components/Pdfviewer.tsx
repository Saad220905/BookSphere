import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Dimensions, ActivityIndicator, Text, TextInput, Button, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import Pdf, { type PdfProps } from 'react-native-pdf'; // this error is not real, ignore

interface PdfViewerProps {
  source: PdfProps['source'];
}

export default function PdfViewer({ source }: PdfViewerProps) {
  // Page stuff
  const [totalPages, setTotalPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  return (
    <View style={styles.pdfViewContainer}>
      <Pdf
        source={source}
        enablePaging={true}
        trustAllCerts={false}
        horizontal={true}
        onLoadComplete={(numberOfPages: number) => {
          console.log(`Total pages loaded: ${numberOfPages}`)
          setTotalPages(numberOfPages);
          setIsLoading(false);
        }}
        onPageChanged={(page: number, numberOfPages: number) => {
          console.log(`Page turned: ${page}`)
          setCurrentPage(page);
        }}
        onError={(error: object) => {
          console.log(error);
          setIsLoading(false);
        }}
        style={styles.pdf}
      />

      {isLoading && (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" />
        </View>
      )}

      {!isLoading && (
        <View style={styles.uiOverlay}>
          {/* Page count */}
          <View style={styles.pageCountContainer}>
            <Text style={styles.pageCountText}>
              Page {currentPage} of {totalPages}
            </Text>
          </View>
        </View>
      )}
    </View>
)}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  pdfViewContainer: {
    flex: 1,
  },
  pdf: {
    flex: 1,
    width: Dimensions.get('window').width,
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },

  uiOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pageCountContainer: {
    marginTop: 50,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 15,
  },
  pageCountText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  textInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 5,
    padding: 8,
    marginRight: 10,
    color: '#fff',
  },
});