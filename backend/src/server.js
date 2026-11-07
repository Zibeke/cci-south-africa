const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const rootEnvPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(rootEnvPath)) {
  const rootEnv = dotenv.parse(fs.readFileSync(rootEnvPath));
  ['CLOUDINARY_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].forEach((key) => {
    if (!process.env[key] && rootEnv[key]) process.env[key] = rootEnv[key];
  });
}
require('express-async-errors');
const http = require('http');
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
const { uploadAsset, deleteAssets } = require('./lib/cloudinary');
const { validateUploads } = require('./lib/uploadValidation');

const app = express();
const server = http.createServer(app);
const clientOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:3005')
  .split(',')
  .map((origin) => new URL(origin.trim()).origin);
const clientOrigin = clientOrigins[0];
const io = new Server(server, {
  cors: { origin: clientOrigins, credentials: true },
  allowRequest: (request, callback) => {
    const origin = request.headers.origin;
    const sameOriginRequest = !origin && request.headers['sec-fetch-site'] === 'same-origin';
    callback(null, sameOriginRequest || clientOrigins.includes(origin));
  }
});
const onlineUsers = new Map();
const port = process.env.PORT || 5005;
const adminEmail = 'zibeke@outlook.com';
const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: clientOrigins, credentials: true }));
app.use(morgan('tiny'));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
const originalSiteDir = path.join(__dirname, '..', '..', 'responsive-mega-menu');
app.use('/original-site', (req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self' https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com; media-src 'self' data: blob: https:; connect-src 'self' https:; frame-ancestors 'self' ${clientOrigins.join(' ')}; form-action 'self' https:`
  );
  if (['/home.html', '/events.html', '/gallery.html', '/chat.html'].includes(req.path)) {
    return authenticate(req, res, next);
  }
  next();
}, express.static(originalSiteDir, { maxAge: '1h' }));
app.use('/uploads', authenticate, express.static(uploadDir, { maxAge: '1d' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }));

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fields: 2, fieldSize: 2000, fieldNameSize: 100, fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, done) => {
    const allowed = /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype);
    done(allowed ? null : new Error('Upload a JPG, PNG, WebP or GIF image.'), allowed);
  }
});

function boundedMemoryStorage(maxBytes) {
  return {
    _handleFile(req, file, callback) {
      let size = 0;
      let settled = false;
      let chunks = [];
      file.stream.on('data', (chunk) => {
        if (settled) return;
        size += chunk.length;
        req.uploadBytes = (req.uploadBytes || 0) + chunk.length;
        if (req.uploadBytes > maxBytes) {
          settled = true;
          chunks = [];
          const error = new Error('The total upload size must be 50 MB or less.');
          error.status = 413;
          callback(error);
          file.stream.resume();
          return;
        }
        chunks.push(chunk);
      });
      file.stream.on('error', (error) => {
        if (settled) return;
        settled = true;
        callback(error);
      });
      file.stream.on('end', () => {
        if (settled) return;
        settled = true;
        callback(null, { buffer: Buffer.concat(chunks, size), size });
      });
    },
    _removeFile(req, file, callback) {
      if (file.buffer) {
        req.uploadBytes = Math.max(0, (req.uploadBytes || 0) - file.size);
        delete file.buffer;
      }
      callback(null);
    }
  };
}

const mediaUpload = multer({
  storage: boundedMemoryStorage(50 * 1024 * 1024),
  limits: { files: 501, fields: 8, fieldSize: 12000, fieldNameSize: 100, fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, done) => {
    const allowed = /^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm|quicktime))$/.test(file.mimetype);
    done(allowed ? null : new Error('Upload JPG, PNG, WebP, GIF, MP4, WebM or MOV files.'), allowed);
  }
});

function rejectOversizedRequest(req, res, next) {
  const contentLength = Number(req.headers['content-length'] || 0);
  if (contentLength > 55 * 1024 * 1024) {
    return res.status(413).json({ message: 'The total upload size must be 50 MB or less.' });
  }
  next();
}

