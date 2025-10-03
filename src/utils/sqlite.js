const fs = require('fs')
const path = require('path')
const initSqlJs = require('sql.js')
const { logger } = require('./logger')

/**
 * SQLite 数据库管理器
 * 使用 sql.js 实现纯 JavaScript 的 SQLite 数据库
 */

// 数据库配置
const DB_CONFIG = {
  dbPath: path.join(process.cwd(), 'data', 'qwen2api.db'),
  autoSaveInterval: 5000 // 5秒自动保存一次
}

// 数据库实例
let db = null
let SQL = null
let autoSaveTimer = null
let operationQueue = Promise.resolve() // 操作队列，确保顺序执行
let isDirty = false // 标记数据是否被修改

/**
 * 初始化 SQLite 数据库
 */
const initDatabase = async () => {
  try {
    // 检查数据库是否有效
    if (db) {
      // 尝试执行一个简单的查询来验证数据库是否可用
      try {
        db.exec('SELECT 1')
        logger.info('SQLite 数据库已初始化', 'SQLITE')
        return db
      } catch (error) {
        // 数据库已关闭或无效，重置变量
        logger.warn('SQLite 数据库已失效，重新初始化...', 'SQLITE')
        // 清理旧的定时器
        stopAutoSave()
        db = null
      }
    }

    logger.info('初始化 SQLite 数据库...', 'SQLITE', '🔌')

    // 初始化 sql.js
    SQL = await initSqlJs()

    // 确保数据目录存在
    const dataDir = path.dirname(DB_CONFIG.dbPath)
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
      logger.info(`创建数据目录: ${dataDir}`, 'SQLITE')
    }

    // 加载或创建数据库
    if (fs.existsSync(DB_CONFIG.dbPath)) {
      try {
        const buffer = fs.readFileSync(DB_CONFIG.dbPath)
        db = new SQL.Database(buffer)
        logger.success('SQLite 数据库加载成功', 'SQLITE')
      } catch (error) {
        logger.error('SQLite 数据库文件损坏，创建备份并重新初始化', 'SQLITE', '', error)

        // 备份损坏的数据库文件
        const backupPath = `${DB_CONFIG.dbPath}.backup.${Date.now()}`
        fs.renameSync(DB_CONFIG.dbPath, backupPath)
        logger.warn(`损坏的数据库已备份到: ${backupPath}`, 'SQLITE')

        // 创建新数据库
        db = new SQL.Database()
        logger.success('SQLite 数据库重新创建成功', 'SQLITE')
      }
    } else {
      db = new SQL.Database()
      logger.success('SQLite 数据库创建成功', 'SQLITE')
    }

    // 创建表
    createTables()

    // 启动自动保存（只在没有定时器时启动）
    if (!autoSaveTimer) {
      startAutoSave()
    }

    logger.success('SQLite 数据库初始化完成', 'SQLITE')
    return db
  } catch (error) {
    logger.error('SQLite 数据库初始化失败', 'SQLITE', '', error)
    throw error
  }
}

/**
 * 创建数据表
 */
const createTables = () => {
  try {
    // 创建账户表
    db.run(`
      CREATE TABLE IF NOT EXISTS accounts (
        accountId TEXT PRIMARY KEY,
        cookie TEXT NOT NULL,
        token TEXT,
        expires INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `)

    logger.success('数据表创建成功', 'SQLITE')
  } catch (error) {
    logger.error('创建数据表失败', 'SQLITE', '', error)
    throw error
  }
}

/**
 * 保存数据库到文件
 */
const saveDatabase = () => {
  try {
    if (!db) {
      return
    }

    const data = db.export()
    const buffer = Buffer.from(data)

    // 先写入临时文件，确保原子性
    const tempPath = `${DB_CONFIG.dbPath}.tmp`
    fs.writeFileSync(tempPath, buffer)

    // 原子性地替换文件
    fs.renameSync(tempPath, DB_CONFIG.dbPath)

    logger.info('SQLite 数据库保存成功', 'SQLITE', '💾')
  } catch (error) {
    logger.error('保存 SQLite 数据库失败', 'SQLITE', '', error)

    // 清理临时文件
    const tempPath = `${DB_CONFIG.dbPath}.tmp`
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath)
      } catch (e) {
        // 忽略清理错误
      }
    }
  }
}

/**
 * 启动自动保存
 */
const startAutoSave = () => {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer)
  }

  autoSaveTimer = setInterval(() => {
    // 只在数据被修改时才保存
    if (isDirty) {
      saveDatabase()
      isDirty = false
      logger.info('自动保存触发（数据已修改）', 'SQLITE', '💾')
    }
  }, DB_CONFIG.autoSaveInterval)

  logger.info(`自动保存已启动 (间隔: ${DB_CONFIG.autoSaveInterval}ms)`, 'SQLITE', '⏰')
}

