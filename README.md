# Qwen2API - 通义千问 OpenAI 格式 API 服务

[![Version](https://img.shields.io/badge/version-2025.09.30-blue.svg)](https://github.com/yourusername/qwen2api)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/docker-supported-blue.svg)](https://www.docker.com/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

> 将通义千问（Qwen）API 转换为 OpenAI 兼容格式的代理服务，支持多账户轮询、Cookie 热重载、CLI 模式等高级功能。

---

## ✨ 核心特性

### 🔄 多账户管理
- **自动轮询**：支持多个 Qwen 账户，自动轮流使用，避免单账户限流
- **失败重试**：账户失败时自动切换到下一个可用账户
- **健康监控**：实时监控账户状态，自动剔除失效账户

### 🔥 Cookie 热重载
- **实时监听**：使用 `chokidar` 监听 `.env` 文件变化，无需重启容器
- **自动更新**：检测到 Cookie 变化后，自动重新加载账户配置
- **零停机**：热重载过程不影响正在进行的 API 请求

### 🚀 CLI 模式支持
- **高级功能**：支持通义千问 CLI 模式，解锁更多高级功能
- **自动刷新**：CLI Token 自动定时刷新，无需手动维护
- **请求计数**：自动跟踪每个账户的 CLI 请求次数（限制 2000 次/天）

### 🔌 OpenAI 兼容
- **标准格式**：完全兼容 OpenAI API 格式，可直接替换 OpenAI API
- **流式响应**：支持 Server-Sent Events (SSE) 流式输出
- **模型映射**：自动映射 Qwen 模型到 OpenAI 模型名称

### 🛡️ 企业级特性
- **API 密钥认证**：Bearer Token 认证，保护 API 安全
- **SQLite 持久化**：账户数据持久化存储，重启不丢失
- **详细日志**：分级日志系统，支持文件日志和控制台输出
- **Docker 支持**：一键部署，支持 Docker Compose

---

## 🚀 快速开始

### 方式一：Docker Compose（推荐）

#### 1. 克隆项目

```bash
git clone https://github.com/yourusername/qwen2api.git
cd qwen2api
```

#### 2. 配置环境变量

```bash
# 复制配置文件
cp .env.example .env

# 编辑配置文件
nano .env
```

**必填配置**：

```env
# API 密钥（用于验证请求）
API_KEY=sk-your-secret-key

# Qwen Cookie（从浏览器复制完整 Cookie）
# 多个账户用逗号分隔
QWEN_COOKIES=token=xxx; ssxmod_itna=xxx,token=yyy; ssxmod_itna=yyy
```

#### 3. 启动服务

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f qwen2api
```

#### 4. 测试 API

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer sk-your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen-max",
    "messages": [{"role": "user", "content": "你好"}],
    "stream": false
  }'
```

---

### 方式二：本地运行

#### 1. 环境要求

- **Node.js**: >= 18.0.0
- **npm**: >= 8.0.0

#### 2. 安装依赖

```bash
npm install
```

#### 3. 配置环境变量

```bash
cp .env.example .env
nano .env
```

#### 4. 启动服务

```bash
# 生产模式
npm start
```

---

## ⚙️ 配置说明

### 环境变量详解

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `SERVICE_PORT` | 否 | `3000` | 服务监听端口 |
| `LISTEN_ADDRESS` | 否 | `0.0.0.0` | 服务监听地址 |
| `API_KEY` | **是** | - | API 密钥（Bearer Token） |
| `QWEN_COOKIES` | **是** | - | Qwen Cookie（多个用逗号分隔） |
| `OUTPUT_THINK` | 否 | `true` | 是否输出思考过程 |
| `SEARCH_INFO_MODE` | 否 | `table` | 搜索信息显示模式（`table` / `list`） |
| `SIMPLE_MODEL_MAP` | 否 | `false` | 是否简化模型列表 |
| `LOG_LEVEL` | 否 | `INFO` | 日志级别（`DEBUG` / `INFO` / `WARN` / `ERROR`） |
| `ENABLE_FILE_LOG` | 否 | `false` | 是否启用文件日志 |
| `LOG_DIR` | 否 | `./logs` | 日志文件目录 |
| `MAX_LOG_FILE_SIZE` | 否 | `10` | 最大日志文件大小（MB） |
| `MAX_LOG_FILES` | 否 | `5` | 保留的日志文件数量 |

### 获取 Qwen Cookie

1. 打开 [通义千问](https://qianwen.aliyun.com/)
2. 登录账户
3. 按 `F12` 打开开发者工具
4. 切换到 `Network` 标签
5. 刷新页面，找到任意请求
6. 在 `Request Headers` 中找到 `Cookie`
7. 复制完整的 Cookie 字符串

--

## 📡 完整 API 接口文档

### 基础信息

- **Base URL**: `http://localhost:3000`
- **认证方式**: Bearer Token（在 `Authorization` 头中传递 `API_KEY`）
- **Content-Type**: `application/json`

---

### 📋 API 接口总览表

| 分类 | 端点 | 方法 | 认证 | 功能 |
|------|------|------|------|------|
| **聊天** | `/v1/chat/completions` | POST | ✅ | 标准聊天完成（支持文本/搜索/图片/视频） |
| **聊天** | `/cli/v1/chat/completions` | POST | ✅ | CLI 聊天完成（高级功能，限 2000 次/天） |
| **模型** | `/v1/models` | GET | ✅ | 获取标准模型列表 |
| **模型** | `/models` | GET | ❌ | 获取模型列表（公开端点） |
| **模型** | `/cli/v1/models` | POST | ❌ | 获取 CLI 模型列表 |
| **账户** | `/api/addAccount` | POST | ✅ | 添加新账户 |
| **账户** | `/api/accountsHealth` | GET | ✅ | 查看账户健康状态 |
| **配置** | `/api/reloadConfig` | POST | ✅ | 手动重载配置 |
| **配置** | `/api/configStatus` | GET | ✅ | 获取配置状态 |
| **验证** | `/verify` | POST | ❌ | 验证 API Key |

---

## 1️⃣ 聊天完成接口

### 1.1 标准聊天完成

**端点**: `POST /v1/chat/completions`

**认证**: 需要 API Key

**功能**: 支持文本对话、联网搜索、图片生成、视频生成等多种模式

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `model` | string | 是 | 模型名称（如 `qwen-max`、`qwen-plus`） |
| `messages` | array | 是 | 对话消息列表 |
| `stream` | boolean | 否 | 是否流式输出（默认 `false`） |
| `temperature` | number | 否 | 温度参数（0-2，默认 0.7） |
| `max_tokens` | number | 否 | 最大生成 token 数 |
| `chat_type` | string | 否 | 聊天类型（`t2t`/`search`/`t2i`/`t2v`/`image_edit`） |

**支持的聊天类型**:

| chat_type | 说明 | 示例 |
|-----------|------|------|
| `t2t` | 文本对话（默认） | 普通对话、问答 |
| `search` | 联网搜索 | 实时新闻、最新信息 |
| `t2i` | 文本生成图片 | 图片创作、插画生成 |
| `t2v` | 文本生成视频 | 视频创作 |
| `image_edit` | 图片编辑 | 图片修改、风格转换 |

**请求示例 - 文本对话**:

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer sk-your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen-max",
    "messages": [
      {"role": "system", "content": "你是一个有帮助的助手"},
      {"role": "user", "content": "介绍一下北京"}
    ],
    "stream": false,
    "temperature": 0.7,
    "max_tokens": 2000
  }'
```

**请求示例 - 联网搜索**:

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer sk-your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen-max",
    "messages": [{"role": "user", "content": "今天的新闻"}],
    "chat_type": "search",
    "stream": false
  }'
```

**请求示例 - 图片生成**:

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer sk-your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen-max",
    "messages": [{"role": "user", "content": "一只可爱的猫咪"}],
    "chat_type": "t2i",
    "stream": false
  }'
```

**请求示例 - 流式输出**:

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer sk-your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen-max",
    "messages": [{"role": "user", "content": "你好"}],
    "stream": true
  }'
```

**响应示例（非流式）**:

```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1696000000,
  "model": "qwen-max",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "北京是中国的首都..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 20,
    "completion_tokens": 100,
    "total_tokens": 120
  }
}
```

**响应示例（流式）**:

```
data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1696000000,"model":"qwen-max","choices":[{"index":0,"delta":{"role":"assistant","content":"你"},"finish_reason":null}]}

data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1696000000,"model":"qwen-max","choices":[{"index":0,"delta":{"content":"好"},"finish_reason":null}]}

data: [DONE]
```

---

### 1.2 CLI 聊天完成

**端点**: `POST /cli/v1/chat/completions`

**认证**: 需要 API Key

**功能**: 使用 CLI 模式，支持更多高级功能，每个账户每天限制 2000 次请求

**请求参数**: 与标准聊天完成相同

**请求示例**:

```bash
curl -X POST http://localhost:3000/cli/v1/chat/completions \
  -H "Authorization: Bearer sk-your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen-max",
    "messages": [{"role": "user", "content": "你好"}],
    "stream": false
  }'
```

**响应示例**: 与标准聊天完成相同

**错误响应**（无可用 CLI 账户）:

```json
{
  "error": "没有可用的CLI账户，请稍后重试"
}
```

---

## 2️⃣ 模型列表接口

### 2.1 获取标准模型列表

**端点**: `GET /v1/models`

**认证**: 需要 API Key

**功能**: 获取所有可用的 Qwen 模型列表

**请求示例**:

```bash
curl http://localhost:3000/v1/models \
  -H "Authorization: Bearer sk-your-secret-key"
```

**响应示例**:

```json
{
  "object": "list",
  "data": [
    {
      "id": "qwen-max",
      "object": "model",
      "created": 1719878112,
      "owned_by": "qwen"
    },
    {
      "id": "qwen-plus",
      "object": "model",
      "created": 1719878112,
      "owned_by": "qwen"
    },
    {
      "id": "qwen-turbo",
      "object": "model",
      "created": 1719878112,
      "owned_by": "qwen"
    }
  ]
}
```

---

### 2.2 获取模型列表（无认证）

**端点**: `GET /models`

**认证**: 不需要

**功能**: 获取模型列表（公开端点）

**请求示例**:

```bash
curl http://localhost:3000/models
```

**响应示例**: 与 `/v1/models` 相同

---

### 2.3 获取 CLI 模型列表

**端点**: `POST /cli/v1/models`

**认证**: 不需要

**功能**: 获取 CLI 模式支持的模型列表

**请求示例**:

```bash
curl -X POST http://localhost:3000/cli/v1/models
```

**响应示例**:

```json
{
  "object": "list",
  "data": [
    {
      "id": "qwen3-coder-plus",
      "object": "model",
      "created": 1719878112,
      "owned_by": "qwen-code"
    },
    {
      "id": "qwen3-coder-flash",
      "object": "model",
      "created": 1719878112,
      "owned_by": "qwen-code"
    }
  ]
}
```

---

## 3️⃣ 账户管理接口

### 3.1 添加账户

**端点**: `POST /api/addAccount`

**认证**: 需要 API Key

**功能**: 动态添加新的 Qwen 账户

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `num` | string | 是 | 账户编号（如 "1", "2", "3"） |
| `cookie` | string | 是 | 完整的 Cookie 字符串 |

**请求示例**:

```bash
curl -X POST http://localhost:3000/api/addAccount \
  -H "Authorization: Bearer sk-your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{
    "num": "3",
    "cookie": "token=xxx; ssxmod_itna=yyy"
  }'
```

**成功响应**:

```json
{
  "success": true,
  "message": "账户 #3 添加成功",
  "account": {
    "num": "3",
    "accountId": "account_3",
    "hasToken": true,
    "expires": "2025-10-10 12:00:00"
  }
}
```

**失败响应**:

```json
{
  "success": false,
  "error": "添加账户失败（账户可能已存在或 Cookie 无效）"
}
```

---

### 3.2 查看账户健康状态

**端点**: `GET /api/accountsHealth`

**认证**: 需要 API Key

**功能**: 获取所有账户的健康状态和统计信息

**请求示例**:

```bash
curl http://localhost:3000/api/accountsHealth \
  -H "Authorization: Bearer sk-your-secret-key"
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "totalAccounts": 3,
    "healthyAccounts": 2,
    "unhealthyAccounts": 1,
    "accounts": [
      {
        "accountId": "account_1",
        "isHealthy": true,
        "failureCount": 0,
        "lastUsed": "2025-10-03T12:00:00.000Z",
        "hasCliInfo": true,
        "cliRequestNumber": 150
      },
      {
        "accountId": "account_2",
        "isHealthy": true,
        "failureCount": 0,
        "lastUsed": "2025-10-03T11:50:00.000Z",
        "hasCliInfo": false
      },
      {
        "accountId": "account_3",
        "isHealthy": false,
        "failureCount": 5,
        "lastUsed": "2025-10-03T10:00:00.000Z",
        "hasCliInfo": false
      }
    ]
  }
}
```

---

## 4️⃣ 配置管理接口

### 4.1 手动重载配置

**端点**: `POST /api/reloadConfig`

**认证**: 需要 API Key

**功能**: 手动触发配置文件（.env）重载，无需重启容器

**请求示例**:

```bash
curl -X POST http://localhost:3000/api/reloadConfig \
  -H "Authorization: Bearer sk-your-secret-key"
```

**成功响应**:

```json
{
  "success": true,
  "message": "配置重载成功",
  "data": {
    "reloadedAt": "2025-10-03T12:00:00.000Z",
    "configStatus": {
      "lastReload": "2025-10-03T12:00:00.000Z",
      "isWatching": true,
      "envPath": "/app/.env"
    },
    "accountsHealth": {
      "totalAccounts": 2,
      "healthyAccounts": 2,
      "unhealthyAccounts": 0
    }
  }
}
```

**无变化响应**:

```json
{
  "success": false,
  "message": "配置无变化或重载失败",
  "data": {
    "configStatus": {
      "lastReload": "2025-10-03T11:00:00.000Z",
      "isWatching": true
    }
  }
}
```

---

### 4.2 获取配置状态

**端点**: `GET /api/configStatus`

**认证**: 需要 API Key

**功能**: 获取配置重载器的当前状态

**请求示例**:

```bash
curl http://localhost:3000/api/configStatus \
  -H "Authorization: Bearer sk-your-secret-key"
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "lastReload": "2025-10-03T12:00:00.000Z",
    "isWatching": true,
    "envPath": "/app/.env",
    "watcherActive": true
  }
}
```

---

## 5️⃣ 验证接口

### 5.1 验证 API Key

**端点**: `POST /verify`

**认证**: 不需要（在请求体中传递 API Key）

**功能**: 验证 API Key 是否有效

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `apiKey` | string | 是 | 要验证的 API Key |

**请求示例**:

```bash
curl -X POST http://localhost:3000/verify \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "sk-your-secret-key"
  }'
```

**成功响应**:

```json
{
  "status": 200,
  "message": "success",
  "isAdmin": false
}
```

**失败响应**:

```json
{
  "status": 401,
  "message": "Unauthorized"
}
```

---

## 🔥 高级功能

### Cookie 热重载

#### 自动热重载

系统会自动监听 `.env` 文件的变化，当检测到 `QWEN_COOKIES` 变化时，会自动重新加载账户配置。

**操作步骤**：

1. 编辑 `.env` 文件

```bash
nano .env
```

2. 修改 `QWEN_COOKIES` 的值

```env
QWEN_COOKIES=token=new_token; ssxmod_itna=new_value
```

3. 保存文件（`Ctrl+O`, `Enter`, `Ctrl+X`）

4. 查看日志，确认重载成功

```bash
docker-compose logs -f qwen2api
```

**预期日志**：

```
[CONFIG] 🔥 检测到 .env 文件变化: /app/.env
[CONFIG] 开始重新加载配置...
[CONFIG] 更新环境变量: QWEN_COOKIES
[CONFIG] 检测到 QWEN_COOKIES 变化，清空数据库...
[SQLITE] 所有账户已清空
[ACCOUNT] 配置文件已更新，重新加载账户...
[CONFIG] ✅ 配置重载成功，更新了 1 个环境变量
```

#### 手动触发重载

```bash
curl -X POST http://localhost:3000/api/reloadConfig \
  -H "Authorization: Bearer sk-your-secret-key"
```

---

### 多账户轮询

系统会自动在多个账户之间轮流使用，避免单账户限流。

**配置示例**：

```env
# 配置 3 个账户
QWEN_COOKIES=token=aaa; ssxmod_itna=xxx,token=bbb; ssxmod_itna=yyy,token=ccc; ssxmod_itna=zzz
```

**账户编号规则**：

- 第 1 个 Cookie → `account_1`
- 第 2 个 Cookie → `account_2`
- 第 3 个 Cookie → `account_3`

**轮询策略**：

1. 按顺序轮流使用账户
2. 如果账户失败，自动切换到下一个
3. 失败次数超过阈值的账户会被暂时剔除
4. 定期重置失败计数，重新尝试失效账户

---

### CLI 模式

CLI 模式支持通义千问的高级功能，如联网搜索、图片生成等。

**使用 CLI 端点**：

```bash
curl -X POST http://localhost:3000/cli/v1/chat/completions \
  -H "Authorization: Bearer sk-your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen-max",
    "messages": [{"role": "user", "content": "搜索最新的 AI 新闻"}],
    "stream": false
  }'
```

**CLI 限制**：

- 每个账户每天限制 2000 次请求
- 系统会自动跟踪请求次数
- 超过限制的账户会自动切换

---

## ❓ 常见问题

### 1. Cookie 多久会过期？

通义千问的 Cookie 通常 **7 天**过期。建议定期更新 Cookie，或使用热重载功能快速更新。

### 2. 如何查看账户状态？

```bash
curl http://localhost:3000/api/health \
  -H "Authorization: Bearer sk-your-secret-key"
```

### 3. 热重载不生效怎么办？

**检查步骤**：

1. 确认 `.env` 文件已挂载到容器

```yaml
volumes:
  - ./.env:/app/.env:ro
```

2. 查看日志，确认文件监听已启动

```bash
docker-compose logs qwen2api | grep "文件实时监听"
```

3. 手动触发重载

```bash
curl -X POST http://localhost:3000/api/reloadConfig \
  -H "Authorization: Bearer sk-your-secret-key"
```

### 4. 如何添加新cookie？

**方式一：修改 `.env` 文件**（推荐）

```env
# 在现有 Cookie 后面添加新的 Cookie（用逗号分隔）
QWEN_COOKIES=token=old; ssxmod_itna=xxx,token=new; ssxmod_itna=yyy
```

**方式二：使用 API**

```bash
curl -X POST http://localhost:3000/api/addAccount \
  -H "Authorization: Bearer sk-your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{"num": "3", "cookie": "token=xxx; ssxmod_itna=yyy"}'
```

### 5. 如何删除cookie？

```bash
curl -X DELETE http://localhost:3000/api/deleteAccount/3 \
  -H "Authorization: Bearer sk-your-secret-key"
```

---

## 🛠️ 开发指南

### 项目结构

```
Qwen2api/
├── src/
│   ├── config/              # 配置管理
│   │   └── index.js         # 环境变量配置
│   ├── controllers/         # 控制器
│   │   ├── chat.js          # 标准聊天控制器
│   │   ├── cli.chat.js      # CLI 聊天控制器
│   │   └── models.js        # 模型列表控制器
│   ├── middlewares/         # 中间件
│   │   ├── authorization.js # API 密钥验证
│   │   └── chat-middleware.js # 聊天中间件
│   ├── routes/              # 路由
│   │   ├── chat.js          # 聊天路由
│   │   ├── cli.chat.js      # CLI 聊天路由
│   │   ├── models.js        # 模型路由
│   │   ├── refresh.js       # 账户管理路由
│   │   └── verify.js        # 验证路由
│   ├── utils/               # 工具类
│   │   ├── account.js       # 账户管理器
│   │   ├── account-rotator.js # 账户轮询器
│   │   ├── config-reloader.js # 配置热重载
│   │   ├── data-persistence.js # 数据持久化
│   │   ├── sqlite.js        # SQLite 数据库
│   │   ├── token-manager.js # Token 管理
│   │   └── logger.js        # 日志工具
│   ├── server.js            # Express 服务器
│   └── start.js             # 启动入口
├── .env.example             # 环境变量示例
├── .dockerignore            # Docker 忽略文件
├── .gitignore               # Git 忽略文件
├── Dockerfile               # Docker 镜像配置
├── docker-compose.yml       # Docker Compose 配置
├── package.json             # 项目依赖
└── README.md                # 项目文档
```

### 核心模块说明

#### 1. 账户管理器（`account.js`）

负责账户的加载、验证、轮询和 CLI 初始化。

**核心方法**：

- `loadAccountTokens()` - 加载账户
- `addAccount(accountId, cookie)` - 添加账户
- `removeAccount(accountId)` - 删除账户
- `getHealthStats()` - 获取健康状态

#### 2. 配置热重载（`config-reloader.js`）

使用 `chokidar` 监听 `.env` 文件变化，实时重载配置。

**核心方法**：

- `startWatching()` - 启动文件监听
- `reload()` - 手动重载配置
- `onReload(callback)` - 注册重载回调

#### 3. 数据持久化（`data-persistence.js` + `sqlite.js`）

使用 SQLite（`sql.js`）持久化账户数据。

**核心方法**：

- `loadAccounts()` - 加载账户
- `saveAccount(accountId, account)` - 保存账户
- `deleteAccount(accountId)` - 删除账户
- `clearAllAccounts()` - 清空所有账户

---

## 🙏 致谢

本项目基于 [Rfym21/Qwen2API](https://github.com/Rfym21/Qwen2API) 进行开发和优化。

感谢原作者 [@Rfym21](https://github.com/Rfym21) 提供的优秀基础代码！

---

## 📄 许可证

MIT License
