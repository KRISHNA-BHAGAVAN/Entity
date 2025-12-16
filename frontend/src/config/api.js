import { supabase } from '../services/supabaseClient';

const API_BASE_URL = 'http://localhost:8000';

const getAuthHeaders = async () => {
  // Use getSession() to get current valid token
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  
  if (!token) return {};
  
  return { 'Authorization': `Bearer ${token}` };
};

const apiCall = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const authHeaders = await getAuthHeaders();
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      ...authHeaders
    },
    ...options,
  };

  const response = await fetch(url, config);
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
};

export const api = {
  extractMarkdown: async (file) => {
    const formData = new FormData();
    const fileName = file.name;
    const properFile = new File([file], fileName.endsWith('.docx') ? fileName : fileName + '.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
    formData.append('file', properFile);
    
    const authHeaders = await getAuthHeaders();
    
    return fetch(`${API_BASE_URL}/extract-markdown`, {
      method: 'POST',
      headers: authHeaders,
      body: formData,
    }).then(res => {
      if (!res.ok) throw new Error(`API Error: ${res.status}`);
      return res.json();
    });
  },

  suggestVariables: (text) => apiCall('/suggest_variables/invoke', {
    method: 'POST',
    body: JSON.stringify({ 
      input: { text: text.substring(0, 15000) }
    }),
  }),

  replaceText: async (docId, replacements) => {
  const formData = new FormData();

  // MUST match FastAPI parameter name
  formData.append('replacements_json', JSON.stringify(replacements));

  const authHeaders = await getAuthHeaders();

  const response = await fetch(
    `${API_BASE_URL}/replace-text/${docId}`,
    {
      method: 'POST',
      headers: {
        ...authHeaders, // Authorization only
        // DO NOT set Content-Type manually
      },
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  // Backend returns a DOCX stream
  const blob = await response.blob();

  // Optional: read replacement count
  const count = response.headers.get('X-Total-Replacements');
  console.log('Total replacements:', count);

  return blob;
},

};

export const base64ToBlob = (base64, mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
};