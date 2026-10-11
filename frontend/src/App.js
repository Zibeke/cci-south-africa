import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext, useAuth } from './context/AuthContext';
import UserPages from './pages/users';
import AdminPages from './pages/admin';
import CommunityPage, { SiteHeader } from './pages/CommunityPage';
import UserLoginPage from './pages/users/login';
import Landing from './pages/Landing';
import {
  ArrowRight, CalendarDays, Check, Image, Play, ShieldCheck, Upload, UserRound, X
} from 'lucide-react';

const api = axios.create({ withCredentials: true });

function errorText(error) {
  return error.response?.data?.message || 'We could not complete that request. Please try again.';
}

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
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
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
    setProfileComposerOpen(true);
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
        <section className="admin-profile admin-section">
          <div className="admin-section-heading"><span className="admin-section-icon"><UserRound size={19} /></span><div><h2>Manage profile</h2><p>These details appear alongside your posts.</p></div></div>
          <form className="profile-form" onSubmit={saveProfile}>
            <div className="profile-photo-row"><Avatar user={{ ...user, photo: profilePhoto ? URL.createObjectURL(profilePhoto) : user.photo }} /><label htmlFor="profile-photo">Update photo</label><input id="profile-photo" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => setProfilePhoto(event.target.files?.[0] || null)} /></div>
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
            <button className="button button-dark" type="button" onClick={() => openProfileComposer('event')}><CalendarDays size={16} />Post Event</button>
            <button className="button button-dark" type="button" onClick={() => openProfileComposer('video')}><Play size={16} />Post Video</button>
            <button className="button button-dark" type="button" onClick={() => openProfileComposer('gallery')}><Image size={16} />Post Gallery</button>
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
        <section className="admin-publish admin-section">
          <button className="admin-compose-close" type="button" aria-label="Close publishing dialog" onClick={() => publishDialog.current?.close()}><X size={19} /></button>
          <div className="admin-section-heading"><span className="admin-section-icon"><Upload size={19} /></span><div><h2>Share an update</h2><p>Publish content for the CCI community.</p></div></div>
          <div className="post-type-switch" role="tablist" aria-label="Post type">
            {[['event', 'Event', CalendarDays], ['video', 'Video', Play], ['gallery', 'Images', Image]].map(([value, label, Icon]) => <button type="button" key={value} role="tab" aria-selected={kind === value} className={kind === value ? 'selected' : ''} onClick={() => selectKind(value)}><Icon size={16} />{label}</button>)}
          </div>
          <form className="publish-form" onSubmit={publish}>
            {kind !== 'video' && <><label htmlFor="post-heading">Heading</label><input id="post-heading" value={heading} onChange={(event) => setHeading(event.target.value)} placeholder={kind === 'event' ? 'Event name' : 'Album title'} maxLength={140} required /><label htmlFor="post-description">Description <span>Optional</span></label><textarea id="post-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="A few words about this update" rows={3} maxLength={1200} /></>}
            {kind === 'video' && <><label htmlFor="post-video-url">Video URL <span>Optional if you upload a file</span></label><input id="post-video-url" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} placeholder="https://example.com/video.mp4" type="url" /></>}
            <label htmlFor="post-media">{kind === 'video' ? 'Video file' : kind === 'gallery' ? 'Images' : 'Event image'} <span>{kind === 'gallery' ? 'Up to 500 images' : 'One file'}</span></label>
            <input id="post-media" className="file-input" type="file" accept={kind === 'video' ? 'video/mp4,video/webm,video/quicktime' : 'image/png,image/jpeg,image/webp,image/gif'} multiple={kind === 'gallery'} onChange={(event) => { setFiles(Array.from(event.target.files || []).slice(0, maxFiles)); setCarouselIndex('0'); }} required={kind !== 'video' || !videoUrl.trim()} />
            <small className="field-hint">{kind === 'video' ? 'MP4, WebM or MOV · up to 25 MB' : 'JPG, PNG, WebP or GIF · up to 25 MB per file'}</small>
            {files.length > 0 && <div className="selected-files">{files.map((file, index) => <span key={`${file.name}-${index}`}><Check size={14} />{file.name}</span>)}</div>}
            {kind !== 'video' && <><label className="carousel-option"><input type="checkbox" checked={carousel} onChange={(event) => setCarousel(event.target.checked)} /><span><strong>Feature in home carousel</strong><small>{kind === 'event' ? 'Show the image with the event heading and description.' : 'Feature one selected photo in the carousel.'}</small></span></label>{carousel && kind === 'gallery' && files.length > 1 && <><label htmlFor="carousel-image">Carousel image</label><select id="carousel-image" value={carouselIndex} onChange={(event) => setCarouselIndex(event.target.value)}>{files.map((file, index) => <option key={`${file.name}-${index}`} value={index}>{file.name}</option>)}</select></>}</>}
            <button className="button button-dark publish-button" disabled={busy}>{busy ? 'Publishing…' : 'Publish update'}<ArrowRight size={16} /></button>
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
          <form className="publish-form" onSubmit={publish}>
            {kind !== 'video' && <><label htmlFor="post-heading">Heading</label><input id="post-heading" value={heading} onChange={(event) => setHeading(event.target.value)} placeholder={kind === 'event' ? 'Event name' : 'Album title'} maxLength={140} required /><label htmlFor="post-description">Description <span>Optional</span></label><textarea id="post-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="A few words about this update" rows={3} maxLength={1200} /></>}
            {kind === 'video' && <><label htmlFor="post-video-url">Video URL <span>Optional if you upload a file</span></label><input id="post-video-url" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} placeholder="https://example.com/video.mp4" type="url" /></>}
            <label htmlFor="post-media">{kind === 'video' ? 'Video file' : kind === 'gallery' ? 'Images' : 'Event image'} <span>{kind === 'gallery' ? 'Up to 500 images' : 'One file'}</span></label>
            <input id="post-media" className="file-input" type="file" accept={kind === 'video' ? 'video/mp4,video/webm,video/quicktime' : 'image/png,image/jpeg,image/webp,image/gif'} multiple={kind === 'gallery'} onChange={(event) => { setFiles(Array.from(event.target.files || []).slice(0, maxFiles)); setCarouselIndex('0'); }} required={kind !== 'video' || !videoUrl.trim()} />
            <small className="field-hint">{kind === 'video' ? 'MP4, WebM or MOV · up to 25 MB' : 'JPG, PNG, WebP or GIF · up to 25 MB per file'}</small>
            {files.length > 0 && <div className="selected-files">{files.map((file, index) => <span key={`${file.name}-${index}`}><Check size={14} />{file.name}</span>)}</div>}
            {kind !== 'video' && <><label className="carousel-option"><input type="checkbox" checked={carousel} onChange={(event) => setCarousel(event.target.checked)} /><span><strong>Feature in home carousel</strong><small>{kind === 'event' ? 'Show the image with the event heading and description.' : 'Feature one selected photo in the carousel.'}</small></span></label>{carousel && kind === 'gallery' && files.length > 1 && <><label htmlFor="carousel-image">Carousel image</label><select id="carousel-image" value={carouselIndex} onChange={(event) => setCarouselIndex(event.target.value)}>{files.map((file, index) => <option key={`${file.name}-${index}`} value={index}>{file.name}</option>)}</select></>}</>}
            <button className="button button-dark publish-button" disabled={busy}>{busy ? 'Publishing…' : 'Publish update'}<ArrowRight size={16} /></button>
          </form>
          {!profilePage && status && <p className="success-message" role="status">{status}</p>}
          {!profilePage && error && <p className="form-message" role="alert">{error}</p>}
        </section>}
      </div>
    </>
  );
}

function Avatar({ user }) {
  return <span className="avatar">{user?.photo ? <img src={user.photo} alt="" /> : user?.name?.trim().charAt(0).toUpperCase() || 'C'}</span>;
}
