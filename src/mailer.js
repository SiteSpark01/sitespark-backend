// Sends the lead-notification email via Resend's HTTPS API instead of
// Gmail SMTP. Render's free tier blocks outbound SMTP ports, which is why
// the old nodemailer/Gmail setup timed out on every send — Resend avoids
// that entirely since it's a normal HTTPS call (port 443), same as any
// other API request this server already makes.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || "SiteSpark <onboarding@resend.dev>";
const NOTIFY_TO = process.env.NOTIFY_TO;

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
  if (!RESEND_API_KEY) {
    throw new Error(
      "RESEND_API_KEY must be set as an environment variable — get this from your Resend dashboard."
    );
  }
  if (!NOTIFY_TO) {
    throw new Error("NOTIFY_TO must be set as an environment variable — the address that should receive lead notifications.");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: NOTIFY_TO,
      reply_to: submission.email, // reply goes straight to the client, not back to yourself
      subject: `New project inquiry — ${submission.name}`,
      text: buildEmailBody(submission),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error (${res.status}): ${body || res.statusText}`);
  }
}

module.exports = { sendNotificationEmail };
