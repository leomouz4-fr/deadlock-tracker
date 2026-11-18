import { api } from '../api.js';
import { heroName, items, rankOf } from '../assets.js';
import { esc, num, kfmt, dur, ago, dateTime, teamNum, heroIcon, itemIcon, table } from '../ui.js';

// Depuis la mise à jour du 22 janvier 2026 : l'équipe 0 (ex-Amber Hand) est The Hidden King, l'équipe 1 (ex-Sapphire Flame) The Archmother.
const TEAMS = [{ name: 'The Hidden King', cls: 'amber' }, { name: 'The Archmother', cls: 'sapphire' }];
const SLOTS = [['weapon', 'Arme'], ['vitality', 'Vitalité'], ['spirit', 'Esprit']];

// #/match/<id>[/<account_id du joueur dont on montre la timeline>]
export async function match([id, focus]) {
  if (!/^\d+$/.test(id || '')) throw new Error('Identifiant de match invalide.');
  const d = await api(`/v1/matches/${id}/metadata`, {}, 600_000);
  const mi = d.match_info || d;
  const P = mi.players || [];

  const names = {};
  const ids = P.map(p => p.account_id).filter(Boolean);
  if (ids.length) {
    try { (await api('/v1/players/steam', { account_ids: ids.join(',') }, 300_000)).forEach(s => { names[s.account_id] = s.personaname; }); }
    catch { /* noms facultatifs */ }
  }
  const nameOf = p => names[p.account_id] || 'Joueur ' + p.account_id;
  const winner = teamNum(mi.winning_team);
  const byTeam = t => P.filter(p => teamNum(p.team) === t).sort((a, b) => (b.net_worth || 0) - (a.net_worth || 0));

  const team = t => {
    const pl = byTeam(t);
    const K = pl.reduce((s, p) => s + (p.kills || 0), 0);
    const NW = pl.reduce((s, p) => s + (p.net_worth || 0), 0);
    const avg = mi[`average_badge_team${t}`];
    const rows = pl.map(p => {
      const fs = (p.stats || []).at(-1) || {};
      const its = [...new Set((p.items || []).filter(i => !i.sold_time_s && items.has(i.item_id)).map(i => i.item_id))];
      return { p, dmg: fs.player_damage || 0, heal: fs.player_healing || 0, obj: fs.boss_damage || 0, its };
    });
    return `<div class="team-h"><span class="${TEAMS[t].cls}">${TEAMS[t].name}${winner === t ? ' · Victoire' : ''}</span>
      <span class="muted">${K} kills · ${kfmt(NW)} âmes${avg ? ' · ' + esc(rankOf(avg).name) : ''}</span></div>` +
      table('match-t' + t, [
        { k: 'pl', label: 'Joueur', v: r => names[r.p.account_id] || '', h: r => `<a class="cell" href="#/player/${r.p.account_id}">${heroIcon(r.p.hero_id)}
          <span><b>${esc(nameOf(r.p))}</b><br><span class="muted" style="font-size:12px">${esc(heroName(r.p.hero_id))}${r.p.level ? ' · niv. ' + r.p.level : ''}</span></span></a>` },
        { k: 'kda', label: 'K / D / A', v: r => ((r.p.kills || 0) + (r.p.assists || 0)) / Math.max(1, r.p.deaths || 0), h: r => `${r.p.kills ?? 0} / ${r.p.deaths ?? 0} / ${r.p.assists ?? 0}` },
        { k: 'nw', label: 'Âmes', v: r => r.p.net_worth || 0, h: r => kfmt(r.p.net_worth) },
        { k: 'lh', label: 'LH / DN', v: r => r.p.last_hits || 0, h: r => `${r.p.last_hits ?? 0} / ${r.p.denies ?? 0}` },
        { k: 'dmg', label: 'Dégâts', v: r => r.dmg, h: r => kfmt(r.dmg) },
        { k: 'obj', label: 'Objectifs', v: r => r.obj, h: r => kfmt(r.obj) },
        { k: 'heal', label: 'Soins', v: r => r.heal, h: r => kfmt(r.heal) },
        { k: 'it', label: 'Items', v: r => r.its.length, h: r => `<span class="items">${r.its.map(itemIcon).join('')}</span>` },
      ], rows, { key: 'nw' });
  };

  // Joueur suivi : celui de l'URL, sinon le plus riche de l'équipe gagnante.
  const sel = P.find(p => String(p.account_id) === String(focus)) || byTeam(winner)[0] || P[0];

  return `<h1>Match ${esc(id)}</h1>
  <p class="sub">${mi.duration_s ? dur(mi.duration_s) + ' · ' : ''}${mi.start_time ? esc(dateTime(mi.start_time)) + ' · ' + ago(mi.start_time) : ''}</p>
  ${P.length ? team(0) + team(1) + timeline(id, P, byTeam, sel, nameOf, mi.duration_s) : '<div class="card note">Les détails de ce match ne sont pas encore disponibles.</div>'}`;
}

