# P08/G5b 合成专题与 Almanac 验收报告

> 验收日期：2026-11-27  
> 工程结果：**G5b SYNTHETIC THEMATIC ENGINEERING PASS**  
> 真实地理与数据发布门禁：**P01/G1 = BLOCKED**；本报告不授予真实上海地图/统计数据发布许可。

## 1. 实际运行证据

关联 [PR #14](https://github.com/1998x-stack/ShanghaiCiv/pull/14)。已验证的代码提交：`b341316c721542c828f7e8893cc0ec0206dfc370`。

| GitHub Actions | 运行记录 | 结果 |
|---|---|---|
| P08 Almanac 与真实 Chromium E2E | [#45954110235](https://github.com/1998x-stack/ShanghaiCiv/actions/runs/45954110235) | completed / success |
| P07 Canvas 浏览器 E2E | [#45954110209](https://github.com/1998x-stack/ShanghaiCiv/actions/runs/45954110209) | completed / success |
| P04 几何与地图合规回归 | [#45954110195](https://github.com/1998x-stack/ShanghaiCiv/actions/runs/45954110195) | completed / success |
| P03 可复现 ETL 回归 | [#45954110226](https://github.com/1998x-stack/ShanghaiCiv/actions/runs/45954110226) | completed / success |
| P02 JSON Schema/数据合同回归 | [#45954110194](https://github.com/1998x-stack/ShanghaiCiv/actions/runs/45954110194) | completed / success |

浏览器 E2E 实际运行 Playwright Chromium，包含 P07 原有拖拽缩放、键盘、移动端和数据加载失败处理，以及 P08 的双年度/双指标、来源追溯、年度切换、`null`/派生/估算、URL 刷新和移动端验证。Run #45954110235 上传了 `p08-synthetic-almanac-screenshots` 产物（桌面与移动端；CI artifact 有保留期）。

**重要过程修正**：
1. Almanac 内容增长曾使桌面 Canvas 被右栏撑到视窗外，改为固定视窗高度、独立侧栏滚动，P07 回归恢复正常。
2. 首次加载缺失专题图例刷新，已补 `refreshThematic()`，避免必须先手动切换数据层。
3. P02 合成统计地区名称与 P04 合成地理地区名称不同，通过统一稳定 ID 联结，并以地理场景名称作为地图和 Almanac 的统一显示名称。
4. Ubuntu 24.04 runner 的 `--with-deps` 曾被外部 APT 软件源 HTTP 403 中断，改为直接安装 Playwright Chromium，最终真实浏览器 E2E 全通过。

## 2. P08 工程验收

| 工作项 | 已落实证据 | 结果 |
|---|---|---|
| P08-T01 | `lensCatalog`、P02 数据 Schema/语义校验与原生 district 粒度 | PASS |
| P08-T02 | 2024/2025 完全虚构人口/密度专题数据；未开放真实区值 | PASS（synthetic） |
| P08-T03 | 区级整面 polygon 着色、缺失灰色样式、值与单位图例 | PASS |
| P08-T04 | 虚构区域对应人口/密度及可比情况下的合成跨年差异 | PASS |
| P08-T05 | Almanac 追溯 source_id、publisher、URL、year、unit、granularity、method_id、flags 与 license | PASS |
| P08-T06 | 点选格网→全部虚构区属→**完整区级统计**→来源；禁止区值分摊到单个 hex | PASS |
| P08-T07 | Python/Node 合同、真实 Chromium 桌面/移动端 E2E、缺失数据失败态 | PASS |
| P08-T08 | 合成 release 不可公开提升，真实行政数据/地图仍 BLOCKED | PASS（技术保护，不等于法律审查） |

## 3. 统计语义与安全限制

- 数值均为**人工虚构**，2024 区甲“人口 100,000”、2025“人口 110,000”仅是测试用的 10% 变动演示，**不能**作为上海现实变化结论。
- 2025 虚构区乙人口、密度均为 `null`，不显示假零、假排名或错误差分。
- 2024 虚构园区工业指数标记 `estimated`、`modeled` 与 `synthetic_estimation`，不得误认为 district 或 hex 实测。
- 任何 Lens 的空间粒度必须是 district；Canvas 仅对**整个虚构行政多边形**做区级着色，交集比例只用于说明 cell 的区属关系。
- 来源 `https://example.invalid/synthetic` 是明确不可访问的测试占位，不能描述为官方真实下载入口。
- 没有引入天地图瓦片、上海16区真实几何、真实人口/GDP、地图审图号或 GitHub Pages 生产部署。

## 4. 真实上海数据与地图发布的未完成工作

- [Issue #3](https://github.com/1998x-stack/ShanghaiCiv/issues/3)：合法地图边界、底图服务 SDK 及公开地图审图路径；
- [Issue #4](https://github.com/1998x-stack/ShanghaiCiv/issues/4)：统计数据的再利用与工业总量对账；
- [Issue #5](https://github.com/1998x-stack/ShanghaiCiv/issues/5)：公园、轨交等 POI 数据集 ID 和开放协议。

**G5b 结论**：P08 合成数据专题和 Almanac UI 已具备工程质量，可用于继续开发 P09 美术与示范区合成原型；真实上海地理与区级数据的对公网发布仍不可启用。
