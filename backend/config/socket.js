const { Server } = require("socket.io");
const User = require("../models/User");

let io;

// ============================================================
// USER PRESENCE TRACKING
// userSocketMap: { userId: socketId }
// userLastSeen:  { userId: Date }
// ============================================================
const userSocketMap = {};
const userLastSeen = {};

const getRecipientSocketId = (userId) => userSocketMap[userId?.toString()];

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:3000",
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("🟢 Socket connected:", socket.id);

    // ── AUTH / PRESENCE ───────────────────────────────────
    socket.on("authenticate", async (userId) => {
      if (!userId) return;
      const uid = userId.toString();
      userSocketMap[uid] = socket.id;
      socket.userId = uid;

      // Persist online status to DB
      try {
        await User.findByIdAndUpdate(uid, { status: "online", lastSeen: new Date() });
      } catch (_) {}

      // Broadcast to ALL clients that this user is online
      io.emit("user-status-change", {
        userId: uid,
        status: "online",
        lastSeen: new Date(),
      });

      console.log(`✅ User ${uid} authenticated (socket ${socket.id})`);
    });

    // ── CONVERSATION ROOMS ─────────────────────────────────
    socket.on("join-conversation", (conversationId) => {
      socket.join(conversationId);
      console.log(`📥 Socket ${socket.id} joined room: ${conversationId}`);
    });

    socket.on("leave-conversation", (conversationId) => {
      socket.leave(conversationId);
      console.log(`📤 Socket ${socket.id} left room: ${conversationId}`);
    });

    // ── SEND MESSAGE ───────────────────────────────────────
    // recipientIds = array of userId strings (everyone except sender)
    socket.on("send-message", ({ conversationId, message, recipientIds }) => {
      console.log("📤 send-message to room:", conversationId);

      // 1️⃣ Emit to conversation room → ChatArea of all joined users
      socket.to(conversationId).emit("receive-message", message);

      // 2️⃣ SIDEBAR FIX: emit directly to each recipient's personal socket
      //    so their sidebar updates even if they haven't opened the chat
      if (recipientIds && Array.isArray(recipientIds)) {
        recipientIds.forEach((recipientId) => {
          const recipientSocketId = getRecipientSocketId(recipientId);
          if (recipientSocketId && recipientSocketId !== socket.id) {
            io.to(recipientSocketId).emit("sidebar-new-message", {
              conversationId,
              message,
            });
          }
        });
      }
    });

    // ── TYPING INDICATORS ──────────────────────────────────
    socket.on("typing-start", ({ conversationId, userId, userName }) => {
      socket.to(conversationId).emit("user-typing", { userId, userName });
    });

    socket.on("typing-stop", ({ conversationId, userId }) => {
      socket.to(conversationId).emit("user-stopped-typing", { userId });
    });

    // ── READ RECEIPTS ──────────────────────────────────────
    // When someone reads messages, notify the sender in real time
    socket.on("messages-read", ({ conversationId, readerId, readerName }) => {
      socket.to(conversationId).emit("messages-seen", {
        conversationId,
        readerId,
        readerName,
      });
    });

    // ── NEW CONVERSATION ───────────────────────────────────
    socket.on("create-conversation", ({ conversation, recipientIds }) => {
      // Notify each recipient directly (for sidebar)
      if (recipientIds && Array.isArray(recipientIds)) {
        recipientIds.forEach((recipientId) => {
          const recipientSocketId = getRecipientSocketId(recipientId);
          if (recipientSocketId) {
            io.to(recipientSocketId).emit("new-conversation", conversation);
          }
        });
      }
    });

    // ── WEBRTC SIGNALING ───────────────────────────────────
    // Call a user
    socket.on("call-user", ({ to, offer, callerInfo, callType }) => {
      const recipientSocketId = getRecipientSocketId(to);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit("incoming-call", {
          offer,
          callerInfo,
          callType,
          callerSocketId: socket.id,
        });
        console.log(`📞 Call from ${socket.userId} to ${to} (${callType})`);
      } else {
        socket.emit("call-failed", { reason: "User is offline" });
      }
    });

    // Caller accepts
    socket.on("call-accepted", ({ to, answer }) => {
      const recipientSocketId = getRecipientSocketId(to);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit("call-accepted", { answer });
      }
    });

    // Caller rejects
    socket.on("call-rejected", ({ to, reason }) => {
      const recipientSocketId = getRecipientSocketId(to);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit("call-rejected", { reason });
      }
    });

    // ICE candidate exchange
    socket.on("ice-candidate", ({ to, candidate }) => {
      const recipientSocketId = getRecipientSocketId(to);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit("ice-candidate", { candidate });
      }
    });

    // End call
    socket.on("end-call", ({ to }) => {
      const recipientSocketId = getRecipientSocketId(to);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit("call-ended");
      }
    });

    // ── DISCONNECT ─────────────────────────────────────────
    socket.on("disconnect", async () => {
      const uid = socket.userId;
      if (uid) {
        delete userSocketMap[uid];
        userLastSeen[uid] = new Date();

        // Persist offline status to DB
        try {
          await User.findByIdAndUpdate(uid, {
            status: "offline",
            lastSeen: new Date(),
          });
        } catch (_) {}

        // Broadcast offline status to all clients
        io.emit("user-status-change", {
          userId: uid,
          status: "offline",
          lastSeen: new Date(),
        });
        console.log(`🔴 User ${uid} disconnected`);
      }
    });
  });
};

// Export io instance for use in controllers
const getIO = () => io;

module.exports = { initializeSocket, getIO, getRecipientSocketId };
