import { api, peek } from '../api.js';
import { heroName, rankOf } from '../assets.js';
import { esc, img, num, kfmt, pct, kda, dur, ago, toMs, teamNum, wrCls, heroIcon, heroCell, badge, stat, table, skeleton } from '../ui.js';
import { rememberProfile } from './home.js';

export const state = { limit: 30, hero: '' };

// 1 = victoire, 2 = défaite, 3-5 = non comptabilisé ; 0 = inconnu → on compare équipe et vainqueur.
const outcome = m => m.player_match_outcome === 1 ? 'w'
  : m.player_match_outcome === 2 ? 'l'
  : [3, 4, 5].includes(m.player_match_outcome) ? 'n'
  : (m.player_team === m.match_result ? 'w' : 'l');

// Matchs ingérés par l'API mais absents de l'historique (même format que /match-history).
function fromMetadata(list, id) {
  const out = [];
  for (const x of Array.isArray(list) ? list : []) {
    const p = (x.players || []).find(q => String(q.account_id) === String(id));
    if (!p || x.match_id == null) continue;
    out.push({
      match_id: x.match_id, hero_id: p.hero_id, hero_level: p.player_level ?? p.level,
      start_time: Math.round(toMs(x.start_time) / 1000), match_duration_s: x.duration_s || 0,
      player_team: teamNum(p.team), match_result: teamNum(x.winning_team), player_match_outcome: x.not_scored ? 5 : 0,
      player_kills: p.kills || 0, player_deaths: p.deaths || 0, player_assists: p.assists || 0,
      net_worth: p.net_worth || 0, last_hits: p.last_hits || 0, denies: p.denies || 0,
    });
  }
  return out;
}

const Q = {
  steam: id => ['/v1/players/steam', { account_ids: id }, 300_000],
  rank: id => [`/v1/players/${id}/rank`, {}, 120_000],
  hist: id => [`/v1/players/${id}/match-history`, {}, 120_000],
  stats: id => ['/v1/players/hero-stats', { account_ids: id }, 300_000],
  // Matchs complémentaires (lourd) : demandé seulement si l'historique est incomplet.
  meta: id => ['/v1/matches/metadata', {
    account_ids: id, only_filtered_players: true, include_info: true, include_player_info: true,
    order_by: 'start_time', order_direction: 'desc', limit: 200,
  }, 300_000],
};
const settle = p => p.then(value => ({ status: 'fulfilled', value }), reason => ({ status: 'rejected', reason }));

export function prefetchPlayer(id) {
  for (const k of ['steam', 'rank', 'stats', 'hist']) api(...Q[k](id)).catch(() => {});
}

export async function player([id, tab = 'matchs'], paint) {
  if (!/^\d+$/.test(id || '')) throw new Error('Identifiant de joueur invalide.');
  const steamP = settle(api(...Q.steam(id)));
  const rankP = settle(api(...Q.rank(id)));
  const statsP = settle(api(...Q.stats(id)));
  const histP = settle(api(...Q.hist(id)));

  // 1er affichage dès que le profil, le rang et les stats (légers) sont là ; l'historique (lourd) suit.
  const [steam, rank, hstats] = await Promise.all([steamP, rankP, statsP]);
  const ctx = { id, tab, steam, rank, hstats };
  if (!peek(...Q.hist(id))) paint?.(render(ctx, null, null));
  const hist = await histP;
  if (hist.status === 'rejected' && hstats.status === 'rejected') throw hist.reason;

  const known = (Array.isArray(hstats.value) ? hstats.value : []).reduce((s, r) => s + (r.matches_played || 0), 0);
  const histLen = Array.isArray(hist.value) ? hist.value.length : 0;
  if (histLen >= known && hist.status === 'fulfilled') return render(ctx, hist, null);

  // Historique incomplet : on affiche ce qu'on a, puis on complète en arrière-plan.
  const meta = peek(...Q.meta(id));
  if (meta) return render(ctx, hist, meta);
  api(...Q.meta(id)).then(m => paint?.(render(ctx, hist, m)), () => paint?.(render(ctx, hist, null)));
  return render(ctx, hist, null, true);
}

