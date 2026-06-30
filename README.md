# Atlas Character Sync (Foundry VTT module)

Push your **dnd5e** actors into [JDR Ninja Atlas](https://www.jdr.ninja) player characters with one
click. One-way (Foundry → Atlas), world-scoped, tier-gated, rate-limited.

## Installation

In Foundry, **Add-on Modules → Install Module**, paste this manifest URL and click **Install**:

```
https://github.com/JDR-Ninja/jdr-ninja-atlas-sync/releases/latest/download/module.json
```

The module installs on any game system, but only works with **dnd5e**: off-system the UI is disabled
and no request is ever sent.

## How it works

1. The world owner opens **Atlas → monde → Paramètres → Synchronisation Foundry** and mints a token
   (shown once, in the form `publicId.secret`).
2. A GM pastes it into the module settings (**Configure Settings → Atlas Character Sync → Sync token**,
   world scope).
3. From the **Actors directory**, the GM opens the **Atlas** window, picks the campaign mapped to this
   Foundry world, then per actor **links / creates / syncs**. A right-click **context-menu** entry
   (« Synchroniser vers Atlas ») syncs a single actor without opening the window.

## Settings (world scope)

- **Sync token** — the `publicId.secret` token from Atlas.
- **Atlas API base URL** — defaults to `https://www.jdr.ninja`.
- **Create characters as "free"** — sync-created PCs are marked claimable.

## Portrait sync

`actor.img` (the character art, not the token texture) is synced. The module skips the upload when the
source bytes are unchanged since the last sync, and all resizing/optimization happens on the Atlas
side. Subject to the world owner's upload permission; if it is off, the sheet still syncs without the
portrait.

## System support

The module is system-agnostic by design while only dnd5e is supported. At runtime a guard checks
`game.system.id === "dnd5e"` and a minimum system version; everywhere else the UI shows a disabled
state. Supporting another system later means adding a converter and widening the guard, with no
manifest change.

## License

See [LICENSE](LICENSE).
