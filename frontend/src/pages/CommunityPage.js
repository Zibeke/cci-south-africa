import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Captions, Check, ChevronDown, LoaderCircle, Maximize, Pause, PictureInPicture2, Play, RectangleHorizontal,
  Repeat, Settings2, Volume2, VolumeX
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL, api, backendUrl } from '../api';
import {
  ChatPage as DataChatPage, EventsPage as DataEventsPage, GalleryPage as DataGalleryPage, ProfileAvatar
} from './PortalPages';

const albums = [
  { id: 'champions', title: 'Dinner of Champions', cover: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=900&q=85', photos: ['photo-1511795409834-ef04bbd61622', 'photo-1511578314322-379afb476865', 'photo-1527529482837-4698179dc6ce'] },
  { id: 'heritage', title: 'Heritage Day Cook-Off', cover: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=900&q=85', photos: ['photo-1511578314322-379afb476865', 'photo-1531058020387-3be344556be6', 'photo-1511632765486-a01980e01a18'] },
  { id: 'people', title: 'People of CCI', cover: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=900&q=85', photos: ['photo-1521737711867-e3b97375f902', 'photo-1528605248644-14dd04022da1', 'photo-1521737604893-d14cc237f11d'] },
  { id: 'community', title: 'Community Impact', cover: 'https://images.unsplash.com/photo-1531206715517-5c0ba140b2b8?auto=format&fit=crop&w=900&q=85', photos: ['photo-1531206715517-5c0ba140b2b8', 'photo-1469571486292-0ba58a3f068b', 'photo-1511632765486-a01980e01a18'] }
];

const cciBenefits = [
  {
    title: 'Bosch Car Service',
    summary: 'An exclusive 15% discount on selected vehicle services for CCI employees.',
    description: 'CCI employees can now enjoy an exclusive 15% discount on vehicle servicing, maintenance, diagnostics, and repairs at participating RMS Automotive Group Bosch Car Service Centres.',
    image: 'https://connect.cci-digital.cloud/wp-content/uploads/2026/06/carsss-01-01.webp',
    alt: 'Bosch Car Service loyalty deal for CCI employees'
  },
  {
    title: 'Renault',
    summary: 'A valuable loyalty deal secured exclusively for CCI employees.',
    description: 'At CCI we care about you and we love making your life a little easier. So, we are excited to share this valuable loyalty deal secured exclusively for our employees in partnership with Renault Durban CBD.',
    image: 'https://connect.cci-digital.cloud/wp-content/uploads/2026/04/Untitled-2-01-1536x865.webp',
    alt: 'Renault loyalty deal for CCI employees'
  },
  {
    title: 'Virgin Active',
    summary: 'CCI’s new Workplace Wellness Partner.',
    description: 'We’re excited to announce that CCI has partnered with Virgin Active SA as our new Workplace Wellness Partner.',
    image: 'https://connect.cci-digital.cloud/wp-content/uploads/2026/04/Untitled-4-01-1-scaled.png',
    alt: 'Virgin Active workplace wellness partnership'
  },
  {
    title: 'Vodacom',
    summary: 'Enjoy discounted deals through our latest partnership.',
    description: 'Enjoy discounted deals through our latest partnership.',
    image: 'https://th.bing.com/th/id/OIP.crahn0HYdZ6-PImm7qqsZQHaE8?w=242&h=180&c=7&r=0&o=7&pid=1.7&rm=3',
    alt: 'Vodacom logo',
    imageFit: 'contain',
    contact: 'onlineapprovals@coactivate.co.za'
  }
];

const cciFaqs = [
  {
    question: 'What does CCI do?',
    answer: 'CCI is an Africa-focused business process outsourcing organisation that partners with international clients to deliver customer experiences through its delivery locations across the continent.'
  },
  {
    question: 'What is CareerBox?',
    answer: 'CareerBox is CCI’s impact-sourcing initiative, providing skills training and work opportunities for young people from disadvantaged backgrounds.'
  },
  {
    question: 'What can I do on CCI Connect?',
    answer: 'Colleagues can follow community updates and events, browse shared photo galleries, and start direct conversations with one another.'
  },
  {
    question: 'Which loyalty deals are featured?',
    answer: 'The current offers shown here include Bosch Car Service, Renault Durban CBD, Virgin Active SA, and Vodacom. Open a deal card for its details.'
  },
  {
    question: 'Who can help with the Vodacom deal?',
    answer: 'For assistance with the Vodacom offer, email onlineapprovals@coactivate.co.za.'
  }
];

export default function CommunityPage({ page, admin = false, onLogin, eventId, adminOnly = false }) {
  const { user } = useAuth();
  if (page === 'login') return <LoginPage onLogin={onLogin} adminOnly={adminOnly} />;
  const isAdmin = admin || user?.role === 'admin';
  return (
    <>
      {page !== 'chat' && !(page === 'events' && eventId) && <SiteHeader page={page} admin={isAdmin} />}
      {page === 'chat' && <DataChatPage admin={isAdmin} />}
      {page === 'events' && <DataEventsPage admin={isAdmin} eventId={eventId} />}
      {page === 'gallery' && <DataGalleryPage />}
      {page === 'my-cci' && <MyCciPage />}
      {(page === 'home' || page === 'index') && <HomePage landing={page === 'index'} admin={isAdmin} user={user} />}
    </>
  );
}

export function SiteHeader({ page, admin }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const landing = page === 'index';
  const base = landing ? '' : admin ? '/admin' : '';
  const homePath = landing ? '/' : `${base}/home`;
  const visibleNotifications = notifications.filter((item) => !item.isRead).length
    ? notifications.filter((item) => !item.isRead).slice(0, 3)
    : notifications.slice(0, 3);

  useEffect(() => {
    if (landing || !user) return undefined;
    let active = true;
    const refreshBadges = async () => {
      try {
        const [notificationResponse, conversationResponse, unreadResponse] = await Promise.all([
          api.get('/api/notifications'),
          api.get('/api/chat/conversations'),
          api.get('/api/notifications/unread-count')
        ]);
        if (!active) return;
        setNotifications(notificationResponse.data);
        setChatUnreadCount(conversationResponse.data.reduce((total, item) => total + Number(item.unreadCount || 0), 0));
        setUnreadNotificationCount(unreadResponse.data.count);
      } catch (error) {
        if (active) console.error('Unable to load header notification counts.', error);
      }
    };
    void refreshBadges();
    const refreshTimer = window.setInterval(() => { void refreshBadges(); }, 30000);
    window.addEventListener('cci:badges-refresh', refreshBadges);
    const socket = io(API_BASE_URL || window.location.origin, { withCredentials: true });
    socket.on('notification:new', () => { void refreshBadges(); });
    socket.on('message:new', (message) => {
      const receiverId = typeof message.receiverId === 'string' ? message.receiverId : message.receiverId?._id;
      const senderId = typeof message.senderId === 'string' ? message.senderId : message.senderId?._id;
      if (receiverId === user.id && senderId !== user.id) void refreshBadges();
    });
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      window.removeEventListener('cci:badges-refresh', refreshBadges);
      socket.disconnect();
    };
  }, [landing, user]);

  async function markNotificationRead(notification) {
    if (notification.isRead) return true;
    try {
      await api.patch(`/api/notifications/${notification._id}/read`);
      setNotifications((items) => items.map((item) => item._id === notification._id ? { ...item, isRead: true } : item));
      setUnreadNotificationCount((count) => Math.max(0, count - 1));
      window.dispatchEvent(new Event('cci:badges-refresh'));
      return true;
    } catch (error) {
      console.error('Unable to mark notification as read.', error);
      return false;
    }
  }

  async function openHeaderNotification(notification) {
    if (!await markNotificationRead(notification)) return;
    setNotificationsOpen(false);
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

  async function logout() {
    try {
      await api.post('/api/auth/logout');
      setUser(null);
      setMenuOpen(false);
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Unable to sign out.', error);
    }
  }

  return (
    <header className="site-header">
      <div className="container">
        <nav className="navigation">
          <Link to={homePath} className="logo">
            <img src={backendUrl('/original-site/images/logo2.png')} alt="CCI South Africa" className="logo-img" />
          </Link>
          <ul className={`nav_menu${menuOpen ? ' active' : ''}`}>
            <li className="nav_list"><Link to={homePath} className={`nav_link${page === 'home' || landing ? ' active' : ''}`}>Home</Link></li>
            {!landing && <li className="nav_list"><Link to={`${base}/chat`} className={`nav_link${page === 'chat' ? ' active' : ''}`} aria-label={`Chat${chatUnreadCount ? `, ${chatUnreadCount} unread messages` : ''}`}><span className="nav_icon_badge"><i className="fa-regular fa-comments" aria-hidden="true" />{chatUnreadCount > 0 && <span className="count_badge" aria-hidden="true">{chatUnreadCount}</span>}</span><span>Chat</span></Link></li>}
            <li className={`nav_list nav_list_menu${aboutOpen ? ' active' : ''}`}>
              <button className="nav_link mega-menu-trigger" type="button" aria-expanded={aboutOpen} onClick={() => setAboutOpen(!aboutOpen)}><span>About Us</span><i className="fa-solid fa-chevron-down" /></button>
              <div className="mega_menu"><div className="mega_menu_inner">
                <div className="mega_feature"><div className="mega_feature_image"><img src="https://th.bing.com/th/id/OIP.4CIgNsjby1jn6hwK5O6OIQHaEo?w=261&h=180&c=7&r=0&o=7&pid=1.7&rm=3" alt="People at work" /></div><div className="mega_feature_content"><h3>People at the heart of what we do.</h3><p>Discover CCI, our people, our culture and the communities we work with.</p></div></div>
                <div className="mega_content">
                  <div className="mega_group"><h3>About CCI</h3><a href="#about" className="mega_link"><i className="fa-solid fa-circle-question" /><span>Why CCI</span></a><a href="#about" className="mega_link"><i className="fa-solid fa-hand-holding-heart" /><span>Creating an Impact</span></a><a href="#locations" className="mega_link"><i className="fa-solid fa-location-dot" /><span>Our Sites</span></a><a href="#about" className="mega_link"><i className="fa-solid fa-people-group" /><span>Community</span></a></div>
                  <div className="mega_group"><h3>Our People</h3><a href="https://connectapps.ccisouthafrica.com/ccicareers/" className="mega_link"><i className="fa-solid fa-user-plus" /><span>Join Our Team</span></a><a href="https://connectapps.ccisouthafrica.com/ccicareers/" className="mega_link"><i className="fa-solid fa-briefcase" /><span>Careers</span></a><a href="#about" className="mega_link"><i className="fa-solid fa-circle-info" /><span>FAQs</span></a><a href="#about" className="mega_link"><i className="fa-regular fa-envelope" /><span>Contact Us</span></a></div>
                  <div className="mega_group my_cci_group"><div className="group_heading"><h3>My CCI</h3><span className="internal_badge">Internal</span></div><p className="group_intro">Access employee services, resources and information.</p><div className="my_cci_links"><a href="#about"><i className="fa-solid fa-file-lines" /><span>Policies &amp; Procedures</span></a><a href="#about"><i className="fa-solid fa-link" /><span>Useful Links</span></a>{user ? <a href="https://online.sage.co.za/U25143#/signin" target="_blank" rel="noopener noreferrer"><i className="fa-solid fa-arrow-up-right-from-square" /><span>Sage ESS</span></a> : <Link to="/login"><i className="fa-solid fa-arrow-up-right-from-square" /><span>Sage ESS</span></Link>}<Link to={landing ? '/login' : `${base}/gallery`}><i className="fa-regular fa-image" /><span>Gallery</span></Link></div><Link to={landing ? '/login' : '/my-cci'} className="my_cci_button"><span>Open My CCI</span><i className="fa-solid fa-arrow-right" /></Link></div>
                </div>
              </div></div>
            </li>
            <li className="nav_list"><Link to={landing ? '/login' : '/my-cci'} className={`nav_link${page === 'my-cci' ? ' active' : ''}`}>My CCI</Link></li>
            <li className="nav_list"><Link to={landing ? '/login' : `${base}/gallery`} className={`nav_link${page === 'gallery' ? ' active' : ''}`}>Gallery</Link></li>
            <li className="nav_list"><Link to={landing ? '/login' : `${base}/events`} className={`nav_link${page === 'events' ? ' active' : ''}`}>Events</Link></li>
            <li className="nav_list landing-auth-mobile">{user
              ? <button className="login-button landing-auth-action" type="button" onClick={logout}><i className="fa-solid fa-arrow-right-from-bracket" aria-hidden="true" /><span>Log out</span></button>
              : <button className="login-button landing-auth-action" type="button" onClick={() => navigate('/login')}><i className="fa-solid fa-arrow-right-to-bracket" aria-hidden="true" /><span>Log in</span></button>}</li>
          </ul>
          <div className="nav_action">
            {!landing && <>
            <Link className="utility_chat" to={`${base}/chat`} aria-label={`Chat${chatUnreadCount ? `, ${chatUnreadCount} unread messages` : ''}`}><span className="utility_icon_badge"><i className="fa-regular fa-comments" />{chatUnreadCount > 0 && <span className="count_badge">{chatUnreadCount > 7 ? '7+' : chatUnreadCount}</span>}</span></Link>
            <button className="header_icon notification_button" type="button" aria-label={`Notifications${unreadNotificationCount ? `, ${unreadNotificationCount} unread` : ''}`} aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen(!notificationsOpen)}><span className="utility_icon_badge"><i className="fa-regular fa-bell" />{unreadNotificationCount > 0 && <span className="count_badge">{unreadNotificationCount > 7 ? '7+' : unreadNotificationCount}</span>}</span></button>
            {notificationsOpen && <section className="notification-popover" aria-label="Notifications"><header>Notifications</header><div className="notification-popover-list">{visibleNotifications.length ? visibleNotifications.map((notification) => <button className="notification-item" key={notification._id} type="button" onClick={() => { void openHeaderNotification(notification); }}><strong>{notification.title}</strong><span>{notification.message}</span><time>{new Date(notification.createdAt).toLocaleString()}</time></button>) : <p className="notification-empty">You’re all caught up.</p>}</div></section>}
            </>}
            <form className="header_search" role="search" onSubmit={(event) => event.preventDefault()}><input type="search" name="q" placeholder="Find CCI people & stories" aria-label="Search CCI" /><button type="submit" aria-label="Submit search"><i className="fa-solid fa-magnifying-glass" /></button></form>
            {!landing && <>
            <div className={`profile_menu${profileOpen ? ' active' : ''}`}>
              <button className="profile_button" type="button" aria-expanded={profileOpen} aria-label="Open profile menu" onClick={() => setProfileOpen(!profileOpen)}><ProfileAvatar profile={user} className="profile_image" /><span className="profile_name">{user?.name?.split(' ')[0] || 'Member'}</span><i className="fa-solid fa-chevron-down" /></button>
              <div className="profile_dropdown"><div className="profile_dropdown_header"><ProfileAvatar profile={user} className="profile_dropdown_image" /><div><strong>{user?.name || 'CCI Member'}</strong><span>CCI South Africa</span></div></div><div className="profile_dropdown_divider" />
                {admin && <Link to="/admin/profile" className="profile_dropdown_link"><i className="fa-regular fa-user" /><span>Manage Profile</span></Link>}
                <a href="#account" className="profile_dropdown_link"><i className="fa-solid fa-gear" /><span>Account Settings</span></a><a href="#notifications" className="profile_dropdown_link"><i className="fa-regular fa-bell" /><span>Notifications</span></a><a href="#password" className="profile_dropdown_link"><i className="fa-solid fa-lock" /><span>Change Password</span></a><div className="profile_dropdown_divider" /><button type="button" className="profile_dropdown_link logout_link" onClick={logout}><i className="fa-solid fa-arrow-right-from-bracket" /><span>Logout</span></button>
              </div></div></>}
            {landing && (user
              ? <button className="login-button landing-auth-desktop" type="button" onClick={logout}><i className="fa-solid fa-arrow-right-from-bracket" aria-hidden="true" /><span>Log out</span></button>
              : <Link className="login-button landing-auth-desktop" to="/login"><i className="fa-solid fa-arrow-right-to-bracket" aria-hidden="true" /><span>Log in</span></Link>)}
              <button className="nav_toggle" type="button" aria-label="Open navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><i className="fa-solid fa-bars-staggered" /></button>
          </div>
        </nav>
        <div className="mobile_search_row"><form className="header_search mobile_search" role="search" onSubmit={(event) => event.preventDefault()}><input type="search" name="q" placeholder="Find CCI people & stories" aria-label="Search CCI people and stories" /><button type="submit" aria-label="Submit search"><i className="fa-solid fa-magnifying-glass" /></button></form></div>
      </div>
    </header>
  );
}

function MyCciPage() {
  const benefitsTrack = useRef(null);
  const [expandedDeals, setExpandedDeals] = useState({});
  const [openFaqs, setOpenFaqs] = useState({});
  const [canScrollBenefitsBack, setCanScrollBenefitsBack] = useState(false);
  const [canScrollBenefitsForward, setCanScrollBenefitsForward] = useState(true);

  function updateBenefitControls() {
    const track = benefitsTrack.current;
    if (!track) return;
    setCanScrollBenefitsBack(track.scrollLeft > 1);
    setCanScrollBenefitsForward(track.scrollLeft + track.clientWidth < track.scrollWidth - 1);
  }

  function scrollBenefits(direction) {
    const track = benefitsTrack.current;
    if (!track) return;
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    const card = track.querySelector('.my-cci-benefit-card');
    const gap = Number.parseFloat(window.getComputedStyle(track).columnGap) || 0;
    track.scrollBy({ left: direction * ((card?.getBoundingClientRect().width || track.clientWidth) + gap), behavior });
  }

  useEffect(() => {
    updateBenefitControls();
    window.addEventListener('resize', updateBenefitControls);
    return () => window.removeEventListener('resize', updateBenefitControls);
  }, []);

  return <main className="my-cci-page">
    <section className="my-cci-hero" aria-labelledby="my-cci-title">
      <div className="my-cci-hero-shade" />
      <div className="my-cci-hero-copy">
        <h1 id="my-cci-title">Why CCI?</h1>
      </div>
    </section>

    <section className="my-cci-why" aria-labelledby="why-cci-title">
      <div className="my-cci-content-width my-cci-why-grid">
        <div className="my-cci-video-frame">
          <FeaturedVideo
            item={{ videoUrl: 'https://connect.cci-digital.cloud/wp-content/uploads/2026/04/2026_01_22_10611373677_Edit_Video_EVP-Video_V2_Connect.mp4' }}
            active
            onPlayingChange={() => {}}
            onNext={() => {}}
            poster="https://connect.cci-digital.cloud/wp-content/uploads/2026/04/Top-Header-copy-3-1-760x270.webp"
          />
        </div>
        <div className="my-cci-section-copy">
          <span className="my-cci-eyebrow">People. Purpose. Progress.</span>
          <h2 id="why-cci-title">Why CCI?</h2>
          <p>CCI partners with international clients to deliver customer experiences through a client-centric operating model focused on quality service and long-term partnerships. With delivery locations across the continent, CCI brings multichannel and multilingual capabilities together with a focus on developing people; through CareerBox, the organisation also provides skills training and work opportunities for young people from disadvantaged backgrounds.</p>
          <a className="my-cci-primary-link" href="https://connectapps.ccisouthafrica.com/ccicareers/" target="_blank" rel="noopener noreferrer">Explore careers <ArrowRight aria-hidden="true" /></a>
        </div>
      </div>
    </section>

    <section className="my-cci-benefits" aria-labelledby="my-cci-benefits-title">
      <div className="my-cci-content-width">
        <header className="my-cci-benefits-heading">
          <span className="my-cci-eyebrow">The CCI Advantage</span>
          <h2 id="my-cci-benefits-title">Loyalty Deals</h2>
          <p>Explore current employee offers and partnerships available through CCI.</p>
        </header>
        <div className="my-cci-carousel-controls" aria-label="Benefits carousel controls">
          <button type="button" aria-label="Previous benefits" onClick={() => scrollBenefits(-1)} disabled={!canScrollBenefitsBack}><ArrowLeft aria-hidden="true" /></button>
          <button type="button" aria-label="Next benefits" onClick={() => scrollBenefits(1)} disabled={!canScrollBenefitsForward}><ArrowRight aria-hidden="true" /></button>
        </div>
        <div className="my-cci-benefits-track" ref={benefitsTrack} onScroll={updateBenefitControls} tabIndex="0" role="region" aria-label="CCI employee loyalty deals">
          {cciBenefits.map((benefit, index) => <article className="my-cci-benefit-card" key={benefit.title}>
            <img className={benefit.imageFit === 'contain' ? 'my-cci-loyalty-logo' : ''} src={benefit.image} alt={benefit.alt} loading="lazy" />
            <div className="my-cci-benefit-copy">
              <h3>{benefit.title}</h3>
              <p>{benefit.summary}</p>
              <div id={`my-cci-deal-details-${index}`} className="my-cci-deal-expanded" hidden={!expandedDeals[index]}>
                <p>{index === 0 ? <>CCI employees can now enjoy an <strong>exclusive 15% discount</strong> on vehicle servicing, maintenance, diagnostics, and repairs at participating RMS Automotive Group Bosch Car Service Centres.</> : benefit.description}</p>
                {benefit.contact && <p className="my-cci-deal-contact">For assistance, email <a href={`mailto:${benefit.contact}`}>{benefit.contact}</a>.</p>}
              </div>
              <button className="my-cci-view-more" type="button" aria-expanded={Boolean(expandedDeals[index])} aria-controls={`my-cci-deal-details-${index}`} onClick={() => setExpandedDeals((current) => ({ ...current, [index]: !current[index] }))}>
                {expandedDeals[index] ? 'View less' : 'View more'} <ChevronDown className={expandedDeals[index] ? 'is-expanded' : ''} aria-hidden="true" />
              </button>
            </div>
          </article>)}
        </div>
      </div>
    </section>

    <section className="my-cci-connect" aria-labelledby="my-cci-connect-title">
      <div className="my-cci-content-width my-cci-connect-grid">
        <div className="my-cci-connect-copy">
          <span className="my-cci-eyebrow">Connected. Informed. Together.</span>
          <h2 id="my-cci-connect-title">Introducing CCI Connect</h2>
          <p>CCI Connect brings the CCI community into one place. Colleagues can keep up with company updates and events, browse shared photo galleries, and connect directly with one another.</p>
          <ul className="my-cci-check-list">
            <li><Check aria-hidden="true" />Follow community updates and events</li>
            <li><Check aria-hidden="true" />Browse shared photo galleries</li>
            <li><Check aria-hidden="true" />Start direct conversations with colleagues</li>
          </ul>
          <Link className="my-cci-connect-link" to="/chat">Explore CCI Connect <ArrowRight aria-hidden="true" /></Link>
        </div>
        <figure className="my-cci-connect-visual">
          <FeaturedVideo
            item={{ videoUrl: 'https://connect.cci-digital.cloud/wp-content/uploads/2026/04/2026_03_25_11578837864_Edit_Video_CCI-Video-For-CCI-Connect-2026.mp4' }}
            active
            onPlayingChange={() => {}}
            onNext={() => {}}
            poster="/images/connect.png"
          />
        </figure>
      </div>
    </section>

    <section className="my-cci-faq" aria-labelledby="my-cci-faq-title">
      <div className="my-cci-content-width my-cci-faq-inner">
        <span className="my-cci-eyebrow">Need to know</span>
        <h2 id="my-cci-faq-title">Frequently Asked Questions</h2>
        <div className="my-cci-faq-list">
          {cciFaqs.map((faq, index) => {
            const isOpen = Boolean(openFaqs[index]);
            const answerId = `my-cci-faq-answer-${index + 1}`;
            return <article className={`my-cci-faq-item${isOpen ? ' is-open' : ''}`} key={faq.question}>
              <h3>
                <button className="my-cci-faq-question" type="button" aria-expanded={isOpen} aria-controls={answerId} onClick={() => setOpenFaqs((current) => ({ ...current, [index]: !current[index] }))}>
                  <span>{faq.question}</span>
                  <ChevronDown className="my-cci-faq-icon" aria-hidden="true" />
                </button>
              </h3>
              <div className="my-cci-faq-answer" id={answerId} hidden={!isOpen}>
                <p>{faq.answer}</p>
              </div>
            </article>;
          })}
        </div>
      </div>
    </section>
  </main>;
}

function LoginPage({ onLogin, adminOnly = false }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState(false);
  const [stage, setStage] = useState(adminOnly ? 'email' : 'microsoft');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!adminOnly && new URLSearchParams(window.location.search).get('error') === 'microsoft') {
      setError(true);
      setFeedback('Microsoft sign-in failed. Use your CCI email and local password to continue.');
      setStage('email');
    }
  }, []);

  async function startMicrosoft() {
    if (adminOnly) return;
    try {
      const { data } = await api.get('/api/auth/method');
      if (!data.microsoft) {
        setError(false);
        setFeedback('Microsoft sign-in is unavailable. Continue with your CCI email and password.');
        setStage('email');
        return;
      }
      window.location.assign(backendUrl('/api/auth/microsoft'));
    } catch (requestError) {
      setError(true);
      setFeedback(requestError.response?.data?.message || 'Microsoft sign-in could not be started. Continue with your CCI email and password.');
      setStage('email');
    }
  }

  function continueWithEmail(event) {
    event.preventDefault();
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError(true);
      setFeedback('Enter a valid email address to continue.');
      return;
    }
    setEmail(address);
    setError(false);
    setFeedback('');
    setStage('password');
  }

  async function submitPassword(event) {
    event.preventDefault();
    if (!event.currentTarget.checkValidity()) {
      event.currentTarget.reportValidity();
      return;
    }
    setSubmitting(true);
    const message = await onLogin(email.trim(), password, adminOnly);
    setSubmitting(false);
    setError(Boolean(message));
    setFeedback(message);
  }

  return <main className="login-page"><section className="login-illustration" aria-label="CCI South Africa sign-in" /><section className="login-panel" aria-labelledby="sign-in-title"><div className="login-panel-inner">
    <Link to="/" aria-label="CCI South Africa home"><img className="login-organization-logo" src="https://aadcdn.msauthimages.net/c1c6b6c8-rqhemeuyazxi4kg7jojjjcpqa2vsduk5y3e-k2ayvae/logintenantbranding/0/bannerlogo?ts=638816294952477934" alt="CCI Group" /></Link>
    <h2 id="sign-in-title">Sign in</h2>
    {stage === 'microsoft' && <><button className="login-options-button" type="button" onClick={startMicrosoft} disabled={submitting}>Continue with Microsoft</button><button className="login-help-link" type="button" onClick={() => { setFeedback(''); setError(false); setStage('email'); }}>Sign in with email instead</button></>}
    {stage === 'email' && <form className="login-form" onSubmit={continueWithEmail} noValidate>
      <label htmlFor="login-email">Email</label><input className="login-email" id="login-email" name="email" type="email" autoComplete="email" placeholder="name@outlook.com" value={email} onChange={(event) => setEmail(event.target.value)} aria-describedby="login-feedback" required />
      <p className={`login-notice${error ? ' is-error' : ''}`} id="login-feedback" role="status" aria-live="polite" hidden={!feedback}>{feedback}</p>
      <button className="login-next" type="submit">Next</button>
    </form>}
    {stage === 'password' && <form className="login-form" onSubmit={submitPassword} noValidate>
      <div className="login-account"><span className="mini-avatar">{email.slice(0, 1).toUpperCase()}</span><span>{email}</span><button type="button" onClick={() => { setPassword(''); setStage('email'); }}>Change</button></div>
      <label htmlFor="login-password">Password</label><input className="login-password" id="login-password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} aria-describedby="login-email-help login-feedback" required />
      <a className="login-help-link" id="login-email-help" href="https://aka.ms/sspr" target="_blank" rel="noopener noreferrer">Can’t access your account?</a>
      <p className={`login-notice${error ? ' is-error' : ''}`} id="login-feedback" role="status" aria-live="polite" hidden={!feedback}>{feedback}</p>
      <button className="login-next" type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
    </form>}
    <p className="login-policy">This system (hardware, software, networks, applications, communications, and data) is the property of the CCI Group and is for authorised use by employees and approved contractors only. Access is subject to CCI policies and forms part of the conditions of use. To the extent permitted by law, CCI may monitor, intercept, access, log, review, and record system activity, communications, and data across jurisdictions for security, compliance, investigations, misconduct management, and operations. Users have no expectation of privacy except where required by law. Personal information is processed in accordance with applicable laws and CCI policies for business, legal, regulatory, and employment or contractual purposes. Unauthorised use may result in disciplinary action (including termination), loss of access, civil claims, or referral to authorities. By proceeding, you confirm that you have read, understood, and agree to this notice, CCI policies, and applicable law.</p>
    <p className="login-page-footer">CCI Group · Secure access for employees and approved contractors{!adminOnly && <>. <Link to="/admin/login">Admin login</Link></>}</p>
  </div></section></main>;
}

