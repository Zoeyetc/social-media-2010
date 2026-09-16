import { CORE_SOCIAL_CHARACTERS, CORE_SOCIAL_FRIENDS } from "./coreSocialFriends";
import { FACEBOOK_AUTHOR_EASTER_EGG_ID, FACEBOOK_AUTHOR_EASTER_EGGS, FACEBOOK_EPHEMERAL_DANIEL_ID, FACEBOOK_EPHEMERAL_DEREK_ID, FACEBOOK_EPHEMERAL_EMILY_ID, FACEBOOK_EPHEMERAL_ERIC_ID, FACEBOOK_EPHEMERAL_FRANK_ID, FACEBOOK_EPHEMERAL_FRIEND_OF_FRIEND_ID, FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS, FACEBOOK_EPHEMERAL_KEVIN_ID, FACEBOOK_EPHEMERAL_MEGAN_ID, FACEBOOK_EPHEMERAL_MIKE_ID, FACEBOOK_EPHEMERAL_NICOLE_ID, FACEBOOK_EPHEMERAL_NICK_ID, FACEBOOK_EPHEMERAL_RACHEL_ID, FACEBOOK_EPHEMERAL_SAM_ID, FACEBOOK_EPHEMERAL_SARAH_ID, FACEBOOK_EPHEMERAL_SOPHIE_ID } from "./facebookActors";
import { JACK_18TH_BIRTHDAY_MEDIA_IDS, JUNE_BIRTHDAY_MEDIA_IDS, JUNE_SHOW_MEDIA_IDS, LUCA_JACK_BIRTHDAY_MEDIA_IDS, LUCA_PICKUP_BASKETBALL_MEDIA_IDS } from "./facebookAlbums";
import { GELATO_ROMA_VENUE, MAIN_STREET_DINER_VENUE, RIVERSIDE_PARK_VENUE, WESTSIDE_LIBRARY_VENUE } from "./canonicalVenues";

export type ContentOrigin = "seed" | "live";

const JAY_BAND_LIKE_DISPLAY_NAMES = Object.freeze([
  "Mike", "Sarah", "Kevin", "Emily", "Nick", "Rachel", "Brian", "Jessica", "David", "Lauren", "Andrew", "Megan",
  "Jason", "Amanda", "Eric", "Nicole", "Daniel", "Ashley", "Josh", "Brittany", "Adam", "Stephanie", "Tyler", "Samantha",
  "Brandon", "Melissa", "Justin", "Rebecca", "Ryan", "Frank", "Jonathan", "Michelle", "Zach", "Allison", "Sean", "Christina",
  "Kyle", "Danielle", "Patrick", "Heather", "Trevor", "Lindsay", "Cody", "Chelsea", "Marcus", "Natalie", "Evan", "Jenna",
] as const);

const JAY_BAND_SEED_LIKES = Object.freeze(JAY_BAND_LIKE_DISPLAY_NAMES.map((displayName, index) => Object.freeze({
  id: `jay-band-performance-like-${String(index + 1).padStart(2, "0")}`,
  itemId: "jay-band-performance-photo" as const,
  displayName,
  ephemeralId: `jay-music-circle-${String(index + 1).padStart(2, "0")}`,
  classification: "EPHEMERAL_FACEBOOK_CONTACT" as const,
  origin: "seed" as const,
})));

function createJayHistoricalSeedLikes(itemId: string, idPrefix: string, count: number) {
  return Object.freeze(JAY_BAND_LIKE_DISPLAY_NAMES.slice(0, count).map((displayName, index) => Object.freeze({
    id: `${idPrefix}-${String(index + 1).padStart(2, "0")}`,
    itemId,
    displayName,
    ephemeralId: `${idPrefix}-contact-${String(index + 1).padStart(2, "0")}`,
    classification: "EPHEMERAL_FACEBOOK_CONTACT" as const,
    origin: "seed" as const,
  })));
}

const JAY_2009_MARCH_LIKES = createJayHistoricalSeedLikes("jay-music-bedroom-2009-03-14", "jay-2009-march-like", 8);
const JAY_2009_JUNE_LIKES = createJayHistoricalSeedLikes("jay-rehearsal-2009-06-27", "jay-2009-june-like", 14);
const JAY_2009_AUGUST_LIKES = createJayHistoricalSeedLikes("jay-cd-haul-2009-08-22", "jay-2009-august-like", 6);
const JAY_2009_NOVEMBER_LIKES = createJayHistoricalSeedLikes("jay-learning-by-ear-2009-11-07", "jay-2009-november-like", 11);

const JUNE_SHOW_LIKES_DISPLAY_NAMES = Object.freeze(JAY_BAND_LIKE_DISPLAY_NAMES.slice(0, 40));

const JUNE_SHOW_POST_LIKES = Object.freeze([
  Object.freeze({ id: "june-show-like-jack", itemId: "june-show-photos-oct19", displayName: CORE_SOCIAL_CHARACTERS.jack.displayName, characterId: CORE_SOCIAL_CHARACTERS.jack.id, classification: "CURATED" as const, origin: "seed" as const }),
  ...JUNE_SHOW_LIKES_DISPLAY_NAMES.map((displayName, index) => Object.freeze({
    id: `june-show-like-${String(index + 1).padStart(2, "0")}`,
    itemId: "june-show-photos-oct19" as const,
    displayName,
    ephemeralId: `june-show-contact-${String(index + 1).padStart(2, "0")}`,
    classification: "EPHEMERAL_FACEBOOK_CONTACT" as const,
    origin: "seed" as const,
  })),
]);

function createJuneStorySeedLikes(itemId: string, idPrefix: string, count: number) {
  return Object.freeze(JAY_BAND_LIKE_DISPLAY_NAMES.slice(0, count).map((displayName, index) => Object.freeze({ id: `${idPrefix}-${String(index + 1).padStart(2, "0")}`, itemId, displayName, ephemeralId: `${idPrefix}-contact-${String(index + 1).padStart(2, "0")}`, classification: "EPHEMERAL_FACEBOOK_CONTACT" as const, origin: "seed" as const })));
}

function juneCanonicalCommentAuthor(characterId: keyof typeof CORE_SOCIAL_CHARACTERS) {
  const character = CORE_SOCIAL_CHARACTERS[characterId];
  return Object.freeze({ type: "canonical" as const, characterId: character.id, displayName: character.displayName, classification: "CURATED" as const });
}

function juneEphemeralCommentAuthor(ephemeralId: keyof typeof FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS) {
  return Object.freeze({ type: "ephemeral" as const, ...FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[ephemeralId] });
}

type JuneSocialCommentAuthor = ReturnType<typeof juneCanonicalCommentAuthor> | ReturnType<typeof juneEphemeralCommentAuthor>;

type JuneSocialSeedComment = Readonly<{
  id: string;
  itemId: string;
  author: JuneSocialCommentAuthor;
  text: string;
  mentions: undefined;
  classification: "CURATED";
  origin: "seed";
}>;

function createJuneStoryComments(itemId: string, idPrefix: string, entries: readonly Readonly<{ author: JuneSocialCommentAuthor; text: string }>[]): readonly JuneSocialSeedComment[] {
  return Object.freeze(entries.map((entry, index) => Object.freeze({
    id: `${idPrefix}-${String(index + 1).padStart(2, "0")}`,
    itemId,
    author: entry.author,
    text: entry.text,
    mentions: undefined,
    classification: "CURATED" as const,
    origin: "seed" as const,
  })));
}

const JUNE_BIRTHDAY_LIKES = createJuneStorySeedLikes("june-18th-birthday-photos", "june-birthday-like", 38);
const JUNE_READING_LIKES = createJuneStorySeedLikes("june-home-photo", "june-reading-like", 16);
const JUNE_STARBUCKS_LIKES = createJuneStorySeedLikes("june-starbucks-photo", "june-starbucks-like", 21);
const JUNE_GIRLS_LIKES = createJuneStorySeedLikes("june-sophie-photo", "june-girls-like", 27);
const JUNE_GRADUATION_LIKES = createJuneStorySeedLikes("june-graduation-photo", "june-graduation-like", 32);

const JUNE_SOCIAL_HUB_COMMENTS = Object.freeze([
  ...createJuneStoryComments("june-18th-birthday-photos", "june-birthday-comment", [
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_SOPHIE_ID), text: "happy birthday beautiful!!" },
    { author: juneCanonicalCommentAuthor("katie"), text: "love you birthday girl ♥" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_EMILY_ID), text: "happy birthday!!" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_NICOLE_ID), text: "so pretty omg" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_MEGAN_ID), text: "best party ever" },
    { author: juneCanonicalCommentAuthor("chris"), text: "happy birthday june!" },
    { author: juneCanonicalCommentAuthor("alex"), text: "happy birthday!!" },
    { author: juneCanonicalCommentAuthor("jack"), text: "happy 18th :)" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_FRIEND_OF_FRIEND_ID), text: "hbd june" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_SARAH_ID), text: "love this picture" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_DEREK_ID), text: "happy birthday!" },
    { author: juneCanonicalCommentAuthor("june"), text: "thank you guys ♥" },
  ]),
  ...createJuneStoryComments("june-home-photo", "june-reading-comment", [
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_SOPHIE_ID), text: "you actually read?? lol" },
    { author: juneCanonicalCommentAuthor("katie"), text: "cute" },
    { author: juneCanonicalCommentAuthor("chris"), text: "what book is that" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_EMILY_ID), text: "lol" },
    { author: juneCanonicalCommentAuthor("alex"), text: "this is a rare sight" },
    { author: juneCanonicalCommentAuthor("june"), text: "shut up lol" },
  ]),
  ...createJuneStoryComments("june-starbucks-photo", "june-starbucks-comment", [
    { author: juneCanonicalCommentAuthor("katie"), text: "of course lol" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_SOPHIE_ID), text: "bring me one" },
    { author: juneCanonicalCommentAuthor("chris"), text: "again??" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_EMILY_ID), text: "cute pic" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_NICOLE_ID), text: "need this rn" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_MEGAN_ID), text: "same" },
    { author: juneCanonicalCommentAuthor("june"), text: "i was dyinggg" },
  ]),
  ...createJuneStoryComments("june-sophie-photo", "june-girls-comment", [
    { author: juneCanonicalCommentAuthor("katie"), text: "pretty girls ♥" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_EMILY_ID), text: "love this" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_NICOLE_ID), text: "you two!!" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_MEGAN_ID), text: "so cute" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_SARAH_ID), text: "miss you guys" },
    { author: juneCanonicalCommentAuthor("chris"), text: "looks like trouble" },
    { author: juneCanonicalCommentAuthor("alex"), text: "nice photo" },
    { author: juneCanonicalCommentAuthor("june"), text: "love herrr" },
  ]),
  ...createJuneStoryComments("june-graduation-photo", "june-graduation-comment", [
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_SOPHIE_ID), text: "so proud of you ♥" },
    { author: juneCanonicalCommentAuthor("katie"), text: "congrats june!!" },
    { author: juneCanonicalCommentAuthor("alex"), text: "congratulations!" },
    { author: juneCanonicalCommentAuthor("chris"), text: "you made it lol" },
    { author: juneCanonicalCommentAuthor("jay"), text: "congrats june" },
    { author: juneCanonicalCommentAuthor("jack"), text: "congrats :)" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_EMILY_ID), text: "your family is so cute" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_NICOLE_ID), text: "congratulations!!" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_MEGAN_ID), text: "so happy for you" },
    { author: juneCanonicalCommentAuthor("june"), text: "thank youuu" },
  ]),
]);

