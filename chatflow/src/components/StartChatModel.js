import React, { useState, useEffect } from 'react';
import { X, Search, MessageSquare, Loader } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getInitials } from '../utils/helpers';
import toast from 'react-hot-toast';

const StartChatModal = ({ isOpen, onClose, onStartChat }) => {
  const { searchUsers, user } = useAuth(); // ✅ Get current user
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState([]); // ✅ Store all users
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // ✅ Load all users when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchAllUsers();
    } else {
      // Reset when modal closes
      setSearchQuery('');
      setSearchResults([]);
      setAllUsers([]);
    }
  }, [isOpen]);

  const fetchAllUsers = async () => {
    setLoading(true);
    try {
      const users = await searchUsers('');
      const currentUserId = user?.id || user?._id;
      
      // ✅ Filter out current user
      const filteredUsers = (users || []).filter(
        u => u._id !== currentUserId && u.id !== currentUserId
      );
      
      setAllUsers(filteredUsers);
      setSearchResults(filteredUsers);
    } catch (error) {
      toast.error('Failed to load users');
      setAllUsers([]);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ CLIENT-SIDE SEARCH (faster than API calls)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(allUsers);
      return;
    }

    const lowerQuery = searchQuery.toLowerCase().trim();
    
    const filtered = allUsers.filter(user => {
      const name = user.name || '';
      const email = user.email || '';
      
      return (
        (typeof name === 'string' && name.toLowerCase().includes(lowerQuery)) ||
        (typeof email === 'string' && email.toLowerCase().includes(lowerQuery))
      );
    });

    setSearchResults(filtered);
  }, [searchQuery, allUsers]);

  const handleSelectUser = async (user) => {
    setSelectedUser(user);
    try {
      await onStartChat(user);
      onClose();
      setSearchQuery('');
      setSearchResults([]);
      setAllUsers([]);
      setSelectedUser(null);
    } catch (error) {
      toast.error('Failed to start conversation');
      setSelectedUser(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col border border-slate-200 dark:border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Start a Chat
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 dark:text-slate-200 placeholder-slate-400"
              autoFocus
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-6 h-6 text-violet-600 animate-spin" />
            </div>
          ) : searchResults.length > 0 ? (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {searchResults.map((user) => (
                <button
                  key={user._id || user.id}
                  onClick={() => handleSelectUser(user)}
                  disabled={selectedUser?._id === user._id}
                  className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {user.profilePicture || user.avatar ? (
                    <img
                      src={user.profilePicture || user.avatar}
                      alt={user.name}
                      className="w-12 h-12 rounded-full object-cover ring-2 ring-white dark:ring-slate-800"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center font-semibold text-white ring-2 ring-white dark:ring-slate-800">
                      {getInitials(user.name)}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {user.name}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                      {user.email}
                    </p>
                  </div>

                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : searchQuery.trim() ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-600 dark:text-slate-400">
                No users found matching "{searchQuery}"
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-100 to-fuchsia-100 dark:from-violet-900/30 dark:to-fuchsia-900/30 flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-violet-600 dark:text-violet-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Start a Conversation
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Search for people by name or email to start chatting
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #8b5cf6, #d946ef);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
};

export default StartChatModal;