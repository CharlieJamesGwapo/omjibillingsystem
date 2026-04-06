import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/AdminLayout';
import CustomerLayout from './components/CustomerLayout';
import Login from './pages/Login';

const Dashboard = React.lazy(() => import('./pages/admin/Dashboard'));
const Customers = React.lazy(() => import('./pages/admin/Customers'));
const Plans = React.lazy(() => import('./pages/admin/Plans'));
const Subscriptions = React.lazy(() => import('./pages/admin/Subscriptions'));
const Payments = React.lazy(() => import('./pages/admin/Payments'));
const Messages = React.lazy(() => import('./pages/admin/Messages'));
const MikroTik = React.lazy(() => import('./pages/admin/MikroTik'));
const ActivityLogs = React.lazy(() => import('./pages/admin/ActivityLogs'));
const Reports = React.lazy(() => import('./pages/admin/Reports'));
const Staff = React.lazy(() => import('./pages/admin/Staff'));
const Settings = React.lazy(() => import('./pages/admin/Settings'));

const MySubscription = React.lazy(() => import('./pages/customer/MySubscription'));
const MyPayments = React.lazy(() => import('./pages/customer/MyPayments'));
const SubmitPayment = React.lazy(() => import('./pages/customer/SubmitPayment'));

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg-deep text-text-primary">
      <h1 className="text-6xl font-heading font-bold mb-2">404</h1>
      <p className="text-text-secondary mb-6">Page not found</p>
      <a
        href="/login"
        className="text-sm text-secondary hover:underline"
      >
        Go to Login
      </a>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute roles={['admin', 'technician']} />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="customers" element={<Customers />} />
              <Route path="plans" element={<Plans />} />
              <Route path="subscriptions" element={<Subscriptions />} />
              <Route path="payments" element={<Payments />} />
              <Route path="messages" element={<Messages />} />
              <Route path="mikrotik" element={<MikroTik />} />
              <Route path="activity-logs" element={<ActivityLogs />} />
              <Route path="reports" element={<Reports />} />
              <Route path="staff" element={<Staff />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={['customer']} />}>
            <Route path="/portal" element={<CustomerLayout />}>
              <Route index element={<MySubscription />} />
              <Route path="payments" element={<MyPayments />} />
              <Route path="submit-payment" element={<SubmitPayment />} />
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
