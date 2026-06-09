# 自定义关键词检查 — 设计规格说明

**日期**: 2026-06-09
**状态**: 待实现
**版本**: 1.0

---

## 1. 目标

将现有「自定义规则」（基于正则表达式）替换为「自定义关键词」（基于文本包含匹配），降低使用门槛。同时新增右侧面板快捷输入区，支持临时输入关键词，与设置弹窗的持久化关键词库双层配合。

## 2. 核心变更

### 2.1 匹配逻辑变更

| 旧 | 新 |
|----|-----|
| 正则表达式匹配 | 关键词包含匹配（大小写不敏感） |
| `pattern: "nsfw\|nude\|explicit"` | 直接输入 `nsfw`, `nude`, `explicit` |
| 需了解正则语法 | 直接输入文本即可 |

匹配规则：标签文本转小写后包含关键词（小写后），即 `tag.toLowerCase().includes(keyword.toLowerCase())`

### 2.2 UI 变更

**右侧面板**：
- 「自定义规则」→「自定义关键词」，颜色由蓝(#74C0FC)改为紫(#c084fc)
- 新增快捷输入区：输入框 + 关键词标签列表 + 「仅删关键词」按钮 + 「⚙ 管理」按钮
- 快捷输入区默认折叠，输入关键词后自动展开

**设置弹窗**：
- 「自定义正则规则」Tab 替换为「自定义关键词」Tab
- 支持单个添加、批量删除、批量导入（逗号分割粘贴）

### 2.3 数据结构变更

```javascript
// keywordLib 中
// 旧: customRules: [{ name, pattern, color }]
// 新: customKeywords: ["keyword1", "keyword2", ...]
```

个性化颜色暂不支持，统一使用 CSS 变量 `--custom-kw: #c084fc`。

### 2.4 两层关键词体系

| 层级 | 来源 | 存储 | 生命周期 |
|------|------|------|----------|
| 持久化关键词 | 设置弹窗 | localStorage | 永久 |
| 临时关键词 | 右侧快捷输入 | 内存（session） | 刷新后消失 |

运行时合并两者做检查，删除时两者统一处理。

## 3. 涉及文件

| 文件 | 操作 |
|------|------|
| `index.html` | 修改：检查选项标签文字/颜色，新增快捷输入面板 |
| `css/style.css` | 修改：新增紫色高亮样式，快捷输入面板样式 |
| `js/keyword-lib.js` | 修改：customRules → customKeywords，对接 localStorage |
| `js/check-engine.js` | 修改：checkCustomRules → checkCustomKeywords |
| `js/app.js` | 修改：面板绑定、临时关键词管理、设置渲染、删除逻辑 |

## 4. 检查引擎变更

```javascript
function checkCustomKeywords(tags, keywords) {
  // 简单包含匹配，大小写不敏感
  for (const tag of tags) {
    for (const kw of keywords) {
      if (tag.text.toLowerCase().includes(kw.toLowerCase())) {
        issues.push({ type: 'custom', ... });
        break; // 一个标签只报一次
      }
    }
  }
}
```

## 5. 删除行为

- **一键删除选中标签**：勾选「自定义关键词」后，自定义关键词匹配到的标签纳入删除范围
- **仅删关键词按钮**：仅删除自定义关键词匹配到的标签，不碰其他类型
- 两者均通过 `editorView.dispatch()` 执行（可撤销）

## 6. 向后兼容

- 检测到 localStorage 中存在旧格式 `customRules` 时，忽略（不自动迁移，避免出错）
- 旧正则规则较复杂，自动转换容易产生误匹配
- 首次打开设置时若旧数据存在，提示用户手动迁移
