const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('express-async-errors');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const { ConfidentialClientApplication } = require('@azure/msal-node');
const User = require('./models/User');
const Post = require('./models/Post');
const Event = require('./models/Event');
const Gallery = require('./models/Gallery');
const Carousel = require('./models/Carousel');
const Notification = require('./models/Notification');
const ChatMessage = require('./models/ChatMessage');
const Conversation = require('./models/Conversation');
const { seedDatabase } = require('../seed');
const { authenticate, requireAdmin } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.CLIENT_ORIGIN || 'http://localhost:3005', credentials: true } });
const onlineUsers = new Map();
const port = process.env.PORT || 5005;
const adminEmail = 'zibeke@outlook.com';
const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:3005', credentials: true }));
app.use(morgan('tiny'));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
const originalSiteDir = path.join(__dirname, '..', '..', 'responsive-mega-menu');
app.use('/original-site', (req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self' https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com; media-src 'self' data: blob: https:; connect-src 'self' https:; frame-ancestors 'self' ${process.env.CLIENT_ORIGIN || 'http://localhost:3005'}; form-action 'self' https:`
  );
  if (['/home.html', '/events.html', '/gallery.html', '/chat.html'].includes(req.path)) {
    return authenticate(req, res, next);
  }
  next();
}, express.static(originalSiteDir, { maxAge: '1h' }));
app.use('/uploads', authenticate, express.static(uploadDir, { maxAge: '1d' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }));

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, done) => done(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { files: 500, fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, done) => {
    const allowed = file.fieldname === 'photo'
      ? /^image\/(jpeg|png|webp|gif)$/
      : /^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm|quicktime))$/;
    done(allowed.test(file.mimetype) ? null : new Error('Upload JPG, PNG, WebP, GIF, MP4 or WebM files.'), allowed.test(file.mimetype));
  }
});

const msalReady = Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET && process.env.MICROSOFT_TENANT_ID);
const msal = msalReady ? new ConfidentialClientApplication({
  auth: {
    clientId: process.env.MICROSOFT_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}`,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET
  }
}) : null;

function setSession(res, user) {
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie('cci_session', token, {
    ...sessionCookieOptions(),
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

function sessionCookieOptions() {
  const secure = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: secure ? 'none' : 'lax',
    secure
  };
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    photo: user.photo,
    avatar: user.photo,
    status: user.status,
    lastSeen: user.lastSeen
  };
}

async function addCarouselItem(item) {
  await Carousel.create(item);
  const oldest = await Carousel.find().sort({ createdAt: -1, _id: -1 }).skip(4).select('_id');
  if (oldest.length) await Carousel.deleteMany({ _id: { $in: oldest.map((entry) => entry._id) } });
}

app.get('/api/health', (req, res) => res.json({ status: 'ok', database: mongoose.connection.readyState === 1, microsoft: msalReady }));

app.get('/api/auth/method', async (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  const account = email ? await User.findOne({ email }).select('role') : null;
  const localOnly = email === adminEmail || account?.role === 'admin';
  res.json({ microsoft: msalReady && !localOnly, local: true, localOnly });
});

app.post('/api/auth/local', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = await User.findOne({ email });
  if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ message: 'The email or password is incorrect.' });
  }
  if (req.body.adminOnly && user.role !== 'admin') {
    return res.status(403).json({ message: 'This sign-in page is for administrators only.' });
  }
  setSession(res, user);
  res.json({ user: publicUser(user) });
});

app.get('/api/auth/microsoft', (req, res) => {
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:3005';
  if (!msalReady) return res.redirect(`${clientOrigin}/login?error=microsoft`);
  const state = crypto.randomBytes(24).toString('hex');
  res.cookie('cci_oauth_state', state, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 10 * 60 * 1000 });
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI || `http://localhost:${port}/api/auth/microsoft/callback`;
  msal.getAuthCodeUrl({
    scopes: ['openid', 'profile', 'email', 'User.Read'],
    redirectUri,
    state,
    prompt: 'select_account'
  }).then((url) => res.redirect(url)).catch((error) => {
    console.warn('Microsoft sign-in could not be started:', error.message);
    res.clearCookie('cci_oauth_state');
    res.redirect(`${clientOrigin}/login?error=microsoft`);
  });
});

