const crypto = require('crypto')
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

  // 使用 timingSafeEqual 防止时序攻击
  // 需要将字符串转为 Buffer，并确保长度一致
  let isValid = false
  try {
    const expectedKey = Buffer.from(config.apiKey, 'utf8')
    const providedKeyBuffer = Buffer.from(cleanKey, 'utf8')

    // timingSafeEqual 要求两个 Buffer 长度相同
    if (expectedKey.length === providedKeyBuffer.length) {
      isValid = crypto.timingSafeEqual(expectedKey, providedKeyBuffer)
    }
  } catch (error) {
    // Buffer 转换失败或其他错误，返回 false
    isValid = false
  }

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

