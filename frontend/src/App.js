import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext, useAuth } from './context/AuthContext';
import { api, backendUrl } from './api';
import UserPages from './pages/users';
import AdminPages from './pages/admin';
import CommunityPage, { SiteHeader } from './pages/CommunityPage';
import UserLoginPage from './pages/users/login';
import Landing from './pages/Landing';
import EventContentEditor from './pages/shared/EventContentEditor';
import {
  ArrowRight, CalendarDays, Check, Image, Play, ShieldCheck, Upload, X
} from 'lucide-react';

function errorText(error) {
  return error.response?.data?.message || 'We could not complete that request. Please try again.';
}

const emptyAdminEvent = () => ({
  title: '', description: '', contentBlocks: [], image: '', startsAt: '', location: '',
  registrationUrl: '', isUpcoming: false, status: 'draft', showInCarousel: false
});

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api.get('/api/auth/me')
      .then(({ data }) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);

  const contextValue = useMemo(() => ({ user, setUser, checking }), [user, checking]);
  return (
    <AuthContext.Provider value={contextValue}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin/login" element={<Login adminOnly />} />
        <Route path="/home" element={<Protected><CommunityPage page="home" /></Protected>} />
        <Route path="/my-cci" element={<Protected><CommunityPage page="my-cci" /></Protected>} />
        <Route path="/events" element={<Protected><CommunityPage page="events" /></Protected>} />
        <Route path="/events/:eventId" element={<Protected><EventDetail /></Protected>} />
        <Route path="/gallery" element={<Protected><CommunityPage page="gallery" /></Protected>} />
        <Route path="/chat" element={<Protected><CommunityPage page="chat" /></Protected>} />
        <Route path="/users/*" element={<Protected><UserPages /></Protected>} />
        <Route path="/admin/*" element={<Protected admin><AdminPages Admin={Admin} /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthContext.Provider>
  );
}

function EventDetail() {
  const location = useLocation();
  const eventId = location.pathname.split('/').pop();
  return <CommunityPage page="events" eventId={eventId} />;
}

function Protected({ children, admin = false }) {
  const { user, checking } = useAuth();
  const location = useLocation();
  if (checking) return <div className="screen-loading"><span className="loading-mark">CCI</span></div>;
  if (!user?.id) {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" state={{ from }} replace />;
  }
  if (admin && user.role !== 'admin') return <Navigate to="/home" replace />;
  return children;
}

