import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, X } from "lucide-react";
import { errorMessage } from "../api/client";
import { imageSrc } from "../api/images";
export function ErrorNotice({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  if (!error) return null;
  return (
    <div className="error" role="alert">
      <p>{errorMessage(error)}</p>
      {retry && (
        <button type="button" className="button secondary" onClick={retry}>
          Повторить
        </button>
      )}
    </div>
  );
}
export function Loading() {
  return (
    <div className="empty" role="status">
      <span className="spinner" />
      Загружаем данные…
    </div>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}
export function PageHeading({
  title,
  description,
  back,
  action,
}: {
  title: string;
  description?: string;
  back?: string;
  action?: ReactNode;
}) {
  return (
    <>
      <div className="heading">
        {back && (
          <Link className="back" to={back}>
            <ArrowLeft size={18} />
            Назад
          </Link>
        )}
        <div className="heading-row">
          <div>
            <h1>{title}</h1>
            {description && <p>{description}</p>}
          </div>
          {action}
        </div>
      </div>
    </>
  );
}
export function Status({ value, label }: { value: string; label: string }) {
  return (
    <span className={`status status-${value.toLowerCase()}`}>
      {label ?? value}
    </span>
  );
}
export function Logo({ url, name }: { url?: string | null; name: string }) {
  return (
    <span className="logo">
      {url ? (
        <img
          key={url}
          src={imageSrc(url)}
          alt=""
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : null}
      <span>{name.slice(0, 2).toUpperCase()}</span>
    </span>
  );
}
export function Confirm({
  title,
  children,
  busy,
  onClose,
  onConfirm,
  confirmLabel = "Сбросить жеребьевку",
  busyLabel = "Сбрасываем…",
  tone = "danger",
}: {
  title: string;
  children: ReactNode;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  busyLabel?: string;
  tone?: "danger" | "primary";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => {
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Закрыть"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
      <div className="dialog-actions">
        <button className="button secondary" disabled={busy} onClick={onClose}>
          Отмена
        </button>
        <button
          className={`button ${tone}`}
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? busyLabel : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
export function dateLabel(value?: string) {
  if (!value) return "Не указана";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("ru-RU");
}
