// Camera để QUAN SÁT và GHI HÌNH. AI của Urban Sound chỉ phân tích âm thanh, không phân tích hình ảnh.

export const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));

export class Camera {
  constructor(video) {
    this.video = video;
    this.facing = isMobile() ? 'environment' : 'user'; // điện thoại: mặc định camera sau
    this.stream = null;
    // iPhone/iPad: BẮT BUỘC phát "trong trang", nếu không iOS tự mở trình phát toàn màn hình
    // và khi thoát ra thì tạm dừng luôn camera.
    video.setAttribute('playsinline', ''); video.setAttribute('webkit-playsinline', '');
    video.setAttribute('muted', ''); video.setAttribute('autoplay', '');
    video.setAttribute('disablepictureinpicture', ''); video.setAttribute('disableremoteplayback', '');
    video.playsInline = true; video.muted = true; video.controls = false;
    const resume = () => { if (this.stream && video.paused) video.play().catch(() => {}); };
    // Lỡ bị mở toàn màn hình (iOS cũ) → thoát ngay và phát tiếp trong khung
    video.addEventListener('webkitbeginfullscreen', () => { try { video.webkitExitFullscreen(); } catch { /* bỏ qua */ } });
    video.addEventListener('webkitendfullscreen', () => setTimeout(resume, 50));
    // Bị tạm dừng (thoát toàn màn hình, chuyển tab rồi quay lại…) → tự phát tiếp
    video.addEventListener('pause', () => setTimeout(resume, 120));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(resume, 200); });
  }

  get on() { return !!this.stream; }
  get ready() { return this.on && this.video.readyState >= 2 && this.video.videoWidth > 0; }
  /** Camera trước được lật ngang như gương, camera sau giữ nguyên. */
  get mirror() { return this.facing !== 'environment'; }

  /** Ràng buộc video dùng chung (cũng dùng khi xin quyền micro + camera một lần). */
  constraints(facing = this.facing) {
    const big = !isMobile(); // điện thoại: 720p cho mượt, máy tính: 1080p
    return { width: { ideal: big ? 1920 : 1280 }, height: { ideal: big ? 1080 : 720 }, frameRate: { ideal: 30, max: 30 }, facingMode: { ideal: facing } };
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
    const { facingMode: _f, ...base } = this.constraints(facing);
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
    const st = this.stream;
    this.stream = null; // đặt trước để sự kiện "pause" không tự phát lại
    st?.getTracks().forEach((t) => t.stop());
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
