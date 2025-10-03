const { logger } = require('./logger')

/**
 * 账户轮询管理器
 * 负责账户的轮询选择和负载均衡
 */
class AccountRotator {
  constructor() {
    this.accounts = []
    this.currentIndex = 0
    this.lastUsedTimes = new Map() // 记录每个账户的最后使用时间
    this.failureCounts = new Map() // 记录每个账户的失败次数
    this.maxFailures = 3 // 最大失败次数
    this.cooldownPeriod = 5 * 60 * 1000 // 5分钟冷却期
  }

  /**
   * 设置账户列表
   * @param {Array} accounts - 账户列表
   */
  setAccounts(accounts) {
    if (!Array.isArray(accounts)) {
      logger.error('账户列表必须是数组', 'ACCOUNT')
      throw new Error('账户列表必须是数组')
    }
    
    this.accounts = [...accounts]
    this.currentIndex = 0
    
    // 清理不存在账户的记录
    this._cleanupRecords()
  }

  /**
   * 获取下一个可用的账户令牌
   * @returns {string|null} 账户令牌或null
   */
  getNextToken() {
    if (this.accounts.length === 0) {
      logger.error('没有可用的账户', 'ACCOUNT')
      return null
    }

    const availableAccounts = this._getAvailableAccounts()
    if (availableAccounts.length === 0) {
      logger.warn('所有账户都不可用，使用轮询策略', 'ACCOUNT')
      return this._getTokenByRoundRobin()
    }

    // 从可用账户中选择最少使用的
    const selectedAccount = this._selectLeastUsedAccount(availableAccounts)
    this._recordUsage(selectedAccount.accountId)

    return selectedAccount.token
  }

  /**
   * 获取指定账户的令牌
   * @param {string} accountId - 账户标识
   * @returns {string|null} 账户令牌或null
   */
  getTokenByAccountId(accountId) {
    const account = this.accounts.find(acc => acc.accountId === accountId)
    if (!account) {
      logger.error(`未找到账户: ${accountId}`, 'ACCOUNT')
      return null
    }

    if (!this._isAccountAvailable(account)) {
      logger.warn(`账户 ${accountId} 当前不可用`, 'ACCOUNT')
      return null
    }

    this._recordUsage(accountId)
    return account.token
  }

  /**
   * 记录账户使用失败
   * @param {string} accountId - 账户标识
   */
  recordFailure(accountId) {
    const currentFailures = this.failureCounts.get(accountId) || 0
    this.failureCounts.set(accountId, currentFailures + 1)

    if (currentFailures + 1 >= this.maxFailures) {
      logger.warn(`账户 ${accountId} 失败次数达到上限，将进入冷却期`, 'ACCOUNT')
    }
  }

  /**
   * 重置账户失败计数
   * @param {string} accountId - 账户标识
   */
  resetFailures(accountId) {
    this.failureCounts.delete(accountId)
  }

  /**
   * 获取账户统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    const total = this.accounts.length
    const available = this._getAvailableAccounts().length
    const inCooldown = total - available

    const usageStats = {}
    this.accounts.forEach(account => {
      const accountId = account.accountId
      usageStats[accountId] = {
        failures: this.failureCounts.get(accountId) || 0,
        lastUsed: this.lastUsedTimes.get(accountId) || null,
        available: this._isAccountAvailable(account)
      }
    })

    return {
      total,
      available,
      inCooldown,
      currentIndex: this.currentIndex,
      usageStats
    }
  }

  /**
   * 获取可用账户列表
   * @private
   */
  _getAvailableAccounts() {
    return this.accounts.filter(account => this._isAccountAvailable(account))
  }

  /**
   * 检查账户是否可用
   * @param {Object} account - 账户对象
   * @returns {boolean} 是否可用
   * @private
   */
  _isAccountAvailable(account) {
    if (!account.token) {
      return false
    }

    const failures = this.failureCounts.get(account.accountId) || 0
    if (failures >= this.maxFailures) {
      const lastUsed = this.lastUsedTimes.get(account.accountId)
      if (lastUsed && Date.now() - lastUsed < this.cooldownPeriod) {
        return false // 仍在冷却期
      } else {
        // 冷却期结束，重置失败计数
        this.failureCounts.delete(account.accountId)
      }
    }

    return true
  }

  /**
   * 选择最少使用的账户
   * @param {Array} accounts - 可用账户列表
   * @returns {Object} 选中的账户
   * @private
   */
  _selectLeastUsedAccount(accounts) {
    if (accounts.length === 1) {
      return accounts[0]
    }

    // 按最后使用时间排序，选择最久未使用的
    return accounts.reduce((least, current) => {
      const leastLastUsed = this.lastUsedTimes.get(least.accountId) || 0
      const currentLastUsed = this.lastUsedTimes.get(current.accountId) || 0

      return currentLastUsed < leastLastUsed ? current : least
    })
  }

  /**
   * 轮询策略获取令牌
   * @returns {string|null} 账户令牌或null
   * @private
   */
  _getTokenByRoundRobin() {
    if (this.currentIndex >= this.accounts.length) {
      this.currentIndex = 0
    }

    const account = this.accounts[this.currentIndex]
    this.currentIndex++

    if (account && account.token) {
      this._recordUsage(account.accountId)
      return account.token
    }

    // 如果当前账户无效，尝试下一个
    if (this.currentIndex < this.accounts.length) {
      return this._getTokenByRoundRobin()
    }

    return null
  }

  /**
   * 记录账户使用
   * @param {string} accountId - 账户标识
   * @private
   */
  _recordUsage(accountId) {
    this.lastUsedTimes.set(accountId, Date.now())
  }

  /**
   * 清理不存在账户的记录
   * @private
   */
  _cleanupRecords() {
    const currentAccountIds = new Set(this.accounts.map(acc => acc.accountId))

    // 清理失败计数记录
    for (const accountId of this.failureCounts.keys()) {
      if (!currentAccountIds.has(accountId)) {
        this.failureCounts.delete(accountId)
      }
    }

    // 清理使用时间记录
    for (const accountId of this.lastUsedTimes.keys()) {
      if (!currentAccountIds.has(accountId)) {
        this.lastUsedTimes.delete(accountId)
      }
    }
  }

  /**
   * 重置所有统计数据
   */
  reset() {
    this.currentIndex = 0
    this.lastUsedTimes.clear()
    this.failureCounts.clear()
  }
}

module.exports = AccountRotator
