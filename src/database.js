import mysql from 'mysql2/promise'
import logger from './logger.js'

class Database {
  constructor() {
    this.pool = null
    this.isConnected = false
  }

  async connect() {
    try {
      // Configuração do pool de conexões
      this.pool = mysql.createPool({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        acquireTimeout: 60000,
        timeout: 60000,
        reconnect: true,
        charset: 'utf8mb4'
      })

      // Testa a conexão
      const connection = await this.pool.getConnection()
      await connection.ping()
      connection.release()

      this.isConnected = true
      
      logger.info('✅ Conexão com MySQL estabelecida com sucesso', {
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        categoria: 'database_connection',
        operacao: 'conexao_estabelecida'
      })

      // Cria as tabelas se não existirem
      await this.createTables()

    } catch (error) {
      this.isConnected = false
      logger.error('❌ Erro ao conectar com MySQL:', {
        erro: error.message,
        stack: error.stack,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        categoria: 'database_connection',
        operacao: 'erro_conexao'
      })
      throw error
    }
  }

  async createTables() {
    try {
      const connection = await this.pool.getConnection()

      // Tabela para eventos de pageview
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS pageview_events (
          id INT PRIMARY KEY AUTO_INCREMENT,
          session_id VARCHAR(255) NOT NULL,
          user_ip VARCHAR(45),
          user_agent TEXT,
          page_url TEXT NOT NULL,
          referrer TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_session_id (session_id),
          INDEX idx_timestamp (timestamp),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)

      // Tabela para eventos de clique em CTA
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS click_cta_events (
          id INT PRIMARY KEY AUTO_INCREMENT,
          session_id VARCHAR(255) NOT NULL,
          lead_empresa VARCHAR(255),
          lead_nome VARCHAR(255),
          lead_email VARCHAR(255),
          lead_telefone VARCHAR(50),
          lead_estado VARCHAR(100),
          lead_cidade VARCHAR(255),
          source VARCHAR(100),
          medium VARCHAR(100),
          campaign VARCHAR(255),
          term VARCHAR(255),
          content VARCHAR(255),
          landing_page TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_session_id (session_id),
          INDEX idx_lead_email (lead_email),
          INDEX idx_lead_cidade (lead_cidade),
          INDEX idx_lead_estado (lead_estado),
          INDEX idx_campaign (campaign),
          INDEX idx_timestamp (timestamp),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)

      // Tabela para eventos de submissão de formulário
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS submit_form_events (
          id INT PRIMARY KEY AUTO_INCREMENT,
          session_id VARCHAR(255) NOT NULL,
          lead_empresa VARCHAR(255),
          lead_nome VARCHAR(255),
          lead_email VARCHAR(255),
          lead_telefone VARCHAR(50),
          lead_estado VARCHAR(100),
          lead_cidade VARCHAR(255),
          source VARCHAR(100),
          medium VARCHAR(100),
          campaign VARCHAR(255),
          term VARCHAR(255),
          content VARCHAR(255),
          landing_page TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_session_id (session_id),
          INDEX idx_lead_email (lead_email),
          INDEX idx_lead_cidade (lead_cidade),
          INDEX idx_lead_estado (lead_estado),
          INDEX idx_campaign (campaign),
          INDEX idx_timestamp (timestamp),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)

      connection.release()

      logger.info('✅ Tabelas do banco de dados verificadas/criadas com sucesso', {
        tabelas: ['pageview_events', 'click_cta_events', 'submit_form_events'],
        categoria: 'database_tables',
        operacao: 'tabelas_criadas'
      })

    } catch (error) {
      logger.error('❌ Erro ao criar tabelas do banco de dados:', {
        erro: error.message,
        stack: error.stack,
        categoria: 'database_tables',
        operacao: 'erro_criar_tabelas'
      })
      throw error
    }
  }

  async insertPageview(data) {
    try {
      const connection = await this.pool.getConnection()
      
      const [result] = await connection.execute(`
        INSERT INTO pageview_events 
        (session_id, user_ip, user_agent, page_url, referrer, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        data.session_id,
        data.user_ip,
        data.user_agent,
        data.page_url,
        data.referrer,
        new Date(data.timestamp || Date.now())
      ])

      connection.release()
      
      logger.info('✅ Evento pageview inserido no banco', {
        eventId: result.insertId,
        sessionId: data.session_id,
        pageUrl: data.page_url,
        categoria: 'database_insert',
        operacao: 'pageview_inserido'
      })

      return result.insertId

    } catch (error) {
      logger.error('❌ Erro ao inserir evento pageview:', {
        erro: error.message,
        stack: error.stack,
        data: data,
        categoria: 'database_insert',
        operacao: 'erro_pageview'
      })
      throw error
    }
  }

  async insertClickCta(data) {
    try {
      const connection = await this.pool.getConnection()
      
      const [result] = await connection.execute(`
        INSERT INTO click_cta_events 
        (session_id, lead_empresa, lead_nome, lead_email, lead_telefone, 
         lead_estado, lead_cidade, source, medium, campaign, term, content, 
         landing_page, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        data.session_id,
        data.lead_empresa,
        data.lead_nome,
        data.lead_email,
        data.lead_telefone,
        data.lead_estado,
        data.lead_cidade,
        data.source,
        data.medium,
        data.campaign,
        data.term,
        data.content,
        data.landing_page,
        new Date(data.timestamp || Date.now())
      ])

      connection.release()
      
      logger.info('✅ Evento click-cta inserido no banco', {
        eventId: result.insertId,
        sessionId: data.session_id,
        leadEmail: data.lead_email,
        leadCidade: data.lead_cidade,
        categoria: 'database_insert',
        operacao: 'click_cta_inserido'
      })

      return result.insertId

    } catch (error) {
      logger.error('❌ Erro ao inserir evento click-cta:', {
        erro: error.message,
        stack: error.stack,
        data: data,
        categoria: 'database_insert',
        operacao: 'erro_click_cta'
      })
      throw error
    }
  }
  

