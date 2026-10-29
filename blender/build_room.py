# Dựng phòng trưng bày Zappa trong Blender (chạy qua addon MCP hoặc: blender -b -P build_room.py)
# Toạ độ viết theo hệ của web (Three.js: x phải, y lên, z về phía người xem) rồi đổi sang Blender.
import bpy, bmesh, math, os

ROOT = "D:/code/store-pring"
ASSET = ROOT + "/web/assets/"
TEX = ROOT + "/blender/tex/"
W, D, H = 7.0, 6.5, 3.2

def B(x, y, z):                     # Three -> Blender
    return (x, -z, y)

def lin(hexs):                      # màu sRGB hex -> linear
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(((v + .055) / 1.055) ** 2.4 if v > .04045 else v / 12.92 for v in c)

# ── dọn cảnh ──
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
for coll in list(bpy.data.collections):
    bpy.data.collections.remove(coll)
for blk in (bpy.data.meshes, bpy.data.materials, bpy.data.curves, bpy.data.lights, bpy.data.cameras, bpy.data.images):
    for x in list(blk):
        if x.users == 0:
            blk.remove(x)
scene = bpy.context.scene
scene.name = "Showroom"
COL = {}
for name in ("BAKE", "EMIT", "PRODUCTS", "LIGHTS"):
    c = bpy.data.collections.new(name); scene.collection.children.link(c); COL[name] = c

# ── vật liệu ──
def new_mat(name):
    """Vật liệu mới với Principled BSDF -> Material Output (Blender 5 không tự tạo sẵn)."""
    m = bpy.data.materials.new(name)
    try: m.use_nodes = True
    except Exception: pass
    nt = m.node_tree
    b = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None) or nt.nodes.new("ShaderNodeBsdfPrincipled")
    out = next((n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"), None) or nt.nodes.new("ShaderNodeOutputMaterial")
    b.name = "Principled BSDF"; out.location = (300, 0)
    if not out.inputs["Surface"].is_linked: nt.links.new(b.outputs["BSDF"], out.inputs["Surface"])
    return m

def mat_color(name, hexs, rough=.8, metal=0.0):
    m = new_mat(name)
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*lin(hexs), 1)
    b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    return m

def mat_emit(name, hexs, strength):
    m = mat_color(name, hexs)
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Emission Color"].default_value = (*lin(hexs), 1)
    b.inputs["Emission Strength"].default_value = strength
    return m

def mat_image(name, path, emit=0.0, alpha=False, rough=.6):
    m = new_mat(name)
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    t = nt.nodes.new("ShaderNodeTexImage"); t.image = bpy.data.images.load(path, check_existing=True)
    t.location = (-400, 200)
    nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = rough
    if alpha:
        nt.links.new(t.outputs["Alpha"], b.inputs["Alpha"])
    if emit:
        nt.links.new(t.outputs["Color"], b.inputs["Emission Color"])
        b.inputs["Emission Strength"].default_value = emit
    return m

# ── tạo hình ──
class Builder:
    """Gom nhiều hộp/mặt phẳng vào một mesh (mỗi mặt có thể khác vật liệu)."""
    def __init__(self): self.v, self.f, self.uv, self.mi, self.mats = [], [], [], [], []
    def _mat(self, m):
        if m not in self.mats: self.mats.append(m)
        return self.mats.index(m)
    def quad(self, pts, uvs, m):
        i = len(self.v); self.v += pts; self.f.append((i, i + 1, i + 2, i + 3)); self.uv.append(uvs); self.mi.append(self._mat(m))
    def box(self, w, h, d, c, m, ry=0.0):
        x, y, z = c; hw, hh, hd = w / 2, h / 2, d / 2; cs, sn = math.cos(ry), math.sin(ry)
        P = lambda a, b_, cc: B(x + a * cs + cc * sn, y + b_, z - a * sn + cc * cs)
        U = ((0, 0), (1, 0), (1, 1), (0, 1))
        self.quad([P(-hw, -hh, hd), P(hw, -hh, hd), P(hw, hh, hd), P(-hw, hh, hd)], U, m)      # trước (+z)
        self.quad([P(hw, -hh, -hd), P(-hw, -hh, -hd), P(-hw, hh, -hd), P(hw, hh, -hd)], U, m)  # sau
        self.quad([P(-hw, -hh, -hd), P(-hw, -hh, hd), P(-hw, hh, hd), P(-hw, hh, -hd)], U, m)  # trái
        self.quad([P(hw, -hh, hd), P(hw, -hh, -hd), P(hw, hh, -hd), P(hw, hh, hd)], U, m)      # phải
        self.quad([P(-hw, hh, hd), P(hw, hh, hd), P(hw, hh, -hd), P(-hw, hh, -hd)], U, m)      # trên
        self.quad([P(-hw, -hh, -hd), P(hw, -hh, -hd), P(hw, -hh, hd), P(-hw, -hh, hd)], U, m)  # dưới
    def plane(self, w, h, c, m, ry=0.0, face="front", uv=((0, 0), (1, 0), (1, 1), (0, 1))):
        x, y, z = c; hw, hh = w / 2, h / 2; cs, sn = math.cos(ry), math.sin(ry)
        if face == "up":      # nằm ngang, nhìn lên
            pts = [(x - hw, y, z + hh), (x + hw, y, z + hh), (x + hw, y, z - hh), (x - hw, y, z - hh)]
        elif face == "down":
            pts = [(x - hw, y, z - hh), (x + hw, y, z - hh), (x + hw, y, z + hh), (x - hw, y, z + hh)]
        else:                 # đứng, mặt hướng +z rồi xoay quanh trục y
            loc = [(-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh)]
            pts = [(x + a * cs, y + b_, z - a * sn) for a, b_ in loc]
        self.quad([B(*p) for p in pts], uv, m)
    def build(self, name, coll):
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.v, [], self.f)
        uvl = me.uv_layers.new(name="UVMap")
        k = 0
        for poly, uvs in zip(me.polygons, self.uv):
            for li, u in zip(poly.loop_indices, uvs): uvl.data[li].uv = u
        for m in self.mats: me.materials.append(m)
        for poly, mi in zip(me.polygons, self.mi): poly.material_index = mi
        me.update()
        ob = bpy.data.objects.new(name, me); coll.objects.link(ob); return ob

