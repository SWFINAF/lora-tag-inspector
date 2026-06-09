# Lora Tag Inspector — 设计规格说明

**日期**: 2026-06-09
**状态**: 待用户审核
**版本**: 1.0

---

## 1. 项目概述

### 1.1 目标

构建一个 Web 本地应用，帮助 Lora 训练者批量检查、高亮标注、直接编辑打标 txt 文件。通过可勾选的检查规则，定向筛查标签中的问题，以不同颜色高亮呈现，方便快速定位和修改。

### 1.2 核心用户场景

1. 用户拖入/选择一个包含多张训练素材图片和对应 txt 打标文件的文件夹
2. 工具自动扫描并列出所有 txt 文件
3. 用户在右侧检查面板勾选要进行的检查类型
4. 编辑器实时高亮显示有问题的标签，不同检查类型用不同颜色
5. 用户直接在编辑器中修改文本，Ctrl+S 保存覆盖原文件

### 1.3 技术选型

- **形态**: Web 本地应用（纯前端，浏览器运行）
- **编辑器**: CodeMirror 6（CDN 加载）
- **文件读写**: File System Access API（Chrome/Edge），降级 FileReader（其他浏览器只读）
- **存储**: localStorage 存配置，原路径覆盖保存文件
- **模块化**: 原生 ES Modules，无构建步骤

---

## 2. 架构

### 2.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                     Lora Tag Inspector                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐   ┌──────────────┐   ┌───────────────────┐  │
│   │ File Manager  │   │  Tag Parser  │   │   Check Engine    │  │
│   │               │   │              │   │                   │  │
│   │ ·拖拽/选择    │──▶│ ·逗号分割    │──▶│ 1.不良标签检查     │  │
│   │ ·文件夹扫描   │   │ ·触发词识别  │   │ 2.自定义规则检查   │  │
│   │ ·文件列表     │   │ ·标签清洗    │   │ 3.冗余重复检查     │  │
│   │ ·标签页管理   │   │              │   │ 4.角色特征检查     │  │
│   └──────────────┘   └──────────────┘   │ 5.风格相关检查     │  │
│                                          └─────────┬─────────┘  │
│                                                    │             │
│   ┌────────────────────────────────────────────────┼──────────┐  │
│   │              CodeMirror 6 Editor              │          │  │
│   │                                               │          │  │
│   │  ·行号/语法提示   ·搜索替换                   ▼          │  │
│   │  ·多色高亮标记（Decoration API） ◀── 高亮结果映射          │  │
│   │  ·直接编辑 + Ctrl+S 保存                                    │  │
│   └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│   ┌──────────────┐   ┌──────────────────────────────────────┐   │
│   │ Keyword Lib  │   │           Control Panel              │   │
│   │              │   │                                      │   │
│   │ ·内置角色词  │   │ ☑ 角色特征    ☐ 风格相关            │   │
│   │ ·内置风格词  │   │ ☑ 重复标签    ☑ 不良标签            │   │
│   │ ·内置不良词  │   │ ☐ 自定义规则                         │   │
│   │ ·用户自定义  │   │                                      │   │
│   └──────────────┘   └──────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 模块职责

| 模块 | 文件 | 职责 | 输入 | 输出 |
|------|------|------|------|------|
| `FileManager` | `js/file-manager.js` | 文件夹/文件加载、文件列表维护、标签页管理、保存 | 拖拽/选择的文件 | 文件列表 + 当前活跃文件内容 + fileHandle |
| `TagParser` | `js/tag-parser.js` | 解析 txt 为标签数组，识别触发词位置 | 原始文本 | `[{text, startIndex, endIndex, isTrigger}]` |
| `CheckEngine` | `js/check-engine.js` | 按启用规则对标签数组执行检查 | 标签数组 + 检查配置 + 关键词库 | `[{type, tag, startIndex, endIndex, message}]` |
| `KeywordLib` | `js/keyword-lib.js` | 管理内置+自定义关键词库，导入导出 | 用户编辑操作 | 合并后的运行时词库 |
| `EditorView` | `js/editor.js` | CodeMirror 封装，高亮标记渲染，状态管理 | 文本 + 问题列表 | 可视化编辑器实例 |
| `App` | `js/app.js` | 主控制器，模块编排，事件绑定 | 用户操作 | 协调所有模块 |

### 2.3 文件结构

```
lora-tag-inspector/
├── index.html              ← 入口，加载所有资源
├── css/
│   └── style.css           ← 布局、颜色主题、高亮样式
├── js/
│   ├── app.js              ← 主控制器，模块编排
│   ├── file-manager.js     ← 文件加载与管理
│   ├── tag-parser.js       ← 标签解析
│   ├── check-engine.js     ← 检查规则引擎
│   ├── keyword-lib.js      ← 内置+自定义关键词库
│   └── editor.js           ← CodeMirror 封装
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-06-09-lora-tag-inspector-design.md  ← 本文件
```

