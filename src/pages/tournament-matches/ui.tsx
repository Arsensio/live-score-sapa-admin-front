import { useCallback, useState } from "react";
import { useParams } from "react-router-dom";
import { groupApi } from "../../entities/group/api";
import type { MatchStatus } from "../../entities/match/model";
import { useQuery } from "../../shared/api/use-query";
import { Empty, ErrorNotice, Loading } from "../../shared/ui";
import { GroupMatches } from "../tournament-groups/matches";

export function TournamentMatchesPage() {
  const { tournamentId = "" } = useParams();
  const [status, setStatus] = useState<MatchStatus | "">("");
  const query = useQuery(
    useCallback(
      (signal: AbortSignal) => groupApi.standings(tournamentId, signal),
      [tournamentId],
    ),
  );

  const groups = query.data?.slice().sort((a, b) => a.groupOrder - b.groupOrder) ?? [];

  return (
    <>
      <div className="list-heading">
        <h2>Матчи турнира</h2>
      </div>
      <label className="filter-label">
        Статус матча
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as MatchStatus | "")}
        >
          <option value="">Все статусы</option>
          <option value="CREATED">Создан</option>
          <option value="LIVE">В эфире</option>
          <option value="FINISHED">Завершён</option>
        </select>
      </label>
      <ErrorNotice error={query.error} retry={query.reload} />
      {query.loading ? (
        <Loading />
      ) : groups.length ? (
        <div className="tournament-matches-list">
          {groups.map((group) => (
            <section className="surface tournament-match-group" key={group.id}>
              <div className="tournament-match-group-heading">
                <span className="group-symbol">{group.name?.slice(0, 1) || "Г"}</span>
                <div>
                  <h3>{group.name}</h3>
                  <p className="muted">{group.isPlayOff ? "Плей-офф" : "Групповой этап"}</p>
                </div>
              </div>
              <GroupMatches
                groupId={group.id}
                groupName={group.name}
                status={status || undefined}
                teamDetails={Object.fromEntries(
                  group.teams.map((team) => [
                    team.teamId,
                    { name: team.teamName, logoUrl: team.teamLogoUrl },
                  ]),
                )}
              />
            </section>
          ))}
        </div>
      ) : (
        query.data && <Empty>Сначала создайте группы турнира.</Empty>
      )}
    </>
  );
}
