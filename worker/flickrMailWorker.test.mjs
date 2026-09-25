import assert from "node:assert/strict";
import { createWorker } from "./index.mjs";

const origin = "https://sm2010-hero-staging.example.workers.dev";
const env = {
  MAIL_API_KEY: "unit-test-api-key",
  MAIL_FROM: "sender@example.test",
  MAIL_REPLY_TO: "feedback@example.test",
  MAIL_RECIPIENT_ALLOWLIST: "recipient@example.test",
  MAIL_LIMIT_SECRET: "a".repeat(32),
  ASSETS: { fetch: async request => new Response(`asset:${new URL(request.url).pathname}`, { headers: { "Content-Type": "text/html" } }) },
};
const payload = (overrides = {}) => ({
  requestId: crypto.randomUUID(), sessionId: "worker-session", to: "recipient@example.test",
  subject: "A photo from Flickr", body: "Hello",
  image: { mediaId: "photo-1", filename: "photo.png", contentType: "image/png", base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jQ0cAAAAASUVORK5CYII=" },
  ...overrides,
});
const request = (path, body, headers = {}) => new Request(`${origin}${path}`, {
  method: body === undefined ? "GET" : "POST",
  headers: body === undefined ? headers : { Origin: origin, "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.10", ...headers },
  body: body === undefined ? undefined : JSON.stringify(body),
});

let providerCalls = [];
const worker = createWorker({ providerFetch: async (url, options) => {
  providerCalls.push({ url, options });
  return new Response(JSON.stringify({ id: "resend-test-id" }), { status: 200 });
} });

let response = await worker.fetch(request("/api/flickr-mail/config"), env);
assert.equal(response.status, 200);
assert.equal(response.headers.get("Cache-Control"), "no-store");
assert.deepEqual(await response.json(), { enabled: true, replyEnabled: true, mode: "real" });

const valid = payload();
response = await worker.fetch(request("/api/flickr-mail", valid), env);
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), { accepted: true, mode: "real" });
assert.equal(providerCalls.length, 1);
assert.equal(providerCalls[0].url, "https://api.resend.com/emails");
assert.equal(providerCalls[0].options.headers.Authorization, `Bearer ${env.MAIL_API_KEY}`);
await worker.fetch(request("/api/flickr-mail", valid), env);
assert.equal(providerCalls.length, 1, "same request must retain idempotency");

response = await createWorker({ providerFetch: () => assert.fail("invalid recipient must not reach provider") })
  .fetch(request("/api/flickr-mail", payload({ to: "outside@example.test" })), env);
assert.equal(response.status, 403);

const disabledEnv = { ...env, MAIL_API_KEY: "", MAIL_FROM: "", ASSETS: env.ASSETS };
response = await createWorker().fetch(request("/api/flickr-mail/config"), disabledEnv);
assert.deepEqual(await response.json(), { enabled: false, replyEnabled: true, mode: "unconfigured" });
response = await createWorker({ providerFetch: () => assert.fail("missing config must not reach provider") })
  .fetch(request("/api/flickr-mail", payload()), disabledEnv);
assert.equal(response.status, 503);

response = await createWorker().fetch(request("/api/flickr-mail", payload(), { Origin: "https://other.example" }), env);
assert.equal(response.status, 403);

const privateProviderError = "provider failed: unit-test-api-key recipient@example.test";
response = await createWorker({ providerFetch: async () => new Response(privateProviderError, { status: 500 }) })
  .fetch(request("/api/flickr-mail", payload()), env);
assert.equal(response.status, 502);
const safeFailure = JSON.stringify(await response.json());
assert.equal(safeFailure.includes(env.MAIL_API_KEY), false);
assert.equal(safeFailure.includes("recipient@example.test"), false);
assert.equal(safeFailure.includes(privateProviderError), false);

response = await worker.fetch(new Request(`${origin}/hero.html`), env);
assert.equal(response.status, 200);
assert.equal(response.headers.get("Cache-Control"), "no-store");
assert.equal(await response.text(), "asset:/hero");
response = await worker.fetch(new Request(`${origin}/index.html`), env);
assert.equal(response.status, 200);
assert.equal(response.headers.get("Cache-Control"), "no-store");
assert.equal(await response.text(), "asset:/");

console.log("PASS: Worker Flickr Mail config/send, allowlist, missing config, same-origin, provider redaction, idempotency, and HTML cache safety.");
