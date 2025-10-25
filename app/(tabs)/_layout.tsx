import React from 'react';


import { FontAwesome } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#0a7ea4',
        tabBarInactiveTintColor: '#666',
        tabBarStyle: {
          backgroundColor: colorScheme === 'dark' ? '#000' : '#fff',
          borderTopColor: colorScheme === 'dark' ? '#333' : '#eee',
        },
        headerStyle: {
          backgroundColor: colorScheme === 'dark' ? '#000' : '#fff',
        },
        headerTintColor: colorScheme === 'dark' ? '#fff' : '#000',
      }}>
      <Tabs.Screen
        name="feed"
        options={{
          headerShown: false,
          tabBarIcon: ({ color }) => <FontAwesome name="home" size={24} color={color} />,
          tabBarLabel: 'Feed',
        }}
      />
      <Tabs.Screen
        name="clubs"
        options={{
          headerShown: false,
          tabBarIcon: ({ color }) => <FontAwesome name="book" size={24} color={color} />,
          tabBarLabel: 'Clubs',
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          headerShown: false,
          tabBarIcon: ({ color }) => <FontAwesome name="comments" size={24} color={color} />,
          tabBarLabel: 'Chat',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          headerShown: false,
          tabBarIcon: ({ color }) => <FontAwesome name="user" size={24} color={color} />,
          tabBarLabel: 'Profile',
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          headerShown: false,
          tabBarIcon: ({ color }) => <FontAwesome name="user" size={24} color={color} />,
          tabBarLabel: 'Search',
        }}
      />
    </Tabs>
  );
}
