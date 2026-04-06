import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import Avatar from '@/components/ui/Avatar';
import Card from '@/components/ui/Card';

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

export default function TechnicianProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleComingSoon = (feature: string) => {
    Alert.alert('Coming Soon', `${feature} will be available in a future update.`);
  };

  const handleAbout = () => {
    Alert.alert(
      'About OMJI Billing',
      'OMJI Billing v1.0.0\n\nA modern ISP billing and subscription management system.\n\nBuilt with care for OMJI Internet Services.',
    );
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const accountItems: MenuItem[] = [
    {
      icon: 'person-outline',
      label: 'Edit Profile',
      onPress: () => handleComingSoon('Edit Profile'),
    },
    {
      icon: 'lock-closed-outline',
      label: 'Change Password',
      onPress: () => handleComingSoon('Change Password'),
    },
  ];

  const appItems: MenuItem[] = [
    {
      icon: 'information-circle-outline',
      label: 'About',
      onPress: handleAbout,
    },
  ];

  const renderMenuItems = (items: MenuItem[]) =>
    items.map((item, index) => (
      <React.Fragment key={item.label}>
        {index > 0 && <View style={styles.menuDivider} />}
        <TouchableOpacity
          style={styles.menuItem}
          activeOpacity={0.6}
          onPress={item.onPress}
        >
          <Ionicons
            name={item.icon}
            size={22}
            color={item.destructive ? Colors.error : Colors.grey700}
          />
          <Text
            style={[
              styles.menuLabel,
              item.destructive && styles.menuLabelDestructive,
            ]}
          >
            {item.label}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={Colors.grey300}
          />
        </TouchableOpacity>
      </React.Fragment>
    ));

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile Header */}
      <LinearGradient
        colors={[Colors.primary, Colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <Avatar name={user?.full_name ?? 'User'} size={64} style={styles.avatar} />
        <Text style={styles.fullName}>{user?.full_name ?? 'User'}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>Technician</Text>
        </View>
        <Text style={styles.phone}>{user?.phone ?? ''}</Text>
      </LinearGradient>

      {/* Account Section */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Card style={styles.menuCard}>{renderMenuItems(accountItems)}</Card>
      </View>

      {/* App Section */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>App</Text>
        <Card style={styles.menuCard}>{renderMenuItems(appItems)}</Card>
      </View>

      {/* Sign Out */}
      <View style={styles.sectionContainer}>
        <Card style={styles.menuCard}>
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.6}
            onPress={handleSignOut}
          >
            <Ionicons name="log-out-outline" size={22} color={Colors.error} />
            <Text style={[styles.menuLabel, styles.menuLabelDestructive]}>
              Sign Out
            </Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.grey300} />
          </TouchableOpacity>
        </Card>
      </View>

      {/* Version */}
      <Text style={styles.version}>OMJI Billing v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  headerGradient: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
  },
  avatar: {
    marginBottom: 12,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  fullName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 100,
    marginBottom: 6,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  phone: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  sectionContainer: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.grey500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  menuCard: {
    padding: 0,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 54,
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    color: Colors.black,
    marginLeft: 14,
  },
  menuLabelDestructive: {
    color: Colors.error,
  },
  version: {
    textAlign: 'center',
    fontSize: 13,
    color: Colors.grey500,
    marginTop: 32,
  },
});
