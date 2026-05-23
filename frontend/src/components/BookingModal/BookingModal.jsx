import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import api from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';

const WEEKDAYS = [
  { label: 'Sun', value: 'SU' },
  { label: 'Mon', value: 'MO' },
  { label: 'Tue', value: 'TU' },
  { label: 'Wed', value: 'WE' },
  { label: 'Thu', value: 'TH' },
  { label: 'Fri', value: 'FR' },
  { label: 'Sat', value: 'SA' }
];

function buildRRule(frequency, weekdays, endType, endDate, occurrences) {
  if (!frequency || frequency === 'none') return null;
  const parts = [`FREQ=${frequency.toUpperCase()}`];
  if (frequency === 'weekly' && weekdays.length > 0) {
    parts.push(`BYDAY=${weekdays.join(',')}`);
  }
  if (endType === 'on' && endDate) {
    parts.push(`UNTIL=${endDate.replace(/-/g, '')}T235959Z`);
  } else if (endType === 'after' && occurrences) {
    parts.push(`COUNT=${occurrences}`);
  }
  return `RRULE:${parts.join(';')}`;
}

export default function BookingModal({ onClose, onSaved, initialData, rooms }) {
  const { user, hasRole } = useAuth();
  const isEdit = !!initialData?.id;

  const [form, setForm] = useState({
    roomId: initialData?.room_id || rooms[0]?.id || '',
    title: initialData?.title || '',
    description: initialData?.description || '',
    startTime: initialData?.start_time ? format(new Date(initialData.start_time), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:00"),
    endTime: initialData?.end_time ? format(new Date(initialData.end_time), "yyyy-MM-dd'T'HH:mm") : format(new Date(Date.now() + 3600000), "yyyy-MM-dd'T'HH:00"),
    frequency: 'none',
    weekdays: [],
    endType: 'never',
    endDate: '',
    occurrences: 10
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function toggleWeekday(day) {
    setForm(prev => ({
      ...prev,
      weekdays: prev.weekdays.includes(day) ? prev.weekdays.filter(d => d !== day) : [...prev.weekdays, day]
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const rrule = buildRRule(form.frequency, form.weekdays, form.endType, form.endDate, form.occurrences);
    const payload = {
      roomId: Number(form.roomId),
      title: form.title,
      description: form.description,
      startTime: new Date(form.startTime).toISOString(),
      endTime: new Date(form.endTime).toISOString(),
      recurrenceRule: rrule,
      recurrenceEnd: form.endType === 'on' && form.endDate ? new Date(form.endDate + 'T23:59:59').toISOString() : null
    };

    try {
      if (isEdit) {
        await api.put(`/bookings/${initialData.id}`, payload);
      } else {
        await api.post('/bookings', payload);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to save booking');
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    if (!confirm('Cancel this booking? This cannot be undone.')) return;
    try {
      await api.delete(`/bookings/${initialData.id}`);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel booking');
    }
  }

  const canEditOthers = hasRole('secretary');
  const isOwner = initialData?.user_id === user?.id;
  const canEdit = !isEdit || canEditOthers || isOwner;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{isEdit ? 'Edit Booking' : 'New Booking'}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}

            {isEdit && initialData?.user_name && (
              <div style={{ padding: '10px 14px', background: 'var(--gray-50)', borderRadius: 'var(--radius)', fontSize: '13px', color: 'var(--gray-600)' }}>
                Booked by <strong>{initialData.user_name}</strong>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Room *</label>
              <select
                className="form-input"
                value={form.roomId}
                onChange={e => set('roomId', e.target.value)}
                required
                disabled={isEdit}
              >
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} — {r.type === 'conference' ? 'Conference Room' : 'Office'} (Cap. {r.capacity}) · {r.floor}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Meeting Title *</label>
              <input
                type="text"
                className="form-input"
                value={form.title}
                onChange={e => set('title', e.target.value)}
                placeholder="e.g. Weekly Team Standup"
                required
                disabled={!canEdit}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-input"
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Optional agenda or notes..."
                rows={2}
                style={{ resize: 'vertical' }}
                disabled={!canEdit}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Start *</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={form.startTime}
                  onChange={e => set('startTime', e.target.value)}
                  required
                  disabled={!canEdit}
                />
              </div>
              <div className="form-group">
                <label className="form-label">End *</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={form.endTime}
                  onChange={e => set('endTime', e.target.value)}
                  required
                  disabled={!canEdit}
                />
              </div>
            </div>

            {!isEdit && (
              <>
                <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Recurrence</label>
                    <select className="form-input" value={form.frequency} onChange={e => set('frequency', e.target.value)}>
                      <option value="none">Does not repeat</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>

                  {form.frequency === 'weekly' && (
                    <div className="form-group" style={{ marginTop: '10px' }}>
                      <label className="form-label">Repeat on</label>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {WEEKDAYS.map(d => (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() => toggleWeekday(d.value)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: '1px solid',
                              fontSize: '12px',
                              fontWeight: '500',
                              background: form.weekdays.includes(d.value) ? 'var(--primary)' : 'white',
                              color: form.weekdays.includes(d.value) ? 'white' : 'var(--gray-600)',
                              borderColor: form.weekdays.includes(d.value) ? 'var(--primary)' : 'var(--gray-300)'
                            }}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {form.frequency !== 'none' && (
                    <div className="form-group" style={{ marginTop: '10px' }}>
                      <label className="form-label">Ends</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {[
                          { value: 'never', label: 'Never' },
                          { value: 'on', label: 'On date' },
                          { value: 'after', label: 'After occurrences' }
                        ].map(opt => (
                          <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input type="radio" name="endType" value={opt.value} checked={form.endType === opt.value} onChange={e => set('endType', e.target.value)} />
                            <span style={{ fontSize: '13px' }}>{opt.label}</span>
                            {opt.value === 'on' && form.endType === 'on' && (
                              <input type="date" className="form-input" style={{ width: 'auto', flex: 1 }} value={form.endDate} onChange={e => set('endDate', e.target.value)} min={form.startTime?.split('T')[0]} />
                            )}
                            {opt.value === 'after' && form.endType === 'after' && (
                              <input type="number" className="form-input" style={{ width: '80px' }} value={form.occurrences} onChange={e => set('occurrences', e.target.value)} min={1} max={365} />
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
            <div>
              {isEdit && canEdit && (
                <button type="button" className="btn btn-danger btn-sm" onClick={handleCancel}>
                  Cancel Booking
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
              {canEdit && (
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Book Room'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
