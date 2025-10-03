const sqliteClient = require('./sqlite')
const { logger } = require('./logger')

/**
 * 数据持久化管理器
 * 使用 SQLite 数据库进行数据持久化
 */
class DataPersistence {
  /**
   * 加载所有账户数据
   * @returns {Promise<Array>} 账户列表
   */
  async loadAccounts() {
    try {
      // 先从数据库加载
      let accounts = await sqliteClient.getAllAccounts()

      // 如果数据库为空，尝试从环境变量加载
      if (accounts.length === 0) {
        logger.info('数据库中没有账户，尝试从环境变量加载...', 'DATA')
        accounts = await this._loadAccountsFromEnv()

        // 如果从环境变量加载成功，保存到数据库
        if (accounts.length > 0) {
          logger.info(`从环境变量加载了 ${accounts.length} 个账户，正在保存到数据库...`, 'DATA')
          await this.saveAllAccounts(accounts)
          logger.success(`成功保存 ${accounts.length} 个账户到数据库`, 'DATA')
        }
      }

      return accounts
    } catch (error) {
      logger.error('加载账户数据失败', 'DATA', '', error)
      return []
    }
  }

  /**
   * 从环境变量加载账户
   * 参考 OCR 项目的实现，直接解析 Cookie 列表
   * 自动从 JWT Token 中提取账户标识
   * @private
   * @returns {Promise<Array>} 账户列表
   */
  async _loadAccountsFromEnv() {
    try {
      // 从环境变量读取 Cookie 配置
      const cookiesEnv = process.env.QWEN_COOKIES

      if (!cookiesEnv) {
        logger.warn('环境变量 QWEN_COOKIES 未设置', 'DATA')
        return []
      }

      // 解析 Cookie 列表（多个账户用逗号分隔）
      // 格式：token=xxx; ssxmod_itna=xxx,token=yyy; ssxmod_itna=yyy
      const cookieList = cookiesEnv.split(',').map(item => item.trim()).filter(item => item)
      const accounts = []
      const TokenManager = require('./token-manager')
      const tokenManager = new TokenManager()

      for (let i = 0; i < cookieList.length; i++) {
        const cookie = cookieList[i]

        if (!cookie) {
          logger.warn(`跳过无效的 Cookie 配置 #${i + 1}`, 'DATA')
          continue
        }

        // 从 Cookie 中提取账户信息
        const accountInfo = tokenManager.extractAccountFromCookie(cookie)

        if (!accountInfo) {
          logger.warn(`跳过无效的 Cookie #${i + 1}（无法提取 Token）`, 'DATA')
          continue
        }

        // 使用编号作为账户标识（account_1, account_2, ...）
        const accountNum = i + 1
        accountInfo.accountId = `account_${accountNum}`
        accountInfo.cookie = cookie

        accounts.push(accountInfo)
        logger.success(`✅ 成功解析账户 #${accountNum}: ${accountInfo.accountId}`, 'DATA')
      }

      if (accounts.length > 0) {
        logger.success(`从环境变量解析了 ${accounts.length} 个账户`, 'DATA')
      } else {
        logger.warn('环境变量 QWEN_COOKIES 中没有有效的账户配置', 'DATA')
      }

      return accounts
    } catch (error) {
      logger.error('从环境变量加载账户失败', 'DATA', '', error)
      return []
    }
  }

  /**
   * 保存单个账户数据
   * @param {string} accountId - 账户标识
   * @param {Object} accountData - 账户数据
   * @returns {Promise<boolean>} 保存是否成功
   */
  async saveAccount(accountId, accountData) {
    try {
      return await sqliteClient.setAccount(accountId, accountData)
    } catch (error) {
      logger.error(`保存账户数据失败 (${accountId})`, 'DATA', '', error)
      return false
    }
  }

  /**
   * 批量保存账户数据
   * @param {Array} accounts - 账户列表
   * @returns {Promise<boolean>} 保存是否成功
   */
  async saveAllAccounts(accounts) {
    try {
      let successCount = 0
      for (const account of accounts) {
        const success = await sqliteClient.setAccount(account.accountId, account)
        if (success) successCount++
      }
      return successCount === accounts.length
    } catch (error) {
      logger.error('批量保存账户数据失败', 'DATA', '', error)
      return false
    }
  }

  /**
   * 删除账户数据
   * @param {string} accountId - 账户标识
   * @returns {Promise<boolean>} 删除是否成功
   */
  async deleteAccount(accountId) {
    try {
      return await sqliteClient.deleteAccount(accountId)
    } catch (error) {
      logger.error(`删除账户数据失败 (${accountId})`, 'DATA', '', error)
      return false
    }
  }
}

module.exports = DataPersistence
