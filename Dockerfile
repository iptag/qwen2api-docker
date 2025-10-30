# 使用 Node.js 18 Alpine 镜像（轻量级）
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装生产依赖
RUN npm install --production

# 复制项目文件
COPY . .

# 创建必要的目录
RUN mkdir -p logs caches data

# 暴露端口（通过环境变量 SERVICE_PORT 控制，默认 3000）
EXPOSE 3000



# 启动应用

CMD ["node", "src/start.js"]
