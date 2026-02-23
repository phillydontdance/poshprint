import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { fetchAdminProducts, fetchOrders } from '../../services/api';
import { FiPackage, FiShoppingBag, FiUsers, FiDollarSign, FiTrendingUp, FiPercent } from 'react-icons/fi';

export default function AdminDashboard() {
  const { token } = useAuth();
  const { formatPrice } = useSettings();
  const [stats, setStats] = useState({ products: 0, orders: 0, revenue: 0, cost: 0, profit: 0, stock: 0 });
  const [recentOrders, setRecentOrders] = useState([]);
  const [productProfits, setProductProfits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    const loadData = async () => {
      try {
        const [products, orders] = await Promise.all([
          fetchAdminProducts(token),
          fetchOrders(token),
        ]);
        const revenue = orders.reduce((sum, o) => sum + o.total, 0);
        const totalCost = orders.reduce((sum, o) =>
          sum + o.items.reduce((s, i) => s + (i.costPrice || 0) * i.quantity, 0), 0);
        const totalStock = products.reduce((sum, p) => sum + p.quantity, 0);

        // Calculate per-product profit from orders
        const profitMap = {};
        orders.forEach(o => {
          o.items.forEach(item => {
            if (!profitMap[item.productId]) {
              profitMap[item.productId] = { name: item.name, sold: 0, revenue: 0, cost: 0 };
            }
            profitMap[item.productId].sold += item.quantity;
            profitMap[item.productId].revenue += item.price * item.quantity;
            profitMap[item.productId].cost += (item.costPrice || 0) * item.quantity;
          });
        });
        const profitList = Object.values(profitMap)
          .map(p => ({ ...p, profit: p.revenue - p.cost }))
          .sort((a, b) => b.profit - a.profit);

        setStats({
          products: products.length,
          orders: orders.length,
          revenue,
          cost: totalCost,
          profit: revenue - totalCost,
          stock: totalStock,
        });
        setProductProfits(profitList);
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

  const profitMargin = stats.revenue > 0 ? ((stats.profit / stats.revenue) * 100).toFixed(1) : 0;

  return (
    <div className="admin-dashboard">
      <h1><FiTrendingUp /> Admin Dashboard</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <FiDollarSign className="stat-icon" />
          <div>
            <h3>{formatPrice(stats.revenue)}</h3>
            <p>Total Revenue</p>
          </div>
        </div>
        <div className="stat-card stat-cost">
          <FiShoppingBag className="stat-icon" />
          <div>
            <h3>{formatPrice(stats.cost)}</h3>
            <p>Total Cost</p>
          </div>
        </div>
        <div className="stat-card stat-profit">
          <FiTrendingUp className="stat-icon" />
          <div>
            <h3>{formatPrice(stats.profit)}</h3>
            <p>Total Profit</p>
          </div>
        </div>
        <div className="stat-card">
          <FiPercent className="stat-icon" />
          <div>
            <h3>{profitMargin}%</h3>
            <p>Profit Margin</p>
          </div>
        </div>
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
          <FiUsers className="stat-icon" />
          <div>
            <h3>{stats.stock}</h3>
            <p>Total Stock</p>
          </div>
        </div>
      </div>

      {productProfits.length > 0 && (
        <div className="dashboard-section">
          <h2><FiTrendingUp /> Profit by Product</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Sold</th>
                <th>Revenue</th>
                <th>Cost</th>
                <th>Profit</th>
                <th>Margin</th>
              </tr>
            </thead>
            <tbody>
              {productProfits.map((p, i) => (
                <tr key={i}>
                  <td><strong>{p.name}</strong></td>
                  <td>{p.sold}</td>
                  <td>{formatPrice(p.revenue)}</td>
                  <td>{formatPrice(p.cost)}</td>
                  <td className={p.profit >= 0 ? 'profit-positive' : 'profit-negative'}>
                    {formatPrice(p.profit)}
                  </td>
                  <td>{p.revenue > 0 ? ((p.profit / p.revenue) * 100).toFixed(1) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
                  <td>{formatPrice(order.total)}</td>
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
