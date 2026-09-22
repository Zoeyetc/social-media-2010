import { Dispatch, useLayoutEffect, useRef } from "react";
import { FlickrEvent, FlickrPhoto, FlickrState, FlickrView, selectFlickrPhotos, selectFlickrNavigationPhotos } from "../state/flickrState";
import { useSessionIdentity } from "../state/sessionIdentity";
import { IOS4Input, IOS4Textarea } from "./IOS4KeyboardSystem";
import type { MediaAttachmentRequest } from "../state/mediaAttachment";
import "../styles/flickr.css";
import type { FlickrMailController } from "../mail/flickrMailController";
import { FlickrMailComposer } from "./FlickrMailComposer";
import { useRafScrollPersistence } from "./scrollPersistence";

type FlickrContainerProps = {
  state: FlickrState;
  mail?: FlickrMailController;
  dispatch: Dispatch<FlickrEvent>;
  elapsedMs?: number;
  experienceSessionId?: string | null;
  mediaAttachmentActive?: boolean;
  onRequestMedia?: (source: MediaAttachmentRequest["source"]) => void;
};
const labels = { all: "All Uploads", contacts: "From Your Contacts", own: "Your Photostream" } as const;
const date = (value: string) => new Date(value).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", month: "long", day: "numeric", year: "numeric" });
const Wordmark = () => <span className="flickr-wordmark">flick<b>r</b></span>;

