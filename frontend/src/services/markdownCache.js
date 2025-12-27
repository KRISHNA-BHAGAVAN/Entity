import { getDocs } from './storage';
import { apiCall } from '../config/api';
import { cacheService } from './cacheService';
import { supabase } from './supabaseClient';

export const getMarkdownFromCache = async (docId) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return await cacheService.getMarkdown(docId, user.id);
};

export const setMarkdownInCache = async (docId, markdown) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await cacheService.setMarkdown(docId, markdown, user.id);
};

export const preloadEventMarkdown = async (eventId) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    console.log(`Preloading markdown for event: ${eventId}`);
    const docs = await getDocs(eventId);
    
    const promises = docs.map(async (doc) => {
      // Skip if already cached
      const cached = await cacheService.getMarkdown(doc.id, user.id);
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
          await cacheService.setMarkdown(doc.id, markdown, user.id);
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await cacheService.clearUserCache(user.id);
};