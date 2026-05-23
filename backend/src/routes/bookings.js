const express = require('express');
const { RRule, rrulestr } = require('rrule');
const { getDb } = require('../database/db');
const { authenticate, hasRole } = require('../middleware/auth');
const { createNotification, notifyRoleAndAbove } = require('../services/notificationService');
const { syncBookingToSalesforce, cancelSalesforceEvent } = require('../services/salesforceService');
const { createOutlookEvent, updateOutlookEvent, deleteOutlookEvent } = require('../services/outlookService');

const router = express.Router();
router.use(authenticate);

// Expand a booking into its instances within [rangeStart, rangeEnd]
function expandBooking(booking, rangeStart, rangeEnd) {
  const start = new Date(booking.start_time);
  const end = new Date(booking.end_time);
  const duration = end - start;

  if (!booking.recurrence_rule) {
    if (start <= rangeEnd && end >= rangeStart) {
      return [formatInstance(booking, start, end)];
    }
    return [];
  }

  try {
    const ruleStr = booking.recurrence_rule.startsWith('RRULE:')
      ? booking.recurrence_rule.slice(6)
      : booking.recurrence_rule;

    const rule = new RRule({
      ...RRule.parseString(ruleStr),
      dtstart: start
    });

    const seriesEnd = booking.recurrence_end
      ? new Date(Math.min(new Date(booking.recurrence_end), rangeEnd))
      : rangeEnd;

    const occurrences = rule.between(rangeStart, seriesEnd, true);

    return occurrences.map(date => formatInstance(booking, date, new Date(date.getTime() + duration)));
  } catch {
    return [];
  }
}

function formatInstance(booking, start, end) {
  return {
    id: booking.id,
    instanceId: `${booking.id}_${start.toISOString()}`,
    room_id: booking.room_id,
    user_id: booking.user_id,
    user_name: booking.user_name,
    room_name: booking.room_name,
    room_color: booking.room_color,
    tag_id: booking.tag_id,
    tag_name: booking.tag_name,
    tag_color: booking.tag_color,
    title: booking.title,
    description: booking.description,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    recurrence_rule: booking.recurrence_rule,
    recurrence_end: booking.recurrence_end,
    status: booking.status,
    isRecurring: !!booking.recurrence_rule,
    created_at: booking.created_at
  };
}

// Check if a time slot is available for a room
function checkConflict(db, roomId, startTime, endTime, excludeId = null, recurrenceRule = null, recurrenceEnd = null) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const duration = end - start;

  // All confirmed bookings in this room
  let query = `
    SELECT b.*, r.name as room_name, r.color as room_color, u.name as user_name
    FROM bookings b
    JOIN rooms r ON b.room_id = r.id
    JOIN users u ON b.user_id = u.id
    WHERE b.room_id = ? AND b.status != 'cancelled'
  `;
  const params = [roomId];
  if (excludeId) { query += ' AND b.id != ?'; params.push(excludeId); }

  const existing = db.prepare(query).all(...params);

  // Generate instances of the new booking to check
  let newInstances = [];
  if (!recurrenceRule) {
    newInstances = [{ start, end }];
  } else {
    const ruleStr = recurrenceRule.startsWith('RRULE:') ? recurrenceRule.slice(6) : recurrenceRule;
    const rule = new RRule({ ...RRule.parseString(ruleStr), dtstart: start });
    const seriesEnd = recurrenceEnd
      ? new Date(recurrenceEnd)
      : new Date(start.getTime() + 365 * 24 * 60 * 60 * 1000);
    const dates = rule.between(start, seriesEnd, true);
    newInstances = dates.map(d => ({ start: d, end: new Date(d.getTime() + duration) }));
  }

  for (const existing_booking of existing) {
    const existingInstances = expandBooking(existing_booking, newInstances[0].start, newInstances[newInstances.length - 1].end);
    for (const ni of newInstances) {
      for (const ei of existingInstances) {
        const eiStart = new Date(ei.start_time);
        const eiEnd = new Date(ei.end_time);
        if (ni.start < eiEnd && ni.end > eiStart) {
          return {
            conflict: true,
            with: {
              id: existing_booking.id,
              title: existing_booking.title,
              user: existing_booking.user_name,
              start: ei.start_time,
              end: ei.end_time
            }
          };
        }
      }
    }
  }

  return { conflict: false };
}

