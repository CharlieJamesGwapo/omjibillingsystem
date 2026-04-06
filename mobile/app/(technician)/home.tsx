import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { getDashboardStats } from '@/services/dashboard';
import { getAllPayments } from '@/services/payments';
import { DashboardStats, Payment } from '@/types';
import { getGreeting } from '@/utils/format';
import StatCard from '@/components/ui/StatCard';
import QuickActions from '@/components/QuickActions';
import PaymentCard from '@/components/PaymentCard';
import Avatar from '@/components/ui/Avatar';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import EmptyState from '@/components/ui/EmptyState';
import Badge from '@/components/ui/Badge';

export default function TechnicianHomeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const {
    data: stats,
    loading: statsLoading,
    refetch: refetchStats,
  } = useApi<DashboardStats>(getDashboardStats);

  const fetchPendingPayments = useCallback(() => getAllPayments('pending'), []);
  const {
    data: pendingPayments,
    loading: paymentsLoading,
    refetch: refetchPayments,
  } = useApi<Payment[]>(fetchPendingPayments);

  const loading = statsLoading || paymentsLoading;

  const onRefresh = useCallback(async () => {
    await Promise.all([refetchStats(), refetchPayments()]);
  }, [refetchStats, refetchPayments]);

  const recentPending = useMemo(
    () => (pendingPayments ?? []).slice(0, 5),
    [pendingPayments],
  );

  const fullName = user?.full_name ?? 'Technician';

  const quickActions = [
    {
      icon: 'checkmark-circle-outline' as const,
      label: 'Approve',
      onPress: () => router.push('/(technician)/payments'),
    },
    {
      icon: 'people-outline' as const,
      label: 'Clients',
      onPress: () => router.push('/(technician)/clients'),
    },
    {
      icon: 'wifi-outline' as const,
      label: 'Network',
      onPress: () =>
        Alert.alert('Coming Soon', 'Network monitoring will be available in a future update.'),
    },
    {
      icon: 'search-outline' as const,
      label: 'Search',
      onPress: () => router.push('/(technician)/clients'),
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
            <Text style={styles.welcomeCaption}>Welcome back,</Text>
            <Text style={styles.fullName}>{fullName}</Text>
          </View>
          <Avatar name={fullName} size={44} />
        </View>

        {/* Stat Cards */}
        {loading ? (
          <SkeletonLoader count={4} style={styles.section} />
        ) : (
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <StatCard
                label="Pending"
                value={stats?.pending_payments ?? 0}
                borderColor={Colors.error}
                icon="time-outline"
              />
            </View>
            <View style={styles.statItem}>
              <StatCard
                label="Overdue"
                value={stats?.overdue ?? 0}
                borderColor={Colors.warning}
                icon="alert-circle-outline"
              />
            </View>
            <View style={styles.statItem}>
              <StatCard
                label="Active"
                value={stats?.active ?? 0}
                borderColor={Colors.success}
                icon="checkmark-circle-outline"
              />
            </View>
            <View style={styles.statItem}>
              <StatCard
                label="Customers"
                value={stats?.total_customers ?? 0}
                borderColor={Colors.info}
                icon="people-outline"
              />
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <QuickActions actions={quickActions} />
        </View>

        {/* Pending Payments */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Pending Payments</Text>
              {(pendingPayments?.length ?? 0) > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>
                    {pendingPayments?.length ?? 0}
                  </Text>
                </View>
              )}
            </View>
            {recentPending.length > 0 && (
              <TouchableOpacity
                onPress={() => router.push('/(technician)/payments')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <SkeletonLoader count={3} />
          ) : recentPending.length > 0 ? (
            recentPending.map((payment) => (
              <PaymentCard
                key={payment.id}
                payment={payment}
                showCustomer
                onPress={() =>
                  router.push(`/(technician)/payments/${payment.id}`)
                }
              />
            ))
          ) : (
            <EmptyState
              icon="checkmark-done-outline"
              title="All Caught Up"
              subtitle="No pending payments to review."
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
  welcomeCaption: {
    fontSize: 14,
    color: Colors.grey500,
    marginBottom: 2,
  },
  fullName: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.black,
  },
  section: {
    marginTop: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 20,
    marginHorizontal: -4,
  },
  statItem: {
    width: '50%',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.black,
  },
  countBadge: {
    backgroundColor: Colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
});
