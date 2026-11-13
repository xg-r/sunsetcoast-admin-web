"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

interface State<T> {
  key: string;
  data?: T;
  error?: string;
}

/**
 * GET 요청. path가 바뀌거나 reload()를 부르면 다시 불러온다.
 * 다시 불러오는 동안에는 이전 데이터를 그대로 보여준다.
 */
export function useApi<T>(path: string | null) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<State<T> | null>(null);
  const key = path === null ? null : `${path}#${version}`;

  useEffect(() => {
    if (path === null || key === null) return;
    let cancelled = false;
    api
      .get<T>(path)
      .then((data) => !cancelled && setState({ key, data }))
      .catch((e: Error) => !cancelled && setState((prev) => ({ key, data: prev?.data, error: e.message })));
    return () => {
      cancelled = true;
    };
  }, [path, key]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return {
    data: state?.data,
    error: state?.key === key ? state?.error : undefined,
    loading: key !== null && state?.key !== key,
    reload,
  };
}
