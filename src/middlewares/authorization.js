const config = require('../config')

/**
 * 验证API Key是否有效
 * @param {string} providedKey - 提供的API Key
 * @returns {object} 验证结果 { isValid: boolean, isAdmin: boolean }
 */
const validateApiKey = (providedKey) => {
  if (!providedKey || !config.apiKey) {
    return { isValid: false, isAdmin: false }
  }

  // 移除Bearer前缀
  const cleanKey = providedKey.startsWith('Bearer ') ? providedKey.slice(7) : providedKey

  // 检查是否与配置的API Key匹配
  const isValid = cleanKey === config.apiKey

  // 当前实现不区分管理员，所有有效Key均视为管理员
  return { isValid, isAdmin: isValid }
}

/**
 * API Key验证中间件
 */
const apiKeyVerify = (req, res, next) => {
  const apiKey = req.headers['authorization'] || req.headers['Authorization'] || req.headers['x-api-key']
  const { isValid } = validateApiKey(apiKey)

  if (!isValid) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  req.apiKey = apiKey
  next()
}

module.exports = {
  apiKeyVerify,
  validateApiKey
}

