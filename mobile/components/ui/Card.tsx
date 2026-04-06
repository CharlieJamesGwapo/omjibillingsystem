import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Colors } from '@/constants/colors';

interface CardProps {
  children: React.ReactNode;
  borderColor?: string;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

export default function Card({ children, borderColor, style, onPress }: CardProps) {
  const cardStyle: ViewStyle[] = [
    styles.card,
    borderColor ? { borderLeftWidth: 4, borderLeftColor: borderColor } : {},
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        style={[cardStyle, style]}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[cardStyle, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
});
