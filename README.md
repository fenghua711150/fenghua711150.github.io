# NEON PINBALL · 赛博弹珠

一款赛博朋克风格的网页弹珠游戏，手写物理、纯 Canvas 渲染，没有任何第三方依赖。

**在线游玩：** <https://fenghua711150.github.io/>

---

## 玩法

| 操作 | 键盘 | 手机 |
| --- | --- | --- |
| 左挡板 | `Z` / `←` | 左下角 `L` |
| 右挡板 | `/` / `→` | 右下角 `R` |
| 蓄力发射 | 按住 `空格`，松开 | 按住「发射」，松开 |
| 暂停 | `P` / `Esc` | 右上角暂停键 |
| 重开 | `R` | 结束界面 `RETRY` |
| 静音 | `M` | 右上角喇叭键 |

- 没有独立发射轨道：每颗球都放在两块挡板之间，蓄力后直接向上射入台面。
- 一共 3 颗球，全部掉落后游戏结束。
- 台面上有 **12 颗得分球**（缓冲器），另有 4 个数据靶、3 条顶部通道，命中都会加分并积攒 **OVERDRIVE** 能量。
- 打亮全部 4 个数据靶，倍率 +1（最高 ×5）；3 秒后靶子重置。
- 能量满后自动进入 **OVERDRIVE**：8 秒内得分 ×2，台面变红。
- 最高分保存在浏览器本地（`localStorage`）。

## 特点

- **手写物理**：240Hz 固定步长，圆与线段、圆与圆、胶囊挡板的碰撞与动量传递；挡板摆动时会真正把球打飞。
- **挡板间发射**：球停在两块挡板正中，蓄力后沿中央通道射向台面；没有右侧独立发射轨道。
- **弹力板与弹弓**：4 块黄色斜向弹力板（内侧两块较短）会把球强力弹回台面；底部两块粉色三角弹弓已放大到包围框尺寸，回击更狠。
- **更多得分球**：12 颗大小不一的缓冲器分布在台面上，另有 4 个数据靶和 3 条顶部通道。
- **霓虹视觉**：发光边框、网格、扫描线、粒子、屏幕震动、球体拖尾，全部 Canvas 实时绘制。
- **合成音效**：Web Audio 现场合成，没有音频文件。
- **可关闭的玩法说明**：开始页或 HUD 右上角的 `?` 打开 FIELD MANUAL，支持 X、`GOT IT`、`Esc`、点击遮罩关闭；游戏中打开会自动暂停，关闭后继续。
- **双端操作**：桌面键盘 + 移动端触屏按钮，布局自适应。
- **零依赖**：没有 npm、没有打包、没有外部字体或 CDN，断网也能玩（首次加载后）。
- **可访问性**：按钮有 `aria-label`，键盘可完整操作，尊重 `prefers-reduced-motion`。

## 文件结构

```text
fenghua711150.github.io/
├─ index.html              # 游戏页面
├─ 404.html                # SIGNAL LOST 404
├─ favicon.ico
├─ assets/
│  ├─ css/game.css         # 街机柜、HUD、覆盖层、响应式
│  ├─ js/game.js           # 物理、渲染、音效、输入
│  └─ img/                 # 图标、OG 分享图
├─ site.webmanifest
├─ robots.txt
├─ sitemap.xml
├─ .nojekyll
└─ README.md
```

## 本地运行

```powershell
cd fenghua711150.github.io
python -m http.server 8000
# 打开 http://localhost:8000/
```

直接双击 `index.html` 也能玩。

## 修改

| 想改什么 | 位置 |
| --- | --- |
| 主题配色 | `assets/css/game.css` 顶部 `:root`；Canvas 颜色在 `game.js` 的 `COLORS` |
| 台面布局（墙、缓冲器、靶、挡板） | `game.js` 的 `ARC`、`walls`、`bumpers`、`targets`、`flippers` |
| 手感（重力、速度、弹性） | `game.js` 中的 `1180`（重力）、`1560`（限速）、各碰撞的 `e`/`kick` |
| 分数与倍率 | `game.js` 的 `addScore`、`collideBumper`、`collideTarget` |
| 文案与分享信息 | `index.html` 的 `<head>` 与覆盖层 |

## 部署

仓库 `fenghua711150.github.io` 已经开启 GitHub Pages（`main` 分支、根目录）。更新后提交并推送即可，通常 1 分钟内自动发布。

如果从零部署：

1. 新建 Public 仓库，名称必须是 `fenghua711150.github.io`
2. 把本目录全部文件上传到仓库根目录（`index.html` 必须在根）
3. Settings → Pages → Deploy from a branch → `main` / `/ (root)` → Save

## License

MIT © 2026 fenghua711150
