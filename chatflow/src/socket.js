import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const socket = io(SOCKET_URL, {
  autoConnect: false,
  withCredentials: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 10,
  transports: ['websocket', 'polling'],
});

// Connect and authenticate with userId
export const connectSocket = (userId) => {
  if (!userId) return;

  if (!socket.connected) {
    socket.connect();
  }

  // Wait for connection then authenticate
  if (socket.connected) {
    socket.emit('authenticate', userId);
  } else {
    socket.once('connect', () => {
      socket.emit('authenticate', userId);
    });
  }
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};

socket.on('connect', () => {
  console.log('✅ Socket connected:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('❌ Socket disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('🔴 Socket error:', error.message);
});

export default socket;
