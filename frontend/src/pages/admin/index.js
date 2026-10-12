import React from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import CommunityPage from '../CommunityPage';
import ChatPage from './chat';
import EventsPage from './events';
import GalleryPage from './gallery';
import HomePage from './home';
import ProfilePage from './profile';

export default function AdminPages({ Admin }) {
  return (
    <Routes>
      <Route index element={<Navigate to="home" replace />} />
      <Route path="home" element={<HomePage />} />
      <Route path="events" element={<EventsPage />} />
      <Route path="events/:eventId" element={<AdminEventDetail />} />
      <Route path="gallery" element={<GalleryPage />} />
      <Route path="chat" element={<ChatPage />} />
      <Route path="login" element={<Navigate to="/login" replace />} />
      <Route path="profile" element={<ProfilePage Admin={Admin} />} />
      <Route path="publish" element={<Admin />} />
      <Route path="*" element={<Navigate to="/admin/home" replace />} />
    </Routes>
  );
}

function AdminEventDetail() {
  const { eventId } = useParams();
  return <CommunityPage page="events" admin eventId={eventId} />;
}
