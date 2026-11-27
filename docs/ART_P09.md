# P09｜合成空间中的原创程序化美术引擎

> 2026-11-27 · **工程验收：P09/G5c 合成基线 CI 已通过**，见 [正式验收报告](release/P09_G5C_SYNTHETIC_ACCEPTANCE.md)  
> **发布限制：P01/G1=BLOCKED。** 这只是完全虚构的地理演示；没有绘制真实上海行政区、真实交通、真实建筑或真实 POI。

## 如何查看

在仓库根目录本地启动：

```bash
python -m http.server 8765 --bind 127.0.0.1
```

- [四级美术画廊](../web/dev/art.html)：本地地址 http://127.0.0.1:8765/web/dev/art.html。
- [合成地图交互原型](../web/dev/synthetic-map.html)：本地地址 http://127.0.0.1:8765/web/dev/synthetic-map.html。

画廊按固定相机与种子分别展示 Overview / Regional / Local / Detail。原型在 P08 人口/密度专题之外，增加「程序化地表装饰」「虚构功能区标签」「细节级别」「虚构类型聚焦」，实时展示 LOD、可见格、物件数和缓存命中指标。页面本身不会自动发布为正式 GitHub Pages 地图。

## 代码与边界

| 模块 | 责任 |
|---|---|
| `web/js/render/art/tokens.mjs` | 自有设计 token；无商业游戏素材 |
| `random.mjs` | 稳定固定 seed/hash；无运行时不可重现随机值 |
| `lod.mjs` | 四档 LOD 阈值与每格装饰预算 |
| `cache.mjs` | 有上限的纯矢量描述符 LRU |
| `props.mjs` | 树/屋顶/灌木、水纹等**虚构**地表造型 |
| `labels.mjs` | 按优先级和矩形碰撞避免标签重叠 |
| `zones.mjs` | 四类虚构功能标签、固定合成坐标及限制说明 |
| `art-layer.mjs` | 可见格绘制、缓存统计与地标/大区标签 |
| `web/js/render/synthetic-canvas.mjs` | P08 专题与 P09 美术层的安全组合 |
| `web/js/app/synthetic-map.mjs` | 控件、相机聚焦、URL hash、诊断 |
| `web/js/app/art-gallery.mjs` | 独立四级画廊 |
| `tests/js/art.test.mjs` | RNG、LOD、LRU、碰撞、场景门禁、250k 格视窗裁剪 |
| `tests/js/art.e2e.mjs` | Chromium 画廊像素一致、交互、缓存、截图、移动端 |
| `.github/workflows/p09-synthetic-art.yml` | P02–P09 端到端 CI，截图证据 |

所有自绘图形在 Canvas 中构造，没有下载素材或使用商业游戏的画面或字体。P09 不改变 P08 指标与 `value=null` 的语义，区级数据仍按完整合成 Polygon 展示，不能按 hex 装饰对象数推算人口或建筑分布。

## 四个示范类型

| 虚构点 | 设计目的 | 明确不代表 |
|---|---|---|
| 虚构金融城 | 高楼、交易型城市场景视觉占位 | 陆家嘴的真实位置/经济 |
| 虚构科技园 | 科技类型标注与聚焦 | 张江的真实边界/企业 |
| 虚构交通枢纽 | 中性交通风格 | 虹桥的现实交通节点 |
| 虚构制造港 | 虚构工厂风格 | 临港的实际产业与地理 |

全部锚点处于 `SYNTHETIC_LOCAL_METERS` 坐标系，只为测试 UI。真实功能区需用官方数据、许可和地图合规审查后另行接入。

## 验收矩阵

| ID | 通过条件 |
|---|---|
| P09-E01 | 画廊加载四级视图，全部明确标注 FICTIONAL |
| P09-E02 | 通过相机缩放自动选 LOD，手动四档切换响应及时 |
| P09-E03 | 同一场景、seed、zoom 的 Canvas 重新绘制具有像素一致性 |
| P09-E04 | 缓存有条目上限、命中/未命中/淘汰计数并正确更新 |
| P09-E05 | 标签按优先级有确定性，碰撞标签被抑制 |
| P09-E06 | 四个虚构类型可选择与聚焦，URL 状态可恢复 |
| P09-E07 | 56 格视图不会遍历不在视野内的扩展网格 |
| P09-E08 | 旧 P07 鼠标键盘/移动交互和 P08 统计来源仍通过真实浏览器 E2E |
| P09-E09 | P02/P03/P04 数据合同/质量校验继续 PASS |
| P09-E10 | 无真实地图、区界/POI 或 commercial art 被公开发布 |

**下一步**：合成工程验收通过后，可以先制作 P10 Explorer 的纯 synthetic 对比面板；真实上海地图与四区域资料仍需 Issue #3/#4/#5 的实证及许可审核。