import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback
} from 'react';
import {
  authAPI,
  conversationAPI,
  messageAPI,
  userAPI
} from '../components/api.js';
import toast from 'react-hot-toast';
import { connectSocket, disconnectSocket } from '../socket';
const AuthContext = createContext(null);

const STORAGE_KEYS = {
  USER: 'chatflow_user',
  TOKEN: 'chatflow_token',
  CONVERSATIONS: 'chatflow_conversations'
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem(STORAGE_KEYS.TOKEN));
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState({});

  /* ===============================
     🔐 Initialize Auth
  =============================== */

  const initializeAuth = useCallback(async () => {
    const storedToken = localStorage.getItem(STORAGE_KEYS.TOKEN);

    if (!storedToken) {
      setLoading(false);
      return;
    }

    try {
      // ✅ FIXED: axios returns response.data, not response directly
      const response = await authAPI.getMe();
      const data = response.data;

      if (!data.success) {
        throw new Error('Invalid token');
      }

      setUser(data.data);
      setToken(storedToken);

      // ✅ FIXED: Load conversations separately, don't let it break auth
      try {
        await loadConversations();
      } catch (convError) {
        console.warn('Could not load conversations:', convError);
        // Don't clear auth just because conversations failed to load
      }

    } catch (error) {
      console.error('Auth initialization failed:', error.message);
      clearAuth();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  /* ===============================
     💾 Sync Storage
  =============================== */

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER);
    }
  }, [user]);

  useEffect(() => {
    if (token) {
      localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    } else {
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
    }
  }, [token]);

  const clearAuth = () => {
    setUser(null);
    setToken(null);
    setConversations([]);
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.CONVERSATIONS);
  };

  /* ===============================
     👤 AUTH FUNCTIONS
  =============================== */

  const register = async (name, email, password) => {
    try {
      // ✅ FIXED: axios wraps in response.data
      const response = await authAPI.register(name, email, password);
      const data = response.data;

      if (!data.success) throw new Error(data.message);

      setUser(data.data.user);
      setToken(data.data.token);

      toast.success('Registration successful!');
      return data;
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
      throw error;
    }
  };

  const login = async (email, password) => {
    try {
      // ✅ FIXED: axios wraps in response.data
      const response = await authAPI.login(email, password);
      const data = response.data;

      setUser(data.data.user);
      setToken(data.data.token);
      const userId = response.data.user.id || response.data.user._id;
      connectSocket(userId);

      toast.success('Login successful!');
      return data;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invalid credentials');
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error(error);
    } finally {
      disconnectSocket();
      clearAuth();
      toast.success('Logged out successfully');
    }
  };

  /* ===============================
     💬 Conversations
  =============================== */

  const loadConversations = async () => {
    try {
      // ✅ FIXED: axios wraps in response.data
      const response = await conversationAPI.getConversations();
      const data = response.data;

      if (!data.success) throw new Error('Failed to load conversations');

      setConversations(data.data);
      localStorage.setItem(
        STORAGE_KEYS.CONVERSATIONS,
        JSON.stringify(data.data)
      );

      return data.data;
    } catch (error) {
      // ✅ Fall back to cached conversations
      const fallback =
        JSON.parse(localStorage.getItem(STORAGE_KEYS.CONVERSATIONS)) || [];
      setConversations(fallback);
      throw error; // Re-throw so caller knows it failed
    }
  };

  const startConversation = async (userId) => {
    try {
      const response = await conversationAPI.createDirectConversation(userId);
      const data = response.data;

      if (!data.success) throw new Error(data.message);

      const newConversation = data.data;
      const isExisting = data.message === 'Conversation already exists';

      if (isExisting) {
        // ✅ Don't add to list, just return it — it's already in conversations
        return newConversation;
      }

      // ✅ Only add if truly new
      setConversations((prev) => {
        const alreadyExists = prev.some(
          conv =>
            (conv._id && conv._id.toString()) ===
            (newConversation._id && newConversation._id.toString())
        );
        if (alreadyExists) return prev;
        return [newConversation, ...prev];
      });

      localStorage.setItem(
        STORAGE_KEYS.CONVERSATIONS,
        JSON.stringify([newConversation, ...conversations])
      );

      toast.success('Conversation started!');
      return newConversation;
    } catch (error) {
      toast.error('Failed to start conversation');
      throw error;
    }
  };

  /* ===============================
     ✉️ Messages
  =============================== */

  const loadMessages = async (conversationId) => {
    try {
      // ✅ FIXED: axios wraps in response.data
      const response = await messageAPI.getMessages(conversationId);
      const data = response.data;

      if (!data.success) return [];

      setMessages((prev) => ({
        ...prev,
        [conversationId]: data.data
      }));

      return data.data;
    } catch (error) {
      console.error('Error loading messages:', error);
      return [];
    }
  };

  const sendMessage = async (conversationId, text, files = []) => {
    try {
      // ✅ messageAPI.sendMessage already returns response.data (see api.js)
      const data = await messageAPI.sendMessage(conversationId, text, files);

      if (!data.success) throw new Error(data.message);

      const newMessage = data.data;

      setMessages((prev) => ({
        ...prev,
        [conversationId]: [...(prev[conversationId] || []), newMessage]
      }));

      const lastMessagePreview = text ||
        (files.length > 0 ? `📎 ${files.length} file(s)` : '');

      setConversations((prev) =>
        prev.map((conv) =>
          conv._id === conversationId || conv.id === conversationId
            ? {
              ...conv,
              lastMessage: lastMessagePreview.substring(0, 50),
              time: 'Just now'
            }
            : conv
        )
      );

      return newMessage;
    } catch (error) {
      console.error('Send message error:', error);
      toast.error('Failed to send message');
      throw error;
    }
  };

  /* ===============================
     🔍 Search Users
  =============================== */

  const searchUsers = async (query) => {
    try {
      // ✅ FIXED: axios wraps in response.data
      const response = await userAPI.searchUsers(query);
      const data = response.data;

      if (data.success && Array.isArray(data.data)) {
        return data.data;
      }

      if (Array.isArray(data)) {
        return data;
      }

      return [];
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search users');
      return [];
    }
  };

  /* ===============================
     CONTEXT VALUE
  =============================== */

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!user,
    conversations,
    register,
    login,
    logout,
    loadConversations,
    startConversation,
    loadMessages,
    sendMessage,
    searchUsers
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export default AuthContext;