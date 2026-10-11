import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ChatPage from './chat';
import EventsPage from './events';
import GalleryPage from './gallery';
import HomePage from './home';

export default function UserPages() {
  return (
    <Routes>
      <Route index element={<Navigate to="home" replace />} />
      <Route path="home" element={<HomePage />} />
      <Route path="events" element={<EventsPage />} />
      <Route path="gallery" element={<GalleryPage />} />
      <Route path="chat" element={<ChatPage />} />
      <Route path="login" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="home" replace />} />
    </Routes>
  );
}
