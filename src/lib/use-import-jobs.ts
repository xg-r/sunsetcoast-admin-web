"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { notifyNotificationsChanged, notifyUnmappedChanged } from "./events";
import type { ImportJob } from "./types";

const POLL_MS = 1500;

/**
 * 업로드 작업 진행 상황. 끝나지 않은 작업이 있으면 1.5초마다 다시 읽는다.
 * 작업 번호는 sessionStorage에 두어 다른 화면에 갔다 와도 이어서 보여 준다.
 */
export function useImportJobs(storageKey: string) {
  const [ids, setIds] = useState<number[]>([]);
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const finishedRef = useRef(false);

  const track = useCallback(
    (next: number[]) => {
      finishedRef.current = false;
      setJobs([]);
      setIds(next);
      writeIds(storageKey, next);
    },
    [storageKey],
  );

  const clear = useCallback(() => track([]), [track]);

  // 저장한 작업 번호는 브라우저에서만 읽는다 (미리 렌더링한 화면과 어긋나지 않도록)
  useEffect(() => {
    const stored = readIds(storageKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored.length) setIds(stored);
  }, [storageKey]);

  useEffect(() => {
    if (ids.length === 0) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const list = await api.get<ImportJob[]>(`/import-jobs?ids=${ids.join(",")}`);
        if (stopped) return;
        setJobs(list);
        setError(null);
        const done = list.length > 0 && list.every((j) => j.status === "SUCCEEDED" || j.status === "FAILED");
        if (done) {
          if (!finishedRef.current) {
            finishedRef.current = true;
            notifyNotificationsChanged();
            notifyUnmappedChanged();
          }
          return;
        }
      } catch (e) {
        if (!stopped) setError((e as Error).message);
      }
      if (!stopped) timer = setTimeout(poll, POLL_MS);
    };
    void poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [ids]);

  const finished = jobs.length > 0 && jobs.every((j) => j.status === "SUCCEEDED" || j.status === "FAILED");
  return { ids, jobs, finished, error, track, clear };
}

function readIds(key: string): number[] {
  try {
    const raw = window.sessionStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
}

function writeIds(key: string, ids: number[]) {
  try {
    if (ids.length) window.sessionStorage.setItem(key, JSON.stringify(ids));
    else window.sessionStorage.removeItem(key);
  } catch {
    // 저장소를 못 쓰면 이 화면에 있는 동안만 보여 준다
  }
}