export function FlickrContainer({ state, dispatch, mail, elapsedMs = 0, experienceSessionId, mediaAttachmentActive = false, onRequestMedia }: FlickrContainerProps) {
  const photostreamRef = useRef<HTMLDivElement>(null);
  const photostreamScroll = useRafScrollPersistence(state.photostreamScrollPosition, photostreamScrollPosition => dispatch({ type: "SET_SCROLL_POSITION", photostreamScrollPosition }));
  const swipe = useRef<{ x: number; moved: boolean } | null>(null);
  const identity = useSessionIdentity();
  const selected = state.photos.find(photo => photo.id === state.selectedPhotoId);
  const selectedSet = state.sets.find(set => set.id === state.currentSetId);
  const selectedComments = state.commentsState.filter(comment => comment.photoId === selected?.id);
  const view = state.currentView;
  const photos = selectFlickrPhotos(state);
  const sequence = selectFlickrNavigationPhotos(state);
  const index = sequence.findIndex(p => p.id === selected?.id);
  const contacts = selectFlickrPhotos(state, "recent");
  const slide = contacts[Math.floor(elapsedMs / 8000) % Math.max(1, contacts.length)];
  const owner = (p: FlickrPhoto) => p.ownerId === "session" ? identity.name : p.owner;
  const navigate = (next: "home" | "contacts" | "recent" | "activity" | "tags" | "favorites" | "search" | "upload") => dispatch({ type: "NAVIGATE", view: next });
  const open = (photo: FlickrPhoto, originView: FlickrView = view) => dispatch({ type: "OPEN_PHOTO", photoId: photo.id,
    origin: originView === "set" && selectedSet ? { view: "set", setId: selectedSet.id }
      : { view: (["home", "photostream", "recent", "favorites", "search", "tag"].includes(originView) ? originView : "recent") as "photostream" },
    photostreamScrollPosition: originView === "photostream" ? photostreamScroll.current() : 0 });
  const beginMedia = () => onRequestMedia?.("camera-or-library");
  const submitSearch = () => dispatch({ type: "SEARCH" });
  useLayoutEffect(() => {
    if (view === "photostream" && photostreamRef.current) photostreamRef.current.scrollTop = state.photostreamScrollPosition;
  }, [view, state.photostreamScrollPosition]);

  const title = view === "photostream" ? (state.ownerId === "session" ? `Hello, ${identity.name}` : state.photos.find(p => p.ownerId === state.ownerId)?.owner ?? "Photostream")
    : view === "photo" ? `${index + 1} of ${sequence.length}`
    : view === "set" ? selectedSet?.title : view === "tag" ? state.selectedTag
    : view === "compose-comment" ? "Comment" : view === "sets" ? "Sets & Tags"
    : view[0].toUpperCase() + view.slice(1);
  const back = () => {
    if (view === "photo") dispatch({ type: "BACK_FROM_PHOTO" });
    else if (view === "comments" || view === "compose-comment" || view === "fullscreen") dispatch({ type: "BACK_TO_PHOTO" });
    else if (view === "set" || view === "tags" || view === "tag") dispatch({ type: "SHOW_SETS" });
    else if (view === "sets" || view === "favorites") dispatch({ type: "SHOW_PHOTOSTREAM", ownerId: state.ownerId });
    else navigate("home");
  };
  const grid = (items: readonly FlickrPhoto[]) => items.length ? <div className={state.grid ? "flickr-grid" : "flickr-list"}>
    {items.map(photo => <button type="button" key={photo.id} onClick={() => open(photo)} aria-label={`Open ${photo.title} by ${owner(photo)}`}>
      <img src={photo.src} alt={photo.title} loading="lazy" />{!state.grid && <span><strong>{photo.title}</strong><small>{owner(photo)}</small></span>}
    </button>)}
  </div> : <p className="flickr-empty">No photos.</p>;

  if (mail?.state) return <FlickrMailComposer controller={mail} />;

  return <section className={`flickr-container${view === "fullscreen" ? " is-fullscreen" : ""}`} aria-label="Flickr" inert={mediaAttachmentActive} data-version="1.2" data-chrome-status="RECONSTRUCTED">
    {view !== "fullscreen" && <header className="flickr-nav">
      {view === "home" ? <span className="flickr-info" title="Account information unavailable">i</span> : view !== "search" && <button type="button" className="flickr-back" onClick={back}>{view === "compose-comment" ? "Cancel" : "Back"}</button>}
      {view === "home" || view === "search" ? <Wordmark /> : view === "recent" || view === "activity" ? <div className="flickr-segments"><button aria-pressed={view === "activity"} onClick={() => navigate("activity")}>Activity</button><button aria-pressed={view === "recent"} onClick={() => navigate("recent")}>Uploads</button></div> : <strong>{title}</strong>}
      {view === "home" && <button type="button" className="flickr-right flickr-upload-icon" aria-label="Upload Photo" onClick={() => state.pendingUpload || state.upload ? navigate("upload") : beginMedia()}><svg viewBox="0 0 28 24" aria-hidden="true"><path d="M2 8h6l2-4h9l2 4h5v14H2z" fill="#eee" stroke="#777"/><circle cx="14" cy="14" r="5" fill="#444"/><path d="M24 12V1m-4 4 4-4 4 4" fill="none" stroke="#174f86" strokeWidth="2"/></svg></button>}
      {view === "search" && <button className="flickr-right" onClick={() => navigate("home")}>Cancel</button>}
      {view === "photostream" && <button className="flickr-right" aria-label="Toggle grid and list" onClick={() => dispatch({ type: "TOGGLE_GRID" })}>▦</button>}
      {view === "comments" && <button className="flickr-right" onClick={() => dispatch({ type: "COMPOSE_COMMENT" })}>Comment</button>}
      {view === "compose-comment" && <button className="flickr-right" disabled={!state.commentDraft.trim()} onClick={() => dispatch({ type: "SUBMIT_COMMENT", author: identity.name })}>Post</button>}
    </header>}

    {view === "home" && <><button className="flickr-search-launch" onClick={() => navigate("search")}><span>⌕ Search</span></button>
      {slide && <button className="flickr-slideshow" onClick={() => open(slide, "home")}><img key={slide.id} src={slide.src} alt={slide.title} /><span>{owner(slide)}</span></button>}
      <nav className="flickr-home-buttons" aria-label="Flickr sections"><button onClick={() => navigate("recent")}>Recent</button><button onClick={() => dispatch({ type: "SHOW_PHOTOSTREAM" })}>You</button><button onClick={() => navigate("contacts")}>Contacts</button></nav></>}

    {view === "contacts" && <div className="flickr-scroll flickr-rows">{[...new Set(contacts.map(p => p.ownerId))].map(id => {
      const photo = contacts.find(p => p.ownerId === id)!;
      return <button key={id} onClick={() => dispatch({ type: "SHOW_PHOTOSTREAM", ownerId: id })}><img src={photo.src} alt="" /><strong>{photo.owner}</strong><span>›</span></button>;
    })}</div>}
    {view === "recent" && <div className="flickr-scroll">{[...new Set(contacts.map(p => date(p.uploadedAt)))].map(day => <div key={day} className="flickr-recent-group"><h2>{day}</h2><div>{contacts.filter(p => date(p.uploadedAt) === day).map(p => <button key={p.id} onClick={() => open(p)}><img src={p.src} alt={p.title} /></button>)}</div></div>)}</div>}
    {view === "activity" && <div className="flickr-scroll flickr-activity">{state.photos.filter(p => p.ownerId === "session" && state.commentsState.some(c => c.photoId === p.id)).map(p => <article key={p.id}><h2>{p.title}</h2>{state.commentsState.filter(c => c.photoId === p.id).map(c => <p key={c.id}><strong>{c.author}</strong>: {c.text}</p>)}</article>)}
      {!state.photos.some(p => p.ownerId === "session" && state.commentsState.some(c => c.photoId === p.id)) && <p className="flickr-empty">No recent activity.</p>}</div>}

    {view === "photostream" && <div className="flickr-scroll" ref={photostreamRef} onScroll={event => photostreamScroll.record(event.currentTarget.scrollTop)}>
      <div className="flickr-you-tiles"><button onClick={() => dispatch({ type: "SHOW_SETS" })}><span>▧</span>Sets &amp; Tags</button><button onClick={() => navigate("favorites")}><span>★</span>Favorites</button></div>
      <h2 className="flickr-section-label">{state.ownerId === "session" ? "YOUR PHOTOSTREAM" : "PHOTOSTREAM"}</h2>{grid(photos)}
    </div>}
    {view === "sets" && <div className="flickr-scroll flickr-rows"><button onClick={() => navigate("tags")}><strong>Tags</strong><span>›</span></button>{state.sets.filter(s => s.ownerId === state.ownerId).map(s => <button key={s.id} onClick={() => dispatch({ type: "OPEN_SET", setId: s.id })}><strong>{s.title}</strong><small>{s.photoIds.length} photos</small><span>›</span></button>)}{!state.sets.some(s => s.ownerId === state.ownerId) && <p className="flickr-empty">No sets.</p>}</div>}
    {view === "tags" && <div className="flickr-scroll flickr-rows">{[...new Set(state.photos.filter(p => p.ownerId === state.ownerId).flatMap(p => [...p.tags]))].map(tag => <button key={tag} onClick={() => dispatch({ type: "OPEN_TAG", tag })}>{tag}<span>›</span></button>)}</div>}
    {(view === "set" || view === "tag" || view === "favorites") && <div className="flickr-scroll">{grid(photos)}</div>}

    {view === "search" && <><div className="flickr-search-bar"><button aria-label="Search scope" onClick={() => dispatch({ type: "TOGGLE_SEARCH_SCOPE" })}>⌕ ▾</button>{!mediaAttachmentActive && <IOS4Input keyboardInputId="flickr-search" aria-label="Search Flickr" value={state.searchQuery} keyboardReturnKeyType="search" onKeyboardSubmit={submitSearch} onValueChange={value => dispatch({ type: "SEARCH_QUERY", value })} />}<button aria-label="Clear query" onClick={() => dispatch({ type: "SEARCH_QUERY", value: "" })}>×</button><button onClick={submitSearch}>Search</button></div>
      {state.searchScopeOpen && <div className="flickr-scope-menu">{(Object.keys(labels) as Array<keyof typeof labels>).map(scope => <button key={scope} aria-pressed={state.searchScope === scope} onClick={() => dispatch({ type: "SEARCH_SCOPE", scope })}>{labels[scope]}</button>)}</div>}
      <div className="flickr-scroll">{state.searchedQuery ? grid(photos) : <div className="flickr-rows">{state.recentSearches.map(q => <button key={q} onClick={() => dispatch({ type: "SEARCH", query: q })}>{q}</button>)}</div>}{state.recentSearches.length > 0 && <button className="flickr-clear-searches" onClick={() => dispatch({ type: "CLEAR_SEARCHES" })}>Clear Recent Searches</button>}</div></>}

    {view === "photo" && selected && <><article className="flickr-detail flickr-scroll">
      <button className="flickr-detail-image" onClick={() => dispatch({ type: "FULLSCREEN" })}><img src={selected.src} alt={selected.title} /></button><h1>{selected.title}</h1>
      <button className="flickr-owner" onClick={() => dispatch({ type: "SHOW_PHOTOSTREAM", ownerId: selected.ownerId })}>by {owner(selected)}</button>
      {selected.description && <p>{selected.description}</p>}<p className="flickr-date">Taken on {date(selected.takenAt)}<br />Uploaded {date(selected.uploadedAt)}</p>
      <p className="flickr-privacy">{selected.privacy === "private" ? "Only you can see this item" : "Anyone can see this item"}</p>
      <div className="flickr-tags">{selected.tags.map(tag => <button key={tag} onClick={() => { dispatch({ type: "SHOW_PHOTOSTREAM", ownerId: selected.ownerId }); dispatch({ type: "OPEN_TAG", tag }); }}>{tag}</button>)}</div>
      <button className="flickr-favorite" aria-pressed={state.favoritePhotoIds.includes(selected.id)} onClick={() => dispatch({ type: "TOGGLE_FAVORITE", photoId: selected.id })}>{state.favoritePhotoIds.includes(selected.id) ? "★ Unfavorite" : "☆ Favorite"}</button>
      <button className="flickr-comments-link" onClick={() => dispatch({ type: "OPEN_COMMENTS" })}>{selectedComments.length} comments</button>
    </article><div className="flickr-toolbar" role="toolbar" aria-label="Photo actions" data-disabled-style="RECONSTRUCTED">
      <button disabled={!mail || !experienceSessionId} aria-label="Email photo" onClick={() => { if (mail && experienceSessionId) void mail.open(selected, experienceSessionId); }}>
        <svg className="flickr-footer-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2 18C4 10 9 7 16 7V3L23 10L16 17V12C10 12 6 14 2 18Z" /></svg>
      </button>
      <button aria-label="Previous photo" disabled={index <= 0} onClick={() => dispatch({ type: "STEP_PHOTO", direction: -1 })}>
        <svg className="flickr-footer-icon is-navigation" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18 4L4 12L18 20Z" /></svg>
      </button>
      <button aria-label="Next photo" disabled={index < 0 || index >= sequence.length - 1} onClick={() => dispatch({ type: "STEP_PHOTO", direction: 1 })}>
        <svg className="flickr-footer-icon is-navigation" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 4L20 12L6 20Z" /></svg>
      </button>
      <button aria-label="Comment" onClick={() => dispatch({ type: "COMPOSE_COMMENT" })}>
        <svg className="flickr-footer-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fillRule="evenodd" d="M4 4H20Q22 4 22 6V15Q22 17 20 17H12L7 22V17H4Q2 17 2 15V6Q2 4 4 4ZM7 7V11H9Q9 13 7 14V15Q11 13 11 10V7ZM13 7V11H15Q15 13 13 14V15Q17 13 17 10V7Z" /></svg>
      </button>
    </div></>}

    {view === "fullscreen" && selected && <div className="flickr-fullscreen" onPointerDown={e => { swipe.current = { x: e.clientX, moved: false }; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerUp={e => {
      if (!swipe.current) return; const dx = e.clientX - swipe.current.x; swipe.current.moved = Math.abs(dx) > 35;
      if (swipe.current.moved) dispatch({ type: "STEP_PHOTO", direction: dx < 0 ? 1 : -1 });
    }} onClick={() => { if (!swipe.current?.moved) dispatch({ type: "TOGGLE_FULLSCREEN_CONTROLS" }); }}>
      <img src={selected.src} alt={selected.title} />{state.fullscreenControls && <div className="flickr-fullscreen-controls"><button onClick={e => { e.stopPropagation(); dispatch({ type: "BACK_TO_PHOTO" }); }}>Done</button><span>{index + 1} of {sequence.length}</span></div>}
    </div>}
    {view === "comments" && <div className="flickr-scroll flickr-comment-list">{selectedComments.length ? selectedComments.map(c => <article key={c.id}><strong>{c.author}</strong><p>{c.text}</p></article>) : <p className="flickr-empty">No comments.</p>}</div>}
    {view === "compose-comment" && selected && <div className="flickr-comment-composer">{!mediaAttachmentActive && <IOS4Textarea keyboardInputId={`flickr-comment-${selected.id}`} aria-label="Comment" value={state.commentDraft} onValueChange={value => dispatch({ type: "EDIT_COMMENT", value })} />}</div>}

    {view === "upload" && <div className="flickr-scroll flickr-upload" data-visual-status="RECONSTRUCTED">
      {state.upload ? <><p>Uploading 1 photo…</p><progress aria-label="Upload progress" max={3000} value={Math.max(0, 3000 - state.upload.dueElapsedMs + elapsedMs)} /><img className="flickr-upload-preview" src={state.upload.photo.src} alt="Uploading photo" /></>
      : <>{state.pendingUpload ? <><img className="flickr-upload-preview" src={state.pendingUpload.attachment.objectUrl} alt="Pending upload" /><p>{state.pendingUpload.attachment.filename}</p><button onClick={beginMedia}>Change Photo</button><button onClick={() => dispatch({ type: "REMOVE_PENDING" })}>Remove Photo</button></> : <><p>No photo selected.</p><button onClick={beginMedia}>Choose Photo</button><button onClick={() => dispatch({ type: "SHOW_PHOTOSTREAM" })}>Your Photostream</button></>}
        {!mediaAttachmentActive && <><label>Description<IOS4Textarea keyboardInputId="flickr-upload-description" value={state.uploadDraft.description} onValueChange={value => dispatch({ type: "EDIT_UPLOAD", field: "description", value })} /></label>
          <label>Tags<IOS4Input keyboardInputId="flickr-upload-tags" value={state.uploadDraft.tags} onValueChange={value => dispatch({ type: "EDIT_UPLOAD", field: "tags", value })} /></label></>}
        <button className="flickr-location" aria-pressed={state.uploadDraft.location} onClick={() => dispatch({ type: "TOGGLE_LOCATION" })}>Current Location <span>{state.uploadDraft.location ? "On" : "Off"}</span></button>
        <p className="flickr-date">Only you can see this item</p>
        <button className="flickr-publish" disabled={!state.pendingUpload || !experienceSessionId || elapsedMs + 3000 >= 900000} onClick={() => dispatch({ type: "BEGIN_UPLOAD", experienceSessionId: experienceSessionId!, elapsedMs, author: identity.name })}>Upload</button>
      </>}
    </div>}
  </section>;
}
