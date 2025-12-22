import { supabase } from '../services/supabaseClient';

const API_BASE_URL = 'http://localhost:8000';

const getAuthHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) return {};

  return { 'Authorization': `Bearer ${token}` };
};

const apiCall = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const authHeaders = await getAuthHeaders();

  // If the body is FormData, don't set Content-Type
  let headers = {};
  if (options.body instanceof FormData) {
    headers = { ...options.headers, ...authHeaders };
  } else {
    headers = { 'Content-Type': 'application/json', ...options.headers, ...authHeaders };
  }

  const config = {
    headers,
    ...options,
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  // If the response is a blob (e.g., file download), return it directly
  if (options.isBlob) {
    return response.blob();
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

    return apiCall('/extract-markdown', {
      method: 'POST',
      body: formData,
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
    formData.append('replacements_json', JSON.stringify(replacements));

    const blob = await apiCall(`/replace-text/${docId}`, {
      method: 'POST',
      body: formData,
      isBlob: true, // Indicate that the response is a blob
    });

    // Optional: read replacement count
    const count = blob.headers?.get('X-Total-Replacements');
    if (count) console.log('Total replacements:', count);

    return blob;
  },
};
