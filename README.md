# SayHi 听力内容生成器（无服务器方案）

听力 / 每日泛听 / 发音口语内容由 **GitHub Actions 每天定时生成**，发布为静态 JSON 文件，
托管在 **GitHub Pages**。App 只读取这些静态文件，**不再需要任何后端服务器**。

```
GitHub Actions（每天北京时间 2:00 定时）
   └─ 运行 generate.js，调用 GLM 生成今日内容
        └─ 更新 content/listening.json + content/meta.json
             └─ git 提交 + 发布到 GitHub Pages（静态 JSON）
                  └─ App 启动时拉取 JSON，缓存到本地，离线可用
```

---

## 一、目录结构

```
content-generator/
├── generators.js      # 内容生成逻辑（4级分类 + GLM 调用），从原服务器移植
├── generate.js        # 每日主脚本：读取历史→生成新内容→合并写回
├── package.json
├── content/
│   ├── listening.json # 全量听力内容（App 拉取的主文件）
│   └── meta.json      # 元信息：最后更新时间、今日更新的分类
└── .github-workflow-daily-content.yml  # GitHub Actions 配置（需移到 .github/workflows/）
```

---

## 二、你需要手动做的事（一次性，约 10-15 分钟）

### 1. 创建 GitHub 仓库
- 登录 GitHub → New repository → 起个名字（如 `sayhi-content`）
- 可以选 **Public**（Pages 免费）或 **Private**（Private 也支持 Pages）

### 2. 上传本目录内容
把本目录的文件传到仓库**根目录**（`generate.js`、`generators.js`、`content/`、
`.github/workflows/daily-content.yml` 都在仓库根）。

> 注意：workflow 已配置为在仓库**根目录**运行 `node generate.js`，
> 内容输出到根目录的 `content/` 下。

### 3. 配置 GLM API Key（加密存储，不进代码）
- 仓库 → Settings → Secrets and variables → Actions → New repository secret
- Name 填：`GLM_API_KEY`
- Value 填：你的智谱 GLM API Key（原来放在 `sayhi-server/.env` 里的那个）

### 4. 开启 GitHub Pages
- 仓库 → Settings → Pages
- Source 选择 **GitHub Actions**（不是 Deploy from a branch）

### 5. 手动跑一次验证
- 仓库 → Actions → 选择 "每日生成听力内容" → Run workflow
- 跑完后访问：`https://<你的用户名>.github.io/<仓库名>/listening.json`
  能看到 JSON 就说明成功了。

### 6. 把内容地址填进 App
打开 `SayHi/SayHi/Core/Common/Constants.swift`，修改：

```swift
enum Content {
    static let baseURL = "https://<你的用户名>.github.io/<仓库名>"
    ...
}
```

把 `<你的用户名>` 和 `<仓库名>` 换成你实际的值，然后重新编译 App。

---

## 三、日常维护

- **完全自动**：配置好后每天北京时间 2:00 自动生成，无需人工干预。
- **改生成数量**：编辑 `.github/workflows/daily-content.yml` 里的
  `DAILY_DIALOGUE_COUNT`（默认 5）和 `DAILY_PRON_COUNT`（默认 1）。
- **手动补内容**：随时可在 Actions 页面点 Run workflow 立即生成。
- **成本**：GitHub Actions + Pages 全免费；只消耗 GLM 每天生成几篇的 token（固定，不随用户数增长）。

---

## 四、本地测试（可选）

```bash
cd content-generator
GLM_API_KEY=你的key node generate.js
```

会在 `content/` 下生成/更新 JSON。

---

## 五、考试真题（英语考试分类）说明

`英语考试` 分类（四六级/雅思/托福/考研真题）**不参与每日自动生成**，
需要单独整理真题数据后，手动追加到 `content/listening.json` 的 `articles` 数组里
（字段格式参照现有对话文章，`contentType` 设为 `"exam"`，`extraData.questions` 放题目）。

---

## 六、数据格式参考

`listening.json`:
```json
{
  "articles": [
    {
      "id": 1,
      "title": "07/31 标题",
      "titleZh": "07/31 中文标题",
      "category": "每日泛听",      // 每日泛听 / 英语考试 / 发音口语
      "tag": "日常对话",           // 二级分类
      "subTag": "咖啡厅",          // 三级分类
      "subTagIcon": "☕",
      "contentType": "dialogue",   // dialogue / exam / pronunciation
      "level": "中级",
      "paragraphs": [{ "en": "...", "zh": "..." }],
      "extraData": { "lines": [...], "questions": [...], "examples": [...] },
      "wordCount": 62,
      "coverIcon": "bubble.left.and.bubble.right.fill",
      "coverColor": "#667EEA",
      "playCount": 0,
      "publishDate": "2026-07-31"
    }
  ],
  "nextId": 2
}
```

`meta.json`:
```json
{
  "lastUpdated": "2026-07-31T18:00:00.000Z",
  "today": "2026-07-31",
  "totalArticles": 120,
  "todayAdded": 6,
  "updatedCategories": ["每日泛听-日常对话", "发音口语-音标发音"]
}
```
