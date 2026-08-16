# 达妮娅 · 虚无之泡 (Denia · Void Bubble)

《鸣潮》达妮娅主题 DeepSeek Harness 皮肤。

## 致谢

- 皮肤工程结构（构建预设、皮肤脚手架、布局/动画工程）源自 dsh-deep-whale 的 **maid-atelier**（作者 [Small-tailqwq](https://github.com/Small-tailqwq)）
- 玻璃卡片层级（`[id=root]` backdrop-filter + scrim）参考 **dsh-client-ui-skin-miku**（作者 [@linxin6666](https://github.com/linxin6666)）
- 背景 / 角色 / 画框素材来自用户本地素材（详见 NOTICE）
- 本皮肤以 CC BY-NC-SA 4.0 发布，禁止任何商业性使用。见 LICENSE 与 NOTICE。

## 安装

将本包放入 DSH 的 `profiles/web/node_modules/@dsh-external/` 目录下，然后在 `cordis.patch.yml` 中添加：

```yaml
- id: ui-skin-denia
  disabled: false
```

重启 DSH 后在设置 → 皮肤中选择"达妮娅 · 虚无之泡"。

## 特性

- 双形态切换：布景之形（亮色）/ 幻灭之形（暗色），含形态切换动画
- 左右全身立绘 + Q版动态 GIF 吉祥物
- 玻璃卡片层级（root 半透明 + backdrop-filter）
- 泡泡粒子场（双层虹彩气泡）
- 锁链边框（深紫锁链，跟随侧栏宽度）
- 渐变文字（工作区/会话标题）
- 装饰条（顶/底彩虹渐变）
- 四角星坠饰（侧边栏四角）
- 深色/浅色按钮文字替换（布景之形 / 幻灭之形）
- 新会话欢迎界面注入
- 侧栏收起/展开自适应布局（立绘 + Q版 + 文字居中）
- 黑白娅分别背景图

## 作者

Ewnscat

## 许可

CC-BY-NC-SA-4.0