/**
 * 停止自动保存
 */
const stopAutoSave = () => {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer)
    autoSaveTimer = null
    logger.info('自动保存已停止', 'SQLITE', '⏰')
  }
}

/**
 * 获取所有账户
 * @returns {Promise<Array>} 所有账户信息数组
 */
const getAllAccounts = async () => {
  // 将读操作也加入队列，确保数据一致性
  return new Promise((resolve) => {
    operationQueue = operationQueue.then(async () => {
      let stmt = null
      try {
        await initDatabase()

        stmt = db.prepare('SELECT * FROM accounts')
        const accounts = []

        while (stmt.step()) {
          const row = stmt.getAsObject()
          accounts.push({
            accountId: row.accountId,
            cookie: row.cookie || '',  // 使用 cookie 字段
            token: row.token || '',
            expires: row.expires || 0
          })
        }

        logger.info(`获取到 ${accounts.length} 个账户`, 'SQLITE', '✅')
        resolve(accounts)
      } catch (error) {
        logger.error('获取所有账户失败', 'SQLITE', '', error)
        resolve([])
      } finally {
        // 确保 statement 被释放，避免内存泄漏
        if (stmt) {
          stmt.free()
        }
      }
    }).catch(error => {
      logger.error(`操作队列执行失败`, 'SQLITE', '', error)
      resolve([])
    })
  })
}

/**
 * 设置账户
 * @param {string} accountId - 账户标识
 * @param {Object} value - 账户信息
 * @returns {Promise<boolean>} 设置是否成功
 */
