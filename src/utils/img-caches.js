const { logger } = require('./logger')

/**
 * 图片缓存管理器
 * 使用内存缓存（Map）存储图片 URL
 */
class imgCacheManager {
  constructor() {
    this.cacheMap = new Map()
  }

  /**
   * 检查缓存是否存在
   * @param {string} signature - 图片签名
   * @returns {boolean} 是否存在
   */
  cacheIsExist(signature) {
    try {
      return this.cacheMap.has(signature)
    } catch (e) {
      logger.error('缓存检查失败', 'CACHE', '', e)
      return false
    }
  }

  /**
   * 添加缓存
   * @param {string} signature - 图片签名
   * @param {string} url - 图片 URL
   * @returns {boolean} 是否添加成功
   */
  addCache(signature, url) {
    try {
      const isExist = this.cacheIsExist(signature)

      if (isExist) {
        return false
      } else {
        this.cacheMap.set(signature, url)
        return true
      }
    } catch (e) {
      logger.error('添加缓存失败', 'CACHE', '', e)
      return false
    }
  }

  /**
   * 获取缓存
   * @param {string} signature - 图片签名
   * @returns {Object} 缓存结果 { status, url }
   */
  getCache(signature) {
    try {
      const isExist = this.cacheIsExist(signature)

      if (isExist) {
        return {
          status: 200,
          url: this.cacheMap.get(signature)
        }
      } else {
        return {
          status: 404,
          url: null
        }
      }
    } catch (e) {
      logger.error('获取缓存失败', 'CACHE', '', e)
      return {
        status: 500,
        url: null
      }
    }
  }
}

module.exports = imgCacheManager
