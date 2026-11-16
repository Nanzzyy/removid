---
videomd: 1
name: ref
description: 制作方式（推断）：代码/模板渲染 100%
source:
  file: ref.mp4
  sha256: ae4f402198fd84e71873915b8c2c9347540673ecec80e807ac37e546c57b8645
  duration: 9.0
  size: 640x360
  fps: 30.0
  aspect: '16:9'
shots: 3
lang: zh
made_mix:
  code_render: 1.0
confidence: 0.777
readers:
- tools
open_questions: 2
generator:
  name: rea-video
  version: 0.1.0
---

# ref.mp4

**结论**（推断）：代码/模板渲染 100%
**制作方式**（推断，按时长）：代码/模板渲染 100%
**复刻**：代码渲染/录屏 3 镜 → 1 个代码工程

## 下一步

- 没开 VLM：能看图就先复核，`rea-video review <本目录>` → 填 `review_answers.json` → `rea-video apply-review <本目录>`
- 复刻：`rea-video remake <本目录>`，能自动做的先做掉，其余原片占位；`remake/status.md` 逐镜写了还要做什么。拿到新镜头写进 `remake/mine.json` 再跑一次
- 代码渲染镜头由 `rea-video code-remake <本目录>` 重画（上一条会自动跑）：改 `code/spec.json` 再跑，不要从零写

## 不确定点

- VLM 没有生效（未开 VLM；实拍/AI/3D 的区分只靠像素统计，可信度有限。能看图的 agent：运行 rea-video review 逐镜看图并 apply-review 并入；否则建议配置 VLM（任意 OpenAI 兼容的多模态模型，如 Gemini / GPT-4o / 豆包 / Qwen-VL）：设置…
- 声音没有 AI 听过：人声是真人还是 TTS 是按波形推断的；音效是从混音里按突然变响的点找的，人声的爆破音、配乐的鼓点也可能被算进去。可以在「声音」里试听分轨和每处音效核对

## 地图

先读本页；要细节时只打开需要的文件。每行是 `路径 | 约 token | 里面有什么 · 什么时候读`，路径相对本目录。

```videomd-map
video/timeline.md | 270 | 时间线：一行一个镜头 · 想知道某段讲什么、哪镜要复核、某镜怎么做
video/content.md | 72 | 内容与结构 · 要讲什么、叙事线、结构时间轴、台词
video/cast.md | 31 | 角色、场景与道具 · 做角色参考图、写首帧提示词
video/sound.md | 130 | 声音 · 人声、BGM、音效、节拍和来源
video/look.md | 115 | 拍法、打光与剪辑 · 有实拍镜头时：景别、机位、布光、器材
video/remake.md | 1723 | 复刻方案 · 生成单元、拍摄场次、代码合成、要准备的真实素材、表演与情绪
video/shots/*.md | 332 | 逐镜细节，token 是每个文件的平均值 · 核实某一镜：看得到的、推断和依据、提示词、帧图
breakdown.json | 8561 | 完整原始数据 · 程序读取；模型一般不用打开
shots/ | - | 每镜的联系表和首尾帧 · 看图核实
storyboard.jpg | - | 全片故事板 · 一眼看全片
frames/ | - | 画面场景：每场景原尺寸帧、画上去那一层的抠图和采样点、测量值 · 复刻代码渲染画面
audio.png | - | 声音波形和节拍图 · 看节奏
```

## 读法

- 每行一个镜头：`#编号 起-止(秒) | 键 值 | …`。键后带 `~` 的是工具推断，不带的是画面里看得到或直接测得的。
- `story` 在叙事里的作用和讲的点 · `seen` 画面里看到的 · `act` 表演（情绪、强度、表情）· `camera` 运镜 · `overlay` 叠加层 · `made~` 制作方式（推断）· `material~` 素材来源（推断）· `remake` 复刻路线 · `flag` 需要复核
- 某一镜的全部细节在 `video/shots/编号.md`（如 `video/shots/07.md`）。
- 「看到的」可以对着截图核实；「推断」是工具和看图模型的判断，依据写在每镜文件的「判断依据」里，两者对不上时以截图为准。
