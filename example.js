/**
 * Qwen2api Node.js 调用示例
 *
 * 重要说明：
 * ========================================
 * 这里的 API Key 是 Qwen2api 服务的 API 密钥（sk-xxx），
 * 不是 Qwen 账户的 JWT 令牌！
 *
 * 认证流程：
 * 1. 客户端（你的代码）使用 Qwen2api 的 API Key（sk-xxx）
 * 2. Qwen2api 服务内部使用 Qwen 账户的 JWT 令牌
 * 3. 你不需要直接处理 Qwen 账户的 JWT 令牌
 * ========================================
 *
 * 功能演示：
 * 1. 基础聊天对话
 * 2. 流式响应
 * 3. 图像生成
 * 4. 视频生成
 * 5. 智能搜索
 * 6. 推理模式
 * 7. 多模态（图片理解）
 * 8. 获取模型列表
 *
 * 使用前请先配置环境变量：
 * export QWEN_API_BASE=http://localhost:3000
 * export QWEN_API_KEY=sk-123456
 *
 * 注意：
 * - QWEN_API_KEY 是 Qwen2api 的 API 密钥（在 .env 文件中配置的 API_KEY）
 * - 不是 Qwen 官方账户的密码或令牌
 * - Qwen 账户的管理在 Qwen2api 的管理页面中进行
 */

const axios = require('axios');

// ==================== 配置 ====================
const config = {
  // Qwen2api 服务地址
  apiBase: process.env.QWEN_API_BASE || 'http://localhost:3000',

  // Qwen2api 的 API 密钥（sk-xxx）
  // 这是在 Qwen2api 的 .env 文件中配置的 API_KEY
  // 不是 Qwen 账户的 JWT 令牌！
  apiKey: process.env.QWEN_API_KEY || 'sk-123456',
};

// ==================== 工具函数 ====================

/**
 * 创建API客户端
 */
function createClient() {
  return axios.create({
    baseURL: config.apiBase,
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 60000,
  });
}

/**
 * 处理流式响应
 */
async function handleStreamResponse(response) {
  return new Promise((resolve, reject) => {
    let fullContent = '';
    
    response.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') {
            console.log('\n\n流式响应完成');
            resolve(fullContent);
            return;
          }
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              process.stdout.write(content);
              fullContent += content;
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    });
    
    response.data.on('end', () => {
      resolve(fullContent);
    });
    
    response.data.on('error', (error) => {
      reject(error);
    });
  });
}

// ==================== 示例函数 ====================

/**
 * 示例1：基础聊天对话（非流式）
 */
async function example1_basicChat() {
  console.log('\n========== 示例1：基础聊天对话 ==========\n');
  
  const client = createClient();
  
  try {
    const response = await client.post('/v1/chat/completions', {
      model: 'qwen-max-latest',
      messages: [
        {
          role: 'system',
          content: '你是一个有用的AI助手。'
        },
        {
          role: 'user',
          content: `今天10点58和59提醒我到https://cdk.linux.do/receive/13dbf384-9b34-4849-9101-6732ab0ec9a2领取兑换码
1.你十分精通crontab表达式的生成和解析，能够根据第2条中的当前时间来计算将信息中的日期和时间准确的解析为crontab表达式，请分析上面的信息并按照'{"current_time": "<当前时间>","crontab": "<信息中的日期和时间解析为一个crontab表达式>","content": "<提醒的内容>"}'这个模板进行回复，不需要回复多余文字和字符
2.current_time字段对应的数值是字符串格式，"${new Date().toLocaleString('zh-CN', {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12: false}).replace(/\//g,'-').replace(',','')}(格式为'年-月-日 时:分:秒')"是格式样例，同时也是今天当前的准确时间
3.crontab字段对应的数值是字符串格式，格式为：'秒 分 时 日 月 周'，crontab只能有一个
4.crontab格式为"f0 f1 f2 f3 f4 f5"，f0-f5字段的具体解释如下：
  a.其中 f0 是表示秒，f1 是表示分钟，f2 表示小时，f3 表示一个月份中的第几日，f4 表示月份，f5 表示一个星期中的第几天。
  b.当 f0 为 * 时表示每秒都要执行，f1 为 * 时表示每分钟都要执行，f2 为 * 时表示每小时都要执行程序，其余类推
  c.当 f0 为 a-b 时表示从第 a 秒到第 b 秒这段时间内要执行，f1 为 a-b 时表示从第 a 分钟到第 b 分钟这段时间内要执行，其余类推
  d.当 f0 为 */n 时表示每 n 秒个时间间隔执行一次，f1 为 */n 时表示每 n 分钟个时间间隔执行一次，其余类推
  e.当 f0 为 a, b, c 时表示第 a, b, c 秒要执行，f1 为 a, b, c 时表示第 a, b, c 分钟要执行，其余类推
  f.需要依据当前的日期和时间(current_time字段)来计算信息中给出的日期和时间，如果计算结果有明确的日期，则f3和f4应填上对应的数字，不能以'*'代替
5.如果信息中未明确时、分和秒则以'早上9点'代替，如果未明确分和秒则以'0分0秒'代替
6.只应对与日期解析、提醒设置的请求作出响应，只需返回 JSON 格式的数据，无需额外的文字提示
7.content中可能包含链接，链接以http或者https开头中间可能包含一些链接中允许的符号，请保留完整`
        }
      ],
      stream: false,
      temperature: 0.7,
      max_tokens: 2000
    });
    
    console.log('响应内容：', response.data.choices[0].message.content);
    console.log('\nToken使用情况：', response.data.usage);
    
  } catch (error) {
    console.error('请求失败：', error.response?.data || error.message);
  }
}

