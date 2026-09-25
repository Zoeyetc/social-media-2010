import { Dispatch, useEffect, useLayoutEffect, useRef } from "react";
import { InstagramEvent, InstagramState, selectInstagramFollowedAccounts, selectInstagramFollowingCount, selectInstagramKnownAccountStats, selectInstagramVisibleFollowedPosts, selectInstagramVisibleKnownPosts } from "../state/instagramState";
import type { CameraRollInitialization } from "../state/cameraRollState";
import { useSessionIdentity } from "../state/sessionIdentity";
import { getSharedCharacterMedia } from "../data/sharedCharacterMedia";
import { getInstagramPopularPost, INSTAGRAM_POPULAR_POSTS } from "../data/instagramPopularContent";
import { InstagramRefreshButton, InstagramTabBar, InstagramTopBar } from "./instagram/InstagramChrome";
import { InstagramFilteredImage, INSTAGRAM_FILTER_OPTIONS, instagramVisibleFilterLabel } from "./instagram/InstagramFilteredImage";
import { PhotosContainer } from "./PhotosContainer";
import instagramClockSrc from "../assets/instagram/chrome/instagram-clock-2010-reconstructed.svg";
import { useRafScrollPersistence } from "./scrollPersistence";

type InstagramContainerProps = {
  state: InstagramState;
  dispatch: Dispatch<InstagramEvent>;
  currentDeviceDateTime: Date;
  cameraRoll: CameraRollInitialization;
};

