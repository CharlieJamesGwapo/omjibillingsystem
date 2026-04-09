import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useApi } from '@/hooks/useApi';
import { getAllSubscriptions } from '@/services/subscriptions';
import { Subscription, SubscriptionStatus } from '@/types';
import ClientCard from '@/components/ClientCard';
import Input from '@/components/ui/Input';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import EmptyState from '@/components/ui/EmptyState';

type FilterOption = 'all' | SubscriptionStatus;

export default function TechnicianClientsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string }>();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterOption>(
    (params.status as FilterOption) ?? 'all',
  );

  const {
    data: subscriptions,
    loading,
    refetch,
  } = useApi<Subscription[]>(getAllSubscriptions);

  // Search filter (client-side)
  const searchFiltered = useMemo(() => {
    if (!subscriptions) return [];
    if (!search.trim()) return subscriptions;
    const q = search.trim().toLowerCase();
    return subscriptions.filter(
      (s) =>
        (s.user_name?.toLowerCase().includes(q) ?? false) ||
        (s.user_phone?.toLowerCase().includes(q) ?? false),
    );
  }, [subscriptions, search]);

  // Status filter
  const filteredClients = useMemo(() => {
    if (filter === 'all') return searchFiltered;
    return searchFiltered.filter((s) => s.status === filter);
  }, [searchFiltered, filter]);

  // Counts from search-filtered data
  const counts = useMemo(() => {
    return {
      all: searchFiltered.length,
      active: searchFiltered.filter((s) => s.status === 'active').length,
      overdue: searchFiltered.filter((s) => s.status === 'overdue').length,
      suspended: searchFiltered.filter((s) => s.status === 'suspended').length,
    };
  }, [searchFiltered]);

  const FILTERS: { key: FilterOption; label: string }[] = [
    { key: 'all', label: `All (${counts.all})` },
    { key: 'active', label: `Active (${counts.active})` },
    { key: 'overdue', label: `Overdue (${counts.overdue})` },
    { key: 'suspended', label: `Suspended (${counts.suspended})` },
  ];

  const renderItem = useCallback(
    ({ item }: { item: Subscription }) => (
      <ClientCard
        subscription={item}
        onPress={() => router.push(`/(technician)/clients/${item.id}`)}
      />
    ),
    [router],
  );

  const keyExtractor = useCallback((item: Subscription) => item.id, []);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Clients</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Input
          placeholder="Search by name or phone"
          value={search}
          onChangeText={setSearch}
          icon="search-outline"
        />
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

      {/* Client List */}
      {loading ? (
        <SkeletonLoader count={5} style={styles.listPadding} />
      ) : (
        <FlatList
          data={filteredClients}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={[
            styles.listPadding,
            filteredClients.length === 0 && styles.emptyList,
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
              icon="people-outline"
              title="No Clients Found"
              subtitle={
                search.trim()
                  ? `No clients matching "${search.trim()}".`
                  : 'No clients to show.'
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 4,
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
