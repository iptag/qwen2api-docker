const config = require('../config/index.js')
const DataPersistence = require('./data-persistence')
const TokenManager = require('./token-manager')
const AccountRotator = require('./account-rotator')
const { logger } = require('./logger')
const configReloader = require('./config-reloader')
/**
 * 账户管理器
 * 统一管理账户、令牌、模型等功能
 */
class Account {
    constructor() {
        // 初始化各个管理器
        this.dataPersistence = new DataPersistence()
        this.tokenManager = new TokenManager()
        this.accountRotator = new AccountRotator()

        // 账户数据
        this.accountTokens = []
        this.isInitialized = false

        // 配置信息
        this.defaultHeaders = config.defaultHeaders || {}

        // cli请求次数定时刷新器
        this.cliRequestNumberInterval = null
        this.cliDailyResetInterval = null

        // 初始化
        this._initialize()
    }

    /**
     * 异步初始化
     * @private
     */
    async _initialize() {
        try {
            // 加载账户信息
            await this.loadAccountTokens()

            // 注册配置热重载回调
            configReloader.onReload(async () => {
                logger.info('配置文件已更新，重新加载账户...', 'ACCOUNT')
                await this.loadAccountTokens()
            })

            // 启动实时文件监听（使用 chokidar）
            configReloader.startWatching()

            this.isInitialized = true
            logger.success(`账户管理器初始化完成，共加载 ${this.accountTokens.length} 个账户`, 'ACCOUNT')
        } catch (error) {
            logger.error('账户管理器初始化失败', 'ACCOUNT', '', error)
        }
    }

    /**
     * 加载账户令牌数据
     * @returns {Promise<void>}
     */
    async loadAccountTokens() {
        try {
            // 清理旧的 CLI 定时器（防止内存泄漏）
            this.accountTokens.forEach(account => {
                if (account.cli_info && account.cli_info.refresh_token_interval) {
                    clearInterval(account.cli_info.refresh_token_interval)
                    account.cli_info.refresh_token_interval = null
                    logger.info(`清理账户 ${account.accountId} 的 CLI 定时器`, 'ACCOUNT')
                }
            })

            // 清理全局定时器，防止热重载时泄漏
            if (this.cliRequestNumberInterval) {
                clearTimeout(this.cliRequestNumberInterval)
                this.cliRequestNumberInterval = null
                logger.info('清理全局 CLI 请求计数定时器', 'ACCOUNT')
            }
            if (this.cliDailyResetInterval) {
                clearInterval(this.cliDailyResetInterval)
                this.cliDailyResetInterval = null
                logger.info('清理全局 CLI 每日重置定时器', 'ACCOUNT')
            }

            this.accountTokens = await this.dataPersistence.loadAccounts()

            // 验证和清理无效令牌
            await this._validateAndCleanTokens()

            // 更新账户轮询器
            this.accountRotator.setAccounts(this.accountTokens)

            // 初始化 CLI 账户（只初始化还没有 CLI 信息的账户）
            if (this.accountTokens.length > 0) {
                // 找到一个有有效令牌但还没有 CLI 信息的账户
                const validAccount = this.accountTokens.find(account =>
                    account.token && account.token !== '' && !account.cli_info
                )

                if (validAccount) {
                    logger.info(`初始化 CLI 账户, 随机初始化账号: ${validAccount.accountId}`, 'ACCOUNT')
                    await this._initializeCliAccount(validAccount)
                } else {
                    logger.info('所有账户已初始化或没有有效令牌', 'ACCOUNT')
                }
            }

            // 设置cli定时器 每天00:00:00刷新请求次数
            this._setupDailyResetTimer()

            logger.success(`成功加载 ${this.accountTokens.length} 个账户`, 'ACCOUNT')
        } catch (error) {
            logger.error('加载账户令牌失败', 'ACCOUNT', '', error)
            this.accountTokens = []
        }
    }



    /**
     * 初始化CLI账户
     * @param {Object} account - 账户对象
     * @private
     */
    async _initializeCliAccount(account) {
        try {
            // 检查账户是否有有效令牌
            if (!account.token || account.token === '') {
                logger.warn(`账户 ${account.accountId} 没有有效令牌，跳过 CLI 初始化`, 'CLI')
                return
            }

            const cliManager = require('./cli.manager')
            const cliAccount = await cliManager.initCliAccount(account.token)

            if (cliAccount.access_token && cliAccount.refresh_token && cliAccount.expiry_date) {
                account.cli_info = {
                    access_token: cliAccount.access_token,
                    refresh_token: cliAccount.refresh_token,
                    expiry_date: cliAccount.expiry_date,
                    refresh_token_interval: setInterval(async () => {
                        try {
                            const refreshToken = await cliManager.refreshAccessToken({
                                access_token: account.cli_info.access_token,
                                refresh_token: account.cli_info.refresh_token,
                                expiry_date: account.cli_info.expiry_date
                            })
                            if (refreshToken.access_token && refreshToken.refresh_token && refreshToken.expiry_date) {
                                account.cli_info.access_token = refreshToken.access_token
                                account.cli_info.refresh_token = refreshToken.refresh_token
                                account.cli_info.expiry_date = refreshToken.expiry_date
                                logger.info(`CLI账户 ${account.accountId} 令牌刷新成功`, 'CLI')
                            }
                        } catch (error) {
                            logger.error(`CLI账户 ${account.accountId} 令牌刷新失败`, 'CLI', '', error)
                        }
                        // 每2小时刷新一次
                    }, 1000 * 60 * 60 * 2),
                    request_number: 0
                }
                logger.success(`CLI账户 ${account.accountId} 初始化成功`, 'CLI')
            } else {
                logger.error(`CLI账户 ${account.accountId} 初始化失败：无效的响应数据`, 'CLI')
            }
        } catch (error) {
            logger.error(`CLI账户 ${account.accountId} 初始化失败`, 'CLI', '', error)
        }
    }

