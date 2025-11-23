import { FontAwesome } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../../components/Themed';
import UserAvatar from '../../components/UserAvatar';
import { db } from '../../config/firebase'; 

// --- Interface Definitions ---
interface FriendProfile {
    uid: string;
    displayName: string;
    photoURL?: string;
    bio?: string;
}

export default function FriendsListScreen() {
    const params = useLocalSearchParams();
    const friendUids: string[] = React.useMemo(() => {
        const uidsParam = params.uids;
        if (!uidsParam) return [];
        
        try {
            const parsed = JSON.parse(uidsParam as string);
            return Array.isArray(parsed) ? parsed : [uidsParam as string];
        } catch (e) {
            return [uidsParam as string];
        }
    }, [params.uids]);


    const [friendsListDetails, setFriendsListDetails] = useState<FriendProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // --- Data Loading Logic ---
    const loadFriendsList = useCallback(async () => {
        if (friendUids.length === 0 || !db) {
            setFriendsListDetails([]);
            setIsLoading(false);
            return;
        }
        
        setIsLoading(true);

        const firestoreInstance = db;
        try {
            const friendPromises = friendUids.map(uid => 
                getDoc(doc(firestoreInstance, 'users', uid)).then(docSnap => { 
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        return { 
                            uid: docSnap.id, 
                            displayName: data.displayName, 
                            photoURL: data.photoURL,
                            bio: data.bio, 
                        } as FriendProfile;
                    }
                    return null;
                })
            );

            const friends = (await Promise.all(friendPromises)).filter((p): p is FriendProfile => p !== null);
            setFriendsListDetails(friends);

        } catch (error) {
            console.error("Error loading friends list details:", error);
            setFriendsListDetails([]);
        } finally {
            setIsLoading(false);
        }
    }, [friendUids]);

    useEffect(() => {
        loadFriendsList();
    }, [loadFriendsList]);

    const handleFriendTap = (friendId: string) => {
        router.push(`/profile/${friendId}`);
    };

    // --- Handle Chat Navigation ---
    const handleChatPress = (friend: FriendProfile) => {
        router.push({
            pathname: `/chat/${friend.uid}`,
            params: { otherUserName: friend.displayName }
        });
    };

    // --- Render Friend List Item ---
    const renderFriendItem = ({ item }: { item: FriendProfile }) => (
        <TouchableOpacity 
            style={styles.friendCard}
            onPress={() => handleFriendTap(item.uid)} 
        >
            <UserAvatar
                photoUrl={item.photoURL || undefined}
                displayName={item.displayName}
                size={50}
            />
            <View style={styles.friendInfo}>
                <Text style={styles.friendName}>{item.displayName || 'Anonymous User'}</Text>
                <Text style={styles.friendBio} numberOfLines={1}>
                    {item.bio || "No bio set."} 
                </Text> 
            </View>
            
            {/* Dedicated Chat Button */}
            <TouchableOpacity 
                style={styles.chatButton}
                onPress={(e) => {
                    e.stopPropagation(); 
                    handleChatPress(item);
                }}
            >
                <FontAwesome name="comment" size={20} color="#0a7ea4" />
            </TouchableOpacity>
        </TouchableOpacity>
    );
    
    return (
        <SafeAreaView style={styles.container}>
            <View style={[styles.header, styles.friendsHeader]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <FontAwesome name="arrow-left" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.title}>Your Friends ({friendUids.length})</Text>
                <View style={styles.spacer} />
            </View>

            {isLoading ? (
                <ActivityIndicator style={styles.loadingIndicator} size="large" color="#0a7ea4" />
            ) : (
                <FlatList
                    data={friendsListDetails}
                    renderItem={renderFriendItem}
                    keyExtractor={(item) => item.uid}
                    contentContainerStyle={styles.friendsListContent}
                    ListEmptyComponent={() => (
                        <View style={styles.emptyList}>
                            <Text style={styles.emptyText}>You haven't added any friends yet.</Text>
                        </View>
                    )}
                />
            )}
        </SafeAreaView>
    );
}


const styles = StyleSheet.create({
    container: { 
	    flex: 1, 
		backgroundColor: '#fff' 
	},
    header: { 
		alignItems: 'center', 
		flexDirection: 'row', 
		justifyContent: 'space-between', 
		padding: 16 
	},
    friendsHeader: { 
		justifyContent: 'flex-start', 
		gap: 15 
	},
    title: { 
		fontSize: 24, 
		fontWeight: 'bold' 
	},
    backButton: { 
		marginRight: 10 
	},
    spacer: { 
		flex: 1 
	},
    loadingIndicator: { 
		flex: 1, 
		justifyContent: 'center' 
	},
    emptyList: { 
		padding: 20, 
		alignItems: 'center', 
		justifyContent: 'center', 
		minHeight: 100 
	},
    emptyText: { 
		textAlign: 'center', 
		color: '#666', 
		fontSize: 16 
	},
    friendsListContent: { 
		paddingHorizontal: 16, 
		paddingTop: 10, 
		paddingBottom: 40 
	},
    friendCard: { 
       	flexDirection: 'row',
       	alignItems: 'center',
       	paddingVertical: 12,
       	paddingHorizontal: 5,
       	borderBottomWidth: 1,
       	borderBottomColor: '#eee',
    },
    friendInfo: { 
		flex: 1, 
		marginLeft: 12 
	},
    friendName: { 
		fontSize: 16, 
		fontWeight: '600' 
	},
    friendBio: { 
		fontSize: 14, 
		color: '#666' 
	},
    chatButton: { 
       	paddingHorizontal: 10,
       	paddingVertical: 5,
    },
});