function Login({ adminOnly = false }) {
  const { user, setUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  if (user) return <Navigate to={user.role === 'admin' ? location.state?.from || '/admin/home' : adminOnly ? '/' : location.state?.from || '/home'} replace />;

  async function signIn(email, password, requireAdmin = false) {
    try {
      const { data } = await api.post('/api/auth/local', { email, password, adminOnly: requireAdmin });
      setUser(data.user);
      navigate(location.state?.from || (data.user.role === 'admin' ? '/admin/home' : '/home'), { replace: true });
      return '';
    } catch (error) {
      return errorText(error);
    }
  }
  return <UserLoginPage onLogin={signIn} adminOnly={adminOnly} />;
}

function PageHeading({ title, description }) {
  return <header className="page-heading"><div><span className="eyebrow">ADMINISTRATION</span><h1>{title}</h1><p>{description}</p></div></header>;
}

function EventPublishFields({ eventDraft, setEventDraft, onUploadImage }) {
  return <>
    <div className="publish-event-fields">
      <label>Event title<input value={eventDraft.title} onChange={(event) => setEventDraft((current) => ({ ...current, title: event.target.value }))} maxLength={140} required /></label>
      <label>Event date and time<input type="datetime-local" value={eventDraft.startsAt} onChange={(event) => setEventDraft((current) => ({ ...current, startsAt: event.target.value }))} /></label>
      <label>Location<input value={eventDraft.location} onChange={(event) => setEventDraft((current) => ({ ...current, location: event.target.value }))} maxLength={240} /></label>
      <label>Registration URL<input type="url" value={eventDraft.registrationUrl} onChange={(event) => setEventDraft((current) => ({ ...current, registrationUrl: event.target.value }))} placeholder="https://" /></label>
      <label className="publish-event-featured">Featured image<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => { void onUploadImage(event.target.files?.[0], (image) => setEventDraft((current) => ({ ...current, image }))); }} />{eventDraft.image && <img src={backendUrl(eventDraft.image)} alt="Featured event preview" />}</label>
      <label>Publishing status<select value={eventDraft.status} onChange={(event) => setEventDraft((current) => ({ ...current, status: event.target.value }))}><option value="draft">Save as draft</option><option value="published">Publish event</option></select></label>
      <label className="publish-event-upcoming"><input type="checkbox" checked={eventDraft.isUpcoming} onChange={(event) => setEventDraft((current) => ({ ...current, isUpcoming: event.target.checked }))} />Show in upcoming events</label>
      <label className="publish-event-carousel"><input type="checkbox" checked={eventDraft.showInCarousel} onChange={(event) => setEventDraft((current) => ({ ...current, showInCarousel: event.target.checked }))} /><span><strong>Feature in home carousel</strong><small>Uses the event title, featured image, and an article snippet. The carousel keeps four newest items across Events, Videos, and Gallery.</small></span></label>
    </div>
    <label className="publish-event-legacy-description">Legacy description <span>Used for older events without article blocks</span><textarea value={eventDraft.description} onChange={(event) => setEventDraft((current) => ({ ...current, description: event.target.value }))} rows={3} maxLength={12000} /></label>
    <section className="publish-event-article" aria-labelledby="publish-event-article-title">
      <div><span className="eyebrow">ARTICLE CONTENT</span><h3 id="publish-event-article-title">Build the event article</h3><p>Add as many paragraphs, headings, lists, images, links, or quotes as this event needs.</p></div>
      <EventContentEditor blocks={eventDraft.contentBlocks} onChange={(contentBlocks) => setEventDraft((current) => ({ ...current, contentBlocks }))} onUploadImage={onUploadImage} />
    </section>
  </>;
}

