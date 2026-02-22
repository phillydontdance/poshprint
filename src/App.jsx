import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SettingsProvider } from './context/SettingsContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ShopPage from './pages/ShopPage';
import CustomerOrdersPage from './pages/CustomerOrdersPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProducts from './pages/admin/AdminProducts';
import AdminOrders from './pages/admin/AdminOrders';
import AdminSettings from './pages/admin/AdminSettings';
import { IoLogoWhatsapp, IoLogoInstagram, IoLogoTiktok, IoLogoFacebook, IoChatbubblesOutline, IoCloseOutline } from 'react-icons/io5';
import './App.css';

function SocialFloat() {
  const [open, setOpen] = React.useState(false);
  return (
    <div className={`social-float ${open ? 'open' : ''}`}>
      {open && (
        <div className="social-links">
          <a href="https://wa.me/254706276584?text=Hi%20Posh%20Print!%20I'm%20interested%20in%20your%20services." target="_blank" rel="noopener noreferrer" className="social-link whatsapp" title="WhatsApp">
            <IoLogoWhatsapp />
          </a>
          <a href="https://www.instagram.com/poshprint" target="_blank" rel="noopener noreferrer" className="social-link instagram" title="Instagram">
            <IoLogoInstagram />
          </a>
          <a href="https://www.tiktok.com/@poshprint" target="_blank" rel="noopener noreferrer" className="social-link tiktok" title="TikTok">
            <IoLogoTiktok />
          </a>
          <a href="https://www.facebook.com/poshprint" target="_blank" rel="noopener noreferrer" className="social-link facebook" title="Facebook">
            <IoLogoFacebook />
          </a>
        </div>
      )}
      <button className="social-toggle" onClick={() => setOpen(!open)} title="Contact us">
        {open ? <IoCloseOutline /> : <IoChatbubblesOutline />}
      </button>
    </div>
  );
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <>
      <Navbar />
      <SocialFloat />
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
          <Route path="/admin/settings" element={
            <ProtectedRoute role="admin">
              <AdminSettings />
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
        <SettingsProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </SettingsProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
