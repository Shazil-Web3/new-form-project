import apiClient from './apiClient';

export const getTrendingItems = async (filters = {}) => {
  const response = await apiClient.get('/api/trending', { params: filters });
  return response.data;
};

export const toggleTrendingFavorite = async ({ itemType, itemId }) => {
  const response = await apiClient.post('/api/trending/favorite', { itemType, itemId });
  return response.data;
};
