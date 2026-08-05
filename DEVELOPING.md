# web 开发手册

> 本手册面向**继续在本项目上开发**的工程师。
> 阅读完你应该能:加新页面 / 加新接口调用 / 用业务码 / 调 axios / 写测试 / 提交代码。

---

## 1. 项目结构

```
web/
├── .env.development       # dev 配置(进库)
├── .env.production        # prod 配置(进库)
├── .env.example           # 环境变量示例(进库)
├── .github/workflows/     # CI
├── public/                # Vite 静态资源
├── src/
│   ├── App.vue            # 根组件
│   ├── main.js            # 启动入口
│   ├── api/               # 后端接口封装
│   │   ├── auth/          # 登录 / 注销 / 当前用户
│   │   ├── system/        # 系统管理 4 个子模块
│   │   └── upload/        # 文件上传
│   ├── assets/            # 全局 CSS
│   ├── components/        # 通用组件(NavBar / SideBar)
│   ├── constants/         # 常量(业务码)
│   ├── layout/            # 布局
│   ├── router/            # 路由
│   │   ├── index.js       # 路由注册
│   │   ├── permission.js  # 鉴权守卫
│   │   └── modules/      # 路由模块
│   ├── stores/            # Pinia
│   ├── utils/             # 工具
│   │   ├── auth.js       # token 存取
│   │   ├── permission.js # 权限工具
│   │   ├── request.js    # axios 封装
│   │   └── cancel-key.js # 重复请求取消 key
│   └── views/             # 页面
└── vite.config.js         # Vite 配置(代理 / 别名)
```

**关键原则**:
- **业务逻辑全在 `src/views/`**,不要把业务写在 `utils/` 或 `api/`
- `api/` 只是 axios 函数,返回 Promise
- 业务判断用 `constants/bizcode.js` 的常量,不要硬编码数字

---

## 2. 业务码规范(⭐ 重要)

后端用**业务码模式**:HTTP 状态码恒为 200,真实状态在 `body.code` 里。

### 业务码定义
见 `src/constants/bizcode.js`,分组规则(与后端 `internal/handler/bizcode.go` 一致):

| 段位 | 含义 | 例子 |
|------|------|------|
| 0 | 成功 | `BizCode.Success` |
| 1xxx | 鉴权 / 账号 / 角色 | `BizCode.UserNotFound = 1004` |
| 2xxx | 权限 | `BizCode.NoPermission = 2001` |
| 3xxx | 文件 / OSS | `BizCode.UploadSize = 3003` |
| 4xxx | 参数 | `BizCode.ParamsInvalid = 4001` |
| 9xxx | 通用 | `BizCode.Unknown = 9999` |

### 使用方式

```js
import { BizCode, isAuthFail } from '@/constants/bizcode'

// 鉴权失败判断(已封装)
if (isAuthFail(code)) { ... }

// 具体业务判断
if (code === BizCode.UserNotFound) { ... }
```

**request.js 已经统一处理**:
- 成功:resolve res
- 鉴权失败(1002/1003):清 token + 跳 login + 静默 reject
- 其他错误:弹 ElMessage + reject

view 里**不需要**判断业务码,直接 `await` 就行。

### 加新业务码的流程

1. **后端先加**:`go_server/internal/handler/bizcode.go`
2. **前端同步**:`web/src/constants/bizcode.js`
3. 业务用得上时 import

---

## 3. 加一个新页面(完整示例)

假设要加一个**订单管理**页面。

### 步骤 1:加 API 封装
`src/api/system/orders/index.js`(新文件):

```js
import request from '@/utils/request'

// 列表
export function getOrdersList(params) {
  return request({
    url: '/api/system/orders/list',
    method: 'get',
    params
  })
}

// 新增
export function createOrder(data) {
  return request({
    url: '/api/system/orders',
    method: 'post',
    data
  })
}

// 删
export function deleteOrder(id) {
  return request({
    url: `/api/system/orders/${id}`,
    method: 'delete'
  })
}
```

### 步骤 2:加 view
`src/views/system/orders/Orders.vue`(新文件):

```vue
<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getOrdersList, createOrder, deleteOrder } from '@/api/system/orders'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const tableData = ref([])
const loading = ref(false)
const pagination = ref({ page: 1, size: 10, total: 0 })

const fetchData = async () => {
  loading.value = true
  try {
    const res = await getOrdersList({
      page: pagination.value.page,
      size: pagination.value.size
    })
    tableData.value = res.data.list
    pagination.value.total = res.data.total
  } finally {
    loading.value = false
  }
}

const handleDelete = (row) => {
  ElMessageBox.confirm(`确定删除订单 ${row.id} 吗?`, '提示', {
    type: 'warning'
  }).then(async () => {
    await deleteOrder(row.id)
    ElMessage.success('删除成功')
    fetchData()
  })
}

onMounted(() => { fetchData() })
</script>

<template>
  <div class="page-container">
    <el-card>
      <el-table :data="tableData" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <!-- ... 业务字段 ... -->
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button
              v-if="userStore.hasRoute('DELETE', '/api/system/orders/:id')"
              type="danger" size="small"
              @click="handleDelete(row)"
            >删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>
```

