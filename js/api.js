// Accès à Deadlock API (https://api.deadlock-api.com) avec cache mémoire et gestion des limites.
export const API = 'https://api.deadlock-api.com';

const cache = new Map();

export async function getJSON(url, ttl = 60_000) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < ttl) return hit.p;
  const p = (async () => {
    for (let attempt = 0; ; attempt++) {
      let r;
      try { r = await fetch(url, { headers: { Accept: 'application/json' } }); }
      catch { throw new Error('Impossible de joindre l’API (connexion ou blocage réseau).'); }
      if (r.ok) return r.json();
      const wait = Number(r.headers.get('Retry-After')) || 2;
      if ((r.status === 429 || r.status === 503) && attempt < 2 && wait <= 10) {
        await new Promise(res => setTimeout(res, wait * 1000));
        continue;
      }
      const msg = {
        400: 'Requête invalide.',
        403: 'Ce joueur a masqué ses données.',
        404: 'Introuvable.',
        429: 'Trop de requêtes : réessayez dans un instant.',
        504: 'L’API a mis trop de temps à répondre.',
      }[r.status] || `Erreur de l’API (${r.status}).`;
      const e = new Error(msg); e.status = r.status; throw e;
    }
  })();
  cache.set(url, { t: Date.now(), p });
  p.catch(() => cache.delete(url));
  return p;
}

export function api(path, params = {}, ttl) {
  const u = new URL(API + path);
  for (const [k, v] of Object.entries(params)) if (v !== '' && v != null) u.searchParams.set(k, v);
  return getJSON(u.toString(), ttl);
}

export const clearCache = () => cache.clear();

// Accepte un account_id (SteamID3), un SteamID64, [U:1:x] ou une URL /profiles/7656…
export function parseAccount(q) {
  q = String(q).trim();
  const m64 = q.match(/profiles\/(\d{17})/) || q.match(/^(\d{17})$/);
  if (m64) return String(BigInt(m64[1]) - 76561197960265728n);
  const m3 = q.match(/^\[?U:1:(\d+)\]?$/i);
  if (m3) return m3[1];
  return /^\d{1,10}$/.test(q) ? q : null;
}
