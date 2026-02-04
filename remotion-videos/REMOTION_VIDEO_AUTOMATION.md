# Remotion Video Automation - One-Click Render

## Quick Render Command

```bash
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/remotion-videos && /usr/local/Cellar/node/25.5.0/bin/node node_modules/@remotion/cli/remotion-cli.js render src/index.ts VoxanneDemo out/voxanne-demo.mp4
```

## Why This Works

Node.js is installed via Homebrew at `/usr/local/Cellar/node/25.5.0/bin/node` but is not in the shell PATH. This command bypasses npm and calls the Remotion CLI directly with the full node binary path.

## After Render

```bash
# Verify output
ls -lh /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/remotion-videos/out/voxanne-demo.mp4

# Play video
open /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/remotion-videos/out/voxanne-demo.mp4
```

## Specifications
- Duration: 90 seconds (2700 frames at 30fps)
- Resolution: 1920x1080
- Codec: H.264
- Expected size: 15-25 MB
