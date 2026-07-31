# web

后台管理系统前端 — Vue 3 + Vite + Element Plus + Pinia。

## 配套后端

本项目是 [go_server](https://github.com/radishesflight/go_server) 的前端,后端在 `../go_server`。

## 技术栈

| 类别 | 选型 |
|------|------|
| 框架 | Vue 3.5 (Composition API + `<script setup>`) |
| 构建 | Vite 8 |
| UI 库 | Element Plus 2.14 |
| 状态 | Pinia 3 |
| 路由 | Vue Router 5 |
| HTTP | axios 1.18 |
| 工具 | ESLint + oxlint + Prettier |

## 目录结构

```
src/
├── api/                       # 后端接口封装
│   ├── auth/                  # 登录 / 注销 / 当前用户
│   ├── system/
│   │   ├── adminMenus/        # 菜单管理
│   │   ├── adminRoles/        # 角色管理
│   │   ├── adminUsers/        # 用户管理
│   │   └── roleMenu/          # 角色-菜单 / 角色-权限
│   └── upload/                # 文件上传
├── assets/                    # 静态资源
├── components/                # 通用组件(NavBar / SideBar)
├── constants/                 # 常量(业务码等)
├── layout/                    # 布局
├── router/                    # 路由
│   ├── index.js               # 路由注册
│   ├── permission.js          # 鉴权守卫
│   └── modules/system.js      # 系统管理模块
├── stores/                    # Pinia
│   └── user.js                # 用户状态
├── utils/                     # 工具
│   ├── auth.js                # token 存取
│   ├── permission.js          # 权限工具
│   └── request.js             # axios 封装
└── views/                     # 页面
    ├── Dashboard/             # 首页 Dashboard
    ├── Login/                 # 登录
    └── system/                # 系统管理
        ├── adminMenus/
        ├── adminRoles/
        ├── adminUsers/
        └── roleMenu/
```

## 快速开始

### 1. 准备环境
- Node.js >= 22.18
- 后端 `go_server` 跑在 `:8080`

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env.development
# 按需修改 .env.development
```

`.env.development` 默认:
```
VITE_API_BASE=/api        # dev 走 vite proxy 转发到 :8080
VITE_API_TARGET=http://localhost:8080
```

### 4. 启动开发服务器

```bash
npm run dev
# 打开 http://localhost:5173
```

dev 模式下,前端请求 `/api/*` 会自动通过 vite proxy 转发到 `VITE_API_TARGET`。

## 常用命令

```bash
npm run dev          # 启动 dev server
npm run build        # 打包到 dist/
npm run preview      # 本地预览生产包
npm run lint         # ESLint + oxlint
npm run format       # Prettier
```

## API 路由

所有接口都走 `/api` 前缀,通过 vite proxy 转发到后端。

| 路径 | 后端 | 说明 |
|------|------|------|
| `/api/login` | POST | 登录 |
| `/api/logout` | POST | 注销 |
| `/api/user/info` | GET | 当前用户信息 |
| `/api/upload/image` | POST | 上传图片 |
| `/api/system/adminUsers/*` | CRUD | 用户管理 |
| `/api/system/adminRoles/*` | CRUD | 角色管理 |
| `/api/system/adminMenus/*` | CRUD | 菜单管理 |
| `/api/system/roleMenu/*` | POST/GET | 角色-菜单分配 |

## 业务码

后端返回 `{code, msg, data}` 格式,`code` 是业务码(0=成功,其他=具体错误)。
业务码常量定义在 `src/constants/bizcode.js`,参考后端 `internal/handler/bizcode.go`。

## License

待定
