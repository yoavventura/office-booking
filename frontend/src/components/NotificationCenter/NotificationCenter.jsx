import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../../contexts/NotificationContext';
import { formatDistanceToNow } from 'date-fns';

const TYPE_ICONS = {
  booking_created: '📋',
  booking_modified: '✏️',
  booking_cancelled: '❌',
  reminder: '⏰',
  recurring_upcoming: '🔁'
};

export default function NotificationCenter() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function handleClick(n) {
    if (!n.is_read) await markRead(n.id);
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(p => !p)}
        style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: 'var(--gray-600)' }}
        title="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span style={{ position: 'absolute', top: '2px', right: '2px', background: 'var(--danger)', color: 'white', borderRadius: '999px', fontSize: '10px', fontWeight: '700', minWidth: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', lineHeight: 1 }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: '360px', background: 'white', borderRadius: '10px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--gray-200)', zIndex: 1000, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--gray-100)' }}>
            <div>
              <span style={{ fontWeight: '700', fontSize: '15px' }}>Notifications</span>
              {unreadCount > 0 && <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--gray-500)' }}>{unreadCount} unread</span>}
            </div>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="btn btn-ghost btn-sm">Mark all read</button>
            )}
          </div>

          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--gray-400)' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔕</div>
                <div>No notifications yet</div>
              </div>
            ) : notifications.map(n => (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                style={{ display: 'flex', gap: '12px', padding: '12px 16px', cursor: 'pointer', background: n.is_read ? 'white' : '#f0f5ff', borderBottom: '1px solid var(--gray-50)', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = n.is_read ? 'var(--gray-50)' : '#e8f0fe'}
                onMouseLeave={e => e.currentTarget.style.background = n.is_read ? 'white' : '#f0f5ff'}
              >
                <div style={{ fontSize: '18px', flexShrink: 0, marginTop: '1px' }}>{TYPE_ICONS[n.type] || '📌'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: n.is_read ? '400' : '600', fontSize: '13px', color: 'var(--gray-800)', marginBottom: '2px' }}>
                    {n.title}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--gray-500)', lineHeight: 1.4 }}>{n.message}</div>
                  <div style={{ fontSize: '11px', color: 'var(--gray-400)', marginTop: '4px' }}>
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </div>
                </div>
                {!n.is_read && (
                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, marginTop: '5px' }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