---

## 3. 检查系统

### 3.1 检查类型与高亮颜色

| 优先级 | 检查类型 | 默认颜色 | 色值 |
|--------|----------|----------|------|
| 1（最高） | 不良标签 | 橙色 | `#FF922B` |
| 2 | 自定义规则 | 蓝色 | `#74C0FC` |
| 3 | 冗余重复 | 黄色 | `#FFD43B` |
| 4 | 角色特征 | 红色 | `#FF6B6B` |
| 5（最低） | 风格相关 | 绿色 | `#51CF66` |

### 3.2 各检查类型详细逻辑

#### 3.2a 不良标签检查（最高优先级）

| 子类 | 检测方式 | 示例 |
|------|----------|------|
| 无意义标签 | 正则检测：单字符、纯标点、纯数字、乱码字符 | `a`, `...`, `123`, `あ`（孤立假名） |
| 冲突标签对 | 关键词库中的预定义互斥对 | `1girl` + `1boy`, `black hair` + `blonde hair`, `day` + `night` |
| 过拟合风险 | 关键词+正则：具体人名、商标名、具体地点、日期时间 | `Taylor Swift`, `Nike`, `Tokyo Tower`, `2024/01/01` |
| 负面质量描述 | 关键词库匹配 | `blurry`, `worst quality`, `bad anatomy`, `模糊`, `灰色湖面` |

#### 3.2b 自定义规则检查

用户自定义的关键词/正则表达式匹配。支持：
- 简单关键词匹配
- 正则表达式匹配（高级用户）

#### 3.2c 冗余重复检查

| 层级 | 说明 | 开关 |
|------|------|------|
| 精确匹配 | 完全相同字符串才算重复 | 默认开启 |
| 模糊匹配 | 归一化后比较（去下划线→空格、统一小写），`blue eyes` ≈ `blue_eyes` ≈ `Blue Eyes` | 可开关 |

同一标签出现 ≥2 次即标记为重复。

#### 3.2d 角色特征检查

匹配角色关键词库，包含以下子类：
- 性别（`1girl`, `1boy`, `female`, `male`）
- 发型（`blonde hair`, `long hair`, `ponytail` 等）
- 瞳色（`blue eyes`, `red eyes`, `heterochromia` 等）
- 表情（`smile`, `angry`, `blush` 等）
- 体型（`slim`, `muscular`, `chibi` 等）
- 服饰（`dress`, `school uniform`, `kimono`, `armor` 等）
- 配饰（`glasses`, `ribbon`, `cat ears` 等）
- 姿态（`standing`, `sitting`, `looking at viewer` 等）

#### 3.2e 风格相关检查

匹配风格关键词库，包含以下子类：
- 媒介（`anime style`, `realistic`, `watercolor`, `3d` 等）
- 渲染质量（`cel shading`, `masterpiece`, `best quality` 等）
- 美术风格（`monochrome`, `vibrant colors`, `pastel` 等）
- 构图（`portrait`, `full body`, `close-up` 等）
- 背景（`simple background`, `outdoors`, `night` 等）

### 3.3 高亮渲染策略

- **优先级覆盖**：同一标签触发多种检查时，只显示最高优先级的颜色
- **Gutter 标记**：编辑器行号旁显示彩色小点，指示该行存在检查命中
- **悬停提示**：Gutter 标记悬停时显示该行所有问题详情（包括被覆盖的低优先级问题）
- **底部摘要栏**：`🔴3 角色 · 🟡2 重复 · 🟠5 不良 · 🟢1 风格 · 🔵0 自定义`
- **点击问题导航**：点击摘要栏中的条目，跳转到对应标签位置

---

## 4. 用户界面

### 4.1 布局

```
┌──────────────────────────────────────────────────────────────────────┐
│  Lora Tag Inspector                                                  │
├────────────┬─────────────────────────────────────┬────────────────────┤
│  [拖拽区]   │  [标签页栏]                          │  [检查面板]         │
│             │─────────────────────────────────────│                    │
│  📁 选择    │                                     │  ☑ 不良标签 #FF922B │
│  文件夹     │                                     │  ☐ 自定义规则 #74C0FC│
│             │      CodeMirror 编辑区              │  ☑ 冗余重复 #FFD43B │
│  ────────   │      （文本+高亮标记）               │    └ ☐ 启用模糊匹配 │
│  文件列表   │                                     │  ☑ 角色特征 #FF6B6B │
│             │                                     │  ☑ 风格相关 #51CF66 │
│  📄 001.txt │                                     │                      │
│  📄 002.txt │                                     │  ────────────────   │
│  📄 003.txt │                                     │  📊 问题摘要         │
│  📄 004.txt │                                     │  🔴3 🟡2 🟠0 🟢1   │
│  ...        │                                     │                      │
│             │─────────────────────────────────────│  [导出报告] [设置]   │
│             │ 状态栏: 12个标签 | 已修改 | Ctrl+S保存│                      │
└────────────┴─────────────────────────────────────┴────────────────────┘
```