### 步骤 3:加路由
`src/router/modules/orders.js`(新文件):

```js
export default [
  {
    path: '/system/orders',
    name: 'Orders',
    component: () => import('@/views/system/orders/Orders.vue'),
    meta: { title: '订单管理' }
  }
]
```

`src/router/index.js` 加一行:

```js
import ordersRoutes from './modules/orders'

// ...

const routes = [
  {
    path: '/',
    component: () => import('@/layout/MainLayout.vue'),
    redirect: '/dashboard',
    children: [
      ...systemRoutes,
      ...ordersRoutes  // ← 这里
    ]
  },
  // ...
]
```

### 步骤 4:同步后端
后端也要加:
- `internal/service/order_service.go`
- `internal/handler/system/order.go`
- `internal/router/system/order.go` + `internal/router/router.go` 注册

(详见后端 `go_server/DEVELOPING.md`)

### 步骤 5:权限 key(⭐ 重要)
权限码 = `"<HTTP 方法> <完整路径>"`,**没有**"推断"这一步,直接是 (method, path) 拼接。

举例:
- `GET /api/system/orders/list` → 权限码 `"GET /api/system/orders/list"`
- `POST /api/system/orders` → 权限码 `"POST /api/system/orders"`
- `DELETE /api/system/orders/:id` → 权限码 `"DELETE /api/system/orders/:id"`

**加新接口时**:
1. 后端 `internal/router/system/orders.go` 加 gin 路由(挂 PermissionMiddleware)
2. 重启服务,`SyncRoutes` 会**自动**把 (method, path) INSERT 到 `admin_menu_operations`
   (要求 path 段 `/api/system/orders` 跟 `admin_menus.code = "orders"` 对应)
3. 在 `admin_menus` 表里给 `code="orders"` 的菜单分配给需要的角色
4. 在"角色权限分配"页(`/system/roleMenu`)给该角色**勾上**对应的 operation

**前端判断权限**:
```vue
<el-button v-if="userStore.hasRoute('POST', '/api/system/orders')">新增订单</el-button>
```

`hasRoute(method, path)` 等价于 `userStore.permissions.includes(method+' '+path)`,严格大小写不敏感(内部都大写)。

---

## 4. axios 封装(`src/utils/request.js`)

**已自动处理**:
- ✅ baseURL 从 `VITE_API_BASE` 读(dev 走 vite proxy)
- ✅ Authorization Header(从 localStorage 读 token)
- ✅ 业务码判断(`code === 0` 成功,其他失败)
- ✅ 鉴权失败自动跳 login(`code === 1002/1003`)
- ✅ **GET 重复请求自动取消**(只对 GET)
- ✅ 错误弹 ElMessage

view 里**直接 await**:

```js
// 成功
const res = await getAdminUsersList({ page: 1 })
// res.data = { list, total, page, size }

// 失败(已自动弹 toast,这里可以接 catch 做特殊处理)
try {
  await deleteUser(id)
  fetchData()
} catch (e) {
  // 不用做任何事,toast 已经弹了
  // 想做特殊处理就这里写
}
```

### 主动取消请求(component unmount 时)

```js
import { onBeforeUnmount } from 'vue'

const controller = new AbortController()
onBeforeUnmount(() => controller.abort())

// 把 controller.signal 传给 request
await getAdminUsersList(params, { signal: controller.signal })
```

> 注意:axios 自动取消只对 GET 生效,POST/PUT/DELETE 业务方要主动传 signal

---

## 5. 状态管理(Pinia)

### `useUserStore`(`src/stores/user.js`)

```js
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

// state
userStore.token         // 当前 token
userStore.user          // 用户信息(LoginResp.user)
userStore.menus         // 菜单树(后端返回,树形)
userStore.permissions   // 权限码列表 ['GET /api/system/adminUsers/list', 'POST /api/system/adminUsers', ...]
                        //  每项 = "METHOD /path",跟后端 admin_menu_operations 一一对应

// getters
userStore.isLoggedIn          // !!token
userStore.getUser             // user
userStore.getMenus            // menus
userStore.dataScope           // 当前用户数据范围(0=全部 1=部门 2=自己)
userStore.departmentId        // 当前用户部门 ID
userStore.hasRoute('POST', '/api/system/adminUsers')    // 路由权限判断
userStore.hasDataScope(1)     // 数据范围判断

// actions
userStore.setLoginData({ token, user, menus, permissions })  // 登录后一次性设置
userStore.logout()       // 清空所有(包含 localStorage)
userStore.refreshUserInfo()  // 静默从后端重新拉 user/menus/permissions(配合 main.js 的 focus 监听)
```

### 加新 store

1. `src/stores/<name>.js`,参照 `user.js` 写
2. 在 view 里 `import { useXxxStore } from '@/stores/<name>'`

---

## 6. 权限控制(2 步)

### 6.1 按钮权限(后端控制 + 前端隐藏)

后端在 `admin_menu_operations` 表登记每个具体接口(method + path),并在 `admin_role_operations` 里给角色关联。`RoleMenu.vue` 页就是给角色分配这些 operation 的界面。

