import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { confirmManualPayment } from '../services/api';
import { FiSmartphone, FiCheckCircle, FiXCircle, FiLoader, FiX, FiCopy, FiArrowRight, FiArrowLeft } from 'react-icons/fi';

const MPESA_PHONE = '0706276584';
const MPESA_NAME = 'Posh Print';

export default function MpesaPaymentModal({ order, onClose, onPaymentComplete }) {
  const { token } = useAuth();
  const { formatPrice } = useSettings();
  const [step, setStep] = useState('instructions'); // instructions | confirm | verifying | success | failed
  const [confirmationCode, setConfirmationCode] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopyNumber = () => {
    navigator.clipboard.writeText(MPESA_PHONE).catch(() => {});
    setCopied(true);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  };

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
      if (onPaymentComplete) onPaymentComplete();
    } catch (err) {
      setError(err.message);
      setStep('confirm');
    }
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

        {step === 'instructions' && (
          <div>
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
                  <strong className="pay-amount">{formatPrice(order.total)}</strong>
                </div>
              </div>

              <div className="mpesa-steps-guide">
                <h4>How to pay:</h4>
                <ol>
                  <li>Open M-Pesa on your phone</li>
                  <li>Select <strong>Send Money</strong></li>
                  <li>Enter number: <strong>{MPESA_PHONE}</strong></li>
                  <li>Enter amount: <strong>{formatPrice(order.total)}</strong></li>
                  <li>Enter your M-Pesa PIN &amp; confirm</li>
                  <li>Enter the confirmation code below</li>
                </ol>
              </div>
            </div>

            <button className="btn btn-mpesa btn-full" onClick={() => setStep('confirm')} style={{ marginTop: '1rem' }}>
              I&apos;ve Sent the Money <FiArrowRight />
            </button>
          </div>
        )}

        {step === 'confirm' && (
          <div>
            <p className="checkout-subtitle" style={{ textAlign: 'center' }}>
              Enter the M-Pesa confirmation code from the SMS you received.
            </p>

            <form onSubmit={handleConfirmPayment}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label htmlFor="mpesa-code-modal">M-Pesa Confirmation Code</label>
                <input
                  id="mpesa-code-modal"
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

            <button className="btn-text" onClick={() => setStep('instructions')} style={{ display: 'block', margin: '0.75rem auto 0' }}>
              <FiArrowLeft /> Back to instructions
            </button>
          </div>
        )}

        {step === 'verifying' && (
          <div className="mpesa-status">
            <div className="mpesa-spinner">
              <FiLoader className="spin" />
            </div>
            <h3>Confirming payment...</h3>
          </div>
        )}

        {step === 'success' && (
          <div className="mpesa-status success">
            <div className="mpesa-icon success">
              <FiCheckCircle />
            </div>
            <h3>Payment Recorded! 🎉</h3>
            <p>Your payment has been recorded and will be verified shortly.</p>
            {confirmationCode && (
              <div className="mpesa-receipt">
                <span>Receipt: </span>
                <strong>{confirmationCode}</strong>
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
            <h3>Something Went Wrong</h3>
            <p>{error}</p>
            <div className="mpesa-actions">
              <button onClick={() => { setStep('confirm'); setError(''); }} className="btn btn-mpesa">
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
