import { Dispatch, useLayoutEffect, useRef } from "react";
import friendsIcon from "../assets/foursquare/icons/friends-2010-reconstructed.svg";
import placesIcon from "../assets/foursquare/icons/places-2010-reconstructed.svg";
import tipsIcon from "../assets/foursquare/icons/tips-2010-reconstructed.svg";
import todosIcon from "../assets/foursquare/icons/todos-2010-reconstructed.svg";
import profileIcon from "../assets/foursquare/icons/profile-2010-reconstructed.svg";
import { CORE_SOCIAL_CHARACTERS } from "../data/coreSocialFriends";
import { FOURSQUARE_F1_PERIPHERAL_PEOPLE, selectFoursquareVenueTips, type FoursquareCheckinActivity } from "../data/foursquareContent";
import { buildLeaderboard, type FoursquareCheckinResult, type FoursquareLeaderboardEntry } from "../data/foursquareGameModel";
import { getFoursquareTipTodo, getFoursquareVenueTodo, sortFoursquareTodos, type FoursquareTodoItem } from "../data/foursquareTodos";
import { createFoursquareVenueViewModels, type FoursquareVenueViewModel } from "../data/foursquareVenueAdapter";
import { FOURSQUARE_ROOT_TABS, FoursquareEvent, FoursquareRootTab, FoursquareState, FoursquareVenue } from "../state/foursquareState";
import { useSessionIdentity } from "../state/sessionIdentity";
import { IOS4Textarea } from "./IOS4KeyboardSystem";
import { FoursquareAvatar } from "./FoursquareAvatar";
import { resolveSystemMapVenue } from "../state/basicSystemApps";
import { FoursquareMapOverlay } from "./FoursquareMapOverlay";
import { useRafScrollPersistence } from "./scrollPersistence";

type Props = { state: FoursquareState; dispatch: Dispatch<FoursquareEvent>; currentDeviceDateTime: Date; onOpenMap?: (venueId: string) => void };
const TAB_PRESENTATION: Readonly<Record<FoursquareRootTab, { label: string; icon: string }>> = Object.freeze({
  friends: { label: "Friends", icon: friendsIcon }, places: { label: "Places", icon: placesIcon }, tips: { label: "Tips", icon: tipsIcon }, todos: { label: "To-Dos", icon: todosIcon }, profile: { label: "Profile", icon: profileIcon },
});

