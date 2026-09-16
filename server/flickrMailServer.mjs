import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createMailService, readMailConfig, createResendTransport, createMockMailTransport, MailError } from "./flickrMail.mjs";
import { MAIL_IMAGE_MAX } from "../src/mail/flickrMailContract.ts";

const MAX_REQUEST = Math.ceil(MAIL_IMAGE_MAX / 3) * 4 + 32768;
export function createMailHttpHandler({ service, origin, dist = resolve("dist") }) {
  const json = (res, status, body) => { res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }); res.end(JSON.stringify(body)); };
  return async (req, res) => {
    try {
      const pathname = new URL(req.url, "http://localhost").pathname;
      if (pathname === "/api/flickr-mail/config" && req.method === "GET") return json(res, 200, service.configuration());
      if (pathname === "/api/flickr-mail" && req.method === "POST") {
        if (req.headers.origin !== origin) throw new MailError(403,"Email request origin rejected.");
        if (!/^application\/json(?:;|$)/i.test(req.headers["content-type"] ?? "")) throw new MailError(415,"Expected an email request.");
        if (Number(req.headers["content-length"]) > MAX_REQUEST) throw new MailError(413,"The photo is too large.");
        let size = 0; const parts = [];
        for await (const chunk of req) { size += chunk.length; if (size > MAX_REQUEST) throw new MailError(413,"The photo is too large."); parts.push(chunk); }
        let payload; try { payload = JSON.parse(Buffer.concat(parts).toString("utf8")); } catch { throw new MailError(400,"Invalid email request."); }
        // Socket peer is authoritative. Never trust user-controlled Forwarded headers.
        // Behind a proxy this deliberately shares the IP quota unless a trusted adapter is deployed.
        const result = await service.send(payload, { ip: req.socket.remoteAddress ?? "unknown", origin: req.headers.origin });
        return json(res, 200, result);
      }
      if (pathname.startsWith("/api/")) return json(res,404,{error:"Not found."});
      if (!["GET","HEAD"].includes(req.method)) return json(res,405,{error:"Method not allowed."});
      const root = resolve(dist), decoded = decodeURIComponent(pathname);
      let path = resolve(root, `.${decoded}`);
      if (!path.startsWith(root + sep) && path !== root) return json(res,404,{error:"Not found."});
      if (path === root || decoded === "/") path = resolve(root,"index.html");
      const info = await stat(path).catch(() => null);
      if (!info?.isFile()) return json(res,404,{error:"Not found."});
      const mime = {".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".png":"image/png", ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".svg":"image/svg+xml", ".mp4":"video/mp4", ".caf":"audio/x-caf"};
      res.writeHead(200,{"Content-Type":mime[extname(path).toLowerCase()] ?? "application/octet-stream", "X-Content-Type-Options":"nosniff"});
      res.end(req.method === "HEAD" ? undefined : await readFile(path));
    } catch (error) { if (!res.headersSent) json(res,error instanceof MailError ? error.status : 500,{error:error instanceof MailError ? error.message : "Email service unavailable."}); else res.end(); }
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = readMailConfig();
  const transport = config.mode === "mock" ? createMockMailTransport() : createResendTransport(config);
  const service = createMailService({ config, transport });
  const server = createServer(createMailHttpHandler({ service, origin: config.origin }));
  server.requestTimeout = 30000; server.headersTimeout = 15000;
  const host = process.env.MAIL_HOST ?? "127.0.0.1", port = Number(process.env.MAIL_PORT ?? 8788);
  if (config.mode === "mock" && !["127.0.0.1","::1"].includes(host)) throw new Error("Mock transport must bind to loopback only.");
  server.listen(port,host,() => console.log(`Flickr mail service: ${config.enabled ? config.mode : "unconfigured"}; listening on ${host}:${port}`));
}
