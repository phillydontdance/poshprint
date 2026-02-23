import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { FiShoppingBag, FiLogOut, FiUser, FiGrid, FiShoppingCart, FiSun, FiMoon, FiMenu, FiX, FiPackage, FiHome, FiSettings } from 'react-icons/fi';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { dark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  // Prevent body scroll when menu open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path ? 'active' : '';

  return (
    <>
      <nav className="navbar">
        <Link to="/" className="navbar-brand">
          <FiShoppingBag />
          <div className="brand-text">
            <span>Posh Print</span>
            <small className="brand-tagline">by Nastech Company</small>
          </div>
        </Link>

        {/* Desktop nav links */}
        <div className="navbar-links desktop-only">
          <button onClick={toggleTheme} className="btn-theme" title={dark ? 'Light mode' : 'Dark mode'}>
            {dark ? <FiSun /> : <FiMoon />}
          </button>
          {user ? (
            <>
              {user.role === 'admin' ? (
                <>
                  <Link to="/admin" className={`nav-link ${isActive('/admin')}`}>
                    <FiGrid /> Dashboard
                  </Link>
                  <Link to="/admin/products" className={`nav-link ${isActive('/admin/products')}`}>
                    Products
                  </Link>
                  <Link to="/admin/orders" className={`nav-link ${isActive('/admin/orders')}`}>
                    Orders
                  </Link>
                  <Link to="/admin/settings" className={`nav-link ${isActive('/admin/settings')}`}>
                    Settings
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/shop" className={`nav-link ${isActive('/shop')}`}>
                    <FiShoppingCart /> Shop
                  </Link>
                  <Link to="/orders" className={`nav-link ${isActive('/orders')}`}>
                    My Orders
                  </Link>
                </>
              )}

              <div className="nav-user">
                <FiUser />
                <span>{user.name}</span>
                <span className={`role-badge ${user.role}`}>{user.role}</span>
              </div>
              <button onClick={handleLogout} className="btn-logout">
                <FiLogOut /> Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/shop" className={`nav-link ${isActive('/shop')}`}>
                <FiShoppingCart /> Shop
              </Link>
              <Link to="/login" className={`nav-link ${isActive('/login')}`}>
                Login
              </Link>
              <Link to="/register" className="nav-link btn-register-link">
                Sign Up
              </Link>
            </>
          )}
        </div>

        {/* Mobile controls */}
        <div className="mobile-controls mobile-only">
          <button onClick={toggleTheme} className="btn-theme" title={dark ? 'Light mode' : 'Dark mode'}>
            {dark ? <FiSun /> : <FiMoon />}
          </button>
          <button className="btn-hamburger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
            {menuOpen ? <FiX /> : <FiMenu />}
          </button>
        </div>
      </nav>

      {/* Mobile slide-out menu */}
      {menuOpen && <div className="mobile-overlay" onClick={() => setMenuOpen(false)} />}
      <div className={`mobile-drawer ${menuOpen ? 'open' : ''}`}>
        <div className="mobile-drawer-header">
          {user && (
            <div className="mobile-user-info">
              <div className="mobile-avatar">
                <FiUser />
              </div>
              <div>
                <div className="mobile-user-name">{user.name}</div>
                <span className={`role-badge ${user.role}`}>{user.role}</span>
              </div>
            </div>
          )}
        </div>
        <div className="mobile-drawer-links">
          {user ? (
            <>
              {user.role === 'admin' ? (
                <>
                  <Link to="/admin" className={`mobile-link ${isActive('/admin')}`} onClick={closeMenu}>
                    <FiGrid /> Dashboard
                  </Link>
                  <Link to="/admin/products" className={`mobile-link ${isActive('/admin/products')}`} onClick={closeMenu}>
                    <FiPackage /> Products
                  </Link>
                  <Link to="/admin/orders" className={`mobile-link ${isActive('/admin/orders')}`} onClick={closeMenu}>
                    <FiShoppingBag /> Orders
                  </Link>
                  <Link to="/admin/settings" className={`mobile-link ${isActive('/admin/settings')}`} onClick={closeMenu}>
                    <FiSettings /> Settings
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/shop" className={`mobile-link ${isActive('/shop')}`} onClick={closeMenu}>
                    <FiShoppingCart /> Shop
                  </Link>
                  <Link to="/orders" className={`mobile-link ${isActive('/orders')}`} onClick={closeMenu}>
                    <FiPackage /> My Orders
                  </Link>
                </>
              )}
              <div className="mobile-divider" />
              <button onClick={handleLogout} className="mobile-link mobile-logout">
                <FiLogOut /> Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/shop" className={`mobile-link ${isActive('/shop')}`} onClick={closeMenu}>
                <FiShoppingCart /> Shop
              </Link>
              <Link to="/login" className={`mobile-link ${isActive('/login')}`} onClick={closeMenu}>
                <FiUser /> Login
              </Link>
              <Link to="/register" className={`mobile-link ${isActive('/register')}`} onClick={closeMenu}>
                <FiHome /> Sign Up
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Bottom tab bar for mobile */}
      <div className="bottom-tab-bar mobile-only">
        {user?.role === 'admin' ? (
          <>
            <Link to="/admin" className={`tab-item ${isActive('/admin')}`}>
              <FiGrid />
              <span>Dashboard</span>
            </Link>
            <Link to="/admin/products" className={`tab-item ${isActive('/admin/products')}`}>
              <FiPackage />
              <span>Products</span>
            </Link>
            <Link to="/admin/orders" className={`tab-item ${isActive('/admin/orders')}`}>
              <FiShoppingBag />
              <span>Orders</span>
            </Link>
          </>
        ) : (
          <>
            <Link to="/shop" className={`tab-item ${isActive('/shop')}`}>
              <FiShoppingCart />
              <span>Shop</span>
            </Link>
            {user && (
              <Link to="/orders" className={`tab-item ${isActive('/orders')}`}>
                <FiPackage />
                <span>Orders</span>
              </Link>
            )}
          </>
        )}
        <button onClick={toggleTheme} className="tab-item">
          {dark ? <FiSun /> : <FiMoon />}
          <span>{dark ? 'Light' : 'Dark'}</span>
        </button>
      </div>
    </>
  );
}
