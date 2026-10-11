import React from 'react';
import CommunityPage from '../CommunityPage';

export default function LoginPage({ onLogin, adminOnly = false }) {
  return <CommunityPage page="login" onLogin={onLogin} adminOnly={adminOnly} />;
}
