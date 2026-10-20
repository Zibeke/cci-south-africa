import React, { useEffect, useState } from 'react';
import { CalendarPlus, Pencil, X } from 'lucide-react';
import { api, backendUrl } from '../../api';
import { SiteHeader } from '../CommunityPage';
import { EventsPage as DataEventsPage } from '../PortalPages';
import EventContentEditor from '../shared/EventContentEditor';

const emptyEvent = () => ({
  title: '', description: '', contentBlocks: [], image: '', startsAt: '', location: '',
  registrationUrl: '', isUpcoming: false, status: 'draft'
});

function dateTimeValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState(emptyEvent);
  const [editingId, setEditingId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadEvents() {
    try {
      const { data } = await api.get('/api/admin/events');
      setEvents(data);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load events.');
    }
  }

  useEffect(() => { void loadEvents(); }, []);

  function createEvent() {
    setForm(emptyEvent());
    setEditingId('');
    setFormOpen(true);
    setMessage('');
    setError('');
  }

  function editEvent(event) {
    setForm({
      title: event.title || '', description: event.description || '', contentBlocks: event.contentBlocks || [],
      image: event.image || '', startsAt: dateTimeValue(event.startsAt), location: event.location || '',
      registrationUrl: event.registrationUrl || '', isUpcoming: Boolean(event.isUpcoming), status: event.status || 'published'
    });
    setEditingId(event._id);
    setFormOpen(true);
    setMessage('');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function uploadImage(file, onUploaded) {
    if (!file) return;
    const body = new FormData();
    body.append('image', file);
    try {
      const { data } = await api.post('/api/admin/event-images', body);
      onUploaded(data.image);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Image upload failed.');
    }
  }

  async function saveEvent(submitEvent) {
    submitEvent.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const payload = { ...form, startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null };
      if (editingId) await api.patch(`/api/admin/events/${editingId}`, payload);
      else await api.post('/api/admin/events', payload);
      await loadEvents();
      setFormOpen(false);
      setEditingId('');
      setMessage(editingId ? 'Event updated.' : 'Event saved.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save this event.');
    } finally {
      setBusy(false);
    }
  }

  return <>
    <SiteHeader page="events" admin />
    <section className="event-admin page-shell" aria-labelledby="event-admin-title">
      <div className="event-admin-heading">
        <div><span className="eyebrow">EVENTS ADMINISTRATION</span><h1 id="event-admin-title">Manage events</h1></div>
        <button className="button button-dark" type="button" onClick={createEvent}><CalendarPlus size={17} />Create event</button>
      </div>
      {message && <p className="success-message" role="status">{message}</p>}
      {error && <p className="form-message" role="alert">{error}</p>}
      {formOpen && <form className="event-editor-form admin-section" onSubmit={saveEvent}>
        <div className="event-editor-form-heading"><div><span className="eyebrow">{editingId ? 'EDIT EVENT' : 'NEW EVENT'}</span><h2>{editingId ? 'Update event' : 'Create event'}</h2></div><button className="bare-icon-button" type="button" aria-label="Close event form" onClick={() => setFormOpen(false)}><X size={19} /></button></div>
        <div className="event-fields-grid">
          <label>Event title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={140} required /></label>
          <label>Event date and time<input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></label>
          <label>Location<input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} maxLength={240} /></label>
          <label>Registration URL<input type="url" value={form.registrationUrl} onChange={(event) => setForm({ ...form, registrationUrl: event.target.value })} placeholder="https://" /></label>
          <label className="event-featured-image">Featured image<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => { void uploadImage(event.target.files?.[0], (image) => setForm((current) => ({ ...current, image }))); }} />{form.image && <img src={backendUrl(form.image)} alt="Featured event preview" />}</label>
          <label>Publishing status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="draft">Save as draft</option><option value="published">Publish</option></select></label>
          <label className="event-upcoming-toggle"><input type="checkbox" checked={form.isUpcoming} onChange={(event) => setForm({ ...form, isUpcoming: event.target.checked })} />Show in upcoming events</label>
        </div>
        <label className="event-legacy-description">Legacy description <span>Shown when an event has no article blocks</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} maxLength={12000} /></label>
        <section className="event-article-editor" aria-labelledby="event-article-title">
          <div><span className="eyebrow">ARTICLE</span><h3 id="event-article-title">Event description</h3><p>Build the article from blocks. The title and featured image remain separate.</p></div>
          <EventContentEditor blocks={form.contentBlocks} onChange={(contentBlocks) => setForm((current) => ({ ...current, contentBlocks }))} onUploadImage={uploadImage} />
        </section>
        <div className="event-editor-submit"><button className="button button-dark" type="submit" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Update event' : form.status === 'draft' ? 'Save draft' : 'Publish event'}</button></div>
      </form>}
      <div className="event-admin-list" aria-label="Events">
        {events.map((event) => <article className="event-admin-row" key={event._id}><div><strong>{event.title}</strong><span>{event.status === 'draft' ? 'Draft' : event.isUpcoming ? 'Upcoming' : 'Published'}{event.startsAt ? ` · ${new Date(event.startsAt).toLocaleDateString()}` : ''}</span></div><button className="button button-light" type="button" onClick={() => editEvent(event)}><Pencil size={15} />Edit</button></article>)}
        {!events.length && <p className="event-admin-empty">No events yet.</p>}
      </div>
    </section>
    <DataEventsPage admin />
  </>;
}
