// 화면 사이에 "미매핑 행 수가 바뀌었다"를 알린다 (사이드바 배지 갱신)
const UNMAPPED_CHANGED = "sunsetcoast:unmapped-changed";

export function notifyUnmappedChanged() {
  window.dispatchEvent(new Event(UNMAPPED_CHANGED));
}

export function onUnmappedChanged(listener: () => void): () => void {
  window.addEventListener(UNMAPPED_CHANGED, listener);
  return () => window.removeEventListener(UNMAPPED_CHANGED, listener);
}

// 알림이 새로 생겼을 수 있다 (업로드 작업이 끝남) → 사이드바 알림 다시 읽기
const NOTIFICATIONS_CHANGED = "sunsetcoast:notifications-changed";

export function notifyNotificationsChanged() {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
}

export function onNotificationsChanged(listener: () => void): () => void {
  window.addEventListener(NOTIFICATIONS_CHANGED, listener);
  return () => window.removeEventListener(NOTIFICATIONS_CHANGED, listener);
}
