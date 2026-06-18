import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true
});

// Attach token automatically
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('chatflow_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ✅ FIXED: Only redirect on 401 for non-auth routes
// Don't redirect during the initial auth check
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthRoute =
      error.config?.url?.includes('/users/me') ||
      error.config?.url?.includes('/users/login') ||
      error.config?.url?.includes('/users/register');

    if (error.response?.status === 401 && !isAuthRoute) {
      localStorage.removeItem('chatflow_token');
      localStorage.removeItem('chatflow_user');
      localStorage.removeItem('chatflow_conversations');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

// AUTH APIs
export const authAPI = {
  register: (name, email, password) =>
    api.post('/users/register', { name, email, password }),

  login: (email, password) =>
    api.post('/users/login', { email, password }),

  logout: () => api.post('/users/logout'),

  getMe: () => api.get('/users/me')
};

// USER APIs
export const userAPI = {
  searchUsers: (query) =>
    api.get(`/users/search?query=${encodeURIComponent(query || '')}`),

  getUserById: (userId) =>
    api.get(`/users/${userId}`),

  updateProfile: (payload) =>
    api.put('/users/me', payload)
};

// CONVERSATION APIs
export const conversationAPI = {
  getConversations: () =>
    api.get('/conversations'),

  createDirectConversation: (userId) =>
    api.post('/conversations/direct', { userId })
};

// MESSAGE APIs
export const messageAPI = {
  sendMessage: async (conversationId, text = '', files = []) => {
    const formData = new FormData();
    formData.append('conversationId', conversationId);

    if (text) {
      formData.append('text', text);
    }

    files.forEach((file) => {
      formData.append('attachments', file);
    });

    const response = await api.post('/messages', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    return response.data;
  },

  getMessages: (conversationId, page = 1, limit = 50) =>
    api.get(`/messages/${conversationId}?page=${page}&limit=${limit}`),

  deleteMessage: (messageId, deleteForEveryone = false) =>
    api.delete(`/messages/${messageId}?deleteForEveryone=${deleteForEveryone}`),

  markAsRead: (messageId) =>
    api.put(`/messages/${messageId}/read`),

  addReaction: (messageId, emoji) =>
    api.post(`/messages/${messageId}/reactions`, { emoji }),

  removeReaction: (messageId) =>
    api.delete(`/messages/${messageId}/reactions`)
};

export default api;