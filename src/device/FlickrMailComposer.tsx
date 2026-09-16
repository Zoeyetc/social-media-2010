import type { FlickrMailController } from "../mail/flickrMailController";
import { FLICKR_SIGNATURE, MAIL_BODY_MAX, MAIL_SUBJECT_MAX, memorialNote } from "../mail/flickrMailContract";
import { IOS4Input, IOS4Textarea } from "./IOS4KeyboardSystem";
import "../styles/flickrMail.css";

export function FlickrMailComposer({ controller }: { controller: FlickrMailController }) {
  const draft = controller.state;
  if (!draft) return null;
  const busy = draft.status === "sending";
  return <section className="flickr-mail" aria-label="Email photo" data-visual-status="RECONSTRUCTED">
    <header className="flickr-mail-nav"><button type="button" disabled={busy} onClick={() => controller.cancel()}>Cancel</button><strong>New Message</strong><button type="button" disabled={!controller.canSend} onClick={() => { void controller.send(); }}>{busy ? "Sending…" : "Send"}</button></header>
    <div className="flickr-mail-content">
      <label className="flickr-mail-row"><span>To:</span><IOS4Input keyboardInputId="flickr-mail-to" aria-label="To" autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={busy || draft.locked} value={draft.to} maxLength={254} onValueChange={value => controller.edit("to", value)} /></label>
      <label className="flickr-mail-row"><span>Subject:</span><IOS4Input keyboardInputId="flickr-mail-subject" aria-label="Subject" autoComplete="off" disabled={busy || draft.locked} value={draft.subject} maxLength={MAIL_SUBJECT_MAX} onValueChange={value => controller.edit("subject", value)} /></label>
      <div className="flickr-mail-message"><IOS4Textarea keyboardInputId="flickr-mail-body" aria-label="Message" disabled={busy || draft.locked} value={draft.body} maxLength={MAIL_BODY_MAX} onValueChange={value => controller.edit("body", value)} />
        <img className="flickr-mail-attachment" src={draft.photo.src} alt={draft.photo.title} data-media-id={draft.photo.mediaId} />
        <p>{FLICKR_SIGNATURE}</p>
        <p className="flickr-mail-note" data-content-layer="product">{memorialNote(draft.config?.replyEnabled ?? false)}</p>
      </div>
      {draft.error && <p className="flickr-mail-error" role="alert">{draft.error}{draft.locked && " Retry keeps the same message to avoid duplicate sending."}</p>}
      {busy && <p className="flickr-mail-status" role="status">Sending message…</p>}
    </div>
  </section>;
}
