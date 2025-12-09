import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Dimensions, ActivityIndicator, Text, TouchableOpacity, KeyboardAvoidingView, Modal, TouchableWithoutFeedback, TextInput, Button, Platform } from 'react-native';
import Pdf, { type PdfDocumentProps } from 'react-native-pdf'; // this error is not real, ignore
import { updateBookPageCount } from '../utils/getBook';
import { FontAwesome } from '@expo/vector-icons';
import { auth } from '../config/firebase';

// Comment imports
import BookCommentsDisplay from './BookCommentsDisplay';
import { listenForComments, addComment , Comment , PageSentiment } from '../utils/bookComments';

//Progress import
import { saveReadingProgress, loadReadingProgress } from '../utils/userProfile'; 


const CommentIcon = () => (
  <FontAwesome name="comment" size={20} color="#8e8e93" />
);

const NightModeToggleIcon = ({ active }: { active: boolean }) => (
  <FontAwesome 
    name={active ? "moon-o" : "sun-o"} 
    size={24} 
    color={active ? "#FFD700" : "#8e8e93"} 
  />
);

type PdfSource = ComponentProps<typeof Pdf>['source'];

interface PdfViewerProps {
  source: PdfSource;
  bookId: string;
  onPageChanged?: (page: number, totalPages: number) => void;
  isNightMode: boolean; 
  setIsNightMode: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function PdfViewer({ source, bookId, onPageChanged, isNightMode, setIsNightMode }: PdfViewerProps) {
  // Page stuff
  const [totalPages, setTotalPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [initialPage, setInitialPage] = useState<number>(1);


  // Comment stuff
  const [comments, setComments] = useState<Comment[]>([]);
  const [isCommentSectionVisible, setIsCommentSectionVisible] = useState(false);
  const [newComment, setNewComment] = useState('');
  const textInputRef = useRef<TextInput>(null);
  const [isSpoiler, setIsSpoiler] = useState(false);
  
  // User stuff
  const currentUserId = auth.currentUser?.uid || 'anonymous_user';
  const [pageSentiment, setPageSentiment] = useState<PageSentiment>('Neutral');
  
  useEffect(() => {
    // Only fetch saved page if we have a valid user and book
    if (currentUserId !== 'anonymous_user' && bookId) {
      loadReadingProgress(currentUserId, bookId).then(progress => {
        if (progress?.currentPage) {
          console.log(`Resuming reading at page ${progress.currentPage}`);
          setInitialPage(progress.currentPage); // Set the start page
        }
      });
    }
  }, [bookId, currentUserId]);

  useEffect(() => {
    if (!bookId || !currentPage) return;

    // Start listening for comments on the current page of the current book
    const unsubscribe = listenForComments(bookId, currentPage, (newComments, newPageSentiment) => {
      setComments(newComments);
      setPageSentiment(newPageSentiment);
    });

    // Stops listening for comments when the page or book changes
    return () => unsubscribe();
  }, [bookId, currentPage]); 

  const handlePostComment = (textFromInput?: string) => {
    const commentText = textFromInput ?? newComment;
    if (commentText.trim() === '') { return; }
    addComment(bookId, currentPage, commentText, currentUserId, isSpoiler); 
    setNewComment(''); 
    setIsSpoiler(false);
    textInputRef.current?.blur(); 
  };

  const openCommentList = () => {
    textInputRef.current?.blur(); 
    setIsCommentSectionVisible(true);
  };

  return (
    <KeyboardAvoidingView
      behavior={"padding"}
      style={styles.container}
    >  
      <View style={styles.pdfViewContainer}>
        <Pdf
          source={source}
          page={initialPage}
          enablePaging={true}
          trustAllCerts={false}
          horizontal={true}
          onLoadComplete={(numberOfPages: number) => {
            console.log(`Total pages loaded: ${numberOfPages}`) // DEBUG : remove later
            setTotalPages(numberOfPages);
            setIsLoading(false);
            updateBookPageCount(bookId, numberOfPages); 
            saveReadingProgress(currentUserId, bookId, currentPage, numberOfPages); 
          }}
          onPageChanged={(page: number, numberOfPages: number) => {
            console.log(`Page turned: ${page}`) // DEBUG : remove later
            saveReadingProgress(currentUserId, bookId, page, numberOfPages); 
            setCurrentPage(page);
            if (onPageChanged) {
              onPageChanged(page, numberOfPages);
            }
          }}
          onError={(error: object) => {
            console.log(error);
            setIsLoading(false);
          }}
          style={[styles.pdf, isNightMode && styles.pdfNight]}
        />

        {/* Loading screen */}
        {isLoading && (
          <View style={styles.loaderOverlay}>
            <ActivityIndicator size="large" />
          </View>
        )}
        {/* Night mode dimmer */}
        {isNightMode && (
          <View style={styles.nightModeDimmer} pointerEvents="none" />
        )}
        {/* Page count */}
        {!isLoading && (
          <View style={styles.pageCountContainer}>
            <Text style={styles.pageCountText}>
              Page {currentPage} of {totalPages}
            </Text>
          </View>
        )}
        {/* Night mode toggle */}
        {!isLoading && (
          <TouchableOpacity 
            style={styles.nightModeToggle} 
            onPress={() => setIsNightMode(!isNightMode)}
          >
            <NightModeToggleIcon active={isNightMode} />
          </TouchableOpacity>
        )}
      </View>
        {!isLoading && (
        <View style={styles.commentInputContainer}>
           {/* Button to toggle comments */}
          <TouchableOpacity onPress={openCommentList} style={styles.openListButton}>
            <CommentIcon />
            {/* Display comment count */}
            {comments.length > 0 && <Text style={styles.commentCountBadge}>{comments.length}</Text>}
          </TouchableOpacity>
          <TextInput
            ref={textInputRef}
            style={styles.textInput}
            placeholder={`Add a comment...`}
            placeholderTextColor="#8e8e93"
            value={newComment}
            onChangeText={setNewComment}
            multiline={true}
          />

          <TouchableOpacity style={styles.spoilerToggle} onPress={() => setIsSpoiler(!isSpoiler)}>
            <FontAwesome name={isSpoiler ? 'eye-slash' : 'eye'} size={20} color={isSpoiler ? '#007AFF' : '#8e8e93'} />
          </TouchableOpacity>

          <Button title="Post" onPress={() => handlePostComment()} disabled={!newComment.trim()} />
        </View>
        )}
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
            <View style={[styles.modalContentContainer, isNightMode && styles.modalNight]}>
              <BookCommentsDisplay
                bookId={bookId}
                currentUserId={currentUserId} 
                comments={comments}
                onPostComment={handlePostComment}
                onClose={() => setIsCommentSectionVisible(false)}
                commentInputValue={newComment}
                onCommentInputChange={setNewComment}
                pageSentiment={pageSentiment}
                isSpoiler={isSpoiler}
                setIsSpoiler={setIsSpoiler}
                isNightMode={isNightMode} 
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
    backgroundColor: '#fff', 
  },
  pdfNight: {
    backgroundColor: '#121212', 
  },
  nightModeDimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', 
    zIndex: 1, 
  },
  nightModeToggle: {
    position: 'absolute',
    top: 20,
    right: 20,
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    zIndex: 2, 
  },
  modalNight: {
    backgroundColor: '#1c1c1e',
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
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#3a3a3c',
    backgroundColor: '#1c1c1e', 
  },
  openListButton: {
    padding: 8,
    marginRight: 8,
    position: 'relative', 
  },
  commentCountBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#007AFF',
    color: 'white',
    borderRadius: 8,
    paddingHorizontal: 5,
    fontSize: 10,
    fontWeight: 'bold',
    minWidth: 16,
    textAlign: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#3a3a3c',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
    color: '#fff',
    fontSize: 16,
    maxHeight: 80, 
  },
  iconContainer: {
    width: 28, 
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: '#1c1c1e'
  },
  spoilerToggle: {
    padding: 8,
    marginRight: 8,
  },
});