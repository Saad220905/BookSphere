import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native'; // --- 1. Import Pressable ---
import { Text } from './Themed';
import { Timestamp } from 'firebase/firestore'; // --- 2. Import Timestamp for better type safety ---

interface Message {
  id: string; // Make sure 'id' is part of the interface
  text: string;
  senderId: string;
  createdAt: Timestamp | null; // --- 3. Use Timestamp type ---
}

interface ChatMessageProps {
  message: Message;
  isCurrentUser: boolean;
  currentUserBubbleColor?: string;
  currentUserTextColor?: string;
  otherUserBubbleColor?: string;
  otherUserTextColor?: string;
  onUnsend: (messageId: string) => void; // --- 4. Add onUnsend prop ---
}

export default function ChatMessage({ 
  message, 
  isCurrentUser, 
  currentUserBubbleColor = '#0a7ea4',
  currentUserTextColor = '#fff',
  otherUserBubbleColor = '#f0f0f0',
  otherUserTextColor = '#000',
  onUnsend // --- 5. Get onUnsend from props ---
}: ChatMessageProps) {

  const bubbleColor = isCurrentUser ? currentUserBubbleColor : otherUserBubbleColor;
  const textColor = isCurrentUser ? currentUserTextColor : otherUserTextColor;

  // --- 6. Create the long-press handler ---
  const handleLongPress = () => {
    // Only allow unsending if it's the current user's message
    if (isCurrentUser) {
      onUnsend(message.id);
    }
  };

  return (
    // --- 7. Wrap the View in a Pressable ---
    <Pressable onLongPress={handleLongPress}>
      <View
        style={[
          styles.messageContainer,
          { backgroundColor: bubbleColor },
          isCurrentUser ? styles.currentUserMessage : styles.otherUserMessage,
        ]}
      >
        <Text style={[styles.messageText, { color: textColor }]}>
          {message.text}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  messageContainer: {
    padding: 10,
    borderRadius: 18,
    marginBottom: 10,
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 0,
    elevation: 8,
  },
  currentUserMessage: {
    alignSelf: 'flex-end',
    marginBottom: 10,
    borderBottomRightRadius: 5,
  },
  otherUserMessage: {
    alignSelf: 'flex-start',
    marginBottom: 10,
    borderBottomLeftRadius: 5,
  },
  messageText: {
    fontSize: 15,
  },
});




