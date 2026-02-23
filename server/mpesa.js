/**
 * M-Pesa Daraja API Integration
 * Uses Safaricom's STK Push (Lipa Na M-Pesa Online)
 *
 * Environment Variables Required:
 *   MPESA_CONSUMER_KEY    - Daraja app consumer key
 *   MPESA_CONSUMER_SECRET - Daraja app consumer secret
 *   MPESA_PASSKEY         - Lipa Na M-Pesa passkey
 *   MPESA_SHORTCODE       - Business shortcode (paybill/till)
 *   MPESA_CALLBACK_URL    - Public URL for M-Pesa callbacks
 *   MPESA_ENV             - 'sandbox' or 'production' (default: sandbox)
 */

const MPESA_ENV = process.env.MPESA_ENV || 'sandbox';

const BASE_URL =
  MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY || 'YOUR_CONSUMER_KEY';
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET || 'YOUR_CONSUMER_SECRET';
const PASSKEY = process.env.MPESA_PASSKEY || 'YOUR_PASSKEY';
const SHORTCODE = process.env.MPESA_SHORTCODE || '174379'; // sandbox default
const CALLBACK_URL = process.env.MPESA_CALLBACK_URL || 'https://your-domain.com/api/mpesa/callback';

/**
 * Get OAuth access token from Daraja API
 */
export async function getAccessToken() {
  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');

  const response = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get M-Pesa access token: ${text}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Generate the password and timestamp for STK Push
 */
function generatePassword() {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-T:.Z]/g, '')
    .slice(0, 14); // YYYYMMDDHHmmss

  const password = Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString('base64');

  return { password, timestamp };
}

/**
 * Format phone number to M-Pesa format (254XXXXXXXXX)
 */
export function formatPhoneNumber(phone) {
  let cleaned = phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');

  if (cleaned.startsWith('+254')) {
    cleaned = cleaned.slice(1); // remove +
  } else if (cleaned.startsWith('0')) {
    cleaned = '254' + cleaned.slice(1);
  } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
    cleaned = '254' + cleaned;
  }

  return cleaned;
}

/**
 * Initiate STK Push (Lipa Na M-Pesa Online)
 * @param {string} phone - Customer phone number
 * @param {number} amount - Amount in KES
 * @param {string} orderId - Order reference
 * @returns {object} - STK Push response with CheckoutRequestID
 */
export async function initiateSTKPush(phone, amount, orderId) {
  const accessToken = await getAccessToken();
  const { password, timestamp } = generatePassword();
  const formattedPhone = formatPhoneNumber(phone);

  const payload = {
    BusinessShortCode: SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.ceil(amount), // M-Pesa only accepts whole numbers
    PartyA: formattedPhone,
    PartyB: SHORTCODE,
    PhoneNumber: formattedPhone,
    CallBackURL: CALLBACK_URL,
    AccountReference: `PoshPrint-${orderId}`,
    TransactionDesc: `Payment for Order #${orderId}`,
  };

  const response = await fetch(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (data.ResponseCode !== '0') {
    throw new Error(data.errorMessage || data.ResponseDescription || 'STK Push failed');
  }

  return {
    checkoutRequestId: data.CheckoutRequestID,
    merchantRequestId: data.MerchantRequestID,
    responseDescription: data.ResponseDescription,
  };
}

/**
 * Query STK Push transaction status
 * @param {string} checkoutRequestId - CheckoutRequestID from initiateSTKPush
 */
export async function querySTKStatus(checkoutRequestId) {
  const accessToken = await getAccessToken();
  const { password, timestamp } = generatePassword();

  const payload = {
    BusinessShortCode: SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    CheckoutRequestID: checkoutRequestId,
  };

  const response = await fetch(`${BASE_URL}/mpesa/stkpushquery/v1/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  return data;
}

/**
 * Parse STK Push callback data
 * @param {object} body - Callback request body from M-Pesa
 */
export function parseCallback(body) {
  const stkCallback = body?.Body?.stkCallback;
  if (!stkCallback) {
    return { success: false, error: 'Invalid callback data' };
  }

  const resultCode = stkCallback.ResultCode;
  const resultDesc = stkCallback.ResultDesc;
  const merchantRequestId = stkCallback.MerchantRequestID;
  const checkoutRequestId = stkCallback.CheckoutRequestID;

  if (resultCode !== 0) {
    return {
      success: false,
      resultCode,
      resultDesc,
      merchantRequestId,
      checkoutRequestId,
    };
  }

  // Parse metadata items
  const metadata = {};
  if (stkCallback.CallbackMetadata?.Item) {
    for (const item of stkCallback.CallbackMetadata.Item) {
      metadata[item.Name] = item.Value;
    }
  }

  return {
    success: true,
    resultCode,
    resultDesc,
    merchantRequestId,
    checkoutRequestId,
    amount: metadata.Amount,
    mpesaReceiptNumber: metadata.MpesaReceiptNumber,
    transactionDate: metadata.TransactionDate,
    phoneNumber: metadata.PhoneNumber,
  };
}
