// Shared payload rules only. Provider credentials and transport live in server/.
export const MAIL_SUBJECT = "A photo from Flickr";
export const FLICKR_SIGNATURE = "Sent from Flickr for iPhone";
export const MAIL_IMAGE_MAX = 6 * 1024 * 1024;
export const MAIL_SUBJECT_MAX = 160;
export const MAIL_BODY_MAX = 4000;
export function validMailRecipient(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(value);
}
export function memorialNote(replyEnabled: boolean): string {
  return "—\nSent from SOCIAL MEDIA, 2010\n\nThis message was created during an interactive reconstruction of social media in 2010.\n\n"
    + (replyEnabled ? "If you have feedback, you’re welcome to reply to this email." : "Replies to this email are not monitored.");
}
export function memorialBody(body: string, replyEnabled: boolean): string {
  // The product note and historical signature are server-owned, each appended once.
  const clean = body.split("—\nSent from SOCIAL MEDIA, 2010")[0].split(FLICKR_SIGNATURE).join("").trim();
  return [clean, FLICKR_SIGNATURE, memorialNote(replyEnabled)].filter(Boolean).join("\n\n");
}
export type MailImage = { mediaId: string; filename: string; contentType: string; base64: string };
export type MailPayload = { requestId: string; sessionId: string; to: string; subject: string; body: string; image: MailImage };
export type MailConfiguration = { enabled: boolean; replyEnabled: boolean; mode: "real" | "mock" | "unconfigured" };
export type MailResult = { accepted: boolean; mode: "real" | "mock" };
