import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Dimensions, ActivityIndicator, Text, TouchableOpacity, KeyboardAvoidingView, Modal, TouchableWithoutFeedback } from 'react-native';
import Pdf, { type PdfProps } from 'react-native-pdf'; // this error is not real, ignore
import { updateBookPageCount } from '../utils/getBook';

// Comment imports
import BookCommentsDisplay from './BookCommentsDisplay';
import { listenForComments, addComment , Comment } from '../utils/bookComments';

const UpArrowIcon = () => (
    <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 16, height: 16, borderLeftWidth: 2, borderTopWidth: 2, borderColor: '#fff', transform: [{ rotate: '45deg' }], marginBottom: -4 }} />
    </View>
);

interface PdfViewerProps {
  source: PdfProps['source'];
  bookId: string;
}

export default function PdfViewer({ source, bookId }: PdfViewerProps) {
  // Page stuff
  const [totalPages, setTotalPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Comment stuff
  const [comments, setComments] = useState<Comment[]>([]);
  const [isCommentSectionVisible, setIsCommentSectionVisible] = useState(false);

  useEffect(() => {
    if (!bookId || !currentPage) return;

    // Start listening for comments on the current page of the current book
    const unsubscribe = listenForComments(bookId, currentPage, (newComments) => {
      setComments(newComments);
    });

    // Stops listening for comments when the page or book changes
    return () => unsubscribe();
  }, [bookId, currentPage]); 

  const handlePostComment = (text: string) => {
    addComment(bookId, currentPage, text, "testing123"); // CHANGE LATER
  };

  return (
    <KeyboardAvoidingView
      behavior={"padding"}
      style={styles.container}
    >
      <View style={styles.pdfViewContainer}>
        <Pdf
          source={source}
          enablePaging={true}
          trustAllCerts={false}
          horizontal={true}
          onLoadComplete={(numberOfPages: number) => {
            console.log(`Total pages loaded: ${numberOfPages}`) // DEBUG : remove later
            setTotalPages(numberOfPages);
            setIsLoading(false);
            updateBookPageCount(bookId, numberOfPages); 
          }}
          onPageChanged={(page: number, numberOfPages: number) => {
            console.log(`Page turned: ${page}`) // DEBUG : remove later
            setCurrentPage(page);
          }}
          onError={(error: object) => {
            console.log(error);
            setIsLoading(false);
          }}
          style={styles.pdf}
        />

        {/* Loading screen */}
        {isLoading && (
          <View style={styles.loaderOverlay}>
            <ActivityIndicator size="large" />
          </View>
        )}
        {/* Page count */}
        {!isLoading && (
          <View style={styles.pageCountContainer}>
            <Text style={styles.pageCountText}>
              Page {currentPage} of {totalPages}
            </Text>
          </View>
        )}
        {/* Comment view toggle */}
        {!isLoading && (
          <TouchableOpacity 
            style={styles.toggleButton} 
            onPress={() => setIsCommentSectionVisible(true)}
          >
            <UpArrowIcon/>
          </TouchableOpacity>
        )}
      </View>

      <Modal
        animationType="slide"
        transparent={true}
        visible={isCommentSectionVisible}
        onRequestClose={() => {
            setIsCommentSectionVisible(false);
        }}
      >
        {/* Comment view untoggle */}
        <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPressOut={() => setIsCommentSectionVisible(false)}
        >
          {/* Comments */}
          <TouchableWithoutFeedback>
            <View style={styles.modalContentContainer}>
              <BookCommentsDisplay
                bookId={bookId}
                currentUserId={"testing123"} // CHANGE LATER
                comments={comments}
                onPostComment={handlePostComment}
                onClose={() => setIsCommentSectionVisible(false)}
              />
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>
  </KeyboardAvoidingView>  
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
  pageCountContainer: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 15,
  },
  pageCountText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  toggleButton: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end', 
    backgroundColor: 'rgba(0,0,0,0.5)', 
  },
  modalContentContainer: {
    height: '50%', 
    width: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
});