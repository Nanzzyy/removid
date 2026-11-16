---
videomd: 1
part: timeline
shots: 3
tokens: 255
---

# 时间线

每行一个镜头：`#编号 起-止(秒) | 键 值 | …`。键后带 `~` 的是工具推断，不带的是画面里看得到或直接测得的。
`story` 在叙事里的作用和讲的点 · `seen` 画面里看到的 · `act` 表演（情绪、强度、表情）· `camera` 运镜 · `overlay` 叠加层 · `made~` 制作方式（推断）· `material~` 素材来源（推断）· `remake` 复刻路线 · `flag` 需要复核
某一镜的全部细节在 `video/shots/编号.md`（如 `video/shots/07.md`）。

```videomd-timeline
#01 0.0-3.0 | camera 固定（主体在动） | made~ 代码/模板渲染 84% · 次选 3D 渲染 9% | material~ 制作方渲染 | remake 代码渲染 · 段1
#02 3.0-6.0 | camera — | made~ 代码/模板渲染 86% · 次选 屏幕录制/截图 9% | material~ 制作方渲染 | remake 代码渲染 · 段1
#03 6.0-9.0 | camera 平滑运镜 | made~ 代码/模板渲染 63% · 次选 3D 渲染 23% | material~ 制作方渲染 | remake 代码渲染 · 段1
```
