import {
  createBrowserRouter,
  Navigate,
  useRouteError,
  Link,
} from "react-router-dom";
import { Layout } from "./ui/layout";
import { TournamentsPage } from "../pages/tournaments/ui";
import { TournamentFormPage } from "../pages/tournament-form/ui";
import { TournamentPage } from "../pages/tournament/ui";
import { TournamentTeamsPage } from "../pages/tournament-teams/ui";
import { TournamentGroupsPage } from "../pages/tournament-groups/ui";
import { TournamentMatchesPage } from "../pages/tournament-matches/ui";
import { TeamFormPage } from "../pages/team-form/ui";
import { GroupPage } from "../pages/group/ui";
import { DrawPage } from "../pages/draw/ui";
import { MatchPage } from "../pages/match/ui";
import { PlayerStatisticsPage } from "../pages/player-statistics/ui";
import { CreatePlayerAwardPage } from "../pages/player-awards/create";
import { PlayerAwardPollsPage } from "../pages/player-awards/list";
import { MatchPollLeaderboardPage } from "../pages/match-poll-leaderboard/ui";
import { PlayerAwardDetailsPage } from "../pages/player-awards/details";
import { ErrorNotice, PageHeading } from "../shared/ui";
import { useAuth } from "../shared/auth/auth-context";
import { LoginPage } from "../pages/login/ui";
import type { ReactNode } from "react";

function RequireAdmin({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === "loading")
    return <main className="auth-loading" role="status">Проверяем сессию…</main>;
  if (status !== "authenticated") return <Navigate to="/login" replace />;
  return children;
}
function RouteError() {
  const error = useRouteError();
  return (
    <main className="container">
      <PageHeading title="Не удалось открыть страницу" />
      <ErrorNotice error={error} />
      <Link className="button primary" to="/tournaments">
        К турнирам
      </Link>
    </main>
  );
}
export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <RequireAdmin><Layout /></RequireAdmin>,
    errorElement: <RouteError />,
    children: [
      { path: "/", element: <Navigate to="/tournaments" replace /> },
      { path: "/tournaments", element: <TournamentsPage /> },
      { path: "/player-award-polls/:pollId", element: <PlayerAwardDetailsPage /> },
      { path: "/matches/:matchId", element: <MatchPage /> },
      { path: "/tournaments/new", element: <TournamentFormPage /> },
      {
        path: "/tournaments/:tournamentId/edit",
        element: <TournamentFormPage />,
      },
      {
        path: "/tournaments/:tournamentId/teams/new",
        element: <TeamFormPage />,
      },
      {
        path: "/tournaments/:tournamentId/teams/:teamId/edit",
        element: <TeamFormPage />,
      },
      {
        path: "/tournaments/:tournamentId/groups/:groupId",
        element: <GroupPage />,
      },
      {
        path: "/tournaments/:tournamentId",
        element: <TournamentPage />,
        children: [
          { index: true, element: <Navigate to="teams" replace /> },
          { path: "teams", element: <TournamentTeamsPage /> },
          { path: "groups", element: <TournamentGroupsPage /> },
          { path: "matches", element: <TournamentMatchesPage /> },
          { path: "draw", element: <DrawPage /> },
          { path: "player-statistics", element: <PlayerStatisticsPage /> },
          { path: "player-award-polls", element: <PlayerAwardPollsPage /> },
          { path: "match-poll-leaderboard", element: <MatchPollLeaderboardPage /> },
          { path: "player-award-polls/new", element: <CreatePlayerAwardPage /> },
          { path: "player-award-polls/:pollId", element: <PlayerAwardDetailsPage /> },
          { path: "draw/:groupId", element: <DrawPage /> },
        ],
      },
      {
        path: "*",
        element: (
          <>
            <PageHeading title="Страница не найдена" />
            <Link className="button primary" to="/tournaments">
              К турнирам
            </Link>
          </>
        ),
      },
    ],
  },
]);
