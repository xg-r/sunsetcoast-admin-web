// 화면 사이에 "미매핑 행 수가 바뀌었다"를 알린다 (사이드바 배지 갱신)
const UNMAPPED_CHANGED = "sunsetcoast:unmapped-changed";

export function notifyUnmappedChanged() {
  window.dispatchEvent(new Event(UNMAPPED_CHANGED));
}

export function onUnmappedChanged(listener: () => void): () => void {
  window.addEventListener(UNMAPPED_CHANGED, listener);
  return () => window.removeEventListener(UNMAPPED_CHANGED, listener);
}
