import { createHmac } from "node:crypto";
import { MAIL_IMAGE_MAX, MAIL_BODY_MAX, MAIL_SUBJECT_MAX, memorialBody, validMailRecipient } from "../src/mail/flickrMailContract.ts";

export class MailError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new MailError(status, message); };
const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every(key => keys.includes(key));
const identifier = value => typeof value === "string" && /^[A-Za-z0-9:_-]{1,128}$/.test(value);

export function validateMailPayload(payload) {
  if (!exactKeys(payload, ["requestId", "sessionId", "to", "subject", "body", "image"])) fail(400, "Invalid email request.");
  if (!identifier(payload.requestId) || !identifier(payload.sessionId)) fail(400, "Invalid email request.");
  if (!validMailRecipient(payload.to)) fail(400, "Enter one valid recipient address.");
  if (typeof payload.subject !== "string" || !payload.subject.trim() || payload.subject.length > MAIL_SUBJECT_MAX || /[\r\n\0]/.test(payload.subject)) fail(400, "Invalid subject.");
  if (typeof payload.body !== "string" || payload.body.length > MAIL_BODY_MAX || payload.body.includes("\0")) fail(400, "The message is too long or invalid.");
  const image = payload.image;
  if (!exactKeys(image, ["mediaId", "filename", "contentType", "base64"]) || !identifier(image.mediaId)
    || typeof image.filename !== "string" || !/^[A-Za-z0-9 _.-]{1,100}\.(?:jpg|jpeg|png)$/i.test(image.filename)
    || !["image/jpeg", "image/png"].includes(image.contentType)) fail(400, "Invalid photo attachment.");
  if (typeof image.base64 !== "string" || image.base64.length > Math.ceil(MAIL_IMAGE_MAX / 3) * 4) fail(413, "The photo exceeds 6 MB.");
  if (!image.base64 || image.base64.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(image.base64)) fail(400, "Invalid photo attachment.");
  const bytes = Buffer.from(image.base64, "base64");
  if (!bytes.length || bytes.length > MAIL_IMAGE_MAX || bytes.toString("base64") !== image.base64) fail(413, "Invalid photo size.");
  const png = bytes.length >= 24 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg = bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes.at(-2) === 255 && bytes.at(-1) === 217;
  if (image.contentType === "image/png" ? !png : !jpeg) fail(400, "The attachment is not a supported photo.");
  if (png && (bytes.readUInt32BE(16) === 0 || bytes.readUInt32BE(20) === 0 || bytes.readUInt32BE(16) * bytes.readUInt32BE(20) > 40000000)) fail(400, "Photo dimensions are unsupported.");
  // This service never fetches a client-supplied URL or accepts SMTP headers/HTML.
  return { ...payload, image: { ...image }, subject: payload.subject.trim() };
}