def one_box(name, w, h, d, c, m, coll):
    b = Builder(); b.box(w, h, d, c, m); return b.build(name, coll)

def one_plane(name, w, h, c, m, coll, **kw):
    b = Builder(); b.plane(w, h, c, m, **kw); return b.build(name, coll)

# ── vật liệu chính ──
M = {
    "floor": mat_image("m_floor", TEX + "floor.png", rough=.3),
    "wall": mat_color("m_wall", "#5a5c50", .9),
    "ceil": mat_color("m_ceil", "#1b1b1d", .9),
    "facade": mat_color("m_facade", "#d9d9d4", .9),
    "navy": mat_color("m_navy", "#1d2742", .5, .4),
    "rib": mat_color("m_rib", "#24314f", .45, .5),
    "ground": mat_color("m_ground", "#26272a", .95),
    "counter": mat_color("m_counter", "#111113", .35, .2),
    "top": mat_color("m_top", "#f1f1ef", .4),
    "ped": mat_color("m_ped", "#0d0d0f", .25, .4),
    "led": mat_emit("m_led", "#ffffff", 14),
    "gold": mat_emit("m_gold", "#f2d51b", 6),
    "ink": mat_color("m_ink", "#111111", .6),
    "metal": mat_color("m_metal", "#a3a6ab", .45),
}

# ── trong phòng ──
one_plane("bake_floor", W, D, (0, 0, -D / 2), M["floor"], COL["BAKE"], face="up")
one_plane("bake_wall_back", W, H, (0, H / 2, -D), M["wall"], COL["BAKE"])
one_plane("bake_wall_left", D, H, (-W / 2, H / 2, -D / 2), M["wall"], COL["BAKE"], ry=math.pi / 2)
one_plane("bake_wall_right", D, H, (W / 2, H / 2, -D / 2), M["wall"], COL["BAKE"], ry=-math.pi / 2)
one_plane("bake_ceiling", W, D, (0, H, -D / 2), M["ceil"], COL["BAKE"], face="down")

# đèn LED lục giác (dải phát sáng rộng 4 cm, ngay dưới trần)
led = Builder()
R, tube = .55, .045
sx, sz = R * 1.5, math.sqrt(3) * R
yl = H - .012
c = 0
while c * sx <= W:
    r = 0
    while r * sz <= D + sz:
        x = -W / 2 + .35 + c * sx
        z = -.35 - (r * sz + (sz / 2 if c % 2 else 0))
        if -W / 2 + R * .8 < x < W / 2 - R * .8 and -D + R * .8 < z < -R * .6:
            k_out, k_in = R - .03, R - .03 - tube
            for i in range(6):
                a0, a1 = math.pi / 3 * i, math.pi / 3 * (i + 1)
                p = [(x + k_out * math.cos(a0), yl, z + k_out * math.sin(a0)), (x + k_out * math.cos(a1), yl, z + k_out * math.sin(a1)),
                     (x + k_in * math.cos(a1), yl, z + k_in * math.sin(a1)), (x + k_in * math.cos(a0), yl, z + k_in * math.sin(a0))]
                led.quad([B(*q) for q in reversed(p)], ((0, 0), (1, 0), (1, 1), (0, 1)), M["led"])
        r += 1
    c += 1
