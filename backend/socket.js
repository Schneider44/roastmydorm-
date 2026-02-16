const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const { Message, MessageThread } = require('./models/Message');
const Block = require('./models/Block');
const User = require('./models/User');

function setupSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      credentials: true
    }
  });

  // Authenticate socket by JWT
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers['authorization']?.replace('Bearer ', '');
    if (!token) return next(new Error('Authentication required'));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = await User.findById(payload.userId);
      if (!socket.user) return next(new Error('User not found'));
      next();
    } catch (e) {
      next(new Error('Invalid token'));
    }
  });

  // Join conversation
  io.on('connection', (socket) => {
    socket.on('join_conversation', async ({ threadId }) => {
      const thread = await MessageThread.findById(threadId);
      if (!thread || !thread.participants.includes(socket.user._id)) {
        return socket.emit('error', { error: 'Not authorized for this conversation.' });
      }
      // Block enforcement
      const otherUserId = thread.participants.find(id => id.toString() !== socket.user._id.toString());
      const block = await Block.findOne({
        $or: [
          { blockerUserId: socket.user._id, blockedUserId: otherUserId },
          { blockerUserId: otherUserId, blockedUserId: socket.user._id }
        ]
      });
      if (block) {
        return socket.emit('error', { error: 'You cannot message this user.' });
      }
      socket.join(threadId);
    });

    // Send message
    socket.on('send_message', async ({ threadId, content }) => {
      const thread = await MessageThread.findById(threadId);
      if (!thread || !thread.participants.includes(socket.user._id)) {
        return socket.emit('error', { error: 'Not authorized for this conversation.' });
      }
      const otherUserId = thread.participants.find(id => id.toString() !== socket.user._id.toString());
      const block = await Block.findOne({
        $or: [
          { blockerUserId: socket.user._id, blockedUserId: otherUserId },
          { blockerUserId: otherUserId, blockedUserId: socket.user._id }
        ]
      });
      if (block) {
        return socket.emit('error', { error: 'You cannot message this user.' });
      }
      // Chat safety flagging
      const flagKeywords = [
        'deposit', 'advance', 'urgent', 'send money', 'western union', 'whatsapp', 'cash', 'virement', 'transfert', 'dépôt', 'avance', 'تحويل', 'فلوس', 'واتساب'
      ];
      const flags = flagKeywords.filter(word => content.toLowerCase().includes(word));
      const message = await Message.create({
        sender: socket.user._id,
        recipient: otherUserId,
        content,
        threadId,
        flags,
        isReported: false
      });
      io.to(threadId).emit('message_new', message);
    });
  });

  return io;
}

module.exports = setupSocket;