app.get('/api/auth/microsoft/callback', async (req, res) => {
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:3005';
  try {
    if (!msalReady || !req.query.code || !req.cookies.cci_oauth_state || req.query.state !== req.cookies.cci_oauth_state) {
      throw new Error('Microsoft sign-in could not be verified.');
    }
    res.clearCookie('cci_oauth_state');
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI || `http://localhost:${port}/api/auth/microsoft/callback`;
    const result = await msal.acquireTokenByCode({ code: req.query.code, scopes: ['openid', 'profile', 'email', 'User.Read'], redirectUri });
    const email = String(result.account?.username || '').toLowerCase();
    if (!email || email === adminEmail) throw new Error('This account must use admin password sign-in.');
    const user = await User.findOne({ email });
    if (!user) throw new Error('This Microsoft account is not registered for CCI access.');
    user.name = result.account.name || user.name;
    user.authProvider = 'microsoft';
    await user.save();
    setSession(res, user);
    res.redirect(`${clientOrigin}${user.role === 'admin' ? '/admin/home' : '/home'}`);
  } catch (error) {
    console.warn('Microsoft sign-in failed:', error.message);
    res.clearCookie('cci_oauth_state');
    res.redirect(`${clientOrigin}/login?error=microsoft`);
  }
});

app.get('/api/auth/me', authenticate, (req, res) => res.json({ user: publicUser(req.user) }));
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('cci_session', sessionCookieOptions());
  res.json({ ok: true });
});

app.get('/api/users', authenticate, async (req, res) => {
  const search = String(req.query.search || req.query.q || '').trim().slice(0, 60);
  const query = { _id: { $ne: req.user._id } };
  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [{ name: new RegExp(escapedSearch, 'i') }, { email: new RegExp(escapedSearch, 'i') }];
  }
  const users = await User.find(query).select('name email role photo status lastSeen').sort({ name: 1 }).limit(30);
  res.json(users);
});

app.get('/api/users/search', authenticate, async (req, res) => {
  const search = String(req.query.q || '').trim().slice(0, 60);
  if (!search) return res.json([]);
  const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const users = await User.find({
    _id: { $ne: req.user._id },
    $or: [{ name: new RegExp(escapedSearch, 'i') }, { email: new RegExp(escapedSearch, 'i') }]
  }).select('name email role photo status lastSeen').sort({ name: 1 }).limit(30);
  res.json(users);
});

app.get('/api/posts', authenticate, async (req, res) => {
  const posts = await Post.find().populate('author', 'name email photo role').populate('comments.author', 'name photo role').sort({ createdAt: -1 });
  res.json(posts);
});

app.get('/api/events', authenticate, async (req, res) => {
  const upcomingOnly = req.query.upcoming === 'true';
  const events = await Event.find({ isUpcoming: upcomingOnly })
    .populate('createdBy', 'name email photo role')
    .populate('likes', 'name photo')
    .populate('comments.userId', 'name photo role')
    .sort(upcomingOnly ? { startsAt: 1 } : { createdAt: -1 });
  res.json(events);
});

app.get('/api/gallery', authenticate, async (req, res) => {
  const galleries = await Gallery.find()
    .populate('createdBy', 'name email photo role')
    .sort({ createdAt: -1 });
  res.json(galleries);
});

app.get('/api/carousel', async (req, res) => {
  const carouselItems = await Carousel.find()
    .sort({ createdAt: -1, _id: -1 })
    .limit(4)
    .lean();
  res.json(carouselItems);
});

app.get('/api/notifications', authenticate, async (req, res) => {
  const notifications = await Notification.find({
    type: { $nin: ['chat', 'hashtag'] },
    $or: [{ forAllUsers: true }, { userId: req.user._id }]
  }).sort({ createdAt: -1 }).limit(100);
  res.json(notifications);
});

app.get('/api/notifications/unread-count', authenticate, async (req, res) => {
  const count = await Notification.countDocuments({
    isRead: false,
    type: { $nin: ['chat', 'hashtag'] },
    $or: [{ forAllUsers: true }, { userId: req.user._id }]
  });
  res.json({ count });
});

app.patch('/api/notifications/:id/read', authenticate, async (req, res) => {
  const notification = await Notification.findOneAndUpdate({
    _id: req.params.id,
    $or: [{ forAllUsers: true }, { userId: req.user._id }]
  }, { $set: { isRead: true } }, { new: true });
  if (!notification) return res.status(404).json({ message: 'Notification not found.' });
  res.json(notification);
});

