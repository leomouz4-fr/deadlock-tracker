// Héros, items et rangs depuis /v1/assets (images hébergées sur assets-bucket.deadlock-api.com).
// Pour utiliser vos propres images plus tard : remplissez LOCAL_IMAGES, ex. { heroes: { 1: 'img/heroes/infernus.webp' } }.
import { API, getJSON } from './api.js';

export const LOCAL_IMAGES = { heroes: {}, items: {}, ranks: {} };

export const heroes = new Map();
export const items = new Map();
export const ranks = new Map();

const VERSION = 'v1';
const TTL = 12 * 3600_000;

function readCache(key) {
  try {
    const c = JSON.parse(localStorage.getItem(key));
    return c && Date.now() - c.t < TTL && c.d?.length ? c.d : null;
  } catch { return null; }
}
function writeCache(key, d) {
  try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), d })); } catch { /* stockage indisponible */ }
}

async function load(name, path, slim) {
  const key = `dlt:${VERSION}:${name}`;
  const cached = readCache(key);
  if (cached) return cached;
  const raw = await getJSON(API + path, TTL);
  const d = raw.map(slim).filter(Boolean);
  writeCache(key, d);
  return d;
}

let ready = null;
export function loadAssets() {
  return ready ||= (async () => {
    const [h, i, r] = await Promise.all([
      load('heroes', '/v1/assets/heroes', x => {
        const im = x.images || {};
        return {
          id: x.id, name: x.name,
          active: !!x.player_selectable && !x.disabled && !x.in_development,
          img: im.icon_image_small_webp || im.icon_image_small || im.icon_hero_card_webp || im.icon_hero_card || im.minimap_image_webp || '',
        };
      }),
      load('items', '/v1/assets/items/by-type/upgrade', x => ({
        id: x.id, name: x.name, cost: x.cost || 0, tier: x.item_tier, slot: x.item_slot_type,
        img: x.shop_image_small_webp || x.shop_image_webp || x.shop_image || x.image_webp || x.image || '',
      })),
      load('ranks', '/v1/assets/ranks', x => ({ tier: x.tier, name: x.name, color: x.color, images: x.images || {} })),
    ]);
    h.forEach(x => heroes.set(x.id, x));
    i.forEach(x => items.set(x.id, x));
    r.forEach(x => ranks.set(x.tier, x));
  })().catch(e => { ready = null; throw e; });
}

export const heroName = id => heroes.get(id)?.name || `Héros ${id}`;
export const heroImg = id => LOCAL_IMAGES.heroes[id] || heroes.get(id)?.img || '';
export const itemImg = id => LOCAL_IMAGES.items[id] || items.get(id)?.img || '';

// badge = palier * 10 + sous-rang (ex. 44 = Sentinel 4)
export function rankOf(badge) {
  if (!badge) return { tier: 0, sub: 0, name: ranks.get(0)?.name || 'Non classé', img: rankImg(0, 0) };
  const tier = Math.floor(badge / 10), sub = badge % 10;
  return { tier, sub, name: `${ranks.get(tier)?.name || 'Rang ' + tier} ${sub || ''}`.trim(), img: rankImg(tier, sub) };
}
function rankImg(tier, sub) {
  const local = LOCAL_IMAGES.ranks[`${tier}-${sub}`] || LOCAL_IMAGES.ranks[tier];
  if (local) return local;
  const im = ranks.get(tier)?.images || {};
  return (sub && (im[`subrank${sub}_webp`] || im[`subrank${sub}`])) || im.large_webp || im.large || '';
}
