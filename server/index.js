import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

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
app.use(express.json());

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
  const { items } = req.body; // [{ productId, quantity, size, color }]
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Order must have items' });
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
    items: orderItems,
    total: orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0),
    status: 'pending',
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

// ============ SETTINGS ROUTES ============

// Get app settings (public)
app.get('/api/settings', (req, res) => {
  const data = readData();
  res.json(data.settings || { currency: 'USD', currencySymbol: '$' });
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