export function InstagramContainer({ state, dispatch, currentDeviceDateTime, cameraRoll }: InstagramContainerProps) {
  const identity = useSessionIdentity();
  const feedRef = useRef<HTMLDivElement>(null);
  const popularRef = useRef<HTMLDivElement>(null);
  const feedScroll = useRafScrollPersistence(state.scrollPosition, scrollPosition => dispatch({ type: "SET_SCROLL_POSITION", scrollPosition }));
  const popularScroll = useRafScrollPersistence(state.popularScrollPosition, scrollPosition => dispatch({ type: "SET_POPULAR_SCROLL_POSITION", scrollPosition }));
  const isWorkflow = state.currentView === "source" || state.currentView === "filter" || state.currentView === "share";
  const followedKnownPosts = selectInstagramVisibleFollowedPosts(state);
  const followedAccounts = selectInstagramFollowedAccounts(state);
  const followingCount = selectInstagramFollowingCount(state);
  const selectedKnownAccount = state.knownAccounts.find(account => account.canonicalCharacterId === state.selectedKnownCharacterId) ?? null;
  const selectedKnownPosts = selectedKnownAccount ? selectInstagramVisibleKnownPosts(state, selectedKnownAccount.canonicalCharacterId) : [];
  const selectedKnownStats = selectedKnownAccount ? selectInstagramKnownAccountStats(state, selectedKnownAccount.canonicalCharacterId) : null;
  const selectedKnownAvatar = selectedKnownAccount?.canonicalCharacterId === "june" ? getSharedCharacterMedia("june-profile-avatar") : null;
  const selectedPopularPost = state.selectedPopularPostId ? getInstagramPopularPost(state.selectedPopularPostId) : null;
  const selectedDraftPhoto = state.draft.selectedCameraRollPhotoId
    ? cameraRoll.records.find(photo => photo.id === state.draft.selectedCameraRollPhotoId) ?? null
    : null;
  const accountTabLabel = instagramAccountTabLabel(identity.name);

  useLayoutEffect(() => {
    if (state.currentView !== "feed" || !feedRef.current) return;
    feedRef.current.scrollLeft = 0;
    feedRef.current.scrollTop = state.scrollPosition;
  }, [state.currentView, state.scrollPosition]);

  useLayoutEffect(() => {
    if (state.currentView !== "popular" || !popularRef.current) return;
    popularRef.current.scrollTop = state.popularScrollPosition;
  }, [state.currentView, state.popularScrollPosition]);

  useEffect(() => {
    if (cameraRoll.status !== "ready" || !state.draft.selectedCameraRollPhotoId || selectedDraftPhoto) return;
    dispatch({ type: "INVALIDATE_DRAFT_MEDIA" });
  }, [cameraRoll.status, dispatch, selectedDraftPhoto, state.draft.selectedCameraRollPhotoId]);

  if (state.currentView === "source") {
    return <PhotosContainer
      mode="picker"
      cameraRoll={cameraRoll}
      onPickerCancel={() => dispatch({ type: "CANCEL_FIRST_PHOTO" })}
      onPickerSelect={photoId => dispatch({ type: "SELECT_CAMERA_ROLL_PHOTO", photoId })}
    />;
  }

  const leftControl = state.currentView === "popularPhotoDetail"
    ? <button className="instagram-navigation-cancel" type="button" onClick={() => dispatch({ type: "BACK_FROM_POPULAR_PHOTO" })}>Back</button>
    : state.currentView === "following" || state.currentView === "facebookFriends" || state.currentView === "knownProfile" || state.currentView === "knownConnections"
      ? <button className="instagram-navigation-cancel" type="button" onClick={() => dispatch({ type: "BACK_FROM_DISCOVERY" })}>Back</button>
      : state.currentView === "filter"
        ? <button className="instagram-navigation-cancel" type="button" onClick={() => dispatch({ type: "BACK_TO_CAMERA_ROLL" })}>Back</button>
        : state.currentView === "share"
          ? <button className="instagram-navigation-cancel" type="button" onClick={() => dispatch({ type: "BACK_TO_FILTERS" })}>Back</button>
          : null;
  const rightControl = state.currentView === "filter"
    ? <button className="instagram-navigation-next" type="button" disabled={!selectedDraftPhoto} onClick={() => dispatch({ type: "CONTINUE_TO_SHARE" })}>Next</button>
    : state.currentView === "share"
      ? <button className="instagram-navigation-next" type="button" disabled={!selectedDraftPhoto} onClick={() => dispatch({ type: "POST_FIRST_PHOTO", owner: identity.name || "Owner", createdAt: currentDeviceDateTime.getTime() })}>Post</button>
    : state.currentView === "feed"
      ? <InstagramRefreshButton label="Refresh Feed" onClick={() => dispatch({ type: "SHOW_FEED" })} />
      : state.currentView === "popular"
        ? <InstagramRefreshButton label="Refresh Popular" onClick={() => dispatch({ type: "REFRESH_POPULAR" })} />
        : state.currentView === "knownProfile" && selectedKnownAccount
          ? <button className="instagram-navigation-next instagram-profile-relationship-control" type="button" data-chrome-status="HOLD" aria-pressed={state.followedCharacterIds.includes(selectedKnownAccount.canonicalCharacterId)} onClick={() => dispatch({ type: "SET_KNOWN_ACCOUNT_FOLLOWING", characterId: selectedKnownAccount.canonicalCharacterId, following: !state.followedCharacterIds.includes(selectedKnownAccount.canonicalCharacterId) })}>{state.followedCharacterIds.includes(selectedKnownAccount.canonicalCharacterId) ? "Following" : "Follow"}</button>
          : null;

  return <section className="instagram-container" aria-label="Instagram" data-chrome-status="RECONSTRUCTED_FROM_PERIOD_SCREENSHOT">
    <InstagramTopBar
      title={viewTitle(state.currentView, selectedKnownAccount?.username, state.knownConnectionsKind, accountTabLabel)}
      wordmark={state.currentView === "feed"}
      leftControl={leftControl}
      rightControl={rightControl}
    />

    {state.currentView === "feed" && <div
      ref={feedRef}
      className="instagram-feed"
      onScroll={event => {
        if (event.currentTarget.scrollLeft !== 0) event.currentTarget.scrollLeft = 0;
        feedScroll.record(event.currentTarget.scrollTop);
      }}
    >
      {state.photos.length === 0 && followedKnownPosts.length === 0
        ? <div className="instagram-empty-feed">
            <p>No photos yet.</p>
            <span>Find friends from Facebook or share your first photo.</span>
          </div>
        : <>{followedKnownPosts.map(post => {
          const media = getSharedCharacterMedia(post.mediaId);
          const avatar = post.canonicalCharacterId === "june" ? getSharedCharacterMedia("june-profile-avatar") : null;
          return <article className="instagram-photo-record is-known-account" key={post.id} data-origin={post.origin}>
            <header className="instagram-feed-metadata">
              <button className="instagram-feed-author" type="button" onClick={() => dispatch({ type: "OPEN_KNOWN_PROFILE", characterId: post.canonicalCharacterId })}>
                {avatar && <img src={avatar.src} alt="" />}
                <strong>{post.username}</strong>
              </button>
              <time><img src={instagramClockSrc} alt="" aria-hidden="true" />{formatInstagramRelativeTimestamp(post.timestamp, currentDeviceDateTime)}</time>
            </header>
            <div className="instagram-square-photo instagram-feed-photo"><img className="instagram-character-photo" src={media.src} alt="" /></div>
          </article>;
        })}{state.photos.map(photo => {
          const sourcePhoto = cameraRoll.records.find(record => record.id === photo.sourcePhotoId) ?? null;
          return <article className="instagram-photo-record" key={photo.id} data-origin={photo.origin} data-source={photo.source}>
            <header><strong>{photo.owner}</strong><span>{instagramVisibleFilterLabel(photo.filter)}</span></header>
            {sourcePhoto
              ? <div className="instagram-square-photo instagram-feed-photo"><InstagramFilteredImage src={sourcePhoto.objectUrl} alt={sourcePhoto.filename} filter={photo.filter} /></div>
              : <div className="instagram-square-photo instagram-feed-photo instagram-unavailable-photo" role="img" aria-label="Photo unavailable" />}
          </article>;
        })}</>}
    </div>}

    {state.currentView === "popular" && <div ref={popularRef} className="instagram-popular-grid" aria-label="Popular photos" data-refresh-count={state.popularRefreshCount} onScroll={event => popularScroll.record(event.currentTarget.scrollTop)}>
      {INSTAGRAM_POPULAR_POSTS.map(post => <button key={post.id} type="button" aria-label={`Open ${post.category} photo by ${post.username}`} onClick={() => dispatch({ type: "OPEN_POPULAR_PHOTO", postId: post.id })}><InstagramPopularFixture media={post.media} username={post.username} /></button>)}
    </div>}

    {state.currentView === "popularPhotoDetail" && selectedPopularPost && <article className="instagram-popular-photo-detail" data-content-classification={selectedPopularPost.classification}>
      <header><span className="instagram-stream-avatar-placeholder" aria-hidden="true" /><strong>{selectedPopularPost.username}</strong><time>{selectedPopularPost.relativeTimestamp}</time></header>
      <div className="instagram-square-photo"><InstagramPopularFixture media={selectedPopularPost.media} username={selectedPopularPost.username} /></div>
      <footer data-action-chrome-status="HOLD"><span>Like</span><span>Comment</span></footer>
    </article>}

    {state.currentView === "news" && <section className="instagram-period-empty-root" data-content-status="RECONSTRUCTED" data-exact-ui-status="HOLD"><p>No new activity.</p></section>}

    {state.currentView === "profile" && <section className="instagram-period-profile instagram-owner-profile">
      <div className="instagram-profile-summary">
        <span className="instagram-profile-avatar-placeholder" aria-hidden="true">{(identity.name || "O").slice(0, 1).toUpperCase()}</span>
        <div className="instagram-profile-summary-content"><strong>{identity.name || "Owner"}</strong>
          <InstagramProfileStats photos={state.photos.length} followers={state.followers} following={followingCount} onFollowing={() => dispatch({ type: "SHOW_FOLLOWING" })} />
        </div>
      </div>
      <button className="instagram-find-facebook-friends" type="button" data-placement-status="RECONSTRUCTED" onClick={() => dispatch({ type: "SHOW_FACEBOOK_FRIENDS" })}>Find Friends from Facebook</button>
      <div className="instagram-profile-photo-stream">{state.photos.length === 0
        ? <p className="instagram-period-empty-stream">No photos yet.</p>
        : state.photos.map(photo => {
          const sourcePhoto = cameraRoll.records.find(record => record.id === photo.sourcePhotoId) ?? null;
          return <article key={photo.id}><header><span className="instagram-stream-avatar-placeholder" aria-hidden="true" /><strong>{identity.name || "Owner"}</strong><time><img src={instagramClockSrc} alt="" aria-hidden="true" />{formatInstagramRelativeTimestamp(photo.createdAt, currentDeviceDateTime)}</time></header>{sourcePhoto
            ? <div className="instagram-square-photo"><InstagramFilteredImage src={sourcePhoto.objectUrl} alt={sourcePhoto.filename} filter={photo.filter} /></div>
            : <div className="instagram-square-photo instagram-unavailable-photo" role="img" aria-label="Photo unavailable" />}</article>;
        })}</div>
    </section>}

    {state.currentView === "following" && <section className="instagram-facebook-friends instagram-following-list" aria-label="Following">
      <p>Following</p>
      {followedAccounts.length === 0 && <p>No followed accounts.</p>}
      {followedAccounts.map(account => <article key={account.canonicalCharacterId}>
        <button type="button" className="instagram-known-profile-link" onClick={() => dispatch({ type: "OPEN_KNOWN_PROFILE", characterId: account.canonicalCharacterId })}><strong>{account.displayName}</strong><span>@{account.username}</span></button>
      </article>)}
    </section>}

    {state.currentView === "facebookFriends" && <section className="instagram-facebook-friends" aria-label="Facebook Friends">
      <p>Friends on Instagram</p>
      {state.knownAccounts.map(account => <article key={account.canonicalCharacterId}>
        <button type="button" className="instagram-known-profile-link" onClick={() => dispatch({ type: "OPEN_KNOWN_PROFILE", characterId: account.canonicalCharacterId })}><strong>{account.displayName}</strong><span>@{account.username}</span></button>
        <button type="button" className="instagram-follow-control" aria-pressed={state.followedCharacterIds.includes(account.canonicalCharacterId)} onClick={() => dispatch({ type: "SET_KNOWN_ACCOUNT_FOLLOWING", characterId: account.canonicalCharacterId, following: !state.followedCharacterIds.includes(account.canonicalCharacterId) })}>{state.followedCharacterIds.includes(account.canonicalCharacterId) ? "Following" : "Follow"}</button>
      </article>)}
    </section>}

    {state.currentView === "knownProfile" && selectedKnownAccount && <section className="instagram-period-profile instagram-known-profile" aria-label={`${selectedKnownAccount.displayName} Instagram Profile`} data-profile-chrome-status={selectedKnownAccount.profileUiStatus}>
      <div className="instagram-profile-summary">
        {selectedKnownAvatar ? <div className="instagram-profile-avatar"><img src={selectedKnownAvatar.src} alt="" /></div> : <span className="instagram-profile-avatar-placeholder" aria-hidden="true" />}
        <div className="instagram-profile-summary-content"><strong>{selectedKnownAccount.displayName}</strong>
          {selectedKnownStats && <InstagramProfileStats photos={selectedKnownStats.posts} followers={selectedKnownStats.followers} following={selectedKnownStats.following} onFollowers={() => dispatch({ type: "SHOW_KNOWN_CONNECTIONS", kind: "followers" })} onFollowing={() => dispatch({ type: "SHOW_KNOWN_CONNECTIONS", kind: "following" })} />}
        </div>
      </div>
      <div className="instagram-profile-photo-stream">
        {selectedKnownPosts.length === 0 && <p className="instagram-period-empty-stream">No photos.</p>}
        {selectedKnownPosts.map(post => {
          const media = getSharedCharacterMedia(post.mediaId);
          return <article key={post.id}><header>{selectedKnownAvatar ? <img src={selectedKnownAvatar.src} alt="" /> : <span className="instagram-stream-avatar-placeholder" aria-hidden="true" />}<strong>{post.username}</strong><time><img src={instagramClockSrc} alt="" aria-hidden="true" />{formatInstagramRelativeTimestamp(post.timestamp, currentDeviceDateTime)}</time></header><div className="instagram-square-photo"><img src={media.src} alt="" /></div></article>;
        })}
      </div>
    </section>}

    {state.currentView === "knownConnections" && selectedKnownAccount && selectedKnownStats && state.knownConnectionsKind && <section className="instagram-facebook-friends instagram-known-connections" aria-label={`${selectedKnownAccount.displayName} ${state.knownConnectionsKind}`}>
      <p>{selectedKnownAccount.displayName} · {state.knownConnectionsKind === "followers" ? selectedKnownStats.followers : selectedKnownStats.following} {state.knownConnectionsKind}</p>
    </section>}

    {state.currentView === "filter" && <section className="instagram-filter-step" data-geometry-status="RECONSTRUCTED">
      <div className="instagram-filter-preview">
        {selectedDraftPhoto
          ? <InstagramFilteredImage src={selectedDraftPhoto.objectUrl} alt={selectedDraftPhoto.filename} filter={state.draft.filter ?? "Original"} />
          : <InstagramCameraRollStateMessage cameraRoll={cameraRoll} />}
      </div>
      <div className="instagram-filter-filmstrip" aria-label="Filters">
        <div className="instagram-filter-filmstrip-track">
          {INSTAGRAM_FILTER_OPTIONS.map(option => <button key={option.id} type="button" aria-pressed={state.draft.filter === option.id} onClick={() => dispatch({ type: "SELECT_FILTER", filter: option.id })}>
            <span className="instagram-filter-thumbnail-frame">{selectedDraftPhoto && <InstagramFilteredImage src={selectedDraftPhoto.objectUrl} alt="" filter={option.id} />}</span>
            <span>{option.label}</span>
          </button>)}
        </div>
      </div>
    </section>}

    {state.currentView === "share" && <section className="instagram-share-confirmation" data-geometry-status="RECONSTRUCTED">
      <div className="instagram-share-photo-row">
        {selectedDraftPhoto
          ? <InstagramFilteredImage src={selectedDraftPhoto.objectUrl} alt={selectedDraftPhoto.filename} filter={state.draft.filter ?? "Original"} />
          : <InstagramCameraRollStateMessage cameraRoll={cameraRoll} />}
      </div>
    </section>}

    {!isWorkflow && <InstagramTabBar
      currentView={state.currentView}
      accountLabel={accountTabLabel}
      onFeed={() => dispatch({ type: "SHOW_FEED" })}
      onPopular={() => dispatch({ type: "SHOW_POPULAR" })}
      onShare={() => dispatch({ type: "BEGIN_FIRST_PHOTO" })}
      onNews={() => dispatch({ type: "SHOW_NEWS" })}
      onProfile={() => dispatch({ type: "SHOW_PROFILE" })}
    />}
  </section>;
}

