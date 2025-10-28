import { Stack, Redirect} from 'expo-router';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import NetworkStatus from '../components/NetworkStatus';
import { AuthProvider } from '../contexts/AuthContext';
import { NotificationProvider } from '../contexts/NotificationContext';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NotificationProvider>
          <NetworkStatus />
          <Stack
            screenOptions={{
              headerShown: false,
              headerStyle: {
                backgroundColor: colorScheme === 'dark' ? '#000' : '#fff',
              },
              headerTintColor: colorScheme === 'dark' ? '#fff' : '#000',
              headerShadowVisible: false,
            }}

          />
          <Redirect href="/(tabs)/profile" />
        </NotificationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
