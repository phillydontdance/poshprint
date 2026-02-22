import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ShopPage from './pages/ShopPage';
import CustomerOrdersPage from './pages/CustomerOrdersPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProducts from './pages/admin/AdminProducts';
import AdminOrders from './pages/admin/AdminOrders';
import './App.css';

function AppRoutes() {
  const { user } = useAuth();

  return (
    <>
      <Navbar />
      <main className="main-content">
        <Routes>
          {/* Public */}
          <Route path="/login" element={user ? <Navigate to={user.role === 'admin' ? '/admin' : '/shop'} /> : <LoginPage />} />
          <Route path="/register" element={user ? <Navigate to="/shop" /> : <RegisterPage />} />
          <Route path="/shop" element={<ShopPage />} />

          {/* Customer */}
          <Route path="/orders" element={
            <ProtectedRoute role="customer">
              <CustomerOrdersPage />
            </ProtectedRoute>
          } />

          {/* Admin */}
          <Route path="/admin" element={
            <ProtectedRoute role="admin">
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/products" element={
            <ProtectedRoute role="admin">
              <AdminProducts />
            </ProtectedRoute>
          } />
          <Route path="/admin/orders" element={
            <ProtectedRoute role="admin">
              <AdminOrders />
            </ProtectedRoute>
          } />

          {/* Default */}
          <Route path="*" element={<Navigate to="/shop" />} />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
