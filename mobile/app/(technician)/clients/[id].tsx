import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { useApi } from '@/hooks/useApi';
import {
  getSubscription,
  disconnectSubscription,
  reconnectSubscription,
} from '@/services/subscriptions';
import { getAllPayments } from '@/services/payments';
import { getUser } from '@/services/users';
import { Subscription, Payment, User } from '@/types';
import { formatCurrency, formatDate } from '@/utils/format';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import PaymentCard from '@/components/PaymentCard';

export default function ClientDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [actionLoading, setActionLoading] = useState(false);
  const [customerUser, setCustomerUser] = useState<User | null>(null);

  const fetchSubscription = useCallback(() => getSubscription(id!), [id]);
  const {
    data: subscription,
    loading: subLoading,
    refetch: refetchSub,
  } = useApi<Subscription>(fetchSubscription);

  const fetchPayments = useCallback(() => getAllPayments(), []);
  const { data: allPayments, loading: paymentsLoading } =
    useApi<Payment[]>(fetchPayments);

  const loading = subLoading;

  // Fetch full user once subscription loads (to get coordinates)
  useEffect(() => {
    if (subscription?.user_id) {
      getUser(subscription.user_id)
        .then(setCustomerUser)
        .catch(() => {});
    }
  }, [subscription?.user_id]);

  const handleNavigate = () => {
    if (!customerUser?.latitude || !customerUser?.longitude) return;
    const url = `https://maps.google.com/?q=${customerUser.latitude},${customerUser.longitude}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Error', 'Could not open Maps application.')
    );
  };

  // Filter payments for this customer
  const customerPayments = useMemo(() => {
    if (!allPayments || !subscription) return [];
    return allPayments
      .filter((p) => p.user_id === subscription.user_id)
      .slice(0, 5);
  }, [allPayments, subscription]);

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect Client',
      `Are you sure you want to disconnect ${subscription?.user_name ?? 'this client'}? Their internet service will be suspended.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              await disconnectSubscription(id!);
              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Warning,
              );
              Alert.alert('Disconnected', 'Client has been disconnected.', [
                { text: 'OK', onPress: () => refetchSub() },
              ]);
            } catch (error: any) {
              Alert.alert(
                'Error',
                error?.message ?? 'Failed to disconnect client.',
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleReconnect = () => {
    Alert.alert(
      'Reconnect Client',
      `Are you sure you want to reconnect ${subscription?.user_name ?? 'this client'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reconnect',
          onPress: async () => {
            try {
              setActionLoading(true);
              await reconnectSubscription(id!);
              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              Alert.alert('Reconnected', 'Client has been reconnected.', [
                { text: 'OK', onPress: () => refetchSub() },
              ]);
            } catch (error: any) {
              Alert.alert(
                'Error',
                error?.message ?? 'Failed to reconnect client.',
              );
            } finally {
              setActionLoading(false);
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
            title: 'Client Details',
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

  if (!subscription) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Client Details',
            headerShown: true,
            headerBackTitle: 'Back',
          }}
        />
        <View style={styles.loadingContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={Colors.grey300}
          />
          <Text style={styles.notFoundText}>Client not found</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Client Details',
          headerShown: true,
          headerBackTitle: 'Back',
        }}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Customer Header */}
        <Card style={styles.card}>
          <View style={styles.customerHeader}>
            <Avatar name={subscription.user_name ?? 'Client'} size={64} />
            <View style={styles.customerInfo}>
              <Text style={styles.customerName}>
                {subscription.user_name ?? 'Unknown Client'}
              </Text>
              <View style={styles.contactRow}>
                <Ionicons name="call-outline" size={14} color={Colors.grey500} />
                <Text style={styles.contactText}>
                  {subscription.user_phone ?? 'No phone'}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Subscription Info */}
        <Card style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>Subscription</Text>
            <Badge status={subscription.status} />
          </View>

          <View style={styles.planHighlight}>
            <Text style={styles.planName}>
              {subscription.plan_name ?? 'Unknown Plan'}
            </Text>
            {subscription.plan_speed != null && (
              <Text style={styles.planSpeed}>
                {subscription.plan_speed} Mbps
              </Text>
            )}
            {subscription.plan_price != null && (
              <Text style={styles.planPrice}>
                {formatCurrency(subscription.plan_price)}/mo
              </Text>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Billing Day</Text>
            <Text style={styles.infoValue}>
              Every {subscription.billing_day}
              {getOrdinalSuffix(subscription.billing_day)} of the month
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Next Due Date</Text>
            <Text style={styles.infoValue}>
              {formatDate(subscription.next_due_date)}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Grace Days</Text>
            <Text style={styles.infoValue}>
              {subscription.grace_days} days
            </Text>
          </View>

          {subscription.ip_address && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>IP Address</Text>
              <Text style={styles.infoValueMono}>
                {subscription.ip_address}
              </Text>
            </View>
          )}

          {subscription.mac_address && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>MAC Address</Text>
              <Text style={styles.infoValueMono}>
                {subscription.mac_address}
              </Text>
            </View>
          )}
        </Card>

        {/* Location */}
        {customerUser?.latitude != null && customerUser?.longitude != null && (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Location</Text>
            <TouchableOpacity
              style={styles.navigateBtn}
              activeOpacity={0.7}
              onPress={handleNavigate}
            >
              <Ionicons name="navigate-outline" size={20} color="#FFFFFF" />
              <Text style={styles.navigateBtnText}>Navigate to Customer</Text>
            </TouchableOpacity>
            <Text style={styles.coordsText}>
              {customerUser.latitude.toFixed(5)}, {customerUser.longitude.toFixed(5)}
            </Text>
          </Card>
        )}

        {/* Actions */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Actions</Text>
          {subscription.status === 'active' || subscription.status === 'overdue' ? (
            <Button
              title="Disconnect Client"
              variant="destructive"
              onPress={handleDisconnect}
              disabled={actionLoading}
              loading={actionLoading}
            />
          ) : subscription.status === 'suspended' ? (
            <Button
              title="Reconnect Client"
              variant="success"
              onPress={handleReconnect}
              disabled={actionLoading}
              loading={actionLoading}
            />
          ) : null}
        </Card>

        {/* Recent Payments */}
        <View style={styles.paymentsSection}>
          <Text style={styles.sectionTitle}>Recent Payments</Text>
          {paymentsLoading ? (
            <ActivityIndicator
              size="small"
              color={Colors.primary}
              style={{ marginTop: 16 }}
            />
          ) : customerPayments.length > 0 ? (
            customerPayments.map((payment) => (
              <PaymentCard
                key={payment.id}
                payment={payment}
                onPress={() =>
                  router.push(`/(technician)/payments/${payment.id}`)
                }
              />
            ))
          ) : (
            <Card style={styles.emptyPayments}>
              <Ionicons
                name="receipt-outline"
                size={32}
                color={Colors.grey300}
              />
              <Text style={styles.emptyPaymentsText}>
                No payment history
              </Text>
            </Card>
          )}
        </View>
      </ScrollView>
    </>
  );
}

function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
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
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.black,
    marginBottom: 16,
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerInfo: {
    flex: 1,
    marginLeft: 16,
  },
  customerName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.black,
    marginBottom: 6,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  contactText: {
    fontSize: 14,
    color: Colors.grey500,
  },
  planHighlight: {
    backgroundColor: Colors.grey100,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.black,
    marginBottom: 4,
  },
  planSpeed: {
    fontSize: 14,
    color: Colors.grey500,
    marginBottom: 2,
  },
  planPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.grey500,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.black,
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  infoValueMono: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.black,
    fontFamily: 'monospace',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  paymentsSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.black,
    marginBottom: 12,
  },
  emptyPayments: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyPaymentsText: {
    fontSize: 14,
    color: Colors.grey500,
  },
  navigateBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  navigateBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  coordsText: {
    fontSize: 12,
    color: Colors.grey500,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
});
