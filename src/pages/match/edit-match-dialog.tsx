import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { matchApi } from "../../entities/match/api";
import type { Match } from "../../entities/match/model";
import { teamApi } from "../../entities/team/api";
import { useQuery } from "../../shared/api/use-query";
import { ErrorNotice, Loading } from "../../shared/ui";

function localDateTime(value: string) {
  // Backend stores LocalDateTime; preserve its wall-clock time without UTC conversion.
  return value.slice(0, 16);
}

export function EditMatchDialog({ match, onClose, onSaved }: {
  match: Match;
  onClose: () => void;
  onSaved: () => unknown;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [teamId1, setTeamId1] = useState(match.teamId1);
  const [teamId2, setTeamId2] = useState(match.teamId2);
  const [scheduledAt, setScheduledAt] = useState(localDateTime(match.scheduledAt));
  const [liveUrl, setLiveUrl] = useState(match.liveUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>();
  const teamsQuery = useQuery(useCallback(
    (signal: AbortSignal) => teamApi.inGroup(match.groupId, signal),
    [match.groupId],
  ));

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.showModal();
    return () => previous?.focus();
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !teamId1 || !teamId2 || !scheduledAt) return;
    if (teamId1 === teamId2) {
      setError(new Error("Выберите две разные команды."));
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await matchApi.update(match.id, {
        groupId: match.groupId,
        teamId1,
        teamId2,
        scheduledAt,
        liveUrl: liveUrl.trim(),
      });
      onSaved();
      onClose();
    } catch (error) {
      setError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog ref={dialogRef} className="dialog" onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }}>
      <form onSubmit={save}>
        <div className="dialog-heading">
          <h2>Редактировать матч</h2>
          <button type="button" className="icon-button" aria-label="Закрыть" disabled={saving} onClick={onClose}>×</button>
        </div>
        <ErrorNotice error={teamsQuery.error} retry={teamsQuery.reload} />
        {teamsQuery.loading ? <Loading /> : (
          <>
            <label className="match-form-field">Первая команда
              <select required value={teamId1} onChange={(event) => setTeamId1(event.target.value)}>
                <option value="">Выберите команду</option>
                {teamsQuery.data?.map((team) => <option key={team.id} value={team.id} disabled={team.id === teamId2}>{team.name}</option>)}
              </select>
            </label>
            <label className="match-form-field">Вторая команда
              <select required value={teamId2} onChange={(event) => setTeamId2(event.target.value)}>
                <option value="">Выберите команду</option>
                {teamsQuery.data?.map((team) => <option key={team.id} value={team.id} disabled={team.id === teamId1}>{team.name}</option>)}
              </select>
            </label>
            <label className="match-form-field">Дата и время
              <input required type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
            </label>
            <label className="match-form-field">Ссылка на YouTube-трансляцию <span className="muted">(необязательно)</span>
              <input type="url" inputMode="url" placeholder="https://www.youtube.com/watch?v=..." value={liveUrl} onChange={(event) => setLiveUrl(event.target.value)} />
            </label>
          </>
        )}
        <ErrorNotice error={error} />
        <div className="dialog-actions">
          <button type="button" className="button secondary" disabled={saving} onClick={onClose}>Отмена</button>
          <button type="submit" className="button primary" disabled={saving || teamsQuery.loading || !teamsQuery.data || teamsQuery.data.length < 2}>
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
