import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { FiSettings, FiSave, FiCheck } from 'react-icons/fi';

export default function AdminSettings() {
  const { token } = useAuth();
  const { settings, updateSettings, CURRENCIES } = useSettings();
  const [selectedCurrency, setSelectedCurrency] = useState(settings.currency);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const curr = CURRENCIES.find(c => c.code === selectedCurrency);
      await updateSettings({
        currency: selectedCurrency,
        currencySymbol: curr?.symbol || '$',
      }, token);
      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-settings">
      <div className="page-header">
        <h1><FiSettings /> Settings</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success"><FiCheck /> {success}</div>}

      <div className="settings-card">
        <h3>Currency</h3>
        <p className="muted">Choose the currency to display prices in.</p>

        <div className="form-group" style={{ maxWidth: '400px', marginTop: '1rem' }}>
          <label>Currency</label>
          <select
            value={selectedCurrency}
            onChange={(e) => setSelectedCurrency(e.target.value)}
          >
            {CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>
                {c.symbol} — {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary"
          style={{ marginTop: '1rem' }}
        >
          <FiSave /> {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
