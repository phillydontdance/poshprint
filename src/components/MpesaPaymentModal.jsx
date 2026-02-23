import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { initiateMpesaPayment, checkPaymentStatus } from '../services/api';
import { FiSmartphone, FiCheckCircle, FiXCircle, FiLoader, FiX } from 'react-icons/fi';

export default function MpesaPaymentModal({ order, onClose, onPaymentComplete }) {
  const { token } = useAuth();
  const { formatPrice } = useSettings();
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState('input'); // input | sending | waiting | success | failed
  const [error, setError] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const pollRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Basic phone validation
    const cleaned = phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
    if (cleaned.length < 9) {
      setError('Please enter a valid phone number');
      return;
    }

    setStep('sending');

    try {
      await initiateMpesaPayment(token, order.id, phone);
      setStep('waiting');
      startPolling();
    } catch (err) {
      setError(err.message);
      setStep('input');
    }
  };

  const startPolling = () => {
    let attempts = 0;
    const maxAttempts = 40; // Poll for ~2 minutes

    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const status = await checkPaymentStatus(token, order.id);

        if (status.paymentStatus === 'paid') {
          clearInterval(pollRef.current);
          setReceiptNumber(status.mpesaReceiptNumber || '');
          setStep('success');
          if (onPaymentComplete) onPaymentComplete(status);
        } else if (status.paymentStatus === 'failed') {
          clearInterval(pollRef.current);
          setError('Payment was not completed. Please try again.');
          setStep('failed');
        }
      } catch {
        // Keep polling on network errors
      }

      if (attempts >= maxAttempts) {
        clearInterval(pollRef.current);
        setError('Payment verification timed out. If you paid, the status will update shortly.');
        setStep('failed');
      }
    }, 3000);
  };

  return (
    <div className="mpesa-modal-overlay" onClick={onClose}>
      <div className="mpesa-modal" onClick={(e) => e.stopPropagation()}>
        <button className="mpesa-close" onClick={onClose}>
          <FiX />
        </button>

        <div className="mpesa-header">
          <div className="mpesa-logo">
            <FiSmartphone />
            <span>M-Pesa</span>
          </div>
          <h2>Pay with M-Pesa</h2>
          <p className="mpesa-amount">Amount: <strong>{formatPrice(order.total)}</strong></p>
          <p className="mpesa-order-ref">Order #{order.id}</p>
        </div>

        {step === 'input' && (
          <form onSubmit={handleSubmit} className="mpesa-form">
            <div className="mpesa-info">
              <p>Enter your M-Pesa registered phone number. You will receive a prompt on your phone to complete the payment.</p>
            </div>

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

            <button type="submit" className="btn btn-mpesa">
              <FiSmartphone /> Send Payment Request
            </button>
          </form>
        )}

        {step === 'sending' && (
          <div className="mpesa-status">
            <div className="mpesa-spinner">
              <FiLoader className="spin" />
            </div>
            <h3>Sending payment request...</h3>
            <p>Please wait while we connect to M-Pesa</p>
          </div>
        )}

        {step === 'waiting' && (
          <div className="mpesa-status">
            <div className="mpesa-spinner pulse">
              <FiSmartphone />
            </div>
            <h3>Check your phone</h3>
            <p>An M-Pesa payment prompt has been sent to your phone. Enter your M-Pesa PIN to complete the payment.</p>
            <div className="mpesa-waiting-steps">
              <div className="waiting-step active">
                <span className="step-num">1</span>
                <span>STK Push sent ✓</span>
              </div>
              <div className="waiting-step">
                <span className="step-num">2</span>
                <span>Enter PIN on phone</span>
              </div>
              <div className="waiting-step">
                <span className="step-num">3</span>
                <span>Confirming payment...</span>
              </div>
            </div>
            <p className="mpesa-hint">Do not close this window</p>
          </div>
        )}

        {step === 'success' && (
          <div className="mpesa-status success">
            <div className="mpesa-icon success">
              <FiCheckCircle />
            </div>
            <h3>Payment Successful!</h3>
            <p>Your M-Pesa payment has been confirmed.</p>
            {receiptNumber && (
              <div className="mpesa-receipt">
                <span>Receipt: </span>
                <strong>{receiptNumber}</strong>
              </div>
            )}
            <button onClick={onClose} className="btn btn-primary btn-full">
              Done
            </button>
          </div>
        )}

        {step === 'failed' && (
          <div className="mpesa-status failed">
            <div className="mpesa-icon failed">
              <FiXCircle />
            </div>
            <h3>Payment Failed</h3>
            <p>{error}</p>
            <div className="mpesa-actions">
              <button onClick={() => { setStep('input'); setError(''); }} className="btn btn-mpesa">
                Try Again
              </button>
              <button onClick={onClose} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
