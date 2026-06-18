import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Search, MessageSquare, Moon, Sun, Plus, X, Mail, Bell
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from './ThemeToggle';
import { filterChats, getInitials } from '../utils/helpers';
import StartChatModal from './StartChatModel';
import toast from 'react-hot-toast';
import ChatArea from './ChatArea';
import socket from '../socket';
import { connectSocket } from '../socket';

// ─── Global Styles ────────────────────────────────────────
const CustomStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap');
    * { font-family: 'Outfit', sans-serif; }

    .custom-scrollbar::-webkit-scrollbar { width: 5px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: linear-gradient(to bottom, #8b5cf6, #d946ef);
      border-radius: 10px;
    }

    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    .animate-slideIn { animation: slideIn 0.3s ease-out; }

    @keyframes pulse-dot {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    .pulse-dot { animation: pulse-dot 2s infinite; }

    @keyframes notif-in {
      from { transform: translateY(-10px) scale(0.9); opacity: 0; }
      to { transform: translateY(0) scale(1); opacity: 1; }
    }
    .notif-in { animation: notif-in 0.3s ease-out; }
  `}</style>
);

// ─── Helpers ──────────────────────────────────────────────
const getOtherParticipant = (chat, currentUserId) => {
  if (!chat?.participants) return { name: 'Unknown', avatar: null, status: 'offline' };
  const other = chat.participants.find(p => p.user && p.user._id !== currentUserId);
  if (!other?.user) return { name: 'Unknown', avatar: null, status: 'offline' };
  return {
    _id: other.user._id,
    name: other.user.name,
    email: other.user.email,
    avatar: other.user.profilePicture || other.user.avatar,
    status: other.user.status || 'offline',
    lastSeen: other.user.lastSeen,
  };
};

const getLastMsgText = (chat) => {
  if (!chat.lastMessage) return 'Start chatting...';
  if (typeof chat.lastMessage === 'string') return chat.lastMessage;
  if (chat.lastMessage?.content?.text) return chat.lastMessage.content.text;
  if (chat.lastMessage?.content) return chat.lastMessage.content;
  return 'Attachment';
};

// Request browser notification permission
const requestNotifPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
};

const showBrowserNotif = (title, body, icon) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    if (document.visibilityState !== 'visible') {
      new Notification(title, { body, icon });
    }
  }
};

// ─── Avatar ───────────────────────────────────────────────
const Avatar = ({ src, alt = 'User', size = 'md', online = false, showStatus = false }) => {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-11 h-11 text-sm', lg: 'w-14 h-14 text-base' };
  const statusSz = { sm: 'w-2 h-2', md: 'w-3 h-3', lg: 'w-3.5 h-3.5' };
  return (
    <div className="relative inline-block flex-shrink-0">
      {src ? (
        <img src={src} alt={alt} className={`${sizes[size]} rounded-full object-cover ring-2 ring-white dark:ring-slate-800`} />
      ) : (
        <div className={`${sizes[size]} rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center font-bold text-white`}>
          {getInitials(alt)}
        </div>
      )}
      {showStatus && (
        <span className={`absolute bottom-0 right-0 ${statusSz[size]} rounded-full border-2 border-white dark:border-slate-800 ${online ? 'bg-emerald-400 pulse-dot' : 'bg-slate-400'}`} />
      )}
    </div>
  );
};

// ─── Badge ────────────────────────────────────────────────
const Badge = ({ count }) => {
  if (!count || count === 0) return null;
  return (
    <span className="bg-violet-600 text-white inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold shadow-sm">
      {count > 99 ? '99+' : count}
    </span>
  );
};

// ─── Sidebar Header ───────────────────────────────────────
const SidebarHeader = ({ darkMode, onToggleDarkMode, onLogout, userName, notifCount }) => (
  <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200 dark:border-slate-700">
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
        <MessageSquare className="w-5 h-5 text-white" />
      </div>
      <div>
        <h1 className="text-lg font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent leading-none">
          ChatFlow
        </h1>
        {userName && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{userName}</p>
        )}
      </div>
    </div>

    <div className="flex items-center gap-1">
      {notifCount > 0 && (
        <div className="relative">
          <Bell className="w-5 h-5 text-slate-500" />
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold">
            {notifCount > 9 ? '9+' : notifCount}
          </span>
        </div>
      )}
      <button
        onClick={onToggleDarkMode}
        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        title="Toggle theme"
      >
        {darkMode
          ? <Sun className="w-4.5 h-4.5 text-slate-500 dark:text-slate-400" />
          : <Moon className="w-4.5 h-4.5 text-slate-500 dark:text-slate-400" />}
      </button>
      <button
        onClick={onLogout}
        className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 rounded-lg transition-colors"
      >
        Logout
      </button>
    </div>
  </div>
);

// ─── Chat List Item ───────────────────────────────────────
const ChatListItem = ({ chat, isActive, onClick, currentUserId, onlineUsers, unreadCounts }) => {
  const participant = getOtherParticipant(chat, currentUserId);
  const chatId = chat._id || chat.id;
  const isOnline = onlineUsers?.[participant._id] === 'online' || participant.status === 'online';
  const unread = unreadCounts?.[chatId] || chat.unread || chat.unreadCount || 0;
  const hasUnread = !isActive && unread > 0;
  const lastMsg = getLastMsgText(chat);

  return (
    <button
      onClick={() => onClick(chat)}
      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all border-l-2 ${
        isActive
          ? 'bg-violet-50 dark:bg-violet-950/30 border-violet-600'
          : 'border-transparent'
      }`}
    >
      <Avatar
        src={participant.avatar}
        alt={participant.name}
        size="md"
        online={isOnline}
        showStatus
      />

      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center justify-between mb-0.5">
          <h3 className={`text-sm truncate ${hasUnread ? 'font-bold text-slate-900 dark:text-white' : 'font-semibold text-slate-800 dark:text-slate-200'}`}>
            {participant.name}
          </h3>
          <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0 ml-2">
            {chat.time || ''}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          {/* ── BOLD LAST MSG IF UNREAD ─────────────────── */}
          <p className={`text-xs truncate ${
            hasUnread
              ? 'font-semibold text-slate-800 dark:text-slate-200'
              : 'font-normal text-slate-500 dark:text-slate-400'
          }`}>
            {lastMsg}
          </p>
          {hasUnread && <Badge count={unread} />}
        </div>
      </div>
    </button>
  );
};

