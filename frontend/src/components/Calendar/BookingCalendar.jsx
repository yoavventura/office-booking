import React, { useState, useRef, useCallback, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { format } from 'date-fns';
import api from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import BookingModal from '../BookingModal/BookingModal';

export default function BookingCalendar({ rooms }) {
  const { hasRole } = useAuth();
  const { refresh: refreshNotifications } = useNotifications();
  const calendarRef = useRef(null);

  const [modal, setModal] = useState(null); // null | { mode: 'create'|'edit', data }
  const [selectedRooms, setSelectedRooms] = useState(new Set(rooms.map(r => r.id)));
  const [roomFilter, setRoomFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSelectedRooms(new Set(rooms.map(r => r.id)));
  }, [rooms]);

  const fetchEvents = useCallback(async (info, successCb, failureCb) => {
    try {
      const res = await api.get('/bookings', {
        params: { start: info.startStr, end: info.endStr }
      });

      const filtered = roomFilter === 'all'
        ? res.data
        : res.data.filter(b => b.room_id === Number(roomFilter));

      const events = filtered.map(b => ({
        id: b.instanceId || String(b.id),
        title: b.title,
        start: b.start_time,
        end: b.end_time,
        backgroundColor: b.room_color,
        borderColor: 'white',
        textColor: 'white',
        extendedProps: { booking: b }
      }));

      successCb(events);
    } catch {
      failureCb();
    }
  }, [roomFilter]);

  function handleDateSelect(selectInfo) {
    if (!hasRole('staff')) return;
    setModal({
      mode: 'create',
      data: {
        start_time: selectInfo.startStr,
        end_time: selectInfo.endStr
      }
    });
    selectInfo.view.calendar.unselect();
  }

  function handleEventClick(clickInfo) {
    const booking = clickInfo.event.extendedProps.booking;
    setModal({ mode: 'edit', data: booking });
  }

  function handleSaved() {
    setModal(null);
    calendarRef.current?.getApi().refetchEvents();
    refreshNotifications();
  }

  function toggleRoom(roomId) {
    setSelectedRooms(prev => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  }

  return (
    <div style={{ display: 'flex', gap: '20px', height: '100%' }}>
      {/* Room filter sidebar */}
      <div className="card" style={{ width: '200px', flexShrink: 0, padding: '16px', alignSelf: 'flex-start', position: 'sticky', top: 0 }}>
        <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--gray-700)', marginBottom: '12px' }}>Rooms</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px 0' }}>
            <input
              type="radio"
              name="roomFilter"
              value="all"
              checked={roomFilter === 'all'}
              onChange={() => setRoomFilter('all')}
            />
            <span style={{ fontSize: '13px', fontWeight: '500' }}>All Rooms</span>
          </label>

          {rooms.map(room => (
            <label key={room.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px 0' }}>
              <input
                type="radio"
                name="roomFilter"
                value={room.id}
                checked={roomFilter === String(room.id)}
                onChange={() => setRoomFilter(String(room.id))}
              />
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: room.color, flexShrink: 0 }} />
                {room.name}
              </span>
            </label>
          ))}
        </div>

      </div>

      {/* Calendar */}
      <div className="card" style={{ flex: 1, padding: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <FullCalendar
          ref={calendarRef}
          plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          customButtons={{
            newBooking: {
              text: '+ New Booking',
              click: () => {
                const now = new Date();
                const start = new Date(now);
                start.setMinutes(0, 0, 0);
                start.setHours(start.getHours() + 1);
                const end = new Date(start.getTime() + 60 * 60 * 1000);
                setModal({ mode: 'create', data: { start_time: start.toISOString(), end_time: end.toISOString() } });
              }
            }
          }}
          headerToolbar={{
            left: 'newBooking prev,next today',
            center: '',
            right: 'timeGridDay,timeGridWeek,dayGridMonth'
          }}
          views={{
            dayGridMonth: { headerToolbar: { left: 'newBooking prev,next today', center: 'title', right: 'timeGridDay,timeGridWeek,dayGridMonth' } }
          }}
          buttonText={{
            day: 'Day',
            week: 'Week',
            month: 'Month'
          }}
          events={fetchEvents}
          selectable
          selectMirror
          dayMaxEvents
          weekends
          allDaySlot={false}
          slotMinTime="07:00:00"
          slotMaxTime="22:00:00"
          slotDuration="00:30:00"
          height="100%"
          contentHeight="auto"
          stickyHeaderDates
          select={handleDateSelect}
          eventClick={handleEventClick}
          eventDidMount={info => {
            const b = info.event.extendedProps.booking;
            if (b?.isRecurring) {
              info.el.style.borderLeft = '4px solid rgba(255,255,255,0.6)';
            }
          }}
          eventContent={renderEventContent}
          nowIndicator={false}
          businessHours={{ daysOfWeek: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '18:00' }}
          dayHeaderContent={(args) => {
            const d = args.date;
            const isToday = d.toDateString() === new Date().toDateString();
            const isDayView = args.view.type === 'timeGridDay';

            if (isDayView) {
              // Simple style for Day view
              const dayName = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const dd = String(d.getDate()).padStart(2, '0');
              return (
                <div style={{ padding: '6px 0', textAlign: 'center', userSelect: 'none' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: isToday ? '#1a73e8' : 'var(--gray-500)', display: 'block', letterSpacing: '0.5px' }}>
                    {dayName}
                  </span>
                  <strong style={{ fontSize: '15px', fontWeight: '700', color: isToday ? '#1a73e8' : 'var(--gray-800)' }}>
                    {mm}/{dd}
                  </strong>
                </div>
              );
            }

            // Google Calendar circle style for Week and Month views
            const dayAbbr = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
            const dayNum = d.getDate();
            return (
              <div style={{ textAlign: 'center', padding: '10px 0 6px', userSelect: 'none' }}>
                <div style={{
                  fontSize: '11px', fontWeight: '600', letterSpacing: '0.8px',
                  color: isToday ? '#1a73e8' : '#70757a',
                  marginBottom: '5px'
                }}>
                  {dayAbbr}
                </div>
                <div style={{
                  width: '34px', height: '34px', borderRadius: '50%',
                  background: isToday ? '#1a73e8' : 'transparent',
                  color: isToday ? 'white' : '#3c4043',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '18px', fontWeight: isToday ? '700' : '500',
                  margin: '0 auto', transition: 'background 0.2s'
                }}>
                  {dayNum}
                </div>
              </div>
            );
          }}
        />
      </div>

      {modal && (
        <BookingModal
          rooms={rooms}
          initialData={modal.data}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function renderEventContent(eventInfo) {
  const booking = eventInfo.event.extendedProps.booking;
  return (
    <div style={{ padding: '3px 6px', overflow: 'hidden' }}>
      <div style={{ fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', lineHeight: 1.3 }}>
        {booking?.isRecurring && <span title="Recurring">↻</span>}
        {eventInfo.event.title}
      </div>
      {booking?.room_name && (
        <div style={{ fontSize: '12px', fontWeight: '500', opacity: 0.88, marginTop: '1px' }}>{booking.room_name}</div>
      )}
    </div>
  );
}
