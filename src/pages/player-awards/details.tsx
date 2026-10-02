import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { playerAwardApi } from "../../entities/player-award/api";
import type { AwardPoll, AwardResults } from "../../entities/player-award/model";
import { ApiError } from "../../shared/api/client";
import { Confirm, Loading, PageHeading, Status } from "../../shared/ui";
import { AwardError, AwardPlayer } from "./player";

const labels = { DRAFT: "Черновик", OPEN: "Голосование открыто", CLOSED: "Голосование закрыто" };

export function PlayerAwardDetailsPage() {
  const { pollId = "", tournamentId } = useParams();
  const [poll, setPoll] = useState<AwardPoll>();
  const [results, setResults] = useState<AwardResults>();
  const [error, setError] = useState<unknown>();
  const [resultsError, setResultsError] = useState<unknown>();
  const [actionError, setActionError] = useState<unknown>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const actionPending = useRef(false);

  const reload = useCallback(async () => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    const [details, scores] = await Promise.allSettled([
      playerAwardApi.get(pollId, request.signal), playerAwardApi.results(pollId, request.signal),
    ]);
    if (request.signal.aborted) return;
    if (details.status === "fulfilled") { setPoll(details.value); setError(undefined); }
    else setError(details.reason);
    if (scores.status === "fulfilled") { setResults(scores.value); setResultsError(undefined); }
    else setResultsError(scores.reason);
    setLoading(false);
  }, [pollId]);

  useEffect(() => {
    setPoll(undefined); setResults(undefined); setActionError(undefined); setLoading(true);
    void reload();
    return () => { controller.current?.abort(); };
  }, [reload]);

  useEffect(() => {
    if (poll?.status !== "OPEN" || results?.status === "CLOSED") return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const startTimer = () => {
      clearInterval(timer);
      if (document.visibilityState === "visible") {
        timer = setInterval(() => { if (!actionPending.current) void reload(); }, 10_000);
      }
    };
    const visibilityChanged = () => {
      if (document.visibilityState === "visible" && !actionPending.current) void reload();
      startTimer();
    };
    startTimer();
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", visibilityChanged); };
  }, [poll?.status, results?.status, reload]);

  async function performAction(action: "OPEN" | "CLOSE") {
    if (actionPending.current) return;
    actionPending.current = true; setBusy(true); setActionError(undefined);
    try {
      await playerAwardApi.action(pollId, action);
      setConfirmClose(false);
      await reload();
    } catch (error) {
      setActionError(error); setConfirmClose(false);
      if (error instanceof ApiError && error.status === 409) await reload();
    } finally { actionPending.current = false; setBusy(false); }
  }

  return <section className="award-page">
    <PageHeading title={poll?.title ?? "Голосование за игрока"} back={tournamentId ? `/tournaments/${encodeURIComponent(tournamentId)}/player-award-polls` : "/tournaments"} />
    <AwardError error={error} retry={() => void reload()} />
    <AwardError error={actionError} />
    {loading ? <Loading /> : poll && <>
      <section className="surface award-form">
        <div className="list-heading">
          <Status value={poll.status} label={labels[poll.status]} />
          {poll.status === "DRAFT" && <button className="button primary" disabled={busy} onClick={() => void performAction("OPEN")}>{busy ? "Открываем…" : "Открыть голосование"}</button>}
          {poll.status === "OPEN" && <button className="button danger" disabled={busy} onClick={() => setConfirmClose(true)}>{busy ? "Закрываем…" : "Закрыть голосование"}</button>}
        </div>
        <p>Количество кандидатов: {poll.candidateCount}</p>
        <h2>Кандидаты</h2>
        <ul className="award-player-list">
          {poll.candidates.map((candidate) => <li className="award-candidate" key={candidate.playerId}>
            <AwardPlayer player={candidate} /><span className="muted">{candidate.teamName}</span>
          </li>)}
        </ul>
        <h2>Начисление баллов</h2>
        <p>Баллы за голос = количество кандидатов + 1 − выбранное место.</p>
        <p className="muted">За места с 1-го по {poll.candidateCount}-е: {Array.from({ length: poll.candidateCount }, (_, index) => poll.candidateCount - index).join(", ")}.</p>
      </section>
      <section className="surface award-form" aria-label="Результаты голосования">
        <div className="list-heading">
          <h2>{poll.status === "OPEN" ? "Предварительные результаты" : "Результаты"}</h2>
          <button className="button secondary" disabled={busy} onClick={() => void reload()}>Обновить</button>
        </div>
        <AwardError error={resultsError} retry={() => void reload()} />
        {results && <>
          <p>Проголосовали: {results.totalVoters}</p>
          {results.totalVoters === 0 && <p className="muted">Пока никто не проголосовал</p>}
          <div className="award-table-scroll"><table className="award-results">
            <thead><tr><th>Место</th><th>Футболист</th><th>Команда</th><th>Баллы</th><th>Первых мест</th></tr></thead>
            <tbody>{results.results.map((player) => <tr key={player.playerId}>
              <td>{player.rank}</td><td><AwardPlayer player={player} /></td><td>{player.teamName}</td><td>{player.totalPoints}</td><td>{player.firstPlaceVotes}</td>
            </tr>)}</tbody>
          </table></div>
        </>}
      </section>
    </>}
    {confirmClose && <Confirm title="Закрыть голосование?" busy={busy} confirmLabel="Закрыть голосование" busyLabel="Закрываем…"
      onClose={() => setConfirmClose(false)} onConfirm={() => void performAction("CLOSE")}>
      <p>Пользователи больше не смогут отправлять и изменять свои рейтинги.</p>
    </Confirm>}
  </section>;
}
