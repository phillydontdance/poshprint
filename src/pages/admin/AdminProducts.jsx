import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchProducts, createProduct, updateProduct, deleteProduct } from '../../services/api';
import { FiPlus, FiEdit2, FiTrash2, FiPackage, FiX, FiSave } from 'react-icons/fi';

export default function AdminProducts() {
  const { token } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const emptyForm = {
    name: '', description: '', price: '', quantity: '',
    sizes: 'S,M,L,XL', colors: 'White', image: '', category: 'Basic',
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const data = await fetchProducts();
      setProducts(data);
    } catch {
      setError('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const openAdd = () => {
    setEditProduct(null);
    setForm(emptyForm);
    setShowForm(true);
    setError('');
  };

  const openEdit = (product) => {
    setEditProduct(product);
    setForm({
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      quantity: product.quantity.toString(),
      sizes: product.sizes.join(','),
      colors: product.colors.join(','),
      image: product.image,
      category: product.category,
    });
    setShowForm(true);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const productData = {
      name: form.name,
      description: form.description,
      price: parseFloat(form.price),
      quantity: parseInt(form.quantity),
      sizes: form.sizes.split(',').map(s => s.trim()),
      colors: form.colors.split(',').map(c => c.trim()),
      image: form.image,
      category: form.category,
    };

    try {
      if (editProduct) {
        await updateProduct(token, editProduct.id, productData);
        setSuccess('Product updated successfully!');
      } else {
        await createProduct(token, productData);
        setSuccess('Product added successfully!');
      }
      setShowForm(false);
      setForm(emptyForm);
      loadProducts();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await deleteProduct(token, id);
      setSuccess('Product deleted!');
      loadProducts();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="loading">Loading products...</div>;

  return (
    <div className="admin-products">
      <div className="page-header">
        <h1><FiPackage /> Manage Products</h1>
        <button className="btn btn-primary" onClick={openAdd}>
          <FiPlus /> Add Product
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editProduct ? 'Edit Product' : 'Add New Product'}</h2>
              <button onClick={() => setShowForm(false)} className="btn-icon"><FiX /></button>
            </div>
            <form onSubmit={handleSubmit} className="product-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Product Name *</label>
                  <input name="name" value={form.name} onChange={handleChange} required placeholder="e.g. Classic White Tee" />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select name="category" value={form.category} onChange={handleChange}>
                    <option value="Basic">Basic</option>
                    <option value="Premium">Premium</option>
                    <option value="Streetwear">Streetwear</option>
                    <option value="Sport">Sport</option>
                    <option value="Kids">Kids</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea name="description" value={form.description} onChange={handleChange} rows="2" placeholder="Product description..." />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Price ($) *</label>
                  <input name="price" type="number" step="0.01" min="0" value={form.price} onChange={handleChange} required placeholder="29.99" />
                </div>
                <div className="form-group">
                  <label>Quantity *</label>
                  <input name="quantity" type="number" min="0" value={form.quantity} onChange={handleChange} required placeholder="50" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Sizes (comma-separated)</label>
                  <input name="sizes" value={form.sizes} onChange={handleChange} placeholder="S,M,L,XL" />
                </div>
                <div className="form-group">
                  <label>Colors (comma-separated)</label>
                  <input name="colors" value={form.colors} onChange={handleChange} placeholder="White,Black" />
                </div>
              </div>

              <div className="form-group">
                <label>Image URL</label>
                <input name="image" value={form.image} onChange={handleChange} placeholder="https://..." />
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">
                  <FiSave /> {editProduct ? 'Update' : 'Add'} Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="products-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Quantity</th>
              <th>Sizes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr><td colSpan="7" className="text-center">No products yet. Add your first product!</td></tr>
            ) : (
              products.map(product => (
                <tr key={product.id}>
                  <td><img src={product.image} alt={product.name} className="table-img" /></td>
                  <td>
                    <strong>{product.name}</strong>
                    <br /><small className="muted">{product.description?.substring(0, 50)}...</small>
                  </td>
                  <td><span className="category-tag">{product.category}</span></td>
                  <td className="price">${product.price.toFixed(2)}</td>
                  <td>
                    <span className={`stock-badge ${product.quantity < 10 ? 'low' : 'ok'}`}>
                      {product.quantity}
                    </span>
                  </td>
                  <td>{product.sizes.join(', ')}</td>
                  <td>
                    <div className="action-buttons">
                      <button onClick={() => openEdit(product)} className="btn-icon edit" title="Edit">
                        <FiEdit2 />
                      </button>
                      <button onClick={() => handleDelete(product.id)} className="btn-icon delete" title="Delete">
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