function render({ id, tab, steam, rank, hstats }, hist, metaList, completing = false) {
  const p = steam.value?.[0] || {};
  const name = p.personaname || `Joueur ${id}`;
  if (p.personaname) rememberProfile({ id, name, av: p.avatarmedium || '' });

  // Historique : /match-history complété par /matches/metadata, sans doublons.
  const byId = new Map();
  for (const m of Array.isArray(hist?.value) ? hist.value : []) byId.set(String(m.match_id), m);
  for (const m of fromMetadata(metaList, id)) if (!byId.has(String(m.match_id))) byId.set(String(m.match_id), m);
  const H = [...byId.values()].sort((a, b) => b.start_time - a.start_time);

  // Totaux : les stats par héros couvrent tous les matchs connus de l'API.
  const HS = Array.isArray(hstats.value) ? hstats.value : [];
  const sumHS = k => HS.reduce((s, r) => s + (r[k] || 0), 0);
  const totalM = sumHS('matches_played');
  const scored = H.filter(m => outcome(m) !== 'n');
  const T = totalM >= H.length && totalM > 0
    ? { m: totalM, w: sumHS('wins'), k: sumHS('kills'), d: sumHS('deaths'), a: sumHS('assists'),
        spm: HS.reduce((s, r) => s + (r.networth_per_min || 0) * r.matches_played, 0) / totalM }
    : { m: scored.length, w: scored.filter(m => outcome(m) === 'w').length,
        k: H.reduce((s, m) => s + m.player_kills, 0), d: H.reduce((s, m) => s + m.player_deaths, 0), a: H.reduce((s, m) => s + m.player_assists, 0),
        spm: H.reduce((s, m) => s + m.net_worth, 0) / Math.max(1, H.reduce((s, m) => s + m.match_duration_s, 0) / 60) };

  const r = rank.value || {};
  const last20 = scored.slice(0, 20);
  const lw = last20.filter(m => outcome(m) === 'w').length;

  const note = !hist ? ''
    : hist.status === 'rejected' ? `<div class="card note">L’historique détaillé n’a pas pu être chargé : ${esc(hist.reason?.message)}</div>`
    : completing ? `<div class="card note">${num(H.length)} match(s) détaillé(s) sur ${num(T.m)} joués. Recherche de matchs supplémentaires…</div>`
    : H.length < T.m ? `<div class="card note">${num(H.length)} match(s) détaillé(s) sur ${num(T.m)} joués. L’API ne garde pas l’historique complet de tous les comptes.</div>` : '';

  const header = `<div class="profile">
    ${img(p.avatarfull || p.avatarmedium, 'av', name, 76)}
    <div class="who"><h1>${esc(name)}</h1>
      <p class="sub" style="margin:0">ID ${esc(id)}${p.countrycode ? ' · ' + esc(p.countrycode) : ''}${p.profileurl ? ` · <a class="acc" href="${esc(p.profileurl)}" target="_blank" rel="noopener">Profil Steam</a>` : ''}</p></div>
    <div class="card">${rank.status === 'rejected' ? '<span class="muted">Rang indisponible</span>' : badge(r.badge)}</div></div>
  <div class="grid g4" style="margin-top:16px">
    ${stat('Matchs', num(T.m))}${stat('Victoires', pct(T.w, T.m), wrCls(T.w, T.m))}
    ${stat('KDA', kda(T.k, T.d, T.a))}${stat('Âmes / min', T.spm ? num(T.spm) : '—')}</div>
  ${note}
  ${last20.length ? `<h2>Forme récente <small>${lw} V – ${last20.length - lw} D</small></h2>
    <div class="card"><div class="form">${last20.slice().reverse().map(m => `<i class="${outcome(m) === 'w' ? 'w' : ''}"></i>`).join('')}</div></div>` : ''}
  <h2>Détail</h2>
  <div class="chips" style="margin-bottom:12px">
    <a class="chip ${tab === 'matchs' ? 'on' : ''}" href="#/player/${id}/matchs">Matchs</a>
    <a class="chip ${tab === 'heros' ? 'on' : ''}" href="#/player/${id}/heros">Héros</a></div>`;

  if (tab === 'heros') return header + heroTable(HS);
  return header + (hist ? matchList(H, id) : skeleton(5));
}

