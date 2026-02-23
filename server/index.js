import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import { initiateSTKPush, querySTKStatus, parseCallback, formatPhoneNumber } from './mpesa.js';

// Initialize Firebase Admin (uses Application Default Credentials or service account)
// For development, it uses the project ID from environment or config
admin.initializeApp({
  // If you have a service account key file, use:
  // credential: admin.credential.cert('./serviceAccountKey.json'),
  // Otherwise for emulator/dev, just set the project ID:
  projectId: process.env.FIREBASE_PROJECT_ID || 'posh-print',
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'data.json');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- Helpers ---
function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Auth middleware — verifies Firebase ID tokens
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const idToken = authHeader.split(' ')[1];
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const data = readData();
    const dbUser = data.users.find(u => u.firebaseUid === decoded.uid);

    req.user = {
      id: decoded.uid,
      email: decoded.email,
      name: decoded.name || decoded.email?.split('@')[0] || 'User',
      role: dbUser?.role || 'customer',
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// ============ AUTH ROUTES ============

// Make a user admin (secured by ADMIN_SECRET env variable)
// Usage: POST /api/admin/setup with { firebaseUid, secret }
app.post('/api/admin/setup', (req, res) => {
  const { firebaseUid, secret } = req.body;
  const adminSecret = process.env.ADMIN_SECRET || 'poshprint-admin-2026';

  if (secret !== adminSecret) {
    return res.status(403).json({ error: 'Invalid secret' });
  }

  const data = readData();
  const user = data.users.find(u => u.firebaseUid === firebaseUid);
  if (!user) return res.status(404).json({ error: 'User not found. Login first to create your account.' });

  user.role = 'admin';
  writeData(data);
  res.json({ message: `User ${user.email} is now admin!`, user });
});

// Sync Firebase user with our database (called after login/register)
app.post('/api/auth/sync', authenticate, (req, res) => {
  const { name } = req.body;
  const data = readData();

  let dbUser = data.users.find(u => u.firebaseUid === req.user.id);

  if (!dbUser) {
    // New user — create in our DB as customer
    dbUser = {
      firebaseUid: req.user.id,
      email: req.user.email,
      name: name || req.user.name,
      role: 'customer',
      createdAt: new Date().toISOString(),
    };
    data.users.push(dbUser);
    writeData(data);
  } else if (name && name !== dbUser.name) {
    // Update name if changed
    dbUser.name = name;
    writeData(data);
  }

  res.json({
    firebaseUid: dbUser.firebaseUid,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role,
  });
});

// Get current user info (role lookup)
app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    name: req.user.name,
    role: req.user.role,
  });
});

// ============ PRODUCT ROUTES ============

// Get all products (public)
app.get('/api/products', (req, res) => {
  const data = readData();
  // Customers see only in-stock products; everyone gets the list
  res.json(data.products);
});

// Get single product
app.get('/api/products/:id', (req, res) => {
  const data = readData();
  const product = data.products.find(p => p.id === parseInt(req.params.id));
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

// Add product (admin only)
app.post('/api/products', authenticate, adminOnly, (req, res) => {
  const { name, description, price, quantity, sizes, colors, image, category } = req.body;

  if (!name || !price || quantity === undefined) {
    return res.status(400).json({ error: 'Name, price, and quantity are required' });
  }

  const data = readData();
  const newProduct = {
    id: Date.now(),
    name,
    description: description || '',
    price: parseFloat(price),
    quantity: parseInt(quantity),
    sizes: sizes || ['M'],
    colors: colors || ['White'],
    image: image || 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400',
    category: category || 'Basic',
  };

  data.products.push(newProduct);
  writeData(data);
  res.status(201).json(newProduct);
});

// Update product (admin only)
app.put('/api/products/:id', authenticate, adminOnly, (req, res) => {
  const data = readData();
  const index = data.products.findIndex(p => p.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'Product not found' });

  data.products[index] = { ...data.products[index], ...req.body, id: data.products[index].id };
  writeData(data);
  res.json(data.products[index]);
});

// Delete product (admin only)
app.delete('/api/products/:id', authenticate, adminOnly, (req, res) => {
  const data = readData();
  const index = data.products.findIndex(p => p.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'Product not found' });

  data.products.splice(index, 1);
  writeData(data);
  res.json({ message: 'Product deleted' });
});

