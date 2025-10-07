// just for testing initial features

import { router } from 'expo-router';
import React from 'react';
import { SafeAreaView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../../components/Themed';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/create/post')}>
          <Text style={styles.actionText}>Create Post</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/create/club')}>
          <Text style={styles.actionText}>Create Club</Text>
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
  },

  // Quick actions section
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },

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