async function uploadFiles(files, folder, allowedResourceTypes) {
  const inspected = await validateUploads(files, allowedResourceTypes);
  const uploaded = [];
  try {
    for (let index = 0; index < files.length; index += 1) {
      uploaded.push(await uploadAsset(files[index].buffer, {
        folder,
        resourceType: inspected[index].resourceType,
        format: inspected[index].format
      }));
    }
    return uploaded;
  } catch (error) {
    try {
      await deleteAssets(uploaded);
    } catch (cleanupError) {
      console.error('Unable to clean up partially uploaded Cloudinary assets.', cleanupError);
    }
    throw error;
  }
}

function requestAsset(url, publicId, resourceType, folder) {
  if (!publicId) return null;
  if (
    typeof url !== 'string' ||
    typeof publicId !== 'string' ||
    !new RegExp(`^cci-connect/${folder}/[a-f0-9-]{36}$`).test(publicId) ||
    resourceType !== 'image'
  ) {
    throw new Error('The uploaded Cloudinary asset reference is invalid.');
  }
  const parsed = new URL(url);
  const pathParts = parsed.pathname.split('/').filter(Boolean);
  const expectedTypeIndex = pathParts.indexOf('upload') - 1;
  const versionIndex = pathParts.indexOf('upload') + 1;
  const assetPath = pathParts.slice(versionIndex).filter((part) => !/^v\d+$/.test(part)).join('/');
  const assetPublicId = assetPath.replace(/\.[a-z0-9]+$/i, '');
  if (
    parsed.protocol !== 'https:' ||
    parsed.hostname !== 'res.cloudinary.com' ||
    pathParts[0] !== process.env.CLOUDINARY_NAME ||
    expectedTypeIndex < 0 ||
    pathParts[expectedTypeIndex] !== resourceType ||
    assetPublicId !== publicId
  ) {
    throw new Error('The uploaded Cloudinary asset reference is invalid.');
  }
  return { publicId, resourceType };
}

function assetReference(url, asset) {
  return asset?.publicId ? { url, publicId: asset.publicId, resourceType: asset.resourceType } : null;
}

function eventAssets(event) {
  return [
    event.imageAsset,
    event.videoAsset,
    ...(event.contentBlocks || []).map((block) => block.srcAsset)
  ].filter((asset) => asset?.publicId);
}

function bodyEventAssets(body) {
  return [
    body.imagePublicId && { publicId: body.imagePublicId, resourceType: body.imageResourceType },
    ...(Array.isArray(body.contentBlocks) ? body.contentBlocks.map((block) => (
      block?.srcPublicId && { publicId: block.srcPublicId, resourceType: block.srcResourceType }
    )) : [])
  ].filter(Boolean);
}

function uploadError(error) {
  const wrapped = new Error(error.status === 503 || error.status === 400
    ? error.message
    : 'Cloudinary could not complete the upload. Please try again.');
  wrapped.status = error.status || 502;
  return wrapped;
}

const eventBlockTypes = new Set(['paragraph', 'subheading', 'image', 'link', 'bulletList', 'numberedList', 'quote', 'richText']);

function validatedUrl(value, label, allowUploads = false) {
  const url = String(value || '').trim();
  if (allowUploads && /^\/uploads\/[a-zA-Z0-9._-]+$/.test(url)) return url;
  if (allowUploads && /^\/original-site\/[a-zA-Z0-9._/-]+$/.test(url)) return url;
  try {
    const parsed = new URL(url);
    if (['http:', 'https:'].includes(parsed.protocol)) return parsed.toString();
  } catch (error) {
    // Return the same validation error for malformed and unsupported URLs.
  }
  throw new Error(`${label} must be a valid HTTP or HTTPS URL${allowUploads ? ' or uploaded image path' : ''}.`);
}

