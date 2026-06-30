/**
 * Projects a live dnd5e actor to the locked Atlas RpgDataJson schema, and prepares the optional
 * portrait payload. Because our schema is a Foundry subset, most fields copy straight through; the
 * Atlas server re-validates through its registry as a safety net.
 */

import { MODULE_ID } from "./constants.js";

const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"];

function toArray(value) {
  if (!value) return [];
  if (value instanceof Set) return Array.from(value);
  if (Array.isArray(value)) return value;
  // dnd5e sometimes stores trait values as { value: Set, custom: string }
  if (typeof value === "object" && "value" in value) return toArray(value.value);
  return [];
}

function codeBag(trait) {
  return {
    value: toArray(trait?.value),
    custom: typeof trait?.custom === "string" ? trait.custom : "",
  };
}

function resolveClasses(actor) {
  const classes = actor.itemTypes?.class ?? [];
  const subclasses = actor.itemTypes?.subclass ?? [];
  return classes.map((cls) => {
    const identifier = cls.system?.identifier;
    const sub = subclasses.find((s) => s.system?.classIdentifier === identifier);
    return {
      name: cls.name,
      subClass: sub?.name ?? "",
      level: Number(cls.system?.levels ?? 0) || 0,
    };
  });
}

function resolveSpecies(actor) {
  const race = actor.itemTypes?.race?.[0];
  if (race?.name) return race.name;
  const detail = actor.system?.details?.race;
  if (typeof detail === "string") return detail;
  if (detail?.name) return detail.name;
  return "";
}

function resolveAbilities(actor) {
  const out = {};
  const abilities = actor.system?.abilities ?? {};
  for (const key of ABILITY_KEYS) {
    const ab = abilities[key];
    if (!ab) continue;
    out[key] = {
      value: Number(ab.value ?? 10) || 10,
      proficient: ab.proficient ? 1 : 0,
    };
  }
  return out;
}

function resolveSkills(actor) {
  const out = {};
  const skills = actor.system?.skills ?? {};
  for (const [code, skill] of Object.entries(skills)) {
    const value = Number(skill?.value ?? 0) || 0;
    if (value > 0) out[code] = value; // 1 = proficiency, 2 = expertise
  }
  return out;
}

function resolveSenses(actor) {
  const s = actor.system?.attributes?.senses ?? {};
  return {
    darkvision: Number(s.darkvision ?? 0) || 0,
    blindsight: Number(s.blindsight ?? 0) || 0,
    tremorsense: Number(s.tremorsense ?? 0) || 0,
    truesight: Number(s.truesight ?? 0) || 0,
    special: typeof s.special === "string" ? s.special : "",
  };
}

/** Builds the flat sheet object (the locked schema keys, codes verbatim). */
export function buildSheet(actor) {
  const sys = actor.system ?? {};
  const ac = sys.attributes?.ac ?? {};
  const hp = sys.attributes?.hp ?? {};
  const traits = sys.traits ?? {};

  return {
    classes: resolveClasses(actor),
    species: resolveSpecies(actor),
    ca: Number(ac.value ?? 10) || 10,
    hp: Number(hp.max ?? hp.value ?? 0) || 0,
    size: typeof traits.size === "string" ? traits.size : "med",
    abilities: resolveAbilities(actor),
    skills: resolveSkills(actor),
    senses: resolveSenses(actor),
    languages: codeBag(traits.languages),
    weapons: codeBag(traits.weaponProf),
    armor: codeBag(traits.armorProf),
  };
}

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
 * Builds the full request body for a push/create. Includes portrait* fields ONLY when the portrait
 * changed vs `previousPortraitHash` (module-side dedup, layer 1).
 */
export async function buildPayload(actor, { previousPortraitHash = null } = {}) {
  const payload = {
    sourceSystemVersion: game.system.version,
    rpgData: buildSheet(actor),
  };

  const portrait = await buildPortrait(actor);
  if (portrait && portrait.hash !== previousPortraitHash) {
    payload.portraitHash = portrait.hash;
    payload.portraitMime = portrait.mime;
    payload.portraitBase64 = portrait.base64;
  }

  return payload;
}