export function readMailConfig(env = process.env) {
  const mode = env.MAIL_TRANSPORT === "mock" ? "mock" : "real";
  if (mode === "mock" && env.NODE_ENV === "production") throw new Error("Mock mail transport is forbidden in production.");
  const recipients = (env.MAIL_RECIPIENT_ALLOWLIST ?? "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  const from = env.MAIL_FROM ?? "";
  const replyTo = env.MAIL_REPLY_TO ?? "";
  if ((from && !validMailRecipient(from)) || (replyTo && !validMailRecipient(replyTo)) || recipients.some(x => !validMailRecipient(x))) throw new Error("Invalid server mail address configuration.");
  const secret = env.MAIL_LIMIT_SECRET ?? "";
  const origin = env.MAIL_ORIGIN ?? "http://127.0.0.1:5175";
  if (new URL(origin).origin !== origin) throw new Error("MAIL_ORIGIN must be one exact origin.");
  const provider = env.MAIL_PROVIDER ?? "resend";
  if (provider !== "resend") throw new Error("Unsupported mail provider; install a server-side adapter first.");
  const apiKey = env.MAIL_API_KEY ?? "";
  return { mode, provider, apiKey, from, replyTo, recipients, secret, origin,
    enabled: Boolean(from && recipients.length && secret.length >= 32 && (mode === "mock" || apiKey)) };
}

export function createResendTransport(config, request = fetch) {
  return { async sendMemorialEmail(message, idempotencyKey) {
    const response = await request("https://api.resend.com/emails", {
      method: "POST", signal: AbortSignal.timeout(15000),
      headers: { "Authorization": `Bearer ${config.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ from: `SOCIAL MEDIA, 2010 <${config.from}>`, to: [message.to], subject: message.subject, text: message.body,
        ...(config.replyTo ? { reply_to: config.replyTo } : {}), attachments: [{ filename: message.image.filename, content: message.image.base64 }] }),
    });
    const body = await response.json().catch(() => null);
    // Do not log or return provider responses containing addresses or credentials.
    if (!response.ok || typeof body?.id !== "string") fail(502, "Email delivery could not be confirmed. Please retry the same message.");
    return { accepted: true, mode: "real" };
  } };
}
export function createMockMailTransport() {
  return { async sendMemorialEmail() { return { accepted: false, mode: "mock" }; } };
}

// One-process v0.1 service. No recipient/body/image persistence or logging.
// Closed recipient pilot is mandatory; do not expose a general guest mail relay.
export function createMailService({ config, transport, now = Date.now }) {
  const buckets = new Map(), deliveries = new Map();
  const digest = value => createHmac("sha256", config.secret).update(value).digest("hex");
  const clean = () => {
    const t = now();
    for (const [key, b] of buckets) if (t >= b.until) buckets.delete(key);
    for (const [key, d] of deliveries) if (t >= d.until && !d.pending) deliveries.delete(key);
  };
  const quota = (key, limit) => {
    const b = buckets.get(key) ?? { count: 0, until: now() + 3600000 };
    if (b.count >= limit || buckets.size > 10000) fail(429, "Email limit reached. Please try later.");
    b.count++; buckets.set(key,b);
  };
  return {
    configuration() { return { enabled: config.enabled, replyEnabled: Boolean(config.replyTo), mode: config.enabled ? config.mode : "unconfigured" }; },
    async send(raw, { ip, origin }) {
      if (origin !== config.origin) fail(403, "Email request origin rejected.");
      if (!config.enabled) fail(503, "Email delivery is not configured yet.");
      clean(); quota(digest(`attempt:${ip}`), 30);
      const payload = validateMailPayload(raw);
      if (!config.recipients.includes(payload.to.toLowerCase())) fail(403, "Email delivery to this address is not enabled for this preview.");
      const key = digest(`${payload.sessionId}:${payload.requestId}`);
      const fingerprint = digest(JSON.stringify(payload));
      const existing = deliveries.get(key);
      if (existing && existing.fingerprint !== fingerprint) fail(409, "Retry must use the same message.");
      if (existing?.result) return existing.result;
      if (existing?.pending) return existing.pending;
      if (!existing) {
        quota(digest(`ip:${ip}`), 6); quota(digest(`session:${payload.sessionId}`), 3); quota("global", 30);
      }
      if (deliveries.size >= 10000) fail(429, "Email service is busy. Please try later.");
      const delivery = existing ?? { fingerprint, until: now() + 23 * 3600000, pending: null, result: null };
      deliveries.set(key, delivery);
      delivery.pending = Promise.resolve().then(() => transport.sendMemorialEmail({
        to: payload.to, subject: payload.subject, body: memorialBody(payload.body, Boolean(config.replyTo)), image: payload.image,
      }, `sm2010-${key}`)).then(result => {
        if (!result || typeof result.accepted !== "boolean" || !["real", "mock"].includes(result.mode)) fail(502, "Email delivery could not be confirmed. Please retry.");
        if (config.mode === "real" && (!result.accepted || result.mode !== "real")) fail(502, "Email delivery could not be confirmed. Please retry.");
        delivery.result = result; return result;
      }).catch(error => { throw error instanceof MailError ? error : new MailError(502, "Email delivery could not be confirmed. Please retry the same message."); })
        .finally(() => { delivery.pending = null; });
      return delivery.pending;
    },
  };
}
