import React, { useRef, useState } from 'react';
import { SiteHeader } from './CommunityPage';
import { useAuth } from '../context/AuthContext';
import './SageEssPage.css';

const tabs = [
  { id: 'payslips', label: 'View Payslips' },
  { id: 'leave', label: 'Request Leave' },
  { id: 'attendance', label: 'Time & Attendance' },
  { id: 'details', label: 'Update Personal Details' },
  { id: 'documents', label: 'View Documents' }
];

const leaveTypes = [
  { id: 'annual', label: 'Annual Leave' },
  { id: 'sick', label: 'Sick Leave' },
  { id: 'family', label: 'Family Responsibility Leave' }
];

function PayslipsPanel() {
  return (
    <div className="sage-table-wrap">
      <table className="sage-payslips-table">
        <thead><tr><th scope="col">Pay period</th><th scope="col">Payslip date</th><th scope="col">Download PDF</th></tr></thead>
        <tbody><tr><td colSpan="3">Payslips are unavailable because a Sage data source is not connected.</td></tr></tbody>
      </table>
    </div>
  );
}

function LeavePanel() {
  return (
    <section className="sage-panel" aria-labelledby="sage-leave-title">
      <h2 id="sage-leave-title">Request leave</h2>
      <p className="sage-unavailable-note" role="status">Leave requests are not connected to a supported Sage submission service.</p>
      <form className="sage-leave-form" onSubmit={(event) => event.preventDefault()}>
        <label>Leave type<select defaultValue="" required><option value="" disabled>Select leave type</option>{leaveTypes.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}</select></label>
        <label>Start date<input type="date" required /></label>
        <label>End date<input type="date" required /></label>
        <label className="sage-leave-reason">Reason<textarea rows="3" required /></label>
        <button className="sage-submit-button" type="submit" disabled>Submit request</button>
      </form>
    </section>
  );
}

function TabPanel({ activeTab, user }) {
  if (activeTab === 'payslips') return <PayslipsPanel />;
  if (activeTab === 'leave') return <LeavePanel />;
  if (activeTab === 'attendance') {
    return <p className="sage-empty-state" role="status">Time and attendance data is unavailable because a Sage data source is not connected.</p>;
  }
  if (activeTab === 'details') {
    return (
      <section className="sage-panel" aria-labelledby="sage-details-title">
        <h2 id="sage-details-title">Personal details</h2>
        <dl className="sage-profile-details">
          <div><dt>Name</dt><dd>{user?.name || 'Unavailable'}</dd></div>
          <div><dt>Email</dt><dd>{user?.email || 'Unavailable'}</dd></div>
        </dl>
        <p className="sage-unavailable-note">Personal and payroll changes cannot be made from this page.</p>
      </section>
    );
  }
  return <p className="sage-empty-state" role="status">Documents are unavailable because a Sage document source is not connected.</p>;
}

export default function SageEssPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('payslips');
  const tabRefs = useRef([]);
  const employeeName = user?.name?.trim();
  const leaveBalances = null;

  function selectTab(index) {
    setActiveTab(tabs[index].id);
    tabRefs.current[index]?.focus();
  }

  function handleTabKeyDown(event, index) {
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;
    event.preventDefault();
    selectTab(nextIndex);
  }

  return (
    <>
      <SiteHeader page="sage-ess" admin={user?.role === 'admin'} />
      <main className="sage-ess-page">
        <aside className="sage-demo-note" role="note">
          This is a demonstration website and is NOT the official CCI website. Sage ESS is a demonstration interface, not a live service.
        </aside>
        <section className="sage-welcome" aria-label="Welcome">
          <h1>{employeeName ? <><span>Welcome back,</span><strong>{employeeName}</strong></> : 'Welcome back'}</h1>
        </section>

        <section className="sage-balances" aria-labelledby="sage-balances-title">
          <h2 id="sage-balances-title">Leave balance</h2>
          <div className="sage-balance-grid">
            {leaveTypes.map((type) => (
              <article className="sage-balance-card" key={type.id}>
                <p className="sage-balance-value">{leaveBalances?.[type.id] ?? '—'}</p>
                <h3>{type.label}</h3>
              </article>
            ))}
          </div>
          <p className="sage-balance-status" role="status">Leave balances are unavailable until a Sage data source is connected.</p>
        </section>

        <section className="sage-services" aria-label="Employee services">
          <div className="sage-tab-scroll">
            <div className="sage-tabs" role="tablist" aria-label="Employee services">
              {tabs.map((tab, index) => (
                <button
                  aria-controls="sage-tab-panel"
                  aria-selected={activeTab === tab.id}
                  className={`sage-tab${activeTab === tab.id ? ' is-active' : ''}`}
                  id={`sage-tab-${tab.id}`}
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                  ref={(element) => { tabRefs.current[index] = element; }}
                  role="tab"
                  tabIndex={activeTab === tab.id ? 0 : -1}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
              <span className="sage-tab-indicator" aria-hidden="true" style={{ transform: `translateX(${tabs.findIndex((tab) => tab.id === activeTab) * 100}%)` }} />
            </div>
          </div>
          <div aria-labelledby={`sage-tab-${activeTab}`} className="sage-tab-panel" id="sage-tab-panel" role="tabpanel" tabIndex="0">
            <TabPanel activeTab={activeTab} user={user} />
          </div>
        </section>
      </main>
    </>
  );
}