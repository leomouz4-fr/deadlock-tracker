// Routeur (#/…), chargement des assets et gestion des évènements.
import { parseAccount, clearCache } from './api.js';
import { loadAssets } from './assets.js';
import { skeleton, errorBox, installImageFallback, onSortClick } from './ui.js';
import { home, search } from './views/home.js';
import { player, state as playerState } from './views/player.js';
import { match } from './views/match.js';

const views = { '': home, search, player, match };
const app = document.getElementById('app');
let navToken = 0, lastHash = null;

async function route() {
  const [name = '', ...args] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const view = views[name] || home;
  const token = ++navToken;
  if (lastHash !== location.hash) { app.innerHTML = skeleton(); lastHash = location.hash; window.scrollTo(0, 0); }
  try {
    await loadAssets();
    const html = await view(args);
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
  location.hash = id ? '#/player/' + id : '#/search/' + encodeURIComponent(q);
  f.q.blur();
});

document.addEventListener('change', e => {
  if (e.target.dataset?.filter === 'hero') { playerState.hero = e.target.value; playerState.limit = 30; route(); }
});

document.addEventListener('click', e => {
  if (onSortClick(e.target)) return;
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'more') { playerState.limit += 30; route(); }
  if (act === 'retry') { clearCache(); route(); }
});

installImageFallback();
route();
