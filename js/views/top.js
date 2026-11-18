// Classement (top 50) par région et résolution d'un joueur du classement vers son compte.
import { api } from '../api.js';
import { esc, img, num, heroIcon, badge } from '../ui.js';

export const REGIONS = [
  { id: 'Europe', label: 'Europe' },
  { id: 'NAmerica', label: 'Amérique du Nord' },
  { id: 'Asia', label: 'Asie' },
];
const TOP = 50;

export function currentRegion() {
  try { const r = localStorage.getItem('dlt:region'); if (REGIONS.some(x => x.id === r)) return r; } catch { /* rien */ }
  return 'Europe';
}
export function setRegion(r) {
  try { localStorage.setItem('dlt:region', r); } catch { /* rien */ }
}

const leaderboard = region => api('/v1/leaderboard/' + region, {}, 600_000).then(d => (d.entries || []).slice(0, TOP));

// Bloc affiché sur l'accueil.
export async function topBlock() {
  const region = currentRegion();
  let rows, error;
  try { rows = await leaderboard(region); } catch (e) { error = e; }
  const tabs = REGIONS.map(r => `<button type="button" class="chip ${r.id === region ? 'on' : ''}" data-region="${r.id}">${r.label}</button>`).join('');
  const body = error
    ? `<div class="card err"><b>Classement indisponible.</b> <span class="muted">${esc(error.message)}</span></div>`
    : `<div class="list lb">${rows.map(e => `<a class="row" href="#/top/${region}/${e.rank}">
        <span class="place ${e.rank <= 3 ? 'p' + e.rank : ''}">${e.rank}</span>
        <span class="grow"><span class="name">${esc(e.account_name || 'Anonyme')}</span></span>
        <span class="heroes">${(e.top_hero_ids || []).slice(0, 3).map(h => heroIcon(h, true)).join('')}</span></a>`).join('')
      || '<div class="row muted">Aucun joueur classé pour le moment.</div>'}</div>`;
  return `<h2>Top ${TOP} des joueurs <small>classement officiel par région</small></h2>
    <div class="chips" style="margin-bottom:12px">${tabs}</div>${body}`;
}

// #/top/<région>/<place> : retrouve le compte Steam derrière une ligne du classement.
export async function topPlayer([region, place]) {
  if (!REGIONS.some(r => r.id === region)) throw new Error('Région inconnue.');
  const entry = (await leaderboard(region)).find(e => String(e.rank) === String(place));
  if (!entry) throw new Error('Ce joueur n’est plus dans le top ' + TOP + '.');
  const ids = (entry.possible_account_ids || []).slice(0, 500);
  if (!ids.length) return notFound(entry, region);

  const profiles = [];
  for (let i = 0; i < ids.length; i += 100) {
    try { profiles.push(...await api('/v1/players/steam', { account_ids: ids.slice(i, i + 100).join(',') }, 600_000)); }
    catch { /* lot ignoré */ }
  }
  const name = (entry.account_name || '').trim().toLowerCase();
  const matches = profiles
    .filter(p => (p.personaname || '').trim().toLowerCase() === name)
    .sort((a, b) => (b.matches_played_last_30d || 0) - (a.matches_played_last_30d || 0));

  if (matches.length === 1) { location.replace('#/player/' + matches[0].account_id); return null; }
  if (!matches.length) return notFound(entry, region);

  return `<h1>${esc(entry.account_name)}</h1>
  <p class="sub">#${entry.rank} en ${esc(REGIONS.find(r => r.id === region).label)}. Plusieurs comptes portent ce nom : le plus actif est en premier.</p>
  <div class="list">${matches.slice(0, 30).map((p, i) => `<a class="row" href="#/player/${p.account_id}">
      ${img(p.avatarmedium || p.avatar, 'hi', '', 36)}
      <span class="grow"><span class="name">${esc(p.personaname)}${i === 0 ? ' <span class="acc" style="font-weight:400;font-size:13px">· le plus probable</span>' : ''}</span>
        <span class="muted" style="font-size:13px">ID ${p.account_id}${p.countrycode ? ' · ' + esc(p.countrycode) : ''} · ${num(p.matches_played_last_30d)} matchs sur 30 jours</span></span>
      ${p.last_team_avg_badge ? badge(p.last_team_avg_badge, { sm: true, label: false }) : ''}</a>`).join('')}</div>`;
}

function notFound(entry, region) {
  return `<h1>${esc(entry.account_name || 'Joueur')}</h1>
  <p class="sub">#${entry.rank} en ${esc(REGIONS.find(r => r.id === region).label)}.</p>
  <div class="card note">L’API ne permet pas de retrouver le compte Steam de ce joueur.
    <a class="acc" href="#/search/${encodeURIComponent(entry.account_name || '')}">Chercher « ${esc(entry.account_name)} »</a></div>`;
}
