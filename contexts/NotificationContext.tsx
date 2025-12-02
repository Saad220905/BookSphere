import { Firestore, addDoc, collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../config/firebase';
import { useAuth } from './AuthContext';

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'club_invite' | 'club_update' | 'new_video' | 'new_recommendation';
  title: string;
  message: string;
  userId: string;
  targetId?: string;
  targetType?: 'video' | 'club' | 'comment' | 'book';
  fromUserId?: string;
  fromUserDisplayName?: string;
  fromUserPhotoURL?: string | null;
  read: boolean;
  createdAt: any;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  createNotification: (notification: Omit<Notification, 'id' | 'read' | 'createdAt'>) => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  deleteAllNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  isLoading: true,
  error: null,
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  createNotification: async () => {},
  deleteNotification: async () => {},
  deleteAllNotifications: async () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    if (!db) {
      setError('Database is not initialized');
      setIsLoading(false);
      return;
    }

    try {
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      const unsubscribe = onSnapshot(notificationsQuery, 
        (snapshot) => {
          try {
            const notificationsData = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
            })) as Notification[];
            setNotifications(notificationsData);
            setError(null);
            setIsLoading(false);
          } catch (err) {
            console.error('Error processing notification data:', err);
            setError('Error processing notifications');
            setIsLoading(false);
          }
        },
        (err) => {
          console.error('Error in notifications snapshot:', err);
          setError('Failed to load notifications');
          setIsLoading(false);
        }
      );

      return unsubscribe;
    } catch (err) {
      console.error('Error setting up notifications listener:', err);
      setError('Failed to initialize notifications');
      setIsLoading(false);
      return () => {};
    }
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (notificationId: string) => {
    if (!user) return;
    if (!db) {
      throw new Error('Database is not initialized');
    }

    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, { read: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user || !db) {
      throw new Error('User or Database is not initialized');
    }

    try {
      const unreadNotifications = notifications.filter(n => !n.read);
      const updatePromises = unreadNotifications.map(async notification => {
        const docRef = doc(db as Firestore, 'notifications', notification.id);
        await updateDoc(docRef, { read: true });
      });
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const createNotification = async (notification: Omit<Notification, 'id' | 'read' | 'createdAt'>) => {
    if (!db) {
      console.error('Database is not initialized');
      throw new Error('Database is not initialized');
    }

    try {
      await addDoc(collection(db, 'notifications'), {
        ...notification,
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error creating notification:', error);
      throw new Error('Failed to create notification');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    if (!user || !db) return;

    try {
      // Security note: The Firestore rule must ensure the user has permission 
      // to delete this specific notification (i.e., user.uid == resource.data.userId).
      const notificationRef = doc(db, 'notifications', notificationId);
      await deleteDoc(notificationRef);
    } catch (error) {
      console.error('Error deleting notification:', error);
      // Optional: Add an Alert here if the deletion fails
    }
  };

  const deleteAllNotifications = async () => {
    if (!user || !db) {
      throw new Error('User or Database is not initialized');
    }
    
    // Safety Note: Firestore Security Rules must allow the user to delete 
    // documents where the 'userId' matches their UID.

    try {
      // 1. Get the list of IDs from the current state (this list is already filtered by user.uid)
      const deletePromises = notifications.map(async notification => {
        const docRef = doc(db as Firestore, 'notifications', notification.id);
        // 2. Schedule the deletion of the document
        await deleteDoc(docRef);
      });
      // 3. Wait for all deletions to complete
      await Promise.all(deletePromises);
      
      // The onSnapshot listener will automatically update the 'notifications' state after deletion.
    } catch (error) {
      console.error('Error deleting all notifications:', error);
      throw new Error('Failed to delete all notifications');
    }
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      isLoading,
      error,
      markAsRead,
      markAllAsRead,
      createNotification,
      deleteNotification,
      deleteAllNotifications,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
} 