app.post('/api/events/:id/comments', authenticate, async (req, res) => {
  const text = String(req.body.text || '').trim();
  if (!text || text.length > 1000) return res.status(400).json({ message: 'Comments must be 1 to 1,000 characters.' });
  const event = await Event.findById(req.params.id);
  if (!event || event.isUpcoming) return res.status(404).json({ message: 'Event not found.' });
  event.comments.push({ userId: req.user._id, text });
  await event.save();
  await event.populate('comments.userId', 'name photo role');
  res.status(201).json(event.comments[event.comments.length - 1]);
});

app.post('/api/events/:id/likes', authenticate, async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event || event.isUpcoming) return res.status(404).json({ message: 'Event not found.' });
  const alreadyLiked = event.likes.some((userId) => userId.equals(req.user._id));
  if (alreadyLiked) event.likes.pull(req.user._id);
  else event.likes.addToSet(req.user._id);
  await event.save();
  res.json({ liked: !alreadyLiked, likes: event.likes.length });
});

app.post('/api/posts', authenticate, requireAdmin, upload.array('media', 500), async (req, res) => {
  const { kind, heading = '', description = '', showInCarousel = 'false', carouselIndex = '0', videoUrl = '' } = req.body;
  const media = (req.files || []).map((file) => `/uploads/${file.filename}`);
  if (kind === 'video' && !media.length && videoUrl.trim()) {
    try {
      const parsedVideoUrl = new URL(videoUrl.trim());
      if (!['http:', 'https:'].includes(parsedVideoUrl.protocol)) throw new Error('Invalid protocol');
      media.push(parsedVideoUrl.toString());
    } catch (error) {
      return res.status(400).json({ message: 'Enter a valid HTTP or HTTPS video URL.' });
    }
  }
  if (!['event', 'video', 'gallery'].includes(kind) || !media.length) return res.status(400).json({ message: 'Choose a post type and upload its media.' });
  if (kind === 'gallery' && media.length > 500) return res.status(400).json({ message: 'A gallery can contain at most 500 images.' });
  if (kind !== 'video' && !heading.trim()) return res.status(400).json({ message: 'Add a heading for this post.' });
  const index = Math.max(0, Math.min(Number(carouselIndex) || 0, media.length - 1));
  const post = await Post.create({
    kind,
    heading: kind === 'video' ? '' : heading.trim(),
    description: kind === 'video' ? '' : description.trim(),
    media,
    showInCarousel: showInCarousel === 'true',
    carouselImage: showInCarousel === 'true' && kind !== 'video' ? media[index] : '',
    author: req.user._id
  });
  await post.populate('author', 'name email photo role');

  let relatedId;
  if (kind === 'gallery') {
    const gallery = await Gallery.create({
      heading: heading.trim(),
      carouselImage: showInCarousel === 'true' ? media[index] : '',
      galleryImages: media,
      createdBy: req.user._id
    });
    relatedId = gallery._id;
    if (showInCarousel === 'true') {
      await addCarouselItem({
        itemType: 'gallery',
        itemId: gallery._id,
        heading: gallery.heading,
        image: gallery.carouselImage
      });
    }
  } else {
    const event = await Event.create({
      title: kind === 'video' ? 'Featured CCI video' : heading.trim(),
      description: kind === 'video' ? '' : description.trim(),
      image: kind === 'video' ? '' : media[0],
      videoUrl: kind === 'video' ? media[0] : '',
      type: kind,
      createdBy: req.user._id
    });
    relatedId = event._id;
    if (kind === 'video' || showInCarousel === 'true') {
      await addCarouselItem({
        itemType: kind,
        itemId: event._id,
        heading: kind === 'video' ? '' : event.title,
        image: kind === 'video' ? '' : event.image,
        videoUrl: event.videoUrl,
        descriptionSnippet: kind === 'video' ? '' : event.description.slice(0, 180)
      });
    }
  }

  const title = kind === 'video' ? 'New video' : heading.trim();
  const message = kind === 'gallery'
    ? `A new photo gallery, ${title}, is available.`
    : kind === 'video'
      ? 'A new video is available to watch.'
      : `A new event, ${title}, has been posted.`;
  const notification = await Notification.create({
    type: kind,
    title,
    message,
    relatedId,
    forAllUsers: true
  });
  io.emit('notification:new', notification);
  res.status(201).json(post);
});

