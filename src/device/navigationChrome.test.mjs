import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const css = read("../styles/device.css");
const flickrCss = read("../styles/flickr.css");
const messages = read("./MobileSMSContainer.tsx");
const primitive = read("./IOS4NavigationBackButton.tsx");
const facebook = read("./FacebookContainer.tsx");
const twitter = read("./TwitterContainer.tsx");
const instagram = read("./InstagramContainer.tsx");
const foursquare = read("./FoursquareContainer.tsx");
const flickr = read("./FlickrContainer.tsx");

assert.match(messages, /<IOS4NavigationBackButton[\s\S]*label="Messages"[\s\S]*BACK_TO_LIST/);
assert.match(primitive, /<path className="ios4-navigation-back-shape"/);
assert.equal((primitive.match(/ios4-navigation-back-shape/g) ?? []).length, 1, "one continuous outer geometry owns the system Back silhouette");
assert.match(primitive, /M2\.8 15L10\.7 2\.7H/, "top highlight continues through the directional cap");
assert.doesNotMatch(css, /\.mobilesms-back-button::before/);
assert.match(css, /\.mobilesms-navigation-bar > \.mobilesms-back-button:active \.ios4-navigation-back-artwork/);
assert.match(css, /\.facebook-navigation-bar > \.facebook-directional-back-control:active \.facebook-directional-back-artwork/);
assert.match(css, /\.twitter-navigation-bar > \.twitter-back-button:active/);
const instagramBase = css.indexOf("button.instagram-navigation-cancel {");
const instagramPressed = css.indexOf("button.instagram-navigation-cancel:active {");
assert.ok(instagramBase >= 0 && instagramPressed > instagramBase, "Instagram directional pressed rule owns the final cascade");

assert.doesNotMatch(flickr, /▦/);
assert.match(flickr, /flickr-grid-list-2010-reconstructed\.svg/);
assert.match(flickrCss, /\.flickr-grid-list-artwork/);
assert.match(foursquare, /foursquare-navigation-bar\$\{[\s\S]*has-left-control/);
assert.match(css, /\.foursquare-navigation-bar\.has-left-control > button \{[^}]*max-width:[^;}]*84px;[^}]*text-overflow: ellipsis;/);
assert.match(css, /\.foursquare-navigation-bar\.has-left-control > strong \{ max-width: 132px; \}/);

for (const [name, source] of [["Facebook", facebook], ["Twitter", twitter], ["Instagram", instagram]]) {
  assert.doesNotMatch(source, /IOS4NavigationBackButton/, `${name} retains app-specific visible Back chrome`);
}
assert.match(facebook, /Facebook2010BackButton/);
assert.match(twitter, /twitter-back-button/);
assert.match(instagram, /instagram-navigation-cancel/);

console.log("PASS: isolated iOS 4 navigation chrome geometry, pressed states, Flickr artwork and Foursquare containment");