function validateEventBlocks(blocks) {
  if (!Array.isArray(blocks)) throw new Error('Article content must be a list of blocks.');
  return blocks.map((block, position) => {
    if (!block || !eventBlockTypes.has(block.type)) throw new Error('Choose a supported article block type.');
    const normalized = { type: block.type, position };
    const content = String(block.content || '').trim();
    if (['paragraph', 'subheading', 'quote', 'richText'].includes(block.type)) {
      const limit = block.type === 'subheading' ? 140 : 12000;
      if (!content || content.length > limit) throw new Error(`Enter content for each ${block.type} block (up to ${limit} characters).`);
      normalized.content = content;
    }
    if (block.type === 'subheading') {
      if (!['h2', 'h3'].includes(block.headingLevel)) throw new Error('Choose H2 or H3 for each subheading.');
      normalized.headingLevel = block.headingLevel;
    }
    if (block.type === 'image') {
      normalized.src = validatedUrl(block.src, 'Article image', true);
      normalized.srcAsset = requestAsset(block.src, block.srcPublicId, block.srcResourceType, 'events');
      normalized.alt = String(block.alt || '').trim().slice(0, 300);
      normalized.caption = String(block.caption || '').trim().slice(0, 500);
    }
    if (block.type === 'link') {
      if (!content || content.length > 500) throw new Error('Enter link text up to 500 characters.');
      normalized.content = content;
      normalized.url = validatedUrl(block.url, 'Link');
    }
    if (block.type === 'bulletList' || block.type === 'numberedList') {
      const items = Array.isArray(block.items) ? block.items.map((item) => String(item || '').trim()).filter(Boolean) : [];
      if (!items.length || items.some((item) => item.length > 2000)) throw new Error('Add at least one list item, each up to 2,000 characters.');
      normalized.items = items;
    }
    return normalized;
  });
}

