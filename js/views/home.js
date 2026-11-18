import { api, parseAccount } from '../api.js';
import { esc, img, num, badge } from '../ui.js';
import { topBlock } from './top.js';

export function recentProfiles() {
  try { return JSON.parse(localStorage.getItem('dlt:recent')) || []; } catch { return []; }
}
export function rememberProfile(p) {
  try {
    const list = recentProfiles().filter(x => x.id !== p.id);
    list.unshift(p);
    localStorage.setItem('dlt:recent', JSON.stringify(list.slice(0, 6)));
  } catch { /* stockage indisponible */ }
}

const searchForm = (q = '') => `<form class="hero-search" data-form="search" role="search">
  <input name="q" value="${esc(q)}" placeholder="Pseudo Steam, SteamID ou URL de profil" autocomplete="off" autocapitalize="off" required aria-label="Rechercher un joueur">
  <button class="btn">Chercher</button></form>`;

export async function home() {
  const recent = recentProfiles();
  return `<h1>Vos stats Deadlock</h1>
  <p class="sub">Cherchez un joueur pour voir son rang, ses héros et son historique de matchs.</p>
  ${searchForm()}
  <p class="muted" style="font-size:13px;margin:0">Astuce : le SteamID ou l’URL /profiles/7656… est le plus fiable. Les URL personnalisées (/id/…) ne sont pas reconnues.</p>
  ${recent.length ? `<h2>Profils récents</h2><div class="list">${recent.map(p =>
    `<a class="row" href="#/player/${p.id}">${img(p.av, 'hi', '', 36)}<span class="grow"><span class="name">${esc(p.name)}</span></span><span class="muted">›</span></a>`).join('')}</div>` : ''}
  ${await topBlock()}`;
}

export async function search([q = '']) {
  const id = parseAccount(q);
  if (id) { location.hash = '#/player/' + id; return null; }
  let res = [];
  try { res = await api('/v1/players/steam-search', { search_query: q, limit: 30 }, 60_000); }
  catch (e) { if (e.status !== 404) throw e; }
  return `<h1>Résultats pour « ${esc(q)} »</h1>
  <p class="sub">${res.length} joueur(s). Seuls les comptes ayant joué au moins 5 matchs ces 30 derniers jours apparaissent.</p>
  ${searchForm(q)}
  <div class="list">${res.map(p => `<a class="row" href="#/player/${p.account_id}">
      ${img(p.avatarmedium || p.avatar, 'hi', '', 36)}
      <span class="grow"><span class="name">${esc(p.personaname)}</span>
        <span class="muted" style="font-size:13px">${p.countrycode ? esc(p.countrycode) + ' · ' : ''}${num(p.matches_played_last_30d)} matchs sur 30 jours</span></span>
      ${p.last_team_avg_badge ? badge(p.last_team_avg_badge, { sm: true, label: false }) : ''}</a>`).join('')
    || '<div class="row muted">Aucun joueur trouvé. Essayez avec le SteamID.</div>'}</div>`;
}
