/**
 * @file references.js
 * @description API service for fetching and managing cross-document & template references
 */

import apiClient from './apiClient';

/**
 * Fetch cross-document references with optional scope, status, and search filters
 * @param {object} params { type, status, search }
 * @returns {Promise<{ data: Array, metrics: object, roleScope: string }>}
 */
export async function getReferences(params = {}) {
  try {
    const response = await apiClient.get('/api/references', { params });
    return response.data;
  } catch (error) {
    console.error('Failed to get references:', error);
    throw error;
  }
}

/**
 * Trigger an on-demand re-index of references across documents and templates
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function syncHistoricalReferences() {
  try {
    const response = await apiClient.post('/api/references/sync');
    return response.data;
  } catch (error) {
    console.error('Failed to sync references:', error);
    throw error;
  }
}

/**
 * Check if any referenced document in the current document/template is obsolete (archived)
 * @param {object} payload { sourceType: 'document'|'template', sourceId: string, content?: string|object, elements?: object }
 * @returns {Promise<{ success: boolean, hasObsolete: boolean, obsoleteDocuments: Array }>}
 */
export async function checkObsoleteReferences(payload = {}) {
  try {
    const response = await apiClient.post('/api/references/check-obsolete', payload);
    return response.data;
  } catch (error) {
    console.warn('Failed to check obsolete references:', error);
    return { success: false, hasObsolete: false, obsoleteDocuments: [] };
  }
}

/**
 * Check if any active document or template is currently referencing this target document
 * @param {string} targetId
 * @returns {Promise<{ success: boolean, isBlocked: boolean, referencingItems: Array }>}
 */
export async function checkInboundReferences(targetId) {
  try {
    const response = await apiClient.post('/api/references/check-inbound', { targetId });
    return response.data;
  } catch (error) {
    console.warn('Failed to check inbound references:', error);
    return { success: false, isBlocked: false, referencingItems: [] };
  }
}