/**
 * 示例2：流式响应
 */
async function example2_streamChat() {
  console.log('\n========== 示例2：流式响应 ==========\n');
  
  const client = createClient();
  
  try {
    const response = await client.post('/v1/chat/completions', {
      model: 'qwen-max-latest',
      messages: [
        {
          role: 'user',
          content: '请写一首关于春天的短诗。'
        }
      ],
      stream: true,
      temperature: 0.8
    }, {
      responseType: 'stream'
    });
    
    console.log('开始接收流式响应：\n');
    await handleStreamResponse(response);
    
  } catch (error) {
    console.error('请求失败：', error.response?.data || error.message);
  }
}

/**
 * 示例3：图像生成
 */
async function example3_imageGeneration() {
  console.log('\n========== 示例3：图像生成 ==========\n');
  
  const client = createClient();
  
  try {
    const response = await client.post('/v1/chat/completions', {
      model: 'qwen-max-latest-image',
      messages: [
        {
          role: 'user',
          content: '画一只可爱的小猫咪在花园里玩耍，卡通风格'
        }
      ],
      size: '1:1',  // 支持: 1:1, 4:3, 3:4, 16:9, 9:16
      stream: false
    });
    
    const content = response.data.choices[0].message.content;
    console.log('生成的图片：', content);
    
    // 提取图片URL
    const imageUrlMatch = content.match(/!\[.*?\]\((.*?)\)/);
    if (imageUrlMatch) {
      console.log('\n图片URL：', imageUrlMatch[1]);
    }
    
  } catch (error) {
    console.error('请求失败：', error.response?.data || error.message);
  }
}

/**
 * 示例4：视频生成
 */
async function example4_videoGeneration() {
  console.log('\n========== 示例4：视频生成 ==========\n');
  
  const client = createClient();
  
  try {
    const response = await client.post('/v1/chat/completions', {
      model: 'qwen-max-latest-video',
      messages: [
        {
          role: 'user',
          content: '生成一段小猫在草地上奔跑的视频'
        }
      ],
      stream: false
    });
    
    const content = response.data.choices[0].message.content;
    console.log('生成的视频：', content);
    
  } catch (error) {
    console.error('请求失败：', error.response?.data || error.message);
  }
}

/**
 * 示例5：智能搜索模式
 */
async function example5_searchMode() {
  console.log('\n========== 示例5：智能搜索模式 ==========\n');
  
  const client = createClient();
  
  try {
    const response = await client.post('/v1/chat/completions', {
      model: 'qwen-max-latest-search',
      messages: [
        {
          role: 'user',
          content: '2024年诺贝尔物理学奖获得者是谁？'
        }
      ],
      stream: false
    });
    
    console.log('响应内容：', response.data.choices[0].message.content);
    
  } catch (error) {
    console.error('请求失败：', error.response?.data || error.message);
  }
}

/**
 * 示例6：推理模式（显示思考过程）
 */
async function example6_thinkingMode() {
  console.log('\n========== 示例6：推理模式 ==========\n');
  
  const client = createClient();
  
  try {
    const response = await client.post('/v1/chat/completions', {
      model: 'qwen-max-latest-thinking',
      messages: [
        {
          role: 'user',
          content: '如果一个房间里有3只猫，每只猫抓了2只老鼠，那么房间里总共有多少只动物？'
        }
      ],
      stream: false
    });
    
    console.log('响应内容：', response.data.choices[0].message.content);
    
  } catch (error) {
    console.error('请求失败：', error.response?.data || error.message);
  }
}

/**
 * 示例7：组合模式（推理+搜索）
 */
async function example7_combinedMode() {
  console.log('\n========== 示例7：组合模式（推理+搜索） ==========\n');
  
  const client = createClient();
  
  try {
    const response = await client.post('/v1/chat/completions', {
      model: 'qwen-max-latest-thinking-search',
      messages: [
        {
          role: 'user',
          content: '分析一下2024年AI技术的最新发展趋势。'
        }
      ],
      stream: false
    });
    
    console.log('响应内容：', response.data.choices[0].message.content);
    
  } catch (error) {
    console.error('请求失败：', error.response?.data || error.message);
  }
}