// Achats, ventes et améliorations d'un joueur, dans l'ordre chronologique.
function events(p) {
  const bought = (p.items || []).filter(i => items.has(i.item_id)).map(i => ({ ...i, it: items.get(i.item_id) }));
  const ev = [];
  for (const b of bought) {
    ev.push({ t: b.game_time_s, kind: 'buy', it: b.it, soldAt: b.sold_time_s || 0 });
    if (b.sold_time_s) {
      // Revendu à la seconde où on achète un item qui le contient → amélioration, pas une vente.
      const into = bought.find(x => Math.abs(x.game_time_s - b.sold_time_s) <= 1 && x.it.parts.includes(b.it.cls));
      ev.push({ t: b.sold_time_s, kind: into ? 'up' : 'sell', it: b.it, into: into?.it });
    }
  }
  return { ev: ev.sort((a, b) => a.t - b.t || (a.kind === 'buy') - (b.kind === 'buy')), bought };
}

function timeline(matchId, P, byTeam, sel, nameOf, duration) {
  const pick = [0, 1].map(t => byTeam(t).map(p =>
    `<a href="#/match/${matchId}/${p.account_id}" class="${p === sel ? 'on' : ''}" title="${esc(nameOf(p))} · ${esc(heroName(p.hero_id))}">${heroIcon(p.hero_id)}</a>`).join('')).join('<span class="sep"></span>');

  const { ev, bought } = events(sel);
  const end = Math.max(duration || 0, ...ev.map(e => e.t), 60);
  const spent = bought.reduce((s, b) => s + b.it.cost, 0);
  const sold = ev.filter(e => e.kind === 'sell').length, ups = ev.filter(e => e.kind === 'up').length;

  // Vue d'ensemble : une ligne par catégorie, chaque item placé à son minute d'achat.
  const step = end > 2400 ? 600 : 300;
  const ticks = [];
  for (let s = 0; s <= end; s += step) ticks.push(`<span style="left:${(100 * s / end).toFixed(2)}%">${Math.round(s / 60)} min</span>`);
  const lanes = SLOTS.map(([slot, label]) => `<div class="lane slot-${slot}"><b class="slot-${slot}">${label}</b>${
    bought.filter(b => b.it.slot === slot).map(b =>
      `<span style="left:${(100 * b.game_time_s / end).toFixed(2)}%">${itemIcon(b.item_id).replace('class="ii', `class="ii${b.sold_time_s ? ' gone' : ''}`).replace(/title="([^"]*)"/, `title="$1 · ${dur(b.game_time_s)}"`)}</span>`).join('')
  }</div>`).join('');

  const label = { buy: ['buy', 'Achat'], sell: ['sell', 'Vente'], up: ['up', 'Amélioré'] };
  const list = ev.map(e => `<div class="row">
      <span class="time">${dur(e.t)}</span>${itemIcon(e.it.id)}
      <span class="grow"><span class="name slot-${e.it.slot}">${esc(e.it.name)}</span>
        <span class="muted" style="font-size:13px">${e.kind === 'buy' ? `${num(e.it.cost)} âmes${e.it.active ? ' · actif' : ''}${e.soldAt ? ` · gardé jusqu’à ${dur(e.soldAt)}` : ''}`
          : e.kind === 'up' ? `en ${esc(e.into.name)}` : 'revendu'}</span></span>
      <span class="tag ${label[e.kind][0]}">${label[e.kind][1]}</span></div>`).join('');

  return `<h2>Achats et ventes <small>${esc(nameOf(sel))} · ${esc(heroName(sel.hero_id))}</small></h2>
  <div class="who-pick">${pick}</div>
  ${bought.length ? `<div class="grid g4">
      <div class="card stat"><div class="k">Items achetés</div><div class="v">${bought.length}</div></div>
      <div class="card stat"><div class="k">Âmes dépensées</div><div class="v">${kfmt(spent)}</div></div>
      <div class="card stat"><div class="k">Améliorés</div><div class="v">${ups}</div></div>
      <div class="card stat"><div class="k">Revendus</div><div class="v">${sold}</div></div></div>
    <div class="card" style="margin-top:12px"><div class="lanes">${lanes}</div><div class="ticks">${ticks.join('')}</div></div>
    <div class="list tl" style="margin-top:12px">${list}</div>`
  : '<div class="card note">Aucun achat enregistré pour ce joueur.</div>'}`;
}
