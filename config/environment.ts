// Environment configuration for BookSphere
// This file validates and exports environment variables

interface EnvironmentConfig {
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
  app: {
    name: string;
    version: string;
    environment: 'development' | 'staging' | 'production';
  };
  gemini: {
    apiKey: string;
  };
}

function validateEnvironment(): EnvironmentConfig {
  const requiredFirebaseVars = [
    'EXPO_PUBLIC_FIREBASE_API_KEY',
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
    'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'EXPO_PUBLIC_FIREBASE_APP_ID',
    'EXPO_PUBLIC_GEMINI_API_KEY',
  ];

  const missingVars = requiredFirebaseVars.filter(
    varName => !process.env[varName]
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}\n` +
      'Please check your .env file and ensure all Firebase configuration variables are set.'
    );
  }

  return {
    firebase: {
      apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
      authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
      storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!,
      messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
      appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID!,
    },
    app: {
      name: 'BookSphere',
      version: '1.0.0',
      environment: (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',
    },
    gemini: {
      apiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY!,
    },
  };
}

export const config = validateEnvironment();
export const geminiConfig = config.gemini;

// Export individual configs for convenience
export const firebaseConfig = config.firebase;
export const appConfig = config.app;

// Helper function to check if we're in development
export const isDevelopment = () => config.app.environment === 'development';

// Helper function to check if we're in production
export const isProduction = () => config.app.environment === 'production'; 