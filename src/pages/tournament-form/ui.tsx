import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, Trophy } from "lucide-react";
import { tournamentApi } from "../../entities/tournament/api";
import {
  typeLabels,
  type TournamentInput,
  type TournamentType,
} from "../../entities/tournament/model";
import { useQuery } from "../../shared/api/use-query";
import { ErrorNotice, Field, Loading, PageHeading } from "../../shared/ui";
import type { Errors } from "../../shared/lib/validation";
import { validateTournament } from "./schema";
import { ImageUpload } from "../../shared/ui/image-upload";
import { useImageUploads } from "../../shared/ui/use-image-uploads";
const blank: TournamentInput = {
  name: "",
  description: "",
  logoUrl: "",
  startDate: "",
  endDate: "",
  maxTeams: 16,
  type: "GROUP_STAGE_WITH_PLAY_OFF",
};
export function TournamentFormPage() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const [values, setValues] = useState<TournamentInput>(blank);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const uploads = useImageUploads();
  const query = useQuery(
    useCallback(
      (signal: AbortSignal) =>
        tournamentId
          ? tournamentApi.get(tournamentId, signal)
          : Promise.resolve(undefined),
      [tournamentId],
    ),
  );
  useEffect(() => {
    if (query.data) {
      const t = query.data;
      setValues({
        name: t.name,
        description: t.description ?? "",
        logoUrl: t.logoUrl ?? "",
        startDate: t.startDate?.slice(0, 10) ?? "",
        endDate: t.endDate?.slice(0, 10) ?? "",
        maxTeams: t.maxTeams,
        type: t.type,
      });
    } else if (!tournamentId) setValues(blank);
  }, [query.data, tournamentId]);
  const set = <K extends keyof TournamentInput>(
    key: K,
    value: TournamentInput[K],
  ) => setValues((v) => ({ ...v, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || uploads.blocked) return;
    const validation = validateTournament(values);
    setErrors(validation);
    if (Object.keys(validation).length) {
      document
        .querySelector<HTMLElement>(
          '[name="' + Object.keys(validation)[0] + '"]',
        )
        ?.focus();
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const payload = {
        ...values,
        name: values.name.trim(),
        description: values.description.trim(),
        logoUrl: values.logoUrl.trim(),
      };
      const saved = tournamentId
        ? await tournamentApi.update(tournamentId, payload)
        : await tournamentApi.create(payload);
      const id = saved?.id ?? tournamentId;
      if (!id)
        throw new Error(
          "Сервер сохранил турнир, но не вернул его id. Проверьте список турниров перед повторным созданием.",
        );
      navigate(`/tournaments/${id}`, { replace: true });
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }
  const back = tournamentId ? `/tournaments/${tournamentId}` : "/tournaments";
  return (
    <div className="narrow">
      <PageHeading
        title={tournamentId ? "Редактировать турнир" : "Новый турнир"}
        description="Задайте основные параметры соревнования."
        back={back}
      />
      {query.loading ? (
        <Loading />
      ) : query.error ? (
        <ErrorNotice error={query.error} retry={query.reload} />
      ) : (
        <form onSubmit={submit} noValidate>
          <section className="surface form-section">
            <div className="section-title">
              <Trophy size={21} />
              <h2>Информация о турнире</h2>
            </div>
            <fieldset disabled={busy}>
              <Field label="Название турнира *" error={errors.name}>
                <input
                  name="name"
                  required
                  value={values.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Например, Кубок осени"
                  aria-invalid={!!errors.name}
                />
              </Field>
              <Field label="Описание">
                <textarea
                  value={values.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Расскажите о турнире"
                  rows={4}
                />
              </Field>
              <ImageUpload
                label="Логотип турнира"
                target="tournament"
                value={values.logoUrl}
                onChange={(url) => set("logoUrl", url)}
                onStateChange={(state) => uploads.setUploadState("logo", state)}
                disabled={busy}
              />
              {errors.logoUrl && (
                <p className="field-error">{errors.logoUrl}</p>
              )}
              <div className="form-grid">
                <Field label="Дата начала *" error={errors.startDate}>
                  <input
                    name="startDate"
                    type="date"
                    required
                    value={values.startDate}
                    onChange={(e) => set("startDate", e.target.value)}
                    aria-invalid={!!errors.startDate}
                  />
                </Field>
                <Field label="Дата окончания *" error={errors.endDate}>
                  <input
                    name="endDate"
                    type="date"
                    required
                    min={values.startDate}
                    value={values.endDate}
                    onChange={(e) => set("endDate", e.target.value)}
                    aria-invalid={!!errors.endDate}
                  />
                </Field>
              </div>
              <Field
                label="Максимальное количество команд *"
                error={errors.maxTeams}
              >
                <input
                  name="maxTeams"
                  type="number"
                  inputMode="numeric"
                  min={2}
                  step={1}
                  required
                  value={Number.isNaN(values.maxTeams) ? "" : values.maxTeams}
                  onChange={(e) => set("maxTeams", e.target.valueAsNumber)}
                  aria-invalid={!!errors.maxTeams}
                />
              </Field>
              <Field label="Тип турнира *">
                <select
                  value={values.type}
                  onChange={(e) =>
                    set("type", e.target.value as TournamentType)
                  }
                >
                  {Object.entries(typeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            </fieldset>
          </section>
          <ErrorNotice error={error} />
          <div className="sticky-actions">
            <Link
              className={`button secondary ${busy ? "disabled" : ""}`}
              to={back}
              aria-disabled={busy}
              onClick={(e) => {
                if (busy) e.preventDefault();
              }}
            >
              Отмена
            </Link>
            <button
              className="button primary"
              disabled={busy || uploads.blocked}
            >
              <Check size={18} />
              {uploads.uploading
                ? "Загружаем изображение…"
                : busy
                  ? "Сохраняем…"
                  : tournamentId
                    ? "Сохранить изменения"
                    : "Создать турнир"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
