const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../office_booking.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initializeDatabase() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      salesforce_id TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'conference',
      capacity INTEGER DEFAULT 1,
      floor TEXT,
      amenities TEXT DEFAULT '[]',
      color TEXT DEFAULT '#2563eb',
      salesforce_id TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL REFERENCES rooms(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      recurrence_rule TEXT,
      recurrence_end DATETIME,
      parent_id INTEGER REFERENCES bookings(id),
      exception_date DATETIME,
      status TEXT NOT NULL DEFAULT 'confirmed',
      salesforce_event_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      booking_id INTEGER REFERENCES bookings(id),
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      target_role TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#6366f1',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_bookings_room_time ON bookings(room_id, start_time, end_time);
    CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
  `);

  // Safe migrations — ignore if column already exists
  try { db.exec('ALTER TABLE bookings ADD COLUMN outlook_event_id TEXT'); } catch {}
  try { db.exec('ALTER TABLE bookings ADD COLUMN tag_id INTEGER REFERENCES tags(id)'); } catch {}

  seedInitialData(db);
  console.log('Database initialized at', DB_PATH);
}

function seedInitialData(db) {
  const adminExists = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
  if (adminExists) return;

  const passwordHash = bcrypt.hashSync('Admin123!', 10);

  const insertUser = db.prepare(`
    INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)
  `);
  insertUser.run('Admin User', 'admin@company.com', passwordHash, 'admin');
  insertUser.run('Jane Secretary', 'secretary@company.com', bcrypt.hashSync('Secretary123!', 10), 'secretary');
  insertUser.run('Bob Manager', 'manager@company.com', bcrypt.hashSync('Manager123!', 10), 'manager');
  insertUser.run('Alice Staff', 'staff@company.com', bcrypt.hashSync('Staff123!', 10), 'staff');

  const insertRoom = db.prepare(`
    INSERT INTO rooms (name, type, capacity, floor, amenities, color) VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertRoom.run('Board Room', 'conference', 20, '10th Floor', JSON.stringify(['Projector', 'Video Conference', 'Whiteboard', 'Coffee Station']), '#2563eb');
  insertRoom.run('Meeting Room A', 'conference', 8, '5th Floor', JSON.stringify(['TV Screen', 'Whiteboard']), '#16a34a');
  insertRoom.run('Meeting Room B', 'conference', 6, '5th Floor', JSON.stringify(['TV Screen']), '#9333ea');
  insertRoom.run('Executive Office 1', 'office', 1, '12th Floor', JSON.stringify(['Standing Desk', 'Video Conference']), '#d97706');
  insertRoom.run('Training Room', 'conference', 30, '3rd Floor', JSON.stringify(['Projector', 'Whiteboard', '30 Computers']), '#dc2626');
  insertRoom.run('Quiet Room', 'office', 2, '7th Floor', JSON.stringify(['Standing Desks']), '#0891b2');

  console.log('Seed data inserted. Default admin: admin@company.com / Admin123!');
}

module.exports = { getDb, initializeDatabase };
