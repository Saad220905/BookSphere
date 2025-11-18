
import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import { collection, onSnapshot, Firestore, query, where, addDoc, serverTimestamp, doc, deleteDoc, runTransaction, arrayUnion, Timestamp } from 'firebase/firestore';
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
import { Text } from '../../components/Themed';
import UserAvatar from '../../components/UserAvatar';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { UserProfile, getUserProfile } from '../../utils/userProfile'; // Ensure UserProfile includes favoriteGenres and friends

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
  const { user } = useAuth();
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
    }, (error) => {
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
     const unsubscribe = onSnapshot(requestsQuery, (snapshot) => {
       const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FriendRequest));
       setIncomingRequests(requests);
       setLoadingRequests(false);
     }, (error) => {
         console.error("Error fetching friend requests:", error);
         setLoadingRequests(false);
         Alert.alert("Error", "Could not fetch friend requests.");
     });
     return () => unsubscribe();
   }, [user, firestoreDb]);

   // --- Fetch Friends (using the friends array on user profile) ---
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
        // Rerun whenever the user changes, or potentially after accepting a request (though listeners might handle this)
   }, [user, firestoreDb]);


  // --- Search Logic (Filters allUsers based on genre, excluding existing friends) ---
  const searchResults = useMemo(() => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) return []; // No search results if query is empty

    const lowerCaseQuery = trimmedQuery.toLowerCase();
    const friendIds = new Set(friendsList.map(f => f.uid)); // Get IDs of current friends to exclude them

    return allUsers.filter(u =>
      !friendIds.has(u.uid) && // Exclude users who are already friends
      u.favoriteGenres?.some(genre => genre.toLowerCase().includes(lowerCaseQuery))
    );
  }, [searchQuery, allUsers, friendsList]); // Recalculate when search, allUsers, or friendsList change

  // --- Send Friend Request ---
  const handleAddFriend = async (targetUser: UserProfile) => {
    if (!user || !firestoreDb) return;

    // Optional: Prevent sending request to self (should be filtered out already, but good check)
    if (user.uid === targetUser.uid) return;

    // Optional: Check if already friends
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
                   fromUserName: user.displayName || user.email?.split('@')[0] || 'User', // Use current user's info
                   fromUserPhoto: user.photoURL || null,
                   toUserId: targetUser.uid,
                   status: 'pending',
                   createdAt: serverTimestamp(),
                 });
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
                // 1. Check if users still exist (optional but good practice)
                const senderDoc = await transaction.get(senderUserRef);
                if (!senderDoc.exists()) { throw new Error("Sender user no longer exists."); }

                // 2. Update request status to 'accepted'
                transaction.update(requestRef, { status: 'accepted' });

                // 3. Add sender to current user's friend list (using arrayUnion)
                transaction.update(currentUserRef, {
                    friends: arrayUnion(request.fromUserId)
                });

                // 4. Add current user to sender's friend list (using arrayUnion)
                transaction.update(senderUserRef, {
                    friends: arrayUnion(user.uid)
                });
            });
            Alert.alert("Friend Added!", `You are now friends with ${request.fromUserName}.`);
            // The friend list useEffect might refetch, or you could manually update state here
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
            // Option 1: Update status to 'declined' (keeps a record)
            // await updateDoc(requestRef, { status: 'declined' });

            // Option 2: Delete the request document entirely (simpler for UI)
            await deleteDoc(requestRef);
            // The listener will automatically remove it from the incomingRequests state

        } catch (error) {
            console.error("Error declining friend request:", error);
            Alert.alert("Error", "Could not decline friend request.");
        }
    };


  // Navigate to chat screen with an existing friend
  const handleChatPress = (friend: UserProfile) => {
     router.push({
      pathname: `/chat/${friend.uid}`,
      params: { otherUserName: friend.displayName || 'Chat' },
    });
  };

  // Renders a user found via search, with an 'Add Friend' button
  const renderSearchResultItem = ({ item }: { item: UserProfile }) => (
    <View style={styles.userCard}>
       <UserAvatar
        photoUrl={item.photoURL}
        displayName={item.displayName || 'Anonymous'}
        size={50}
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
        size={50}
      />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.displayName || 'Anonymous User'}</Text>
        <Text style={styles.userActionText}>Chat now</Text>
      </View>
      <FontAwesome name="chevron-right" size={20} color="#666" />
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
          onChangeText={setSearchQuery} // Update state on text change
          clearButtonMode="while-editing" // iOS clear button
          autoCapitalize="none" // Prevent auto-capitalization
        />
      </View>

      {/* Conditional List Rendering */}
      {loadingUsers || loadingRequests || loadingFriends ? ( // Show loader if any data is loading
        <ActivityIndicator style={styles.loader} size="large" color="#0a7ea4" />
      ) : searchQuery.trim() ? (
        // Show Search Results if query exists
        <FlatList
          data={searchResults}
          renderItem={renderSearchResultItem}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={styles.listContainer}
          ListHeaderComponent={<Text style={styles.listHeader}>Search Results</Text>}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              No users found matching &quot;{searchQuery}&quot;.
            </Text>
          }
        />
      ) : (
         // Show Friend Requests and Friends List if query is empty
         <FlatList
           // Combine incoming requests and friends list for the main view
           data={[...incomingRequests, ...friendsList]}
           keyExtractor={(item, index) => (item as FriendRequest).id || (item as UserProfile).uid || `item-${index}` } // Use unique ID from either type
           renderItem={({ item }) => {
               // Determine which type of item it is based on structure
               if ('status' in item && item.status === 'pending') {
                   // Render friend request if it has 'status' property
                   return renderRequestItem({ item: item as FriendRequest });
               } else {
                   // Render friend if it's a UserProfile (friend)
                   return renderFriendItem({ item: item as UserProfile });
               }
           }}
           ListHeaderComponent={() => (
                <>
                   {/* Show request header only if there are requests */}
                   {incomingRequests.length > 0 && (
                       <Text style={styles.listHeader}>Friend Requests ({incomingRequests.length})</Text>
                   )}
                   {/* Always show friends header */}
                   <Text style={[
                       styles.listHeader,
                       incomingRequests.length > 0 && { marginTop: 20 } // Add extra space if requests are shown
                   ]}>
                       Friends ({friendsList.length})
                   </Text>
                </>
           )}
           ListEmptyComponent={
                // Show specific message only if *both* requests and friends are empty
                (incomingRequests.length === 0 && friendsList.length === 0) ? (
                     <Text style={styles.emptyText}>You haven&apos;t added any friends yet. Use the search bar above!</Text>
                ) : null // Otherwise, one of the lists might be empty, but that's okay
           }
           contentContainerStyle={styles.listContainer}
         />
       )}
    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#ffffffff' }, // Lighter grey background
    header: { 
        paddingVertical: 12, 
        paddingHorizontal: 16, 
        borderBottomWidth: 1, 
        borderBottomColor: '#ffffffff',
        backgroundColor: '#060606ff', // White header
    },
    title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
    
    searchContainer: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: '#000000ff', // Changed from grey to white
        borderRadius: 12,       // Softer radius
        marginHorizontal: 16,
        marginTop: 16,
        marginBottom: 8,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#e0e0e0', // Subtle border
        // iOS Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        // Android Shadow
        elevation: 2,
    },
    searchIcon: { marginRight: 8 },
    searchInput: { 
        flex: 1, 
        height: 48, // Taller for better tap target
        fontSize: 16, 
        color: '#f8f5f5ff' 
    },
    
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContainer: { paddingHorizontal: 16, paddingBottom: 40 }, // More bottom padding

    // --- 5. Polished List Headers ---
    listHeader: { 
        fontSize: 20,       // Larger
        fontWeight: '700',  // Bolder
        color: '#0a0909ff',     // Darker
        marginTop: 24,    // More space
        marginBottom: 12,
        paddingHorizontal: 8 
    },
    
    // --- Polished Friend/Search Card ---
    userCard: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingVertical: 14, // More vertical space
        paddingHorizontal: 8,
        backgroundColor: '#96a3aaff',
        borderBottomWidth: 1, 
        borderBottomColor: '#152d1dff' // Lighter border
    },
    userInfo: { flex: 1, marginLeft: 12 },
    userName: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
    userGenres: { fontSize: 14, color: '#666' },
    userActionText: { fontSize: 14, color: '#0a7ea4', fontWeight: '500' },

    // "Add Friend" Button (in search) ---
    addButton: {
        padding: 8,
        width: 40,
        height: 40,
        borderRadius: 20, // Circular
        backgroundColor: '#e6f7ff', // Light blue background
        justifyContent: 'center',
        alignItems: 'center',
    },
    
    emptyText: { 
        textAlign: 'center', 
        marginTop: 30, 
        fontSize: 16, 
        color: '#888', // Softer grey
        paddingHorizontal: 20 
    },
    
    // --- 2.  Friend Request "Card" ---
    requestCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12, // Consistent padding
        backgroundColor: '#37364bff', // White card background
        borderRadius: 10,       // Softer radius
        marginBottom: 10,       // Space between cards
        // iOS Shadow
        shadowColor: '#282424ff',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        // Android Shadow
        elevation: 3,
        borderWidth: 1,
        borderColor: '#f0f0f0', // Very light border
    },
    requestInfo: {
        flex: 1,
        marginLeft: 10,
    },
    requestActions: {
        flexDirection: 'row',
    },

    // --- 3.  Accept/Decline Buttons ---
    requestButton: {
        marginLeft: 10,     // More space between buttons
        width: 36,          // Larger tap target
        height: 36,
        borderRadius: 18,   // Perfect circle
        justifyContent: 'center',
        alignItems: 'center',
        // iOS Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 1,
        // Android Shadow
        elevation: 2,
    },
    acceptButton: {
        backgroundColor: '#34C759', // Brighter, modern iOS green
    },
    declineButton: {
        backgroundColor: '#FF3B30', // Brighter, modern iOS red
    },
});