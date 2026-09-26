import { useCallback, useState } from "react";
import type { UploadState } from "./image-upload";
export function useImageUploads() {
  const [states, setStates] = useState<Record<string, UploadState>>({});
  const setUploadState = useCallback((key: string, state: UploadState) => {
    setStates((current) => {
      if ((current[key] ?? "idle") === state) return current;
      const next = { ...current };
      if (state === "idle") delete next[key];
      else next[key] = state;
      return next;
    });
  }, []);
  return {
    setUploadState,
    uploading: Object.values(states).includes("uploading"),
    blocked: Object.keys(states).length > 0,
  };
}