用户登录后,`userStore.permissions` 包含该用户角色的所有 operation(每项 = `"METHOD /path"`)。

前端 view 里用 `v-if` 隐藏按钮:

```vue
<el-button
  v-if="userStore.hasRoute('POST', '/api/system/adminUsers')"
  @click="handleAdd"
>新增</el-button>
```

注意是 `hasRoute(method, path)`,**不是** `hasPermission('xxx:yyy')`(后者是旧版 API,已废弃)。

### 6.2 路由权限(前端守卫)

`src/router/permission.js` 已经处理:
- 没 token + 非白名单路径 → 跳 `/login?redirect=...`
- 有 token + 跳 `/login` → 跳 `/`
- 有 token 但没用户信息 → 自动调 `getCurrentUser` 填充 store

加新路由时不需要改这个文件(白名单列表是常量)。

---

## 7. 测试(Vitest)

### 跑测试

```bash
npm run test:unit         # 一次性
npm run test:unit -- --watch  # watch 模式
```

### 加新测试

文件命名:`<file>.test.js`,与被测文件同目录。

```js
import { describe, it, expect } from 'vitest'
import { myFunction } from '@/utils/my-file'

describe('myFunction', () => {
  it('应该返回正确结果', () => {
    expect(myFunction('input')).toBe('output')
  })
})
```

### 测试 DOM 相关

`vitest.config.js` 已经配 `environment: 'jsdom'`,可以直接用 `localStorage` / `document` 等浏览器 API。

---

## 8. 命名约定

| 类别 | 规则 | 例子 |
|------|------|------|
| 目录 | 复数小写 | `views/`, `api/system/orders/` |
| 文件名 | 大驼峰(组件) / 复数小写(api) | `AdminUsers.vue`, `orders/index.js` |
| 组件 | 大驼峰(views 可单词) | `App.vue`, `NavBar.vue` |
| 导出函数 | 驼峰 | `getOrdersList` |
| 业务码 | 大写分组,见 `constants/bizcode.js` | `BizCode.UserNotFound` |
| 路由 path | 蛇形,复数 | `/system/orders` |
| 路由 name | 大驼峰 | `'Orders'` |
| 权限码 | `"<METHOD> <path>"`(完整接口) | `"POST /api/system/adminUsers"` |

---

## 9. 环境变量

| 变量 | dev 默认 | prod 默认 | 说明 |
|------|---------|---------|------|
| `VITE_API_BASE` | `/api` | `/api` | 前端请求的 baseURL |
| `VITE_API_TARGET` | `http://localhost:8080` | (无) | dev 时 vite proxy 目标 |

dev 模式:`/api/*` 走 vite proxy → `VITE_API_TARGET`
prod 模式:直接请求 `VITE_API_BASE`(nginx 同域或跨域)

---

## 10. 提交规范(commit message)

```
<type>: <subject>

<body>(可选)
```

**type 类别**:
- `feat` 新功能
- `fix` 修复 bug
- `refactor` 重构
- `docs` 文档
- `test` 测试
- `chore` 构建 / 配置

**示例**:
```
feat: 加订单管理页面

- api: src/api/system/orders/
- view: src/views/system/orders/Orders.vue
- route: src/router/modules/orders.js
- 业务码: 6001-6009(后端)
```

---

## 11. 常见错误 FAQ

### Q: 启动后页面空白?
A: 检查:
1. `.env.development` 是否有 `VITE_API_BASE`
2. 后端是否启动(看 :8080)
3. 浏览器 console 有没有错

### Q: 报 404 / 网络错误?
A: `vite.config.js` 的 proxy 是否配了 `/api → VITE_API_TARGET`

### Q: 报"令牌无效"?
A: 401/1002/1003:token 过期或不正确,清 localStorage 重登

### Q: 按钮不显示?
A: `userStore.permissions` 是不是有对应权限码。后端要分配,前端才能 `hasRoute(method, path)` 返回 true。
具体排查:
1. `admin_menu_operations` 表里有没有这条 (method, path) — 没有就是路由没注册或 SyncRoutes 没跑
2. `admin_role_operations` 里有没有把这条 route 分配给该用户的角色 — 没有就去 `/system/roleMenu` 页勾
3. 给该角色勾上后,**该用户的 token 会在下次请求时自动懒重载**(等几秒)

### Q: dev 修改代码,浏览器不更新?
A: Vite HMR 有时候失效,刷新一下浏览器;import 路径错的话改完得重启 `npm run dev`

### Q: 接口没数据?
A: 打开浏览器 DevTools → Network → 看具体请求,看 response body

---

## 12. 调试技巧

### 看请求 / 响应
F12 → Network → 过滤 `/api/`

### 看 Pinia 状态
Vue DevTools → Pinia 标签 → 看 user store

### 改 vite.config.js
比如要换 dev 后端地址:
```js
// .env.development
VITE_API_TARGET=http://192.168.1.100:8080
```

### 跑 dev 看后端日志
dev 模式下请求会打到 :8080,看后端 console

---

**祝开发愉快 🎉 有问题先看 FAQ,再问同事。**
