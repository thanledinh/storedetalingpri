# storedetalingpri

Trang bảng giá đại lý Store Detailing 2026 (PPF Zappa, PPF màu, cách âm – tiêu âm, phủ gầm GB).

- Toàn bộ trang nằm trong `web/` (một file `index.html` + ảnh trong `web/assets/`).
- Sửa giá: khối `DATA` ở đầu phần `<script>` trong `web/index.html`.
- Tốc độ màn xe kéo bảng: hằng `TOW_SPEED` ngay dưới khối `DATA`.
- Cảnh xe + PPF sau nút START: `web/car-intro.js` (mốc thời gian ở hằng `T`). Xe `assets/car-urus.glb` và khuôn phim `assets/ppf-patterns.*` lấy từ dự án son-wowww; mô hình “Lamborghini Urus 2018” của kirikom9000 (CC BY 4.0) — giữ dòng ghi nguồn ở màn mở đầu và trang Liên hệ.
- Phòng trưng bày 3D: `web/room.js` + `blender/` (xem `blender/README.md`).

## Chạy bằng Docker

```bash
docker build -t storedetalingpri .
docker run -p 3000:3000 storedetalingpri
```

Mở http://localhost:3000

## Dokploy

Tạo ứng dụng từ repo này, Build Type: **Dockerfile**, cổng ứng dụng: **3000**.
