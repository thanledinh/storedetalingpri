# Render thử 2 góc nhìn (bên trong, mặt tiền) ra blender/preview_*.png
import bpy, time
scene = bpy.context.scene
out = "D:/code/store-pring/blender/"
t0 = time.time()
for cam in ("cam_in", "cam_out"):
    scene.camera = bpy.data.objects[cam]
    scene.render.filepath = out + "preview_" + cam + ".png"
    bpy.ops.render.render(write_still=True)
scene.camera = bpy.data.objects["cam_in"]
print("rendered in %.1fs" % (time.time() - t0))
