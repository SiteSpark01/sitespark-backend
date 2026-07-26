require("dotenv").config();

const express = require("express");
const rateLimit = require("express-rate-limit");

const { validateSubmission } = require("./validate");
const { initDb, insertSubmission, markEmailSent } = require("./db");
const { sendNotificationEmail } = require("./mailer");

// Last-resort safety net — logs clearly instead of letting an unexpected
// error crash the whole process silently (which is what a 502 with no
// error detail usually means from the outside).
process.on("unhandledRejection", (err) => {
  console.error("Unhandled promise rejection:", err);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

const app = express();
app.use(express.json({ limit: "50kb" })); // small limit — this endpoint only ever needs a short form payload

// CORS — locked to the real site's domain(s), not left open to anyone.
// Set ALLOWED_ORIGIN as an env var once the site has a real domain;
// falls back to allowing localhost during development only.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim());

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Rate limit — stop the endpoint being spammed. 5 submissions per IP per 15 min
// is generous for a real visitor, tight enough to blunt abuse.
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { ok: false, error: "Too many submissions from this address. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.post("/api/start-project", submitLimiter, async (req, res) => {
  const result = validateSubmission(req.body);
  if (!result.ok) {
    return res.status(400).json({ ok: false, errors: result.errors });
  }

  const { data } = result;

  const submission = {
    name: data.name,
    email: data.email,
    projectType: data.projectType,
    message: data.message,
    ip: req.ip,
  };

  let id;
  try {
    id = await insertSubmission(submission);
  } catch (err) {
    console.error("Database insert failed:", err.message);
    return res.status(500).json({
      ok: false,
      errors: ["We couldn't save your submission right now. Please try again shortly."],
    });
  }

  // The submission is saved regardless of what happens next — an email
  // failure never means the lead itself is lost.
  try {
    await sendNotificationEmail(submission);
    await markEmailSent(id, true);
  } catch (err) {
    console.error(`Notification email failed for submission #${id}:`, err.message);
    await markEmailSent(id, false);
    return res.status(200).json({
      ok: true,
      warning: "Your submission was saved, but the notification email failed to send. We'll still see it.",
    });
  }

  return res.status(200).json({ ok: true });
});

app.get("/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;

// Turso needs the table to exist before the server accepts traffic —
// initDb() is a no-op if it's already there, so this is safe on every boot.
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`SiteSpark backend listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database on startup:", err.message);
    process.exit(1);
  });
