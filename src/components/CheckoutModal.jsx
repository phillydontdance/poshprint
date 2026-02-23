import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { placeOrder, initiateMpesaPayment, checkPaymentStatus } from '../services/api';
import {
  FiSmartphone, FiCheckCircle, FiXCircle, FiLoader, FiX,
  FiMapPin, FiShoppingBag, FiTruck, FiArrowRight, FiArrowLeft
} from 'react-icons/fi';

/**
 * Combined Checkout Modal
 * Step 1: Delivery method (pickup / delivery + location)
 * Step 2: Payment method (M-Pesa / Pay Later)
 * Step 3: M-Pesa phone + STK push flow
 * Step 4: Success
 */
export default function CheckoutModal({ cartItems, cartTotal, onClose, onComplete }) {
  const { token } = useAuth();
  const { formatPrice } = useSettings();

  // Checkout steps
  const [step, setStep] = useState('delivery'); // delivery | payment | mpesa | processing | waiting | success | failed

  // Delivery
  const [deliveryMethod, setDeliveryMethod] = useState('pickup');
  const [deliveryLocation, setDeliveryLocation] = useState('');

  // Payment / M-Pesa
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [order, setOrder] = useState(null);
  const [receiptNumber, setReceiptNumber] = useState('');
  const pollRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Step 1 → Step 2: Place order, then ask for payment
  const handleDeliveryNext = async () => {
    setError('');

    if (deliveryMethod === 'delivery' && !deliveryLocation.trim()) {
      setError('Please enter your delivery location');
      return;
    }

    setStep('processing');

    try {
      const newOrder = await placeOrder(
        token,
        cartItems.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          size: i.size,
          color: i.color,
        })),
        {
          method: deliveryMethod,
          location: deliveryLocation.trim(),
          phone: phone,
        }
      );
      setOrder(newOrder);
      setStep('payment');
    } catch (err) {
      setError(err.message);
      setStep('delivery');
    }
  };

  // Step 2 → Pay Later (done)
  const handlePayLater = () => {
    if (onComplete) onComplete(order);
  };

  // Step 2 → Step 3: Show M-Pesa phone input
  const handlePayMpesa = () => {
    setStep('mpesa');
  };

  // Step 3: Send STK Push
  const handleMpesaSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleaned = phone.replace(/\s+/g, '').replace(/[^0-9]/g, '');
    if (cleaned.length < 9) {
      setError('Please enter a valid phone number');
      return;
    }

    // Ensure phone starts with 254
    let formattedPhone = cleaned;
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.slice(1);
    } else if (formattedPhone.startsWith('7') || formattedPhone.startsWith('1')) {
      formattedPhone = '254' + formattedPhone;
    }

    setStep('sending');

    try {
      await initiateMpesaPayment(token, order.id, formattedPhone);
      setStep('waiting');
      startPolling();
    } catch (err) {
      setError(err.message);
      setStep('mpesa');
    }
  };

  const startPolling = () => {
    let attempts = 0;
    const maxAttempts = 40;

    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const status = await checkPaymentStatus(token, order.id);
        if (status.paymentStatus === 'paid') {
          clearInterval(pollRef.current);
          setReceiptNumber(status.mpesaReceiptNumber || '');
          setStep('success');
        } else if (status.paymentStatus === 'failed') {
          clearInterval(pollRef.current);
          setError('Payment was not completed. Please try again.');
          setStep('failed');
        }
      } catch {
        // keep polling
      }
      if (attempts >= maxAttempts) {
        clearInterval(pollRef.current);
        setError('Payment verification timed out. If you paid, the status will update shortly.');
        setStep('failed');
      }
    }, 3000);
  };

  const handleDone = () => {
    if (onComplete) onComplete(order);
  };

  return (
    <div className="checkout-overlay" onClick={onClose}>
      <div className="checkout-modal" onClick={(e) => e.stopPropagation()}>
        <button className="mpesa-close" onClick={onClose}><FiX /></button>

        {/* Progress bar */}
        <div className="checkout-progress">
          <div className={`progress-step ${['delivery', 'payment', 'mpesa', 'processing', 'sending', 'waiting', 'success', 'failed'].includes(step) ? 'active' : ''}`}>
            <span className="progress-dot">1</span>
            <span>Delivery</span>
          </div>
          <div className="progress-line" />
          <div className={`progress-step ${['payment', 'mpesa', 'sending', 'waiting', 'success', 'failed'].includes(step) ? 'active' : ''}`}>
            <span className="progress-dot">2</span>
            <span>Payment</span>
          </div>
          <div className="progress-line" />
          <div className={`progress-step ${step === 'success' ? 'active' : ''}`}>
            <span className="progress-dot">3</span>
            <span>Done</span>
          </div>
        </div>

        {/* Order summary */}
        <div className="checkout-summary">
          <strong>Order Total: {formatPrice(cartTotal)}</strong>
          <span>{cartItems.length} item{cartItems.length > 1 ? 's' : ''}</span>
        </div>

        {/* ===== STEP 1: Delivery ===== */}
        {step === 'delivery' && (
          <div className="checkout-step">
            <h2><FiTruck /> Delivery Method</h2>

            <div className="delivery-options">
              <label
                className={`delivery-option ${deliveryMethod === 'pickup' ? 'selected' : ''}`}
                onClick={() => setDeliveryMethod('pickup')}
              >
                <input
                  type="radio"
                  name="delivery"
                  checked={deliveryMethod === 'pickup'}
                  onChange={() => setDeliveryMethod('pickup')}
                />
                <div className="delivery-option-content">
                  <FiShoppingBag className="delivery-icon" />
                  <div>
                    <strong>Shop Pickup</strong>
                    <p>Pick up your order from our shop</p>
                  </div>
                </div>
              </label>

              <label
                className={`delivery-option ${deliveryMethod === 'delivery' ? 'selected' : ''}`}
                onClick={() => setDeliveryMethod('delivery')}
              >
                <input
                  type="radio"
                  name="delivery"
                  checked={deliveryMethod === 'delivery'}
                  onChange={() => setDeliveryMethod('delivery')}
                />
                <div className="delivery-option-content">
                  <FiTruck className="delivery-icon" />
                  <div>
                    <strong>Delivery</strong>
                    <p>We deliver to your location</p>
                  </div>
                </div>
              </label>
            </div>

            {deliveryMethod === 'delivery' && (
              <div className="form-group">
                <label htmlFor="delivery-location">
                  <FiMapPin /> Delivery Location
                </label>
                <textarea
                  id="delivery-location"
                  placeholder="Enter your delivery address, area, landmark, or building name..."
                  value={deliveryLocation}
                  onChange={(e) => setDeliveryLocation(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            {error && <div className="mpesa-error">{error}</div>}

            <button className="btn btn-primary btn-full" onClick={handleDeliveryNext}>
              Continue to Payment <FiArrowRight />
            </button>
          </div>
        )}

        {/* ===== PROCESSING (placing order) ===== */}
        {step === 'processing' && (
          <div className="mpesa-status">
            <div className="mpesa-spinner"><FiLoader className="spin" /></div>
            <h3>Placing your order...</h3>
          </div>
        )}

        {/* ===== STEP 2: Payment Choice ===== */}
        {step === 'payment' && (
          <div className="checkout-step">
            <h2><FiSmartphone /> Payment</h2>
            <p className="checkout-subtitle">Order #{order?.id} created! How would you like to pay?</p>

            <div className="payment-options">
              <button className="btn btn-mpesa btn-full" onClick={handlePayMpesa}>
                <FiSmartphone /> Pay Now with M-Pesa
              </button>
              <button className="btn btn-secondary btn-full" onClick={handlePayLater}>
                Pay Later
              </button>
            </div>

            <button className="btn-text" onClick={() => setStep('delivery')}>
              <FiArrowLeft /> Back to delivery
            </button>
          </div>
        )}

        {/* ===== STEP 3: M-Pesa Phone ===== */}
        {step === 'mpesa' && (
          <div className="checkout-step">
            <div className="mpesa-logo">
              <FiSmartphone />
              <span>M-Pesa</span>
            </div>
            <h2>Enter M-Pesa Number</h2>
            <p className="checkout-subtitle">
              Amount: <strong>{formatPrice(order?.total)}</strong>
            </p>

            <form onSubmit={handleMpesaSubmit}>
              <div className="form-group">
                <label htmlFor="mpesa-phone">Phone Number</label>
                <div className="phone-input-wrapper">
                  <span className="phone-prefix">+254</span>
                  <input
                    id="mpesa-phone"
                    type="tel"
                    placeholder="7XX XXX XXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
              </div>

              {error && <div className="mpesa-error">{error}</div>}

              <button type="submit" className="btn btn-mpesa btn-full">
                <FiSmartphone /> Send Payment Request
              </button>
            </form>

            <button className="btn-text" onClick={() => setStep('payment')}>
              <FiArrowLeft /> Back
            </button>
          </div>
        )}

        {/* ===== SENDING STK ===== */}
        {step === 'sending' && (
          <div className="mpesa-status">
            <div className="mpesa-spinner"><FiLoader className="spin" /></div>
            <h3>Sending payment request...</h3>
            <p>Connecting to M-Pesa</p>
          </div>
        )}

        {/* ===== WAITING for PIN ===== */}
        {step === 'waiting' && (
          <div className="mpesa-status">
            <div className="mpesa-spinner pulse"><FiSmartphone /></div>
            <h3>Check your phone</h3>
            <p>Enter your M-Pesa PIN to complete the payment.</p>
            <div className="mpesa-waiting-steps">
              <div className="waiting-step active">
                <span className="step-num">1</span><span>STK Push sent ✓</span>
              </div>
              <div className="waiting-step">
                <span className="step-num">2</span><span>Enter PIN on phone</span>
              </div>
              <div className="waiting-step">
                <span className="step-num">3</span><span>Confirming payment...</span>
              </div>
            </div>
            <p className="mpesa-hint">Do not close this window</p>
          </div>
        )}

        {/* ===== SUCCESS ===== */}
        {step === 'success' && (
          <div className="mpesa-status success">
            <div className="mpesa-icon success"><FiCheckCircle /></div>
            <h3>Payment Successful!</h3>
            <p>Your M-Pesa payment has been confirmed.</p>
            {receiptNumber && (
              <div className="mpesa-receipt">
                <span>Receipt: </span><strong>{receiptNumber}</strong>
              </div>
            )}
            <p className="checkout-delivery-confirm">
              {order?.deliveryMethod === 'delivery'
                ? `📦 Delivering to: ${order.deliveryLocation}`
                : '🏪 Ready for shop pickup'}
            </p>
            <button onClick={handleDone} className="btn btn-primary btn-full">Done</button>
          </div>
        )}

        {/* ===== FAILED ===== */}
        {step === 'failed' && (
          <div className="mpesa-status failed">
            <div className="mpesa-icon failed"><FiXCircle /></div>
            <h3>Payment Failed</h3>
            <p>{error}</p>
            <p className="checkout-delivery-confirm" style={{ marginTop: '0.5rem' }}>
              Your order #{order?.id} has been saved. You can pay later from your orders page.
            </p>
            <div className="mpesa-actions">
              <button onClick={() => { setStep('mpesa'); setError(''); }} className="btn btn-mpesa">
                Try Again
              </button>
              <button onClick={handleDone} className="btn btn-secondary">
                Continue Without Paying
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
