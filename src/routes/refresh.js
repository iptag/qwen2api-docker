const express = require('express')
const router = express.Router()
const accountManager = require('../utils/account')
const { logger } = require('../utils/logger')
const { apiKeyVerify } = require('../middlewares/authorization')
const configReloader = require('../utils/config-reloader')

/**
 * POST /api/addAccount
 * 添加新账户
 *
 * @param {string} num - 账户编号（必填，如 "1", "2", "3"）
 * @param {string} cookie - 完整的 Cookie 字符串（必填）
 * @returns {Object} 添加结果
 */
router.post('/api/addAccount', apiKeyVerify, async (req, res) => {
  try {
    const { num, cookie } = req.body

    // 验证必填参数
    if (!num || !cookie) {
      return res.status(400).json({
        success: false,
        error: '账户编号（num）和 Cookie 不能为空'
      })
    }

    // 生成账户标识（格式：account_1, account_2, ...）
    const accountId = `account_${num}`

    // 使用 accountManager.addAccount() 方法（自动处理内存和数据库同步）
    const success = await accountManager.addAccount(accountId, cookie)

    if (!success) {
      return res.status(400).json({
        success: false,
        error: '添加账户失败（账户可能已存在或 Cookie 无效）'
      })
    }

    // 获取添加的账户信息
    const account = accountManager.accountTokens.find(acc => acc.accountId === accountId)

    res.json({
      success: true,
      message: `账户 #${num} 添加成功`,
      account: {
        num,
        accountId,
        hasToken: !!(account && account.token),
        expires: account && account.expires > 0 ? new Date(account.expires * 1000).toLocaleString() : '未设置'
      }
    })
  } catch (error) {
    logger.error('添加账户失败', 'ACCOUNT', '', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/reloadConfig
 * 手动重新加载配置文件（.env）
 *
 * 用途：当修改 .env 文件后，可以通过此接口立即重载配置，无需重启容器
 *
 * @returns {Object} 重载结果
 */
router.post('/api/reloadConfig', apiKeyVerify, async (req, res) => {
  try {
    logger.info('收到手动重载配置请求', 'CONFIG')

    // 执行配置重载
    const success = await configReloader.reload()

    if (success) {
      // 获取重载后的账户状态
      const healthStats = accountManager.getHealthStats()

      res.json({
        success: true,
        message: '配置重载成功',
        data: {
          reloadedAt: new Date().toISOString(),
          configStatus: configReloader.getStatus(),
          accountsHealth: healthStats
        }
      })
    } else {
      res.json({
        success: false,
        message: '配置无变化或重载失败',
        data: {
          configStatus: configReloader.getStatus()
        }
      })
    }
  } catch (error) {
    logger.error('手动重载配置失败', 'CONFIG', '', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/configStatus
 * 获取配置重载器状态
 *
 * @returns {Object} 配置状态信息
 */
router.get('/api/configStatus', apiKeyVerify, async (req, res) => {
  try {
    const status = configReloader.getStatus()

    res.json({
      success: true,
      data: status
    })
  } catch (error) {
    logger.error('获取配置状态失败', 'CONFIG', '', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

module.exports = router

