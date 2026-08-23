# dsh-client-ui-skin-denia · 达妮娅 · 虚无之泡

DeepSeek Harness Web GUI 的鸣潮达妮娅主题皮肤。

## 效果预览

点击图片可查看完整尺寸。

| 布景之形（亮色） | 幻灭之形（暗色） |
|---|---|
| [![布景之形](preview/light.webp)](preview/light.webp) | [![幻灭之形](preview/dark.webp)](preview/dark.webp) |

## 特性

- **双形态切换**：布景之形（亮色）/ 幻灭之形（暗色），含形态切换动画
- **左右全身立绘** + Q版动态 GIF 吉祥物
- **玻璃卡片层级**：root 半透明 + backdrop-filter 模糊
- **泡泡粒子场**：双层虹彩气泡上浮
- **锁链边框**：深紫锁链，跟随侧栏宽度
- **渐变文字**：工作区/会话标题粉紫渐变
- **装饰条 + 四角星**：侧边栏彩虹渐变装饰
- **深色/浅色按钮文字替换**：布景之形 / 幻灭之形
- **新会话欢迎界面注入**：达妮娅标题 + 副标题 + 台词
- **侧栏收起/展开自适应布局**：立绘 + Q版 + 文字居中联动
- **黑白娅分别背景图**

## 版权所有人

| 版权所有人 | 版权所有内容 |
|---|---|
| Kuro Games（库洛游戏） | 「鸣潮」游戏作品及达妮娅（Denia）角色形象原作 |
| Ewnscat | 皮肤覆盖层实现（CSS 配色、SVG 装饰、DOM 装饰逻辑） |

\*背景 / 角色 / 画框素材及预览截图来自用户本地素材库。本皮肤为同人创作，与 Kuro Games 无关联。

## 安装

### 懒人版

对你的 dsh 说：
```
安装一下这个皮肤包：https://github.com/Ewnscat-ya/dsh-client-ui-skin-denia
```

### 手动安装

```sh
git clone https://github.com/Ewnscat-ya/dsh-client-ui-skin-denia
cd <harness>
dsh plugin --profile web add ../dsh-client-ui-skin-denia
```

或手动将本包放入 DSH 的 `profiles/web/node_modules/@dsh-external/dsh-client-ui-skin-denia/` 目录下，然后在 `cordis.patch.yml` 中添加：

```yaml
- id: ui-skin-denia
  disabled: false
```

重启 DSH 后在设置 → 皮肤中选择"达妮娅 · 虚无之泡"。

## 调色板

皮肤加载后，界面右下角会出现一个默认折叠的调色板面板，点击 `🎨` 展开。设置会保存到当前 DSH profile 的皮肤专属文件；刷新、重启、清除浏览器站点存储后仍可恢复。亮色与暗色自定义背景图也会一并保存。

### 亮色 / 暗色（分形态独立控制）

| 控件 | 说明 |
|---|---|
| 背景图 | 上传自定义背景 / 清除恢复默认 |
| 左立绘 | 显示/隐藏左侧角色立绘 |
| 右立绘 | 显示/隐藏右侧角色立绘 |
| Q版吉祥物 | 显示/隐藏 Q版 GIF 表情包 |

### 通用（亮暗两形态同时生效）

| 控件 | 范围 | 默认值 |
|---|---|---|
| 对话宽度 | 500–1000px | 780px |
| 立绘高度 | 30–80vh | 55vh |
| 立绘水平偏移 | −50–50px | 0px |
| 表情大小 | 60–240px | 120px |
| 表情竖直偏移 | −420–300px | 0px |
| 背景透明度 | 20–100% | 100% |
| 消息文本框 | 开/关 | 关 |
| 文本框透明度 | 20–100% | 68% |
| 泡泡粒子场 | 开/关 | 开 |
| 泡泡数量 | 5–40 | 20 |
| 泡泡速度 | 30–200% | 100% |
| 锁链边框 | 开/关 | 开 |
| 装饰条 | 开/关 | 开 |

点击「♻ 恢复默认设置」可一键还原所有选项。

## 兼容性

