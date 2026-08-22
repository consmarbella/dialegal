from PIL import Image, ImageDraw, ImageFont
import os

# Create 1200x630 OG image
w, h = 1200, 630
img = Image.new("RGB", (w, h), "#05070f")
draw = ImageDraw.Draw(img)

# Gradient-like background with accent
for y in range(h):
    r = int(5 + (y / h) * 5)
    g = int(7 + (y / h) * 15)
    b = int(15 + (y / h) * 30)
    draw.line([(0, y), (w, y)], fill=(r, g, b))

# Accent bar at top
draw.rectangle([0, 0, w, 6], fill="#00d4ff")

# Logo scales icon
draw.rectangle([80, 100, 130, 200], fill="#00d4ff", outline="#00d4ff")
draw.rectangle([140, 100, 190, 200], fill="#00d4ff", outline="#00d4ff")
draw.rectangle([80, 140, 190, 160], fill="#00d4ff", outline="#00d4ff")

# Try to load a good font, fallback to default
try:
    font_title = ImageFont.truetype("arial.ttf", 52)
    font_sub = ImageFont.truetype("arial.ttf", 26)
    font_cta = ImageFont.truetype("arial.ttf", 20)
except:
    try:
        font_title = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 52)
        font_sub = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 26)
        font_cta = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 20)
    except:
        font_title = ImageFont.load_default()
        font_sub = ImageFont.load_default()
        font_cta = ImageFont.load_default()

# Title
draw.text((80, 230), "LegalHelp Chile", fill="#ffffff", font=font_title)

# Subtitle
draw.text((80, 310), "Diagnóstico Legal con IA", fill="#00d4ff", font=font_sub)

# Description
draw.text((80, 380), "Analiza demandas, calcula plazos fatales", fill="#a0aec0", font=font_sub)
draw.text((80, 420), "y recibe orientación legal en Chile", fill="#a0aec0", font=font_sub)

# CTA bar
draw.rounded_rectangle([80, 500, 400, 560], radius=8, fill="#00d4ff")
draw.text((120, 515), "legalhelp.cl", fill="#05070f", font=font_cta)

# Categories
cats = ["Arriendo", "Laboral", "Deudas", "Familia", "Civil"]
x = 500
for cat in cats:
    draw.rounded_rectangle([x, 505, x + 120, 555], radius=6, outline="#1a2040", width=2)
    bbox = draw.textbbox((0, 0), cat, font=font_cta)
    tw = bbox[2] - bbox[0]
    draw.text((x + 60 - tw // 2, 518), cat, fill="#a0aec0", font=font_cta)
    x += 140

out = os.path.join(os.path.dirname(__file__), "..", "public", "og-image.png")
os.makedirs(os.path.dirname(out), exist_ok=True)
img.save(out, "PNG", optimize=True)
print(f"OG image saved: {out} ({os.path.getsize(out)} bytes)")
