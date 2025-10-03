const { logger } = require('./utils/logger')

// 加载环境变量
require('dotenv').config()

// 获取环境变量配置
const SERVICE_PORT = process.env.SERVICE_PORT || 3000
const NODE_ENV = process.env.NODE_ENV || 'production'

// 启动信息
logger.info('🚀 Qwen2API 启动', 'START')
logger.info(`服务端口: ${SERVICE_PORT}`, 'START')
logger.info(`运行环境: ${NODE_ENV}`, 'START')
logger.info(`进程ID: ${process.pid}`, 'START')

// 直接启动服务器
require('./server.js')

// 优雅关闭处理
process.on('SIGTERM', () => {
  logger.info('收到SIGTERM信号，正在关闭...', 'START')
  process.exit(0)
})

process.on('SIGINT', () => {
  logger.info('收到SIGINT信号，正在关闭...', 'START')
  process.exit(0)
})

// 未捕获的异常处理
process.on('uncaughtException', (error) => {
  logger.error('未捕获的异常', 'START', '', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的Promise拒绝', 'START', '', reason)
  process.exit(1)
})
