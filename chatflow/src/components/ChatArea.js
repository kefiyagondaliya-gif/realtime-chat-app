import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Paperclip, Smile, MoreVertical, Phone, Video, Info,
  X, Check, CheckCheck, MessageSquare
} from 'lucide-react';
import { useAutoScroll } from '../utils/hooks';
import { shouldGroupMessages, getInitials } from '../utils/helpers';
import EmojiPicker from 'emoji-picker-react';
import toast from 'react-hot-toast';
import socket from '../socket';
import VideoCallModal, { IncomingCallBanner } from './VideoCallModal';

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

// Real-time "Active X ago" / "Active now"
const getStatusText = (status, lastSeen) => {
  if (status === 'online') return 'Active now';
  if (!lastSeen) return 'Offline';
  const now = Date.now();
  const seen = new Date(lastSeen).getTime();
  const diff = now - seen;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Active just now';
  if (mins < 60) return `Active ${mins}m ago`;
  if (hours < 24) return `Active ${hours}h ago`;
  if (days === 1) return 'Active yesterday';
  return `Active ${days}d ago`;
};

// Detect emoji-only messages for larger rendering
const EMOJI_REGEX = /^(\p{Emoji_Presentation}|\p{Extended_Pictographic}|\uFE0F|\u200D)+$/u;
const isEmojiOnly = (text) => {
  if (!text) return false;
  const stripped = text.trim();
  if (stripped.length > 20) return false;
  return EMOJI_REGEX.test(stripped);
};
const countEmojis = (text) => {
  const segments = [...(new Intl.Segmenter('en', { granularity: 'grapheme' })).segment(text)];
  return segments.length;
};

