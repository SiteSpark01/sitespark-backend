const nodemailer = require("nodemailer");

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const NOTIFY_TO = process.env.NOTIFY_TO || GMAIL_USER;

let transporter = null;

function getTransporter() {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error(
      "GMAIL_USER and GMAIL_APP_PASSWORD must be set as environment variables — never hardcode these."
    );
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });
  }
  return transporter;
}

function buildEmailBody(submission) {
  return `
New project inquiry from the SiteSpark website

Name: ${submission.name}
Email: ${submission.email}
Project type: ${submission.projectType}

Message:
${submission.message}

—
Reply directly to this email to respond to ${submission.name}.
  `.trim();
}

/**
 * Sends the notification email. Throws on failure — caller decides how
 * to handle that (submission is still saved to the DB either way, so
 * nothing is lost even if the email send fails).
 */
async function sendNotificationEmail(submission) {
  const mailer = getTransporter();

  await mailer.sendMail({
    from: `"SiteSpark" <${GMAIL_USER}>`,
    to: NOTIFY_TO,
    replyTo: submission.email, // reply in Gmail goes straight to the client, not back to yourself
    subject: `New project inquiry — ${submission.name}`,
    text: buildEmailBody(submission),
  });
}

module.exports = { sendNotificationEmail };
