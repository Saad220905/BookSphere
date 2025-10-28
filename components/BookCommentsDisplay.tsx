import React from 'react';
import { StyleSheet, View, Text, TextInput, Button, ScrollView, Platform, TouchableOpacity, KeyboardAvoidingView } from 'react-native';
import { Comment, toggleLike } from '../utils/bookComments';

interface CommentSectionProps {
  bookId: string;
  currentUserId: string;
  comments: Comment[];
  onPostComment: (commentText: string) => void;
  onClose: () => void;
  commentInputValue: string;        
  onCommentInputChange: (text: string) => void;
}

// --- NEW HELPER FUNCTION ---
const getSentimentDisplay = (sentiment: Comment['sentiment']) => {
  switch (sentiment) {
    case 'Positive':
      return { emoji: '😀 Positive', color: '#00cc00' }; // Bright Green
    case 'Negative':
      return { emoji: '😠 Negative', color: '#ff3b30' }; // Bright Red
    case 'Neutral':
      return { emoji: '😐 Neutral', color: '#ffcc00' }; // Yellow/Gold
    case 'AnalysisError':
    default:
      return { emoji: '❓ Error', color: '#8e8e93' }; // Dark Gray
  }
};

const DownArrowIcon = () => (
  <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: 16, height: 16, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: '#fff', transform: [{ rotate: '-45deg' }], marginTop: -4 }} />
  </View>
);
const HeartIcon = ({ liked }: { liked: boolean }) => (
  // Using a filled heart for better contrast on a dark background
  <Text style={{ fontSize: 20, color: liked ? '#ff3b30' : '#8e8e93' }}>
    {liked ? '❤️' : '♡'}
  </Text>
);

export default function BookCommentsDisplay({ bookId, currentUserId, comments, onPostComment, onClose, commentInputValue, onCommentInputChange }: CommentSectionProps) {

  const handlePost = () => {
    if (commentInputValue.trim() === '') return;
    onPostComment(commentInputValue);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.modalContainer}
      keyboardVerticalOffset={10}
    >
      {/* Comment section header */}
      <View style={styles.header}>
        <View style={{width: 24}} /> 
        <Text style={styles.headerTitle}>Comments</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <DownArrowIcon />
        </TouchableOpacity>
      </View>

      {/* Scrollable comments */}
      <ScrollView style={styles.commentList}>
        {comments.length === 0 ? (
          <Text style={styles.noCommentsText}>Be the first to comment.</Text>
        ) : (
          comments.map((comment) => {
            const isLikedByUser = Array.isArray(comment.likedBy) && comment.likedBy.includes(currentUserId);
            // --- USE HELPER TO GET SENTIMENT INFO ---
            const { emoji, color } = getSentimentDisplay(comment.sentiment);
            
            return (
              <View key={comment.id} style={styles.commentItemContainer}>
                {/* Left side: user info and comment content */}
                <View style={styles.commentContent}>
                  {/* --- NEW USER/SENTIMENT LINE --- */}
                  <View style={styles.userLine}>
                    <Text style={styles.commentUser}>{comment.userId}</Text>
                    <Text style={[styles.sentimentText, { color: color }]}>{emoji}</Text>
                  </View>
                  {/* ---------------------------------- */}
                  <Text style={styles.commentText}>{comment.text}</Text>
                </View>
                {/* Right side: like button and like count */}
                <TouchableOpacity
                  onPress={() => toggleLike(bookId, comment.id, currentUserId)}
                  style={styles.likeButtonContainer}
                >
                  <HeartIcon liked={isLikedByUser} />
                  {comment.likeCount > 0 && (
                    <Text style={styles.likeCount}>{comment.likeCount}</Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Comment input */}
      <View style={styles.commentInputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Add a comment..."
          placeholderTextColor="#8e8e93"
          value={commentInputValue}
          onChangeText={onCommentInputChange}
        />
        <Button title="Post" onPress={handlePost} disabled={!commentInputValue.trim()} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  modalContainer: { 
    height: '100%',
    backgroundColor: '#1c1c1e' 
  }, 
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a3c',
  },
  headerTitle: { color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 16 
  },
  closeButton: {
    padding: 5
  },
  commentList: { 
    flex: 1
  },
  noCommentsText: { 
    color: '#8e8e93', 
    textAlign: 'center', 
    marginTop: 30, 
    fontStyle: 'italic' 
  },
  commentItemContainer: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a3c',
    alignItems: 'flex-start',
  },
  commentContent: { 
    flex: 1, 
    marginRight: 15 
  },
  // --- NEW STYLE FOR USER AND SENTIMENT ---
  userLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  commentUser: { 
    fontWeight: 'bold', 
    color: '#fff', 
    // Removed marginBottom: 4 because it's now in userLine
  },
  // --- NEW STYLE FOR SENTIMENT TEXT ---
  sentimentText: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#3a3a3c', // Dark background for the tag
  },
  commentText: { 
    color: '#fff', 
    lineHeight: 20 
  },
  likeButtonContainer: { 
    alignItems: 'center', 
    paddingTop: 4 
  },
  likeCount: { 
    color: '#8e8e93', 
    fontSize: 12, 
    marginTop: 4 
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#3a3a3c',
    backgroundColor: '#1c1c1e',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#3a3a3c',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    marginRight: 10,
    color: '#fff',
    fontSize: 16,
  },
});