export function FoursquareContainer({ state, dispatch, currentDeviceDateTime, onOpenMap }: Props) {
  const identity = useSessionIdentity();
  const rootRef = useRef<HTMLDivElement>(null);
  const rootScroll = useRafScrollPersistence(state.rootScrollPositions[state.activeTab], scrollPosition => dispatch({ type: "SET_ROOT_SCROLL_POSITION", tab: state.activeTab, scrollPosition }));
  const venue = state.venues.find(candidate => candidate.id === state.selectedVenueId) ?? null;
  const venueViewModel = createFoursquareVenueViewModels(state.venues, state.socialActivities).find(candidate => candidate.id === state.selectedVenueId) ?? null;
  useLayoutEffect(() => {
    if (state.currentView === "root" && rootRef.current) rootRef.current.scrollTop = state.rootScrollPositions[state.activeTab];
  }, [state.activeTab, state.currentView, state.rootScrollPositions]);

  const title = state.currentView === "leaderboard" ? "Leaderboard" : state.currentView === "venue" ? state.venueSubview === "summary" ? venue?.name ?? "Venue" : state.venueSubview === "checkIn" ? "Check In" : state.venueSubview === "info" ? "Info" : state.venueSubview === "tips" ? "Tips" : "" : state.activeTab === "friends" ? "foursquare" : TAB_PRESENTATION[state.activeTab].label;
  return <section className="foursquare-container" aria-label="Foursquare" data-chrome-status="RECONSTRUCTED_FROM_PERIOD_SCREENSHOT">
    <header className="foursquare-navigation-bar">
      {state.currentView === "venue" && <button type="button" onClick={() => dispatch({ type: state.venueSubview === "summary" ? "SHOW_PLACES" : "SHOW_VENUE_SUMMARY" })}>{state.venueSubview === "summary" ? "Places" : state.venueSubview === "result" ? "Close" : venue?.name ?? "Venue"}</button>}
      {state.currentView === "leaderboard" && <button type="button" onClick={() => dispatch({ type: "SHOW_PROFILE" })}>Profile</button>}
      <strong className={state.activeTab === "friends" && state.currentView === "root" ? "is-wordmark" : ""}>{title}</strong>
    </header>
    <main className="foursquare-content">
      {state.currentView === "root" && <div ref={rootRef} className={`foursquare-root is-${state.activeTab}`} onScroll={event => rootScroll.record(event.currentTarget.scrollTop)}>
        {state.activeTab === "friends" && <FriendsRoot simulatedNowMs={currentDeviceDateTime.getTime()} activities={state.socialActivities} venues={state.venues} onOpenVenue={venueId => dispatch({ type: "OPEN_VENUE", venueId, scrollPosition: state.rootScrollPositions.places })} />}
        {state.activeTab === "places" && <PlacesRoot state={state} onOpen={(venueId, scrollPosition) => dispatch({ type: "OPEN_VENUE", venueId, scrollPosition })} scrollHost={rootRef} />}
        {state.activeTab === "tips" && <QuietRoot label="Tips" />}
        {state.activeTab === "todos" && <TodosRoot todos={state.todos} venues={state.venues} onOpenVenue={venueId => dispatch({ type: "OPEN_VENUE", venueId, scrollPosition: state.rootScrollPositions.places })} onOpenTipVenue={venueId => { dispatch({ type: "OPEN_VENUE", venueId, scrollPosition: state.rootScrollPositions.places }); dispatch({ type: "SHOW_VENUE_TIPS" }); }} />}
        {state.activeTab === "profile" && <><section className="foursquare-profile-root"><FoursquareAvatar identityId="session-owner" displayName={identity.name} /><strong>{identity.name}</strong></section><button type="button" className="foursquare-profile-leaderboard-row" onClick={() => dispatch({ type: "SHOW_LEADERBOARD" })}><strong>Leaderboard</strong><span aria-hidden="true">›</span></button></>}
      </div>}
      {state.currentView === "venue" && venue && venueViewModel && <VenueDetail onOpenMap={onOpenMap} venue={venue} venueViewModel={venueViewModel} state={state} identityName={identity.name} currentDeviceDateTime={currentDeviceDateTime} dispatch={dispatch} />}
      {state.currentView === "leaderboard" && <Leaderboard entries={buildLeaderboard(state.pointEvents)} playerDisplayName={identity.name} />}
    </main>
    <nav className="foursquare-tab-bar" aria-label="Foursquare sections">
      {FOURSQUARE_ROOT_TABS.map(tab => <button key={tab} type="button" aria-current={state.activeTab === tab ? "page" : undefined} onClick={() => { rootScroll.flush(); dispatch({ type: "SHOW_TAB", tab }); }}>
        <img src={TAB_PRESENTATION[tab].icon} alt="" aria-hidden="true" /><span>{TAB_PRESENTATION[tab].label}</span>
      </button>)}
    </nav>
  </section>;
}

function Leaderboard({ entries, playerDisplayName }: { entries: readonly FoursquareLeaderboardEntry[]; playerDisplayName: string }) {
  return <ol className="foursquare-leaderboard" aria-label="Leaderboard">{entries.map(entry => {
    const person = entry.identityId === "session-owner" ? { displayName: playerDisplayName } : entry.identityId === "foursquare-mia" ? FOURSQUARE_F1_PERIPHERAL_PEOPLE[entry.identityId] : CORE_SOCIAL_CHARACTERS[entry.identityId as keyof typeof CORE_SOCIAL_CHARACTERS];
    if (!person) return null;
    return <li key={entry.identityId} className="foursquare-leaderboard-row">
      <strong className="foursquare-leaderboard-rank">#{entry.rank}</strong>
      <FoursquareAvatar identityId={entry.identityId} displayName={person.displayName} />
      <strong className="foursquare-leaderboard-name">{person.displayName}</strong>
      <strong className="foursquare-leaderboard-score">{entry.weeklyPoints}</strong>
    </li>;
  })}</ol>;
}