// ─── Sidebar ──────────────────────────────────────────────
const Sidebar = ({
  darkMode, onToggleDarkMode, searchQuery, onSearchChange,
  chats, selectedChatId, onSelectChat, onLogout, userName,
  onAddClick, currentUserId, onlineUsers, unreadCounts, notifCount
}) => (
  <div className="w-80 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-col flex-shrink-0">
    <SidebarHeader
      darkMode={darkMode}
      onToggleDarkMode={onToggleDarkMode}
      onLogout={onLogout}
      userName={userName}
      notifCount={notifCount}
    />

    {/* Search + New Chat */}
    <div className="px-4 pt-4 pb-2">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-9 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30 dark:text-slate-200 placeholder-slate-400 transition-all"
          />
        </div>
        <button
          onClick={onAddClick}
          className="p-2.5 bg-gradient-to-br from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 rounded-xl transition-all shadow-lg shadow-violet-500/30"
          title="New chat"
        >
          <Plus className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>

    {/* Chat list */}
    {chats.length === 0 ? (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-100 to-fuchsia-100 dark:from-violet-900/30 dark:to-fuchsia-900/30 flex items-center justify-center mb-3">
          <MessageSquare className="w-8 h-8 text-violet-500" />
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No conversations yet</p>
        <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Click <strong>+</strong> to start one</p>
      </div>
    ) : (
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {chats.map(chat => (
          <ChatListItem
            key={chat._id || chat.id}
            chat={chat}
            isActive={(chat._id || chat.id) === selectedChatId}
            onClick={onSelectChat}
            currentUserId={currentUserId}
            onlineUsers={onlineUsers}
            unreadCounts={unreadCounts}
          />
        ))}
      </div>
    )}
  </div>
);