    /**
     * 设置每日重置定时器
     * @private
     */
    _setupDailyResetTimer() {
        logger.info('设置CLI请求次数每日重置定时器', 'CLI')

        // 计算到下一天00:00:00的毫秒数
        const now = new Date()
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0)
        const timeDiff = tomorrow.getTime() - now.getTime()

        logger.info(`距离下次重置还有 ${Math.round(timeDiff / 1000 / 60)} 分钟`, 'CLI')

        // 首次执行使用setTimeout
        this.cliRequestNumberInterval = setTimeout(() => {
            // 重置所有CLI账户的请求次数
            this._resetCliRequestNumbers()

            // 设置每24小时执行一次的定时器
            this.cliDailyResetInterval = setInterval(() => {
                this._resetCliRequestNumbers()
            }, 24 * 60 * 60 * 1000)
        }, timeDiff)
    }

    /**
     * 重置CLI请求次数
     * @private
     */
    _resetCliRequestNumbers() {
        const cliAccounts = this.accountTokens.filter(account => account.cli_info)
        cliAccounts.forEach(account => {
            account.cli_info.request_number = 0
        })
        logger.info(`已重置 ${cliAccounts.length} 个CLI账户的请求次数`, 'CLI')
    }

    /**
     * 验证和清理无效令牌
     * @private
     */
    async _validateAndCleanTokens() {
        const validAccounts = []

        for (const account of this.accountTokens) {
            // 从 cookie 提取 token
            if (account.cookie) {
                const token = this.tokenManager.extractTokenFromCookie(account.cookie)
                if (token) {
                    const decoded = this.tokenManager.validateToken(token)
                    if (decoded) {
                        account.token = token
                        account.expires = decoded.exp
                        validAccounts.push(account)
                        logger.success(`账户 ${account.accountId} Token 有效，过期时间: ${new Date(decoded.exp * 1000).toLocaleString()}`, 'TOKEN')
                    } else {
                        logger.warn(`账户 ${account.accountId} 的 Token 已过期`, 'TOKEN')
                        account.token = ''
                        account.expires = 0
                        validAccounts.push(account)
                    }
                } else {
                    logger.warn(`账户 ${account.accountId} 的 Cookie 无效`, 'TOKEN')
                    account.token = ''
                    account.expires = 0
                    validAccounts.push(account)
                }
            } else {
                logger.warn(`账户 ${account.accountId} 没有 Cookie`, 'TOKEN')
                account.token = ''
                account.expires = 0
                validAccounts.push(account)
            }
        }

        this.accountTokens = validAccounts
    }




    /**
     * 获取可用的账户令牌
     * @returns {string|null} 账户令牌或null
     */
    getAccountToken() {
        if (!this.isInitialized) {
            logger.warn('账户管理器尚未初始化完成', 'ACCOUNT')
            return null
        }

        if (this.accountTokens.length === 0) {
            logger.error('没有可用的账户令牌', 'ACCOUNT')
            return null
        }

        const token = this.accountRotator.getNextToken()
        if (!token) {
            logger.error('所有账户令牌都不可用', 'ACCOUNT')
        }

        return token
    }

    /**
     * 根据账户标识获取特定账户的令牌
     * @param {string} accountId - 账户标识
     * @returns {string|null} 账户令牌或null
     */
    getTokenByAccountId(accountId) {
        return this.accountRotator.getTokenByAccountId(accountId)
    }

    /**
     * 生成 Markdown 表格
     * @param {Array} websites - 网站信息数组
     * @param {string} mode - 模式 ('table' 或 'text')
     * @returns {Promise<string>} Markdown 字符串
     */
    async generateMarkdownTable(websites, mode) {
        // 输入校验
        if (!Array.isArray(websites) || websites.length === 0) {
            return ''
        }

        let markdown = ''
        if (mode === 'table') {
            markdown += '| **序号** | **网站URL** | **来源** |\n'
            markdown += '|:---|:---|:---|\n'
        }

        // 默认值
        const DEFAULT_TITLE = '未知标题'
        const DEFAULT_URL = 'https://www.baidu.com'
        const DEFAULT_HOSTNAME = '未知来源'

        // 表格内容
        websites.forEach((site, index) => {
            const { title, url, hostname } = site
            // 处理字段值，若为空则使用默认值
            const urlCell = `[${title || DEFAULT_TITLE}](${url || DEFAULT_URL})`
            const hostnameCell = hostname || DEFAULT_HOSTNAME
            if (mode === 'table') {
                markdown += `| ${index + 1} | ${urlCell} | ${hostnameCell} |\n`
            } else {
                markdown += `[${index + 1}] ${urlCell} | 来源: ${hostnameCell}\n`
            }
        })

        return markdown
    }



    /**
     * 获取所有账户信息
     * @returns {Array} 账户列表
     */
    getAllAccountKeys() {
        return this.accountTokens
    }



    /**
     * 记录账户使用失败
     * @param {string} accountId - 账户标识
     */
    recordAccountFailure(accountId) {
        this.accountRotator.recordFailure(accountId)
    }

    /**
     * 重置账户失败计数
     * @param {string} accountId - 账户标识
     */
    resetAccountFailures(accountId) {
        this.accountRotator.resetFailures(accountId)
    }

    /**
     * 添加新账户
     * @param {string} accountId - 账户标识（用户ID或自定义名称）
     * @param {string} cookie - 完整的 Cookie 字符串
     * @returns {Promise<boolean>} 添加是否成功
     */
    async addAccount(accountId, cookie) {
        try {
            // 检查账户是否已存在
            const existingAccount = this.accountTokens.find(acc => acc.accountId === accountId)
            if (existingAccount) {
                logger.warn(`账户 ${accountId} 已存在`, 'ACCOUNT')
                return false
            }

            // 从 cookie 提取 token
            const token = this.tokenManager.extractTokenFromCookie(cookie)
            if (!token) {
                logger.error(`账户 ${accountId} Cookie 中未找到有效的 Token`, 'ACCOUNT')
                return false
            }

            const decoded = this.tokenManager.validateToken(token)
            if (!decoded) {
                logger.error(`账户 ${accountId} Token 无效或已过期`, 'ACCOUNT')
                return false
            }

            const newAccount = {
                accountId,
                cookie,
                token,
                expires: decoded.exp
            }

            // 添加到内存
            this.accountTokens.push(newAccount)

            // 保存到持久化存储
            await this.dataPersistence.saveAccount(accountId, newAccount)

            // 更新轮询器
            this.accountRotator.setAccounts(this.accountTokens)

            logger.success(`成功添加账户: ${accountId}`, 'ACCOUNT')
            return true
        } catch (error) {
            logger.error(`添加账户失败 (${accountId})`, 'ACCOUNT', '', error)
            return false
        }
    }

    /**
     * 移除账户
     * @param {string} accountId - 账户标识
     * @returns {Promise<boolean>} 移除是否成功
     */
    async removeAccount(accountId) {
        try {
            const index = this.accountTokens.findIndex(acc => acc.accountId === accountId)
            if (index === -1) {
                logger.warn(`账户 ${accountId} 不存在`, 'ACCOUNT')
                return false
            }

            // 从内存中移除
            this.accountTokens.splice(index, 1)

            // 从数据库中删除
            await this.dataPersistence.deleteAccount(accountId)

            // 更新轮询器
            this.accountRotator.setAccounts(this.accountTokens)

            logger.success(`成功移除账户: ${accountId}`, 'ACCOUNT')
            return true
        } catch (error) {
            logger.error(`移除账户失败 (${accountId})`, 'ACCOUNT', '', error)
            return false
        }
    }

    /**
     * 为指定账户初始化CLI信息（公共方法）
     * @param {Object} account - 账户对象
     * @returns {Promise<boolean>} 初始化是否成功
     */
    async initializeCliForAccount(account) {
        if (!account) {
            logger.error('账户对象不能为空', 'CLI')
            return false
        }

        try {
            await this._initializeCliAccount(account)
            return true
        } catch (error) {
            logger.error(`为账户 ${account.accountId} 初始化CLI失败`, 'CLI', '', error)
            return false
        }
    }

    /**
     * 延迟函数
     * @param {number} ms - 延迟毫秒数
     * @private
     */
    async _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    /**
     * 清理资源
     */
    destroy() {
        // 清理自动刷新定时器
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval)
            this.refreshInterval = null
        }

        // 清理CLI请求次数重置定时器
        if (this.cliRequestNumberInterval) {
            clearTimeout(this.cliRequestNumberInterval)
            this.cliRequestNumberInterval = null
        }

        if (this.cliDailyResetInterval) {
            clearInterval(this.cliDailyResetInterval)
            this.cliDailyResetInterval = null
        }

        // 清理所有CLI账户的刷新定时器
        this.accountTokens.forEach(account => {
            if (account.cli_info && account.cli_info.refresh_token_interval) {
                clearInterval(account.cli_info.refresh_token_interval)
                account.cli_info.refresh_token_interval = null
            }
        })

        this.accountRotator.reset()
        logger.info('账户管理器已清理资源', 'ACCOUNT', '🧹')
    }

}

if (!(process.env.API_KEY || config.apiKey)) {
    logger.error('请务必设置 API_KEY 环境变量', 'CONFIG', '⚙️')
    process.exit(1)
}

const accountManager = new Account()

module.exports = accountManager