import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Colors } from '@/constants/colors';

interface SkeletonLoaderProps {
  count?: number;
  style?: StyleProp<ViewStyle>;
}

function SkeletonCard({ index }: { index: number }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  // Vary widths for visual interest
  const widths: `${number}%`[] = ['75%', '60%', '90%', '50%', '80%'];

  return (
    <Animated.View style={[styles.card, { opacity }]}>
      <View style={[styles.line, { width: widths[index % widths.length] }]} />
      <View style={[styles.line, styles.lineShort]} />
      <View style={[styles.line, styles.lineMedium]} />
    </Animated.View>
  );
}

export default function SkeletonLoader({ count = 3, style }: SkeletonLoaderProps) {
  return (
    <View style={style}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} index={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  line: {
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.grey100,
    marginBottom: 10,
  },
  lineShort: {
    width: '40%',
  },
  lineMedium: {
    width: '65%',
    marginBottom: 0,
  },
});
