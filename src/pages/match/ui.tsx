import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { matchApi } from "../../entities/match/api";
import { matchEventApi } from "../../entities/match/events-api";
import type { MatchEvent, MatchEventType } from "../../entities/match/model";
import { isShootoutEvent } from "../../entities/match/model";
import { teamApi } from "../../entities/team/api";
import type { Player } from "../../entities/team/model";
import { useQuery } from "../../shared/api/use-query";
import { Confirm, ErrorNotice, Loading, Logo, PageHeading, Status } from "../../shared/ui";
import { EditMatchDialog } from "./edit-match-dialog";

const eventLabels: Record<MatchEventType, string> = {
  GOAL: "Гол",
  OWN_GOAL: "Автогол",
  YELLOW_CARD: "Жёлтая карточка",
  RED_CARD: "Красная карточка",
  SHOOTOUT_GOAL: "Забил пенальти",
  SHOOTOUT_MISS: "Не забил пенальти",
};

const statusLabels = { CREATED: "Запланирован", LIVE: "Идёт", PENALTY_SHOOTOUT: "Серия пенальти", FINISHED: "Завершён", CANCELLED: "Отменён" };

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
  const [editMatchOpen, setEditMatchOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<MatchEvent | null>(null);
  const [teamId, setTeamId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [assistPlayerId, setAssistPlayerId] = useState("");
  const [eventType, setEventType] = useState<MatchEventType>("GOAL");
  const [minute, setMinute] = useState("1");
  const [saving, setSaving] = useState(false);
  const [eventError, setEventError] = useState<unknown>();
  const [finishing, setFinishing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [confirmStart, setConfirmStart] = useState(false);
  const [startError, setStartError] = useState<unknown>();
  const [finishError, setFinishError] = useState<unknown>();
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [startingShootout, setStartingShootout] = useState(false);
  const [shootoutError, setShootoutError] = useState<unknown>();
  const [deleteEvent, setDeleteEvent] = useState<MatchEvent | null>(null);
  const eventDialogRef = useRef<HTMLDialogElement>(null);
  const playerTeamId = eventType === "OWN_GOAL" && match
    ? teamId === match.teamId1 ? match.teamId2 : match.teamId1
    : teamId;
  const availablePlayers = useMemo(() => players.filter((player) => player.teamId === playerTeamId), [players, playerTeamId]);
  const availableAssistPlayers = useMemo(() => availablePlayers.filter((player) => player.id !== playerId), [availablePlayers, playerId]);
  const home = match?.team1?.name ?? `Команда ${match?.teamId1 ?? "1"}`;
  const away = match?.team2?.name ?? `Команда ${match?.teamId2 ?? "2"}`;
  const allEvents = match?.events ?? [];
  const events = allEvents.filter((event) => !event.linkedEventId && !isShootoutEvent(event)).sort((a, b) => (b.minute ?? 0) - (a.minute ?? 0));
  const shootoutEvents = allEvents.filter(isShootoutEvent).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const inShootout = match?.status === "PENALTY_SHOOTOUT";
  const canEditEvents = match?.status === "CREATED" || match?.status === "LIVE" || inShootout;
  const canStartShootout = match?.status === "LIVE" && match.isPlayOff === true && match.homeScore === match.awayScore;
  const canFinishShootout = inShootout && match.homePenaltyScore != null && match.awayPenaltyScore != null && match.homePenaltyScore !== match.awayPenaltyScore;
  const shootoutForm = isShootoutEvent({ type: eventType });
  const formEventTypes = Object.entries(eventLabels).filter(([type]) => isShootoutEvent({ type: type as MatchEventType }) === inShootout);

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
    if (!match || !canEditEvents) return;
    setEditingEvent(null);
    setTeamId(match.teamId1);
    setPlayerId("");
    setAssistPlayerId("");
    setEventType(inShootout ? "SHOOTOUT_GOAL" : "GOAL");
    setMinute("1");
    setEventError(undefined);
    setFormOpen(true);
  }

  function openEditEvent(event: MatchEvent) {
    if (!canEditEvents || isShootoutEvent(event) !== inShootout) return;
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
    if (!match || saving || !canEditEvents || shootoutForm !== inShootout) return;
    if (!playerId && !shootoutForm) {
      setEventError(new Error("Выберите игрока для события."));
      return;
    }
    setSaving(true);
    setEventError(undefined);
    const body = {
      matchId: match.id,
      teamId,
      playerId: playerId || null,
      ...(shootoutForm ? { assistPlayerId: null } : eventType === "GOAL" && assistPlayerId ? { assistPlayerId } : {}),
      type: eventType,
      minute: shootoutForm ? null : Number(minute),
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

  async function startMatch() {
    if (!match || match.status !== "CREATED" || starting) return;
    setStarting(true);
    setStartError(undefined);
    try {
      await matchApi.start(match.id);
      setConfirmStart(false);
      query.reload();
    } catch (error) {
      setStartError(error);
    } finally {
      setStarting(false);
    }
  }

  async function finishMatch() {
    if (!match || finishing || (inShootout && !canFinishShootout)) return;
    setFinishing(true);
    setFinishError(undefined);
    try {
      await matchApi.finish(match.id);
      query.reload();
      setConfirmFinish(false);
    } catch (error) {
      setFinishError(error);
      setConfirmFinish(false);
      query.reload();
    } finally {
      setFinishing(false);
    }
  }

  async function startShootout() {
    if (!match || !canStartShootout || startingShootout || finishing) return;
    setStartingShootout(true);
    setShootoutError(undefined);
    try {
      await matchApi.startShootout(match.id);
    } catch (error) {
      setShootoutError(error);
    } finally {
      query.reload();
      setStartingShootout(false);
    }
  }

  async function removeEvent() {
    if (!deleteEvent || saving || !canEditEvents) return;
    setSaving(true);
    setEventError(undefined);
    try {
      await matchEventApi.delete(deleteEvent.id);
      setDeleteEvent(null);
      query.reload();
    } catch (error) {
      setEventError(error);
    } finally {
      setSaving(false);
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
      <ErrorNotice error={shootoutError} />
      <ErrorNotice error={finishError} />
      {query.loading ? <Loading /> : match ? (
        <>
          <section className="surface match-score-card" aria-label="Счёт матча">
            <div className={`match-score-status ${match.status === "LIVE" ? "is-live" : ""}`}>
              <Status value={match.status} label={match.status === "LIVE" ? "LIVE" : statusLabels[match.status]} />
            </div>
            <div className="match-score-teams">
              <div className={`match-score-team ${match.winnerTeamId === match.teamId1 ? "match-winner" : ""}`}>
                <Logo name={home} url={match.team1?.logoUrl} />
                <strong>{home}</strong>
                {match.winnerTeamId === match.teamId1 && <span>Победитель</span>}
                {match.team1?.shortName && <span className="muted">{match.team1.shortName}</span>}
              </div>
              <strong className="match-score">{match.homeScore} : {match.awayScore}</strong>
              <div className={`match-score-team ${match.winnerTeamId === match.teamId2 ? "match-winner" : ""}`}>
                <Logo name={away} url={match.team2?.logoUrl} />
                <strong>{away}</strong>
                {match.winnerTeamId === match.teamId2 && <span>Победитель</span>}
                {match.team2?.shortName && <span className="muted">{match.team2.shortName}</span>}
              </div>
            </div>
            <p className="muted match-time">{match.startedAt ? `Начало: ${dateTime(match.startedAt)}` : `По расписанию: ${dateTime(match.scheduledAt)}`}</p>
            {match.homePenaltyScore != null && match.awayPenaltyScore != null ? (
              <p className="match-penalty-score">Пенальти: {match.homePenaltyScore} : {match.awayPenaltyScore}</p>
            ) : inShootout && <p className="match-penalty-score">Серия пенальти — ожидается первый удар</p>}
            {(match.liveUrl || match.status === "CREATED") && (
              <div className="match-details-actions">
                {match.liveUrl && <a href={match.liveUrl} target="_blank" rel="noreferrer" className="button secondary full-width">Открыть трансляцию</a>}
                {match.status === "CREATED" && (
                  <>
                    <button type="button" className="button secondary full-width" disabled={starting} onClick={() => setEditMatchOpen(true)}>
                      Редактировать матч
                    </button>
                    <button type="button" className="button primary full-width" disabled={starting} onClick={() => { setStartError(undefined); setConfirmStart(true); }}>
                      {starting ? "Запускаем…" : "СТАРТ"}
                    </button>
                  </>
                )}
              </div>
            )}
            {canStartShootout && (
              <div className="match-details-actions">
                <button type="button" className="button primary full-width" disabled={startingShootout || finishing} onClick={() => void startShootout()}>
                  {startingShootout ? "Запускаем серию…" : "Начать серию пенальти"}
                </button>
              </div>
            )}
            {(match.status === "LIVE" || inShootout) && (
              <div className="match-finish-action">
                <button type="button" className="button danger full-width" disabled={finishing || startingShootout || (inShootout && !canFinishShootout)} onClick={() => setConfirmFinish(true)}>
                  {finishing ? "Завершаем матч…" : "Завершить матч"}
                </button>
              </div>
            )}
          </section>

          <section className="surface match-events-card">
            <div className="list-heading">
              <div><h2>События матча</h2><span className="muted">{events.length + shootoutEvents.length}</span></div>
              {canEditEvents && <button type="button" className="button primary" onClick={openNewEvent}>Добавить событие</button>}
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
                    {canEditEvents && !inShootout && <button type="button" className="button secondary match-event-edit" onClick={() => openEditEvent(event)}>Изменить</button>}
                  </li>;
                })}
              </ol>
            ) : <p className="muted match-events-empty">Событий пока нет.</p>}
            {(inShootout || shootoutEvents.length > 0) && (
              <section className="match-shootout-events" aria-label="Серия пенальти">
                <h3>Серия пенальти</h3>
                <ol className="match-event-list">
                  {shootoutEvents.map((event) => {
                    const player = players.find((candidate) => candidate.id === event.playerId);
                    return (
                      <li className="match-shootout-event" key={event.id}>
                        <span className={event.type === "SHOOTOUT_GOAL" ? "shootout-goal" : "shootout-miss"} aria-hidden="true">{event.type === "SHOOTOUT_GOAL" ? "✓" : "✕"}</span>
                        <div>
                          <strong>{event.teamId === match.teamId1 ? home : away} — {eventLabels[event.type]}</strong>
                          {event.playerId && <p className="muted">{player ? `${player.firstName} ${player.lastName}` : `Игрок ${event.playerId}`}</p>}
                        </div>
                        {canEditEvents && inShootout && (
                          <div className="match-shootout-actions">
                            <button type="button" className="button secondary" onClick={() => openEditEvent(event)}>Изменить</button>
                            <button type="button" className="button danger" onClick={() => { setEventError(undefined); setDeleteEvent(event); }}>Удалить</button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}
          </section>
          {formOpen && canEditEvents && (
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
                <label className="match-form-field">Игрок <span className="muted">{shootoutForm ? "(необязательно)" : "(обязательно)"}</span>
                  <select required={!shootoutForm} value={playerId} onChange={(event) => { setPlayerId(event.target.value); if (event.target.value === assistPlayerId) setAssistPlayerId(""); }}>
                    <option value="">{shootoutForm ? "Без игрока" : "Выберите игрока"}</option>
                    {availablePlayers.map((player) => <option key={player.id} value={player.id}>{player.firstName} {player.lastName}{player.shirtNumber != null ? ` · №${player.shirtNumber}` : ""}</option>)}
                  </select>
                </label>
                <label className="match-form-field">Тип события
                  <select required value={eventType} onChange={(event) => { setEventType(event.target.value as MatchEventType); setPlayerId(""); setAssistPlayerId(""); }}>
                    {formEventTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
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
                {!shootoutForm && <label className="match-form-field">Минута
                  <input required type="number" min="0" max="130" value={minute} onChange={(event) => setMinute(event.target.value)} />
                </label>}
                <ErrorNotice error={eventError} />
                <div className="dialog-actions">
                  <button type="button" className="button secondary" disabled={saving} onClick={() => setFormOpen(false)}>Отмена</button>
                  <button type="submit" className="button primary" disabled={saving}>{saving ? "Сохраняем…" : editingEvent ? "Сохранить" : "Добавить"}</button>
                </div>
              </form>
            </dialog>
          )}
          {editMatchOpen && match.status === "CREATED" && (
            <EditMatchDialog match={match} onClose={() => setEditMatchOpen(false)} onSaved={query.reload} />
          )}
          {confirmStart && (
            <Confirm
              title="Начать матч?"
              busy={starting}
              tone="primary"
              confirmLabel="Да, начать матч"
              busyLabel="Запускаем…"
              onClose={() => setConfirmStart(false)}
              onConfirm={() => void startMatch()}
            >
              <p>Вы уверены, что хотите начать матч?</p>
              <ErrorNotice error={startError} />
            </Confirm>
          )}
          {deleteEvent && canEditEvents && (
            <Confirm title="Удалить удар?" busy={saving} confirmLabel="Удалить" busyLabel="Удаляем…"
              onClose={() => setDeleteEvent(null)} onConfirm={() => void removeEvent()}>
              <p>Удалить этот удар из серии пенальти?</p>
              <ErrorNotice error={eventError} />
            </Confirm>
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
