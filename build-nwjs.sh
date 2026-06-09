#!/bin/bash
# Build NW.js standalone distribution for Windows
# Produces a self-contained folder — no Python/Node.js required
# Double-click "Lora Tag Inspector.exe" to launch

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
NWJS_DIR="$PROJECT_DIR/nwjs-runtime/nwjs-v0.96.0-win-x64"
DIST_DIR="$PROJECT_DIR/dist/lora-tag-inspector"
OUTPUT_ZIP="$PROJECT_DIR/lora-tag-inspector-v1.5-standalone.zip"

echo "=== Lora Tag Inspector — NW.js Standalone Builder ==="
echo ""

# Clean previous build
rm -rf "$PROJECT_DIR/dist"
mkdir -p "$DIST_DIR"

echo "[1/4] Copying app files..."
cp "$PROJECT_DIR/index.html" "$DIST_DIR/"
cp "$PROJECT_DIR/package.json" "$DIST_DIR/"
cp -r "$PROJECT_DIR/css" "$DIST_DIR/"
cp -r "$PROJECT_DIR/js" "$DIST_DIR/"

echo "[2/4] Copying NW.js runtime..."
# Core executable (renamed for user-friendliness)
cp "$NWJS_DIR/nw.exe" "$DIST_DIR/Lora Tag Inspector.exe"
# Essential DLLs
cp "$NWJS_DIR/nw.dll" "$DIST_DIR/"
cp "$NWJS_DIR/node.dll" "$DIST_DIR/"
cp "$NWJS_DIR/nw_elf.dll" "$DIST_DIR/"
cp "$NWJS_DIR/d3dcompiler_47.dll" "$DIST_DIR/"
cp "$NWJS_DIR/libEGL.dll" "$DIST_DIR/"
cp "$NWJS_DIR/libGLESv2.dll" "$DIST_DIR/"
cp "$NWJS_DIR/ffmpeg.dll" "$DIST_DIR/"
cp "$NWJS_DIR/vulkan-1.dll" "$DIST_DIR/"
cp "$NWJS_DIR/vk_swiftshader.dll" "$DIST_DIR/"
cp "$NWJS_DIR/vk_swiftshader_icd.json" "$DIST_DIR/"
# Data and resources
cp "$NWJS_DIR/icudtl.dat" "$DIST_DIR/"
cp "$NWJS_DIR/v8_context_snapshot.bin" "$DIST_DIR/"
cp "$NWJS_DIR/resources.pak" "$DIST_DIR/"
cp "$NWJS_DIR/nw_100_percent.pak" "$DIST_DIR/"
cp "$NWJS_DIR/nw_200_percent.pak" "$DIST_DIR/"
# Locales (keep only en-US and zh-CN to save space)
mkdir -p "$DIST_DIR/locales"
cp "$NWJS_DIR/locales/en-US.pak" "$DIST_DIR/locales/" 2>/dev/null || true
cp "$NWJS_DIR/locales/zh-CN.pak" "$DIST_DIR/locales/" 2>/dev/null || true
# credits
cp "$NWJS_DIR/credits.html" "$DIST_DIR/" 2>/dev/null || true

echo "[3/4] Copying README..."
cat > "$DIST_DIR/README.txt" << 'README_EOF'
============================================
  Lora Tag Inspector v1.5
  提示词标签检查与批量管理工具
============================================

使用方法
--------
双击 "Lora Tag Inspector.exe" 即可启动。
无需安装 Python、Node.js 或任何其他软件。

功能简介
--------
- 拖拽文件夹到左侧区域，自动加载所有 .txt 标签文件
- 支持不良标签、自定义关键词、冗余重复、角色特征、风格相关等检查
- 一键删除高亮标签、批量保存
- 图片预览 + 缩放/平移

注意事项
--------
- 首次启动可能需要 5-10 秒加载（NW.js 运行时初始化）
- 如果 Windows 弹出安全警告，点击"更多信息" → "仍然运行"
- 文件保存使用浏览器原生 API，兼容 Windows 10+

问题反馈
--------
如遇到问题，请将此文件夹中的所有文件保留在一起，
不要单独移动 "Lora Tag Inspector.exe"。
README_EOF

echo "[4/4] Creating zip archive..."
cd "$PROJECT_DIR/dist"
pwsh -NoProfile -Command "Compress-Archive -Path 'lora-tag-inspector' -DestinationPath '$OUTPUT_ZIP' -Force" 2>/dev/null || \
  zip -r "$OUTPUT_ZIP" "lora-tag-inspector" 2>/dev/null || \
  (echo "WARNING: Could not create zip. Folder is ready at: $DIST_DIR" && exit 0)

if [ -f "$OUTPUT_ZIP" ]; then
    SIZE=$(ls -lh "$OUTPUT_ZIP" | awk '{print $5}')
    echo ""
    echo "=== Build complete ==="
    echo "Output: $OUTPUT_ZIP ($SIZE)"
    echo "Folder: $DIST_DIR"
else
    echo ""
    echo "=== Build complete ==="
    echo "Folder ready at: $DIST_DIR"
fi
