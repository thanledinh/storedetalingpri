# storedetalingpri

Trang bảng giá đại lý Store Detailing 2026 (PPF Zappa, PPF màu, cách âm – tiêu âm, phủ gầm GB).

- Toàn bộ trang nằm trong `web/` (một file `index.html` + ảnh trong `web/assets/`).
- Các trang bảng giá là ảnh poster gốc `web/assets/poster-<id trang>.webp` (1125×2000). Đổi giá thì thay ảnh cùng tên; nhớ sửa `DATA.ppf` (trong `web/index.html`) cho khớp — nó dùng cho chữ mô tả ảnh và khung giá cuộn phim trong phòng 3D.
- Tốc độ màn xe kéo bảng: hằng `TOW_SPEED` ngay dưới khối `DATA`.
- Trang đầu "Xe dán PPF" (sau nút START): `web/car-stage.js` (mốc thời gian ở hằng `T`); cảnh chạy theo thanh cuộn của trang `#xe`, lần đầu tự cuộn một lượt. Xe `assets/car-urus.glb` và khuôn phim `assets/ppf-patterns.*` lấy từ dự án son-wowww; mô hình “Lamborghini Urus 2018” của kirikom9000 (CC BY 4.0) — giữ dòng ghi nguồn ở màn mở đầu và trang Liên hệ.
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
