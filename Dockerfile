# =====================================================
# 多阶段:node 构建 → nginx serve
# 阶段 1:builder
# 阶段 2:runtime(nginx + 静态 dist + 反代配置)
# =====================================================

# 阶段 1:builder
FROM node:22.20.0-alpine AS builder

# 国内构建加速
ENV NPM_CONFIG_REGISTRY=https://registry.npmmirror.com

WORKDIR /src

# 单独 copy package.json 触发依赖安装缓存
COPY package.json package-lock.json* ./
# 用 npm install 而非 npm ci:lockfile 是 Windows 上 install 生成的,Linux 容器里 npm ci 会因 os:win32 binding 报 EBADPLATFORM。
# 改用 install 后,npm 会按当前平台(容器是 linux)重新解析,自动跳过 win32 binding,装 vite/rolldown 的 linux binding。
RUN npm install --no-audit --fund=false

COPY . .
RUN npm run build

# 阶段 2:runtime
FROM nginx:1.27-alpine

ENV TZ=Asia/Shanghai

# 国内构建可取消下行注释
# RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# 拷 dist + nginx 配置
COPY --from=builder /src/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# 健康检查打到 /healthz(nginx.conf 里定义),比查 / 准
# 用 127.0.0.1 而不是 localhost:busybox wget 默认 IPv6 first,nginx 只 listen IPv4,localhost 会拿到 ::1 → Connection refused
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
