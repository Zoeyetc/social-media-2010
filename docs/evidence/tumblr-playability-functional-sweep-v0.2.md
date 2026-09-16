# Tumblr Playability Functional Sweep v0.2

## Scope

This sweep covers Tumblr-local Reblog confirmation, optional Reblog text, Notes viewing, and current-user Like/Reblog Note relations. It preserves the existing Dashboard, Post Detail, scroll restoration, live-post delivery, and App Runtime ownership.

## Reblog state model

Each active current-user Reblog is stored independently from its source post:

```ts
{
  id: `user-reblog:${sourcePostId}`,
  sourcePostId,
  reblogged: true,
  rebloggedBy: sessionIdentity.name,
  optionalUserText: string | null,
  actionTimestamp
}
```

- `OPEN_REBLOG` enters a minimal local flow without changing Reblog state.
- Optional text is plain and capped at 140 characters as a compact functional approximation; the exact historical limit remains HOLD.
- Cancel returns to Post Detail and clears the draft without creating a relation.
- Confirm stores exactly one stable relation and returns to Post Detail.
- The original author, content, post ID, seed/live origin, and source object remain untouched.
- Unreblog removes only the matching current-user relation and current-user Reblog Note.

No source post is cloned into a user-authored Dashboard object, and no global event is scheduled.

## Notes model

Notes use:

```ts
{
  id,
  sourcePostId,
  blogName,
  type: "liked" | "reblogged",
  origin: "seed" | "user"
}
```

- One sparse seeded reblog Note provides the current read-only baseline after the approved unfinished-photo cleanup.
- Its blog name (`smallhours`) and exact wording are project-curated `CURATED/HOLD`, not historical claims.
- Like creates/removes one stable `user-like:<sourcePostId>` Note.
- Confirmed Reblog creates one stable `user-reblog:<sourcePostId>` Note.
- Notes render in stored chronological action order; exact historical timestamp/writing presentation remains HOLD.
- Opening Notes is read-only and does not Like or Reblog.

## Functional results

| Check | Result | Evidence |
| --- | --- | --- |
| Existing Dashboard | PASS | Seed posts remain cloned into session state; scheduled live post still delivers once. |
| Post Detail and Back | PASS | Existing selected-post and Dashboard scroll model remains intact. |
| Like / Unlike | PASS | Like state remains independent and creates/removes only its own user Note. |
| Reblog opens minimal flow | PASS | Valid source opens Reblog without marking it active. |
| Optional text and Cancel | PASS | Draft is capped locally, survives the flow, and Cancel clears it without a relation. |
| Confirm Reblog | PASS | Stores source ID, identity, optional text, action timestamp, and stable relation ID. |
| Duplicate prevention | PASS | A source cannot enter another flow while active; reblogging after removal restores one relation, not duplicates. |
| Unreblog | PASS | Removes only the user Reblog/reblog Note; source post and Like remain. |
| Notes view | PASS | Filters seed/user liked/reblogged Notes for the selected post. |
| Live-event compatibility | PASS | Existing live post delivery preserves current-user Reblog, Like, Notes, and scroll state. |
| Suspension/resume | PASS (architecture/code-level) | All added fields remain in the existing mounted Tumblr reducer. No lifecycle transition resets them. Browser interaction was not performed. |
| Session reset | PASS | Reset removes Zoey state and live additions while restoring seed posts and two seed Notes for Alex. |
| Cross-app isolation | PASS (diff inspection) | Changes are confined to Tumblr state/container/styles, validation assertions, planning, and this document. |

## Interaction independence

Automated checks verify:

- Like does not create a Reblog.
- Reblog does not remove or create Like state.
- Opening Notes changes only the current view.
- Unreblog preserves Like and its user Note.
- Unreblog preserves original seed/live posts and seed Notes.
- Live Tumblr delivery does not duplicate or overwrite user actions.

## Findings

### A — Architecture / Blocker

None found.

### B — Functional

None found by reducer tests, build validation, and diff inspection.

### C — Polish / Historical fidelity

- Exact 2010 Tumblr Reblog and Notes chrome.
- Exact Notes wording, ordering metadata, timestamps, typography, gradients, and spacing.
- Provenance-complete seed blog identities and post artwork.

These remain backlog items and were not polished.

## HOLD boundaries

- Full Tumblr posting/composer and post-type picker.
- Text, photo, quote, link, chat, audio, and video creation flows.
- Exact icon, imagery, animations, and pixel geometry.
- Modern reactions, activity filtering, floating compose, communities, and modern cards remain excluded.

## Validation

- `npm run test:seed`: PASS
- `npm run build`: PASS
- `git diff --check`: PASS
- Global scheduler and Cross-App Timeline: unchanged
- Twitter/Facebook/Foursquare/Flickr: unchanged
- Camera Runtime: unchanged
- Historical artwork: none added or modified

## Checkpoint recommendation

Tumblr v0.2 is ready for a **code-level functional checkpoint**. Manual browser interaction remains NOT TESTED. The umbrella App Playability Expansion remains in progress.