function matchList(H, id) {
  const heroOpts = [...new Set(H.map(m => m.hero_id))].sort((a, b) => heroName(a).localeCompare(heroName(b)));
  const list = H.filter(m => !state.hero || String(m.hero_id) === state.hero);
  return `<div class="controls"><select data-filter="hero" aria-label="Filtrer par héros">
      <option value="">Tous les héros</option>${heroOpts.map(h => `<option value="${h}"${String(h) === state.hero ? ' selected' : ''}>${esc(heroName(h))}</option>`).join('')}</select></div>
  <div class="list">${list.slice(0, state.limit).map(m => {
    const o = outcome(m);
    const label = { w: 'Victoire', l: 'Défaite', n: 'Non comptabilisé' }[o];
    return `<a class="m ${o === 'w' ? 'w' : o === 'n' ? 'n' : ''}" href="#/match/${m.match_id}/${id}"><span class="edge"></span>${heroIcon(m.hero_id)}
      <span><span class="t ${o === 'w' ? 'win' : o === 'l' ? 'loss' : 'muted'}">${label}</span> <span class="t">· ${esc(heroName(m.hero_id))}</span><br>
      <span class="d">${m.player_kills}/${m.player_deaths}/${m.player_assists} · ${kfmt(m.net_worth)} âmes · ${m.last_hits} LH${m.hero_level ? ' · niv. ' + m.hero_level : ''}${m.ranked_display_badge ? ' · ' + esc(rankOf(m.ranked_display_badge).name) : ''}</span></span>
      <span class="r">${dur(m.match_duration_s)}${m.ranked_delta ? ` <b class="${m.ranked_delta > 0 ? 'win' : 'loss'}">${m.ranked_delta > 0 ? '+' : ''}${m.ranked_delta}</b>` : ''}<br><span class="d">${ago(m.start_time)}</span></span></a>`;
  }).join('') || '<div class="row muted">Aucun match disponible.</div>'}</div>
  ${list.length > state.limit ? `<p class="center"><button class="btn ghost" data-act="more">Afficher plus (${list.length - state.limit} restants)</button></p>` : ''}`;
}

function heroTable(HS) {
  return table('player-heroes', [
    { k: 'hero', label: 'Héros', v: r => heroName(r.hero_id), h: r => heroCell(r.hero_id) },
    { k: 'm', label: 'Matchs', v: r => r.matches_played, h: r => num(r.matches_played) },
    { k: 'wr', label: 'Victoires', v: r => r.wins / Math.max(1, r.matches_played), h: r => `<b class="${wrCls(r.wins, r.matches_played)}">${pct(r.wins, r.matches_played)}</b>` },
    { k: 'kda', label: 'KDA', v: r => (r.kills + r.assists) / Math.max(1, r.deaths), h: r => kda(r.kills, r.deaths, r.assists) },
    { k: 'spm', label: 'Âmes/min', v: r => r.networth_per_min || 0, h: r => num(r.networth_per_min) },
    { k: 'dpm', label: 'Dégâts/min', v: r => r.damage_per_min || 0, h: r => num(r.damage_per_min) },
    { k: 'acc', label: 'Précision', v: r => r.accuracy || 0, h: r => pct(r.accuracy, 1) },
    { k: 'lp', label: 'Dernier match', v: r => r.last_played || 0, h: r => ago(r.last_played) },
  ], HS, { key: 'm' });
}
