/**
 * Actor flag helpers. The link bag lives at flags["jdr-ninja-atlas-sync"].link and carries:
 *   { atlasCharacterId, syncedAtUtc, portraitHash }
 */

import { MODULE_ID, FLAG_LINK } from "./constants.js";

/** Returns the link bag for an actor, or null when unlinked. */
export function getLink(actor) {
  return actor?.getFlag(MODULE_ID, FLAG_LINK) ?? null;
}

export function isLinked(actor) {
  return Boolean(getLink(actor)?.atlasCharacterId);
}

/** Links an actor to an Atlas PC id (clears any stale sync metadata). */
export async function setLink(actor, atlasCharacterId) {
  return actor.setFlag(MODULE_ID, FLAG_LINK, {
    atlasCharacterId,
    syncedAtUtc: null,
    portraitHash: null,
  });
}

/** Records a successful sync (and optionally the new portrait hash). */
export async function markSynced(actor, { syncedAtUtc, portraitHash } = {}) {
  const link = getLink(actor) ?? {};
  const next = { ...link };
  if (syncedAtUtc !== undefined) next.syncedAtUtc = syncedAtUtc;
  if (portraitHash !== undefined && portraitHash !== null) next.portraitHash = portraitHash;
  return actor.setFlag(MODULE_ID, FLAG_LINK, next);
}

/** Removes the link bag entirely. */
export async function clearLink(actor) {
  return actor.unsetFlag(MODULE_ID, FLAG_LINK);
}
