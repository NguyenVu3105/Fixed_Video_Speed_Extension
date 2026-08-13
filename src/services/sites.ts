import type { BuiltInSiteType, CustomSite, SiteType } from "../types";

/** A built-in platform and the hostnames on which its player is embedded. */
export interface SiteDefinition {
  readonly type: BuiltInSiteType;
  readonly label: string;
  readonly domains: readonly string[];
}

/**
 * Host rules for the platforms listed in the roadmap. Rules intentionally use
 * hostnames rather than URL paths so they continue to work across SPAs and
 * localized versions of each service.
 */
export const SITE_DEFINITIONS: readonly SiteDefinition[] = [
  { type: "youtube", label: "YouTube", domains: ["youtube.com", "youtu.be"] },
  {
    type: "bilibili",
    label: "Bilibili",
    domains: ["bilibili.com", "bilibili.tv"],
  },
  { type: "tiktok", label: "TikTok", domains: ["tiktok.com"] },
  { type: "vimeo", label: "Vimeo", domains: ["vimeo.com"] },
  { type: "twitch", label: "Twitch", domains: ["twitch.tv"] },
  { type: "netflix", label: "Netflix", domains: ["netflix.com"] },
  { type: "disney-plus", label: "Disney+", domains: ["disneyplus.com"] },
  {
    type: "prime-video",
    label: "Prime Video",
    domains: ["primevideo.com", "amazon.com"],
  },
  { type: "coursera", label: "Coursera", domains: ["coursera.org"] },
  { type: "udemy", label: "Udemy", domains: ["udemy.com"] },
  { type: "edx", label: "edX", domains: ["edx.org"] },
  { type: "khan-academy", label: "Khan Academy", domains: ["khanacademy.org"] },
  {
    type: "facebook",
    label: "Facebook Video",
    domains: ["facebook.com", "fb.watch"],
  },
  { type: "x", label: "X", domains: ["x.com", "twitter.com"] },
  { type: "reddit", label: "Reddit Video", domains: ["reddit.com", "redd.it"] },
  { type: "dailymotion", label: "Dailymotion", domains: ["dailymotion.com"] },
] as const;

/** Normalizes a browser hostname for deterministic matching and persistence. */
export function normalizeHostname(host: string): string {
  return host
    .trim()
    .toLowerCase()
    .replace(/^\.+|\.+$/g, "");
}

/** Returns true for an exact domain or one of its subdomains. */
export function isDomainOrSubdomain(host: string, domain: string): boolean {
  const normalizedHost = normalizeHostname(host);
  const normalizedDomain = normalizeHostname(domain);
  return (
    normalizedHost === normalizedDomain ||
    normalizedHost.endsWith(`.${normalizedDomain}`)
  );
}

/** Finds the built-in site definition matching a hostname, if any. */
export function getSiteDefinition(host: string): SiteDefinition | null {
  const normalized = normalizeHostname(host);
  return (
    SITE_DEFINITIONS.find((definition) =>
      definition.domains.some((domain) =>
        isDomainOrSubdomain(normalized, domain),
      ),
    ) ?? null
  );
}

/** Detects the supported platform represented by a hostname. */
export function detectSiteFromHost(host: string): SiteType {
  return getSiteDefinition(host)?.type ?? "other";
}

/** Returns the user-facing label for a built-in/fallback site identifier. */
export function getSiteLabel(site: SiteType): string {
  if (site === "other") return "Custom site";
  return (
    SITE_DEFINITIONS.find((definition) => definition.type === site)?.label ??
    site
  );
}

/**
 * Converts user input into a hostname. URL prefixes are accepted for
 * convenience, but paths, query strings, credentials and ports are rejected
 * because custom settings are intentionally domain-scoped.
 */
export function normalizeCustomDomain(input: string): string | null {
  const trimmed = input.trim().toLowerCase().replace(/^\*\./, "");
  if (trimmed.length === 0 || /\s/.test(trimmed)) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.port !== "" ||
    parsed.pathname !== "/" ||
    parsed.search !== "" ||
    parsed.hash !== ""
  ) {
    return null;
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (hostname.length === 0 || hostname.includes("..")) return null;
  return hostname;
}

/** Returns the matching custom domain, preferring the first stored entry. */
export function findCustomSite(
  host: string,
  customSites: readonly CustomSite[],
): CustomSite | null {
  const normalizedHost = normalizeHostname(host);
  return (
    customSites.find((site) =>
      isDomainOrSubdomain(normalizedHost, site.domain),
    ) ?? null
  );
}

/** Built-in platforms are always enabled; custom pages require a saved rule. */
export function isHostSupported(
  host: string,
  customSites: readonly CustomSite[],
): boolean {
  return (
    getSiteDefinition(host) !== null ||
    findCustomSite(host, customSites) !== null
  );
}
