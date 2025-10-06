import { User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, FirestoreError, Firestore } from 'firebase/firestore';
import { db } from '../config/firebase';
import { FirebaseError } from 'firebase/app';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  bio?: string;
  readingLists?: string[];
  followingCount: number;
  followersCount: number;
  booksRead: number;
  createdAt: Date;
  updatedAt: Date;
}

export class UserProfileError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'UserProfileError';
  }
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

async function retryOperation<T>(operation: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (retries > 0 && (error instanceof FirebaseError || error instanceof FirestoreError)) {
      // Only retry on network-related errors
      const errorWithCode = error as { code?: string };
      if (errorWithCode.code === 'permission-denied' || errorWithCode.code === 'unavailable') {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return retryOperation(operation, retries - 1);
      }
    }
    throw error;
  }
}

function getFirestore(): Firestore {
  if (!db) {
    throw new UserProfileError('Firestore is not initialized');
  }
  return db;
}

function validateUserProfile(profile: Partial<UserProfile>): void {
  if (profile.email && !profile.email.includes('@')) {
    throw new UserProfileError('Invalid email format');
  }
  if (profile.bio && profile.bio.length > 500) {
    throw new UserProfileError('Bio cannot exceed 500 characters');
  }
  if (profile.followingCount !== undefined && profile.followingCount < 0) {
    throw new UserProfileError('Following count cannot be negative');
  }
  if (profile.followersCount !== undefined && profile.followersCount < 0) {
    throw new UserProfileError('Followers count cannot be negative');
  }
  if (profile.booksRead !== undefined && profile.booksRead < 0) {
    throw new UserProfileError('Books read count cannot be negative');
  }
}

export async function createUserProfile(user: User): Promise<UserProfile> {
  if (!user?.uid) {
    throw new UserProfileError('User ID is required');
  }

  const userProfile: UserProfile = {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || '',
    photoURL: user.photoURL || '',
    followingCount: 0,
    followersCount: 0,
    booksRead: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  validateUserProfile(userProfile);

  const userRef = doc(getFirestore(), 'users', user.uid);
  
  try {
    await retryOperation(() => setDoc(userRef, userProfile));
    return userProfile;
  } catch (error) {
    if (error instanceof FirebaseError || error instanceof FirestoreError) {
      const firebaseError = error as { message?: string, code?: string };
      throw new UserProfileError(`Failed to create user profile: ${firebaseError.message}`, firebaseError.code);
    }
    throw new UserProfileError('Failed to create user profile');
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (!uid) {
    throw new UserProfileError('User ID is required');
  }

  const userRef = doc(getFirestore(), 'users', uid);
  
  try {
    const userDoc = await retryOperation(() => getDoc(userRef));
    
    if (!userDoc.exists()) {
      return null;
    }
    
    const data = userDoc.data() as UserProfile;
    // Ensure dates are properly converted
    data.createdAt = data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt);
    data.updatedAt = data.updatedAt instanceof Date ? data.updatedAt : new Date(data.updatedAt);
    
    return data;
  } catch (error) {
    if (error instanceof FirebaseError || error instanceof FirestoreError) {
      const firebaseError = error as { message?: string, code?: string };
      throw new UserProfileError(`Failed to get user profile: ${firebaseError.message}`, firebaseError.code);
    }
    throw new UserProfileError('Failed to get user profile');
  }
}

export async function updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
  if (!uid) {
    throw new UserProfileError('User ID is required');
  }

  validateUserProfile(updates);

  const userRef = doc(getFirestore(), 'users', uid);
  const updateData = {
    ...updates,
    updatedAt: new Date(),
  };

  try {
    await retryOperation(() => updateDoc(userRef, updateData));
  } catch (error) {
    if (error instanceof FirebaseError || error instanceof FirestoreError) {
      const firebaseError = error as { message?: string, code?: string };
      throw new UserProfileError(`Failed to update user profile: ${firebaseError.message}`, firebaseError.code);
    }
    throw new UserProfileError('Failed to update user profile');
  }
}