### 4.2 交互流程

```
拖拽文件夹/文件 ──▶ 扫描.txt ──▶ 加载文件列表 ──▶ 打开首个文件
                                                    │
                                           ☑/☐ 勾选检查项 ──▶ 实时重新检查高亮
                                                    │
                                           点击文件 ──▶ 切换编辑器内容
                                                    │
                                           编辑文本 ──▶ 标记"已修改"
                                                    │
                                           Ctrl+S ──▶ 覆盖保存原txt
```

### 4.3 设置弹窗

弹窗包含以下 Tab：
- **角色特征词库**：分类列表，增删改查
- **风格相关词库**：分类列表，增删改查
- **不良标签词库**：负面质量词 + 过拟合风险词管理
- **冲突标签对**：互斥对列表，新增/删除
- **自定义正则规则**：名称 + 正则表达式 + 颜色
- **导入/导出配置**：JSON 文件，备份和分享
- **重置到默认**：一键恢复内置词库

### 4.4 标签页管理

- 顶部标签页栏 + 左侧文件列表双模式
- 左侧点击文件 → 自动在顶部标签页打开（如已打开则切换）
- 标签页可关闭（×），关闭时检查是否修改（提醒保存）
- 标签页标题显示修改标记（`● file.txt` 表示已修改）

---

## 5. 数据流

### 5.1 核心数据流

```
拖拽/选择文件夹
       │
       ▼
  FileManager ──── 扫描 .txt 文件，读入内存
       │
       │ 当前文件文本
       ▼
  TagParser ──── 逗号分割 + trim → 标签数组
       │
       │ [{text, startIndex, endIndex, isTrigger}]
       ▼
  CheckEngine ──── 遍历启用规则 × 关键词库匹配
       │
       │ [{type, tag, startIndex, endIndex, message}]
       ▼
  EditorView ──── CodeMirror DecorationSet 高亮渲染
       │
       ▼
  用户看到高亮 → 编辑 → Ctrl+S 保存
```

### 5.2 运行时状态

```javascript
const state = {
  files: [],              // [{name, path, content, modified, fileHandle}]
  activeFileIndex: 0,
  activeTabIds: [],       // 当前打开的标签页文件索引列表
  checks: {
    badTags: true,
    custom: false,
    duplicate: true,
    fuzzyDuplicate: false,
    character: true,
    style: true,
  },
  keywordLib: {           // 合并内置+用户自定义
    character: { ... },
    style: { ... },
    badTags: { conflictingPairs: [...], negativeQuality: [...], overfitRisk: [...] },
    custom: [ { name, pattern, color } ],
  },
  issues: [],             // 当前文件问题列表
};
```

### 5.3 持久化策略

| 数据 | 存储位置 | 说明 |
|------|----------|------|
| 检查勾选状态 | localStorage | 自动保存，下次打开恢复 |
| 用户自定义词库 | localStorage | 自动保存 |
| 配置导入/导出 | JSON 文件 | 用户手动操作 |
| 原始 txt 文件 | 原路径覆盖写回 | File System Access API |

---

## 6. 文件操作

### 6.1 加载

- 支持拖拽文件夹到拖拽区
- 支持拖拽单个/多个文件到拖拽区
- 支持点击按钮选择文件夹（File System Access API）
- 自动过滤仅 `.txt` 文件
- 跳过非 txt 文件并在状态栏提示数量

### 6.2 保存

- Ctrl+S 快捷键保存当前文件
- 使用 fileHandle.createWritable() 覆盖写入
- 保存后清除修改标记
- 后续可选加"全部保存"按钮

### 6.3 编码处理

1. 优先以 UTF-8 读取
2. 如出现乱码特征（� 字符），尝试 GBK
3. 仍失败则提示用户手动选择编码

---

## 7. 容错与边界情况

| 场景 | 处理方式 |
|------|----------|
| 非 txt 文件 | 自动过滤，仅加载 `.txt`，状态栏提示"已跳过 N 个非txt文件" |
| txt 为空 | 编辑器显示空白，检查结果为空，状态栏显示 "0 个标签" |
| 超大文件（>500KB） | 弹出确认框 "文件较大，加载可能变慢，是否继续？" |
| File System API 不可用 | 降级为 FileReader 只读模式，顶部提示"浏览器不支持直接保存，请安装 Chrome/Edge" |
| 文件被外部删除 | 保存时捕获异常，提示"文件已被删除或移动，请重新加载" |
| 切换未保存文件 | 弹出确认框 "当前文件已修改，是否保存？" |
| 浏览器刷新/关闭 | `beforeunload` 事件弹出确认 |
| 文件编码非 UTF-8 | 尝试 GBK 解码，失败则提示"无法识别文件编码" |
| 空关键词库 | 对应检查结果始终为 0，不报错 |
| 同一标签触发多种检查 | 显示最高优先级颜色，Gutter 悬停提示列出全部命中 |

