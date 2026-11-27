# ShanghaiCiv P07/G5a 合成地图交互工程验收

> **验收日期**：2026-11-27 · **结果**：**G5a SYNTHETIC UI ENGINEERING PASS**  
> **强制限制**：P01/G1（真实上海地理数据及公开地图许可）= **BLOCKED**。本次只验收完全虚构的互动示意地图，**不代表真实上海地图上线或行政审图完成**。

## 1. 已实际执行的 CI 证据

| 工作流 | Run | 验证结果 |
|---|---|---|
| P07 Canvas + 真 Chromium E2E | [#45952603505](https://github.com/1998x-stack/ShanghaiCiv/actions/runs/45952603505) | completed / success |
| P02 统计合同及双端一致性 | [#45952603545](https://github.com/1998x-stack/ShanghaiCiv/actions/runs/45952603545) | completed / success |
| P03 离线 ETL 可复现性 | [#45952603495](https://github.com/1998x-stack/ShanghaiCiv/actions/runs/45952603495) | completed / success |
| P04 几何与空间权限门禁 | [#45952603591](https://github.com/1998x-stack/ShanghaiCiv/actions/runs/45952603591) | completed / success |

- 验证代码 commit：`228aa6b2e84ba1936e854ad8c1871e5c3150d0e4`，对应 PR [#12](https://github.com/1998x-stack/ShanghaiCiv/pull/12)。
- Chromium 浏览器实际打开 `web/dev/synthetic-map.html`，运行桌面与 390px 移动端用户旅程，并生成 `p07-synthetic-e2e-screenshots` 截图 artifact（见 P07 Run 页面）。
- CI 首次使用 `ubuntu-latest` 遇到 Ubuntu 26.04 对 Playwright 1.56.1 安装 Chromium 不兼容，已改用显式 `ubuntu-24.04`；随后真实浏览器测试成功。
- 中间曾发现拖拽后相机 URL 未改变的 E2E 失败；增强了测试的指针事件诊断，再次验证后通过。**这不证明所有浏览器/触摸设备均无兼容问题**，生产可用性需后续设备矩阵复测。

## 2. 逐项交付与验收

| 项 | 验收证据 | 状态 |
|---|---|---|
| 真实可打开的前端页面 | 本地静态 HTTP 服务，加载 56 个合成 hex | PASS |
| 双层 Canvas | base 负责静态地形/边界；overlay 处理 hover/selection | PASS |
| 鼠标与触摸 | 选中 hex、拖拽、缩放、移动端点击、缩放按钮 | PASS |
| 键盘与分享状态 | 方向键/Enter、URL hash、刷新保留选中/图层 | PASS |
| 图层/搜索 | terrain、grid、district、partial 开关及虚构区域聚焦 | PASS |
| 详情面板 | Cell ID，陆/水/未分类及虚构区属面积比例 | PASS |
| 来源损坏/缺失 | 故意阻断 JSON 请求，界面显示明确错误状态 | PASS |
| 几何可信 | 浏览器 JS 与 Python P04 逐格 geometry/partial 对照 | PASS |
| 数据授权防护 | 无真实区界、GDP/人口格网造数、商业瓦片和地图生产文件 | PASS |
| 真实上海 16 区 | 无合法发布的区界及实际地图审核 | **BLOCKED** |
| 生产性能目标 | 未在真实上海规模与设备样本下测量 | **NOT VERIFIED** |

## 3. 运行方式和边界

```bash
python -m http.server 8765 --bind 127.0.0.1
# 浏览器 http://127.0.0.1:8765/web/dev/synthetic-map.html
```

- 默认 P04 fixture 是完全虚构的两个区、一条河流、海域及离岛，共 56 个 500 m 半径 hex；
- 不使用真实上海 GIS，不执行未经核准的数据抓取，不自动部署 GitHub Pages；
- 页面有常驻的 `FICTIONAL DATA` 声明，源/图层/详情不能使用户误以为看到官方上海行政地图；
- 所有真实区 GDP 与人口仍按原统计单元和出处保存，不能变成 hex 的伪观测。

## 4. 下一步

可以进入 **P08 合成专题图层与来源百科 UI**，先使用 P02 合成 metric/lens/source 数据合同完成可交互面板与可追溯数据链。与此同时，需要继续处理 [Issue #3](https://github.com/1998x-stack/ShanghaiCiv/issues/3) 地图授权、[#4](https://github.com/1998x-stack/ShanghaiCiv/issues/4) 统计再使用、[#5](https://github.com/1998x-stack/ShanghaiCiv/issues/5) 交通/公园数据授权。

**G5a 结论：synthetic-only Canvas 前端与浏览器交互完成；真实地图 G1/G6 依然 BLOCKED。**