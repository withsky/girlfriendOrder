# 小周私房菜（NAS 轻量点餐系统）

适合家用 NAS（N100）的网页版点餐系统，手机操作优先，功能接近外卖点餐界面。

## 核心功能
- 厨房点餐页：左侧分类（含“所有菜/常点菜”），右侧菜品图片列表，搜索与排序
- 菜品详情弹窗：介绍、预计制作时间、辣度、食材、配料、流程，多图切换
- 菜单与下单：加入菜单、确认下单、备注
- 订单处理页：待处理/制作中/可上桌/已完成/取消
- 订单处理页：待处理/制作中/可上桌/已完成/取消
  - AI 出餐优化：生成“时间线+并行任务”流程并保存，可随时查看
- 管理页：
  - 管理菜品（名称、分类、辣度、介绍、制作时间、多图、做法等）
  - 本地图片上传（保存到服务器 `public/uploads/`）
  - 图片可视化管理：小图删除、拖拽排序（不再手填图片路径）
  - AI 自动填充（DeepSeek）一键生成介绍/时间/食材/配料/流程
  - 管理分类（增删改）
  - 分类拖拽排序
  - 菜品拖拽手动排序
- 自动统计点菜次数（下单后自动累加）
- 自动排序：按菜名字母、按点菜次数

## 技术栈（轻量）
- Node.js + Express
- 原生 HTML/CSS/JS（无前端框架）
- JSON 文件持久化（`data/db.json`）

## 启动
```bash
npm install
npm start
```

默认端口：`3000`

访问：
- 首页：`http://<NAS_IP>:3000`
- 健康检查：`http://<NAS_IP>:3000/api/health`

## 数据文件
- `data/defaultDishes.js`：基础菜谱内容
- `data/defaultData.js`：初始分类/菜品/设置
- `data/db.json`：运行时数据（自动生成）
- `public/uploads/`：本地上传图片目录
- `public/uploads/samples/`：已下载样图（每道菜 2 张）

重置数据：删除 `data/db.json` 后重启。

## 下载样图
已内置下载脚本（会下载到本地并可直接展示）：

```bash
node scripts/download-samples.js
```

## DeepSeek 配置
设置环境变量后，管理页“AI 填写”按钮可用：

```bash
export DEEPSEEK_API_KEY=你的key
export DEEPSEEK_MODEL=deepseek-chat
# 可选，默认 https://api.deepseek.com/v1/chat/completions
export DEEPSEEK_BASE_URL=https://api.deepseek.com/v1/chat/completions
npm start
```

## NAS + 域名
按你现有方案将域名反向代理到 `http://127.0.0.1:3000` 即可，建议开启 HTTPS。
