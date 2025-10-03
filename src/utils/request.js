const axios = require('axios')
const config = require('../config/index.js')
const accountManager = require('./account.js')
const { logger } = require('./logger')


/**
 * 发送聊天请求
 * @param {Object} body - 请求体
 * @returns {Promise<Object>} 响应结果
 */
const sendChatRequest = async (body) => {
    try {
        // 获取可用的令牌
        const currentToken = accountManager.getAccountToken()

        if (!currentToken) {
            logger.error('无法获取有效的访问令牌', 'TOKEN')
            return {
                status: false,
                response: null
            }
        }

        // 构建请求配置
        const requestConfig = {
            headers: {
                'Authorization': `Bearer ${currentToken}`,
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                ...(config.ssxmodItna && { 'Cookie': `ssxmod_itna=${config.ssxmodItna}` })
            },
            responseType: body.stream ? 'stream' : 'json',
            timeout: 60 * 1000,
        }

        // console.log(body)
        // console.log(requestConfig)

        const chat_id = await generateChatID(currentToken,body.model)

        logger.network(`发送聊天请求`, 'REQUEST')
        const response = await axios.post("https://chat.qwen.ai/api/v2/chat/completions?chat_id=" + chat_id, {
            ...body,
            chat_id: chat_id
        }, requestConfig)

        // 请求成功
        if (response.status === 200) {
            // console.log(JSON.stringify(response.data))
            return {
                currentToken: currentToken,
                status: true,
                response: response.data
            }
        }

    } catch (error) {
        console.log(error)
        logger.error('发送聊天请求失败', 'REQUEST', '', error.message)
        return {
            status: false,
            response: null
        }
    }
}

/**
 * 生成chat_id
 * @param {*} currentToken 
 * @returns {Promise<string|null>} 返回生成的chat_id，如果失败则返回null
 */
const generateChatID = async (currentToken,model) => {
    try {
        const response_data = await axios.post("https://chat.qwen.ai/api/v2/chats/new", {
            "title": "New Chat",
            "models": [
                model
            ],
            "chat_mode": "local",
            "chat_type": "t2i",
            "timestamp": new Date().getTime()
        }, {
            headers: {
                'Authorization': `Bearer ${currentToken}`,
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                ...(config.ssxmodItna && { 'Cookie': `ssxmod_itna=${config.ssxmodItna}` })
            }
        })

        return response_data.data?.data?.id || null

    } catch (error) {
        logger.error('生成chat_id失败', 'CHAT', '', error.message)
        return null
    }
}

module.exports = {
    sendChatRequest,
    generateChatID
}