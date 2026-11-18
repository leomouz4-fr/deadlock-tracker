// Liste des héros et page d'un héros (stats globales + meilleurs joueurs par région).
import { api } from '../api.js';
import { activeHeroes, heroes, heroCard, heroName } from '../assets.js';
import { esc, img, num, pct, kda, kfmt, wrCls, stat } from '../ui.js';
import { topBlock } from './top.js';

const heroStats = () => api('/v1/analytics/hero-stats', {}, 3_600_000).catch(() => []);

export async function heroList() {
  const stats = new Map((await heroStats()).map(s => [s.hero_id, s]));
  return `<h1>Héros</h1>
  <p class="sub">Choisissez un héros pour voir ses statistiques et ses meilleurs joueurs.</p>
  <div class="hero-grid">${activeHeroes().map(h => {
    const s = stats.get(h.id);
    return `<a class="hero-card" href="#/hero/${h.id}">${img(heroCard(h.id), 'card-img', h.name, 120)}
      <span class="hn">${esc(h.name)}</span>${s?.matches ? `<span class="hw ${wrCls(s.wins, s.matches)}">${pct(s.wins, s.matches)}</span>` : ''}</a>`;
  }).join('')}</div>`;
}

export async function heroPage([id]) {
  const hid = Number(id);
  if (!heroes.has(hid)) throw new Error('Héros inconnu.');
  const all = await heroStats();
  const s = all.find(x => x.hero_id === hid);
  const total = all.reduce((t, x) => t + (x.matches || 0), 0) / 12; // 12 joueurs par match
  return `<div class="profile">${img(heroCard(hid), 'av hero-av', heroName(hid), 76)}
    <div class="who"><h1>${esc(heroName(hid))}</h1><p class="sub" style="margin:0"><a class="acc" href="#/heroes">Tous les héros</a></p></div></div>
  ${s?.matches ? `<div class="grid g4" style="margin-top:16px">
    ${stat('Victoires', pct(s.wins, s.matches), wrCls(s.wins, s.matches))}
    ${stat('Sélection', pct(s.matches, total))}
    ${stat('KDA moyen', kda(s.total_kills, s.total_deaths, s.total_assists))}
    ${stat('Âmes / match', kfmt(s.total_net_worth / s.matches))}</div>
    <p class="muted" style="font-size:13px;margin:8px 0 0">Sur ${num(s.matches)} matchs analysés par Deadlock API.</p>` : ''}
  ${await topBlock(hid)}`;
}
