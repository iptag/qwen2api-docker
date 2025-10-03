const { logger } = require('./logger')
const { sha256Encrypt, generateUUID } = require('./tools.js')
const { uploadFileToQwenOss } = require('./upload.js')
const accountManager = require('./account.js')
const CacheManager = require('./img-caches.js')

/**
 * 判断聊天类型
 * @param {string} model - 模型名称
 * @param {boolean} search - 是否搜索模式
 * @returns {string} 聊天类型 ('search' 或 't2t')
 */
const isChatType = (model) => {
    if (!model) return 't2t'
    if (model.includes('-search')) {
        return 'search'
    } else if (model.includes('-image-edit')) {
        return 'image_edit'
    } else if (model.includes('-image')) {
        return 't2i'
    } else if (model.includes('-video')) {
        return 't2v'
    } else if (model.includes('-deep-research')) {
        return 'deep_research'
    } else {
        return 't2t'
    }
}

/**
 * 判断是否启用思考模式
 * @param {string} model - 模型名称
 * @param {boolean} enable_thinking - 是否启用思考
 * @param {number} thinking_budget - 思考预算
 * @returns {object} 思考配置对象
 */
const isThinkingEnabled = (model, enable_thinking, thinking_budget) => {
    const thinking_config = {
        "output_schema": "phase",
        "thinking_enabled": false,
        "thinking_budget": 81920
    }

    if (!model) return thinking_config

    if (model.includes('-thinking') || enable_thinking) {
        thinking_config.thinking_enabled = true
    }

    if (thinking_budget && Number(thinking_budget) !== Number.NaN && Number(thinking_budget) > 0 && Number(thinking_budget) < 38912) {
        thinking_config.budget = Number(thinking_budget)
    }

    return thinking_config
}

/**
 * 解析模型名称，移除特殊后缀
 * @param {string} model - 原始模型名称
 * @returns {string} 解析后的模型名称
 */
const parserModel = (model) => {
    if (!model) return 'qwen3-coder-plus'

    try {
        model = String(model)
        model = model.replace('-search', '')
        model = model.replace('-thinking', '')
        model = model.replace('-edit', '')
        model = model.replace('-video', '')
        model = model.replace('-deep-research', '')
        model = model.replace('-image', '')
        return model
    } catch (e) {
        return 'qwen3-coder-plus'
    }
}

/**
 * 解析消息格式，处理图片上传和消息结构
 * @param {Array} messages - 原始消息数组
 * @param {object} thinking_config - 思考配置
 * @param {string} chat_type - 聊天类型
 * @returns {Promise<Array>} 解析后的消息数组
 */
const parserMessages = async (messages, thinking_config, chat_type) => {
    try {
        const feature_config = thinking_config
        const imgCacheManager = new CacheManager()

        for (let message of messages) {
            if (message.role === 'user' || message.role === 'assistant') {
                message.chat_type = "t2t"
                message.extra = {}
                message.feature_config = {
                    "output_schema": "phase",
                    "thinking_enabled": false,
                }

                if (!Array.isArray(message.content)) continue

                const newContent = []

                for (let item of message.content) {
                    if (item.type === 'image' || item.type === 'image_url') {
                        let base64 = null
                        if (item.type === 'image_url') {
                            base64 = item.image_url.url
                        }
                        if (base64) {
                            const regex = /data:(.+);base64,/
                            // 截取文本
                            const fileType = base64.match(regex)
                            const fileExtension = fileType && fileType[1] ? fileType[1].split('/')[1] || 'png' : 'png'
                            const filename = `${generateUUID()}.${fileExtension}`
                            base64 = base64.replace(regex, '')
                            const signature = sha256Encrypt(base64)

                            try {
                                const buffer = Buffer.from(base64, 'base64')
                                const cacheIsExist = imgCacheManager.cacheIsExist(signature)
                                if (cacheIsExist) {
                                    delete item.image_url
                                    item.type = 'image'
                                    item.image = imgCacheManager.getCache(signature).url
                                    newContent.push(item)
                                } else {
                                    const uploadResult = await uploadFileToQwenOss(buffer, filename, accountManager.getAccountToken())
                                    if (uploadResult && uploadResult.status === 200) {
                                        delete item.image_url
                                        item.type = 'image'
                                        item.image = uploadResult.file_url
                                        imgCacheManager.addCache(signature, uploadResult.file_url)
                                        newContent.push(item)
                                    }
                                }

                            } catch (error) {
                                logger.error('图片上传失败', 'UPLOAD', '', error)
                            }
                        }
                    } else if (item.type === 'text') {
                        item.chat_type = 't2t'
                        item.feature_config = {
                            "output_schema": "phase",
                            "thinking_enabled": false,
                        }

                        if (newContent.length >= 2) {
                            messages.push({
                                "role": "user",
                                "content": item.text,
                                "chat_type": "t2t",
                                "extra": {},
                                "feature_config": {
                                    "output_schema": "phase",
                                    "thinking_enabled": false,
                                }
                            })
                        } else {
                            newContent.push(item)
                        }

                    }
                }
            } else {
                if (Array.isArray(message.content)) {
                    let system_prompt = ''
                    for (let item of message.content) {
                        if (item.type === 'text') {
                            system_prompt += item.text
                        }
                    }
                    if (system_prompt) {
                        message.content = system_prompt
                    }
                }
            }
        }

        messages[messages.length - 1].feature_config = feature_config
        messages[messages.length - 1].chat_type = chat_type

        return messages
    } catch (e) {
        return [
            {
                "role": "user",
                "content": "直接返回字符串： '聊天历史处理有误...'",
                "chat_type": "t2t",
                "extra": {},
                "feature_config": {
                    "output_schema": "phase",
                    "enabled": false,
                }
            }
        ]
    }
}

module.exports = {
    isChatType,
    isThinkingEnabled,
    parserModel,
    parserMessages
}