- DSH Web：0.1.0-rc.6 至 0.1.0-rc.8（dsh-web-frontend）
- 平台：Web
- 最近验证日期：2026-08-24

## 更新日志

### v0.0.5 — 2026-08-24

**新增与改进**
- 调色板默认折叠为 `🎨` 按钮，减少对侧栏空间的占用
- 扩大既有的 Q版达妮娅竖直偏移滑块范围至 −420–300px，便于适配不同窗口高度
- 新增「消息文字配色」开关，可分别应用亮色与暗色形态的消息文字配色规则
- 调色板设置改为保存至 DSH profile 的皮肤专属文件，不再依赖浏览器 origin；滑块、开关及亮色/暗色自定义背景图均可跨刷新、重启和站点存储清理恢复
- 自定义背景上传限制为 PNG、JPEG、WebP、GIF，浏览器端单张文件最大 5MB
- 支持 DSH Web 0.1.0-rc.8

**修复**
- 修正 DevTools 停靠状态检测：启动阶段不再误判为已打开；关闭 DevTools 后左右立绘和侧栏 Q版可靠恢复。保留打开 DevTools 时的淡出效果
- 修正侧栏 footer 的弹性布局；其他插件追加底部内容时，皮肤设置入口不会被挤出可视区域

### v0.0.4 — 2026-08-18

**新增**
- 打开 DevTools 控制台（停靠状态）时，左/右立绘和侧栏 Q版自动淡出至 20% 透明度，关闭后恢复
- 版本检查超时从 5s 增加到 15s，修复代理/VPN 用户因延迟导致更新提示不显示

### v0.0.3 — 2026-08-17

**修复**
- 侧边栏底部区域固定高度导致兼容性 bug：其他插件（如 API 余额显示）向 footer 添加内容时设置按钮被挤出画面。改为 `flex:0 0 auto` 自适应高度，保留 `min-height` 兜底

### v0.0.2 — 2026-08-17

**修复**
- 对话宽度滑块不生效：CSS 选择器改为匹配 DSH Web 真实 DOM（`_centerCol` / `_viewArea` / `_composerSeat`）
- 左侧立绘闪烁：移除 `getComputedStyle()` 强制样式重算，改用 `getBoundingClientRect()` 位置检测
- 刷新后 Q版不出现：添加 2 秒延迟重试，应对 DSH React 异步渲染时序

**新增**
- 右侧 workbench 面板打开时，左立绘和 Q版表情包自动淡出至 20% 透明度，关闭后恢复
- 调色板新增控件：表情大小（60–240px）、表情竖直偏移（−200–200px），亮暗双形态同时生效
- 调色板底部显示当前版本，自动检查 GitHub Release，有新版时提示更新
- README 兼容性声明、package.json `dsh.client.version` 字段

### v0.0.1

- 初始发布

## 致谢

| 来源 | 说明 |
|---|---|
| [maid-atelier](https://github.com/Small-tailqwq/dsh-deep-whale)（Small-tailqwq） | 皮肤工程结构思路：模块加载工厂模式、内联背景同步、侧边栏伪元素装饰、工作区树标记逻辑、固定层角色舞台架构 |
| [dsh-client-ui-skin-miku](https://github.com/linxin6666)（@linxin6666） | 玻璃卡片层级方式：`[id=root]` backdrop-filter + scrim 遮罩模式 |
| [dsh-web-ui](https://github.com/zhu1090093659/dsh-web-ui)（zhu1090093659） | 皮肤工程脚手架 |
| [@frewily](https://github.com/frewily) | 调色板默认折叠与 Q版竖直偏移范围优化 |
| [@1691695205](https://github.com/1691695205) | 消息文字配色开关及亮色/暗色消息配色规则 |

\*反馈问题尽可能在 issue 中发起。

## 许可

本仓库以 **CC BY-NC-SA 4.0**（署名-非商业性使用-相同方式共享）发布，禁止商业性使用。署名链见 `NOTICE`。

Character "Denia" (达妮娅) and "Wuthering Waves" (鸣潮) are trademarks of Kuro Games. This skin is a fan work and is not affiliated with or endorsed by Kuro Games.
