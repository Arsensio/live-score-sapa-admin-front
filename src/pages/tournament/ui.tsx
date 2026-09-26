import { useCallback } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useOutletContext,
  useParams,
} from "react-router-dom";
import { BarChart3, CalendarDays, Pencil, Trophy, Users } from "lucide-react";
import { tournamentApi } from "../../entities/tournament/api";
import {
  statusLabels,
  typeLabels,
  type Tournament,
} from "../../entities/tournament/model";
import { useQuery } from "../../shared/api/use-query";
import {
  dateLabel,
  ErrorNotice,
  Loading,
  Logo,
  PageHeading,
  Status,
} from "../../shared/ui";
export function useTournament() {
  return useOutletContext<{ tournament: Tournament }>();
}
export function TournamentPage() {
  const { tournamentId = "" } = useParams();
  const query = useQuery(
    useCallback(
      (signal: AbortSignal) => tournamentApi.get(tournamentId, signal),
      [tournamentId],
    ),
  );
  if (query.loading) return <Loading />;
  if (query.error || !query.data)
    return (
      <>
        <PageHeading title="Турнир" back="/tournaments" />
        <ErrorNotice
          error={query.error ?? new Error("Турнир не найден")}
          retry={query.reload}
        />
      </>
    );
  const tournament = query.data;
  return (
    <>
      <PageHeading
        title={tournament.name}
        back="/tournaments"
        action={
          <Link className="button secondary edit-button" to="edit">
            <Pencil size={17} />
            <span>Редактировать</span>
          </Link>
        }
      />
      <section className="tournament-summary">
        <div className="summary-title">
          <Logo name={tournament.name} url={tournament.logoUrl} />
          <div>
            <Status
              value={tournament.status}
              label={statusLabels[tournament.status]}
            />
            <p>{typeLabels[tournament.type] ?? tournament.type}</p>
          </div>
        </div>
        {tournament.description && (
          <p className="description">{tournament.description}</p>
        )}
        <div className="summary-meta">
          <span>
            <CalendarDays size={17} />
            {dateLabel(tournament.startDate)} — {dateLabel(tournament.endDate)}
          </span>
          <span>
            <Users size={17} />
            До {tournament.maxTeams} команд
          </span>
        </div>
      </section>
      <nav className="tabs" aria-label="Разделы турнира">
        <NavLink to="matches"><Trophy size={15} /> Матчи</NavLink>
        <NavLink to="teams">Команды</NavLink>
        <NavLink to="groups">Группы</NavLink>
        <NavLink to="draw">Жеребьевка</NavLink>
        <NavLink to="player-statistics"><BarChart3 size={15} /> Статистика игроков</NavLink>
      </nav>
      <Outlet context={{ tournament }} />
    </>
  );
}
