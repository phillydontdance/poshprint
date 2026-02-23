import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { fetchOrders, updateOrderStatus, updateOrderPayment } from '../../services/api';
import { FiPackage, FiClock, FiCheckCircle, FiTruck, FiRefreshCw, FiDollarSign, FiSmartphone, FiMapPin, FiShoppingBag, FiTrendingUp } from 'react-icons/fi';

export default function AdminOrders() {
  const { token } = useAuth();
  const { formatPrice } = useSettings();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const loadOrders = async () => {
    if (!token) return;
    try {
      const data = await fetchOrders(token);
      setOrders(data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch {
      console.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadOrders(); }, [token]);

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await updateOrderStatus(token, orderId, newStatus);
      loadOrders();
    } catch {
      console.error('Failed to update status');
    }
  };

  const handleMarkPaid = async (orderId) => {
    try {
      await updateOrderPayment(token, orderId, {
        paymentStatus: 'paid',
        paymentMethod: 'manual',
      });
      loadOrders();
    } catch {
      console.error('Failed to update payment');
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
                    <span className="item-price">{formatPrice(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              {order.deliveryMethod && (
                <div className="order-delivery-info">
                  {order.deliveryMethod === 'delivery' ? (
                    <><FiMapPin className="delivery-badge-icon" /> <span>Delivery to: <strong>{order.deliveryLocation}</strong></span></>
                  ) : (
                    <><FiShoppingBag className="delivery-badge-icon" /> <span>Shop Pickup</span></>
                  )}
                  {order.customerPhone && <span className="customer-phone"> • Phone: {order.customerPhone}</span>}
                </div>
              )}

              <div className="order-total">
                <strong>Total: {formatPrice(order.total)}</strong>
                {(() => {
                  const orderCost = order.items.reduce((s, i) => s + (i.costPrice || 0) * i.quantity, 0);
                  const orderProfit = order.total - orderCost;
                  return orderCost > 0 ? (
                    <span className={`order-profit ${orderProfit >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                      <FiTrendingUp /> Profit: {formatPrice(orderProfit)}
                    </span>
                  ) : null;
                })()}
                <div className="order-payment-info">
                  <span className={`payment-badge ${order.paymentStatus || 'unpaid'}`}>
                    {order.paymentStatus === 'paid' ? <FiCheckCircle /> : <FiDollarSign />}
                    {order.paymentStatus === 'paid'
                      ? `Paid${order.paymentMethod === 'mpesa' || order.paymentMethod === 'mpesa-manual' ? ' (M-Pesa)' : order.paymentMethod === 'manual' ? ' (Manual)' : ''}`
                      : order.paymentStatus === 'pending'
                        ? 'Awaiting Verification'
                        : 'Unpaid'}
                    {order.mpesaReceiptNumber && <small> • {order.mpesaReceiptNumber}</small>}
                  </span>
                  {order.mpesaPhone && (
                    <span className="mpesa-phone-info">
                      <FiSmartphone /> {order.mpesaPhone}
                    </span>
                  )}
                  {order.paymentStatus !== 'paid' && (
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => handleMarkPaid(order.id)}
                    >
                      <FiCheckCircle /> Mark Paid
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
