import { Dispatch, useLayoutEffect, useRef } from "react";
import { TumblrEvent, TumblrPost, TumblrState, TumblrReblog, tumblrMyPosts } from "../state/tumblrState";
import { simulatedClock } from "../state/deviceMachine";
import { useSessionIdentity } from "../state/sessionIdentity";
import { IOS4Input, IOS4Textarea } from "./IOS4KeyboardSystem";

type TumblrContainerProps = {
  state: TumblrState;
  dispatch: Dispatch<TumblrEvent>;
  currentElapsedMs: number;
  mediaAttachmentActive?: boolean;
  onRequestMedia: (contextId: string) => void;
};

function parsePostTimestamp(timestamp: string) {
  const ms = Date.parse(timestamp);
  return Number.isFinite(ms) ? ms : 0;
}

function postsInReverseChronologicalOrder(posts: readonly TumblrPost[]) {
  return [...posts].sort((left, right) => parsePostTimestamp(right.timestamp) - parsePostTimestamp(left.timestamp));
}

export function TumblrContainer({ state, dispatch, currentElapsedMs, mediaAttachmentActive = false, onRequestMedia }: TumblrContainerProps) {
  const dashboardRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const identity = useSessionIdentity();
  const selected = state.posts.find(post => post.id === state.selectedPostId) ?? null;
  const selectedReblog = selected ? state.reblogs.find(reblog => reblog.sourcePostId === selected.id) ?? null : null;
  const selectedNotes = selected ? state.notes.filter(note => note.sourcePostId === selected.id) : [];
  const query = state.searchQuery.trim().toLocaleLowerCase();
  const dashboardEntries = (state.dashboardSegment === "my-posts" ? tumblrMyPosts(state)
    : postsInReverseChronologicalOrder(state.posts).map(post => ({ post, reblog: undefined as TumblrReblog | undefined })))
    .filter(({ post, reblog }) => !query || `${post.blog} ${post.title} ${post.content} ${reblog?.optionalUserText ?? ""}`.toLocaleLowerCase().includes(query));
  const composing = state.currentView === "post" && state.composerKind !== null;
  const canPublish = !mediaAttachmentActive && (state.composerKind === "photo" ? Boolean(state.pendingAttachment) : state.composerTitle.trim().length > 0 || state.composerContent.trim().length > 0);

  useLayoutEffect(() => {
    if (state.currentView !== "dashboard" || !dashboardRef.current) return;
    dashboardRef.current.scrollTop = state.dashboardScrollPosition;
  }, [state.currentView, state.dashboardScrollPosition]);

  const submitText = () => dispatch({
    type: "SUBMIT_COMPOSER_POST",
    author: identity.name,
    publishedAtMs: currentElapsedMs,
    submissionToken: state.composerSubmissionToken,
  });

  return <section className="tumblr-container" aria-label="Tumblr" inert={mediaAttachmentActive} data-chrome-status="EVIDENCE-BACKED BEST FIT">
    <header className="tumblr-navigation-bar">
      {state.currentView === "dashboard" && <>
        <button type="button" className="tumblr-nav-left tumblr-nav-icon" aria-label="Refresh" onClick={() => {
          if (dashboardRef.current) dashboardRef.current.scrollTop = 0;
          dispatch({ type: "SET_DASHBOARD_SCROLL_POSITION", dashboardScrollPosition: 0 });
        }}><TumblrIcon name="refresh" /></button>
        <button type="button" className="tumblr-nav-right tumblr-nav-icon" aria-label="Search" aria-controls="tumblr-dashboard-search" onClick={() => searchRef.current?.focus()}><TumblrIcon name="search" /></button>
      </>}
      {(state.currentView === "reblog" || state.currentView === "notes") && <button type="button" className="tumblr-nav-left" onClick={() => dispatch({ type: "BACK_TO_POST" })}>Post</button>}
      {state.currentView === "post" && !composing && <button type="button" className="tumblr-nav-left" onClick={() => dispatch({ type: "BACK_TO_DASHBOARD" })}>Dashboard</button>}
      {composing && <>
        <button type="button" className="tumblr-nav-left" onClick={() => dispatch({ type: "CANCEL_COMPOSER" })}>Cancel</button>
        <button type="button" className="tumblr-nav-right" disabled={!canPublish} onClick={submitText}>Post</button>
      </>}
      <strong>{viewTitle(state)}</strong>
    </header>

    {state.currentView === "dashboard" && <>
      <div className="tumblr-search-bar">
        <TumblrIcon name="search" />
        {!mediaAttachmentActive && <IOS4Input ref={searchRef} id="tumblr-dashboard-search" keyboardInputId="tumblr-search" aria-label="Search Tumblr" placeholder="Search"
          value={state.searchQuery} keyboardReturnKeyType="search" keyboardDismissOnSubmit
          onValueChange={value => dispatch({ type: "SEARCH_QUERY", value })} />}
        <button type="button" disabled={!state.searchQuery} aria-label="Clear search" onClick={() => dispatch({ type: "SEARCH_QUERY", value: "" })}>×</button>
      </div>
      <div className="tumblr-dashboard-segments" role="group" aria-label="Dashboard sections">
        <button type="button" disabled>Tumblr</button>
        <button type="button" aria-pressed={state.dashboardSegment === "dashboard"} onClick={() => dispatch({ type: "SELECT_DASHBOARD_SEGMENT", segment: "dashboard" })}>Dashboard</button>
        <button type="button" aria-pressed={state.dashboardSegment === "my-posts"} onClick={() => dispatch({ type: "SELECT_DASHBOARD_SEGMENT", segment: "my-posts" })}>My Posts</button>
      </div>
      <div
        ref={dashboardRef}
        className="tumblr-dashboard"
        onScroll={event => dispatch({ type: "SET_DASHBOARD_SCROLL_POSITION", dashboardScrollPosition: event.currentTarget.scrollTop })}
      >
        {dashboardEntries.map(({ post, reblog }) => <PostRow
          key={reblog?.id ?? post.id}
          reblog={reblog}
          post={post}
          notesCount={state.notes.filter(note => note.sourcePostId === post.id).length}
          isLiked={state.likedPostIds.includes(post.id)}
          isReblogged={state.rebloggedPostIds.includes(post.id)}
          onOpen={() => dispatch({
            type: "OPEN_POST",
            postId: post.id,
            dashboardScrollPosition: dashboardRef.current?.scrollTop ?? state.dashboardScrollPosition,
          })}
        />)}
        {state.dashboardSegment === "my-posts" && dashboardEntries.length === 0 && <p className="tumblr-empty">No posts.</p>}
      </div>
    </>}

    {state.currentView === "post-types" && <section className="tumblr-post-type-selector" aria-label="Post types">
      {POST_TYPES.map(kind => <button
        type="button"
        key={kind}
        className={kind === "Photo" ? "tumblr-photo-row" : undefined}
        disabled={kind !== "Text" && kind !== "Photo"}
        onClick={kind === "Text" ? () => dispatch({ type: "OPEN_COMPOSER", kind: "text" }) : kind === "Photo" ? () => {
          dispatch({ type: "OPEN_COMPOSER", kind: "photo" });
          onRequestMedia(`photo:${state.composerSubmissionToken + 1}`);
        } : undefined}
      ><PostStamp kind={kind} /><span>{kind}</span></button>)}
    </section>}

    {composing && <section className="tumblr-composer">
      {state.composerKind === "text" && <button type="button" className="tumblr-advanced-row" disabled data-evidence-status="HOLD">Close advanced options</button>}
      {state.composerKind === "photo" && <div className="tumblr-photo-preview">
        {state.pendingAttachment && <img src={state.pendingAttachment.objectUrl} alt="Pending photo" />}
        <button type="button" onClick={() => onRequestMedia(`photo:${state.composerSubmissionToken}`)}>{state.pendingAttachment ? "Change Photo" : "Choose Photo"}</button>
      </div>}
      <form onSubmit={event => { event.preventDefault(); submitText(); }}>
        {!mediaAttachmentActive && state.composerKind === "text" && <IOS4Input
          keyboardInputId="tumblr-composer-title-text"
          aria-label="Title"
          value={state.composerTitle}
          onValueChange={value => dispatch({ type: "EDIT_COMPOSER_TITLE", value })}
          maxLength={60}
          placeholder="Title"
        />}
        {!mediaAttachmentActive && <IOS4Textarea
          keyboardInputId={state.composerKind === "photo" ? "tumblr-photo-caption" : "tumblr-composer-text"}
          id="tumblr-composer-text"
          aria-label={state.composerKind === "photo" ? "Caption" : "Body"}
          maxLength={280}
          value={state.composerContent}
          onValueChange={value => dispatch({ type: "EDIT_COMPOSER_CONTENT", value })}
          placeholder={state.composerKind === "photo" ? "Caption" : "Body"}
        />}
      </form>
    </section>}

    {state.currentView === "settings" && <section className="tumblr-settings" aria-label="Settings" data-evidence-status="RECONSTRUCTED">
      <h2>Account</h2>
      <dl><div><dt>Blog</dt><dd>{identity.name}</dd></div></dl>
    </section>}

    {state.currentView === "post" && !composing && selected && <article className="tumblr-post-detail">
      <PostContent post={selected} />
      {selectedReblog?.optionalUserText && <section className="tumblr-reblog-summary">
        <strong>Reblogged by {selectedReblog.rebloggedBy}</strong>
        <p>{selectedReblog.optionalUserText}</p>
      </section>}
      <div className="tumblr-actions">
        <button type="button" onClick={() => dispatch({ type: "TOGGLE_LIKE", postId: selected.id, blogName: identity.name })}>
          {state.likedPostIds.includes(selected.id) ? "Unlike" : "Like"}
        </button>
        <button type="button" onClick={() => dispatch(state.rebloggedPostIds.includes(selected.id)
          ? { type: "REMOVE_REBLOG", postId: selected.id }
          : { type: "OPEN_REBLOG", postId: selected.id })}>
          {state.rebloggedPostIds.includes(selected.id) ? "Unreblog" : "Reblog"}
        </button>
        <button type="button" onClick={() => dispatch({ type: "OPEN_NOTES", postId: selected.id })}>Notes ({selectedNotes.length})</button>
        <button type="button" onClick={() => dispatch({ type: "BACK_TO_DASHBOARD" })}>Back</button>
      </div>
    </article>}

    {state.currentView === "reblog" && selected && <section className="tumblr-reblog-flow">
      <PostContent post={selected} />
      <form onSubmit={event => {
        event.preventDefault();
        dispatch({ type: "CONFIRM_REBLOG", rebloggedBy: identity.name, actionElapsedMs: currentElapsedMs });
      }}>
        <label htmlFor={`tumblr-reblog-${selected.id}`}>Add text (optional)</label>
        <IOS4Textarea
          keyboardInputId={`tumblr-reblog-${selected.id}`}
          id={`tumblr-reblog-${selected.id}`}
          maxLength={140}
          value={state.reblogDraft}
          onValueChange={value => dispatch({ type: "EDIT_REBLOG_TEXT", value })}
        />
        <div>
          <button type="button" onClick={() => dispatch({ type: "CANCEL_REBLOG" })}>Cancel</button>
          <button type="submit">Reblog</button>
        </div>
      </form>
    </section>}

    {state.currentView === "notes" && selected && <section className="tumblr-notes" data-copy-status="RECONSTRUCTED">
      <h2 className="tumblr-notes-heading">{selectedNotes.length} notes on {selected.title || "Photo"}</h2>
      {selectedNotes.length === 0
        ? <p>No notes.</p>
        : selectedNotes.map(note => <article key={note.id} data-origin={note.origin}>
          <strong>@{note.blogName}</strong>
          <span>{note.type === "liked" ? "liked this" : "reblogged this"}</span>
        </article>)}
    </section>}
    {!composing && <nav className="tumblr-tab-bar" aria-label="Tumblr tabs">
      {TABS.map(tab => <button
        type="button"
        key={tab.view}
        aria-current={(state.currentView === tab.view || (tab.view === "dashboard" && ["post", "notes", "reblog"].includes(state.currentView))) ? "page" : undefined}
        onClick={() => dispatch({ type: "SELECT_TAB", tab: tab.view })}
      ><TumblrIcon name={tab.icon} /><span>{tab.label}</span></button>)}
    </nav>}
  </section>;
}

