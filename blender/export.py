# Xuất phòng đã bake ra web/assets/showroom.glb
#  - vật thể BAKE: một vật liệu duy nhất = ảnh bake đã khử nhiễu (blender/bake_dn/<tên>.jpg)
#  - vật thể EMIT: giữ vật liệu phát sáng (chữ nổi đổi sang mesh)
#  - sản phẩm, đèn, camera: không xuất (web tự đặt sản phẩm để bấm được)
import bpy, os
ROOT = "D:/code/store-pring/"
DN = ROOT + "blender/bake_dn/"
OUT = ROOT + "web/assets/showroom.glb"
scene = bpy.context.scene
restore, temp = [], []

def new_mat(name):
    m = bpy.data.materials.new(name)
    try: m.use_nodes = True
    except Exception: pass
    nt = m.node_tree
    b = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None) or nt.nodes.new("ShaderNodeBsdfPrincipled")
    out = next((n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"), None) or nt.nodes.new("ShaderNodeOutputMaterial")
    if not out.inputs["Surface"].is_linked: nt.links.new(b.outputs["BSDF"], out.inputs["Surface"])
    return m, b

export = []
for ob in bpy.data.collections["BAKE"].objects:
    path = DN + ob.name + ".jpg"
    m, b = new_mat("x_" + ob.name)
    t = m.node_tree.nodes.new("ShaderNodeTexImage")
    t.image = bpy.data.images.load(path, check_existing=False); t.image.name = "x_" + ob.name
    m.node_tree.links.new(t.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 1; b.inputs["Metallic"].default_value = 0
    restore.append((ob, [s.material for s in ob.material_slots], [p.material_index for p in ob.data.polygons]))
    for p in ob.data.polygons: p.material_index = 0
    ob.data.materials.clear(); ob.data.materials.append(m)
    export.append(ob)

dg = bpy.context.evaluated_depsgraph_get()
for ob in bpy.data.collections["EMIT"].objects:
    if ob.type == "MESH":
        export.append(ob); continue
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))      # chữ nổi -> mesh
    tmp = bpy.data.objects.new(ob.name + "_mesh", me); tmp.matrix_world = ob.matrix_world
    scene.collection.objects.link(tmp); temp.append(tmp); export.append(tmp)

for o in bpy.context.view_layer.objects: o.select_set(False)
for o in export: o.select_set(True)
bpy.context.view_layer.objects.active = export[0]
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True, export_apply=True,
                          export_image_format="JPEG", export_jpeg_quality=86, export_cameras=False, export_lights=False)

# trả lại cảnh như trước khi xuất
for ob, mats, idx in restore:
    ob.data.materials.clear()
    for m in mats: ob.data.materials.append(m)
    for p, i in zip(ob.data.polygons, idx): p.material_index = i
for tmp in temp: bpy.data.objects.remove(tmp, do_unlink=True)
print("exported", len(export), "objects ->", OUT, os.path.getsize(OUT) // 1024, "KB")
