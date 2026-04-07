import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function Index() {
  const { isLoading, isAuthenticated, user } = useAuth();

  // Loading state is handled by the root layout splash screen
  if (isLoading) {
    return null;
  }

  if (!isAuthenticated || !user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (user.role === 'customer') {
    return <Redirect href="/(customer)/home" />;
  }

  if (user.role === 'technician' || user.role === 'admin') {
    return <Redirect href="/(technician)/home" />;
  }

  // Fallback for unknown roles
  return <Redirect href="/(auth)/login" />;
}