# viền chữ nhật bao quanh
for (w_, d_, cx_, cz_) in ((W - .5, tube, 0, -.25), (W - .5, tube, 0, -D + .25), (tube, D - .5, -W / 2 + .25, -D / 2), (tube, D - .5, W / 2 - .25, -D / 2)):
    led.plane(w_, d_, (cx_, yl, cz_), M["led"], face="down")
led.build("emit_led", COL["EMIT"])

# quầy kệ
for side, x in (("L", -2.15), ("R", 2.15)):
    b = Builder()
    b.box(2.3, 1.0, .6, (x, .5, -D + .3), M["counter"])
    b.box(2.34, .03, .64, (x, 1.015, -D + .3), M["top"])
    b.build("bake_counter_" + side, COL["BAKE"])

# bục giữa
bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=.55, depth=.62, location=B(0, .31, -3.8))
ped = bpy.context.active_object; ped.name = "bake_pedestal"; ped.data.materials.append(M["ped"])
for cl in ped.users_collection: cl.objects.unlink(ped)
COL["BAKE"].objects.link(ped)
bpy.ops.mesh.primitive_torus_add(major_radius=.55, minor_radius=.012, major_segments=64, minor_segments=8, location=B(0, .625, -3.8))
ring = bpy.context.active_object; ring.name = "emit_ring"; ring.data.materials.append(M["gold"])
for cl in ring.users_collection: cl.objects.unlink(ring)
COL["EMIT"].objects.link(ring)

# bảng treo tường (tự phát sáng như hộp đèn); bảng giá bên trái là sản phẩm bấm được (xem P bên dưới)
one_plane("emit_board", 2.5, 1.46, (0, 2.15, -D + .015), mat_image("m_board", ASSET + "room-board.jpg", emit=1.6), COL["EMIT"])

# ── mặt tiền ──
fb = Builder()
fb.box(4.2, 4.4, .2, (-3.9, 2.2, -.1), M["facade"])
fb.box(4.2, 4.4, .2, (3.9, 2.2, -.1), M["facade"])
fb.box(3.6, 1.8, .2, (0, 3.5, -.1), M["facade"])
for x in (-1.85, 1.85): fb.box(.12, 2.6, .26, (x, 1.3, -.05), M["navy"])
fb.box(3.82, .12, .26, (0, 2.6, -.05), M["navy"])
fb.build("bake_facade", COL["BAKE"])
hb = Builder()
hb.box(5.6, 1.75, .12, (0, 3.52, .02), M["rib"])
n = 34
for i in range(n):
    hb.box(.06, 1.75, .05, (-2.8 + (i + .5) * 5.6 / n, 3.52, .1), M["rib"])
hb.build("bake_header", COL["BAKE"])
one_plane("bake_ground", 16, 10, (0, 0, 5), M["ground"], COL["BAKE"], face="up")

# biển hiệu: logo chữ ZAPPA Paint Protection Film (tex/sign-zappa.png, 1600 × 449, nền ngoài viền tô đen) dán lên một
# tấm chữ nhật bo góc đúng theo viền logo (bán kính góc = 1/24 bề ngang) — khỏi cần ảnh trong suốt (GLB xuất ảnh JPEG)
def rounded_panel(name, w, h, r, c, m, coll, seg=10):
    x0, y0, z0 = c
    pts = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    me = bpy.data.meshes.new(name)
    me.from_pydata([B(x0 + x, y0 + y, z0) for x, y in pts], [], [list(range(len(pts)))])
    uvl = me.uv_layers.new(name="UVMap")
    for li in me.polygons[0].loop_indices:
        x, y = pts[me.loops[li].vertex_index]
        uvl.data[li].uv = (x / w + .5, y / h + .5)
    me.materials.append(m); me.update()
    ob = bpy.data.objects.new(name, me); coll.objects.link(ob); return ob
SIGN_LOGO_W = 3.0                   # khoảng nửa bề ngang mảng tôn (5,6 m), chừa khoảng thở hai bên
rounded_panel("emit_sign_logo", SIGN_LOGO_W, SIGN_LOGO_W * 449 / 1600, SIGN_LOGO_W / 24, (0, 3.52, .16),
              mat_image("m_sign_logo", TEX + "sign-zappa.png", emit=3.0), COL["EMIT"])

