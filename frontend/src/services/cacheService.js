import Dexie from 'dexie';

class CacheService extends Dexie {
  constructor() {
    super('EntityCache');
    
    this.version(1).stores({
      markdownCache: '++id, [docId+userId], docId, userId, content, timestamp',
      schemaCache: '++id, [key+userId], key, userId, schema, timestamp'
    });
  }

  // Markdown caching
  async getMarkdown(docId, userId) {
    const cached = await this.markdownCache
      .where('[docId+userId]')
      .equals([docId, userId])
      .first();
    
    if (cached && this.isValid(cached.timestamp)) {
      return cached.content;
    }
    return null;
  }

  async setMarkdown(docId, content, userId) {
    await this.markdownCache.put({
      docId,
      content,
      userId,
      timestamp: Date.now()
    });
  }

  // Schema caching
  async getSchema(key, userId) {
    const cached = await this.schemaCache
      .where('[key+userId]')
      .equals([key, userId])
      .first();
    
    if (cached && this.isValid(cached.timestamp)) {
      return cached.schema;
    }
    return null;
  }

  async setSchema(key, schema, userId) {
    await this.schemaCache.put({
      key,
      schema,
      userId,
      timestamp: Date.now()
    });
  }

  // Cache validation (24 hours)
  isValid(timestamp) {
    return Date.now() - timestamp < 24 * 60 * 60 * 1000;
  }

  // Clear user cache
  async clearUserCache(userId) {
    await this.markdownCache.where('userId').equals(userId).delete();
    await this.schemaCache.where('userId').equals(userId).delete();
  }
}

export const cacheService = new CacheService();