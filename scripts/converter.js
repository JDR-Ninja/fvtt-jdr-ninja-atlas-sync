/**
 * Shared, system-agnostic half of the conversion: the optional portrait payload and the full request
 * body. The per-system sheet projection lives in scripts/converters/<systemId>.js and is dispatched by
 * scripts/converters/index.js on `game.system.id`; `buildSheet` is re-exported from here so callers
 * keep one import surface.
 */

import { MODULE_ID, SUPPORTED_SYSTEMS } from "./constants.js";
import { buildSheet } from "./converters/index.js";

export { buildSheet };

const RASTER_MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Reads actor.img and returns { hash, mime, base64 } for a raster portrait, or null when there is no
 * usable image (missing, a video/svg/data url, or a fetch failure). The caller decides whether the
 * hash changed vs the actor flag before including it.
 */
export async function buildPortrait(actor) {
  const img = actor.img;
  if (!img || img.startsWith("data:") || img.startsWith("icons/svg/")) return null;

  const ext = img.split("?")[0].split(".").pop()?.toLowerCase();
  const mime = RASTER_MIME[ext];
  if (!mime) return null; // not a raster image we can process

  try {
    const res = await fetch(img);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength === 0) return null;
    const hash = await sha256Hex(buffer);
    return { hash, mime, base64: arrayBufferToBase64(buffer) };
  } catch (err) {
    console.warn(`${MODULE_ID} | could not read portrait for ${actor.name}`, err);
    return null;
  }
}

/**
 * Builds the full request body for a push/create. The body names its system twice: `systemSlug` is
 * the Atlas RPG module the sheet targets (from SUPPORTED_SYSTEMS) and `sourceSystemId` the Foundry
 * `game.system.id` it was read from; the server rejects a pair that does not match its registry
 * (VALIDATION_FAILED / SYSTEM_MISMATCH). Includes portrait* fields ONLY when the portrait changed vs
 * `previousPortraitHash` (module-side dedup, layer 1).
 */
export async function buildPayload(actor, { previousPortraitHash = null } = {}) {
  const systemId = game.system.id;
  const system = SUPPORTED_SYSTEMS[systemId];
  if (!system) {
    // Unreachable behind the runtime guard; a clear error beats a TypeError on `.atlasSlug`.
    throw new Error(`${MODULE_ID} | unsupported game system "${systemId}"`);
  }

  const payload = {
    systemSlug: system.atlasSlug,
    sourceSystemId: systemId,
    sourceSystemVersion: game.system.version,
    rpgData: buildSheet(actor, systemId),
  };

  const portrait = await buildPortrait(actor);
  if (portrait && portrait.hash !== previousPortraitHash) {
    payload.portraitHash = portrait.hash;
    payload.portraitMime = portrait.mime;
    payload.portraitBase64 = portrait.base64;
  }

  return payload;
}
