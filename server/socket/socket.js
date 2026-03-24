const { auth } = require('../database/firebase');
const { getLocalDemoUserFromToken } = require('../services/demo-auth.service');
const { verifyAppSessionToken } = require('../utils/app-session');
const ChatService = require('../services/chat.service');

let io = null;
let chatService = null;

/**
 * Initialize Socket.IO with authentication
 */
const initializeSocket = (socketIo) => {
  io = socketIo;
  chatService = new ChatService(io);

  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decodedSession = verifyAppSessionToken(token);
      if (decodedSession?.user) {
        socket.userId = decodedSession.user.id || decodedSession.user.uid || decodedSession.user.registration_number;
        socket.userRole = decodedSession.user.role;
        return next();
      }
    } catch (_) {
      // Fall through to demo/Firebase token handling.
    }

    try {
      const localDemoUser = getLocalDemoUserFromToken(token);
      if (localDemoUser) {
        socket.userId = localDemoUser.id || localDemoUser.registration_number;
        socket.userRole = localDemoUser.role;
        return next();
      }
    } catch (_) {
      // Continue to Firebase token verification.
    }

    try {
      const decoded = await auth.verifyIdToken(token);
      socket.userId = decoded.uid;
      socket.userRole = decoded.role || decoded.claims?.role || 'student';
      return next();
    } catch (error) {
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId}`);

    // Join user-specific room (use consistent naming)
    socket.join(`user-${socket.userId}`);
    socket.join(`user:${socket.userId}`);

    // Join role-based room
    socket.join(`role:${socket.userRole}`);

    // Join department/class rooms (if data provided)
    socket.on('join:department', (data) => {
      if (data.department) {
        socket.join(`dept:${data.department}`);
        socket.join(`dept-${data.department}`);
        
        if (data.year && data.section) {
          socket.join(`class:${data.department}-${data.year}${data.section}`);
          socket.join(`dept-${data.department}-year-${data.year}`);
        }
      }
    });

    // Profile-related events
    socket.on('profile:view', (data) => {
      console.log(`User ${socket.userId} viewed profile`);
    });

    socket.on('profile:photo:upload:progress', () => {
      socket.emit('profile:photo:upload:progress', { percent: 0 });
    });

    // Initialize chat service events
    if (chatService) {
      chatService.initializeChatSockets(socket);
    }

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
    });

    // Heartbeat
    socket.on('ping', () => {
      socket.emit('pong');
    });
  });

  console.log('✓ Socket.IO initialized');
};

/**
 * Get Socket.IO instance
 */
const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

/**
 * Emit to specific user
 */
const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};

/**
 * Emit to role (all students, all teachers, etc.)
 */
const emitToRole = (role, event, data) => {
  if (io) {
    io.to(`role:${role}`).emit(event, data);
  }
};

/**
 * Emit to department
 */
const emitToDepartment = (department, event, data) => {
  if (io) {
    io.to(`dept:${department}`).emit(event, data);
  }
};

/**
 * Emit to class (department + year + section)
 */
const emitToClass = (department, year, section, event, data) => {
  if (io) {
    io.to(`class:${department}-${year}${section}`).emit(event, data);
  }
};

/**
 * Broadcast to all connected users
 */
const broadcast = (event, data) => {
  if (io) {
    io.emit(event, data);
  }
};

module.exports = {
  initializeSocket,
  getIO,
  emitToUser,
  emitToRole,
  emitToDepartment,
  emitToClass,
  broadcast
};
