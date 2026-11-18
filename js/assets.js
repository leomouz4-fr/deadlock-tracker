// Héros, items et rangs depuis /v1/assets (images hébergées sur assets-bucket.deadlock-api.com).
// Pour utiliser vos propres images plus tard : remplissez LOCAL_IMAGES, ex. { heroes: { 1: 'img/heroes/infernus.webp' } }.
import { API, getJSON } from './api.js';

export const LOCAL_IMAGES = { heroes: {}, items: {}, ranks: {} };

export const heroes = new Map();
export const items = new Map();
export const ranks = new Map();

const VERSION = 'v2';
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
          card: im.icon_hero_card_webp || im.icon_hero_card || im.icon_image_small_webp || '',
        };
      }),
      load('items', '/v1/assets/items/by-type/upgrade', x => ({
        id: x.id, name: x.name, cost: x.cost || 0, tier: x.item_tier, slot: x.item_slot_type,
        cls: x.class_name, parts: x.component_items || [], active: !!x.is_active_item,
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
export const heroCard = id => LOCAL_IMAGES.heroes[id] || heroes.get(id)?.card || heroImg(id);

// "lash", "Mo & Krill", "mo et krill", "lady geist" → héros correspondant (actifs uniquement).
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, 'et').replace(/[^a-z0-9]/g, '');
export function findHero(q) {
  const n = norm(q); if (n.length < 2) return null;
  const list = [...heroes.values()].filter(h => h.active);
  return list.find(h => norm(h.name) === n) || (n.length >= 3 ? list.find(h => norm(h.name).startsWith(n)) : null) || null;
}
export const activeHeroes = () => [...heroes.values()].filter(h => h.active).sort((a, b) => a.name.localeCompare(b.name));
export const itemImg = id => LOCAL_IMAGES.items[id] || items.get(id)?.img || '';

// badge = palier * 10 + sous-rang (ex. 44 = Sentinel IV). Sous-rangs affichés I à VI comme en jeu.
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];
export function rankOf(badge) {
  if (!badge) return { tier: 0, sub: 0, name: ranks.get(0)?.name || 'Non classé', img: rankImg(0, 0) };
  const tier = Math.floor(badge / 10), sub = badge % 10;
  return { tier, sub, name: `${ranks.get(tier)?.name || 'Rang ' + tier} ${ROMAN[sub] || ''}`.trim(), img: rankImg(tier, sub) };
}
function rankImg(tier, sub) {
  const local = LOCAL_IMAGES.ranks[`${tier}-${sub}`] || LOCAL_IMAGES.ranks[tier];
  if (local) return local;
  const im = ranks.get(tier)?.images || {};
  return (sub && (im[`subrank${sub}_webp`] || im[`subrank${sub}`])) || im.large_webp || im.large || '';
}
