import { MAIL_IMAGE_MAX } from "../src/mail/flickrMailContract.ts";
import { MailError, createMailService, createResendTransport, readMailConfig } from "../server/flickrMail.mjs";

const MAX_REQUEST = Math.ceil(MAIL_IMAGE_MAX / 3) * 4 + 32768;
const JSON_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });

async function readJsonBody(request) {
  const declaredSize = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_REQUEST) throw new MailError(413, "The photo is too large.");
  if (!request.body) throw new MailError(400, "Invalid email request.");
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_REQUEST) {
      await reader.cancel();
      throw new MailError(413, "The photo is too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new MailError(400, "Invalid email request."); }
}

function htmlNoStore(response) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function createWorker({ providerFetch = fetch } = {}) {
  const services = new Map();
  const serviceFor = (env, origin) => {
    let entry = services.get(origin);
    if (!entry || entry.env !== env) {
      const config = readMailConfig(env, origin);
      entry = { env, service: createMailService({ config, transport: createResendTransport(config, providerFetch) }) };
      services.set(origin, entry);
    }
    return entry.service;
  };

  return {
    async fetch(request, env) {
      try {
        const url = new URL(request.url);
        const service = () => serviceFor(env, url.origin);
        if (url.pathname === "/api/flickr-mail/config") {
          if (request.method !== "GET") return json(405, { error: "Method not allowed." });
          return json(200, service().configuration());
        }
        if (url.pathname === "/api/flickr-mail") {
          if (request.method !== "POST") return json(405, { error: "Method not allowed." });
          if (request.headers.get("Origin") !== url.origin) throw new MailError(403, "Email request origin rejected.");
          if (!/^application\/json(?:;|$)/i.test(request.headers.get("Content-Type") ?? "")) throw new MailError(415, "Expected an email request.");
          const payload = await readJsonBody(request);
          const result = await service().send(payload, {
            ip: request.headers.get("CF-Connecting-IP") ?? "unknown",
            origin: request.headers.get("Origin"),
          });
          return json(200, result);
        }
        if (url.pathname.startsWith("/api/")) return json(404, { error: "Not found." });
        if (!["GET", "HEAD"].includes(request.method)) return json(405, { error: "Method not allowed." });
        const assetPath = url.pathname === "/hero.html" ? "/hero" : url.pathname === "/index.html" ? "/" : url.pathname;
        const assetRequest = assetPath === url.pathname ? request : new Request(new URL(assetPath, url), request);
        const asset = await env.ASSETS.fetch(assetRequest);
        return url.pathname === "/" || url.pathname.endsWith(".html") ? htmlNoStore(asset) : asset;
      } catch (error) {
        return json(error instanceof MailError ? error.status : 500, {
          error: error instanceof MailError ? error.message : "Email service unavailable.",
        });
      }
    },
  };
}

export default createWorker();
