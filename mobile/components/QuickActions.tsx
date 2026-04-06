import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

interface QuickAction {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  badge?: number;
}

interface QuickActionsProps {
  actions: QuickAction[];
}

export default function QuickActions({ actions }: QuickActionsProps) {
  return (
    <View style={styles.row}>
      {actions.map((action, index) => (
        <TouchableOpacity
          key={index}
          style={styles.actionCard}
          activeOpacity={0.7}
          onPress={action.onPress}
        >
          <View style={styles.iconContainer}>
            <Ionicons name={action.icon} size={24} color={Colors.primary} />
            {action.badge != null && action.badge > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {action.badge > 99 ? '99+' : action.badge}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.label} numberOfLines={1}>
            {action.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.grey700,
    textAlign: 'center',
  },
});
