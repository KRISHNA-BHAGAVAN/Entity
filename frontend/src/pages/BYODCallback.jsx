import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { apiCall } from '../config/api';
import { useToast } from '../contexts/ToastContext';

const BYODCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { success, error } = useToast();
  const [status, setStatus] = useState('Verifying Google Drive connection...');
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const errorParam = searchParams.get('error');

      if (errorParam) {
        error('Failed to connect Google Drive: ' + errorParam);
        navigate('/settings/byok');
        return;
      }

      if (!code) {
        error('Invalid authorization code');
        navigate('/settings/byok');
        return;
      }

      try {
        await apiCall('/api/byod/auth/callback', {
          method: 'POST',
          body: JSON.stringify({
            code,
            redirect_uri: window.location.origin + '/settings/byod/callback'
          })
        });
        
        success('Successfully connected Google Drive');
      } catch (err) {
        console.error("BYOD Callback Error:", err);
        error('Failed to complete Google Drive connection: ' + (err.detail || err.message || 'Unknown error'));
      } finally {
        navigate('/settings/byok');
      }
    };

    hasProcessed.current = true;
    handleCallback();
  }, [searchParams, navigate, success, error]);

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4 text-slate-600">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="font-medium">{status}</p>
      </div>
    </div>
  );
};

export default BYODCallback;
