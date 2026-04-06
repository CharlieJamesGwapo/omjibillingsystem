import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import Card from '@/components/ui/Card';

interface StatCardProps {
  label: string;
  value: string | number;
  borderColor: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export default function StatCard({ label, value, borderColor, icon }: StatCardProps) {
  return (
    <Card borderColor={borderColor} style={styles.card}>
      <View style={styles.row}>
        <View style={styles.content}>
          <Text style={styles.value}>{value}</Text>
          <Text style={styles.label}>{label.toUpperCase()}</Text>
        </View>
        {icon && (
          <Ionicons name={icon} size={24} color={borderColor} />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
  },
  value: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.black,
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.grey500,
    letterSpacing: 0.5,
  },
});
