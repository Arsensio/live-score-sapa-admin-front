import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { matchApi } from "../../entities/match/api";
import { matchEventApi } from "../../entities/match/events-api";
import type { MatchEvent, MatchEventType } from "../../entities/match/model";
import { teamApi } from "../../entities/team/api";
import type { Player } from "../../entities/team/model";
import { useQuery } from "../../shared/api/use-query";
import { Confirm, ErrorNotice, Loading, Logo, PageHeading, Status } from "../../shared/ui";

const eventLabels: Record<MatchEventType, string> = {
  GOAL: "Гол",
  OWN_GOAL: "Автогол",
  YELLOW_CARD: "Жёлтая карточка",
  RED_CARD: "Красная карточка",
};

const statusLabels = { CREATED: "Запланирован", LIVE: "Идёт", FINISHED: "Завершён" };

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ru-RU", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function MatchPage() {
  const { matchId = "" } = useParams();
  const query = useQuery(useCallback(
    (signal: AbortSignal) => matchApi.byId(matchId, signal),
    [matchId],
  ));
  const match = query.data;
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerLoadError, setPlayerLoadError] = useState<unknown>();
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<MatchEvent | null>(null);
  const [teamId, setTeamId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [assistPlayerId, setAssistPlayerId] = useState("");
  const [eventType, setEventType] = useState<MatchEventType>("GOAL");
  const [minute, setMinute] = useState("1");
  const [saving, setSaving] = useState(false);
  const [eventError, setEventError] = useState<unknown>();
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<unknown>();
  const [confirmFinish, setConfirmFinish] = useState(false);
  const eventDialogRef = useRef<HTMLDialogElement>(null);
  const playerTeamId = eventType === "OWN_GOAL" && match
    ? teamId === match.teamId1 ? match.teamId2 : match.teamId1
    : teamId;
  const availablePlayers = useMemo(() => players.filter((player) => player.teamId === playerTeamId), [players, playerTeamId]);
  const availableAssistPlayers = useMemo(() => availablePlayers.filter((player) => player.id !== playerId), [availablePlayers, playerId]);
  const home = match?.team1?.name ?? `Команда ${match?.teamId1 ?? "1"}`;
  const away = match?.team2?.name ?? `Команда ${match?.teamId2 ?? "2"}`;
  const allEvents = match?.events ?? [];
  const events = allEvents.filter((event) => !event.linkedEventId).slice().sort((a, b) => b.minute - a.minute);

  useEffect(() => {
    if (!match) return;
    const controller = new AbortController();
    setPlayerLoadError(undefined);
    Promise.allSettled([
      teamApi.get(match.teamId1, controller.signal),
      teamApi.get(match.teamId2, controller.signal),
    ]).then((results) => {
      if (controller.signal.aborted) return;
      const loaded = results.flatMap((result) => result.status === "fulfilled" ? result.value.players ?? [] : []);
      setPlayers(loaded);
      if (results.every((result) => result.status === "rejected")) setPlayerLoadError(results[0].status === "rejected" ? results[0].reason : undefined);
    });
    return () => controller.abort();
  }, [match?.teamId1, match?.teamId2]);

  useEffect(() => {
    if (!formOpen) return;
    eventDialogRef.current?.showModal();
  }, [formOpen]);

  function openNewEvent() {
    if (!match) return;
    setEditingEvent(null);
    setTeamId(match.teamId1);
    setPlayerId("");
    setAssistPlayerId("");
    setEventType("GOAL");
    setMinute("1");
    setEventError(undefined);
    setFormOpen(true);
  }

  function openEditEvent(event: MatchEvent) {
    setEditingEvent(event);
    setTeamId(event.teamId);
    setPlayerId(event.playerId ?? "");
    setAssistPlayerId(
      allEvents.find((candidate) => candidate.linkedEventId === event.id)?.playerId
        ?? event.assistPlayerId
        ?? "",
    );
    setEventType(event.type);
    setMinute(String(event.minute));
    setEventError(undefined);
    setFormOpen(true);
  }

  async function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!match || saving) return;
    setSaving(true);
    setEventError(undefined);
    const body = {
      matchId: match.id,
      teamId,
      playerId: playerId || null,
      ...(eventType === "GOAL" && assistPlayerId ? { assistPlayerId } : {}),
      type: eventType,
      minute: Number(minute),
    };
    try {
      if (editingEvent) await matchEventApi.update(editingEvent.id, body);
      else await matchEventApi.create(body);
      setFormOpen(false);
      await query.reload();
    } catch (error) {
      setEventError(error);
    } finally {
      setSaving(false);
    }
  }

  async function finishMatch() {
    if (!match || finishing) return;
    setFinishing(true);
    setFinishError(undefined);
    try {
      await matchApi.finish(match.id);
      query.reload();
      setConfirmFinish(false);
    } catch (error) {
      setFinishError(error);
    } finally {
      setFinishing(false);
    }
  }

  return (
    <main className="container match-page">
      <PageHeading
        title="Детали матча"
        description={match ? dateTime(match.scheduledAt) : undefined}
        back={match ? `/tournaments/${encodeURIComponent(match.tournamentId)}/matches` : "/tournaments"}
      />
      <ErrorNotice error={query.error} retry={query.reload} />
      {query.loading ? <Loading /> : match ? (
        <>
          <section className="surface match-score-card" aria-label="Счёт матча">
            <div className={`match-score-status ${match.status === "LIVE" ? "is-live" : ""}`}>
              <Status value={match.status} label={match.status === "LIVE" ? "LIVE" : statusLabels[match.status]} />
            </div>
            <div className="match-score-teams">
              <div className="match-score-team">
                <Logo name={home} url={match.team1?.logoUrl} />
                <strong>{home}</strong>
                {match.team1?.shortName && <span className="muted">{match.team1.shortName}</span>}
              </div>
              <strong className="match-score">{match.homeScore} : {match.awayScore}</strong>
              <div className="match-score-team">
                <Logo name={away} url={match.team2?.logoUrl} />
                <strong>{away}</strong>
                {match.team2?.shortName && <span className="muted">{match.team2.shortName}</span>}
              </div>
            </div>
            <p className="muted match-time">{match.startedAt ? `Начало: ${dateTime(match.startedAt)}` : `По расписанию: ${dateTime(match.scheduledAt)}`}</p>
            {match.status === "LIVE" && (
              <div className="match-finish-action">
                <ErrorNotice error={finishError} />
                <button type="button" className="button danger full-width" disabled={finishing} onClick={() => setConfirmFinish(true)}>
                  {finishing ? "Завершаем матч…" : "Завершить матч"}
                </button>
              </div>
            )}
          </section>

          <section className="surface match-events-card">
            <div className="list-heading">
              <div><h2>События матча</h2><span className="muted">{events.length}</span></div>
              <button type="button" className="button primary" onClick={openNewEvent}>Добавить событие</button>
            </div>
            <ErrorNotice error={playerLoadError} />
            {events.length ? (
              <ol className="match-event-list">
                {events.map((event) => {
                  const teamName = event.teamId === match.teamId1 ? home : event.teamId === match.teamId2 ? away : "Команда";
                  const isHomeEvent = event.teamId === match.teamId1;
                  const player = players.find((candidate) => candidate.id === event.playerId);
                  const assistEvent = event.type === "GOAL"
                    ? allEvents.find((candidate) => candidate.linkedEventId === event.id)
                    : undefined;
                  const assistPlayer = assistEvent?.playerId
                    ? players.find((candidate) => candidate.id === assistEvent.playerId)
                    : undefined;
                  return <li className={`match-event ${isHomeEvent ? "match-event-home" : "match-event-away"}`} key={event.id}>
                    <span className="match-event-minute">{event.minute}′</span>
                    <div className="match-event-details">
                      {event.type === "GOAL" || event.type === "OWN_GOAL" ? (
                        <span className="match-event-ball" aria-hidden="true">⚽</span>
                      ) : (
                        <span className={`match-event-card-icon match-event-card-${event.type.toLowerCase()}`} aria-hidden="true" />
                      )}
                      <div>
                        <strong>{eventLabels[event.type] ?? event.type}</strong>
                        <span className="muted">{teamName}{event.playerId ? ` · ${player ? `${player.firstName} ${player.lastName}` : `игрок ${event.playerId}`}` : " · без игрока"}</span>
                        {assistEvent && <span className="muted">({assistPlayer ? `${assistPlayer.firstName} ${assistPlayer.lastName}` : assistEvent.playerId ? `игрок ${assistEvent.playerId}` : "ассист"})</span>}
                      </div>
                    </div>
                    <button type="button" className="button secondary match-event-edit" onClick={() => openEditEvent(event)}>Изменить</button>
                  </li>;
                })}
              </ol>
            ) : <p className="muted match-events-empty">Событий пока нет.</p>}
          </section>
          {formOpen && (
            <dialog ref={eventDialogRef} className="dialog match-event-dialog" onCancel={(event) => { event.preventDefault(); if (!saving) setFormOpen(false); }}>
              <form onSubmit={saveEvent}>
                <div className="dialog-heading">
                  <h2>{editingEvent ? "Изменить событие" : "Добавить событие"}</h2>
                  <button type="button" className="icon-button" aria-label="Закрыть" disabled={saving} onClick={() => setFormOpen(false)}>×</button>
                </div>
                <label className="match-form-field">Команда
                  <select required value={teamId} onChange={(event) => { setTeamId(event.target.value); setPlayerId(""); setAssistPlayerId(""); }}>
                    <option value={match.teamId1}>{home}</option>
                    <option value={match.teamId2}>{away}</option>
                  </select>
                </label>
                <label className="match-form-field">Игрок <span className="muted">(необязательно)</span>
                  <select value={playerId} onChange={(event) => { setPlayerId(event.target.value); if (event.target.value === assistPlayerId) setAssistPlayerId(""); }}>
                    <option value="">Без игрока</option>
                    {availablePlayers.map((player) => <option key={player.id} value={player.id}>{player.firstName} {player.lastName}{player.shirtNumber != null ? ` · №${player.shirtNumber}` : ""}</option>)}
                  </select>
                </label>
                <label className="match-form-field">Тип события
                  <select required value={eventType} onChange={(event) => { setEventType(event.target.value as MatchEventType); setPlayerId(""); setAssistPlayerId(""); }}>
                    {Object.entries(eventLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                {eventType === "GOAL" && (
                  <label className="match-form-field">Ассист <span className="muted">(необязательно)</span>
                    <select value={assistPlayerId} onChange={(event) => setAssistPlayerId(event.target.value)}>
                      <option value="">Без ассиста</option>
                      {availableAssistPlayers.map((player) => <option key={player.id} value={player.id}>{player.firstName} {player.lastName}{player.shirtNumber != null ? ` · №${player.shirtNumber}` : ""}</option>)}
                    </select>
                  </label>
                )}
                <label className="match-form-field">Минута
                  <input required type="number" min="0" max="130" value={minute} onChange={(event) => setMinute(event.target.value)} />
                </label>
                <ErrorNotice error={eventError} />
                <div className="dialog-actions">
                  <button type="button" className="button secondary" disabled={saving} onClick={() => setFormOpen(false)}>Отмена</button>
                  <button type="submit" className="button primary" disabled={saving}>{saving ? "Сохраняем…" : editingEvent ? "Сохранить" : "Добавить"}</button>
                </div>
              </form>
            </dialog>
          )}
          {confirmFinish && (
            <Confirm
              title="Завершить матч?"
              busy={finishing}
              confirmLabel="Да, завершить"
              busyLabel="Завершаем…"
              onClose={() => setConfirmFinish(false)}
              onConfirm={() => void finishMatch()}
            >
              <p>Вы уверены, что хотите завершить матч?</p>
              <ErrorNotice error={finishError} />
            </Confirm>
          )}
        </>
      ) : null}
    </main>
  );
}