const createJackSeedLikes = (itemId: string, idPrefix: string, count: number) => Object.freeze(Array.from({ length: count }, (_, index) => Object.freeze({ id: `${idPrefix}-${String(index + 1).padStart(2, "0")}`, itemId, displayName: `Friend ${index + 1}`, classification: "CURATED" as const, origin: "seed" as const })));
const JACK_GAME_LIKES = createJackSeedLikes("jack-football-game-photo", "jack-game-like", 28);
const JACK_SUMMER_LIKES = createJackSeedLikes("jack-summer-photos", "jack-summer-like", 34);
const JACK_CAR_LIKES = createJackSeedLikes("jack-car-matt-2009-photos", "jack-car-like", 9);
const JACK_PRACTICE_LIKES = createJackSeedLikes("jack-practice-brutal", "jack-practice-like", 8);
const JACK_BIRTHDAY_JUNE_LIKES = createJackSeedLikes("jack-birthday-june-post", "jack-birthday-june-like", 34);
const JACK_BIRTHDAY_SOPHIE_LIKES = createJackSeedLikes("jack-birthday-sophie-post", "jack-birthday-sophie-like", 19);
const JACK_BIRTHDAY_LUCA_LIKES = createJackSeedLikes("luca-jack-birthday-photos", "jack-birthday-luca-like", 28);
const JACK_BIRTHDAY_MATT_LIKES = createJackSeedLikes("matt-jack-birthday-photo", "jack-birthday-matt-like", 22);
const JACK_BIRTHDAY_THANKS_LIKES = createJackSeedLikes("jack-birthday-thanks-photos", "jack-birthday-thanks-like", 57);
const JACK_BIRTHDAY_COMMENTS = Object.freeze([
  ...createJuneStoryComments("jack-birthday-june-post", "jack-birthday-june-comment", [
    { author: juneCanonicalCommentAuthor("jack"), text: "haha thx" },
    { author: juneCanonicalCommentAuthor("katie"), text: "happy birthday!!" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_SOPHIE_ID), text: "happy bday jack!" },
    { author: juneCanonicalCommentAuthor("chris"), text: "hbd man" },
    { author: juneCanonicalCommentAuthor("alex"), text: "happy birthday" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_EMILY_ID), text: "happy 18th!!" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_MIKE_ID), text: "big 18 lol" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_SARAH_ID), text: "hbd!!" },
    { author: juneCanonicalCommentAuthor("june"), text: "have a good one :)" },
  ]),
  ...createJuneStoryComments("jack-birthday-sophie-post", "jack-birthday-sophie-comment", [
    { author: juneCanonicalCommentAuthor("jack"), text: "haha thx" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_EMILY_ID), text: "happy birthday!" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_FRIEND_OF_FRIEND_ID), text: "hbd jack" },
    { author: juneCanonicalCommentAuthor("chris"), text: "happy birthday bro" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_SOPHIE_ID), text: "lol have fun" },
  ]),
  ...createJuneStoryComments("luca-jack-birthday-photos", "jack-birthday-luca-comment", [
    { author: juneCanonicalCommentAuthor("chris"), text: "happy birthday bro" },
    { author: juneCanonicalCommentAuthor("jack"), text: "thanks bro" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_MIKE_ID), text: "happy birthday" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_FRANK_ID), text: "big 18 lol" },
    { author: juneCanonicalCommentAuthor("luca"), text: "good night man" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_KEVIN_ID), text: "hbd!" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_RACHEL_ID), text: "happy bday" },
  ]),
  ...createJuneStoryComments("matt-jack-birthday-photo", "jack-birthday-matt-comment", [
    { author: juneCanonicalCommentAuthor("jack"), text: "heyyy what does that mean" },
    { author: juneCanonicalCommentAuthor("jack"), text: "thanks man" },
    { author: juneCanonicalCommentAuthor("chris"), text: "lol" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_MIKE_ID), text: "happy birthday man" },
    { author: juneCanonicalCommentAuthor("matt"), text: "haha" },
  ]),
  ...createJuneStoryComments("jack-birthday-thanks-photos", "jack-birthday-thanks-comment", [
    { author: juneCanonicalCommentAuthor("chris"), text: "happy birthday bro" },
    { author: juneCanonicalCommentAuthor("jack"), text: "thanks man" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_MIKE_ID), text: "finally 18 lol" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_KEVIN_ID), text: "last night was insane" },
    { author: juneCanonicalCommentAuthor("june"), text: "♥" },
    { author: juneCanonicalCommentAuthor("jack"), text: "haha" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_SOPHIE_ID), text: "superstar survived" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_FRIEND_OF_FRIEND_ID), text: "happy bdayyy" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_DEREK_ID), text: "practice is gonna suck tomorrow" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_EMILY_ID), text: "happy birthday jack :)" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_FRANK_ID), text: "great night man" },
    { author: juneCanonicalCommentAuthor("luca"), text: "hbd bro" },
    { author: juneCanonicalCommentAuthor("matt"), text: "happy birthday" },
    { author: juneCanonicalCommentAuthor("katie"), text: "happy birthday!!" },
    { author: juneCanonicalCommentAuthor("jack"), text: "thx everyone" },
  ]),
]);
const JACK_PROFILE_COMMENTS = Object.freeze([
  ...createJuneStoryComments("jack-football-game-photo", "jack-game-comment", [
    { author: juneCanonicalCommentAuthor("chris"), text: "good game man" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_MIKE_ID), text: "nice win" },
    { author: juneCanonicalCommentAuthor("jack"), text: "thanks" },
    { author: juneCanonicalCommentAuthor("katie"), text: "congrats" },
    { author: juneCanonicalCommentAuthor("alex"), text: "good game" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_FRIEND_OF_FRIEND_ID), text: "you killed it" },
  ]),
  ...createJuneStoryComments("jack-summer-photos", "jack-summer-comment", [
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_SOPHIE_ID), text: "love these" },
    { author: juneCanonicalCommentAuthor("june"), text: "lol this was fun" },
    { author: juneCanonicalCommentAuthor("katie"), text: "beach again??" },
    { author: juneCanonicalCommentAuthor("chris"), text: "party friday??" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_FRIEND_OF_FRIEND_ID), text: "good summer" },
    { author: juneEphemeralCommentAuthor(FACEBOOK_EPHEMERAL_EMILY_ID), text: "cute" },
    { author: juneCanonicalCommentAuthor("jack"), text: "friday" },
  ]),
  Object.freeze({ id: "jack-car-matt-2009-comment-matt-1", itemId: "jack-car-matt-2009-photos", author: juneCanonicalCommentAuthor("matt"), text: "why? you have one", mentions: undefined, classification: "CURATED" as const, origin: "seed" as const }),
  Object.freeze({ id: "jack-car-matt-2009-comment-jack-1", itemId: "jack-car-matt-2009-photos", author: juneCanonicalCommentAuthor("jack"), text: "i'm not your chauffeur", mentions: undefined, classification: "CURATED" as const, origin: "seed" as const }),
  Object.freeze({ id: "jack-car-matt-2009-comment-matt-2", itemId: "jack-car-matt-2009-photos", author: juneCanonicalCommentAuthor("matt"), text: "you kinda are", mentions: undefined, classification: "CURATED" as const, origin: "seed" as const }),
  Object.freeze({ id: "jack-car-comment-02", itemId: "jack-car-matt-2009-photos", author: juneCanonicalCommentAuthor("chris"), text: "finally", mentions: undefined, classification: "CURATED" as const, origin: "seed" as const }),
  Object.freeze({ id: "jack-car-matt-2009-comment-jack-2", itemId: "jack-car-matt-2009-photos", author: juneCanonicalCommentAuthor("jack"), text: "yeah bro", mentions: undefined, classification: "CURATED" as const, origin: "seed" as const }),
  ...createJuneStoryComments("jack-practice-brutal", "jack-practice-comment", [
    { author: juneCanonicalCommentAuthor("chris"), text: "same" },
    { author: juneCanonicalCommentAuthor("luca"), text: "brutal" },
  ]),
  ...createJuneStoryComments("jack-matt-2008-photo", "jack-matt-2008-comment", [{ author: juneCanonicalCommentAuthor("matt"), text: "that's why you keep showing up" }]),
  ...createJuneStoryComments("jack-matt-2010-photo", "jack-matt-2010-comment", [{ author: juneCanonicalCommentAuthor("matt"), text: "cazzo, delete it" }, { author: juneCanonicalCommentAuthor("jack"), text: "拒絕" }, { author: juneCanonicalCommentAuthor("matt"), text: "Du bist unmöglich." }]),
]);

