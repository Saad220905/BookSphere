import { FontAwesome } from '@expo/vector-icons';
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, Button, ScrollView, Platform, TouchableOpacity, KeyboardAvoidingView, Image, Alert } from 'react-native';
import { Comment, toggleLike, deleteComment  } from '../utils/bookComments';
import { UserProfile, getUserProfile } from '../utils/userProfile';

interface CommentSectionProps {
  bookId: string;
  currentUserId: string;
  comments: Comment[];
  //New prop for overall page sentiment
  pageSentiment: 'Positive' | 'Negative' | 'Neutral' | 'Mixed';
  onPostComment: (commentText: string,  isSpoiler: boolean) => void;
  onClose: () => void;
  commentInputValue: string;
  onCommentInputChange: (text: string) => void;
  isSpoiler: boolean;
  setIsSpoiler: (value: boolean) => void;
}

// --- NEW HELPER FOR PAGE SENTIMENT DISPLAY ---
const getPageSentimentDisplay = (pageSentiment: CommentSectionProps['pageSentiment']) => {
  switch (pageSentiment) {
    case 'Positive':
      return { text: 'Overall Positive', color: '#00cc00', emoji: '🌟' };
    case 'Negative':
      return { text: 'Overall Negative', color: '#ff3b30', emoji: '⛈️' };
    case 'Neutral':
      return { text: 'Overall Neutral', color: '#ffcc00', emoji: '☁️' };
    case 'Mixed':
      return { text: 'Mixed Feelings', color: '#8e8e93', emoji: '⚖️' };
  }
};

// --- HELPER FUNCTION ---
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
  <FontAwesome
    name={liked ? 'heart' : 'heart-o'} 
    style={{ 
      fontSize: 20, 
      color: liked ? '#ff3b30' : '#8e8e93' 
    }}
  />
);

const CommentItem = ({ comment, bookId, currentUserId }: { comment: Comment, bookId: string, currentUserId: string }) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showSpoiler, setShowSpoiler] = useState(false);

  useEffect(() => {
    // Fetch the profile for this userId
    if (comment.userId && comment.userId !== 'anonymous_user') {
      getUserProfile(comment.userId)
        .then(profile => {
          if (profile) {
            setUserProfile(profile);
          }
        })
        .catch(err => console.error(`Failed to get profile for ${comment.userId}`, err));
    }
  }, [comment.userId]); 

  const isLikedByUser = Array.isArray(comment.likedBy) && comment.likedBy.includes(currentUserId);
  const { emoji, color } = getSentimentDisplay(comment.sentiment);

  // Use the fetched displayName, or fallback to "Anonymous"
  const displayName = userProfile?.displayName || (comment.userId === 'anonymous_user' ? 'Anonymous' : '...');
  // Use user's photoURL OR fallback to UI-AVATARS
  const photoURL =  { uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}` };
  const isOwner = currentUserId === comment.userId;
  
  const handleDelete = () => {
    Alert.alert(
      "Delete Comment",
      "Are you sure you want to permanently delete this comment?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: () => {
            deleteComment(bookId, comment.id)
              .catch(err => {
                console.error("Failed to delete comment:", err);
                Alert.alert("Error", "Could not delete comment.");
              });
          } 
        }
      ]
    );
  };

  return (
    <View style={styles.commentItemContainer}>
      <Image source={photoURL} style={styles.profilePic} />

      {/* Left side: user info and comment content */}
      <View style={styles.commentContent}>
        <View style={styles.userLine}>
          {/* --- USE 'displayName' --- */}
          <Text style={styles.commentUser}>{displayName}</Text>
          {(!comment.isSpoiler || showSpoiler) && (
            <Text style={[styles.sentimentText, { color: color }]}>{emoji}</Text>
          )}
        </View>
        {comment.isSpoiler && !showSpoiler ? (
          <TouchableOpacity onPress={() => setShowSpoiler(true)} style={styles.spoilerButton}>
            <FontAwesome name="eye-slash" size={14} color="#8e8e93" />
            <Text style={styles.spoilerButtonText}>Show Spoiler</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.commentText}>{comment.text}</Text>
        )}
      </View>
      
      {/* Right side: delete + like button and like count */}
      <View style={styles.rightColumnContainer}>
        <TouchableOpacity
          onPress={() => toggleLike(bookId, comment.id, currentUserId)}
          style={styles.likeButtonContainer}
        >
          <HeartIcon liked={isLikedByUser} />
          {comment.likeCount > 0 && (
            <Text style={styles.likeCount}>{comment.likeCount}</Text>
          )}
        </TouchableOpacity>
        {isOwner && (
          <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
            <FontAwesome name="trash-o" size={15} color="#8e8e93" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------------------
// MAIN COMPONENT EXPORT
// ---------------------------------------------------------------------------------------
export default function BookCommentsDisplay({ 
    bookId, 
    currentUserId, 
    comments, 
    onPostComment, 
    onClose, 
    commentInputValue, 
    onCommentInputChange, 
    pageSentiment,
    isSpoiler,
    setIsSpoiler
}: CommentSectionProps) {
    //Call the helper function here to declare the variables before the return statement.
    const { text, color, emoji } = getPageSentimentDisplay(pageSentiment);

  const handlePost = () => {
    if (commentInputValue.trim() === '') return;
    onPostComment(commentInputValue, isSpoiler);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.modalContainer}
    >
      {/* Comment section header */}
      <View style={styles.header}>
        <View style={{width: 24}} /> 
        {/* display the Overall Page Sentiment */}
          <View style={styles.pageSentimentContainer}>
            {/* variables (color, emoji, text) correctly defined */}
            <Text style={[styles.pageSentimentText, {color: color}]}>{emoji} {text}</Text>
          </View>
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
          comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              bookId={bookId}
              currentUserId={currentUserId}
            />
          ))
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
      <View style={styles.spoilerToggleContainer}>
        <TouchableOpacity style={styles.spoilerToggle} onPress={() => setIsSpoiler(!isSpoiler)}>
          <FontAwesome name={isSpoiler ? 'check-square-o' : 'square-o'} size={20} color={isSpoiler ? '#007AFF' : '#8e8e93'} />
          <Text style={styles.spoilerToggleText}>Mark as Spoiler</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
// ---------------------------------------------------------------------------------------
// STYLES
// ---------------------------------------------------------------------------------------
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
  },
  pageSentimentContainer: {
    position: 'absolute', // Position this absolutely so it doesn't push the title
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'flex-start', // Align to the left side
    paddingLeft: 15,
},//overall page sentiment
  pageSentimentText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
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
    fontSize: 10, 
    marginTop: -2 
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
  profilePic: {
    width: 40,
    height: 40,
    borderRadius: 20, 
    marginRight: 10,
    backgroundColor: '#3a3a3c', 
  },
  spoilerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3a3a3c',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start', 
  },
  spoilerButtonText: {
    color: '#8e8e93',
    marginLeft: 8,
    fontWeight: 'bold',
    fontSize: 14,
  },
  spoilerToggleContainer: {
    paddingHorizontal: 15,
    paddingBottom: 10, 
    paddingTop: 5,
    backgroundColor: '#1c1c1e', 
    borderTopWidth: 1,
    borderTopColor: '#3a3a3c',
  },
  spoilerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spoilerToggleText: {
    color: '#8e8e93',
    marginLeft: 10,
    fontSize: 14,
  },
  rightColumnContainer: {
    alignItems: 'center',
    justifyContent: 'space-between', 
    minHeight: 50, 
  },
  deleteButton: {
    paddingTop: 4,
  }
});