# P04/G4 合成 GIS 工程验收记录

> **验收日期**：2026-11-27 · **结论**：**G4 SYNTHETIC ENGINEERING PASS**  
> **独立门禁**：**P01/G1 真实地图数据许可与地图发布审核仍为 BLOCKED**。本报告不是16区真实 GIS 已完成的声明。

## 1. 已通过的 GitHub Actions 证据

- [PR #10](https://github.com/1998x-stack/ShanghaiCiv/pull/10)：`feat/p04-synthetic-gis`
- [P04 Run #45951267494](https://github.com/1998x-stack/ShanghaiCiv/actions/runs/45951267494) → `gis-synthetic-only`：**completed / success**
- [P03 回归 Run #45951267563](https://github.com/1998x-stack/ShanghaiCiv/actions/runs/45951267563) → `offline-etl`：**completed / success**
- [P02 回归 Run #45951267798](https://github.com/1998x-stack/ShanghaiCiv/actions/runs/45951267798) → `semantic-and-schema`：**completed / success**

通过步骤包括：Python 单测、P02/P03 历史测试回归、Node 测试、`python -m pipeline spatial`、`spatial-check`、`spatial-benchmark`、两次输出文件的逐项 SHA-256 一致性比对，以及公开地图文件不存在的门禁。

## 2. 已落地范围

| 验收项 | 证据 | 状态 |
|---|---|---|
| 合成投影与坐标 | `SyntheticLocalProjection`，实际 CRS 直接拒绝 | PASS |
| 多边形与洞 | Polygon/MultiPolygon、shell-hole 面积、边界点击 | PASS |
| 六边形叠合 | 与凸 hex 求交面积、按 cell 归属覆盖率 | PASS |
| 水域及离岛 | 2 个虚构区、河道、带岛屿孔洞的海域 | PASS |
| 交叉覆盖 | 同一格陆/水/未分类占比及行政区合计约束 | PASS |
| 双语言网格一致性 | JS/Python 顶点顺序、视窗查询 | PASS |
| 空间合同 | P02 world Schema + P04 coverage Schema | PASS |
| 防篡改 | 哈希及覆盖率/归属 cross-check，拒绝伪造空间比例 | PASS |
| 复现性 | 同一 fixture 两次构建字节一致 | PASS |
| 网格半径 | 0.5/1/2 km 合成范围基准 | PASS |
| 许可发布隔离 | `public_map_release_approved=false`，未写入 web/data | PASS |

### 数据约束

- 当前 fixture 中 **56 个** 0.5 km 半径合成六边形；这个数字不代表上海实际地图格数。
- 研究数据在 `data/research/`，没有写入 P04 的 GIS 构建器，也没有任何区级人口/GDP → hex 的事实伪装。
- 真正上海区界、崇明等岛屿、水域、正式 CRS、合法底图 SDK 等**没有取得/没有验证**。

## 3. 未解决问题及其阻塞状态

- **Issue #3**：官方地图几何、SDK 叠加与公开地图审核：**BLOCKED**。
- **Issue #4**：统计数据再利用和工业数据对账：**BLOCKED**。
- **Issue #5**：开放平台具体 POI/交通数据及协议：**FOLLOW-UP**。
- 本纯 Python 面积裁剪要求输入是简单、合法、无自相交/嵌套错误的多边形；真实地理边界仍应使用**权利合规、拓扑可检验**的成熟 GIS 库验证。
- 正式上海 CRS 和地图服务的 GCJ-02/CGCS2000/WGS84 处理必须在服务商授权及权威参考点核对后独立实现，不可以把 synthetic affine offset 当作真实坐标变换。

## 4. 后续任务衔接

- GIS 真实区界和地图合规审查通过后，基于 P04 建立生产地理数据版本、离岛和河道准确性 QA、边界覆盖率误差审核；
- 在此之前可以先做 **P07 的 synthetic Canvas 地图原型**，展示格网、陆水/区属覆盖与交互逻辑，但必须显著标注“虚构测试地图，非真实上海地图”，不得公开发布为上海地图；
- P05 交通/地表实际数据同样取决于逐数据集授权状态。

**终结结论**：合成 GIS 引擎可以进入后续工程原型阶段；真实地理内容与对公众发布的合规门禁仍未开放。
