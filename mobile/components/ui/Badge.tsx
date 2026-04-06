import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';

type BadgeStatus =
  | 'approved'
  | 'active'
  | 'pending'
  | 'overdue'
  | 'rejected'
  | 'suspended'
  | 'inactive';

interface BadgeProps {
  status: BadgeStatus;
}

const STATUS_COLORS: Record<BadgeStatus, { text: string; bg: string }> = {
  approved: { text: Colors.success, bg: Colors.successLight },
  active: { text: Colors.success, bg: Colors.successLight },
  pending: { text: Colors.warning, bg: Colors.warningLight },
  overdue: { text: Colors.warning, bg: Colors.warningLight },
  rejected: { text: Colors.error, bg: Colors.errorLight },
  suspended: { text: Colors.error, bg: Colors.errorLight },
  inactive: { text: Colors.grey500, bg: Colors.grey100 },
};

export default function Badge({ status }: BadgeProps) {
  const colors = STATUS_COLORS[status] ?? STATUS_COLORS.inactive;

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { color: colors.text }]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