  async insertSubmitForm(data) {
    try {
      const connection = await this.pool.getConnection()
      
      const [result] = await connection.execute(`
        INSERT INTO submit_form_events 
        (session_id, lead_empresa, lead_nome, lead_email, lead_telefone, 
         lead_estado, lead_cidade, source, medium, campaign, term, content, 
         landing_page, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        data.session_id,
        data.lead_empresa,
        data.lead_nome,
        data.lead_email,
        data.lead_telefone,
        data.lead_estado,
        data.lead_cidade,
        data.source,
        data.medium,
        data.campaign,
        data.term,
        data.content,
        data.landing_page,
        new Date(data.timestamp || Date.now())
      ])

      connection.release()
      
      logger.info('✅ Evento submit-form inserido no banco', {
        eventId: result.insertId,
        sessionId: data.session_id,
        leadEmail: data.lead_email,
        leadCidade: data.lead_cidade,
        categoria: 'database_insert',
        operacao: 'submit_form_inserido'
      })

      return result.insertId

    } catch (error) {
      logger.error('❌ Erro ao inserir evento submit-form:', {
        erro: error.message,
        stack: error.stack,
        data: data,
        categoria: 'database_insert',
        operacao: 'erro_submit_form'
      })
      throw error
    }
  }
  

  async getEventsByEmail(email, startDate = null, endDate = null) {
    try {
      const connection = await this.pool.getConnection()
      
      let whereClause = 'WHERE lead_email = ?'
      let params = [email]
      
      if (startDate && endDate) {
        whereClause += ' AND timestamp BETWEEN ? AND ?'
        params.push(startDate, endDate)
      }

      const [clickEvents] = await connection.execute(`
        SELECT 'click-cta' as event_type, * FROM click_cta_events ${whereClause}
      `, params)

      const [submitEvents] = await connection.execute(`
        SELECT 'submit-form' as event_type, * FROM submit_form_events ${whereClause}
      `, params)

      connection.release()

      return {
        click_cta_events: clickEvents,
        submit_form_events: submitEvents,
        total_events: clickEvents.length + submitEvents.length
      }

    } catch (error) {
      logger.error('❌ Erro ao buscar eventos por email:', {
        erro: error.message,
        email: email,
        categoria: 'database_query',
        operacao: 'erro_buscar_por_email'
      })
      throw error
    }
  }

  // Função para buscar estatísticas gerais de leads
  async getLeadsStats(periodoDias = 1, campanha = null) {
    try {
      const connection = await this.pool.getConnection()
      
      let whereClause = 'WHERE DATE(timestamp) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)'
      let params = [periodoDias - 1]
      
      if (campanha) {
        whereClause += ' AND campaign LIKE ?'
        params.push(`%${campanha}%`)
      }
      
      // Buscar cliques em CTA
      const [clickStats] = await connection.execute(`
        SELECT 
          COUNT(*) as total_clicks,
          COUNT(DISTINCT lead_email) as emails_unicos,
          COUNT(DISTINCT lead_cidade) as cidades_distintas,
          COUNT(DISTINCT campaign) as campanhas_distintas
        FROM click_cta_events 
        ${whereClause}
      `, params)
      
      // Buscar submissões de formulário
      const [formStats] = await connection.execute(`
        SELECT 
          COUNT(*) as total_submissions,
          COUNT(DISTINCT lead_email) as emails_unicos,
          COUNT(DISTINCT lead_cidade) as cidades_distintas,
          COUNT(DISTINCT campaign) as campanhas_distintas
        FROM submit_form_events 
        ${whereClause}
      `, params)
      
      connection.release()
      
      return {
        success: true,
        clickStats: clickStats[0] || {},
        formStats: formStats[0] || {},
        periodo: periodoDias
      }
      
    } catch (error) {
      logger.error('❌ Erro ao buscar estatísticas de leads:', {
        erro: error.message,
        stack: error.stack,
        periodoDias,
        campanha,
        categoria: 'database_query',
        operacao: 'erro_buscar_leads_stats'
      })
      throw error
    }
  }

  async getTopCampaigns(periodoDias = 1, limit = 5) {
    try {
      const connection = await this.pool.getConnection()
      
      const [clickCampaigns] = await connection.execute(`
        SELECT 
          campaign,
          COUNT(*) as total_events,
          COUNT(DISTINCT lead_email) as unique_leads
        FROM click_cta_events 
        WHERE DATE(timestamp) >= DATE_SUB(CURDATE(), INTERVAL ? DAY) 
        AND campaign IS NOT NULL
        GROUP BY campaign
        ORDER BY total_events DESC
      `, [periodoDias - 1])
      
      const [formCampaigns] = await connection.execute(`
        SELECT 
          campaign,
          COUNT(*) as total_events,
          COUNT(DISTINCT lead_email) as unique_leads
        FROM submit_form_events 
        WHERE DATE(timestamp) >= DATE_SUB(CURDATE(), INTERVAL ? DAY) 
        AND campaign IS NOT NULL
        GROUP BY campaign
        ORDER BY total_events DESC
      `, [periodoDias - 1])
      
      connection.release()
      
      // Resto da função permanece igual...
      const campaignMap = new Map()
      
      clickCampaigns.forEach(campaign => {
        const key = campaign.campaign
        if (!campaignMap.has(key)) {
          campaignMap.set(key, {
            campaign: key,
            total_events: 0,
            unique_leads: 0
          })
        }
        const existing = campaignMap.get(key)
        existing.total_events += parseInt(campaign.total_events || 0)
        existing.unique_leads += parseInt(campaign.unique_leads || 0)
      })
      
      formCampaigns.forEach(campaign => {
        const key = campaign.campaign
        if (!campaignMap.has(key)) {
          campaignMap.set(key, {
            campaign: key,
            total_events: 0,
            unique_leads: 0
          })
        }
        const existing = campaignMap.get(key)
        existing.total_events += parseInt(campaign.total_events || 0)
        existing.unique_leads += parseInt(campaign.unique_leads || 0)
      })
      
      const campaigns = Array.from(campaignMap.values())
        .sort((a, b) => b.total_events - a.total_events)
        .slice(0, limit)
      
      return {
        success: true,
        campaigns: campaigns || []
      }
      
    } catch (error) {
      logger.error('❌ Erro ao buscar top campanhas:', {
        erro: error.message,
        stack: error.stack,
        periodoDias,
        limit,
        categoria: 'database_query',
        operacao: 'erro_buscar_top_campanhas'
      })
      throw error
    }
  }

  async getRecentLeads(periodoDias = 1, limit = 10) {
    try {
      const connection = await this.pool.getConnection()
      
      const [formLeads] = await connection.execute(`
        SELECT 
          lead_email,
          lead_nome,
          lead_empresa,
          lead_cidade,
          lead_estado,
          campaign,
          landing_page,
          source,
          timestamp,
          'form_submit' as lead_source
        FROM submit_form_events 
        WHERE DATE(timestamp) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        ORDER BY timestamp DESC
      `, [periodoDias - 1])

      const [clickLeads] = await connection.execute(`
        SELECT 
          lead_email,
          lead_nome,
          lead_empresa,
          lead_cidade,
          lead_estado,
          campaign,
          landing_page,
          source,
          timestamp,
          'click_cta' as lead_source
        FROM click_cta_events 
        WHERE DATE(timestamp) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        ORDER BY timestamp DESC
      `, [periodoDias - 1])
            
      connection.release()
      
      const allLeads = [...formLeads, ...clickLeads]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit)
      
      return {
        success: true,
        leads: allLeads || []
      }
      
    } catch (error) {
      logger.error('❌ Erro ao buscar leads recentes:', {
        erro: error.message,
        stack: error.stack,
        periodoDias,
        limit,
        categoria: 'database_query',
        operacao: 'erro_buscar_leads_recentes'
      })
      throw error
    }
  }

  async getPageviewsStats(periodoDias = 1, campanha = null) {
    try {
      const connection = await this.pool.getConnection()
      
      let whereClause = 'WHERE DATE(timestamp) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)'
      let params = [periodoDias - 1]
      
      if (campanha) {
        whereClause += ' AND page_url LIKE ?'
        params.push(`%${campanha}%`)
      }
      
      // Buscar pageviews
      const [pageviewStats] = await connection.execute(`
        SELECT 
          COUNT(*) as total_pageviews,
          COUNT(DISTINCT session_id) as sessoes_unicas,
          COUNT(DISTINCT user_ip) as ips_unicos
        FROM pageview_events 
        ${whereClause}
      `, params)
      
      connection.release()
      
      return {
        success: true,
        pageviewStats: pageviewStats[0] || {}
      }
      
    } catch (error) {
      logger.error('❌ Erro ao buscar estatísticas de pageviews:', {
        erro: error.message,
        stack: error.stack,
        periodoDias,
        campanha,
        categoria: 'database_query',
        operacao: 'erro_buscar_pageviews_stats'
      })
      throw error
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end()
      this.isConnected = false
      logger.info('🔒 Conexão com MySQL encerrada', {
        categoria: 'database_connection',
        operacao: 'conexao_encerrada'
      })
    }
  }
}

export default new Database()