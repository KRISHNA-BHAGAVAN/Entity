import { apiCall } from '../config/api';

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
  return response.events.map(e => ({
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
  
  return response.docs.map(d => ({
    id: d.id,
    eventId: d.eventId,
    name: d.name,
    originalFilePath: d.originalFilePath,
    templateFilePath: d.templateFilePath,
    variables: d.variables || [],
    uploadDate: new Date(d.uploadDate).getTime(),
    markdownContent: d.markdownContent,
    tableData: d.tableData || []
  }));
};

export const saveDoc = async (doc, fileBlob) => {
  const isUpdate = !fileBlob && doc.id;

  if (isUpdate) {
    const res = await apiCall('/docs/confirm', {
      method: 'POST',
      body: JSON.stringify({
        id: doc.id,
        eventId: doc.eventId || doc.event_id,
        name: doc.name,
        variables: doc.variables || []
      })
    });
    return res.docId; // Return the ID
  }

  // NEW UPLOAD STEP
  const urlData = await apiCall(
    `/docs/upload-url?name=${encodeURIComponent(doc.name)}&event_id=${doc.eventId}`, 
    { method: 'POST' }
  );

  if (urlData.status === 'exists') {
    console.log("File already exists, skipping storage upload.");
    // Optionally call confirm to ensure DB is synced, or just return existing ID
    return urlData.doc_id; 
  }

  const { upload_url, file_path, doc_id } = urlData;

  // Perform the actual file upload to Supabase Storage
  const uploadResponse = await fetch(upload_url, {
    method: 'PUT',
    body: fileBlob,
    headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
  });

  if (!uploadResponse.ok) throw new Error('Cloud storage upload failed');

  const confirmData = await apiCall('/docs/confirm', {
    method: 'POST',
    body: JSON.stringify({ 
      ...doc, 
      id: doc_id, 
      file_path: file_path,
      eventId: doc.eventId || doc.event_id 
    })
  });

  return confirmData.docId;
};




export const deleteDoc = async (id) => {
  await apiCall(`/docs/${id}`, { method: 'DELETE' });
};

export const downloadDoc = async (docId, filename = 'document.docx') => {
  const blob = await apiCall(`/docs/${docId}`, { isBlob: true });
  downloadFile(blob, filename);
  return blob;
};