// ─── Info Panel ───────────────────────────────────────────
const InfoPanel = ({ chat, onClose, currentUserId, onlineUsers }) => {
  const participant = getOtherParticipant(chat, currentUserId);
  const isOnline = onlineUsers?.[participant._id] === 'online';

  return (
    <div className="w-72 border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-col animate-slideIn flex-shrink-0">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">Profile</h3>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
          <X className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="flex flex-col items-center px-5 py-8 border-b border-slate-200 dark:border-slate-700">
          <Avatar src={participant.avatar} alt={participant.name} size="lg" online={isOnline} showStatus />
          <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-slate-100">{participant.name}</h2>
          <span className={`mt-1 text-xs px-3 py-1 rounded-full font-medium ${
            isOnline
              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
          }`}>
            {isOnline ? '● Active now' : 'Offline'}
          </span>
        </div>

        <div className="px-5 py-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Contact</p>
          <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
            <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span>{participant.email || 'No email'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── MAIN CHAT APP ────────────────────────────────────────
const ChatApp = () => {
  const {
    user, logout, conversations, loadMessages, sendMessage,
    startConversation, searchUsers, loadConversations
  } = useAuth();

  const { isDark: darkMode, toggleTheme: setDarkMode } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [messages, setMessages] = useState([]);
  const [showStartChatModal, setShowStartChatModal] = useState(false);

  // ── Real-time state ───────────────────────────────────────
  const [onlineUsers, setOnlineUsers] = useState({}); // { userId: 'online'|'offline', userId_lastSeen: Date }
  const [unreadCounts, setUnreadCounts] = useState({}); // { conversationId: count }
  const [notifCount, setNotifCount] = useState(0);

  const selectedChatRef = useRef(null);
  const currentUserId = user?.id || user?._id;
  const chats = conversations || [];

  // ─ Dark mode persist ────────────────────────────────────
  

  // ─ Keep selectedChat ref fresh ──────────────────────────
  useEffect(() => { selectedChatRef.current = selectedChat; }, [selectedChat]);

  // ─ Request browser notifications ────────────────────────
  useEffect(() => { requestNotifPermission(); }, []);

  // ─ Build initial online status from conversations ────────
  useEffect(() => {
    const status = {};
    chats.forEach(c => {
      const other = getOtherParticipant(c, currentUserId);
      if (other._id) {
        status[other._id] = other.status || 'offline';
        if (other.lastSeen) status[`${other._id}_lastSeen`] = other.lastSeen;
      }
    });
    setOnlineUsers(prev => ({ ...prev, ...status }));
  }, [chats, currentUserId]);

  // ─ Socket setup ─────────────────────────────────────────
  useEffect(() => {
    if (!currentUserId) return;
    connectSocket(currentUserId);
  }, [currentUserId]);

  // ─ Socket event: receive message in chat area ────────────
  useEffect(() => {
    const handleReceive = (message) => {
      const msgChatId = message.conversationId || message.conversation;
      const curr = selectedChatRef.current;
      const currId = curr?._id || curr?.id;

      if (currId === msgChatId) {
        // Chat is open → show immediately, no unread
        setMessages(prev => {
          const exists = prev.some(m => (m._id || m.id) === (message._id || message.id));
          return exists ? prev : [...prev, message];
        });

        // Emit read receipt
        socket.emit('messages-read', {
          conversationId: msgChatId,
          readerId: currentUserId,
        });
      }
    };

    socket.on('receive-message', handleReceive);
    return () => socket.off('receive-message', handleReceive);
  }, [currentUserId]);

  // ─ Socket: SIDEBAR UPDATE (new msg for a chat not open) ──
  useEffect(() => {
    const handleSidebarMsg = ({ conversationId, message }) => {
      const curr = selectedChatRef.current;
      const currId = curr?._id || curr?.id;

      // Only increment if this conversation is NOT the currently open one
      if (conversationId !== currId) {
        setUnreadCounts(prev => ({
          ...prev,
          [conversationId]: (prev[conversationId] || 0) + 1,
        }));
        setNotifCount(prev => prev + 1);

        // Browser notification
        const senderName = message.sender?.name || 'Someone';
        const msgText = message.content?.text || message.text || '📎 Attachment';
        showBrowserNotif(senderName, msgText.slice(0, 80));

        // Update sidebar last message (reload conversations)
        loadConversations();
      }
    };

    socket.on('sidebar-new-message', handleSidebarMsg);
    return () => socket.off('sidebar-new-message', handleSidebarMsg);
  }, [loadConversations]);

  // ─ Socket: online/offline status changes ────────────────
  useEffect(() => {
    const handleStatusChange = ({ userId, status, lastSeen }) => {
      setOnlineUsers(prev => ({
        ...prev,
        [userId]: status,
        [`${userId}_lastSeen`]: lastSeen || prev[`${userId}_lastSeen`],
      }));

      // Update status in selectedChat in-memory
      setSelectedChat(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants?.map(p => {
            if (p.user?._id === userId) {
              return { ...p, user: { ...p.user, status, lastSeen } };
            }
            return p;
          }),
        };
      });
    };

    socket.on('user-status-change', handleStatusChange);
    return () => socket.off('user-status-change', handleStatusChange);
  }, []);

  // ─ Socket: new conversation ──────────────────────────────
  useEffect(() => {
    const handle = () => {
      loadConversations();
      toast.success('New conversation started!');
    };
    socket.on('new-conversation', handle);
    return () => socket.off('new-conversation', handle);
  }, [loadConversations]);

  // ─ Join socket room when chat opens ─────────────────────
  useEffect(() => {
    if (!selectedChat) return;
    const chatId = selectedChat._id || selectedChat.id;
    socket.emit('join-conversation', chatId);
    return () => socket.emit('leave-conversation', chatId);
  }, [selectedChat]);

  // ─ Load messages when chat selected ─────────────────────
  useEffect(() => {
    if (!selectedChat) return;
    const load = async () => {
      const chatId = selectedChat._id || selectedChat.id;
      const msgs = await loadMessages(chatId);
      setMessages(msgs || []);
    };
    load();
  }, [selectedChat]);

  // ── Actions ───────────────────────────────────────────────
  const handleSelectChat = async (chat) => {
    setSelectedChat(chat);
    setShowInfo(false);

    const chatId = chat._id || chat.id;

    // Clear unread for this chat
    setUnreadCounts(prev => ({ ...prev, [chatId]: 0 }));
    setNotifCount(prev => Math.max(0, prev - (unreadCounts[chatId] || 0)));

    // Mark as read on server
    try {
      const token = localStorage.getItem('chatflow_token');
      await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/messages/read/${chatId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });

      // Notify sender that messages were read
      socket.emit('messages-read', { conversationId: chatId, readerId: currentUserId });
    } catch (_) {}

    loadConversations();
  };

  const handleSendMessage = async (files = []) => {
    if (!inputValue.trim() && files.length === 0) return;
    if (!selectedChat) return;

    const chatId = selectedChat._id || selectedChat.id;

    // Get recipient IDs (everyone except me) for sidebar socket notification
    const recipientIds = selectedChat.participants
      ?.filter(p => (p.user?._id || p.user?.id) !== currentUserId)
      .map(p => p.user?._id || p.user?.id)
      .filter(Boolean) || [];

    try {
      const newMessage = await sendMessage(chatId, inputValue, files);

      setMessages(prev => {
        const exists = prev.some(m => (m._id || m.id) === (newMessage._id || newMessage.id));
        return exists ? prev : [...prev, newMessage];
      });

      setInputValue('');

      // Emit to socket → room (chatarea) + direct to recipients (sidebar)
      socket.emit('send-message', {
        conversationId: chatId,
        message: newMessage,
        recipientIds,  // ← THIS FIXES SIDEBAR NOT UPDATING
      });

      loadConversations();
    } catch (err) {
      console.error('Send error:', err);
    }
  };

  const handleLogout = () => {
    toast((t) => (
      <div className="flex flex-col gap-2">
        <p className="font-medium">Logout from ChatFlow?</p>
        <div className="flex gap-2">
          <button className="bg-red-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
            onClick={() => { logout(); toast.dismiss(t.id); }}>
            Logout
          </button>
          <button className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-4 py-1.5 rounded-lg text-sm"
            onClick={() => toast.dismiss(t.id)}>
            Cancel
          </button>
        </div>
      </div>
    ), { duration: 10000 });
  };

  const handleStartChat = async (selectedUser) => {
    try {
      const conversation = await startConversation(selectedUser._id || selectedUser.id);

      // Get participant IDs for socket notification
      const recipientIds = [selectedUser._id || selectedUser.id];

      socket.emit('create-conversation', { conversation, recipientIds });

      const existing = chats.find(c =>
        c._id?.toString() === conversation._id?.toString()
      );
      setSelectedChat(existing || conversation);
      setShowStartChatModal(false);
    } catch (err) {
      console.error('Start chat error:', err);
    }
  };

  const filteredChats = filterChats(chats, searchQuery, currentUserId);

  return (
    <div className={darkMode ? 'dark' : ''}>
      <CustomStyles />
      <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
        {/* ── Sidebar ─── */}
        <Sidebar
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode(d => !d)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          chats={filteredChats}
          selectedChatId={selectedChat?._id || selectedChat?.id}
          onSelectChat={handleSelectChat}
          onLogout={handleLogout}
          userName={user?.name}
          onAddClick={async () => {
            setShowStartChatModal(true);
            try {
              const users = await searchUsers('');
              setAvailableUsers(users || []);
            } catch (_) {}
          }}
          currentUserId={currentUserId}
          onlineUsers={onlineUsers}
          unreadCounts={unreadCounts}
          notifCount={notifCount}
        />

        {/* ── Chat Area ─── */}
        <ChatArea
          selectedChat={selectedChat}
          messages={messages}
          inputValue={inputValue}
          onInputChange={setInputValue}
          onSendMessage={handleSendMessage}
          onToggleInfo={() => setShowInfo(s => !s)}
          currentUserId={currentUserId}
          onlineUsers={onlineUsers}
        />

        {/* ── Info Panel ─── */}
        {showInfo && selectedChat && (
          <InfoPanel
            chat={selectedChat}
            onClose={() => setShowInfo(false)}
            currentUserId={currentUserId}
            onlineUsers={onlineUsers}
          />
        )}
      </div>

      {/* ── Start Chat Modal ─── */}
      <StartChatModal
        isOpen={showStartChatModal}
        onClose={() => setShowStartChatModal(false)}
        onStartChat={handleStartChat}
        users={availableUsers}
      />
    </div>
  );
};

export default ChatApp;