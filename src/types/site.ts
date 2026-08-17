/** Built-in video platform identifiers. */
export type BuiltInSiteType =
  | "youtube"
  | "bilibili"
  | "tiktok"
  | "twitch"
  | "netflix"
  | "disney-plus"
  | "coursera"
  | "udemy"
  | "facebook"
  | "x"
  | "reddit"
  | "dailymotion";

/** Site identifiers used by statistics for unsupported/custom pages. */
export type SiteType = BuiltInSiteType | "other";

/** All built-in site identifiers plus the fallback bucket. */
export const SITE_TYPES = [
  "youtube",
  "bilibili",
  "tiktok",
  "twitch",
  "netflix",
  "disney-plus",
  "coursera",
  "udemy",
  "facebook",
  "x",
  "reddit",
  "dailymotion",
  "other",
] as const satisfies readonly SiteType[];

/** Sites that can be handled without a user-provided custom domain. */
export const SUPPORTED_SITE_TYPES = SITE_TYPES.filter(
  (site): site is BuiltInSiteType => site !== "other",
);
