# ShanghaiCiv P09 / G5c — 合成地图美术工程验收

> 日期：2026-11-27 · 工程结论：**SYNTHETIC ART ENGINEERING PASS**  
> 合规状态：**真实上海地图及公开地图发布 G1/G6 = BLOCKED**。本报告不声称已经取得真实上海行政区/设施数据许可、不声称真实四区域地图已经交付。

## 实际 CI 验证

| 检查 | GitHub Actions Run | 结果 |
|---|---|---|
| P09 程序化美术与真实 Chromium E2E | [#45958368284](https://github.com/1998x-stack/ShanghaiCiv/actions/runs/45958368284) | completed / success |
| P08 区级专题和 Almanac Chromium E2E | [#45958368201](https://github.com/1998x-stack/ShanghaiCiv/actions/runs/45958368201) | completed / success |
| P07 地图交互 Chromium E2E | [#45958368162](https://github.com/1998x-stack/ShanghaiCiv/actions/runs/45958368162) | completed / success |
| P04 GIS 空间数据/许可门禁 | [#45958368183](https://github.com/1998x-stack/ShanghaiCiv/actions/runs/45958368183) | completed / success |
| P03 数据流水线与双次重建 | [#45958368308](https://github.com/1998x-stack/ShanghaiCiv/actions/runs/45958368308) | completed / success |
| P02 数据合同及六边形契约 | [#45958368240](https://github.com/1998x-stack/ShanghaiCiv/actions/runs/45958368240) | completed / success |

通过的功能代码基线 commit：`edc8fe424107f6df41cb2bb9086ed948f52954e4`。后续文档 Markdown 修正不改变 Canvas 模块功能，但以最终提交 CI 为正式合并准入条件。

P09 workflow 的 GitHub Actions artifacts：**`p09-synthetic-art-visual-evidence`**（631,357 字节，验收时尚未过期）。包括四级画廊、桌面地图与移动端地图的 Chromium 截图。此附件可能随 GitHub Actions 保留期过期。

## T01–T08 质量追踪

| 工作包 | 具体实现或检查 | 合成基线 |
|---|---|---|
| T01 原创样式 token | 自有 Canvas 画线与色彩，无付费素材/地图瓦片 | PASS |
| T02 四级 LOD | Overview/Regional/Local/Detail、阈值与独立 `art.html` | PASS |
| T03 确定性造型 | seed+cell+LOD 生成固定树、屋顶、水纹；重复绘制像素一致 | PASS |
| T04 缓存 | 160 项上限 LRU 描述符、命中/未命中/淘汰统计 | PASS |
| T05 视觉层次 | P08 整体区级专题填色保持；装饰不制造格网统计值 | PASS |
| T06 视窗/标签 | `visibleCells` 裁剪、优先级碰撞测试、250k 候选网格视窗单测 | PASS |
| T07 四类示范占位 | 纯虚构金融/科技/交通/制造坐标与警示，不是现实园区 | PASS（synthetic） |
| T08 测试与审计 | Node/Chromium 画廊、URL、移动端、旧 P07/P08 E2E | PASS |

## 无法由本次验收推出的结论

1. **不代表** 250k 全图渲染已达到 45 FPS/30 FPS、低端设备功耗或内存已达生产标准。当前大型格网仅完成视窗筛选算法测试。
2. 四个功能示范的真实区域——陆家嘴、张江、虹桥、临港——**未**引入任何真实坐标、边界或经济指标；单元测试纯为合成 UI。
3. 不表示已具备对真实地图公开发布的资质。行政区几何来源、地图服务授权与可能的地图审核必须由 [#3](https://github.com/1998x-stack/ShanghaiCiv/issues/3) 进一步核实；统计再利用 [#4](https://github.com/1998x-stack/ShanghaiCiv/issues/4)、POI 数据 [#5](https://github.com/1998x-stack/ShanghaiCiv/issues/5) 仍独立审查。
4. Browser E2E 主要覆盖 Chromium 桌面和触控仿真移动端，尚无 Safari/Firefox 和真实 Android/iOS 性能矩阵。

## 结论与下一步

可将 **P09/G5c「合成地图原创美术工程」标记为通过**，后续 P10 可以基于 P08/P09 的 synthetic-only 合同开发 Explorer 区域指标对比，不得用未批准的真实上海数据或地图图层替换。完整设计与运行参见 [ART_P09](../ART_P09.md) 和 [STYLE_GUIDE](../STYLE_GUIDE.md)。