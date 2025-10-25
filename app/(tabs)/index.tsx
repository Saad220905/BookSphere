import { router } from 'expo-router';
import React from 'react';
import { SafeAreaView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../../components/Themed';
import { FontAwesome } from '@expo/vector-icons'; // Make sure FontAwesome is imported

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/create/post')}>
          <FontAwesome name="pencil-square-o" size={20} color="#fff" />
          <Text style={styles.actionText}>Create Post</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/create/club')}>
          <FontAwesome name="book" size={20} color="#fff" />
          <Text style={styles.actionText}>Create Club</Text>
        </TouchableOpacity>
      </View>

      {/* Chat Button Section */}
      <View style={styles.chatAction}>
        <TouchableOpacity
          style={[styles.actionButton, styles.chatButton]}
          onPress={() => router.push('/(tabs)/chat')}
        >
          <FontAwesome name="comments" size={24} color="#fff" />
          <Text style={styles.actionText}>Chat With Other Users</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Layout
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
    justifyContent: 'flex-start',
  },

  // Quick actions section
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },

  // --- ADD THESE MISSING STYLES ---
  chatAction: {
    marginTop: 12,
  },
  chatButton: {
    flex: 0, // This makes the button only as wide as its content
  },
  // ----------------------------------

  // Buttons
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
    padding: 16,
    gap: 8,
  },

  // Text
  actionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});