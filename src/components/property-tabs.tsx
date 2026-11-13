"use client";

import { Segmented } from "./ui";
import type { Property } from "@/lib/types";

const shortName: Record<string, string> = {
  SUNSETCOAST_CAMPING: "선셋코스트",
  STAYDND_POOLVILLA: "스테이디앤디",
};

export function PropertyTabs({ properties, value, onChange }: { properties: Property[]; value: number | null; onChange: (id: number) => void }) {
  if (!properties.length) return null;
  return <Segmented options={properties.map((p) => ({ value: p.id, label: shortName[p.code] ?? p.name }))} value={value} onChange={onChange} />;
}
