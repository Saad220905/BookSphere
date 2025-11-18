import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../../components/Themed';
import { useAuth } from '../../contexts/AuthContext';
//import { getFirebaseErrorMessage } from '../../utils/firebaseErrors';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, isAuthAvailable } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!isAuthAvailable) {
      Alert.alert(
        'Connection Error', 
        'Unable to connect to authentication service. Please check your internet connection and try again.'
      );
      return;
    }

    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      await signIn(email, password);
      router.replace('/(tabs)/feed');
    } catch (error: any) {
      //const errorMessage = getFirebaseErrorMessage(error);
      //Alert.alert('Sign In Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <FontAwesome name="book" size={48} color="#0a7ea4" />
        <Text style={styles.title}>Welcome to BookSphere</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>
        {!isAuthAvailable && (
          <Text style={styles.warningText}>
            ⚠️ Offline mode - authentication unavailable
          </Text>
        )}
      </View>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <FontAwesome name="envelope" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={isAuthAvailable}
          />
        </View>

        <View style={styles.inputContainer}>
          <FontAwesome name="lock" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={isAuthAvailable}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, (loading || !isAuthAvailable) && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading || !isAuthAvailable}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Signing in...' : !isAuthAvailable ? 'Offline' : 'Sign In'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => router.push('/signup')}
        >
          <Text style={styles.linkText}>
            Don&apos;t have an account? <Text style={styles.link}>Sign up</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  container: {
    backgroundColor: '#fff',
    flex: 1,
    padding: 24,
  },
  form: {
    gap: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
    marginTop: 48,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: 48,
  },
  inputContainer: {
    alignItems: 'center',
    borderColor: '#ddd',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  link: {
    color: '#0a7ea4',
    fontWeight: 'bold',
  },
  linkButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  linkText: {
    color: '#666',
    fontSize: 14,
  },
  subtitle: {
    color: '#666',
    fontSize: 16,
    marginTop: 8,
  },
  title: {
    color: '#0a7ea4',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 16,
  },
  warningText: {
    color: '#ff6b35',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
}); 