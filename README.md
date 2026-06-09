# Lora Tag Inspector

AI 绘画提示词（Prompt Tag）检查与批量管理工具。

打开 `.txt` 标签文件，自动高亮识别不良标签、冗余重复、角色特征、风格关键词等，支持一键批量删除和保存。

## 功能特性

- **多维度标签检查**：不良标签、自定义关键词、冗余重复、角色特征、风格相关
- **双栏编辑器**：上方原始文件只读（高亮标记），下方编辑预览（可手动微调）
- **自定义关键词**：自由添加关键词，支持正则匹配和定向删除
- **批量文件操作**：勾选文件列表，一键批量删除标签 / 批量保存
- **图片预览**：关联图片自动预览，支持滚轮缩放、右键拖拽、一键适配
- **面板拖拽**：侧边栏、右侧面板、图片区域均可拖拽调整大小

## 快速开始

### 方式一：独立版（推荐）

1. 从 [Releases](../../releases) 下载 `lora-tag-inspector-v1.5-standalone.zip`
2. 解压到任意文件夹
3. 双击 `Lora Tag Inspector.exe`

🟢 无需安装 Python、Node.js 或任何依赖。

> 首次运行如弹出 Windows SmartScreen 警告，点击「更多信息」→「仍要运行」。

### 方式二：源码运行

需要 Python 3 或 Node.js：

```bash
# Windows — 双击
start.bat

# Mac / Linux
./start.sh
```

浏览器打开 `http://localhost:3000`。

## 使用方法

1. 拖拽包含 `.txt` 标签文件的文件夹到左侧区域（或点击选择）
2. 在右侧面板勾选需要的检查类型
3. 上方编辑器会高亮显示问题标签
4. 点击「🗑 一键删除选中标签」在下预览窗口查看结果
5. 满意后点击「💾 保存到本地」

## 项目结构

```
lora-tag-inspector/
├── index.html          # 主页面
├── package.json        # NW.js 配置（独立版）
├── css/
│   └── style.css       # 样式
├── js/
│   ├── app.js          # 主逻辑 & UI 交互
│   ├── check-engine.js # 标签检查引擎
│   ├── editor.js       # CodeMirror 编辑器封装
│   ├── file-manager.js # 文件读写管理
│   ├── keyword-lib.js  # 关键词库
│   └── tag-parser.js   # 标签解析器
├── start.bat           # Windows 启动脚本
├── start.sh            # Mac/Linux 启动脚本
└── build-nwjs.sh       # 独立版构建脚本
```

## 技术栈

- 纯前端 HTML/CSS/JavaScript（ES Modules）
- [CodeMirror 6](https://codemirror.net/) 编辑器
- [NW.js](https://nwjs.io/) 桌面打包
- File System Access API（本地文件读写）

## License

MIT
