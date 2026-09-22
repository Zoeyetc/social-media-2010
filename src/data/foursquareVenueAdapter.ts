import coffeeIcon from "../assets/foursquare/icons/category-coffee-2010-reconstructed.svg";
import dinerIcon from "../assets/foursquare/icons/category-diner-2010-reconstructed.svg";
import bookstoreIcon from "../assets/foursquare/icons/category-bookstore-2010-reconstructed.svg";
import parkIcon from "../assets/foursquare/icons/category-park-2010-reconstructed.svg";
import { FOURSQUARE_VENUE_TIPS, type FoursquareCheckinActivity } from "./foursquareContent";
import type { FoursquareVenue } from "../state/foursquareState";

export const FOURSQUARE_VENUE_CATEGORIES = ["coffee-shop", "diner-restaurant", "bookstore", "park", "gelato", "chinese-restaurant"] as const;
export type FoursquareVenueCategory = typeof FOURSQUARE_VENUE_CATEGORIES[number];

export type FoursquareVenueViewModel = Readonly<{
  id: string;
  name: string;
  category: FoursquareVenueCategory;
  categoryLabel: string;
  categoryIcon: string;
  tipIds: readonly string[];
  mayorCharacterId?: string;
  priorFriendActivityIds: readonly string[];
  currentFriendIds: readonly string[];
  contentStatus: FoursquareVenue["contentStatus"];
}>;

const CATEGORY_BY_VENUE_ID: Readonly<Record<string, { id: FoursquareVenueCategory; label: string; icon: string }>> = Object.freeze({
  "gelato-roma": Object.freeze({ id: "gelato", label: "Ice Cream / Gelato", icon: dinerIcon }),
  "hk": Object.freeze({ id: "chinese-restaurant", label: "Chinese Restaurant", icon: dinerIcon }),
  "night-owl": Object.freeze({ id: "coffee-shop", label: "Coffee Shop", icon: coffeeIcon }),
  "main-street-diner": Object.freeze({ id: "diner-restaurant", label: "Diner / Restaurant", icon: dinerIcon }),
  "cedar-books": Object.freeze({ id: "bookstore", label: "Bookstore", icon: bookstoreIcon }),
  "riverside-park": Object.freeze({ id: "park", label: "Park", icon: parkIcon }),
});

export function createFoursquareVenueViewModels(
  venues: readonly FoursquareVenue[],
  activities: readonly FoursquareCheckinActivity[],
): readonly FoursquareVenueViewModel[] {
  return venues.map(venue => {
    const category = CATEGORY_BY_VENUE_ID[venue.id];
    if (!category) throw new Error(`Missing explicit Foursquare category mapping for ${venue.id}`);
    return Object.freeze({
      id: venue.id,
      name: venue.name,
      category: category.id,
      categoryLabel: category.label,
      categoryIcon: category.icon,
      tipIds: Object.freeze(FOURSQUARE_VENUE_TIPS.filter(tip => tip.venueId === venue.id).map(tip => tip.id)),
      priorFriendActivityIds: Object.freeze(activities.filter(activity => activity.visible && activity.venueId === venue.id).map(activity => activity.id)),
      currentFriendIds: Object.freeze([]),
      contentStatus: venue.contentStatus,
    });
  });
}
