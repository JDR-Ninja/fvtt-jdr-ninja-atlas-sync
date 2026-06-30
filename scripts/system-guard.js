/**
 * Gates the whole sync UI on the active game system. Off-system or too-old → the window/context-menu
 * show a disabled state and no API call is ever made.
 */

import { REQUIRED_SYSTEM_ID, MIN_SYSTEM_VERSION } from "./constants.js";

export function systemGuard() {
  const id = game.system.id;
  const version = game.system.version;

  if (id !== REQUIRED_SYSTEM_ID) {
    return { ok: false, reason: "system", id, version };
  }
  if (foundry.utils.isNewerVersion(MIN_SYSTEM_VERSION, version)) {
    return { ok: false, reason: "version", id, version };
  }
  return { ok: true, id, version };
}

/** Localized one-line reason the guard failed (for the window banner). */
export function guardMessage(guard) {
  if (guard.ok) return "";
  if (guard.reason === "system") {
    return game.i18n.format("JDRNINJA_ATLAS_SYNC.guard.wrongSystem", { system: guard.id });
  }
  return game.i18n.format("JDRNINJA_ATLAS_SYNC.guard.tooOld", { min: MIN_SYSTEM_VERSION, version: guard.version });
}
