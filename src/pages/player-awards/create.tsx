import { useCallback, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { playerAwardApi } from "../../entities/player-award/api";
import type { Player } from "../../entities/team/model";
import { useQuery } from "../../shared/api/use-query";
import { Field, Loading, PageHeading } from "../../shared/ui";
import { AwardError, AwardPlayer } from "./player";

export function CreatePlayerAwardPage() {
  const { tournamentId = "" } = useParams();
  return <CreatePlayerAwardForm key={tournamentId} tournamentId={tournamentId} />;
}

function CreatePlayerAwardForm({ tournamentId }: { tournamentId: string }) {
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const [title, setTitle] = useState("");
  const [count, setCount] = useState("2");
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Map<string, Player>>(() => new Map());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>();
  const players = useQuery(useCallback((signal: AbortSignal) => playerAwardApi.players(tournamentId, name, page, signal), [tournamentId, name, page]));
  const candidateCount = Number(count);
  const validCount = Number.isSafeInteger(candidateCount) && candidateCount >= 2;
  const canCreate = title.trim().length > 0 && title.trim().length <= 255 && validCount && selected.size === candidateCount;
  const lastPage = players.data?.last ?? (page + 1 >= (players.data?.totalPages ?? players.data?.page?.totalPages ?? 1));

  function toggle(player: Player) {
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(player.id)) next.delete(player.id);
      else next.set(player.id, player);
      return next;
    });
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreate || saving) return;
    setSaving(true);
    setError(undefined);
    try {
      const poll = await playerAwardApi.create({ tournamentId, title: title.trim(), candidateCount, playerIds: Array.from(selected.keys()) });
      navigate(`/tournaments/${encodeURIComponent(tournamentId)}/player-award-polls/${encodeURIComponent(poll.id)}`);
    } catch (error) { setError(error); }
    finally { setSaving(false); }
  }

  return <section className="award-page">
    <PageHeading title="Голосование за игрока" description="Создайте голосование и выберите кандидатов." back={`/tournaments/${encodeURIComponent(tournamentId)}/player-award-polls`} />
    <form ref={formRef} className="surface award-form" onSubmit={create}>
      <fieldset disabled={saving} className="award-fields">
        <Field label="Название"><input required maxLength={255} value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
        <Field label="Количество кандидатов"><input required type="number" min="2" step="1" value={count} onChange={(event) => setCount(event.target.value)} /></Field>
        <h2>Футболисты</h2>
        <div className="award-search">
          <Field label="Поиск по имени или фамилии"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); setName(search); setPage(0); } }} /></Field>
          <button type="button" className="button secondary" onClick={() => { setName(search); setPage(0); }}>Найти</button>
        </div>
        <p aria-live="polite">Выбрано {selected.size} из {count || "0"}</p>
        {selected.size > 0 && <div className="award-selected" aria-label="Выбранные футболисты">
          {Array.from(selected.values()).map((player) => <button type="button" className="button secondary" key={player.id} onClick={() => toggle(player)} aria-label={`Убрать ${player.firstName} ${player.lastName}`}>
            {player.firstName} {player.lastName} ×
          </button>)}
        </div>}
        <AwardError error={players.error} retry={players.reload} />
        {players.loading ? <Loading /> : players.data && <>
          <ul className="award-player-list">
            {players.data.content.map((player) => <li key={player.id}><label className="award-select-player">
              <input type="checkbox" checked={selected.has(player.id)} onChange={() => toggle(player)} disabled={!selected.has(player.id) && (!validCount || selected.size >= candidateCount)} />
              <AwardPlayer player={player} />
            </label></li>)}
          </ul>
          {players.data.content.length === 0 && <p className="muted">Футболисты не найдены.</p>}
          <div className="award-pagination">
            <button type="button" className="button secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Назад</button>
            <span>Страница {page + 1}</span>
            <button type="button" className="button secondary" disabled={lastPage} onClick={() => setPage(page + 1)}>Далее</button>
          </div>
        </>}
      </fieldset>
      <AwardError error={error} retry={!saving && canCreate ? () => formRef.current?.requestSubmit() : undefined} />
      <button className="button primary" type="submit" disabled={saving || !canCreate}>{saving ? "Создаём…" : "Создать"}</button>
    </form>
  </section>;
}
