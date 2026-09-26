import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  ChevronRight,
  Plus,
  Search,
  Trophy,
  Users,
} from "lucide-react";
import { tournamentApi } from "../../entities/tournament/api";
import { statusLabels, typeLabels } from "../../entities/tournament/model";
import { items } from "../../shared/api/pagination";
import { useQuery } from "../../shared/api/use-query";
import {
  dateLabel,
  Empty,
  ErrorNotice,
  Loading,
  Logo,
  PageHeading,
  Status,
} from "../../shared/ui";
export function TournamentsPage() {
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [page, setPage] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      setName(search.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useQuery(
    useCallback(
      (signal: AbortSignal) => tournamentApi.list(name, page, 12, signal),
      [name, page],
    ),
  );
  const rows = query.data ? items(query.data) : [];
  const response =
    query.data && !Array.isArray(query.data) ? query.data : undefined;
  const totalPages = response?.totalPages ?? response?.page?.totalPages;
  const hasNext = response
    ? totalPages !== undefined
      ? page + 1 < totalPages
      : response.last === false
    : false;
  return (
    <>
      <PageHeading
        title="Мои турниры"
        description="От первого свистка до финального кубка."
        action={
          <Link className="button primary desktop-action" to="/tournaments/new">
            <Plus size={18} />
            Создать турнир
          </Link>
        }
      />
      <section className="intro-card">
        <span className="intro-icon">
          <Trophy size={30} />
        </span>
        <div>
          <span className="eyebrow">УПРАВЛЕНИЕ СОРЕВНОВАНИЯМИ</span>
          <h2>Большая игра начинается здесь</h2>
          <p>Создавайте турниры, собирайте команды и проводите жеребьевку.</p>
        </div>
      </section>
      <label className="search">
        <Search size={20} />
        <input
          aria-label="Поиск турнира по названию"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Найти турнир по названию"
          type="search"
        />
      </label>
      <ErrorNotice error={query.error} retry={query.reload} />
      {query.loading ? (
        <Loading />
      ) : (
        !query.error && (
          <>
            <div className="list-heading">
              <h2>Все турниры</h2>
              <span>
                {response?.totalElements ??
                  response?.page?.totalElements ??
                  rows.length}{" "}
                турниров
              </span>
            </div>
            <div className="tournament-grid">
              {rows.map((t) => (
                <Link
                  className="tournament-card"
                  to={`/tournaments/${t.id}`}
                  key={t.id}
                >
                  <div className="card-top">
                    <Logo name={t.name} url={t.logoUrl} />
                    <Status value={t.status} label={statusLabels[t.status]} />
                  </div>
                  <h2>{t.name}</h2>
                  <p className="muted">{typeLabels[t.type] ?? t.type}</p>
                  <div className="card-meta">
                    <span>
                      <CalendarDays size={16} />
                      {dateLabel(t.startDate)} — {dateLabel(t.endDate)}
                    </span>
                    <span>
                      <Users size={16} />
                      До {t.maxTeams} команд
                    </span>
                  </div>
                  <div className="card-bottom">
                    Открыть турнир
                    <ChevronRight size={18} />
                  </div>
                </Link>
              ))}
            </div>
            {!rows.length && (
              <Empty>
                {name
                  ? "По вашему запросу ничего не найдено."
                  : "Турниров пока нет. Создайте первый турнир."}
              </Empty>
            )}
            {response && (
              <div className="pagination">
                <button
                  className="button secondary"
                  disabled={page === 0}
                  onClick={() => setPage((n) => n - 1)}
                >
                  Назад
                </button>
                <span>
                  Страница {page + 1}
                  {totalPages ? ` из ${totalPages}` : ""}
                </span>
                <button
                  className="button secondary"
                  disabled={!hasNext}
                  onClick={() => setPage((n) => n + 1)}
                >
                  Далее
                </button>
              </div>
            )}
          </>
        )
      )}
      <div className="mobile-create">
        <Link to="/tournaments/new" className="button primary">
          <Plus size={19} />
          Создать турнир
        </Link>
      </div>
    </>
  );
}
