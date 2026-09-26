import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, CheckCircle2, Shuffle } from "lucide-react";
import { groupApi } from "../../entities/group/api";
import {
  groupStatusLabels,
  type GroupWithStatistics,
  type GroupStatus,
} from "../../entities/group/model";
import { useQuery } from "../../shared/api/use-query";
import { Confirm, Empty, ErrorNotice, Loading, Status } from "../../shared/ui";
import { GroupStandings } from "./standings";
export function TournamentGroupsPage() {
  const { tournamentId = "" } = useParams();
  const [status, setStatus] = useState<GroupStatus | "">("");
  const [finish, setFinish] = useState<GroupWithStatistics>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [message, setMessage] = useState("");
  const query = useQuery(
    useCallback(
      (signal: AbortSignal) => groupApi.standings(tournamentId, signal),
      [tournamentId],
    ),
  );
  const groups =
    query.data
      ?.filter((group) => !status || group.status === status)
      .sort((a, b) => a.groupOrder - b.groupOrder) ?? [];
  async function confirmFinish() {
    if (!finish || busy || finish.status === "FINISHED") return;
    setBusy(true);
    setError(undefined);
    try {
      await groupApi.finish(finish.id);
      setMessage(`Группа «${finish.name}» завершена.`);
      setFinish(undefined);
      query.reload();
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="list-heading">
        <h2>Группы турнира</h2>
        <Link
          className="button primary"
          to={`/tournaments/${tournamentId}/draw`}
        >
          <Shuffle size={17} />
          Жеребьевка
        </Link>
      </div>
      <label className="filter-label">
        Статус группы
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as GroupStatus | "")}
        >
          <option value="">Все группы</option>
          {Object.entries(groupStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      <ErrorNotice error={query.error} retry={query.reload} />
      {query.loading ? (
        <Loading />
      ) : (
        <div className="group-standings-grid">
          {groups.map((group) => (
            <article className="surface group-card" key={group.id}>
              <div className="group-title">
                <span className="group-symbol">
                  {group.name?.slice(0, 1) || "Г"}
                </span>
                <Status
                  value={group.status}
                  label={groupStatusLabels[group.status]}
                />
              </div>
              <h3>{group.name}</h3>
              <p className="muted group-stage-label">
                {group.isPlayOff ? "Плей-офф" : "Групповой этап"} · Команд:{" "}
                {group.teams.length}
              </p>
              <GroupStandings group={group} />
              <Link
                className="button secondary full-width"
                to={`/tournaments/${tournamentId}/groups/${group.id}`}
              >
                Посмотреть команды
                <ArrowRight size={17} />
              </Link>
              <button
                className="button primary full-width finish-group-button"
                disabled={busy || group.status === "FINISHED"}
                onClick={() => {
                  setError(undefined);
                  setFinish(group);
                }}
              >
                <CheckCircle2 size={16} />
                {group.status === "FINISHED"
                  ? "Группа завершена"
                  : "Завершить группу"}
              </button>
            </article>
          ))}
        </div>
      )}
      {query.data && groups.length === 0 && (
        <Empty>
          {status
            ? "Групп с выбранным статусом нет."
            : "Группы ещё не созданы на сервере. После их создания здесь можно будет провести жеребьевку."}
        </Empty>
      )}
      {finish && (
        <Confirm
          title={`Завершить «${finish.name}»?`}
          busy={busy}
          onClose={() => setFinish(undefined)}
          onConfirm={confirmFinish}
          confirmLabel="Да, завершить группу"
          busyLabel="Завершаем…"
          tone="primary"
        >
          <p>
            Вы точно уверены? Группа будет завершена. Её состав и статистика
            сохранятся, а команды, не участвующие в других активных группах,
            станут доступны для следующей жеребьевки.
          </p>
          <ErrorNotice error={error} />
        </Confirm>
      )}
    </>
  );
}
