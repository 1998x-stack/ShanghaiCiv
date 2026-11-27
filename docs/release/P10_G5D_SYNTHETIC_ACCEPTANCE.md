# ShanghaiCiv P10/G5d 合成 Explorer 工程验收

> 验收日期：2026-11-27  
> 工程结论：**SYNTHETIC EXPLORER ENGINEERING PASS（仅合成工程）**  
> **真实上海 16 区地图与统计数据公开再利用：P01/G1 = BLOCKED**。本验收不等于正式上海 Explorer、真实数据公开许可或生产级地图上线。

## 1. 实际 CI 证据

PR [#18](https://github.com/1998x-stack/ShanghaiCiv/pull/18) 的功能提交：`0ee940ad4ede063dc227a66679708ad678765433`。

| 流水线 | Run | 状态 |
|---|---|---|
| P10 Explorer + P07/P08/P09 Chromium E2E | [#45962789826](https://github.com/1998x-stack/ShanghaiCiv/actions/runs/45962789826) | completed / success |
| P09 原创美术浏览器回归 | [#45962789713](https://github.com/1998x-stack/ShanghaiCiv/actions/runs/45962789713) | completed / success |
| P08 区级专题/Almanac 浏览器回归 | [#45962789655](https://github.com/1998x-stack/ShanghaiCiv/actions/runs/45962789655) | completed / success |
| P07 六边形地图浏览器回归 | [#45962789660](https://github.com/1998x-stack/ShanghaiCiv/actions/runs/45962789660) | completed / success |
| P04 GIS 几何与门禁 | [#45962789641](https://github.com/1998x-stack/ShanghaiCiv/actions/runs/45962789641) | completed / success |
| P03 离线 ETL 复现性 | [#45962789649](https://github.com/1998x-stack/ShanghaiCiv/actions/runs/45962789649) | completed / success |
| P02 统计合同 | [#45962789657](https://github.com/1998x-stack/ShanghaiCiv/actions/runs/45962789657) | completed / success |

P10 Run 的 artifact `p10-synthetic-explorer-evidence`（约 745 KB）包含真实 Chromium 生成的桌面/390px 移动端浏览器截图；附件受 GitHub Actions 保留期限制。

## 2. 已通过的工程功能

| 验收点 | 内容及证据 | 结果 |
|---|---|---|
| 同年区际排序 | 仅人工虚构甲乙区、人口与密度，升降序，null 永远在末尾 | PASS |
| 区际比较 | 同年、同单位/粒度/方法/状态/来源期/来源 ID；2024 甲乙人口示范差值 50,000 人 | PASS |
| 不兼容与缺失 | 2025 乙区人口缺失，2024/2025 乙区密度缺失；不制造零值、差值或排行 | PASS |
| 散点 | 只绘制人口/密度两轴均有值的 district；样本不足不计算相关性 | PASS |
| 地图联动 | Explorer 表行/SVG 点→P07 格网选择与区域聚焦→P08 Almanac；地图点击→Explorer 行高亮 | PASS |
| URL 恢复 | P08 year、P10 排序/选择/比较指标、当前格网与虚构区域状态 | PASS |
| 来源审计 | 显示单位、source ID、发布机构、method ID、quality flags、license_status、period | PASS |
| 测试 CSV | 仅允许 `synthetic_test`，包含来源/单位/方法/许可与显著假数据警告，阻止 production 和未批准来源；公式注入转义 | PASS |
| 缺失产业结构 | 没有 district GDP 或产业结构指标，不用 zone 工业指数代替；展示空态 | PASS |
| 移动端 | Chromium 模拟390px touch UI 可操作排序、选区及来源 | PASS |
| 旧阶段无回归 | P02–P09 七组检查全部 success | PASS |

## 3. 已知限制

1. 所有数值与行政区形状由人工合成，**绝不代表上海真实16区人口、产业结构、经济排名**。
2. 2024 两个区具有人口值，但只有一个区有密度值；真实统计相关性与回归完全没有意义，本页面明确禁用。
3. 地图仍仅存在 `SYNTHETIC_LOCAL_METERS` 中；真实行政区边界、地图 API/瓦片、审图号和真实公共数据再利用尚未获审验（[#3](https://github.com/1998x-stack/ShanghaiCiv/issues/3)、[#4](https://github.com/1998x-stack/ShanghaiCiv/issues/4)、[#5](https://github.com/1998x-stack/ShanghaiCiv/issues/5)）。
4. CSV 是**明确标识 SYNTHETIC-ONLY 的本地测试材料**。未来真实数据的在线导出需重新审查源许可、字段暴露规则及发布权限。
5. 没有验证真实 16 区批量浏览/分页性能，也没有完成正式移动设备无障碍、耗电和生产地图发布测试。

## 4. 本地运行

```bash
python -m http.server 8765 --bind 127.0.0.1
```

浏览器打开 http://127.0.0.1:8765/web/dev/synthetic-map.html，右侧 Inspector 中的 **P10 District Explorer** 提供排序、比较、散点、来源与 synthetic CSV。

**验收结论**：G5d 仅就 P10 synthetic Explorer 工程基线通过。依据仓库 AGENTS.md，本 PR 应以分支+PR 交付，不自动合并；真实地图和统计发布门禁仍保留。