import { useState, useEffect } from 'react';
import { getMarkdownContent, getSchemaCache, setSchemaCache } from '../services/docService';
import { getMarkdownFromCache } from '../services/markdownCache';

export const useMarkdownCache = (docId) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!docId) {
      setContent('');
      return;
    }

    const loadContent = async () => {
      setLoading(true);
      try {
        let markdown = await getMarkdownFromCache(docId);
        
        if (!markdown) {
          markdown = await getMarkdownContent(docId);
        }
        
        setContent(markdown || '');
      } catch (error) {
        console.error('Failed to load markdown:', error);
        setContent('');
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [docId]);

  return { content, loading };
};

export const useSchemaCache = (key) => {
  const [schema, setSchema] = useState(null);

  const getSchema = async () => {
    const cached = await getSchemaCache(key);
    setSchema(cached);
    return cached;
  };

  const saveSchema = async (newSchema) => {
    await setSchemaCache(key, newSchema);
    setSchema(newSchema);
  };

  return { schema, getSchema, saveSchema };
};