import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Check, CheckCheck, Ellipsis, Heart, House, MessageCircle,
  MoreVertical, Paperclip, Search, Send, SquarePen
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const api = axios.create({ withCredentials: true });

function requestError(error) {
  return error.response?.data?.message || 'We could not load this content. Please try again.';
}

function imageSource(image) {
  if (!image) return '/original-site/thumbnail.png';
  return image.startsWith('/uploads/') ? image : image;
}

function avatarColor(value = '') {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) | 0;
  return Math.abs(hash) % 6;
}

function profileHandle(profile) {
  if (profile?.username) return profile.username.replace(/^@/, '');
  const nameHandle = profile?.name?.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return nameHandle || profile?.email?.split('@')[0] || '';
}

function ProfileAvatar({ profile, className = '' }) {
  const name = profile?.name || 'CCI member';
  const identity = profile?._id || profile?.id || name;
  return profile?.photo
    ? <img className={className} src={imageSource(profile.photo)} alt="" />
    : <span className={`${className} profile-initial profile-initial--color-${avatarColor(identity)}`} aria-label={name}>{name.trim().charAt(0).toUpperCase()}</span>;
}

export function EventsPage({ admin = false, eventId }) {
  const [events, setEvents] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [likesOpen, setLikesOpen] = useState({});
  const [commentsOpen, setCommentsOpen] = useState({});
  const commentInputRefs = useRef({});
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const requestedEvent = eventId || searchParams.get('event');

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get('/api/events'),
      api.get('/api/notifications'),
      api.get('/api/events?upcoming=true')
    ]).then(([eventResponse, notificationResponse, upcomingResponse]) => {
      if (!active) return;
      setEvents(eventResponse.data);
      setNotifications(notificationResponse.data);
      setUpcoming(upcomingResponse.data);
      setError('');
    }).catch((loadError) => {
      if (active) setError(requestError(loadError));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const displayedEvents = requestedEvent
    ? events.filter((event) => event._id === requestedEvent)
    : events;
  const unreadNotifications = notifications.filter((notification) => !notification.isRead);
  const displayedNotifications = (unreadNotifications.length ? unreadNotifications : notifications).slice(0, 3);

  async function toggleLike(event) {
    try {
      const { data } = await api.post(`/api/events/${event._id}/likes`);
      setEvents((current) => current.map((item) => item._id === event._id
        ? {
          ...item,
          likes: data.liked
            ? [...item.likes, { _id: user.id, name: user.name }]
            : item.likes.filter((like) => (like._id || like) !== user.id)
        }
        : item));
    } catch (likeError) {
      setError(requestError(likeError));
    }
  }

  async function addComment(event, formEvent) {
    formEvent.preventDefault();
    const form = formEvent.currentTarget;
    const text = String(new FormData(form).get('comment') || '').trim();
    if (!text) return;
    try {
      const { data } = await api.post(`/api/events/${event._id}/comments`, { text });
      setEvents((current) => current.map((item) => item._id === event._id
        ? { ...item, comments: [...item.comments, data] }
        : item));
      form.reset();
    } catch (commentError) {
      setError(requestError(commentError));
    }
  }

  function toggleComments(event) {
    const isCurrentlyOpen = commentsOpen[event._id] ?? requestedEvent === event._id;
    const isOpening = !isCurrentlyOpen;
    setCommentsOpen((current) => ({ ...current, [event._id]: isOpening }));
    if (isOpening) {
      window.requestAnimationFrame(() => commentInputRefs.current[event._id]?.focus());
    }
  }

  async function markRead(notification) {
    if (notification.isRead) return true;
    try {
      await api.patch(`/api/notifications/${notification._id}/read`);
      setNotifications((items) => items.map((item) => item._id === notification._id
        ? { ...item, isRead: true }
        : item));
      window.dispatchEvent(new Event('cci:badges-refresh'));
      return true;
    } catch (readError) {
      setError(requestError(readError));
      return false;
    }
  }

  async function openNotification(notification) {
    if (!await markRead(notification)) return;
    const base = admin ? '/admin' : '';
    if (notification.type === 'gallery') {
      navigate(`${base}/gallery`);
    } else if (notification.type === 'upcoming') {
      navigate(`${base}/events#upcoming-events`);
    } else if (notification.relatedId) {
      navigate(`${base}/events/${notification.relatedId}`);
    } else {
      navigate(`${base}/events`);
    }
  }

  return (
    <main className={`events-page page-shell${requestedEvent ? ' has-event-detail' : ''}`}>
      <div className="events-layout">
        <section className="events-feed" aria-label="Events and updates">
          {requestedEvent && (
            <Link className="event-detail-back" to={admin ? '/admin/events' : '/events'} onClick={() => setSearchParams({})}>
              <i className="fa-solid fa-arrow-left" aria-hidden="true" />
              <span>All events</span>
            </Link>
          )}
          {error && <p className="form-message" role="alert">{error}</p>}
          {loading ? <div className="events-post-list" role="status" aria-label="Loading events">{[0, 1, 2].map((item) => <article className="event-post event-post-skeleton" key={item} aria-hidden="true"><header className="post-header"><span className="skeleton-block skeleton-avatar" /><span className="skeleton-author"><i className="skeleton-block skeleton-line skeleton-name" /><i className="skeleton-block skeleton-line skeleton-handle" /></span><i className="skeleton-block skeleton-line skeleton-date" /><i className="skeleton-block skeleton-menu" /></header><div className="post-content"><i className="skeleton-block skeleton-copy" /><i className="skeleton-block skeleton-copy skeleton-copy-short" /><i className="skeleton-block skeleton-media" /></div><div className="post-actions"><i className="skeleton-block skeleton-action" /><i className="skeleton-block skeleton-action" /><i className="skeleton-block skeleton-action-date" /></div></article>)}</div>
            : displayedEvents.length === 0
              ? <p className="events-empty-state">No events or updates have been posted yet.</p>
              : <div className="events-post-list">
                {displayedEvents.map((event) => {
                  const liked = (event.likes || []).some((like) => (like._id || like) === user.id);
                  const author = event.createdBy || {};
                  const authorHandle = profileHandle(author);
                  const createdAt = new Date(event.createdAt);
                  const commentsExpanded = commentsOpen[event._id] ?? requestedEvent === event._id;
                  return (
                    <article
                      className="event-post"
                      key={event._id}
                      tabIndex={requestedEvent ? undefined : 0}
                      aria-label={`Open post by ${author.name || 'CCI South Africa'}`}
                      onClick={(clickEvent) => {
                        if (requestedEvent || clickEvent.target.closest('button, a, input, textarea, form, video')) return;
                        navigate(admin ? `/admin/events/${event._id}` : `/events/${event._id}`);
                      }}
                      onKeyDown={(keyEvent) => {
                        if (requestedEvent || keyEvent.target !== keyEvent.currentTarget || !['Enter', ' '].includes(keyEvent.key)) return;
                        keyEvent.preventDefault();
                        navigate(admin ? `/admin/events/${event._id}` : `/events/${event._id}`);
                      }}
                    >
                      <header className="post-header">
                        <ProfileAvatar profile={author} className="post-avatar" />
                        <div className="post-author"><strong>{author.name || 'CCI South Africa'}</strong><span>{authorHandle && `@${authorHandle}`}</span></div>
                        <time dateTime={event.createdAt}>{createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {createdAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</time>
                        <button className="bare-icon-button post-menu" type="button" aria-label="Post options"><Ellipsis aria-hidden="true" /></button>
                      </header>
                      <div className="post-content">
                        {event.title && <h2>{event.title}</h2>}
                        {event.description && <p>{event.description}</p>}
                        {event.type === 'video'
                          ? <video controls playsInline preload="metadata" poster="/original-site/CCI/videoImage.png"><source src={event.videoUrl} /></video>
                          : event.image && <img src={imageSource(event.image)} alt={event.title || ''} />}
                      </div>
                      <div className="post-actions">
                        <div className="like-action-group">
                          <button className={`post-action like-button${liked ? ' is-liked' : ''}`} type="button" aria-pressed={liked} aria-label={liked ? 'Unlike post' : 'Like post'} onClick={() => toggleLike(event)}>
                            <Heart aria-hidden="true" fill={liked ? 'currentColor' : 'none'} />
                          </button>
                          <button className="likes-summary" type="button" aria-expanded={Boolean(likesOpen[event._id])} onClick={() => setLikesOpen((open) => ({ ...open, [event._id]: !open[event._id] }))}>{event.likes?.length || 0} likes</button>
                        </div>
                        <button className="post-action comment-toggle" type="button" aria-expanded={commentsExpanded} onClick={() => toggleComments(event)}>
                          <MessageCircle aria-hidden="true" /><span className="comment-count">{event.comments?.length || 0}</span><span>Comments</span>
                        </button>
                        <time dateTime={event.createdAt}>{createdAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</time>
                      </div>
                      {likesOpen[event._id] && <div className="likes-list" aria-label="People who liked this post">{event.likes?.length ? event.likes.map((person) => <span key={person._id || person.id}>{person.name || 'CCI member'}</span>) : <span>No likes yet.</span>}</div>}
                      <section className="post-comments" aria-label="Comments" hidden={!commentsExpanded}>
                        <div className="comment-list">
                          {(event.comments || []).map((comment) => (
                            <article className="event-comment" key={comment._id}>
                              <ProfileAvatar profile={comment.userId} />
                              <div><div className="comment-author"><strong>{comment.userId?.name || 'CCI member'}</strong>{profileHandle(comment.userId) && <span>@{profileHandle(comment.userId)}</span>}<time>{new Date(comment.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {new Date(comment.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</time></div><p>{comment.text}</p></div>
                            </article>
                          ))}
                        </div>
                        <form className="comment-form" onSubmit={(formEvent) => addComment(event, formEvent)}>
                          <ProfileAvatar profile={user} />
                          <label className="visually-hidden" htmlFor={`comment-${event._id}`}>Add a comment</label>
                          <input ref={(input) => { commentInputRefs.current[event._id] = input; }} id={`comment-${event._id}`} name="comment" placeholder="Write a comment…" maxLength={1000} required />
                          <button type="submit" aria-label="Post comment"><Send aria-hidden="true" /></button>
                        </form>
                      </section>
                    </article>
                  );
                })}
              </div>}
        </section>
        {!requestedEvent && <aside className="events-sidebar">
          <section className="events-side-panel notification-panel" aria-labelledby="events-notifications-title">
            <div className="side-panel-heading"><h2 id="events-notifications-title">Notifications</h2><i className="fa-regular fa-bell" aria-hidden="true" /></div>
            {loading
              ? <div className="notification-loading-skeleton" role="status" aria-label="Loading notifications">{[0, 1, 2].map((item) => <div className="notification-skeleton-row" key={item}><i className="skeleton-block notification-skeleton-icon" /><span><i className="skeleton-block skeleton-line notification-skeleton-title" /><i className="skeleton-block skeleton-line notification-skeleton-message" /><i className="skeleton-block skeleton-line notification-skeleton-time" /></span></div>)}</div>
              : displayedNotifications.length === 0
              ? <p className="notification-empty">You’re all caught up.</p>
              : <ul className="event-notifications">
                {displayedNotifications.map((item) => (
                  <li key={item._id}>
                    <button className="event-notification" type="button" onClick={() => { void openNotification(item); }}>
                      <span className="notification-icon"><i className={`fa-solid ${item.type === 'upcoming' ? 'fa-calendar-days' : item.type === 'gallery' ? 'fa-images' : 'fa-bell'}`} aria-hidden="true" /></span>
                      <span className="notification-copy"><strong>{item.title}</strong> {item.message}<time>{new Date(item.createdAt).toLocaleString()}</time></span>
                      {!item.isRead && <span className="notification-unread" aria-label="Unread" />}
                    </button>
                  </li>
                ))}
              </ul>}
          </section>
          <section className="events-side-panel" id="upcoming-events">
            <div className="side-panel-heading"><h2>Upcoming</h2><i className="fa-regular fa-calendar-days" aria-hidden="true" /></div>
            <div className="upcoming-events-list">
              {upcoming.slice(0, 2).map((event) => <article className="upcoming-event" key={event._id}><time dateTime={event.startsAt}><strong>{new Date(event.startsAt).toLocaleDateString('en', { day: '2-digit' })}</strong><span>{new Date(event.startsAt).toLocaleDateString('en', { month: 'short' }).toUpperCase()}</span></time><div><h3>{event.title}</h3><p>{event.location}</p></div></article>)}
            </div>
          </section>
          <section className="events-side-panel"><div className="side-panel-heading"><h2>Popular tags</h2><i className="fa-solid fa-hashtag" aria-hidden="true" /></div><div className="event-tags"><a href="#!">#PeopleFirst</a><a href="#!">#CareerBox</a><a href="#!">#CCICommunity</a></div></section>
        </aside>}
      </div>
    </main>
  );
}

export function GalleryPage() {
  const [galleries, setGalleries] = useState([]);
  const [selected, setSelected] = useState(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [error, setError] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    let active = true;
    api.get('/api/gallery').then(({ data }) => {
      if (active) setGalleries(data);
    }).catch((loadError) => {
      if (active) setError(requestError(loadError));
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const requestedId = searchParams.get('album');
    if (requestedId) setSelected(galleries.find((gallery) => gallery._id === requestedId) || null);
    else setSelected(null);
  }, [galleries, searchParams]);

  function openGallery(gallery) {
    setSearchParams({ album: gallery._id });
  }

  function closeGallery() {
    setSearchParams({});
  }

  const photos = selected?.galleryImages || [];
  return (
    <main className="gallery-page page-shell">
      <header className="gallery-hero"><img src="https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1800&q=90" alt="Colleagues gathering at a CCI community event" /><div className="gallery-hero-copy"><h1>Gallery</h1><p>Browse moments from our people, events and communities.</p></div></header>
      {error && <p className="form-message" role="alert">{error}</p>}
      {!selected ? <div className="gallery-months"><section className="gallery-month" aria-labelledby="gallery-current"><div className="month-heading"><h2 id="gallery-current">Photo albums</h2><span>{galleries.length} albums</span></div>
        {galleries.length === 0 ? <p className="gallery-empty-state">No photo albums have been posted yet.</p> : <div className="album-grid">{galleries.map((gallery) => <button className="album-card" type="button" key={gallery._id} onClick={() => openGallery(gallery)}><span className="album-cover"><img src={imageSource(gallery.carouselImage || gallery.galleryImages[0])} alt="" loading="lazy" /></span><span className="album-card-copy"><strong>{gallery.heading}</strong><span>{gallery.galleryImages.length} photos</span></span></button>)}</div>}
      </section></div> : <section className="gallery-album-view" aria-labelledby="album-view-title"><div className="album-view-heading"><button className="album-back" type="button" onClick={closeGallery}><i className="fa-solid fa-arrow-left" aria-hidden="true" /><span>All albums</span></button><div><p className="eyebrow">PHOTO ALBUM</p><h2 id="album-view-title">{selected.heading}</h2></div></div><div className="gallery-photo-grid">{photos.map((photo, index) =>       <button className="gallery-photo-button" type="button" key={`${photo}-${index}`} aria-label={`Open photo ${index + 1}`} onClick={() => { setPhotoIndex(index); setLightboxOpen(true); document.body.classList.add('lightbox-open'); }}><img src={imageSource(photo)} alt={`${selected.heading}, photo ${index + 1}`} loading="lazy" /></button>)}</div></section>}
      {selected && <div className="gallery-lightbox" role="dialog" aria-modal="true" aria-label="Photo viewer" hidden={!lightboxOpen} onClick={(event) => { if (event.target === event.currentTarget) setLightboxOpen(false); }}>
        <button className="lightbox-close" type="button" aria-label="Close photo" onClick={() => setLightboxOpen(false)}><i className="fa-solid fa-xmark" /></button>
        <button className="lightbox-arrow lightbox-previous" type="button" aria-label="Previous photo" onClick={() => setPhotoIndex((photoIndex + photos.length - 1) % photos.length)}><i className="fa-solid fa-chevron-left" /></button>
        <figure><img src={imageSource(photos[photoIndex])} alt={`${selected.heading}, photo ${photoIndex + 1}`} /><figcaption>{selected.heading}</figcaption></figure>
        <button className="lightbox-arrow lightbox-next" type="button" aria-label="Next photo" onClick={() => setPhotoIndex((photoIndex + 1) % photos.length)}><i className="fa-solid fa-chevron-right" /></button>
        <span className="lightbox-count">{photoIndex + 1} / {photos.length}</span>
      </div>}
    </main>
  );
}

function userId(value) {
  return typeof value === 'string' ? value : value?._id || value?.id || '';
}

export function ChatPage({ admin = false }) {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [homeRevealed, setHomeRevealed] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState('');
  const homeLinkRef = useRef(null);
  const socketRef = useRef(null);
  const selectedRef = useRef(selected);
  const usersRef = useRef(users);
  const typingTimer = useRef(null);
  const messageHistory = useRef(null);
  const pageBase = admin || user.role === 'admin' ? '/admin' : '';
  selectedRef.current = selected;
  usersRef.current = users;

  useEffect(() => {
    let active = true;
    api.get('/api/chat/conversations')
      .then(({ data }) => {
        if (!active) return;
        setConversations(data);
      })
      .catch((loadError) => { if (active) setError(requestError(loadError)); })
      .finally(() => { if (active) setUsersLoading(false); });
    const socket = io(window.location.origin, { withCredentials: true });
    socketRef.current = socket;
    socket.on('connect_error', (connectionError) => setError(connectionError.message || 'Chat connection failed.'));
    socket.on('message:new', (message) => {
      const activeSelection = selectedRef.current;
      const isForSelected = [user.id, activeSelection?.id].includes(userId(message.senderId)) &&
        [user.id, activeSelection?.id].includes(userId(message.receiverId)) &&
        userId(message.senderId) !== userId(message.receiverId);
      if (isForSelected && activeSelection) {
        setMessages((current) => current.some((item) => item._id === message._id) ? current : [...current, message]);
      }
      setConversations((current) => {
        const senderId = userId(message.senderId);
        const receiverId = userId(message.receiverId);
        const peerId = senderId === user.id ? receiverId : senderId;
        const previous = current.find((item) => item.user.id === peerId);
        const peerProfile = senderId === user.id ? message.receiverId : message.senderId;
        const peer = previous?.user || usersRef.current.find((item) => userId(item) === peerId) ||
          (typeof peerProfile === 'object' ? { ...peerProfile, id: peerId } : null);
        if (!peer) return current;
        return [
          { user: peer, lastMessage: message.message, lastMessageSenderId: userId(message.senderId), lastMessageAt: message.createdAt, unreadCount: userId(message.senderId) === user.id || selectedRef.current?.id === peerId ? 0 : (previous?.unreadCount || 0) + 1 },
          ...current.filter((item) => item.user.id !== peerId)
        ];
      });
    });
    socket.on('message:status', ({ messageIds, status }) => {
      setMessages((current) => current.map((message) => messageIds.includes(message._id) ? { ...message, status } : message));
    });
    socket.on('typing:update', ({ userId: sender, isTyping }) => {
      if (sender === selectedRef.current?.id) setTyping(Boolean(isTyping));
    });
    socket.on('presence:update', ({ userId: personId, status, lastSeen }) => {
      setUsers((current) => current.map((item) => item._id === personId ? { ...item, status, lastSeen } : item));
      setConversations((current) => current.map((item) => item.user.id === personId ? { ...item, user: { ...item.user, status, lastSeen } } : item));
      setSelected((current) => current?.id === personId ? { ...current, status, lastSeen } : current);
    });
    return () => {
      active = false;
      window.clearTimeout(typingTimer.current);
      socket.disconnect();
    };
  }, [user.id]);

  useEffect(() => {
    if (!selected) return undefined;
    let active = true;
    setMessages([]);
    setMessagesLoading(true);
    setTyping(false);
    api.get(`/api/chat/messages/${selected.id}`)
      .then(({ data }) => {
        if (active) {
          setMessages(data);
          window.dispatchEvent(new Event('cci:badges-refresh'));
        }
      })
      .catch((loadError) => { if (active) setError(requestError(loadError)); })
      .finally(() => { if (active) setMessagesLoading(false); });
    setConversations((current) => current.map((item) => item.user.id === selected.id ? { ...item, unreadCount: 0 } : item));
    return () => { active = false; };
  }, [selected?.id]);

  useEffect(() => {
    if (!search.trim()) {
      setSearchLoading(false);
      setSearchResults([]);
      return undefined;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      api.get('/api/users/search', { params: { q: search.trim() } })
        .then(({ data }) => {
          if (!active) return;
          setUsers(data);
          setSearchResults(data);
        })
        .catch((loadError) => { if (active) setError(requestError(loadError)); })
        .finally(() => { if (active) setSearchLoading(false); });
    }, 200);
    return () => { active = false; window.clearTimeout(timer); };
  }, [search]);

  function updateSearch(value) {
    setSearch(value);
    setSearchLoading(Boolean(value.trim()));
  }

  useEffect(() => {
    if (messageHistory.current) messageHistory.current.scrollTop = messageHistory.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (homeRevealed) homeLinkRef.current?.focus();
  }, [homeRevealed]);

  const conversationMap = new Map(conversations.map((conversation) => [conversation.user.id, conversation]));
  const totalUnreadCount = conversations.reduce((total, conversation) => total + Number(conversation.unreadCount || 0), 0);
  const contactList = (search.trim()
    ? searchResults.map((person) => {
      const existing = conversationMap.get(userId(person));
      return {
        ...person,
        id: userId(person),
        preview: existing?.lastMessage ? `${existing.lastMessageSenderId === user.id ? 'You: ' : ''}${existing.lastMessage}` : '',
        lastMessageAt: existing?.lastMessageAt || null,
        unreadCount: existing?.unreadCount || 0
      };
    })
    : conversations.map((conversation) => ({
      ...conversation.user,
      id: userId(conversation.user),
      preview: conversation.lastMessage
        ? `${conversation.lastMessageSenderId === user.id ? 'You: ' : ''}${conversation.lastMessage}`
        : '',
      lastMessageAt: conversation.lastMessageAt,
      unreadCount: conversation.unreadCount
    }))).sort((left, right) => {
    if (left.lastMessageAt && right.lastMessageAt) return new Date(right.lastMessageAt) - new Date(left.lastMessageAt);
    if (left.lastMessageAt) return -1;
    if (right.lastMessageAt) return 1;
    return left.name.localeCompare(right.name);
  }).filter((person) => filter !== 'unread' || person.unreadCount > 0);

  async function sendMessage(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !selected) return;
    try {
      const { data } = await api.post('/api/chat/messages', { recipientId: selected.id, text });
      setMessages((current) => current.some((message) => message._id === data._id) ? current : [...current, data]);
      setDraft('');
      socketRef.current?.emit('typing', { to: selected.id, isTyping: false });
    } catch (sendError) {
      setError(requestError(sendError));
    }
  }

  function updateDraft(value) {
    setDraft(value);
    if (!selected) return;
    socketRef.current?.emit('typing', { to: selected.id, isTyping: Boolean(value.trim()) });
    window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => {
      socketRef.current?.emit('typing', { to: selected.id, isTyping: false });
    }, 1600);
  }

  return (
    <main className={`chat-page page-shell${selected ? ' show-conversation' : ''}`}>
      <section className="chat-workspace" aria-label="Messages">
        <aside className="chat-sidebar">
          <div className="chat-sidebar-heading"><h1>Messages</h1><div className="chat-heading-actions"><Link ref={homeLinkRef} to={`${pageBase}/home`} className="chat-home-action" hidden={!homeRevealed}><House aria-hidden="true" /><span>Home</span></Link><button className="bare-icon-button" id="chat-home-reveal" type="button" aria-label="Show home link" hidden={homeRevealed} onClick={() => setHomeRevealed(true)}><SquarePen aria-hidden="true" /></button></div></div>
          <label className="chat-search"><Search aria-hidden="true" /><input type="search" placeholder="Search people or messages" autoComplete="off" value={search} onChange={(event) => updateSearch(event.target.value)} /></label>
          <div className="chat-filter-tabs" role="tablist" aria-label="Message filters"><button className={`chat-filter${filter === 'all' ? ' is-active' : ''}`} type="button" onClick={() => setFilter('all')}>All</button><button className={`chat-filter${filter === 'unread' ? ' is-active' : ''}`} type="button" onClick={() => setFilter('unread')}>Unread{totalUnreadCount > 0 && <span>{totalUnreadCount}</span>}</button></div>
          {error && <p className="message-feedback" role="alert">{error}</p>}
          <div className="chat-contact-list" aria-label="Recent conversations" aria-busy={usersLoading || searchLoading}>
            {(usersLoading || searchLoading) && Array.from({ length: 6 }, (_, index) => <div className="chat-contact chat-contact-skeleton" key={`skeleton-${index}`} aria-hidden="true"><span className="chat-avatar skeleton-block" /><span className="chat-contact-copy"><i className="skeleton-block skeleton-line skeleton-contact-name" /><i className="skeleton-block skeleton-line skeleton-contact-preview" /></span></div>)}
            {!usersLoading && !searchLoading && contactList.map((contact) => <button className={`chat-contact${selected?.id === contact.id ? ' is-selected' : ''}`} type="button" key={contact.id} onClick={() => setSelected(contact)} data-status={contact.status} data-unread={contact.unreadCount} aria-label={`${contact.name}${contact.unreadCount ? `, ${contact.unreadCount} unread messages` : ''}`}>
              <span className="chat-avatar"><ProfileAvatar profile={contact} /><span className="chat-contact-presence" data-presence={contact.status} /></span>
              <span className="chat-contact-copy"><span className="chat-contact-top"><strong>{contact.name}</strong><time>{contact.lastMessageAt ? new Date(contact.lastMessageAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}</time></span><span className="chat-contact-preview">{contact.status === 'typing' ? 'typing…' : contact.preview || (search.trim() ? 'Start a conversation' : '')}</span></span>
              {contact.unreadCount > 0 && <span className="unread-pill" aria-hidden="true">{contact.unreadCount}</span>}
            </button>)}
            {!usersLoading && !searchLoading && contactList.length === 0 && (search.trim()
              ? <p className="chat-search-empty">No people found.</p>
              : <div className="chat-search-empty chat-start-new"><strong>{filter === 'unread' ? 'No unread messages' : 'Start a new chat'}</strong>{filter !== 'unread' && <span>Search for a colleague to start a conversation.</span>}</div>)}
          </div>
        </aside>
        <section className={`chat-conversation${selected ? ' is-active' : ''}`} aria-label="Conversation">
          {selected ? <>
            <header className="conversation-header"><button className="conversation-back bare-icon-button" type="button" aria-label="Back to conversations" onClick={() => setSelected(null)}><ArrowLeft aria-hidden="true" /></button><span className="chat-avatar conversation-avatar"><ProfileAvatar profile={selected} /></span><div className="conversation-person"><h2>{selected.name}</h2><p className={`presence${selected.status === 'online' ? ' is-online' : ''}${typing ? ' is-typing' : ''}`}>{typing ? 'Typing…' : selected.status === 'online' ? 'Online' : 'Offline'}</p></div><div className="conversation-actions"><button className="bare-icon-button" type="button" aria-label="Search conversation" onClick={() => document.querySelector('.chat-search input')?.focus()}><Search aria-hidden="true" /></button><button className="bare-icon-button" type="button" aria-label="More options"><MoreVertical aria-hidden="true" /></button></div></header>
            <div className="message-history" ref={messageHistory} role="log" aria-live="polite" aria-label="Message history" aria-busy={messagesLoading}><div className="chat-date-divider"><span>Today</span></div>{messagesLoading
              ? <div className="message-loading-skeleton" aria-label="Loading messages">{[0, 1, 2].map((item) => <div className={`message-skeleton-row${item % 2 ? ' is-sent' : ''}`} key={item}><span className="skeleton-block message-skeleton-bubble"><i className="skeleton-block skeleton-line" /><i className="skeleton-block skeleton-line" /></span></div>)}</div>
              : messages.map((message) => {
              const sent = userId(message.senderId) === user.id;
              return <div className={`message-row ${sent ? 'sent' : 'received'}`} key={message._id}><div className="message-bubble"><p>{message.message}</p><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}{sent && (message.status === 'sent' ? <Check size={13} aria-label="Sent" /> : <CheckCheck size={13} className={message.status === 'read' ? 'message-receipt-read' : ''} aria-label={message.status === 'read' ? 'Read' : 'Delivered'} />)}</time></div></div>;
            })}</div>
            <form className="message-composer" onSubmit={sendMessage}><button className="bare-icon-button composer-attach" type="button" aria-label="Attach file"><Paperclip aria-hidden="true" /></button><textarea rows="1" placeholder="Write a message" aria-label="Write a message" value={draft} onChange={(event) => updateDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form.requestSubmit(); } }} /><button className="composer-send" type="submit" aria-label="Send message"><Send aria-hidden="true" /></button></form>
          </> : <div className="chat-welcome"><img className="chat-welcome-logo" src="/images/chatLogo.png" alt="" /><h2>Welcome to CCI Connect</h2><p>Connect with colleagues and management through secure, professional conversations. Please keep messages work-related and avoid sharing payment card data or other sensitive personal information.</p></div>}
        </section>
      </section>
    </main>
  );
}
