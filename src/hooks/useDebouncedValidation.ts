import { useEffect, useMemo, useRef, useState } from "react";

import {
  trainingService,
  type TrainingValidationResponse,
  type ValidateTrainingOptions,
} from "@/services/trainingService";
import type { TrainingConfig } from "@/types";

type UseDebouncedValidationArgs = {
  projectId: string;
  config: TrainingConfig;
  enabled: boolean;
  delayMs?: number;
  validateOptions?: Omit<ValidateTrainingOptions, "signal">;
};

type UseDebouncedValidationResult = {
  serverResult: TrainingValidationResponse | null;
  isValidating: boolean;
  lastValidatedAt: string | null;
  validationError: string | null;
};

function isAbortError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  return /abort|cancel(l)?ed/i.test(msg);
}

export function useDebouncedValidation({
  projectId,
  config,
  enabled,
  delayMs = 500,
  validateOptions,
}: UseDebouncedValidationArgs): UseDebouncedValidationResult {
  const [serverResult, setServerResult] = useState<TrainingValidationResponse | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [lastValidatedAt, setLastValidatedAt] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const sequenceRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const payloadKey = useMemo(() => JSON.stringify(config), [config]);
  const validateOptionsKey = useMemo(() => JSON.stringify(validateOptions ?? {}), [validateOptions]);

  useEffect(() => {
    if (!enabled || !String(projectId ?? "").trim()) {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      setIsValidating(false);
      return;
    }

    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    sequenceRef.current += 1;
    const seq = sequenceRef.current;

    const timeoutId = window.setTimeout(async () => {
      setIsValidating(true);
      setValidationError(null);

      try {
        const out = await trainingService.validateTraining(projectId, config, {
          ...(validateOptions ?? {}),
          signal: controller.signal,
        });
        if (seq !== sequenceRef.current || controller.signal.aborted) return;
        setServerResult(out);
        setLastValidatedAt(new Date().toISOString());
      } catch (error: unknown) {
        if (seq !== sequenceRef.current || controller.signal.aborted || isAbortError(error)) return;
        setValidationError(error instanceof Error ? error.message : "Validation serveur indisponible.");
      } finally {
        if (seq === sequenceRef.current && !controller.signal.aborted) {
          setIsValidating(false);
        }
      }
    }, delayMs);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    };
  }, [delayMs, enabled, payloadKey, projectId, validateOptionsKey]);

  return {
    serverResult,
    isValidating,
    lastValidatedAt,
    validationError,
  };
}

export default useDebouncedValidation;