function Admin({ profilePage = false }) {
  const { user, setUser } = useAuth();
  const [kind, setKind] = useState('event');
  const [profileComposerOpen, setProfileComposerOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [heading, setHeading] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]);
  const [carousel, setCarousel] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState('0');
  const [profileName, setProfileName] = useState(user.name);
  const [eventDraft, setEventDraft] = useState(emptyAdminEvent);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const publishDialog = useRef(null);
  useEffect(() => {
    if (profilePage && profileComposerOpen && publishDialog.current && !publishDialog.current.open) {
      publishDialog.current.showModal();
    }
  }, [profilePage, profileComposerOpen]);
  function selectKind(value) {
    setKind(value);
    setFiles([]);
    setCarousel(false);
    setVideoUrl('');
  }
  function openProfileComposer(value) {
    setKind(value);
    setFiles([]);
    setCarousel(false);
    setVideoUrl('');
    if (value === 'event') setEventDraft(emptyAdminEvent());
    setProfileComposerOpen(true);
  }

  async function uploadEventImage(file, onUploaded) {
    if (!file) return;
    const body = new FormData();
    body.append('image', file);
    try {
      const { data } = await api.post('/api/admin/event-images', body);
      onUploaded(data.image);
      setError('');
    } catch (requestError) {
      setError(errorText(requestError));
    }
  }
  async function saveProfile(event) {
    event.preventDefault();
    const body = new FormData();
    body.append('name', profileName);
    if (profilePhoto) body.append('photo', profilePhoto);
    try {
      const { data } = await api.patch('/api/profile', body);
      setUser(data.user);
      setProfilePhoto(null);
      setStatus('Profile updated.');
      setError('');
    } catch (requestError) {
      setError(errorText(requestError));
    }
  }
  async function publish(event) {
    event.preventDefault();
    if (kind === 'event') {
      setBusy(true);
      setStatus('');
      setError('');
      try {
        const payload = {
          ...eventDraft,
          startsAt: eventDraft.startsAt ? new Date(eventDraft.startsAt).toISOString() : null
        };
        await api.post('/api/admin/events', payload);
        setEventDraft(emptyAdminEvent());
        if (profilePage) {
          publishDialog.current?.close();
          setProfileComposerOpen(false);
        }
        setStatus(eventDraft.status === 'draft' ? 'Event draft saved.' : 'Event published.');
      } catch (requestError) {
        setError(errorText(requestError));
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!files.length && !(kind === 'video' && videoUrl.trim())) {
      setError('Choose media to publish.');
      return;
    }
    const body = new FormData();
    body.append('kind', kind);
    body.append('heading', heading);
    body.append('description', description);
    body.append('showInCarousel', String(carousel));
    body.append('carouselIndex', carouselIndex);
    body.append('videoUrl', videoUrl.trim());
    files.forEach((file) => body.append('media', file));
    setBusy(true);
    setStatus('');
    setError('');
    try {
      await api.post('/api/posts', body);
      setHeading('');
      setDescription('');
      setFiles([]);
      setCarousel(false);
      setCarouselIndex('0');
      setVideoUrl('');
      if (profilePage) {
        publishDialog.current?.close();
        setProfileComposerOpen(false);
      }
      event.target.reset();
      setStatus('Published. Your update is now live.');
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setBusy(false);
    }
  }
  const maxFiles = kind === 'gallery' ? 500 : 1;
  return (
    <>
      {profilePage && <SiteHeader page="profile" admin />}
      {!profilePage && <PageHeading
        title={profilePage ? 'Manage profile' : 'Publish an update'}
        description={profilePage ? 'Update your administrator profile.' : 'Share events, videos and photo albums with the community.'}
      />}
      <div className={`admin-layout ${profilePage ? 'admin-profile-page' : 'admin-publish-page'}`}>
        <section className={`admin-profile admin-section${profilePage ? ' admin-profile-editor' : ''}`}>
          <form className="profile-form" onSubmit={saveProfile}>
            <div className="profile-photo-row"><Avatar user={{ ...user, photo: profilePhoto ? URL.createObjectURL(profilePhoto) : user.photo }} /><input id="profile-photo" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => setProfilePhoto(event.target.files?.[0] || null)} /><label className="profile-photo-upload button button-light" htmlFor="profile-photo"><Upload size={15} />Change profile photo</label></div>
            <label htmlFor="admin-name">Display name</label><input id="admin-name" value={profileName} onChange={(event) => setProfileName(event.target.value)} maxLength={80} required />
            <label>Email address</label><div className="readonly-field">{user.email}</div>
            <button className="button button-dark" type="submit">Save profile <Check size={16} /></button>
          </form>
          {profilePage && status && <p className="success-message" role="status">{status}</p>}
          {profilePage && error && <p className="form-message" role="alert">{error}</p>}
          {!profilePage && <div className="admin-role-note"><ShieldCheck size={16} /><span>Admin publishing access</span></div>}
        </section>
        {profilePage ? <>
        <section className="admin-profile-publishing admin-section">
          <div className="admin-section-heading"><span className="admin-section-icon"><Upload size={19} /></span><div><h2>Share with the community</h2><p>Choose what you want to publish. Your update will appear in the relevant community feed.</p></div></div>
          <div className="admin-profile-publish-actions">
            <button className="button button-dark" type="button" onClick={() => openProfileComposer('event')}>Create Event</button>
            <button className="button button-dark" type="button" onClick={() => openProfileComposer('video')}>Add Video</button>
            <button className="button button-dark" type="button" onClick={() => openProfileComposer('gallery')}>Create Gallery</button>
          </div>
        </section>
        <dialog
          ref={publishDialog}
          className="admin-compose-dialog"
          onClose={() => setProfileComposerOpen(false)}
          onClick={(event) => {
            if (event.target === publishDialog.current) publishDialog.current.close();
          }}
        >
        <section className={`admin-publish admin-section${kind === 'event' ? ' publish-event-section' : ''}`}>
          <button className="admin-compose-close" type="button" aria-label="Close publishing dialog" onClick={() => publishDialog.current?.close()}><X size={19} /></button>
          <div className="admin-section-heading"><span className="admin-section-icon"><Upload size={19} /></span><div><h2>{kind === 'event' ? 'Create an event' : 'Share an update'}</h2><p>{kind === 'event' ? 'Add event details and build the article from blocks.' : 'Publish content for the CCI community.'}</p></div></div>
          {profilePage && error && <p className="form-message" role="alert">{error}</p>}
          <div className="post-type-switch" role="tablist" aria-label="Post type">
            {[['event', 'Event', CalendarDays], ['video', 'Video', Play], ['gallery', 'Images', Image]].map(([value, label, Icon]) => <button type="button" key={value} role="tab" aria-selected={kind === value} className={kind === value ? 'selected' : ''} onClick={() => selectKind(value)}><Icon size={16} />{label}</button>)}
          </div>
          <form className={`publish-form${kind === 'event' ? ' publish-event-form' : ''}`} onSubmit={publish}>
            {kind === 'event' && <EventPublishFields eventDraft={eventDraft} setEventDraft={setEventDraft} onUploadImage={uploadEventImage} />}
            {kind !== 'video' && kind !== 'event' && <><label htmlFor="post-heading">Heading</label><input id="post-heading" value={heading} onChange={(event) => setHeading(event.target.value)} placeholder="Album title" maxLength={140} required /><label htmlFor="post-description">Description <span>Optional</span></label><textarea id="post-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="A few words about this update" rows={3} maxLength={1200} /></>}
            {kind === 'video' && <><label htmlFor="post-video-url">Video URL <span>Optional if you upload a file</span></label><input id="post-video-url" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} placeholder="https://example.com/video.mp4" type="url" /></>}
            {kind !== 'event' && <>
              <label htmlFor="post-media">{kind === 'video' ? 'Video file' : 'Images'} <span>{kind === 'gallery' ? 'Up to 500 images' : 'One file'}</span></label>
              <input id="post-media" className="file-input" type="file" accept={kind === 'video' ? 'video/mp4,video/webm,video/quicktime' : 'image/png,image/jpeg,image/webp,image/gif'} multiple={kind === 'gallery'} onChange={(event) => { setFiles(Array.from(event.target.files || []).slice(0, maxFiles)); setCarouselIndex('0'); }} required={kind !== 'video' || !videoUrl.trim()} />
              <small className="field-hint">{kind === 'video' ? 'MP4, WebM or MOV · up to 25 MB' : 'JPG, PNG, WebP or GIF · up to 25 MB per file'}</small>
              {files.length > 0 && <div className="selected-files">{files.map((file, index) => <span key={`${file.name}-${index}`}><Check size={14} />{file.name}</span>)}</div>}
            </>}
            {kind === 'gallery' && <><label className="carousel-option"><input type="checkbox" checked={carousel} onChange={(event) => setCarousel(event.target.checked)} /><span><strong>Feature in home carousel</strong><small>Feature one selected photo in the carousel.</small></span></label>{carousel && files.length > 1 && <><label htmlFor="carousel-image">Carousel image</label><select id="carousel-image" value={carouselIndex} onChange={(event) => setCarouselIndex(event.target.value)}>{files.map((file, index) => <option key={`${file.name}-${index}`} value={index}>{file.name}</option>)}</select></>}</>}
            <button className="button button-dark publish-button" disabled={busy}>{busy ? 'Saving…' : kind === 'event' ? eventDraft.status === 'draft' ? 'Save draft' : 'Publish event' : 'Publish update'}<ArrowRight size={16} /></button>
          </form>
          {!profilePage && status && <p className="success-message" role="status">{status}</p>}
          {!profilePage && error && <p className="form-message" role="alert">{error}</p>}
          {profilePage && <div className="admin-compose-actions"><button className="admin-compose-cancel" type="button" onClick={() => { publishDialog.current?.close(); setProfileComposerOpen(false); }}>Cancel</button></div>}
        </section>
        </dialog></> : <section className="admin-publish admin-section">
          <div className="admin-section-heading"><span className="admin-section-icon"><Upload size={19} /></span><div><h2>Share an update</h2><p>Publish content for the CCI community.</p></div></div>
          <div className="post-type-switch" role="tablist" aria-label="Post type">
            {[['event', 'Event', CalendarDays], ['video', 'Video', Play], ['gallery', 'Images', Image]].map(([value, label, Icon]) => <button type="button" key={value} role="tab" aria-selected={kind === value} className={kind === value ? 'selected' : ''} onClick={() => selectKind(value)}><Icon size={16} />{label}</button>)}
          </div>
          <form className={`publish-form${kind === 'event' ? ' publish-event-form' : ''}`} onSubmit={publish}>
            {kind === 'event' && <EventPublishFields eventDraft={eventDraft} setEventDraft={setEventDraft} onUploadImage={uploadEventImage} />}
            {kind === 'gallery' && <><label htmlFor="post-heading">Album title</label><input id="post-heading" value={heading} onChange={(event) => setHeading(event.target.value)} placeholder="Album title" maxLength={140} required /><label htmlFor="post-description">Description <span>Optional</span></label><textarea id="post-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="A few words about this update" rows={3} maxLength={1200} /></>}
            {kind === 'video' && <><label htmlFor="post-video-url">Video URL <span>Optional if you upload a file</span></label><input id="post-video-url" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} placeholder="https://example.com/video.mp4" type="url" /></>}
            {kind !== 'event' && <>
              <label htmlFor="post-media">{kind === 'video' ? 'Video file' : 'Images'} <span>{kind === 'gallery' ? 'Up to 500 images' : 'One file'}</span></label>
              <input id="post-media" className="file-input" type="file" accept={kind === 'video' ? 'video/mp4,video/webm,video/quicktime' : 'image/png,image/jpeg,image/webp,image/gif'} multiple={kind === 'gallery'} onChange={(event) => { setFiles(Array.from(event.target.files || []).slice(0, maxFiles)); setCarouselIndex('0'); }} required={kind !== 'video' || !videoUrl.trim()} />
              <small className="field-hint">{kind === 'video' ? 'MP4, WebM or MOV · up to 25 MB' : 'JPG, PNG, WebP or GIF · up to 25 MB per file'}</small>
              {files.length > 0 && <div className="selected-files">{files.map((file, index) => <span key={`${file.name}-${index}`}><Check size={14} />{file.name}</span>)}</div>}
            </>}
            {kind === 'gallery' && <><label className="carousel-option"><input type="checkbox" checked={carousel} onChange={(event) => setCarousel(event.target.checked)} /><span><strong>Feature in home carousel</strong><small>Feature one selected photo in the carousel.</small></span></label>{carousel && files.length > 1 && <><label htmlFor="carousel-image">Carousel image</label><select id="carousel-image" value={carouselIndex} onChange={(event) => setCarouselIndex(event.target.value)}>{files.map((file, index) => <option key={`${file.name}-${index}`} value={index}>{file.name}</option>)}</select></>}</>}
            <button className="button button-dark publish-button" disabled={busy}>{busy ? 'Saving…' : kind === 'event' ? eventDraft.status === 'draft' ? 'Save draft' : 'Publish event' : 'Publish update'}<ArrowRight size={16} /></button>
          </form>
          {!profilePage && status && <p className="success-message" role="status">{status}</p>}
          {!profilePage && error && <p className="form-message" role="alert">{error}</p>}
        </section>}
      </div>
    </>
  );
}

function Avatar({ user }) {
  return <span className="avatar">{user?.photo ? <img src={backendUrl(user.photo)} alt="" /> : user?.name?.trim().charAt(0).toUpperCase() || 'C'}</span>;
}
