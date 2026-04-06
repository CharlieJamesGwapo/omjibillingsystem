import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { useApi } from '@/hooks/useApi';
import { createPayment } from '@/services/payments';
import { getMySubscriptions } from '@/services/subscriptions';
import { Subscription, PaymentMethod } from '@/types';
import { formatCurrency } from '@/utils/format';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import SkeletonLoader from '@/components/ui/SkeletonLoader';

interface MethodOption {
  key: PaymentMethod;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const METHODS: MethodOption[] = [
  { key: 'gcash', label: 'GCash', icon: 'phone-portrait-outline' },
  { key: 'maya', label: 'Maya', icon: 'card-outline' },
  { key: 'bank', label: 'Bank Transfer', icon: 'business-outline' },
  { key: 'cash', label: 'Cash', icon: 'cash-outline' },
];

export default function SubmitPaymentScreen() {
  const router = useRouter();

  const { data: subscriptions, loading: subsLoading } =
    useApi<Subscription[]>(getMySubscriptions);

  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const subscription = subscriptions?.[0] ?? null;
  const amount = subscription?.plan_price ?? 0;

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const removeImage = () => {
    setImageUri(null);
  };

  const handleSubmit = async () => {
    if (!method || !subscription) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('subscription_id', subscription.id);
      formData.append('amount', amount.toString());
      formData.append('method', method);

      if (referenceNumber.trim()) {
        formData.append('reference_number', referenceNumber.trim());
      }

      if (imageUri) {
        const filename = imageUri.split('/').pop() ?? 'proof.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        formData.append('proof_image', {
          uri: imageUri,
          name: filename,
          type,
        } as any);
      }

      await createPayment(formData);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Payment Submitted', 'Your payment is now pending approval.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to submit payment.';
      Alert.alert('Error', message);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = method !== null && !submitting;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Submit Payment',
          headerBackTitle: 'Back',
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Amount Section */}
          {subsLoading ? (
            <SkeletonLoader count={1} />
          ) : subscription ? (
            <Card style={styles.amountCard}>
              <Text style={styles.amountLabel}>Payment Amount</Text>
              <Text style={styles.amountValue}>
                {formatCurrency(amount)}
              </Text>
              <Text style={styles.planName}>
                {subscription.plan_name ?? 'Current Plan'}
              </Text>
            </Card>
          ) : (
            <Card style={styles.amountCard}>
              <Text style={styles.amountLabel}>No active subscription</Text>
            </Card>
          )}

          {/* Payment Method */}
          <Text style={styles.sectionLabel}>Payment Method</Text>
          <View style={styles.methodGrid}>
            {METHODS.map((m) => {
              const isSelected = method === m.key;
              return (
                <TouchableOpacity
                  key={m.key}
                  style={[
                    styles.methodCard,
                    isSelected && styles.methodCardSelected,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    setMethod(m.key);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <View style={styles.methodIconRow}>
                    <Ionicons
                      name={m.icon}
                      size={24}
                      color={isSelected ? '#FFFFFF' : Colors.grey500}
                    />
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color="#FFFFFF"
                        style={styles.checkIcon}
                      />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.methodLabel,
                      isSelected && styles.methodLabelSelected,
                    ]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Reference Number */}
          {method && method !== 'cash' && (
            <View style={styles.inputSection}>
              <Text style={styles.sectionLabel}>Reference Number</Text>
              <Input
                placeholder="Enter reference number (optional)"
                value={referenceNumber}
                onChangeText={setReferenceNumber}
                icon="document-text-outline"
                keyboardType="default"
                autoCapitalize="none"
              />
            </View>
          )}

          {/* Proof Upload */}
          <Text style={styles.sectionLabel}>Proof of Payment</Text>
          {imageUri ? (
            <View style={styles.imagePreview}>
              <Image source={{ uri: imageUri }} style={styles.proofImage} />
              <TouchableOpacity
                style={styles.removeImage}
                onPress={removeImage}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle" size={28} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.uploadArea}
              activeOpacity={0.7}
              onPress={pickImage}
            >
              <Ionicons
                name="camera-outline"
                size={36}
                color={Colors.grey300}
              />
              <Text style={styles.uploadText}>
                Tap to upload proof of payment
              </Text>
            </TouchableOpacity>
          )}

          {/* Submit */}
          <View style={styles.submitSection}>
            <Button
              title={submitting ? 'Submitting...' : 'Submit Payment'}
              onPress={handleSubmit}
              loading={submitting}
              disabled={!canSubmit}
              fullWidth
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  amountCard: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 8,
  },
  amountLabel: {
    fontSize: 14,
    color: Colors.grey500,
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.black,
    marginBottom: 4,
  },
  planName: {
    fontSize: 14,
    color: Colors.grey500,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.black,
    marginTop: 20,
    marginBottom: 12,
  },
  methodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  methodCard: {
    width: '47%',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.grey300,
  },
  methodCardSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  methodIconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  checkIcon: {
    marginLeft: 4,
  },
  methodLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.grey700,
  },
  methodLabelSelected: {
    color: '#FFFFFF',
  },
  inputSection: {
    marginBottom: 4,
  },
  uploadArea: {
    height: 160,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.grey300,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  uploadText: {
    fontSize: 14,
    color: Colors.grey500,
    marginTop: 8,
  },
  imagePreview: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  proofImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  removeImage: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: Colors.surface,
    borderRadius: 14,
  },
  submitSection: {
    marginTop: 32,
  },
});
