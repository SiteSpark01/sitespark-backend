const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_PROJECT_TYPES = ["website", "web-application", "not-sure"];

/**
 * Validates and normalizes a raw request body.
 * Returns { ok: true, data } or { ok: false, errors: string[] }.
 * Never trusts anything from the client without checking it here first.
 */
function validateSubmission(body) {
  const errors = [];
  const data = {};

  const name = String(body.name || "").trim();
  if (!name || name.length > 200) errors.push("Name is required and must be under 200 characters.");
  data.name = name;

  const email = String(body.email || "").trim();
  if (!EMAIL_RE.test(email)) errors.push("A valid email address is required.");
  data.email = email;

  const projectType = String(body.projectType || "");
  if (!VALID_PROJECT_TYPES.includes(projectType)) errors.push("Invalid project type.");
  data.projectType = projectType;

  const message = String(body.message || "").trim();
  if (!message || message.length > 5000) errors.push("Message is required and must be under 5000 characters.");
  data.message = message;

  return errors.length ? { ok: false, errors } : { ok: true, data };
}

module.exports = { validateSubmission };
