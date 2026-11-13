"use client";

import { useEffect, useState } from "react";
import type { Property } from "./types";
import { useApi } from "./use-api";

const STORAGE_KEY = "sunsetcoast-admin:property";

function readStored(): number | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value ? Number(value) : null;
  } catch {
    return null;
  }
}

/** 업소 목록과 선택한 업소 (선택은 브라우저에 기억한다) */
export function useProperty() {
  const { data: properties, error } = useApi<Property[]>("/properties");
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    if (!properties?.length || selected !== null) return;
    const stored = readStored();
    const next = properties.some((p) => p.id === stored) ? stored : properties[0].id;
    // 저장된 값을 처음 한 번만 읽어 온다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(next);
  }, [properties, selected]);

  const select = (id: number) => {
    setSelected(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(id));
    } catch {
      // 저장하지 못해도 선택은 유지된다
    }
  };

  return { properties: properties ?? [], propertyId: selected, select, error };
}