function PostContent({ post }: { post: TumblrPost }) {
  return <>
    <header className="tumblr-post-author">
      <strong>@{post.blog}</strong>
      <p>{post.timestamp}</p>
    </header>
    <section className={`tumblr-post-body is-${post.type}`}>
      {post.title && <h2>{post.title}</h2>}
      {post.attachment && <img className="tumblr-published-photo" src={post.attachment.objectUrl} alt={post.content || "Photo"} />}
      <p>{post.content}</p>
    </section>
  </>;
}

function PostRow({ post, reblog, notesCount, isLiked, isReblogged, onOpen }: {
  post: TumblrPost;
  reblog?: TumblrReblog;
  notesCount: number;
  isLiked: boolean;
  isReblogged: boolean;
  onOpen: () => void;
}) {
  return <button
    type="button"
    className="tumblr-post-row"
    onClick={onOpen}
  >
    {reblog && <span className="tumblr-reblog-attribution">{reblog.rebloggedBy} reblogged {post.blog} · {simulatedClock(reblog.actionTimestamp)}</span>}
    {reblog?.optionalUserText && <p className="tumblr-reblog-caption">{reblog.optionalUserText}</p>}
    <span className="tumblr-feed-byline"><span>{post.blog}</span><span className="tumblr-notes-count">{notesCount} notes</span></span>
    {post.title && <strong>{post.title}</strong>}
    {post.attachment && <img className="tumblr-published-photo" src={post.attachment.objectUrl} alt={post.content || "Photo"} />}
    <p className={`tumblr-feed-body is-${post.type}`}>{post.content}</p>
    <span className="tumblr-feed-meta">{post.timestamp}{isLiked ? " · Liked" : ""}{isReblogged ? " · Reblogged" : ""}</span>
  </button>;
}

