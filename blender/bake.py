# Bake ánh sáng (Cycles) cho mọi vật thể trong collection BAKE -> blender/bake/<tên>.png
import bpy, math, os, time
ROOT = "D:/code/store-pring/blender/"
OUT = ROOT + "bake/"
os.makedirs(OUT, exist_ok=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 64
scene.view_settings.view_transform = "Standard"
bk = scene.render.bake
bk.use_pass_direct = bk.use_pass_indirect = True
bk.use_pass_diffuse = bk.use_pass_emit = True
bk.use_pass_glossy = bk.use_pass_transmission = False
bk.margin = 8

SIZE = {  # rộng x cao ảnh bake (tỉ lệ gần theo mặt thật)
    "bake_floor": (2048, 1902), "bake_wall_back": (1024, 468), "bake_wall_left": (1024, 504), "bake_wall_right": (1024, 504),
    "bake_ceiling": (512, 476), "bake_ground": (1024, 640), "bake_facade": (1024, 1024), "bake_header": (1024, 512),
    "bake_counter_L": (512, 512), "bake_counter_R": (512, 512), "bake_pedestal": (512, 512),
}

def select_only(ob):
    for o in bpy.context.view_layer.objects: o.select_set(False)
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)

def smart_uv(ob):
    select_only(ob)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.02)
    bpy.ops.object.mode_set(mode="OBJECT")

log = []
t_all = time.time()
for ob in list(bpy.data.collections["BAKE"].objects):
    t0 = time.time()
    # vật liệu riêng cho từng vật thể để ảnh bake không ghi đè lẫn nhau
    for i, m in enumerate(ob.data.materials):
        if m.users > 1: ob.data.materials[i] = m.copy()
    if len(ob.data.polygons) > 1:
        smart_uv(ob)
    w, h = SIZE.get(ob.name, (1024, 1024))
    img = bpy.data.images.get(ob.name + "_bake") or bpy.data.images.new(ob.name + "_bake", w, h, float_buffer=True)
    for m in ob.data.materials:
        nt = m.node_tree
        node = nt.nodes.get("BAKE_TARGET") or nt.nodes.new("ShaderNodeTexImage")
        node.name = "BAKE_TARGET"; node.image = img; node.location = (-700, -300)
        for n in nt.nodes: n.select = False
        node.select = True; nt.nodes.active = node
    select_only(ob)
    bpy.ops.object.bake(type="COMBINED")
    img.filepath_raw = OUT + ob.name + ".png"; img.file_format = "PNG"
    img.save_render(OUT + ob.name + ".png", scene=scene)
    log.append("%s %dx%d %.1fs" % (ob.name, w, h, time.time() - t0))
bpy.ops.wm.save_mainfile()
print("\n".join(log)); print("total %.1fs" % (time.time() - t_all))
