import { useCallback, useState } from "react";
import { useParams } from "react-router-dom";
import { matchPollApi } from "../../entities/match-poll/api";
import { userApi } from "../../entities/user/api";
import { useQuery } from "../../shared/api/use-query";
import { Empty, ErrorNotice, Loading, PageHeading } from "../../shared/ui";

function LeaderUser({ userId }: { userId: string }) {
  const query = useQuery(useCallback((signal: AbortSignal) => userApi.info(userId, signal), [userId]));
  if (query.loading) return <span role="status">Загрузка пользователя…</span>;
  if (query.error) return <ErrorNotice error={query.error} retry={query.reload} />;
  if (!query.data) return <span className="muted">Пользователь не найден</span>;
  const user = query.data;
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return <div className="leaderboard-user">
    <strong>{user.name?.trim() || fullName || "Имя не указано"}</strong>
    {fullName && fullName !== user.name?.trim() && <span>{fullName}</span>}
    <span className="muted">{user.email}</span>
  </div>;
}

export function MatchPollLeaderboardPage() {
  const { tournamentId } = useParams();
  const [scope, setScope] = useState("tournament");
  const query = useQuery(useCallback(
    (signal: AbortSignal) => matchPollApi.leaderboard(scope === "tournament" ? tournamentId : undefined, signal),
    [scope, tournamentId],
  ));

  return <section>
    <PageHeading title="Рейтинг прогнозов" description="Количество угаданных результатов матчей" />
    <label className="filter-label">Рейтинг
      <select value={scope} onChange={(event) => setScope(event.target.value)}>
        <option value="tournament">Текущий турнир</option>
        <option value="all">Все турниры</option>
      </select>
    </label>
    <ErrorNotice error={query.error} retry={query.reload} />
    {query.loading ? <Loading /> : query.data && (query.data.length === 0
      ? <Empty>Пока никто не угадал результаты матчей.</Empty>
      : <div className="surface leaderboard-scroll">
        <table className="leaderboard-table" aria-label="Рейтинг прогнозов">
          <thead><tr><th scope="col">Место</th><th scope="col">Пользователь</th><th scope="col">Угадано матчей</th></tr></thead>
          <tbody>{query.data.map((leader, index) => <tr key={leader.userId}>
            <td>{index + 1}</td><th scope="row"><LeaderUser userId={leader.userId} /></th><td>{leader.guessedCount}</td>
          </tr>)}</tbody>
        </table>
      </div>)}
  </section>;
}
