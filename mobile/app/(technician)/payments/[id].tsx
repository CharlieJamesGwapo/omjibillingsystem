import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  TextInput,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { API_BASE_URL } from '@/constants/api';
import { useApi } from '@/hooks/useApi';
import { getAllPayments, approvePayment, rejectPayment } from '@/services/payments';
import { Payment } from '@/types';
import {
  formatCurrency,
  formatBillingPeriod,
  timeAgo,
} from '@/utils/format';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';

const METHOD_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  gcash: 'phone-portrait-outline',
  maya: 'phone-portrait-outline',
  bank: 'business-outline',
  cash: 'cash-outline',
};

const METHOD_LABELS: Record<string, string> = {
  gcash: 'GCash',
  maya: 'Maya',
  bank: 'Bank Transfer',
  cash: 'Cash',
};

export default function PaymentDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [notes, setNotes] = useState('');
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const fetchPayments = useCallback(() => getAllPayments(), []);
  const { data: payments, loading } = useApi<Payment[]>(fetchPayments);

  const payment = payments?.find((p) => p.id === id) ?? null;

  const isPending = payment?.status === 'pending';
  const processing = approving || rejecting;

  const getImageUrl = (url: string) => {
    if (url.startsWith('http')) return url;
    return `${API_BASE_URL}${url}`;
  };

  const handleApprove = () => {
    Alert.alert(
      'Approve Payment',
      `Are you sure you want to approve this ${formatCurrency(payment?.amount ?? 0)} payment?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              setApproving(true);
              await approvePayment(id!, notes.trim() || undefined);
              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              Alert.alert('Success', 'Payment has been approved.', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (error: any) {
              Alert.alert(
                'Error',
                error?.message ?? 'Failed to approve payment.',
              );
            } finally {
              setApproving(false);
            }
          },
        },
      ],
    );
  };

  const handleReject = () => {
    if (!notes.trim()) {
      Alert.alert(
        'Notes Required',
        'Please provide a reason for rejecting this payment.',
      );
      return;
    }

    Alert.alert(
      'Reject Payment',
      `Are you sure you want to reject this ${formatCurrency(payment?.amount ?? 0)} payment?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              setRejecting(true);
              await rejectPayment(id!, notes.trim());
              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Warning,
              );
              Alert.alert('Rejected', 'Payment has been rejected.', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (error: any) {
              Alert.alert(
                'Error',
                error?.message ?? 'Failed to reject payment.',
              );
            } finally {
              setRejecting(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Payment Detail',
            headerShown: true,
            headerBackTitle: 'Back',
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </>
    );
  }

  if (!payment) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Payment Detail',
            headerShown: true,
            headerBackTitle: 'Back',
          }}
        />
        <View style={styles.loadingContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.grey300} />
          <Text style={styles.notFoundText}>Payment not found</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Payment Detail',
          headerShown: true,
          headerBackTitle: 'Back',
        }}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Customer Info */}
        <Card style={styles.card}>
          <View style={styles.customerRow}>
            <Avatar name={payment.user_name ?? 'Customer'} size={44} />
            <View style={styles.customerInfo}>
              <Text style={styles.customerName}>
                {payment.user_name ?? 'Unknown Customer'}
              </Text>
              <Text style={styles.customerPhone}>
                {payment.user_phone ?? 'No phone'}
              </Text>
            </View>
            <Badge status={payment.status} />
          </View>
        </Card>

        {/* Payment Info */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Payment Information</Text>

          <Text style={styles.amount}>{formatCurrency(payment.amount)}</Text>

          <View style={styles.infoRow}>
            <Ionicons
              name={METHOD_ICONS[payment.method] ?? 'card-outline'}
              size={18}
              color={Colors.grey500}
            />
            <Text style={styles.infoLabel}>Method</Text>
            <Text style={styles.infoValue}>
              {METHOD_LABELS[payment.method] ?? payment.method}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Ionicons name="document-text-outline" size={18} color={Colors.grey500} />
            <Text style={styles.infoLabel}>Reference</Text>
            <Text style={styles.infoValue}>
              {payment.reference_number || 'N/A'}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={18} color={Colors.grey500} />
            <Text style={styles.infoLabel}>Billing Period</Text>
            <Text style={styles.infoValue}>
              {formatBillingPeriod(
                payment.billing_period_start,
                payment.billing_period_end,
              )}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={18} color={Colors.grey500} />
            <Text style={styles.infoLabel}>Submitted</Text>
            <Text style={styles.infoValue}>{timeAgo(payment.created_at)}</Text>
          </View>
        </Card>

        {/* Proof Image */}
        {payment.proof_image_url && (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Proof of Payment</Text>
            <TouchableOpacity activeOpacity={0.8}>
              <Image
                source={{ uri: getImageUrl(payment.proof_image_url) }}
                style={styles.proofImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          </Card>
        )}

        {/* Status / Review Section */}
        {!isPending && (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Review Details</Text>
            <View style={styles.infoRow}>
              <Ionicons name="shield-checkmark-outline" size={18} color={Colors.grey500} />
              <Text style={styles.infoLabel}>Status</Text>
              <Badge status={payment.status} />
            </View>
            {payment.approver_name && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Ionicons name="person-outline" size={18} color={Colors.grey500} />
                  <Text style={styles.infoLabel}>Reviewed by</Text>
                  <Text style={styles.infoValue}>{payment.approver_name}</Text>
                </View>
              </>
            )}
            {payment.notes && (
              <>
                <View style={styles.divider} />
                <View style={styles.notesBlock}>
                  <Text style={styles.infoLabel}>Notes</Text>
                  <Text style={styles.notesText}>{payment.notes}</Text>
                </View>
              </>
            )}
          </Card>
        )}

        {/* Action Section (Pending Only) */}
        {isPending && (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Review Payment</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Add notes (optional for approval, required for rejection)"
              placeholderTextColor={Colors.grey300}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={!processing}
            />
            <View style={styles.actionRow}>
              <View style={styles.actionButton}>
                <Button
                  title="Reject"
                  variant="destructive"
                  onPress={handleReject}
                  disabled={processing}
                  loading={rejecting}
                />
              </View>
              <View style={styles.actionButton}>
                <Button
                  title="Approve"
                  variant="success"
                  onPress={handleApprove}
                  disabled={processing}
                  loading={approving}
                />
              </View>
            </View>
          </Card>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  notFoundText: {
    fontSize: 16,
    color: Colors.grey500,
  },
  card: {
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.black,
    marginBottom: 16,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.black,
  },
  customerPhone: {
    fontSize: 14,
    color: Colors.grey500,
    marginTop: 2,
  },
  amount: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 20,
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.grey500,
    marginLeft: 10,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.black,
    textAlign: 'right',
    flexShrink: 1,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 10,
  },
  proofImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: Colors.grey100,
  },
  notesBlock: {
    paddingVertical: 4,
  },
  notesText: {
    fontSize: 14,
    color: Colors.black,
    marginTop: 6,
    lineHeight: 20,
  },
  notesInput: {
    backgroundColor: Colors.grey100,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: Colors.black,
    minHeight: 80,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
});
