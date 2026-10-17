import assert from "node:assert/strict";
import { createServer } from "vite";
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom", logLevel: "silent" });
try {
  const m = await server.ssrLoadModule("/src/state/messagesState.ts");
  const scheduler = await server.ssrLoadModule("/src/state/deviceEventScheduler.ts");
  let state = m.messagesStateTransition(m.createInitialMessagesState(), { type: "OPEN_CONVERSATION", conversationId: "mom" });
  for (const text of ["yes", "YES", "yes!", "yes mom", "yes mom!", "yes mami", "yes mommy", "yeah mom", "yep mom", "  YUP, MOM!! "]) {
    assert.equal(m.classifyMomReply(text), "affirmative", text);
    assert.equal(m.shouldScheduleMomReply(state, text), true, text);
    assert.equal(m.shouldScheduleMomLoveReply(state, text), false, "affirmative never claims the love path");
  }
  for (const text of ["no mom", "maybe mom", "not yet mom", "yes dad", "I said yes yesterday", "yes mom but no", "yesterday mom"]) assert.equal(m.shouldScheduleMomReply(state, text), false, text);
  for (const text of ["i love you", "love you", "love u", "luv you", "luv u", "I LOVE YOU!!!"]) assert.equal(m.shouldScheduleMomLoveReply(state, text), true);
  state = m.messagesStateTransition(state, { type: "EDIT_DRAFT", value: "yes mami" });
  state = m.messagesStateTransition(state, { type: "SEND" });
  assert.equal(state.momReply, "pending");
  assert.equal(m.shouldScheduleMomReply(state, "yes mom"), false, "one-time pending claim");
  state = m.messagesStateTransition(state, { type: "BACK_TO_LIST" });
  state = m.messagesStateTransition(state, { type: "TOGGLE_LIST_EDIT" });
  state = m.messagesStateTransition(state, { type: "SELECT_DELETE_CONVERSATION", conversationId: "mom" });
  state = m.messagesStateTransition(state, { type: "DELETE_CONVERSATION", conversationId: "mom" });
  assert.equal(state.momReply, "pending");
  state = m.messagesStateTransition(state, { type: "DELIVER_MOM_REPLY" });
  assert.equal(state.messages.filter(x => x.id === "mom-sleep-early").length, 1);
  state = m.messagesStateTransition(state, { type: "DELIVER_MOM_REPLY" });
  assert.equal(state.messages.filter(x => x.id === "mom-sleep-early").length, 1);
  assert.equal(state.momReply, "delivered");
  assert.deepEqual(scheduler.scheduleDeviceEvent([], { id: "late", type: "momReply", dueElapsedMs: 900000 }), []);
  const delay = m.deterministicMomLoveReplyDelayMs("QA");
  assert.equal(delay, m.deterministicMomLoveReplyDelayMs("QA")); assert.ok(delay >= 20000 && delay <= 60000);
  console.log("PASS: bounded Mom address forms, negative/ambiguous rejection, independent love intent, pending/delivered claims, deletion recreation and terminal cutoff");
} finally { await server.close(); }
