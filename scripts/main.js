/**
 * Atlas Character Sync — entry point. Registers settings, the Actors-directory button and the actor
 * context-menu entry. System-agnostic placement: never the actor sheet.
 */

import {
  MODULE_ID,
  SETTINGS,
  DEFAULT_API_BASE_URL,
} from "./constants.js";
import { systemGuard } from "./system-guard.js";
import { AtlasSyncApp } from "./sync-app.js";
import { isLinked, getLink } from "./flags.js";
import { pushActor, createActor, notify } from "./sync.js";

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTINGS.token, {
    name: "JDRNINJA_ATLAS_SYNC.settings.token.name",
    hint: "JDRNINJA_ATLAS_SYNC.settings.token.hint",
    scope: "world",
    config: true,
    type: String,
    default: "",
  });

  game.settings.register(MODULE_ID, SETTINGS.apiBaseUrl, {
    name: "JDRNINJA_ATLAS_SYNC.settings.apiBaseUrl.name",
    hint: "JDRNINJA_ATLAS_SYNC.settings.apiBaseUrl.hint",
    scope: "world",
    config: true,
    type: String,
    default: DEFAULT_API_BASE_URL,
  });

  game.settings.register(MODULE_ID, SETTINGS.markCreatedAsClaimable, {
    name: "JDRNINJA_ATLAS_SYNC.settings.markCreatedAsClaimable.name",
    hint: "JDRNINJA_ATLAS_SYNC.settings.markCreatedAsClaimable.hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  // Managed inside the window (the chosen campaign for this Foundry world).
  game.settings.register(MODULE_ID, SETTINGS.campaignId, {
    scope: "world",
    config: false,
    type: String,
    default: "",
  });
});

// ── Actors-directory button ───────────────────────────────────────────────────

Hooks.on("renderActorDirectory", (app, html) => {
  if (!game.user.isGM) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;

  // Avoid duplicates on re-render.
  if (root.querySelector(".jdr-atlas-sync-open")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "jdr-atlas-sync-open";
  button.innerHTML = `<i class="fa-solid fa-globe"></i> ${game.i18n.localize("JDRNINJA_ATLAS_SYNC.app.openButton")}`;
  button.addEventListener("click", () => AtlasSyncApp.open());

  const guard = systemGuard();
  if (!guard.ok) {
    button.disabled = true;
    button.title = game.i18n.localize("JDRNINJA_ATLAS_SYNC.guard.disabledHint");
  }

  // V13+ sidebar: a header action area; fall back to the directory header / footer.
  const header = root.querySelector(".header-actions") || root.querySelector(".directory-header");
  const footer = root.querySelector(".directory-footer");
  if (header) header.appendChild(button);
  else if (footer) footer.prepend(button);
  else root.prepend(button);
});

// ── Actor context-menu entry ──────────────────────────────────────────────────

function actorFromContextLi(li) {
  const el = li instanceof HTMLElement ? li : li?.[0];
  const id = el?.dataset?.entryId ?? el?.dataset?.documentId;
  return id ? game.actors.get(id) : null;
}

function registerContextOption(menuItems) {
  menuItems.push({
    name: "JDRNINJA_ATLAS_SYNC.context.sync",
    icon: '<i class="fa-solid fa-globe"></i>',
    condition: (li) => {
      if (!game.user.isGM || !systemGuard().ok) return false;
      const actor = actorFromContextLi(li);
      return actor?.type === "character";
    },
    callback: async (li) => {
      const actor = actorFromContextLi(li);
      if (!actor) return;

      if (isLinked(actor) && getLink(actor)?.atlasCharacterId) {
        const result = await pushActor(actor);
        notify(result);
        return;
      }

      const campaignId = game.settings.get(MODULE_ID, SETTINGS.campaignId) ?? "";
      if (!campaignId) {
        ui.notifications.warn(game.i18n.localize("JDRNINJA_ATLAS_SYNC.notify.pickCampaign"));
        return;
      }
      const markClaimable = game.settings.get(MODULE_ID, SETTINGS.markCreatedAsClaimable) ?? false;
      const result = await createActor(actor, campaignId, markClaimable);
      notify(result, "JDRNINJA_ATLAS_SYNC.notify.created");
    },
  });
}

// V13+ uses getActorContextOptions; older cores used getActorDirectoryEntryContext. Only one fires
// per core version, so registering both is safe (no duplicate menu entry).
Hooks.on("getActorContextOptions", (app, menuItems) => registerContextOption(menuItems));
Hooks.on("getActorDirectoryEntryContext", (html, menuItems) => registerContextOption(menuItems));
