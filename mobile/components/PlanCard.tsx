import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/colors';
import Badge from '@/components/ui/Badge';
import { formatDate } from '@/utils/format';
import { ViewStyle, StyleProp } from 'react-native';

interface PlanCardProps {
  plan: {
    name: string;
    speed_mbps: number;
    price: number;
  };
  subscription: {
    status: 'active' | 'pending' | 'overdue' | 'suspended' | 'inactive';
    next_due_date: string;
  };
  style?: StyleProp<ViewStyle>;
}

export default function PlanCard({ plan, subscription, style }: PlanCardProps) {
  return (
    <LinearGradient
      colors={['#CC0000', '#990000']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.gradient, style]}
    >
      <View style={styles.topRow}>
        <Text style={styles.planName}>{plan.name}</Text>
        <View style={styles.badgeWrapper}>
          <Badge status={subscription.status} />
        </View>
      </View>

      <Text style={styles.speed}>{plan.speed_mbps} Mbps</Text>

      <View style={styles.bottomRow}>
        <Text style={styles.price}>
          ₱{plan.price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}/mo
        </Text>
        <Text style={styles.dueDate}>
          Next due: {formatDate(subscription.next_due_date)}
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    borderRadius: 16,
    padding: 20,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  badgeWrapper: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 100,
    overflow: 'hidden',
  },
  speed: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 16,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dueDate: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
});
