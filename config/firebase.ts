import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { firebaseConfig } from './environment';

// Global variables to ensure singleton pattern
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: any = null;

// Initialize Firebase with maximum defensive programming
async function initializeFirebase() {
  try {
    // Check if any Firebase apps are already initialized
    const existingApps = getApps();
    
    if (existingApps.length === 0) {
      // No apps exist, create a new one
      app = initializeApp(firebaseConfig);
      console.log('Firebase app initialized successfully');
    } else {
      // Use the first existing app (usually the DEFAULT app)
      app = getApp();
      console.log('Using existing Firebase app:', app.name);
    }

    // Initialize services with proper error handling (for now)
    try {
      auth = getAuth(app);
      console.log('Firebase Auth initialized successfully');
      console.log('Note: Auth state will use memory persistence. For persistent auth, consider upgrading Firebase SDK.');
    } catch (authError) {
      console.error('Firebase Auth initialization failed:', authError);
      auth = null;
    }

    try {
      // Initialize Firestore
      const settings = {
        cacheSizeBytes: 100000000,
        experimentalForceLongPolling: true,
      };
      
      try {
        db = initializeFirestore(app, settings);
      } catch (error) {
        console.warn('⚠️ Could not initialize Firestore with settings, falling back to default config');
        db = getFirestore(app);
      }
      console.log('Firestore initialized successfully');
    } catch (dbError) {
      console.error('Firestore initialization failed:', dbError);
      db = null;
    }

    try {
      storage = getStorage(app);
      console.log('Firebase Storage initialized successfully');
    } catch (storageError) {
      console.error('Firebase Storage initialization failed:', storageError);
      storage = null;
    }

    console.log('📊 Firebase services status:', {
      projectId: firebaseConfig.projectId,
      authDomain: firebaseConfig.authDomain,
      appName: app.name,
      auth: auth ? 'yes' : 'no',
      db: db ? 'yes' : 'no',
      storage: storage ? 'yes' : 'no'
    });

  } catch (error) {
    console.error('Error initializing Firebase:', error);
    console.log('App will continue without Firebase services');
    // Don't throw error, let app continue without Firebase
  }
}

// Initialize Firebase immediately
initializeFirebase().catch(error => {
  console.error('Error during Firebase initialization:', error);
});

// Export the services (may be null if initialization failed)
export { auth, db, storage };
export default app; 