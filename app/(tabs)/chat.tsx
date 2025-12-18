import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import { 
  collection, onSnapshot, Firestore, query, where, addDoc, 
  serverTimestamp, doc, deleteDoc, runTransaction, arrayUnion, 
  arrayRemove, Timestamp 
} from 'firebase/firestore';
import React, { useEffect, useState, useMemo } from 'react';
import {
  FlatList, StyleSheet, TextInput, TouchableOpacity, View, 
  ActivityIndicator, Alert, StatusBar, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/Themed';
import UserAvatar from '@/components/UserAvatar';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { UserProfile, getUserProfile } from '@/utils/userProfile'; 
import { useNotifications } from '@/contexts/NotificationContext';

// --- Interfaces ---
interface FriendRequest {
    id: string;
    fromUserId: string;
    fromUserName: string;
    fromUserPhoto?: string;
    toUserId: string;
    status: 'pending' | 'accepted' | 'declined';
    createdAt: Timestamp | null;
}

export default function ChatScreen() {
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [friendsList, setFriendsList] = useState<UserProfile[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [friendsDataChangeCounter, setFriendsDataChangeCounter] = useState(0); 

  const { user } = useAuth();
  const { createNotification } = useNotifications();
  const firestoreDb = db as Firestore;

  // --- Data Fetching Logic ---
  useEffect(() => {
    if (!firestoreDb || !user) return;
    const usersQuery = query(collection(firestoreDb, 'users'), where('uid', '!=', user.uid));
    const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
      const usersList = snapshot.docs.map(doc => ({
          ...doc.data(),
          uid: doc.id,
          favoriteGenres: Array.isArray(doc.data().favoriteGenres) ? doc.data().favoriteGenres : [],
      } as UserProfile));
      setAllUsers(usersList);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
     if (!firestoreDb || !user) return;
     const requestsQuery = query(collection(firestoreDb, 'friendRequests'), where('toUserId', '==', user.uid), where('status', '==', 'pending'));
     const unsubscribe = onSnapshot(requestsQuery, (snapshot) => { 
       setIncomingRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FriendRequest)));
     });
     return () => unsubscribe();
   }, [user]);

   useEffect(() => {
        const fetchFriends = async () => {
          if (!user) return;
           try {
               const currentUserProfile = await getUserProfile(user.uid);
               const friendIds = currentUserProfile?.friends || [];
               if (friendIds.length > 0) {
                   const friendPromises = friendIds.map(id => getUserProfile(id));
                   const friendProfiles = (await Promise.all(friendPromises)).filter(p => p !== null) as UserProfile[];
                   setFriendsList(friendProfiles);
               } else { setFriendsList([]); }
           } finally { setLoading(false); }
        };
        fetchFriends();
   }, [user, friendsDataChangeCounter]);

  const searchResults = useMemo(() => {
    const trimmedQuery = searchQuery.trim().toLowerCase();
    if (!trimmedQuery) return [];
    const friendIds = new Set(friendsList.map(f => f.uid));
    return allUsers.filter(u =>
      !friendIds.has(u.uid) && 
      u.favoriteGenres?.some((genre: string) => genre.toLowerCase().includes(trimmedQuery))
    );
  }, [searchQuery, allUsers, friendsList]); 

  // --- Handlers ---
  const handleAddFriend = async (targetUser: UserProfile) => {
    if (!user) return;
    Alert.alert('Send Request', `Want to connect with ${targetUser.displayName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send', onPress: async () => {
          await addDoc(collection(firestoreDb, 'friendRequests'), {
            fromUserId: user.uid, fromUserName: user.displayName || 'User', 
            fromUserPhoto: user.photoURL || null, toUserId: targetUser.uid,
            status: 'pending', createdAt: serverTimestamp(),
          });
          await createNotification({
            type: 'friend_request', title: 'New Request', message: `${user.displayName} sent a request!`,
            userId: targetUser.uid, fromUserId: user.uid, fromUserDisplayName: user.displayName || 'User',
            fromUserPhotoURL: user.photoURL, targetId: user.uid, 
          });
      }}
    ]);
  };

  const handleAcceptRequest = async (request: FriendRequest) => {
    if (!user) return;
    await runTransaction(firestoreDb, async (transaction) => {
        transaction.delete(doc(firestoreDb, 'friendRequests', request.id));
        transaction.update(doc(firestoreDb, 'users', user.uid), { friends: arrayUnion(request.fromUserId) });
        transaction.update(doc(firestoreDb, 'users', request.fromUserId), { friends: arrayUnion(user.uid) });
    });
    setFriendsDataChangeCounter(c => c + 1);
  };

  const handleDeclineRequest = async (id: string) => {
    await deleteDoc(doc(firestoreDb, 'friendRequests', id));
  };

  const handleFriendOptions = (friend: UserProfile) => {
    Alert.alert(friend.displayName || 'User', 'Select action', [
      { text: 'View Profile', onPress: () => router.push(`/profile/${friend.uid}`) },
      { text: 'Unfriend', style: 'destructive', onPress: async () => {
          await runTransaction(firestoreDb, async (t) => {
            t.update(doc(firestoreDb, 'users', user!.uid), { friends: arrayRemove(friend.uid) });
            t.update(doc(firestoreDb, 'users', friend.uid), { friends: arrayRemove(user!.uid) });
          });
          setFriendsDataChangeCounter(c => c + 1);
      }},
      { text: 'Cancel', style: 'cancel' }
    ]);
  };

  // --- Renders ---
  const renderSearchResultItem = ({ item }: { item: UserProfile }) => (
    <View style={[styles.mainFriendCard, styles.discoveryCard]}>
      <View style={styles.avatarGlow}>
        <UserAvatar photoUrl={item.photoURL} displayName={item.displayName || 'U'} size={55} />
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.friendName}>{item.displayName}</Text>
        <View style={styles.tagContainer}>
           {item.favoriteGenres?.slice(0, 2).map((g, i) => (
             <View key={i} style={styles.genreTag}><Text style={styles.genreTagText}>{g}</Text></View>
           ))}
        </View>
      </View>
      <TouchableOpacity onPress={() => handleAddFriend(item)} style={styles.actionIconButton}>
        <FontAwesome name="plus-circle" size={30} color="#6366f1" />
      </TouchableOpacity>
    </View>
  );

  const renderFriendItem = ({ item }: { item: UserProfile }) => (
    <TouchableOpacity 
      activeOpacity={0.7}
      style={styles.mainFriendCard} 
      onPress={() => router.push({ pathname: `/chat/${item.uid}`, params: { otherUserName: item.displayName }})}
    >
      <View style={styles.avatarGlow}>
        <UserAvatar photoUrl={item.photoURL} displayName={item.displayName || 'U'} size={60} />
        <View style={styles.onlineStatus} />
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.friendName}>{item.displayName}</Text>
        <Text style={styles.lastMessage} numberOfLines={1}>Tap to open conversation</Text>
      </View>
      <TouchableOpacity onPress={() => handleFriendOptions(item)} style={styles.moreButton}>
        <FontAwesome name="chevron-right" size={14} color="#CBD5E1" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderRequestItem = ({ item }: { item: FriendRequest }) => (
    <View style={styles.requestCard}>
        <UserAvatar photoUrl={item.fromUserPhoto} displayName={item.fromUserName} size={45} />
        <View style={styles.userInfo}>
            <Text style={styles.requestName}>{item.fromUserName}</Text>
            <Text style={styles.requestSubtext}>New Friend Request</Text>
        </View>
        <View style={styles.requestActions}>
            <TouchableOpacity onPress={() => handleAcceptRequest(item)} style={[styles.requestButton, styles.acceptButton]}>
                <FontAwesome name="check" size={16} color="#6366f1" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDeclineRequest(item.id)} style={[styles.requestButton, styles.declineButton]}>
                 <FontAwesome name="times" size={16} color="#FFF" />
            </TouchableOpacity>
        </View>
    </View>
  );

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.welcomeText}>CONNECT &</Text>
            <Text style={styles.title}>Chat</Text> 
            
          </View>
          <TouchableOpacity style={styles.headerIcon} onPress={() => router.push('/profile')}>
            <UserAvatar photoUrl={user?.photoURL} displayName={user?.displayName || 'Me'} size={44} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchWrapper}>
          <View style={styles.searchGradient}>
            <FontAwesome name="search" size={18} color="#6366f1" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by favorite genre..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery} 
            />
          </View>
        </View>

        {loading ? (
            <ActivityIndicator style={{marginTop: 50}} color="#6366f1" size="large" />
        ) : (
            <FlatList
              data={searchQuery.trim() ? searchResults : [...incomingRequests, ...friendsList]}
              keyExtractor={(item, index) => ('uid' in item ? item.uid : item.id)}
              renderItem={({ item }) => 'status' in item ? renderRequestItem({ item }) : ('uid' in item ? (searchQuery.trim() ? renderSearchResultItem({ item: item as UserProfile }) : renderFriendItem({ item: item as UserProfile })) : null)}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={() => (
                <Text style={styles.sectionTitle}>
                  {searchQuery.trim() ? "People you might like" : "Conversations"}
                </Text>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>Nothing here yet. Try searching for a genre!</Text>}
            />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC', 
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 15,
  },
  welcomeText: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '800',
    letterSpacing: 2,
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: -2,
  },
  headerIcon: {
    padding: 2,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#6366f1',
  },
  searchWrapper: {
    paddingHorizontal: 20,
    marginVertical: 20,
  },
  searchGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 20,
    height: 64,
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  searchInput: {
    flex: 1,
    marginLeft: 15,
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 15,
    marginLeft: 4,
  },
  mainFriendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 14,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 15,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  discoveryCard: {
    borderLeftWidth: 6,
    borderLeftColor: '#6366f1',
  },
  avatarGlow: {
    padding: 2,
    backgroundColor: '#F8FAFC',
    borderRadius: 22,
    position: 'relative',
  },
  onlineStatus: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: '#22C55E',
    borderWidth: 3,
    borderColor: '#FFF',
  },
  userInfo: {
    flex: 1,
    marginLeft: 16,
  },
  friendName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  lastMessage: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  moreButton: {
    backgroundColor: '#F1F5F9',
    width: 30,
    height: 30,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagContainer: {
    flexDirection: 'row',
    marginTop: 6,
  },
  genreTag: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginRight: 6,
  },
  genreTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6366f1',
    textTransform: 'uppercase',
  },
  actionIconButton: {
    padding: 4,
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    borderRadius: 28,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#6366f1",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  requestName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
  requestSubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 10,
  },
  requestButton: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
  },
  acceptButton: {
    backgroundColor: '#FFF',
  },
  declineButton: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 60,
    fontSize: 15,
    color: '#94A3B8',
    lineHeight: 22,
  }
});
