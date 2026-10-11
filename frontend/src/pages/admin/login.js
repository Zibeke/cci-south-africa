import React from 'react';
import CommunityPage from '../CommunityPage';

export default function LoginPage({ onLogin }) {
  return <CommunityPage page="login" admin onLogin={onLogin} />;
}
