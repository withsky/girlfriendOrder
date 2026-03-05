# 女朋友点菜 Web（轻量 NAS 版）

一个为家庭场景设计的超轻量点菜网页：
- 手机优先界面
- 菜品点单次数统计（可直接修改）
- 菜品辣度配置
- 排序：手动排序 / 按菜名字母自动排序 / 按点菜次数自动排序
- 菜品详情页：制作流程、食材准备、配料用量
- 数据落地到本地 `JSON` 文件，资源占用低，适合 N100 NAS

## 技术方案（参考点餐项目思路，做轻量化裁剪）
- 后端：Node.js + Express
- 前端：原生 HTML/CSS/JS（无框架）
- 存储：`data/db.json`

> 你给的菜品已全部内置：共 27 道。

## 本地启动

```bash
npm install
npm start
```

默认端口：`3000`

浏览器访问：
- 首页：`http://<NAS_IP>:3000/`
- 健康检查：`http://<NAS_IP>:3000/api/health`

## NAS 部署建议（域名访问）

## 1) 在 NAS 中运行

```bash
cd /你的路径/girlfriendOrder
npm install --omit=dev
NODE_ENV=production PORT=3000 node server.js
```

可选：用 `pm2` 守护

```bash
npm i -g pm2
pm2 start server.js --name girlfriend-order --env production
pm2 save
```

## 2) 反向代理绑定域名

使用 Nginx / Nginx Proxy Manager / Caddy 都可以。核心是把域名流量转发到 `127.0.0.1:3000`。

Nginx 示例：

```nginx
server {
    listen 80;
    server_name menu.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

再用 `certbot` 或 Nginx Proxy Manager 申请 HTTPS 证书。

## 3) 路由器与 DNS
- 域名 A 记录指向家庭公网 IP（或 DDNS）
- 路由器端口转发 `80/443` 到 NAS
- 建议开启 HTTPS

## 数据文件
- `data/defaultDishes.js`：初始菜品和详情
- `data/db.json`：运行时数据（点菜次数、辣度、排序设置）

如果要重置数据，删除 `data/db.json` 后重启服务即可。

## 目录结构

```text
.
├─ server.js
├─ package.json
├─ data/
│  ├─ defaultDishes.js
│  └─ db.json (运行后自动生成)
└─ public/
   ├─ index.html
   ├─ detail.html
   ├─ main.js
   ├─ detail.js
   └─ styles.css
```
