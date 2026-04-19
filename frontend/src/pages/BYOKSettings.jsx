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
  RefreshCw,
  Plus,
  HardDrive
} from 'lucide-react';
import { BYOKSettingsSkeleton, SkeletonBlock } from '../components/Skeletons';

const BYOKSettings = () => {
  const { success, error } = useToast();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [providerCatalog, setProviderCatalog] = useState({});
  const [selectedProvider, setSelectedProvider] = useState('');
  const [credentialValues, setCredentialValues] = useState({});
  const [selectedModel, setSelectedModel] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [showCustomModel, setShowCustomModel] = useState(false);
  const [showSecrets, setShowSecrets] = useState({});
  const [isAdding, setIsAdding] = useState(false);
  const [validatingProvider, setValidatingProvider] = useState('');
  const [revokingProvider, setRevokingProvider] = useState('');

  const [driveStatus, setDriveStatus] = useState(null);
  const [driveLoading, setDriveLoading] = useState(true);
  const [driveConfig, setDriveConfig] = useState(null);
  const [driveToken, setDriveToken] = useState(null);
  const [isSettingFolder, setIsSettingFolder] = useState(false);
  const [showManualFolderInput, setShowManualFolderInput] = useState(false);
  const [manualFolderLink, setManualFolderLink] = useState('');
  const [isSettingManualFolder, setIsSettingManualFolder] = useState(false);

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

  const loadCatalog = async () => {
    try {
      const data = await apiCall('/api/byok/catalog');
      const providerMap = Object.fromEntries((data.providers || []).map((provider) => [provider.id, provider]));
      setProviderCatalog(providerMap);
    } catch (err) {
      error('Failed to load provider catalog');
    } finally {
      setCatalogLoading(false);
    }
  };

  const loadDriveStatus = async () => {
    try {
      const data = await apiCall('/api/byod/status');
      setDriveStatus(data);
    } catch (err) {
      console.error('Failed to load drive status:', err);
    } finally {
      setDriveLoading(false);
    }
  };

  const addOrUpdateKey = async () => {
    if (!selectedProvider) return;

    const selectedProviderMeta = providerCatalog[selectedProvider];
    const requiredFields = (selectedProviderMeta?.credential_fields || []).filter((field) => field.required);
    const missingRequiredField = requiredFields.find((field) => !String(credentialValues[field.name] || '').trim());
    if (missingRequiredField) return;

    const modelToUse = showCustomModel ? customModel.trim() : selectedModel;
    const credentials = Object.fromEntries(
      Object.entries(credentialValues).filter(([, value]) => String(value || '').trim())
    );

    setIsAdding(true);
    try {
      const result = await apiCall('/api/byok', {
        method: 'POST',
        body: JSON.stringify({
          provider: selectedProvider,
          model: modelToUse || null,
          credentials
        })
      });

      success(`API key ${result.action} successfully`);
      setSelectedProvider('');
      setCredentialValues({});
      setSelectedModel('');
      setCustomModel('');
      setShowCustomModel(false);
      setShowSecrets({});
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

  const connectDrive = async () => {
    try {
      const data = await apiCall('/api/byod/auth/url', {
        method: 'POST',
        body: JSON.stringify({ redirect_uri: window.location.origin + '/settings/byod/callback' })
      });
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      error('Failed to get Google authorization URL');
    }
  };

  const handleChooseFolder = () => {
    try {
      if (!driveConfig?.client_id || !driveToken) {
        throw new Error("Missing Google configuration or access token.");
      }

      setIsSettingFolder(true);
      
      const loadScript = (src) => new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
      });

      const launchPicker = () => {
        const view = new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
          .setIncludeFolders(true)
          .setSelectFolderEnabled(true);

        const picker = new window.google.picker.PickerBuilder()
          .addView(view)
          .setAppId(driveConfig.client_id.split('-')[0])
          .setOAuthToken(driveToken)
          .setCallback(async (data) => {
            if (data.action === window.google.picker.Action.CANCEL) {
              setIsSettingFolder(false);
            }
            if (data.action === window.google.picker.Action.PICKED) {
              const folder = data.docs[0];
              try {
                await apiCall('/api/byod/folder', {
                  method: 'POST',
                  body: JSON.stringify({ url: folder.id })
                });
                success('Drive folder selected successfully');
                loadDriveStatus();
              } catch (err) {
                error('Failed to set Drive folder: ' + err.message);
              } finally {
                setIsSettingFolder(false);
              }
            }
          })
          .build();
        picker.setVisible(true);
      };

      loadScript('https://apis.google.com/js/api.js')
        .then(() => {
          window.gapi.load('picker', { callback: launchPicker });
        })
        .catch((err) => {
          setIsSettingFolder(false);
          error("Failed to load Google Picker APIs. Please disable adblockers for this site.");
        });

    } catch (err) {
      error('Failed to open Google Drive picker: ' + err.message);
      setIsSettingFolder(false);
    }
  };

  const handleSetManualFolder = async () => {
    if (!manualFolderLink.trim()) {
      error("Please enter a valid folder link or ID");
      return;
    }
    
    setIsSettingManualFolder(true);
    try {
      await apiCall('/api/byod/folder', {
        method: 'POST',
        body: JSON.stringify({ url: manualFolderLink.trim() })
      });
      success('Drive folder linked successfully');
      setManualFolderLink('');
      setShowManualFolderInput(false);
      loadDriveStatus();
    } catch (err) {
      error('Failed to set Drive folder: ' + err.message);
    } finally {
      setIsSettingManualFolder(false);
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
    loadCatalog();
    loadDriveStatus();
  }, []);

  // Reset model selection when provider changes
  useEffect(() => {
    setSelectedModel('');
    setCustomModel('');
    setShowCustomModel(false);
    setCredentialValues({});
    setShowSecrets({});
  }, [selectedProvider]);

  if (loading || catalogLoading) {
    return <BYOKSettingsSkeleton />;
  }

  const selectedProviderMeta = selectedProvider ? providerCatalog[selectedProvider] : null;
  const recommendedModels = selectedProviderMeta?.recommended_models || [];
  const credentialFields = selectedProviderMeta?.credential_fields || [];
  const hasMissingRequiredCredential = credentialFields.some(
    (field) => field.required && !String(credentialValues[field.name] || '').trim()
  );

  return (
    <div className="relative mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_15%,rgba(14,165,233,0.18),transparent_40%),radial-gradient(circle_at_85%_0%,rgba(34,197,94,0.1),transparent_30%)]" />
      <div className="mb-6 rounded-3xl border border-sky-100 bg-gradient-to-r from-sky-50 via-white to-cyan-50 p-6 shadow-[0_24px_50px_-38px_rgba(3,105,161,0.65)]">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
          Credential Vault
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl flex items-center gap-2">
          <Shield className="text-sky-600" size={24} />
          Bring Your Own Keys (BYOK)
        </h1>
        <p className="mt-2 text-slate-600">
          Securely manage your own LLM provider credentials. Credentials are encrypted and never stored in plaintext.
        </p>
      </div>

      {/* <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
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
      </div> */}

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
          <HardDrive className="text-sky-600" size={20} />
           Google Drive Integration (BYOD)
        </h2>
        {driveLoading ? (
          <div className="space-y-3">
           <SkeletonBlock className="h-4 w-40" />
           <SkeletonBlock className="h-11 w-full" />
           <SkeletonBlock className="h-11 w-3/4" />
          </div>
        ) : driveStatus?.connected ? (
           <div className="space-y-4">
             <div className="bg-green-50 text-green-700 p-3 rounded-md flex items-center justify-between text-sm border border-green-200">
               <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-green-500"></div> 
                 <span>Connected to Google Drive</span>
                 {driveStatus.email && (
                   <span className="text-xs bg-green-100 px-2 py-0.5 rounded font-mono">{driveStatus.email}</span>
                 )}
               </div>
               <button
                 onClick={async () => {
                   if (confirm('Disconnect Google Drive? This will remove all uploaded files from Drive and you\'ll need to reconnect.')) {
                     try {
                       await apiCall('/api/byod/disconnect', { method: 'DELETE' });
                       success('Google Drive disconnected successfully');
                       loadDriveStatus();
                     } catch (err) {
                       error('Failed to disconnect: ' + err.message);
                     }
                   }
                 }}
                 className="text-xs text-red-600 hover:text-red-700 font-medium underline"
               >
                 Disconnect
               </button>
             </div>
             <div>
               <label className="block text-sm font-medium text-slate-700 mb-2">Drive Folder Settings</label>
               {driveStatus.folder_id ? (
                 <p className="text-sm text-slate-600 mb-2">Current Root Folder ID: <span className="font-mono bg-slate-100 px-1 rounded">{driveStatus.folder_id}</span></p>
               ) : (
                 <p className="text-sm text-amber-600 mb-2">No folder set. Please choose a folder to store documents.</p>
               )}
               <div className="flex gap-2">
                 <button 
                   onClick={() => setShowManualFolderInput(!showManualFolderInput)}
                   className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-200 transition"
                 >
                   Provide Folder Link
                 </button>
               </div>

               {showManualFolderInput && (
                 <div className="mt-4 p-4 border border-slate-200 rounded-md bg-slate-50">
                   <div className="flex flex-col gap-3">
                     <div className="flex-1 w-full">
                       <label className="block text-sm font-medium text-slate-700 mb-1">
                         Manual Folder Link or ID
                       </label>
                       <input
                         type="text"
                         value={manualFolderLink}
                         onChange={(e) => setManualFolderLink(e.target.value)}
                         placeholder="https://drive.google.com/drive/folders/..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                       />
                       <p className="text-xs text-slate-500 mt-1">
                         Make sure the folder is owned by or shared with: <span className="font-semibold">{driveStatus.email || 'your connected account'}</span>
                       </p>
                     </div>
                     <div className="flex gap-2">
                       <button
                         onClick={handleSetManualFolder}
                         disabled={isSettingManualFolder || !manualFolderLink.trim()}
                        className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[100px]"
                       >
                         {isSettingManualFolder ? <Loader2 size={16} className="animate-spin" /> : 'Save Link'}
                       </button>
                       <button
                         onClick={() => {
                           setShowManualFolderInput(false);
                           setManualFolderLink('');
                         }}
                         className="px-4 py-2 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200"
                       >
                         Cancel
                       </button>
                     </div>
                   </div>
                 </div>
               )}
             </div>
           </div>
        ) : (
           <div className="space-y-4">
             <p className="text-sm text-slate-600">Connect your Google Drive account to enable document previews and cloud storage.</p>
             <button onClick={connectDrive} className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-700 transition-colors">
               Connect Google Drive
             </button>
           </div>
        )}
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-sm">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Add / Test API Key</h2>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Provider
              </label>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">Select provider...</option>
                {Object.entries(providerCatalog).map(([key, provider]) => (
                  <option key={key} value={key}>{provider.name}</option>
                ))}
              </select>
            </div>
          </div>

          {selectedProvider && (
            <>
              {credentialFields.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {credentialFields.map((field) => {
                    const isSecret = field.secret;
                    const showSecret = !!showSecrets[field.name];
                    return (
                      <div key={field.name}>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          {field.label}
                        </label>
                        <div className="relative">
                          <input
                            type={isSecret && !showSecret ? 'password' : (field.input_type || 'text')}
                            value={credentialValues[field.name] || ''}
                            onChange={(e) => setCredentialValues((current) => ({
                              ...current,
                              [field.name]: e.target.value
                            }))}
                            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                            className={`w-full px-3 py-2 ${isSecret ? 'pr-10' : ''} border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500`}
                          />
                          {isSecret && (
                            <button
                              type="button"
                              onClick={() => setShowSecrets((current) => ({
                                ...current,
                                [field.name]: !current[field.name]
                              }))}
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          )}
                        </div>
                        {field.help_text && (
                          <p className="text-xs text-slate-500 mt-1">{field.help_text}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Model (Optional)
                </label>
                {!showCustomModel ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {recommendedModels.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => setSelectedModel(selectedModel === model.id ? '' : model.id)}
                          className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-all ${selectedModel === model.id
                              ? 'bg-sky-600 text-white border-sky-600'
                              : 'bg-white text-slate-700 border-slate-300 hover:border-sky-400'
                            }`}
                        >
                          {model.label || model.id}
                        </button>
                      ))}
                      <button
                        onClick={() => setShowCustomModel(true)}
                        className="px-3 py-1.5 text-sm font-medium rounded-lg border border-dashed border-slate-300 text-slate-500 hover:border-sky-400 hover:text-sky-600 flex items-center gap-1"
                      >
                        <Plus size={14} />
                        Custom
                      </button>
                    </div>
                    <p className="text-xs text-slate-500">
                      Recommended models for {selectedProviderMeta?.name}
                    </p>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customModel}
                      onChange={(e) => setCustomModel(e.target.value)}
                      placeholder="Enter custom model name..."
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <button
                      onClick={() => {
                        setShowCustomModel(false);
                        setCustomModel('');
                      }}
                      className="px-3 py-2 text-sm text-slate-600 border border-slate-300 rounded-md hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="flex gap-2">
            <button
              onClick={addOrUpdateKey}
              disabled={!selectedProvider || hasMissingRequiredCredential || isAdding}
              className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isAdding ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Testing & Adding...
                </>
              ) : (
                <>
                  <Key size={16} />
                  Test & Add Key
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm backdrop-blur-sm">
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
                        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                        {providerCatalog[provider.provider]?.name || provider.provider}
                        {provider.model && (
                          <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {provider.model}
                          </span>
                        )}
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

      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-amber-600 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold text-amber-800">Important Notes</h3>
            <ul className="text-sm text-amber-700 mt-1 space-y-1">
              <li>• When you click "Test & Add Key", your key and model are validated with a real API call</li>
              <li>• Revoking a key will immediately disable it for all operations</li>
              <li>• Provider-specific credential fields come from the backend catalog</li>
              <li>• Custom models are validated against the selected provider at runtime</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BYOKSettings;