function FriendsRoot({ activities, venues, onOpenVenue, simulatedNowMs }: { simulatedNowMs: number; activities: FoursquareCheckinActivity[]; venues: FoursquareVenue[]; onOpenVenue: (venueId: string) => void }) {
  const visible = activities.filter(activity => activity.visible).sort((a, b) => Date.parse(b.simulatedCreatedAt) - Date.parse(a.simulatedCreatedAt));
  const recent = visible.filter(activity => simulatedNowMs - Date.parse(activity.simulatedCreatedAt) <= 3 * 60 * 60 * 1000);
  const earlier = visible.filter(activity => !recent.includes(activity));
  return <section className="foursquare-friends-feed" aria-label="Friends check-ins">
    <ActivityBucket simulatedNowMs={simulatedNowMs} title="Last 3 Hours" activities={recent} venues={venues} onOpenVenue={onOpenVenue} />
    <ActivityBucket simulatedNowMs={simulatedNowMs} title="Earlier" activities={earlier} venues={venues} onOpenVenue={onOpenVenue} />
  </section>;
}

function ActivityBucket({ title, activities, venues, onOpenVenue, simulatedNowMs }: { simulatedNowMs: number; title: string; activities: FoursquareCheckinActivity[]; venues: FoursquareVenue[]; onOpenVenue: (venueId: string) => void }) {
  if (!activities.length) return null;
  return <section><h2>{title}</h2>{activities.map(activity => {
    const friend = activity.friendId === "foursquare-mia" ? FOURSQUARE_F1_PERIPHERAL_PEOPLE[activity.friendId] : CORE_SOCIAL_CHARACTERS[activity.friendId];
    const venue = venues.find(item => item.id === activity.venueId);
    if (!friend || !venue) return null;
    return <button key={activity.id} type="button" className="foursquare-checkin-row" onClick={() => onOpenVenue(venue.id)}>
      <FoursquareAvatar identityId={friend.id} displayName={friend.displayName} />
      <span className="foursquare-checkin-copy"><span><strong>{friend.displayName}</strong> <b>@ {venue.name}</b></span><small>{venue.category} · {formatRelativeActivityTime(activity.simulatedCreatedAt, simulatedNowMs)}</small>{activity.shout && <em>“{activity.shout}”</em>}</span>
      {activity.mayorStatus === "mayor" && <span className="foursquare-mayor-crown" aria-label="Mayor">♛</span>}
    </button>;
  })}</section>;
}

function PlacesRoot({ state, onOpen, scrollHost }: { state: FoursquareState; onOpen: (venueId: string, scrollPosition: number) => void; scrollHost: React.RefObject<HTMLDivElement | null> }) {
  const venues = createFoursquareVenueViewModels(state.venues, state.socialActivities);
  return <section className="foursquare-places" data-fidelity-status="RECONSTRUCTED_FROM_PERIOD_SCREENSHOT">{venues.map(item => <VenueRow key={item.id} venue={item} checkedIn={Boolean(state.checkIns[item.id])} onOpen={() => onOpen(item.id, scrollHost.current?.scrollTop ?? state.rootScrollPositions.places)} />)}</section>;
}