function InstagramProfileStats({ photos, followers, following, onFollowers, onFollowing }: { photos: number; followers: number; following: number; onFollowers?: () => void; onFollowing?: () => void }) {
  return <dl className="instagram-profile-stats" data-classification="CURATED-DISPLAY">
    <div><dt>{photos}</dt><dd>photos</dd></div>
    <div>{onFollowers ? <button type="button" onClick={onFollowers}><strong>{followers}</strong><span>followers</span></button> : <><dt>{followers}</dt><dd>followers</dd></>}</div>
    <div>{onFollowing ? <button type="button" onClick={onFollowing}><strong>{following}</strong><span>following</span></button> : <><dt>{following}</dt><dd>following</dd></>}</div>
  </dl>;
}

function formatInstagramRelativeTimestamp(timestamp: string | number, currentDeviceDateTime: Date): string {
  const timestampMs = typeof timestamp === "number" ? timestamp : Date.parse(timestamp);
  if (!Number.isFinite(timestampMs)) return "now";
  const elapsedSeconds = Math.max(0, Math.floor((currentDeviceDateTime.getTime() - timestampMs) / 1000));
  if (elapsedSeconds < 60) return "1m";
  if (elapsedSeconds < 60 * 60) return `${Math.floor(elapsedSeconds / 60)}m`;
  if (elapsedSeconds < 24 * 60 * 60) return `${Math.floor(elapsedSeconds / (60 * 60))}h`;
  return `${Math.floor(elapsedSeconds / (24 * 60 * 60))}d`;
}

