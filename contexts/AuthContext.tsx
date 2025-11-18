import { User, createUserWithEmailAndPassword, signOut as firebaseSignOut, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../config/firebase';
import { UserProfile, createUserProfile, getUserProfile } from '../utils/userProfile';
import React from 'react';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>; //RESET PASS TYPE DEF HERE
  isAuthAvailable: boolean;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  resetPassword: async () => {}, //RESET PASS DEFAULT VAL
  isAuthAvailable: false,
  refreshUserProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthAvailable, setIsAuthAvailable] = useState(false);

  const fetchUserProfile = async (user: User) => {
    try {
      const profile = await getUserProfile(user.uid);
      setUserProfile(profile);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setUserProfile(null);
    }
  };

  const refreshUserProfile = async () => {
    if (user) {
      await fetchUserProfile(user);
    }
  };

  useEffect(() => {
    if (!auth) {
      console.log('Firebase Auth not available, skipping auth state listener');
      setLoading(false);
      setIsAuthAvailable(false);
      return;
    }

    setIsAuthAvailable(true);
    console.log('🔐 Setting up Firebase Auth state listener');

    const unsubscribe = auth.onAuthStateChanged(async (user: User | null) => {
      console.log('👤 Auth state changed:', user ? `User ${user.email} logged in` : 'No user');
      setUser(user);
      if (user) {
        await fetchUserProfile(user);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    }, (error) => {
      console.error('Auth state listener error:', error);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!auth) {
      throw new Error('Firebase Auth is not available. Please check your internet connection and try again.');
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string) => {
    if (!auth) {
      throw new Error('Firebase Auth is not available. Please check your internet connection and try again.');
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // Create user profile after successful sign up
      await createUserProfile(userCredential.user);
    } catch (error: any) {
      console.error('Sign up error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    if (!auth) {
      throw new Error('Firebase Auth is not available. Please check your internet connection and try again.');
    }
    try {
      await firebaseSignOut(auth);
      setUserProfile(null);
    } catch (error: any) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  // RESET PASS FUNCTION
  const resetPassword = async (email: string) => {
    if (!auth) {
      throw new Error('Firebase Auth is not available. Please check your internet connection and try again.');
    }
    // We trim the email here just in case, before sending the reset request
    await sendPasswordResetEmail(auth, email.trim());
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      userProfile,
      loading, 
      signIn, 
      signUp, 
      signOut, 
      resetPassword, // RESET PASS NEW FUNCTION
      isAuthAvailable,
      refreshUserProfile 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 