const setAccount = async (accountId, value) => {
  // 创建一个新的 Promise 来跟踪这个特定操作的结果
  return new Promise((resolve) => {
    operationQueue = operationQueue.then(async () => {
      try {
        await initDatabase()

        const { cookie, token, expires } = value
        const now = Math.floor(Date.now() / 1000)

        // 使用 INSERT OR REPLACE 实现 upsert
        db.run(
          `INSERT OR REPLACE INTO accounts (accountId, cookie, token, expires, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          [accountId, cookie || '', token || '', expires || 0, now]
        )

        // 标记数据已修改
        isDirty = true

        logger.success(`账户 ${accountId} 设置成功`, 'SQLITE')
        resolve(true)
      } catch (error) {
        logger.error(`设置账户 ${accountId} 失败`, 'SQLITE', '', error)
        resolve(false)
      }
    }).catch(error => {
      logger.error(`操作队列执行失败`, 'SQLITE', '', error)
      resolve(false)
    })
  })
}

/**
 * 删除账户
 * @param {string} accountId - 账户标识
 * @returns {Promise<boolean>} 删除是否成功
 */
const deleteAccount = async (accountId) => {
  // 创建一个新的 Promise 来跟踪这个特定操作的结果
  return new Promise((resolve) => {
    operationQueue = operationQueue.then(async () => {
      try {
        await initDatabase()

        db.run('DELETE FROM accounts WHERE accountId = ?', [accountId])

        // 标记数据已修改
        isDirty = true

        logger.success(`账户 ${accountId} 删除成功`, 'SQLITE')
        resolve(true)
      } catch (error) {
        logger.error(`删除账户 ${accountId} 失败`, 'SQLITE', '', error)
        resolve(false)
      }
    }).catch(error => {
      logger.error(`操作队列执行失败`, 'SQLITE', '', error)
      resolve(false)
    })
  })
}

/**
 * 检查账户是否存在
 * @param {string} accountId - 账户标识
 * @returns {Promise<boolean>} 账户是否存在
 */
const checkAccountExists = async (accountId) => {
  // 将读操作也加入队列，确保数据一致性
  return new Promise((resolve) => {
    operationQueue = operationQueue.then(async () => {
      let stmt = null
      try {
        await initDatabase()

        stmt = db.prepare('SELECT COUNT(*) as count FROM accounts WHERE accountId = ?')
        stmt.bind([accountId])
        stmt.step()
        const result = stmt.getAsObject()

        const exists = result.count > 0
        logger.info(`账户 ${accountId} ${exists ? '存在' : '不存在'}`, 'SQLITE', exists ? '✅' : '❌')
        resolve(exists)
      } catch (error) {
        logger.error(`检查账户 ${accountId} 时出错`, 'SQLITE', '', error)
        resolve(false)
      } finally {
        // 确保 statement 被释放，避免内存泄漏
        if (stmt) {
          stmt.free()
        }
      }
    }).catch(error => {
      logger.error(`操作队列执行失败`, 'SQLITE', '', error)
      resolve(false)
    })
  })
}

/**
 * 清空所有账户
 * @returns {Promise<boolean>} 清空是否成功
 */
const clearAllAccounts = async () => {
  return new Promise((resolve) => {
    operationQueue = operationQueue.then(async () => {
      try {
        await initDatabase()

        db.run('DELETE FROM accounts')

        // 标记数据已修改
        isDirty = true

        logger.success('所有账户已清空', 'SQLITE')
        resolve(true)
      } catch (error) {
        logger.error('清空所有账户失败', 'SQLITE', '', error)
        resolve(false)
      }
    }).catch(error => {
      logger.error(`操作队列执行失败`, 'SQLITE', '', error)
      resolve(false)
    })
  })
}

/**
 * 获取数据库状态
 * @returns {Object} 数据库状态信息
 */
const getDatabaseStatus = async () => {
  // 将读操作也加入队列，确保数据一致性
  return new Promise((resolve) => {
    operationQueue = operationQueue.then(async () => {
      let stmt = null
      try {
        await initDatabase()

        stmt = db.prepare('SELECT COUNT(*) as count FROM accounts')
        stmt.step()
        const result = stmt.getAsObject()

        resolve({
          initialized: !!db,
          dbPath: DB_CONFIG.dbPath,
          accountCount: result.count,
          autoSaveInterval: DB_CONFIG.autoSaveInterval,
          isDirty: isDirty
        })
      } catch (error) {
        logger.error('获取数据库状态失败', 'SQLITE', '', error)
        resolve({
          initialized: false,
          dbPath: DB_CONFIG.dbPath,
          accountCount: 0,
          autoSaveInterval: DB_CONFIG.autoSaveInterval,
          isDirty: false
        })
      } finally {
        // 确保 statement 被释放，避免内存泄漏
        if (stmt) {
          stmt.free()
        }
      }
    }).catch(error => {
      logger.error(`操作队列执行失败`, 'SQLITE', '', error)
      resolve({
        initialized: false,
        dbPath: DB_CONFIG.dbPath,
        accountCount: 0,
        autoSaveInterval: DB_CONFIG.autoSaveInterval,
        isDirty: false
      })
    })
  })
}

/**
 * 关闭数据库
 */
const closeDatabase = async () => {
  try {
    stopAutoSave()

    if (db) {
      saveDatabase()
      db.close()
      db = null
      logger.success('SQLite 数据库已关闭', 'SQLITE')
    }
  } catch (error) {
    logger.error('关闭 SQLite 数据库失败', 'SQLITE', '', error)
  }
}

/**
 * 清理资源（用于应用关闭时）- 异步版本
 */
const cleanup = async () => {
  logger.info('清理 SQLite 数据库...', 'SQLITE', '🧹')
  await closeDatabase()
}

/**
 * 清理资源（用于应用关闭时）- 同步版本
 * 用于 process.on('exit') 事件，因为该事件不支持异步操作
 */
const cleanupSync = () => {
  logger.info('清理资源...', 'SYSTEM', '🧹')

  // 清理账户管理器
  try {
    const accountManager = require('./account')
    if (accountManager && accountManager.destroy) {
      accountManager.destroy()
      logger.info('账户管理器已清理', 'SYSTEM')
    }
  } catch (error) {
    // 忽略错误，可能是循环依赖导致的
  }

  // 清理 SQLite 数据库
  stopAutoSave()

  if (db) {
    try {
      // 同步保存数据库
      const data = db.export()
      const buffer = Buffer.from(data)
      fs.writeFileSync(DB_CONFIG.dbPath, buffer)
      logger.success('SQLite 数据库保存成功', 'SQLITE', '💾')

      // 关闭数据库
      db.close()
      db = null
      logger.success('SQLite 数据库已关闭', 'SQLITE')
    } catch (error) {
      logger.error('关闭 SQLite 数据库失败', 'SQLITE', '', error)
    }
  }
}

// 创建 SQLite 客户端对象
const sqliteClient = {
  initDatabase,
  getAllAccounts,
  setAccount,
  deleteAccount,
  clearAllAccounts,
  checkAccountExists,
  getDatabaseStatus,
  closeDatabase,
  cleanup,
  cleanupSync,
  saveDatabase
}

// 进程退出时清理连接
// 使用同步版本确保数据不丢失
process.on('exit', cleanupSync)
process.on('SIGINT', () => {
  cleanupSync()
  process.exit(0)
})
process.on('SIGTERM', () => {
  cleanupSync()
  process.exit(0)
})

module.exports = sqliteClient

