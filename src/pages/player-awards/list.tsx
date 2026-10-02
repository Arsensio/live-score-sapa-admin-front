import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { playerAwardApi } from "../../entities/player-award/api";
import { useQuery } from "../../shared/api/use-query";
import { Empty, Loading, Status } from "../../shared/ui";
import { AwardError } from "./player";

const labels = { DRAFT: "Черновик", OPEN: "Голосование открыто", CLOSED: "Голосование закрыто" };

export function PlayerAwardPollsPage() {
  const { tournamentId = "" } = useParams();
  return <PlayerAwardPollsList key={tournamentId} tournamentId={tournamentId} />;
}

function PlayerAwardPollsList({ tournamentId }: { tournamentId: string }) {
  const [page, setPage] = useState(0);
  const query = useQuery(useCallback(
    (signal: AbortSignal) => playerAwardApi.list(tournamentId, page, signal),
    [tournamentId, page],
  ));
  const base = `/tournaments/${encodeURIComponent(tournamentId)}/player-award-polls`;
  const totalPages = query.data?.totalPages ?? query.data?.page?.totalPages;
  const lastPage = query.data?.last ?? (totalPages !== undefined ? page + 1 >= totalPages : !query.data?.content.length);

  return <section className="award-page">
    <div className="list-heading">
      <h2>Голосования <span className="count">{query.data?.totalElements ?? query.data?.page?.totalElements ?? "—"}</span></h2>
      <Link className="button primary" to={`${base}/new`}><Plus size={18} />Создать голосование</Link>
    </div>
    <AwardError error={query.error} retry={query.reload} />
    {query.loading ? <Loading /> : query.data && <>
      {query.data.content.length === 0 ? <Empty>Голосований пока нет.</Empty> : <div className="team-grid">
        {query.data.content.map((poll) => <article className="surface award-form" key={poll.id}>
          <h3><Link to={`${base}/${encodeURIComponent(poll.id)}`}>{poll.title}</Link></h3>
          <Status value={poll.status} label={labels[poll.status]} />
          <p className="muted">Кандидатов: {poll.candidateCount}</p>
          <Link className="button secondary" to={`${base}/${encodeURIComponent(poll.id)}`}>Подробнее</Link>
        </article>)}
      </div>}
      <div className="award-pagination">
        <button type="button" className="button secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Назад</button>
        <span>Страница {page + 1}{totalPages ? ` из ${totalPages}` : ""}</span>
        <button type="button" className="button secondary" disabled={lastPage} onClick={() => setPage(page + 1)}>Далее</button>
      </div>
    </>}
  </section>;
}
