"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import type { Property, Reservation } from "./types";

/** 여러 업소의 기간 예약을 불러와 합친다. refreshKey를 바꾸면 다시 불러온다 */
export function useReservations(properties: Property[], range: { from: string; to: string } | null, refreshKey = 0) {
  const key = range && properties.length ? `${properties.map((p) => p.id).join(",")}|${range.from}|${range.to}|${refreshKey}` : null;
  const [state, setState] = useState<{ key: string; data: Reservation[]; error?: string } | null>(null);

  useEffect(() => {
    if (!key || !range) return;
    let cancelled = false;
    Promise.all(properties.map((p) => api.get<Reservation[]>(`/reservations?propertyId=${p.id}&from=${range.from}&to=${range.to}`)))
      .then((results) => !cancelled && setState({ key, data: results.flat() }))
      .catch((e: Error) => !cancelled && setState((prev) => ({ key, data: prev?.data ?? [], error: e.message })));
    return () => {
      cancelled = true;
    };
    // key가 properties·range·refreshKey를 대표한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return {
    data: key === null ? [] : state?.data,
    loading: key !== null && state?.key !== key,
    error: state?.key === key ? state?.error : undefined,
  };
}
