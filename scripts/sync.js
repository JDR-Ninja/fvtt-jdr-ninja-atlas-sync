/**
 * Orchestration: glue the converter, the HTTP client and the actor flags together for the two write
 * paths (push an already-linked actor, create-on-sync an unlinked one). Each function returns the API
 * result envelope ({ ok, status, body }) and writes the flags back on success.
 */

import { STATUS, localizeStatus, formatRetryDelay } from "./constants.js";
import { AtlasApi } from "./api.js";
import { buildPayload } from "./converter.js";
import { getLink, setLink, markSynced } from "./flags.js";

/** Pushes a linked actor's sheet (+ portrait if changed) into its Atlas PC. */
export async function pushActor(actor) {
  const link = getLink(actor);
  if (!link?.atlasCharacterId) {
    return { ok: false, status: STATUS.CHARACTER_NOT_FOUND, body: {} };
  }

  const payload = await buildPayload(actor, { previousPortraitHash: link.portraitHash });
  const result = await AtlasApi.push(link.atlasCharacterId, payload);

  if (result.ok) {
    await markSynced(actor, {
      syncedAtUtc: result.body.syncedAtUtc ?? new Date().toISOString(),
      // Only persist the new hash when the server actually updated the portrait.
      portraitHash: result.body.portrait === "updated" ? payload.portraitHash : undefined,
    });
  }
  return result;
}

/** Creates a new Atlas PC from an unlinked actor, then links the actor to it. */
export async function createActor(actor, campaignId, markCreatedAsClaimable) {
  const payload = await buildPayload(actor, { previousPortraitHash: null });
  payload.name = actor.name;
  payload.markClaimable = Boolean(markCreatedAsClaimable);

  const result = await AtlasApi.create(campaignId, payload);

  if (result.ok && result.body.id) {
    await setLink(actor, result.body.id);
    await markSynced(actor, {
      syncedAtUtc: result.body.syncedAtUtc ?? new Date().toISOString(),
      portraitHash: result.body.portrait === "updated" ? payload.portraitHash : undefined,
    });
  }
  return result;
}

/** Surfaces an API result to the user as a localized notification. */
/** The localized, user-facing message for a failed API result (rate-limit-aware). */
export function resultMessage(result) {
  // Rate limited: the server tells us the cooldown remaining, so say when to retry.
  if (result.status === STATUS.RATE_LIMITED && result.body?.retryAfterSeconds > 0) {
    return game.i18n.format("JDRNINJA_ATLAS_SYNC.status.RATE_LIMITED_RETRY", {
      delay: formatRetryDelay(result.body.retryAfterSeconds),
    });
  }
  return localizeStatus(result.status);
}

export function notify(result, successKey = "JDRNINJA_ATLAS_SYNC.notify.synced") {
  if (result.ok) {
    ui.notifications.info(game.i18n.localize(successKey));
    return;
  }
  ui.notifications.warn(resultMessage(result));
}
