// src/components/sportshub/SeasonCalendarCard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// SP-2 · Season Brain — the guardian/athlete-facing season calendar input.
//
// The Lab can only taper into game day if it knows when game day IS. This card
// (Check-In tab) shows the current season window + next-game countdown and lets
// the athlete or their guardian set season dates, weekly practice load, and
// upcoming game dates. Writes ride bbf_set_my_season (token-gated). The Sunday
// Season Brain pass reads this calendar and drafts game-week adjustments into
// the founder approval queue — nothing here changes training directly.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react';
import { setMySeason } from '../../lib/seasonApi.js';

const T = {
  en: {
    title: 'Season Calendar', kicker: 'Game-Day Intelligence',
    empty: 'Tell the Lab your season — it will plan your training around your games.',
    inSeason: 'IN-SEASON', offSeason: 'OFF-SEASON',
    nextGame: 'Next game', days: 'days', today: 'TODAY',
    edit: 'Set My Season', save: 'Save Season', cancel: 'Cancel',
    start: 'Season starts', end: 'Season ends', practice: 'Practices / week',
    games: 'Upcoming game dates', addGame: '+ Add game date', saved: 'Season locked in. The Lab is watching your calendar.',
  },
  es: {
    title: 'Calendario de Temporada', kicker: 'Inteligencia de Partido',
    empty: 'Dile al Lab tu temporada — planificará tu entrenamiento alrededor de tus partidos.',
    inSeason: 'EN TEMPORADA', offSeason: 'FUERA DE TEMPORADA',
    nextGame: 'Próximo partido', days: 'días', today: 'HOY',
    edit: 'Configurar Temporada', save: 'Guardar', cancel: 'Cancelar',
    start: 'Inicio de temporada', end: 'Fin de temporada', practice: 'Prácticas / semana',
    games: 'Próximos partidos', addGame: '+ Agregar partido', saved: 'Temporada registrada. El Lab vigila tu calendario.',
  },
  pt: {
    title: 'Calendário da Temporada', kicker: 'Inteligência de Jogo',
    empty: 'Conte ao Lab sua temporada — ele planejará seu treino em torno dos seus jogos.',
    inSeason: 'NA TEMPORADA', offSeason: 'FORA DA TEMPORADA',
    nextGame: 'Próximo jogo', days: 'dias', today: 'HOJE',
    edit: 'Definir Temporada', save: 'Salvar', cancel: 'Cancelar',
    start: 'Início da temporada', end: 'Fim da temporada', practice: 'Treinos / semana',
    games: 'Próximos jogos', addGame: '+ Adicionar jogo', saved: 'Temporada registrada. O Lab está de olho no seu calendário.',
  },
};

export default function SeasonCalendarCard({ uid, season, lang = 'en', onSaved }) {
  const t = T[lang] || T.en;
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [start, setStart] = useState(season?.season_start || '');
  const [end, setEnd] = useState(season?.season_end || '');
  const [practice, setPractice] = useState(season?.practice_days_per_week ?? 2);
  const [games, setGames] = useState(['']);

  const countdown = useMemo(() => {
    const d = season?.days_to_next_game;
    if (d == null) return null;
    return d === 0 ? t.today : `${d} ${t.days}`;
  }, [season, t]);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    const res = await setMySeason(uid, {
      season_start: start || null,
      season_end: end || null,
      practice_days_per_week: Number(practice) || 0,
      games: games.filter(Boolean),
      updated_by: 'guardian',
    });
    setBusy(false);
    if (res?.ok) {
      setEditing(false);
      setDone(true);
      onSaved?.();
    }
  };

  return (
    <section className="sh-card" data-testid="sh-season-card">
      <div className="sh-day-kicker">{t.kicker}</div>
      <h2 className="sh-rest-title">{t.title}</h2>

      {season?.has_season ? (
        <p className="sh-rest-sub">
          <strong>{season.in_season ? t.inSeason : t.offSeason}</strong>
          {season.season_start ? ` · ${season.season_start} → ${season.season_end || '—'}` : ''}
          {season.next_game_date ? ` · ${t.nextGame}: ${season.next_game_date} (${countdown})` : ''}
        </p>
      ) : (
        <p className="sh-rest-sub">{t.empty}</p>
      )}
      {done ? <p className="sh-rest-sub" data-testid="sh-season-saved">✓ {t.saved}</p> : null}

      {!editing ? (
        <button type="button" className="sh-ex" onClick={() => setEditing(true)} data-testid="sh-season-edit">
          <span className="sh-ex-name">🗓 {t.edit}</span>
        </button>
      ) : (
        <div className="sh-season-form" data-testid="sh-season-form">
          <label className="sh-rest-sub">
            {t.start}
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} data-testid="sh-season-start" />
          </label>
          <label className="sh-rest-sub">
            {t.end}
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} data-testid="sh-season-end" />
          </label>
          <label className="sh-rest-sub">
            {t.practice}
            <input type="number" min="0" max="7" value={practice} onChange={(e) => setPractice(e.target.value)} />
          </label>
          <div className="sh-rest-sub">{t.games}</div>
          {games.map((g, i) => (
            <input
              // Index keys are safe here: the list is append-only while editing.
              key={`game-${i}`}
              type="date"
              value={g}
              onChange={(e) => setGames((prev) => prev.map((x, xi) => (xi === i ? e.target.value : x)))}
              data-testid={`sh-season-game-${i}`}
            />
          ))}
          {games.length < 12 ? (
            <button type="button" className="sh-ex" onClick={() => setGames((prev) => [...prev, ''])}>
              <span className="sh-ex-name">{t.addGame}</span>
            </button>
          ) : null}
          <div>
            <button type="button" className="sh-ex" onClick={save} disabled={busy} data-testid="sh-season-save">
              <span className="sh-ex-name">✓ {t.save}</span>
            </button>
            <button type="button" className="sh-ex" onClick={() => setEditing(false)} disabled={busy}>
              <span className="sh-ex-name">{t.cancel}</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
