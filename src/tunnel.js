import dotenv from "dotenv"
import { spawn } from 'child_process'
import logger from './logger.js'
import fetch from 'node-fetch'

dotenv.config()

class CloudflareTunnel {
  constructor() {
    this.process = null
    this.url = null
    this.urlFixa = process.env.URL_FIXA_DOMINIO || null
    this.isFixedUrlActive = false
}

  // Função para verificar se a URL fixa está ativa
  async checkFixedUrlHealth(port = 3000) {
    if (!this.urlFixa) {
      logger.warn('⚠️ URL fixa não configurada, pulando verificação', {
        categoria: 'cloudflare_tunnel',
        operacao: 'url_fixa_nao_configurada'
      })
      return false
    }

    try {
      logger.info('🔍 Verificando se API está online na URL fixa...', {
        urlFixa: this.urlFixa,
        categoria: 'cloudflare_tunnel',
        operacao: 'verificando_url_fixa'
      })

      const healthCheckUrl = `${this.urlFixa}/health`
      const response = await fetch(healthCheckUrl, {
        method: 'GET',
        timeout: 10000, // 10 segundos
        headers: {
          'User-Agent': '4events-bot-health-check'
        }
      })

      if (response.ok) {
        const data = await response.json()
        
        if (data.status === 'ok') {
          this.isFixedUrlActive = true
          
          logger.info('✅ API confirmada como online na URL fixa', {
            urlFixa: this.urlFixa,
            statusCode: response.status,
            responseData: data,
            service: data.service || 'N/A',
            version: data.version || 'N/A',
            categoria: 'cloudflare_tunnel',
            operacao: 'url_fixa_ativa'
          })
          
          return true
        } else {
          logger.warn('⚠️ API respondeu mas status não é "ok"', {
            urlFixa: this.urlFixa,
            statusCode: response.status,
            responseStatus: data.status,
            categoria: 'cloudflare_tunnel',
            operacao: 'url_fixa_status_incorreto'
          })
          return false
        }
      } else {
        logger.warn('⚠️ URL fixa respondeu com status HTTP não-ok', {
          urlFixa: this.urlFixa,
          statusCode: response.status,
          statusText: response.statusText,
          categoria: 'cloudflare_tunnel',
          operacao: 'url_fixa_http_erro'
        })
        return false
      }

    } catch (error) {
      logger.warn('⚠️ Erro ao verificar URL fixa (pode não estar ativa ainda)', {
        urlFixa: this.urlFixa,
        erro: error.message,
        errorCode: error.code,
        categoria: 'cloudflare_tunnel',
        operacao: 'url_fixa_erro_conexao'
      })
      return false
    }
  }

  // Função para monitorar continuamente a URL fixa
  async startFixedUrlMonitoring(intervalMinutes = 30) {
    if (!this.urlFixa) return

    const checkInterval = intervalMinutes * 60 * 1000 // Converter para ms
    
    logger.info('🔄 Iniciando monitoramento contínuo da URL fixa', {
      urlFixa: this.urlFixa,
      intervalMinutos: intervalMinutes,
      categoria: 'cloudflare_tunnel',
      operacao: 'iniciando_monitoramento_url_fixa'
    })

    // Verificação inicial
    await this.checkFixedUrlHealth()

    // Verificações periódicas
    this.fixedUrlMonitor = setInterval(async () => {
      const wasActive = this.isFixedUrlActive
      const isActive = await this.checkFixedUrlHealth()
      
      // Log apenas se houve mudança de status
      if (wasActive !== isActive) {
        if (isActive) {
          logger.info('🟢 URL fixa ficou ativa', {
            urlFixa: this.urlFixa,
            categoria: 'cloudflare_tunnel',
            operacao: 'url_fixa_ativada'
          })
        } else {
          logger.warn('🔴 URL fixa ficou inativa', {
            urlFixa: this.urlFixa,
            categoria: 'cloudflare_tunnel',
            operacao: 'url_fixa_desativada'
          })
        }
      }
    }, checkInterval)
  }

