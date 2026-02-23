import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { placeOrder, confirmManualPayment, initiateMpesaPayment, checkPaymentStatus } from '../services/api';
import {
  FiSmartphone, FiCheckCircle, FiXCircle, FiLoader, FiX,
  FiMapPin, FiShoppingBag, FiTruck, FiArrowRight, FiArrowLeft, FiCopy, FiPhone
} from 'react-icons/fi';
import LocationPicker from './LocationPicker';

const MPESA_PHONE = '0706276584';
const MPESA_NAME = 'Posh Print';

/**
 * Checkout Modal
 * Step 1: Delivery (pickup / delivery with map)
 * Step 2: Payment choice (STK Push prompt / Send Money manually / Pay Later)
 * Step 3a: STK Push → phone input → waiting for PIN → success
 * Step 3b: Manual → enter confirmation code → success
 * Step 4: Success
 */
export default function CheckoutModal({ cartItems, cartTotal, onClose, onComplete }) {
  const { token } = useAuth();
  const { formatPrice } = useSettings();

  const [step, setStep] = useState('delivery');

  // Delivery
  const [deliveryMethod, setDeliveryMethod] = useState('pickup');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [deliveryCoords, setDeliveryCoords] = useState(null);

  // Payment
  const [confirmationCode, setConfirmationCode] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [order, setOrder] = useState(null);
  const [copied, setCopied] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState('');
  const timerRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    const timer = timerRef.current;
    const poll = pollRef.current;
    return () => {
      if (timer) clearTimeout(timer);
      if (poll) clearInterval(poll);
    };
  }, []);

  const handleLocationSelect = (location) => {
    setDeliveryLocation(location.address);
    setDeliveryCoords({ lat: location.lat, lng: location.lng });
  };

  // Step 1 → Place order → Step 2
  const handleDeliveryNext = async () => {
    setError('');
    if (deliveryMethod === 'delivery' && !deliveryLocation.trim()) {
      setError('Please select your delivery location on the map');
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
          coords: deliveryCoords,
        }
      );
      setOrder(newOrder);
      setStep('payment');
    } catch (err) {
      setError(err.message);
      setStep('delivery');
    }
  };

  const handlePayLater = () => {
    if (onComplete) onComplete(order);
  };

  const handleCopyNumber = () => {
    navigator.clipboard.writeText(MPESA_PHONE).catch(() => {});
    setCopied(true);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  // STK Push: send payment prompt to phone
  const handleMpesaPrompt = async (e) => {
    e.preventDefault();
    setError('');

    const cleaned = phone.replace(/\s+/g, '').replace(/[^0-9]/g, '');
    if (cleaned.length < 9) {
      setError('Please enter a valid phone number');
      return;
    }

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

  // Submit manual confirmation code
  const handleConfirmPayment = async (e) => {
    e.preventDefault();
    setError('');

    const code = confirmationCode.trim().toUpperCase();
    if (!code || code.length < 8) {
      setError('Please enter a valid M-Pesa confirmation code (e.g. SLK4H7TXY2)');
      return;
    }

    setStep('verifying');

    try {
      await confirmManualPayment(token, order.id, code);
      setStep('success');
    } catch (err) {
      setError(err.message);
      setStep('confirm');
    }
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
          <div className={`progress-step ${step !== '' ? 'active' : ''}`}>
            <span className="progress-dot">1</span>
            <span>Delivery</span>
          </div>
          <div className="progress-line" />
          <div className={`progress-step ${['payment', 'mpesa', 'manual', 'confirm', 'sending', 'waiting', 'verifying', 'success', 'failed'].includes(step) ? 'active' : ''}`}>
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
          <strong>Total: {formatPrice(cartTotal)}</strong>
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
                <input type="radio" name="delivery" checked={deliveryMethod === 'pickup'} onChange={() => setDeliveryMethod('pickup')} />
                <div className="delivery-option-content">
                  <FiShoppingBag className="delivery-icon" />
                  <div>
                    <strong>Shop Pickup</strong>
                    <p>Pick up from our shop — no extra charge</p>
                  </div>
                </div>
              </label>

              <label
                className={`delivery-option ${deliveryMethod === 'delivery' ? 'selected' : ''}`}
                onClick={() => setDeliveryMethod('delivery')}
              >
                <input type="radio" name="delivery" checked={deliveryMethod === 'delivery'} onChange={() => setDeliveryMethod('delivery')} />
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
              <div className="delivery-map-section">
                <label><FiMapPin /> Select your delivery location</label>
                <LocationPicker
                  onLocationSelect={handleLocationSelect}
                  initialAddress={deliveryLocation}
                />
              </div>
            )}

            {error && <div className="mpesa-error">{error}</div>}

            <button className="btn btn-primary btn-full" onClick={handleDeliveryNext}>
              Continue to Payment <FiArrowRight />
            </button>
          </div>
        )}

        {/* Processing */}
        {step === 'processing' && (
          <div className="mpesa-status">
            <div className="mpesa-spinner"><FiLoader className="spin" /></div>
            <h3>Placing your order...</h3>
          </div>
        )}

        {/* ===== STEP 2: Payment Choice ===== */}
        {step === 'payment' && (
          <div className="checkout-step">
            <div className="mpesa-logo">
              <FiSmartphone />
              <span>M-Pesa</span>
            </div>
            <h2>Pay with M-Pesa</h2>
            <p className="checkout-subtitle">Order #{order?.id} — {formatPrice(order?.total)}</p>

            <div className="payment-options">
              <button className="btn btn-mpesa btn-full" onClick={() => setStep('mpesa')}>
                <FiPhone /> Pay Now — Get Prompt on Phone
              </button>
              <button className="btn btn-secondary btn-full" onClick={() => setStep('manual')}>
                <FiCopy /> Send Money Manually
              </button>
              <button className="btn btn-secondary btn-full" onClick={handlePayLater} style={{ opacity: 0.7 }}>
                Pay Later
              </button>
            </div>

            <button className="btn-text" onClick={() => setStep('delivery')}>
              <FiArrowLeft /> Back to delivery
            </button>
          </div>
        )}

        {/* ===== STEP 3a: M-Pesa STK Push — Phone Input ===== */}
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

            <form onSubmit={handleMpesaPrompt}>
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
                <FiSmartphone /> Send Payment Prompt
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
            <h3>Sending payment prompt...</h3>
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

        {/* ===== STEP 3b: Manual Payment Instructions ===== */}
        {step === 'manual' && (
          <div className="checkout-step">
            <div className="mpesa-logo">
              <FiSmartphone />
              <span>M-Pesa</span>
            </div>
            <h2>Send Money Manually</h2>
            <p className="checkout-subtitle">Order #{order?.id} — {formatPrice(order?.total)}</p>

            <div className="mpesa-instructions">
              <h3>Send money to:</h3>
              <div className="mpesa-pay-details">
                <div className="pay-detail-row">
                  <span className="pay-label">Phone Number</span>
                  <div className="pay-value-row">
                    <strong className="pay-number">{MPESA_PHONE}</strong>
                    <button type="button" className="btn-copy" onClick={handleCopyNumber}>
                      <FiCopy /> {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
                <div className="pay-detail-row">
                  <span className="pay-label">Name</span>
                  <strong>{MPESA_NAME}</strong>
                </div>
                <div className="pay-detail-row">
                  <span className="pay-label">Amount</span>
                  <strong className="pay-amount">{formatPrice(order?.total)}</strong>
                </div>
              </div>

              <div className="mpesa-steps-guide">
                <h4>How to pay:</h4>
                <ol>
                  <li>Open M-Pesa on your phone</li>
                  <li>Select <strong>Send Money</strong></li>
                  <li>Enter number: <strong>{MPESA_PHONE}</strong></li>
                  <li>Enter amount: <strong>{formatPrice(order?.total)}</strong></li>
                  <li>Enter your M-Pesa PIN &amp; confirm</li>
                  <li>Enter the confirmation code below</li>
                </ol>
              </div>
            </div>

            <button className="btn btn-mpesa btn-full" onClick={() => setStep('confirm')} style={{ marginTop: '1rem' }}>
              I&apos;ve Sent the Money <FiArrowRight />
            </button>

            <button className="btn-text" onClick={() => setStep('payment')} style={{ display: 'block', margin: '0.75rem auto 0' }}>
              <FiArrowLeft /> Back to payment options
            </button>
          </div>
        )}

        {/* ===== STEP 3b cont: Enter Confirmation Code ===== */}
        {step === 'confirm' && (
          <div className="checkout-step">
            <div className="mpesa-logo">
              <FiSmartphone />
              <span>M-Pesa</span>
            </div>
            <h2>Enter Confirmation Code</h2>
            <p className="checkout-subtitle">
              Enter the M-Pesa confirmation code from the SMS you received.
            </p>

            <form onSubmit={handleConfirmPayment}>
              <div className="form-group">
                <label htmlFor="mpesa-code">M-Pesa Confirmation Code</label>
                <input
                  id="mpesa-code"
                  type="text"
                  className="confirmation-code-input"
                  placeholder="e.g. SLK4H7TXY2"
                  value={confirmationCode}
                  onChange={(e) => setConfirmationCode(e.target.value.toUpperCase())}
                  autoFocus
                  maxLength={12}
                  required
                />
              </div>

              {error && <div className="mpesa-error">{error}</div>}

              <button type="submit" className="btn btn-mpesa btn-full">
                <FiCheckCircle /> Confirm Payment
              </button>
            </form>

            <button className="btn-text" onClick={() => setStep('manual')}>
              <FiArrowLeft /> Back to instructions
            </button>
          </div>
        )}

        {/* Verifying */}
        {step === 'verifying' && (
          <div className="mpesa-status">
            <div className="mpesa-spinner"><FiLoader className="spin" /></div>
            <h3>Confirming payment...</h3>
          </div>
        )}

        {/* ===== SUCCESS ===== */}
        {step === 'success' && (
          <div className="mpesa-status success">
            <div className="mpesa-icon success"><FiCheckCircle /></div>
            <h3>Payment Successful! 🎉</h3>
            <p>Your M-Pesa payment has been confirmed.</p>
            {(receiptNumber || confirmationCode) && (
              <div className="mpesa-receipt">
                <span>Receipt: </span><strong>{receiptNumber || confirmationCode}</strong>
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
              <button onClick={() => { setStep('payment'); setError(''); }} className="btn btn-mpesa">
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
