# storedetalingpri

Trang bảng giá đại lý Store Detailing 2026 (PPF Zappa, PPF màu, cách âm – tiêu âm, phủ gầm GB).

- Toàn bộ trang nằm trong `web/` (một file `index.html` + ảnh trong `web/assets/`).
- Các trang bảng giá là ảnh poster gốc `web/assets/poster-<id trang>.webp` (1125×2000). Đổi giá thì thay ảnh cùng tên; nhớ sửa `DATA.ppf` (trong `web/index.html`) cho khớp — nó dùng cho chữ mô tả ảnh và khung giá cuộn phim trong phòng 3D.
- Tốc độ màn xe kéo bảng: hằng `TOW_SPEED` ngay dưới khối `DATA`.
- Trang đầu "Xe dán PPF" (sau nút START): `web/car-stage.js`; cảnh chạy theo thanh cuộn của trang `#xe`, lần đầu tự cuộn một lượt. Đây là đúng khúc phim ghép vào xe của trang storedetailing (dự án son-wowww, giây 13,1 → 18,5): code trong `web/ppf/` chép nguyên từ son-wowww (`src/car.js`, `src/v3/kit.js`, `src/v3/sflook.js`; `ppf-scene.js` là phần cảnh đó của `src/v3/stage.js`; chỉ `ppf/studio.js` đổi đường dẫn file), file trong `web/assets/ppf911/` (xe, ảnh môi trường, khuôn phim) — nên màu y hệt trang kia. Sửa cảnh bên son-wowww thì chép lại các file này. Tô bóng kiểu Sketchfab chỉ áp cho vật liệu của cảnh này (`sfScope`), phòng 3D không đổi. Mô hình “Porsche 911” của Outlaw Games (CC BY-NC 4.0, không dùng cho mục đích thương mại) — giữ dòng ghi nguồn ở màn mở đầu và trang Liên hệ.
- Trang video lễ ký kết (ngay sau trang xe): điện thoại chạy `assets/le-ky-ket-doc.mp4`; máy tính (màn ngang) là dải lướt ngang các clip `assets/le-ky-ket-ngang-1…6.mp4` (ảnh chờ `.jpg` cùng tên). Thêm/bớt clip thì sửa hằng `REEL` trong `web/index.html`.
- Phòng trưng bày 3D: `web/room.js` + `blender/` (xem `blender/README.md`).
- Chặng: các trang nối nhau cuộn bình thường, chỉ giữa các chặng mới có xe kéo bảng. Trang mở đầu mỗi chặng nằm trong hằng `CHAPTER_HEADS` (trong `web/index.html`); trang theo sau tự nối vào chặng đó lúc tải.

## Chạy bằng Docker

```bash
docker build -t storedetalingpri .
docker run -p 3000:3000 storedetalingpri
```

Mở http://localhost:3000

## Dokploy

Tạo ứng dụng từ repo này, Build Type: **Dockerfile**, cổng ứng dụng: **3000**.
