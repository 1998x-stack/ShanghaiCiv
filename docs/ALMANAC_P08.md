# ShanghaiCiv P08｜区级专题图层与 Almanac 来源百科

> **阶段**：P08 / Synthetic thematic MVP  
> **状态**：G5b synthetic-only 工程验收通过；证据见 [P08/G5b 验收记录](release/P08_G5B_SYNTHETIC_ACCEPTANCE.md)。  
> **数据性质**：**2024/2025 所有数字和地理边界均为虚构样本**，不能用于描述真实上海区级人口、工业或地理分布  
> **独立门禁**：P01/G1 = **BLOCKED**（地图数据权利及公开地图审核）；真实统计再利用许可仍待确认

## 1. 用户体验目标

基于 P07 已完成的 Canvas 地图，增加研究型用户真正需要的“数值→统计单元→统计期→来源与方法”审计链条，而不是给每个六边形任意赋予一组经济点数。

**核心场景**：选择虚构行政区甲（而不是“这一个六边形实测”）→切换 2024/2025 →选人口或密度专题→查看整个行政区的原始指标、缺失/估计标记→审阅模拟来源 ID、单位、方法和质量标记→决定是否具备跨期比较条件。

### 交互与界面

| 区域 | 新增功能 |
|---|---|
| 左栏 DATA LENSES | 2024/2025 测试年度、区级人口与人口密度专题、无专题、图例与缺失提示 |
| 地图 Canvas | **按虚构区级多边形整体着色**，而不是把人口/GDP 分解成 500m 格网；海岸线/行政区界仍是合成几何 |
| 六边形 Inspector | 继续只显示几何覆盖率；新增该格所覆盖的所有虚构行政区的**完整区级**统计值，区属份额不影响统计值 |
| Almanac | source_id、publisher、source URL、统计期、unit、granularity、status、method_id、quality_flags、许可证状态 |
| 年度对比 | 2024→2025 只有值、单位、定义、空间粒度、状态与方法满足条件才显示**模拟差值**；不能解释为上海真实增长率 |

## 2. 可信数据模型

数据源是仓库中既有 P02 合成 fixture：

- `tests/fixtures/synthetic/synthetic_2024.json`：区甲/乙虚构人口，区甲密度派生值，区乙密度缺失，甲区下属虚构园区模拟工业估计；
- `tests/fixtures/synthetic/synthetic_2025.json`：区甲模拟人口 110,000，区乙模拟人口缺失，区甲密度 1,321，区乙密度缺失；
- `tests/fixtures/synthetic/synthetic_gis_scene.json`：P04 绘制的完全虚构区界、河道、水域和离岛。

以上都不代表上海真实观测。`example.invalid` 是测试占位来源，不可将其描述成可访问的官方下载 URL。

### 数据准入

- 浏览器在显示任何指标前，先调用 `validateBundle` 检查 P02 结构和跨记录语义。
- 两个年度均须有 `synthetic=true`、`publish_approved=false`、`license_review=blocked`、source license=synthetic、`native_granularity=district`。
- 每个 district metric 的 `geography_id` 必须对应 P04 虚构区界稳定 ID；不能以相同地名猜测 ID。
- 专题 `granularity` 只能为 `district`，专题用颜色覆盖**完整虚构行政区 Polygon**，不是给单元造出统计测量。
- `value=null` 表示“暂无数据”；`0` 是确切的零，两者不同。
- `observed`、`derived`、`estimated`、`unavailable` 被分别解释；派生和估算必须有 method_id，估算必须带 modeled flag（由 P02 合同先检查）。

### 映射与展示

虚构区级值通过 `districtMetricsView(bundle,lens,scene)` 绑定虚构区实体 ID。使用简单线性分段着色来说明指标大小，并保留缺失区的灰色视觉语义。区属几何比例只用来确定“被点击 hex 与哪些区相交”，绝不用于区值加权或区级数值分摊。

## 3. 跨期比较边界

`comparePeriods(old,new)` 明确拒绝以下情况：

