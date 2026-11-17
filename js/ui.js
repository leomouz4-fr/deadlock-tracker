// Petits utilitaires d'affichage partagés par les vues.
import { heroName, heroImg, itemImg, items, rankOf } from './assets.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = new Intl.NumberFormat('fr-FR');
export const num = v => nf.format(Math.round(v || 0));
export const kfmt = v => (v || 0) >= 1000 ? ((v / 1000).toFixed(v >= 100_000 ? 0 : 1).replace('.', ',') + 'k') : String(Math.round(v || 0));
export const pct = (a, b, d = 1) => b ? (100 * a / b).toFixed(d).replace('.', ',') + ' %' : '—';
export const kda = (k, d, a) => ((k + a) / Math.max(1, d)).toFixed(2).replace('.', ',');
export const dur = s => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
export const wrCls = (w, m) => m ? (w / m >= 0.5 ? 'win' : 'loss') : '';

// Les dates arrivent en secondes Unix ou en texte "2026-11-16 23:32:49" (UTC).
export function toMs(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v < 1e12 ? v * 1000 : v;
  const s = String(v);
  return Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(' ', 'T') + 'Z');
}
const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
export function ago(v) {
  const t = toMs(v); if (!t) return '';
  const d = (t - Date.now()) / 1000, a = Math.abs(d);
  if (a < 3600) return rtf.format(Math.round(d / 60), 'minute');
  if (a < 86400) return rtf.format(Math.round(d / 3600), 'hour');
  if (a < 2592000) return rtf.format(Math.round(d / 86400), 'day');
  if (a < 31536000) return rtf.format(Math.round(d / 2592000), 'month');
  return rtf.format(Math.round(d / 31536000), 'year');
}
export const dateTime = v => { const t = toMs(v); return t ? new Date(t).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : ''; };

// "Team1" / 1 → 1
export const teamNum = v => typeof v === 'number' ? v : (/1/.test(String(v)) ? 1 : 0);

export function img(src, cls, alt, size) {
  if (!src) return `<span class="${cls} ph" style="width:${size}px;height:${size}px" title="${esc(alt)}">${esc(String(alt || '').slice(0, 2))}</span>`;
  return `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" title="${esc(alt)}" width="${size}" height="${size}" loading="lazy" decoding="async">`;
}
export const heroIcon = (id, sm) => img(heroImg(id), 'hi' + (sm ? ' sm' : ''), heroName(id), sm ? 26 : 36);
export const heroCell = id => `<span class="cell">${heroIcon(id)}<b>${esc(heroName(id))}</b></span>`;
export const itemIcon = id => img(itemImg(id), 'ii', items.get(id)?.name || `Item ${id}`, 26);

export function badge(b, { sm = false, label = true } = {}) {
  const r = rankOf(b);
  return `<span class="badge${sm ? ' sm' : ''}">${r.img ? `<img src="${esc(r.img)}" alt="" width="${sm ? 26 : 40}" height="${sm ? 26 : 40}" loading="lazy">` : ''}${label ? `<span>${esc(r.name)}</span>` : ''}</span>`;
}

export const stat = (k, v, cls = '') => `<div class="card stat"><div class="k">${k}</div><div class="v ${cls}">${v}</div></div>`;
export const skeleton = (n = 5) => '<div class="sk"></div>'.repeat(n);
export const errorBox = e => `<div class="card err"><b>Impossible de charger ces données.</b>
  <p class="muted" style="margin:6px 0 12px">${esc(e?.message || e)}</p><button class="btn ghost" data-act="retry">Réessayer</button></div>`;

// Image en échec → initiales à la place (évite les cases vides).
export function installImageFallback() {
  document.addEventListener('error', e => {
    const el = e.target;
    if (!(el instanceof HTMLImageElement) || el.dataset.failed) return;
    el.dataset.failed = '1';
    const s = document.createElement('span');
    s.className = `${el.className} ph`;
    s.title = el.alt;
    s.textContent = (el.alt || '').slice(0, 2);
    s.style.width = s.style.height = (el.getAttribute('width') || 26) + 'px';
    el.replaceWith(s);
  }, true);
}

// Tableau triable. cols : [{ k, label, v: ligne => valeur de tri, h: ligne => html }]
const tables = {};
export function table(id, cols, rows, { key, dir = -1 } = {}) {
  const prev = tables[id];
  tables[id] = { cols, rows, key: prev?.key || key || cols[0].k, dir: prev?.dir ?? dir };
  return tableHTML(id);
}
function tableHTML(id) {
  const t = tables[id], c = t.cols.find(x => x.k === t.key) || t.cols[0];
  const rows = [...t.rows].sort((a, b) => {
    const x = c.v(a), y = c.v(b);
    return (typeof x === 'string' ? x.localeCompare(y) : x - y) * t.dir;
  });
  return `<div class="tw" id="t-${id}"><table><thead><tr>${t.cols.map(x =>
    `<th data-sort="${id}:${x.k}" class="${x.k === t.key ? 's' : ''}">${x.label}${x.k === t.key ? (t.dir < 0 ? ' ↓' : ' ↑') : ''}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr>${t.cols.map(x => `<td>${x.h ? x.h(r) : esc(x.v(r))}</td>`).join('')}</tr>`).join('')
    || `<tr><td colspan="${t.cols.length}" class="muted">Aucune donnée.</td></tr>`}</tbody></table></div>`;
}
export function onSortClick(target) {
  const th = target.closest('[data-sort]'); if (!th) return false;
  const [id, k] = th.dataset.sort.split(':'), t = tables[id];
  if (t.key === k) t.dir *= -1;
  else { t.key = k; t.dir = typeof t.cols.find(c => c.k === k).v(t.rows[0] || {}) === 'string' ? 1 : -1; }
  document.getElementById('t-' + id).outerHTML = tableHTML(id);
  return true;
}
