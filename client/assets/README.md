# Assets Directory

This directory should contain:

- `logo.png` - College logo (recommended size: 256x256px)
- `icon.png` - Main app icon (512x512px)
- `icon-*.png` - PWA icons in various sizes (72, 96, 128, 144, 152, 192, 384, 512)
- `screenshot1.png` - App screenshot for PWA (540x720px)
- `screenshot2.png` - App screenshot for PWA (540x720px)

## Quick Icon Generation

You can use online tools to generate all icon sizes from a single image:
- https://realfavicongenerator.net/
- https://www.pwabuilder.com/imageGenerator

Or use ImageMagick:
```bash
convert icon-512.png -resize 192x192 icon-192.png
convert icon-512.png -resize 144x144 icon-144.png
# ... etc
```

## Placeholder Icons

For development, you can create simple colored squares as placeholders.

The seed script and app will work without actual images, but for production:
1. Add your college logo
2. Generate proper PWA icons
3. Take screenshots of the app in mobile view
