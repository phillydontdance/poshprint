import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchOrders, updateOrderStatus } from '../../services/api';
import { FiPackage, FiClock, FiCheckCircle, FiTruck, FiRefreshCw } from 'react-icons/fi';

export default function AdminOrders() {
  const { token } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const data = await fetchOrders(token);
      setOrders(data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch {
      console.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await updateOrderStatus(token, orderId, newStatus);
      loadOrders();
    } catch {
      console.error('Failed to update status');
    }
  };

  const filteredOrders = filter === 'all'
    ? orders
    : orders.filter(o => o.status === filter);

  const statusIcon = (status) => {
    switch (status) {
      case 'pending': return <FiClock />;
      case 'processing': return <FiTruck />;
      case 'completed': return <FiCheckCircle />;
      default: return <FiClock />;
    }
  };

  if (loading) return <div className="loading">Loading orders...</div>;

  return (
    <div className="admin-orders">
      <div className="page-header">
        <h1><FiPackage /> Manage Orders</h1>
        <button onClick={loadOrders} className="btn btn-secondary">
          <FiRefreshCw /> Refresh
        </button>
      </div>

      <div className="order-filters">
        {['all', 'pending', 'processing', 'completed'].map(f => (
          <button
            key={f}
            className={`filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && ` (${orders.filter(o => o.status === f).length})`}
          </button>
        ))}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="empty-state">
          <FiPackage />
          <p>No orders found</p>
        </div>
      ) : (
        <div className="orders-list">
          {filteredOrders.map(order => (
            <div key={order.id} className="order-card admin-order-card">
              <div className="order-header">
                <div>
                  <h3>Order #{order.id}</h3>
                  <p className="order-meta">
                    <strong>Customer:</strong> {order.customerName} •
                    <strong> Date:</strong> {new Date(order.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="order-status-control">
                  {statusIcon(order.status)}
                  <select
                    value={order.status}
                    onChange={(e) => handleStatusChange(order.id, e.target.value)}
                    className={`status-select ${order.status}`}
                  >
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="order-items">
                {order.items.map((item, i) => (
                  <div key={i} className="order-item">
                    <span className="item-name">{item.name}</span>
                    <span className="item-details">{item.size} • {item.color}</span>
                    <span className="item-qty">×{item.quantity}</span>
                    <span className="item-price">${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="order-total">
                <strong>Total: ${order.total.toFixed(2)}</strong>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
