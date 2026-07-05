/**
 * Shared constants for Atlas Character Sync.
 */

export const MODULE_ID = "jdr-ninja-atlas-sync";

/** The only game system this module targets. */
export const REQUIRED_SYSTEM_ID = "dnd5e";

/** Minimum dnd5e system version the converter's data-model paths are validated against. */
export const MIN_SYSTEM_VERSION = "3.0.0";

/** World-scope settings keys. */
export const SETTINGS = {
  token: "token",
  apiBaseUrl: "apiBaseUrl",
  campaignId: "campaignId",
  markCreatedAsClaimable: "markCreatedAsClaimable",
};

/** Default Atlas API origin. */
export const DEFAULT_API_BASE_URL = "https://www.jdr.ninja";

/** Path of the actor flag bag that links an actor to its Atlas PC. */
export const FLAG_LINK = "link";

/**
 * Machine status codes the API returns. The module owns the localized string for each
 * (see languages/*.json `JDRNINJA_ATLAS_SYNC.status.<CODE>`); the server never localizes.
 */
export const STATUS = {
  OK: "OK",
  INVALID_TOKEN: "INVALID_TOKEN",
  TOKEN_REVOKED: "TOKEN_REVOKED",
  TIER_REQUIRED: "TIER_REQUIRED",
  CAMPAIGN_NOT_FOUND: "CAMPAIGN_NOT_FOUND",
  CHARACTER_NOT_FOUND: "CHARACTER_NOT_FOUND",
  RATE_LIMITED: "RATE_LIMITED",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  LIMIT_REACHED: "LIMIT_REACHED",
  TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
  NETWORK_ERROR: "NETWORK_ERROR",
};

/** Localizes an API status code via the module's lang files. */
export function localizeStatus(code) {
  const key = `JDRNINJA_ATLAS_SYNC.status.${code}`;
  const translated = game.i18n.localize(key);
  // Fall back to a generic message if a new server code has no string yet.
  return translated === key ? game.i18n.localize("JDRNINJA_ATLAS_SYNC.status.UNKNOWN") : translated;
}

/** Humanizes a cooldown (seconds) into a compact "23 h 5 min" style string for the retry hint. */
export function formatRetryDelay(totalSeconds) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const u = (unit) => game.i18n.localize(`JDRNINJA_ATLAS_SYNC.time.${unit}`);
  const parts = [];
  if (h > 0) parts.push(`${h} ${u("hours")}`);
  if (m > 0) parts.push(`${m} ${u("minutes")}`);
  // Under a minute (or an exact hour with no minutes left): show seconds so it is never empty.
  if (parts.length === 0) parts.push(`${s % 60} ${u("seconds")}`);
  return parts.join(" ");
}
