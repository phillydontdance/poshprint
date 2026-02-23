const API_URL = '/api';

function getHeaders(token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// Products
export async function fetchProducts() {
  const res = await fetch(`${API_URL}/products`);
  if (!res.ok) throw new Error('Failed to fetch products');
  return res.json();
}

export async function fetchProduct(id) {
  const res = await fetch(`${API_URL}/products/${id}`);
  if (!res.ok) throw new Error('Product not found');
  return res.json();
}

export async function createProduct(token, product) {
  const res = await fetch(`${API_URL}/products`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(product),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create product');
  }
  return res.json();
}

export async function updateProduct(token, id, product) {
  const res = await fetch(`${API_URL}/products/${id}`, {
    method: 'PUT',
    headers: getHeaders(token),
    body: JSON.stringify(product),
  });
  if (!res.ok) throw new Error('Failed to update product');
  return res.json();
}

export async function deleteProduct(token, id) {
  const res = await fetch(`${API_URL}/products/${id}`, {
    method: 'DELETE',
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to delete product');
  return res.json();
}

// Orders
export async function placeOrder(token, items) {
  const res = await fetch(`${API_URL}/orders`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ items }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to place order');
  }
  return res.json();
}

export async function fetchOrders(token) {
  const res = await fetch(`${API_URL}/orders`, {
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to fetch orders');
  return res.json();
}

export async function updateOrderStatus(token, id, status) {
  const res = await fetch(`${API_URL}/orders/${id}`, {
    method: 'PUT',
    headers: getHeaders(token),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error('Failed to update order');
  return res.json();
}

// M-Pesa Payments
export async function initiateMpesaPayment(token, orderId, phone) {
  const res = await fetch(`${API_URL}/mpesa/pay`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ orderId, phone }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to initiate M-Pesa payment');
  return data;
}

export async function checkPaymentStatus(token, orderId) {
  const res = await fetch(`${API_URL}/mpesa/status/${orderId}`, {
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to check payment status');
  return res.json();
}

export async function updateOrderPayment(token, orderId, paymentData) {
  const res = await fetch(`${API_URL}/orders/${orderId}/payment`, {
    method: 'PUT',
    headers: getHeaders(token),
    body: JSON.stringify(paymentData),
  });
  if (!res.ok) throw new Error('Failed to update payment');
  return res.json();
}
