#!/bin/bash
# Build NW.js standalone distribution for Windows
# Produces a self-contained folder — no Python/Node.js required
# Double-click "START.bat" to launch, or run "LoraTagInspector.exe" directly

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
NWJS_DIR="$PROJECT_DIR/nwjs-runtime/nwjs-v0.96.0-win-x64"
DIST_DIR="$PROJECT_DIR/dist/lora-tag-inspector"
OUTPUT_ZIP="$PROJECT_DIR/lora-tag-inspector-v1.5-standalone.zip"

echo "=== Lora Tag Inspector — NW.js Standalone Builder ==="
echo ""

# Check if NW.js runtime exists
if [ ! -f "$NWJS_DIR/nw.exe" ]; then
    echo "[ERROR] NW.js runtime not found at: $NWJS_DIR"
    echo "Please download NW.js first:"
    echo "  curl -sL 'https://dl.nwjs.io/v0.96.0/nwjs-v0.96.0-win-x64.zip' -o nwjs.zip"
    echo "  unzip -q nwjs.zip -d nwjs-runtime"
    exit 1
fi

# Clean previous build
rm -rf "$PROJECT_DIR/dist"
mkdir -p "$DIST_DIR"

echo "[1/5] Copying app files..."
cp "$PROJECT_DIR/index.html" "$DIST_DIR/"
cp "$PROJECT_DIR/package.json" "$DIST_DIR/"
cp -r "$PROJECT_DIR/css" "$DIST_DIR/"
cp -r "$PROJECT_DIR/js" "$DIST_DIR/"
# Provide both an ASCII launcher name (most reliable) and a Chinese alias.
cp "$PROJECT_DIR/launcher.bat" "$DIST_DIR/START.bat"
cp "$PROJECT_DIR/launcher.bat" "$DIST_DIR/启动.bat"

echo "[2/5] Copying NW.js runtime..."
# Core executable (renamed without spaces)
cp "$NWJS_DIR/nw.exe" "$DIST_DIR/LoraTagInspector.exe"
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
cp "$NWJS_DIR/notification_helper.exe" "$DIST_DIR/" 2>/dev/null || true
# SwiftShader (software GPU fallback — needed on some machines)
if [ -d "$NWJS_DIR/swiftshader" ]; then
    cp -r "$NWJS_DIR/swiftshader" "$DIST_DIR/"
fi
# Locales (keep en-US and zh-CN)
mkdir -p "$DIST_DIR/locales"
for loc in en-US zh-CN; do
    cp "$NWJS_DIR/locales/${loc}.pak" "$DIST_DIR/locales/" 2>/dev/null || true
done
# Credits
cp "$NWJS_DIR/credits.html" "$DIST_DIR/" 2>/dev/null || true

echo "[3/5] Creating README..."
cat > "$DIST_DIR/使用说明.txt" << 'README_EOF'
============================================
  Lora Tag Inspector v1.5
  提示词标签检查与批量管理工具
============================================

【使用方法】
  1. 推荐双击 "START.bat" 启动（最稳定，避免中文文件名乱码）
  2. 也可以双击 "启动.bat" 或 "LoraTagInspector.exe"

【首次运行提示】
  如果 Windows 弹出 "Windows 已保护你的电脑" 提示：
  → 点击 "更多信息"
  → 点击 "仍要运行"
  （这是因为程序没有购买数字签名证书，绝对安全无毒）

【如果启动失败】
  1. 杀毒软件可能隔离了文件 → 请在杀毒软件中添加信任
  2. 缺少运行库 → 下载安装 VC++ 运行库：
     https://aka.ms/vs/17/release/vc_redist.x64.exe

【注意事项】
  - 所有 DLL 文件和 exe 必须在同一文件夹中
  - 不要单独移动 LoraTagInspector.exe 到其他位置
  - 需要联网（编辑器组件从网络加载）

【功能简介】
  - 拖拽文件夹加载 .txt 标签文件
  - 自动检测不良标签、冗余重复、角色特征、风格关键词
  - 双栏编辑器（原始只读 + 编辑预览）
  - 批量文件操作（勾选 + 一键删除/保存）
  - 关联图片预览（滚轮缩放、右键拖拽）

【问题反馈】
  GitHub: https://github.com/SWFINAF/lora-tag-inspector
README_EOF

echo "[4/5] Copying English README..."
cp "$PROJECT_DIR/README.md" "$DIST_DIR/README.txt" 2>/dev/null || true

echo "[5/5] Creating zip archive..."
cd "$PROJECT_DIR/dist"
powershell -NoProfile -Command "Compress-Archive -Path 'lora-tag-inspector' -DestinationPath '$OUTPUT_ZIP' -Force" 2>/dev/null && {
    SIZE=$(ls -lh "$OUTPUT_ZIP" | awk '{print $5}')
    echo ""
    echo "=== Build complete ==="
    echo "Output: $OUTPUT_ZIP ($SIZE)"
    echo "Folder: $DIST_DIR"
    echo ""
    echo "User launches: START.bat"
} || {
    echo ""
    echo "=== Build complete (zip failed — folder ready) ==="
    echo "Folder: $DIST_DIR"
    echo ""
    echo "To create zip manually:"
    echo "  powershell Compress-Archive -Path '$DIST_DIR' -DestinationPath '$OUTPUT_ZIP'"
}

# Clean up OLD standalone zip in project root (keep only the new one)
rm -f "$PROJECT_DIR/lora-tag-inspector-v1.5.zip"
echo "Tip: old web-only zip removed. Use this standalone zip instead."