function TodosRoot({ todos, venues, onOpenVenue, onOpenTipVenue }: { todos: readonly FoursquareTodoItem[]; venues: readonly FoursquareVenue[]; onOpenVenue: (venueId: string) => void; onOpenTipVenue: (venueId: string) => void }) {
  return <section className="foursquare-todos-root" aria-label="To-Dos" data-content-status="RECONSTRUCTED_FROM_EXISTING_PROJECT_MATERIAL">{sortFoursquareTodos(todos).map(todo => {
    const venue = venues.find(candidate => candidate.id === todo.venueId);
    if (!venue) return null;
    if (todo.kind === "venue") return <button key={todo.id} type="button" className="foursquare-todo-venue-row" onClick={() => onOpenVenue(venue.id)}><strong>{venue.name}</strong></button>;
    const tip = selectFoursquareVenueTips(todo.venueId).find(candidate => candidate.id === todo.tipId);
    if (!tip) return null;
    return <button key={todo.id} type="button" className="foursquare-todo-tip-row" onClick={() => onOpenTipVenue(todo.venueId)}><strong>{tip.text}</strong><small>{venue.name}</small></button>;
  })}</section>;
}

function QuietRoot({ label }: { label: string }) { return <section className="foursquare-quiet-root" aria-label={label} />; }

function VenueDetail({ venue, venueViewModel, state, identityName, currentDeviceDateTime, dispatch, onOpenMap }: { onOpenMap?: (venueId: string) => void; venue: FoursquareVenue; venueViewModel: FoursquareVenueViewModel; state: FoursquareState; identityName: string; currentDeviceDateTime: Date; dispatch: Dispatch<FoursquareEvent> }) {
  const tips = selectFoursquareVenueTips(venue.id);
  const venueTodo = getFoursquareVenueTodo(state.todos, venue.id);
  return <article className={`foursquare-venue-detail is-${state.venueSubview}`} data-content-status={venue.contentStatus} data-fidelity-status="RECONSTRUCTED_FROM_PERIOD_SCREENSHOT">
    {state.venueSubview === "summary" && <><header className="foursquare-venue-summary-header"><img src={venueViewModel.categoryIcon} alt="" aria-hidden="true" /><span><strong>{venueViewModel.name}</strong><small>{venueViewModel.categoryLabel}</small></span></header><nav className="foursquare-venue-actions" aria-label={`${venueViewModel.name} actions`}>
      <button type="button" onClick={() => dispatch({ type: "SHOW_VENUE_CHECK_IN" })}>Check In<span aria-hidden="true">›</span></button>
      <button type="button" onClick={() => dispatch({ type: "SHOW_VENUE_INFO" })}>Info<span aria-hidden="true">›</span></button>
      <button type="button" onClick={() => dispatch({ type: "SHOW_VENUE_TIPS" })}>Tips<span aria-hidden="true">›</span></button>
      <button type="button" className="foursquare-venue-todo-action" data-content-status="RECONSTRUCTED_FROM_EXISTING_PROJECT_MATERIAL" onClick={() => dispatch(venueTodo ? { type: "REMOVE_TODO", todoId: venueTodo.id } : { type: "ADD_VENUE_TODO", venueId: venue.id, simulatedCreatedAt: currentDeviceDateTime.getTime() })}>{venueTodo ? "Remove from To-Dos" : "Add to To-Dos"}</button>
    </nav></>}
    {state.venueSubview === "info" && <section className="foursquare-venue-info" aria-label="Venue information"><div><span>Category</span><strong>{venueViewModel.categoryLabel}</strong></div><FoursquareMapOverlay venueId={venue.id} />{onOpenMap && resolveSystemMapVenue(venue.id) && <button type="button" className="foursquare-open-system-map" onClick={() => onOpenMap(venue.id)}>Open in Maps<span aria-hidden="true"> ›</span></button>}</section>}
    {state.venueSubview === "tips" && <section className="foursquare-venue-tips" aria-label="Venue tips">{tips.map(tip => {
      const tipTodo = getFoursquareTipTodo(state.todos, tip.id);
      return <article key={tip.id} className="foursquare-venue-tip" data-content-status={tip.classification}><strong>{tip.authorDisplayName}</strong><p>{tip.text}</p><button type="button" className="foursquare-tip-todo-action" data-content-status="RECONSTRUCTED_FROM_EXISTING_PROJECT_MATERIAL" onClick={() => dispatch(tipTodo ? { type: "REMOVE_TODO", todoId: tipTodo.id } : { type: "ADD_TIP_TODO", tipId: tip.id, simulatedCreatedAt: currentDeviceDateTime.getTime() })}>{tipTodo ? "Remove from To-Dos" : "Add to To-Dos"}</button></article>;
    })}</section>}
    {state.venueSubview === "checkIn" && <><header className="foursquare-checkin-venue-context"><strong>{venueViewModel.name}</strong><small>{venueViewModel.categoryLabel}</small></header><form className="foursquare-checkin-form" onSubmit={event => { event.preventDefault(); const checkInTimestamp = currentDeviceDateTime.getTime(); dispatch({ type: "CHECK_IN", venueId: venue.id, checkedInBy: identityName, checkInTimestamp }); }}><label htmlFor={`foursquare-shout-${venue.id}`}>Shout (optional)</label><IOS4Textarea keyboardInputId={`foursquare-shout-${venue.id}`} id={`foursquare-shout-${venue.id}`} maxLength={140} value={state.shoutDrafts[venue.id] ?? ""} onValueChange={value => dispatch({ type: "EDIT_CHECK_IN_SHOUT", venueId: venue.id, value })} /><button className="foursquare-checkin-button" type="submit">Check-in here</button></form></>}
    {state.venueSubview === "result" && state.checkIns[venue.id] && <CheckInResult venueName={venueViewModel.name} playerDisplayName={identityName} result={state.checkIns[venue.id].result} />}
  </article>;
}