| 错误类型 | 处理 |
|---|---|
| 任一年 value 为 null | 不计算变化，不把 null 当 0 |
| 指标 ID/单位/区域/空间粒度改变 | 不可比 |
| observed / derived / estimated 状态不同 | 不可比 |
| 派生/估算 method_id 变动 | 不可比 |
| estimated 或 unavailable | 不提供直接排名/变化 |
| 两条记录实际为同一期 | 拒绝误称跨年 |
| 两期都有效、同口径 | 可以显示差额与百分比，但 **SYNTHETIC_DEMO_ONLY** |

例：虚构区甲 2024 人口 100,000 vs 2025 人口 110,000，演示 10,000 人 / 10% 变化；这个数字**不得**用来说明上海甲区、浦东等真实行政区增长。

实际生产比较还需要统计修订、地区边界是否变化、价格口径和人口统计制度等额外核对；此处仅是技术合同的演示条件。

## 4. 文件结构

| 文件 | 职责 |
|---|---|
| `web/js/almanac.mjs` | 双年度许可与 Schema 检查、区级专题计算、跨期比较、来源与估算追踪 |
| `web/js/app/almanac-ui.mjs` | DOM 元素安全渲染、区级指标、来源字段和缺失警告 |
| `web/js/render/synthetic-canvas.mjs` | 在原先 P07 Canvas 上叠加整体虚构区多边形专题填色 |
| `web/js/app/synthetic-map.mjs` | 加载两个年度、连接 Year/Lens/Cell/Almanac/URL 状态 |
| `web/dev/synthetic-map.html` | 专题选单、年份控件、Almanac |
| `web/css/synthetic-map.css` | 响应式图例、来源百科、年度比较卡片 |
| `tests/js/almanac.test.mjs` | Node 纯逻辑及 P02 数据合同回归 |
| `tests/js/almanac.e2e.mjs` | 真实 Chromium 桌面/移动端专题切换及来源追溯旅程 |
| `.github/workflows/p08-almanac.yml` | Python GIS、Node 合同、Playwright E2E、合规门禁和截图 |

## 5. 本地启动与测试

从仓库根目录：

```bash
python -m http.server 8765 --bind 127.0.0.1
```

浏览器访问：

**http://127.0.0.1:8765/web/dev/synthetic-map.html**

完整合同/几何回归：

```bash
python -m pipeline spatial --workspace .p07-work
python -m pipeline spatial-check --workspace .p07-work
python -m unittest discover -s tests -v
node --test tests/js/*.test.mjs
```

Chromium E2E（可由 GitHub Actions 自动运行）：

```bash
npm install --no-save --no-package-lock playwright@1.56.1
npx playwright install chromium
# 另一个终端已经运行 localhost:8765 HTTP
node tests/js/synthetic-map.e2e.mjs
node tests/js/almanac.e2e.mjs
```

测试环境须用 Playwright 支持的操作系统；GitHub Actions 已显式使用 Ubuntu 24.04，不依赖当前 ubuntu-latest 版本。

## 6. 验收条目（G5b synthetic）

- [ ] 页面可选择模拟 2024、2025，切换人口/人口密度，不出现客户端异常；
- [ ] 只按完整虚构行政区专题着色；选中跨界 hex 时区级数据保持原值；
- [ ] 2025 区乙人口与密度仍是 null、显示“暂无数据”，不参与跨期比较；
- [ ] 2024 区甲的园区工业指数显示“模拟估算”，保留计算方法与 modeled flag；
- [ ] Almanac 完整溯源到 SYN-001、模拟发布机构/许可/URL、method_id、单位和年份；
- [ ] 页面刷新恢复 year、lens、cell、camera；
- [ ] 实际 Chromium 桌面/移动端测试、P02/P03/P04/P07 回归均 PASS；
- [ ] 缺失任一年 source 时 fail closed，不显示不完整统计；
- [ ] 未新增任何正式上海 GIS、第三方瓦片、公开 `web/data/world.json`；
- [ ] CI 合规审核不将 synthetic 文件晋升为 production publishing。

**验收解释**：G5b ENGINEERING PASS 仅对合成专题/Almanac UI 生效。真实上海统计数据接入以及真实地图部署，需要完全独立的源许可、GIS 合规、政府地图审核适用性核验和真实数据质量验收。