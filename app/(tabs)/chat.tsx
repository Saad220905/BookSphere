import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import { collection, onSnapshot, Firestore, query, where, addDoc, serverTimestamp, doc, deleteDoc, runTransaction, arrayUnion, arrayRemove, Timestamp, QuerySnapshot, DocumentData } from 'firebase/firestore';
import React, { useEffect, useState, useMemo } from 'react';
import {
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/Themed';
import UserAvatar from '@/components/UserAvatar';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { UserProfile, getUserProfile } from '@/utils/userProfile'; 
import { useNotifications } from '@/contexts/NotificationContext';

// Interface for Friend Request documents in Firestore
interface FriendRequest {
    id: string; // Document ID from Firestore
    fromUserId: string;
    fromUserName: string;
    fromUserPhoto?: string;
    toUserId: string;
    status: 'pending' | 'accepted' | 'declined';
    createdAt: Timestamp | null; // Use Firestore Timestamp
}

export default function ChatScreen() {
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]); // Stores all users fetched from Firestore
  const [friendsList, setFriendsList] = useState<UserProfile[]>([]); // State for actual friends
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]); // State for incoming requests
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingFriends, setLoadingFriends] = useState(true); // State for loading friends
  
  // Counter to manually trigger friend list refetch after accepting/unfriending
  const [friendsDataChangeCounter, setFriendsDataChangeCounter] = useState(0); 

  const { user } = useAuth();
  const { createNotification } = useNotifications();
  const firestoreDb = db as Firestore;

  // --- Fetch All Users (excluding self) ---
  useEffect(() => {
    if (!firestoreDb || !user) {
      setAllUsers([]);
      setLoadingUsers(false);
      return;
    }
    setLoadingUsers(true);
    const usersQuery = query(
      collection(firestoreDb, 'users'),
      where('uid', '!=', user.uid)
    );
    const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
      const usersList = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
              ...data,
              uid: doc.id,
              favoriteGenres: Array.isArray(data.favoriteGenres) ? data.favoriteGenres : [],
          } as UserProfile
      });
      setAllUsers(usersList);
      setLoadingUsers(false);
    }, (error: Error) => { 
        console.error("Error fetching users: ", error);
        setLoadingUsers(false);
        Alert.alert("Error", "Could not fetch users.");
    });
    return () => unsubscribe();
  }, [user, firestoreDb]);

  // --- Fetch Incoming Friend Requests ---
   useEffect(() => {
     if (!firestoreDb || !user) {
       setIncomingRequests([]);
       setLoadingRequests(false);
       return;
     }
     setLoadingRequests(true);
     const requestsQuery = query(
       collection(firestoreDb, 'friendRequests'),
       where('toUserId', '==', user.uid),
       where('status', '==', 'pending') // Only show pending requests
     );
       const unsubscribe = onSnapshot(requestsQuery, (snapshot: QuerySnapshot<DocumentData>) => { 
       const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FriendRequest));
       setIncomingRequests(requests);
       setLoadingRequests(false);
     }, (error: Error) => { 
         console.error("Error fetching friend requests:", error);
         setLoadingRequests(false);
         Alert.alert("Error", "Could not fetch friend requests.");
     });
     return () => unsubscribe();
   }, [user, firestoreDb]);

   // --- Fetch Friends (Triggered by friendsDataChangeCounter) ---
   useEffect(() => {
        const fetchFriends = async () => {
          if (!user || !firestoreDb) {
            setFriendsList([]);
            setLoadingFriends(false);
            return;
          }
           setLoadingFriends(true);
           try {
               // Fetch current user's profile which should contain the 'friends' array (of UIDs)
               const currentUserProfile = await getUserProfile(user.uid);
               const friendIds = currentUserProfile?.friends || []; // Ensure friends is an array

               if (friendIds.length > 0) {
                   // Fetch profile data for each friend ID
                   const friendPromises = friendIds.map(id => getUserProfile(id));
                   const friendProfiles = (await Promise.all(friendPromises)).filter(p => p !== null) as UserProfile[]; // Filter out null results if a friend profile was deleted
                   setFriendsList(friendProfiles);
               } else {
                   setFriendsList([]); // No friend IDs
               }
           } catch (error) {
                console.error("Error fetching friends list:", error);
                setFriendsList([]); // Clear list on error
           } finally {
                setLoadingFriends(false);
           }
        };
        fetchFriends();
   }, [user, firestoreDb, friendsDataChangeCounter]);


  // --- Search Logic (Filters allUsers based on genre, excluding existing friends) ---
  const searchResults = useMemo(() => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) return []; // No search results if query is empty

    const lowerCaseQuery = trimmedQuery.toLowerCase();
    const friendIds = new Set(friendsList.map(f => f.uid)); // Get IDs of current friends to exclude them

    return allUsers.filter(u =>
      !friendIds.has(u.uid) && // Exclude users who are already friends
      u.favoriteGenres?.some((genre: string) => genre.toLowerCase().includes(lowerCaseQuery))
    );
  }, [searchQuery, allUsers, friendsList]); 

  // --- Send Friend Request ---
  const handleAddFriend = async (targetUser: UserProfile) => {
    if (!user || !firestoreDb) return;

    if (user.uid === targetUser.uid) return;

     if (friendsList.some(friend => friend.uid === targetUser.uid)) {
         Alert.alert("Already Friends", `You are already friends with ${targetUser.displayName}.`);
         return;
     }

    Alert.alert(
      'Send Friend Request?',
      `Send a request to connect with ${targetUser.displayName || 'this user'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send', onPress: async () => {
             try {
                 await addDoc(collection(firestoreDb, 'friendRequests'), {
                   fromUserId: user.uid,
                   fromUserName: user.displayName || user.email?.split('@')[0] || 'User', 
                   fromUserPhoto: user.photoURL || null,
                   toUserId: targetUser.uid,
                   status: 'pending',
                   createdAt: serverTimestamp(),
                 });

                //  // --- NOTIFICATION TRIGGER ---
                //  await createNotification({
                //    type: 'friend_request',
                //    title: 'New Friend Request',
                //    message: `${user.displayName || 'User'} sent you a friend request.`,
                //    userId: targetUser.uid, // Notify the target user
                //    fromUserId: user.uid,
                //    fromUserDisplayName: user.displayName || 'User',
                //    fromUserPhotoURL: user.photoURL,
                //    targetId: user.uid, 
                //    targetType: 'chat' 
                //  });

                 Alert.alert('Request Sent!', `Friend request sent to ${targetUser.displayName || 'this user'}.`);
             } catch (error) {
                 console.error("Error sending friend request:", error);
                 Alert.alert("Error", "Could not send friend request. Please try again.");
             }
           }
        }
      ]
    );
  };

   // --- Accept Friend Request ---
    const handleAcceptRequest = async (request: FriendRequest) => {
        if (!user || !firestoreDb) return;
        const requestRef = doc(firestoreDb, 'friendRequests', request.id);
        const currentUserRef = doc(firestoreDb, 'users', user.uid);
        const senderUserRef = doc(firestoreDb, 'users', request.fromUserId);

        try {
            await runTransaction(firestoreDb, async (transaction) => {
                const senderDoc = await transaction.get(senderUserRef);
                if (!senderDoc.exists()) { 
                    transaction.delete(requestRef); 
                    throw new Error("Sender user no longer exists."); 
                }

                transaction.delete(requestRef); 

                transaction.update(currentUserRef, {
                    friends: arrayUnion(request.fromUserId)
                });

                transaction.update(senderUserRef, {
                    friends: arrayUnion(user.uid)
                });
            });
            Alert.alert("Friend Added!", `You are now friends with ${request.fromUserName}.`);
            setFriendsDataChangeCounter(c => c + 1);

        } 
        catch (error) {
            console.error("Error accepting friend request:", error);
            Alert.alert("Error", "Could not accept friend request.");
        }
    };

    // --- Decline Friend Request ---
    const handleDeclineRequest = async (requestId: string) => {
        if (!firestoreDb) return;
        const requestRef = doc(firestoreDb, 'friendRequests', requestId);
        try {
            await deleteDoc(requestRef);
        } catch (error) {
            console.error("Error declining friend request:", error);
            Alert.alert("Error", "Could not decline friend request.");
        }
    };

    // --- Unfriend a Friend ---
    const handleUnfriend = (friend: UserProfile) => {
      if (!user || !firestoreDb) return;

      Alert.alert(
        'Unfriend?',
        `Are you sure you want to unfriend ${friend.displayName || 'this user'}? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unfriend', 
            style: 'destructive', 
            onPress: async () => {
              const currentUserRef = doc(firestoreDb, 'users', user.uid);
              const friendUserRef = doc(firestoreDb, 'users', friend.uid);

              try {
                await runTransaction(firestoreDb, async (transaction) => {
                  transaction.update(currentUserRef, {
                    friends: arrayRemove(friend.uid)
                  });

                  transaction.update(friendUserRef, {
                    friends: arrayRemove(user.uid)
                  });
                });
                Alert.alert("Unfriended", `${friend.displayName || 'User'} has been removed from your friends list.`);
                setFriendsDataChangeCounter(c => c + 1);

              } catch (error) {
                console.error("Error unfriending:", error);
                Alert.alert("Error", "Could not unfriend user.");
              }
            }
          }
        ]
      );
    };

  // Navigate to chat screen with an existing friend
  const handleChatPress = (friend: UserProfile) => {
     router.push({
      pathname: `/chat/${friend.uid}`,
      params: { otherUserName: friend.displayName || 'Chat' },
    });
  };

  // --- Handle Options Menu (3 Dots) ---
  const handleFriendOptions = (friend: UserProfile) => {
    Alert.alert(
      friend.displayName || 'Options',
      'Choose an action',
      [
        {
          text: 'View Profile',
          onPress: () => {
             // Navigate to the profile page of the friend
             router.push(`/profile/${friend.uid}`);
          }
        },
        {
          text: 'Unfriend',
          style: 'destructive',
          onPress: () => handleUnfriend(friend) // Triggers the confirmation alert
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  // Renders a user found via search, with an 'Add Friend' button
  const renderSearchResultItem = ({ item }: { item: UserProfile }) => (
    <View style={styles.userCard}>
       <UserAvatar
        photoUrl={item.photoURL}
        displayName={item.displayName || 'Anonymous'}
        size={65}
      />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.displayName || 'Anonymous User'}</Text>
        <Text style={styles.userGenres} numberOfLines={1}>
          Genres: {item.favoriteGenres?.join(', ') || 'Not set'}
        </Text>
      </View>
      <TouchableOpacity onPress={() => handleAddFriend(item)} style={styles.addButton}>
        <FontAwesome name="user-plus" size={24} color="#0a7ea4" />
      </TouchableOpacity>
    </View>
  );

  // Renders a user from the actual friends list
  const renderFriendItem = ({ item }: { item: UserProfile }) => (
    <TouchableOpacity
      style={styles.userCard}
      onPress={() => handleChatPress(item)} // Navigate to chat on press
    >
      <UserAvatar
        photoUrl={item.photoURL}
        displayName={item.displayName || 'Anonymous'}
        size={70}
      />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.displayName || 'Anonymous User'}</Text>
        <Text style={styles.userActionText}>Chat now</Text>
      </View>
      
      {/* Options Menu (3 dots) */}
      <TouchableOpacity 
        onPress={() => handleFriendOptions(item)} 
        style={styles.optionsButton}
      >
        <FontAwesome name="ellipsis-v" size={20} color="#666" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

   // Renders an Incoming Friend Request Item
    const renderRequestItem = ({ item }: { item: FriendRequest }) => (
        <View style={styles.requestCard}>
            <UserAvatar
                photoUrl={item.fromUserPhoto}
                displayName={item.fromUserName || 'User'}
                size={40}
            />
            <View style={styles.requestInfo}>
                <Text style={styles.userName}>{item.fromUserName || 'User'} wants to connect.</Text>
            </View>
            <View style={styles.requestActions}>
                <TouchableOpacity onPress={() => handleAcceptRequest(item)} style={[styles.requestButton, styles.acceptButton]}>
                    <FontAwesome name="check" size={18} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeclineRequest(item.id)} style={[styles.requestButton, styles.declineButton]}>
                     <FontAwesome name="times" size={18} color="#fff" />
                </TouchableOpacity>
            </View>
        </View>
    );

  // --- Main Return ---
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}> Chat </Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
         <FontAwesome name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search users by favorite genre..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery} 
          clearButtonMode="while-editing" 
          autoCapitalize="none" 
        />
      </View>

      {/* Conditional List Rendering */}
      {loadingUsers || loadingRequests || loadingFriends ? ( 
        <ActivityIndicator style={styles.loader} size="large" color="#0a7ea4" />
      ) : searchQuery.trim() ? (
        // Show Search Results if query exists
        <FlatList
          data={searchResults}
          renderItem={renderSearchResultItem}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={styles.listContainer}
          ListHeaderComponent={<Text style={styles.listHeader}>Search Results</Text>}
          ListEmptyComponent={<Text style={styles.emptyText}>No users found matching "{searchQuery}".</Text>}
        />
      ) : (
         // Show Friend Requests and Friends List if query is empty
         <FlatList
           data={[...incomingRequests, ...friendsList]}
           keyExtractor={(item, index) => ('status' in item ? (item as FriendRequest).id : (item as UserProfile).uid) || `item-${index}` } 
           renderItem={({ item }) => {
               if ('status' in item && item.status === 'pending') {
                   return renderRequestItem({ item: item as FriendRequest });
               } else {
                   return renderFriendItem({ item: item as UserProfile });
               }
           }}
           ListHeaderComponent={() => (
                <>
                   {incomingRequests.length > 0 && (
                       <Text style={styles.listHeader}>Friend Requests ({incomingRequests.length})</Text>
                   )}
                   <Text style={[
                       styles.listHeader,
                       incomingRequests.length > 0 && { marginTop: 20 } 
                   ]}>
                       Friends ({friendsList.length})
                   </Text>
                </>
           )}
           ListEmptyComponent={
                (incomingRequests.length === 0 && friendsList.length === 0) ? (
                     <Text style={styles.emptyText}>You haven't added any friends yet. Use the search bar above!</Text>
                ) : null 
           }
           contentContainerStyle={styles.listContainer}
         />
       )}
    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: '#F2F4F6' 
    }, 
    header: { 
        paddingVertical: 16, 
        paddingHorizontal: 20, 
        backgroundColor: '#FFFFFF', 
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5EA',
    },
    title: { 
        fontSize: 28, 
        fontWeight: '800', 
        color: '#1C1C1E',
        textAlign: 'left'
    },
    
    searchContainer: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: '#FFFFFF', 
        borderRadius: 12,       
        marginHorizontal: 16,
        marginTop: 16,
        marginBottom: 12,
        paddingHorizontal: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    searchIcon: { marginRight: 10 },
    searchInput: { 
        flex: 1, 
        height: 48, 
        fontSize: 16, 
        color: '#333' 
    },
    
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContainer: { 
        paddingHorizontal: 16, 
        paddingBottom: 40,
        paddingTop: 8
    },

    listHeader: { 
        fontSize: 18,       
        fontWeight: '700',  
        color: '#666',     
        marginTop: 16,    
        marginBottom: 12,
        marginLeft: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    
    userCard: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingVertical: 16, 
        paddingHorizontal: 16,
        backgroundColor: '#FFFFFF', 
        borderRadius: 16, 
        marginBottom: 12, 
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
    },
    userInfo: { flex: 1, marginLeft: 16 },
    userName: { 
        fontSize: 16, 
        fontWeight: '700', 
        color: '#1C1C1E',
        marginBottom: 4 
    },
    userGenres: { fontSize: 13, color: '#8E8E93' },
    userActionText: { 
        fontSize: 13, 
        color: '#0a7ea4', 
        fontWeight: '600',
        marginTop: 2
    },

    addButton: {
        padding: 10,
        borderRadius: 20, 
        backgroundColor: '#F0F8FF', 
        justifyContent: 'center',
        alignItems: 'center',
    },
    optionsButton: {
        padding: 8,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        width: 40,
        backgroundColor: '#F9F9F9', 
    },
    
    emptyText: { 
        textAlign: 'center', 
        marginTop: 40, 
        fontSize: 16, 
        color: '#999', 
        paddingHorizontal: 40,
        lineHeight: 24
    },
    
    requestCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16, 
        backgroundColor: '#FFFFFF', 
        borderRadius: 16,       
        marginBottom: 12,       
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
        borderLeftWidth: 4, 
        borderLeftColor: '#0a7ea4' 
    },
    requestInfo: {
        flex: 1,
        marginLeft: 14,
    },
    requestActions: {
        flexDirection: 'row',
        gap: 8
    },

    requestButton: {
        width: 36,          
        height: 36,
        borderRadius: 18,   
        justifyContent: 'center',
        alignItems: 'center',
    },
    acceptButton: {
        backgroundColor: '#0fff87ff', 
    },
    declineButton: {
        backgroundColor: '#ff0000ff', 
    },
});
