import React, { useState } from 'react';
import axios from 'axios';
import { ArrowLeft, Check, ShieldCheck, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';

const api = axios.create({ withCredentials: true });

export default function AdminProfile() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [photo, setPhoto] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function saveProfile(event) {
    event.preventDefault();
    const data = new FormData();
    data.append('name', name);
    if (photo) data.append('photo', photo);
    try {
      const response = await api.patch('/api/profile', data);
      setName(response.data.user.name);
      setEmail(response.data.user.email);
      setMessage('Profile updated.');
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Profile update failed.');
    }
  }

  return (
    <main className="admin-profile-page page-shell">
      <header className="admin-profile-heading">
        <Link to="/admin/home"><ArrowLeft size={17} /> Back to home</Link>
        <span><UserRound size={20} /> Administrator</span>
        <h1>Manage profile</h1>
        <p>Update the profile details shown alongside your community posts.</p>
      </header>
      <form className="admin-profile-form" onSubmit={saveProfile}>
        <label htmlFor="admin-profile-name">Display name</label>
        <input id="admin-profile-name" value={name} onChange={(event) => setName(event.target.value)} required />
        <label htmlFor="admin-profile-email">Email address</label>
        <input id="admin-profile-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
        <label htmlFor="admin-profile-photo">Profile photo</label>
        <input id="admin-profile-photo" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => setPhoto(event.target.files?.[0] || null)} />
        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}
        <button type="submit"><Check size={17} /> Save profile</button>
        <span><ShieldCheck size={16} /> Admin profile</span>
      </form>
    </main>
  );
}
