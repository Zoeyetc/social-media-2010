import type { TwitterTweet } from "../state/twitterState";
import type { PublicTwitterOutroState } from "../state/publicTwitterOutroState";

export const PUBLIC_TWITTER_OUTRO_COPY = Object.freeze({
  title: "Preview a Tweet",
  explanation: "Choose one Tweet to preview with a username. This preview stays in this experience and is not published to other visitors.",
  selection: "Select one Tweet",
  handle: "Public username",
  handleExplanation: "This username labels your Tweet only. It does not create an account or profile.",
  skip: "Keep private to this experience",
  success: "Your preview is ready. It has not been published to other visitors.",
  failure: "Your Tweet is still in this experience, but it couldn't be left for other visitors.",
});

export function PublicTwitterOutro({ state, tweets, selectedTweet, onSelect, onContinue, onHandleChange, onConfirmHandle, onSubmit, onRetry, onWithdraw, onComplete }: {
  state: PublicTwitterOutroState;
  tweets: readonly TwitterTweet[];
  selectedTweet: TwitterTweet | null;
  onSelect: (id: string) => void;
  onContinue: () => void;
  onHandleChange: (value: string) => void;
  onConfirmHandle: () => void;
  onSubmit: () => void;
  onRetry: () => void;
  onWithdraw: () => void;
  onComplete: () => void;
}) {
  return <aside className="public-twitter-outro" aria-label={PUBLIC_TWITTER_OUTRO_COPY.title} data-ux-status="PROJECT_UX_RECONSTRUCTED">
    <div className="public-twitter-outro-content">
      <h1>{PUBLIC_TWITTER_OUTRO_COPY.title}</h1>
      {state.phase === "selecting" && <>
        <p>{PUBLIC_TWITTER_OUTRO_COPY.explanation}</p>
        <strong>{PUBLIC_TWITTER_OUTRO_COPY.selection}</strong>
        <div className="public-twitter-outro-tweets">{tweets.map(tweet => <button type="button" key={tweet.id} aria-pressed={state.selectedTweetId === tweet.id} onClick={() => onSelect(tweet.id)}>{tweet.text}</button>)}</div>
        <button type="button" className="public-twitter-outro-primary" disabled={!state.selectedTweetId} onClick={onContinue}>Continue</button>
        <button type="button" className="public-twitter-outro-secondary" onClick={onComplete}>{PUBLIC_TWITTER_OUTRO_COPY.skip}</button>
      </>}
      {state.phase === "entering_handle" && <form onSubmit={event => { event.preventDefault(); onConfirmHandle(); }}>
        <label htmlFor="public-twitter-handle">{PUBLIC_TWITTER_OUTRO_COPY.handle}</label>
        <div className="public-twitter-outro-handle"><span>@</span><input id="public-twitter-handle" autoFocus value={state.handleInput} maxLength={16} autoComplete="off" onChange={event => onHandleChange(event.target.value)} /></div>
        <p>{PUBLIC_TWITTER_OUTRO_COPY.handleExplanation}</p>
        {state.error && <p role="alert">{state.error}</p>}
        <button type="submit" className="public-twitter-outro-primary">Continue</button>
        <button type="button" className="public-twitter-outro-secondary" onClick={onComplete}>{PUBLIC_TWITTER_OUTRO_COPY.skip}</button>
      </form>}
      {state.phase === "confirming" && selectedTweet && <>
        <p>{PUBLIC_TWITTER_OUTRO_COPY.explanation}</p>
        <blockquote>{selectedTweet.text}</blockquote>
        <p className="public-twitter-outro-attribution">@{state.publicHandle}</p>
        <button type="button" className="public-twitter-outro-primary" onClick={onSubmit}>Preview as @{state.publicHandle}</button>
        <button type="button" className="public-twitter-outro-secondary" onClick={onComplete}>{PUBLIC_TWITTER_OUTRO_COPY.skip}</button>
      </>}
      {state.phase === "submitting" && <p>Sending…</p>}
      {state.phase === "success" && <><p>{PUBLIC_TWITTER_OUTRO_COPY.success}</p><button type="button" className="public-twitter-outro-secondary" onClick={onWithdraw}>Withdraw</button><button type="button" className="public-twitter-outro-primary" onClick={onComplete}>Continue</button></>}
      {state.phase === "failed" && <><p>{PUBLIC_TWITTER_OUTRO_COPY.failure}</p><button type="button" className="public-twitter-outro-primary" onClick={onRetry}>Try Again</button><button type="button" className="public-twitter-outro-secondary" onClick={onComplete}>Cancel</button></>}
      {state.phase === "withdrawn" && <><p>Your Tweet won't be left for other visitors.</p><button type="button" className="public-twitter-outro-primary" onClick={onComplete}>Continue</button></>}
    </div>
  </aside>;
}
