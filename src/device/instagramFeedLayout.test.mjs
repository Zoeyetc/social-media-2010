import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../styles/device.css", import.meta.url), "utf8");
const source = readFileSync(new URL("./InstagramContainer.tsx", import.meta.url), "utf8");
const rule = selector => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `missing ${selector}`);
  return match[1];
};

const feed = rule(".instagram-feed");
const post = rule(".instagram-feed > .instagram-photo-record");
const photo = rule(".instagram-feed .instagram-feed-photo");
const header = rule(".instagram-photo-record > header");
assert.match(feed, /width:\s*100%/);
assert.match(feed, /overflow-x:\s*hidden/);
assert.match(feed, /overflow-y:\s*auto/);
assert.match(post, /width:\s*100%/);
assert.match(post, /box-sizing:\s*border-box/);
assert.match(post, /margin-left:\s*0/);
assert.match(photo, /width:\s*calc\(100% - 15px\)/);
assert.match(photo, /aspect-ratio:\s*1\s*\/\s*1/);
assert.match(photo, /box-sizing:\s*border-box/);
assert.match(photo, /margin:\s*0 8px 0 7px/);
assert.match(header, /padding:\s*0 8px 0 7px/);
assert.equal(320 - 15 + 7 + 8, 320, "square photo and margins fit one 320px column");
assert.match(rule(".instagram-square-photo img"), /width:\s*100%;\s*height:\s*100%;\s*object-fit:\s*cover/);
assert.match(source, /feedRef\.current\.scrollLeft = 0/);
assert.match(source, /event\.currentTarget\.scrollLeft !== 0/);
assert.equal((source.match(/className="instagram-photo-record(?: is-known-account)?"/g) ?? []).length, 2, "known and local Feed posts share one wrapper class");
assert.equal((source.match(/className="instagram-square-photo instagram-feed-photo/g) ?? []).length, 3, "both Feed post types share the square photo contract");
console.log("PASS: one fixed 320px Instagram Feed column, shared header/photo origin, square image sizing, zero horizontal scroll");