---

## 8. 性能考虑

| 场景 | 策略 |
|------|------|
| 单文件检查 | 全文匹配，预期 <50ms |
| 大量标签（1000+） | 关键词转 Set/Map 做 O(1) 查找 |
| 频繁编辑触发重检 | debounce 300ms |
| 多文件批量报告 | 异步逐文件处理，显示进度 |

---

## 9. 技术依赖

| 依赖 | 用途 | 加载方式 |
|------|------|----------|
| CodeMirror 6 (`@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/search`) | 编辑器核心 | CDN (esm.sh) |
| 无其他依赖 | — | 纯原生 JS/CSS/HTML |

首次加载后浏览器缓存 CodeMirror，之后可离线使用。

---

## 10. 未来扩展（不在当前版本实现）

| 扩展功能 | 预留点 |
|----------|--------|
| 批量替换/重命名标签 | 检查引擎输出已包含标签位置 |
| 导出检查报告（HTML/CSV） | 问题列表已结构化 |
| 多语言界面（中/英/日） | CSS class 命名已预留 i18n |
| 与 Kohya/EveryDream 训练工具集成 | TagParser 输出可序列化 |
| 完全离线打包 | CDN 资源本地化 |

---

## 11. 关键词库结构（内置默认值）

### 11.1 角色特征词

| 分类 | 示例关键词 |
|------|-----------|
| 性别 | `1girl`, `1boy`, `1other`, `female`, `male`, `multiple girls`, `multiple boys` |
| 发型 | `blonde hair`, `black hair`, `brown hair`, `blue hair`, `red hair`, `white hair`, `short hair`, `long hair`, `ponytail`, `twintails`, `braid`, `bangs` |
| 瞳色 | `blue eyes`, `red eyes`, `green eyes`, `brown eyes`, `heterochromia`, `closed eyes` |
| 表情 | `smile`, `smiling`, `open mouth`, `blush`, `angry`, `sad`, `laughing`, `surprised` |
| 体型 | `slim`, `skinny`, `muscular`, `tall`, `short`, `chibi` |
| 服饰 | `dress`, `skirt`, `shirt`, `jacket`, `school uniform`, `kimono`, `armor`, `swimsuit`, `maid`, `chinese clothes` |
| 配饰 | `glasses`, `earrings`, `necklace`, `hat`, `ribbon`, `bow`, `headband`, `cat ears` |
| 姿态 | `standing`, `sitting`, `lying`, `looking at viewer`, `looking away`, `arms up`, `hand on hip`, `crossed arms` |

### 11.2 风格相关词

| 分类 | 示例关键词 |
|------|-----------|
| 媒介 | `anime style`, `realistic`, `semi-realistic`, `sketch`, `watercolor`, `oil painting`, `lineart`, `flat color`, `digital painting`, `3d`, `cg` |
| 渲染 | `cel shading`, `soft shading`, `detailed`, `intricate`, `highres`, `masterpiece`, `best quality`, `absurdres` |
| 美术风格 | `monochrome`, `greyscale`, `sepia`, `vibrant colors`, `muted colors`, `pastel`, `dark`, `colorful` |
| 构图 | `portrait`, `full body`, `close-up`, `cowboy shot`, `dutch angle`, `from above`, `from below`, `side view`, `back view` |
| 背景 | `simple background`, `white background`, `transparent`, `gradient`, `outdoors`, `indoors`, `nature`, `city`, `night`, `day` |

### 11.3 不良标签

| 分类 | 示例 |
|------|------|
| 冲突对 | `[1girl, 1boy]`, `[black hair, blonde hair]`, `[black hair, white hair]`, `[day, night]`, `[smile, angry]` |
| 负面质量 | `blurry`, `blurred`, `low quality`, `worst quality`, `bad quality`, `lowres`, `jpeg artifacts`, `noise`, `grainy`, `distorted`, `poorly drawn`, `bad anatomy`, `extra fingers`, `missing fingers`, `fused fingers`, `too many fingers`, `mutation`, `deformed`, `disfigured`, `ugly`, `bad proportions`, `gross proportions`, `poorly drawn face`, `poorly drawn hands`, `poorly drawn feet`, `模糊`, `灰色`, `灰色湖面`, `模糊画面`, `不清楚`, `低质量` |
| 无意义 | 正则检测：`^[a-zA-Z0-9]$`（单字符）、`^[^a-zA-Z0-9一-鿿぀-ゟ゠-ヿ]+$`（纯标点）、乱码字符 |
