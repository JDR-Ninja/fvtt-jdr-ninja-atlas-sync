# Atlas Character Sync (Foundry VTT module)

Push your player-character actors into [JDR Ninja Atlas](https://www.jdr.ninja) player characters
with one click. One-way (Foundry → Atlas), world-scoped, tier-gated, rate-limited. Supported game
systems are listed under [System support](#system-support) (dnd5e, tor2e, pf2e, sf2e, wfrp4e).

## Installation

In Foundry, **Add-on Modules → Install Module**, paste this manifest URL and click **Install**:

```
https://github.com/JDR-Ninja/jdr-ninja-atlas-sync/releases/latest/download/module.json
```

The module installs on any game system, but only works with a supported one: on any other system
the UI is disabled and no request is ever sent.

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

| Foundry system id | Minimum version | Atlas slug (`systemSlug`) |
|---|---|---|
| `dnd5e` | 3.0.0 | `dnd5e-compatible` |
| `tor2e` | 6.0.0 | `tor2e-compatible` |
| `pf2e` | 7.5.0 | `pf2e-compatible` |
| `sf2e` | 1.0.0 | `sf2e-compatible` |
| `wfrp4e` | 9.0.0 | `wfrp4e-compatible` |

The module is system-agnostic at install (no `relationships.systems` in the manifest) and
table-driven at runtime: `SUPPORTED_SYSTEMS` in `scripts/constants.js` is the single list above.
The guard (`scripts/system-guard.js`) disables the UI when `game.system.id` is not in the table or
its version is below the entry's minimum; the converter dispatch (`scripts/converters/index.js`)
picks `scripts/converters/<systemId>.js` for the sheet projection; and the payload names the
system (see [API contract](#api-contract)). Supporting another system means one table entry plus
one converter file, with no manifest change, once Atlas has the matching RPG module.

### The One Ring 2e (`tor2e`)

Minimum version **6.0.0**, the first release of the community system built on Foundry data models
(`modules/models/actors/character.model.mjs`); the converter (`scripts/converters/tor2e.js`) reads
the prepared `character` actor and nothing from `CONFIG` or the world settings.

Synced: culture, calling, standard of living, cultural blessing, shadow path, fellowship focus, age;
Strength, Heart and Wits; Valour and Wisdom; the Endurance and Hope **maximums**; Parry as the
number an adversary must beat (the entered base plus the equipped shield's protection); Protection
as the dice of the equipped body armour (mail or leather) plus the equipped headgear; the eighteen
common skills with their rank and favoured mark; the four combat proficiencies (Axes, Swords,
Spears, Bows); distinctive features, virtues and rewards by name.

Not synced: live play state (current Endurance and Hope, Shadow points, scars, Fatigue, Weary /
Wounded / Poisoned / Miserable, Adventure, Skill, Fellowship and Reputation points, Treasure),
equipment beyond the two figures above, journey logs, narrative history, custom skills, standings,
flaws, Brawling (a runtime derivation, never stored) and Active-Effect bonuses. The Target Number of
an attribute is derived on the Atlas side as 20 minus the rating; the world's `tnBaseValue` setting
is not sent.

Clamped rather than refused, so one homebrew number never blocks the whole sheet: attributes to
0..10, Valour, Wisdom, skill and proficiency ranks to 0..6, Endurance and Hope to 0..99, Parry to
0..40, Protection to 0..15, age to 0..99999; free text to 60 characters, names to 40, at most 6
distinctive features, 8 virtues and 8 rewards (first ones in actor order, duplicates dropped). A
calling or standard of living outside the six system keys (an old free-text world) is sent empty.

### Pathfinder Second Edition (`pf2e`)

`scripts/converters/pf2e.js` reads the prepared actor (never `_source`) and stores ranks, never
modifiers: level (clamped 1..20, a level 0 pregen syncs as 1), key attribute, class / ancestry /
heritage / background names, size, the six remaster attribute modifiers, max HP, AC, the speeds
from `system.movement.speeds` (land always, the others when positive), the primary class DC (null
without a class), the perception rank, the three save ranks, every trained-or-better skill of
`CONFIG.PF2E.skills` keyed by full slug, the lore items (name + rank, first 6), the four weapon
and four armor proficiency ranks (`weapon-group-*`, `weapon-base-*` and barding keys are dropped),
the senses (type, acuity when not precise, range when not unlimited, first 8) and the languages
(slugs verbatim, first 24, `details` as free text). Nothing live is read: hero points, current
HP, conditions, XP. The minimum 7.5.0 is the release that moved speeds to `system.movement.speeds`,
the last data-path change the converter depends on.

### Starfinder Second Edition (`sf2e`)

The same converter: `sf2e` is a fork of the `pf2e` system with the same actor shape, so the only
differences flow through at runtime. `CONFIG.PF2E.skills` carries `computers` and `piloting`, which
sync like any other skill; the languages are the Pact Worlds slugs (`common` and `pact-common`
both pass through when the actor holds both); the Operative's `simple-guns` proficiency is an extra
attack key and is dropped like the pf2e group keys. Atlas validates the sheet under
`sf2e-compatible`, whose skill set has the two extra slugs. The minimum 1.0.0 is the first V14
release, the earliest the module can be installed on.

### Warhammer Fantasy Roleplay 4e (`wfrp4e`)

`scripts/converters/wfrp4e.js` reads the prepared `character` actor and syncs: species and
subspecies (resolved to their labels through `game.wfrp4e.config.species` / `.subspecies` when the
sheet stored a key, free text otherwise), the current career's class, career group, level title
and level (1 to 5), the status (tier and standing, as computed from that career; none without a
current career), the size, the movement, the ten characteristics (current values, as displayed),
the maximum wounds, fate and resilience, the trained skills (advances above 0; same-name items
merged; basic skills first, then advanced and grouped ones, each by name) and the talents
(duplicates summed, as the sheet does). Not synced: current wounds, fortune, resolve, advantage,
corruption, experience and every other live value; trappings, weapons, armour, spells, prayers,
mutations, conditions and effects; the biography and the other narrative fields.

Atlas stores at most 40 skills and 30 talents per character, with names cut to 60 characters. A
character over either cap keeps the entries with the most advances and the console shows a warning
naming how many were dropped. Advances typed with a decimal (the system's field accepts 2.5) are
truncated to the integer the server stores, item by item before same-name items are summed; names
are merged the way the server checks uniqueness (trimmed, case-insensitive). The size and status
tier are checked against the server's fixed code sets, not against the world's `actorSizes` /
`statusTiers` tables (a table extended by another module would pass a code Atlas refuses).
Minimum system version 9.0.0.

## API contract

Every write is a `POST` to `api/foundry-sync/v1` with `Authorization: Bearer publicId.secret`
(push: `/characters/{atlasCharacterId}`; create: `/campaigns/{campaignId}/characters`). Body fields:

| Field | Meaning |
|---|---|
| `contractVersion` | always `1`. |
| `systemSlug` | the Atlas RPG module the sheet targets, from the table above (`dnd5e-compatible`, `tor2e-compatible`, `pf2e-compatible`, `sf2e-compatible`, `wfrp4e-compatible`). |
| `sourceSystemId` | the Foundry `game.system.id` the actor was read from (`dnd5e`, `tor2e`, `pf2e`, `sf2e`, `wfrp4e`). |
| `sourceSystemVersion` | `game.system.version`, informational. |
| `rpgData` | the flat sheet built by the system's converter, validated again on the server. |
| `portraitHash` / `portraitMime` / `portraitBase64` | present only when the portrait changed (see [Portrait sync](#portrait-sync)). |
| `name` / `markClaimable` | create only. |

The server resolves the module from `systemSlug` (a body without it is treated as
`dnd5e-compatible`, which keeps builds older than 0.2.0 working) and answers `VALIDATION_FAILED`
with an error `{ code: "SYSTEM_MISMATCH", path: "systemSlug" }` when the slug is unknown, when the
module has no Foundry counterpart, or when `sourceSystemId` is not the system that module accepts.
Responses carry `contractVersion`, a machine `status` code the module localizes, and on a
validation failure an `errors: [{ code, path }]` list.

The module owns one string per `status` (`JDRNINJA_ATLAS_SYNC.status.<STATUS>`) and, for a
`VALIDATION_FAILED` response, reads the first error's `code` to show a more specific one
(`JDRNINJA_ATLAS_SYNC.error.<CODE>`) for the three causes a GM can act on:

| `errors[0].code` | `path` | Meaning | Shown |
|---|---|---|---|
| `SYSTEM_MISMATCH` | `systemSlug` | the world's game system is not one Atlas accepts for this sheet (see above) | « Atlas n'accepte pas le système de jeu de ce monde pour cette fiche. Vérifiez que le module est à jour. » |
| `TOO_LARGE` | `rpgData` | the canonical sheet exceeds the server's storage cap | « La fiche est trop volumineuse pour Atlas. Réduisez le nombre d'entrées (compétences, talents, listes), puis réessayez. » |
| `MALFORMED_BODY` | `rpgData` | `rpgData` is not a JSON object (a broken build) | « Atlas n'a pas pu lire la fiche envoyée. Mettez le module à jour, puis réessayez. » |

Any other code (`REQUIRED`, `VALIDATION_FAILED`, a code added server-side later), a missing
`errors` list or a code on another status falls back to the generic `status.VALIDATION_FAILED`
string (« La fiche n'a pas pu être validée par Atlas. »). Rate limits keep their own message with
the cooldown (`status.RATE_LIMITED_RETRY`).

## Localization

The module ships the **same five languages as the jdr.ninja site: French, English, Spanish, German,
Italian** (`languages/{fr,en,es,de,it}.json`, all registered in `module.json`). This parity is a
requirement, not a convenience: **keep the module aligned on the site's supported languages.**

Rules when touching localized strings:

- **Every key must exist in all five files.** French and English are authored first (French is the
  source of truth for tone); Spanish, German and Italian mirror them key-for-key.
- **Register is formal** in every language, matching the site (vous / usted / Sie / Lei).
- **Preserve placeholders** verbatim across languages (`{name}`, `{delay}`, `{names}`, `{current}`,
  `{total}`, `{ok}`, `{failed}`, `{system}`, `{version}`, `{min}`, `{supported}`). The guard
  strings never name a system: `{supported}` is built from `SUPPORTED_SYSTEMS` at runtime, so
  adding a system needs no string edit.
- Adding a key means adding it to **all five** files in the same commit; if the site later adds or
  drops a supported language, mirror that change here. `npm test` fails on a key set that differs
  between two files, on a `STATUS` / `VALIDATION_ERROR` code without its string, on an em-dash, and
  on tutoiement in the French file.

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
`scripts/main.js` at build time. `node --check scripts/*.js scripts/converters/*.js` catches syntax
errors and the build catches unresolved imports. `npm test` runs every `node --test` suite under
`scripts/converters/__tests__/`, pure Node with no Foundry: one per converter against a stub
prepared actor (`tor2e`, `pf2e` for pf2e + sf2e with a stub `CONFIG.PF2E` / `game`, `wfrp4e` with
a stub `game.wfrp4e.config`, `dnd5e`), plus `guard`, which drives the system guard and
`buildPayload` for every entry of `SUPPORTED_SYSTEMS` with a stub `game` /
`foundry.utils.isNewerVersion`, checks the five language files for identical key sets and the
result messages against the real strings. A single suite runs on its own:

```bash
npm test                                                   # every suite
node --test scripts/converters/__tests__/wfrp4e.test.mjs   # one converter
```

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