# ── sản phẩm (chỉ để tính bóng đổ khi bake, KHÔNG xuất ra web — web tự đặt lại để bấm được) ──
# bảng vẫy hai mặt gắn ở góc trên mặt tiền, xoè ra hai bên; standee 80x200 đứng hai bên cửa
SIGN_W, SIGN_H, SIGN_D, SIGN_Y, SIGN_A, SIGN_X, SIGN_Z = .78, 1.04, .1, 2.95, .9, 3.0, .06
STAND_W, STAND_H, STAND_X, STAND_Z, STAND_A = .8, 2.0, 2.45, .5, .1
m_sign = mat_image("m_sign_face", ASSET + "room-sign.webp", emit=1.0, alpha=True)
hw = Builder()
for s in (-1, 1):
    ry = -s * SIGN_A
    cx, cz = s * (SIGN_X + SIGN_W / 2 * math.cos(SIGN_A)), SIGN_Z + SIGN_W / 2 * math.sin(SIGN_A)
    nx, nz = math.sin(ry), math.cos(ry)                         # pháp tuyến mặt trước
    ux, uz = -s * math.cos(SIGN_A), -math.sin(SIGN_A)          # dọc mặt bảng, hướng về tường
    b = Builder()
    b.box(SIGN_W - .01, SIGN_H - .01, SIGN_D, (cx, SIGN_Y, cz), M["ink"], ry)
    off = SIGN_D / 2 + .002
    b.plane(SIGN_W, SIGN_H, (cx + nx * off, SIGN_Y, cz + nz * off), m_sign, ry=ry)
    b.plane(SIGN_W, SIGN_H, (cx - nx * off, SIGN_Y, cz - nz * off), m_sign, ry=ry + math.pi)
    b.build("prod_sign_" + "lr"[s > 0], COL["PRODUCTS"])
    # tay đỡ: thanh ngang dọc mép trên cắm vào tường, 2 móc treo, đế bắt vít
    top = SIGN_Y + SIGN_H / 2
    hw.box(SIGN_W + .12, .035, .035, (cx + ux * .06, top + .06, cz + uz * .06), M["metal"], ry)
    for t in (-.25, .25):
        hw.box(.012, .05, .012, (cx + ux * t, top + .025, cz + uz * t), M["metal"], ry)
    hw.box(.12, .22, .02, (s * (SIGN_X - .048), top + .03, .01), M["metal"])
    # standee: đế nhôm, thanh nẹp trên, cột chống phía sau
    ry = -s * STAND_A
    x, z = s * STAND_X, STAND_Z
    nx, nz = math.sin(ry), math.cos(ry)
    hw.box(STAND_W + .06, .07, .22, (x - nx * .03, .035, z - nz * .03), M["metal"], ry)
    hw.box(STAND_W + .02, .03, .03, (x, .07 + STAND_H + .01, z), M["metal"], ry)
    hw.box(.02, STAND_H, .02, (x - nx * .07, .07 + STAND_H / 2, z - nz * .07), M["ink"], ry)
# tường phải: thanh treo 2 áo (móc ngay trên cổ áo) và kệ nhỏ để mũ
SHIRT_X, SHIRT_Y, SHIRT_W, SHIRT_H, SHIRT_Z = W / 2 - .04, 1.8, .74, .95, (-4.2, -3.3)
rail_y = SHIRT_Y + SHIRT_H / 2 + .05
hw.box(.025, .025, 1.8, (W / 2 - .06, rail_y, sum(SHIRT_Z) / 2), M["metal"])
for z in (sum(SHIRT_Z) / 2 - .88, sum(SHIRT_Z) / 2 + .88):
    hw.box(.06, .025, .025, (W / 2 - .03, rail_y, z), M["metal"])
for z in SHIRT_Z:
    hw.box(.01, .05, .01, (W / 2 - .06, rail_y - .03, z), M["metal"])
