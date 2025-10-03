const jwtDecodeModule = require('jwt-decode')
const { logger } = require('./logger')

// 处理 jwt-decode 的不同导入格式
// jwt-decode 可能导出为：
// 1. 函数本身（旧版本）
// 2. { jwtDecode: function } 对象（新版本）
// 3. { default: function } 对象（ES Module）
const JwtDecode = typeof jwtDecodeModule === 'function'
  ? jwtDecodeModule
  : (jwtDecodeModule.jwtDecode || jwtDecodeModule.default)

/**
 * 令牌管理器
 * 负责从 Cookie 中提取和验证令牌
 */
class TokenManager {
  /**
   * 从 Cookie 中提取 Token
   * @param {string} cookie - 完整的 cookie 字符串
   * @returns {string|null} Token 或 null
   */
  extractTokenFromCookie(cookie) {
    try {
      if (!cookie) {
        return null
      }

      const tokenMatch = cookie.match(/token=([^;]+)/)
      if (!tokenMatch) {
        logger.warn('Cookie 中未找到 token', 'TOKEN')
        return null
      }

      return tokenMatch[1]
    } catch (error) {
      logger.error('从 Cookie 提取 Token 失败', 'TOKEN', '', error)
      return null
    }
  }

  /**
   * 验证令牌是否有效
   * @param {string} token - JWT令牌
   * @returns {Object|null} 解码后的令牌信息或null
   */
  validateToken(token) {
    try {
      if (!token) {
        return null
      }

      const decoded = JwtDecode(token)

      // 检查是否过期
      const now = Math.floor(Date.now() / 1000)
      if (decoded.exp <= now) {
        return null // 令牌已过期
      }

      return decoded
    } catch (error) {
      logger.error('验证令牌失败', 'TOKEN', '', error)
      return null
    }
  }

  /**
   * 从 JWT Token 中提取用户标识
   * @param {string} token - JWT Token
   * @returns {string} 用户标识
   */
  extractUserIdFromToken(token) {
    try {
      const decoded = JwtDecode(token)

      // 优先使用 id 字段，其次是 sub
      const userId = decoded.id || decoded.sub

      if (!userId) {
        // 如果都没有，使用 token 的前8位
        return `user_${token.substring(0, 8)}`
      }

      // 如果 userId 是完整的 UUID，只取前8位
      if (userId.length > 16) {
        return `user_${userId.substring(0, 8)}`
      }

      return `user_${userId}`
    } catch (error) {
      logger.error('从 Token 提取用户ID失败', 'TOKEN', '', error)
      return `user_${token.substring(0, 8)}`
    }
  }

  /**
   * 从完整的 Cookie 中提取账户信息
   * 参考 OCR 项目的实现，从完整的 Cookie 字符串中提取需要的字段
   * @param {string} cookie - 完整的 Cookie 字符串
   * @returns {Object|null} { accountId, token, expires } 或 null
   */
  extractAccountFromCookie(cookie) {
    try {
      // 1. 从完整的 Cookie 中提取 token 字段
      const token = this.extractTokenFromCookie(cookie)
      if (!token) {
        return null
      }

      // 2. 验证 token 并获取过期时间
      const decoded = this.validateToken(token)
      if (!decoded) {
        logger.warn('Token 无效或已过期', 'TOKEN')
        return null
      }

      // 3. 从 token 中提取用户标识
      const userId = this.extractUserIdFromToken(token)

      return {
        accountId: userId,  // 使用 userId 作为 accountId
        token,
        expires: decoded.exp
      }
    } catch (error) {
      logger.error('从 Cookie 提取账户信息失败', 'TOKEN', '', error)
      return null
    }
  }
}

module.exports = TokenManager

