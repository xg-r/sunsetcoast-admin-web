"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { roomLabel } from "@/lib/format";
import type { Room } from "@/lib/types";

export type RoomStatus = "CHECK_IN" | "STAY" | "EMPTY";

/** 상태 색. 입실·연박은 같은 계열(투숙), 빈 방은 무채색 */
export const STATUS_COLOR: Record<RoomStatus, string> = {
  CHECK_IN: "#ea580c",
  STAY: "#fdba74",
  EMPTY: "#dbe2ea",
};

export interface RoomCell {
  room: Room;
  status: RoomStatus;
  /** 그 달 가동률 0~1. 블록 높이 */
  occupancy: number;
}

/** 블록 하나의 바닥 크기 (유형별) */
const FOOTPRINT: Record<string, [number, number]> = {
  POOL_VILLA: [1.7, 1.5],
  RESORT: [0.95, 0.95],
  SPACE_CARAVAN: [1.0, 1.25],
  AIR_STREAM: [1.0, 1.25],
  CARAVAN: [1.0, 1.25],
};
const GAP = 0.35;
const MIN_HEIGHT = 0.18;
const MAX_HEIGHT = 2.6;

interface Placed {
  room: Room;
  x: number;
  z: number;
  w: number;
  d: number;
}

interface Platform {
  propertyId: number;
  cx: number;
  cz: number;
  w: number;
  d: number;
}

/** 업소별로 객실을 줄지어 놓는다. 줄 = 객실 유형 (리조트는 층) */
function layout(rooms: Room[], propertyOrder: number[]): { placed: Placed[]; platforms: Platform[] } {
  const placed: Placed[] = [];
  const platforms: Platform[] = [];
  let offsetX = 0;
  propertyOrder.forEach((propertyId) => {
    const own = rooms.filter((r) => r.propertyId === propertyId);
    if (!own.length) return;
    const rows = new Map<string, Room[]>();
    own.forEach((r) => {
      const key = r.type === "RESORT" ? `RESORT_${r.name.charAt("RESORT_".length)}` : r.type;
      rows.set(key, [...(rows.get(key) ?? []), r]);
    });
    const rowList = [...rows.values()];
    const rowWidths = rowList.map((row) => row.reduce((sum, r) => sum + (FOOTPRINT[r.type]?.[0] ?? 1) + GAP, -GAP));
    const width = Math.max(...rowWidths);
    let z = 0;
    rowList.forEach((row, i) => {
      const depth = Math.max(...row.map((r) => FOOTPRINT[r.type]?.[1] ?? 1));
      let x = offsetX + (width - rowWidths[i]) / 2;
      row.forEach((r) => {
        const [w, d] = FOOTPRINT[r.type] ?? [1, 1];
        placed.push({ room: r, x: x + w / 2, z: z + depth / 2, w, d });
        x += w + GAP;
      });
      z += depth + GAP * 2;
    });
    const depth = z - GAP * 2;
    platforms.push({ propertyId, cx: offsetX + width / 2, cz: depth / 2, w: width + 1.2, d: depth + 1.2 });
    offsetX += width + 2.6;
  });
  // 전체를 원점 중심으로
  const minX = Math.min(...platforms.map((p) => p.cx - p.w / 2));
  const maxX = Math.max(...platforms.map((p) => p.cx + p.w / 2));
  const maxD = Math.max(...platforms.map((p) => p.d));
  const shiftX = -(minX + maxX) / 2;
  const shiftZ = -maxD / 2 + 0.6;
  placed.forEach((p) => {
    p.x += shiftX;
    p.z += shiftZ;
  });
  platforms.forEach((p) => {
    p.cx += shiftX;
    p.cz += shiftZ;
  });
  return { placed, platforms };
}

interface Block {
  mesh: THREE.Mesh<RoundedBoxGeometry, THREE.MeshStandardMaterial>;
  label: CSS2DObject;
  targetHeight: number;
  height: number;
  targetColor: THREE.Color;
  placed: Placed;
}

/**
 * 객실 3D 현황판. 객실마다 블록 하나, 색은 상태, 높이는 가동률.
 * 마우스로 돌리고(드래그) 확대(휠)하며, 블록에 올리면 툴팁, 누르면 onSelect.
 */
