/**
 * The actor-centric management window (V14 ApplicationV2 + Handlebars). Lists the world's `character`
 * actors with their Atlas link state, a campaign selector, batch sync and the « Créer comme libre »
 * toggle. System-agnostic: it never touches the actor sheet.
 */

import { MODULE_ID, SETTINGS, STATUS, localizeStatus } from "./constants.js";
import { AtlasApi } from "./api.js";
import { getLink, isLinked, setLink, clearLink } from "./flags.js";
import { pushActor, createActor, notify } from "./sync.js";
import { systemGuard, guardMessage } from "./system-guard.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class AtlasSyncApp extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {AtlasSyncApp|null} singleton so the directory button toggles one window. */
  static _instance = null;

  static DEFAULT_OPTIONS = {
    id: "atlas-character-sync",
    classes: ["jdr-ninja-atlas-sync"],
    tag: "div",
    window: {
      title: "JDRNINJA_ATLAS_SYNC.app.title",
      icon: "fa-solid fa-globe",
      resizable: true,
    },
    position: { width: 760, height: 680 },
    actions: {
      refresh: AtlasSyncApp.prototype._onRefresh,
      sync: AtlasSyncApp.prototype._onSync,
      unlink: AtlasSyncApp.prototype._onUnlink,
      create: AtlasSyncApp.prototype._onCreate,
      link: AtlasSyncApp.prototype._onLink,
      syncAll: AtlasSyncApp.prototype._onSyncAll,
    },
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/sync-app.hbs` },
  };

  /** Loaded API state. */
  _data = { loading: true, whoami: null, campaigns: [], error: null };

  static open() {
    if (!AtlasSyncApp._instance) AtlasSyncApp._instance = new AtlasSyncApp();
    const app = AtlasSyncApp._instance;
    app.render(true);
    app.loadData();
    return app;
  }

  /** Pulls /whoami + /campaigns, then re-renders. */
  async loadData() {
    this._data.loading = true;
    this._data.error = null;

    if (!AtlasApi.hasToken()) {
      this._data = { loading: false, whoami: null, campaigns: [], error: STATUS.INVALID_TOKEN };
      return this.render();
    }

    const who = await AtlasApi.whoami();
    if (!who.ok) {
      this._data = { loading: false, whoami: null, campaigns: [], error: who.status };
      return this.render();
    }

    const campaigns = await AtlasApi.campaigns();
    this._data = {
      loading: false,
      whoami: who.body,
      campaigns: campaigns.ok ? campaigns.body.items ?? [] : [],
      error: campaigns.ok ? null : campaigns.status,
    };
    this.render();
  }

  get selectedCampaignId() {
    return game.settings.get(MODULE_ID, SETTINGS.campaignId) ?? "";
  }

  async _prepareContext() {
    const guard = systemGuard();
    const data = this._data;
    const selected = this.selectedCampaignId;

    const characters = game.actors.filter((a) => a.type === "character");
    const rows = characters.map((actor) => {
      const link = getLink(actor);
      const linked = Boolean(link?.atlasCharacterId);
      return {
        actorId: actor.id,
        name: actor.name,
        img: actor.img,
        linked,
        atlasId: link?.atlasCharacterId ?? null,
        syncedLabel: link?.syncedAtUtc
          ? new Date(link.syncedAtUtc).toLocaleString()
          : null,
      };
    });

    return {
      guard,
      guardMessage: guard.ok ? null : guardMessage(guard),
      loading: data.loading,
      error: data.error ? localizeStatus(data.error) : null,
      connected: Boolean(data.whoami),
      worldName: data.whoami?.world?.name ?? "",
      tierAllowed: data.whoami?.tier?.allowed ?? false,
      systemLabel: `${game.system.title ?? game.system.id} · v${game.system.version}`,
      campaigns: data.campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        count: c.characterCount,
        selected: c.id === selected,
      })),
      hasCampaign: Boolean(selected),
      markClaimable: game.settings.get(MODULE_ID, SETTINGS.markCreatedAsClaimable) ?? false,
      rows,
      canWrite: guard.ok && Boolean(data.whoami) && (data.whoami?.tier?.allowed ?? false),
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const root = this.element;

    // Campaign selector persists to the world-scope setting, then refreshes the listing.
    const select = root.querySelector("[data-control='campaign']");
    if (select) {
      select.addEventListener("change", async (ev) => {
        await game.settings.set(MODULE_ID, SETTINGS.campaignId, ev.target.value);
        this.render();
      });
    }

    // « Créer comme libre » toggle bound to the setting.
    const claimable = root.querySelector("[data-control='claimable']");
    if (claimable) {
      claimable.addEventListener("change", async (ev) => {
        await game.settings.set(MODULE_ID, SETTINGS.markCreatedAsClaimable, ev.target.checked);
      });
    }
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  _actorFromTarget(target) {
    const id = target.closest("[data-actor-id]")?.dataset.actorId;
    return id ? game.actors.get(id) : null;
  }

  async _onRefresh() {
    await this.loadData();
  }

  async _onSync(event, target) {
    const actor = this._actorFromTarget(target);
    if (!actor) return;
    const result = await pushActor(actor);
    notify(result);
    this.render();
  }

  async _onUnlink(event, target) {
    const actor = this._actorFromTarget(target);
    if (!actor) return;
    await clearLink(actor);
    ui.notifications.info(game.i18n.localize("JDRNINJA_ATLAS_SYNC.notify.unlinked"));
    this.render();
  }

  async _onCreate(event, target) {
    const actor = this._actorFromTarget(target);
    if (!actor) return;
    const campaignId = this.selectedCampaignId;
    if (!campaignId) {
      ui.notifications.warn(game.i18n.localize("JDRNINJA_ATLAS_SYNC.notify.pickCampaign"));
      return;
    }
    const markClaimable = game.settings.get(MODULE_ID, SETTINGS.markCreatedAsClaimable) ?? false;
    const result = await createActor(actor, campaignId, markClaimable);
    notify(result, "JDRNINJA_ATLAS_SYNC.notify.created");
    this.render();
  }

  async _onLink(event, target) {
    const actor = this._actorFromTarget(target);
    if (!actor) return;
    const campaignId = this.selectedCampaignId;
    if (!campaignId) {
      ui.notifications.warn(game.i18n.localize("JDRNINJA_ATLAS_SYNC.notify.pickCampaign"));
      return;
    }

    const list = await AtlasApi.characters(campaignId, { pageSize: 200 });
    if (!list.ok) {
      ui.notifications.warn(localizeStatus(list.status));
      return;
    }
    const items = list.body.items ?? [];
    if (items.length === 0) {
      ui.notifications.info(game.i18n.localize("JDRNINJA_ATLAS_SYNC.notify.noCharacters"));
      return;
    }

    const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const options = items
      .map((i) => `<option value="${esc(i.id)}">${esc(i.name)}</option>`)
      .join("");
    const chosen = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("JDRNINJA_ATLAS_SYNC.dialog.linkTitle") },
      content: `<div class="form-group"><label>${game.i18n.localize("JDRNINJA_ATLAS_SYNC.dialog.linkLabel")}</label>
        <select name="pc" style="width:100%">${options}</select></div>`,
      ok: {
        label: game.i18n.localize("JDRNINJA_ATLAS_SYNC.dialog.linkConfirm"),
        callback: (ev, button) => button.form.elements.pc.value,
      },
      rejectClose: false,
    });
    if (!chosen) return;

    await setLink(actor, chosen);
    ui.notifications.info(game.i18n.localize("JDRNINJA_ATLAS_SYNC.notify.linked"));
    this.render();
  }

  async _onSyncAll() {
    const linkedActors = game.actors.filter((a) => a.type === "character" && isLinked(a));
    if (linkedActors.length === 0) {
      ui.notifications.info(game.i18n.localize("JDRNINJA_ATLAS_SYNC.notify.nothingLinked"));
      return;
    }

    let ok = 0;
    let failed = 0;
    for (const actor of linkedActors) {
      const result = await pushActor(actor);
      if (result.ok) ok += 1;
      else failed += 1;
    }
    ui.notifications.info(
      game.i18n.format("JDRNINJA_ATLAS_SYNC.notify.batchDone", { ok, failed })
    );
    this.render();
  }
}
