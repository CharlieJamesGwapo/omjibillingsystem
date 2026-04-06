import React, { useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Colors } from '@/constants/colors';

type ButtonVariant = 'primary' | 'outline' | 'destructive' | 'success';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  fullWidth = false,
}: ButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  };

  const isDisabled = disabled || loading;

  const containerStyles: ViewStyle[] = [styles.base];

  switch (variant) {
    case 'primary':
      containerStyles.push(styles.primary, styles.shadow);
      break;
    case 'outline':
      containerStyles.push(styles.outline);
      break;
    case 'destructive':
      containerStyles.push(styles.destructive);
      break;
    case 'success':
      containerStyles.push(styles.success, styles.shadow);
      break;
  }

  if (fullWidth) containerStyles.push(styles.fullWidth);
  if (isDisabled) containerStyles.push(styles.disabled);

  const textColor =
    variant === 'outline'
      ? Colors.primary
      : variant === 'destructive'
        ? Colors.error
        : Colors.surface;

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        style={containerStyles}
      >
        {loading ? (
          <ActivityIndicator color={textColor} size="small" />
        ) : (
          <Text style={[styles.text, { color: textColor }]}>{title}</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  primary: {
    backgroundColor: Colors.primary,
  },
  outline: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  destructive: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.error,
  },
  success: {
    backgroundColor: Colors.success,
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
});
