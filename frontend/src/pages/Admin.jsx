import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

const ROOM_COLORS = ['#2563eb', '#16a34a', '#9333ea', '#d97706', '#dc2626', '#0891b2', '#db2777', '#65a30d'];
const ROLES = ['staff', 'manager', 'secretary', 'admin'];

export default function Admin() {
  const [tab, setTab] = useState('rooms');

  const tabs = [
    { key: 'rooms',   label: '🏠 Rooms' },
    { key: 'users',   label: '👥 Users' },
    { key: 'outlook', label: '📧 Outlook' }
  ];

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--gray-900)' }}>Administration</h1>
        <p style={{ color: 'var(--gray-500)', fontSize: '13px', marginTop: '2px' }}>Manage rooms, users, and integrations</p>
      </div>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'var(--gray-100)', padding: '4px', borderRadius: '8px', width: 'fit-content' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '7px 18px',
              borderRadius: '6px',
              border: 'none',
              fontWeight: '500',
              fontSize: '13px',
              background: tab === t.key ? 'white' : 'transparent',
              color: tab === t.key ? 'var(--gray-800)' : 'var(--gray-500)',
              boxShadow: tab === t.key ? 'var(--shadow)' : 'none',
              transition: 'all 0.15s'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'rooms'   && <RoomsTab />}
      {tab === 'users'   && <UsersTab />}
      {tab === 'outlook' && <OutlookTab />}
    </div>
  );
}

