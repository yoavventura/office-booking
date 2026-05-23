# Office & Conference Room Booking System

A full-stack booking system for corporate offices, built with React + Node.js.
Integrates with Salesforce CRM and features conflict detection, recurring bookings, and role-based notifications.

## Prerequisites

Install **Node.js 20 LTS** from https://nodejs.org before running anything.

---

## Quick Start

### 1. Set up the backend

```cmd
cd backend
npm install
copy .env.example .env
```

Edit `.env` if you want to change the port or add Salesforce credentials.

```cmd
npm run dev
```

The API will start at http://localhost:3001

### 2. Set up the frontend (new terminal)

```cmd
cd frontend
npm install
npm run dev
```

The app will open at http://localhost:5173

---

## Default Accounts

| Role      | Email                     | Password        |
|-----------|---------------------------|-----------------|
| Admin     | admin@company.com         | Admin123!       |
| Secretary | secretary@company.com     | Secretary123!   |
| Manager   | manager@company.com       | Manager123!     |
| Staff     | staff@company.com         | Staff123!       |

---

## Role Permissions

| Feature                        | Staff | Manager | Secretary | Admin |
|-------------------------------|-------|---------|-----------|-------|
| View own bookings on calendar  | ✅    | ✅      | ✅        | ✅    |
| View ALL bookings on calendar  | ❌    | ❌      | ✅        | ✅    |
| Create bookings                | ✅    | ✅      | ✅        | ✅    |
| Edit/cancel any booking        | ❌    | ❌      | ✅        | ✅    |
| Add/edit rooms                 | ❌    | ❌      | ✅        | ✅    |
| Manage users                   | ❌    | ❌      | ❌        | ✅    |
| Salesforce sync settings       | ❌    | ❌      | ❌        | ✅    |
| Receive booking notifications  | own   | own     | all       | all   |

---

## Features

### Conflict Prevention
- The system checks for overlapping bookings before confirming any reservation.
- For recurring bookings, every instance in the series is checked against all existing bookings.
- If a conflict is found, the booking is rejected with a clear message showing who has the room and when.

### Recurring Bookings
- Supports: Daily, Weekly (choose specific days), Monthly, Yearly
- Series can end: Never / On a specific date / After N occurrences
- Recurring events show a ↻ icon on the calendar

### Notifications (checked every hour, displayed in-app)
- **New booking created** → all Secretaries and Admins notified
- **Booking modified** → booking owner + Secretaries/Admins notified
- **Booking cancelled** → booking owner + Secretaries/Admins notified
- **Reminder** → booking owner notified 24h before each occurrence
- Notification bell in the header shows unread count (updates every 30 seconds)

### Salesforce Integration
Set these in `backend/.env` to enable:
```
SALESFORCE_ENABLED=true
SALESFORCE_USERNAME=your@org.com
SALESFORCE_PASSWORD=yourpassword
SALESFORCE_SECURITY_TOKEN=yourtoken
SALESFORCE_LOGIN_URL=https://login.salesforce.com
```
When enabled, bookings are automatically synced as Salesforce Events.

---

## Project Structure

```
backend/
  server.js                  — Express app entry point
  src/
    database/db.js           — SQLite schema + seed data
    middleware/auth.js       — JWT authentication + role checking
    routes/
      auth.js                — Login / logout / me
      bookings.js            — Booking CRUD + conflict detection
      rooms.js               — Room management
      notifications.js       — Notification management
      users.js               — User management (admin only)
      salesforce.js          — Salesforce sync status
    services/
      notificationService.js — Background reminder jobs (node-cron)
      salesforceService.js   — jsforce Salesforce integration

frontend/
  src/
    contexts/
      AuthContext.jsx        — Current user + login/logout
      NotificationContext.jsx — Notification state + polling
    components/
      Layout/Layout.jsx      — Sidebar + header shell
      Calendar/BookingCalendar.jsx — FullCalendar main view
      BookingModal/BookingModal.jsx — Create/edit booking form
      NotificationCenter/    — Bell icon + dropdown
    pages/
      Login.jsx              — Login screen
      Dashboard.jsx          — Calendar page
      Admin.jsx              — Room + user management
```

---

## Embedding in Salesforce

To embed this app inside Salesforce as a Lightning component:

1. Deploy the backend to a public URL (e.g., Azure App Service, AWS, Render)
2. Deploy the frontend as a static build (`npm run build`)
3. In Salesforce Setup → Visualforce Pages, create a page with an `<iframe>` pointing to your frontend URL
4. Or use a Lightning Web Component with `<iframe>` in an HTML template

The app authenticates via its own JWT cookie system, independent of Salesforce login.
For full SSO, the Salesforce OAuth flow can be added to `backend/src/routes/salesforce.js`.
