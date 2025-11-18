import React from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import NetworkStatus from '../components/NetworkStatus';
import { AuthProvider } from '../contexts/AuthContext';
import { NotificationProvider } from '../contexts/NotificationContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NotificationProvider>
          <NetworkStatus />
          <Stack screenOptions={{ headerShown: false }} />
        </NotificationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
