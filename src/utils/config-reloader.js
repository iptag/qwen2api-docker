const fs = require('fs')
const path = require('path')
const chokidar = require('chokidar')
const { logger } = require('./logger')

/**
 * 配置热重载管理器
 * 负责监听 .env 文件变化并重新加载环境变量
 * 使用 chokidar 实现实时文件监听
 */
class ConfigReloader {
  constructor() {
    this.envPath = path.resolve(process.cwd(), '.env')
    this.reloadCallbacks = []
    this.watcher = null
    this.debounceTimer = null
    this.debounceDelay = 500 // 防抖延迟（毫秒）
  }

  /**
   * 注册重载回调函数
   * @param {Function} callback - 重载时执行的回调函数
   */
  onReload(callback) {
    if (typeof callback === 'function') {
      this.reloadCallbacks.push(callback)
    }
  }

  /**
   * 手动重新加载配置
   * @returns {Promise<boolean>} 重载是否成功
   */
  async reload() {
    try {
      logger.info('开始重新加载配置...', 'CONFIG')

      // 检查 .env 文件是否存在
      if (!fs.existsSync(this.envPath)) {
        logger.warn('.env 文件不存在，跳过重载', 'CONFIG')
        return false
      }

      // 读取 .env 文件内容
      const envContent = fs.readFileSync(this.envPath, 'utf8')

      // 解析环境变量
      const envVars = this._parseEnvFile(envContent)

      // 检查哪些变量发生了变化
      const changedVars = []
      let updatedCount = 0

      for (const [key, value] of Object.entries(envVars)) {
        if (process.env[key] !== value) {
          process.env[key] = value
          updatedCount++
          changedVars.push(key)
          logger.info(`更新环境变量: ${key}`, 'CONFIG')
        }
      }

      if (updatedCount === 0) {
        logger.info('环境变量无变化', 'CONFIG')
        return false
      }

      // 如果 QWEN_COOKIES 变化，清空数据库
      if (changedVars.includes('QWEN_COOKIES')) {
        logger.info('检测到 QWEN_COOKIES 变化，清空数据库...', 'CONFIG')
        const sqliteClient = require('./sqlite')
        await sqliteClient.clearAllAccounts()
      }

      // 执行所有回调
      for (const callback of this.reloadCallbacks) {
        try {
          await callback()
        } catch (error) {
          logger.error('执行重载回调失败', 'CONFIG', '', error)
        }
      }

      logger.success(`✅ 配置重载成功，更新了 ${updatedCount} 个环境变量`, 'CONFIG')
      return true
    } catch (error) {
      logger.error('重新加载配置失败', 'CONFIG', '', error)
      return false
    }
  }

  /**
   * 启动实时文件监听
   * 使用 chokidar 监听 .env 文件变化，实时触发重载
   */
  startWatching() {
    if (this.watcher) {
      logger.warn('文件监听已在运行', 'CONFIG')
      return
    }

    if (!fs.existsSync(this.envPath)) {
      logger.warn(`.env 文件不存在: ${this.envPath}，跳过监听`, 'CONFIG')
      return
    }

    logger.info(`启动 .env 文件实时监听: ${this.envPath}`, 'CONFIG')

    // 创建文件监听器
    this.watcher = chokidar.watch(this.envPath, {
      persistent: true,
      ignoreInitial: true,  // 忽略初始添加事件
      awaitWriteFinish: {   // 等待文件写入完成
        stabilityThreshold: 300,  // 文件稳定后 300ms 触发
        pollInterval: 100
      }
    })

    // 监听文件变化事件
    this.watcher.on('change', (filePath) => {
      logger.info(`🔥 检测到 .env 文件变化: ${filePath}`, 'CONFIG')

      // 使用防抖，避免短时间内多次触发
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer)
      }

      this.debounceTimer = setTimeout(async () => {
        await this.reload()
      }, this.debounceDelay)
    })

    // 监听错误事件
    this.watcher.on('error', (error) => {
      logger.error('文件监听出错', 'CONFIG', '', error)
    })

    logger.success('✅ .env 文件实时监听已启动', 'CONFIG')
  }

  /**
   * 停止文件监听
   */
  stopWatching() {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
      logger.info('已停止 .env 文件监听', 'CONFIG')
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }

  /**
   * 解析 .env 文件内容
   * @param {string} content - .env 文件内容
   * @returns {Object} 环境变量键值对
   * @private
   */
  _parseEnvFile(content) {
    const envVars = {}
    const lines = content.split('\n')

    for (const line of lines) {
      // 跳过空行和注释
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) {
        continue
      }

      // 解析 KEY=VALUE
      const match = trimmed.match(/^([^=]+)=(.*)$/)
      if (match) {
        const key = match[1].trim()
        let value = match[2].trim()

        // 移除引号
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }

        envVars[key] = value
      }
    }

    return envVars
  }

  /**
   * 获取当前配置状态
   * @returns {Object} 配置状态信息
   */
  getStatus() {
    let lastModified = null
    if (fs.existsSync(this.envPath)) {
      const stats = fs.statSync(this.envPath)
      lastModified = stats.mtime.toISOString()
    }

    return {
      envPath: this.envPath,
      envExists: fs.existsSync(this.envPath),
      lastModified,
      watchingEnabled: !!this.watcher,
      watchingMode: 'real-time (chokidar)',
      debounceDelay: this.debounceDelay,
      callbacksCount: this.reloadCallbacks.length
    }
  }
}

// 导出单例
module.exports = new ConfigReloader()