// ─── Styles ───────────────────────────────────────────────
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

    .emoji-only-sm { font-size: 2.5rem; line-height: 1.2; }
    .emoji-only-md { font-size: 3.5rem; line-height: 1.2; }
    .emoji-only-lg { font-size: 4.5rem; line-height: 1.2; }

    @keyframes typing-bounce {
      0%, 80%, 100% { transform: translateY(0); }
      40% { transform: translateY(-6px); }
    }
    .typing-dot { animation: typing-bounce 1.2s infinite; }
    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    .animate-slideIn { animation: slideIn 0.3s ease-out; }
    
    @keyframes slideDown {
      from { transform: translateY(-20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .animate-slideDown { animation: slideDown 0.3s ease-out; }

    .chat-bubble-sent {
      background: linear-gradient(135deg, #7c3aed, #a21caf);
    }
  `}</style>
);

// ─── Avatar ───────────────────────────────────────────────
const Avatar = ({ src, alt = 'User', size = 'md', online = false, showStatus = false }) => {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-base' };
  const statusSize = { sm: 'w-2 h-2', md: 'w-2.5 h-2.5', lg: 'w-3.5 h-3.5' };
  return (
    <div className="relative inline-block flex-shrink-0">
      {src ? (
        <img src={src} alt={alt} className={`${sizes[size]} rounded-full object-cover ring-2 ring-white dark:ring-slate-800`} />
      ) : (
        <div className={`${sizes[size]} rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center font-bold text-white ring-2 ring-white dark:ring-slate-800`}>
          {getInitials(alt)}
        </div>
      )}
      {showStatus && (
        <span className={`absolute bottom-0 right-0 ${statusSize[size]} rounded-full border-2 border-white dark:border-slate-800 ${online ? 'bg-emerald-400' : 'bg-slate-400'}`} />
      )}
    </div>
  );
};

// ─── Typing Indicator ────────────────────────────────────
const TypingIndicator = ({ typers }) => {
  if (!typers || typers.length === 0) return null;
  return (
    <div className="flex items-center gap-2 px-6 py-2">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400 flex items-center justify-center text-white text-xs font-semibold">
        {getInitials(typers[0]?.name || '?')}
      </div>
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-2xl rounded-bl-sm">
        <div className="typing-dot w-2 h-2 bg-slate-400 rounded-full" />
        <div className="typing-dot w-2 h-2 bg-slate-400 rounded-full" />
        <div className="typing-dot w-2 h-2 bg-slate-400 rounded-full" />
      </div>
      <span className="text-xs text-slate-400">{typers[0]?.name} is typing...</span>
    </div>
  );
};

// ─── Message Bubble ────────────────────────────────────────
const MessageBubble = ({ message, showAvatar, isGrouped, currentUserId, selectedChat, seenByOther }) => {
  const isSent = message.sender === currentUserId ||
    message.sender?._id === currentUserId ||
    message.sender?.id === currentUserId;

  const getSenderName = () => {
    if (isSent) return 'You';
    if (message.sender?.name) return message.sender.name;
    if (selectedChat?.participants) {
      const sid = message.sender?._id || message.sender?.id || message.sender;
      const p = selectedChat.participants.find(p => String(p.user?._id || p.user?.id) === String(sid));
      if (p?.user?.name) return p.user.name;
    }
    return 'Unknown';
  };

  const getText = () => {
    if (message.content?.text) return message.content.text;
    if (message.text) return message.text;
    return '';
  };

  const getTime = () => {
    if (message.time) return message.time;
    if (message.createdAt) {
      return new Date(message.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    return '';
  };

  const text = getText();
  const emojiOnly = isEmojiOnly(text);
  const emojiCount = emojiOnly ? countEmojis(text) : 0;

  const getEmojiClass = () => {
    if (emojiCount <= 2) return 'emoji-only-lg';
    if (emojiCount <= 4) return 'emoji-only-md';
    return 'emoji-only-sm';
  };

  const hasAttachments = message.attachments && message.attachments.length > 0;

  return (
    <div className={`flex gap-2 ${isSent ? 'justify-end' : 'justify-start'} ${isGrouped ? 'mt-0.5' : 'mt-4'}`}>
      {!isSent && (
        <div className={`${showAvatar ? 'visible' : 'invisible'} w-8 self-end`}>
          {showAvatar && (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-xs font-semibold">
              {getInitials(getSenderName())}
            </div>
          )}
        </div>
      )}

      <div className={`flex flex-col ${isSent ? 'items-end' : 'items-start'} max-w-[70%]`}>
        {/* Bubble */}
        {emojiOnly ? (
          <div className={`px-1 py-1 ${getEmojiClass()} select-text`}>
            {text}
          </div>
        ) : (
          <div className={`px-4 py-2.5 rounded-2xl shadow-sm ${
            isSent
              ? 'chat-bubble-sent text-white rounded-br-none'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-none'
          }`}>
            {/* Text content */}
            {text && (
              <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{text}</p>
            )}

            {/* Attachments */}
            {hasAttachments && message.attachments.map((att, i) => (
              <div key={i} className="mt-2">
                {att.type === 'image' ? (
                  <img
                    src={`http://localhost:5000${att.url}`}
                    alt={att.filename}
                    className="max-w-full max-h-64 rounded-lg object-cover cursor-pointer"
                    onClick={() => window.open(`http://localhost:5000${att.url}`, '_blank')}
                  />
                ) : att.type === 'video' ? (
                  <video
                    src={`http://localhost:5000${att.url}`}
                    controls
                    className="max-w-full max-h-48 rounded-lg"
                  />
                ) : (
                  <a
                    href={`http://localhost:5000${att.url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-xs underline opacity-80"
                  >
                    📎 {att.filename}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Time + read receipt */}
        <div className="flex items-center gap-1 mt-0.5 px-1">
          <span className="text-xs text-slate-400 dark:text-slate-500">{getTime()}</span>
          {isSent && (
            <span>
              {seenByOther ? (
                <CheckCheck className="w-3.5 h-3.5 text-violet-400" title="Seen" />
              ) : message.readBy?.length > 1 ? (
                <CheckCheck className="w-3.5 h-3.5 text-blue-400" title="Read" />
              ) : (
                <Check className="w-3.5 h-3.5 text-slate-400" title="Sent" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Message List ─────────────────────────────────────────
const MessageList = ({ messages, currentUserId, selectedChat, typers, seenInfo }) => {
  const scrollRef = useAutoScroll(messages);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-900">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-100 to-fuchsia-100 dark:from-violet-900/30 dark:to-fuchsia-900/30 flex items-center justify-center mx-auto mb-3">
            <MessageSquare className="w-8 h-8 text-violet-500" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm">No messages yet. Say hi! 👋</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 bg-white dark:bg-slate-900 custom-scrollbar space-y-0">
      {messages.map((msg, i) => {
        const prev = i > 0 ? messages[i - 1] : null;
        const isGrouped = shouldGroupMessages(msg, prev);
        const showAvatar = !isGrouped;
        const isLast = i === messages.length - 1;
        const isSent = msg.sender === currentUserId ||
          msg.sender?._id === currentUserId ||
          msg.sender?.id === currentUserId;
        const seenByOther = isLast && isSent && seenInfo?.seen;

        return (
          <MessageBubble
            key={msg.id || msg._id || i}
            message={msg}
            showAvatar={showAvatar}
            isGrouped={isGrouped}
            currentUserId={currentUserId}
            selectedChat={selectedChat}
            seenByOther={seenByOther}
          />
        );
      })}
      <TypingIndicator typers={typers} />
    </div>
  );
};

// ─── Message Input ────────────────────────────────────────
const MessageInput = ({ value, onChange, onSend, onTypingStart, onTypingStop, disabled }) => {
  const [showEmoji, setShowEmoji] = useState(false);
  const [files, setFiles] = useState([]);
  const fileRef = useRef(null);
  const typingTimerRef = useRef(null);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e) => {
    onChange(e.target.value);
    // Typing indicator
    onTypingStart?.();
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      onTypingStop?.();
    }, 2000);
  };

  const handleEmojiClick = (emojiObj) => {
    onChange(value + emojiObj.emoji);
    setShowEmoji(false);
  };

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files);
    if (selected.some(f => f.size > 50 * 1024 * 1024)) {
      toast.error('Max file size is 50MB');
      return;
    }
    setFiles(prev => [...prev, ...selected].slice(0, 5));
    e.target.value = '';
  };

  const handleSend = () => {
    if (!value.trim() && files.length === 0) return;
    onTypingStop?.();
    clearTimeout(typingTimerRef.current);
    onSend(files);
    setFiles([]);
    setShowEmoji(false);
  };

  const getIcon = (f) => {
    if (f.type.startsWith('image/')) return '🖼️';
    if (f.type.startsWith('video/')) return '🎥';
    if (f.type.includes('pdf')) return '📄';
    return '📎';
  };

  return (
    <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      {/* File previews */}
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 dark:bg-violet-900/20 rounded-lg border border-violet-200 dark:border-violet-800 text-sm">
              <span>{getIcon(f)}</span>
              <span className="text-slate-700 dark:text-slate-300 truncate max-w-[120px]">{f.name}</span>
              <button onClick={() => setFiles(p => p.filter((_, j) => j !== i))}>
                <X className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 relative">
        {/* Attachment */}
        <button
          onClick={() => fileRef.current?.click()}
          className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
          title="Attach file"
        >
          <Paperclip className="w-5 h-5 text-slate-500 dark:text-slate-400" />
        </button>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFileSelect}
          accept="image/*,video/*,.pdf,.doc,.docx,.txt" />

        {/* Textarea */}
        <div className="flex-1 relative">
          <textarea
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            disabled={disabled}
            className="w-full px-4 py-3 pr-12 bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-violet-400 rounded-2xl resize-none focus:outline-none text-sm dark:text-slate-200 placeholder-slate-400 transition-all max-h-36"
            style={{ minHeight: '48px', lineHeight: '1.5' }}
          />
          {/* Emoji button */}
          <button
            onClick={() => setShowEmoji(!showEmoji)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Smile className="w-5 h-5 text-slate-500" />
          </button>

          {/* Emoji Picker */}
          {showEmoji && (
            <div className="absolute bottom-full right-0 mb-2 z-50 shadow-2xl rounded-2xl overflow-hidden">
              <EmojiPicker
                onEmojiClick={handleEmojiClick}
                theme="auto"
                width={340}
                height={420}
                emojiStyle="native"
                previewConfig={{ showPreview: false }}
              />
            </div>
          )}
        </div>

        {/* Send */}
        <button
          onClick={handleSend}
          disabled={!value.trim() && files.length === 0}
          className="p-3 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0 shadow-lg shadow-violet-500/30"
        >
          <Send className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  );
};

// ─── Chat Header ──────────────────────────────────────────
const ChatHeader = ({
  chat, onToggleInfo, currentUserId, onVideoCall, onAudioCall,
  onlineUsers
}) => {
  const participant = getOtherParticipant(chat, currentUserId);
  const isOnline = onlineUsers?.[participant._id] === 'online' || participant.status === 'online';
  const lastSeen = onlineUsers?.[`${participant._id}_lastSeen`] || participant.lastSeen;

  // Live status text updates every minute
  const [statusText, setStatusText] = useState(getStatusText(isOnline ? 'online' : 'offline', lastSeen));
  useEffect(() => {
    setStatusText(getStatusText(isOnline ? 'online' : 'offline', lastSeen));
    const id = setInterval(() => {
      setStatusText(getStatusText(isOnline ? 'online' : 'offline', lastSeen));
    }, 60000);
    return () => clearInterval(id);
  }, [isOnline, lastSeen]);

  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
      <div className="flex items-center gap-3">
        <Avatar src={participant.avatar} alt={participant.name} size="md" online={isOnline} showStatus />
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{participant.name}</h2>
          <p className={`text-xs ${isOnline ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'}`}>
            {statusText}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-0.5">
        <button
          onClick={onAudioCall}
          className="p-2 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors group"
          title="Voice call"
        >
          <Phone className="w-5 h-5 text-slate-500 dark:text-slate-400 group-hover:text-violet-600" />
        </button>
        <button
          onClick={onVideoCall}
          className="p-2 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors group"
          title="Video call"
        >
          <Video className="w-5 h-5 text-slate-500 dark:text-slate-400 group-hover:text-violet-600" />
        </button>
        <button
          onClick={onToggleInfo}
          className="p-2 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors group"
          title="View profile"
        >
          <Info className="w-5 h-5 text-slate-500 dark:text-slate-400 group-hover:text-violet-600" />
        </button>
        <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <MoreVertical className="w-5 h-5 text-slate-500 dark:text-slate-400" />
        </button>
      </div>
    </div>
  );
};

// ─── Empty State ──────────────────────────────────────────
const EmptyState = () => (
  <div className="flex flex-col items-center justify-center h-full text-center px-6">
    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 flex items-center justify-center mb-5">
      <MessageSquare className="w-12 h-12 text-violet-500/50" />
    </div>
    <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">Your Messages</h3>
    <p className="text-slate-400 dark:text-slate-500 text-sm max-w-xs">
      Select a conversation or click <strong>+</strong> to start chatting
    </p>
  </div>
);

// ─── ChatArea (exported) ──────────────────────────────────
const ChatArea = ({
  selectedChat,
  messages,
  inputValue,
  onInputChange,
  onSendMessage,
  onToggleInfo,
  currentUserId,
  onlineUsers,
  onMessagesRead,
}) => {
  const [typers, setTypers] = useState([]);
  const [seenInfo, setSeenInfo] = useState({ seen: false });

  // Video/Audio call state
  const [callOpen, setCallOpen] = useState(false);
  const [callType, setCallType] = useState('video');
  const [incomingCall, setIncomingCall] = useState(null); // { offer, callerInfo, callType, callerSocketId }
  const [callRemoteUser, setCallRemoteUser] = useState(null);
  const [isIncomingCall, setIsIncomingCall] = useState(false);

  const conversationId = selectedChat?._id || selectedChat?.id;
  const participant = selectedChat ? getOtherParticipant(selectedChat, currentUserId) : null;

  // ── Socket listeners for this chat area ──────────────────
  useEffect(() => {
    if (!conversationId) return;

    const onTyping = ({ userId, userName }) => {
      if (userId !== currentUserId) {
        setTypers(prev => {
          if (prev.find(t => t.id === userId)) return prev;
          return [...prev, { id: userId, name: userName }];
        });
      }
    };

    const onStopTyping = ({ userId }) => {
      setTypers(prev => prev.filter(t => t.id !== userId));
    };

    const onMessagesSeen = ({ conversationId: cid }) => {
      if (cid === conversationId) {
        setSeenInfo({ seen: true });
      }
    };

    socket.on('user-typing', onTyping);
    socket.on('user-stopped-typing', onStopTyping);
    socket.on('messages-seen', onMessagesSeen);

    return () => {
      socket.off('user-typing', onTyping);
      socket.off('user-stopped-typing', onStopTyping);
      socket.off('messages-seen', onMessagesSeen);
    };
  }, [conversationId, currentUserId]);

  // Reset seen status when messages change
  useEffect(() => {
    setSeenInfo({ seen: false });
  }, [messages.length]);

  // ── Incoming call listener ────────────────────────────────
  useEffect(() => {
    const onIncomingCall = ({ offer, callerInfo, callType, callerSocketId }) => {
      setIncomingCall({ offer, callerInfo, callType, callerSocketId });
    };
    socket.on('incoming-call', onIncomingCall);
    return () => socket.off('incoming-call', onIncomingCall);
  }, []);

  // ── Call failed ───────────────────────────────────────────
  useEffect(() => {
    const onCallFailed = ({ reason }) => {
      toast.error(reason || 'Call failed');
      setCallOpen(false);
    };
    socket.on('call-failed', onCallFailed);
    return () => socket.off('call-failed', onCallFailed);
  }, []);

  const handleTypingStart = useCallback(() => {
    socket.emit('typing-start', {
      conversationId,
      userId: currentUserId,
      userName: 'You',
    });
  }, [conversationId, currentUserId]);

  const handleTypingStop = useCallback(() => {
    socket.emit('typing-stop', { conversationId, userId: currentUserId });
  }, [conversationId, currentUserId]);

  const startVideoCall = () => {
    if (!participant) return;
    setCallType('video');
    setCallRemoteUser(participant);
    setIsIncomingCall(false);
    setCallOpen(true);
  };

  const startAudioCall = () => {
    if (!participant) return;
    setCallType('audio');
    setCallRemoteUser(participant);
    setIsIncomingCall(false);
    setCallOpen(true);
  };

  const acceptIncomingCall = () => {
    setCallType(incomingCall.callType);
    setCallRemoteUser({
      _id: incomingCall.callerInfo?.userId,
      name: incomingCall.callerInfo?.name,
    });
    setIsIncomingCall(true);
    setCallOpen(true);
    setIncomingCall(null);
  };

  const rejectIncomingCall = () => {
    if (incomingCall) {
      socket.emit('call-rejected', {
        to: incomingCall.callerInfo?.userId,
        reason: 'Call declined',
      });
    }
    setIncomingCall(null);
  };

  if (!selectedChat) {
    return (
      <div className="flex-1 bg-white dark:bg-slate-900">
        <CustomStyles />
        <EmptyState />
        {/* Global incoming call banner */}
        <IncomingCallBanner
          callInfo={incomingCall}
          onAccept={acceptIncomingCall}
          onReject={rejectIncomingCall}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
      <CustomStyles />

      <ChatHeader
        chat={selectedChat}
        onToggleInfo={onToggleInfo}
        currentUserId={currentUserId}
        onVideoCall={startVideoCall}
        onAudioCall={startAudioCall}
        onlineUsers={onlineUsers}
      />

      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        selectedChat={selectedChat}
        typers={typers}
        seenInfo={seenInfo}
      />

      <MessageInput
        value={inputValue}
        onChange={onInputChange}
        onSend={onSendMessage}
        onTypingStart={handleTypingStart}
        onTypingStop={handleTypingStop}
      />

      {/* Video/Audio Call Modal */}
      <VideoCallModal
        isOpen={callOpen}
        onClose={() => setCallOpen(false)}
        callType={callType}
        remoteUser={callRemoteUser}
        isIncoming={isIncomingCall}
        incomingOffer={incomingCall?.offer}
        callerSocketId={incomingCall?.callerSocketId}
        currentUserId={currentUserId}
      />

      {/* Incoming call notification (when call modal not yet open) */}
      {!callOpen && (
        <IncomingCallBanner
          callInfo={incomingCall}
          onAccept={acceptIncomingCall}
          onReject={rejectIncomingCall}
        />
      )}
    </div>
  );
};

export default ChatArea;
