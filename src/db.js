const { createClient } = require("@libsql/client");

const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
  throw new Error(
    "TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set as environment variables — get these from your Turso dashboard after creating a database."
  );
}

const client = createClient({
  url: TURSO_DATABASE_URL,
  authToken: TURSO_AUTH_TOKEN,
});

// Runs once at startup — safe to call every boot, CREATE TABLE IF NOT EXISTS
// is a no-op if the table already exists.
async function initDb() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      project_type TEXT NOT NULL,
      message TEXT NOT NULL,
      email_sent INTEGER NOT NULL DEFAULT 0,
      ip TEXT
    )
  `);
}

async function insertSubmission(data) {
  const result = await client.execute({
    sql: `
      INSERT INTO submissions
        (name, email, project_type, message, email_sent, ip)
      VALUES
        (?, ?, ?, ?, ?, ?)
    `,
    args: [
      data.name,
      data.email,
      data.projectType,
      data.message,
      data.emailSent ? 1 : 0,
      data.ip || null,
    ],
  });
  return Number(result.lastInsertRowid);
}

async function markEmailSent(id, sent) {
  await client.execute({
    sql: `UPDATE submissions SET email_sent = ? WHERE id = ?`,
    args: [sent ? 1 : 0, id],
  });
}

module.exports = { client, initDb, insertSubmission, markEmailSent };
