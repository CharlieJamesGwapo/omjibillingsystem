import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Colors } from '@/constants/colors';

const logo = require('../../assets/logo.jpeg');
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const { login, user } = useAuth();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [generalError, setGeneralError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (): boolean => {
    let valid = true;
    setPhoneError('');
    setPasswordError('');
    setGeneralError('');

    if (!phone.trim()) {
      setPhoneError('Phone number is required');
      valid = false;
    }

    if (!password) {
      setPasswordError('Password is required');
      valid = false;
    }

    return valid;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    setIsSubmitting(true);
    setGeneralError('');

    try {
      await login(phone.trim(), password);

      // Re-read user from the auth state after login resolves.
      // Since login updates state, we rely on the returned promise
      // and read the role from the auth context on next render.
      // However, the state update may not be reflected yet in this
      // closure, so we use a small workaround: the login function
      // in AuthContext sets the user, and router.replace will be
      // called. We need to get the user role from the response.
      // Since useAuth().user may not be updated yet in this tick,
      // we read from the storage or trust the context update.
    } catch (err: any) {
      const message =
        err?.response?.data?.error ||
        err?.message ||
        'Invalid phone number or password';
      setGeneralError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Navigate once user state updates after successful login
  React.useEffect(() => {
    if (user) {
      if (user.role === 'customer') {
        router.replace('/(customer)/home');
      } else if (user.role === 'technician' || user.role === 'admin') {
        router.replace('/(technician)/home');
      }
    }
  }, [user, router]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {/* Gradient Header */}
          <LinearGradient
            colors={[Colors.primary, Colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            <View style={styles.logoContainer}>
              <Image source={logo} style={styles.logo} />
            </View>
            <Text style={styles.brandTitle}>OMJI Billing</Text>
            <Text style={styles.brandSubtitle}>
              Internet Access &amp; Billing System
            </Text>
          </LinearGradient>

          {/* Form Card */}
          <View style={styles.card}>
            <Text style={styles.welcomeTitle}>Welcome Back</Text>
            <Text style={styles.welcomeSubtitle}>
              Sign in to your account
            </Text>

            <View style={styles.form}>
              <Input
                icon="call-outline"
                placeholder="Phone Number (09XX XXX XXXX)"
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  if (phoneError) setPhoneError('');
                  if (generalError) setGeneralError('');
                }}
                keyboardType="phone-pad"
                autoCapitalize="none"
                error={phoneError}
              />

              <View style={styles.inputGap} />

              <Input
                icon="lock-closed-outline"
                placeholder="Password"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (passwordError) setPasswordError('');
                  if (generalError) setGeneralError('');
                }}
                secureTextEntry={true}
                autoCapitalize="none"
                error={passwordError}
              />

              <View style={styles.buttonGap} />

              {generalError ? (
                <Text style={styles.errorText}>{generalError}</Text>
              ) : null}

              <Button
                title="Sign In"
                onPress={handleLogin}
                variant="primary"
                fullWidth
                loading={isSubmitting}
                disabled={isSubmitting}
              />
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerBrand}>OMJI Balingasag</Text>
            <Text style={styles.footerVersion}>v1.0.0</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  gradient: {
    height: SCREEN_HEIGHT * 0.4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 6,
    letterSpacing: 0.3,
  },
  card: {
    backgroundColor: Colors.surface,
    marginHorizontal: 20,
    marginTop: -30,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.black,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: Colors.grey500,
    marginTop: 4,
    marginBottom: 24,
  },
  form: {
    width: '100%',
  },
  inputGap: {
    height: 16,
  },
  buttonGap: {
    height: 24,
  },
  errorText: {
    fontSize: 14,
    color: Colors.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
    marginTop: 'auto',
  },
  footerBrand: {
    fontSize: 14,
    color: Colors.grey500,
    fontWeight: '500',
  },
  footerVersion: {
    fontSize: 12,
    color: Colors.grey300,
    marginTop: 4,
  },
});