// ============ ORDERS ROUTES ============

// Place order (customer)
app.post('/api/orders', authenticate, (req, res) => {
  const { items, deliveryMethod, deliveryLocation, customerPhone } = req.body;
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Order must have items' });
  }
  if (!deliveryMethod || !['pickup', 'delivery'].includes(deliveryMethod)) {
    return res.status(400).json({ error: 'Please select pickup or delivery' });
  }
  if (deliveryMethod === 'delivery' && !deliveryLocation) {
    return res.status(400).json({ error: 'Delivery location is required' });
  }

  const data = readData();
  if (!data.orders) data.orders = [];

  const orderItems = [];
  for (const item of items) {
    const product = data.products.find(p => p.id === item.productId);
    if (!product) return res.status(404).json({ error: `Product ${item.productId} not found` });
    if (product.quantity < item.quantity) {
      return res.status(400).json({ error: `Not enough stock for ${product.name}` });
    }
    product.quantity -= item.quantity;
    orderItems.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: item.quantity,
      size: item.size,
      color: item.color,
    });
  }

  const order = {
    id: Date.now(),
    userId: req.user.id,
    customerName: req.user.name,
    customerPhone: customerPhone || null,
    items: orderItems,
    total: orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0),
    deliveryMethod,
    deliveryLocation: deliveryMethod === 'delivery' ? deliveryLocation : null,
    status: 'pending',
    paymentStatus: 'unpaid',
    paymentMethod: null,
    mpesaReceiptNumber: null,
    mpesaPhone: null,
    createdAt: new Date().toISOString(),
  };

  data.orders.push(order);
  writeData(data);
  res.status(201).json(order);
});

// Get orders (admin: all, customer: own)
app.get('/api/orders', authenticate, (req, res) => {
  const data = readData();
  if (!data.orders) data.orders = [];

  if (req.user.role === 'admin') {
    res.json(data.orders);
  } else {
    res.json(data.orders.filter(o => o.userId === req.user.id));
  }
});

// Update order status (admin only)
app.put('/api/orders/:id', authenticate, adminOnly, (req, res) => {
  const data = readData();
  if (!data.orders) data.orders = [];
  const order = data.orders.find(o => String(o.id) === String(req.params.id));
  if (!order) return res.status(404).json({ error: 'Order not found' });

  order.status = req.body.status || order.status;
  writeData(data);
  res.json(order);
});

// ============ M-PESA PAYMENT ROUTES ============

// Initiate M-Pesa STK Push payment for an order
app.post('/api/mpesa/pay', authenticate, async (req, res) => {
  const { orderId, phone } = req.body;

  if (!orderId || !phone) {
    return res.status(400).json({ error: 'Order ID and phone number are required' });
  }

  const data = readData();
  if (!data.orders) data.orders = [];
  const order = data.orders.find(o => String(o.id) === String(orderId));

  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized' });
  }
  if (order.paymentStatus === 'paid') {
    return res.status(400).json({ error: 'Order is already paid' });
  }

  try {
    const formattedPhone = formatPhoneNumber(phone);
    const result = await initiateSTKPush(formattedPhone, order.total, order.id);

    // Store the checkout request ID on the order for tracking
    order.mpesaCheckoutRequestId = result.checkoutRequestId;
    order.mpesaPhone = formattedPhone;
    order.paymentMethod = 'mpesa';
    order.paymentStatus = 'pending';
    writeData(data);

    res.json({
      message: 'STK Push sent. Check your phone to complete payment.',
      checkoutRequestId: result.checkoutRequestId,
    });
  } catch (err) {
    console.error('M-Pesa STK Push error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to initiate M-Pesa payment' });
  }
});