function CheckInResult({ venueName, playerDisplayName, result }: { venueName: string; playerDisplayName: string; result: FoursquareCheckinResult }) {
  return <section className="foursquare-checkin-result" role="status" data-fidelity-status="RECONSTRUCTED_FROM_PERIOD_SCREENSHOT">
    <header className="foursquare-result-confirmation">OK! We’ve got you @ {venueName}.</header>
    <h2 className="foursquare-result-section-header">Points</h2>
    <div className="foursquare-result-points-summary">Nice check-in! You earned: <strong>+{result.pointDelta}</strong></div>
    <div className="foursquare-result-reason"><span>Check-in</span><strong>+{result.pointDelta}</strong></div>
    <h2 className="foursquare-result-section-header">Leaderboard</h2>
    <div className="foursquare-result-leaderboard-row">
      <strong className="foursquare-result-rank">#{result.rankAfter}</strong>
      <FoursquareAvatar identityId="session-owner" displayName={playerDisplayName} />
      <strong className="foursquare-result-player-name">{playerDisplayName}</strong>
      <strong className="foursquare-result-score">{result.weeklyPointsAfter}</strong>
    </div>
  </section>;
}

function VenueRow({ venue, checkedIn, onOpen }: { venue: FoursquareVenueViewModel; checkedIn: boolean; onOpen: () => void }) { return <button type="button" className="foursquare-venue-row" onClick={onOpen} data-content-status={venue.contentStatus} data-category={venue.category}>
  <img className="foursquare-venue-category-icon" src={venue.categoryIcon} alt="" aria-hidden="true" />
  <span className="foursquare-venue-copy"><strong>{venue.name}</strong><small>{venue.categoryLabel}{checkedIn ? " · Checked in" : ""}</small></span>
  <span className="foursquare-venue-disclosure" aria-hidden="true" />
</button>; }

export function formatRelativeActivityTime(simulatedCreatedAt: string, simulatedNowMs: number): string {
  const minutes = Math.max(0, Math.floor((simulatedNowMs - Date.parse(simulatedCreatedAt)) / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr${hours === 1 ? "" : "s"} ago`;
}
