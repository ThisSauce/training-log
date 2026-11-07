"""Draw the Home Screen icon: the app's phase-colour glow behind a frosted glass dumbbell."""
import pathlib
from PIL import Image, ImageDraw, ImageFilter

OUT = pathlib.Path(__file__).resolve().parent.parent / "docs" / "icons"
N = 1024

def blob(img, cx, cy, r, rgb, alpha):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse((cx - r, cy - r, cx + r, cy + r), fill=rgb + (alpha,))
    return Image.alpha_composite(img, layer.filter(ImageFilter.GaussianBlur(r * 0.45)))

img = Image.new("RGBA", (N, N), (12, 20, 34, 255))
img = blob(img, 170, 160, 520, (42, 120, 214), 255)   # --p1 blue
img = blob(img, 930, 520, 430, (27, 175, 122), 235)   # --p2 aqua
img = blob(img, 300, 1000, 470, (232, 89, 12), 245)   # --p3 orange

# Dumbbell shapes (bar, inner plates, outer plates) on a 1024 grid.
shapes = [
    (300, 482, 724, 542, 30),        # bar
    (226, 330, 336, 694, 52),        # left inner plate
    (688, 330, 798, 694, 52),        # right inner plate
    (148, 404, 236, 620, 40),        # left outer plate
    (788, 404, 876, 620, 40),        # right outer plate
]
mask = Image.new("L", (N, N), 0)
md = ImageDraw.Draw(mask)
for x0, y0, x1, y1, r in shapes:
    md.rounded_rectangle((x0, y0, x1, y1), r, fill=255)

# Soft drop shadow.
shadow = Image.new("RGBA", (N, N), (6, 12, 24, 0))
shadow.putalpha(mask.point(lambda v: v * 0.45).filter(ImageFilter.GaussianBlur(26)))
img = Image.alpha_composite(img, shadow.transform(img.size, Image.AFFINE, (1, 0, 0, 0, 1, -18)))

# Frosted glass fill: blurred backdrop brightened, plus a top-down sheen.
frost = img.filter(ImageFilter.GaussianBlur(40)).point(lambda v: int(v * 0.25 + 255 * 0.75))
sheen = Image.new("L", (N, N))
sheen.putdata([255 - int(70 * (y / N)) for y in range(N) for _ in range(N)])
glass = Image.merge("RGBA", (*frost.split()[:3], mask))
glass = Image.composite(glass, Image.new("RGBA", (N, N), (255, 255, 255, 0)), mask)
img = Image.alpha_composite(img, glass)
tint = Image.new("RGBA", (N, N), (255, 255, 255, 0))
tint.putalpha(Image.composite(sheen.point(lambda v: (v - 185) * 2 if v > 185 else 0), Image.new("L", (N, N), 0), mask))
img = Image.alpha_composite(img, tint)

# Bright rim on the top edge of each shape.
rim = mask.filter(ImageFilter.MaxFilter(1))
inner = mask.transform(mask.size, Image.AFFINE, (1, 0, 0, 0, 1, -7))
edge = Image.composite(Image.new("L", (N, N), 0), rim, inner).filter(ImageFilter.GaussianBlur(2))
hl = Image.new("RGBA", (N, N), (255, 255, 255, 0)); hl.putalpha(edge)
img = Image.alpha_composite(img, hl)

final = img.convert("RGB")
OUT.mkdir(parents=True, exist_ok=True)
final.resize((180, 180), Image.LANCZOS).save(OUT / "apple-touch-icon.png")
final.resize((192, 192), Image.LANCZOS).save(OUT / "icon-192.png")
final.resize((512, 512), Image.LANCZOS).save(OUT / "icon-512.png")
final.save(OUT.parent.parent / "scripts" / "icon-preview.png")
print("icons written")
