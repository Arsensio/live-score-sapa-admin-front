import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  RotateCcw,
  Search,
  Shuffle,
  Users,
} from "lucide-react";
import { groupApi } from "../../entities/group/api";
import { groupStatusLabels } from "../../entities/group/model";
import { teamApi } from "../../entities/team/api";
import { ApiError } from "../../shared/api/client";
import { useQuery } from "../../shared/api/use-query";
import {
  Confirm,
  Empty,
  ErrorNotice,
  Loading,
  Logo,
  Status,
} from "../../shared/ui";
import { submitDraw } from "./api";

export function DrawPage() {
  const { tournamentId = "", groupId } = useParams();
  return (
    <DrawWorkspace
      key={`${tournamentId}/${groupId ?? "groups"}`}
      tournamentId={tournamentId}
      groupId={groupId}
    />
  );
}

function DrawWorkspace({
  tournamentId,
  groupId,
}: {
  tournamentId: string;
  groupId?: string;
}) {
  const [selection, setSelection] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<unknown>();
  const [resetError, setResetError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [success, setSuccess] = useState("");
  const root = `/tournaments/${tournamentId}/draw`;
  const query = useQuery(
    useCallback(
      async (signal: AbortSignal) => {
        const [teams, groups] = await Promise.all([
          teamApi.list(tournamentId, signal),
          groupApi.list(tournamentId, undefined, signal),
        ]);
        if (groupId && !groups.some((g) => g.id === groupId))
          throw new Error("Группа не найдена в этом турнире.");
        const memberships = groups.map((group) => {
          if (!Array.isArray(group.teams))
            throw new Error(
              "Сервер не вернул состав группы. Обновите данные перед жеребьевкой.",
            );
          return {
            group,
            teams: group.teams.map((team) => ({
              id: team.teamId,
              name: team.teamName,
              shortName: team.teamShortName,
              logoUrl: team.teamLogoUrl,
            })),
          };
        });
        memberships.sort(
          (a, b) =>
            (a.group.groupOrder ?? Number.MAX_SAFE_INTEGER) -
              (b.group.groupOrder ?? Number.MAX_SAFE_INTEGER) ||
            a.group.name.localeCompare(b.group.name, "ru", { numeric: true }),
        );
        return { teams, memberships };
      },
      [tournamentId, groupId],
    ),
  );
  useEffect(() => {
    setSelection([]);
  }, [query.data]);

  const current = query.data?.memberships.find((m) => m.group.id === groupId);
  const assigned = new Set(
    query.data?.memberships
      .filter((m) => m.group.status !== "FINISHED" || m.group.id === groupId)
      .flatMap((m) => m.teams.map((team) => team.id)) ?? [],
  );
  const available =
    query.data?.teams.filter((team) => !assigned.has(team.id)) ?? [];
  const visible = available.filter((team) =>
    `${team.name} ${team.shortName ?? ""}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );
  const selected = available.filter((team) => selection.includes(team.id));
  const finished = current?.group.status === "FINISHED";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !current || finished || !selected.length) return;
    setBusy(true);
    setError(undefined);
    setSuccess("");
    try {
      await submitDraw({
        tournamentId,
        teams: selected.map((team) => ({
          teamId: team.id,
          groupId: current.group.id,
        })),
      });
      setSuccess(`Команды добавлены в ${current.group.name}.`);
      setSelection([]);
      setSearch("");
      query.reload();
    } catch (reason) {
      setError(
        reason instanceof ApiError && reason.status === 409
          ? new Error(
              "Одна из команд уже состоит в группе или распределение изменилось. Обновите список и выберите свободные команды.",
            )
          : reason,
      );
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (busy || !current || finished) return;
    setBusy(true);
    setResetError(undefined);
    setSuccess("");
    try {
      await groupApi.reset(current.group.id);
      setConfirmReset(false);
      setSuccess(`Жеребьевка ${current.group.name} сброшена.`);
      setSelection([]);
      setError(undefined);
      query.reload();
    } catch (reason) {
      setResetError(reason);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {groupId && (
        <Link className="back" to={root}>
          <ArrowLeft size={18} />
          Все группы жеребьевки
        </Link>
      )}
      <div className="list-heading">
        <h2>
          <Shuffle size={21} />
          {current?.group.name ??
            (groupId ? "Жеребьевка группы" : "Жеребьевка по группам")}
        </h2>
        {current && (
          <Status
            value={current.group.status}
            label={groupStatusLabels[current.group.status]}
          />
        )}
      </div>
      <p className="muted section-description">
        {groupId
          ? "Состав группы и добавление свободных команд турнира."
          : "Откройте группу и выберите команды, которые будут в ней играть."}
      </p>
      {success && (
        <div className="success" role="status">
          <Check size={18} />
          {success}
        </div>
      )}
      <ErrorNotice error={query.error} retry={query.reload} />
      {query.loading ? (
        <Loading />
      ) : (
        query.data &&
        (!groupId ? (
          <>
            <div className="draw-progress">
              <span>Свободные команды</span>
              <strong>
                {available.length} / {query.data.teams.length}
              </strong>
            </div>
            <div className="group-grid">
              {query.data.memberships.map(({ group, teams }) => (
                <Link
                  className="surface draw-group-link"
                  to={`${root}/${group.id}`}
                  key={group.id}
                  aria-label={`Открыть ${group.name}`}
                >
                  <div className="group-title">
                    <span className="group-symbol">
                      {group.name
                        .replace(/^(group|группа)\s*/i, "")
                        .slice(0, 2)}
                    </span>
                    <Status
                      value={group.status}
                      label={groupStatusLabels[group.status]}
                    />
                  </div>
                  <h3>{group.name}</h3>
                  <p className="draw-group-count">
                    <Users size={17} />
                    Команд в группе: {teams.length}
                  </p>
                  <div className="draw-group-preview">
                    {teams.length ? (
                      teams.slice(0, 3).map((team) => (
                        <div key={team.id}>
                          <Logo name={team.name} url={team.logoUrl} />
                          <span>{team.name}</span>
                        </div>
                      ))
                    ) : (
                      <p>Пока нет команд</p>
                    )}
                    {teams.length > 3 && <small>Ещё {teams.length - 3}</small>}
                  </div>
                  <div className="card-bottom">
                    {group.status === "FINISHED"
                      ? "Посмотреть состав"
                      : "Открыть и добавить команды"}
                    <ArrowRight size={18} />
                  </div>
                </Link>
              ))}
            </div>
            {!query.data.memberships.length && (
              <Empty>
                Групп пока нет. После их создания на сервере здесь появятся
                Group A, Group B и другие группы.
              </Empty>
            )}
          </>
        ) : (
          current && (
            <>
              <section className="draw-current">
                <div className="list-heading">
                  <h2>
                    Команды в группе{" "}
                    <span className="count">{current.teams.length}</span>
                  </h2>
                </div>
                <div className="team-grid">
                  {current.teams.map((team) => (
                    <article className="surface team-card" key={team.id}>
                      <Logo name={team.name} url={team.logoUrl} />
                      <div>
                        <h3>{team.name}</h3>
                        <p className="muted">
                          {team.shortName || "Участник группы"}
                        </p>
                      </div>
                      <Check className="draw-member-check" size={18} />
                    </article>
                  ))}
                </div>
                {!current.teams.length && (
                  <Empty>
                    В этой группе пока нет команд. Выберите участников ниже.
                  </Empty>
                )}
              </section>
              {finished ? (
                <div className="hint">
                  Группа завершена. Добавление команд и сброс жеребьевки
                  недоступны.
                </div>
              ) : (
                <form onSubmit={submit}>
                  <div className="list-heading">
                    <h2>
                      <Plus size={20} />
                      Добавить команды
                    </h2>
                    <span>Выбрано: {selected.length}</span>
                  </div>
                  <p className="muted section-description">
                    Отметьте команды для {current.group.name}. Команды
                    завершённых групп доступны снова, если не участвуют в другой
                    незавершённой группе.
                  </p>
                  {!!available.length && (
                    <label className="search">
                      <Search size={19} />
                      <input
                        type="search"
                        aria-label="Поиск свободной команды"
                        placeholder="Найти команду"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        disabled={busy}
                      />
                    </label>
                  )}
                  <fieldset disabled={busy}>
                    <div className="draw-team-options">
                      {visible.map((team) => (
                        <label
                          className={`surface draw-team-option ${selection.includes(team.id) ? "is-selected" : ""}`}
                          key={team.id}
                        >
                          <input
                            type="checkbox"
                            checked={selection.includes(team.id)}
                            aria-label={`Добавить ${team.name}`}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setSelection((s) =>
                                checked
                                  ? [...s, team.id]
                                  : s.filter((id) => id !== team.id),
                              );
                            }}
                          />
                          <Logo name={team.name} url={team.logoUrl} />
                          <span>
                            <strong>{team.name}</strong>
                            <small>
                              {team.shortName || "Свободная команда"}
                            </small>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  {!available.length && (
                    <Empty>
                      {query.data.teams.length ? (
                        "Все команды турнира уже распределены по группам."
                      ) : (
                        <>
                          <span>В турнире пока нет команд.</span>
                          <Link
                            className="button primary"
                            to={`/tournaments/${tournamentId}/teams/new`}
                          >
                            Создать команду
                          </Link>
                        </>
                      )}
                    </Empty>
                  )}
                  {!!available.length && !visible.length && (
                    <Empty>По вашему запросу команды не найдены.</Empty>
                  )}
                  <ErrorNotice error={error} />
                  {!!error && (
                    <button
                      className="button secondary"
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setError(undefined);
                        query.reload();
                      }}
                    >
                      Обновить распределение
                    </button>
                  )}
                  <div className="sticky-actions">
                    <button
                      className="button primary"
                      disabled={busy || !selected.length}
                    >
                      <Plus size={18} />
                      {busy
                        ? "Сохраняем…"
                        : `Добавить в ${current.group.name}${selected.length ? ` (${selected.length})` : ""}`}
                    </button>
                  </div>
                </form>
              )}
              {!finished && current.teams.length > 0 && (
                <button
                  type="button"
                  className="button reset-button full-width"
                  disabled={busy}
                  onClick={() => {
                    setResetError(undefined);
                    setConfirmReset(true);
                  }}
                >
                  <RotateCcw size={16} />
                  Сбросить жеребьевку группы
                </button>
              )}
              {confirmReset && (
                <Confirm
                  title={`Сбросить ${current.group.name}?`}
                  busy={busy}
                  onClose={() => setConfirmReset(false)}
                  onConfirm={reset}
                >
                  <p>
                    Команды и статистика будут удалены только из этой группы.
                    Команды останутся в турнире и снова станут доступны для
                    жеребьевки.
                  </p>
                  <ErrorNotice error={resetError} />
                </Confirm>
              )}
            </>
          )
        ))
      )}
    </>
  );
}