function RoomsTab() {
  const [rooms, setRooms] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editRoom, setEditRoom] = useState(null);
  const [error, setError] = useState('');

  const emptyForm = { name: '', type: 'conference', capacity: 8, floor: '', amenities: '', color: '#2563eb' };
  const [form, setForm] = useState(emptyForm);

  function loadRooms() {
    api.get('/rooms').then(res => setRooms(res.data)).catch(console.error);
  }

  useEffect(() => { loadRooms(); }, []);

  function openAdd() { setForm(emptyForm); setEditRoom(null); setShowForm(true); setError(''); }
  function openEdit(room) {
    setForm({ ...room, amenities: (room.amenities || []).join(', ') });
    setEditRoom(room);
    setShowForm(true);
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const payload = { ...form, capacity: Number(form.capacity), amenities: form.amenities ? form.amenities.split(',').map(s => s.trim()).filter(Boolean) : [] };
    try {
      if (editRoom) {
        await api.put(`/rooms/${editRoom.id}`, payload);
      } else {
        await api.post('/rooms', payload);
      }
      setShowForm(false);
      loadRooms();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    }
  }

  async function handleDelete(room) {
    if (!confirm(`Deactivate "${room.name}"? Existing bookings will remain.`)) return;
    try { await api.delete(`/rooms/${room.id}`); loadRooms(); }
    catch (err) { alert(err.response?.data?.error || 'Failed to deactivate'); }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ fontWeight: '600', color: 'var(--gray-700)' }}>{rooms.length} active rooms</div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Room</button>
      </div>

      {showForm && (
        <div className="card" style={{ padding: '20px', marginBottom: '20px', border: '2px solid var(--primary-light)' }}>
          <div style={{ fontWeight: '600', marginBottom: '16px' }}>{editRoom ? 'Edit Room' : 'Add New Room'}</div>
          {error && <div className="alert alert-danger" style={{ marginBottom: '12px' }}>{error}</div>}
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-input" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                <option value="conference">Conference Room</option>
                <option value="office">Office</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Capacity</label>
              <input type="number" className="form-input" min={1} value={form.capacity} onChange={e => setForm(p => ({ ...p, capacity: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Floor</label>
              <input className="form-input" value={form.floor} onChange={e => setForm(p => ({ ...p, floor: e.target.value }))} placeholder="e.g. 5th Floor" />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Amenities (comma-separated)</label>
              <input className="form-input" value={form.amenities} onChange={e => setForm(p => ({ ...p, amenities: e.target.value }))} placeholder="Projector, Whiteboard, Video Conference" />
            </div>
            <div className="form-group">
              <label className="form-label">Calendar Color</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {ROOM_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setForm(p => ({ ...p, color: c }))} style={{ width: '26px', height: '26px', borderRadius: '50%', background: c, border: form.color === c ? '3px solid var(--gray-800)' : '2px solid white', outline: form.color === c ? '2px solid var(--gray-400)' : 'none', cursor: 'pointer' }} />
                ))}
              </div>
            </div>
            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid var(--gray-100)', paddingTop: '12px', marginTop: '4px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">{editRoom ? 'Save Changes' : 'Create Room'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Room</th>
              <th>Type</th>
              <th>Capacity</th>
              <th>Floor</th>
              <th>Amenities</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rooms.map(room => (
              <tr key={room.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: room.color, flexShrink: 0 }} />
                    <span style={{ fontWeight: '500' }}>{room.name}</span>
                  </div>
                </td>
                <td style={{ color: 'var(--gray-500)', textTransform: 'capitalize' }}>{room.type}</td>
                <td>{room.capacity}</td>
                <td>{room.floor || '—'}</td>
                <td style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{(room.amenities || []).join(', ') || '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(room)}>Edit</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(room)}>Remove</button>
                  </div>
                </td>
              </tr>
            ))}
            {rooms.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '32px' }}>No rooms yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OutlookTab() {
  const [form, setForm] = useState({ enabled: false, tenantId: '', clientId: '', clientSecret: '' });
  const [hasSecret, setHasSecret] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [testResult, setTestResult] = useState('');

  useEffect(() => {
    api.get('/settings/outlook').then(res => {
      setForm({ enabled: res.data.enabled, tenantId: res.data.tenantId, clientId: res.data.clientId, clientSecret: '' });
      setHasSecret(res.data.hasSecret);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    setSaving(true);
    try {
      await api.post('/settings/outlook', form);
      setSuccess('Settings saved successfully.');
      if (form.clientSecret) setHasSecret(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save settings');
    } finally { setSaving(false); }
  }

  async function handleTest() {
    setTestResult(''); setError('');
    setTesting(true);
    try {
      const res = await api.post('/settings/outlook/test', form);
      setTestResult(res.data.message);
    } catch (err) {
      setTestResult('✗ ' + (err.response?.data?.error || 'Connection failed'));
    } finally { setTesting(false); }
  }

  if (loading) return <div style={{ color: 'var(--gray-400)', padding: '32px' }}>Loading...</div>;

  return (
    <div style={{ maxWidth: '600px' }}>
      {/* Info card */}
      <div className="card" style={{ padding: '20px', marginBottom: '20px', background: '#f0f7ff', border: '1px solid #bfdbfe' }}>
        <div style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--gray-800)' }}>📧 One-Way Outlook Sync</div>
        <p style={{ fontSize: '13px', color: 'var(--gray-600)', lineHeight: 1.6 }}>
          When enabled, every booking created in this system is automatically pushed to the organiser's Outlook calendar.
          Edits and cancellations sync too. Bookings are always managed from here — Outlook just reflects them.
        </p>
        <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--gray-500)' }}>
          <strong>Requires:</strong> Microsoft 365 · Azure App Registration · <code>Calendars.ReadWrite</code> application permission
        </div>
      </div>

      {/* Setup steps */}
      <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
        <div style={{ fontWeight: '600', marginBottom: '12px', fontSize: '14px' }}>Azure Setup (one time)</div>
        <ol style={{ fontSize: '13px', color: 'var(--gray-600)', lineHeight: 2, paddingLeft: '18px' }}>
          <li>Go to <strong>portal.azure.com</strong> → Azure Active Directory → App registrations → New registration</li>
          <li>Name it anything (e.g. <em>Office Booking</em>), click Register</li>
          <li>Copy the <strong>Application (client) ID</strong> and <strong>Directory (tenant) ID</strong></li>
          <li>Go to <strong>Certificates &amp; secrets</strong> → New client secret → Copy the value immediately</li>
          <li>Go to <strong>API permissions</strong> → Add → Microsoft Graph → Application permissions → <code>Calendars.ReadWrite</code> → Grant admin consent</li>
        </ol>
      </div>

      {/* Settings form */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ fontWeight: '600', marginBottom: '16px' }}>Connection Settings</div>

        {error   && <div className="alert alert-danger"  style={{ marginBottom: '12px' }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ marginBottom: '12px' }}>{success}</div>}

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Enable toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '12px 16px', borderRadius: 'var(--radius)', background: form.enabled ? 'var(--primary-light)' : 'var(--gray-50)', border: `1px solid ${form.enabled ? 'var(--primary)' : 'var(--gray-200)'}`, transition: 'all 0.15s' }}>
            <input type="checkbox" checked={form.enabled} onChange={e => setForm(p => ({ ...p, enabled: e.target.checked }))} style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }} />
            <div>
              <div style={{ fontWeight: '600', fontSize: '13px' }}>Enable Outlook Sync</div>
              <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>New bookings will appear in Outlook automatically</div>
            </div>
          </label>

          <div className="form-group">
            <label className="form-label">Tenant ID (Directory ID)</label>
            <input className="form-input" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={form.tenantId} onChange={e => setForm(p => ({ ...p, tenantId: e.target.value }))} />
          </div>

          <div className="form-group">
            <label className="form-label">Client ID (Application ID)</label>
            <input className="form-input" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={form.clientId} onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))} />
          </div>

          <div className="form-group">
            <label className="form-label">
              Client Secret
              {hasSecret && <span style={{ fontWeight: '400', color: 'var(--success)', marginLeft: '8px' }}>✓ saved</span>}
            </label>
            <input
              type="password"
              className="form-input"
              placeholder={hasSecret ? 'Leave blank to keep existing secret' : 'Paste secret value here'}
              value={form.clientSecret}
              onChange={e => setForm(p => ({ ...p, clientSecret: e.target.value }))}
            />
          </div>

          {/* Test result */}
          {testResult && (
            <div className={`alert ${testResult.startsWith('✗') ? 'alert-danger' : 'alert-success'}`}>
              {testResult}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid var(--gray-100)', paddingTop: '14px' }}>
            <button type="button" className="btn btn-secondary" onClick={handleTest} disabled={testing}>
              {testing ? 'Testing…' : '🔌 Test Connection'}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [error, setError] = useState('');

  const emptyForm = { name: '', email: '', password: '', role: 'staff' };
  const [form, setForm] = useState(emptyForm);

  function loadUsers() {
    api.get('/users').then(res => setUsers(res.data)).catch(console.error);
  }
  useEffect(() => { loadUsers(); }, []);

  function openAdd() { setForm(emptyForm); setEditUser(null); setShowForm(true); setError(''); }
  function openEdit(user) {
    setForm({ name: user.name, email: user.email, password: '', role: user.role });
    setEditUser(user);
    setShowForm(true);
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const payload = { ...form };
    if (editUser && !payload.password) delete payload.password;
    try {
      if (editUser) await api.put(`/users/${editUser.id}`, payload);
      else await api.post('/users', payload);
      setShowForm(false);
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    }
  }

  async function handleDeactivate(user) {
    if (!confirm(`Deactivate "${user.name}"? They will lose access.`)) return;
    try { await api.delete(`/users/${user.id}`); loadUsers(); }
    catch (err) { alert(err.response?.data?.error || 'Failed'); }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ fontWeight: '600', color: 'var(--gray-700)' }}>{users.filter(u => u.is_active).length} active users</div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add User</button>
      </div>

      {showForm && (
        <div className="card" style={{ padding: '20px', marginBottom: '20px', border: '2px solid var(--primary-light)' }}>
          <div style={{ fontWeight: '600', marginBottom: '16px' }}>{editUser ? 'Edit User' : 'Add New User'}</div>
          {error && <div className="alert alert-danger" style={{ marginBottom: '12px' }}>{error}</div>}
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-input" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input type="email" className="form-input" required value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} disabled={!!editUser} />
            </div>
            <div className="form-group">
              <label className="form-label">{editUser ? 'New Password (leave blank to keep)' : 'Password *'}</label>
              <input type="password" className="form-input" required={!editUser} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder={editUser ? 'Leave blank to keep current' : ''} />
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-input" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid var(--gray-100)', paddingTop: '12px', marginTop: '4px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">{editUser ? 'Save Changes' : 'Create User'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} style={{ opacity: user.is_active ? 1 : 0.4 }}>
                <td style={{ fontWeight: '500' }}>{user.name}</td>
                <td style={{ color: 'var(--gray-500)' }}>{user.email}</td>
                <td><span className={`badge badge-${user.role}`}>{user.role}</span></td>
                <td>
                  <span className={`badge ${user.is_active ? 'badge-confirmed' : 'badge-cancelled'}`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(user)}>Edit</button>
                    {user.is_active && (
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDeactivate(user)}>Deactivate</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '32px' }}>No users</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
