# storedetalingpri

Trang bảng giá đại lý Store Detailing 2026 (PPF Zappa, PPF màu, cách âm – tiêu âm, phủ gầm GB).

- Toàn bộ trang nằm trong `web/` (một file `index.html` + ảnh trong `web/assets/`).
- Các trang bảng giá là ảnh poster gốc `web/assets/poster-<id trang>.webp` (1125×2000). Đổi giá thì thay ảnh cùng tên; nhớ sửa `DATA.ppf` (trong `web/index.html`) cho khớp — nó dùng cho chữ mô tả ảnh và khung giá cuộn phim trong phòng 3D.
- Tốc độ màn xe kéo bảng: hằng `TOW_SPEED` ngay dưới khối `DATA`.
- Trang đầu "Xe dán PPF" (sau nút START): `web/car-stage.js`; cảnh chạy theo thanh cuộn của trang `#xe` (người xem tự lướt, không tự cuộn). Đây là đúng khúc phim ghép vào xe của trang storedetailing (dự án son-wowww, giây 13,1 → 18,5): code trong `web/ppf/` chép nguyên từ son-wowww (`src/car.js`, `src/v3/kit.js`, `src/v3/sflook.js`; `ppf-scene.js` là phần cảnh đó của `src/v3/stage.js`; chỉ `ppf/studio.js` đổi đường dẫn file; thêm chế độ nhẹ `lite` cho iPhone / điện thoại ít RAM — độ nét 1,25x, bỏ MSAA, bóng đổ 1024, nướng bóng gầm nhẹ hơn — khai trong `ppf/studio.js`, dùng ở `ppf/v3/sflook.js` và `ppf/v3/ppf-scene.js`; `?lite=1` / `?lite=0` để ép bật / tắt), file trong `web/assets/ppf911/` (xe, ảnh môi trường, khuôn phim) — nên màu y hệt trang kia. Sửa cảnh bên son-wowww thì chép lại các file này (giữ lại phần `lite`). Trình duyệt tắt WebGL của cảnh (iPhone thiếu bộ nhớ) thì trang tự dựng lại xe trên canvas mới, tối đa 3 lần. Tô bóng kiểu Sketchfab chỉ áp cho vật liệu của cảnh này (`sfScope`), phòng 3D không đổi. Mô hình “Porsche 911” của Outlaw Games (CC BY-NC 4.0, không dùng cho mục đích thương mại; giấy phép yêu cầu ghi nguồn) — dòng ghi nguồn đã bỏ khỏi trang theo yêu cầu.
- Tiếng nổ máy lúc bấm START / chìa khóa: `web/assets/no-may.mp3` (đề → nổ → rú ga, khớp kim vòng tua trong `ignite()`), ghép bằng `python audio/no-may.py` (cần numpy, ffmpeg) từ bản ghi âm xe thật `audio/xe-that-043.flac` — file 043 của bộ [Performance Cars](https://muted.io/performance-cars) (muted.io, CC0: dùng thương mại, không cần ghi nguồn); riêng 0,34 giây tiếng đề là tổng hợp. Đổi nhịp `ignite()` thì sửa `CATCH`/`CUT` trong script rồi chạy lại.
- Trang video lễ ký kết (ngay sau trang xe): điện thoại chạy `assets/le-ky-ket-doc.mp4`; máy tính (màn ngang) là dải lướt ngang các clip `assets/le-ky-ket-ngang-1…6.mp4` (ảnh chờ `.jpg` cùng tên). Thêm/bớt clip thì sửa hằng `REEL` trong `web/index.html`.
- Phòng trưng bày 3D: `web/room.js` + `blender/` (xem `blender/README.md`). Trên iPhone / điện thoại ít RAM (`LITE_3D` trong `web/index.html`) chỉ giữ một cảnh 3D một lúc: vào phòng thì tạm bỏ xe 3D, rời phòng thì giải phóng phòng (`dispose()`) và dựng lại xe.
- Chặng: các trang nối nhau cuộn bình thường, chỉ giữa các chặng mới có xe kéo bảng. Trang mở đầu mỗi chặng nằm trong hằng `CHAPTER_HEADS` (trong `web/index.html`); trang theo sau tự nối vào chặng đó lúc tải.

## Tên miền và xem trước khi gửi link

Trang chạy ở https://daily.zappa.vn/. Khi gửi link (Zalo, Facebook, Messenger…) hiện ảnh `web/assets/og-zappa.jpg` (1200 × 630) cùng tiêu đề, mô tả trong các thẻ `og:` đầu `web/index.html` — các đường dẫn ở đó phải đầy đủ `https://daily.zappa.vn/…`. Đổi ảnh thì giữ tên file hoặc sửa cả `og:image`. Biểu tượng trang: `assets/favicon.svg`, `assets/apple-touch-icon.png` (180 × 180). Zalo / Facebook lưu bản xem trước một thời gian: link đã gửi trước đó có thể vẫn hiện bản cũ.

## Chạy bằng Docker

```bash
docker build -t storedetalingpri .
docker run -p 3000:3000 storedetalingpri
```

Mở http://localhost:3000

## Dokploy

Tạo ứng dụng từ repo này, Build Type: **Dockerfile**, cổng ứng dụng: **3000**.
