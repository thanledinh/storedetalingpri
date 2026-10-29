/* Trang "Xe dán PPF" (trang đầu, ngay sau START): đúng khúc phim ghép vào xe của trang storedetailing (dự án son-wowww,
   src/v3/stage.js, giây 13,1 → 18,5): một vòng quanh chiếc Porsche 911 với bộ PPF lơ lửng quanh xe, rồi phim ập vào
   xe dưới một vệt sáng chạy dọc thân và sơn bóng sâu lên. Xe, khuôn phim, ánh sáng, cách tô bóng và xử lý màu là của
   trang đó, chép nguyên (ppf/, chỉ ppf/studio.js đổi đường dẫn file), nên màu y hệt trang đó.
   Cảnh chạy theo thanh cuộn của trang: cuộn xuống phim ghép vào xe, cuộn lên xem lại.
   Mô hình xe: "Porsche 911" của Outlaw Games (Sketchfab, CC BY-NC 4.0), đã chỉnh sửa. */
import * as THREE from 'three';
import { isTouch } from './ppf/studio.js';
import { createPpfScene, SEGMENT } from './ppf/v3/ppf-scene.js';

const clamp01 = (t) => Math.min(1, Math.max(0, t));

/** onProgress(0..1): phần đã tải (theo số file: xe, ảnh môi trường, khuôn phim, bộ giải nén), để màn tải hiện phần trăm.
    onLost(): trình duyệt tắt WebGL của cảnh (iPhone làm vậy khi thiếu bộ nhớ) — trang báo lỗi thay vì để khung trống */
export async function createCarStage(canvas, { onProgress, onLost } = {}) {
  const manager = THREE.DefaultLoadingManager, before = manager.onProgress;
  manager.onProgress = (url, loaded, total) => onProgress && onProgress(loaded / total);
  // (chính dispose() cũng tắt WebGL để trả bộ nhớ: lúc đó không báo)
  let disposed = false;
  canvas.addEventListener('webglcontextlost', () => { if (!disposed && onLost) onLost(); }, { once: true });
  let ppf = null;
  try {
    ppf = createPpfScene({ canvas });
    // mất WebGL lúc đang dựng thì ready không bao giờ xong: quá 30 giây coi như lỗi, nút START vẫn mở
    await Promise.race([ppf.ready, new Promise((_, fail) => setTimeout(() => fail(new Error('dựng cảnh quá 30 giây')), 30000))]);
  } catch (err) {
    disposed = true;
    ppf?.dispose();                                       // (index.html then shows the stage's failure message)
    throw err;
  } finally {
    manager.onProgress = before;
  }

  // t (giây của cảnh, trong SEGMENT) đuổi theo thanh cuộn như trang kia (mỗi khung hình 45% quãng còn lại, điện thoại
  // 20%); chỉ vẽ liên tục khi trang đang mở, ngoài ra giữ khung hình cuối
  let active = false, raf = 0, t = SEGMENT.start, goal = SEGMENT.start;
  const draw = (now = performance.now()) => {
    ppf.setTime(t);
    ppf.render(now / 1000);
  };
  function frame(now) {
    t += (goal - t) * (isTouch ? 0.2 : 0.45);
    if (Math.abs(goal - t) < 0.0005) t = goal;
    draw(now);
    if (active) raf = requestAnimationFrame(frame);
  }
  draw();
  const onResize = () => {
    ppf.resize();
    if (!active) draw();
  };
  addEventListener('resize', onResize);

  return {
    /** vẽ đúng khung hình ở giây s của cảnh (0 → SEGMENT.duration), để xem thử từng nhịp */
    seek(s) {
      t = goal = SEGMENT.start + Math.min(SEGMENT.duration, Math.max(0, s));
      draw();
    },
    /** p 0..1 = vị trí thanh cuộn của trang; snap: nhảy thẳng tới (khi trang chưa mở, ví dụ lúc vừa quay lại trang) */
    setProgress(p, snap = false) {
      goal = SEGMENT.start + clamp01(p) * SEGMENT.duration;
      if (snap || !active) {
        t = goal;
        draw();
      }
    },
    setActive(on) {
      if (on === active) return;
      active = on;
      if (on) raf = requestAnimationFrame(frame);
      else cancelAnimationFrame(raf);
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      removeEventListener('resize', onResize);
      ppf.dispose();
    },
  };
}
