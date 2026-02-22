import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchProducts, fetchOrders } from '../../services/api';
import { FiPackage, FiShoppingBag, FiUsers, FiDollarSign, FiTrendingUp } from 'react-icons/fi';

export default function AdminDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState({ products: 0, orders: 0, revenue: 0, stock: 0 });
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [products, orders] = await Promise.all([
          fetchProducts(),
          fetchOrders(token),
        ]);
        const revenue = orders.reduce((sum, o) => sum + o.total, 0);
        const totalStock = products.reduce((sum, p) => sum + p.quantity, 0);
        setStats({
          products: products.length,
          orders: orders.length,
          revenue,
          stock: totalStock,
        });
        setRecentOrders(orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5));
      } catch {
        console.error('Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [token]);

  if (loading) return <div className="loading">Loading dashboard...</div>;

  return (
    <div className="admin-dashboard">
      <h1><FiTrendingUp /> Admin Dashboard</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <FiPackage className="stat-icon" />
          <div>
            <h3>{stats.products}</h3>
            <p>Products</p>
          </div>
        </div>
        <div className="stat-card">
          <FiShoppingBag className="stat-icon" />
          <div>
            <h3>{stats.orders}</h3>
            <p>Orders</p>
          </div>
        </div>
        <div className="stat-card">
          <FiDollarSign className="stat-icon" />
          <div>
            <h3>${stats.revenue.toFixed(2)}</h3>
            <p>Revenue</p>
          </div>
        </div>
        <div className="stat-card">
          <FiUsers className="stat-icon" />
          <div>
            <h3>{stats.stock}</h3>
            <p>Total Stock</p>
          </div>
        </div>
      </div>

      <div className="dashboard-section">
        <h2>Recent Orders</h2>
        {recentOrders.length === 0 ? (
          <p className="muted">No orders yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map(order => (
                <tr key={order.id}>
                  <td>#{order.id}</td>
                  <td>{order.customerName}</td>
                  <td>{order.items.length} items</td>
                  <td>${order.total.toFixed(2)}</td>
                  <td><span className={`status-badge ${order.status}`}>{order.status}</span></td>
                  <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