function viewTitle(state: TumblrState): string {
  switch (state.currentView) {
    case "dashboard": return "Dashboard";
    case "post-types": return "Post";
    case "settings": return "Settings";
    case "post": return state.composerKind === "text" ? "Text" : state.composerKind === "photo" ? "Photo" : "Post";
    case "reblog": return "Reblog";
    case "notes": return "Notes";
  }
}

const POST_TYPES = ["Text", "Photo", "Quote", "Link", "Chat", "Audio", "Video"] as const;
const TABS = [
  { view: "post-types", label: "Post", icon: "post" },
  { view: "dashboard", label: "Dashboard", icon: "dashboard" },
  { view: "settings", label: "Settings", icon: "settings" },
] as const;

type TumblrIconName = "text" | "photo" | "quote" | "link" | "chat" | "audio" | "video" | "post" | "dashboard" | "settings" | "refresh" | "search";

// RECONSTRUCTED artwork; no modern icon library or claimed exact raster provenance.
function TumblrIcon({ name }: { name: TumblrIconName }) {
  if (name === "post") return <svg className="tumblr-icon is-post" viewBox="-1 0 34 38" aria-hidden="true" focusable="false">
    <path transform="translate(0 1) rotate(-28 18 19)" fill="currentColor"
      d="M8.5 6.5 Q8 6.5 8 7 L8.5 8.3 L14.5 8.3 L15.2 20.7 L12.7 22.2 Q12.4 22.6 13 22.8 L17.3 22.8 L18 32 L18.7 22.8 L23 22.8 Q23.6 22.6 23.3 22.2 L20.8 20.7 L21.5 8.3 L27.5 8.3 L28 7 Q28 6.5 27.5 6.5 Z" />
  </svg>;
  const paths: Record<Exclude<TumblrIconName, "post">, string> = {
    text: "M3 27 12 5h5l9 22h-6l-2-6H10l-2 6Zm9-10h5l-2.5-7Z",
    photo: "M3 8h7l2-3h8l2 3h7v20H3Zm13 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm0 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z",
    quote: "M4 7h10v11l-7 8H3l5-8H4Zm15 0h10v11l-7 8h-4l5-8h-4Z",
    link: "M14 8 18 4a7 7 0 0 1 10 10l-6 6-3-3 6-6a3 3 0 0 0-4-4l-4 4Zm4 16-4 4A7 7 0 0 1 4 18l6-6 3 3-6 6a3 3 0 0 0 4 4l4-4ZM10 19l9-9 3 3-9 9Z",
    chat: "M2 4h23v16H12l-7 6v-6H2Zm24 7h4v15h-4v5l-7-5h-7v-3h14Z",
    audio: "M14 5 29 2v21a5 5 0 1 1-4-5V9l-7 2v15a5 5 0 1 1-4-5Z",
    video: "M2 5h28v23H2Zm4 4v3h3V9Zm0 6v3h3v-3Zm0 6v3h3v-3ZM23 9v3h3V9Zm0 6v3h3v-3Zm0 6v3h3v-3ZM13 11v12l8-6Z",
    dashboard: "M12 2h7v8h8v6h-8v9c0 3 4 3 8 1v6c-11 4-16 0-16-6V16H6v-5c4-1 6-5 6-9Z",
    settings: "M13 2h6l1 5 4 2 5-1 3 5-4 4v4l2 4-5 4-4-3-4 1-3 4-6-2v-5l-3-3-5-1v-6l5-2 2-4-1-4 5-3Zm3 9a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z",
    refresh: "M26 6V1l6 9-10 2 2-3A10 10 0 1 0 26 22l4 2A14 14 0 1 1 26 6Z",
    search: "M13 2a11 11 0 1 0 6 20l9 9 3-3-9-9A11 11 0 0 0 13 2Zm0 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14Z",
  };
  return <svg className={`tumblr-icon is-${name}`} viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d={paths[name]} fill="currentColor" fillRule="evenodd" /></svg>;
}

