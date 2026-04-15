"""Generate simple PNG icons for the Chrome extension."""
from PIL import Image, ImageDraw, ImageFont
import os

output_dir = os.path.join(os.path.dirname(__file__), "icons")
os.makedirs(output_dir, exist_ok=True)

sizes = [16, 32, 48, 128]

for size in sizes:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Rounded rectangle background with purple gradient simulation
    margin = max(1, size // 10)
    r = max(2, size // 6)

    # Draw rounded rect background
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=r,
        fill=(99, 102, 241, 255),  # Indigo
    )

    # Draw a simple highlight/pen symbol
    # Inner white "H" mark or highlight bar
    bar_h = max(2, size // 6)
    bar_margin = size // 4
    bar_y = size // 2 - bar_h // 2

    draw.rounded_rectangle(
        [bar_margin, bar_y, size - bar_margin, bar_y + bar_h],
        radius=max(1, bar_h // 2),
        fill=(255, 255, 255, 220),
    )

    # Second smaller bar below
    bar2_h = max(1, size // 8)
    bar2_y = bar_y + bar_h + max(1, size // 10)
    if bar2_y + bar2_h < size - margin:
        draw.rounded_rectangle(
            [bar_margin + size // 8, bar2_y, size - bar_margin - size // 8, bar2_y + bar2_h],
            radius=max(1, bar2_h // 2),
            fill=(255, 255, 255, 160),
        )

    path = os.path.join(output_dir, f"icon{size}.png")
    img.save(path, "PNG")
    print(f"Generated {path}")

print("All icons generated!")
