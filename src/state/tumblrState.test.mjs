import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

function parsePostRows(markup) {
  const rows = [];
  for (const match of markup.matchAll(/<button[^>]*class="tumblr-post-row"[^>]*>([\s\S]*?)<\/button>/g)) {
    const rowMarkup = match[1] ?? "";
    const title = rowMarkup.match(/<strong>(.*?)<\/strong>/)?.[1] ?? "";
    if (title) rows.push(title);
  }
  return rows;
}

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
try {
  const {
    createInitialTumblrState: initial,
    tumblrMyPosts,
    tumblrStateTransition: reduce,
  } = await server.ssrLoadModule("/src/state/tumblrState.ts");
  const { TumblrContainer } = await server.ssrLoadModule("/src/device/TumblrContainer.tsx");
  const { IOS4KeyboardSystem } = await server.ssrLoadModule("/src/device/IOS4KeyboardSystem.tsx");
  const { SessionIdentityContext } = await server.ssrLoadModule("/src/state/sessionIdentity.ts");
  const { simulatedClock, simulatedDeviceDateTime } = await server.ssrLoadModule("/src/state/deviceMachine.ts");
  const { buildSessionTimelineEvents } = await server.ssrLoadModule("/src/data/sessionTimeline.ts");

  const renderTumblr = (state, currentElapsedMs) => renderToStaticMarkup(
    createElement(
      SessionIdentityContext.Provider,
      { value: { name: "Visitor" } },
      createElement(
        IOS4KeyboardSystem,
        { suspended: false },
        createElement(TumblrContainer, { state, dispatch: (event) => { currentState = reduce(currentState, event); }, currentElapsedMs, onRequestMedia: () => {} }),
      ),
    ),
  );

  let currentState = initial();
  let markup = renderTumblr(currentState, 0);

  const seedPosts = initial().posts;
  const expectedReverseOrder = [...seedPosts]
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
    .map(post => post.title);

  assert.equal(currentState.currentView, "dashboard");
  assert.equal(seedPosts.length > 0, true, "Seeded Tumblr posts exist");
  for (const post of seedPosts) {
    assert.equal(markup.includes(post.title), true, `Seeded post title renders: ${post.title}`);
  }
  assert.deepEqual(
    parsePostRows(markup).slice(0, expectedReverseOrder.length),
    expectedReverseOrder,
    "Dashboard is reverse-chronological",
  );

  assert.match(markup, /aria-label="Tumblr tabs"/, "Fixed bottom navigation renders");
  assert.match(markup, /aria-label="Refresh"/, "Dashboard refresh is present");
  assert.match(markup, /aria-label="Search" aria-controls="tumblr-dashboard-search"/, "Search targets the mounted field");
  assert.match(markup, /class="tumblr-search-bar"/, "Default Dashboard includes search before focus");
  assert.match(markup, /id="tumblr-dashboard-search"[^>]*placeholder="Search"[^>]*value=""/, "Default search is empty, not a hardcoded query");
  assert.ok(markup.indexOf('class="tumblr-search-bar"') < markup.indexOf('class="tumblr-dashboard-segments"'), "Search row precedes segments");
  assert.doesNotMatch(markup, /class="ios4-keyboard /, "Default search does not open keyboard");
  assert.match(markup, />Tumblr<.*aria-pressed="true">Dashboard<.*>My Posts</s, "Historical segments, Dashboard selected");
  assert.doesNotMatch(markup, /class="tumblr-post-type-selector"/, "Post selector is no longer embedded in Dashboard");
  const originalPosts = currentState.posts;
  currentState = reduce(currentState, { type: "SELECT_TAB", tab: "post-types" });
  markup = renderTumblr(currentState, 0);
  assert.equal(currentState.currentView, "post-types");
  const picker = markup.match(/<section class="tumblr-post-type-selector"[^>]*>(.*?)<\/section>/s)?.[1];
  assert.ok(picker, "Post tab opens full selector");
  assert.deepEqual([...picker.matchAll(/<span>(.*?)<\/span>/g)].map(match => match[1]),
    ["Text", "Photo", "Quote", "Link", "Chat", "Audio", "Video"], "Archival post type order");
  const rows = [...picker.matchAll(/<button([^>]*)>(.*?)<\/button>/gs)];
  assert.equal(rows.length, 7);
  assert.doesNotMatch(rows[0][1], /disabled/, "Text is active");
  assert.doesNotMatch(rows[1][1], /disabled/, "Photo is active");
  for (const row of rows.slice(2)) assert.match(row[1], /disabled/, "All unapproved post types stay disabled");
  assert.match(markup, /aria-current="page"[^>]*>.*?is-post/s, "Post tab selected");
  currentState = reduce(currentState, { type: "OPEN_COMPOSER", kind: "photo" });
  assert.equal(currentState.composerKind, "photo");
  markup = renderTumblr(currentState, 0);
  assert.match(markup, />Cancel<.*>Post<.*<strong>Photo<\/strong>/s);
  const photoToken = currentState.composerSubmissionToken;
  currentState = reduce(currentState, { type: "EDIT_COMPOSER_CONTENT", value: "A caption" });
  currentState = reduce(currentState, { type: "SUBMIT_COMPOSER_POST", author: "Visitor", publishedAtMs: 0, submissionToken: photoToken });
  assert.equal(currentState.posts, originalPosts, "Photo cannot publish without image");
  const media = { id: "camera-resource", objectUrl: "blob:camera-resource", filename: "IMG_0001.JPG" };
  currentState = reduce(currentState, { type: "MEDIA_RETURN", contextId: "photo:stale", attachment: media });
  assert.equal(currentState.pendingAttachment, null, "Stale request cannot attach");
  currentState = reduce(currentState, { type: "MEDIA_RETURN", contextId: `photo:${photoToken}`, attachment: media });
  currentState = reduce(currentState, { type: "MEDIA_RETURN", contextId: `photo:${photoToken}` });
  assert.equal(currentState.pendingAttachment, media, "Picker cancellation preserves attachment");
  assert.equal(currentState.composerContent, "A caption");
  const submitPhoto = { type: "SUBMIT_COMPOSER_POST", author: "Visitor", publishedAtMs: 2000, submissionToken: photoToken };
  currentState = reduce(currentState, submitPhoto);
  currentState = reduce(currentState, submitPhoto);
  assert.equal(currentState.posts.length, originalPosts.length + 1);
  assert.equal(currentState.posts[0].attachment, media, "Publication reuses shared resource reference");
  assert.equal(currentState.posts[0].content, "A caption");
  assert.equal(currentState.pendingAttachment, null);
  assert.equal(currentState.composerContent, "");
  assert.match(renderTumblr(currentState, 2000), /src="blob:camera-resource"/);
  currentState = reduce(currentState, { type: "RESET" });
  assert.deepEqual(currentState.posts, originalPosts);

  currentState = reduce(currentState, { type: "SEARCH_QUERY", value: "no-matching-post" });
  markup = renderTumblr(currentState, 0);
  assert.match(markup, /aria-label="Search Tumblr"/);
  assert.match(markup, /aria-label="Clear search"/);
  assert.equal(parsePostRows(markup).length, 0, "Search only filters current local posts");
  currentState = reduce(currentState, { type: "RESET" });
  currentState = reduce(currentState, { type: "SELECT_TAB", tab: "settings" });
  markup = renderTumblr(currentState, 0);
  assert.match(markup, /class="tumblr-settings".*?data-evidence-status="RECONSTRUCTED"/);
  assert.deepEqual(currentState.posts, originalPosts, "Settings preserves posts");
  currentState = reduce(currentState, { type: "SELECT_TAB", tab: "dashboard" });
  assert.equal(currentState.currentView, "dashboard", "Dashboard tab restores feed");

  const firstSeedPostId = seedPosts[0].id;
  currentState = reduce(currentState, { type: "OPEN_POST", postId: firstSeedPostId, dashboardScrollPosition: 12 });
  markup = renderTumblr(currentState, 0);
  assert.equal(currentState.currentView, "post", "Post detail opens");
  assert.equal(currentState.selectedPostId, firstSeedPostId, "Selected post stored");
  assert.ok(markup.includes("class=\"tumblr-post-detail\""));
  currentState = reduce(currentState, { type: "BACK_TO_DASHBOARD" });
  assert.equal(currentState.currentView, "dashboard", "Back to dashboard from detail");

  currentState = reduce(currentState, { type: "OPEN_COMPOSER", kind: "text" });
  markup = renderTumblr(currentState, 0);
  assert.equal(currentState.currentView, "post", "Post-type selector opens composer");
  assert.equal(currentState.composerKind, "text", "Text composer selected");
  assert.ok(markup.includes("class=\"tumblr-composer\""), "Text composer route reached");
  assert.match(markup, /<input[^>]*>/, "Composer title control renders");
  assert.match(markup, /<textarea[^>]*>/, "Composer body control renders");
  const tumblrSource = await readFile(new URL("../device/TumblrContainer.tsx", import.meta.url), "utf8");
  assert.match(markup, /Close advanced options/);
  assert.ok(tumblrSource.includes("IOS4Input"), "Title uses IOS4Input");
  assert.match(tumblrSource, /onClick=\{\(\) => searchRef\.current\?\.focus\(\)\}/, "Top Search focuses existing field without navigation or query mutation");
  assert.match(tumblrSource, /IOS4Input ref=\{searchRef\} id="tumblr-dashboard-search" keyboardInputId="tumblr-search"/, "Search focus goes through shared keyboard binding");
  assert.doesNotMatch(tumblrSource, /state\.searchVisible|TOGGLE_SEARCH/, "Focus and blur cannot toggle row mounting");
  assert.match(tumblrSource, /keyboardReturnKeyType="search" keyboardDismissOnSubmit/, "Shared keyboard uses Search action");
  assert.ok(tumblrSource.includes("IOS4Textarea"), "Body uses IOS4Textarea");
  assert.doesNotMatch(tumblrSource, /<(?:input|textarea)\b/, "No app-specific native keyboard bypass");
  assert.match(tumblrSource, /kind === "Text" \? \(\) => dispatch\(\{ type: "OPEN_COMPOSER", kind: "text" \}\)/, "Only Text row opens composer");
  assert.match(tumblrSource, /dispatch\(\{ type: "SELECT_TAB", tab: tab.view \}\)/, "Bottom tabs use session-owned navigation");
  assert.match(markup, />Cancel<.*>Post<.*<strong>Text<\/strong>/s, "Composer has Cancel/Text/Post navigation");
  assert.doesNotMatch(markup, /aria-label="Tumblr tabs"/, "Composer reserves lower region for body and shared keyboard");

  const beforeCancelCount = currentState.posts.length;
  currentState = reduce(currentState, { type: "CANCEL_COMPOSER" });
  assert.equal(currentState.currentView, "dashboard", "Cancel composer returns dashboard");
  assert.equal(currentState.posts.length, beforeCancelCount, "Cancel creates no post");

  currentState = reduce(currentState, { type: "OPEN_COMPOSER", kind: "text" });
  currentState = reduce(currentState, { type: "EDIT_COMPOSER_TITLE", value: "First post" });
  currentState = reduce(currentState, { type: "EDIT_COMPOSER_CONTENT", value: "Body for first post" });
  const publishMs = 330000;
  const publishToken = currentState.composerSubmissionToken;
  const beforePublishCount = currentState.posts.length;
  currentState = reduce(currentState, {
    type: "SUBMIT_COMPOSER_POST",
    author: "Visitor",
    publishedAtMs: publishMs,
    submissionToken: publishToken,
  });
  assert.equal(currentState.posts.length, beforePublishCount + 1, "Publish creates one post");
  const createdPost = currentState.posts[0];
  const expectedTimestamp = `${simulatedDeviceDateTime(publishMs).toISOString().slice(0, 10)} ${simulatedClock(publishMs)}`;
  assert.equal(createdPost.timestamp, expectedTimestamp, "Canonical simulated timestamp used");

  currentState = reduce(currentState, {
    type: "SUBMIT_COMPOSER_POST",
    author: "Visitor",
    publishedAtMs: publishMs,
    submissionToken: publishToken,
  });
  assert.equal(currentState.posts.length, beforePublishCount + 1, "Idempotent submit token prevents duplicate publish");

  currentState = reduce(currentState, { type: "OPEN_POST", postId: firstSeedPostId, dashboardScrollPosition: 0 });
  currentState = reduce(currentState, { type: "OPEN_REBLOG", postId: firstSeedPostId });
  currentState = reduce(currentState, { type: "EDIT_REBLOG_TEXT", value: "A note" });
  const reblogMs = 700000;
  currentState = reduce(currentState, {
    type: "CONFIRM_REBLOG",
    rebloggedBy: "Visitor",
    actionElapsedMs: reblogMs,
  });
  const reblog = currentState.reblogs.find(entry => entry.sourcePostId === firstSeedPostId);
  assert.ok(reblog, "Reblog creates relation");
  assert.equal(reblog.actionTimestamp, reblogMs, "Reblog uses canonical actionElapsedMs");

  const beforeSecondPublish = currentState.posts.length;
  currentState = reduce(currentState, { type: "BACK_TO_DASHBOARD" });
  currentState = reduce(currentState, { type: "SELECT_TAB", tab: "post-types" });
  currentState = reduce(currentState, { type: "OPEN_COMPOSER", kind: "text" });
  currentState = reduce(currentState, { type: "EDIT_COMPOSER_CONTENT", value: "Second post after navigation" });
  assert.notEqual(currentState.composerSubmissionToken, publishToken, "Navigation never recycles a published token");
  currentState = reduce(currentState, { type: "SUBMIT_COMPOSER_POST", author: "Visitor", publishedAtMs: 720000, submissionToken: currentState.composerSubmissionToken });
  assert.equal(currentState.posts.length, beforeSecondPublish + 1, "Publish works again after detail/reblog/tab navigation");
  assert.equal(currentState.reblogs.find(entry => entry.sourcePostId === firstSeedPostId)?.actionTimestamp, reblogMs, "Tab navigation preserves canonical reblog");
  currentState = reduce(currentState, { type: "SELECT_TAB", tab: "post-types" });
  currentState = reduce(currentState, { type: "OPEN_COMPOSER", kind: "text" });
  currentState = reduce(currentState, { type: "EDIT_COMPOSER_CONTENT", value: "Discard me" });
  currentState = reduce(currentState, { type: "RESET" });
  assert.equal(currentState.currentView, "dashboard");
  assert.equal(currentState.composerKind, null);
  assert.equal(currentState.composerContent, "");

  const liveEvents = buildSessionTimelineEvents().filter(event => event.type === "tumblrBackgroundPost" && event.sourceApp === "tumblr");
  assert.equal(liveEvents.length, 1, "Single Tumblr background event in timeline");
  const liveEvent = liveEvents[0];
  assert.equal(liveEvent.dueElapsedMs, 630 * 1000, "T+630 live event scheduled");
  assert.equal(liveEvent.payload?.kind, "tumblr-post");
  const livePost = liveEvent.payload?.post;
  assert.equal(livePost?.title, "After midnight");
  assert.ok(livePost?.content.includes("The city gets quieter after midnight."));

  currentState = reduce(currentState, { type: "RESET" });
  const resetState = initial();
  assert.deepEqual(currentState.posts, resetState.posts, "RESET restores historical seeds");
  assert.deepEqual(currentState.notes, resetState.notes, "RESET restores historical notes");
  assert.equal(currentState.posts.some(post => post.id === livePost.id), false, "Reset clears transiently injected live post");

  currentState = reduce(currentState, { type: "DELIVER_BACKGROUND_POST", post: livePost });
  currentState = reduce(currentState, { type: "DELIVER_BACKGROUND_POST", post: livePost });
  assert.equal(currentState.posts.filter(post => post.id === livePost.id).length, 1, "T+630 live post appears exactly once");
  assert.equal(currentState.posts.find(post => post.id === livePost.id)?.title, "After midnight");


  // Two complete v0.4 sessions, including identity collision with a seeded blog.
  for (let run = 0; run < 2; run++) {
    currentState = initial();
    assert.deepEqual(tumblrMyPosts(currentState), []);
    const source = currentState.posts[0];
    const seedNoteCount = currentState.notes.filter(n => n.sourcePostId === source.id).length;
    for (const kind of ["text", "photo"]) {
      currentState = reduce(currentState, { type: "OPEN_COMPOSER", kind });
      currentState = reduce(currentState, { type: "EDIT_COMPOSER_CONTENT", value: `Own ${kind}` });
      if (kind === "photo") currentState = reduce(currentState, { type: "MEDIA_RETURN", contextId: `photo:${currentState.composerSubmissionToken}`, attachment: media });
      currentState = reduce(currentState, { type: "SUBMIT_COMPOSER_POST", author: source.blog, publishedAtMs: kind === "text" ? 1000 : 2000, submissionToken: currentState.composerSubmissionToken });
    }
    assert.equal(tumblrMyPosts(currentState).length, 2, "Name collision never includes seed posts");
    assert.equal(tumblrMyPosts(currentState)[0].post.attachment, media);
    currentState = reduce(currentState, { type: "OPEN_POST", postId: source.id, dashboardScrollPosition: 0 });
    currentState = reduce(currentState, { type: "TOGGLE_LIKE", postId: source.id, blogName: "Visitor" });
    assert.equal(currentState.notes.filter(n => n.sourcePostId === source.id).length, seedNoteCount + 1);
    assert.equal(tumblrMyPosts(currentState).length, 2, "Likes do not confer authorship");
    currentState = reduce(currentState, { type: "TOGGLE_LIKE", postId: source.id, blogName: "Visitor" });
    assert.equal(currentState.notes.filter(n => n.sourcePostId === source.id).length, seedNoteCount);
    currentState = reduce(currentState, { type: "OPEN_REBLOG", postId: source.id });
    const confirm = { type: "CONFIRM_REBLOG", rebloggedBy: "Visitor", actionElapsedMs: 3000 };
    currentState = reduce(reduce(currentState, confirm), confirm);
    assert.equal(currentState.notes.filter(n => n.sourcePostId === source.id).length, seedNoteCount + 1);
    const own = tumblrMyPosts(currentState);
    assert.equal(own.length, 3);
    assert.equal(own[0].post, source, "Reblog keeps original object/source attribution");
    assert.equal(own[0].reblog.actionTimestamp, 3000);
    assert.deepEqual(own.slice(1).map(e => e.post.type), ["photo", "text"]);
    currentState = reduce(currentState, { type: "OPEN_NOTES", postId: source.id });
    markup = renderTumblr(currentState, 3000);
    assert.match(markup, new RegExp(`${seedNoteCount + 1} notes on`));
    assert.match(markup, /reblogged this/);
    currentState = reduce(currentState, { type: "BACK_TO_DASHBOARD" });
    currentState = reduce(currentState, { type: "SELECT_DASHBOARD_SEGMENT", segment: "my-posts" });
    currentState = reduce(reduce(currentState, { type: "DELIVER_BACKGROUND_POST", post: livePost }), { type: "DELIVER_BACKGROUND_POST", post: livePost });
    markup = renderTumblr(currentState, 3000);
    assert.match(markup, /aria-pressed="true">My Posts/);
    assert.match(markup, /Visitor reblogged/);
    assert.match(markup, /Own text/);
    assert.match(markup, /src="blob:camera-resource"/);
    assert.doesNotMatch(markup, /After midnight/);
    assert.equal(currentState.posts.filter(p => p.id === livePost.id).length, 1);
    assert.equal([...markup.matchAll(/aria-current="page"/g)].length, 1);
    currentState = reduce(currentState, { type: "SELECT_TAB", tab: "settings" });
    markup = renderTumblr(currentState, 3000);
    assert.match(markup, /<dt>Blog<.*Visitor/s);
    assert.doesNotMatch(markup, /<input|<textarea/);
    assert.equal([...markup.matchAll(/aria-current="page"/g)].length, 1);
    currentState = reduce(currentState, { type: "SELECT_TAB", tab: "dashboard" });
    assert.equal(currentState.dashboardSegment, "my-posts");
    currentState = reduce(currentState, { type: "RESET" });
    assert.deepEqual(currentState, initial());
    assert.deepEqual(tumblrMyPosts(currentState), []);
  }
  console.log("PASS: Tumblr Phase-1/v0.3 structure, search, photo identity/publication, HOLD, keyboard, reblog/reset/timing checks complete.");
} finally {
  await server.close();
}