function HomePage({ landing, admin, user }) {
  const [slide, setSlide] = useState(0);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [locationsExpanded, setLocationsExpanded] = useState(false);
  const [carouselItems, setCarouselItems] = useState([]);
  const [carouselError, setCarouselError] = useState('');
  const base = landing ? '' : admin ? '/admin' : '/users';
  const slides = carouselItems;

  useEffect(() => {
    let active = true;
    api.get('/api/carousel').then(({ data }) => {
      if (active) {
        setCarouselItems(data.slice(0, 4));
        setCarouselError('');
      }
    }).catch((error) => {
      if (active) setCarouselError(error.response?.data?.message || 'Featured updates are temporarily unavailable.');
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setSlide((current) => Math.min(current, Math.max(0, slides.length - 1)));
  }, [slides.length]);

  useEffect(() => {
    if (slides.length < 2) return undefined;
    if (videoPlaying) return undefined;
    const timer = window.setInterval(() => {
      setSlide((current) => (current + 1) % slides.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [slides.length, videoPlaying]);
  useEffect(() => {
    setVideoPlaying(false);
  }, [slide]);
  return <main>
    <section className="home-dashboard" aria-label="CCI South Africa home"><div className={`carousel${slides[slide]?.itemType === 'video' ? ' video-active' : ''}`} aria-roledescription="carousel" aria-label="Featured updates">
      {carouselError && <p className="form-message" role="alert">{carouselError}</p>}
      {slides.map((item, index) => item.itemType === 'video'
        ? <article key={item._id} className={`carousel-slide video-slide${slide === index ? ' is-active' : ''}`} aria-hidden={slide !== index}><FeaturedVideo item={item} active={slide === index} onPlayingChange={setVideoPlaying} onNext={() => setSlide((index + 1) % slides.length)} /></article>
        : <Link key={item._id} className={`carousel-slide carousel-story-link${slide === index ? ' is-active' : ''}`} to={landing ? '/login' : item.itemType === 'gallery' ? `/gallery?album=${encodeURIComponent(item.itemId)}` : `/events/${encodeURIComponent(item.itemId)}`} aria-hidden={slide !== index}><img src={backendUrl(item.image)} alt="" /><div className="slide-caption"><h1>{item.heading}</h1><p>{item.descriptionSnippet ? `${item.descriptionSnippet}${item.descriptionSnippet.endsWith('...') ? '' : '...'}` : ''}</p></div></Link>)}
      {!slides.length && !carouselError && <p className="events-empty-state">No featured updates yet.</p>}
      <div className="carousel_controls"><div className="carousel_dots" aria-label="Choose a slide">{slides.map((item, index) => <button key={item._id} className={`carousel_dot${slide === index ? ' is-active' : ''}`} type="button" aria-label={`Show slide ${index + 1}`} aria-current={slide === index ? 'true' : undefined} onClick={() => setSlide(index)} />)}</div></div>
    </div>
      <aside className="topLinks" aria-labelledby="top-links-title"><h2 id="top-links-title">Top Links</h2><div className="top_link_grid"><Link className="top_link" to={landing ? '/login' : `${base}/chat`}><i className="fa-regular fa-comments" /><span>{landing ? 'Chat Now' : 'Chat'}</span></Link><a className="top_link" href="https://connectapps.ccisouthafrica.com/ccicareers/"><i className="fa-solid fa-briefcase" /><span>{landing ? 'Job Portal' : 'Careers'}</span></a>{user ? <a className="top_link" href="https://servicedesk.cciglobal.com/" target="_blank" rel="noopener noreferrer"><i className="fa-solid fa-ticket" /><span>IT Ticket</span></a> : <Link className="top_link" to="/login"><i className="fa-solid fa-ticket" /><span>IT Ticket</span></Link>}<a className="top_link" href="#!"><i className="fa-regular fa-thumbs-up" /><span>Sho Peter</span></a><Link className="top_link" to={landing ? '/login' : `${base}/home`}><i className="fa-solid fa-user-shield" /><span>HR Ticket</span></Link><Link className="top_link" to={landing ? '/login' : `${base}/events`}><i className="fa-regular fa-calendar-days" /><span>Events</span></Link></div></aside>
    </section>
    <section className="locations-section" id="locations" aria-labelledby="locations-title"><header className="locations-heading"><h2 id="locations-title">Our Locations</h2><p>Explore our CCI offices and find the right team, from local hubs to regional centres.</p></header><div className={`locations-grid${locationsExpanded ? ' is-expanded' : ''}`} id="locations-grid">{[['KwaZulu-Natal','https://connect.cci-digital.cloud/wp-content/uploads/2026/02/KwaZulu_Natal.webp','Umhlanga House 1','3 The High Street, Umhlanga, Durban, 4319'],['Gauteng','https://connect.cci-digital.cloud/wp-content/uploads/2026/02/Gauteng.webp','Sandton','6 Gwen Lane, 24 Central, Johannesburg, Gauteng, 2196'],['Western Cape','https://connect.cci-digital.cloud/wp-content/uploads/2026/02/Western_Cape.webp','Newlands','08 Boundary Road, Newlands Terrace, Newlands'],['Kenya','https://connect.cci-digital.cloud/wp-content/uploads/2026/02/Kenya.webp','Garden City','Garden City Business Park, Along Boulevard Drive, Nairobi'],['Rwanda','https://connect.cci-digital.cloud/wp-content/uploads/2026/02/Rwanda.webp','Kigali','Masterpiece Mall, KN 5 Rd, Kigali'],['Ethiopia','https://connect.cci-digital.cloud/wp-content/uploads/2026/02/50c49f71-4379-425c-87cb-8518754c31f7.jpeg','Addis Ababa','Golagol, 22, Addis Ababa, Ethiopia'],['Egypt','https://connect.cci-digital.cloud/wp-content/uploads/2026/02/Egypt.webp','Alexandria','Palm City Business HUB, Alexandria Governorate'],['Dubai','https://connect.cci-digital.cloud/wp-content/uploads/2026/02/Dubai.webp','United Arab Emirates','Unit 3101 to 3108, HDS Tower, Jumeirah Lakes Towers, Dubai']].map(([name, image, location, address]) => <article className="location-card" key={name}><img src={image} alt={`${name} office location`} /><div className="location-details"><h3>{name}</h3><dl><div><dt>{location}</dt><dd>{address}</dd></div></dl></div></article>)}</div><button className="locations-toggle" type="button" aria-expanded={locationsExpanded} aria-controls="locations-grid" onClick={() => setLocationsExpanded(!locationsExpanded)}><span>{locationsExpanded ? 'View less' : 'View more'}</span><i className={`fa-solid fa-chevron-${locationsExpanded ? 'up' : 'down'}`} aria-hidden="true" /></button></section>
    <section className="about-us-template" id="about" aria-labelledby="who-we-are-title"><img className="about-us-first-image" src="https://connect.cci-digital.cloud/wp-content/uploads/2026/02/ABOUT_CCI.webp" alt="CCI South Africa team and workplace" /><div className="about-us-intro-copy"><h2 id="who-we-are-title">Who We Are</h2><div className="about-us-lead-copy"><p>CCI is an Africa focused business process outsourcing organization catering to a large portfolio of international clients from our delivery locations across the continent. Our emphasis on growth, quality service delivery and commitment to establishing long term partnerships has enabled us to become the top tier BPO operator in South Africa. CCI is transforming how we do business by being impact sourcing pioneers while retaining the essence of what makes us competitive, flexible and adaptable in a dynamic global business environment.</p><p>We are a diverse organization that operates from 7 locations across South Africa. Our focus has been on developing people combined with our client centric operating model creating a business enhancing, multichannel, multilingual delivery center capability servicing a global customer base 24×7×365. Our team’s diversity and socially conscious operating model have created a truly unique value proposition within the BPO space.</p></div></div><img className="about-us-wide-image" src="https://connect.cci-digital.cloud/wp-content/uploads/2026/02/Elements.webp" alt="CCI's people-focused impact sourcing work" /><div className="about-us-details"><p>Through CareerBox (Impact Sourcing Innovators) we provide unique training and work opportunities for highly driven skilled young people who come from disadvantaged backgrounds. CCI South Africa helps set them up for future success as well as helping them make an immediate positive impact on their families and the societies they live in.</p><p>CareerBox has impacted over 200,000 lives and has a target of changing an additional 150,000 lives by 2025, impacting over 350,000 lives. CCI South Africa not only invest in communities through CareerBox, but we are also enhancing our shared capability and ensuring skill integration by creating community value in the markets we operate in.</p></div><div className="about-us-impact-images"><img className="about-us-impact-image" src="https://connect.cci-digital.cloud/wp-content/uploads/2026/02/7832685075_Design_CCI_World_Map_2024_11_14_v2_copy.jpg" alt="CCI's global locations map" /><img className="about-us-impact-image" src="https://connect.cci-digital.cloud/wp-content/uploads/2026/02/Snipaste_2026-02-14_20-16-56-1024x999.webp" alt="CareerBox and CCI community impact" /></div></section>
    <footer className="site-footer"><div className="site-footer-inner"><section className="footer-column" aria-labelledby="footer-about-title"><Link className="footer-brand" to={landing ? '/' : '/users/home'} aria-label="CCI South Africa home"><img src={backendUrl('/original-site/images/logo2.png')} alt="CCI South Africa" /></Link><h2 id="footer-about-title">People. Purpose. Progress.</h2><p>CCI South Africa is a people-first business process outsourcing partner, connecting global brands with exceptional customer experiences while creating meaningful opportunities in our communities.</p><ul className="footer-highlights"><li><i className="fa-solid fa-location-dot" /> 7 South African locations</li><li><i className="fa-regular fa-clock" /> Supporting customers 24/7/365</li></ul></section><section className="footer-column" aria-labelledby="footer-contact-title"><h2 id="footer-contact-title">Get in touch</h2><p>Find our head office or explore opportunities with our team.</p><address className="footer-contact-list"><strong>Head office</strong><br />Umhlanga House 1<br />3 The High Street, Umhlanga<br />Durban, South Africa</address><a href="https://connectapps.ccisouthafrica.com/ccicareers/" className="text-link">Explore careers <i className="fa-solid fa-arrow-right" /></a></section></div></footer>
  </main>;
}

function FeaturedVideo({ item, active, onPlayingChange, onNext, poster }) {
  const playerRef = React.useRef(null);
  const videoRef = React.useRef(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [theater, setTheater] = useState(false);
  const [error, setError] = useState('');
  const video = videoRef.current;
  const tracksAvailable = Boolean(video?.textTracks?.length);
  React.useEffect(() => {
    if (!active) videoRef.current?.pause();
  }, [active]);
  const formatTime = (time) => {
    if (!Number.isFinite(time)) return '0:00';
    return `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`;
  };

  function togglePlayback() {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch((playError) => {
        setError(playError.message || 'Video playback could not start.');
      });
    } else {
      videoRef.current.pause();
    }
  }

  function changeVolume(value) {
    const nextVolume = Number(value);
    setVolume(nextVolume);
    setMuted(nextVolume === 0);
    if (videoRef.current) {
      videoRef.current.volume = nextVolume;
      videoRef.current.muted = nextVolume === 0;
    }
  }

  function toggleCaptions() {
    const tracks = videoRef.current?.textTracks;
    if (!tracks?.length) return;
    const show = !Array.from(tracks).some((track) => track.mode === 'showing');
    Array.from(tracks).forEach((track) => { track.mode = show ? 'showing' : 'hidden'; });
  }

  async function togglePictureInPicture() {
    const videoElement = videoRef.current;
    if (!videoElement || !document.pictureInPictureEnabled) return;
    if (document.pictureInPictureElement) await document.exitPictureInPicture();
    else await videoElement.requestPictureInPicture();
  }

  async function toggleFullscreen() {
    if (!playerRef.current) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await playerRef.current.requestFullscreen();
  }

  return <div className={`player-wrapper${theater ? ' is-theater' : ''}`} ref={playerRef}>
    <div className="video-holder">
      <video
        ref={videoRef}
        playsInline
        preload="auto"
        poster={poster || backendUrl('/original-site/CCI/videoImage.png')}
        aria-label="Featured CCI video"
        onLoadStart={() => setLoading(true)}
        onWaiting={() => setLoading(true)}
        onCanPlay={() => setLoading(false)}
        onPlaying={() => { setLoading(false); setPlaying(true); onPlayingChange(true); }}
        onPause={() => { setPlaying(false); onPlayingChange(false); }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => { setDuration(event.currentTarget.duration || 0); setLoading(false); }}
        onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
        onEnded={() => { setPlaying(false); onPlayingChange(false); if (autoplay) onNext(); }}
        onError={() => { setLoading(false); setError('This video could not be loaded.'); }}
      >
        <source src={item.videoUrl} type="video/mp4" />
        Your browser does not support video playback.
      </video>
      {loading && <span className="video-loading" role="status" aria-label="Loading video"><LoaderCircle aria-hidden="true" /></span>}
      {error && <p className="video-error" role="alert">{error}</p>}
    </div>
    <div className="video-controller">
      <div className="controller-container">
        <input className="play-bar" type="range" min="0" max={duration || 100} step="0.1" value={duration ? currentTime : 0} aria-label="Seek video" style={{ '--played': `${duration ? currentTime / duration * 100 : 0}%` }} onChange={(event) => { if (videoRef.current) videoRef.current.currentTime = Number(event.target.value); }} />
        <div className="video-controller-actions">
          <button className="video-control-button video-toggle" type="button" aria-label={playing ? 'Pause video' : 'Play video'} onClick={togglePlayback}>{playing ? <Pause /> : <Play />}</button>
          <span className="video-time" aria-live="off">{formatTime(currentTime)} / {formatTime(duration)}</span>
          <span className="video-controller-spacer" />
          <button className={`video-control-button video-autoplay${autoplay ? ' is-selected' : ''}`} type="button" aria-label={`Autoplay ${autoplay ? 'on' : 'off'}`} aria-pressed={autoplay} title={`Autoplay ${autoplay ? 'on' : 'off'}`} onClick={() => setAutoplay(!autoplay)}><Repeat /></button>
          <button className="video-control-button video-captions" type="button" aria-label={tracksAvailable ? 'Toggle captions' : 'Captions unavailable'} title={tracksAvailable ? 'Toggle captions' : 'No captions available for this video'} disabled={!tracksAvailable} onClick={toggleCaptions}><Captions /></button>
          <div className="sound-control"><button className="video-control-button video-mute" type="button" aria-label={muted || volume === 0 ? 'Unmute video' : 'Mute video'} onClick={() => { const nextMuted = !muted; setMuted(nextMuted); if (videoRef.current) videoRef.current.muted = nextMuted; }}>{muted || volume === 0 ? <VolumeX /> : <Volume2 />}</button><input className="volume-range" type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume} aria-label="Video volume" onChange={(event) => changeVolume(event.target.value)} /></div>
          <div className="video-settings"><button className="video-control-button video-settings-toggle" type="button" aria-label="Video settings" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(!settingsOpen)}><Settings2 /></button>
            {settingsOpen && <div className="video-settings-menu"><label className="video-setting-row"><span>Playback speed</span><select className="video-speed" value={speed} onChange={(event) => { const nextSpeed = Number(event.target.value); setSpeed(nextSpeed); if (videoRef.current) videoRef.current.playbackRate = nextSpeed; }}><option value="0.25">0.25x</option><option value="0.5">0.5x</option><option value="0.75">0.75x</option><option value="1">Normal</option><option value="1.25">1.25x</option><option value="1.5">1.5x</option><option value="1.75">1.75x</option><option value="2">2x</option></select></label><label className="video-setting-row"><span>Quality</span><select className="video-quality" disabled><option>Auto · source quality</option></select></label></div>}
          </div>
          <button className="video-control-button video-pip" type="button" aria-label="Picture in picture" title="Picture in picture" disabled={!document.pictureInPictureEnabled} onClick={() => { void togglePictureInPicture().catch((pipError) => setError(pipError.message || 'Picture in picture is unavailable.')); }}><PictureInPicture2 /></button>
          <button className={`video-control-button video-theater${theater ? ' is-selected' : ''}`} type="button" aria-label={theater ? 'Exit theater mode' : 'Theater mode'} aria-pressed={theater} title={theater ? 'Exit theater mode' : 'Theater mode'} onClick={() => setTheater(!theater)}><RectangleHorizontal /></button>
          <button className="video-control-button video-fullscreen" type="button" aria-label="Enter full screen" onClick={() => { void toggleFullscreen().catch((fullscreenError) => setError(fullscreenError.message || 'Fullscreen is unavailable.')); }}><Maximize /></button>
        </div>
      </div>
    </div>
  </div>;
}

function EventsPage({ admin }) {
  const [liked, setLiked] = useState({});
  const [commentsOpen, setCommentsOpen] = useState({});
  const posts = [
    { id: 'champions', name: 'Onwabe Zibeke', handle: '@onwabezibeke', date: 'Sep 24 · 2:20 PM', text: 'Celebrating the people and teams behind another brilliant Dinner of Champions. Congratulations to all of our quarterly award recipients.', image: 'https://connect.cci-digital.cloud/wp-content/uploads/2026/09/12943254269_Design_Emailer_Dinner-of-Champions-September-Teaser_2026_09_23_vs02-scaled.webp', likes: 28, count: 4 },
    { id: 'heritage', name: 'Simosenkosi Mncube', handle: '@simosenkosi', date: 'Sep 18 · 11:06 AM', text: 'Good food, great company and a lot of team spirit at our Heritage Day Cook-Off. Thank you to everyone who brought a taste of home to the table.', image: 'https://connect.cci-digital.cloud/wp-content/uploads/2026/09/2026_09_18_12818236186_CCI-Heritage-Day-Cook-Off_V2_Connect.mp4', likes: 46, count: 7, video: true },
    { id: 'careerbox', name: 'Onwabe Zibeke', handle: '@onwabezibeke', date: 'Sep 12 · 8:45 AM', text: 'CareerBox continues to open doors through skills training and meaningful work. Every new opportunity strengthens a person, a family and a community.', likes: 19, count: 2 }
  ];
  const pageBase = admin ? '/admin' : '/users';
  return <main className="events-page page-shell"><div className="events-layout"><section className="events-feed" aria-label="Events and updates"><div className="events-post-list">
    {posts.map((post) => <article className="event-post" key={post.id}><header className="post-header"><img src={backendUrl('/original-site/thumbnail.png')} alt="" className="post-avatar" /><div className="post-author"><strong>{post.name}</strong><span>{post.handle}</span></div><time>{post.date}</time><button className="bare-icon-button post-menu" type="button" aria-label="Post options"><i className="fa-solid fa-ellipsis" /></button></header><div className="post-content"><p>{post.text}</p>{post.image && (post.video ? <video controls playsInline preload="metadata" poster={backendUrl('/original-site/CCI/videoImage.png')}><source src={backendUrl(post.image)} type="video/mp4" /></video> : <img src={backendUrl(post.image)} alt={post.id === 'champions' ? 'Dinner of Champions quarterly awards' : ''} />)}</div><div className="post-actions"><button className="post-action like-button" type="button" aria-pressed={Boolean(liked[post.id])} onClick={() => setLiked({ ...liked, [post.id]: !liked[post.id] })}><i className="fa-regular fa-heart" /><span className="like-count">{post.likes + (liked[post.id] ? 1 : 0)}</span><span>Like</span></button><button className="post-action comment-toggle" type="button" aria-expanded={Boolean(commentsOpen[post.id])} onClick={() => setCommentsOpen({ ...commentsOpen, [post.id]: !commentsOpen[post.id] })}><i className="fa-regular fa-comment" /><span className="comment-count">{post.count}</span><span>Comments</span></button><time>September {post.id === 'champions' ? '24' : post.id === 'heritage' ? '18' : '12'}, 2026</time></div>{commentsOpen[post.id] && <section className="post-comments" aria-label="Comments"><div className="comment-list"><article className="event-comment"><span className="profile-initial profile-initial--b">B</span><div><div className="comment-author"><strong>Bandile Bandile</strong><span>@bandileb</span><time>12 min ago</time></div><p>Such a special afternoon. Congratulations, everyone!</p><button className="comment-like" type="button" aria-pressed="false"><i className="fa-regular fa-heart" /><span>6</span></button></div></article></div><form className="comment-form" onSubmit={(event) => event.preventDefault()}><img src={backendUrl('/original-site/thumbnail.png')} alt="" /><label className="visually-hidden" htmlFor={`comment-${post.id}`}>Add a comment</label><input id={`comment-${post.id}`} name="comment" placeholder="Write a comment…" required /><button type="submit" aria-label="Post comment"><i className="fa-solid fa-paper-plane" /></button></form></section>}</article>)}
  </div></section>
  <aside className="events-sidebar"><section className="events-side-panel notification-panel" aria-labelledby="notification-list-title"><div className="side-panel-heading"><h2 id="notification-list-title">Notifications</h2><i className="fa-regular fa-bell" /></div><ul className="event-notifications"><li><Link className="event-notification" to={`${pageBase}/events`}><span className="notification-icon"><i className="fa-regular fa-comment" /></span><span className="notification-copy"><strong>Bandile Bandile</strong> commented on Dinner of Champions.<time>12 min ago</time></span><span className="notification-unread" /></Link></li><li><Link className="event-notification" to={`${pageBase}/gallery`}><span className="notification-icon"><i className="fa-regular fa-images" /></span><span className="notification-copy">New photos from <strong>Heritage Day Cook-Off</strong> are available.<time>2 hours ago</time></span></Link></li></ul></section><section className="events-side-panel" id="upcoming-events"><div className="side-panel-heading"><h2>Upcoming</h2><i className="fa-regular fa-calendar" /></div><article className="upcoming-event"><time>OCT 12</time><div><h3>Community Career Day</h3><p>Johannesburg · 10:00 AM</p></div></article></section></aside>
  </div></main>;
}

function GalleryPage() {
  const [album, setAlbum] = useState(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const current = albums.find((item) => item.id === album);
  function photoUrl(id) { return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=85`; }
  return <main className="gallery-page page-shell"><header className="gallery-hero"><img src="https://connect.cci-digital.cloud/wp-content/uploads/2026/02/strikeaposestudios.co_.za-6574-1.jpg" alt="CCI colleagues gathering at a community event" /><div className="gallery-hero-copy"><h1>Gallery</h1><p>Browse moments from our people, events and communities.</p></div></header>
    {!current ? <div className="gallery-months">{[['September 2026', albums.slice(0, 2)], ['August 2026', albums.slice(2)]].map(([month, items]) => <section className="gallery-month" key={month}><div className="month-heading"><h2>{month}</h2><span>{items.length} albums</span></div><div className="album-grid">{items.map((item) => <button className="album-card" type="button" data-album={item.id} key={item.id} onClick={() => setAlbum(item.id)}><span className="album-cover"><img src={item.cover} alt={item.title} /></span><span className="album-card-copy"><strong>{item.title}</strong><span>{item.photos.length} photos <i className="fa-solid fa-arrow-up-right-from-square" /></span></span></button>)}</div></section>)}</div> : <section className="gallery-album-view"><div className="album-view-heading"><button className="album-back" type="button" onClick={() => setAlbum(null)}><i className="fa-solid fa-arrow-left" /><span>All albums</span></button><div><p className="eyebrow">PHOTO ALBUM</p><h2>{current.title}</h2></div></div><div className="gallery-photo-grid">{current.photos.map((photo, index) => <button type="button" key={photo} onClick={() => { setPhotoIndex(index); setLightboxOpen(true); }}><img src={photoUrl(photo)} alt={`${current.title}, photo ${index + 1}`} /></button>)}</div></section>}
    {current && lightboxOpen && <div className="gallery-lightbox" role="dialog" aria-modal="true" aria-label="Photo viewer"><button className="lightbox-close" type="button" aria-label="Close photo" onClick={() => setLightboxOpen(false)}><i className="fa-solid fa-xmark" /></button><button className="lightbox-arrow lightbox-previous" type="button" aria-label="Previous photo" onClick={() => setPhotoIndex((photoIndex + current.photos.length - 1) % current.photos.length)}><i className="fa-solid fa-chevron-left" /></button><figure><img src={photoUrl(current.photos[photoIndex])} alt={`${current.title}, photo ${photoIndex + 1}`} /><figcaption>{current.title}</figcaption></figure><button className="lightbox-arrow lightbox-next" type="button" aria-label="Next photo" onClick={() => setPhotoIndex((photoIndex + 1) % current.photos.length)}><i className="fa-solid fa-chevron-right" /></button><span className="lightbox-count">{photoIndex + 1} / {current.photos.length}</span></div>}
  </main>;
}

function ChatPage({ admin }) {
  const conversations = [
    { id: 'simosenkosi', name: 'Simosenkosi Mncube', initial: 'S', time: '10:42', preview: 'I’ll share the updated brief shortly.', status: 'Online', unread: 1 },
    { id: 'onwabe', name: 'Onwabe Zibeke', initial: 'O', time: '09:18', preview: 'Voice note · 0:18', status: 'Typing…', unread: 1 },
    { id: 'bandile', name: 'Bandile Bandile', initial: 'B', time: 'Yesterday', preview: 'Thanks, this is exactly what we needed.', status: 'Offline', unread: 0 },
    { id: 'nosihle', name: 'Nosihle Ngwane', initial: 'N', time: 'Sep 24', preview: 'Sent you a document', status: 'Online', unread: 0 }
  ];
  const [selected, setSelected] = useState(conversations[0]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [messages, setMessages] = useState(['Morning! Have you had a chance to look at the campaign brief?', 'Yes, I’ve reviewed it. The direction looks strong.', 'Great. I’m updating the final section and will send it through in a few minutes.']);
  const [draft, setDraft] = useState('');
  const pageBase = admin ? '/admin' : '/users';
  const visible = conversations.filter((item) => (filter === 'all' || item.unread) && `${item.name} ${item.preview}`.toLowerCase().includes(search.toLowerCase()));
  function send(event) { event.preventDefault(); if (!draft.trim()) return; setMessages([...messages, draft.trim()]); setDraft(''); }
  return <main className="chat-page page-shell"><section className="chat-workspace" aria-label="Messages"><aside className="chat-sidebar"><div className="chat-sidebar-heading"><h1>Messages</h1><div className="chat-heading-actions"><Link to={`${pageBase}/home`} className="chat-home-action"><i className="fa-solid fa-house" /><span>Home</span></Link></div></div><label className="chat-search"><i className="fa-solid fa-magnifying-glass" /><input type="search" placeholder="Search people or messages" autoComplete="off" value={search} onChange={(event) => setSearch(event.target.value)} /></label><div className="chat-filter-tabs" role="tablist" aria-label="Message filters"><button className={`chat-filter${filter === 'all' ? ' is-active' : ''}`} type="button" onClick={() => setFilter('all')}>All</button><button className={`chat-filter${filter === 'unread' ? ' is-active' : ''}`} type="button" onClick={() => setFilter('unread')}>Unread <span>2</span></button></div><div className="chat-contact-list" aria-label="Recent conversations">{visible.map((contact) => <button className={`chat-contact${selected.id === contact.id ? ' is-selected' : ''}`} type="button" key={contact.id} onClick={() => setSelected(contact)}><span className={`chat-avatar profile-initial profile-initial--${contact.initial.toLowerCase()}`}>{contact.initial}</span><span className="chat-contact-copy"><span className="chat-contact-top"><strong>{contact.name}</strong><time>{contact.time}</time></span><span className="chat-contact-preview">{contact.preview}</span></span>{contact.unread > 0 && <span className="unread-pill">{contact.unread}</span>}</button>)}</div></aside>
    <section className="chat-conversation" aria-label={`Conversation with ${selected.name}`}><header className="conversation-header"><span className={`chat-avatar conversation-avatar profile-initial profile-initial--${selected.initial.toLowerCase()}`}>{selected.initial}</span><div className="conversation-person"><h2>{selected.name}</h2><p className={`presence${selected.status === 'Online' ? ' is-online' : ''}`}>{selected.status}</p></div><div className="conversation-actions"><button className="bare-icon-button" type="button" aria-label="Search conversation"><i className="fa-solid fa-magnifying-glass" /></button><button className="bare-icon-button" type="button" aria-label="More options"><i className="fa-solid fa-ellipsis-vertical" /></button></div></header><div className="message-history" role="log" aria-live="polite" aria-label="Message history"><div className="chat-date-divider"><span>Today</span></div>{messages.map((message, index) => <div className={`message-row ${index % 2 ? 'sent' : 'received'}`} key={`${index}-${message}`}><div className="message-bubble"><p>{message}</p><time>{index ? '10:37' : '10:34'}</time></div></div>)}</div><form className="message-composer" onSubmit={send}><button className="bare-icon-button composer-attach" type="button" aria-label="Attach file"><i className="fa-solid fa-paperclip" /></button><textarea rows="1" placeholder="Write a message" aria-label="Write a message" value={draft} onChange={(event) => setDraft(event.target.value)} /><button className="composer-send" type="submit" aria-label="Send message"><i className="fa-solid fa-paper-plane" /></button></form></section></section></main>;
}
