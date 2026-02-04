import { useState, useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';
import { apiCall } from '../config/api';
import {
  Key,
  Eye,
  EyeOff,
  Loader2,
  Shield,
  AlertTriangle,
  Trash2,
  RefreshCw
} from 'lucide-react';

const PROVIDERS = {
  openai: { name: 'OpenAI', placeholder: 'sk-...' },
  gemini: { name: 'Google Gemini', placeholder: 'AI...' },
  groq: { name: 'Groq', placeholder: 'gsk_...' }
};

const BYOKSettings = () => {
  const { success, error } = useToast();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [validatingProvider, setValidatingProvider] = useState('');
  const [revokingProvider, setRevokingProvider] = useState('');

  const loadProviders = async () => {
    try {
      const data = await apiCall('/api/byok');
      setProviders(data);
    } catch (err) {
      error('Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  const addOrUpdateKey = async () => {
    if (!selectedProvider || !apiKey.trim()) return;

    setIsAdding(true);
    try {
      const result = await apiCall('/api/byok', {
        method: 'POST',
        body: JSON.stringify({
          provider: selectedProvider,
          api_key: apiKey.trim()
        })
      });

      success(`API key ${result.action} successfully`);
      setApiKey('');
      setSelectedProvider('');
      loadProviders();
    } catch (err) {
      error(err.detail || err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const validateKey = async (provider) => {
    setValidatingProvider(provider);
    try {
      const result = await apiCall('/api/byok/validate', {
        method: 'POST',
        body: JSON.stringify({ provider })
      });

      if (result.valid) {
        success('API key is valid');
      } else {
        error('API key is invalid');
      }
      loadProviders();
    } catch (err) {
      error('Failed to validate API key');
    } finally {
      setValidatingProvider('');
    }
  };

  const revokeKey = async (provider) => {
    setRevokingProvider(provider);
    try {
      await apiCall(`/api/byok/${provider}`, {
        method: 'DELETE'
      });

      success('API key revoked successfully');
      loadProviders();
    } catch (err) {
      error('Failed to revoke API key');
    } finally {
      setRevokingProvider('');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'revoked': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  useEffect(() => {
    loadProviders();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-indigo-600" size={24} />
        <span className="ml-2 text-slate-600">Loading API keys...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Shield className="text-indigo-600" size={24} />
          Bring Your Own Keys (BYOK)
        </h1>
        <p className="text-slate-600 mt-2">
          Securely manage your own API keys for OpenAI, Gemini, and Groq. Keys are encrypted and never stored in plaintext.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <Shield className="text-blue-600 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold text-blue-800">Security Features</h3>
            <ul className="text-sm text-blue-700 mt-1 space-y-1">
              <li>• Keys are encrypted with AES-256-GCM before storage</li>
              <li>• Keys are never logged or returned to the frontend</li>
              <li>• Decryption only happens in memory during request execution</li>
              <li>• Complete audit trail of all key operations</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Add API Key</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Provider
            </label>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select provider...</option>
              {Object.entries(PROVIDERS).map(([key, provider]) => (
                <option key={key} value={key}>{provider.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={selectedProvider ? PROVIDERS[selectedProvider]?.placeholder : 'Enter API key...'}
                className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex items-end">
            <button
              onClick={addOrUpdateKey}
              disabled={!selectedProvider || !apiKey.trim() || isAdding}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isAdding ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Key size={16} />
              )}
              {isAdding ? 'Adding...' : 'Add Key'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Your API Keys</h2>
        </div>

        {providers.length === 0 ? (
          <div className="p-6 text-center text-slate-500">
            <Key className="mx-auto mb-2 opacity-50" size={32} />
            <p>No API keys configured yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {providers.map((provider) => (
              <div key={provider.provider} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <h3 className="font-semibold text-slate-800">
                        {PROVIDERS[provider.provider]?.name || provider.provider}
                      </h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-slate-600">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(provider.status)}`}>
                          {provider.status}
                        </span>
                        <span>Added: {formatDate(provider.created_at)}</span>
                        <span>Last used: {formatDate(provider.last_used_at)}</span>
                        <span>Last validated: {formatDate(provider.last_validated_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => validateKey(provider.provider)}
                      disabled={validatingProvider === provider.provider || provider.status === 'revoked'}
                      className="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      {validatingProvider === provider.provider ? (
                        <Loader2 className="animate-spin" size={14} />
                      ) : (
                        <RefreshCw size={14} />
                      )}
                      Validate
                    </button>

                    <button
                      onClick={() => revokeKey(provider.provider)}
                      disabled={revokingProvider === provider.provider || provider.status === 'revoked'}
                      className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      {revokingProvider === provider.provider ? (
                        <Loader2 className="animate-spin" size={14} />
                      ) : (
                        <Trash2 size={14} />
                      )}
                      Revoke
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-amber-600 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold text-amber-800">Important Notes</h3>
            <ul className="text-sm text-amber-700 mt-1 space-y-1">
              <li>• Revoking a key will immediately disable it for all operations</li>
              <li>• Keys are validated with minimal API calls to preserve your usage quotas</li>
              <li>• If no user key is available, the system falls back to admin keys</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BYOKSettings;