// GET /api/bookings — list bookings in a date range
router.get('/', (req, res) => {
  const { start, end, roomId, userId } = req.query;
  const db = getDb();

  const rangeStart = start ? new Date(start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rangeEnd = end ? new Date(end) : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

  let query = `
    SELECT b.*, r.name as room_name, r.color as room_color, u.name as user_name,
           t.name as tag_name, t.color as tag_color
    FROM bookings b
    JOIN rooms r ON b.room_id = r.id
    JOIN users u ON b.user_id = u.id
    LEFT JOIN tags t ON b.tag_id = t.id
    WHERE b.parent_id IS NULL AND b.status != 'cancelled'
  `;
  const params = [];

  // Secretary and above see all bookings; others see only their own
  if (!hasRole(req.user, 'secretary')) {
    query += ' AND b.user_id = ?';
    params.push(req.user.id);
  } else if (userId) {
    query += ' AND b.user_id = ?';
    params.push(userId);
  }

  if (roomId) { query += ' AND b.room_id = ?'; params.push(roomId); }

  const bookings = db.prepare(query).all(...params);

  const instances = [];
  for (const booking of bookings) {
    instances.push(...expandBooking(booking, rangeStart, rangeEnd));
  }

  res.json(instances);
});

// GET /api/bookings/:id
router.get('/:id', (req, res) => {
  const booking = getDb().prepare(`
    SELECT b.*, r.name as room_name, r.color as room_color, u.name as user_name, u.email as user_email,
           t.name as tag_name, t.color as tag_color
    FROM bookings b JOIN rooms r ON b.room_id = r.id JOIN users u ON b.user_id = u.id
    LEFT JOIN tags t ON b.tag_id = t.id
    WHERE b.id = ?
  `).get(req.params.id);

  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (!hasRole(req.user, 'secretary') && booking.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  res.json(booking);
});

// POST /api/bookings — create booking
router.post('/', (req, res) => {
  const { roomId, title, description, startTime, endTime, recurrenceRule, recurrenceEnd, tagId } = req.body;
  const db = getDb();

  if (!roomId || !title || !startTime || !endTime) {
    return res.status(400).json({ error: 'roomId, title, startTime, and endTime are required' });
  }

  const start = new Date(startTime);
  const end = new Date(endTime);
  if (start >= end) return res.status(400).json({ error: 'End time must be after start time' });

  const room = db.prepare('SELECT * FROM rooms WHERE id = ? AND is_active = 1').get(roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const conflict = checkConflict(db, roomId, startTime, endTime, null, recurrenceRule, recurrenceEnd);
  if (conflict.conflict) {
    return res.status(409).json({
      error: 'Time slot conflict',
      message: `This room is already booked by "${conflict.with.user}" (${new Date(conflict.with.start).toLocaleString()} – ${new Date(conflict.with.end).toLocaleString()})`,
      conflict: conflict.with
    });
  }

  const result = db.prepare(`
    INSERT INTO bookings (room_id, user_id, title, description, start_time, end_time, recurrence_rule, recurrence_end, tag_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(roomId, req.user.id, title, description || null, startTime, endTime,
     recurrenceRule || null, recurrenceEnd || null, tagId || null);

  const booking = db.prepare(`
    SELECT b.*, r.name as room_name, r.color as room_color, u.name as user_name,
           t.name as tag_name, t.color as tag_color
    FROM bookings b JOIN rooms r ON b.room_id = r.id JOIN users u ON b.user_id = u.id
    LEFT JOIN tags t ON b.tag_id = t.id
    WHERE b.id = ?
  `).get(result.lastInsertRowid);

  // Notify all secretaries and admins
  notifyRoleAndAbove(db, 'secretary', booking.id, 'booking_created',
    `New booking: ${room.name}`,
    `${req.user.name} booked "${room.name}" for "${title}" on ${new Date(startTime).toLocaleDateString()}${recurrenceRule ? ' (recurring)' : ''}`
  );

  syncBookingToSalesforce(booking).catch(() => {});

  // Push to Outlook calendar (fire-and-forget — don't block the response)
  createOutlookEvent(booking, req.user.email).then(outlookId => {
    if (outlookId) {
      getDb().prepare('UPDATE bookings SET outlook_event_id = ? WHERE id = ?')
        .run(outlookId, result.lastInsertRowid);
    }
  }).catch(() => {});

  res.status(201).json(booking);
});

// PUT /api/bookings/:id — update booking
router.put('/:id', (req, res) => {
  const db = getDb();
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  if (!hasRole(req.user, 'secretary') && booking.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { title, description, startTime, endTime, recurrenceRule, recurrenceEnd, scope, tagId } = req.body;
  const newStart = startTime || booking.start_time;
  const newEnd = endTime || booking.end_time;

  if (new Date(newStart) >= new Date(newEnd)) {
    return res.status(400).json({ error: 'End time must be after start time' });
  }

  const conflict = checkConflict(db, booking.room_id, newStart, newEnd, booking.id,
    recurrenceRule !== undefined ? recurrenceRule : booking.recurrence_rule,
    recurrenceEnd !== undefined ? recurrenceEnd : booking.recurrence_end
  );
  if (conflict.conflict) {
    return res.status(409).json({
      error: 'Time slot conflict',
      message: `This room is already booked by "${conflict.with.user}" (${new Date(conflict.with.start).toLocaleString()})`,
      conflict: conflict.with
    });
  }

  db.prepare(`
    UPDATE bookings SET title = ?, description = ?, start_time = ?, end_time = ?,
    recurrence_rule = ?, recurrence_end = ?, tag_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    title ?? booking.title,
    description ?? booking.description,
    newStart, newEnd,
    recurrenceRule !== undefined ? recurrenceRule : booking.recurrence_rule,
    recurrenceEnd !== undefined ? recurrenceEnd : booking.recurrence_end,
    tagId !== undefined ? tagId : booking.tag_id,
    req.params.id
  );

  const updated = db.prepare(`
    SELECT b.*, r.name as room_name, r.color as room_color, u.name as user_name,
           t.name as tag_name, t.color as tag_color
    FROM bookings b JOIN rooms r ON b.room_id = r.id JOIN users u ON b.user_id = u.id
    LEFT JOIN tags t ON b.tag_id = t.id
    WHERE b.id = ?
  `).get(req.params.id);

  notifyRoleAndAbove(db, 'secretary', updated.id, 'booking_modified',
    `Booking updated: ${updated.room_name}`,
    `${req.user.name} updated "${updated.title}" on ${new Date(newStart).toLocaleDateString()}`
  );

  if (updated.user_id !== req.user.id) {
    createNotification(db, updated.user_id, updated.id, 'booking_modified',
      'Your booking was updated',
      `"${updated.title}" in ${updated.room_name} has been updated to ${new Date(newStart).toLocaleString()}`
    );
  }

  syncBookingToSalesforce(updated).catch(() => {});

  // Update Outlook event if one exists
  if (booking.outlook_event_id) {
    updateOutlookEvent(booking.outlook_event_id, updated, req.user.email).catch(() => {});
  }

  res.json(updated);
});

// DELETE /api/bookings/:id — cancel booking
router.delete('/:id', (req, res) => {
  const db = getDb();
  const booking = db.prepare(`
    SELECT b.*, r.name as room_name, u.name as user_name
    FROM bookings b JOIN rooms r ON b.room_id = r.id JOIN users u ON b.user_id = u.id
    WHERE b.id = ?
  `).get(req.params.id);

  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  if (!hasRole(req.user, 'secretary') && booking.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  db.prepare("UPDATE bookings SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .run(req.params.id);

  notifyRoleAndAbove(db, 'secretary', booking.id, 'booking_cancelled',
    `Booking cancelled: ${booking.room_name}`,
    `${req.user.name} cancelled "${booking.title}" in ${booking.room_name} (was ${new Date(booking.start_time).toLocaleDateString()})`
  );

  if (booking.user_id !== req.user.id) {
    createNotification(db, booking.user_id, booking.id, 'booking_cancelled',
      'Your booking was cancelled',
      `"${booking.title}" in ${booking.room_name} has been cancelled`
    );
  }

  cancelSalesforceEvent(booking).catch(() => {});

  // Remove from Outlook calendar
  if (booking.outlook_event_id) {
    // Need the organiser's email — fetch it
    const organiser = getDb().prepare('SELECT email FROM users WHERE id = ?').get(booking.user_id);
    if (organiser) deleteOutlookEvent(booking.outlook_event_id, organiser.email).catch(() => {});
  }

  res.json({ message: 'Booking cancelled' });
});

module.exports = router;
