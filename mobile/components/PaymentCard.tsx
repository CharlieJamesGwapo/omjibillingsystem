import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import { Payment } from '@/types';
import { formatCurrency, formatBillingPeriod } from '@/utils/format';

const STATUS_BORDER: Record<string, string> = {
  approved: Colors.success,
  pending: Colors.warning,
  rejected: Colors.error,
};

interface PaymentCardProps {
  payment: Payment;
  onPress?: () => void;
  showCustomer?: boolean;
}

export default function PaymentCard({
  payment,
  onPress,
  showCustomer = false,
}: PaymentCardProps) {
  const borderColor = STATUS_BORDER[payment.status] ?? Colors.grey300;

  return (
    <Card borderColor={borderColor} onPress={onPress} style={styles.card}>
      {/* Customer row */}
      {showCustomer && payment.user_name && (
        <View style={styles.customerRow}>
          <Avatar name={payment.user_name} size={32} />
          <Text style={styles.customerName}>{payment.user_name}</Text>
        </View>
      )}

      {/* Main row: billing period + amount */}
      <View style={styles.mainRow}>
        <View style={styles.leftContent}>
          <Text style={styles.period}>
            {formatBillingPeriod(
              payment.billing_period_start,
              payment.billing_period_end,
            )}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons
              name="card-outline"
              size={14}
              color={Colors.grey500}
              style={styles.metaIcon}
            />
            <Text style={styles.metaText}>
              {payment.method}
              {payment.reference_number ? ` \u00B7 ${payment.reference_number}` : ''}
            </Text>
          </View>
        </View>
        <Text style={styles.amount}>{formatCurrency(payment.amount)}</Text>
      </View>

      {/* Status badge */}
      <View style={styles.footer}>
        <Badge status={payment.status} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.black,
    marginLeft: 10,
  },
  mainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  leftContent: {
    flex: 1,
    marginRight: 12,
  },
  period: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.black,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaIcon: {
    marginRight: 4,
  },
  metaText: {
    fontSize: 13,
    color: Colors.grey500,
  },
  amount: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.black,
  },
  footer: {
    marginTop: 10,
  },
});
