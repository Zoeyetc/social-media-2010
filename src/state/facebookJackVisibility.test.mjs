import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
try {
  const f = await server.ssrLoadModule('/src/state/facebookState.ts');
  let state = f.createInitialFacebookState('Visitor');
  const wall = s => f.selectFacebookProfileWall(s, 'Jack Keller');
  const feed = s => f.selectFacebookVisibleFeed(s);
  const has = (items, id) => items.some(p => p.id === id);
  const originals = state.feed.map(p => ({ ...p }));
  assert.equal(has(wall(state), 'jack-movie'), false);
  assert.equal(has(feed(state), 'jack-movie'), false);
  // Exercise Everyone explicitly without changing canonical seed audiences.
  const publicPost = { ...state.feed.find(p => p.id === 'jack-movie'), id: 'public-fixture', visibility: 'everyone' };
  state = { ...state, feed: [...state.feed, publicPost] };
  state = f.facebookStateTransition(state, { type: 'DELIVER_JACK_REQUEST' });
  assert.equal(state.friendRequestState, 'pending');
  assert.equal(has(wall(state), publicPost.id), true);
  assert.equal(has(feed(state), publicPost.id), true);
  const before = state;
  state = f.facebookStateTransition(state, { type: 'ACCEPT_JACK' });
  assert.equal(has(wall(state), 'jack-movie'), true);
  assert.equal(has(feed(state), 'jack-movie'), true);
  assert.deepEqual(state.feed, before.feed, 'acceptance does not republish, retimestamp, or duplicate');
  assert.deepEqual(state.feed.slice(0, -1), originals);
  assert.equal(f.facebookStateTransition(state, { type: 'ACCEPT_JACK' }), state);
  for (const current of [before, state]) {
    for (const post of current.feed.filter(p => p.friendId === 'jack' && p.visibility === 'custom' && !p.customAudienceIncludesUser)) {
      assert.equal(has(wall(current), post.id), false, `${post.id}: Wall metadata cannot bypass custom audience`);
      assert.equal(has(feed(current), post.id), false);
    }
    assert.equal(has(wall(current), 'jack-owned-j-2009-photo'), true, 'eligible older history remains on Wall');
    assert.equal(has(feed(current), 'jack-owned-j-2009-photo'), false, 'Feed year gate unchanged');
    const entries = feed(current);
    for (let i = 1; i < entries.length; i++) assert.ok(Date.parse(entries[i-1].createdAt) >= Date.parse(entries[i].createdAt));
  }
  console.log('PASS: public before acceptance, friends-only unlock, custom exclusions, historical Wall/Feed distinction, chronology and idempotent acceptance');
} finally { await server.close(); }