export const SESSION_SEED_CONTENT = Object.freeze({
  messages: Object.freeze([
    Object.freeze({
      id: "dad-dinner-tonight",
      conversationId: "dad",
      sender: "Dad",
      text: "Are you coming over for dinner tonight?",
      direction: "incoming" as const,
      timestamp: "5:48 PM",
      status: "unread" as const,
      origin: "seed" as const,
    }),
  ]),
  facebook: Object.freeze({
    feed: Object.freeze([
      Object.freeze({ id: "ben-long-day", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "Long day.", timestamp: "11:58 PM", createdAt: "2010-10-19T23:58:00-07:00", kind: "status" as const, visibility: "friends" as const, origin: "seed" as const }),
      Object.freeze({ id: "mike-anil-question", actor: Object.freeze({ kind: "ephemeral-friend-of-friend" as const, ephemeralId: FACEBOOK_EPHEMERAL_MIKE_ID }), author: "Mike", text: "is Anil playing friday too?", timestamp: "11:54 PM", createdAt: "2010-10-19T23:54:00-07:00", kind: "status" as const, visibility: "friends-of-friends" as const, origin: "seed" as const }),
      Object.freeze({ id: "june-show-photos-oct19", friendId: CORE_SOCIAL_CHARACTERS.june.id, author: CORE_SOCIAL_CHARACTERS.june.displayName, text: `added ${JUNE_SHOW_MEDIA_IDS.length} new photos. proud of you guys ♥ that show was actually so good @Jay @Matt @Anil`, mentions: Object.freeze([{ token: "@Jay", actor: Object.freeze({ kind: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.jay.id, displayName: CORE_SOCIAL_CHARACTERS.jay.displayName }) }, { token: "@Matt", actor: Object.freeze({ kind: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.matt.id, displayName: CORE_SOCIAL_CHARACTERS.matt.displayName }) }]), timestamp: "11:51 PM", createdAt: "2010-10-19T23:51:00-07:00", kind: "album" as const, visibility: "friends" as const, mediaIds: JUNE_SHOW_MEDIA_IDS, albumTitle: "10/18", photoCount: JUNE_SHOW_MEDIA_IDS.length, origin: "seed" as const }),
      Object.freeze({ id: "june-starbucks-photo", friendId: CORE_SOCIAL_CHARACTERS.june.id, author: CORE_SOCIAL_CHARACTERS.june.displayName, text: "starbucks saved my life today", timestamp: "Mon 2:10 PM", createdAt: "2010-10-18T14:10:00-07:00", kind: "photo" as const, visibility: "custom" as const, customAudienceIncludesUser: false, mediaId: "june-starbucks-mobile" as const, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "june-profile-picture-update", friendId: CORE_SOCIAL_CHARACTERS.june.id, author: CORE_SOCIAL_CHARACTERS.june.displayName, text: "updated her profile picture.", timestamp: "October 10", createdAt: "2010-10-10T16:00:00-07:00", kind: "photo" as const, visibility: "custom" as const, customAudienceIncludesUser: false, mediaId: "june-facebook-profile-picture" as const, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "sophie-june-club-photo-story", actor: Object.freeze({ kind: "ephemeral-friend-of-friend" as const, ephemeralId: FACEBOOK_EPHEMERAL_SOPHIE_ID }), author: FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[FACEBOOK_EPHEMERAL_SOPHIE_ID].displayName, text: "bestie ♥ @June", mentions: Object.freeze([{ token: "@June", actor: Object.freeze({ kind: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.june.id, displayName: CORE_SOCIAL_CHARACTERS.june.displayName }) }]), timestamp: "October 16", createdAt: "2010-10-16T02:57:00-07:00", kind: "photo" as const, visibility: "custom" as const, customAudienceIncludesUser: false, mediaId: "sophie-june-club-photo" as const, taggedCharacterIds: Object.freeze([CORE_SOCIAL_CHARACTERS.june.id]), profileWallEligible: true, tagUiStatus: "HOLD" as const, origin: "seed" as const }),
      Object.freeze({ id: "jack-football-game-photo", actor: Object.freeze({ kind: "ephemeral-friend-of-friend" as const, ephemeralId: FACEBOOK_EPHEMERAL_MIKE_ID }), author: FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[FACEBOOK_EPHEMERAL_MIKE_ID].displayName, text: "good win", timestamp: "October 15", createdAt: "2010-10-15T22:45:00-07:00", kind: "photo" as const, visibility: "friends-of-friends" as const, mediaId: "jack-football-game" as const, albumTitle: "Photos", taggedCharacterIds: Object.freeze([CORE_SOCIAL_CHARACTERS.jack.id]), profileWallEligible: true, tagUiStatus: "HOLD" as const, origin: "seed" as const }),
      Object.freeze({ id: "sophie-jack-tagged-02", actor: Object.freeze({ kind: "ephemeral-friend-of-friend" as const, ephemeralId: FACEBOOK_EPHEMERAL_SOPHIE_ID }), author: FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[FACEBOOK_EPHEMERAL_SOPHIE_ID].displayName, text: "he cleans up okay ;)", timestamp: "August 24", createdAt: "2010-08-24T20:00:00-07:00", kind: "photo" as const, visibility: "friends-of-friends" as const, mediaId: "jack-tagged-sophie-02" as const, albumTitle: "Photos", taggedCharacterIds: Object.freeze([CORE_SOCIAL_CHARACTERS.jack.id]), profileWallEligible: true, tagUiStatus: "HOLD" as const, origin: "seed" as const }),
      Object.freeze({ id: "sophie-jack-tagged-03", actor: Object.freeze({ kind: "ephemeral-friend-of-friend" as const, ephemeralId: FACEBOOK_EPHEMERAL_SOPHIE_ID }), author: FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[FACEBOOK_EPHEMERAL_SOPHIE_ID].displayName, text: "don't let this go to your head @Jack", mentions: Object.freeze([{ token: "@Jack", actor: Object.freeze({ kind: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.jack.id, displayName: CORE_SOCIAL_CHARACTERS.jack.displayName }) }]), timestamp: "August 24", createdAt: "2010-08-24T20:00:00-07:00", kind: "photo" as const, visibility: "friends-of-friends" as const, mediaId: "jack-tagged-sophie-03" as const, albumTitle: "Photos", taggedCharacterIds: Object.freeze([CORE_SOCIAL_CHARACTERS.jack.id]), profileWallEligible: true, tagUiStatus: "HOLD" as const, origin: "seed" as const }),
      Object.freeze({ id: "ryan-jack-night-photo", actor: Object.freeze({ kind: "ephemeral-friend-of-friend" as const, ephemeralId: FACEBOOK_EPHEMERAL_FRIEND_OF_FRIEND_ID }), author: FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[FACEBOOK_EPHEMERAL_FRIEND_OF_FRIEND_ID].displayName, text: "good night with these idiots", timestamp: "September 27", createdAt: "2010-09-27T21:00:00-07:00", kind: "photo" as const, visibility: "friends-of-friends" as const, mediaId: "jack-tagged-ryan" as const, albumTitle: "Photos", taggedCharacterIds: Object.freeze([CORE_SOCIAL_CHARACTERS.jack.id]), profileWallEligible: true, tagUiStatus: "HOLD" as const, origin: "seed" as const }),
      Object.freeze({ id: "june-jack-tagged-night-photo", friendId: CORE_SOCIAL_CHARACTERS.june.id, author: CORE_SOCIAL_CHARACTERS.june.displayName, text: "last night was actually so much fun :) @Jack", mentions: Object.freeze([{ token: "@Jack", actor: Object.freeze({ kind: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.jack.id, displayName: CORE_SOCIAL_CHARACTERS.jack.displayName }) }]), timestamp: "September 27", createdAt: "2010-09-27T21:00:00-07:00", kind: "photo" as const, visibility: "friends-of-friends" as const, mediaId: "jack-tagged-june" as const, albumTitle: "Photos", taggedCharacterIds: Object.freeze([CORE_SOCIAL_CHARACTERS.jack.id]), profileWallEligible: true, tagUiStatus: "HOLD" as const, origin: "seed" as const }),
      Object.freeze({ id: "june-home-photo", friendId: CORE_SOCIAL_CHARACTERS.june.id, author: CORE_SOCIAL_CHARACTERS.june.displayName, text: "so tired lol", timestamp: "September 26", createdAt: "2010-09-26T19:30:00-07:00", kind: "photo" as const, visibility: "custom" as const, customAudienceIncludesUser: false, mediaId: "june-home-mobile" as const, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "june-sophie-photo", friendId: CORE_SOCIAL_CHARACTERS.june.id, author: CORE_SOCIAL_CHARACTERS.june.displayName, text: "girls night ♥", timestamp: "August 14", createdAt: "2010-08-14T22:30:00-07:00", kind: "photo" as const, visibility: "custom" as const, customAudienceIncludesUser: false, mediaId: "june-sophie-girls" as const, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "june-graduation-photo", friendId: CORE_SOCIAL_CHARACTERS.june.id, author: CORE_SOCIAL_CHARACTERS.june.displayName, text: "finally done!!", timestamp: "June 12", createdAt: "2010-06-12T17:00:00-07:00", kind: "photo" as const, visibility: "custom" as const, customAudienceIncludesUser: false, mediaId: "june-family-graduation" as const, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "june-18th-birthday-photos", friendId: CORE_SOCIAL_CHARACTERS.june.id, author: CORE_SOCIAL_CHARACTERS.june.displayName, text: `added ${JUNE_BIRTHDAY_MEDIA_IDS.length} new photos. best night ever ♥`, timestamp: "June 6", createdAt: "2010-06-06T21:08:00-07:00", kind: "album" as const, visibility: "custom" as const, customAudienceIncludesUser: false, mediaIds: JUNE_BIRTHDAY_MEDIA_IDS, albumTitle: "18th Birthday", photoCount: JUNE_BIRTHDAY_MEDIA_IDS.length, profileWallEligible: true, origin: "seed" as const }),
Object.freeze({ id: "jack-movie", friendId: CORE_SOCIAL_CHARACTERS.jack.id, author: CORE_SOCIAL_CHARACTERS.jack.displayName, text: "That movie was better than I expected.", timestamp: "11:52 PM", createdAt: "2010-10-19T23:52:00-07:00", kind: "status" as const, visibility: "friends" as const, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "jack-matt-2010-photo", friendId: CORE_SOCIAL_CHARACTERS.jack.id, author: CORE_SOCIAL_CHARACTERS.jack.displayName, text: "@Matt Ciao, bello", mentions: Object.freeze([{ token: "@Matt", actor: Object.freeze({ kind: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.matt.id, displayName: CORE_SOCIAL_CHARACTERS.matt.displayName }) }]), timestamp: "Mon 10:34 PM", createdAt: "2010-10-18T22:34:00-07:00", kind: "photo" as const, visibility: "custom" as const, customAudienceIncludesUser: false, mediaId: "jack-matt-01" as const, taggedCharacterIds: Object.freeze([CORE_SOCIAL_CHARACTERS.matt.id]), profileWallEligible: true, origin: "seed" as const }),
Object.freeze({ id: "jack-practice-brutal", friendId: CORE_SOCIAL_CHARACTERS.jack.id, author: CORE_SOCIAL_CHARACTERS.jack.displayName, text: "practice was brutal", timestamp: "Mon 7:10 PM", createdAt: "2010-10-18T19:10:00-07:00", kind: "status" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, origin: "seed" as const }),
Object.freeze({ id: "jack-car-photo", friendId: CORE_SOCIAL_CHARACTERS.jack.id, author: CORE_SOCIAL_CHARACTERS.jack.displayName, text: "finally home", timestamp: "Sep 12", createdAt: "2010-09-12T16:20:00-07:00", kind: "photo" as const, visibility: "custom" as const, customAudienceIncludesUser: false, mediaId: "jack-car" as const, profileWallEligible: true, origin: "seed" as const }),
Object.freeze({ id: "jack-profile-picture-update", friendId: CORE_SOCIAL_CHARACTERS.jack.id, author: CORE_SOCIAL_CHARACTERS.jack.displayName, text: "updated his profile picture.", timestamp: "Sep 5", createdAt: "2010-09-05T18:00:00-07:00", kind: "photo" as const, visibility: "custom" as const, customAudienceIncludesUser: false, mediaId: "jack-profile-picture" as const, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "jack-summer-party-photo", friendId: CORE_SOCIAL_CHARACTERS.jack.id, author: CORE_SOCIAL_CHARACTERS.jack.displayName, text: "summer", timestamp: "August 22", createdAt: "2010-08-22T17:30:00-07:00", kind: "photo" as const, visibility: "friends-of-friends" as const, mediaId: "jack-summer-party" as const, albumTitle: "Summer", profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "jack-summer-photos", actor: Object.freeze({ kind: "ephemeral-friend-of-friend" as const, ephemeralId: FACEBOOK_EPHEMERAL_SARAH_ID }), author: FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[FACEBOOK_EPHEMERAL_SARAH_ID].displayName, text: "added 2 new photos.", timestamp: "August 22", createdAt: "2010-08-22T17:30:00-07:00", kind: "album" as const, visibility: "friends-of-friends" as const, mediaIds: Object.freeze(["jack-beach-10", "jack-beach-8"] as const), albumTitle: "Photos", photoCount: 2, taggedCharacterIds: Object.freeze([CORE_SOCIAL_CHARACTERS.jack.id]), profileWallEligible: true, tagUiStatus: "HOLD" as const, origin: "seed" as const }),
      Object.freeze({ id: "jack-birthday-thanks-photos", friendId: CORE_SOCIAL_CHARACTERS.jack.id, author: CORE_SOCIAL_CHARACTERS.jack.displayName, text: "Thx, guys!", timestamp: "August 3", createdAt: "2010-08-03T13:08:00-07:00", kind: "album" as const, visibility: "friends-of-friends" as const, mediaId: JACK_18TH_BIRTHDAY_MEDIA_IDS[0], mediaIds: JACK_18TH_BIRTHDAY_MEDIA_IDS, albumTitle: "18th Birthday", photoCount: JACK_18TH_BIRTHDAY_MEDIA_IDS.length, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "luca-jack-birthday-photos", friendId: CORE_SOCIAL_CHARACTERS.luca.id, author: CORE_SOCIAL_CHARACTERS.luca.displayName, text: "@Jack happy birthday bro", mentions: Object.freeze([{ token: "@Jack", actor: Object.freeze({ kind: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.jack.id, displayName: CORE_SOCIAL_CHARACTERS.jack.displayName }) }]), timestamp: "August 2", createdAt: "2010-08-02T23:17:00-07:00", kind: "album" as const, visibility: "friends" as const, mediaId: LUCA_JACK_BIRTHDAY_MEDIA_IDS[0], mediaIds: LUCA_JACK_BIRTHDAY_MEDIA_IDS, albumTitle: "Photos", photoCount: LUCA_JACK_BIRTHDAY_MEDIA_IDS.length, taggedCharacterIds: Object.freeze([CORE_SOCIAL_CHARACTERS.jack.id]), profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "jack-birthday-sophie-post", actor: Object.freeze({ kind: "ephemeral-friend-of-friend" as const, ephemeralId: FACEBOOK_EPHEMERAL_SOPHIE_ID }), author: FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[FACEBOOK_EPHEMERAL_SOPHIE_ID].displayName, text: "@Jack happy birthday, superstar", mentions: Object.freeze([{ token: "@Jack", actor: Object.freeze({ kind: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.jack.id, displayName: CORE_SOCIAL_CHARACTERS.jack.displayName }) }]), timestamp: "August 2", createdAt: "2010-08-02T12:38:00-07:00", kind: "status" as const, visibility: "friends-of-friends" as const, taggedCharacterIds: Object.freeze([CORE_SOCIAL_CHARACTERS.jack.id]), profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "jack-birthday-june-post", friendId: CORE_SOCIAL_CHARACTERS.june.id, author: CORE_SOCIAL_CHARACTERS.june.displayName, text: "@Jack happy 18th!! ♥", mentions: Object.freeze([{ token: "@Jack", actor: Object.freeze({ kind: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.jack.id, displayName: CORE_SOCIAL_CHARACTERS.jack.displayName }) }]), timestamp: "August 2", createdAt: "2010-08-02T10:24:00-07:00", kind: "status" as const, visibility: "friends" as const, taggedCharacterIds: Object.freeze([CORE_SOCIAL_CHARACTERS.jack.id]), profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "jack-car-matt-2009-photos", friendId: CORE_SOCIAL_CHARACTERS.jack.id, author: CORE_SOCIAL_CHARACTERS.jack.displayName, text: "@Matt get off the computer and get your license already lol", mentions: Object.freeze([{ token: "@Matt", actor: Object.freeze({ kind: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.matt.id, displayName: CORE_SOCIAL_CHARACTERS.matt.displayName }) }]), timestamp: "Nov 14", createdAt: "2009-11-14T21:10:00-08:00", kind: "album" as const, visibility: "custom" as const, customAudienceIncludesUser: false, mediaIds: Object.freeze(["jack-car", "jack-matt-02"] as const), albumTitle: "Photos", photoCount: 2, taggedCharacterIds: Object.freeze([CORE_SOCIAL_CHARACTERS.matt.id]), profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "jack-owned-j-2009-photo", friendId: CORE_SOCIAL_CHARACTERS.jack.id, author: CORE_SOCIAL_CHARACTERS.jack.displayName, text: "good day.", timestamp: "April 15", createdAt: "2009-04-15T16:00:00-07:00", kind: "photo" as const, visibility: "friends-of-friends" as const, mediaId: "jack-owned-j-2009" as const, albumTitle: "Photos", profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "jack-matt-2008-photo", friendId: CORE_SOCIAL_CHARACTERS.jack.id, author: CORE_SOCIAL_CHARACTERS.jack.displayName, text: "@Matt your dad still makes the best lasagna btw lol", mentions: Object.freeze([{ token: "@Matt", actor: Object.freeze({ kind: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.matt.id, displayName: CORE_SOCIAL_CHARACTERS.matt.displayName }) }]), timestamp: "Sep 20", createdAt: "2008-09-20T19:32:00-07:00", kind: "photo" as const, visibility: "custom" as const, customAudienceIncludesUser: false, mediaId: "jack-matt-03" as const, taggedCharacterIds: Object.freeze([CORE_SOCIAL_CHARACTERS.matt.id]), profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "jack-matt-family-2007-photo", friendId: CORE_SOCIAL_CHARACTERS.jack.id, author: CORE_SOCIAL_CHARACTERS.jack.displayName, text: "@Matt", mentions: Object.freeze([{ token: "@Matt", actor: Object.freeze({ kind: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.matt.id, displayName: CORE_SOCIAL_CHARACTERS.matt.displayName }) }]), timestamp: "Jun 16", createdAt: "2007-06-16T18:40:00-07:00", kind: "photo" as const, visibility: "custom" as const, customAudienceIncludesUser: false, mediaId: "jack-matt-family" as const, taggedCharacterIds: Object.freeze([CORE_SOCIAL_CHARACTERS.matt.id]), profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "alex-jacks-party-friday", friendId: CORE_SOCIAL_CHARACTERS.alex.id, author: CORE_SOCIAL_CHARACTERS.alex.displayName, text: "anyone going to jack's party friday?", timestamp: "11:47 PM", createdAt: "2010-10-19T23:47:00-07:00", kind: "status" as const, visibility: "friends-of-friends" as const, origin: "seed" as const }),
      Object.freeze({ id: "katie-coffee", friendId: CORE_SOCIAL_FRIENDS.katie.id, author: CORE_SOCIAL_FRIENDS.katie.displayName, text: "likes a coffee shop downtown.", timestamp: "11:41 PM", createdAt: "2010-10-19T23:41:00-07:00", kind: "activity" as const, visibility: "friends" as const, origin: "seed" as const }),
      Object.freeze({ id: "jay-reading", friendId: CORE_SOCIAL_FRIENDS.jay.id, author: CORE_SOCIAL_FRIENDS.jay.displayName, text: "One more chapter before bed.", timestamp: "11:33 PM", createdAt: "2010-10-19T23:33:00-07:00", kind: "status" as const, visibility: "friends" as const, origin: "seed" as const }),
      Object.freeze({ id: "luca-pickup-basketball-photos", friendId: CORE_SOCIAL_CHARACTERS.luca.id, author: CORE_SOCIAL_CHARACTERS.luca.displayName, text: `added ${LUCA_PICKUP_BASKETBALL_MEDIA_IDS.length} new photos from pickup basketball.`, timestamp: "10:58 PM", createdAt: "2010-10-19T22:58:00-07:00", kind: "album" as const, visibility: "friends" as const, mediaId: LUCA_PICKUP_BASKETBALL_MEDIA_IDS[0], mediaIds: LUCA_PICKUP_BASKETBALL_MEDIA_IDS, albumTitle: "Pickup Basketball", photoCount: LUCA_PICKUP_BASKETBALL_MEDIA_IDS.length, relatedCharacterIds: Object.freeze([CORE_SOCIAL_CHARACTERS.chris.id]), tagUiStatus: "HOLD" as const, origin: "seed" as const }),
      Object.freeze({ id: "luca-profile-picture-current", friendId: CORE_SOCIAL_CHARACTERS.luca.id, author: CORE_SOCIAL_CHARACTERS.luca.displayName, text: "updated his profile picture.", timestamp: "12:00 AM", createdAt: "2010-10-20T00:00:00-07:00", kind: "photo" as const, visibility: "custom" as const, customAudienceIncludesUser: false, mediaId: "luca-profile-picture" as const, albumTitle: "Profile Pictures", profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "luca-main-street-diner-checkin", friendId: CORE_SOCIAL_CHARACTERS.luca.id, author: CORE_SOCIAL_CHARACTERS.luca.displayName, text: `is at ${MAIN_STREET_DINER_VENUE.name}.`, timestamp: "10:44 PM", createdAt: "2010-10-19T22:44:00-07:00", kind: "checkin" as const, visibility: "friends" as const, venueId: MAIN_STREET_DINER_VENUE.id, origin: "seed" as const }),
      Object.freeze({ id: "jay-band-performance-photo", friendId: CORE_SOCIAL_CHARACTERS.jay.id, author: CORE_SOCIAL_CHARACTERS.jay.displayName, text: "last night was awesome. thx @Matt @Z.tokyo @Anil", mentions: Object.freeze([{ token: "@Matt", actor: Object.freeze({ kind: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.matt.id, displayName: CORE_SOCIAL_CHARACTERS.matt.displayName }) }, { token: "@Z.tokyo", actor: Object.freeze({ kind: "author-easter-egg" as const, authorId: FACEBOOK_AUTHOR_EASTER_EGG_ID, displayName: FACEBOOK_AUTHOR_EASTER_EGGS[FACEBOOK_AUTHOR_EASTER_EGG_ID].displayName }) }]), timestamp: "10:00 PM", createdAt: "2010-10-19T22:00:00-07:00", kind: "photo" as const, visibility: "friends" as const, mediaId: "jay-band-performance" as const, relatedCharacterIds: Object.freeze([CORE_SOCIAL_CHARACTERS.matt.id]), offlineSubjectIds: Object.freeze(["anil"] as const), tagUiStatus: "HOLD" as const, origin: "seed" as const }),
      Object.freeze({ id: "alex-riverside-park-checkin", friendId: CORE_SOCIAL_CHARACTERS.alex.id, author: CORE_SOCIAL_CHARACTERS.alex.displayName, text: `is at ${RIVERSIDE_PARK_VENUE.name}.`, timestamp: "9:36 PM", createdAt: "2010-10-19T21:36:00-07:00", kind: "checkin" as const, visibility: "friends" as const, venueId: RIVERSIDE_PARK_VENUE.id, origin: "seed" as const }),
      Object.freeze({ id: "katie-westside-library-checkin", friendId: CORE_SOCIAL_CHARACTERS.katie.id, author: CORE_SOCIAL_CHARACTERS.katie.displayName, text: `is at ${WESTSIDE_LIBRARY_VENUE.name}.`, timestamp: "8:14 PM", createdAt: "2010-10-19T20:14:00-07:00", kind: "checkin" as const, visibility: "friends" as const, venueId: WESTSIDE_LIBRARY_VENUE.id, origin: "seed" as const }),
      Object.freeze({ id: "matt-gelato-roma-checkin", friendId: CORE_SOCIAL_CHARACTERS.matt.id, author: CORE_SOCIAL_CHARACTERS.matt.displayName, text: `is at ${GELATO_ROMA_VENUE.name}.`, timestamp: "7:22 PM", createdAt: "2010-10-19T19:22:00-07:00", kind: "checkin" as const, visibility: "friends" as const, venueId: GELATO_ROMA_VENUE.id, origin: "seed" as const }),
      Object.freeze({ id: "jay-guitar-photo", friendId: CORE_SOCIAL_CHARACTERS.jay.id, author: CORE_SOCIAL_CHARACTERS.jay.displayName, text: "added a new photo.", timestamp: "9:12 PM", createdAt: "2010-10-17T21:12:00-07:00", kind: "photo" as const, visibility: "friends" as const, mediaId: "jay-guitar" as const, tagUiStatus: "HOLD" as const, origin: "seed" as const }),
      Object.freeze({ id: "z-tokyo-profile-picture-update", actor: Object.freeze({ kind: "author-easter-egg" as const, authorId: FACEBOOK_AUTHOR_EASTER_EGG_ID }), author: FACEBOOK_AUTHOR_EASTER_EGGS[FACEBOOK_AUTHOR_EASTER_EGG_ID].displayName, text: "updated her profile picture.", timestamp: "8:52 PM", kind: "photo" as const, visibility: "everyone" as const, createdAt: "2010-10-18T20:52:00-07:00", mediaId: FACEBOOK_AUTHOR_EASTER_EGGS[FACEBOOK_AUTHOR_EASTER_EGG_ID].profileMediaId, origin: "seed" as const }),
      Object.freeze({ id: "jay-may-guitar-photo", friendId: CORE_SOCIAL_CHARACTERS.jay.id, author: CORE_SOCIAL_CHARACTERS.jay.displayName, text: "hey baby", timestamp: "May 15", createdAt: "2010-05-15T18:00:00-07:00", kind: "photo" as const, visibility: "friends" as const, mediaId: "jay-guitar-may" as const, tagUiStatus: "HOLD" as const, origin: "seed" as const }),
      Object.freeze({ id: "jay-learning-by-ear-2009-11-07", friendId: CORE_SOCIAL_CHARACTERS.jay.id, author: CORE_SOCIAL_CHARACTERS.jay.displayName, text: "trying to figure this one out", timestamp: "Nov 7", createdAt: "2009-11-07T23:08:00-08:00", kind: "photo" as const, visibility: "friends" as const, mediaId: "jay-learning-by-ear-2009-11-07" as const, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "jay-cd-haul-2009-08-22", friendId: CORE_SOCIAL_CHARACTERS.jay.id, author: CORE_SOCIAL_CHARACTERS.jay.displayName, text: "good day", timestamp: "Aug 22", createdAt: "2009-08-22T15:22:00-07:00", kind: "photo" as const, visibility: "friends" as const, mediaId: "jay-cd-haul-2009-08-22" as const, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "jay-rehearsal-2009-06-27", friendId: CORE_SOCIAL_CHARACTERS.jay.id, author: CORE_SOCIAL_CHARACTERS.jay.displayName, text: "not terrible today", timestamp: "Jun 27", createdAt: "2009-06-27T20:46:00-07:00", kind: "album" as const, visibility: "friends" as const, mediaId: "jay-rehearsal-2009-06-27-01" as const, mediaIds: Object.freeze(["jay-rehearsal-2009-06-27-01", "jay-rehearsal-2009-06-27-02"] as const), albumTitle: "Music", photoCount: 2, relatedCharacterIds: Object.freeze([CORE_SOCIAL_CHARACTERS.matt.id]), profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "jay-music-bedroom-2009-03-14", friendId: CORE_SOCIAL_CHARACTERS.jay.id, author: CORE_SOCIAL_CHARACTERS.jay.displayName, text: "been playing this all week", timestamp: "Mar 14", createdAt: "2009-03-14T22:18:00-07:00", kind: "photo" as const, visibility: "friends" as const, mediaId: "jay-music-bedroom-2009-03-14" as const, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "katie-profile-picture-update", friendId: CORE_SOCIAL_CHARACTERS.katie.id, author: CORE_SOCIAL_CHARACTERS.katie.displayName, text: "updated her profile picture.", timestamp: "Oct 10", createdAt: "2010-10-10T16:00:00-07:00", kind: "photo" as const, visibility: "custom" as const, customAudienceIncludesUser: false, mediaId: "katie-profile-picture" as const, origin: "seed" as const }),
      Object.freeze({ id: "katie-selfie-september-2010", friendId: CORE_SOCIAL_CHARACTERS.katie.id, author: CORE_SOCIAL_CHARACTERS.katie.displayName, text: "added a new photo.", timestamp: "Sep 11", createdAt: "2010-09-11T14:00:00-07:00", kind: "photo" as const, visibility: "custom" as const, customAudienceIncludesUser: false, mediaId: "katie-selfie-september-2010" as const, origin: "seed" as const }),
      Object.freeze({ id: "katie-selfie-july-2010", friendId: CORE_SOCIAL_CHARACTERS.katie.id, author: CORE_SOCIAL_CHARACTERS.katie.displayName, text: "added a new photo.", timestamp: "Jul 17", createdAt: "2010-07-17T15:00:00-07:00", kind: "photo" as const, visibility: "custom" as const, customAudienceIncludesUser: false, mediaId: "katie-selfie-july-2010" as const, origin: "seed" as const }),
      Object.freeze({ id: "katie-selfie-august-2009", friendId: CORE_SOCIAL_CHARACTERS.katie.id, author: CORE_SOCIAL_CHARACTERS.katie.displayName, text: "summer :)", timestamp: "Aug 22", createdAt: "2009-08-22T16:00:00-07:00", kind: "photo" as const, visibility: "custom" as const, customAudienceIncludesUser: false, mediaId: "katie-selfie-august-2009" as const, origin: "seed" as const }),
      Object.freeze({ id: "katie-selfie-july-2009", friendId: CORE_SOCIAL_CHARACTERS.katie.id, author: CORE_SOCIAL_CHARACTERS.katie.displayName, text: "added a new photo.", timestamp: "Jul 18", createdAt: "2009-07-18T17:00:00-07:00", kind: "photo" as const, visibility: "custom" as const, customAudienceIncludesUser: false, mediaId: "katie-selfie-july-2009" as const, origin: "seed" as const }),
      Object.freeze({ id: "luca-work-main-street-diner", friendId: CORE_SOCIAL_CHARACTERS.luca.id, author: CORE_SOCIAL_CHARACTERS.luca.displayName, text: "added a new photo.", timestamp: "Mar 20", createdAt: "2010-03-20T22:30:00-07:00", kind: "photo" as const, visibility: "custom" as const, customAudienceIncludesUser: false, mediaId: "luca-work-main-street-diner" as const, venueId: MAIN_STREET_DINER_VENUE.id, origin: "seed" as const }),
      Object.freeze({ id: "luca-jack-tagged-photo", friendId: CORE_SOCIAL_CHARACTERS.luca.id, author: CORE_SOCIAL_CHARACTERS.luca.displayName, text: "somehow this guy ends up in every picture lol", timestamp: "September 14", createdAt: "2010-09-14T20:00:00-07:00", kind: "photo" as const, visibility: "friends-of-friends" as const, mediaId: "jack-tagged-luca-01" as const, albumTitle: "Photos", taggedCharacterIds: Object.freeze([CORE_SOCIAL_CHARACTERS.jack.id]), profileWallEligible: true, tagUiStatus: "HOLD" as const, origin: "seed" as const }),
      Object.freeze({ id: "alex-profile-picture-update", friendId: CORE_SOCIAL_CHARACTERS.alex.id, author: CORE_SOCIAL_CHARACTERS.alex.displayName, text: "updated his profile picture.", timestamp: "Oct 1", createdAt: "2010-10-01T16:00:00-07:00", kind: "photo" as const, visibility: "custom" as const, customAudienceIncludesUser: false, mediaId: "alex-profile-picture" as const, origin: "seed" as const }),
      Object.freeze({ id: "alex-dogs-wangcai-bb-2009", friendId: CORE_SOCIAL_CHARACTERS.alex.id, author: CORE_SOCIAL_CHARACTERS.alex.displayName, text: "旺財&BB", timestamp: "May 8", createdAt: "2009-05-08T16:00:00-07:00", kind: "photo" as const, visibility: "custom" as const, customAudienceIncludesUser: false, mediaId: "alex-dogs-wangcai-bb-2009" as const, origin: "seed" as const }),
      Object.freeze({ id: "alex-dog-golden-2007", friendId: CORE_SOCIAL_CHARACTERS.alex.id, author: CORE_SOCIAL_CHARACTERS.alex.displayName, text: "added a new photo.", timestamp: "Oct 3", createdAt: "2007-10-03T16:00:00-07:00", kind: "photo" as const, visibility: "custom" as const, customAudienceIncludesUser: false, mediaId: "alex-dog-golden-2007" as const, origin: "seed" as const }),
      Object.freeze({ id: "ben-profile-current-update", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "updated his profile picture.", timestamp: "Oct 15", createdAt: "2010-10-15T22:12:00-07:00", kind: "photo" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, mediaId: "ben-profile-current" as const, origin: "seed" as const }),
      Object.freeze({ id: "ben-photo-friday-2010", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "happy friday. finally.", timestamp: "Oct 15", createdAt: "2010-10-15T21:49:00-07:00", kind: "photo" as const, visibility: "friends" as const, profileWallEligible: true, mediaId: "ben-photo-friday-2010" as const, origin: "seed" as const }),
      Object.freeze({ id: "ben-wall-2010-10-12-coffee", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "coffee.", timestamp: "Oct 12", createdAt: "2010-10-12T08:29:00-07:00", kind: "status" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "ben-wall-2010-10-04-spreadsheet", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "another spreadsheet", timestamp: "Oct 4", createdAt: "2010-10-04T17:36:00-07:00", kind: "status" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "ben-wall-2010-09-29-still-here", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "still here.", timestamp: "Sep 29", createdAt: "2010-09-29T21:03:00-07:00", kind: "status" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "ben-wall-2010-09-10-numbers", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "too many numbers", timestamp: "Sep 10", createdAt: "2010-09-10T18:12:00-07:00", kind: "status" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "ben-wall-2010-08-27-home", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "going home on time", timestamp: "Aug 27", createdAt: "2010-08-27T16:49:00-07:00", kind: "status" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "ben-wall-2010-08-18-printer", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "printer survived today", timestamp: "Aug 18", createdAt: "2010-08-18T17:27:00-07:00", kind: "status" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "ben-wall-2010-08-06-emails", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "coffee then emails", timestamp: "Aug 6", createdAt: "2010-08-06T08:41:00-07:00", kind: "status" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "ben-wall-2010-07-23-friday", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "friday finally", timestamp: "Jul 23", createdAt: "2010-07-23T16:03:00-07:00", kind: "status" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "ben-wall-2010-07-12-monday", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "monday again", timestamp: "Jul 12", createdAt: "2010-07-12T08:16:00-07:00", kind: "status" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "ben-car-2010", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "new truck :)", timestamp: "Jul 10", createdAt: "2010-07-10T16:00:00-07:00", kind: "photo" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, mediaId: "ben-car-2010" as const, origin: "seed" as const }),
      Object.freeze({ id: "ben-wall-2010-07-02-weekend", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "three day weekend please", timestamp: "Jul 2", createdAt: "2010-07-02T14:38:00-07:00", kind: "status" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "ben-wall-2010-06-29-quarter-end", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "quarter end. cool.", timestamp: "Jun 29", createdAt: "2010-06-29T20:44:00-07:00", kind: "status" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "ben-wall-2010-06-11-office", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "still at the office", timestamp: "Jun 11", createdAt: "2010-06-11T19:08:00-07:00", kind: "status" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "ben-wall-2010-05-25-excel", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "excel hates me today", timestamp: "May 25", createdAt: "2010-05-25T18:31:00-07:00", kind: "status" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "ben-wall-2010-05-14-weekend", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "weekend soon", timestamp: "May 14", createdAt: "2010-05-14T15:55:00-07:00", kind: "status" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "ben-wall-2010-05-06-coffee", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "need a second coffee", timestamp: "May 6", createdAt: "2010-05-06T09:22:00-07:00", kind: "status" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "ben-wall-2010-04-27-tuesday", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "why is it only tuesday", timestamp: "Apr 27", createdAt: "2010-04-27T10:17:00-07:00", kind: "status" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "ben-wall-2010-04-16-meeting", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "another meeting about the meeting", timestamp: "Apr 16", createdAt: "2010-04-16T13:34:00-07:00", kind: "status" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "ben-wall-2010-04-09-outside", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "finally outside", timestamp: "Apr 9", createdAt: "2010-04-09T17:18:00-07:00", kind: "status" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "ben-wall-2010-03-31-month-end", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "month end = coffee", timestamp: "Mar 31", createdAt: "2010-03-31T20:06:00-07:00", kind: "status" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "ben-wall-2010-03-12-client", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "client changed it again lol", timestamp: "Mar 12", createdAt: "2010-03-12T16:42:00-08:00", kind: "status" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "ben-wall-2010-02-26-numbers", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "numbers still don't match. awesome", timestamp: "Feb 26", createdAt: "2010-02-26T18:09:00-08:00", kind: "status" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "ben-wall-2010-02-19-lunch", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "lunch was 12 minutes", timestamp: "Feb 19", createdAt: "2010-02-19T12:23:00-08:00", kind: "status" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "ben-wall-2010-02-05-commute", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "cold commute", timestamp: "Feb 5", createdAt: "2010-02-05T07:51:00-08:00", kind: "status" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "ben-wall-2010-01-21-meeting", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "meeting again", timestamp: "Jan 21", createdAt: "2010-01-21T14:12:00-08:00", kind: "status" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "ben-wall-2010-01-08-inbox", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "inbox is scary today", timestamp: "Jan 8", createdAt: "2010-01-08T08:36:00-08:00", kind: "status" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "ben-wall-2009-12-29-still-here", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "still here.", timestamp: "Dec 29", createdAt: "2009-12-29T19:14:00-08:00", kind: "status" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "ben-wall-2009-12-18-friday", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "friday please hurry", timestamp: "Dec 18", createdAt: "2009-12-18T15:47:00-08:00", kind: "status" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "ben-wall-2009-12-04-spreadsheet", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "another spreadsheet", timestamp: "Dec 4", createdAt: "2009-12-04T11:26:00-08:00", kind: "status" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "ben-wall-2009-11-24-printer", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "printer is broken again", timestamp: "Nov 24", createdAt: "2009-11-24T16:18:00-08:00", kind: "status" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "ben-wall-2009-11-06-coffee", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "need coffee", timestamp: "Nov 6", createdAt: "2009-11-06T07:42:00-08:00", kind: "status" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "ben-coffee-2009", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "added a new photo.", timestamp: "Feb 14", createdAt: "2009-02-14T16:00:00-08:00", kind: "photo" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, mediaId: "ben-coffee-2009" as const, origin: "seed" as const }),
      Object.freeze({ id: "ben-coffee-2006", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "added a new photo.", timestamp: "Aug 12", createdAt: "2006-08-12T16:00:00-07:00", kind: "photo" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, mediaId: "ben-coffee-2006" as const, origin: "seed" as const }),
      Object.freeze({ id: "ben-profile-2005-update", friendId: CORE_SOCIAL_CHARACTERS.ben.id, author: CORE_SOCIAL_CHARACTERS.ben.displayName, text: "updated his profile picture.", timestamp: "Sep 18", createdAt: "2005-09-18T16:00:00-07:00", kind: "photo" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, mediaId: "ben-profile-2005" as const, origin: "seed" as const }),
      Object.freeze({ id: "chris-profile-picture-update", friendId: CORE_SOCIAL_CHARACTERS.chris.id, author: CORE_SOCIAL_CHARACTERS.chris.displayName, text: "updated his profile picture.", timestamp: "Nov 14", createdAt: "2009-11-14T20:30:00-08:00", kind: "photo" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, mediaId: "chris-profile-picture" as const, origin: "seed" as const }),
      Object.freeze({ id: "matt-code-photo-2010", friendId: CORE_SOCIAL_CHARACTERS.matt.id, author: CORE_SOCIAL_CHARACTERS.matt.displayName, text: "added a new photo.", timestamp: "Oct 15", createdAt: "2010-10-15T23:03:00-07:00", kind: "photo" as const, visibility: "friends" as const, profileWallEligible: true, mediaId: "matt-code-2010" as const, origin: "seed" as const }),
      Object.freeze({ id: "matt-jack-tagged-photo", friendId: CORE_SOCIAL_CHARACTERS.matt.id, author: CORE_SOCIAL_CHARACTERS.matt.displayName, text: "apparently standing still isn't an option", timestamp: "October 3", createdAt: "2010-10-03T20:00:00-07:00", kind: "photo" as const, visibility: "friends-of-friends" as const, mediaId: "jack-tagged-matt-02" as const, albumTitle: "Photos", taggedCharacterIds: Object.freeze([CORE_SOCIAL_CHARACTERS.jack.id]), profileWallEligible: true, tagUiStatus: "HOLD" as const, origin: "seed" as const }),
      Object.freeze({ id: "matt-profile-current-update", friendId: CORE_SOCIAL_CHARACTERS.matt.id, author: CORE_SOCIAL_CHARACTERS.matt.displayName, text: "updated his profile picture.", timestamp: "Oct 2", createdAt: "2010-10-02T21:18:00-07:00", kind: "photo" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, mediaId: "matt-profile-current" as const, origin: "seed" as const }),
      Object.freeze({ id: "matt-jack-birthday-photo", friendId: CORE_SOCIAL_CHARACTERS.matt.id, author: CORE_SOCIAL_CHARACTERS.matt.displayName, text: "another year. happy birthday", timestamp: "August 2", createdAt: "2010-08-02T23:49:00-07:00", kind: "photo" as const, visibility: "friends" as const, mediaId: "matt-jack-birthday" as const, taggedCharacterIds: Object.freeze([CORE_SOCIAL_CHARACTERS.jack.id]), profileWallEligible: true, origin: "seed" as const }),
      Object.freeze({ id: "matt-photo-2007", friendId: CORE_SOCIAL_CHARACTERS.matt.id, author: CORE_SOCIAL_CHARACTERS.matt.displayName, text: "added a new photo.", timestamp: "Sep 25", createdAt: "2007-09-25T21:14:00-07:00", kind: "photo" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, mediaId: "matt-photo-2007" as const, origin: "seed" as const }),
      Object.freeze({ id: "matt-profile-2007-update", friendId: CORE_SOCIAL_CHARACTERS.matt.id, author: CORE_SOCIAL_CHARACTERS.matt.displayName, text: "updated his profile picture.", timestamp: "Aug 18", createdAt: "2007-08-18T20:10:00-07:00", kind: "photo" as const, visibility: "custom" as const, customAudienceIncludesUser: false, profileWallEligible: true, mediaId: "matt-profile-2007" as const, origin: "seed" as const }),
    ]),
    likes: Object.freeze([
      Object.freeze({ id: "luca-pickup-basketball-like-chris", itemId: "luca-pickup-basketball-photos", displayName: CORE_SOCIAL_CHARACTERS.chris.displayName, characterId: CORE_SOCIAL_CHARACTERS.chris.id, classification: "CURATED" as const, origin: "seed" as const }),
      ...JUNE_SHOW_POST_LIKES,
      ...JUNE_BIRTHDAY_LIKES,
      ...JUNE_READING_LIKES,
      ...JUNE_STARBUCKS_LIKES,
      ...JUNE_GIRLS_LIKES,
      ...JUNE_GRADUATION_LIKES,
      ...JACK_GAME_LIKES,
      ...JACK_SUMMER_LIKES,
      ...JACK_CAR_LIKES,
      ...JACK_PRACTICE_LIKES,
      ...JACK_BIRTHDAY_JUNE_LIKES,
      ...JACK_BIRTHDAY_SOPHIE_LIKES,
      ...JACK_BIRTHDAY_LUCA_LIKES,
      ...JACK_BIRTHDAY_MATT_LIKES,
      ...JACK_BIRTHDAY_THANKS_LIKES,
      ...JAY_BAND_SEED_LIKES,
      ...JAY_2009_MARCH_LIKES,
      ...JAY_2009_JUNE_LIKES,
      ...JAY_2009_AUGUST_LIKES,
      ...JAY_2009_NOVEMBER_LIKES,
    ]),
    comments: Object.freeze([
      Object.freeze({ id: "alex-party-comment-jay", itemId: "alex-jacks-party-friday", author: Object.freeze({ type: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.jay.id, displayName: CORE_SOCIAL_CHARACTERS.jay.displayName, classification: "CURATED" as const }), text: "yeah probably", origin: "seed" as const }),
      Object.freeze({ id: "alex-party-comment-ryan", itemId: "alex-jacks-party-friday", author: Object.freeze({ type: "ephemeral" as const, ...FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[FACEBOOK_EPHEMERAL_FRIEND_OF_FRIEND_ID] }), text: "yeah everyone's going lol", origin: "seed" as const }),
      Object.freeze({ id: "june-show-comment-jack", itemId: "june-show-photos-oct19", author: Object.freeze({ type: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.jack.id, displayName: CORE_SOCIAL_CHARACTERS.jack.displayName, classification: "CURATED" as const }), text: "My boy @Matt kiss kiss <3", mentions: Object.freeze([{ token: "@Matt", actor: Object.freeze({ kind: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.matt.id, displayName: CORE_SOCIAL_CHARACTERS.matt.displayName }) }]), origin: "seed" as const }),
      Object.freeze({ id: "june-show-comment-emily", itemId: "june-show-photos-oct19", author: Object.freeze({ type: "ephemeral" as const, ...FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[FACEBOOK_EPHEMERAL_EMILY_ID] }), text: "who was the drummer??", origin: "seed" as const }),
      Object.freeze({ id: "june-show-comment-ryan-a", itemId: "june-show-photos-oct19", author: Object.freeze({ type: "ephemeral" as const, ...FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[FACEBOOK_EPHEMERAL_FRIEND_OF_FRIEND_ID] }), text: "Anil lol how do you not know him", origin: "seed" as const }),
      Object.freeze({ id: "june-show-comment-sophie", itemId: "june-show-photos-oct19", author: Object.freeze({ type: "ephemeral" as const, ...FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[FACEBOOK_EPHEMERAL_SOPHIE_ID] }), text: "Girl you looked fancy <3", origin: "seed" as const }),
      Object.freeze({ id: "june-show-comment-nicole", itemId: "june-show-photos-oct19", author: Object.freeze({ type: "ephemeral" as const, ...FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[FACEBOOK_EPHEMERAL_NICOLE_ID] }), text: "wait THAT'S Anil?? damn", origin: "seed" as const }),
      Object.freeze({ id: "june-show-comment-chris", itemId: "june-show-photos-oct19", author: Object.freeze({ type: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.chris.id, displayName: CORE_SOCIAL_CHARACTERS.chris.displayName, classification: "CURATED" as const }), text: "who was on keys?", origin: "seed" as const }),
      Object.freeze({ id: "june-show-comment-ryan-b", itemId: "june-show-photos-oct19", author: Object.freeze({ type: "ephemeral" as const, ...FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[FACEBOOK_EPHEMERAL_FRIEND_OF_FRIEND_ID] }), text: "pretty sure that was Evan", origin: "seed" as const }),
      Object.freeze({ id: "june-show-comment-derek", itemId: "june-show-photos-oct19", author: Object.freeze({ type: "ephemeral" as const, ...FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[FACEBOOK_EPHEMERAL_DEREK_ID] }), text: "Anil killed it as usual", origin: "seed" as const }),
      Object.freeze({ id: "june-show-comment-megan", itemId: "june-show-photos-oct19", author: Object.freeze({ type: "ephemeral" as const, ...FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[FACEBOOK_EPHEMERAL_MEGAN_ID] }), text: "he plays with The Static Lines sometimes i think", origin: "seed" as const }),
      Object.freeze({ id: "june-show-comment-june", itemId: "june-show-photos-oct19", author: Object.freeze({ type: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.june.id, displayName: CORE_SOCIAL_CHARACTERS.june.displayName, classification: "CURATED" as const }), text: "haha apparently everyone knows everyone except me", origin: "seed" as const }),
      Object.freeze({ id: "june-sophie-photo-comment-sophie", itemId: "june-sophie-photo", author: Object.freeze({ type: "ephemeral" as const, ...FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[FACEBOOK_EPHEMERAL_SOPHIE_ID] }), text: "call me when u wake up lol", origin: "seed" as const }),
      ...JUNE_SOCIAL_HUB_COMMENTS,
      ...JACK_PROFILE_COMMENTS,
      ...JACK_BIRTHDAY_COMMENTS,
      Object.freeze({ id: "katie-september-comment-ben", itemId: "katie-selfie-september-2010", author: Object.freeze({ type: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.ben.id, displayName: CORE_SOCIAL_CHARACTERS.ben.displayName, classification: "CURATED" as const }), classification: "CURATED / SIBLING BANTER" as const, text: "do you own any other shirts?", origin: "seed" as const }),
      Object.freeze({ id: "luca-basketball-comment-chris-shot", itemId: "luca-pickup-basketball-photos", author: Object.freeze({ type: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.chris.id, displayName: CORE_SOCIAL_CHARACTERS.chris.displayName, classification: "CURATED" as const }), text: "my shot was clean tho lol", origin: "seed" as const }),
      Object.freeze({ id: "luca-basketball-comment-luca-misses", itemId: "luca-pickup-basketball-photos", author: Object.freeze({ type: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.luca.id, displayName: CORE_SOCIAL_CHARACTERS.luca.displayName, classification: "CURATED" as const }), text: "you missed like 10 before that", origin: "seed" as const }),
      Object.freeze({ id: "luca-basketball-comment-chris-details", itemId: "luca-pickup-basketball-photos", author: Object.freeze({ type: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.chris.id, displayName: CORE_SOCIAL_CHARACTERS.chris.displayName, classification: "CURATED" as const }), text: "details details", origin: "seed" as const }),
      Object.freeze({ id: "luca-basketball-comment-frank-count", itemId: "luca-pickup-basketball-photos", author: Object.freeze({ type: "ephemeral" as const, ...FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[FACEBOOK_EPHEMERAL_FRANK_ID] }), text: "i counted 12 lol", origin: "seed" as const }),
      Object.freeze({ id: "jay-band-comment-katie", itemId: "jay-band-performance-photo", author: Object.freeze({ type: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.katie.id, displayName: CORE_SOCIAL_CHARACTERS.katie.displayName, classification: "CURATED" as const }), text: "wait you guys are actually really good lol", origin: "seed" as const }),
      Object.freeze({ id: "jay-band-comment-alex", itemId: "jay-band-performance-photo", author: Object.freeze({ type: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.alex.id, displayName: CORE_SOCIAL_CHARACTERS.alex.displayName, classification: "CURATED" as const }), text: "wish i made it lol", origin: "seed" as const }),
      Object.freeze({ id: "jay-band-comment-jack", itemId: "jay-band-performance-photo", author: Object.freeze({ type: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.jack.id, displayName: CORE_SOCIAL_CHARACTERS.jack.displayName, classification: "CURATED" as const }), text: "nice. you guys killed it", origin: "seed" as const }),
      Object.freeze({ id: "jay-band-comment-mike", itemId: "jay-band-performance-photo", author: Object.freeze({ type: "ephemeral" as const, ...FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[FACEBOOK_EPHEMERAL_MIKE_ID] }), text: "@Matt bass sounded sick", mentions: Object.freeze([{ token: "@Matt", actor: Object.freeze({ kind: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.matt.id, displayName: CORE_SOCIAL_CHARACTERS.matt.displayName }) }]), origin: "seed" as const }),
      Object.freeze({ id: "jay-band-comment-sarah", itemId: "jay-band-performance-photo", author: Object.freeze({ type: "ephemeral" as const, ...FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[FACEBOOK_EPHEMERAL_SARAH_ID] }), text: "who's the drummer?", origin: "seed" as const }),
      Object.freeze({ id: "jay-band-comment-kevin", itemId: "jay-band-performance-photo", author: Object.freeze({ type: "ephemeral" as const, ...FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[FACEBOOK_EPHEMERAL_KEVIN_ID] }), text: "that was a good set", origin: "seed" as const }),
      Object.freeze({ id: "jay-band-comment-emily", itemId: "jay-band-performance-photo", author: Object.freeze({ type: "ephemeral" as const, ...FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[FACEBOOK_EPHEMERAL_EMILY_ID] }), text: "i knew that song!!", origin: "seed" as const }),
      Object.freeze({ id: "jay-band-comment-nick", itemId: "jay-band-performance-photo", author: Object.freeze({ type: "ephemeral" as const, ...FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[FACEBOOK_EPHEMERAL_NICK_ID] }), text: "next show when", origin: "seed" as const }),
      Object.freeze({ id: "jay-band-comment-rachel", itemId: "jay-band-performance-photo", author: Object.freeze({ type: "ephemeral" as const, ...FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[FACEBOOK_EPHEMERAL_RACHEL_ID] }), text: "so good", origin: "seed" as const }),
      Object.freeze({ id: "jay-band-comment-frank", itemId: "jay-band-performance-photo", author: Object.freeze({ type: "ephemeral" as const, ...FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[FACEBOOK_EPHEMERAL_FRANK_ID] }), text: "nice set lol", origin: "seed" as const }),
      Object.freeze({ id: "jay-band-comment-ryan", itemId: "jay-band-performance-photo", author: Object.freeze({ type: "ephemeral" as const, ...FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[FACEBOOK_EPHEMERAL_FRIEND_OF_FRIEND_ID] }), text: "looks awesome", origin: "seed" as const }),
      Object.freeze({ id: "jay-2009-march-comment-luca", itemId: "jay-music-bedroom-2009-03-14", author: Object.freeze({ type: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.luca.id, displayName: CORE_SOCIAL_CHARACTERS.luca.displayName, classification: "CURATED" as const }), text: "again??", origin: "seed" as const }),
      Object.freeze({ id: "jay-2009-march-comment-jay", itemId: "jay-music-bedroom-2009-03-14", author: Object.freeze({ type: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.jay.id, displayName: CORE_SOCIAL_CHARACTERS.jay.displayName, classification: "CURATED" as const }), text: "yeah", origin: "seed" as const }),
      Object.freeze({ id: "jay-2009-march-comment-sarah", itemId: "jay-music-bedroom-2009-03-14", author: Object.freeze({ type: "ephemeral" as const, ...FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[FACEBOOK_EPHEMERAL_SARAH_ID] }), text: "good album", origin: "seed" as const }),
      Object.freeze({ id: "jay-2009-june-comment-matt", itemId: "jay-rehearsal-2009-06-27", author: Object.freeze({ type: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.matt.id, displayName: CORE_SOCIAL_CHARACTERS.matt.displayName, classification: "CURATED" as const }), text: "speak for yourself", origin: "seed" as const }),
      Object.freeze({ id: "jay-2009-june-comment-jay", itemId: "jay-rehearsal-2009-06-27", author: Object.freeze({ type: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.jay.id, displayName: CORE_SOCIAL_CHARACTERS.jay.displayName, classification: "CURATED" as const }), text: "shut up ricci", origin: "seed" as const }),
      Object.freeze({ id: "jay-2009-june-comment-z-tokyo", itemId: "jay-rehearsal-2009-06-27", author: Object.freeze({ type: "author-easter-egg" as const, authorId: FACEBOOK_AUTHOR_EASTER_EGG_ID, displayName: FACEBOOK_AUTHOR_EASTER_EGGS[FACEBOOK_AUTHOR_EASTER_EGG_ID].displayName }), text: "lol", origin: "seed" as const }),
      Object.freeze({ id: "jay-2009-june-comment-mike", itemId: "jay-rehearsal-2009-06-27", author: Object.freeze({ type: "ephemeral" as const, ...FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[FACEBOOK_EPHEMERAL_MIKE_ID] }), text: "sounds better", origin: "seed" as const }),
      Object.freeze({ id: "jay-2009-june-comment-kevin", itemId: "jay-rehearsal-2009-06-27", author: Object.freeze({ type: "ephemeral" as const, ...FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[FACEBOOK_EPHEMERAL_KEVIN_ID] }), text: "finally lol", origin: "seed" as const }),
      Object.freeze({ id: "jay-2009-august-comment-matt", itemId: "jay-cd-haul-2009-08-22", author: Object.freeze({ type: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.matt.id, displayName: CORE_SOCIAL_CHARACTERS.matt.displayName, classification: "CURATED" as const }), text: "you bought that one finally", origin: "seed" as const }),
      Object.freeze({ id: "jay-2009-august-comment-jay-1", itemId: "jay-cd-haul-2009-08-22", author: Object.freeze({ type: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.jay.id, displayName: CORE_SOCIAL_CHARACTERS.jay.displayName, classification: "CURATED" as const }), text: "yeah", origin: "seed" as const }),
      Object.freeze({ id: "jay-2009-august-comment-emily", itemId: "jay-cd-haul-2009-08-22", author: Object.freeze({ type: "ephemeral" as const, ...FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[FACEBOOK_EPHEMERAL_EMILY_ID] }), text: "worth it?", origin: "seed" as const }),
      Object.freeze({ id: "jay-2009-august-comment-jay-2", itemId: "jay-cd-haul-2009-08-22", author: Object.freeze({ type: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.jay.id, displayName: CORE_SOCIAL_CHARACTERS.jay.displayName, classification: "CURATED" as const }), text: "definitely", origin: "seed" as const }),
      Object.freeze({ id: "jay-2009-november-comment-matt-1", itemId: "jay-learning-by-ear-2009-11-07", author: Object.freeze({ type: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.matt.id, displayName: CORE_SOCIAL_CHARACTERS.matt.displayName, classification: "CURATED" as const }), text: "you're playing it wrong", origin: "seed" as const }),
      Object.freeze({ id: "jay-2009-november-comment-jay", itemId: "jay-learning-by-ear-2009-11-07", author: Object.freeze({ type: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.jay.id, displayName: CORE_SOCIAL_CHARACTERS.jay.displayName, classification: "CURATED" as const }), text: "come over then", origin: "seed" as const }),
      Object.freeze({ id: "jay-2009-november-comment-matt-2", itemId: "jay-learning-by-ear-2009-11-07", author: Object.freeze({ type: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.matt.id, displayName: CORE_SOCIAL_CHARACTERS.matt.displayName, classification: "CURATED" as const }), text: "no", origin: "seed" as const }),
      Object.freeze({ id: "jay-2009-november-comment-frank", itemId: "jay-learning-by-ear-2009-11-07", author: Object.freeze({ type: "ephemeral" as const, ...FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[FACEBOOK_EPHEMERAL_FRANK_ID] }), text: "lol", origin: "seed" as const }),
      Object.freeze({ id: "matt-code-comment-eric-jsonp", itemId: "matt-code-photo-2010", author: Object.freeze({ type: "ephemeral" as const, ...FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[FACEBOOK_EPHEMERAL_ERIC_ID] }), classification: "PERIOD-EVIDENCE-INFORMED / CURATED" as const, text: "jsonp? lol", origin: "seed" as const }),
      Object.freeze({ id: "matt-code-comment-daniel-callback", itemId: "matt-code-photo-2010", author: Object.freeze({ type: "ephemeral" as const, ...FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[FACEBOOK_EPHEMERAL_DANIEL_ID] }), classification: "PERIOD-EVIDENCE-INFORMED / CURATED" as const, text: "yeah callback=? should work", origin: "seed" as const }),
      Object.freeze({ id: "matt-code-comment-sam-jquery", itemId: "matt-code-photo-2010", author: Object.freeze({ type: "ephemeral" as const, ...FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[FACEBOOK_EPHEMERAL_SAM_ID] }), classification: "PERIOD-EVIDENCE-INFORMED / CURATED" as const, text: "still on 1.4.2. not touching rc2 yet", origin: "seed" as const }),
      Object.freeze({ id: "matt-code-comment-kevin-image", itemId: "matt-code-photo-2010", author: Object.freeze({ type: "ephemeral" as const, ...FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[FACEBOOK_EPHEMERAL_KEVIN_ID] }), classification: "PERIOD-EVIDENCE-INFORMED / CURATED" as const, text: "image[2]['#text'] should give you the larger one", origin: "seed" as const }),
      Object.freeze({ id: "matt-code-comment-rachel-album", itemId: "matt-code-photo-2010", author: Object.freeze({ type: "ephemeral" as const, ...FACEBOOK_EPHEMERAL_FRIENDS_OF_FRIENDS[FACEBOOK_EPHEMERAL_RACHEL_ID] }), classification: "CURATED" as const, text: "oracular spectacular again lol", origin: "seed" as const }),
      Object.freeze({ id: "matt-code-comment-matt-reply", itemId: "matt-code-photo-2010", author: Object.freeze({ type: "canonical" as const, characterId: CORE_SOCIAL_CHARACTERS.matt.id, displayName: CORE_SOCIAL_CHARACTERS.matt.displayName, classification: "CURATED" as const }), text: "works now", origin: "seed" as const }),
    ]),
    inbox: Object.freeze([
      Object.freeze({ id: "katie-tomorrow", friendId: CORE_SOCIAL_FRIENDS.katie.id, sender: CORE_SOCIAL_FRIENDS.katie.displayName, preview: "see you tomorrow", timestamp: "10:14 PM", status: "read" as const, origin: "seed" as const }),
      Object.freeze({ id: "jay-photo", friendId: CORE_SOCIAL_FRIENDS.jay.id, sender: CORE_SOCIAL_FRIENDS.jay.displayName, preview: "send me the photo", timestamp: "9:16 PM", status: "read" as const, origin: "seed" as const }),
    ]),
  }),
  twitter: Object.freeze([
    Object.freeze({ id: "matt-back-to-the-mac", friendId: CORE_SOCIAL_CHARACTERS.matt.id, displayName: CORE_SOCIAL_CHARACTERS.matt.displayName, text: "really curious what apple means by “back to the mac”", timestamp: "10:47 PM", timestampProvenance: "CURATED" as const, contentType: "character-content" as const, contentProvenance: "CURATED" as const, origin: "seed" as const }),
    Object.freeze({ id: "matt-phone-battery", friendId: CORE_SOCIAL_CHARACTERS.matt.id, displayName: CORE_SOCIAL_CHARACTERS.matt.displayName, text: "my phone battery is somehow worse when i actually need it", timestamp: "11:16 PM", timestampProvenance: "CURATED" as const, contentType: "character-content" as const, contentProvenance: "CURATED" as const, origin: "seed" as const }),
    Object.freeze({ id: "jay-halcyon-digest", friendId: CORE_SOCIAL_CHARACTERS.jay.id, displayName: CORE_SOCIAL_CHARACTERS.jay.displayName, text: "halcyon digest sounds way better with headphones", timestamp: "9:38 PM", timestampProvenance: "CURATED" as const, contentType: "character-content" as const, contentProvenance: "CURATED" as const, origin: "seed" as const }),
    Object.freeze({ id: "jay-new-sufjan-record", friendId: CORE_SOCIAL_CHARACTERS.jay.id, displayName: CORE_SOCIAL_CHARACTERS.jay.displayName, text: "the new sufjan record is completely insane", timestamp: "10:21 PM", timestampProvenance: "CURATED" as const, contentType: "character-content" as const, contentProvenance: "CURATED" as const, origin: "seed" as const }),
    Object.freeze({ id: "jay-cmj-bands", friendId: CORE_SOCIAL_CHARACTERS.jay.id, displayName: CORE_SOCIAL_CHARACTERS.jay.displayName, text: "spent an hour looking up bands playing cmj and now i want to be in new york", timestamp: "11:23 PM", timestampProvenance: "CURATED" as const, contentType: "character-content" as const, contentProvenance: "CURATED" as const, origin: "seed" as const }),
    Object.freeze({ id: "still-awake", displayName: "June", text: "anyone still awake?", timestamp: "11:58 PM", timestampProvenance: "CURATED" as const, contentType: "ordinary" as const, contentProvenance: "CURATED" as const, origin: "seed" as const }),
    Object.freeze({
      id: "manual-rt-kanye-album-cover",
      displayName: "Nora",
      text: "RT @kanyewest In response to the reaction of my album cover... \"I'm deeply sorry if I haven't offended everybody\"",
      timestamp: "11:53 PM",
      timestampProvenance: "CURATED" as const,
      contentType: "manual-retweet" as const,
      sourceTweetProvenance: "HOLD" as const,
      retweetWrapperProvenance: "CURATED" as const,
      sourceTweet: Object.freeze({
        displayName: "Kanye West",
        handle: "@kanyewest",
        text: "In response to the reaction of my album cover... \"I'm deeply sorry if I haven't offended everybody\"",
        sourceDate: "2010-10-19",
        sourceTimestamp: "2010-10-19T16:05:11Z",
        pacificTime: "9:05:11 AM PDT",
        sourceUrl: "https://yzy-twts.com/2010",
        note: "Later archive metadata; no original status capture recovered.",
      }),
      origin: "seed" as const,
    }),
    Object.freeze({ id: "dana-office-deck", displayName: "Dana", text: "still at the office. this deck is never going to end", timestamp: "11:49 PM", timestampProvenance: "CURATED" as const, contentType: "work-life" as const, contentProvenance: "CURATED" as const, origin: "seed" as const }),
    Object.freeze({ id: "late-night-matt", friendId: CORE_SOCIAL_CHARACTERS.matt.id, displayName: CORE_SOCIAL_CHARACTERS.matt.displayName, text: "one missing semicolon and suddenly nothing works", timestamp: "11:41 PM", timestampProvenance: "CURATED" as const, contentType: "ordinary" as const, contentProvenance: "CURATED" as const, origin: "seed" as const }),
    Object.freeze({ id: "kanye-discussion", displayName: "Mia", text: "why is everyone talking about Kanye tonight", timestamp: "11:26 PM", timestampProvenance: "CURATED" as const, contentType: "celebrity-discussion" as const, contentProvenance: "CURATED" as const, origin: "seed" as const }),
    Object.freeze({ id: "marcus-client-approved", displayName: "Marcus", text: "client approved the first version. honestly kind of suspicious", timestamp: "11:09 PM", timestampProvenance: "CURATED" as const, contentType: "work-life" as const, contentProvenance: "CURATED" as const, origin: "seed" as const }),
    Object.freeze({
      id: "manual-rt-conan-fan-question",
      displayName: "Eli",
      text: "RT @ConanOBrien This week I answer another fan's question and punish my head writer in the process: http://bit.ly/cGrEgh",
      timestamp: "11:03 PM",
      timestampProvenance: "CURATED" as const,
      contentType: "manual-retweet" as const,
      sourceTweetProvenance: "HOLD" as const,
      retweetWrapperProvenance: "CURATED" as const,
      sourceTweet: Object.freeze({
        displayName: "Conan O'Brien",
        handle: "@ConanOBrien",
        text: "This week I answer another fan's question and punish my head writer in the process: http://bit.ly/cGrEgh",
        sourceDate: "2010-10-19",
        sourceTimestamp: null,
        pacificTime: null,
        sourceUrl: "https://wicoco.fandom.com/wiki/Conan_O%27Brien%27s_Twitter_account/Archive",
        note: "Later date-only archive; exact time, client, and original permalink remain unresolved.",
      }),
      origin: "seed" as const,
    }),
    Object.freeze({ id: "apple-event", displayName: "Sam", text: "Apple event tomorrow morning. Might follow the liveblogs.", timestamp: "10:47 PM", timestampProvenance: "CURATED" as const, contentType: "apple-reference" as const, contentProvenance: "CURATED/HOLD" as const, origin: "seed" as const }),
    Object.freeze({ id: "priya-file-typo", displayName: "Priya", text: "sent the file and immediately found a typo. perfect.", timestamp: "10:22 PM", timestampProvenance: "CURATED" as const, contentType: "work-life" as const, contentProvenance: "CURATED" as const, origin: "seed" as const }),
    Object.freeze({ id: "class-tomorrow", displayName: "Jack", text: "class tomorrow and I'm still watching TV", timestamp: "10:05 PM", timestampProvenance: "CURATED" as const, contentType: "ordinary" as const, contentProvenance: "CURATED" as const, origin: "seed" as const }),
    Object.freeze({ id: "claire-promotion-talk", displayName: "Claire", text: "promotion talk went way better than i expected", timestamp: "9:47 PM", timestampProvenance: "CURATED" as const, contentType: "work-life" as const, contentProvenance: "CURATED" as const, origin: "seed" as const }),
    Object.freeze({ id: "rain-stopped", displayName: "June", text: "The rain finally stopped.", timestamp: "9:12 PM", timestampProvenance: "CURATED" as const, contentType: "ordinary" as const, contentProvenance: "CURATED" as const, origin: "seed" as const }),
    Object.freeze({ id: "ben-home-from-work", displayName: "Ben", text: "home from work. not opening my laptop again tonight", timestamp: "9:08 PM", timestampProvenance: "CURATED" as const, contentType: "work-life" as const, contentProvenance: "CURATED" as const, origin: "seed" as const }),
    Object.freeze({ id: "matt-jacks-party", friendId: CORE_SOCIAL_CHARACTERS.matt.id, displayName: CORE_SOCIAL_CHARACTERS.matt.displayName, text: "jack's party sounds exhausting lol", timestamp: "8:30 PM", timestampProvenance: "CURATED" as const, contentType: "party-reaction" as const, contentProvenance: "CURATED" as const, origin: "seed" as const }),
  ]),
  twitterReplies: Object.freeze([
    Object.freeze({ id: "jay-reply-matt-nerd", targetTweetId: "matt-back-to-the-mac", friendId: CORE_SOCIAL_CHARACTERS.jay.id, displayName: CORE_SOCIAL_CHARACTERS.jay.displayName, text: "nerd", timestamp: "2010-10-19T22:51:00-07:00", origin: "seed" as const }),
  ]),
  twitterMentions: Object.freeze([
    Object.freeze({ id: "mention-alex-conan", friendId: CORE_SOCIAL_FRIENDS.alex.id, sender: CORE_SOCIAL_FRIENDS.alex.displayName, textTemplate: "@{handle} look at this lol", timestamp: "11:54 PM", unread: true, linkedTweetId: "historical-conan-jackass-3d", origin: "seed" as const, provenance: "CURATED" as const }),
    Object.freeze({ id: "mention-chris-thing", friendId: CORE_SOCIAL_FRIENDS.chris.id, sender: CORE_SOCIAL_FRIENDS.chris.displayName, textTemplate: "@{handle} did you ever finish that thing?", timestamp: "10:38 PM", unread: false, linkedTweetId: null, origin: "seed" as const, provenance: "CURATED" as const }),
  ]),
  twitterDirectMessages: Object.freeze([
    Object.freeze({ id: "dm-katie", friendId: CORE_SOCIAL_FRIENDS.katie.id, sender: CORE_SOCIAL_FRIENDS.katie.displayName, timestamp: "11:46 PM", unread: true, messages: Object.freeze([Object.freeze({ id: "dm-katie-1", text: "crazy ahaha", linkedTweetId: "historical-conan-jackass-3d", origin: "seed" as const })]), origin: "seed" as const, provenance: "CURATED" as const }),
    Object.freeze({ id: "dm-matt", friendId: CORE_SOCIAL_FRIENDS.matt.id, sender: CORE_SOCIAL_FRIENDS.matt.displayName, timestamp: "10:21 PM", unread: false, messages: Object.freeze([Object.freeze({ id: "dm-matt-1", text: "see you tomorrow", linkedTweetId: null, origin: "seed" as const })]), origin: "seed" as const, provenance: "CURATED" as const }),
  ]),
  twitterHistoricalLinkedTweets: Object.freeze([
    Object.freeze({
      id: "historical-conan-jackass-3d",
      displayName: "Conan O'Brien",
      authorHandle: "@ConanOBrien",
      text: "Saw Jackass 3D. Not as good as the book.",
      timestamp: "Oct 18",
      sourceTimestamp: "2010-10-18T22:58:58Z",
      pacificTime: "3:58:58 PM PDT",
      sourceUrl: "https://web.archive.org/web/20101022080924id_/http://twitter.com/ConanOBrien/status/27777712177",
      provenance: "PERIOD-EVIDENCE" as const,
      evidenceNote: "Original Twitter status captured by Wayback; authentic but outside the primary target window.",
      origin: "seed" as const,
    }),
  ]),
  foursquare: Object.freeze({
    venues: Object.freeze([
      Object.freeze({ id: "night-owl", name: "Night Owl Cafe", category: "Coffee Shop", address: "214 4th Street", distance: "0.2 mi", mayor: "June", tip: Object.freeze({ id: "night-owl-tip", author: "June", text: "The coffee is strongest after ten.", origin: "seed" as const }), origin: "seed" as const }),
      Object.freeze({ ...MAIN_STREET_DINER_VENUE, category: "Diner", address: "38 Market Street", distance: "0.3 mi", mayor: "Jack", tip: null, origin: "seed" as const }),
      Object.freeze({ id: "cedar-books", name: "Cedar Books", category: "Bookstore", address: "91 Cedar Avenue", distance: "0.5 mi", mayor: "Mia", tip: null, origin: "seed" as const }),
      Object.freeze({ id: "riverside-park", name: "Riverside Park", category: "Park", address: "Riverside Drive", distance: "0.7 mi", mayor: "Eli", tip: null, origin: "seed" as const }),
    ]),
    activities: Object.freeze([
      Object.freeze({ id: "mia-cedar-books", message: "Mia checked in at Cedar Books.", timestamp: "8:42 PM", origin: "seed" as const }),
    ]),
  }),
  flickr: Object.freeze([
    Object.freeze({ id: "sunset-brooklyn", title: "Evening Streetlight", owner: "flickr.demo", timestamp: "2010-10-19 11:54 PM", comments: Object.freeze(["Nice shot"]), origin: "seed" as const }),
    Object.freeze({ id: "coffee-table", title: "Cup and Notepad", owner: "flickr.demo", timestamp: "2010-10-19 11:27 PM", origin: "seed" as const }),
    Object.freeze({ id: "platform", title: "Platform", owner: "flickr.demo", timestamp: "2010-10-19 10:49 PM", origin: "seed" as const }),
  ]),
  tumblr: Object.freeze([
    Object.freeze({ id: "sunset-note", type: "text" as const, blog: "dayonejournal", title: "Evening walk", content: "The lights on the avenue feel older than we used to remember.", timestamp: "2010-10-19 11:51 PM", origin: "seed" as const }),
    Object.freeze({ id: "quote-post", type: "quote" as const, blog: "tinyquotes", title: "Quote", content: "“The long night begins with one silent decision.”", timestamp: "2010-10-19 11:18 PM", origin: "seed" as const }),
  ]),
  instagram: Object.freeze({
    photos: Object.freeze([]),
    followers: 0,
    followedCharacterIds: Object.freeze([CORE_SOCIAL_CHARACTERS.june.id]),
    knownAccounts: Object.freeze([
      Object.freeze({
        canonicalCharacterId: CORE_SOCIAL_CHARACTERS.june.id,
        username: CORE_SOCIAL_CHARACTERS.june.socialHandles.instagram,
        displayName: CORE_SOCIAL_CHARACTERS.june.displayName,
        followersBaseline: 118,
        followingBaseline: 236,
        classification: "CURATED" as const,
        discoveryUiStatus: "READY" as const,
        followUiStatus: "READY" as const,
        profileUiStatus: "HOLD" as const,
        origin: "seed" as const,
      }),
    ]),
    knownAccountPosts: Object.freeze([
      Object.freeze({ id: "june-ig-04" as const, canonicalCharacterId: CORE_SOCIAL_CHARACTERS.june.id, username: CORE_SOCIAL_CHARACTERS.june.socialHandles.instagram, mediaId: "june-ig-04" as const, caption: null, timestamp: "2010-10-20T00:00:00-07:00", status: "visible" as const, classification: "CURATED" as const, origin: "seed" as const }),
      Object.freeze({ id: "june-ig-03" as const, canonicalCharacterId: CORE_SOCIAL_CHARACTERS.june.id, username: CORE_SOCIAL_CHARACTERS.june.socialHandles.instagram, mediaId: "june-ig-03" as const, caption: null, timestamp: "2010-10-16", status: "visible" as const, classification: "CURATED" as const, origin: "seed" as const }),
      Object.freeze({ id: "june-ig-02" as const, canonicalCharacterId: CORE_SOCIAL_CHARACTERS.june.id, username: CORE_SOCIAL_CHARACTERS.june.socialHandles.instagram, mediaId: "june-ig-02" as const, caption: null, timestamp: "2010-10-15", status: "visible" as const, classification: "CURATED" as const, origin: "seed" as const }),
    ]),
  }),
});
