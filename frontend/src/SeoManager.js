import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SITE_URL = 'https://cci-connect.onrender.com';
const SOCIAL_IMAGE = `${SITE_URL}/images/logo2.png`;
const HOME_DESCRIPTION = 'This is a demonstration website and is NOT the official CCI website.';

const privatePages = {
  home: {
    title: 'Employee Home | CCI Connect Demo',
    description: 'Access the private CCI Connect demonstration portal for employee community updates and services.'
  },
  events: {
    title: 'Events and Updates | CCI Connect Demo',
    description: 'Browse events and community updates in the private CCI Connect demonstration portal.'
  },
  gallery: {
    title: 'Gallery | CCI Connect Demo',
    description: 'View photo albums in the private CCI Connect demonstration portal.'
  },
  chat: {
    title: 'Chat | CCI Connect Demo',
    description: 'Use the private messaging demonstration interface in CCI Connect.'
  },
  'my-cci': {
    title: 'My CCI | CCI Connect Demo',
    description: 'Explore employee information and services in the CCI Connect demonstration website.'
  },
  'sage-ess': {
    title: 'Sage ESS Demo | CCI Connect Demo',
    description: 'View the Sage ESS demonstration interface. It is not connected to a live Sage service.'
  },
  profile: {
    title: 'Profile | CCI Connect Demo',
    description: 'Manage a profile in the private CCI Connect demonstration portal.'
  },
  publish: {
    title: 'Publish Content | CCI Connect Demo',
    description: 'Manage demonstration portal content. This private admin page is not publicly indexed.'
  },
  login: {
    title: 'Sign In | CCI Connect Demo',
    description: 'Sign in to the CCI Connect demonstration website. This is not the official CCI website.'
  }
};

function pageForPath(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') {
    return {
      title: 'CCI Connect | Demo Website',
      description: HOME_DESCRIPTION,
      indexable: true
    };
  }

  if (path === '/login' || path === '/admin/login' || path === '/users/login') {
    return privatePages.login;
  }

  const segments = path.split('/').filter(Boolean);
  const isAdmin = segments[0] === 'admin';
  const pageSegment = isAdmin ? (segments[1] || 'home') : segments[0] === 'users' ? (segments[1] || 'home') : segments[0];
  const page = privatePages[pageSegment];

  if (page) {
    if (pageSegment === 'events' && segments.length > (isAdmin || segments[0] === 'users' ? 2 : 1)) {
      return {
        title: `Event Details | CCI Connect Demo`,
        description: 'View event details in the private CCI Connect demonstration portal.'
      };
    }
    return page;
  }

  return {
    title: 'Private Page | CCI Connect Demo',
    description: 'This CCI Connect demonstration page is not publicly indexed.'
  };
}

function setMeta(attribute, key, content) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

export default function SeoManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    const page = pageForPath(pathname);
    const canonicalUrl = `${SITE_URL}${pathname === '/' ? '/' : pathname.replace(/\/+$/, '')}`;
    const robots = page.indexable ? 'index, follow' : 'noindex, nofollow';

    document.title = page.title;
    document.documentElement.lang = 'en';
    setMeta('name', 'description', page.description);
    setMeta('name', 'robots', robots);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:title', page.title);
    setMeta('property', 'og:description', page.description);
    setMeta('property', 'og:url', canonicalUrl);
    setMeta('property', 'og:image', SOCIAL_IMAGE);
    setMeta('property', 'og:image:alt', 'CCI Connect demo website logo');
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', page.title);
    setMeta('name', 'twitter:description', page.description);
    setMeta('name', 'twitter:image', SOCIAL_IMAGE);
    setMeta('name', 'twitter:image:alt', 'CCI Connect demo website logo');

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;

    let structuredData = document.getElementById('website-structured-data');
    if (page.indexable) {
      if (!structuredData) {
        structuredData = document.createElement('script');
        structuredData.id = 'website-structured-data';
        structuredData.type = 'application/ld+json';
        document.head.appendChild(structuredData);
      }
      structuredData.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'CCI Connect | Demo Website',
        url: `${SITE_URL}/`,
        description: HOME_DESCRIPTION,
        inLanguage: 'en'
      });
    } else {
      structuredData?.remove();
    }
  }, [pathname]);

  return null;
}
