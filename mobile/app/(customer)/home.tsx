import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { getMyPayments } from '@/services/payments';
import { getMySubscriptions } from '@/services/subscriptions';
import { Payment, Subscription } from '@/types';
import { getGreeting } from '@/utils/format';
import PlanCard from '@/components/PlanCard';
import QuickActions from '@/components/QuickActions';
import PaymentCard from '@/components/PaymentCard';
import Avatar from '@/components/ui/Avatar';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import EmptyState from '@/components/ui/EmptyState';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const {
    data: subscriptions,
    loading: subsLoading,
    refetch: refetchSubs,
  } = useApi<Subscription[]>(getMySubscriptions);

  const {
    data: payments,
    loading: paymentsLoading,
    refetch: refetchPayments,
  } = useApi<Payment[]>(getMyPayments);

  const loading = subsLoading || paymentsLoading;

  const onRefresh = useCallback(async () => {
    await Promise.all([refetchSubs(), refetchPayments()]);
  }, [refetchSubs, refetchPayments]);

  const subscription = subscriptions?.[0] ?? null;
  const recentPayments = (payments ?? []).slice(0, 3);
  const firstName = user?.full_name?.split(' ')[0] ?? 'there';

  const quickActions = [
    {
      icon: 'wallet-outline' as const,
      label: 'Pay Now',
      onPress: () => router.push('/(customer)/payments/submit'),
    },
    {
      icon: 'time-outline' as const,
      label: 'History',
      onPress: () => router.push('/(customer)/payments'),
    },
    {
      icon: 'wifi-outline' as const,
      label: 'My Plan',
      onPress: () => router.push('/(customer)/plan'),
    },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>
              {getGreeting()}, {firstName}
            </Text>
            <Text style={styles.subtitle}>Here's your account overview</Text>
          </View>
          <Avatar name={user?.full_name ?? 'User'} size={44} />
        </View>

        {/* Plan Card */}
        {loading ? (
          <SkeletonLoader count={1} style={styles.section} />
        ) : subscription ? (
          <PlanCard
            plan={{
              name: subscription.plan_name ?? 'Unknown Plan',
              speed_mbps: subscription.plan_speed ?? 0,
              price: subscription.plan_price ?? 0,
            }}
            subscription={{
              status: subscription.status,
              next_due_date: subscription.next_due_date,
            }}
            style={styles.section}
          />
        ) : (
          <View style={styles.section}>
            <EmptyState
              icon="wifi-outline"
              title="No Active Plan"
              subtitle="You don't have an active subscription yet."
            />
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <QuickActions actions={quickActions} />
        </View>

        {/* Recent Payments */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Payments</Text>
            {recentPayments.length > 0 && (
              <TouchableOpacity
                onPress={() => router.push('/(customer)/payments')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <SkeletonLoader count={2} />
          ) : recentPayments.length > 0 ? (
            recentPayments.map((payment) => (
              <PaymentCard key={payment.id} payment={payment} />
            ))
          ) : (
            <EmptyState
              icon="receipt-outline"
              title="No Payments Yet"
              subtitle="Your payment history will appear here."
              actionLabel="Make a Payment"
              onAction={() => router.push('/(customer)/payments/submit')}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  headerText: {
    flex: 1,
    marginRight: 12,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.black,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.grey500,
  },
  section: {
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.black,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
});
