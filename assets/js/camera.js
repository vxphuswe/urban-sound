// Camera để QUAN SÁT và GHI HÌNH. AI của Urban Sound chỉ phân tích âm thanh, không phân tích hình ảnh.

export const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));

export class Camera {
  constructor(video) {
    this.video = video;
    this.facing = isMobile() ? 'environment' : 'user'; // điện thoại: mặc định camera sau
    this.stream = null;
  }

  get on() { return !!this.stream; }
  get ready() { return this.on && this.video.readyState >= 2 && this.video.videoWidth > 0; }
  /** Camera trước được lật ngang như gương, camera sau giữ nguyên. */
  get mirror() { return this.facing !== 'environment'; }

  /** Ràng buộc video dùng chung (cũng dùng khi xin quyền micro + camera một lần). */
  constraints(facing = this.facing) {
    return { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 30 }, facingMode: { ideal: facing } };
  }

  /** Nhận luồng video đã xin sẵn. */
  async adopt(stream) {
    this.stop();
    this.stream = stream;
    const st = stream.getVideoTracks()[0]?.getSettings?.() || {};
    this.facing = st.facingMode || this.facing;
    this.video.srcObject = stream;
    this.video.muted = true;
    await this.video.play().catch(() => {});
    return this;
  }

  async start(facing = this.facing) {
    const base = { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 30 } };
    this.stop(); // nhiều điện thoại không mở được 2 camera cùng lúc
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { ...base, facingMode: { exact: facing } }, audio: false });
    } catch (e) {
      if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') throw e;
      // Máy tính chỉ có 1 webcam hoặc trình duyệt không hỗ trợ "exact" → thử lại mềm hơn
      stream = await navigator.mediaDevices.getUserMedia({ video: { ...base, facingMode: { ideal: facing } }, audio: false });
    }
    this.stream = stream;
    const st = stream.getVideoTracks()[0]?.getSettings?.() || {};
    this.facing = st.facingMode || facing;
    this.video.srcObject = stream;
    this.video.muted = true;
    await this.video.play().catch(() => {});
    return this;
  }

  async flip() {
    const prev = this.facing;
    try {
      return await this.start(prev === 'environment' ? 'user' : 'environment');
    } catch (e) {
      await this.start(prev).catch(() => {}); // không đổi được → mở lại camera cũ
      throw e;
    }
  }

  get track() { return this.stream?.getVideoTracks()[0]; }

  stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) this.video.srcObject = null;
  }
}

export async function countCameras() {
  try { return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput').length; } catch { return 0; }
}

export function cameraErrorMessage(e) {
  const n = e?.name || '', m = e?.message || '';
  if (document.featurePolicy && !document.featurePolicy.allowsFeature('camera')) return 'Máy chủ web đang chặn camera (Permissions-Policy trong vercel.json). Hãy kiểm tra lại cấu hình rồi tải lại trang bằng Ctrl + Shift + R.';
  if (n === 'NotAllowedError' && /system/i.test(m)) return 'Hệ điều hành đang chặn trình duyệt dùng camera. Windows: Settings → Privacy & security → Camera → bật “Camera access” và “Let desktop apps access your camera”. macOS: System Settings → Privacy & Security → Camera → bật cho trình duyệt.';
  if (n === 'NotAllowedError' || n === 'SecurityError') return 'Trình duyệt đang chặn camera cho trang này. Bấm biểu tượng bên trái thanh địa chỉ → Camera → Cho phép. Nếu không thấy mục Camera, mở chrome://settings/content/camera và chọn “Trang web có thể yêu cầu dùng camera”.';
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'Không tìm thấy camera trên thiết bị này.';
  if (n === 'NotReadableError') return 'Camera đang được ứng dụng khác dùng (Zoom, Meet…). Hãy đóng ứng dụng đó rồi thử lại.';
  if (!window.isSecureContext) return 'Camera chỉ hoạt động trên HTTPS hoặc localhost.';
  return `Không mở được camera (${n}): ${m}`;
}
