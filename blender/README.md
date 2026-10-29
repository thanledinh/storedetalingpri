# Phòng trưng bày 3D (Blender)

Phòng trên web (`web/assets/showroom.glb`) được dựng và bake ánh sáng ở đây. Blender điều khiển qua addon **MCP for Blender** (`127.0.0.1:9876`) bằng `bmcp.py`.

1. `python blender/bmcp.py run blender/build_room.py` — dựng phòng, lưu `showroom.blend`
2. `python blender/bmcp.py run blender/preview.py` — render thử 2 góc (`preview_cam_in.png`, `preview_cam_out.png`)
3. `python blender/bmcp.py run blender/bake.py` — bake ánh sáng (Cycles, ~7 phút CPU) ra `bake/`
4. `python blender/denoise.py` — khử nhiễu ra `bake_dn/`
5. `python blender/bmcp.py run blender/export.py` — xuất `web/assets/showroom.glb`

Sản phẩm (bảng vẫy, standee, bạt trải capo, poster capo, bảng giá treo tường, bình phun, máy bắn sỏi trên bục, máy kiểm tra tác động trên kệ phải, 2 áo + mũ ở tường phải, cuộn phim) chỉ có trong Blender để tính bóng đổ; web tự đặt lại chúng trong `web/room.js` để bấm được. Đổi vị trí sản phẩm thì sửa cả hai nơi. Tay đỡ bảng vẫy, đế standee, thanh treo áo và kệ mũ nằm trong `bake_hw` (xuất ra GLB). Biển hiệu ZAPPA nằm trong GLB; web phủ một tấm chạm vô hình lên để bấm được.

Sàn bóng không bake: `web/room.js` vẽ lại cảnh lật qua mặt sàn rồi phủ mờ lên sàn (độ bóng: `mix(.15, .42, k)` trong shader `gloss`).

Biển hiệu trên mặt tiền là logo chữ ZAPPA Paint Protection Film: `tex/sign-zappa.png` (1600×449, phần ngoài viền tô đen) dán lên một tấm bo góc đúng theo viền logo, nên không cần ảnh trong suốt.

Mặt bảng vẫy là thiết kế gốc (395×525, bo góc trong suốt) → `web/assets/room-sign.webp`. Ảnh standee gốc 80×200 cm (300 dpi, ~36 MB) được thu về 1000×2500 → `web/assets/room-standee-1.webp`, `room-standee-2.webp`.
