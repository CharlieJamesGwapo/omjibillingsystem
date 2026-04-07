import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { updateMyProfile, changeMyPassword } from '@/services/users';
import Avatar from '@/components/ui/Avatar';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  // Edit Profile state
  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Change Password state
  const [passVisible, setPassVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passLoading, setPassLoading] = useState(false);

  const openEditProfile = () => {
    setEditName(user?.full_name ?? '');
    setEditEmail(user?.email ?? '');
    setEditAddress(user?.address ?? '');
    setEditVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Full name is required');
      return;
    }
    setEditLoading(true);
    try {
      await updateMyProfile({
        full_name: editName.trim(),
        email: editEmail.trim() || undefined,
        address: editAddress.trim() || undefined,
      });
      Alert.alert('Success', 'Profile updated successfully');
      setEditVisible(false);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update profile');
    } finally {
      setEditLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    setPassLoading(true);
    try {
      await changeMyPassword(newPassword);
      Alert.alert('Success', 'Password changed successfully');
      setPassVisible(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to change password');
    } finally {
      setPassLoading(false);
    }
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
      onPress: openEditProfile,
    },
    {
      icon: 'lock-closed-outline',
      label: 'Change Password',
      onPress: () => setPassVisible(true),
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

  const roleLabel =
    (user?.role ?? 'customer').charAt(0).toUpperCase() +
    (user?.role ?? 'customer').slice(1);

  return (
    <>
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
            <Text style={styles.roleText}>{roleLabel}</Text>
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

        <Text style={styles.version}>OMJI Billing v1.0.0</Text>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={editVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <View style={styles.modalForm}>
              <Input
                icon="person-outline"
                placeholder="Full Name"
                value={editName}
                onChangeText={setEditName}
              />
              <View style={styles.inputGap} />
              <Input
                icon="mail-outline"
                placeholder="Email (optional)"
                value={editEmail}
                onChangeText={setEditEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <View style={styles.inputGap} />
              <Input
                icon="location-outline"
                placeholder="Address (optional)"
                value={editAddress}
                onChangeText={setEditAddress}
              />
            </View>
            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setEditVisible(false)}
                style={styles.modalBtn}
              />
              <Button
                title="Save"
                variant="primary"
                onPress={handleSaveProfile}
                loading={editLoading}
                style={styles.modalBtn}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={passVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Change Password</Text>
            <View style={styles.modalForm}>
              <Input
                icon="lock-closed-outline"
                placeholder="New Password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
              />
              <View style={styles.inputGap} />
              <Input
                icon="lock-closed-outline"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => {
                  setPassVisible(false);
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                style={styles.modalBtn}
              />
              <Button
                title="Change"
                variant="primary"
                onPress={handleChangePassword}
                loading={passLoading}
                style={styles.modalBtn}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.black,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalForm: {
    marginBottom: 20,
  },
  inputGap: {
    height: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
  },
});
