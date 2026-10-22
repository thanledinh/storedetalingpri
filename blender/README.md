# Phòng trưng bày 3D (Blender)

Phòng trên web (`web/assets/showroom.glb`) được dựng và bake ánh sáng ở đây. Blender điều khiển qua addon **MCP for Blender** (`127.0.0.1:9876`) bằng `bmcp.py`.

1. `python blender/bmcp.py run blender/build_room.py` — dựng phòng, lưu `showroom.blend`
2. `python blender/bmcp.py run blender/preview.py` — render thử 2 góc (`preview_cam_in.png`, `preview_cam_out.png`)
3. `python blender/bmcp.py run blender/bake.py` — bake ánh sáng (Cycles, ~7 phút CPU) ra `bake/`
4. `python blender/denoise.py` — khử nhiễu ra `bake_dn/`
5. `python blender/bmcp.py run blender/export.py` — xuất `web/assets/showroom.glb`

Sản phẩm (hộp đèn, băng rôn, poster capo, bình phun, máy demo, cuộn phim) chỉ có trong Blender để tính bóng đổ; web tự đặt lại chúng trong `web/room.js` để bấm được. Đổi vị trí sản phẩm thì sửa cả hai nơi.
