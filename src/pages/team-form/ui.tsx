import { useCallback, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, Plus, Trash2, Users } from "lucide-react";
import { teamApi } from "../../entities/team/api";
import { ErrorNotice, Field, Loading, PageHeading } from "../../shared/ui";
import { useQuery } from "../../shared/api/use-query";
import type { Team } from "../../entities/team/model";
import { teamPayload, teamToForm } from "./model";
import type { Errors } from "../../shared/lib/validation";
import { validateTeam, type PlayerForm, type TeamForm } from "./schema";
import { ImageUpload } from "../../shared/ui/image-upload";
import { useImageUploads } from "../../shared/ui/use-image-uploads";
const newPlayer = (): PlayerForm => ({
  key: crypto.randomUUID(),
  firstName: "",
  lastName: "",
  shirtNumber: "",
  photoUrl: "",
});
export function TeamFormPage() {
  const { tournamentId = "", teamId } = useParams();
  const query = useQuery(
    useCallback(
      async (signal: AbortSignal) => {
        if (!teamId) return undefined;
        const team = await teamApi.get(teamId, signal);
        if (team.id !== teamId)
          throw new Error("Сервер вернул другую команду. Обновите страницу.");
        if (team.tournamentId !== tournamentId)
          throw new Error("Команда не принадлежит выбранному турниру.");
        if (!Array.isArray(team.players))
          throw new Error(
            "Сервер не вернул полный состав команды. Редактирование недоступно, чтобы не потерять игроков.",
          );
        return team;
      },
      [tournamentId, teamId],
    ),
  );
  if (teamId && query.data && query.data.id !== teamId) return <Loading />;
  if (teamId && (query.loading || query.error || !query.data))
    return (
      <div className="narrow">
        <PageHeading
          title="Редактировать команду"
          back={`/tournaments/${tournamentId}/teams`}
        />
        {query.loading ? (
          <Loading />
        ) : (
          <ErrorNotice
            error={query.error ?? new Error("Команда не найдена.")}
            retry={query.reload}
          />
        )}
      </div>
    );
  return (
    <TeamEditor
      key={`${tournamentId}/${teamId ?? "new"}`}
      tournamentId={tournamentId}
      team={teamId ? query.data : undefined}
    />
  );
}
function TeamEditor({
  tournamentId,
  team,
}: {
  tournamentId: string;
  team?: Team;
}) {
  const navigate = useNavigate();
  const back = `/tournaments/${tournamentId}/teams`;
  const [values, setValues] = useState<TeamForm>(() => teamToForm(team));
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const uploads = useImageUploads();
  const set = (key: "name" | "shortName" | "logoUrl", value: string) =>
    setValues((v) => ({ ...v, [key]: value }));
  const setPlayer = (key: string, field: keyof PlayerForm, value: string) =>
    setValues((v) => ({
      ...v,
      players: v.players.map((p) =>
        p.key === key ? { ...p, [field]: value } : p,
      ),
    }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || uploads.blocked) return;
    const validation = validateTeam(values);
    setErrors(validation);
    if (Object.keys(validation).length) {
      document.getElementById(Object.keys(validation)[0])?.focus();
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const payload = teamPayload(tournamentId, values);
      if (team) await teamApi.update(team.id, payload);
      else await teamApi.create(payload);
      navigate(back, { replace: true });
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="narrow">
      <PageHeading
        title={team ? "Редактировать команду" : "Новая команда"}
        description={
          team
            ? "Обновите данные команды и её состав."
            : "Добавьте команду и её состав в турнир."
        }
        back={back}
      />
      <form noValidate onSubmit={submit}>
        <fieldset disabled={busy}>
          <section className="surface form-section">
            <div className="section-title">
              <Users size={21} />
              <h2>Информация о команде</h2>
            </div>
            <Field label="Название команды *" error={errors.name}>
              <input
                id="name"
                required
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Например, ФК Кайрат"
                aria-invalid={!!errors.name}
              />
            </Field>
            <Field label="Короткое название" error={errors.shortName}>
              <input
                id="shortName"
                maxLength={50}
                value={values.shortName}
                onChange={(e) => set("shortName", e.target.value)}
                placeholder="КАЙ"
                aria-invalid={!!errors.shortName}
              />
            </Field>
            <ImageUpload
              label="Логотип команды"
              target="team"
              value={values.logoUrl}
              onChange={(url) => set("logoUrl", url)}
              onStateChange={(state) => uploads.setUploadState("logo", state)}
              disabled={busy}
            />
            {errors.logoUrl && <p className="field-error">{errors.logoUrl}</p>}
          </section>
          <div className="list-heading">
            <h2>
              Игроки <span className="count">{values.players.length}</span>
            </h2>
            <button
              className="button secondary"
              type="button"
              onClick={() =>
                setValues((v) => ({
                  ...v,
                  players: [...v.players, newPlayer()],
                }))
              }
            >
              <Plus size={18} />
              Добавить игрока
            </button>
          </div>
          {!values.players.length && (
            <div className="hint">
              Состав пока пуст. Нажмите «Добавить игрока», чтобы заполнить
              данные участников.
            </div>
          )}
          {values.players.map((p, index) => (
            <section className="surface player-form" key={p.key}>
              <div className="player-heading">
                <h3>
                  <span className="count">{index + 1}</span> Игрок
                </h3>
                <button
                  className="icon-button delete"
                  type="button"
                  aria-label={`Удалить игрока ${index + 1}`}
                  onClick={() => {
                    setValues((v) => ({
                      ...v,
                      players: v.players.filter(
                        (player) => player.key !== p.key,
                      ),
                    }));
                    setErrors({});
                  }}
                >
                  <Trash2 size={19} />
                </button>
              </div>
              <div className="form-grid">
                {(["firstName", "lastName"] as const).map((field) => (
                  <Field
                    key={field}
                    label={field === "firstName" ? "Имя *" : "Фамилия *"}
                    error={errors[`${field}-${index}`]}
                  >
                    <input
                      id={`${field}-${index}`}
                      maxLength={100}
                      required
                      value={p[field]}
                      onChange={(e) => setPlayer(p.key, field, e.target.value)}
                      aria-invalid={!!errors[`${field}-${index}`]}
                    />
                  </Field>
                ))}
              </div>
              <Field
                label="Номер футболки"
                error={errors[`shirtNumber-${index}`]}
              >
                <input
                  id={`shirtNumber-${index}`}
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={p.shirtNumber}
                  onChange={(e) =>
                    setPlayer(p.key, "shirtNumber", e.target.value)
                  }
                  aria-invalid={!!errors[`shirtNumber-${index}`]}
                />
              </Field>
              <ImageUpload
                label={`Фото игрока ${index + 1}`}
                target="player"
                value={p.photoUrl}
                onChange={(url) => setPlayer(p.key, "photoUrl", url)}
                onStateChange={(state) => uploads.setUploadState(p.key, state)}
                disabled={busy}
              />
              {errors[`photoUrl-${index}`] && (
                <p className="field-error">{errors[`photoUrl-${index}`]}</p>
              )}
            </section>
          ))}
          {values.players.length > 0 && (
            <button
              className="button secondary full-width"
              type="button"
              onClick={() =>
                setValues((v) => ({
                  ...v,
                  players: [...v.players, newPlayer()],
                }))
              }
            >
              <Plus size={18} />
              Добавить ещё игрока
            </button>
          )}
        </fieldset>
        <ErrorNotice error={error} />
        <div className="sticky-actions">
          <Link
            className={`button secondary ${busy ? "disabled" : ""}`}
            to={back}
            onClick={(e) => {
              if (busy) e.preventDefault();
            }}
          >
            Отмена
          </Link>
          <button className="button primary" disabled={busy || uploads.blocked}>
            <Check size={18} />
            {uploads.uploading
              ? "Загружаем изображения…"
              : busy
                ? "Сохраняем…"
                : "Сохранить команду"}
          </button>
        </div>
      </form>
    </div>
  );
}
