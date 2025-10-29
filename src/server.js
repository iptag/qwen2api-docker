const express = require('express')
const bodyParser = require('body-parser')
const config = require('./config/index.js')
const cors = require('cors')
const { logger } = require('./utils/logger')
const app = express()
const path = require('path')
const fs = require('fs')
const modelsRouter = require('./routes/models.js')
const chatRouter = require('./routes/chat.js')
const cliChatRouter = require('./routes/cli.chat.js')
const verifyRouter = require('./routes/verify.js')
const refreshRouter = require('./routes/refresh.js')

app.use(bodyParser.json({ limit: '128mb' }))
app.use(bodyParser.urlencoded({ limit: '128mb', extended: true }))
app.use(cors())

// API路由
app.use(modelsRouter)
app.use(chatRouter)
app.use(cliChatRouter)
app.use(verifyRouter)
app.use(refreshRouter)

// 根路径返回 API 信息
app.get('/', (req, res) => {
  res.json({
    name: 'Qwen2API',
    version: '2025.09.30',
    status: 'running',
    description: 'Qwen API 代理服务（Cookie 管理模式）',
    endpoints: {
      models: '/v1/models',
      chat: '/v1/chat/completions',
      cli_chat: '/cli/v1/chat/completions',
      add_account: '/api/addAccount',
      accounts_health: '/api/accountsHealth',
      reload_config: '/api/reloadConfig',
      config_status: '/api/configStatus'
    }
  })
})

// 处理错误中间件（必须放在所有路由之后）
app.use((err, req, res, next) => {
  logger.error('服务器内部错误', 'SERVER', '', err)
  res.status(500).send('服务器内部错误')
})


// 服务器启动信息
const serverInfo = {
  address: config.listenAddress || 'localhost',
  port: config.listenPort,
  outThink: config.outThink ? '开启' : '关闭',
  searchInfoMode: config.searchInfoMode === 'table' ? '表格' : '文本',
  dataSaveMode: 'sqlite',
  logLevel: config.logLevel,
  enableFileLog: config.enableFileLog
}

if (config.listenAddress) {
  app.listen(config.listenPort, config.listenAddress, () => {
    logger.server('服务器启动成功', 'SERVER', serverInfo)
  })
} else {
  app.listen(config.listenPort, () => {
    logger.server('服务器启动成功', 'SERVER', serverInfo)
  })
}