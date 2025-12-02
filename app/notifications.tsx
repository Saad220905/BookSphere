import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useContext } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../components/Themed';
import { useNotifications } from '../contexts/NotificationContext';
import UserAvatar from '../components/UserAvatar';
import { Alert } from 'react-native';

const formatTime = (timestamp: any): string => {
    if (!timestamp) return 'Just now';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (date >= today) {
        return `Today at ${timeString}`; 
    }
    
    if (date >= yesterday) {
        return `Yesterday at ${timeString}`;
    }

    return date.toLocaleDateString([], { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
};


export default function NotificationScreen() {
    const { 
        notifications, 
        unreadCount, 
        isLoading, 
        markAsRead, 
        markAllAsRead,
        deleteNotification,
        deleteAllNotifications,
    } = useNotifications();

    const handleDeleteAllPress = () => {
        if (notifications.length === 0) return;

        Alert.alert(
            "Delete All Notifications?",
            "This will permanently remove all notifications from your feed.",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Delete All", 
                    style: "destructive", 
                    onPress: deleteAllNotifications
                },
            ]
        );
    };

    const handleDeletePress = (notificationId: string, title: string) => {
        Alert.alert(
            "Delete Notification?",
            `Are you sure you want to delete the notification: "${title}"?`,
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Delete", 
                    style: "destructive", 
                    onPress: () => deleteNotification(notificationId) 
                },
            ]
        );
    };

    const handleNotificationPress = async (notification: any) => {
        if (!notification.read) {
            await markAsRead(notification.id);
        }
        console.log(`Notification pressed: ${notification.title}`);
    };

    const renderNotificationItem = ({ item }: { item: any }) => {
        let iconName: keyof typeof FontAwesome.glyphMap = 'bell';
        let iconColor = '#0a7ea4';
        
        if (item.type === 'like') { iconName = 'heart'; iconColor = '#ff4444'; }
        if (item.type === 'comment') { iconName = 'comment'; iconColor = '#ff9900'; }
        if (item.type === 'new_recommendation') { iconName = 'book'; iconColor = '#0a7ea4'; }
        if (item.type === 'club_invite') { iconName = 'group'; iconColor = '#34c759'; }
        
        const isUnread = !item.read;

        return (
            <TouchableOpacity 
                style={[styles.card, isUnread && styles.unreadCard]}
                onPress={() => handleNotificationPress(item)}
            >
                <View style={styles.iconContainer}>
                    <FontAwesome name={iconName} size={20} color={iconColor} />
                </View>
                
                {item.fromUserPhotoURL && (
                    <UserAvatar
                        photoUrl={item.fromUserPhotoURL}
                        displayName={item.fromUserDisplayName || item.title}
                        size={35}
                    />
                )}

                <View style={styles.content}>
                    <Text style={styles.titleText}>{item.title}</Text>
                    <Text style={styles.messageText}>{item.message}</Text>
                    <Text style={styles.timeText}>{formatTime(item.createdAt)}</Text>
                </View>

                <TouchableOpacity 
                    onPress={() => handleDeletePress(item.id, item.title)}
                    style={styles.deleteButton}
                >
                    <FontAwesome name="times-circle" size={24} color="#ff3b30" />
                </TouchableOpacity>

                {isUnread && <View style={styles.unreadDot} />}
            </TouchableOpacity>
        );
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator style={styles.loadingIndicator} size="large" color="#0a7ea4" />
            </SafeAreaView>
        );
    }
    
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <FontAwesome name="arrow-left" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notifications ({unreadCount})</Text>
                
                {notifications.length > 0 && (
                    <TouchableOpacity 
                        style={styles.markAllButton} 
                        onPress={markAllAsRead}
                        disabled={unreadCount === 0}
                    >
                        <Text style={[styles.markAllText, unreadCount === 0 && { color: '#ccc' }]}>
                            Mark All Read
                        </Text>
                    </TouchableOpacity>
                )}

                {notifications.length > 0 && (
                        <TouchableOpacity 
                            style={styles.deleteButtonHeader} 
                            onPress={handleDeleteAllPress}
                        >
                            <FontAwesome name="trash" size={20} color="#ff3b30" />
                        </TouchableOpacity>
                    )}
            </View>

            <FlatList
                data={notifications}
                keyExtractor={(item) => item.id}
                renderItem={renderNotificationItem}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={() => (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>You're all caught up! No new notifications.</Text>
                    </View>
                )}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: '#fff' 
    },
    loadingIndicator: { 
        flex: 1, 
        justifyContent: 'center' 
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    headerTitle: { 
        fontSize: 20, 
        fontWeight: 'bold', 
        marginLeft: 15, 
        flex: 1 
    },
    headerActions: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 10,
    },
    markAllButton: { 
        padding: 5 
    },
    markAllText: { 
        color: '#0a7ea4', 
        fontWeight: '600', 
        fontSize: 14 
    },
    deleteButtonHeader: { 
        padding: 5 
    },
    listContent: { 
        padding: 10 
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    unreadCard: {
        backgroundColor: '#f0f8ff',
        borderColor: '#0a7ea4',
        borderLeftWidth: 4,
    },
    iconContainer: { 
        width: 30, 
        height: 30, 
        justifyContent: 'center', 
        alignItems: 'center', 
        marginRight: 10 
    },
    avatar: { 
        marginRight: 10 
    },
    content: { 
        flex: 1 
    },
    titleText: { 
        fontSize: 15, 
        fontWeight: '600', 
        color: '#333', 
        marginBottom: 2 
    },
    messageText: { 
        fontSize: 14, 
        color: '#666', 
        lineHeight: 18 
    },
    timeText: { 
        fontSize: 12, 
        color: '#aaa', 
        marginTop: 4, 
        textAlign: 'right' 
    },
    deleteButton: { 
        marginLeft: 10,
        padding: 5,
    },
    unreadDot: { 
        width: 8, 
        height: 8, 
        borderRadius: 4, 
        backgroundColor: '#ff4444', 
        marginLeft: 10 
    },
    emptyContainer: { 
        padding: 30, 
        alignItems: 'center' 
    },
    emptyText: { 
        fontSize: 16, 
        color: '#888', 
        textAlign: 'center' 
    },
});