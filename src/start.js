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
// 注意：不直接退出进程，避免单个错误导致生产环境完全停机
// 应配合进程监控工具（PM2/systemd/Docker restart policy）处理严重故障
process.on('uncaughtException', (error) => {
  logger.error('未捕获的异常', 'START', '', error)
  // 移除 process.exit(1) - 记录错误但保持服务运行
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的Promise拒绝', 'START', '', reason)
  // 移除 process.exit(1) - 防止 Promise 错误导致服务中断
})