CAP_Z, CAP_SHELF_Y, CAP_W, CAP_H = -2.3, 1.45, .5, .465
hw.box(.24, .03, .62, (W / 2 - .12, CAP_SHELF_Y, CAP_Z), M["top"])
hw.build("bake_hw", COL["BAKE"])
P = [
    ("standee_1", "room-standee-1.webp", STAND_W, STAND_H, (-STAND_X, .07 + STAND_H / 2, STAND_Z), STAND_A, 0, False),
    ("standee_2", "room-standee-2.webp", STAND_W, STAND_H, (STAND_X, .07 + STAND_H / 2, STAND_Z), -STAND_A, 0, False),
    ("banner", "room-banner.webp", 2.43, 1.19, (-W / 2 + .03, 1.95, -3.3), math.pi / 2, 0, False),   # bạt trải nắp capo treo tường
    ("hood", "room-hood.jpg", .95, 1.27, (2.15, 2.05, -D + .02), 0, 1.0, False),
    ("tank", "room-tank-2.webp", .56, .63, (-2.75, 1.03 + .315, -D + .32), 0, 0, False),
    ("pump", "room-pump.webp", .27, .39, (1.6, 1.03 + .195, -D + .32), 0, 0, False),
    ("price", "room-price.webp", .9, 1.27, (-2.15, 2.05, -D + .02), 0, 1.0, False),        # bảng giá PPF Zappa sau bình tạo bọt
    ("demo", "room-may-ban-soi.webp", .8, .58, (0, .63 + .29, -3.8), 0, 0, False),          # máy bắn sỏi trên bục giữa
    ("impact", "room-may-tac-dong.webp", .65, .44, (2.62, 1.03 + .22, -D + .32), 0, 0, False),  # máy kiểm tra tác động trên kệ phải
    ("shirt_front", "room-ao-truoc.webp", SHIRT_W, SHIRT_H, (SHIRT_X, SHIRT_Y, SHIRT_Z[0]), -math.pi / 2, 0, False),
    ("shirt_back", "room-ao-sau.webp", SHIRT_W, SHIRT_H, (SHIRT_X, SHIRT_Y, SHIRT_Z[1]), -math.pi / 2, 0, False),
    ("cap", "room-mu.webp", CAP_W, CAP_H, (W / 2 - .13, CAP_SHELF_Y + .015 + CAP_H / 2, CAP_Z), -math.pi / 2, 0, False),
]
for name, img, w, h, c, ry, emit, flip in P:
    uv = ((1, 0), (0, 0), (0, 1), (1, 1)) if flip else ((0, 0), (1, 0), (1, 1), (0, 1))
    one_plane("prod_" + name, w, h, c, mat_image("m_" + name, ASSET + img, emit=emit, alpha=True), COL["PRODUCTS"], ry=ry, uv=uv)
for name, x, y in (("1398pro", -2.15, .84), ("1398", -2.15, .52), ("1388pro", -2.15, .2), ("1388", 2.15, .84), ("1378", 2.15, .52), ("1368", 2.15, .2)):
    one_plane("prod_film_" + name, 1.95, .31, (x, y, -D + .605), mat_image("m_film_" + name, ASSET + "ppf-%s-cut.png" % name, alpha=True), COL["PRODUCTS"])

# ── đèn ──
world = scene.world or bpy.data.worlds.new("World"); scene.world = world; world.use_nodes = True
bg = world.node_tree.nodes["Background"]; bg.inputs["Color"].default_value = (*lin("#1a2233"), 1); bg.inputs["Strength"].default_value = .35
def light(name, kind, energy, c, rot=(0, 0, 0), size=1.0, color="#ffffff", spot=None):
    ld = bpy.data.lights.new(name, kind); ld.energy = energy; ld.color = lin(color)
    if kind == "AREA": ld.size = size
    if kind == "SPOT": ld.spot_size = spot or math.radians(45); ld.spot_blend = .5
    ob = bpy.data.objects.new(name, ld); ob.location = B(*c); ob.rotation_euler = rot; COL["LIGHTS"].objects.link(ob); return ob
light("spot_pedestal", "SPOT", 180, (0, H - .05, -3.8), spot=math.radians(42), color="#fff4e2")
light("area_canopy", "AREA", 420, (0, 5.2, 2.6), rot=(math.radians(-25), 0, 0), size=4.5, color="#e8eefc")
light("area_room", "AREA", 160, (0, H - .08, -3.2), size=4.0, color="#fff6ea")

# ── camera xem thử ──
def cam(name, c, pitch_deg, fov_deg=62):
    cd = bpy.data.cameras.new(name); cd.lens_unit = "FOV"; cd.angle = math.radians(fov_deg)
    ob = bpy.data.objects.new(name, cd); ob.location = B(*c); ob.rotation_euler = (math.radians(90 + pitch_deg), 0, 0)
    scene.collection.objects.link(ob); return ob
cam("cam_in", (0, 1.72, -.15), 4, 70)
cam_out = cam("cam_out", (0, 1.75, 8.6), 3, 48)
scene.camera = bpy.data.objects["cam_in"]

# ── cài đặt render ──
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = 960, 540
scene.view_settings.view_transform = "Standard"
os.makedirs(ROOT + "/blender", exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=ROOT + "/blender/showroom.blend")
print("built", len(bpy.data.objects), "objects")
