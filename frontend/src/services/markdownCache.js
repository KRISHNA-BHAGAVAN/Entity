import { getDocs } from './storage';
import { apiCall } from '../config/api';
import { cacheService } from './cacheService';
import { getCurrentUserId } from './authSession';

export const getMarkdownFromCache = async (docId) => {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  return await cacheService.getMarkdown(docId, userId);
};

export const setMarkdownInCache = async (docId, markdown) => {
  const userId = await getCurrentUserId();
  if (!userId) return;
  await cacheService.setMarkdown(docId, markdown, userId);
};

export const preloadEventMarkdown = async (eventId) => {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return;
    
    console.log(`Preloading markdown for event: ${eventId}`);
    const docs = await getDocs(eventId);
    
    const promises = docs.map(async (doc) => {
      // Skip if already cached
      const cached = await cacheService.getMarkdown(doc.id, userId);
      if (cached) return;
      
      try {
        let markdown = doc.markdownContent;
        
        if (!markdown?.trim()) {
          console.log(`Extracting markdown for doc: ${doc.name}`);
          const formData = new FormData();
          
          const fileBlob = await apiCall(`/docs/${doc.id}`, { isBlob: true });
          formData.append('file', fileBlob, doc.name);
          
          const result = await apiCall('/extract-markdown', {
            method: 'POST',
            body: formData
          });
          
          markdown = result.markdown;
        }
        
        if (markdown) {
          await cacheService.setMarkdown(doc.id, markdown, userId);
          console.log(`Cached markdown for: ${doc.name} (${markdown.length} chars)`);
        }
      } catch (err) {
        console.error(`Failed to cache markdown for ${doc.name}:`, err);
      }
    });
    
    await Promise.all(promises);
    console.log(`Markdown preloading completed for event: ${eventId}`);
    
  } catch (err) {
    console.error('Failed to preload markdown:', err);
  }
};

export const clearMarkdownCache = async () => {
  const userId = await getCurrentUserId();
  if (!userId) return;
  await cacheService.clearUserCache(userId);
};