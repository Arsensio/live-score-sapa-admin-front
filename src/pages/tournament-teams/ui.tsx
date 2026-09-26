import { useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { Pencil, Plus, Users } from "lucide-react";
import { teamApi } from "../../entities/team/api";
import { useQuery } from "../../shared/api/use-query";
import { Empty, ErrorNotice, Loading, Logo } from "../../shared/ui";
export function TournamentTeamsPage() {
  const { tournamentId = "" } = useParams();
  const query = useQuery(
    useCallback(
      (signal: AbortSignal) => teamApi.list(tournamentId, signal),
      [tournamentId],
    ),
  );
  return (
    <>
      <div className="list-heading">
        <h2>
          Команды <span className="count">{query.data?.length ?? "—"}</span>
        </h2>
        <Link
          className="button primary"
          to={`/tournaments/${tournamentId}/teams/new`}
        >
          <Plus size={18} />
          Добавить команду
        </Link>
      </div>
      <ErrorNotice error={query.error} retry={query.reload} />
      {query.loading ? (
        <Loading />
      ) : (
        <div className="team-grid">
          {query.data?.map((team) => (
            <article className="surface team-manage-card" key={team.id}>
              <div className="team-card">
                <Logo name={team.name} url={team.logoUrl} />
                <div>
                  <h3>{team.name}</h3>
                  <p className="muted">
                    {team.shortName || "Участник турнира"}
                  </p>
                </div>
                <span className="player-count">
                  <Users size={16} />
                  {team.players?.length ?? "—"}
                </span>
              </div>
              <Link
                className="button secondary team-edit-link"
                to={`/tournaments/${tournamentId}/teams/${team.id}/edit`}
                aria-label={`Редактировать команду ${team.name}`}
              >
                <Pencil size={16} />
                Редактировать команду
              </Link>
            </article>
          ))}
        </div>
      )}
      {query.data?.length === 0 && (
        <Empty>Пока нет участников. Добавьте первую команду с игроками.</Empty>
      )}
    </>
  );
}
