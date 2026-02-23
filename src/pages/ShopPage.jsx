import { useState, useEffect } from 'react';
import { fetchProducts } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { placeOrder } from '../services/api';
import { FiShoppingCart, FiPackage, FiSearch, FiCheck, FiSmartphone } from 'react-icons/fi';
import MpesaPaymentModal from '../components/MpesaPaymentModal';

export default function ShopPage() {
  const { user, token } = useAuth();
  const { formatPrice } = useSettings();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingOrder, setPendingOrder] = useState(null);
  const [showPayment, setShowPayment] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const data = await fetchProducts();
      setProducts(data.filter(p => p.quantity > 0));
    } catch {
      setError('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const categories = ['All', ...new Set(products.map(p => p.category))];

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === 'All' || p.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  const addToCart = (product, size, color) => {
    const existing = cart.find(
      i => i.productId === product.id && i.size === size && i.color === color
    );
    if (existing) {
      setCart(cart.map(i =>
        i === existing ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setCart([...cart, {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        size,
        color,
        image: product.image,
      }]);
    }
    setShowCart(true);
  };

  const removeFromCart = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleCheckout = async () => {
    if (!user) {
      setError('Please login to place an order');
      return;
    }
    try {
      const order = await placeOrder(token, cart.map(i => ({
        productId: i.productId,
        quantity: i.quantity,
        size: i.size,
        color: i.color,
      })));
      setCart([]);
      setPendingOrder(order);
      setShowPayment(true);
      loadProducts();
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePaymentComplete = () => {
    setShowPayment(false);
    setPendingOrder(null);
    setOrderSuccess(true);
    setTimeout(() => setOrderSuccess(false), 4000);
  };

  const handleSkipPayment = () => {
    setShowPayment(false);
    setPendingOrder(null);
    setOrderSuccess(true);
    setTimeout(() => setOrderSuccess(false), 4000);
  };

  if (loading) return <div className="loading"><FiPackage /> Loading products...</div>;

  return (
    <div className="shop-page">
      <div className="shop-header">
        <h1><FiPackage /> T-Shirt Collection</h1>
        <p>Browse our premium t-shirts ready for custom printing</p>
      </div>

      <div className="shop-controls">
        <div className="search-bar">
          <FiSearch />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="category-filters">
          {categories.map(cat => (
            <button
              key={cat}
              className={`filter-btn ${categoryFilter === cat ? 'active' : ''}`}
              onClick={() => setCategoryFilter(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
        {user && (
          <button className="btn btn-cart" onClick={() => setShowCart(!showCart)}>
            <FiShoppingCart />
            Cart ({cart.length})
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {orderSuccess && (
        <div className="alert alert-success">
          <FiCheck /> Order placed successfully! Check your orders for status & payment.
        </div>
      )}

      {showPayment && pendingOrder && (
        <div className="payment-choice-overlay" onClick={handleSkipPayment}>
          <div className="payment-choice-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Order Placed! 🎉</h2>
            <p>Order #{pendingOrder.id} has been created.</p>
            <p className="payment-prompt">Would you like to pay now via M-Pesa?</p>
            <div className="payment-choice-buttons">
              <button
                className="btn btn-mpesa"
                onClick={() => {
                  setShowPayment(false);
                  setPendingOrder({ ...pendingOrder, _showMpesa: true });
                }}
              >
                <FiSmartphone /> Pay with M-Pesa
              </button>
              <button className="btn btn-secondary" onClick={handleSkipPayment}>
                Pay Later
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingOrder?._showMpesa && (
        <MpesaPaymentModal
          order={pendingOrder}
          onClose={() => { setPendingOrder(null); handlePaymentComplete(); }}
          onPaymentComplete={handlePaymentComplete}
        />
      )}

      <div className="shop-layout">
        <div className="products-grid">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <FiPackage />
              <p>No products found</p>
            </div>
          ) : (
            filtered.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={addToCart}
                isLoggedIn={!!user}
                formatPrice={formatPrice}
              />
            ))
          )}
        </div>

        {showCart && user && (
          <div className="cart-sidebar">
            <h3><FiShoppingCart /> Your Cart</h3>
            {cart.length === 0 ? (
              <p className="cart-empty">Your cart is empty</p>
            ) : (
              <>
                {cart.map((item, i) => (
                  <div key={i} className="cart-item">
                    <img src={item.image} alt={item.name} />
                    <div className="cart-item-info">
                      <h4>{item.name}</h4>
                      <p>{item.size} • {item.color}</p>
                      <p className="cart-item-price">
                        {formatPrice(item.price)} × {item.quantity}
                      </p>
                    </div>
                    <button onClick={() => removeFromCart(i)} className="btn-remove">×</button>
                  </div>
                ))}
                <div className="cart-total">
                  <strong>Total: {formatPrice(cartTotal)}</strong>
                </div>
                <button onClick={handleCheckout} className="btn btn-primary btn-full">
                  Place Order
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ProductCard({ product, onAddToCart, isLoggedIn, formatPrice }) {
  const [selectedSize, setSelectedSize] = useState(product.sizes[0]);
  const [selectedColor, setSelectedColor] = useState(product.colors[0]);

  return (
    <div className="product-card">
      <div className="product-image">
        <img src={product.image} alt={product.name} />
        <span className="product-category">{product.category}</span>
      </div>
      <div className="product-info">
        <h3>{product.name}</h3>
        <p className="product-desc">{product.description}</p>
        <div className="product-price">{formatPrice(product.price)}</div>
        <div className="product-stock">
          {product.quantity > 0 ? `${product.quantity} in stock` : 'Out of stock'}
        </div>

        <div className="product-options">
          <div className="option-group">
            <label>Size:</label>
            <div className="option-buttons">
              {product.sizes.map(s => (
                <button
                  key={s}
                  className={`option-btn ${selectedSize === s ? 'active' : ''}`}
                  onClick={() => setSelectedSize(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="option-group">
            <label>Color:</label>
            <div className="option-buttons">
              {product.colors.map(c => (
                <button
                  key={c}
                  className={`option-btn ${selectedColor === c ? 'active' : ''}`}
                  onClick={() => setSelectedColor(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoggedIn ? (
          <button
            className="btn btn-primary btn-full"
            onClick={() => onAddToCart(product, selectedSize, selectedColor)}
          >
            <FiShoppingCart /> Add to Cart
          </button>
        ) : (
          <p className="login-prompt">Login to order</p>
        )}
      </div>
    </div>
  );
}
