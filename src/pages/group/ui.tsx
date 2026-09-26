import { useCallback } from "react";
import { useParams } from "react-router-dom";
import { Users } from "lucide-react";
import { teamApi } from "../../entities/team/api";
import { groupApi } from "../../entities/group/api";
import { groupStatusLabels } from "../../entities/group/model";
import { useQuery } from "../../shared/api/use-query";
import {
  Empty,
  ErrorNotice,
  Loading,
  Logo,
  PageHeading,
  Status,
} from "../../shared/ui";
export function GroupPage() {
  const { tournamentId = "", groupId = "" } = useParams();
  const query = useQuery(
    useCallback(
      async (signal: AbortSignal) => {
        const [groups, teams] = await Promise.all([
          groupApi.list(tournamentId, undefined, signal),
          teamApi.inGroup(groupId, signal),
        ]);
        const group = groups.find((g) => g.id === groupId);
        if (!group) throw new Error("Группа не найдена в этом турнире.");
        return { group, teams };
      },
      [tournamentId, groupId],
    ),
  );
  return (
    <>
      <PageHeading
        title={query.data?.group.name ?? "Состав группы"}
        description="Распределение команд по данным сервера."
        back={`/tournaments/${tournamentId}/groups`}
        action={
          query.data && (
            <Status
              value={query.data.group.status}
              label={groupStatusLabels[query.data.group.status]}
            />
          )
        }
      />
      <ErrorNotice error={query.error} retry={query.reload} />
      {query.loading ? (
        <Loading />
      ) : (
        <>
          <div className="team-grid">
            {query.data?.teams.map((team) => (
              <article className="surface group-team" key={team.id}>
                <div className="team-card">
                  <Logo name={team.name} url={team.logoUrl} />
                  <div>
                    <h3>{team.name}</h3>
                    <p className="muted">{team.shortName}</p>
                  </div>
                </div>
                {team.players?.length > 0 && (
                  <details>
                    <summary>
                      <Users size={16} />
                      Состав · {team.players.length}
                    </summary>
                    <ul className="players-list">
                      {team.players.map((player, index) => (
                        <li key={index}>
                          <span className="shirt-number">
                            {player.shirtNumber}
                          </span>
                          {player.firstName} {player.lastName}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </article>
            ))}
          </div>
          {query.data?.teams.length === 0 && (
            <Empty>
              В группе пока нет команд. Назначьте их на странице жеребьевки.
            </Empty>
          )}
        </>
      )}
    </>
  );
}
