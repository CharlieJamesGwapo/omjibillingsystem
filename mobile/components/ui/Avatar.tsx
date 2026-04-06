import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';

const AVATAR_COLORS = [
  '#E53935',
  '#8E24AA',
  '#3949AB',
  '#00897B',
  '#43A047',
  '#F4511E',
  '#6D4C41',
  '#546E7A',
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase();
}

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

interface AvatarProps {
  name: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export default function Avatar({ name, size = 44, style }: AvatarProps) {
  const color = AVATAR_COLORS[hashName(name) % AVATAR_COLORS.length];
  const initials = getInitials(name);
  const fontSize = size * 0.38;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    >
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
