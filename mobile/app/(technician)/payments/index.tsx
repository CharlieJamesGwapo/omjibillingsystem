import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useApi } from '@/hooks/useApi';
import { getAllPayments } from '@/services/payments';
import { Payment, PaymentStatus } from '@/types';
import PaymentCard from '@/components/PaymentCard';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import EmptyState from '@/components/ui/EmptyState';

type FilterOption = 'all' | PaymentStatus;

export default function TechnicianPaymentsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterOption>('all');

  const {
    data: payments,
    loading,
    refetch,
  } = useApi<Payment[]>(getAllPayments);

  const counts = useMemo(() => {
    if (!payments) return { all: 0, pending: 0, approved: 0, rejected: 0 };
    return {
      all: payments.length,
      pending: payments.filter((p) => p.status === 'pending').length,
      approved: payments.filter((p) => p.status === 'approved').length,
      rejected: payments.filter((p) => p.status === 'rejected').length,
    };
  }, [payments]);

  const FILTERS: { key: FilterOption; label: string }[] = [
    { key: 'all', label: `All (${counts.all})` },
    { key: 'pending', label: `Pending (${counts.pending})` },
    { key: 'approved', label: `Approved (${counts.approved})` },
    { key: 'rejected', label: `Rejected (${counts.rejected})` },
  ];

  const filteredPayments = useMemo(() => {
    if (!payments) return [];
    if (filter === 'all') return payments;
    return payments.filter((p) => p.status === filter);
  }, [payments, filter]);

  const renderItem = useCallback(
    ({ item }: { item: Payment }) => (
      <PaymentCard
        payment={item}
        showCustomer
        onPress={() => router.push(`/(technician)/payments/${item.id}`)}
      />
    ),
    [router],
  );

  const keyExtractor = useCallback((item: Payment) => item.id, []);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Payments</Text>
      </View>

      {/* Filter Pills */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {FILTERS.map((f) => {
            const isActive = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.pill, isActive && styles.pillActive]}
                onPress={() => setFilter(f.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.pillText, isActive && styles.pillTextActive]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Payments List */}
      {loading ? (
        <SkeletonLoader count={4} style={styles.listPadding} />
      ) : (
        <FlatList
          data={filteredPayments}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={[
            styles.listPadding,
            filteredPayments.length === 0 && styles.emptyList,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={refetch}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title="No Payments Found"
              subtitle={
                filter === 'all'
                  ? 'No payments have been submitted yet.'
                  : `No ${filter} payments to show.`
              }
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.black,
  },
  filterContainer: {
    paddingVertical: 8,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.grey300,
  },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.grey500,
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  listPadding: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 100,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});
