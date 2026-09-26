import { useEffect, useState } from "react";
import { playerStatisticsApi, type PlayerStatisticsEventType, type PlayerStatisticsItem } from "../../entities/player/statistics-api";
import { imageSrc } from "../../shared/api/images";
import { Empty, ErrorNotice, Loading, PageHeading } from "../../shared/ui";

const eventTypes: { value: PlayerStatisticsEventType; label: string; countLabel: string }[] = [
  { value: "GOAL", label: "Голы", countLabel: "голов" },
  { value: "ASSIST", label: "Ассисты", countLabel: "ассистов" },
  { value: "OWN_GOAL", label: "Автоголы", countLabel: "автоголов" },
  { value: "YELLOW_CARD", label: "Жёлтые карточки", countLabel: "карточек" },
  { value: "RED_CARD", label: "Красные карточки", countLabel: "карточек" },
];

const PAGE_SIZE = 5;

export function PlayerStatisticsPage() {
  const [type, setType] = useState<PlayerStatisticsEventType>("GOAL");
  const [page, setPage] = useState(0);
  const [players, setPlayers] = useState<PlayerStatisticsItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>();
  const [revision, setRevision] = useState(0);
  const selectedType = eventTypes.find((item) => item.value === type) ?? eventTypes[0];

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(undefined);
    playerStatisticsApi.list(type, page, PAGE_SIZE, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setPlayers((current) => page === 0 ? result.content : [...current, ...result.content]);
        setHasMore(result.last === undefined
          ? page + 1 < result.totalPages
          : !result.last);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [type, page, revision]);

  function changeType(nextType: PlayerStatisticsEventType) {
    setType(nextType);
    setPage(0);
    setPlayers([]);
    setHasMore(false);
  }

  return (
    <section className="player-statistics-page">
      <PageHeading title="Статистика игроков" description="Лидеры по событиям матчей" />
      <label className="filter-label">
        Тип события
        <select value={type} onChange={(event) => changeType(event.target.value as PlayerStatisticsEventType)}>
          {eventTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <ErrorNotice error={error} retry={() => setRevision((current) => current + 1)} />
      {loading && page === 0 ? <Loading /> : players.length ? (
        <>
          <ol className="player-statistics-list" aria-label={selectedType.label}>
            {players.map((player, index) => (
              <li className="surface player-statistics-item" key={`${player.playerId}-${index}`}>
                <span className="player-statistics-rank">{index + 1}</span>
                <span className="player-statistics-photo">
                  <span aria-hidden="true">{`${player.firstName.slice(0, 1)}${player.lastName.slice(0, 1)}`.toUpperCase()}</span>
                  {player.photoUrl && <img src={imageSrc(player.photoUrl)} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
                </span>
                <span className="player-statistics-info">
                  <strong>{player.firstName} {player.lastName}</strong>
                  <span className="muted">
                    {player.teamLogoUrl && <img className="player-statistics-team-logo" src={imageSrc(player.teamLogoUrl)} alt="" />}
                    {player.teamName}{player.teamShortName ? ` · ${player.teamShortName}` : ""}
                  </span>
                </span>
                <strong className="player-statistics-count">
                  {player.games}<span>матчей</span>
                </strong>
                <strong className="player-statistics-count">
                  {player.count}<span>{selectedType.countLabel}</span>
                </strong>
              </li>
            ))}
          </ol>
          {hasMore && (
            <button className="button secondary full-width player-statistics-more" type="button" disabled={loading} onClick={() => setPage((current) => current + 1)}>
              {loading ? "Загружаем…" : "Показать больше"}
            </button>
          )}
        </>
      ) : !loading && !error ? <Empty>Пока нет статистики для этого типа события.</Empty> : null}
      {loading && page > 0 && <Loading />}
    </section>
  );
}
