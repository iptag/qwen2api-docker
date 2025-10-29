const dotenv = require('dotenv')
dotenv.config()

const config = {
  apiKey: process.env.API_KEY || null,
  simpleModelMap: process.env.SIMPLE_MODEL_MAP === 'true' ? true : false,
  listenAddress: process.env.LISTEN_ADDRESS || null,
  listenPort: process.env.SERVICE_PORT || 3000,
  searchInfoMode: process.env.SEARCH_INFO_MODE === 'table' ? "table" : "text",
  outThink: process.env.OUTPUT_THINK === 'true' ? true : false,

  logLevel: process.env.LOG_LEVEL || "INFO",
  enableFileLog: process.env.ENABLE_FILE_LOG === 'true',
  logDir: process.env.LOG_DIR || "./logs",
  maxLogFileSize: parseInt(process.env.MAX_LOG_FILE_SIZE) || 10,
  maxLogFiles: parseInt(process.env.MAX_LOG_FILES) || 5,
  qwenCookies: process.env.QWEN_COOKIES || ""
}

module.exports = config
