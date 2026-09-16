import type { MediaAttachment } from "../state/mediaAttachment";

// Conservative functional reconstruction using the existing Photos list chrome.
export function MediaSourceChooser({ onSource, onCancel, requester }: { requester?: string; onSource: (source: "camera" | "library") => void; onCancel: () => void }) {
  if (requester === "flickr") return <section className="flickr-source-overlay" aria-label="Upload Photo" data-visual-status="RECONSTRUCTED">
    <div className="flickr-source-sheet">
      <button type="button" onClick={() => onSource("camera")}>Take Photo</button>
      <button type="button" onClick={() => onSource("library")}>Upload from Library</button>
      <button type="button" className="flickr-source-cancel" onClick={onCancel}>Cancel</button>
    </div>
  </section>;
  return <section className="photos-container media-source-chooser" aria-label="Attach Photo" data-visual-status="RECONSTRUCTED">
    <header className="photos-navigation-bar"><button type="button" className="photos-back-button" onClick={onCancel}>Cancel</button><strong>Photo</strong></header>
    <div className="photos-album-list">
      <button type="button" className="photos-album-row" onClick={() => onSource("camera")}><strong>Take Photo</strong></button>
      <button type="button" className="photos-album-row" onClick={() => onSource("library")}><strong>Choose from Camera Roll</strong></button>
    </div>
  </section>;
}

export function PendingMediaAttachment({ attachment, onRemove }: { attachment: MediaAttachment; onRemove: () => void }) {
  return <div className="pending-media-attachment" data-visual-status="RECONSTRUCTED">
    <img src={attachment.objectUrl} alt="Pending photo" />
    <button type="button" onClick={onRemove}>Remove Photo</button>
  </div>;
}
