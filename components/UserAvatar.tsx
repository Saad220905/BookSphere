import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { colors, typography } from '../constants/theme';
import { Text } from './Themed';

interface UserAvatarProps {
  photoUrl?: string;
  displayName: string;
  size?: number;
  onPress?: () => void;
}

export default function UserAvatar({ photoUrl, displayName, size = 40, onPress }: UserAvatarProps) {
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container style={[styles.container, { width: size, height: size }]}>
      {photoUrl ? (
        <Image
          source={{ uri: photoUrl }}
          style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
        />
      ) : (
        <View style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={styles.initials}>{initials}</Text>
        </View>
      )}
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    borderRadius: 9999,
  },
  initials: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
  },
  placeholder: {
    alignItems: 'center',
    backgroundColor: '#0a7ea4',
    borderRadius: 9999,
    justifyContent: 'center',
  },
}); 
