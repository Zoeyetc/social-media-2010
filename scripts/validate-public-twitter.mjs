import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "vite";

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });

try {
  const repositoryModule = await vite.ssrLoadModule("/src/data/publicTwitterRepository.ts");
  const mockModule = await vite.ssrLoadModule("/src/data/mockPublicTwitterRepository.ts");
  const fixturesModule = await vite.ssrLoadModule("/src/data/publicTwitterFixtures.ts");
  const publicState = await vite.ssrLoadModule("/src/state/publicTwitterState.ts");
  const composition = await vite.ssrLoadModule("/src/state/twitterTimelineComposition.ts");
  const seed = await vite.ssrLoadModule("/src/data/sessionSeedContent.ts");
  const timeline = await vite.ssrLoadModule("/src/data/sessionTimeline.ts");
  const submissionMock = await vite.ssrLoadModule("/src/data/mockPublicTwitterSubmissionRepository.ts");
  const twitter = await vite.ssrLoadModule("/src/state/twitterState.ts");
  const outro = await vite.ssrLoadModule("/src/state/publicTwitterOutroState.ts");

  const repository = mockModule.createMockPublicTwitterRepository();
  const first = await repository.listApprovedPosts();
  const second = await repository.listApprovedPosts();
  assert.deepEqual(first, second, "mock reads must be deterministic");
  assert.notStrictEqual(first, second, "each mock read must return an independent immutable array");
  assert.equal(Object.isFrozen(first), true, "mock result arrays must be immutable");
  assert.equal(fixturesModule.PUBLIC_TWITTER_MOCK_DTOS.length, 6, "P1b must retain a small mock fixture set");
  assert.deepEqual((await repository.listApprovedPosts({ limit: 2 })).map(post => post.id), first.slice(0, 2).map(post => post.id), "limit must preserve stable order");
  assert.deepEqual(await repository.listApprovedPosts({ limit: 0 }), [], "zero limit must return no records");
  assert.ok(first.every(post => post.origin === "public_visitor"), "all repository records must retain public provenance");
  assert.ok(first.every(post => post.body.length <= 140), "mock bodies must honor the current UTF-16 limit");
  assert.ok(first.every(post => !post.publicHandle.startsWith("@")), "domain handles must omit the rendering @ prefix");
  assert.ok(first.every(post => {
    const time = Date.parse(post.simulated2010CreatedAt);
    return time >= repositoryModule.PUBLIC_TWITTER_SIMULATED_START_MS
      && time <= repositoryModule.PUBLIC_TWITTER_SIMULATED_END_MS;
  }), "mock timestamps must stay within the canonical experience window");

  const baseDto = fixturesModule.PUBLIC_TWITTER_MOCK_DTOS[0];
  const invalid = [
    { ...baseDto, id: "" },
    { ...baseDto, public_handle: "@" },
    { ...baseDto, body: "x".repeat(141) },
    { ...baseDto, simulated_2010_created_at: "not-a-date" },
    { ...baseDto, origin: "seed" },
    { ...baseDto, moderation_status: "pending" },
    { ...baseDto, deleted_at: "2026-08-01T05:00:00.000Z" },
  ];
  assert.deepEqual(repositoryModule.mapApprovedPublicTwitterPostDtos(invalid), [], "invalid, non-approved, and deleted DTOs must be filtered");

  const fixtureIds = new Set(first.map(post => post.id));
  assert.ok(seed.SESSION_SEED_CONTENT.twitter.every(tweet => !fixtureIds.has(tweet.id)), "public fixtures must not enter canonical Twitter seed");
  assert.ok(timeline.TWITTER_LIVE_ACTIVITY_POOL.every(event => !fixtureIds.has(event.payload.post.id)), "public fixtures must not enter the realtime scheduler");

  const selectedA = composition.selectPublicVisitorPostIds(first, "experience-a");
  const selectedAAgain = composition.selectPublicVisitorPostIds(first, "experience-a");
  const selectedB = composition.selectPublicVisitorPostIds(first, "experience-b");
  assert.deepEqual(selectedA, selectedAAgain, "same experience must select the same public sample");
  assert.equal(selectedA.length, 3, "public sample must be capped at three");
  assert.equal(new Set(selectedA).size, selectedA.length, "public sample must not duplicate records");
  assert.notDeepEqual(selectedA, selectedB, "different experience seeds may select a different sample");

  const canonicalStart = Date.parse("2010-10-20T00:01:00-07:00");
  const canonical = Array.from({ length: 13 }, (_, index) => ({
    id: `canonical-${index}`, tweet: { id: `canonical-${index}`, displayName: "Canonical", text: `${index}`, timestamp: "12:01 AM", contentStatus: "HOLD-fictional", origin: "seed" }, retweetActivity: false, effectiveAt: canonicalStart - index * 60_000,
  }));
  const composed = composition.composeTwitterTimelineActivities(canonical, first, selectedA, 15 * 60_000);
  assert.deepEqual(composed.filter(item => item.source === "canonical").map(item => item.id), canonical.map(item => item.id), "composition must preserve canonical relative order");
  assert.deepEqual(composed.filter(item => item.source === "public_visitor").map(item => item.id).sort(), [...selectedA].sort(), "composition must use stored selected IDs");
  assert.ok(composed.filter(item => item.source === "public_visitor").every(item => !item.capabilities.detail && !item.capabilities.profile && !item.capabilities.reply && !item.capabilities.retweet && item.capabilities.favorite), "P1b visitor capabilities must remain explicit and narrow");
  assert.ok(composed.slice(1).every((item, index) => composed[index].effectiveAt >= item.effectiveAt), "combined Timeline must remain monotonically reverse chronological");

  const thresholdPost = first.find(post => post.id === "visitor-dev-0003");
  assert.ok(thresholdPost, "temporal regression fixture must exist");
  const thresholdSelection = Object.freeze([thresholdPost.id]);
  const beforeThreshold = composition.composeTwitterTimelineActivities(canonical, first, thresholdSelection, thresholdPost.simulatedElapsedMs - 1);
  assert.equal(beforeThreshold.some(item => item.id === thresholdPost.id), false, "future selected visitor must remain hidden");
  const atThreshold = composition.composeTwitterTimelineActivities(canonical, first, thresholdSelection, thresholdPost.simulatedElapsedMs);
  assert.equal(atThreshold.some(item => item.id === thresholdPost.id), true, "selected visitor must become visible exactly at its elapsed threshold");
  assert.deepEqual(thresholdSelection, [thresholdPost.id], "future visibility gating must not mutate selected archive IDs");
  const visibleSelected = composition.composeTwitterTimelineActivities(canonical, first, selectedA, 240_000).filter(item => item.source === "public_visitor");
  assert.ok(visibleSelected.every(item => first.find(post => post.id === item.id).simulatedElapsedMs <= 240_000), "no visible visitor may be newer than current simulated elapsed time");

  const midnightCanonical = [
    { id: "canonical-1149", tweet: { id: "canonical-1149", displayName: "Canonical", text: "11:49", timestamp: "11:49 PM", contentStatus: "HOLD-fictional", origin: "seed" }, retweetActivity: false, effectiveAt: Date.parse("2010-10-19T23:49:00-07:00") },
    { id: "canonical-1126", tweet: { id: "canonical-1126", displayName: "Canonical", text: "11:26", timestamp: "11:26 PM", contentStatus: "HOLD-fictional", origin: "seed" }, retweetActivity: false, effectiveAt: Date.parse("2010-10-19T23:26:00-07:00") },
  ];
  assert.deepEqual(
    composition.composeTwitterTimelineActivities(midnightCanonical, first, [thresholdPost.id], thresholdPost.simulatedElapsedMs).map(item => item.id),
    [thresholdPost.id, "canonical-1149", "canonical-1126"],
    "midnight ordering must compare full simulated epochs rather than display strings",
  );

  const tieEpoch = Date.parse("2010-10-20T00:04:00-07:00");
  const tiedVisitors = [
    { ...first[0], id: "visitor-tie-a", simulated2010CreatedAt: new Date(tieEpoch).toISOString(), simulatedElapsedMs: 120_000 },
    { ...first[0], id: "visitor-tie-b", simulated2010CreatedAt: new Date(tieEpoch).toISOString(), simulatedElapsedMs: 120_000 },
  ];
  const tiedCanonical = [
    { id: "canonical-tie-b", tweet: { id: "canonical-tie-b", displayName: "Canonical", text: "b", timestamp: "12:04 AM", contentStatus: "HOLD-fictional", origin: "seed" }, retweetActivity: false, effectiveAt: tieEpoch },
    { id: "canonical-tie-a", tweet: { id: "canonical-tie-a", displayName: "Canonical", text: "a", timestamp: "12:04 AM", contentStatus: "HOLD-fictional", origin: "seed" }, retweetActivity: false, effectiveAt: tieEpoch },
  ];
  assert.deepEqual(
    composition.composeTwitterTimelineActivities(tiedCanonical, tiedVisitors, ["visitor-tie-b", "visitor-tie-a"], 120_000).map(item => item.id),
    ["canonical-tie-b", "canonical-tie-a", "visitor-tie-b", "visitor-tie-a"],
    "equal-time merge must explicitly preserve canonical precedence/input order and selected visitor order",
  );

  const mixedCanonical = [
    { id: "realtime", tweet: { id: "realtime", displayName: "Realtime", text: "live", timestamp: "12:12 AM", contentStatus: "HOLD-fictional", origin: "live" }, retweetActivity: false, effectiveAt: Date.parse("2010-10-20T00:12:00-07:00") },
    { id: "player", tweet: { id: "player", displayName: "Player", text: "local", timestamp: "12:08 AM", contentStatus: "HOLD-fictional", origin: "user" }, retweetActivity: false, effectiveAt: Date.parse("2010-10-20T00:08:00-07:00") },
    midnightCanonical[0],
  ];
  assert.deepEqual(
    composition.composeTwitterTimelineActivities(mixedCanonical, first, [thresholdPost.id], 15 * 60_000).map(item => item.id),
    ["realtime", thresholdPost.id, "player", "canonical-1149"],
    "realtime, visitor, player, and canonical activities must share one chronological merge without mutating their records",
  );
  assert.deepEqual(composition.composeTwitterTimelineActivities(canonical, [], [], 15 * 60_000), canonical.map(item => ({ ...item, source: "canonical", capabilities: { detail: true, profile: true, reply: true, retweet: true, favorite: true } })), "empty/error public data must leave canonical composition intact");

  const loaded = publicState.publicTwitterStateTransition(publicState.initialPublicTwitterState, { type: "LOAD_SUCCEEDED", posts: first, selectedArchiveIds: selectedA });
  assert.equal(loaded.status, "ready");
  assert.deepEqual(loaded.approvedPosts, first);
  assert.deepEqual(loaded.selectedArchiveIds, selectedA);
  const revealed = publicState.publicTwitterStateTransition(loaded, { type: "TOGGLE_ARCHIVE_ACTIONS", archiveId: selectedA[0] });
  assert.equal(revealed.revealedArchiveId, selectedA[0]);
  const reset = publicState.publicTwitterStateTransition(loaded, { type: "RESET_PUBLIC_SESSION" });
  assert.deepEqual(reset, publicState.initialPublicTwitterState, "public session reset must clear only local public-layer state");
  assert.equal(reset.publicHandle, null);
  assert.deepEqual(reset.selectedArchiveIds, []);

  assert.equal(publicState.initialPublicTwitterState.publicHandle, null, "public handle must start empty and independent of Hero identity");
  assert.equal(publicState.normalizePublicTwitterHandle(" @Coffee_Run "), "coffee_run");
  for (const invalidHandle of ["", "two words", "bad!", "abcdefghijklmnop"]) {
    assert.equal(publicState.normalizePublicTwitterHandle(invalidHandle), null, `invalid public handle must be rejected: ${invalidHandle}`);
  }

  let local = twitter.createInitialTwitterState("Hero Name");
  local = twitter.twitterStateTransition(local, { type: "BEGIN_NEW_TWEET" });
  local = twitter.twitterStateTransition(local, { type: "EDIT_COMPOSER", value: "same local and public body" });
  const localMoment = Date.parse("2010-10-20T00:08:00-07:00");
  local = twitter.twitterStateTransition(local, { type: "SUBMIT_NEW_TWEET", displayName: "Hero Name", createdAt: localMoment, timestamp: "12:08 AM" });
  const localTweet = local.timeline.find(tweet => tweet.id === "twitter-user-tweet-1");
  assert.ok(localTweet, "ordinary local Tweet must exist before any public submission");
  assert.equal(local.currentView, "timeline");
  assert.equal(local.composerKind, null);
  assert.equal(publicState.initialPublicTwitterState.submissionStatus, "idle", "ordinary Send must not create public intent");

  const snapshot = Object.freeze({ localTweetId: localTweet.id, body: localTweet.text, simulated2010CreatedAt: new Date(localMoment).toISOString(), simulatedElapsedMs: 360_000, idempotencyKey: "00000000-0000-4000-8000-000000000001" });
  let publicFlow = publicState.publicTwitterStateTransition(loaded, { type: "BEGIN_PUBLIC_INTENT", snapshot });
  assert.equal(publicFlow.submissionStatus, "awaiting_handle");
  assert.equal(publicFlow.publicHandle, null, "Hero identity must never initialize public handle");
  assert.equal(publicFlow.pendingSubmission.body, localTweet.text);
  assert.equal(publicFlow.pendingSubmission.simulated2010CreatedAt, new Date(localTweet.createdAt).toISOString());
  publicFlow = publicState.publicTwitterStateTransition(publicFlow, { type: "SET_PUBLIC_HANDLE", publicHandle: "coffee_run" });
  assert.equal(publicFlow.submissionStatus, "idle");

  const writeRepository = submissionMock.createMockPublicTwitterSubmissionRepository();
  const payload = { publicHandle: publicFlow.publicHandle, body: snapshot.body, simulated2010CreatedAt: snapshot.simulated2010CreatedAt, simulatedElapsedMs: snapshot.simulatedElapsedMs, idempotencyKey: snapshot.idempotencyKey };
  writeRepository.failNextSubmission();
  await assert.rejects(writeRepository.submit(payload), /Mock public submission failed/);
  assert.ok(local.timeline.some(tweet => tweet.id === localTweet.id), "public failure must not remove the local Tweet");
  const failed = publicState.publicTwitterStateTransition(publicFlow, { type: "SUBMISSION_FAILED", error: "Mock public submission failed" });
  assert.equal(failed.pendingSubmission.idempotencyKey, snapshot.idempotencyKey, "retry must retain idempotency key");
  const accepted = await writeRepository.submit(payload);
  assert.deepEqual(await writeRepository.submit(payload), accepted, "same key and payload must return the same result");
  await assert.rejects(writeRepository.submit({ ...payload, body: "conflict" }), /conflicting/);
  const nextSnapshot = { ...snapshot, localTweetId: "twitter-user-tweet-2", idempotencyKey: "00000000-0000-4000-8000-000000000002" };
  assert.notEqual(nextSnapshot.idempotencyKey, snapshot.idempotencyKey, "new Tweet must receive a new idempotency key");
  assert.deepEqual(composition.composeTwitterTimelineActivities(canonical, first, selectedA, 15 * 60_000).filter(item => item.source === "public_visitor").map(item => item.id).sort(), [...selectedA].sort(), "P1c submission must not enter or alter the approved P1b sample");
  const resetSubmission = publicState.publicTwitterStateTransition(failed, { type: "RESET_PUBLIC_SESSION" });
  assert.equal(resetSubmission.publicHandle, null);
  assert.equal(resetSubmission.submissionStatus, "idle");
  assert.equal(resetSubmission.pendingSubmission, null);

  assert.equal(outro.publicTwitterOutroTransition(outro.initialPublicTwitterOutroState, { type: "START", eligibleTweetIds: [] }).phase, "complete", "zero local Tweets must bypass selection");
  const eligibleOnly = outro.selectEligibleLocalTweetIds([
    { id: "seed", origin: "seed" }, { id: "live", origin: "live" }, { id: "visitor", origin: "public_visitor" }, { id: "local-1", origin: "user" }, { id: "local-2", origin: "user" },
  ]);
  assert.deepEqual(eligibleOnly, ["local-1", "local-2"], "outro eligibility must include only origin=user Tweets");
  let outroFlow = outro.publicTwitterOutroTransition(outro.initialPublicTwitterOutroState, { type: "START", eligibleTweetIds: eligibleOnly });
  assert.equal(outroFlow.phase, "selecting");
  assert.equal(outroFlow.selectedTweetId, null, "one or many eligible Tweets must start unselected");
  outroFlow = outro.publicTwitterOutroTransition(outroFlow, { type: "SELECT", tweetId: "local-1" });
  outroFlow = outro.publicTwitterOutroTransition(outroFlow, { type: "SELECT", tweetId: "local-2" });
  assert.equal(outroFlow.selectedTweetId, "local-2", "selection must remain max-one");
  assert.equal(outro.publicTwitterOutroTransition(outroFlow, { type: "SUBMIT" }).phase, "selecting", "final confirmation stage must be required before submission");
  outroFlow = outro.publicTwitterOutroTransition(outroFlow, { type: "ENTER_HANDLE" });
  outroFlow = outro.publicTwitterOutroTransition(outroFlow, { type: "EDIT_HANDLE", value: " @Coffee_Run " });
  const outroHandle = publicState.normalizePublicTwitterHandle(outroFlow.handleInput);
  outroFlow = outro.publicTwitterOutroTransition(outroFlow, { type: "CONFIRM_HANDLE", publicHandle: outroHandle });
  assert.equal(outroFlow.phase, "confirming");
  outroFlow = outro.publicTwitterOutroTransition(outroFlow, { type: "SUBMIT" });
  assert.equal(outroFlow.phase, "submitting");
  const withdrawRepository = submissionMock.createMockPublicTwitterSubmissionRepository();
  const withdrawAccepted = await withdrawRepository.submit({ ...payload, idempotencyKey: "00000000-0000-4000-8000-000000000003" });
  const withdrawnResult = await withdrawRepository.withdraw(withdrawAccepted.submissionId);
  assert.equal(withdrawnResult.status, "withdrawn");
  assert.equal(withdrawRepository.isWithdrawn(withdrawAccepted.submissionId), true, "mock withdrawal must mark only the mock submission");
  assert.deepEqual(composition.composeTwitterTimelineActivities(canonical, first, selectedA, 15 * 60_000).filter(item => item.source === "public_visitor").map(item => item.id).sort(), [...selectedA].sort(), "outro submit/withdraw must not affect P1b sample");

  const appSource = readFileSync(new URL("../src/device/App.tsx", import.meta.url), "utf8");
  assert.match(appSource, /session\.shutdownReason !== "battery"[\s\S]+performCanonicalShutdownReset/, "manual shutdown must use canonical reset without outro");
  assert.match(appSource, /session\.phase === "shutdown" \|\| elapsed >= SESSION_DURATION_MS\) return;[\s\S]+nextDueDeviceEvent/, "scheduler delivery must freeze during shutdown/outro");
  assert.match(appSource, /performCanonicalShutdownReset\(session\.shutdownReason\)/, "outro completion must converge on canonical reset");
  const twitterContainerSource = readFileSync(new URL("../src/device/TwitterContainer.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(twitterContainerSource, /PublicTwitterOutro|Leave a Tweet for other visitors/, "P1d must not modify or enter historical Twitter UI");
  const outroSource = readFileSync(new URL("../src/device/PublicTwitterOutro.tsx", import.meta.url), "utf8");
  assert.match(outroSource, /Your Tweet won't be left for other visitors\./, "withdrawn outro must use player-facing project UX wording");
  assert.doesNotMatch(outroSource, /This Tweet has been withdrawn from this prototype submission\./, "withdrawn outro must not restore implementation-language copy");

  console.log("Public Visitor Twitter P1d checks: PASS");
} finally {
  await vite.close();
}