function InstagramPopularFixture({ media, username }: { media: string; username: string }) {
  return <img className="instagram-popular-image" src={media} alt={`Photo by ${username}`} />;
}

function instagramAccountTabLabel(name: string): string {
  const normalized = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 12);
  return `@${normalized || "account"}`;
}

function viewTitle(view: InstagramState["currentView"], knownUsername: string | undefined, connectionsKind: "followers" | "following" | null | undefined, accountTitle: string): string {
  switch (view) {
    case "feed": return "Instagram";
    case "popular": return "Popular";
    case "popularPhotoDetail": return "Photo";
    case "news": return "News";
    case "profile": return accountTitle;
    case "following": return "Following";
    case "facebookFriends": return "Facebook Friends";
    case "knownProfile": return knownUsername ?? "Profile";
    case "knownConnections": return connectionsKind === "followers" ? "Followers" : "Following";
    case "source": return "Photo";
    case "filter": return "Filters";
    case "share": return "Share";
  }
}

function InstagramCameraRollStateMessage({ cameraRoll }: { cameraRoll: CameraRollInitialization }) {
  return <p className="instagram-camera-roll-state" role={cameraRoll.status === "error" ? "alert" : "status"}>
    {cameraRoll.status === "loading" ? "Loading Camera Roll…" : "Camera Roll Unavailable"}
  </p>;
}
