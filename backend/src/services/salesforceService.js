const jsforce = require('jsforce');

let conn = null;
let status = { connected: false, enabled: false, lastSync: null, error: null };

async function connectSalesforce() {
  if (!process.env.SALESFORCE_ENABLED || process.env.SALESFORCE_ENABLED !== 'true') {
    status = { connected: false, enabled: false, error: 'Salesforce integration is disabled' };
    return status;
  }

  try {
    conn = new jsforce.Connection({ loginUrl: process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com' });
    await conn.login(
      process.env.SALESFORCE_USERNAME,
      (process.env.SALESFORCE_PASSWORD || '') + (process.env.SALESFORCE_SECURITY_TOKEN || '')
    );
    status = { connected: true, enabled: true, lastSync: new Date().toISOString(), error: null };
    console.log('Salesforce connected');
    return status;
  } catch (err) {
    status = { connected: false, enabled: true, error: err.message };
    console.error('Salesforce connection failed:', err.message);
    throw err;
  }
}

function getSalesforceStatus() {
  return { ...status };
}

async function syncBookingToSalesforce(booking) {
  if (!conn || !status.connected) return null;

  try {
    const eventData = {
      Subject: `[Room Booking] ${booking.title}`,
      Location: booking.room_name,
      Description: booking.description || '',
      StartDateTime: booking.start_time,
      EndDateTime: booking.end_time,
      IsAllDayEvent: false
    };

    let result;
    if (booking.salesforce_event_id) {
      await conn.sobject('Event').update({ Id: booking.salesforce_event_id, ...eventData });
      result = { id: booking.salesforce_event_id };
    } else {
      result = await conn.sobject('Event').create(eventData);
    }

    status.lastSync = new Date().toISOString();
    return result;
  } catch (err) {
    console.error('Salesforce sync error:', err.message);
    return null;
  }
}

async function cancelSalesforceEvent(booking) {
  if (!conn || !status.connected || !booking.salesforce_event_id) return;

  try {
    await conn.sobject('Event').update({
      Id: booking.salesforce_event_id,
      Description: `[CANCELLED] ${booking.description || ''}`.trim()
    });
    status.lastSync = new Date().toISOString();
  } catch (err) {
    console.error('Salesforce cancel error:', err.message);
  }
}

// Attempt connection on startup
if (process.env.SALESFORCE_ENABLED === 'true') {
  connectSalesforce().catch(() => {});
}

module.exports = { connectSalesforce, getSalesforceStatus, syncBookingToSalesforce, cancelSalesforceEvent };