// M-Pesa callback — called by Safaricom after payment
app.post('/api/mpesa/callback', (req, res) => {
  console.log('M-Pesa Callback received:', JSON.stringify(req.body, null, 2));

  const result = parseCallback(req.body);
  const data = readData();
  if (!data.orders) data.orders = [];

  // Find the order by checkoutRequestId
  const order = data.orders.find(
    o => o.mpesaCheckoutRequestId === result.checkoutRequestId
  );

  if (order) {
    if (result.success) {
      order.paymentStatus = 'paid';
      order.mpesaReceiptNumber = result.mpesaReceiptNumber;
      order.paidAt = new Date().toISOString();
      console.log(`✅ Payment confirmed for Order #${order.id}: ${result.mpesaReceiptNumber}`);
    } else {
      order.paymentStatus = 'failed';
      order.paymentError = result.resultDesc;
      console.log(`❌ Payment failed for Order #${order.id}: ${result.resultDesc}`);
    }
    writeData(data);
  }

  // Always respond with success to M-Pesa
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

// Check payment status for an order
app.get('/api/mpesa/status/:orderId', authenticate, async (req, res) => {
  const data = readData();
  if (!data.orders) data.orders = [];
  const order = data.orders.find(o => String(o.id) === String(req.params.orderId));

  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized' });
  }

  // If payment is still pending, try querying M-Pesa for the latest status
  if (order.paymentStatus === 'pending' && order.mpesaCheckoutRequestId) {
    try {
      const stkStatus = await querySTKStatus(order.mpesaCheckoutRequestId);

      if (stkStatus.ResultCode === '0' || stkStatus.ResultCode === 0) {
        order.paymentStatus = 'paid';
        order.paidAt = new Date().toISOString();
        writeData(data);
      } else if (stkStatus.ResultCode && stkStatus.ResultCode !== '0') {
        order.paymentStatus = 'failed';
        order.paymentError = stkStatus.ResultDesc;
        writeData(data);
      }
      // If ResultCode is undefined, the transaction is still processing
    } catch (err) {
      console.error('STK query error:', err.message);
      // Don't fail — just return current status
    }
  }

  res.json({
    orderId: order.id,
    paymentStatus: order.paymentStatus || 'unpaid',
    paymentMethod: order.paymentMethod,
    mpesaReceiptNumber: order.mpesaReceiptNumber,
    mpesaPhone: order.mpesaPhone,
    paidAt: order.paidAt,
  });
});

// Admin: manually mark an order as paid (e.g., for cash payments)
app.put('/api/orders/:id/payment', authenticate, adminOnly, (req, res) => {
  const { paymentStatus, paymentMethod, mpesaReceiptNumber } = req.body;
  const data = readData();
  if (!data.orders) data.orders = [];
  const order = data.orders.find(o => String(o.id) === String(req.params.id));

  if (!order) return res.status(404).json({ error: 'Order not found' });

  if (paymentStatus) order.paymentStatus = paymentStatus;
  if (paymentMethod) order.paymentMethod = paymentMethod;
  if (mpesaReceiptNumber) order.mpesaReceiptNumber = mpesaReceiptNumber;
  if (paymentStatus === 'paid') order.paidAt = new Date().toISOString();

  writeData(data);
  res.json(order);
});

// ============ SETTINGS ROUTES ============

// Get app settings (public)
app.get('/api/settings', (req, res) => {
  const data = readData();
  res.json(data.settings || { currency: 'KES', currencySymbol: 'KSh' });
});

// Update settings (admin only)
app.put('/api/settings', authenticate, adminOnly, (req, res) => {
  const data = readData();
  data.settings = { ...data.settings, ...req.body };
  writeData(data);
  res.json(data.settings);
});

// ============ SERVE FRONTEND ============
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // All non-API routes serve the React app
  app.get('{*path}', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ============ START ============
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Posh Print API running on port ${PORT}`);
});
