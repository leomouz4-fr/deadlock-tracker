import { api } from '../api.js';
import { heroName, items, rankOf } from '../assets.js';
import { esc, num, kfmt, dur, ago, dateTime, teamNum, heroIcon, itemIcon, table } from '../ui.js';

const TEAMS = [{ name: 'Main d’Ambre', cls: 'amber' }, { name: 'Flamme Saphir', cls: 'sapphire' }];

export async function match([id]) {
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
  const winner = teamNum(mi.winning_team);

  const team = t => {
    const pl = P.filter(p => teamNum(p.team) === t);
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
          <span><b>${esc(names[r.p.account_id] || 'Joueur ' + r.p.account_id)}</b><br><span class="muted" style="font-size:12px">${esc(heroName(r.p.hero_id))}${r.p.level ? ' · niv. ' + r.p.level : ''}</span></span></a>` },
        { k: 'kda', label: 'K / D / A', v: r => ((r.p.kills || 0) + (r.p.assists || 0)) / Math.max(1, r.p.deaths || 0), h: r => `${r.p.kills ?? 0} / ${r.p.deaths ?? 0} / ${r.p.assists ?? 0}` },
        { k: 'nw', label: 'Âmes', v: r => r.p.net_worth || 0, h: r => kfmt(r.p.net_worth) },
        { k: 'lh', label: 'LH / DN', v: r => r.p.last_hits || 0, h: r => `${r.p.last_hits ?? 0} / ${r.p.denies ?? 0}` },
        { k: 'dmg', label: 'Dégâts', v: r => r.dmg, h: r => kfmt(r.dmg) },
        { k: 'obj', label: 'Objectifs', v: r => r.obj, h: r => kfmt(r.obj) },
        { k: 'heal', label: 'Soins', v: r => r.heal, h: r => kfmt(r.heal) },
        { k: 'it', label: 'Items', v: r => r.its.length, h: r => `<span class="items">${r.its.map(itemIcon).join('')}</span>` },
      ], rows, { key: 'nw' });
  };

  return `<h1>Match ${esc(id)}</h1>
  <p class="sub">${mi.duration_s ? dur(mi.duration_s) + ' · ' : ''}${mi.start_time ? esc(dateTime(mi.start_time)) + ' · ' + ago(mi.start_time) : ''}</p>
  ${P.length ? team(0) + team(1) : '<div class="card note">Les détails de ce match ne sont pas encore disponibles.</div>'}`;
}
