# 风华 · FENGHUA

`fenghua711150` 的个人网站 —— 纯静态、无框架、无构建步骤，托管于 GitHub Pages。

**线上地址：** <https://fenghua711150.github.io/>

---

## 这是什么

一个可以长期维护的个人主页，包含：

- 首屏介绍、关于我、技能栈、精选项目、成长时间线、联系方式
- 深色 / 浅色主题（跟随系统，可手动切换并记住选择）
- 响应式布局（桌面 / 平板 / 手机）
- 滚动入场、打字机、数字滚动等轻量动效，并尊重 `prefers-reduced-motion`
- SEO：`meta`、Open Graph、Twitter Card、JSON-LD、`sitemap.xml`、`robots.txt`
- 404 页面、PWA manifest、站点图标与分享图

没有 npm、没有打包、没有第三方 JS 依赖。改完文件刷新即可看到效果。

## 目录结构

```text
fenghua711150.github.io/
├─ index.html              # 首页（内容都在这里）
├─ 404.html                # 404 页面
├─ favicon.ico             # 站点图标（兼容旧浏览器）
├─ assets/
│  ├─ css/style.css        # 全部样式与设计变量
│  ├─ js/main.js           # 主题、导航、动效、复制邮箱
│  └─ img/                 # 头像、图标、OG 分享图
├─ site.webmanifest        # PWA 配置
├─ robots.txt
├─ sitemap.xml
├─ .nojekyll               # 告诉 GitHub Pages 不要用 Jekyll 处理
└─ README.md
```

## 本地预览

方式一：直接双击 `index.html`，浏览器打开即可。

方式二（推荐，路径行为与线上一致）：

```powershell
cd fenghua711150.github.io
python -m http.server 8000
# 然后访问 http://localhost:8000/
```

## 部署到 GitHub Pages

> 关键点：仓库名必须是 **`fenghua711150.github.io`**，且为 **Public**。这样站点地址才是 `https://fenghua711150.github.io/`。

### A. 网页上传（不需要命令行）

1. 打开 <https://github.com/new>，仓库名填 `fenghua711150.github.io`，选择 **Public**，不要勾选任何初始化文件，点击 **Create repository**。
2. 在空仓库页点击 **uploading an existing file**，把本项目**根目录下的全部文件和文件夹**拖进去（注意：不要把外层文件夹一起拖，`index.html` 必须在仓库根目录）。
3. 填写提交信息，点击 **Commit changes**。
4. 进入仓库 **Settings → Pages**，在 **Build and deployment** 中把 **Source** 设为 **Deploy from a branch**，**Branch** 选 **main**、目录选 **/ (root)**，点击 **Save**。
5. 等 1–2 分钟，访问 <https://fenghua711150.github.io/>。

### B. 命令行

```powershell
cd fenghua711150.github.io
git init
git add .
git commit -m "feat: 初始化个人网站"
git branch -M main
git remote add origin https://github.com/fenghua711150/fenghua711150.github.io.git
git push -u origin main
```

推送后同样在 **Settings → Pages** 里选择 `main` / `/ (root)` 并保存。

### 之后更新内容

改完文件后重新提交并推送即可，GitHub Pages 会自动重新发布（通常 1 分钟内）：

```powershell
git add .
git commit -m "content: 更新项目"
git push
```

## 把内容换成你自己的

| 想改什么 | 去哪里找 |
| --- | --- |
| 名字、标语、首屏文案 | `index.html` 中 `<!-- 首屏 -->` 区块 |
| 邮箱 | 搜索 `fenghua711150@gmail.com`，共 3 处（关于、联系按钮、复制邮箱按钮的 `data-email`） |
| GitHub 链接 | 搜索 `https://github.com/fenghua711150` |
| 项目卡片 | `<!-- 项目 -->` 区块，复制一个 `<a class="project">` 改文案与链接 |
| 技能 | `<!-- 技能 -->` 区块的 `chips` 列表 |
| 时间线 | `<!-- 历程 -->` 区块的 `timeline__item` |
| 统计数字 | 首屏 `data-count="6"` 等，改数字即可自动滚动 |
| 主题色 | `assets/css/style.css` 顶部的 `--accent`、`--accent-2`、`--accent-3` |
| 头像 | 替换 `assets/img/avatar.svg`（保持 1:1 比例） |
| 分享图 | 替换 `assets/img/og.png`（建议 1200×630） |

改完文案后，顺手更新 `index.html` 里的 `description`、Open Graph、JSON-LD，以及 `sitemap.xml` 的 `lastmod`。

## 关于「私人」

GitHub Pages 的站点是**公开可访问**的：任何人拿到地址都能打开，搜索引擎也可能收录。如果你说的「私人」是指：

- **只是个人主页** → 现在的方案就合适；
- **需要登录 / 密码才能看** → GitHub Pages 本身不支持，需要换成 Cloudflare Pages + Cloudflare Access、Netlify 密码保护，或自建带鉴权的服务器。

目前页面已加 `robots.txt` 允许收录。若不想被搜索引擎索引，把 `robots.txt` 改为：

```text
User-agent: *
Disallow: /
```

并在 `index.html` 的 `<head>` 中加入 `<meta name="robots" content="noindex" />`。

## 技术说明

- 语义化 HTML5 + 手写 CSS（自定义属性、`clamp()`、`color-mix()` 带降级）
- 原生 JavaScript，无依赖；使用 `IntersectionObserver` 做滚动监听与入场动画
- 可访问性：跳转链接、焦点样式、`aria-*`、键盘可操作的菜单与主题切换
- 性能：零外部请求（字体使用系统字体栈），图片为 SVG / 优化 PNG

## License

MIT © 2026 fenghua711150