  async start(port = 3000) {
    // Primeiro, verifica se a URL fixa já está ativa
    const isFixedActive = await this.checkFixedUrlHealth(port)
    
    if (isFixedActive) {
      logger.info('🎯 URL fixa já está ativa, usando-a como principal', {
        urlFixa: this.urlFixa,
        porta: port,
        categoria: 'cloudflare_tunnel',
        operacao: 'usando_url_fixa'
      })
      
      // Inicia monitoramento da URL fixa
      this.startFixedUrlMonitoring()
      
      return this.urlFixa
    }

    // Se URL fixa não está ativa, cria tunnel temporário
    logger.info('🌐 URL fixa não disponível, criando tunnel temporário...', {
      urlFixa: this.urlFixa || 'não configurada',
      categoria: 'cloudflare_tunnel',
      operacao: 'criando_tunnel_temporario'
    })

    return new Promise((resolve, reject) => {
      logger.info('🌐 Iniciando Cloudflare Tunnel...', {
        porta: port,
        categoria: 'cloudflare_tunnel',
        operacao: 'iniciando_tunnel'
      })

      const command = 'cloudflared'
      const args = ['tunnel', '--url', `http://localhost:${port}`]
      
      const options = {
        shell: true,
        stdio: ['inherit', 'pipe', 'pipe']
      }

      this.process = spawn(command, args, options)

      let urlEncontrada = false
      // Regex para capturar URLs do trycloudflare.com
      const urlRegex = /https:\/\/[a-zA-Z0-9\-]+\.trycloudflare\.com/g

      // Função para processar output e procurar URL
      const processOutput = (data) => {
        const output = data.toString()
        
        const urlMatch = output.match(urlRegex)
        
        if (urlMatch && !urlEncontrada) {
          this.url = urlMatch[0]
          urlEncontrada = true
          
          logger.info('✅ Cloudflare Tunnel ativo (temporário)', {
            urlPublica: this.url,
            urlFixa: this.urlFixa || 'não configurada',
            isFixedActive: this.isFixedUrlActive,
            porta: port,
            categoria: 'cloudflare_tunnel',
            operacao: 'tunnel_temporario_ativo'
          })
          
          // Inicia monitoramento da URL fixa em paralelo
          this.startFixedUrlMonitoring()
          
          resolve(this.url)
        }
      }

      // Escuta apenas stdout para capturar a URL
      this.process.stdout.on('data', processOutput)
      
      // Escuta stderr para capturar a URL
      this.process.stderr.on('data', processOutput)

      this.process.on('error', (error) => {
        if (error.code === 'ENOENT') {
          logger.error('❌ Cloudflared não encontrado. Verifique se está instalado e no PATH', {
            error: error.message,
            code: error.code,
            categoria: 'cloudflare_tunnel',
            operacao: 'comando_nao_encontrado'
          })
          reject(new Error('Cloudflared não encontrado. Instale cloudflared e adicione ao PATH do sistema.'))
        } else {
          logger.error('❌ Erro ao iniciar Cloudflare Tunnel:', {
            error: error.message,
            code: error.code,
            categoria: 'cloudflare_tunnel',
            operacao: 'erro_inicializacao'
          })
          reject(error)
        }
      })

      this.process.on('close', (code) => {
        logger.info('🛑 Cloudflare Tunnel encerrado', {
          exitCode: code,
          categoria: 'cloudflare_tunnel',
          operacao: 'tunnel_encerrado'
        })
      })

      // Timeout de 30 segundos
      setTimeout(() => {
        if (!urlEncontrada) {
          logger.error('❌ Timeout: URL do tunnel não encontrada', {
            timeout: '30 segundos',
            categoria: 'cloudflare_tunnel',
            operacao: 'timeout_erro'
          })
          reject(new Error('Timeout: URL do tunnel não encontrada em 30 segundos'))
        }
      }, 30000)
    })
  }

  stop() {
    // Para o processo do tunnel
    if (this.process) {
      this.process.kill()
      logger.info('🛑 Cloudflare Tunnel parado manualmente', {
        categoria: 'cloudflare_tunnel',
        operacao: 'tunnel_parado'
      })
    }

    // Para o monitoramento da URL fixa
    if (this.fixedUrlMonitor) {
      clearInterval(this.fixedUrlMonitor)
      logger.info('🛑 Monitoramento da URL fixa parado', {
        categoria: 'cloudflare_tunnel',
        operacao: 'monitoramento_url_fixa_parado'
      })
    }
  }

  getUrl() {
    // Prioriza URL fixa se estiver ativa
    if (this.isFixedUrlActive && this.urlFixa) {
      return this.urlFixa
    }
    return this.url
  }

  getStatus() {
    return {
      tunnelUrl: this.url,
      fixedUrl: this.urlFixa,
      isFixedUrlActive: this.isFixedUrlActive,
      activeUrl: this.getUrl()
    }
  }
}

export default new CloudflareTunnel()