# P02/G2 工程验收记录（Synthetic Contract Baseline）

> **日期**：2026-11-27 · **范围**：仅 P02 合成数据合同与算法 · **判定**：**G2 ENGINEERING PASS（synthetic-only）**  
> **强制独立门禁**：P01/G1 **BLOCKED**；真实地图几何授权及公开发布审核未完成。P02 工程通过**不表示**真实上海地图可以上线。

## 1. GitHub 可核验证据

- [PR #6](https://github.com/1998x-stack/ShanghaiCiv/pull/6)：`feat/p02-data-contracts`，基于 P01 研究分支（stacked PR）
- [GitHub Actions Run #45947693507](https://github.com/1998x-stack/ShanghaiCiv/actions/runs/45947693507)
- Workflow：`P02 contract and synthetic GIS checks`
- Job：`semantic-and-schema` — **conclusion: success**（通过 GitHub 工作流任务/步骤状态读取，非凭空宣称）
- 已完成的步骤：
  1. `python -m pip install -r requirements-test.txt`
  2. `python scripts/validate_p01_research.py` + `python -m scripts.validate_p02_contracts`
  3. `node scripts/validate_p02_contracts.mjs`
  4. `python -m unittest discover -s tests -v`
  5. `node --test tests/js/*.test.mjs`
  6. 发布保护：不存在 `web/data/world.json` 或未审核研究数据生产复制

## 2. P02-T01～T08 逐项验收

| Task | 交付证据 | 结果 |
|---|---|---|
| P02-T01 领域主实体 | `docs/DATA_CONTRACTS.md` 的 ID/关系定义、region/source/metric/release/lens/world | PASS（dataset 独立注册表留 P03） |
| P02-T02 统计语义 | Python/JS 验证：status、source、period、spatial granularity | PASS |
| P02-T03 坐标与覆盖规则 | 合成米制投影说明、odd-r 半径/邻接、partial memberships 与占比检查 | PASS（真实 CRS 仍待 P04） |
| P02-T04 规范化、空值、版本 | 2024/2025 fixtures、value null、release/schema version | PASS |
| P02-T05 Schema | 7 个 JSON Schema 2020-12，交叉引用结构经 tests 测试 | PASS |
| P02-T06 游戏化 | `docs/METRIC_METHODS.md`：代理规则及禁用条件；无真实游戏分数 | PASS（规则设计） |
| P02-T07 2合成样本 | `synthetic_2024.json`、`synthetic_2025.json` | PASS |
| P02-T08 双端验收 | Python/Node 反例、对等错误码和六边形一致性测试 | PASS |

## 3. 反例与数据安全

- 测试拒绝 `METRIC_SOURCE_REF`、`METRIC_PERIOD`、`METRIC_STATUS_VALUE`、`METRIC_NATIVE_GRANULARITY`、`METRIC_HEX_OBSERVATION`、`METRIC_DERIVATION`、`METRIC_ESTIMATE_FLAG`、`MEMBERSHIP_SUM`；
- 合成数据标记 `synthetic=true` 与 `publish_approved=false`，提升为生产发布将被拒绝；
- 同名园区拥有不同稳定 ID，不因同名发生实体覆盖；
- 人口/GDP 等统计口径**不能**凭六边形形状被自动拆分为格网实测；
- 未加入真实上海区界、瓦片、POI、交通设施、在线地图请求或生产地图构建产物。

## 4. 已知限制和下一阶段

1. **P01/G1 BLOCKED**：GIS 数据/底图在线叠加、地图审核与来源再分发仍需外部确认；见 Issues [#3](https://github.com/1998x-stack/ShanghaiCiv/issues/3)、[#4](https://github.com/1998x-stack/ShanghaiCiv/issues/4)、[#5](https://github.com/1998x-stack/ShanghaiCiv/issues/5)。
2. P02 为全包测试用 bundle；正式数据源 `dataset` 独立注册表、`revision_stage`、精确许可引用、ETL 需要在 P03 按 Schema 版本演进。
3. Python/JS 合同 validator 是显式语义约束；正式生产仍需完整 JSON Schema 检验、数据质量报告及人工审核。
4. 不能把 CI 成功当作真实数据真实性或地图合法发布证明。
5. 后续进入 P03，应先在不联网、无需真实地理数据的条件下开发可重复的 Source/Builder DAG、manifest、原子 JSON、校验命令；真实统计下载/再分发须等待对应许可审查通过。

**阶段结论：** P02 合成合同与双端空间网格工程基线通过验收，可进行不涉及真实地理素材的 P03 工程准备。