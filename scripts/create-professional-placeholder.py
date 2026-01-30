#!/usr/bin/env python3
"""
Professional Placeholder Image Generator for Ndi

Creates a professional placeholder that matches the quality of existing team photos.
This placeholder should be replaced with a real professional headshot.
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_professional_placeholder():
    # Image dimensions matching existing team photos
    width, height = 800, 800

    # Create new image with professional gradient background
    img = Image.new('RGB', (width, height), color='#1e3a8a')
    draw = ImageDraw.Draw(img)

    # Create gradient background (professional blue)
    for y in range(height):
        # Gradient from dark blue to lighter blue
        r = int(30 + (y / height) * 29)  # 30 to 59
        g = int(58 + (y / height) * 72)  # 58 to 130
        b = int(138 + (y / height) * 108) # 138 to 246
        draw.rectangle([(0, y), (width, y+1)], fill=(r, g, b))

    # Draw professional silhouette
    center_x, center_y = width // 2, height // 2

    # Head (circle)
    head_radius = 120
    draw.ellipse(
        [center_x - head_radius, center_y - head_radius - 100,
         center_x + head_radius, center_y + head_radius - 100],
        fill='#6b5544',
        outline='#4a3f35',
        width=3
    )

    # Shoulders/Suit (professional attire)
    shoulder_points = [
        (center_x - 180, height),
        (center_x - 120, center_y + 20),
        (center_x - 60, center_y + 40),
        (center_x, center_y + 30),
        (center_x + 60, center_y + 40),
        (center_x + 120, center_y + 20),
        (center_x + 180, height)
    ]
    draw.polygon(shoulder_points, fill='#1f2937', outline='#111827', width=2)

    # Collar/Shirt
    collar_points = [
        (center_x - 60, center_y + 30),
        (center_x - 40, center_y + 100),
        (center_x, center_y + 90),
        (center_x + 40, center_y + 100),
        (center_x + 60, center_y + 30)
    ]
    draw.polygon(collar_points, fill='white')

    # Tie (professional detail)
    tie_points = [
        (center_x - 15, center_y + 50),
        (center_x, center_y + 150),
        (center_x + 15, center_y + 50)
    ]
    draw.polygon(tie_points, fill='#3b82f6')

    # Add professional text overlay
    try:
        # Use default font, larger size
        font_large = ImageFont.load_default()
        font_small = ImageFont.load_default()
    except:
        font_large = None
        font_small = None

    # Name label
    text_y = height - 200
    draw.text((center_x, text_y), "NDI",
              fill='white',
              anchor='mm',
              font=font_large)

    # Role label
    draw.text((center_x, text_y + 40),
              "Head of Human & International Relations",
              fill=(255, 255, 255, 200),
              anchor='mm',
              font=font_small)

    # Placeholder watermark
    draw.text((center_x, height - 50),
              "PLACEHOLDER - Replace with professional photo",
              fill=(255, 255, 255, 100),
              anchor='mm',
              font=font_small)

    # Save as PNG
    output_path = '../public/images/team/ndi-placeholder.png'
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    img.save(output_path, 'PNG', quality=95)

    print(f"✅ Professional placeholder created: {output_path}")
    print("\n⚠️  IMPORTANT: This is a placeholder image")
    print("\nRecommended specifications for real photo:")
    print("- Subject: Black American male, ~40 years old")
    print("- Format: PNG (transparent background preferred)")
    print("- Dimensions: 800x800px minimum")
    print("- Background: Professional office/studio")
    print("- Attire: Business professional (suit and tie)")
    print("- Expression: Confident, approachable")
    print("- Lighting: Professional headshot quality")
    print("\nSuggested AI image generation prompts:")
    print("- Midjourney: 'professional headshot of a Black American male executive,")
    print("  40 years old, wearing a navy suit and blue tie, confident smile,")
    print("  office background, studio lighting, corporate photography style --ar 1:1'")
    print("- DALL-E 3: 'Professional corporate headshot photograph of a Black American")
    print("  male executive in his 40s, wearing a navy business suit with blue tie,")
    print("  warm confident expression, neutral office background, professional")
    print("  studio lighting, high quality'")

if __name__ == "__main__":
    create_professional_placeholder()
