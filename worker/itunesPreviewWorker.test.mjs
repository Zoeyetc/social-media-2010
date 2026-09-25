import assert from "node:assert/strict";
import { createWorker } from "./index.mjs";
import { ITUNES_TRACKS } from "../src/state/finalDecorativeApps.ts";

const origin = "https://staging.example.workers.dev";
const previewUrl = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/test.m4a";
const requests = [];
const worker = createWorker({ appleFetch: async (input) => {
  const url = new URL(input);
  requests.push(url);
  assert.equal(url.origin, "https://itunes.apple.com");
  assert.equal(url.searchParams.get("country"), "US");
  assert.equal(url.searchParams.get("media"), "music");
  assert.equal(url.searchParams.get("entity"), "song");
  const track = ITUNES_TRACKS.find(item => url.searchParams.get("term") === `${item.title} ${item.artist}`);
  assert.ok(track);
  const appleArtist = track.id === "like-a-g6" ? "Far East Movement, The Cataracs & DEV" : track.artist;
  return Response.json({ results: [
    { wrapperType: "track", kind: "song", country: "USA", trackName: `${track.title} (Remix)`, artistName: track.artist, previewUrl },
    { wrapperType: "track", kind: "song", country: "USA", trackName: track.title, artistName: "Cover Band", previewUrl },
    { wrapperType: "track", kind: "song", country: "GBR", trackName: track.title, artistName: appleArtist, previewUrl },
    { wrapperType: "track", kind: "song", country: "USA", trackName: track.title, artistName: appleArtist, previewUrl },
  ] });
} });
for (const track of ITUNES_TRACKS) {
  const response = await worker.fetch(new Request(`${origin}/api/itunes-preview/resolve?id=${track.id}`), {});
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].trackName, track.title);
  assert.equal(result.results[0].artistName, track.id === "like-a-g6" ? "Far East Movement, The Cataracs & DEV" : track.artist);
  assert.equal(result.results[0].previewUrl, previewUrl);
}
assert.equal(requests.length, 5);
const unknown = await worker.fetch(new Request(`${origin}/api/itunes-preview/resolve?id=unknown`), {});
assert.equal(unknown.status, 404);
assert.equal(requests.length, 5, "unknown IDs never reach Apple");
console.log("PASS: Worker US metadata lookup and exact title/artist filtering");