function eventFields(body) {
  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();
  const location = String(body.location || '').trim();
  const status = String(body.status || 'published');
  const showInCarousel = body.showInCarousel === true || body.showInCarousel === 'true';
  if (!title || title.length > 140) throw new Error('Enter an event title up to 140 characters.');
  if (description.length > 12000) throw new Error('The legacy description must be 12,000 characters or fewer.');
  if (location.length > 240) throw new Error('The event location must be 240 characters or fewer.');
  if (!['draft', 'published'].includes(status)) throw new Error('Choose draft or published status.');
  const image = body.image ? validatedUrl(body.image, 'Featured image', true) : '';
  const imageAsset = image && body.imagePublicId
    ? requestAsset(image, body.imagePublicId, body.imageResourceType, 'events')
    : null;
  if (showInCarousel && status === 'published' && !image) throw new Error('Upload a featured image before adding this event to the home carousel.');
  let startsAt = null;
  if (body.startsAt) {
    startsAt = new Date(body.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw new Error('Enter a valid event date and time.');
  }
  return {
    title,
    description,
    contentBlocks: validateEventBlocks(body.contentBlocks || []),
    image,
    imageAsset,
    startsAt,
    location,
    registrationUrl: body.registrationUrl ? validatedUrl(body.registrationUrl, 'Registration link') : '',
    isUpcoming: body.isUpcoming === true || body.isUpcoming === 'true',
    showInCarousel,
    status
  };
}

async function syncEventCarousel(event, showInCarousel) {
  const existingItem = await Carousel.findOne({ itemType: 'event', itemId: event._id });
  if (!showInCarousel || event.status !== 'published') {
    if (existingItem) await Carousel.deleteOne({ _id: existingItem._id });
    return;
  }
  const articleCopy = (event.contentBlocks || [])
    .map((block) => [block.content, ...(block.items || [])].filter(Boolean).join(' '))
    .filter(Boolean)
    .join(' ');
  const carouselFields = {
    heading: event.title,
    image: event.image,
    imageAsset: event.imageAsset,
    descriptionSnippet: String(event.description || articleCopy).replace(/\s+/g, ' ').trim().slice(0, 180),
    createdAt: new Date()
  };
  if (existingItem) {
    Object.assign(existingItem, carouselFields);
    await existingItem.save();
    return;
  }
  await addCarouselItem({ itemType: 'event', itemId: event._id, ...carouselFields });
}

const msalReady = Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET && process.env.MICROSOFT_TENANT_ID);
const msal = msalReady ? new ConfidentialClientApplication({
  auth: {
    clientId: process.env.MICROSOFT_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}`,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET
  }
}) : null;

function setSession(res, user) {
  const token = jwt.sign({ sub: user.id, sessionVersion: user.sessionVersion || 0 }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie('cci_session', token, {
    ...sessionCookieOptions(),
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

function sessionCookieOptions() {
  const secure = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    path: '/',
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
app.post('/api/auth/logout', async (req, res) => {
  try {
    const token = req.cookies.cci_session;
    if (token) {
      let payload;
      try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
      } catch (error) {
        if (!['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) throw error;
      }
      if (payload?.sub && mongoose.isValidObjectId(payload.sub)) {
        const sessionVersion = Number(payload.sessionVersion || 0);
        const revocation = await User.updateOne({
          _id: payload.sub,
          $or: [{ sessionVersion }, { sessionVersion: { $exists: false } }]
        }, { $inc: { sessionVersion: 1 } });
        if (revocation.modifiedCount) io.in(`user:${payload.sub}`).disconnectSockets(true);
      }
    }
  } finally {
    res.clearCookie('cci_session', sessionCookieOptions());
    res.clearCookie('cci_session', { ...sessionCookieOptions(), path: '/api/auth' });
  }
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
  const search = String(req.query.q || '').trim().slice(0, 60);
  const query = { status: { $ne: 'draft' } };
  if (!search) query.isUpcoming = upcomingOnly;
  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { title: new RegExp(escapedSearch, 'i') },
      { description: new RegExp(escapedSearch, 'i') },
      { hashtags: new RegExp(escapedSearch, 'i') }
    ];
  }
  const events = await Event.find(query)
    .populate('createdBy', 'name email photo role')
    .populate('likes', 'name photo')
    .populate('comments.userId', 'name photo role')
    .sort(upcomingOnly ? { startsAt: 1 } : { createdAt: -1 });
  res.json(events);
});

app.get('/api/admin/events', authenticate, requireAdmin, async (req, res) => {
  const [events, carouselItems] = await Promise.all([
    Event.find({ type: 'event' }).populate('createdBy', 'name email photo role').sort({ createdAt: -1 }),
    Carousel.find({ itemType: 'event' }).select('itemId')
  ]);
  const featuredIds = new Set(carouselItems.map((item) => String(item.itemId)));
  res.json(events.map((event) => ({ ...event.toObject(), isInCarousel: featuredIds.has(String(event._id)) })));
});

app.post('/api/admin/event-images', authenticate, requireAdmin, rejectOversizedRequest, (req, res, next) => {
  imageUpload.single('image')(req, res, async (error) => {
    if (error) return next(error);
    if (!req.file) return res.status(400).json({ message: 'Choose an image to upload.' });
    try {
      const [asset] = await uploadFiles([req.file], 'events', ['image']);
      res.status(201).json({
        image: asset.url,
        imagePublicId: asset.publicId,
        imageResourceType: asset.resourceType
      });
    } catch (uploadFailure) {
      next(uploadError(uploadFailure));
    }
  });
});

app.post('/api/admin/events', authenticate, requireAdmin, async (req, res) => {
  let fields;
  try {
    fields = eventFields(req.body);
  } catch (error) {
    try {
      await deleteAssets(bodyEventAssets(req.body));
    } catch (cleanupError) {
      console.error('Unable to clean up an unused event image.', cleanupError);
    }
    return res.status(400).json({ message: error.message });
  }
  const { showInCarousel, ...eventFieldsToSave } = fields;
  let event;
  try {
    event = await Event.create({ ...eventFieldsToSave, type: 'event', createdBy: req.user._id });
    await event.populate('createdBy', 'name email photo role');
    await syncEventCarousel(event, showInCarousel);
    if (event.status === 'published') {
      const notification = await Notification.create({
        type: 'event', title: event.title, message: `A new event, ${event.title}, has been posted.`, relatedId: event._id, forAllUsers: true
      });
      io.emit('notification:new', notification);
    }
  } catch (error) {
    if (event) {
      try {
        await Promise.all([
          Event.deleteOne({ _id: event._id }),
          Carousel.deleteMany({ itemType: 'event', itemId: event._id }),
          Notification.deleteMany({ type: 'event', relatedId: event._id })
        ]);
      } catch (rollbackError) {
        console.error('Unable to roll back event records after a failed database operation.', rollbackError);
      }
    }
    try {
      await deleteAssets(eventAssets(event || eventFieldsToSave));
    } catch (cleanupError) {
      console.error('Unable to clean up event images after a failed database operation.', cleanupError);
    }
    throw error;
  }
  res.status(201).json(event);
});

app.patch('/api/admin/events/:id', authenticate, requireAdmin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Event not found.' });
  const event = await Event.findOne({ _id: req.params.id, type: 'event' });
  if (!event) return res.status(404).json({ message: 'Event not found.' });
  const previousAssets = eventAssets(event);
  const previousIds = new Set(previousAssets.map((asset) => asset.publicId));
  let fields;
  try {
    fields = eventFields(req.body);
  } catch (error) {
    try {
      await deleteAssets(bodyEventAssets(req.body).filter((asset) => !previousIds.has(asset.publicId)));
    } catch (cleanupError) {
      console.error('Unable to clean up an unused replacement event image.', cleanupError);
    }
    return res.status(400).json({ message: error.message });
  }
  if (fields.image === event.image && !fields.imageAsset?.publicId) {
    fields.imageAsset = event.imageAsset;
  }
  fields.contentBlocks = fields.contentBlocks.map((block, index) => {
    const previousBlock = event.contentBlocks?.[index];
    if (block.type === 'image' && block.src === previousBlock?.src && !block.srcAsset?.publicId) {
      return { ...block, srcAsset: previousBlock.srcAsset };
    }
    return block;
  });
  const wasDraft = event.status === 'draft';
  const { showInCarousel, ...eventFieldsToSave } = fields;
  Object.assign(event, eventFieldsToSave);
  try {
    await event.save();
  } catch (error) {
    try {
      await deleteAssets(eventAssets(event).filter((asset) => !previousIds.has(asset.publicId)));
    } catch (cleanupError) {
      console.error('Unable to clean up replacement event images after a failed database operation.', cleanupError);
    }
    throw error;
  }
  await event.populate('createdBy', 'name email photo role');
  await syncEventCarousel(event, showInCarousel);
  const currentIds = new Set(eventAssets(event).map((asset) => asset.publicId));
  await deleteAssets(previousAssets.filter((asset) => !currentIds.has(asset.publicId)));
  if (wasDraft && event.status === 'published') {
    const notification = await Notification.create({
      type: 'event', title: event.title, message: `A new event, ${event.title}, has been posted.`, relatedId: event._id, forAllUsers: true
    });
    io.emit('notification:new', notification);
  }
  res.json(event);
});

app.delete('/api/admin/events/:id', authenticate, requireAdmin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Event not found.' });
  const event = await Event.findById(req.params.id).select('type createdBy imageAsset videoAsset contentBlocks');
  if (!event) return res.status(404).json({ message: 'Event not found.' });
  if (String(event.createdBy) !== String(req.user._id)) {
    return res.status(403).json({ message: 'You can only delete posts you created.' });
  }

  const [carouselItems, relatedPost] = await Promise.all([
    Carousel.find({ itemType: { $in: ['event', 'video'] }, itemId: event._id }).select('imageAsset videoAsset'),
    Post.findOne({ relatedId: event._id, relatedType: 'event' }).select('mediaAssets carouselImageAsset')
  ]);
  await Promise.all([
    Carousel.deleteMany({ itemId: event._id }),
    Notification.deleteMany({ type: event.type, relatedId: event._id })
  ]);
  const deletion = await Event.deleteOne({ _id: event._id });
  if (deletion.deletedCount !== 1) return res.status(404).json({ message: 'Event not found.' });
  if (relatedPost) await Post.deleteOne({ _id: relatedPost._id });
  await deleteAssets([
    ...eventAssets(event),
    ...(relatedPost?.mediaAssets || []),
    relatedPost?.carouselImageAsset,
    ...carouselItems.flatMap((item) => [item.imageAsset, item.videoAsset])
  ]);
  res.json({ ok: true });
});

app.delete('/api/admin/posts/:id', authenticate, requireAdmin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Post not found.' });
  const post = await Post.findById(req.params.id).select('relatedId relatedType mediaAssets carouselImageAsset');
  if (!post) return res.status(404).json({ message: 'Post not found.' });
  const relatedAssets = [];
  let carouselItems = [];
  if (post.relatedId && post.relatedType === 'gallery') {
    const gallery = await Gallery.findById(post.relatedId).select('galleryImageAssets carouselImageAsset');
    if (gallery) relatedAssets.push(...gallery.galleryImageAssets, gallery.carouselImageAsset);
    carouselItems = await Carousel.find({ itemType: 'gallery', itemId: post.relatedId }).select('imageAsset videoAsset');
    await Gallery.deleteOne({ _id: post.relatedId });
  } else if (post.relatedId && post.relatedType === 'event') {
    const event = await Event.findById(post.relatedId).select('imageAsset videoAsset contentBlocks');
    if (event) relatedAssets.push(...eventAssets(event));
    carouselItems = await Carousel.find({ itemType: { $in: ['event', 'video'] }, itemId: post.relatedId }).select('imageAsset videoAsset');
    await Event.deleteOne({ _id: post.relatedId });
  }
  await Promise.all([
    Carousel.deleteMany({ itemId: post.relatedId }),
    Notification.deleteMany({ relatedId: post.relatedId }),
    Post.deleteOne({ _id: post._id })
  ]);
  await deleteAssets([
    ...post.mediaAssets,
    post.carouselImageAsset,
    ...relatedAssets,
    ...carouselItems.flatMap((item) => [item.imageAsset, item.videoAsset])
  ]);
  res.json({ ok: true });
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
  if (!event || event.isUpcoming || event.status === 'draft') return res.status(404).json({ message: 'Event not found.' });
  event.comments.push({ userId: req.user._id, text });
  await event.save();
  await event.populate('comments.userId', 'name photo role');
  res.status(201).json(event.comments[event.comments.length - 1]);
});

app.post('/api/events/:id/likes', authenticate, async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event || event.isUpcoming || event.status === 'draft') return res.status(404).json({ message: 'Event not found.' });
  const alreadyLiked = event.likes.some((userId) => userId.equals(req.user._id));
  if (alreadyLiked) event.likes.pull(req.user._id);
  else event.likes.addToSet(req.user._id);
  await event.save();
  res.json({ liked: !alreadyLiked, likes: event.likes.length });
});

app.post('/api/posts', authenticate, requireAdmin, rejectOversizedRequest, mediaUpload.fields([
  { name: 'media', maxCount: 500 },
  { name: 'coverImage', maxCount: 1 }
]), async (req, res) => {
  const { kind, heading = '', description = '', showInCarousel = 'false', carouselIndex = '0', videoUrl = '' } = req.body;
  const files = req.files?.media || [];
  const coverFile = req.files?.coverImage?.[0];
  if (!['event', 'video', 'gallery'].includes(kind)) return res.status(400).json({ message: 'Choose a supported post type.' });
  if (kind !== 'video' && !String(heading).trim()) return res.status(400).json({ message: 'Add a heading for this post.' });
  if (kind !== 'video' && coverFile) return res.status(400).json({ message: 'Cover images can only be uploaded with videos.' });
  if (kind === 'video' && files.length > 1) return res.status(400).json({ message: 'Upload one video at a time.' });
  if (kind === 'gallery' && files.length > 500) return res.status(400).json({ message: 'A gallery can contain at most 500 images.' });
  if (kind === 'event' && files.length > 1) return res.status(400).json({ message: 'Upload one event image at a time.' });
  if (!files.length && !(kind === 'video' && String(videoUrl).trim())) {
    return res.status(400).json({ message: 'Choose media to publish.' });
  }
  const allFiles = [...files, ...(coverFile ? [coverFile] : [])];
  if (allFiles.some((file) => file.size > 50 * 1024 * 1024) || allFiles.reduce((total, file) => total + file.size, 0) > 50 * 1024 * 1024) {
    return res.status(413).json({ message: 'The total upload size must be 50 MB or less.' });
  }
  let externalVideoUrl = '';
  if (kind === 'video' && !files.length) {
    try {
      const parsedVideoUrl = new URL(String(videoUrl).trim());
      if (!['http:', 'https:'].includes(parsedVideoUrl.protocol)) throw new Error('Invalid protocol');
      externalVideoUrl = parsedVideoUrl.toString();
    } catch (error) {
      return res.status(400).json({ message: 'Enter a valid HTTP or HTTPS video URL.' });
    }
  }

  const allowedTypes = kind === 'video' ? ['video'] : ['image'];
  let uploadedAssets = [];
  let uploadedMediaAssets = [];
  let uploadedCoverAsset;
  try {
    uploadedMediaAssets = files.length ? await uploadFiles(files, kind === 'gallery' ? 'galleries' : 'posts', allowedTypes) : [];
    uploadedAssets = [...uploadedMediaAssets];
    if (coverFile) {
      [uploadedCoverAsset] = await uploadFiles([coverFile], 'posts', ['image']);
      uploadedAssets.push(uploadedCoverAsset);
    }
  } catch (error) {
    try {
      await deleteAssets(uploadedAssets);
    } catch (cleanupError) {
      console.error('Unable to clean up uploaded media after a failed upload.', cleanupError);
    }
    throw uploadError(error);
  }
  const media = uploadedMediaAssets.length ? uploadedMediaAssets.map((asset) => asset.url) : [externalVideoUrl];
  const mediaAssets = uploadedMediaAssets.map(({ publicId, resourceType }) => ({ publicId, resourceType }));
  const showInCarouselValue = showInCarousel === 'true';
  const index = Math.max(0, Math.min(Number(carouselIndex) || 0, media.length - 1));
  let post;
  let related;
  let relatedType;
  try {
    post = await Post.create({
      kind,
      heading: kind === 'video' ? '' : String(heading).trim(),
      description: kind === 'video' ? '' : String(description).trim().slice(0, 1200),
      media,
      mediaAssets,
      showInCarousel: showInCarouselValue,
      carouselImage: showInCarouselValue && kind !== 'video' ? media[index] : '',
      carouselImageAsset: showInCarouselValue && kind !== 'video' ? mediaAssets[index] : undefined,
      author: req.user._id
    });

    if (kind === 'gallery') {
      relatedType = 'gallery';
      related = await Gallery.create({
        heading: String(heading).trim(),
        carouselImage: showInCarouselValue ? media[index] : '',
        carouselImageAsset: showInCarouselValue ? mediaAssets[index] : undefined,
        galleryImages: media,
        galleryImageAssets: mediaAssets,
        createdBy: req.user._id
      });
      if (showInCarouselValue) {
        await addCarouselItem({
          itemType: 'gallery',
          itemId: related._id,
          heading: related.heading,
          image: related.carouselImage,
          imageAsset: related.carouselImageAsset
        });
      }
    } else {
      relatedType = 'event';
      related = await Event.create({
        title: kind === 'video' ? 'Featured CCI video' : String(heading).trim(),
        description: kind === 'video' ? '' : String(description).trim().slice(0, 12000),
        image: kind === 'video' ? uploadedCoverAsset?.url || '' : media[0],
        imageAsset: kind === 'video' && uploadedCoverAsset
          ? { publicId: uploadedCoverAsset.publicId, resourceType: uploadedCoverAsset.resourceType }
          : kind === 'video' ? undefined : mediaAssets[0],
        videoUrl: kind === 'video' ? media[0] : '',
        videoAsset: kind === 'video' ? mediaAssets[0] : undefined,
        type: kind,
        createdBy: req.user._id
      });
      if (kind === 'video' || showInCarouselValue) {
        await addCarouselItem({
          itemType: kind,
          itemId: related._id,
          heading: kind === 'video' ? '' : related.title,
          image: related.image,
          imageAsset: related.imageAsset,
          videoUrl: related.videoUrl,
          videoAsset: kind === 'video' ? related.videoAsset : undefined,
          descriptionSnippet: kind === 'video' ? '' : related.description.slice(0, 180)
        });
      }
    }

    post.relatedId = related._id;
    post.relatedType = relatedType;
    await post.save();
    await post.populate('author', 'name email photo role');

    const title = kind === 'video' ? 'New video' : String(heading).trim();
    const message = kind === 'gallery'
      ? `A new photo gallery, ${title}, is available.`
      : kind === 'video'
        ? 'A new video is available to watch.'
        : `A new event, ${title}, has been posted.`;
    const notification = await Notification.create({
      type: kind,
      title,
      message,
      relatedId: related._id,
      forAllUsers: true
    });
    io.emit('notification:new', notification);
    res.status(201).json(post);
  } catch (error) {
    try {
      if (related) {
        await Promise.all([
          relatedType === 'gallery' ? Gallery.deleteOne({ _id: related._id }) : Event.deleteOne({ _id: related._id }),
          Carousel.deleteMany({ itemId: related._id }),
          Notification.deleteMany({ relatedId: related._id })
        ]);
      }
      if (post) await Post.deleteOne({ _id: post._id });
    } catch (rollbackError) {
      console.error('Unable to roll back post records after a failed database operation.', rollbackError);
    }
    try {
      await deleteAssets(uploadedAssets);
    } catch (cleanupError) {
      console.error('Unable to clean up uploaded media after a failed database operation.', cleanupError);
    }
    throw error;
  }
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

app.patch('/api/profile', authenticate, rejectOversizedRequest, imageUpload.single('photo'), async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name || name.length > 80) return res.status(400).json({ message: 'Enter a name up to 80 characters.' });
  let newAsset = null;
  if (req.file) {
    try {
      [newAsset] = await uploadFiles([req.file], 'profile', ['image']);
    } catch (error) {
      throw uploadError(error);
    }
  }
  const previousAsset = req.user.photoAsset?.publicId
    ? { publicId: req.user.photoAsset.publicId, resourceType: req.user.photoAsset.resourceType }
    : null;
  req.user.name = name;
  if (newAsset) {
    req.user.photo = newAsset.url;
    req.user.photoAsset = { publicId: newAsset.publicId, resourceType: newAsset.resourceType };
  }
  try {
    await req.user.save();
  } catch (error) {
    if (newAsset) await deleteAssets([newAsset]);
    throw error;
  }
  if (newAsset && previousAsset) await deleteAssets([previousAsset]);
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
    const user = await User.findById(payload.sub).select('_id sessionVersion');
    if (!user || Number(payload.sessionVersion || 0) !== Number(user.sessionVersion || 0)) {
      return next(new Error('Unauthorized'));
    }
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
  if (error instanceof multer.MulterError) {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ message: error.message });
  }
  if (error.message?.startsWith('Upload ')) return res.status(400).json({ message: error.message });
  if (error.status) return res.status(error.status).json({ message: error.message });
  console.error(error);
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
});

const frontendBuild = path.join(__dirname, '..', '..', 'frontend', 'build');
if (fs.existsSync(frontendBuild)) {
  app.use((req, res, next) => {
    if (req.method !== 'GET' || !req.accepts('html')) return next();
    const route = req.path.replace(/\/+$/, '') || '/';
    const privateRoute = /^\/(?:login|admin(?:\/|$)|users(?:\/|$)|home(?:\/|$)|my-cci(?:\/|$)|events(?:\/|$)|gallery(?:\/|$)|chat(?:\/|$)|sage-ess(?:\/|$))/.test(route);
    res.setHeader('X-Robots-Tag', privateRoute ? 'noindex, nofollow' : 'index, follow');
    next();
  });
  app.use(express.static(frontendBuild));
  app.get('*', (req, res) => {
    res.setHeader('X-Robots-Tag', req.path === '/' ? 'index, follow' : 'noindex, nofollow');
    res.sendFile(path.join(frontendBuild, 'index.html'));
  });
}

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cci-community-portal')
  .then(seedDatabase)
  .then(() => server.listen(port, () => console.log(`CCI Community API listening on ${port}`)))
  .catch((error) => {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  });