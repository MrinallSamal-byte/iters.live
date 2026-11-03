const { auth } = require('../database/firebase');
const { getLocalDemoUserFromToken } = require('../services/demo-auth.service');
const { verifyAppSessionToken } = require('../utils/app-session');
const ChatService = require('../services/chat.service');
const { evaluateSession } = require('../services/session-guard.service');

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

    let decodedSession = null;
    try {
      decodedSession = verifyAppSessionToken(token);
    } catch (_) {
      // Not an app-session token: fall through to demo/Firebase token handling.
    }

    if (decodedSession?.user) {
      // Same revocation/deactivation rules as the REST middleware.
      const verdict = await evaluateSession(decodedSession.user, decodedSession);
      if (!verdict.allowed) {
        return next(new Error('Session is no longer valid'));
      }

      const sessionUser = verdict.user;
      socket.userId = sessionUser.id || sessionUser.uid || sessionUser.registration_number;
      socket.userRole = sessionUser.role;
      socket.userName = sessionUser.name || 'User';
      socket.userDepartment = sessionUser.department || null;
      return next();
    }

    // Same demo-token gate as auth middleware
    if (
      process.env.NODE_ENV !== 'production' &&
      process.env.ALLOW_LOCAL_DEMO_AUTH === 'true'
    ) {
      try {
        const localDemoUser = getLocalDemoUserFromToken(token);
        if (localDemoUser) {
          socket.userId = localDemoUser.id || localDemoUser.registration_number;
          socket.userRole = localDemoUser.role;
          socket.userName = localDemoUser.name || 'User';
          socket.userDepartment = localDemoUser.department || null;
          return next();
        }
      } catch (_) {
        // Continue to Firebase token verification.
      }
    }

    try {
      const decoded = await auth.verifyIdToken(token);
      socket.userId = decoded.uid;
      socket.userRole = decoded.role || decoded.claims?.role || 'student';
      socket.userName = decoded.name || decoded.displayName || 'User';
      socket.userDepartment = null;
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
      const requested = data && data.department;
      if (!requested) {
        return;
      }

      // Validate the requested department against the authenticated user's own
      // department; admins may join any department room. A user with no known
      // department may not join any (previously the check was skipped for them,
      // letting them subscribe to every department's events).
      if (socket.userRole !== 'admin' && requested !== socket.userDepartment) {
        return;
      }

      socket.join(`dept:${requested}`);
      socket.join(`dept-${requested}`);
      
      if (data.year && data.section) {
        socket.join(`class:${requested}-${data.year}${data.section}`);
        socket.join(`dept-${requested}-year-${data.year}`);
      }
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
