import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './Themed'; // Assumes Themed.tsx is in the same components folder

interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: any; // Using 'any' as per previous code, consider using Firestore Timestamp type if possible
}

interface ChatMessageProps {
  message: Message;
  isCurrentUser: boolean;
  currentUserBubbleColor?: string;
  currentUserTextColor?: string;
  otherUserBubbleColor?: string;
  otherUserTextColor?: string;
}

export default function ChatMessage({
  message,
  isCurrentUser,
  currentUserBubbleColor = '#0a7ea4', // Default blue for current user
  currentUserTextColor = '#fff',     // Default white text
  otherUserBubbleColor = '#f0f0f0',   // Default light grey for other user
  otherUserTextColor = '#000',       // Default black text
}: ChatMessageProps) {

  const bubbleColor = isCurrentUser ? currentUserBubbleColor : otherUserBubbleColor;
  const textColor = isCurrentUser ? currentUserTextColor : otherUserTextColor;

  return (
    <View
      style={[
        styles.messageContainer,
        { backgroundColor: bubbleColor }, // Apply dynamic background color
        isCurrentUser ? styles.currentUserMessage : styles.otherUserMessage,
      ]}
    >
      <Text style={[styles.messageText, { color: textColor }]}>
        {message.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  messageContainer: {
    padding: 12,
    borderRadius: 18,
    marginBottom: 8,
    maxWidth: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  currentUserMessage: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  otherUserMessage: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
  },
});