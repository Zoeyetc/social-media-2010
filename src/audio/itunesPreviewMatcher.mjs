const normalize = value => value.toLocaleLowerCase("en-US").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
export function approvedPreviewURL(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "audio-ssl.itunes.apple.com" && !url.username && !url.password && !url.port && url.pathname.startsWith("/itunes-assets/AudioPreview");
  } catch { return false; }
}
export function matchesPreview(track, result) {
  if (result.wrapperType !== "track" || result.kind !== "song" || result.country !== "USA" || typeof result.trackName !== "string" || typeof result.artistName !== "string" || !approvedPreviewURL(result.previewUrl)) return false;
  if (typeof result.collectionName === "string" && /karaoke|tribute|\blive\b|re-record|taylor.s version/i.test(result.collectionName)) return false;
  const title = normalize(result.trackName), artist = normalize(result.artistName);
  if (track.id !== "like-a-g6") return title === normalize(track.title) && artist === normalize(track.artist);
  const match = title.match(/^like a g6(?: \(feat\. (?:the )?cataracs & dev\))?$/);
  if (!match) return false;
  const credits = artist.split(/,| & /).map(s => s.trim().replace(/^the cataracs$/, "cataracs")).sort();
  return JSON.stringify(credits) === JSON.stringify(["cataracs", "dev", "far east movement"]) || (artist === "far east movement" && title !== "like a g6");
}
