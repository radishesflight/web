# =====================================================
# 多阶段构建
# 阶段 1:builder  - npm install + vite build
# 阶段 2:runtime  - nginx 静态服务
# =====================================================

# 阶段 1:builder
FROM node:22-alpine AS builder

# 国内构建可取消下行注释(Alpine 镜像源)
# RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

WORKDIR /app

# 单独 copy package*.json,利用 Docker 缓存
COPY package.json package-lock.json ./
RUN npm ci

# copy 源码
COPY . .

# build 参数
ARG VITE_API_BASE=/api
ARG VITE_API_TARGET=http://localhost:8080
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_API_TARGET=$VITE_API_TARGET

RUN npm run build

# 阶段 2:runtime(nginx 静态服务)
FROM nginx:1.27-alpine

# 国内构建可取消下行注释
# RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# 时区
ENV TZ=Asia/Shanghai

# 从 builder 拷构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx 配置(默认就行,静态文件直接服务)
# 如需反向代理 /api 到后端,改成自定义 nginx.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -q --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
