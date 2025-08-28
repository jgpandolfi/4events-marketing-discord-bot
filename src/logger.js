import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

// Configuração para ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Importa a versão do package.json dinamicamente
const require = createRequire(import.meta.url)
const packageJson = require('../package.json')

// Garante que a pasta logs exista
const logsDir = path.join(__dirname, '../logs')
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

// Configuração de formatação personalizada para arquivos
const fileFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
)

// Formatação para console
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
    return `${timestamp} [${level}]: ${message}${metaStr}`
  })
)

// Remover dados sensíveis dos logs
const sanitizeLogData = (data) => {
  if (typeof data === 'object' && data !== null) {
    const sanitized = { ...data }
    // Remove tokens e dados sensíveis
    delete sanitized.BOT_TOKEN
    delete sanitized.CLARITY_API_TOKEN
    delete sanitized.token
    delete sanitized.password
    return sanitized
  }
  return data
}

// Configuração principal do logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL === 'production' ? 'warn' : 'info',
  format: fileFormat,
  defaultMeta: { 
    service: '4events-marketing-bot',
    version: packageJson.version, // Versão carregada dinamicamente do package.json
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Arquivo para todos os logs (rotativo diário)
    new DailyRotateFile({
      filename: path.join(__dirname, '../logs/4events-bot-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      level: 'info'
    }),
    
    // Arquivo separado para erros críticos
    new DailyRotateFile({
      filename: path.join(__dirname, '../logs/4events-bot-error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error'
    }),
    
    // Arquivo para comandos e interações dos usuários
    new DailyRotateFile({
      filename: path.join(__dirname, '../logs/4events-bot-commands-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '10m',
      maxFiles: '30d',
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
        winston.format((info) => {
        return info.categoria?.includes('discord_comando') || info.type === 'command' ? info : false
        })()
      )
    }),
    
    // Console
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
    })
  ],
  
  // Tratamento de exceções não capturadas
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(__dirname, '../logs/4events-bot-exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '10m',
      maxFiles: '30d'
    })
  ],
  
  // Tratamento de promises rejeitadas
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(__dirname, '../logs/4events-bot-rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '10m',
      maxFiles: '30d'
    })
  ]
})

// Funções especializadas permanecem iguais...
export const logCommand = (user, command, params = {}) => {
  logger.info('Comando executado', sanitizeLogData({
    type: 'command',
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName
    },
    command: command,
    params: params,
    timestamp: new Date().toISOString()
  }))
}

export const logError = (error, context = {}) => {
  logger.error('Erro capturado', sanitizeLogData({
    type: 'error',
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    context: context,
    timestamp: new Date().toISOString()
  }))
}

export const logWebhook = (type, success, data = {}) => {
  const level = success ? 'info' : 'error'
  logger[level]('Webhook executado', sanitizeLogData({
    type: 'webhook',
    webhookType: type,
    success: success,
    data: data,
    timestamp: new Date().toISOString()
  }))
}

export const logPerformance = (operation, duration, metadata = {}) => {
  logger.info('Métrica de performance', sanitizeLogData({
    type: 'performance',
    operation: operation,
    duration: duration,
    metadata: metadata,
    timestamp: new Date().toISOString()
  }))
}

export default logger