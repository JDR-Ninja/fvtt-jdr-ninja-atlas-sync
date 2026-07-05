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

## Localization

The module ships the **same five languages as the jdr.ninja site: French, English, Spanish, German,
Italian** (`languages/{fr,en,es,de,it}.json`, all registered in `module.json`). This parity is a
requirement, not a convenience: **keep the module aligned on the site's supported languages.**

Rules when touching localized strings:

- **Every key must exist in all five files.** French and English are authored first (French is the
  source of truth for tone); Spanish, German and Italian mirror them key-for-key.
- **Register is formal** in every language, matching the site (vous / usted / Sie / Lei).
- **Preserve placeholders** verbatim across languages (`{name}`, `{delay}`, `{names}`, `{current}`,
  `{total}`, `{ok}`, `{failed}`, `{system}`, `{version}`, `{min}`).
- Adding a key means adding it to **all five** files in the same commit; if the site later adds or
  drops a supported language, mirror that change here.

Quick parity check (no missing/extra keys across locales):

```bash
node -e 'const fs=require("fs");const L=["fr","en","es","de","it"];const flat=(o,p="")=>Object.entries(o).flatMap(([k,v])=>v&&typeof v==="object"?flat(v,p+k+"."):[p+k]);const base=new Set(flat(require("./languages/en.json")));for(const l of L){const k=new Set(flat(require(`./languages/${l}.json`)));const miss=[...base].filter(x=>!k.has(x));const extra=[...k].filter(x=>!base.has(x));console.log(`${l}: ${k.size} keys, missing=${miss.join(",")||"none"}, extra=${extra.join(",")||"none"}`);}'
```

## Development

Requires Node.js 20+.

```bash
npm install      # install build tooling
npm run build    # bundle + minify into dist/ and produce module.zip
npm run watch    # rebuild the bundle on change (for live dev)
```

The `scripts/` sources are authored as plain ES modules and bundled into a single minified
`scripts/main.js` at build time.

### Cutting a release

```bash
npm run release patch     # 0.1.0 -> 0.1.1   (also: minor | major | x.y.z)
git add module.json && git commit -m "release: vX.Y.Z"
git tag vX.Y.Z && git push --follow-tags
```

`npm run release` bumps the version in `module.json` and rewrites its `download` URL. Pushing the
`vX.Y.Z` tag triggers the GitHub Actions workflow, which builds and publishes the release with
`module.json` + `module.zip` attached.

## License

See [LICENSE](LICENSE).
