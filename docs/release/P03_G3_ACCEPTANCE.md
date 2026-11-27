# P03/G3 工程验收记录（Synthetic ETL Baseline）

> **验收日期**：2026-11-27 · **状态**：ENGINEERING PASS / synthetic-only  
> **警示**：P01/G1 仍为 **BLOCKED**；此记录不代表上海官方地图/数据权利已核准，也不代表 P03 已接入真实来源。

## 1. 实际验证证据

- [PR #8](https://github.com/1998x-stack/ShanghaiCiv/pull/8)：`feat/p03-offline-etl`
- [P03 GitHub Actions Run #45949933769](https://github.com/1998x-stack/ShanghaiCiv/actions/runs/45949933769)：**completed / success**
- [P02 回归 GitHub Actions Run #45949933784](https://github.com/1998x-stack/ShanghaiCiv/actions/runs/45949933784)：**completed / success**
- 测试代码 SHA：`ff1307bc87e7e88c0c952b4fa12d7edad61cb118`（后续仅文档变更不改变已测试的逻辑）。

实际通过步骤：
1. 安装 Python 3.11、Node 22 与 `requirements-test.txt`
2. `python scripts/validate_p01_research.py`
3. `python -m unittest discover -s tests -v`（包括新 P03 单测、P02 Schema 和双端 hex 合同）
4. `node --test tests/js/*.test.mjs`
5. `python -m pipeline list`
6. `python -m pipeline all --offline --workspace .p03-work`
7. `python -m pipeline check --workspace .p03-work`
8. 两次执行 `all --offline` 后逐个 JSON 文件计算 SHA-256，并以 `diff` 对比：**一致**
9. 公开数据阻断测试：`web/data/world.json` 与未审核的区级研究快照不存在；质量报告显示 `p01_g1_status=BLOCKED`、`public_map_release_approved=false`

## 2. P03-T01–T08 结果

| 编号 | 内容 | 验收 |
|---|---|---|
| P03-T01 | SourceInfo、Source.fetch/process | **PASS** |
| P03-T02 | Raw/Interim/Build Manifest：SHA256、来源、年份、许可、版本 | **PASS** |
| P03-T03 | 本地缓存、--force 修复、原子写入、HTTP fail-closed、基础重试 | **PASS**（真实 HTTP/断点续传未验证） |
| P03-T04 | 2024/2025 两个 synthetic Source adapters | **PASS**（不代表真实源接入） |
| P03-T05 | 统一 P02 bundle 与 dataset.schema.json、修订阶段字段 | **PASS**（复杂真实统计清洗未验证） |
| P03-T06 | 引用与 Hash 质量检查；工业差额保留说明 | **PASS**（真实工业范围未解） |
| P03-T07 | CLI list/fetch/process/build/check/all，依赖拓扑和离线重跑 | **PASS** |
| P03-T08 | Quality report、Python/Node/Schema 回归、GitHub CI | **PASS** |

## 3. 质量反例

- 损坏缓存或 JSON 后，hash 校验失败，构建不静默修复；
- 手动 `--force` 可从合法本地 fixture 恢复缓存；
- 未经批准的 source 不会被 HTTP fetch，即使传入 online；
- 含 URL query/token 的网络源在请求前被拒绝；
- 依赖 DAG 的循环、缺依赖、重复产物被拒绝；
- 产物仅在隔离的 `.p03-work/` 下生成，合成 release 始终不可发布；
- P02 验证继续拒绝区级观测伪装成六边形观测。

## 4. 下一步

**P04 可先实施 synthetic GIS 架构骨架**（投影接口、地理对象的元信息、edge-cell 与岛屿水体的合成测试），但实际上海区界和地图展示仍必须等待：
- [Issue #3：底图、区界授权和审图](https://github.com/1998x-stack/ShanghaiCiv/issues/3)
- [Issue #4：统计数据再利用和工业差额](https://github.com/1998x-stack/ShanghaiCiv/issues/4)
- [Issue #5：空间数据集 ID 与协议](https://github.com/1998x-stack/ShanghaiCiv/issues/5)

可以开始实做的其他无授权依赖工作：ETL 本地导入标准结构、可疑数据可视化、区域实体稳定 ID、差异报告。

**G3 结论**：可复现离线合成数据 ETL **ENGINEERING PASS**；真实上海数据适配、GIS/地图审图及公开发布仍 **BLOCKED**。