// RECONSTRUCTED from the inspected 2010 stamp/paper motifs, not modern icon assets.
function PostStamp({ kind }: { kind: typeof POST_TYPES[number] }) {
  return <svg className="tumblr-post-stamp" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <g transform="rotate(-16 24 24)">
      <rect x="7" y="6" width="34" height="36" fill="#f9f9f3" stroke="#aaa" strokeWidth="2" strokeDasharray="2 2" />
      <rect x="10" y="9" width="28" height="30" fill="#fff" stroke="#d9d9d1" />
      {kind === "Text" && <text x="14" y="34" fontFamily="Georgia,serif" fontSize="30" fontWeight="bold" fill="#242424">T</text>}
      {kind === "Photo" && <g><path fill="#81b8cf" d="M12 15h24v20H12z" /><circle cx="29" cy="20" r="3" fill="#fff4bb" /><path fill="#447b31" d="m12 30 8-9 7 8 4-4 5 7v3H12Z" /><path fill="#f8f8f2" d="m17 24 3-3 3 3Z" /></g>}
      {kind === "Quote" && <path fill="#e88832" d="M13 15h8v10h-4l3 8h-4l-3-7Zm13 0h8v10h-4l3 8h-4l-3-7Z" />}
      {kind === "Link" && <g><circle cx="24" cy="24" r="12" fill="#78ad52" /><path d="M14 24h20m-18-3 3 3-3 3m16-6-3 3 3 3" stroke="#f6ffe9" fill="none" strokeWidth="2" /></g>}
      {kind === "Chat" && <g><path d="M12 16h24v17H24l-7 4v-4h-5Z" fill="#628eb3" /><text x="16" y="28" fontFamily="Helvetica,Arial,sans-serif" fontSize="10" fill="#fff">Hi!</text></g>}
      {kind === "Audio" && <g fill="#9e74ba"><path d="M12 14h24v21H12Z" fill="#d9cbe2" /><path d="M14 19h3v14h-3Zm5-4h3v18h-3Zm5 2h3v16h-3Zm5-4h3v20h-3Zm5 8h2v12h-2Z" /></g>}
      {kind === "Video" && <g><path d="M12 12h24v24H12Z" fill="#484b50" /><path d="M17 15h14v18H17Z" fill="#8b9098" /><path d="M13 15h2m-2 5h2m-2 5h2m-2 5h2m17-15h2m-2 5h2m-2 5h2m-2 5h2" stroke="#ddd" strokeWidth="2" /></g>}
    </g>
  </svg>;
}
