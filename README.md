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

**P03 工程验收记录**：[G3 验收报告](docs/release/P03_G3_ACCEPTANCE.md)，[GitHub Actions #45949933769](https://github.com/1998x-stack/ShanghaiCiv/actions/runs/45949933769) 已通过。范围仅合成数据离线 ETL，真实 GIS 和地图发布仍阻塞。

## P07 交互式 Canvas 合成地图（已通过合成工程验收）

- **本地演示**：在仓库根目录运行 `python -m http.server 8765 --bind 127.0.0.1`，打开 http://127.0.0.1:8765/web/dev/synthetic-map.html 。
- [P07 浏览器架构与验收说明](docs/WEB_P07.md) · [HTML 交互原型](web/dev/synthetic-map.html) · [真实浏览器 E2E](tests/js/synthetic-map.e2e.mjs)。
- 支持 56 个**完全虚构**的几何格网、陆/水体显示、点选、拖动缩放、移动端触摸和 URL 状态恢复；不代表上海真实地图。
- 真实行政区、底图 SDK 和公开审图仍 [BLOCKED](https://github.com/1998x-stack/ShanghaiCiv/issues/3)，不会自动发布 GitHub Pages。

## P04 空间叠合与合成 GIS（工程验收通过）

- [GIS 技术说明与限制](docs/GIS_P04.md) · [Python 几何库](pipeline/core/geo.py) · [空间构建器](pipeline/build/spatial.py)
- 全部使用**虚构区界、虚构河道/海域/离岛**，不是上海现实地图；输出只写入 `.p04-work/`。
- 运行：`python -m pipeline spatial --workspace .p04-work`；验收：`python -m pipeline spatial-check --workspace .p04-work`。
- Python/JavaScript 同步提供六边形顶点、视窗裁剪；行政区覆盖率按面积计算，不把区级统计分配成虚假的网格实测。
- 对外地图许可、真实 CRS 与行政区矢量数据仍然**阻塞**，见 [Issue #3](https://github.com/1998x-stack/ShanghaiCiv/issues/3)。

## P03 离线数据流水线## P03 离线数据流水线（合成源工程基线）

- [P03 流水线设计与运行](docs/ETL_PIPELINE.md) · [合成数据质量检查](pipeline/check.py) · [Source 接口](pipeline/core/source.py) · [Builder DAG](pipeline/build/graph.py)
- 离线完整构建：`python -m pipeline all --offline --workspace .p03-work`
- 质量报告：`.p03-work/reports/p03_quality.json`（本地生成，不作为公开地图数据）
- 数据版本与许可：每阶段保留 SHA256 来源链；未知许可来源和未经核验的真实地图资产不能进入公开页面。
- 依赖跟踪：[Issue #7](https://github.com/1998x-stack/ShanghaiCiv/issues/7)。**G1 真实数据与地图公开许可仍为 BLOCKED。**

## P02 数据合同与合成空间引擎（阶段进行中）

- [合同 v1 与统计口径规则](docs/DATA_CONTRACTS.md) · [游戏化指标方法（未启用）](docs/METRIC_METHODS.md)
- [JSON Schemas](schemas/bundle.schema.json) · [Python 跨记录验证器](pipeline/contracts.py) · [JavaScript 验证器](web/js/contracts.mjs)
- [Python 六边形算法](pipeline/core/hexgrid.py) · [JavaScript 镜像](web/js/hex.mjs)
- [2024 虚构样本](tests/fixtures/synthetic/synthetic_2024.json) · [2025 虚构样本](tests/fixtures/synthetic/synthetic_2025.json)
- 验证命令：`python -m scripts.validate_p02_contracts && python -m unittest discover -s tests -v && node --test tests/js/*.test.mjs`

**P02 不包含真实上海行政边界或地图发布**：P01 的 G1 授权门禁仍处于 BLOCKED；测试用 5×4 虚构格网不对应现实坐标。

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