app.post('/api/posts/:id/comments', authenticate, async (req, res) => {
  const text = String(req.body.text || '').trim();
  if (!text || text.length > 1000) return res.status(400).json({ message: 'Comments must be 1 to 1,000 characters.' });
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: 'Post not found.' });
  post.comments.push({ author: req.user._id, text });
  await post.save();
  await post.populate('comments.author', 'name photo role');
  res.status(201).json(post.comments[post.comments.length - 1]);
});

app.post('/api/posts/:id/likes', authenticate, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: 'Post not found.' });
  const alreadyLiked = post.likes.some((userId) => userId.equals(req.user._id));
  if (alreadyLiked) post.likes.pull(req.user._id);
  else post.likes.addToSet(req.user._id);
  await post.save();
  res.json({ liked: !alreadyLiked, likes: post.likes.length });
});

app.patch('/api/profile', authenticate, upload.single('photo'), async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name || name.length > 80) return res.status(400).json({ message: 'Enter a name up to 80 characters.' });
  req.user.name = name;
  if (req.file) req.user.photo = `/uploads/${req.file.filename}`;
  await req.user.save();
  res.json({ user: publicUser(req.user) });
});

app.post('/api/chat/messages', authenticate, async (req, res) => {
  const recipientId = String(req.body.recipientId || req.body.receiverId || '');
  const text = String(req.body.text || req.body.message || '').trim();
  if (!mongoose.isValidObjectId(recipientId) || recipientId === req.user.id || !text || text.length > 3000) {
    return res.status(400).json({ message: 'Choose a person and enter a message up to 3,000 characters.' });
  }
  const recipient = await User.findById(recipientId).select('_id');
  if (!recipient) return res.status(404).json({ message: 'User not found.' });
  const isDelivered = onlineUsers.has(recipient.id);
  const message = await ChatMessage.create({
    senderId: req.user._id,
    receiverId: recipient._id,
    message: text,
    status: isDelivered ? 'delivered' : 'sent'
  });
  let conversation = await Conversation.findOne({
    participants: { $all: [req.user._id, recipient._id], $size: 2 }
  });
  if (!conversation) {
    conversation = await Conversation.create({ participants: [req.user._id, recipient._id] });
  }
  conversation.lastMessage = text;
  conversation.lastMessageAt = message.createdAt;
  conversation.unreadCount.set(recipient.id, (conversation.unreadCount.get(recipient.id) || 0) + 1);
  await conversation.save();
  const populated = await message.populate('senderId receiverId', 'name email photo status lastSeen');
  io.to(`user:${recipient.id}`).emit('message:new', populated);
  io.to(`user:${req.user.id}`).emit('message:new', populated);
  const chatNotification = await Notification.create({
    type: 'chat',
    title: req.user.name,
    message: text,
    relatedId: message._id,
    userId: recipient._id
  });
  io.to(`user:${recipient.id}`).emit('notification:new', chatNotification);
  res.status(201).json(populated);
});

app.get('/api/chat/messages/:userId', authenticate, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.userId)) return res.status(400).json({ message: 'Invalid user.' });
  const other = req.params.userId;
  const messages = await ChatMessage.find({
    $or: [
      { senderId: req.user._id, receiverId: other },
      { senderId: other, receiverId: req.user._id }
    ]
  }).populate('senderId receiverId', 'name email photo status lastSeen').sort({ createdAt: 1 }).limit(500);
  const readMessages = await ChatMessage.find({
    senderId: other,
    receiverId: req.user._id,
    status: { $ne: 'read' }
  }).select('_id');
  if (readMessages.length) {
    await ChatMessage.updateMany({ _id: { $in: readMessages.map(({ _id }) => _id) } }, { $set: { status: 'read' } });
    io.to(`user:${other}`).emit('message:status', {
      messageIds: readMessages.map(({ _id }) => String(_id)),
      status: 'read'
    });
  }
  const conversation = await Conversation.findOne({
    participants: { $all: [req.user._id, other], $size: 2 }
  });
  if (conversation) {
    conversation.unreadCount.set(req.user.id, 0);
    await conversation.save();
  }
  res.json(messages.map((message) => {
    if (String(message.senderId._id) === other && String(message.receiverId._id) === req.user.id) {
      message.status = 'read';
    }
    return message;
  }));
});

