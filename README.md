# ShanghaiCiv

> **上海真实数据驱动的《文明》风格交互地图**｜需求与工程规划阶段 · 2026-11-27

ShanghaiCiv 拟以真实地理、上海 16 区人口与经济、产业、交通和公共设施等可追溯数据构建交互式城市知识地图，参考 [Karpathy USACIV](https://karpathy.ai/usaciv/) 的结构化数据流水线、六边形格网、程序化渲染和 Almanac 来源系统。

**当前进度：** 已制定 PRD 与分阶段 WBS，**尚未**完成数据授权、官方地图展示/审核合规确认，亦未开始产品代码实现。以下计划任务不能被视为完成的工程交付。

## P01 实际调查结果（2026-11-27）

- [P01 可行性报告](docs/research/FEASIBILITY_REPORT.md) — 官方年鉴4张区级数据表、16区编码、2024统计口径和质量异常。
- [16区2024统计研究数据](data/research/districts_2024_observations.json) — 16区 × 8项数值指标；**仅研究用途，不能自动公开到web/data**。
- [数据源注册](data/catalog/sources.yml) / [指标字典](data/catalog/metrics.yml) / [自动数据检查](scripts/validate_p01_research.py)。
- [地图与发布合规检查](docs/compliance/MAP_PUBLICATION_CHECKLIST.md) — **G1=BLOCKED**，几何数据/SDK权限及地图审核路径尚待正式确认。

剩余外部事项：[#3 地图使用与审核](https://github.com/1998x-stack/ShanghaiCiv/issues/3) · [#4 统计使用许可与工业差额](https://github.com/1998x-stack/ShanghaiCiv/issues/4) · [#5 公共开放平台具体POI数据](https://github.com/1998x-stack/ShanghaiCiv/issues/5)。

## 📚 文档导航

| 文档 | 内容 | 用途 |
|---|---|---|
| [产品需求文档 PRD](docs/PRD.md) | 目标用户、场景、FR 功能矩阵、范围、非目标、指标、风险与发布规则 | **先读** |
| [分阶段实施计划 WBS](docs/IMPLEMENTATION_PLAN.md) | **P00–P12 / 13 阶段**，每阶段任务 ID、依赖、实施步骤、预计文件、验收条件和阻塞 | 执行主线 |
| [数据来源与许可台账](docs/DATA_CATALOG.md) | 官方候选源、字段与空间粒度、许可状态、16区核对表 | P01 前置 |
| [架构与数据合同草案](docs/ARCHITECTURE.md) | GIS、格网、ETL、Canvas、浏览器 API、JSON 结构、CI | P02/P04 实现参考 |
| [验收与 QA 矩阵](docs/ACCEPTANCE.md) | FR→Test 追溯、数据检查、E2E、性能与公开发布门禁 | QA |
| [产品与架构决策记录](docs/DECISIONS.md) | 关键未决问题、责任人、关闭证据和替代方案 | 决策治理 |
| [Agent 工程约束](AGENTS.md) | Coding Agent 的数据真实性、许可证、合规与 PR 纪律 | 每次动手前阅读 |

## 路线图

```text
P00 工程初始化
  └─ P01 数据/授权与地图合规调查 [G1]
      └─ P02 数据模型与合同 [G2]
          ├─ P03 ETL 与来源适配 [G3] ──┬─ P06 人口/经济构建
          └─ P04 GIS / 16区 / 1km 格网 [G4] ├─ P05 地形/设施
                                         └─ P07 Canvas 地图 [G5]
                                               └─ P08 专题图+Almanac
                                                   ├─ P09 美术/四示范区域
                                                   └─ P10 Explorer
                                                       └─ P11 QA/合规发布 [G6]
                                                           └─ P12 V2 增量更新
```

**MVP**：16 区、地图交互、官方数据面板、至少 4 个可用且符合许可的专题、数据溯源、分享/比较。特殊美术、模拟机制和街镇粒度需要单独验证资源与可行性。

## 重要工程原则

1. **可信数据高于视觉**：不能把区级 GDP/人口直接拆到六边形当成真实值，空值必须为 null。
2. **空间边界合法**：底图服务条款、地理信息/行政区界来源、地图审核与审图号等适用要求必须经核验。
3. **从静态数据起步**：Source→Interim→Builder→校验→Web JSON→Canvas，减少前端复杂计算。
4. **每阶段都有验收门禁**：没有真实执行证据不能宣称 PASS；未知许可不能公开地图数据。
5. **以 PR 推进**：优先完成 P01 的真实性与许可验证，再开发真实地图。

## 第一批官方入口

- [上海统计年鉴 2025](https://tjj.sh.gov.cn/tjnj/tjnj2025.htm)（不同表格应逐项记录其统计年度）
- [2025 年上海统计公报](https://tjj.sh.gov.cn/tjgb/20260330/e0772941e8e041eaaad2df850b44ef98.html)（市级公报，2026-03-30 发布）
- [上海公共数据开放平台](https://data.sh.gov.cn/)
- [天地图·上海](https://shanghai.tianditu.gov.cn/)

## 许可证与公开发布

项目自身代码与文档的最终许可证尚待确认；USACIV 的 MIT 代码许可不意味着其全部数据/图片/第三方权利自动适用于 ShanghaiCiv。第三方数据只能在许可允许的范围内使用/发布，公开地图须另行通过适用的地图管理审核与标示检查。
