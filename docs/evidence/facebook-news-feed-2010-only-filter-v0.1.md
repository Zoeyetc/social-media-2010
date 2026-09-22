# Facebook News Feed 2010-Only Filter v0.1

## Rule

Facebook News Feed eligibility is now `calendar year 2010 in America/Los_Angeles AND canonical timestamp <= simulated now AND existing audience/friendship visibility`. The year gate only rejects content; it does not promote private Profile history or bypass existing ranking/order. Profile Wall, Albums, Profile Pictures, Photo Detail, and Photos of a character do not use the year gate.

The centralized `isFacebookNewsFeedEligible` selector reads `createdAt`, formats its year explicitly in `America/Los_Angeles`, applies the future guard, and then delegates audience rules to `isFacebookStoryVisibleToUser`. User-created and delivered live Facebook stories receive canonical `createdAt` instants when created.

## Current candidate audit

| Story ID or exact family | Actor | Year | Feed eligible | Reason |
|---|---|---:|---|---|
| `ben-long-day`, `mike-anil-question`, `june-show-photos-oct19` | Ben / Mike / June | 2010 | Yes | 2010, pre-session, and visible through existing audience rules |
| `jack-movie` | Jack | 2010 | Conditional | Requires accepted friendship |
| `alex-jacks-party-friday`, `katie-coffee`, `jay-reading` | Alex / Katie / Jay | 2010 | Yes | Existing visible seed candidates |
| `luca-pickup-basketball-photos`, `luca-main-street-diner-checkin`, `jay-band-performance-photo`, `jay-guitar-photo`, `z-tokyo-profile-picture-update` | Luca / Jay / Z.tokyo | 2010 | Yes | 2010 and existing audience permits distribution |
| `jack-football-game-photo`, `sophie-jack-tagged-02`, `sophie-jack-tagged-03`, `ryan-jack-night-photo`, `june-jack-tagged-night-photo`, `luca-jack-tagged-photo`, `matt-jack-tagged-photo`, `jack-summer-party-photo`, `jack-summer-photos` | Upload owners | 2010 | Yes | Owner upload stories with friends-of-friends visibility |
| `june-starbucks-photo`, `june-profile-picture-update`, `sophie-june-club-photo-story`, `june-home-photo`, `june-sophie-photo`, `june-graduation-photo`, `june-18th-birthday-photos` | June / Sophie | 2010 | No for current user | Pass year gate but remain custom/private |
| `jack-practice-brutal`, `jack-car-photo`, `jack-profile-picture-update` | Jack | 2010 | No for current user | Pass year gate but remain custom/private |
| `luca-profile-picture-current`, `luca-work-main-street-diner` | Luca | 2010 | No for current user | Pass year gate but remain custom/private |
| `jay-may-guitar-photo` | Jay | 2010 | Yes | Canonical friends-visible May music story |
| Katie's 2010 profile/selfie stories | Katie | 2010 | No for current user | Pass year gate but remain custom/private |
| `ben-photo-friday-2010` | Ben | 2010 | Yes | Canonical friends-visible Oct 15 photo story |
| Ben's `ben-wall-2010-*`, `ben-profile-current-update`, `ben-car-2010` | Ben | 2010 | No for current user | Profile and Wall history remains custom/private |
| `jack-car-matt-2009-photos`, `jack-owned-j-2009-photo`, `jack-matt-2008-photo`, `jack-matt-family-2007-photo` | Jack | 2007–2009 | No | Hard year rejection; remains on Jack Wall/Photos |
| `alex-dogs-wangcai-bb-2009`, `alex-dog-golden-2007` | Alex | 2007 / 2009 | No | Hard year rejection; remains in Dogs album |
| `katie-selfie-august-2009`, `katie-selfie-july-2009` | Katie | 2009 | No | Hard year rejection; remains in Photos |
| Ben's `ben-wall-2009-*`, `ben-coffee-2009`, `ben-coffee-2006`, `ben-profile-2005-update` | Ben | 2005–2009 | No | Hard year rejection; remains on Wall/in albums |
| `chris-profile-picture-update` | Chris | 2009 | No | Hard year rejection; remains in Profile Pictures and Wall history |
| `matt-photo-2007`, `matt-profile-2007-update` | Matt | 2007 | No | Hard year rejection; remains in Matt Photos/Profile Pictures |
| `facebook-june-instagram-announcement`, `facebook-june-jack-gossip-ryan-standalone` | June / Ryan | 2010 live | After delivery/time | Canonical `createdAt` plus future guard; scheduler remains authoritative |
| `facebook-user-status-*` | Session user | 2010 live | After creation | Canonical simulated creation instant and existing audience rules |

Katie/Chris/Sophie live gossip additions are comments on existing 2010 stories rather than separate Feed candidates. Jack requests, messages, party invitation state, and notifications are not Feed stories and remain outside this selector.

## Preserved surfaces

The year gate is not called by Profile Wall or photo selectors. Historical Jack, Alex, Ben, Matt, Chris, and Katie content remains discoverable through their canonical Wall and photo relationships. No scheduler timing, story timestamp, album membership, tag relationship, or media file is changed.

## RC Jack/Matt relationship audience correction

User-approved narrative metadata: `jack-matt-2010-photo`,
`jack-car-matt-2009-photos`, `jack-matt-2008-photo`, and
`jack-matt-family-2007-photo` are Friends, superseding their former
Custom/user-excluded classification. All four remain hidden on Jack's Wall
before friendship and become eligible after acceptance. This is curated
narrative intent, not an archival claim about real posts' privacy settings.

The 2010 photo becomes Feed-eligible at its original October 18 timestamp;
the 2007–2009 posts remain excluded by the Feed year gate. Acceptance changes
no IDs, timestamps, captions, media, or insertion order. Unrelated Jack Custom
posts remain private. Audience selectors are unchanged.
