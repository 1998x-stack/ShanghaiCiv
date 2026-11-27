# ShanghaiCiv P10｜Explorer 区际对比与合成数据研究

> 状态：开发中，最终以 P10 GitHub Actions 实际结果为准。  
> **仅使用人工虚构的两个行政区以及 2024/2025 年测试数字，绝非上海真实人口或地图。**  
> 地图审核与真实统计再利用 G1/G6 继续 **BLOCKED**。

## 目标与功能

P10 在 P07 Canvas、P08 Almanac、P09 美术基础上增加区际 Explorer：

| 功能 | 数据合同和展示 |
|---|---|
| 排序表 | 只列虚构甲、乙区；按同年人口或人口密度升降排序；`null` 永远排在末尾，不记零 |
| 双区对比 | 同年、同指标/单位/粒度、同状态/方法/来源/统计期才允许差分；禁止混合年份和来源 |
| 散点图 | 原生 SVG，X 轴人口、Y 轴密度；一个点代表整个虚构行政区，不是 hex；缺失任何轴不画点 |
| 地图联动 | 点击表行或散点聚焦该区的一个合法合成 hex，地图选中/Almanac/Explorer 同步；点击地图亦同步右侧表格 |
| 来源审核 | 显示 source_id、发布机构、期次、单位、方法、质量标记、license_status；example.invalid 只是不可访问的占位 |
| 导出 | **只允许 synthetic_test CSV**，写入来源/方法/单位及假数据警告；拒绝 production 或未经许可来源 |
| 产业结构 | 没有区级 GDP 或产业结构样本，不制造不存在的指标，展示“暂无可比较的区级产业结构数据” |

### 人工虚构数字，不能用于真实研究

| 虚构行政区 | 2024 人口（人） | 2025 人口（人） | 2024 密度（人/km²） | 2025 密度 |
|---|---:|---:|---:|---:|
| 甲区 | 100,000 | 110,000 | 1,200.5 | 1,321 |
| 乙区 | 50,000 | null | null | null |

所谓 2024 年人口“甲比乙多 50,000 人”只用于测试比较函数；真实上海没有通过本阶段增加任何统计数据。

## 代码文件

| 文件 | 职责 |
|---|---|
| `web/js/explorer.mjs` | 比较合同、null 排序、区级散点和受控 CSV |
| `web/js/app/explorer-ui.mjs` | 排序表、可点击 SVG、比较卡片与来源字段 |
| `web/js/app/synthetic-map.mjs` | P08 年度共享、地图反向选择、URL 状态 |
| `web/dev/synthetic-map.html` | 内嵌 Explorer、对比、散点、导出控件 |
| `tests/js/explorer.test.mjs` | 单测：同年同源、缺失、CSV 公式注入、禁止生产导出 |
| `tests/js/explorer.e2e.mjs` | 真实 Chromium：桌面/移动端、区域/地图同步、下载和刷新 |
| `.github/workflows/p10-explorer.yml` | 全套 Python/Node/Chromium 与 G1 门禁 |

**原生数据粒度始终是 district**：hex→region membership 只提供几何归属，不按 hex 覆盖比例拆人口。由于只有两个区、一个人口和密度同时完整的点，散点绝不能做相关性、回归或真实产业结论。

## 导出安全

`syntheticCSV(view,"synthetic_test")` 要求 `synthetic=true`、`publish_approved=false`、source 许可为 `synthetic` 且允许测试再分发，导出文件名强制以前缀 `SYNTHETIC-ONLY` 开始。内容包含首行 `SYNTHETIC TEST ONLY - NOT REAL SHANGHAI DATA`、统计期、单位、来源、方法、质量标记、许可、`publish_approved=false`。`null` 会留空但保留 unavailable 状态。恶意表格公式前缀转义。`mode="production"` 必然拒绝；真实授权不能借用合成测试出口。

## 本地运行和验收

仓库根目录运行：

```bash
python -m http.server 8765 --bind 127.0.0.1
```

打开 http://127.0.0.1:8765/web/dev/synthetic-map.html。

验证命令：

```bash
python -m pipeline spatial --workspace .p07-work
python -m pipeline spatial-check --workspace .p07-work
python -m unittest discover -s tests -v
node --test tests/js/*.test.mjs
# HTTP 服务保持运行，Playwright 安装完成后：
node tests/js/explorer.e2e.mjs
```

验收必须以 GitHub Actions 真正 PASS 为准。前端实际 Chromium 需验证排序方向、缺失置末、双区不可比、散点与地图/Almanac 同步、带警告的合成 CSV 下载、URL 恢复和 390px 移动端；P02–P09 历史回归不得失败。

### 未完成与外部阻塞

- 实际上海 16 区 Explorer 需要完整且许可明确的区级统计与版本化口径（[#4](https://github.com/1998x-stack/ShanghaiCiv/issues/4)）。
- 真实地图/区界授权与公开审图路径在 [#3](https://github.com/1998x-stack/ShanghaiCiv/issues/3) 继续审核；道路、公园和 POI 数据授权在 #5。
- 本阶段不能自动上线生产地图、不能声称真实区际差异、不能把演示工业指数当 GDP/产业结构。

**结论**：P10 的验收范围仅是 synthetic-only Explorer 工程，而非上海城市数据研究正式发布。