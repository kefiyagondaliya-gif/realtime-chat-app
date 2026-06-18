/**
 * Get initials from name for avatar fallback
 */
export const getInitials = (name) => {
  if (!name || typeof name !== 'string') return 'U';
  
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

/**
 * Get other participant from conversation
 */
const getOtherParticipant = (chat, currentUserId) => {
  if (!chat.participants || !Array.isArray(chat.participants)) {
    return { name: 'Unknown User' };
  }

  const otherParticipant = chat.participants.find(
    p => p.user && p.user._id !== currentUserId
  );

  if (!otherParticipant || !otherParticipant.user) {
    return { name: 'Unknown User' };
  }

  return otherParticipant.user;
};

/**
 * Get display name for conversation
 */
const getConversationName = (chat, currentUserId) => {
  // For group chats
  if (chat.type === 'group' && chat.name) {
    return chat.name;
  }
  
  // For direct chats, get other participant's name
  const otherUser = getOtherParticipant(chat, currentUserId);
  return otherUser.name || 'Unknown User';
};

/**
 * Get last message text safely
 */
const getLastMessageText = (chat) => {
  if (!chat.lastMessage) return '';
  
  // If lastMessage is an object with content property
  if (typeof chat.lastMessage === 'object' && chat.lastMessage.content) {
    // If content is an object with text property
    if (typeof chat.lastMessage.content === 'object' && chat.lastMessage.content.text) {
      return chat.lastMessage.content.text;
    }
    // If content is a string
    if (typeof chat.lastMessage.content === 'string') {
      return chat.lastMessage.content;
    }
  }
  
  // If lastMessage is a string
  if (typeof chat.lastMessage === 'string') {
    return chat.lastMessage;
  }
  
  return '';
};

/**
 * Filter chats based on search query - FIXED VERSION
 */
export const filterChats = (chats, query, currentUserId) => {
  if (!query || !query.trim()) return chats;
  
  const lowerQuery = query.toLowerCase().trim();
  
  return chats.filter(chat => {
    // Get conversation name safely
    const name = getConversationName(chat, currentUserId);
    const nameMatch = name && typeof name === 'string' 
      ? name.toLowerCase().includes(lowerQuery) 
      : false;
    
    // Get last message safely
    const lastMessage = getLastMessageText(chat);
    const messageMatch = lastMessage && typeof lastMessage === 'string'
      ? lastMessage.toLowerCase().includes(lowerQuery)
      : false;
    
    // Also search by email if available
    const otherUser = getOtherParticipant(chat, currentUserId);
    const emailMatch = otherUser.email && typeof otherUser.email === 'string'
      ? otherUser.email.toLowerCase().includes(lowerQuery)
      : false;
    
    return nameMatch || messageMatch || emailMatch;
  });
};

/**
 * Check if messages should be grouped (same sender)
 */
export const shouldGroupMessages = (currentMsg, previousMsg) => {
  if (!previousMsg) return false;
  
  // Compare sender IDs properly
  const currentSender = currentMsg.sender?._id || currentMsg.sender;
  const previousSender = previousMsg.sender?._id || previousMsg.sender;
  
  return currentSender === previousSender;
};

/**
 * Format time to relative
 */
export const formatTime = (timestamp) => {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffInMs = now - date;
  const diffInMinutes = Math.floor(diffInMs / 60000);
  const diffInHours = Math.floor(diffInMs / 3600000);
  const diffInDays = Math.floor(diffInMs / 86400000);
  
  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInDays < 7) return `${diffInDays}d ago`;
  
  return date.toLocaleDateString();
};