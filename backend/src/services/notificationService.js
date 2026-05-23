const cron = require('node-cron');
const { getDb } = require('../database/db');

function createNotification(db, userId, bookingId, type, title, message) {
  db.prepare(`
    INSERT INTO notifications (user_id, booking_id, type, title, message)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, bookingId || null, type, title, message);
}

function notifyRoleAndAbove(db, role, bookingId, type, title, message) {
  db.prepare(`
    INSERT INTO notifications (user_id, booking_id, type, title, message, target_role)
    VALUES (NULL, ?, ?, ?, ?, ?)
  `).run(bookingId || null, type, title, message, role);
}

function sendRemindersForUpcomingBookings() {
  const db = getDb();
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in23h = new Date(now.getTime() + 23 * 60 * 60 * 1000);

  // Find bookings starting in the next 24h (±1h window to avoid duplicates)
  const upcoming = db.prepare(`
    SELECT b.*, r.name as room_name, u.name as user_name
    FROM bookings b
    JOIN rooms r ON b.room_id = r.id
    JOIN users u ON b.user_id = u.id
    WHERE b.status = 'confirmed'
    AND b.start_time > ? AND b.start_time <= ?
    AND b.recurrence_rule IS NULL
  `).all(in23h.toISOString(), in24h.toISOString());

  for (const booking of upcoming) {
    // Check we haven't already sent a reminder for this booking
    const alreadySent = db.prepare(`
      SELECT id FROM notifications
      WHERE booking_id = ? AND type = 'reminder' AND user_id = ?
    `).get(booking.id, booking.user_id);

    if (!alreadySent) {
      createNotification(db, booking.user_id, booking.id, 'reminder',
        `Reminder: ${booking.room_name} tomorrow`,
        `You have "${booking.title}" in ${booking.room_name} at ${new Date(booking.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} tomorrow`
      );
    }
  }
}

function checkRecurringUpcoming() {
  const db = getDb();
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { RRule } = require('rrule');

  const recurringBookings = db.prepare(`
    SELECT b.*, r.name as room_name, u.name as user_name
    FROM bookings b
    JOIN rooms r ON b.room_id = r.id
    JOIN users u ON b.user_id = u.id
    WHERE b.status = 'confirmed'
    AND b.recurrence_rule IS NOT NULL
    AND b.recurrence_rule != ''
  `).all();

  for (const booking of recurringBookings) {
    try {
      const start = new Date(booking.start_time);
      const ruleStr = booking.recurrence_rule.startsWith('RRULE:')
        ? booking.recurrence_rule.slice(6)
        : booking.recurrence_rule;

      const rule = new RRule({ ...RRule.parseString(ruleStr), dtstart: start });
      const nextOccurrences = rule.between(now, in24h, true);

      if (nextOccurrences.length > 0) {
        const nextTime = nextOccurrences[0];
        const alreadySent = db.prepare(`
          SELECT id FROM notifications
          WHERE booking_id = ? AND type = 'reminder'
          AND created_at > datetime('now', '-23 hours')
        `).get(booking.id);

        if (!alreadySent) {
          createNotification(db, booking.user_id, booking.id, 'reminder',
            `Recurring meeting: ${booking.room_name}`,
            `Recurring meeting "${booking.title}" in ${booking.room_name} at ${nextTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — today`
          );
        }
      }
    } catch { /* skip malformed rrule */ }
  }
}

function startNotificationJobs() {
  // Run reminder check every hour
  cron.schedule('0 * * * *', () => {
    try {
      sendRemindersForUpcomingBookings();
      checkRecurringUpcoming();
    } catch (err) {
      console.error('Notification job error:', err);
    }
  });

  console.log('Notification jobs scheduled');
}

module.exports = { createNotification, notifyRoleAndAbove, startNotificationJobs };