async function listConversationsFor(user) {
  const conversations = await Conversation.find({ participants: user._id })
    .sort({ lastMessageAt: -1 })
    .populate('participants', 'name email role photo status lastSeen');
  const peers = conversations.map((conversation) => conversation.participants.find((person) => person.id !== user.id)).filter(Boolean);
  const latestMessages = peers.length
    ? await ChatMessage.aggregate([
      {
        $match: {
          $or: [
            { senderId: user._id, receiverId: { $in: peers.map((person) => person._id) } },
            { receiverId: user._id, senderId: { $in: peers.map((person) => person._id) } }
          ]
        }
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: { $cond: [{ $eq: ['$senderId', user._id] }, '$receiverId', '$senderId'] },
          message: { $first: '$message' },
          senderId: { $first: '$senderId' },
          createdAt: { $first: '$createdAt' }
        }
      }
    ])
    : [];
  const latestByPeer = new Map(latestMessages.map((message) => [String(message._id), message]));

  return conversations.map((conversation) => {
    const other = conversation.participants.find((person) => person.id !== user.id);
    const latest = other && latestByPeer.get(other.id);
    return {
      id: conversation.id,
      user: other,
      lastMessage: latest?.message || '',
      lastMessageSenderId: latest?.senderId || null,
      lastMessageAt: latest?.createdAt || conversation.lastMessageAt,
      unreadCount: conversation.unreadCount.get(user.id) || 0
    };
  }).filter((conversation) => conversation.user && conversation.lastMessage);
}

app.get('/api/chat/conversations', authenticate, async (req, res) => {
  res.json(await listConversationsFor(req.user));
});
app.get('/api/chat', authenticate, async (req, res) => {
  res.json(await listConversationsFor(req.user));
});

io.use(async (socket, next) => {
  try {
    const cookies = Object.fromEntries((socket.handshake.headers.cookie || '').split(';').filter(Boolean).map((part) => {
      const separator = part.indexOf('=');
      return [part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1).trim())];
    }));
    const payload = jwt.verify(cookies.cci_session, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select('_id');
    if (!user) return next(new Error('Unauthorized'));
    socket.userId = user.id;
    next();
  } catch (error) {
    next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.userId;
  const sockets = onlineUsers.get(userId) || new Set();
  sockets.add(socket.id);
  onlineUsers.set(userId, sockets);
  socket.join(`user:${userId}`);
  User.findByIdAndUpdate(userId, { $set: { status: 'online' } })
    .then((user) => {
      if (!user) return;
      io.emit('presence:update', { userId, status: 'online', lastSeen: user.lastSeen });
      return ChatMessage.updateMany(
        { receiverId: userId, status: 'sent' },
        { $set: { status: 'delivered' } }
      );
    })
    .then(() => ChatMessage.find({ receiverId: userId, status: 'delivered' }).select('senderId _id'))
    .then((messages) => {
      messages.forEach((message) => io.to(`user:${message.senderId}`).emit('message:status', {
        messageIds: [String(message._id)],
        status: 'delivered'
      }));
    })
    .catch((error) => console.error('Unable to update online status.', error));

  socket.on('typing', ({ to, isTyping } = {}) => {
    if (typeof to !== 'string' || !mongoose.isValidObjectId(to)) return;
    io.to(`user:${to}`).emit('typing:update', { userId, isTyping: Boolean(isTyping) });
  });

  socket.on('disconnect', () => {
    const currentSockets = onlineUsers.get(userId);
    currentSockets?.delete(socket.id);
    if (currentSockets?.size) return;
    onlineUsers.delete(userId);
    const lastSeen = new Date();
    User.findByIdAndUpdate(userId, { $set: { status: 'offline', lastSeen } })
      .then(() => io.emit('presence:update', { userId, status: 'offline', lastSeen }))
      .catch((error) => console.error('Unable to update offline status.', error));
  });
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) return res.status(400).json({ message: error.message });
  if (error.message?.startsWith('Upload ')) return res.status(400).json({ message: error.message });
  console.error(error);
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
});

const frontendBuild = path.join(__dirname, '..', '..', 'frontend', 'build');
if (fs.existsSync(frontendBuild)) {
  app.use(express.static(frontendBuild));
  app.get('*', (req, res) => res.sendFile(path.join(frontendBuild, 'index.html')));
}

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cci-community-portal')
  .then(seedDatabase)
  .then(() => server.listen(port, () => console.log(`CCI Community API listening on ${port}`)))
  .catch((error) => {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  });