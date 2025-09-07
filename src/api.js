import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import database from './database.js'
import logger from './logger.js'
import { 
  pageviewSchema, 
  clickCtaSchema, 
  submitFormSchema, 
  emailQuerySchema 
} from './validators.js'

import { createRequire } from "module"
const require = createRequire(import.meta.url)
const packageJson = require("../package.json")

class ApiServer {
  constructor() {
    this.fastify = null
    this.isRunning = false
  }

  async initialize() {
    try {
      // Configuração do Fastify
      this.fastify = Fastify({
        logger: false, // Usamos nosso próprio sistema de logging
        trustProxy: true,
        bodyLimit: 1048576 // 1MB
      })

      // Middleware de segurança
      await this.fastify.register(helmet, {
        contentSecurityPolicy: false
      })

      // CORS
      await this.fastify.register(cors, {
        origin: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE']
      })

      // Rate limiting
      await this.fastify.register(rateLimit, {
        max: 100,
        timeWindow: '1 minute',
        errorResponseBuilder: (request, context) => ({
          code: 429,
          error: 'Rate limit exceeded',
          message: `Muitas requisições. Tente novamente em ${Math.round(context.ttl / 1000)} segundos.`,
          expiresIn: Math.round(context.ttl / 1000)
        })
      })

      // Registra as rotas
      await this.registerRoutes()

      logger.info('✅ API Fastify inicializada com sucesso', {
        categoria: 'fastify_api',
        operacao: 'api_inicializada'
      })

    } catch (error) {
      logger.error('❌ Erro ao inicializar API Fastify:', {
        erro: error.message,
        stack: error.stack,
        categoria: 'fastify_api',
        operacao: 'erro_inicializacao'
      })
      throw error
    }
  }

