import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, RotateCcw, X } from "lucide-react";
import { imageSrc, uploadImage, type ImageTarget } from "../api/images";
import { errorMessage } from "../api/client";

export type UploadState = "idle" | "uploading" | "error";
type Props = {
  label: string;
  target: ImageTarget;
  value: string;
  onChange: (value: string) => void;
  onStateChange: (state: UploadState) => void;
  disabled?: boolean;
};
export function ImageUpload({
  label,
  target,
  value,
  onChange,
  onStateChange,
  disabled = false,
}: Props) {
  const id = useId();
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState("");
  const [state, setState] = useState<UploadState>("idle");
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const notify = useRef(onStateChange);
  notify.current = onStateChange;
  useEffect(
    () => () => {
      request.current?.abort();
      notify.current("idle");
    },
    [],
  );
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function changeState(next: UploadState) {
    setState(next);
    notify.current(next);
  }
  async function startUpload(selected: File) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setError("");
    if (!selected.type.startsWith("image/") || selected.size === 0) {
      setFile(undefined);
      setError("Выберите непустой файл изображения.");
      changeState("error");
      return;
    }
    setFile(selected);
    changeState("uploading");
    try {
      const url = await uploadImage(target, selected, controller.signal);
      if (controller.signal.aborted) return;
      onChange(url);
      changeState("idle");
    } catch (reason) {
      if (controller.signal.aborted) return;
      setError(errorMessage(reason));
      changeState("error");
    }
  }
  function cancelSelection() {
    request.current?.abort();
    setFile(undefined);
    setError("");
    changeState("idle");
    if (input.current) input.current.value = "";
  }
  return (
    <div className="image-field">
      <label className="image-field-label" htmlFor={id}>
        {label}
      </label>
      <div className="image-upload" aria-busy={state === "uploading"}>
        <div
          className={`image-preview ${target === "player" ? "portrait" : ""}`}
        >
          {preview || value ? (
            <img
              src={preview || imageSrc(value)}
              alt={`Предпросмотр: ${label}`}
            />
          ) : (
            <ImagePlus size={28} />
          )}
        </div>
        <div className="image-upload-controls">
          <input
            ref={input}
            id={id}
            type="file"
            accept="image/*"
            disabled={disabled}
            aria-describedby={`${id}-status`}
            onChange={(e) => {
              const selected = e.target.files?.[0];
              e.target.value = "";
              if (selected) void startUpload(selected);
            }}
          />
          <button
            className="button secondary"
            type="button"
            disabled={disabled}
            onClick={() => input.current?.click()}
          >
            <ImagePlus size={18} />
            {value || file ? "Заменить изображение" : "Выбрать изображение"}
          </button>
          <p id={`${id}-status`} role="status">
            {state === "uploading"
              ? "Загружаем изображение…"
              : state === "error"
                ? "Изображение не загружено"
                : file && value
                  ? "Изображение загружено"
                  : value
                    ? "Изображение сохранено"
                    : "Выберите фото или файл с устройства"}
          </p>
          {file && <span className="image-file-name">{file.name}</span>}
        </div>
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="image-upload-actions">
        {state === "error" && file && (
          <button
            type="button"
            className="button secondary"
            disabled={disabled}
            onClick={() => void startUpload(file)}
          >
            <RotateCcw size={16} />
            Повторить
          </button>
        )}
        {state !== "idle" && (
          <button
            type="button"
            className="button secondary"
            disabled={disabled}
            onClick={cancelSelection}
          >
            Отменить загрузку
          </button>
        )}
        {value && state === "idle" && (
          <button
            type="button"
            className="button secondary"
            disabled={disabled}
            onClick={() => {
              cancelSelection();
              onChange("");
            }}
          >
            <X size={16} />
            Убрать изображение
          </button>
        )}
      </div>
    </div>
  );
}
