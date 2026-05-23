import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import BookingCalendar from '../components/Calendar/BookingCalendar';

export default function Dashboard() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/rooms')
      .then(res => setRooms(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', color: 'var(--gray-400)', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '32px' }}>📅</div>
      <span>Loading calendar...</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 108px)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--gray-900)' }}>Room Calendar</h1>
          <p style={{ color: 'var(--gray-500)', fontSize: '13px', marginTop: '2px' }}>
            Click any empty slot to create a booking. Click an event to view or edit.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {rooms.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', background: 'white', borderRadius: '999px', border: '1px solid var(--gray-200)', fontSize: '12px', color: 'var(--gray-600)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: r.color }} />
              {r.name}
            </div>
          ))}
        </div>
      </div>

      {/* Calendar fills remaining space and scrolls internally */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <BookingCalendar rooms={rooms} />
      </div>
    </div>
  );
}
