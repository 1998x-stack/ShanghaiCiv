# ShanghaiCiv P04｜地理空间引擎（合成几何基线）

> **状态**：算法工程实现；真实上海行政区 GIS 仍未授权、未验收 · 2026-11-27  
> **来源**：全部为人工设计的虚构几何，**绝不代表真实上海行政区、黄浦江、岛屿或海岸线**。  
> 依赖：[数据合同](DATA_CONTRACTS.md) · [地图准入清单](compliance/MAP_PUBLICATION_CHECKLIST.md) · [任务 Issue #9](https://github.com/1998x-stack/ShanghaiCiv/issues/9)。

## 1. 要解决的问题

P02 已建立 1 km 半径候选的 `odd-r` 六边形编号与坐标反查，但尚不具备将行政多边形映射到格网、处理一个格子跨多个行政区或跨水陆边界的能力。P04 在不获取真实上海几何的前提下完成地理算法：

- 平面坐标契约、投影适配接口和显式未实现的真实 CRS 转换门禁；
- 具有外环/内洞的 Polygon、MultiPolygon 面积与相交计算；
- 六边形多边形的求交面积、归属覆盖比例（而非仅凭中心点推断边界）；
- 离岛、河流、海域的陆水覆盖、外部/未知空间以及混合边界单元标记；
- Python 与 JS 网格顶点、视窗索引的一致性；
- 500/1000/2000 m 半径的**合成场景**格子数量候选比较；
- 保持真实地图及发布权限 BLOCKED。

## 2. 技术模块

| 路径 | 职责 |
|---|---|
| `pipeline/core/geo.py` | `SyntheticLocalProjection`、ring、shoelace area、Sutherland–Hodgman 裁剪、Polygon/MultiPolygon holes、点边界/内外判断 |
| `pipeline/core/hexgrid.py` | 点顶 hex 的顶点、矩形范围及 conservative viewport culling |
| `web/js/hex.mjs` | 对应 JS 顶点与视窗索引；测试跨语言坐标/顺序一致 |
| `pipeline/build/spatial.py` | 合成场景叠合、按 cell 的 district coverage 与陆水比例、质量报告、版本化 SHA-256 |
| `tests/fixtures/synthetic/synthetic_gis_scene.json` | 两个虚构区（其中一个含离岛）、虚构河道、海域及离岛洞 |
| `tests/test_spatial.py` / `tests/js/spatial.test.mjs` | 面积、孔洞、混合地格、岛屿、投影/坐标、错位/篡改拒绝与 Python↔JS |

**输出目录只有本地工作目录** `.p04-work/spatial/` 和 `.p04-work/reports/`；不向 `web/data/` 写入地理数据。

## 3. 几何语义

**坐标**：统一局部平面米制，`x` 向右、`y` 向下。样本标记为 `SYNTHETIC_LOCAL_METERS`，此名称并非 EPSG 代码；传入真实投影如 EPSG:4326 会被拒绝而非错误执行线性变换。后续正式 CRS 由具有专业资格/职责的 GIS 人员根据合法数据服务确定、实现并核验。

**六边形**：点顶 `odd-r`，R=500 m 作为合成测试默认值；R=1 km 是 P02 的候选基线，不是已经批准的上海真实分辨率。面积公式：

```text
hex_area = 3 * sqrt(3) * R^2 / 2
```

**Polygon/MultiPolygon**：使用 GeoJSON 的 `type/coordinates` 表达简单面，可有内洞与互不重叠的多个外壳。Sutherland–Hodgman 将原面边界裁剪至凸六边形，再计算 `sum(shell) - sum(holes)` 的交集面积。输入须事先为**有效简单多边形**：不含自相交、外部洞、互叠的不同壳。该纯 Python 几何实现用于合成算法验证；不能取代真实生产所需的拓扑校验和鲁棒 GIS 引擎。

**行政区叠合**：`membership_fraction = polygon_intersection_area / hex_area`，若同一格覆盖甲区、乙区、河道，分别保留其真实几何覆盖比例；合计超过 100%（加容差）直接 FAIL，不能通过重分配或归一化掩盖重叠边界错误。

**水体/陆地/其他**：水/陆量化为 0～1 的面积占比；完整覆盖需要陆、水与未分类之和约等于 1；虚构海水多边形具有匹配离岛的孔洞，避免海水和岛屿同时占据一个几何面积。未分类空间不能凭猜测当作水域。全图与现实的土地面积一致性需要真实合法边界来源后才能测量。

**重要**：格网只负责几何索引、渲染和交互。人口、GDP、工业、服务业仍在真实原始统计单元（市或区）上保存；不能通过 `membership_fraction` 自动计算「1 km 单元实际 GDP」。

## 4. 测试场景及预期

```text
         虚构甲区       (虚构河道)      虚构乙区
     ┌─────────────┐   │水│   ┌────────────────┐
     │             │   │ │   │                │
     │             │   │ │   │                │
     └─────────────┘   └─┘   └────────────────┘
     ~~~~~~~~~~~~~~~~~虚构海域~~~~~~~~~~~~~~~~~~
                         [虚构乙区离岛]
     ~~~~~~~~~~~~~~~~~虚构海域~~~~~~~~~~~~~~~~~~
```

- 甲区：3800 × 3700 = **14,060,000 m²**
- 乙区主区域：4300 × 3700 = **15,910,000 m²**
- 乙区离岛：650 × 650 = **422,500 m²**
- 河道：200 × 3700 = **740,000 m²**
- 海域：9000 × 2200 − 422,500 = **19,377,500 m²**
- 格网：8 × 7 = **56 个合成六边形**；R=500 m，均以米计。
- 验证区/水/未分类比例、离岛位于多边形内洞，边界点击具有 `inside/boundary/outside` 三态。

数值与形状**全部是人为构造的测试数据**，不能从这些面积推断上海地理。

## 5. 执行命令

```bash
python -m pipeline spatial --workspace .p04-work
python -m pipeline spatial-check --workspace .p04-work
python -m pipeline spatial-benchmark --workspace .p04-work
python -m unittest discover -s tests -v
node --test tests/js/*.test.mjs
```

生成产物：

```text
.p04-work/
  spatial/world.synthetic.json
  spatial/coverage.synthetic.json
  spatial/manifest.synthetic.json
  reports/p04_spatial_quality.json
```

仅在合成数据校验中允许，`manifest.synthetic.json` 始终包含 `public_map_release_approved=false`、`p01_g1_status=BLOCKED` 和完整 SHA-256 来源链。

## 6. 阶段验收

- [ ] [GitHub Actions P04](../.github/workflows/p04-synthetic-gis.yml) 成功。
- [ ] 真实米制合成空间中六边形相交、孔洞、岛屿与边缘覆盖测试成功。
- [ ] 额外 GIS 功能未破坏 P02 网格索引/语义校验或 P03 ETL 流水线。
- [ ] 两次合成 GIS 构建输出字节一致，篡改/绕过门禁明确 FAIL。
- [ ] 不生成真实上海 GIS，不对公发布地图，不侵犯服务条款。

**G4 可以仅就 synthetic geometry ENGINEERING PASS；真实上海 GIS 和 G1/G6 必须保持 BLOCKED。**

## 7. 真正接入上海之前仍需解决

1. **[Issue #3](https://github.com/1998x-stack/ShanghaiCiv/issues/3)**：区界来源及是否可自建/再分发，官方底图 SDK/叠加授权、公开地图审图。
2. 正式地图数据原始 CRS、坐标精度、使用条款、标准区划编码版本。
3. 面要素真实有效性检验（自相交、重叠、洞、岛屿、区界无缝、面积误差），优先使用有许可的成熟 GIS 库进行验证。
4. 授权后的 16 区、主要河流、崇明等岛屿空间对照和人工 QA。
5. 根据上海地图体验测试 0.5/1/2 km 精度、运行时间/内存，并记录最终选择的 ADR。
6. 合规核查和验收签署完成后，才允许将生产 `world.json` 写入公开 `web/data/`。

这一步完成的是**可信空间算法底座**，不是已经发布的上海真实文明地图。