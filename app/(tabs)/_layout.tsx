import React from 'react';
import { Animated, Easing, useColorScheme, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type IconName = React.ComponentProps<typeof FontAwesome>['name'];

interface AnimatedTabIconProps {
  name: IconName;
  focused: boolean;
  color: string;
}

const AnimatedTabIcon: React.FC<AnimatedTabIconProps> = ({ name, focused, color }) => {
  const scale = React.useRef(new Animated.Value(focused ? 1.2 : 1)).current;
  const translateY = React.useRef(new Animated.Value(focused ? -6 : 0)).current;
  const glow = focused ? '#0a7ea4' : 'transparent';

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: focused ? 1.3 : 1,
        friction: 5,
        tension: 100,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: focused ? -6 : 0,
        duration: 250,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused, scale, translateY]);

  return (
    <Animated.View
      style={[
        styles.iconWrapper,
        {
          transform: [{ scale }, { translateY }],
          shadowColor: glow,
          shadowOpacity: focused ? 0.4 : 0,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 3 },
        },
      ]}
    >
      <FontAwesome name={name} size={26} color={color} />
    </Animated.View>
  );
};

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const renderIcon = (name: IconName) => {
    const TabIcon = ({ color, focused }: { color: string; focused: boolean }) => (
      <AnimatedTabIcon name={name} focused={focused} color={focused ? '#0a7ea4' : color} />
    );
    TabIcon.displayName = `${name}-icon`;
    return TabIcon;
  };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#0a7ea4',
        tabBarInactiveTintColor: '#777',
        tabBarShowLabel: false,
        headerShown: false,
        tabBarStyle: [
          styles.tabBarBase,
          {
            backgroundColor: isDark ? 'rgba(18,18,18,0.9)' : 'rgba(255,255,255,0.9)',
            shadowColor: isDark ? '#0a7ea4' : '#000',
            bottom: insets.bottom > 0 ? 0 : 0, // Align with home indicator
            paddingBottom: 10, // internal padding
          },
        ],
      }}
    >
      <Tabs.Screen name="feed" options={{ tabBarIcon: renderIcon('home') }} />
      <Tabs.Screen name="clubs" options={{ tabBarIcon: renderIcon('book') }} />
      <Tabs.Screen name="chat" options={{ tabBarIcon: renderIcon('comments') }} />
      <Tabs.Screen name="search" options={{ tabBarIcon: renderIcon('search') }} />
      <Tabs.Screen name="profile" options={{ tabBarIcon: renderIcon('user') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarBase: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 70,
    borderRadius: 35,
    borderTopWidth: 0,
    elevation: 10,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    paddingTop: 8,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    marginBottom: 4, // nudges icons down slightly
  },
});