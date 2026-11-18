// Routeur (#/…), chargement des assets et gestion des évènements.
import { parseAccount, clearCache } from './api.js';
import { loadAssets, findHero } from './assets.js';
import { skeleton, errorBox, installImageFallback, onSortClick } from './ui.js';
import { home, search } from './views/home.js';
import { player, state as playerState, prefetchPlayer } from './views/player.js';
import { match, prefetchMatch } from './views/match.js';
import { topPlayer, setRegion } from './views/top.js';
import { heroList, heroPage } from './views/hero.js';

const views = { '': home, search, player, match, top: topPlayer, heroes: heroList, hero: heroPage };
const app = document.getElementById('app');
let navToken = 0, lastHash = null;

async function route() {
  const [name = '', ...args] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const view = views[name] || home;
  const token = ++navToken;
  if (lastHash !== location.hash) { app.innerHTML = skeleton(); lastHash = location.hash; window.scrollTo(0, 0); }
  try {
    await loadAssets();
    // Les vues peuvent afficher une première version avant d'avoir toutes leurs données.
    // Elle n'apparaît que si la page complète tarde (> 80 ms), pour éviter les clignotements ;
    // après l'affichage final, une mise à jour (ex. matchs complémentaires) s'applique tout de suite.
    let done = false, timer = null;
    const paint = html => {
      if (token !== navToken) return;
      if (done) { app.innerHTML = html; return; }
      clearTimeout(timer);
      timer = setTimeout(() => { if (token === navToken && !done) app.innerHTML = html; }, 80);
    };
    const html = await view(args, paint);
    done = true; clearTimeout(timer);
    if (token !== navToken || html == null) return;
    app.innerHTML = html;
  } catch (e) {
    if (token === navToken) app.innerHTML = errorBox(e);
  }
  if (token === navToken) {
    const h1 = app.querySelector('h1')?.textContent;
    document.title = h1 ? `${h1} — Deadlock Tracker` : 'Deadlock Tracker';
  }
}

window.addEventListener('hashchange', () => {
  playerState.limit = 30;
  if (!location.hash.startsWith('#/player/')) playerState.hero = '';
  route();
});

document.addEventListener('submit', e => {
  const f = e.target.closest('[data-form="search"]'); if (!f) return;
  e.preventDefault();
  const q = f.q.value.trim(); if (!q) return;
  const id = parseAccount(q);
  const hero = !id && findHero(q);
  location.hash = id ? '#/player/' + id : hero ? '#/hero/' + hero.id : '#/search/' + encodeURIComponent(q);
  f.q.blur();
});

document.addEventListener('change', e => {
  if (e.target.dataset?.filter === 'hero') { playerState.hero = e.target.value; playerState.limit = 30; route(); }
});

document.addEventListener('click', e => {
  if (onSortClick(e.target)) return;
  const region = e.target.closest('[data-region]')?.dataset.region;
  if (region) { setRegion(region); route(); return; }
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'more') { playerState.limit += 30; route(); }
  if (act === 'retry') { clearCache(); route(); }
});

// Préchargement : dès qu'un lien est survolé ou touché, on lance ses requêtes.
const warmed = new Set();
function warm(e) {
  const a = e.target.closest?.('a[href^="#/"]'); if (!a) return;
  const h = a.getAttribute('href'); if (warmed.has(h)) return;
  warmed.add(h);
  loadAssets().then(() => {
    let m;
    if ((m = h.match(/^#\/player\/(\d+)/))) prefetchPlayer(m[1]);
    else if ((m = h.match(/^#\/match\/(\d+)/))) prefetchMatch(m[1]);
  }).catch(() => {});
}
document.addEventListener('mouseover', warm, { passive: true });
document.addEventListener('touchstart', warm, { passive: true });
document.addEventListener('focusin', warm);

installImageFallback();
route();
