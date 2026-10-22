# Vẽ mặt bảng vẫy Zappa (900 x 1200) -> web/assets/room-sign.webp
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 900, 1200
LIME, WHITE, INK = (222, 238, 40), (245, 245, 240), (22, 26, 24)
img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# vỏ đen bo góc + nền xanh rêu có vệt sáng chéo
d.rounded_rectangle((0, 0, W - 1, H - 1), radius=80, fill=(14, 15, 15, 255))
bg = Image.new("RGBA", (W, H))
bd = ImageDraw.Draw(bg)
for y in range(H):
    t = y / H
    bd.line([(0, y), (W, y)], fill=(int(64 - 14 * t), int(78 - 14 * t), int(74 - 12 * t), 255))
streak = Image.new("L", (W, H), 0)
ImageDraw.Draw(streak).polygon([(560, 0), (700, 0), (520, H), (330, H)], fill=60)
bg.paste((210, 215, 210, 255), (0, 0), streak.filter(ImageFilter.GaussianBlur(18)))
mask = Image.new("L", (W, H), 0)
ImageDraw.Draw(mask).rounded_rectangle((34, 34, W - 35, H - 35), radius=52, fill=255)
img.paste(bg, (0, 0), mask)
d = ImageDraw.Draw(img)
d.rounded_rectangle((70, 70, W - 71, H - 71), radius=34, outline=LIME, width=9)

# chữ Z: lấy đúng logo từ ảnh hộp đèn thật (vùng vàng trên nền tối), tô lại màu chanh
src = Image.open("D:/code/store-pring/web/assets/room-lightbox.webp").convert("RGB").crop((153, 136, 344, 391))
zh = 340
zw = round(src.width * zh / src.height)
z_alpha = src.getchannel("G").point(lambda g: max(0, min(255, (g - 60) * 255 // 140))).resize((zw, zh), Image.LANCZOS)
img.paste(Image.new("RGBA", (zw, zh), LIME + (255,)), ((W - zw) // 2, 140), z_alpha)
d = ImageDraw.Draw(img)

# chữ ZAPPA
f_big = ImageFont.truetype("C:/Windows/Fonts/bahnschrift.ttf", 172); f_big.set_variation_by_name("Bold")
txt, sp = "ZAPPA", 12
bw = d.textlength(txt, font=f_big) + 4 * sp
x = (W - bw) / 2
for ch in txt:
    d.text((x + 4, 720 + 5), ch, font=f_big, fill=(0, 0, 0, 120), anchor="ls")
    d.text((x, 720), ch, font=f_big, fill=WHITE, anchor="ls")
    x += d.textlength(ch, font=f_big) + sp

# dải vàng chanh + dải tối
d.rectangle((72, 770, W - 73, 850), fill=LIME)
f_mid = ImageFont.truetype("C:/Windows/Fonts/bahnschrift.ttf", 46); f_mid.set_variation_by_name("Bold")
d.text((W / 2, 811), "PAINT PROTECTION FILM", font=f_mid, fill=INK, anchor="mm")
d.rectangle((72, 862, W - 73, 932), fill=(18, 22, 21))
f_vn = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 38)
d.text((W / 2, 897), "PHIM BẢO VỆ BỀ MẶT SƠN Ô TÔ", font=f_vn, fill=WHITE, anchor="mm")

# dải cờ sọc góc trên phải
flag = Image.new("RGBA", (320, 110), (0, 0, 0, 0))
fd = ImageDraw.Draw(flag)
for i in range(7):
    fd.rectangle((0, i * 16, 320, i * 16 + 8), fill=(200, 40, 46, 255))
    fd.rectangle((0, i * 16 + 8, 320, i * 16 + 16), fill=(240, 236, 232, 255))
fd.rectangle((0, 0, 110, 56), fill=(34, 52, 120, 255))
for r in range(3):
    for c in range(5):
        fd.ellipse((10 + c * 20, 8 + r * 16, 15 + c * 20, 13 + r * 16), fill=(240, 240, 240, 255))
flag = flag.resize((176, 60), Image.LANCZOS).rotate(-14, expand=True, resample=Image.BICUBIC)
img.alpha_composite(flag, (W - 262, 92))
d = ImageDraw.Draw(img)
d.rounded_rectangle((70, 70, W - 71, H - 71), radius=34, outline=LIME, width=9)
# cắt theo vỏ bo góc
outer = Image.new("L", (W, H), 0)
ImageDraw.Draw(outer).rounded_rectangle((0, 0, W - 1, H - 1), radius=80, fill=255)
img.putalpha(outer)
img.save("D:/code/store-pring/web/assets/room-sign.webp", quality=90, method=6)
print("ok")
