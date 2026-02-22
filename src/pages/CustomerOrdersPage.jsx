import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { fetchOrders } from '../services/api';
import { FiPackage, FiClock, FiCheckCircle, FiTruck } from 'react-icons/fi';

export default function CustomerOrdersPage() {
  const { token } = useAuth();
  const { formatPrice } = useSettings();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const statusIcon = (status) => {
    switch (status) {
      case 'pending': return <FiClock className="status-icon pending" />;
      case 'processing': return <FiTruck className="status-icon processing" />;
      case 'completed': return <FiCheckCircle className="status-icon completed" />;
      default: return <FiClock />;
    }
  };

  if (loading) return <div className="loading">Loading orders...</div>;

  return (
    <div className="orders-page">
      <h1><FiPackage /> My Orders</h1>

      {orders.length === 0 ? (
        <div className="empty-state">
          <FiPackage />
          <p>You haven't placed any orders yet.</p>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map(order => (
            <div key={order.id} className="order-card">
              <div className="order-header">
                <div>
                  <h3>Order #{order.id}</h3>
                  <p className="order-date">
                    {new Date(order.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
                <div className={`order-status ${order.status}`}>
                  {statusIcon(order.status)}
                  <span>{order.status}</span>
                </div>
              </div>

              <div className="order-items">
                {order.items.map((item, i) => (
                  <div key={i} className="order-item">
                    <span className="item-name">{item.name}</span>
                    <span className="item-details">{item.size} • {item.color}</span>
                    <span className="item-qty">×{item.quantity}</span>
                    <span className="item-price">{formatPrice(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="order-total">
                <strong>Total: {formatPrice(order.total)}</strong>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
