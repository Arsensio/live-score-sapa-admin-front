import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, X } from "lucide-react";
import { matchApi } from "../../entities/match/api";
import type { MatchStatus } from "../../entities/match/model";
import { teamApi } from "../../entities/team/api";
import type { Team } from "../../entities/team/model";
import { useQuery } from "../../shared/api/use-query";
import { Confirm, ErrorNotice, Loading, Logo } from "../../shared/ui";

function localDateTimeValue() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function matchDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value.replace("T", " ")
    : date.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export function GroupMatches({
  groupId,
  groupName,
  status,
  teamDetails = {},
}: {
  groupId: string;
  groupName: string;
  status?: MatchStatus;
  teamDetails?: Record<string, { name: string; logoUrl: string | null }>;
}) {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [startingMatchId, setStartingMatchId] = useState<string | null>(null);
  const [confirmStartMatchId, setConfirmStartMatchId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<unknown>();
  const [createError, setCreateError] = useState<unknown>();
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamsError, setTeamsError] = useState<unknown>();
  const [teamsRevision, setTeamsRevision] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const matchesQuery = useQuery(
    useCallback(
      (signal: AbortSignal) => matchApi.byGroup(groupId, status, signal),
      [groupId, status],
    ),
  );
  const [teamId1, setTeamId1] = useState("");
  const [teamId2, setTeamId2] = useState("");
  const [scheduledAt, setScheduledAt] = useState(localDateTimeValue);
  const [liveUrl, setLiveUrl] = useState("");

  useEffect(() => {
    if (!createOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.showModal();
    return () => previous?.focus();
  }, [createOpen]);

  useEffect(() => {
    if (!createOpen) return;
    const controller = new AbortController();
    setTeamsLoading(true);
    setTeamsError(undefined);
    teamApi.inGroup(groupId, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setTeams(result);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setTeamsError(error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setTeamsLoading(false);
      });
    return () => controller.abort();
  }, [createOpen, groupId, teamsRevision]);

  async function createMatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !teamId1 || !teamId2 || teamId1 === teamId2 || !scheduledAt) return;
    setSaving(true);
    setCreateError(undefined);
    try {
      const normalizedLiveUrl = liveUrl.trim();
      await matchApi.create({
        groupId,
        teamId1,
        teamId2,
        scheduledAt,
        ...(normalizedLiveUrl ? { liveUrl: normalizedLiveUrl } : {}),
      });
      setCreateOpen(false);
      setTeamId1("");
      setTeamId2("");
      setScheduledAt(localDateTimeValue());
      setLiveUrl("");
      matchesQuery.reload();
    } catch (error) {
      setCreateError(error);
    } finally {
      setSaving(false);
    }
  }

  async function startMatch(matchId: string) {
    if (startingMatchId) return;
    setStartingMatchId(matchId);
    setActionError(undefined);
    try {
      await matchApi.start(matchId);
      setConfirmStartMatchId(null);
      navigate(`/matches/${encodeURIComponent(matchId)}`);
    } catch (error) {
      setActionError(error);
    } finally {
      setStartingMatchId(null);
    }
  }

  return (
    <section className="group-matches" aria-label={`Матчи: ${groupName}`}>
      <div className="group-matches-heading">
        <h4>Матчи</h4>
        <button
          type="button"
          className="button secondary create-match-button"
          onClick={() => {
            setCreateError(undefined);
            setCreateOpen(true);
          }}
        >
          <Plus size={16} /> Создать матч
        </button>
      </div>
      <ErrorNotice error={matchesQuery.error} retry={matchesQuery.reload} />
      <ErrorNotice error={actionError} />
      {matchesQuery.loading ? (
        <Loading />
      ) : matchesQuery.data?.content.length ? (
        <ul className="group-match-list">
          {matchesQuery.data.content.map((match) => (
            <li className="group-match" key={match.id}>
              <span className="group-match-date">{matchDate(match.scheduledAt)}</span>
              <div className="group-match-teams">
                <span className="group-match-team">
                  <Logo
                    name={match.team1?.name ?? teamDetails[match.teamId1]?.name ?? "Команда 1"}
                    url={match.team1?.logoUrl ?? teamDetails[match.teamId1]?.logoUrl ?? null}
                  />
                  <span>{match.team1?.name ?? teamDetails[match.teamId1]?.name ?? "Команда 1"}</span>
                </span>
                <strong>{match.homeScore} : {match.awayScore}</strong>
                <span className="group-match-team group-match-team-away">
                  <span>{match.team2?.name ?? teamDetails[match.teamId2]?.name ?? "Команда 2"}</span>
                  <Logo
                    name={match.team2?.name ?? teamDetails[match.teamId2]?.name ?? "Команда 2"}
                    url={match.team2?.logoUrl ?? teamDetails[match.teamId2]?.logoUrl ?? null}
                  />
                </span>
              </div>
              {match.homePenaltyScore != null && match.awayPenaltyScore != null && (
                <p className="match-penalty-score">Пенальти: {match.homePenaltyScore} : {match.awayPenaltyScore}</p>
              )}
              {match.status === "CREATED" ? (
                <>
                  <Link className="button secondary full-width match-start-button" to={`/matches/${encodeURIComponent(match.id)}`}>
                    Открыть матч
                  </Link>
                  <button
                    type="button"
                    className="button primary full-width match-start-button"
                    disabled={startingMatchId !== null}
                  onClick={() => { setActionError(undefined); setConfirmStartMatchId(match.id); }}
                  >
                    {startingMatchId === match.id ? "Запускаем…" : "СТАРТ"}
                  </button>
                </>
              ) : match.status === "LIVE" || match.status === "PENALTY_SHOOTOUT" ? (
                <Link className="button match-manage-button full-width match-start-button" to={`/matches/${encodeURIComponent(match.id)}`}>
                  Управлять матчем
                </Link>
              ) : (
                <Link className="button secondary full-width match-start-button" to={`/matches/${encodeURIComponent(match.id)}`}>
                  Открыть матч
                </Link>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted group-matches-empty">Матчей пока нет.</p>
      )}

      {confirmStartMatchId && (
        <Confirm
          title="Начать матч?"
          busy={startingMatchId !== null}
          tone="primary"
          confirmLabel="Да, начать матч"
          busyLabel="Запускаем…"
          onClose={() => setConfirmStartMatchId(null)}
          onConfirm={() => void startMatch(confirmStartMatchId)}
        >
          <p>Вы уверены, что хотите начать матч?</p>
          <ErrorNotice error={actionError} />
        </Confirm>
      )}
      {createOpen && (
        <dialog
          ref={dialogRef}
          className="dialog"
          onCancel={(event) => {
            event.preventDefault();
            if (!saving) setCreateOpen(false);
          }}
        >
          <form onSubmit={createMatch}>
            <div className="dialog-heading">
              <h2>Создать матч · {groupName}</h2>
              <button
                className="icon-button"
                type="button"
                aria-label="Закрыть"
                disabled={saving}
                onClick={() => setCreateOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            <ErrorNotice
              error={teamsError}
              retry={() => setTeamsRevision((revision) => revision + 1)}
            />
            {teamsLoading ? (
              <Loading />
            ) : teams.length < 2 ? (
              <p className="muted">Для создания матча в группе должны быть минимум две команды.</p>
            ) : (
              <>
                <label className="match-form-field">
                  Первая команда
                  <select required value={teamId1} onChange={(event) => setTeamId1(event.target.value)}>
                    <option value="">Выберите команду</option>
                    {teams.map((team: Team) => (
                      <option key={team.id} value={team.id} disabled={team.id === teamId2}>{team.name}</option>
                    ))}
                  </select>
                </label>
                <label className="match-form-field">
                  Вторая команда
                  <select required value={teamId2} onChange={(event) => setTeamId2(event.target.value)}>
                    <option value="">Выберите команду</option>
                    {teams.map((team: Team) => (
                      <option key={team.id} value={team.id} disabled={team.id === teamId1}>{team.name}</option>
                    ))}
                  </select>
                </label>
                <label className="match-form-field">
                  Дата и время
                  <input required type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
                </label>
                <label className="match-form-field">
                  Ссылка на YouTube-трансляцию <span className="muted">(необязательно)</span>
                  <input
                    type="url"
                    inputMode="url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={liveUrl}
                    onChange={(event) => setLiveUrl(event.target.value)}
                  />
                </label>
              </>
            )}
            <ErrorNotice error={createError} />
            <div className="dialog-actions">
              <button type="button" className="button secondary" disabled={saving} onClick={() => setCreateOpen(false)}>Отмена</button>
              <button type="submit" className="button primary" disabled={saving || teamsLoading || teams.length < 2}>
                {saving ? "Создаём…" : "Создать матч"}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </section>
  );
}