  async registerRoutes() {
    // Rota raiz
    this.fastify.get('/', async (request, reply) => {
      return {
        service: '4.events Marketing Bot API',
        version: packageJson.version,
        status: 'online',
        timestamp: new Date().toISOString(),
        message: 'API em funcionamento',
        endpoints: [
          '/health',
          '/api/events/pageview',
          '/api/events/click-cta-mlg', 
          '/api/events/submit-form-mlg',
          '/api/reports/events-by-email'
        ]
      }
    })

    // Rota de health check
    this.fastify.get('/health', async (request, reply) => {
      return {
        status: 'ok',
        service: '4.events Marketing Bot API',
        version: packageJson.version,
        timestamp: new Date().toISOString(),
        database: database.isConnected ? 'connected' : 'disconnected',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        endpoints: [
          '/health',
          '/api/events/pageview',
          '/api/events/click-cta-mlg', 
          '/api/events/submit-form-mlg',
          '/api/reports/events-by-email'
        ]
      }
    })

    // Rota para eventos de pageview
    this.fastify.post('/api/events/pageview', {
      schema: {
        body: pageviewSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              event_id: { type: 'number' },
              message: { type: 'string' },
              timestamp: { type: 'string' }
            }
          }
        }
      }
    }, async (request, reply) => {
      try {
        const eventData = request.body
        
        // Adiciona informações da requisição
        eventData.user_ip = eventData.user_ip || request.ip
        eventData.user_agent = eventData.user_agent || request.headers['user-agent']
        eventData.timestamp = eventData.timestamp || new Date()

        const eventId = await database.insertPageview(eventData)

        logger.info('📈 Evento pageview recebido via API', {
          eventId,
          sessionId: eventData.session_id,
          pageUrl: eventData.page_url,
          userIp: request.ip,
          categoria: 'api_evento_pageview',
          operacao: 'pageview_recebido'
        })

        return reply.code(200).send({
          success: true,
          event_id: eventId,
          message: 'Evento pageview registrado com sucesso',
          timestamp: new Date().toISOString()
        })

      } catch (error) {
        logger.error('❌ Erro ao processar evento pageview:', {
          erro: error.message,
          stack: error.stack,
          body: request.body,
          categoria: 'api_evento_pageview',
          operacao: 'erro_processar_pageview'
        })

        return reply.code(500).send({
          success: false,
          error: 'Erro interno do servidor',
          message: 'Falha ao registrar evento pageview'
        })
      }
    })

    // Rota para eventos de clique em CTA
    this.fastify.post('/api/events/click-cta-mlg', {
      schema: {
        body: clickCtaSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              event_id: { type: 'number' },
              message: { type: 'string' },
              timestamp: { type: 'string' }
            }
          }
        }
      }
    }, async (request, reply) => {
      try {
        const eventData = request.body
        eventData.timestamp = eventData.timestamp || new Date()

        const eventId = await database.insertClickCta(eventData)

        logger.info('🖱️ Evento click-cta-mlg recebido via API', {
          eventId,
          sessionId: eventData.session_id,
          leadEmail: eventData.lead_email,
          leadCidade: eventData.lead_cidade,
          campaign: eventData.campaign,
          userIp: request.ip,
          categoria: 'api_evento_click_cta',
          operacao: 'click_cta_recebido'
        })

        return reply.code(200).send({
          success: true,
          event_id: eventId,
          message: 'Evento click-cta-mlg registrado com sucesso',
          timestamp: new Date().toISOString()
        })

      } catch (error) {
        logger.error('❌ Erro ao processar evento click-cta-mlg:', {
          erro: error.message,
          stack: error.stack,
          body: request.body,
          categoria: 'api_evento_click_cta',
          operacao: 'erro_processar_click_cta'
        })

        return reply.code(500).send({
          success: false,
          error: 'Erro interno do servidor',
          message: 'Falha ao registrar evento click-cta-mlg'
        })
      }
    })

    // Rota para eventos de submissão de formulário
    this.fastify.post('/api/events/submit-form-mlg', {
      schema: {
        body: submitFormSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              event_id: { type: 'number' },
              message: { type: 'string' },
              timestamp: { type: 'string' }
            }
          }
        }
      }
    }, async (request, reply) => {
      try {
        const eventData = request.body
        eventData.timestamp = eventData.timestamp || new Date()

        const eventId = await database.insertSubmitForm(eventData)

        logger.info('📝 Evento submit-form-mlg recebido via API', {
          eventId,
          sessionId: eventData.session_id,
          leadEmail: eventData.lead_email,
          leadCidade: eventData.lead_cidade,
          campaign: eventData.campaign,
          userIp: request.ip,
          categoria: 'api_evento_submit_form',
          operacao: 'submit_form_recebido'
        })

        return reply.code(200).send({
          success: true,
          event_id: eventId,
          message: 'Evento submit-form-mlg registrado com sucesso',
          timestamp: new Date().toISOString()
        })

      } catch (error) {
        logger.error('❌ Erro ao processar evento submit-form-mlg:', {
          erro: error.message,
          stack: error.stack,
          body: request.body,
          categoria: 'api_evento_submit_form',
          operacao: 'erro_processar_submit_form'
        })

        return reply.code(500).send({
          success: false,
          error: 'Erro interno do servidor',
          message: 'Falha ao registrar evento submit-form-mlg'
        })
      }
    })

    // Rota para consultar eventos por email (para relatórios)
    this.fastify.get('/api/reports/events-by-email', {
      schema: {
        querystring: emailQuerySchema
      }
    }, async (request, reply) => {
      try {
        const { email, start_date, end_date } = request.query
        
        const events = await database.getEventsByEmail(email, start_date, end_date)

        logger.info('📊 Consulta de eventos por email realizada', {
          email,
          totalEvents: events.total_events,
          clickEvents: events.click_cta_events.length,
          submitEvents: events.submit_form_events.length,
          userIp: request.ip,
          categoria: 'api_relatorio',
          operacao: 'consulta_por_email'
        })

        return reply.code(200).send({
          success: true,
          data: events,
          timestamp: new Date().toISOString()
        })

      } catch (error) {
        logger.error('❌ Erro ao consultar eventos por email:', {
          erro: error.message,
          stack: error.stack,
          query: request.query,
          categoria: 'api_relatorio',
          operacao: 'erro_consulta_email'
        })

        return reply.code(500).send({
          success: false,
          error: 'Erro interno do servidor',
          message: 'Falha ao consultar eventos'
        })
      }
    })

    // Middleware de tratamento de erro 404
    this.fastify.setNotFoundHandler((request, reply) => {
      logger.warn('🔍 Rota não encontrada', {
        method: request.method,
        url: request.url,
        userIp: request.ip,
        categoria: 'api_404',
        operacao: 'rota_nao_encontrada'
      })

      return reply.code(404).send({
        success: false,
        error: 'Rota não encontrada',
        message: 'O endpoint solicitado não existe'
      })
    })

    // Middleware de tratamento de erros gerais
    this.fastify.setErrorHandler((error, request, reply) => {
      logger.error('❌ Erro não tratado na API:', {
        erro: error.message,
        stack: error.stack,
        method: request.method,
        url: request.url,
        body: request.body,
        categoria: 'api_erro_geral',
        operacao: 'erro_nao_tratado'
      })

      return reply.code(500).send({
        success: false,
        error: 'Erro interno do servidor',
        message: 'Ocorreu um erro inesperado'
      })
    })
  }

  async start() {
    try {
      const port = parseInt(process.env.API_PORT) || 3000
      const host = process.env.API_HOST || '0.0.0.0'

      await this.fastify.listen({ port, host })
      this.isRunning = true

      logger.info('🚀 Servidor API iniciado com sucesso', {
        port,
        host,
        url: `http://${host}:${port}`,
        categoria: 'fastify_server',
        operacao: 'servidor_iniciado'
      })

    } catch (error) {
      this.isRunning = false
      logger.error('❌ Erro ao iniciar servidor API:', {
        erro: error.message,
        stack: error.stack,
        porta: process.env.API_PORT,
        categoria: 'fastify_server',
        operacao: 'erro_iniciar_servidor'
      })
      throw error
    }
  }

  async stop() {
    if (this.fastify && this.isRunning) {
      await this.fastify.close()
      this.isRunning = false
      
      logger.info('🛑 Servidor API encerrado', {
        categoria: 'fastify_server',
        operacao: 'servidor_encerrado'
      })
    }
  }
}

export default new ApiServer()