/**
 * 示例8：多模态（图片理解）
 */
async function example8_imageUnderstanding() {
  console.log('\n========== 示例8：多模态（图片理解） ==========\n');
  
  const client = createClient();
  
  try {
    // 这里使用base64编码的图片或图片URL
    const imageUrl = 'https://example.com/image.jpg';
    
    const response = await client.post('/v1/chat/completions', {
      model: 'qwen-max-latest',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '这张图片里有什么？'
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl
              }
            }
          ]
        }
      ],
      stream: false
    });
    
    console.log('响应内容：', response.data.choices[0].message.content);
    
  } catch (error) {
    console.error('请求失败：', error.response?.data || error.message);
  }
}

/**
 * 示例9：获取模型列表
 */
async function example9_getModels() {
  console.log('\n========== 示例9：获取模型列表 ==========\n');
  
  const client = createClient();
  
  try {
    const response = await client.get('/v1/models');
    
    console.log('可用模型数量：', response.data.data.length);
    console.log('\n前10个模型：');
    response.data.data.slice(0, 10).forEach((model, index) => {
      console.log(`${index + 1}. ${model.id}`);
    });
    
  } catch (error) {
    console.error('请求失败：', error.response?.data || error.message);
  }
}

/**
 * 示例10：多轮对话
 */
async function example10_multiTurnChat() {
  console.log('\n========== 示例10：多轮对话 ==========\n');
  
  const client = createClient();
  const messages = [
    {
      role: 'system',
      content: '你是一个友好的AI助手。'
    }
  ];
  
  try {
    // 第一轮对话
    messages.push({
      role: 'user',
      content: '我叫小明，今年25岁。'
    });
    
    let response = await client.post('/v1/chat/completions', {
      model: 'qwen-max-latest',
      messages: messages,
      stream: false
    });
    
    console.log('第一轮回复：', response.data.choices[0].message.content);
    messages.push(response.data.choices[0].message);
    
    // 第二轮对话
    messages.push({
      role: 'user',
      content: '你还记得我叫什么名字吗？'
    });
    
    response = await client.post('/v1/chat/completions', {
      model: 'qwen-max-latest',
      messages: messages,
      stream: false
    });
    
    console.log('\n第二轮回复：', response.data.choices[0].message.content);
    
  } catch (error) {
    console.error('请求失败：', error.response?.data || error.message);
  }
}

/**
 * 示例11：CLI模式（支持256K上下文）
 */
async function example11_cliMode() {
  console.log('\n========== 示例11：CLI模式 ==========\n');
  
  const client = createClient();
  
  try {
    const response = await client.post('/cli/v1/chat/completions', {
      model: 'qwen3-coder-plus',  // 或 qwen3-coder-flash
      messages: [
        {
          role: 'user',
          content: '请帮我写一个快速排序的Python实现。'
        }
      ],
      stream: false,
      temperature: 0.7
    });
    
    console.log('响应内容：', response.data.choices[0].message.content);
    console.log('\nToken使用情况：', response.data.usage);
    
  } catch (error) {
    console.error('请求失败：', error.response?.data || error.message);
  }
}

// ==================== 主函数 ====================

async function main() {
  console.log('='.repeat(60));
  console.log('Qwen2api Node.js 调用示例');
  console.log('='.repeat(60));
  console.log(`API地址: ${config.apiBase}`);
  console.log(`API密钥: ${config.apiKey.slice(0, 10)}...`);
  console.log('='.repeat(60));
  
  // 运行所有示例
  try {
    await example1_basicChat();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await example2_streamChat();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // await example3_imageGeneration();
    // await new Promise(resolve => setTimeout(resolve, 1000));
    
    // await example4_videoGeneration();
    // await new Promise(resolve => setTimeout(resolve, 1000));
    
    // await example5_searchMode();
    // await new Promise(resolve => setTimeout(resolve, 1000));
    // 
    // await example6_thinkingMode();
    // await new Promise(resolve => setTimeout(resolve, 1000));
    
    // await example7_combinedMode();
    // await new Promise(resolve => setTimeout(resolve, 1000));
    
    // await example8_imageUnderstanding();
    // await new Promise(resolve => setTimeout(resolve, 1000));
    
    // await example9_getModels();
    // await new Promise(resolve => setTimeout(resolve, 1000));
    // 
    // await example10_multiTurnChat();
    // await new Promise(resolve => setTimeout(resolve, 1000));
    
    // await example11_cliMode();
    
  } catch (error) {
    console.error('运行示例时出错：', error);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('所有示例运行完成！');
  console.log('='.repeat(60));
}

// ==================== 运行 ====================

// 如果直接运行此文件
if (require.main === module) {
  main().catch(console.error);
}
