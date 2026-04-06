import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import { Subscription } from '@/types';
import { formatDate } from '@/utils/format';

const STATUS_BORDER: Record<string, string> = {
  active: Colors.success,
  pending: Colors.warning,
  overdue: Colors.warning,
  suspended: Colors.error,
  inactive: Colors.grey300,
};

interface ClientCardProps {
  subscription: Subscription;
  onPress?: () => void;
}

export default function ClientCard({ subscription, onPress }: ClientCardProps) {
  const borderColor = STATUS_BORDER[subscription.status] ?? Colors.grey300;
  const isOverdue = subscription.status === 'overdue';
  const dueDate = new Date(subscription.next_due_date);
  const now = new Date();
  const isPastDue = dueDate < now;

  return (
    <Card borderColor={borderColor} onPress={onPress} style={styles.card}>
      <View style={styles.topRow}>
        <Avatar name={subscription.user_name || 'Unknown'} size={40} />
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {subscription.user_name || 'Unknown'}
          </Text>
          <Text style={styles.plan}>{subscription.plan_name}</Text>
        </View>
        <Badge status={subscription.status} />
      </View>

      <View style={styles.bottomRow}>
        <Text
          style={[
            styles.dueText,
            (isOverdue || isPastDue) && styles.overdueText,
          ]}
        >
          {isOverdue || isPastDue
            ? `Overdue since ${formatDate(subscription.next_due_date)}`
            : `Due: ${formatDate(subscription.next_due_date)}`}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.black,
  },
  plan: {
    fontSize: 13,
    color: Colors.grey500,
    marginTop: 2,
  },
  bottomRow: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
  },
  dueText: {
    fontSize: 13,
    color: Colors.grey500,
  },
  overdueText: {
    color: Colors.error,
    fontWeight: '600',
  },
});
