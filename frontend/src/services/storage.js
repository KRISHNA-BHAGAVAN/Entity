import { supabase } from './supabaseClient';

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
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...authHeaders
    }
  });
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  
  return response;
};

// Helper Functions
export const downloadFile = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Events Operations
export const getEvents = async () => {
  const response = await apiCall('/events');
  const data = await response.json();
  return data.events.map(e => ({
    id: e.id,
    name: e.name,
    description: e.description,
    createdAt: new Date(e.createdAt).getTime()
  }));
};

export const saveEvent = async (event) => {
  await apiCall('/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: event.id,
      name: event.name,
      description: event.description,
      createdAt: new Date(event.createdAt).toISOString()
    })
  });
};

export const deleteEvent = async (id) => {
  await apiCall(`/events/${id}`, { method: 'DELETE' });
};

// Document Operations
export const getDocs = async (eventId) => {
  const url = eventId ? `/docs?event_id=${eventId}` : '/docs';
  const response = await apiCall(url);
  const data = await response.json();
  
  return data.docs.map(d => ({
    id: d.id,
    eventId: d.eventId,
    name: d.name,
    originalFilePath: d.originalFilePath,
    templateFilePath: d.templateFilePath,
    variables: d.variables || [],
    uploadDate: new Date(d.uploadDate).getTime()
  }));
};

export const saveDoc = async (doc, fileBlob) => {
  const formData = new FormData();
  formData.append('event_id', doc.eventId);
  formData.append('name', doc.name);
  
  if (fileBlob) {
    // New upload
    formData.append('file', fileBlob);
    const response = await apiCall('/docs', {
      method: 'POST',
      body: formData
    });
    const data = await response.json();
    return data.docId;
  } else {
    // Update template with variables
    const templateBlob = new Blob([doc.templateFileBase64], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
    formData.append('file', templateBlob);
    formData.append('variables', JSON.stringify(doc.variables));
    
    await apiCall(`/docs/${doc.id}/template`, {
      method: 'PUT',
      body: formData
    });
  }
};

export const deleteDoc = async (id) => {
  await apiCall(`/docs/${id}`, { method: 'DELETE' });
};

export const downloadDoc = async (docId, filename = 'document.docx') => {
  const response = await apiCall(`/docs/${docId}`);
  const blob = await response.blob();
  downloadFile(blob, filename);
  return blob;
};