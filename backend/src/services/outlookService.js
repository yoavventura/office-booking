const { getDb } = require('../database/db');

// ─── Helpers ────────────────────────────────────────────────────────────────

function getOutlookSettings() {
  const db = getDb();
  const rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'outlook_%'").all();
  const s = {};
  rows.forEach(r => { s[r.key.replace('outlook_', '')] = r.value; });
  return s; // { enabled, tenant_id, client_id, client_secret }
}

async function getAccessToken(tenantId, clientId, clientSecret) {
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default'
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error_description || err.error || 'Failed to get access token from Microsoft');
  }

  const data = await res.json();
  return data.access_token;
}

function buildEventPayload(booking) {
  const isRecurring = !!booking.recurrence_rule;
  return {
    subject: isRecurring ? `${booking.title} (Recurring)` : booking.title,
    body: {
      contentType: 'Text',
      content: [
        booking.description || '',
        `Room: ${booking.room_name || 'Office Room'}`,
        isRecurring ? 'This is a recurring booking managed via Office Booking.' : ''
      ].filter(Boolean).join('\n')
    },
    start: {
      dateTime: new Date(booking.start_time).toISOString().replace('Z', ''),
      timeZone: 'UTC'
    },
    end: {
      dateTime: new Date(booking.end_time).toISOString().replace('Z', ''),
      timeZone: 'UTC'
    },
    location: {
      displayName: booking.room_name || 'Office Room'
    }
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

async function createOutlookEvent(booking, userEmail) {
  const s = getOutlookSettings();
  if (s.enabled !== 'true' || !s.tenant_id || !s.client_id || !s.client_secret) return null;

  const token = await getAccessToken(s.tenant_id, s.client_id, s.client_secret);

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${userEmail}/events`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildEventPayload(booking))
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to create Outlook event');
  }

  const data = await res.json();
  return data.id; // Outlook event ID — stored in bookings.outlook_event_id
}

async function updateOutlookEvent(outlookEventId, booking, userEmail) {
  const s = getOutlookSettings();
  if (s.enabled !== 'true' || !s.tenant_id || !s.client_id || !s.client_secret) return;
  if (!outlookEventId || !userEmail) return;

  const token = await getAccessToken(s.tenant_id, s.client_id, s.client_secret);

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${userEmail}/events/${outlookEventId}`,
    {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildEventPayload(booking))
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to update Outlook event');
  }
}

async function deleteOutlookEvent(outlookEventId, userEmail) {
  const s = getOutlookSettings();
  if (s.enabled !== 'true' || !s.tenant_id || !s.client_id || !s.client_secret) return;
  if (!outlookEventId || !userEmail) return;

  const token = await getAccessToken(s.tenant_id, s.client_id, s.client_secret);

  await fetch(
    `https://graph.microsoft.com/v1.0/users/${userEmail}/events/${outlookEventId}`,
    {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
}

async function testOutlookConnection(tenantId, clientId, clientSecret) {
  const token = await getAccessToken(tenantId, clientId, clientSecret);

  const res = await fetch('https://graph.microsoft.com/v1.0/organization', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!res.ok) throw new Error('Connected to Microsoft but could not read organisation info. Check API permissions.');

  const data = await res.json();
  return data.value?.[0]?.displayName || 'Microsoft 365';
}

module.exports = { createOutlookEvent, updateOutlookEvent, deleteOutlookEvent, testOutlookConnection };
