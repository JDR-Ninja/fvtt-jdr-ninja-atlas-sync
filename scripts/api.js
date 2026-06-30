/**
 * Thin HTTP client for the Atlas Foundry-sync API. Every call returns
 *   { ok: boolean, status: string, http: number, body: object }
 * where `status` is the machine code from the body (or NETWORK_ERROR on a transport failure).
 */

import { MODULE_ID, SETTINGS, DEFAULT_API_BASE_URL, STATUS } from "./constants.js";

function token() {
  return (game.settings.get(MODULE_ID, SETTINGS.token) ?? "").trim();
}

function baseUrl() {
  const raw = (game.settings.get(MODULE_ID, SETTINGS.apiBaseUrl) ?? DEFAULT_API_BASE_URL).trim();
  return raw.replace(/\/+$/, "");
}

async function request(method, path, body) {
  const url = `${baseUrl()}/api/foundry-sync/v1${path}`;
  const headers = { Authorization: `Bearer ${token()}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    console.error(`${MODULE_ID} | network error`, err);
    return { ok: false, status: STATUS.NETWORK_ERROR, http: 0, body: {} };
  }

  let payload = {};
  try {
    payload = await res.json();
  } catch (_e) {
    // Non-JSON response (e.g. a proxy 502).
  }

  const status = payload?.status ?? (res.ok ? STATUS.OK : STATUS.NETWORK_ERROR);
  return { ok: res.ok && status === STATUS.OK, status, http: res.status, body: payload };
}

export const AtlasApi = {
  hasToken() {
    return token().length > 0;
  },

  whoami() {
    return request("GET", "/whoami");
  },

  campaigns() {
    return request("GET", "/campaigns");
  },

  characters(campaignId, { q = "", page = 1, pageSize = 50 } = {}) {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (q) params.set("q", q);
    return request("GET", `/campaigns/${campaignId}/characters?${params.toString()}`);
  },

  /** Push into an existing linked PC. `payload` is the body built by the converter. */
  push(atlasCharacterId, payload) {
    return request("POST", `/characters/${atlasCharacterId}`, { contractVersion: 1, ...payload });
  },

  /** Create-on-sync from an unlinked actor. */
  create(campaignId, payload) {
    return request("POST", `/campaigns/${campaignId}/characters`, { contractVersion: 1, ...payload });
  },
};
