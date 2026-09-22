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
  const relationshipIds = ['jack-matt-2010-photo', 'jack-car-matt-2009-photos', 'jack-matt-2008-photo', 'jack-matt-family-2007-photo'];
  for (const id of relationshipIds) {
    const post = state.feed.find(p => p.id === id);
    assert.equal(post.visibility, 'friends');
    assert.equal(post.customAudienceIncludesUser, undefined);
    assert.equal(has(wall(state), id), false, `${id}: hidden before friendship`);
    assert.equal(has(feed(state), id), false);
  }
  const before = state;
  state = f.facebookStateTransition(state, { type: 'ACCEPT_JACK' });
  assert.equal(has(wall(state), 'jack-movie'), true);
  assert.equal(has(feed(state), 'jack-movie'), true);
  for (const id of relationshipIds) {
    assert.equal(wall(state).filter(p => p.id === id).length, 1, `${id}: one Wall entry after friendship`);
    assert.deepEqual(state.feed.find(p => p.id === id), before.feed.find(p => p.id === id), 'timestamps, captions and media unchanged');
    assert.equal(has(feed(state), id), id === 'jack-matt-2010-photo', 'older history cannot enter 2010 Feed');
  }
  assert.deepEqual(wall(state).filter(p => relationshipIds.includes(p.id)).map(p => p.id), relationshipIds, 'original relationship chronology');
  const wallEntries = wall(state).filter(p => p.id !== publicPost.id);
  for (let i=1;i<wallEntries.length;i++) assert.ok(Date.parse(wallEntries[i-1].createdAt)>=Date.parse(wallEntries[i].createdAt));
  assert.ok(feed(state).findIndex(p => p.id === 'jack-movie') < feed(state).findIndex(p => p.id === 'jack-matt-2010-photo'), '2010 history stays behind the newer original status');
  for (const id of ['jack-practice-brutal','jack-car-photo','jack-profile-picture-update']) {
    const post = state.feed.find(p => p.id === id);
    assert.equal(post.visibility, 'custom'); assert.equal(post.customAudienceIncludesUser, false);
    assert.equal(has(wall(before),id),false); assert.equal(has(wall(state),id),false);
  }
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