export function RoomScene3D({
  cells,
  propertyOrder,
  propertyNames,
  focusPropertyId,
  selectedRoomId,
  onSelect,
  describe,
}: {
  cells: RoomCell[];
  propertyOrder: number[];
  propertyNames: Record<number, string>;
  /** 카메라를 이 업소에 맞춘다. null이면 전체 */
  focusPropertyId: number | null;
  selectedRoomId: number | null;
  onSelect: (roomId: number | null) => void;
  describe: (roomId: number) => React.ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ReturnType<typeof createScene> | null>(null);
  const [hover, setHover] = useState<{ roomId: number; x: number; y: number; width: number } | null>(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // 객실 구성이 바뀔 때만 장면을 새로 만든다
  const roomKey = cells.map((c) => c.room.id).join(",") + "|" + propertyOrder.join(",");
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !cells.length) return;
    const scene = createScene(host, cells.map((c) => c.room), propertyOrder, propertyNames, {
      hover: (roomId, x, y) => setHover(roomId === null ? null : { roomId, x, y, width: host.clientWidth }),
      click: (roomId) => onSelectRef.current(roomId),
    });
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
    // roomKey가 객실 구성을 대표한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomKey]);

  useEffect(() => {
    sceneRef.current?.update(cells);
  }, [cells, roomKey]);
  useEffect(() => {
    sceneRef.current?.select(selectedRoomId);
  }, [selectedRoomId, roomKey]);
  useEffect(() => {
    sceneRef.current?.focus(focusPropertyId);
  }, [focusPropertyId, roomKey]);

  return (
    <div className="relative h-[360px] overflow-hidden rounded-xl sm:h-[520px]">
      <div ref={hostRef} className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing" />
      {hover && (
        <div
          className="pointer-events-none absolute z-10 min-w-40 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur"
          style={{
            left: Math.min(hover.x + 14, hover.width - 180),
            top: Math.max(hover.y - 12, 8),
          }}
        >
          {describe(hover.roomId)}
        </div>
      )}
    </div>
  );
}

function createScene(
  host: HTMLDivElement,
  rooms: Room[],
  propertyOrder: number[],
  propertyNames: Record<number, string>,
  on: { hover: (roomId: number | null, x: number, y: number) => void; click: (roomId: number | null) => void },
) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const width = () => host.clientWidth || 1;
  const height = () => host.clientHeight || 1;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width(), height());
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const labels = new CSS2DRenderer();
  labels.setSize(width(), height());
  labels.domElement.style.position = "absolute";
  labels.domElement.style.inset = "0";
  labels.domElement.style.pointerEvents = "none";
  host.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, width() / height(), 0.1, 200);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xcbd5e1, 1.6));
  const sun = new THREE.DirectionalLight(0xfff1e0, 2.2);
  sun.position.set(-8, 14, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -18;
  sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -12;
  sun.shadow.radius = 4;
  scene.add(sun);

  const { placed, platforms } = layout(rooms, propertyOrder);

  // 바닥 (그림자만 받는 투명 평면) + 업소 발판
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.08 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  scene.add(ground);

  const disposables: { dispose: () => void }[] = [ground.geometry, ground.material];
  platforms.forEach((p) => {
    const geometry = new RoundedBoxGeometry(p.w, 0.16, p.d, 4, 0.3);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    const slab = new THREE.Mesh(geometry, material);
    slab.position.set(p.cx, -0.08, p.cz);
    slab.receiveShadow = true;
    scene.add(slab);
    disposables.push(geometry, material);

    const tag = document.createElement("div");
    tag.textContent = propertyNames[p.propertyId] ?? "";
    tag.className = "rounded-full bg-slate-900/80 px-2.5 py-1 text-[11px] font-semibold text-white whitespace-nowrap";
    const label = new CSS2DObject(tag);
    label.position.set(p.cx, 0, p.cz + p.d / 2 + 0.2);
    scene.add(label);
  });

  const blocks = new Map<number, Block>();
  placed.forEach((p) => {
    // 높이 1짜리를 만들어 scale.y로 늘린다 (모서리 둥글기는 조금 늘어나지만 눈에 띄지 않는다)
    const geometry = new RoundedBoxGeometry(p.w, 1, p.d, 3, 0.08);
    geometry.translate(0, 0.5, 0);
    const material = new THREE.MeshStandardMaterial({ color: STATUS_COLOR.EMPTY, roughness: 0.55, metalness: 0.02 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(p.x, 0, p.z);
    mesh.scale.y = MIN_HEIGHT;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.roomId = p.room.id;
    scene.add(mesh);
    disposables.push(geometry, material);

    const tag = document.createElement("div");
    tag.textContent = roomLabel(p.room.name).replace(/^리조트 /, "").replace("프리미엄 풀빌라", "프리미엄");
    tag.className = "text-[10px] font-medium text-slate-700 whitespace-nowrap [text-shadow:0_0_3px_white,0_0_3px_white]";
    const label = new CSS2DObject(tag);
    label.position.set(p.x, MIN_HEIGHT + 0.25, p.z);
    scene.add(label);

    blocks.set(p.room.id, {
      mesh,
      label,
      height: MIN_HEIGHT,
      targetHeight: MIN_HEIGHT,
      targetColor: new THREE.Color(STATUS_COLOR.EMPTY),
      placed: p,
    });
  });

  // 선택 테두리
  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x0f172a });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.7, 48), ringMaterial);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.005;
  ring.visible = false;
  scene.add(ring);
  disposables.push(ring.geometry, ringMaterial);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 6;
  controls.maxDistance = 45;
  controls.maxPolarAngle = Math.PI / 2.15;
  controls.enablePan = true;

  // 카메라 목표 (focus)
  const camGoal = { target: new THREE.Vector3(), position: new THREE.Vector3() };
  let camAnimating = false;
  const fitTo = (bounds: { minX: number; maxX: number; minZ: number; maxZ: number }, instant: boolean) => {
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cz = (bounds.minZ + bounds.maxZ) / 2;
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const aspect = width() / height();
    // 가로는 화면 폭, 세로(깊이)는 비스듬히 보이므로 조금 줄여서 맞춘다
    const distance = Math.max((bounds.maxX - bounds.minX) / 2 / (tan * aspect), ((bounds.maxZ - bounds.minZ) * 0.9) / 2 / tan) * 1.32;
    camGoal.target.set(cx, 0.6, cz);
    camGoal.position.set(cx + distance * 0.18, distance * 0.62, cz + distance * 0.8);
    if (instant || reduceMotion) {
      controls.target.copy(camGoal.target);
      camera.position.copy(camGoal.position);
      camAnimating = false;
    } else {
      camAnimating = true;
    }
  };
  const boundsOf = (propertyId: number | null) => {
    const list = platforms.filter((p) => propertyId === null || p.propertyId === propertyId);
    return {
      minX: Math.min(...list.map((p) => p.cx - p.w / 2)),
      maxX: Math.max(...list.map((p) => p.cx + p.w / 2)),
      minZ: Math.min(...list.map((p) => p.cz - p.d / 2)),
      maxZ: Math.max(...list.map((p) => p.cz + p.d / 2)),
    };
  };
  let focused: number | null = null;
  fitTo(boundsOf(null), true);
  controls.addEventListener("start", () => (camAnimating = false));

  // 마우스 올림 / 누름
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hovered: number | null = null;
  let downAt: { x: number; y: number } | null = null;
  const pick = (event: PointerEvent): number | null => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects([...blocks.values()].map((b) => b.mesh), false)[0];
    return hit ? (hit.object.userData.roomId as number) : null;
  };
  const onMove = (event: PointerEvent) => {
    if (event.buttons) {
      if (hovered !== null) {
        hovered = null;
        on.hover(null, 0, 0);
      }
      return;
    }
    const roomId = pick(event);
    const rect = renderer.domElement.getBoundingClientRect();
    hovered = roomId;
    renderer.domElement.style.cursor = roomId === null ? "" : "pointer";
    on.hover(roomId, event.clientX - rect.left, event.clientY - rect.top);
  };
  const onLeave = () => {
    hovered = null;
    on.hover(null, 0, 0);
  };
  const onDown = (event: PointerEvent) => (downAt = { x: event.clientX, y: event.clientY });
  const onUp = (event: PointerEvent) => {
    if (!downAt || Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) > 5) return;
    on.click(pick(event));
  };
  renderer.domElement.addEventListener("pointermove", onMove);
  renderer.domElement.addEventListener("pointerleave", onLeave);
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointerup", onUp);

  const resize = new ResizeObserver(() => {
    renderer.setSize(width(), height());
    labels.setSize(width(), height());
    camera.aspect = width() / height();
    camera.updateProjectionMatrix();
    fitTo(boundsOf(focused), true);
  });
  resize.observe(host);

  let selected: number | null = null;
  const highlight = new THREE.Color();
  let frame = 0;
  const tick = () => {
    frame = requestAnimationFrame(tick);
    const k = reduceMotion ? 1 : 0.14;
    blocks.forEach((b, id) => {
      b.height += (b.targetHeight - b.height) * k;
      b.mesh.scale.y = b.height;
      b.label.position.y = b.height + 0.25;
      b.mesh.material.color.lerp(b.targetColor, k);
      const lit = id === hovered || id === selected;
      b.mesh.material.emissive.copy(lit ? highlight.set(0x334155) : highlight.set(0x000000));
      b.mesh.material.emissiveIntensity = lit ? 0.18 : 0;
    });
    if (camAnimating) {
      controls.target.lerp(camGoal.target, 0.08);
      camera.position.lerp(camGoal.position, 0.08);
      if (camera.position.distanceTo(camGoal.position) < 0.02) camAnimating = false;
    }
    controls.update();
    renderer.render(scene, camera);
    labels.render(scene, camera);
  };
  tick();

  return {
    update(cells: RoomCell[]) {
      cells.forEach((cell) => {
        const block = blocks.get(cell.room.id);
        if (!block) return;
        block.targetHeight = MIN_HEIGHT + cell.occupancy * (MAX_HEIGHT - MIN_HEIGHT);
        block.targetColor.set(STATUS_COLOR[cell.status]);
      });
    },
    select(roomId: number | null) {
      selected = roomId;
      const block = roomId === null ? undefined : blocks.get(roomId);
      ring.visible = !!block;
      if (block) {
        const r = Math.max(block.placed.w, block.placed.d) * 0.62;
        ring.geometry.dispose();
        ring.geometry = new THREE.RingGeometry(r, r + 0.07, 48);
        ring.position.x = block.placed.x;
        ring.position.z = block.placed.z;
      }
    },
    focus(propertyId: number | null) {
      if (propertyId === focused) return;
      focused = propertyId;
      fitTo(boundsOf(propertyId), false);
    },
    dispose() {
      cancelAnimationFrame(frame);
      resize.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerleave", onLeave);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      host.replaceChildren();
    },
  };
}
