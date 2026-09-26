import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { GroupWithStatistics } from "../../entities/group/model";
import { Logo } from "../../shared/ui";

export function GroupStandings({ group }: { group: GroupWithStatistics }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const syncEdges = useCallback(() => {
    const element = scroller.current;
    if (element)
      setEdges({
        left: element.scrollLeft > 1,
        right:
          element.scrollLeft + element.clientWidth < element.scrollWidth - 1,
      });
  }, []);
  useEffect(() => {
    syncEdges();
    const element = scroller.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(syncEdges);
    observer.observe(element);
    return () => observer.disconnect();
  }, [syncEdges, group.teams]);
  function scroll(direction: number) {
    scroller.current?.scrollBy({
      left: direction * 192,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  if (!group.teams.length)
    return (
      <p className="muted standings-empty">Команды пока не распределены.</p>
    );
  if (group.isPlayOff)
    return (
      <ul className="playoff-team-list" aria-label={`Команды ${group.name}`}>
        {group.teams.map((team) => (
          <li className={`playoff-team ${team.isLive ? "is-live" : ""}`} key={team.groupTeamId} title={team.isLive ? "У команды идёт матч" : undefined}>
            <Logo name={team.teamName} url={team.teamLogoUrl} />
            <span className="standings-team-name" title={team.teamName}>
              {team.teamName}
            </span>
          </li>
        ))}
      </ul>
    );
  return (
    <div className="standings">
      <div className="standings-controls">
        <span>Сдвиньте влево — больше статистики</span>
        <div>
          <button
            className="icon-button"
            type="button"
            aria-label={`Прокрутить статистику ${group.name} влево`}
            disabled={!edges.left}
            onClick={() => scroll(-1)}
          >
            <ChevronLeft size={19} />
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label={`Прокрутить статистику ${group.name} вправо`}
            disabled={!edges.right}
            onClick={() => scroll(1)}
          >
            <ChevronRight size={19} />
          </button>
        </div>
      </div>
      <div
        className="standings-scroll"
        ref={scroller}
        onScroll={syncEdges}
        tabIndex={0}
        role="region"
        aria-label={`Статистика ${group.name}`}
      >
        <table className="standings-table" aria-label={`Таблица ${group.name}`}>
          <colgroup>
            <col className="standings-team-col" />
            <col className="standings-points-col" />
            <col span={7} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="standings-team">
                <span className="standings-rank">#</span>Команда
              </th>
              <th scope="col" className="standings-points">
                Очки
              </th>
              {[
                ["И", "Игры"],
                ["РМ", "Разница мячей"],
                ["В", "Победы"],
                ["Н", "Ничьи"],
                ["П", "Поражения"],
                ["ЗМ", "Забито мячей"],
                ["ПМ", "Пропущено мячей"],
              ].map(([short, full]) => (
                <th scope="col" key={short} aria-label={full} title={full}>
                  {short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {group.teams.map((team, index) => (
              <tr
                key={team.groupTeamId}
                className={team.isLive ? "standings-row-live" : undefined}
                aria-label={`Статистика ${team.teamName}${team.isLive ? ", идёт live-матч" : ""}`}
                title={team.isLive ? "У команды идёт матч" : undefined}
              >
                <th scope="row" className="standings-team">
                  <div className="standings-team-content">
                    <span className="standings-rank">{index + 1}</span>
                    <Logo name={team.teamName} url={team.teamLogoUrl} />
                    <span className="standings-team-name" title={team.teamName}>
                      {team.teamName}
                    </span>
                  </div>
                </th>
                <td className="standings-points" aria-label="Очки">
                  <strong>{team.points}</strong>
                </td>
                <td aria-label="Игры">{team.gamePlayed}</td>
                <td aria-label="Разница">
                  {team.goalDifference > 0
                    ? `+${team.goalDifference}`
                    : team.goalDifference}
                </td>
                <td aria-label="Победы">{team.winCount}</td>
                <td aria-label="Ничьи">{team.drawCount}</td>
                <td aria-label="Поражения">{team.loseCount}</td>
                <td aria-label="Забито">{team.goalCount}</td>
                <td aria-label="Пропущено">{team.goalMissed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="standings-legend">
        И — игры · РМ — разница мячей · В / Н / П — победы / ничьи / поражения ·
        ЗМ / ПМ — забито / пропущено
      </p>
    </div>
  );
}
