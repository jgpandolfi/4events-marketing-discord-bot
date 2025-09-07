import {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  StringSelectMenuBuilder,
  SelectMenuOptionBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  AttachmentBuilder,
  FileBuilder
} from "discord.js"
import fs from "fs"
import path from "path"
import { zip } from 'zip-a-folder'
import dotenv from "dotenv"
import fetch from "node-fetch"
import logger, { logCommand, logError, logWebhook, logPerformance } from './logger.js'
import database from './database.js'
import apiServer from './api.js'
import tunnel from './tunnel.js'

import { createRequire } from "module"
const require = createRequire(import.meta.url)
const emojis = require("./emojis.json")

dotenv.config()

// Configurações de retry
const RETRY_CONFIG = {
  maxTentativas: 3,
  delayInicial: 1000, // 1 segundo
  backoffMultiplier: 1.5, // Aumenta 50% a cada tentativa
  retriableErrors: ['500', 'Internal Server Error', 'ECONNRESET', 'ETIMEDOUT']
}

// Validação das variáveis de ambiente
if (!process.env.BOT_TOKEN) {
  logger.error("❌ Erro: BOT_TOKEN não está configurado no arquivo .env", { 
  missingConfig: 'BOT_TOKEN' 
})
  process.exit(1)
}

if (!process.env.CANAL_MARKETING) {
  logger.error("❌ Erro: CANAL_MARKETING não está configurado no arquivo .env", { 
  missingConfig: 'CANAL_MARKETING' 
})
  process.exit(1)
}

if (!process.env.CLARITY_PROJECT_ID) {
  logger.error("❌ Erro: CLARITY_PROJECT_ID não está configurado no arquivo .env", { 
  missingConfig: 'CLARITY_PROJECT_ID' 
})
  process.exit(1)
}

if (!process.env.CLARITY_API_TOKEN) {
  logger.error("❌ Erro: CLARITY_API_TOKEN não está configurado no arquivo .env", { 
  missingConfig: 'CLARITY_API_TOKEN' 
})
  process.exit(1)
}

if (!process.env.BOT_ADMIN_DISCORD_USERS_ID) {
  logger.error("❌ Erro: BOT_ADMIN_DISCORD_USERS_ID não está configurado no arquivo .env", { 
    missingConfig: 'BOT_ADMIN_DISCORD_USERS_ID' 
  })
  process.exit(1)
}

if (!process.env.API_PORT) {
  logger.error("❌ Erro: API_PORT não está configurado no arquivo .env", { 
    missingConfig: 'API_PORT' 
  })
  process.exit(1)
}

if (!process.env.DB_HOST) {
  logger.error("❌ Erro: DB_HOST não está configurado no arquivo .env", { 
    missingConfig: 'DB_HOST' 
  })
  process.exit(1)
}

if (!process.env.DB_USER) {
  logger.error("❌ Erro: DB_USER não está configurado no arquivo .env", { 
    missingConfig: 'DB_USER' 
  })
  process.exit(1)
}

if (!process.env.DB_PASSWORD) {
  logger.error("❌ Erro: DB_PASSWORD não está configurado no arquivo .env", { 
    missingConfig: 'DB_PASSWORD' 
  })
  process.exit(1)
}

if (!process.env.DB_NAME) {
  logger.error("❌ Erro: DB_NAME não está configurado no arquivo .env", { 
    missingConfig: 'DB_NAME' 
  })
  process.exit(1)
}

if (process.env.NODE_ENV === 'production' && !process.env.TUNNEL_ENABLED) {
  logger.warn("⚠️ TUNNEL_ENABLED não está configurado no arquivo .env", { 
    configuracao: 'TUNNEL_ENABLED',
    valorPadrao: 'false',
    categoria: 'validacao_config'
  })
}

if (process.env.NODE_ENV === 'production' && process.env.TUNNEL_ENABLED === 'true' && !process.env.URL_FIXA_DOMINIO) {
  logger.warn("⚠️ URL_FIXA_DOMINIO não está configurada no arquivo .env", { 
    configuracao: 'URL_FIXA_DOMINIO',
    categoria: 'validacao_config'
  })
}

// Configuração da webhook do N8N
const WEBHOOK_URL = process.env.WEBHOOK
const WEBHOOK_URL_PARCERIA = process.env.WEBHOOK_PARCERIA

// Configuração da API do Microsoft Clarity
const CLARITY_PROJECT_ID = process.env.CLARITY_PROJECT_ID
const CLARITY_API_TOKEN = process.env.CLARITY_API_TOKEN
const CLARITY_BASE_URL = "https://www.clarity.ms/export-data/api/v1"

// Lista de IDs de usuários do Discord que são administradores do bot
const BOT_ADMIN_DISCORD_USERS_ID = process.env.BOT_ADMIN_DISCORD_USERS_ID.split(',').map(id => id.trim())

// Cria o cliente do Discord com as intents necessárias
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
})

// Função auxiliar para implementar retry com backoff progressivo
async function executarComRetry(funcaoAsync, parametros, maxTentativas = 3, delayInicial = 1000) {
  let ultimoErro = null
  
  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    try {
      logger.info(`📤 Tentativa ${tentativa}/${maxTentativas}`, {
        tentativa,
        maxTentativas,
        funcao: funcaoAsync.name
      })
      
      const resultado = await funcaoAsync(...parametros)
      
      // Se sucesso, retorna imediatamente
      if (resultado.success) {
        if (tentativa > 1) {
          logger.info(`✅ Sucesso na tentativa ${tentativa}/${maxTentativas}`, {
            tentativa,
            maxTentativas,
            sucesso: true,
            funcao: funcaoAsync.name
          })
        }
        return resultado
      }
      
      // Se não é erro 500, não tenta novamente
      if (!resultado.error?.includes('500') && !resultado.error?.includes('Internal Server Error')) {
        logger.warn(`❌ Erro não temporário detectado, não retentar: ${resultado.error}`, {
          erro: resultado.error,
          tentativa,
          maxTentativas,
          tipoErro: 'nao_temporario'
        })
        return resultado
      }
      
      ultimoErro = resultado
      
      // Se não é a última tentativa, aguarda antes de tentar novamente
      if (tentativa < maxTentativas) {
        const delay = delayInicial * Math.pow(RETRY_CONFIG.backoffMultiplier, tentativa - 1) // Backoff progressivo
        logger.info(`⏳ Aguardando ${delay}ms antes da próxima tentativa...`, {
          delay,
          tentativa,
          maxTentativas,
          proximaTentativa: tentativa + 1
        })
        await new Promise(resolve => setTimeout(resolve, delay))
      }
      
    } catch (error) {
      ultimoErro = { success: false, error: error.message }
      
      if (tentativa < maxTentativas) {
        const delay = delayInicial * Math.pow(RETRY_CONFIG.backoffMultiplier, tentativa - 1)
        logger.warn(`⏳ Erro capturado, aguardando ${delay}ms antes da próxima tentativa...`, {
          erro: error.message,
          delay,
          tentativa,
          maxTentativas,
          proximaTentativa: tentativa + 1
        })
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  // Se chegou aqui, todas as tentativas falharam
  logger.error(`❌ Todas as ${maxTentativas} tentativas falharam`, {
    maxTentativas,
    ultimoErro: ultimoErro?.error,
    funcao: funcaoAsync.name,
    falhaTotal: true
  })
  return ultimoErro || { success: false, error: "Todas as tentativas falharam" }
}

// Função para executar retry com feedback visual para o usuário
async function executarComRetryComFeedback(interaction, funcaoAsync, parametros, tipoOperacao = "operação") {
  let ultimoErro = null
  const maxTentativas = RETRY_CONFIG.maxTentativas
  const delayInicial = RETRY_CONFIG.delayInicial
  
  logger.info("Iniciando retry com feedback visual", {
    tipoOperacao,
    maxTentativas,
    delayInicial,
    usuario: interaction.user.username,
    funcao: funcaoAsync.name
  })
  
  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    try {
      // Atualiza mensagem durante tentativas (só a partir da segunda)
      if (tentativa > 1) {
        const loadingEmoji = obterEmoji("loading")
        await interaction.editReply(
          `${loadingEmoji} Tentativa ${tentativa}/${maxTentativas} - Processando ${tipoOperacao}...`
        )
        
        logger.info("Feedback visual atualizado para tentativa", {
          tentativa,
          maxTentativas,
          tipoOperacao,
          usuario: interaction.user.username
        })
      }
      
      const resultado = await funcaoAsync(...parametros)
      
      if (resultado.success) {
        if (tentativa > 1) {
          logger.info("Sucesso após retry com feedback", {
            tentativa,
            maxTentativas,
            tipoOperacao,
            usuario: interaction.user.username,
            sucesso: true
          })
        }
        return resultado
      }
      
      // Se não é erro 500, não tenta novamente
      if (!resultado.error?.includes('500') && !resultado.error?.includes('Internal Server Error')) {
        logger.warn("Erro não temporário detectado no retry com feedback", {
          erro: resultado.error,
          tentativa,
          maxTentativas,
          tipoOperacao,
          tipoErro: 'nao_temporario',
          usuario: interaction.user.username
        })
        return resultado
      }
      
      ultimoErro = resultado
      
      // Aguarda antes da próxima tentativa
      if (tentativa < maxTentativas) {
        const delay = delayInicial * Math.pow(RETRY_CONFIG.backoffMultiplier, tentativa - 1)
        
        const loadingEmoji = obterEmoji("loading")
        await interaction.editReply(
          `${loadingEmoji} Instabilidade detectada. Tentando novamente em ${Math.round(delay/1000)}s... (${tentativa}/${maxTentativas})`
        )
        
        logger.info("Aguardando delay antes da próxima tentativa com feedback", {
          delay,
          tentativa,
          maxTentativas,
          tipoOperacao,
          proximaTentativa: tentativa + 1,
          usuario: interaction.user.username
        })
        
        await new Promise(resolve => setTimeout(resolve, delay))
      }
      
    } catch (error) {
      ultimoErro = { success: false, error: error.message }
      
      logger.error("Erro capturado durante retry com feedback", {
        erro: error.message,
        tentativa,
        maxTentativas,
        tipoOperacao,
        usuario: interaction.user.username,
        stack: error.stack
      })
      
      if (tentativa < maxTentativas) {
        const delay = delayInicial * Math.pow(RETRY_CONFIG.backoffMultiplier, tentativa - 1)
        
        logger.info("Aguardando delay após erro capturado", {
          delay,
          tentativa,
          maxTentativas,
          proximaTentativa: tentativa + 1,
          usuario: interaction.user.username
        })
        
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  logger.error("Todas as tentativas falharam no retry com feedback", {
    maxTentativas,
    tipoOperacao,
    ultimoErro: ultimoErro?.error,
    usuario: interaction.user.username,
    falhaTotal: true
  })
  
  return ultimoErro || { success: false, error: "Todas as tentativas falharam" }
}

// Função auxiliar para obter string de emoji personalizado do bot (emojis.json)
function obterEmoji(nomeEmoji) {
  try {
    // Verifica se o emoji existe na categoria estático
    if (emojis.estatico && emojis.estatico[nomeEmoji]) {
      return `<:${nomeEmoji}:${emojis.estatico[nomeEmoji]}>`
    }

    // Verifica se o emoji existe na categoria animado
    if (emojis.animado && emojis.animado[nomeEmoji]) {
      return `<a:${nomeEmoji}:${emojis.animado[nomeEmoji]}>`
    }

    // Retorna vazio se não encontrar o emoji
    logger.warn(`❌ O emoji personalizado de nome ${nomeEmoji} não existe`, {
      nomeEmoji,
      categoria: 'emoji_nao_encontrado',
      emojisEstatico: Object.keys(emojis.estatico || {}),
      emojisAnimado: Object.keys(emojis.animado || {}),
      totalEmojisDisponiveis: (Object.keys(emojis.estatico || {}).length + Object.keys(emojis.animado || {}).length)
    })
    return ""
  } catch (erro) {
    logger.error(`❌ Erro ao obter emoji ${nomeEmoji}: ${erro.message}`, {
      nomeEmoji,
      erro: erro.message,
      stack: erro.stack,
      categoria: 'erro_obter_emoji',
      emojisCarregados: !!(emojis.estatico || emojis.animado)
    })
    return ""
  }
}

// Função para ler arquivos de log
async function lerArquivosLog(tipoLog = 'geral') {
  try {
    const logsDir = path.join(process.cwd(), 'logs')
    const hoje = new Date().toISOString().split('T')[0]
    
    let nomeArquivo
    switch (tipoLog) {
      case 'error':
        nomeArquivo = `4events-bot-error-${hoje}.log`
        break
      case 'commands':
        nomeArquivo = `4events-bot-commands-${hoje}.log`
        break
      case 'exceptions':
        nomeArquivo = `4events-bot-exceptions-${hoje}.log`
        break
      default:
        nomeArquivo = `4events-bot-${hoje}.log`
    }
    
    const caminhoArquivo = path.join(logsDir, nomeArquivo)
    
    if (!fs.existsSync(caminhoArquivo)) {
      return { success: false, error: `Arquivo de log não encontrado: ${nomeArquivo}` }
    }
    
    const conteudo = fs.readFileSync(caminhoArquivo, 'utf8')
    const linhas = conteudo.trim().split('\n').filter(linha => linha.trim() !== '')
    
    // Pega as últimas 10 linhas
    const ultimasLinhas = linhas.slice(-10)
    
    const logs = ultimasLinhas.map(linha => {
      try {
        return JSON.parse(linha)
      } catch {
        return { timestamp: 'N/A', level: 'info', message: linha }
      }
    })
    
    return { success: true, logs, total: linhas.length, arquivo: nomeArquivo }
    
  } catch (error) {
    logger.error("❌ Erro ao ler arquivos de log:", {
      erro: error.message,
      stack: error.stack,
      tipoLog: tipoLog,
      categoria: 'discord_comando_logs',
      operacao: 'erro_leitura_logs'
    })
    
    return { success: false, error: error.message }
  }
}

// Função para criar container inicial do comando de logs com Components V2
function criarContainerInicialLogs(categoriaSelecionada = 'geral', resultadoLogs = null) {
  const dropdown = new StringSelectMenuBuilder()
    .setCustomId('select_log_category')
    .setPlaceholder('🔍 Selecione a categoria de logs')
    .addOptions([
      {
        label: '🌎 Todos',
        description: 'Exibe todos os logs',
        value: 'geral',
        default: categoriaSelecionada === 'geral'
      },
      {
        label: '❌ Apenas erros',
        description: 'Exibe somente erros',
        value: 'error',
        default: categoriaSelecionada === 'error'
      },
      {
        label: '⌨️ Apenas comandos',
        description: 'Exibe logs de comandos',
        value: 'commands',
        default: categoriaSelecionada === 'commands'
      },
      {
        label: '🚨 Apenas exceções',
        description: 'Exibe logs de exceções',
        value: 'exceptions',
        default: categoriaSelecionada === 'exceptions'
      },
    ])

  const container = new ContainerBuilder()
    .setAccentColor(16731904) // Cor laranja da 4.events (0xff4f00)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`### ${obterEmoji("search")} Logs do sistema`),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(dropdown)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("☝️ Selecione no menu acima a categoria de logs que deseja visualizar."),
    )

  // Se temos dados de logs, exibir informações
  if (resultadoLogs && resultadoLogs.success) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`### ${obterEmoji("info")} ${categoriaSelecionada.toUpperCase()}`),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Arquivo:** \`${resultadoLogs.arquivo}\`\n**Total de logs hoje:** \`${resultadoLogs.total}\``),
    )

    // Formatar logs para exibição
    if (resultadoLogs.logs && resultadoLogs.logs.length > 0) {
      const logsTexto = formatarLogsParaContainer(resultadoLogs.logs)
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent("**Últimos 10 registros:**"),
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(logsTexto),
      )
    } else {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent("Nenhum log encontrado para esta categoria hoje."),
      )
    }
  } else if (resultadoLogs && !resultadoLogs.success) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`${obterEmoji("errado")} **Erro:** ${resultadoLogs.error}`),
    )
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
  )

  // Criar um botão de download dos logs (.zip)
  const downloadLogsButton = new ButtonBuilder()
    .setCustomId('download_logs_zip') 
    .setLabel('Baixar logs')
    .setStyle(ButtonStyle.Secondary)

  // Criar o botão
  const limparLogsButton = new ButtonBuilder()
    .setCustomId('clear_logs')
    .setLabel('Limpar logs')
    .setStyle(ButtonStyle.Danger)

  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(downloadLogsButton, limparLogsButton)
  )

  return [container]
}

// Função para formatar logs para exibição em containers V2
function formatarLogsParaContainer(logs) {
  if (!logs || logs.length === 0) {
    return "Nenhum log encontrado."
  }
  
  const logsFormatados = logs.map((log, index) => {
    const timestamp = log.timestamp ? new Date(log.timestamp).toLocaleTimeString('pt-BR') : 'N/A'
    const level = log.level || 'info'
    const message = (log.message || 'N/A').substring(0, 120)
    
    const emoji = level === 'error' ? obterEmoji("errado") : 
                  level === 'warn' ? obterEmoji("warn") : 
                  obterEmoji("info")
    
    return `${emoji} \`${timestamp} [${level.toUpperCase()}] ${message}${message.length > 120 ? '...' : ''}\``
  }).join('\n')
  
  return logsFormatados
}

// Função auxiliar para criar o container inicial do comando /help
function criarContainerInicialHelp() {
  return [
    new ContainerBuilder()
      .setAccentColor(16731904) // Cor laranja da 4.events (0xff4f00)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`### ${obterEmoji("ajuda")} Central de ajuda`),
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("**Bot para criação de solicitações de tarefas de marketing, registro de parcerias e análise de performance.**\n\nAlém dessas funcionalidades principais, também foram implementadas funcionalidades para auxiliar em demais tarefas do dia a dia."),
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`### ${obterEmoji("config")} Selecione o que você precisa`),
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("👇 Escolha uma das opções abaixo para obter ajuda específica sobre cada funcionalidade do bot:"),
      )
      .addActionRowComponents(
        new ActionRowBuilder()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("help_select_menu")
              .setPlaceholder("🔍 Selecione uma opção de ajuda...")
              .addOptions(
                new SelectMenuOptionBuilder()
                  .setLabel("📋 Visão geral do bot")
                  .setValue("help_overview")
                  .setDescription("Informações gerais sobre o bot e suas funcionalidades"),
                new SelectMenuOptionBuilder()
                  .setLabel("📋 Comando /marketing")
                  .setValue("help_marketing")
                  .setDescription("Como criar solicitações de tarefas de marketing"),
                new SelectMenuOptionBuilder()
                  .setLabel("🤝 Comando /parceria")
                  .setValue("help_parceria")
                  .setDescription("Como registrar novas parcerias comerciais"),
                new SelectMenuOptionBuilder()
                  .setLabel("📊 Comando /leads")
                  .setValue("help_leads")
                  .setDescription("Como visualizar dados e estatísticas de leads"),
                new SelectMenuOptionBuilder()
                  .setLabel("📊 Comando /cro")
                  .setValue("help_cro")
                  .setDescription("Como obter dados de performance e estatísticas"),
                new SelectMenuOptionBuilder()
                  .setLabel("🎨 Comando /midiakit")
                  .setValue("help_midiakit")
                  .setDescription("Como acessar o mídia kit oficial da 4.events"),
                new SelectMenuOptionBuilder()
                  .setLabel("📊 Comando /apresentações")
                  .setValue("help_apresentacoes")
                  .setDescription("Como acessar apresentações comerciais oficiais"),
                new SelectMenuOptionBuilder()
                  .setLabel("📄 Comando /modelos")
                  .setValue("help_modelos")
                  .setDescription("Como acessar modelos de documentos e templates"),
                new SelectMenuOptionBuilder()
                  .setLabel("🖼️ Comandos de Imagens")
                  .setValue("help_images")
                  .setDescription("Capa LinkedIn e fundo de escritório"),
                new SelectMenuOptionBuilder()
                  .setLabel("🏓 Outros Comandos")
                  .setValue("help_others")
                  .setDescription("Ping e outras utilidades do bot"),
                new SelectMenuOptionBuilder()
                  .setLabel("📅 Formatos de Data")
                  .setValue("help_dates")
                  .setDescription("Como usar datas nos comandos do bot"),
              ),
        ),
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`${obterEmoji("warn")} **Importante:**\n• Use os comandos em qualquer canal do servidor\n• Desenvolvido especificamente para a equipe 4.events\n• Para suporte técnico, entre em contato com os administradores`),
      ),
  ];
}

// Função para gerar arquivo ZIP com todos os logs
async function gerarZipLogs() {
  const startTime = Date.now()
  
  try {
    const agora = new Date()
    const dataHora = agora.toISOString()
      .replace(/:/g, '-')
      .replace(/\./g, '-')
      .slice(0, 19) // Remove os milissegundos e o Z
    
    const nomeArquivo = `logs-${dataHora}.zip`
    const caminhoZip = path.join(process.cwd(), nomeArquivo)
    const pastaLogs = path.join(process.cwd(), 'logs')
    
    logger.info("🎯 Iniciando geração de arquivo ZIP dos logs", {
      nomeArquivo: nomeArquivo,
      caminhoZip: caminhoZip,
      pastaLogs: pastaLogs,
      dataHoraFormatada: dataHora,
      timestamp: agora.toISOString(),
      categoria: 'zip_logs_operacao',
      operacao: 'inicio_geracao_zip'
    })
    
    // Verifica se a pasta logs existe
    if (!fs.existsSync(pastaLogs)) {
      logger.error("❌ Pasta de logs não encontrada durante geração ZIP", {
        pastaLogs: pastaLogs,
        pastaExiste: false,
        nomeArquivo: nomeArquivo,
        categoria: 'zip_logs_erro',
        operacao: 'pasta_logs_nao_encontrada'
      })
      return { success: false, error: "Pasta de logs não encontrada" }
    }
    
    // Lista conteúdo da pasta logs para debugging
    const arquivosLogs = fs.readdirSync(pastaLogs)
    const estatisticasPasta = {
      totalArquivos: arquivosLogs.length,
      arquivos: arquivosLogs.map(arquivo => {
        const caminhoCompleto = path.join(pastaLogs, arquivo)
        const stats = fs.statSync(caminhoCompleto)
        return {
          nome: arquivo,
          tamanho: stats.size,
          modificado: stats.mtime.toISOString()
        }
      }),
      tamanhoTotal: arquivosLogs.reduce((total, arquivo) => {
        const stats = fs.statSync(path.join(pastaLogs, arquivo))
        return total + stats.size
      }, 0)
    }
    
    logger.info("📁 Conteúdo da pasta logs identificado", {
      ...estatisticasPasta,
      pastaLogs: pastaLogs,
      nomeArquivo: nomeArquivo,
      categoria: 'zip_logs_operacao',
      operacao: 'analise_pasta_logs'
    })
    
    // Remove arquivo ZIP anterior se existir
    const arquivosZipExistentes = fs.readdirSync(process.cwd())
      .filter(arquivo => arquivo.startsWith('logs-') && arquivo.endsWith('.zip'))
    
    if (arquivosZipExistentes.length > 0) {
      logger.info("🗑️ Removendo arquivos ZIP anteriores", {
        arquivosParaRemover: arquivosZipExistentes,
        totalArquivos: arquivosZipExistentes.length,
        nomeArquivo: nomeArquivo,
        categoria: 'zip_logs_operacao',
        operacao: 'limpeza_arquivos_antigos'
      })
      
      for (const arquivo of arquivosZipExistentes) {
        const caminhoArquivo = path.join(process.cwd(), arquivo)
        try {
          fs.unlinkSync(caminhoArquivo)
          logger.info(`✅ Arquivo ZIP anterior removido: ${arquivo}`, {
            arquivoRemovido: arquivo,
            caminhoCompleto: caminhoArquivo,
            nomeArquivo: nomeArquivo,
            categoria: 'zip_logs_operacao',
            operacao: 'arquivo_antigo_removido'
          })
        } catch (errorRemove) {
          logger.warn(`⚠️ Falha ao remover arquivo ZIP anterior: ${arquivo}`, {
            arquivoNaoRemovido: arquivo,
            erro: errorRemove.message,
            caminhoCompleto: caminhoArquivo,
            nomeArquivo: nomeArquivo,
            categoria: 'zip_logs_warning',
            operacao: 'erro_remover_arquivo_antigo'
          })
        }
      }
    } else {
      logger.info("ℹ️ Nenhum arquivo ZIP anterior encontrado", {
        diretorioVerificado: process.cwd(),
        nomeArquivo: nomeArquivo,
        categoria: 'zip_logs_operacao',
        operacao: 'nenhum_arquivo_antigo'
      })
    }
    
    // Gera o novo arquivo ZIP
    logger.info("🔄 Iniciando compactação da pasta logs", {
      pastaOrigem: pastaLogs,
      arquivoDestino: caminhoZip,
      nomeArquivo: nomeArquivo,
      arquivosParaComprimir: estatisticasPasta.totalArquivos,
      tamanhoTotalMB: (estatisticasPasta.tamanhoTotal / 1024 / 1024).toFixed(2),
      categoria: 'zip_logs_operacao',
      operacao: 'inicio_compactacao'
    })
    
    await zip(pastaLogs, caminhoZip)
    
    // Verifica se o arquivo foi criado e obtém informações
    if (!fs.existsSync(caminhoZip)) {
      logger.error("❌ Arquivo ZIP não foi criado apesar de não haver erro na compactação", {
        caminhoEsperado: caminhoZip,
        nomeArquivo: nomeArquivo,
        pastaOrigem: pastaLogs,
        categoria: 'zip_logs_erro',
        operacao: 'arquivo_zip_nao_criado'
      })
      return { success: false, error: "Arquivo ZIP não foi criado" }
    }
    
    const statsZip = fs.statSync(caminhoZip)
    const duracaoMs = Date.now() - startTime
    
    logger.info("✅ Arquivo ZIP de logs gerado com sucesso", {
      nomeArquivo: nomeArquivo,
      caminhoCompleto: caminhoZip,
      tamanhoBytes: statsZip.size,
      tamanhoMB: (statsZip.size / 1024 / 1024).toFixed(2),
      duracaoMs: duracaoMs,
      duracaoFormatada: `${(duracaoMs / 1000).toFixed(2)}s`,
      arquivosComprimidos: estatisticasPasta.totalArquivos,
      taxaCompressao: ((1 - (statsZip.size / estatisticasPasta.tamanhoTotal)) * 100).toFixed(1) + '%',
      categoria: 'zip_logs_sucesso',
      operacao: 'zip_gerado_com_sucesso'
    })
    
    return { 
      success: true, 
      nomeArquivo: nomeArquivo,
      caminhoCompleto: caminhoZip,
      tamanho: statsZip.size,
      duracaoMs: duracaoMs,
      arquivosComprimidos: estatisticasPasta.totalArquivos
    }
    
  } catch (error) {
    const duracaoMs = Date.now() - startTime
    
    logger.error("❌ Erro ao gerar ZIP dos logs:", {
      erro: error.message,
      stack: error.stack,
      errorName: error.name,
      duracaoAteErroMs: duracaoMs,
      duracaoAteErroFormatada: `${(duracaoMs / 1000).toFixed(2)}s`,
      categoria: 'zip_logs_erro',
      operacao: 'erro_geracao_zip',
      fase: 'compactacao_ou_verificacao'
    })
    
    return { success: false, error: error.message }
  }
}

// Função para excluir todos os arquivos de logs
async function excluirTodosLogs() {
  const startTime = Date.now()
  
  try {
    const pastaLogs = path.join(process.cwd(), 'logs')
    
    logger.info("🗑️ Iniciando exclusão de todos os arquivos de logs", {
      pastaLogs: pastaLogs,
      timestamp: new Date().toISOString(),
      categoria: 'exclusao_logs_operacao',
      operacao: 'inicio_exclusao_logs'
    })
    
    // Verifica se a pasta logs existe
    if (!fs.existsSync(pastaLogs)) {
      logger.warn("⚠️ Pasta de logs não encontrada durante exclusão", {
        pastaLogs: pastaLogs,
        pastaExiste: false,
        categoria: 'exclusao_logs_warning',
        operacao: 'pasta_logs_nao_encontrada'
      })
      return { success: false, error: "Pasta de logs não encontrada" }
    }
    
    // Lista todos os arquivos da pasta logs
    const arquivosLogs = fs.readdirSync(pastaLogs)
    const estatisticasPasta = {
      totalArquivos: arquivosLogs.length,
      arquivos: arquivosLogs.map(arquivo => {
        const caminhoCompleto = path.join(pastaLogs, arquivo)
        const stats = fs.statSync(caminhoCompleto)
        return {
          nome: arquivo,
          tamanho: stats.size,
          modificado: stats.mtime.toISOString()
        }
      }),
      tamanhoTotal: arquivosLogs.reduce((total, arquivo) => {
        const stats = fs.statSync(path.join(pastaLogs, arquivo))
        return total + stats.size
      }, 0)
    }
    
    logger.info("📁 Arquivos de logs identificados para exclusão", {
      ...estatisticasPasta,
      pastaLogs: pastaLogs,
      categoria: 'exclusao_logs_operacao',
      operacao: 'analise_arquivos_logs'
    })
    
    // Exclui todos os arquivos
    let arquivosExcluidos = 0
    let errosExclusao = []
    
    for (const arquivo of arquivosLogs) {
      const caminhoArquivo = path.join(pastaLogs, arquivo)
      try {
        fs.unlinkSync(caminhoArquivo)
        arquivosExcluidos++
        
        logger.info(`✅ Arquivo de log excluído: ${arquivo}`, {
          arquivoExcluido: arquivo,
          caminhoCompleto: caminhoArquivo,
          categoria: 'exclusao_logs_operacao',
          operacao: 'arquivo_excluido_sucesso'
        })
      } catch (errorExclusao) {
        errosExclusao.push({
          arquivo: arquivo,
          erro: errorExclusao.message
        })
        
        logger.error(`❌ Erro ao excluir arquivo de log: ${arquivo}`, {
          arquivoNaoExcluido: arquivo,
          erro: errorExclusao.message,
          stack: errorExclusao.stack,
          caminhoCompleto: caminhoArquivo,
          categoria: 'exclusao_logs_erro',
          operacao: 'erro_excluir_arquivo'
        })
      }
    }
    
    const duracaoMs = Date.now() - startTime
    
    // Verifica se houve erros
    if (errosExclusao.length > 0) {
      logger.warn("⚠️ Exclusão de logs finalizada com alguns erros", {
        arquivosExcluidos: arquivosExcluidos,
        totalArquivos: arquivosLogs.length,
        errosExclusao: errosExclusao,
        duracaoMs: duracaoMs,
        duracaoFormatada: `${(duracaoMs / 1000).toFixed(2)}s`,
        categoria: 'exclusao_logs_warning',
        operacao: 'exclusao_finalizada_com_erros'
      })
      
      return { 
        success: false, 
        error: `${errosExclusao.length} arquivos não puderam ser excluídos`,
        arquivosExcluidos: arquivosExcluidos,
        totalArquivos: arquivosLogs.length,
        erros: errosExclusao
      }
    }
    
    logger.info("✅ Todos os arquivos de logs excluídos com sucesso", {
      arquivosExcluidos: arquivosExcluidos,
      totalArquivos: arquivosLogs.length,
      tamanhoTotalExcluidoMB: (estatisticasPasta.tamanhoTotal / 1024 / 1024).toFixed(2),
      duracaoMs: duracaoMs,
      duracaoFormatada: `${(duracaoMs / 1000).toFixed(2)}s`,
      categoria: 'exclusao_logs_sucesso',
      operacao: 'exclusao_finalizada_sucesso'
    })
    
    return { 
      success: true, 
      arquivosExcluidos: arquivosExcluidos,
      totalArquivos: arquivosLogs.length,
      tamanhoExcluidoMB: (estatisticasPasta.tamanhoTotal / 1024 / 1024).toFixed(2),
      duracaoMs: duracaoMs
    }
    
  } catch (error) {
    const duracaoMs = Date.now() - startTime
    
    logger.error("❌ Erro crítico ao excluir logs:", {
      erro: error.message,
      stack: error.stack,
      errorName: error.name,
      duracaoAteErroMs: duracaoMs,
      duracaoAteErroFormatada: `${(duracaoMs / 1000).toFixed(2)}s`,
      categoria: 'exclusao_logs_erro',
      operacao: 'erro_critico_exclusao',
      fase: 'exclusao_geral'
    })
    
    return { success: false, error: error.message }
  }
}

// Função para criar container de confirmação de exclusão de logs
function criarContainerConfirmacaoExclusaoLogs() {
  const containerConfirmacao = new ContainerBuilder()
    .setAccentColor(16711680) // Vermelho para indicar perigo
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`### ${obterEmoji("warn")} Confirmar exclusão de logs`),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("\n**Esta ação não pode ser revertida!**\nVocê tem certeza que deseja excluir **TODOS** os arquivos de logs do sistema?\nIsso incluirá:\n• `Logs gerais`\n• `Logs de comandos`\n• `Logs de erros`\n• `Logs de exceções`\n• `Arquivos de log microcompactados (.gz)`"),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
    )

  // Botão para confirmar exclusão
  const confirmarButton = new ButtonBuilder()
    .setCustomId('confirm_delete_logs')
    .setLabel('Excluir todos os logs')
    .setStyle(ButtonStyle.Danger)

  // Botão para cancelar
  const cancelarButton = new ButtonBuilder()
    .setCustomId('cancel_delete_logs')
    .setLabel('Cancelar')
    .setStyle(ButtonStyle.Secondary)

  containerConfirmacao.addActionRowComponents(
    new ActionRowBuilder().addComponents(cancelarButton, confirmarButton)
  )

  return [containerConfirmacao]
}

// Define o comando slash /marketing
const cmdMarketing = new SlashCommandBuilder()
  .setName("marketing")
  .setDescription("📋 Cria uma nova solicitação de tarefa de marketing")

// Define o comando slash /parceria
const cmdParceria = new SlashCommandBuilder()
  .setName("parceria")
  .setDescription("🤝 Registra uma nova parceria comercial")

// Define o comando slash /cro
const cmdCro = new SlashCommandBuilder()
  .setName("cro")
  .setDescription("📊 Obtém dados de desempenho e estatísticas das páginas do site via Microsoft Clarity")
  .addStringOption((option) =>
    option
      .setName("data_desejada")
      .setDescription("Data para consulta das estatísticas (formato: DD/MM/AAAA) - padrão: hoje")
      .setRequired(false)
      .setMaxLength(10)
  )
  .addStringOption((option) =>
    option
      .setName("final_da_url_desejada")
      .setDescription("Final da URL para análise (ex: credenciamento) - padrão: dados consolidados do site")
      .setRequired(false)
      .setMaxLength(200)
  )

// Define o comando slash /midiakit
const cmdMidiaKit = new SlashCommandBuilder()
  .setName("midiakit")
  .setDescription("🎨 Acessa o mídia kit oficial da 4.events com logos, ícones e materiais audiovisuais")

// Define o comando slash /apresentações
const cmdApresentacoes = new SlashCommandBuilder()
  .setName("apresentações")
  .setDescription("📊 Acessa as apresentações comerciais oficiais da 4.events em PDF e editáveis online")

// Define o comando slash /modelos
const cmdModelos = new SlashCommandBuilder()
  .setName("modelos")
  .setDescription("📄 Acessa os modelos de documentos e templates com branding da 4.events")

// Define o comando slash /capa-linkedin
const cmdCapaLinkedin = new SlashCommandBuilder()
  .setName("capa-linkedin")
  .setDescription("🖼️ Acessa a capa oficial da 4.events para LinkedIn dos colaboradores")

// Define o comando slash /fundo-escritorio
const cmdFundoEscritorio = new SlashCommandBuilder()
  .setName("fundo-escritorio")
  .setDescription("🖥️ Acessa o papel de parede oficial da 4.events para área de trabalho")

// Define o comando /ping para teste
const cmdPing = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("🏓 Testa a conectividade do bot")

// Define o comando slash /leads
const cmdLeads = new SlashCommandBuilder()
  .setName("leads")
  .setDescription("📊 Exibe estatísticas e dados dos leads capturados pelas landing pages")
  .addStringOption((option) =>
    option
      .setName("periodo")
      .setDescription("Período para consulta dos leads (hoje, 7dias, 30dias) - padrão: hoje")
      .setRequired(false)
      .addChoices(
        { name: '🎯 Hoje', value: 'hoje' },
        { name: '📅 Últimos 7 dias', value: '7dias' },
        { name: '📈 Últimos 30 dias', value: '30dias' }
      )
  )
  .addStringOption((option) =>
    option
      .setName("campanha")
      .setDescription("Filtrar por campanha específica (opcional)")
      .setRequired(false)
      .setMaxLength(255)
  )

// Define o comando /help
const cmdHelp = new SlashCommandBuilder()
  .setName("help")
  .setDescription("❓ Mostra informações de ajuda sobre os comandos")

// Função para validar URL
function validarURL(url) {
  try {
    const urlObj = new URL(url)
    
    // Verifica se é uma URL válida e se contém domínios esperados
    const dominiosValidos = ['pipe.run', 'app.pipe.run', '4.works', 'app.4.works']
    const dominio = urlObj.hostname.toLowerCase()
    
    const dominioValido = dominiosValidos.some(d => dominio.includes(d))
    
    if (!dominioValido) {
      return {
        valido: false,
        erro: "URL deve ser do sistema Pipe.run ou 4.works"
      }
    }
    
    return {
      valido: true,
      url: url.trim()
    }
    
  } catch (error) {
    return {
      valido: false,
      erro: "URL inválida. Verifique o formato da URL"
    }
  }
}

// Função para validar e formatar data
function validarEFormatarData(dataInput) {
  try {
    // Remove espaços e caracteres inválidos
    const dataLimpa = dataInput.trim().replace(/[^\d\/]/g, '')
    
    // Regex para aceitar diferentes formatos de data
    const regexData = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/
    const match = dataLimpa.match(regexData)
    
    if (!match) {
      return { valido: false, erro: "Formato de data inválido. Use DD/MM/AAAA" }
    }
    
    let [, dia, mes, ano] = match
    
    // Converte para números
    dia = parseInt(dia, 10)
    mes = parseInt(mes, 10)
    ano = parseInt(ano, 10)
    
    // Ajusta ano com 2 dígitos para 4 dígitos
    if (ano < 100) {
      const anoAtual = new Date().getFullYear()
      const anoBase = Math.floor(anoAtual / 100) * 100
      ano = anoBase + ano
      
      // Se o ano resultante for muito no passado, assume próximo século
      if (ano < anoAtual - 50) {
        ano += 100
      }
    }
    
    // Validações básicas
    if (mes < 1 || mes > 12) {
      return { valido: false, erro: "Mês inválido (1-12)" }
    }
    
    if (dia < 1 || dia > 31) {
      return { valido: false, erro: "Dia inválido (1-31)" }
    }
    
    // Cria objeto Date para validação mais precisa
    const dataObj = new Date(ano, mes - 1, dia)
    
    if (dataObj.getFullYear() !== ano || dataObj.getMonth() !== mes - 1 || dataObj.getDate() !== dia) {
      return { valido: false, erro: "Data inválida" }
    }
    
    // Para parceria, não valida se a data é no passado (eventos podem ser passados)
    
    // Formata data para exibição
    const dataFormatada = `${dia.toString().padStart(2, '0')}/${mes.toString().padStart(2, '0')}/${ano}`
    
    return {
      valido: true,
      dataFormatada: dataFormatada,
      dataObj: dataObj,
      iso: dataObj.toISOString()
    }
    
  } catch (error) {
    return { valido: false, erro: "Erro ao processar data" }
  }
}

// Função para calcular diferença de dias entre duas datas
function calcularDiasEntreDatas(dataInicial, dataFinal) {
  const diffTime = Math.abs(dataFinal - dataInicial)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

// Função para construir URL completa a partir do final da URL
function construirURLCompleta(finalURL) {
  const baseURL = "https://4.events/pt-br"
  
  if (!finalURL || finalURL.trim() === "") {
    return baseURL + "/"
  }
  
  let finalLimpo = finalURL.trim()
  
  // Remove barra do início se existir para evitar duplicação
  if (finalLimpo.startsWith("/")) {
    finalLimpo = finalLimpo.substring(1)
  }
  
  // Se não há nada após remover a barra, retorna URL base
  if (finalLimpo === "") {
    return baseURL + "/"
  }
  
  return baseURL + "/" + finalLimpo
}

// Função para buscar dados do Microsoft Clarity
async function buscarDadosClarity(numDias, urlFiltro = null) {
  try {
    let params = {
      numOfDays: numDias.toString()
    }
    
    // Se não há filtro de URL, busca dados consolidados por OS
    // Se há filtro de URL, busca dados específicos por página
    if (urlFiltro) {
      params.dimension1 = "Page"
    } else {
      params.dimension1 = "OS" // Dados consolidados por sistema operacional
    }
    
    const queryString = new URLSearchParams(params).toString()
    const url = `${CLARITY_BASE_URL}/project-live-insights?${queryString}`
    
    const headers = {
      "Authorization": `Bearer ${CLARITY_API_TOKEN}`,
      "Content-Type": "application/json"
    }
    
    logger.info(`📤 Fazendo requisição para Clarity API: ${url}`, {
      numDias,
      urlFiltro,
      dimension: params.dimension1,
      endpoint: 'project-live-insights',
      method: 'GET',
      hasUrlFilter: !!urlFiltro,
      queryParams: params,
      categoria: 'clarity_api_request'
    })
    
    const response = await fetch(url, {
      method: "GET",
      headers: headers
    })
    
    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status} - ${response.statusText}`)
    }
    
    const result = await response.json()
    
    logger.info("✅ Resposta da Clarity API recebida", {
      numDias,
      urlFiltro,
      statusCode: response.status,
      statusText: response.statusText,
      responseSize: JSON.stringify(result).length,
      hasData: !!(result && Array.isArray(result) && result.length > 0),
      dataCount: Array.isArray(result) ? result.length : 0,
      endpoint: 'project-live-insights',
      categoria: 'clarity_api_success'
    })
    
    return { success: true, data: result }
    
  } catch (error) {
    logger.error("❌ Erro ao buscar dados do Clarity:", {
      erro: error.message,
      stack: error.stack,
      numDias,
      urlFiltro,
      endpoint: 'project-live-insights',
      clarityBaseUrl: CLARITY_BASE_URL,
      hasApiToken: !!CLARITY_API_TOKEN,
      categoria: 'clarity_api_error'
    })
    return { success: false, error: error.message }
  }
}

// Função para buscar dados de eventos inteligentes do Microsoft Clarity
async function buscarEventosInteligentesClarity(numDias, urlFiltro = null) {
  try {
    let params = {
      numOfDays: numDias.toString(),
      dimension1: "SmartEvent"
    }
    
    const queryString = new URLSearchParams(params).toString()
    const url = `${CLARITY_BASE_URL}/project-live-insights?${queryString}`
    
    const headers = {
      "Authorization": `Bearer ${CLARITY_API_TOKEN}`,
      "Content-Type": "application/json"
    }
    
    logger.info(`📤 Fazendo requisição para eventos inteligentes Clarity API: ${url}`, {
      numDias,
      urlFiltro,
      dimension: params.dimension1,
      endpoint: 'project-live-insights',
      method: 'GET',
      hasUrlFilter: !!urlFiltro,
      queryParams: params,
      tipoConsulta: 'eventos_inteligentes',
      categoria: 'clarity_smart_events_request'
    })
    
    const response = await fetch(url, {
      method: "GET",
      headers: headers
    })
    
    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status} - ${response.statusText}`)
    }
    
    const result = await response.json()
    
    logger.info("✅ Resposta de eventos inteligentes da Clarity API recebida", {
      numDias,
      urlFiltro,
      statusCode: response.status,
      statusText: response.statusText,
      responseSize: JSON.stringify(result).length,
      hasData: !!(result && Array.isArray(result) && result.length > 0),
      dataCount: Array.isArray(result) ? result.length : 0,
      endpoint: 'project-live-insights',
      tipoConsulta: 'eventos_inteligentes',
      categoria: 'clarity_smart_events_success'
    })
    
    return { success: true, data: result }
    
  } catch (error) {
    logger.error("❌ Erro ao buscar eventos inteligentes do Clarity:", {
      erro: error.message,
      stack: error.stack,
      numDias,
      urlFiltro,
      endpoint: 'project-live-insights',
      tipoConsulta: 'eventos_inteligentes',
      clarityBaseUrl: CLARITY_BASE_URL,
      hasApiToken: !!CLARITY_API_TOKEN,
      categoria: 'clarity_smart_events_error'
    })
    return { success: false, error: error.message }
  }
}

// Função para processar e formatar dados do Clarity
function processarDadosClarity(dadosClarity, urlAlvo = null) {
  try {
    if (!dadosClarity || !Array.isArray(dadosClarity) || dadosClarity.length === 0) {
      return {
        success: false,
        erro: "Nenhum dado encontrado na resposta da API"
      }
    }
    
    const trafficData = dadosClarity.find(item => item.metricName === "Traffic")
    
    if (!trafficData || !trafficData.information || !Array.isArray(trafficData.information)) {
      return {
        success: false,
        erro: "Dados de tráfego não encontrados"
      }
    }
    
    let dados = trafficData.information
    
    // Se temos URL alvo, filtra pelos dados dessa URL
    if (urlAlvo) {
      dados = dados.filter(item => {
        return item.Page && item.Page.toLowerCase().includes(urlAlvo.toLowerCase())
      })
      
      if (dados.length === 0) {
        return {
          success: false,
          erro: `Nenhum dado encontrado para a URL: ${urlAlvo}`
        }
      }
    }
    
    // Calcula totais
    let totalSessoes = 0
    let totalBots = 0
    let totalUsuarios = 0
    let totalPaginasPorSessao = 0
    let totalPaginas = 0
    
    dados.forEach(item => {
      const sessoes = parseInt(item.totalSessionCount || 0)
      const bots = parseInt(item.totalBotSessionCount || 0)
      const usuarios = parseInt(item.distantUserCount || 0)
      const paginasPorSessao = parseFloat(item.PagesPerSessionPercentage || 0)
      
      totalSessoes += sessoes
      totalBots += bots
      totalUsuarios += usuarios
      
      // Calcula total de páginas vistas (sessões * páginas por sessão)
      totalPaginas += Math.round(sessoes * paginasPorSessao)
    })
    
    const sessaosSemBots = totalSessoes - totalBots
    
    // Calcula média real de páginas por sessão
    const mediaPaginasPorSessao = totalSessoes > 0 ? (totalPaginas / totalSessoes).toFixed(2) : "0.00"
    
    // NOVA IMPLEMENTAÇÃO: Ordena os dados por sessões (do maior para o menor) e limita a 5
    const dadosOrdenados = dados
      .sort((a, b) => {
        const sessoesA = parseInt(a.totalSessionCount || 0)
        const sessoesB = parseInt(b.totalSessionCount || 0)
        return sessoesB - sessoesA // Ordem decrescente
      })
      .slice(0, 5) // Limita aos top 5
    
    return {
      success: true,
      resumo: {
        totalSessoes,
        totalBots,
        sessaosSemBots,
        totalUsuarios,
        mediaPaginasPorSessao,
        percentualBots: totalSessoes > 0 ? ((totalBots / totalSessoes) * 100).toFixed(1) : 0
      },
      detalhes: dadosOrdenados, // Agora são os dados ordenados e limitados
      totalItens: dados.length
    }
    
  } catch (error) {
    return {
      success: false,
      erro: `Erro ao processar dados: ${error.message}`
    }
  }
}

// Função para processar dados de eventos inteligentes
function processarEventosInteligentes(dadosEventos) {
  try {
    if (!dadosEventos || !Array.isArray(dadosEventos) || dadosEventos.length === 0) {
      logger.info("Nenhum dado de eventos inteligentes fornecido", {
        dadosEventosExiste: !!dadosEventos,
        isArray: Array.isArray(dadosEventos),
        length: dadosEventos?.length || 0,
        categoria: 'clarity_smart_events_processing',
        resultado: 'dados_vazios'
      })
      
      return {
        success: true,
        totalEventos: 0,
        eventosFormulario: 0
      }
    }
    
    const eventosData = dadosEventos.find(item => item.metricName === "Traffic")
    
    if (!eventosData || !eventosData.information || !Array.isArray(eventosData.information)) {
      logger.warn("Dados de eventos inteligentes sem informações de tráfego válidas", {
        hasEventosData: !!eventosData,
        hasInformation: !!(eventosData?.information),
        isInformationArray: Array.isArray(eventosData?.information),
        informationLength: eventosData?.information?.length || 0,
        categoria: 'clarity_smart_events_processing',
        resultado: 'estrutura_invalida'
      })
      
      return {
        success: true,
        totalEventos: 0,
        eventosFormulario: 0
      }
    }
    
    let totalEventos = 0
    let eventosFormulario = 0
    
    eventosData.information.forEach(item => {
      const count = parseInt(item.totalSessionCount || 0)
      totalEventos += count
      
      // Verifica se é evento de "Enviar formulário"
      const eventName = item.SmartEvent || ""
      if (eventName.toLowerCase().includes("enviar formulário") || 
          eventName.toLowerCase().includes("enviar formulario") ||
          eventName.toLowerCase().includes("submit form") ||
          eventName.toLowerCase().includes("form submit")) {
        eventosFormulario += count
      }
    })
    
    logger.info("Eventos inteligentes processados com sucesso", {
      totalEventos,
      eventosFormulario,
      eventosProcessados: eventosData.information.length,
      percentualFormulario: totalEventos > 0 ? ((eventosFormulario / totalEventos) * 100).toFixed(1) : 0,
      categoria: 'clarity_smart_events_processing',
      resultado: 'sucesso'
    })
    
    return {
      success: true,
      totalEventos,
      eventosFormulario
    }
    
  } catch (error) {
    logger.error("❌ Erro ao processar eventos inteligentes:", {
      erro: error.message,
      stack: error.stack,
      dadosEventosType: typeof dadosEventos,
      dadosEventosLength: dadosEventos?.length || 0,
      hasTrafficData: !!(dadosEventos?.find?.(item => item.metricName === "Traffic")),
      categoria: 'clarity_smart_events_processing',
      resultado: 'erro'
    })
    
    return {
      success: true,
      totalEventos: 0,
      eventosFormulario: 0
    }
  }
}

// Função para enviar dados para a webhook do N8N (Marketing)
async function enviarParaN8N(cardTitle, detalhes, prazo, usuario) {
  try {
    const body = {
      cardTitle: cardTitle,
      detalhes: detalhes,
      prazo: prazo,
      solicitadoPor: {
        username: usuario.username,
        displayName: usuario.displayName || usuario.username,
        id: usuario.id,
        tag: usuario.tag || `${usuario.username}#${usuario.discriminator}`
      },
      timestamp: new Date().toISOString(),
      plataforma: "Discord"
    }

    logger.info("📤 Enviando dados para N8N (Marketing):", {
      cardTitle: cardTitle,
      detalhes: detalhes.substring(0, 100) + (detalhes.length > 100 ? '...' : ''),
      prazoFormatado: prazo.dataFormatada,
      prazoISO: prazo.dataISO,
      usuario: {
        username: usuario.username,
        displayName: usuario.displayName,
        id: usuario.id
      },
      bodySize: JSON.stringify(body).length,
      webhookUrl: WEBHOOK_URL ? 'configurada' : 'não configurada',
      timestamp: body.timestamp,
      plataforma: body.plataforma,
      categoria: 'n8n_webhook_marketing',
      operacao: 'envio'
    })

    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status} - ${response.statusText}`)
    }

    const result = await response.json().catch(() => ({ success: true }))
    
    logger.info("✅ Resposta do N8N (Marketing):", {
      statusCode: response.status,
      statusText: response.statusText,
      success: true,
      responseData: result,
      hasTaskUrl: !!(result?.url || result?.taskUrl || result?.cardUrl),
      taskUrl: result?.url || result?.taskUrl || result?.cardUrl || null,
      responseSize: JSON.stringify(result).length,
      cardTitle: cardTitle,
      usuario: usuario.username,
      categoria: 'n8n_webhook_marketing',
      operacao: 'resposta_sucesso'
    })
    
    return { success: true, data: result }

  } catch (error) {
    logger.error("❌ Erro ao enviar para N8N (Marketing):", {
      erro: error.message,
      stack: error.stack,
      cardTitle: cardTitle,
      detalhes: detalhes.substring(0, 100) + (detalhes.length > 100 ? '...' : ''),
      usuario: {
        username: usuario.username,
        displayName: usuario.displayName,
        id: usuario.id
      },
      webhookUrl: WEBHOOK_URL ? 'configurada' : 'não configurada',
      errorType: error.name,
      categoria: 'n8n_webhook_marketing',
      operacao: 'erro'
    })
    
    return { success: false, error: error.message }
  }
}

// Função para enviar dados de parceria para a webhook do N8N (Parceria)
async function enviarParceriaParaN8N(cardURL, dataEvento, usuario) {
  try {
    const body = {
      cardURL: cardURL,
      dataEvento: {
        dataFormatada: dataEvento.dataFormatada,
        dataISO: dataEvento.dataISO
      },
      solicitadoPor: {
        username: usuario.username,
        displayName: usuario.displayName || usuario.username,
        id: usuario.id,
        tag: usuario.tag || `${usuario.username}#${usuario.discriminator}`
      },
      timestamp: new Date().toISOString(),
      plataforma: "Discord"
    }

    logger.info("📤 Enviando dados de parceria para N8N:", {
      cardURL: cardURL,
      dataEventoFormatada: dataEvento.dataFormatada,
      dataEventoISO: dataEvento.dataISO,
      usuario: {
        username: usuario.username,
        displayName: usuario.displayName,
        id: usuario.id
      },
      bodySize: JSON.stringify(body).length,
      webhookUrl: WEBHOOK_URL_PARCERIA ? 'configurada' : 'não configurada',
      timestamp: body.timestamp,
      plataforma: body.plataforma,
      categoria: 'n8n_webhook_parceria',
      operacao: 'envio'
    })

    const response = await fetch(WEBHOOK_URL_PARCERIA, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status} - ${response.statusText}`)
    }

    const result = await response.json().catch(() => ({ success: true }))
    
    logger.info("✅ Resposta do N8N (Parceria):", {
      statusCode: response.status,
      statusText: response.statusText,
      success: true,
      responseData: result,
      hasCardName: !!(result?.name),
      cardName: result?.name || null,
      responseSize: JSON.stringify(result).length,
      cardURL: cardURL,
      dataEvento: dataEvento.dataFormatada,
      usuario: usuario.username,
      categoria: 'n8n_webhook_parceria',
      operacao: 'resposta_sucesso'
    })
    
    return { success: true, data: result }

  } catch (error) {
    logger.error("❌ Erro ao enviar parceria para N8N:", {
      erro: error.message,
      stack: error.stack,
      cardURL: cardURL,
      dataEventoFormatada: dataEvento.dataFormatada,
      dataEventoISO: dataEvento.dataISO,
      usuario: {
        username: usuario.username,
        displayName: usuario.displayName,
        id: usuario.id
      },
      webhookUrl: WEBHOOK_URL_PARCERIA ? 'configurada' : 'não configurada',
      errorType: error.name,
      categoria: 'n8n_webhook_parceria',
      operacao: 'erro'
    })
    
    return { success: false, error: error.message }
  }
}

// Função para enviar alerta no canal de marketing
async function enviarAlertaCanal(nomeDemanda, detalhesDemanda, validacaoData, usuario, taskUrl = null) {
  try {
    const canalMarketing = client.channels.cache.get(process.env.CANAL_MARKETING)
    
    if (!canalMarketing) {
      logger.error("❌ Canal de marketing não encontrado!", {
        canalId: process.env.CANAL_MARKETING,
        nomeDemanda: nomeDemanda,
        usuario: {
          username: usuario.username,
          displayName: usuario.displayName,
          id: usuario.id
        },
        taskUrl: taskUrl,
        categoria: 'discord_canal_marketing',
        operacao: 'canal_nao_encontrado'
      })
      return
    }

    // Prepara os campos do embed para o canal
    const embedFields = [
      {
        name: `${obterEmoji("info")} Nome da tarefa`,
        value: `\`\`\`${truncarTexto(nomeDemanda, 500)}\`\`\``,
        inline: false,
      },
      {
        name: `${obterEmoji("pasta")} Detalhes`,
        value: `\`${truncarTexto(detalhesDemanda, 800)}\``,
        inline: false,
      },
      {
        name: `${obterEmoji("relogio")} Prazo`,
        value: `\`${validacaoData.dataFormatada}\``,
        inline: true,
      },
      {
        name: `${obterEmoji("equipe")} Solicitado por`,
        value: `<@${usuario.id}> (${usuario.tag})`,
        inline: true,
      },
      {
        name: `${obterEmoji("relogio2")} Criado em`,
        value: formatarDataHora(),
        inline: true,
      }
    ]

    // Adiciona URL da tarefa se disponível
    if (taskUrl) {
      embedFields.push({
        name: `${obterEmoji("planeta")} Link da tarefa`,
        value: `[Clique aqui para acessar a tarefa](${taskUrl})`,
        inline: false,
      })
    }

    // Cria o embed de alerta para o canal
    const embedAlerta = {
      color: 0xff4f00, // Cor laranja para destacar como alerta
      description: "**Uma nova solicitação de tarefa foi criada:**",
      fields: embedFields,
      footer: {
        text: "4.events Marketing Bot • Alerta automático",
      },
      timestamp: new Date().toISOString(),
    }

    // Envia a mensagem no canal de marketing com menção da role específica
    await canalMarketing.send({
      content: `${obterEmoji("notify")} Nova demanda registrada! <@&422833735780794379>`,
      embeds: [embedAlerta],
    })

    logger.info("📢 Alerta enviado no canal de marketing para a tarefa:", {
      nomeDemanda: nomeDemanda,
      detalhesDemanda: detalhesDemanda.substring(0, 100) + (detalhesDemanda.length > 100 ? '...' : ''),
      prazo: validacaoData.dataFormatada,
      prazoISO: validacaoData.iso,
      usuario: {
        username: usuario.username,
        displayName: usuario.displayName,
        id: usuario.id,
        tag: usuario.tag
      },
      taskUrl: taskUrl,
      hasTaskUrl: !!taskUrl,
      canalId: process.env.CANAL_MARKETING,
      canalNome: canalMarketing.name,
      embedFieldsCount: embedFields.length,
      embedColor: embedAlerta.color,
      mentionRole: "422833735780794379",
      categoria: 'discord_canal_marketing',
      operacao: 'alerta_enviado_sucesso'
    })

  } catch (error) {
    logger.error("❌ Erro ao enviar alerta no canal de marketing:", {
      erro: error.message,
      stack: error.stack,
      nomeDemanda: nomeDemanda,
      detalhesDemanda: detalhesDemanda.substring(0, 100) + (detalhesDemanda.length > 100 ? '...' : ''),
      prazo: validacaoData?.dataFormatada,
      prazoISO: validacaoData?.iso,
      usuario: {
        username: usuario.username,
        displayName: usuario.displayName,
        id: usuario.id,
        tag: usuario.tag
      },
      taskUrl: taskUrl,
      canalId: process.env.CANAL_MARKETING,
      errorType: error.name,
      categoria: 'discord_canal_marketing',
      operacao: 'erro_envio_alerta'
    })
  }
}

// Função para enviar notificação de parceria no canal específico
async function enviarNotificacaParceria(cardURL, dataEvento, usuario, nomeCard = null) {
  try {
    const canalParceria = client.channels.cache.get("1397497396606537738")
    
    if (!canalParceria) {
      logger.error("❌ Canal de parceria não encontrado!", {
        canalId: "1397497396606537738",
        cardURL: cardURL,
        dataEvento: dataEvento.dataFormatada,
        dataEventoISO: dataEvento.dataISO,
        usuario: {
          username: usuario.username,
          displayName: usuario.displayName,
          id: usuario.id
        },
        nomeCard: nomeCard,
        categoria: 'discord_canal_parceria',
        operacao: 'canal_nao_encontrado'
      })
      return
    }

    // Prepara os campos do embed para o canal
    const embedFields = [
      {
        name: `${obterEmoji("planeta")} URL do Card`,
        value: `[Clique aqui para acessar o card](${cardURL})`,
        inline: false,
      },
      {
        name: `${obterEmoji("relogio")} Data do Evento`,
        value: `\`${dataEvento.dataFormatada}\``,
        inline: true,
      },
      {
        name: `${obterEmoji("equipe")} Registrado por`,
        value: `<@${usuario.id}> (${usuario.tag})`,
        inline: true,
      },
      {
        name: `${obterEmoji("relogio2")} Registrado em`,
        value: formatarDataHora(),
        inline: true,
      }
    ]

    // Adiciona nome do card se disponível
    if (nomeCard) {
      embedFields.unshift({
        name: `${obterEmoji("info")} Nome do Card`,
        value: `\`\`\`${nomeCard}\`\`\``,
        inline: false,
      })
    }

    // Cria o embed de notificação para o canal
    const embedParceria = {
      color: 0x00ff00, // Cor verde para parceria
      title: "🤝 Nova Parceria Registrada!",
      description: "**Uma nova parceria comercial foi registrada no sistema:**",
      fields: embedFields,
      footer: {
        text: "4.events Marketing Bot • Notificação de Parceria",
      },
      timestamp: new Date().toISOString(),
    }

    // Envia a mensagem no canal de parceria
    await canalParceria.send({
      content: `${obterEmoji("notify")} Nova parceria registrada!`,
      embeds: [embedParceria],
    })

    logger.info("📢 Notificação de parceria enviada:", {
      cardURL: cardURL,
      nomeCard: nomeCard || 'Card não identificado',
      hasNomeCard: !!nomeCard,
      dataEvento: dataEvento.dataFormatada,
      dataEventoISO: dataEvento.dataISO,
      usuario: {
        username: usuario.username,
        displayName: usuario.displayName,
        id: usuario.id,
        tag: usuario.tag
      },
      canalId: "1397497396606537738",
      canalNome: canalParceria.name,
      embedFieldsCount: embedFields.length,
      embedColor: embedParceria.color,
      embedTitle: embedParceria.title,
      timestamp: new Date().toISOString(),
      categoria: 'discord_canal_parceria',
      operacao: 'notificacao_enviada_sucesso'
    })

  } catch (error) {
    logger.error("❌ Erro ao enviar notificação de parceria:", {
      erro: error.message,
      stack: error.stack,
      cardURL: cardURL,
      nomeCard: nomeCard,
      dataEvento: dataEvento?.dataFormatada,
      dataEventoISO: dataEvento?.dataISO,
      usuario: {
        username: usuario.username,
        displayName: usuario.displayName,
        id: usuario.id,
        tag: usuario.tag
      },
      canalId: "1397497396606537738",
      errorType: error.name,
      categoria: 'discord_canal_parceria',
      operacao: 'erro_envio_notificacao'
    })
  }
}

// Função para formatar a data/hora em português
function formatarDataHora() {
  const agora = new Date()
  return agora.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// Função para truncar texto se muito longo
function truncarTexto(texto, maxLength = 1000) {
  if (texto.length <= maxLength) return texto
  return texto.substring(0, maxLength - 3) + "..."
}

// Função para formatar números grandes
function formatarNumero(numero) {
  return new Intl.NumberFormat('pt-BR').format(numero)
}

// Evento: Bot está pronto
client.once("ready", async () => {
  try {
    logger.info("✅ Bot 4.events Marketing online", {
      botTag: client.user.tag,
      botId: client.user.id,
      botUsername: client.user.username,
      discriminator: client.user.discriminator,
      verified: client.user.verified,
      timestamp: new Date().toISOString(),
      categoria: 'discord_bot_startup',
      operacao: 'bot_ready_sucesso'
    })

    // Conecta ao banco de dados
    await database.connect()
    
    // Inicializa e starta a API
    await apiServer.initialize()
    await apiServer.start()

    // Inicia o Cloudflare Tunnel
    if (process.env.NODE_ENV === 'production' && process.env.TUNNEL_ENABLED === 'true') {
      try {
        const publicUrl = await tunnel.start(parseInt(process.env.API_PORT) || 3000)
        
        logger.info('🌐 API disponível publicamente via Cloudflare Tunnel', {
          urlPublica: publicUrl,
          urlLocal: `http://localhost:${process.env.API_PORT || 3000}`,
          categoria: 'api_publicacao',
          operacao: 'tunnel_configurado'
        })

      } catch (error) {
        logger.error('❌ Erro ao configurar Cloudflare Tunnel:', {
          erro: error.message,
          categoria: 'api_publicacao',
          operacao: 'erro_tunnel'
        })
      }
    } else {
      const motivo = process.env.NODE_ENV !== 'production' 
        ? `NODE_ENV=${process.env.NODE_ENV || 'undefined'}` 
        : `TUNNEL_ENABLED=${process.env.TUNNEL_ENABLED || 'undefined'}`
        
      logger.info('📴 Criação do Cloudflare Tunnel ignorada (configuração .env)', {
        motivo: motivo,
        nodeEnv: process.env.NODE_ENV || 'undefined',
        tunnelEnabled: process.env.TUNNEL_ENABLED || 'undefined',
        categoria: 'api_publicacao',
        operacao: 'tunnel_ignorado'
      })
    }
    
    // Registra comandos do bot (global)
    await client.application.commands.set([
      cmdMarketing,
      cmdParceria,
      cmdCro,
      cmdMidiaKit,
      cmdApresentacoes,
      cmdModelos,
      cmdCapaLinkedin,
      cmdFundoEscritorio,
      cmdPing,
      cmdLeads,
      cmdHelp,
    ])
    
    logger.info("✅ Comandos slash atualizados globalmente", {
      comandosRegistrados: [
        'marketing',
        'parceria', 
        'cro',
        'midiakit',
        'apresentações',
        'modelos',
        'capa-linkedin',
        'fundo-escritorio',
        'ping',
        'leads',
        'help'
      ],
      totalComandos: 10,
      botTag: client.user.tag,
      botId: client.user.id,
      timestamp: new Date().toISOString(),
      categoria: 'discord_comandos',
      operacao: 'comandos_registrados_sucesso'
    })
    
    client.user.setActivity("solicitações de marketing e parcerias", { type: "WATCHING" })
    
  } catch (error) {
    logger.error("❌ Erro na inicialização do bot:", {
      erro: error.message,
      stack: error.stack,
      errorType: error.name,
      botTag: client.user?.tag,
      botId: client.user?.id,
      botUsername: client.user?.username,
      timestamp: new Date().toISOString(),
      categoria: 'discord_bot_startup',
      operacao: 'erro_inicializacao_bot'
    })
  }
})

// Evento: Processar interações (comandos slash)
client.on("interactionCreate", async (interaction) => {
  try {
    // Handler de Modals - Processar submissão de modals (comandos /marketing e /parceria)
    if (interaction.isModalSubmit()) {
      
      // Modal de Marketing (criado pelo comando /marketing)
      if (interaction.customId === 'marketing_modal') {
        // Obter dados do modal
        const nomeDemanda = interaction.fields.getTextInputValue('nome_demanda')
        const detalhesDemanda = interaction.fields.getTextInputValue('detalhes_demanda')
        const prazoInput = interaction.fields.getTextInputValue('prazo')
        
        // Usar a mesma lógica de validação que já existe
        // Valida os dados de entrada
        if (!nomeDemanda || nomeDemanda.trim().length === 0) {
          await interaction.reply({
            content: `${obterEmoji("errado")} O nome da tarefa não pode estar vazio!`,
            flags: MessageFlags.Ephemeral,
          })
          return
        }

        if (!detalhesDemanda || detalhesDemanda.trim().length === 0) {
          await interaction.reply({
            content: `${obterEmoji("errado")} Os detalhes da tarefa não podem estar vazios!`,
            flags: MessageFlags.Ephemeral,
          })
          return
        }

        // Valida a data do prazo
        const validacaoData = validarEFormatarData(prazoInput)
        if (!validacaoData.valido) {
          await interaction.reply({
            content: `${obterEmoji("errado")} **Erro na data:** ${validacaoData.erro}`,
            flags: MessageFlags.Ephemeral,
          })
          return
        }

        // Verifica se a data não é no passado para marketing
        const hoje = new Date()
        hoje.setHours(0, 0, 0, 0)
        
        if (validacaoData.dataObj < hoje) {
          await interaction.reply({
            content: `${obterEmoji("errado")} **Erro na data:** A data não pode ser no passado`,
            flags: MessageFlags.Ephemeral,
          })
          return
        }

        // Resposta inicial (primeira tentativa - mensagem normal)
        const loadingEmoji = obterEmoji("loading")
        await interaction.reply(`${loadingEmoji} Criando solicitação de tarefa para o marketing...`)

        // Prepara dados do usuário
        const usuario = {
          username: interaction.user.username,
          displayName: interaction.member?.displayName || interaction.user.username,
          id: interaction.user.id,
          tag: interaction.user.tag,
        }

        // Prepara dados do prazo
        const dadosPrazo = {
          dataFormatada: validacaoData.dataFormatada,
          dataISO: validacaoData.iso
        }

        // Envia para o N8N com retry e feedback visual
        const resultado = await executarComRetryComFeedback(
          interaction,
          enviarParaN8N,
          [nomeDemanda.trim(), detalhesDemanda.trim(), dadosPrazo, usuario],
          "solicitação de marketing"
        )

        if (resultado.success) {
          // Captura a URL da tarefa se disponível
          let taskUrl = null
          if (resultado.data) {
            // Se for um array, pega o primeiro elemento
            if (Array.isArray(resultado.data) && resultado.data.length > 0) {
              taskUrl = resultado.data[0].url || 
                        resultado.data.taskUrl || 
                        resultado.data.cardUrl
            } else if (typeof resultado.data === 'object') {
              // Se for um objeto simples
              taskUrl = resultado.data.url || 
                        resultado.data.taskUrl || 
                        resultado.data.cardUrl
            }
          }

          // Prepara os campos do embed de resposta ao usuário
          const embedFields = [
            {
              name: `${obterEmoji("info")} Nome da tarefa`,
              value: `\`\`\`${truncarTexto(nomeDemanda, 500)}\`\`\``,
              inline: false,
            },
            {
              name: `${obterEmoji("pasta")} Detalhes`,
              value: `\`${truncarTexto(detalhesDemanda, 800)}\``,
              inline: false,
            },
            {
              name: `${obterEmoji("relogio")} Prazo`,
              value: `\`${validacaoData.dataFormatada}\``,
              inline: true,
            },
            {
              name: `${obterEmoji("equipe")} Solicitado por`,
              value: `${usuario.displayName} (${usuario.tag})`,
              inline: true,
            },
            {
              name: `${obterEmoji("relogio2")} Criado em`,
              value: formatarDataHora(),
              inline: true,
            }
          ]

          // Adiciona URL da tarefa no embed de resposta se disponível
          if (taskUrl) {
            embedFields.push({
              name: `${obterEmoji("planeta")} Link da Tarefa`,
              value: `[Clique aqui para acessar a tarefa](${taskUrl})`,
              inline: false,
            })
          }

          // Sucesso - edita a resposta para o usuário
          const embed = {
            color: 0x00ff00,
            title: `${obterEmoji("certo")} Solicitação criada com sucesso!`,
            fields: embedFields,
            footer: {
              text: "4.events Marketing Bot",
            },
            timestamp: new Date().toISOString(),
          }

          await interaction.editReply({
            content: "",
            embeds: [embed],
          })

          // Envia alerta no canal de marketing
          await enviarAlertaCanal(nomeDemanda, detalhesDemanda, validacaoData, usuario, taskUrl)
          logger.info("✅ Solicitação criada:", {
            nomeCard: nomeDemanda,
            prazo: validacaoData.dataFormatada,
            prazoISO: validacaoData.iso,
            hasTaskUrl: !!taskUrl,
            taskUrl: taskUrl,
            usuario: {
              username: usuario.username,
              displayName: usuario.displayName,
              id: usuario.id,
              tag: usuario.tag
            },
            detalhesLength: detalhesDemanda?.length || 0,
            timestamp: new Date().toISOString(),
            categoria: 'discord_marketing_solicitacao',
            operacao: 'solicitacao_criada_sucesso'
          })

        } else {
          // Mensagem de erro detalhada
          const isServerError = resultado.error?.includes('500') || 
                              resultado.error?.includes('Internal Server Error')
          
          let errorMessage = `${obterEmoji("errado")} **Erro ao criar solicitação**\n\`\`\`${resultado.error}\`\`\``
          
          if (isServerError) {
            errorMessage += `\n\n${obterEmoji("ideiadev")} **Este parece ser um erro temporário do servidor.**\n` +
                          `O bot tentou ${RETRY_CONFIG.maxTentativas} vezes antes de desistir.\n` +
                          `**Sugestão:** Tente novamente em alguns minutos ou entre em contato com o suporte.`
          } else {
            errorMessage += `\n\n**Tente novamente ou entre em contato com o suporte.**`
          }

          await interaction.editReply({ content: errorMessage })
          logger.error("❌ Falha ao criar solicitação:", {
            erro: resultado.error,
            isServerError: isServerError,
            maxTentativas: RETRY_CONFIG.maxTentativas,
            nomeCard: nomeDemanda,
            prazo: validacaoData?.dataFormatada,
            prazoISO: validacaoData?.iso,
            usuario: {
              username: usuario.username,
              displayName: usuario.displayName,
              id: usuario.id,
              tag: usuario.tag
            },
            detalhesLength: detalhesDemanda?.length || 0,
            errorMessage: errorMessage,
            timestamp: new Date().toISOString(),
            categoria: 'discord_marketing_solicitacao',
            operacao: 'erro_criar_solicitacao'
          })
        }
      }
      
      // Modal de Parceria (criado pelo comando /parceria)
      else if (interaction.customId === 'parceria_modal') {
        // Obter dados do modal
        const urlDoCard = interaction.fields.getTextInputValue('url_do_card')
        const dataDoEvento = interaction.fields.getTextInputValue('data_do_evento')
        
        // Valida a URL
        const validacaoURL = validarURL(urlDoCard)
        if (!validacaoURL.valido) {
          await interaction.reply({
            content: `${obterEmoji("errado")} **Erro na URL:** ${validacaoURL.erro}`,
            flags: MessageFlags.Ephemeral,
          })
          return
        }

        // Valida a data do evento
        const validacaoData = validarEFormatarData(dataDoEvento)
        if (!validacaoData.valido) {
          await interaction.reply({
            content: `${obterEmoji("errado")} **Erro na data:** ${validacaoData.erro}`,
            flags: MessageFlags.Ephemeral,
          })
          return
        }

        // Resposta inicial (primeira tentativa - mensagem normal)
        const loadingEmoji = obterEmoji("loading")
        await interaction.reply(`${loadingEmoji} Registrando parceria comercial...`)

        // Prepara dados do usuário
        const usuario = {
          username: interaction.user.username,
          displayName: interaction.member?.displayName || interaction.user.username,
          id: interaction.user.id,
          tag: interaction.user.tag,
        }

        // Prepara dados do evento
        const dadosEvento = {
          dataFormatada: validacaoData.dataFormatada,
          dataISO: validacaoData.iso
        }

        // Envia para o N8N com retry e feedback visual
        const resultado = await executarComRetryComFeedback(
          interaction,
          enviarParceriaParaN8N,
          [validacaoURL.url, dadosEvento, usuario],
          "registro de parceria"
        )

        if (resultado.success) {
          // Captura o nome do card se disponível
          let nomeCard = null
          if (resultado.data && Array.isArray(resultado.data) && resultado.data.length > 0) {
            nomeCard = resultado.data.name
          }

          // Prepara os campos do embed de resposta ao usuário
          const embedFields = [
            {
              name: `${obterEmoji("planeta")} URL do Card`,
              value: `[Clique aqui para acessar](${validacaoURL.url})`,
              inline: false,
            },
            {
              name: `${obterEmoji("relogio")} Data do Evento`,
              value: `\`${validacaoData.dataFormatada}\``,
              inline: true,
            },
            {
              name: `${obterEmoji("equipe")} Registrado por`,
              value: `${usuario.displayName} (${usuario.tag})`,
              inline: true,
            },
            {
              name: `${obterEmoji("relogio2")} Registrado em`,
              value: formatarDataHora(),
              inline: true,
            }
          ]

          // Adiciona nome do card se disponível
          if (nomeCard) {
            embedFields.unshift({
              name: `${obterEmoji("info")} Nome do Card`,
              value: `\`\`\`${nomeCard}\`\`\``,
              inline: false,
            })
          }

          // Sucesso - edita a resposta para o usuário
          const embed = {
            color: 0x00ff00,
            title: `${obterEmoji("certo")} Parceria registrada com sucesso!`,
            fields: embedFields,
            footer: {
              text: "4.events Marketing Bot",
            },
            timestamp: new Date().toISOString(),
          }

          await interaction.editReply({
            content: "",
            embeds: [embed],
          })

          // Envia notificação no canal de parceria
          await enviarNotificacaParceria(validacaoURL.url, dadosEvento, usuario, nomeCard)
          logger.info("✅ Parceria registrada:", {
            nomeCard: nomeCard || 'Card não identificado',
            dataEvento: validacaoData.dataFormatada,
            dataEventoISO: validacaoData.iso,
            cardURL: validacaoURL.url,
            usuario: {
              username: usuario.username,
              displayName: usuario.displayName,
              id: usuario.id,
              tag: usuario.tag
            },
            timestamp: new Date().toISOString(),
            categoria: 'discord_parceria_registro',
            operacao: 'parceria_registrada_sucesso'
          })

        } else {
          // Mensagem de erro detalhada
          const isServerError = resultado.error?.includes('500') || 
                              resultado.error?.includes('Internal Server Error')
          
          let errorMessage = `${obterEmoji("errado")} **Erro ao registrar parceria**\n\`\`\`${resultado.error}\`\`\``
          
          if (isServerError) {
            errorMessage += `\n\n${obterEmoji("ideiadev")} **Este parece ser um erro temporário do servidor.**\n` +
                          `O bot tentou ${RETRY_CONFIG.maxTentativas} vezes antes de desistir.\n` +
                          `**Sugestão:** Tente novamente em alguns minutos ou entre em contato com o suporte.`
          } else {
            errorMessage += `\n\n**Tente novamente ou entre em contato com o suporte.**`
          }

          await interaction.editReply({ content: errorMessage })
          logger.error("❌ Falha ao registrar parceria:", {
            erro: resultado.error,
            isServerError: isServerError,
            maxTentativas: RETRY_CONFIG.maxTentativas,
            cardURL: validacaoURL?.url,
            dataEvento: validacaoData?.dataFormatada,
            dataEventoISO: validacaoData?.iso,
            usuario: {
              username: usuario.username,
              displayName: usuario.displayName,
              id: usuario.id,
              tag: usuario.tag
            },
            errorMessage: errorMessage,
            timestamp: new Date().toISOString(),
            categoria: 'discord_parceria_registro',
            operacao: 'erro_registrar_parceria'
          })
        }
      }
    }

    // Handler de botões
    if (interaction.isButton()) {
          // Handler do botão "Voltar ao menu principal" do comando /help
          if (interaction.customId === 'help_voltar') {
            const components = criarContainerInicialHelp();

            await interaction.update({
              components: components,
              flags: MessageFlags.IsComponentsV2
            })

            // Log da ação
            logger.info("✅ Usuário voltou ao menu principal do help:", {
              usuario: {
                username: interaction.user.username,
                displayName: interaction.member?.displayName || interaction.user.username,
                id: interaction.user.id,
                tag: interaction.user.tag
              },
              botao: 'help_voltar',
              timestamp: new Date().toISOString(),
              categoria: 'discord_help_navegacao',
              operacao: 'voltar_menu_principal'
            })
            
            return
          }

          // Handler do botão "Baixar Logs (ZIP)"
          if (interaction.customId === 'download_logs_zip') {
            const startTime = Date.now()
            
            // Verifica se o usuário está autorizado (administrador do bot)
            const usuarioAutorizado = BOT_ADMIN_DISCORD_USERS_ID.includes(interaction.user.id)
            
            logger.info("🎯 Solicitação de download de logs recebida", {
              usuario: {
                id: interaction.user.id,
                username: interaction.user.username,
                displayName: interaction.member?.displayName || interaction.user.username,
                tag: interaction.user.tag
              },
              autorizado: usuarioAutorizado,
              botaoClicado: 'download_logs_zip',
              servidor: {
                id: interaction.guildId,
                nome: interaction.guild?.name
              },
              canal: {
                id: interaction.channelId,
                tipo: interaction.channel?.type
              },
              timestamp: new Date().toISOString(),
              categoria: 'discord_comando_logs',
              operacao: 'solicitacao_download_logs'
            })
            
            if (!usuarioAutorizado) {
              await interaction.reply({
                content: `${obterEmoji("errado")} Apenas administradores autorizados podem baixar os logs.`,
                flags: MessageFlags.Ephemeral
              })
              
              logger.warn("🚫 Tentativa não autorizada de download de logs via botão", {
                usuario: {
                  id: interaction.user.id,
                  username: interaction.user.username,
                  tag: interaction.user.tag
                },
                servidor: {
                  id: interaction.guildId,
                  nome: interaction.guild?.name
                },
                canal: {
                  id: interaction.channelId
                },
                motivoNegacao: 'usuario_nao_autorizado',
                usuariosAutorizados: BOT_ADMIN_DISCORD_USERS_ID.length,
                timestamp: new Date().toISOString(),
                categoria: 'discord_comando_logs',
                operacao: 'download_acesso_negado'
              })
              
              return
            }

            // Resposta inicial de processamento
            const loadingEmoji = obterEmoji("loading")
            await interaction.reply({
              content: `${loadingEmoji} Gerando arquivo compactado com todos os logs... Por favor, aguarde.`,
              flags: MessageFlags.Ephemeral
            })

            logger.info("📤 Iniciando processo de geração de ZIP para usuário autorizado", {
              usuario: {
                id: interaction.user.id,
                username: interaction.user.username,
                displayName: interaction.member?.displayName || interaction.user.username,
                tag: interaction.user.tag
              },
              mensagemInicialEnviada: true,
              categoria: 'discord_comando_logs',
              operacao: 'inicio_processo_zip'
            })

            try {
              // Gera o arquivo ZIP
              const resultadoZip = await gerarZipLogs()
              
              logger.info("🔄 Resultado da geração ZIP recebido", {
                sucesso: resultadoZip.success,
                nomeArquivo: resultadoZip.success ? resultadoZip.nomeArquivo : null,
                tamanhoBytes: resultadoZip.success ? resultadoZip.tamanho : null,
                erro: resultadoZip.success ? null : resultadoZip.error,
                duracaoGeracaoMs: resultadoZip.success ? resultadoZip.duracaoMs : null,
                usuario: {
                  id: interaction.user.id,
                  username: interaction.user.username
                },
                categoria: 'discord_comando_logs',
                operacao: 'resultado_geracao_zip'
              })
              
              if (resultadoZip.success) {
                // Cria o attachment e o FileBuilder
                logger.info("📎 Criando attachment para envio do arquivo ZIP", {
                  nomeArquivo: resultadoZip.nomeArquivo,
                  caminhoCompleto: resultadoZip.caminhoCompleto,
                  tamanhoMB: (resultadoZip.tamanho / 1024 / 1024).toFixed(2),
                  usuario: {
                    id: interaction.user.id,
                    username: interaction.user.username
                  },
                  categoria: 'discord_comando_logs',
                  operacao: 'criacao_attachment'
                })
                
                const file = new AttachmentBuilder(resultadoZip.caminhoCompleto)
                
                // Cria container de sucesso
                const containerSucesso = new ContainerBuilder()
                  .setAccentColor(65280) // Verde
                  .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`### ${obterEmoji("certo")} Logs compactados com sucesso!`),
                  )
                  .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`**Arquivo:** \`${resultadoZip.nomeArquivo}\`\n**Tamanho:** \`${(resultadoZip.tamanho / 1024 / 1024).toFixed(2)} MB\`\n**Arquivos incluídos:** \`${resultadoZip.arquivosComprimidos}\`\n\n📥 **Clique no arquivo abaixo para fazer o download:**`),
                  )
                  .addFileComponents(
                    new FileBuilder().setURL(`attachment://${resultadoZip.nomeArquivo}`),
                  )
                
                // Edita a resposta com o arquivo
                await interaction.editReply({
                  content: "",
                  components: [containerSucesso],
                  files: [file],
                  flags: MessageFlags.IsComponentsV2
                })

                const duracaoTotalMs = Date.now() - startTime

                // Log da operação bem-sucedida
                logger.info("✅ Arquivo ZIP de logs gerado e enviado com sucesso", {
                  usuario: {
                    id: interaction.user.id,
                    username: interaction.user.username,
                    displayName: interaction.member?.displayName || interaction.user.username,
                    tag: interaction.user.tag
                  },
                  arquivo: {
                    nome: resultadoZip.nomeArquivo,
                    tamanhoBytes: resultadoZip.tamanho,
                    tamanhoMB: (resultadoZip.tamanho / 1024 / 1024).toFixed(2),
                    arquivosIncluidos: resultadoZip.arquivosComprimidos,
                    caminhoCompleto: resultadoZip.caminhoCompleto
                  },
                  performance: {
                    duracaoGeracaoMs: resultadoZip.duracaoMs,
                    duracaoTotalMs: duracaoTotalMs,
                    duracaoGeracaoFormatada: `${(resultadoZip.duracaoMs / 1000).toFixed(2)}s`,
                    duracaoTotalFormatada: `${(duracaoTotalMs / 1000).toFixed(2)}s`
                  },
                  servidor: {
                    id: interaction.guildId,
                    nome: interaction.guild?.name
                  },
                  canal: {
                    id: interaction.channelId
                  },
                  timestamp: new Date().toISOString(),
                  categoria: 'discord_comando_logs',
                  operacao: 'download_zip_sucesso'
                })

              } else {
                // Erro na geração do ZIP
                logger.error("❌ Erro na geração do arquivo ZIP para usuário", {
                  erro: resultadoZip.error,
                  usuario: {
                    id: interaction.user.id,
                    username: interaction.user.username,
                    displayName: interaction.member?.displayName || interaction.user.username,
                    tag: interaction.user.tag
                  },
                  duracaoAteErroMs: Date.now() - startTime,
                  servidor: {
                    id: interaction.guildId,
                    nome: interaction.guild?.name
                  },
                  categoria: 'discord_comando_logs',
                  operacao: 'erro_geracao_zip_usuario'
                })
                
                const containerErro = new ContainerBuilder()
                  .setAccentColor(16711680) // Vermelho
                  .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`### ${obterEmoji("errado")} Erro ao gerar arquivo`),
                  )
                  .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`**Erro:** \`${resultadoZip.error}\`\n\nTente novamente ou entre em contato com o suporte técnico.`),
                  )

                await interaction.editReply({
                  content: "",
                  components: [containerErro],
                  flags: MessageFlags.IsComponentsV2
                })
              }

            } catch (error) {
              const duracaoTotalMs = Date.now() - startTime
              
              // Erro inesperado
              logger.error("❌ Erro inesperado no processo de download de logs", {
                erro: error.message,
                stack: error.stack,
                errorName: error.name,
                usuario: {
                  id: interaction.user.id,
                  username: interaction.user.username,
                  displayName: interaction.member?.displayName || interaction.user.username,
                  tag: interaction.user.tag
                },
                performance: {
                  duracaoAteErroMs: duracaoTotalMs,
                  duracaoAteErroFormatada: `${(duracaoTotalMs / 1000).toFixed(2)}s`
                },
                servidor: {
                  id: interaction.guildId,
                  nome: interaction.guild?.name
                },
                canal: {
                  id: interaction.channelId
                },
                timestamp: new Date().toISOString(),
                categoria: 'discord_comando_logs',
                operacao: 'erro_inesperado_download'
              })
              
              const containerErro = new ContainerBuilder()
                .setAccentColor(16711680) // Vermelho
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(`### ${obterEmoji("errado")} Erro interno`),
                )
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent("Ocorreu um erro interno ao processar o download. Tente novamente."),
                )

              await interaction.editReply({
                content: "",
                components: [containerErro],
                flags: MessageFlags.IsComponentsV2
              })
            }
            
            return
          }

          // Handler do botão "Limpar logs"
          if (interaction.customId === 'clear_logs') {
            // Verifica se o usuário está autorizado (administrador do bot)
            const usuarioAutorizado = BOT_ADMIN_DISCORD_USERS_ID.includes(interaction.user.id)
            
            logger.info("🗑️ Solicitação de limpeza de logs recebida", {
              usuario: {
                id: interaction.user.id,
                username: interaction.user.username,
                displayName: interaction.member?.displayName || interaction.user.username,
                tag: interaction.user.tag
              },
              autorizado: usuarioAutorizado,
              botaoClicado: 'clear_logs',
              servidor: {
                id: interaction.guildId,
                nome: interaction.guild?.name
              },
              canal: {
                id: interaction.channelId,
                tipo: interaction.channel?.type
              },
              timestamp: new Date().toISOString(),
              categoria: 'discord_comando_logs',
              operacao: 'solicitacao_limpeza_logs'
            })
            
            if (!usuarioAutorizado) {
              await interaction.reply({
                content: `${obterEmoji("errado")} Apenas administradores autorizados podem limpar os logs do sistema.`,
                flags: MessageFlags.Ephemeral
              })
              
              logger.warn("🚫 Tentativa não autorizada de limpeza de logs via botão", {
                usuario: {
                  id: interaction.user.id,
                  username: interaction.user.username,
                  tag: interaction.user.tag
                },
                servidor: {
                  id: interaction.guildId,
                  nome: interaction.guild?.name
                },
                canal: {
                  id: interaction.channelId
                },
                motivoNegacao: 'usuario_nao_autorizado',
                usuariosAutorizados: BOT_ADMIN_DISCORD_USERS_ID.length,
                timestamp: new Date().toISOString(),
                categoria: 'discord_comando_logs',
                operacao: 'limpeza_acesso_negado'
              })
              
              return
            }

            // Cria container de confirmação
            const componentsConfirmacao = criarContainerConfirmacaoExclusaoLogs()
            
            await interaction.reply({
              components: componentsConfirmacao,
              flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            })

            logger.info("🔄 Container de confirmação de exclusão de logs enviado", {
              usuario: {
                id: interaction.user.id,
                username: interaction.user.username,
                displayName: interaction.member?.displayName || interaction.user.username,
                tag: interaction.user.tag
              },
              containerEnviado: true,
              categoria: 'discord_comando_logs',
              operacao: 'confirmacao_exclusao_enviada'
            })
            
            return
          }

          // Handler do botão "Confirmar exclusão de logs"
          if (interaction.customId === 'confirm_delete_logs') {
            const startTime = Date.now()
            
            // Verifica novamente se o usuário está autorizado
            const usuarioAutorizado = BOT_ADMIN_DISCORD_USERS_ID.includes(interaction.user.id)
            
            if (!usuarioAutorizado) {
              await interaction.update({
                content: `${obterEmoji("errado")} Acesso negado. Apenas administradores autorizados podem executar esta ação.`,
                components: [],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
              })
              return
            }

            // Mensagem de processamento
            const loadingEmoji = obterEmoji("loading")
            const containerProcessando = new ContainerBuilder()
              .setAccentColor(16731904) // Cor laranja da 4.events
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`${loadingEmoji} Excluindo todos os arquivos de logs... Por favor, aguarde.`),
            )

            await interaction.update({
              content: "",
              components: [containerProcessando],
              flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            })


            logger.info("🗑️ Iniciando processo de exclusão de logs confirmado pelo usuário", {
              usuario: {
                id: interaction.user.id,
                username: interaction.user.username,
                displayName: interaction.member?.displayName || interaction.user.username,
                tag: interaction.user.tag
              },
              categoria: 'discord_comando_logs',
              operacao: 'inicio_exclusao_confirmada'
            })

            try {
              // Executa a exclusão dos logs
              const resultadoExclusao = await excluirTodosLogs()
              
              if (resultadoExclusao.success) {
                // Container de sucesso
                const containerSucesso = new ContainerBuilder()
                  .setAccentColor(65280) // Verde
                  .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`### ${obterEmoji("certo")} Logs excluídos com sucesso!`),
                  )
                  .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`**Operação concluída:**\n• Arquivos excluídos: \`${resultadoExclusao.arquivosExcluidos}\`\n• Espaço liberado: \`${resultadoExclusao.tamanhoExcluidoMB} MB\`\n• Tempo de execução: \`${(resultadoExclusao.duracaoMs / 1000).toFixed(2)}s\`\n\n${obterEmoji("certo")} Todos os arquivos de logs foram removidos do sistema.`),
                  )

                await interaction.editReply({
                  content: "",
                  components: [containerSucesso],
                  flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                })

                logger.info("✅ Exclusão de logs concluída com sucesso via interface", {
                  usuario: {
                    id: interaction.user.id,
                    username: interaction.user.username,
                    displayName: interaction.member?.displayName || interaction.user.username,
                    tag: interaction.user.tag
                  },
                  resultadoExclusao: resultadoExclusao,
                  duracaoTotalMs: Date.now() - startTime,
                  categoria: 'discord_comando_logs',
                  operacao: 'exclusao_logs_sucesso_interface'
                })

              } else {
                // Container de erro
                const containerErro = new ContainerBuilder()
                  .setAccentColor(16711680) // Vermelho
                  .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`### ${obterEmoji("errado")} Erro na exclusão de logs`),
                  )
                  .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`**Erro encontrado:**\n\n\`${resultadoExclusao.error}\`\n\n${resultadoExclusao.arquivosExcluidos ? `• **Arquivos excluídos:** \`${resultadoExclusao.arquivosExcluidos}/${resultadoExclusao.totalArquivos}\`` : ''}\n\nTente novamente ou entre em contato com o suporte técnico.`),
                  )

                await interaction.editReply({
                  content: "",
                  components: [containerErro],
                  flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                })

                logger.error("❌ Erro na exclusão de logs via interface", {
                  usuario: {
                    id: interaction.user.id,
                    username: interaction.user.username,
                    displayName: interaction.member?.displayName || interaction.user.username,
                    tag: interaction.user.tag
                  },
                  erro: resultadoExclusao.error,
                  arquivosExcluidos: resultadoExclusao.arquivosExcluidos || 0,
                  totalArquivos: resultadoExclusao.totalArquivos || 0,
                  duracaoTotalMs: Date.now() - startTime,
                  categoria: 'discord_comando_logs',
                  operacao: 'erro_exclusao_logs_interface'
                })
              }

            } catch (error) {
              // Erro inesperado
              logger.error("❌ Erro inesperado na exclusão de logs", {
                erro: error.message,
                stack: error.stack,
                errorName: error.name,
                usuario: {
                  id: interaction.user.id,
                  username: interaction.user.username,
                  displayName: interaction.member?.displayName || interaction.user.username,
                  tag: interaction.user.tag
                },
                duracaoTotalMs: Date.now() - startTime,
                categoria: 'discord_comando_logs',
                operacao: 'erro_inesperado_exclusao'
              })
              
              const containerErro = new ContainerBuilder()
                .setAccentColor(16711680) // Vermelho
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(`### ${obterEmoji("errado")} Erro interno`),
                )
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent("Ocorreu um erro interno ao processar a exclusão de logs. Tente novamente."),
                )

              await interaction.editReply({
                content: "",
                components: [containerErro],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
              })
            }
            
            return
          }

          // Handler do botão "Cancelar exclusão de logs"
          if (interaction.customId === 'cancel_delete_logs') {
            // Verifica se o usuário está autorizado
            const usuarioAutorizado = BOT_ADMIN_DISCORD_USERS_ID.includes(interaction.user.id)
            
            if (!usuarioAutorizado) {
              await interaction.update({
                content: `${obterEmoji("errado")} Acesso negado.`,
                components: [],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
              })
              return
            }

            // Container de cancelamento
            const containerCancelado = new ContainerBuilder()
              .setAccentColor(16776960) // Amarelo/laranja
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`### ${obterEmoji("info")} Operação cancelada`),
              )
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent("A exclusão de logs foi **cancelada** pelo usuário.\n\nNenhum arquivo foi removido do sistema."),
              )

            await interaction.update({
              content: "",
              components: [containerCancelado],
              flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            })

            logger.info("🚫 Exclusão de logs cancelada pelo usuário", {
              usuario: {
                id: interaction.user.id,
                username: interaction.user.username,
                displayName: interaction.member?.displayName || interaction.user.username,
                tag: interaction.user.tag
              },
              botaoClicado: 'cancel_delete_logs',
              timestamp: new Date().toISOString(),
              categoria: 'discord_comando_logs',
              operacao: 'exclusao_logs_cancelada'
            })
            
            return
          }

      return // Retorna aqui para evitar processar comandos
    }

    // Handler para Select Menus
    if (interaction.isStringSelectMenu()) {
      // Handler para o select menu do comando /help
      if (interaction.customId === 'help_select_menu') {
        const selectedValue = interaction.values[0]
        let helpContent = []

        switch (selectedValue) {
          case 'help_overview':
            helpContent = [
              new ContainerBuilder()
                .setAccentColor(16731904)
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(`### ${obterEmoji("info")} Visão Geral do Bot`),
                )
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent("**Bot para criação de solicitações de tarefas de marketing, registro de parcerias e análise de performance.**\n\nFuncionalidades principais:\n• Criar tarefas de marketing com formulários\n• Registrar parcerias comerciais\n• Obter dados de performance via Microsoft Clarity\n• Acessar materiais oficiais da 4.events"),
                )
                .addSeparatorComponents(
                  new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(`### ${obterEmoji("config")} Como Usar\n\n• **Comandos com Modal**: /marketing e /parceria abrem formulários\n• **Comandos diretos**: Demais comandos funcionam imediatamente\n• **Todos os comandos**: Funcionam em qualquer canal do servidor`),
                )
                .addSeparatorComponents(
                  new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addActionRowComponents(
                  new ActionRowBuilder()
                    .addComponents(
                      new ButtonBuilder()
                        .setCustomId('help_voltar')
                        .setLabel('Voltar ao menu principal')
                        .setStyle(ButtonStyle.Secondary)
                    ),
                )
            ]
            break

          case 'help_marketing':
            helpContent = [
              new ContainerBuilder()
                .setAccentColor(16731904)
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(`### 📋 Comando /marketing`),
                )
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent("**Descrição:** Cria uma nova solicitação de tarefa de marketing\n\n**Como usar:**\n1. Digite `/marketing`\n2. Preencha o formulário popup que será exibido\n3. Clique em 'Enviar'"),
                )
                .addSeparatorComponents(
                  new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent("**Campos do formulário:**\n• **Nome da tarefa** - Título da tarefa *(máx: 100 caracteres)*\n• **Detalhes** - Descrição detalhada *(máx: 1000 caracteres)*\n• **Prazo** - Data limite no formato **DD/MM/AAAA**"),
                )
                .addSeparatorComponents(
                  new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(`${obterEmoji("warn")} **Regras importantes:**\n• Não aceita datas no passado\n• Todos os campos são obrigatórios\n• Sistema automático de retry em caso de falhas\n• Alerta automático enviado ao canal de marketing`),
                )
                .addSeparatorComponents(
                  new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addActionRowComponents(
                  new ActionRowBuilder()
                    .addComponents(
                      new ButtonBuilder()
                        .setCustomId('help_voltar')
                        .setLabel('Voltar ao menu principal')
                        .setStyle(ButtonStyle.Secondary)
                    ),
                )
            ]
            break

          case 'help_parceria':
            helpContent = [
              new ContainerBuilder()
                .setAccentColor(16731904)
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(`### 🤝 Comando /parceria`),
                )
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent("**Descrição:** Registra uma nova parceria comercial\n\n**Como usar:**\n1. Digite `/parceria`\n2. Preencha o formulário popup que será exibido\n3. Clique em 'Enviar'"),
                )
                .addSeparatorComponents(
                  new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent("**Campos do formulário:**\n• **URL do card** - URL do card no sistema *(máx: 500 caracteres)*\n• **Data do evento** - Data do evento no formato **DD/MM/AAAA**"),
                )
                .addSeparatorComponents(
                  new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(`${obterEmoji("warn")} **Regras importantes:**\n• Aceita datas passadas (eventos já realizados)\n• URLs devem ser dos domínios Pipe.run ou 4.works\n• Notificação automática enviada ao canal de parcerias`),
                )
                .addSeparatorComponents(
                  new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addActionRowComponents(
                  new ActionRowBuilder()
                    .addComponents(
                      new ButtonBuilder()
                        .setCustomId('help_voltar')
                        .setLabel('Voltar ao menu principal')
                        .setStyle(ButtonStyle.Secondary)
                    ),
                )
            ]
            break

          case 'help_leads':
            helpContent = [
              new ContainerBuilder()
                .setAccentColor(16731904)
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(`### 📊 Comando /leads`),
                )
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent("**Descrição:** Exibe estatísticas e dados dos leads capturados pelas landing pages\n\n**Parâmetros (opcionais):**\n• `periodo` - Período para consulta (hoje, 7dias, 30dias) *(padrão: hoje)*\n• `campanha` - Filtrar por campanha específica"),
                )
                .addSeparatorComponents(
                  new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent("**Exemplos de uso:**\n• `/leads` - Leads de hoje\n• `/leads periodo:7dias` - Leads dos últimos 7 dias\n• `/leads periodo:30dias campanha:black-friday` - Leads filtrados por campanha\n• `/leads campanha:webinar` - Leads de uma campanha específica de hoje"),
                )
                .addSeparatorComponents(
                  new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(`${obterEmoji("warn")} **Informações exibidas:**\n• Total de interações e leads únicos\n• Taxa de conversão (CTA → Formulário)\n• Detalhamento por cliques e formulários\n• Top 5 campanhas do período\n• Últimos leads recentes com detalhes`),
                )
                .addSeparatorComponents(
                  new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addActionRowComponents(
                  new ActionRowBuilder()
                    .addComponents(
                      new ButtonBuilder()
                        .setCustomId('help_voltar')
                        .setLabel('Voltar ao menu principal')
                        .setStyle(ButtonStyle.Secondary)
                    ),
                )
            ]
            break

          case 'help_cro':
            helpContent = [
              new ContainerBuilder()
                .setAccentColor(16731904)
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(`### 📊 Comando /cro`),
                )
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent("**Descrição:** Obtém dados de performance e estatísticas via Microsoft Clarity\n\n**Parâmetros (opcionais):**\n• `data_desejada` - Data para consulta no formato **DD/MM/AAAA** *(padrão: hoje)*\n• `final_da_url_desejada` - Final da URL para análise *(padrão: dados consolidados)*"),
                )
                .addSeparatorComponents(
                  new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent("**Exemplos de uso:**\n• `/cro` - Dados consolidados de hoje\n• `/cro data_desejada:20/07/2025` - Dados de data específica\n• `/cro final_da_url_desejada:credenciamento` - Página específica\n• `/cro data_desejada:20/07/2025 final_da_url_desejada:credenciamento` - Combinado"),
                )
                .addSeparatorComponents(
                  new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(`${obterEmoji("warn")} **Importante:**\n• Não aceita datas futuras\n• Dados obtidos do Microsoft Clarity\n• Métricas incluem sessões, usuários únicos e sistemas operacionais`),
                )
                .addSeparatorComponents(
                  new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addActionRowComponents(
                  new ActionRowBuilder()
                    .addComponents(
                      new ButtonBuilder()
                        .setCustomId('help_voltar')
                        .setLabel('Voltar ao menu principal')
                        .setStyle(ButtonStyle.Secondary)
                    ),
                )
            ]
            break

          case 'help_midiakit':
            helpContent = [
              new ContainerBuilder()
                .setAccentColor(16731904)
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(`### 🎨 Comando /midiakit`),
                )
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent("**Descrição:** Acessa o mídia kit oficial da 4.events\n\n**Como usar:** Digite `/midiakit` para visualizar todos os links dos materiais visuais"),
                )
                .addSeparatorComponents(
                  new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent("**Conteúdo disponível:**\n• **Logos oficiais** - Versões horizontal, profile, negativo\n• **Ícones de produtos** - Ícones de funcionalidades dos apps\n• **Materiais audiovisuais** - Logos animados, intros, elementos para vídeos"),
                )
                .addSeparatorComponents(
                  new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(`${obterEmoji("warn")} **Diretrizes:**\n• Mantenha as proporções originais dos logos\n• Respeite as cores oficiais da marca\n• Para dúvidas sobre uso, consulte o time de marketing`),
                )
                .addSeparatorComponents(
                  new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addActionRowComponents(
                  new ActionRowBuilder()
                    .addComponents(
                      new ButtonBuilder()
                        .setCustomId('help_voltar')
                        .setLabel('Voltar ao menu principal')
                        .setStyle(ButtonStyle.Secondary)
                    ),
                )
            ]
            break

          case 'help_apresentacoes':
            helpContent = [
              new ContainerBuilder()
                .setAccentColor(16731904)
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(`### 📊 Comando /apresentações`),
                )
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent("**Descrição:** Acessa as apresentações comerciais oficiais da 4.events\n\n**Como usar:** Digite `/apresentações` para acessar apresentações em PDF e editáveis"),
                )
                .addSeparatorComponents(
                  new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent("**Conteúdo disponível:**\n• Apresentações comerciais\n• Apresentações técnicas\n• Materiais de vendas\n• Templates editáveis online"),
                )
                .addSeparatorComponents(
                  new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(`${obterEmoji("warn")} **IMPORTANTE:**\n• **USO INTERNO EXCLUSIVO** - não compartilhar externamente\n• Material confidencial da 4.events\n• Acesso restrito à equipe autorizada`),
                )
                .addSeparatorComponents(
                  new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addActionRowComponents(
                  new ActionRowBuilder()
                    .addComponents(
                      new ButtonBuilder()
                        .setCustomId('help_voltar')
                        .setLabel('Voltar ao menu principal')
                        .setStyle(ButtonStyle.Secondary)
                    ),
                )
            ]
            break

          case 'help_modelos':
            helpContent = [
              new ContainerBuilder()
                .setAccentColor(16731904)
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(`### 📄 Comando /modelos`),
                )
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent("**Descrição:** Acessa modelos de documentos e templates com branding da 4.events\n\n**Como usar:** Digite `/modelos` para acessar templates de documentos"),
                )
                .addSeparatorComponents(
                  new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent("**Conteúdo disponível:**\n• Documentos timbrados\n• Modelos de contratos\n• Templates de propostas\n• Modelos de relatórios\n• Materiais com identidade visual"),
                )
                .addSeparatorComponents(
                  new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(`${obterEmoji("warn")} **IMPORTANTE:**\n• **USO INTERNO EXCLUSIVO** - não compartilhar externamente\n• Mantenha sempre a identidade visual padrão\n• Material confidencial da 4.events`),
                )
                .addSeparatorComponents(
                  new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addActionRowComponents(
                  new ActionRowBuilder()
                    .addComponents(
                      new ButtonBuilder()
                        .setCustomId('help_voltar')
                        .setLabel('Voltar ao menu principal')
                        .setStyle(ButtonStyle.Secondary)
                    ),
                )
            ]
            break

          case 'help_images':
            helpContent = [
              new ContainerBuilder()
                .setAccentColor(16731904)
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(`### 🖼️ Comandos de Imagens`),
                )
                .addSeparatorComponents(
                  new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent("**🖼️ /capa-linkedin**\n• Acessa a capa oficial da 4.events para LinkedIn\n• Para uso em perfis dos colaboradores\n• Comando: `/capa-linkedin`"),
                )
                .addSeparatorComponents(
                  new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent("**🖥️ /fundo-escritorio**\n• Acessa o papel de parede oficial da 4.events\n• Para área de trabalho e webcam em reuniões\n• Ideal para home office\n• Comando: `/fundo-escritorio`"),
                )
                .addSeparatorComponents(
                  new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addActionRowComponents(
                  new ActionRowBuilder()
                    .addComponents(
                      new ButtonBuilder()
                        .setCustomId('help_voltar')
                        .setLabel('Voltar ao menu principal')
                        .setStyle(ButtonStyle.Secondary)
                    ),
                )
            ]
            break

          case 'help_others':
            helpContent = [
              new ContainerBuilder()
                .setAccentColor(16731904)
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(`### 🏓 Outros Comandos`),
                )
                .addSeparatorComponents(
                  new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent("**🏓 /ping**\n• Verifica a conectividade e latência do bot\n• Mostra o status de funcionamento\n• Comando: `/ping`"),
                )
                .addSeparatorComponents(
                  new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent("**❓ /help**\n• Exibe esta central de ajuda\n• Navegação interativa por categorias\n• Comando: `/help`"),
                )
                .addSeparatorComponents(
                  new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addActionRowComponents(
                  new ActionRowBuilder()
                    .addComponents(
                      new ButtonBuilder()
                        .setCustomId('help_voltar')
                        .setLabel('Voltar ao menu principal')
                        .setStyle(ButtonStyle.Secondary)
                    ),
                )
            ]
            break

          case 'help_dates':
            helpContent = [
              new ContainerBuilder()
                .setAccentColor(16731904)
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(`### 📅 Formatos de Data Aceitos`),
                )
                .addSeparatorComponents(
                  new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(`**${obterEmoji("certo")} Exemplos Válidos:**\n• \`25/12/2025\` - Formato padrão\n• \`5/3/25\` - Dia e mês com 1 dígito, ano com 2\n• \`15/3/25\` - Dia com 2 dígitos, mês com 1\n• \`5/03/2025\` - Mês com zero à esquerda\n• \`05/12/25\` - Dia com zero à esquerda`),
                )
                .addSeparatorComponents(
                  new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(`**${obterEmoji("warn")} Regras por Comando:**\n• **/marketing**: Não aceita datas no passado\n• **/parceria**: Aceita datas passadas\n• **/cro**: Não aceita datas futuras\n• Use apenas números e barras \`/\` em datas\n• Anos de 2 dígitos assumem 20XX`),
                )
                .addSeparatorComponents(
                  new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addActionRowComponents(
                  new ActionRowBuilder()
                    .addComponents(
                      new ButtonBuilder()
                        .setCustomId('help_voltar')
                        .setLabel('Voltar ao menu principal')
                        .setStyle(ButtonStyle.Secondary)
                    ),
                )
            ]
            break

          default:
            helpContent = [
              new ContainerBuilder()
                .setAccentColor(16731904)
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(`### ${obterEmoji("errado")} Opção não encontrada`),
                )
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent("Selecione uma opção válida do menu acima."),
                )
            ]
        }

        await interaction.update({
          components: helpContent,
          flags: MessageFlags.IsComponentsV2
        })

        // Log da seleção
        logger.info("✅ Opção de ajuda selecionada:", {
          usuario: {
            username: interaction.user.username,
            displayName: interaction.member?.displayName || interaction.user.username,
            id: interaction.user.id,
            tag: interaction.user.tag
          },
          opcaoSelecionada: selectedValue,
          timestamp: new Date().toISOString(),
          categoria: 'discord_help_navegacao',
          operacao: 'opcao_help_selecionada'
        })
      }
      return
    }

    if (!interaction.isCommand()) return

    // Comando /marketing
    if (interaction.commandName === "marketing") {
      // Criar o modal
      const modal = new ModalBuilder()
        .setCustomId('marketing_modal')
        .setTitle('📋 Nova Solicitação de Marketing')

      // Campo para nome da demanda
      const nomeInput = new TextInputBuilder()
        .setCustomId('nome_demanda')
        .setLabel('Nome/Título da Tarefa')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100)
        .setPlaceholder('Ex: Campanha redes sociais para evento X')

      // Campo para detalhes
      const detalhesInput = new TextInputBuilder()
        .setCustomId('detalhes_demanda')
        .setLabel('Detalhes e Descrição da Tarefa')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000)
        .setPlaceholder('Descreva os detalhes da tarefa, objetivos, materiais necessários...')

      // Campo para prazo
      const prazoInput = new TextInputBuilder()
        .setCustomId('prazo')
        .setLabel('Data Limite (DD/MM/AAAA)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(10)
        .setPlaceholder('25/12/2025')

      // Organizar campos em ActionRows
      const firstActionRow = new ActionRowBuilder().addComponents(nomeInput)
      const secondActionRow = new ActionRowBuilder().addComponents(detalhesInput)
      const thirdActionRow = new ActionRowBuilder().addComponents(prazoInput)

      // Adicionar campos ao modal
      modal.addComponents(firstActionRow, secondActionRow, thirdActionRow)

      // Exibir o modal
      await interaction.showModal(modal)
    }

    // Comando /parceria
    else if (interaction.commandName === "parceria") {
      // Criar o modal
      const modal = new ModalBuilder()
        .setCustomId('parceria_modal')
        .setTitle('🤝 Registrar Nova Parceria')

      // Campo para URL do card
      const urlInput = new TextInputBuilder()
        .setCustomId('url_do_card')
        .setLabel('URL do Card no Sistema')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(500)
        .setPlaceholder('https://app.pipe.run/cards/...')

      // Campo para data do evento
      const dataInput = new TextInputBuilder()
        .setCustomId('data_do_evento')
        .setLabel('Data do Evento (DD/MM/AAAA)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(10)
        .setPlaceholder('15/06/2025')

      // Organizar campos em ActionRows
      const firstActionRow = new ActionRowBuilder().addComponents(urlInput)
      const secondActionRow = new ActionRowBuilder().addComponents(dataInput)

      // Adicionar campos ao modal
      modal.addComponents(firstActionRow, secondActionRow)

      // Exibir o modal
      await interaction.showModal(modal)
    }

    // Comando /leads
    else if (interaction.commandName === "leads") {
      const periodo = interaction.options.getString("periodo") || "hoje"
      const campanhaFiltro = interaction.options.getString("campanha")
      
      // Mapeia período para dias
      const periodoDias = {
        'hoje': 1,
        '7dias': 7,
        '30dias': 30
      }[periodo] || 1
      
      const periodoTexto = {
        'hoje': 'hoje',
        '7dias': 'últimos 7 dias',
        '30dias': 'últimos 30 dias'
      }[periodo] || 'hoje'
      
      // Resposta inicial
      const loadingEmoji = obterEmoji("loading")
      await interaction.reply(`${loadingEmoji} Coletando dados de leads do período: ${periodoTexto}...`)
      
      try {
        // Buscar dados do banco
        const [statsResult, topCampaigns, recentLeads] = await Promise.all([
          database.getLeadsStats(periodoDias, campanhaFiltro),
          database.getTopCampaigns(periodoDias, 5),
          database.getRecentLeads(periodoDias, 8)
        ])
        
        if (statsResult.success) {
          const { clickStats, formStats } = statsResult
          
          // Calcular métricas consolidadas
          const totalInteracoes = (clickStats.total_clicks || 0) + (formStats.total_submissions || 0)
          const totalEmailsUnicos = new Set([
            ...(clickStats.emails_unicos ? [clickStats.emails_unicos] : []),
            ...(formStats.emails_unicos ? [formStats.emails_unicos] : [])
          ]).size
          
          const conversaoRate = clickStats.total_clicks > 0 
            ? ((formStats.total_submissions / clickStats.total_clicks) * 100).toFixed(1)
            : '0.0'
          
          // Criar container principal
          const container = new ContainerBuilder()
            .setAccentColor(16731904) // Cor laranja da 4.events (0xff4f00)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`### ${obterEmoji("usuarios")} Relatório de leads - ${periodoTexto.charAt(0).toUpperCase() + periodoTexto.slice(1)}`),
            )
          
          if (campanhaFiltro) {
            container.addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`**Filtro aplicado:** \`${campanhaFiltro}\``),
            )
          }
          
          container.addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`${obterEmoji("planeta")} Cliques em CTA: \`${formatarNumero(clickStats.total_clicks || 0)}\`\n${obterEmoji("pasta")} Formulários Enviados: \`${formatarNumero(formStats.emails_unicos || 0)}\``),
          )

                    // Adicionar leads recentes se houver dados
          if (recentLeads.success && recentLeads.leads.length > 0) {
            container.addSeparatorComponents(
              new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`### ${obterEmoji("relogio")} Leads recentes`),
            )
            
            let leadsTexto = ""
            recentLeads.leads.slice(0, 6).forEach((lead, index) => {
              const nome = lead.lead_nome || 'Nome não informado'
              const email = lead.lead_email || 'Email não informado'
              const empresa = lead.lead_empresa ? ` (${lead.lead_empresa})` : ''
              const cidade = lead.lead_cidade ? ` - ${lead.lead_cidade}` : ''
              const fonte = lead.lead_source === 'form_submit' ? 'Formulário' : 'CTA'
              const campanha = lead.campaign ? lead.campaign : 'Não informada'
              const landingPage = lead.landing_page ? lead.landing_page : 'Não informada'
              const origem = lead.source || 'Não informada'
              const timestamp = new Date(lead.timestamp).toLocaleString('pt-BR', { 
                timeZone: 'America/Sao_Paulo',
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              })
              
              leadsTexto += `\`\`\`${index + 1}. ${nome}${empresa}\n   • ${email}${cidade}\n   • Via: ${fonte} em ${timestamp}\n   • Campanha: ${truncarTexto(campanha, 40)}\n   • Origem: ${origem}\n   • Landing: ${truncarTexto(landingPage, 50)}\n\`\`\``
            })
            
            if (leadsTexto) {
              container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(leadsTexto),
              )
            }
          }
          
          // Adicionar top campanhas se houver dados
          if (topCampaigns.success && topCampaigns.campaigns.length > 0) {
            container.addSeparatorComponents(
              new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`### ${obterEmoji("medalha")} Top campanhas`),
            )
            
            let campanhasTexto = ""
            const campanhasProcessadas = new Map()
            
            topCampaigns.campaigns.forEach((camp, index) => {
              if (index < 5) {
                const key = camp.campaign || 'Sem campanha'
                if (!campanhasProcessadas.has(key)) {
                  campanhasProcessadas.set(key, {
                    total_events: 0,
                    unique_leads: 0
                  })
                }
                
                const existing = campanhasProcessadas.get(key)
                existing.total_events += parseInt(camp.total_events || 0)
                existing.unique_leads += parseInt(camp.unique_leads || 0)
              }
            })
            
            let pos = 1
            for (const [campanha, dados] of campanhasProcessadas) {
              campanhasTexto += `\`\`\`${pos}. ${truncarTexto(campanha, 40)}\n   • Eventos: ${formatarNumero(dados.total_events)} • Leads: ${formatarNumero(dados.unique_leads)}\n\`\`\``
              pos++
            }
            
            if (campanhasTexto) {
              container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(campanhasTexto),
              )
            }
          }
          
          // Resposta final
          await interaction.editReply({
            content: "",
            components: [container],
            flags: MessageFlags.IsComponentsV2
          })
          
          // Log da consulta bem-sucedida
          const usuario = {
            username: interaction.user.username,
            displayName: interaction.member?.displayName || interaction.user.username,
            id: interaction.user.id,
            tag: interaction.user.tag,
          }
          
          logger.info("✅ Dados de leads consultados:", {
            periodo: periodoTexto,
            periodoDias: periodoDias,
            campanhaFiltro: campanhaFiltro,
            totalInteracoes: totalInteracoes,
            totalEmailsUnicos: totalEmailsUnicos,
            conversaoRate: conversaoRate,
            usuario: {
              username: usuario.username,
              displayName: usuario.displayName,
              id: usuario.id,
              tag: usuario.tag
            },
            timestamp: new Date().toISOString(),
            categoria: 'discord_leads_consulta',
            operacao: 'consulta_leads_sucesso'
          })
          
        } else {
          // Erro nos dados
          await interaction.editReply({
            content: `${obterEmoji("errado")} **Erro ao buscar dados de leads**\n\`\`\`Falha na consulta ao banco de dados\`\`\`\nTente novamente ou entre em contato com o suporte.`,
          })
        }
        
      } catch (error) {
        // Erro na consulta
        await interaction.editReply({
          content: `${obterEmoji("errado")} **Erro ao consultar dados de leads**\n\`\`\`${error.message}\`\`\`\nTente novamente ou entre em contato com o suporte.`,
        })
        
        logger.error("❌ Erro ao consultar dados de leads:", {
          erro: error.message,
          stack: error.stack,
          periodo: periodoTexto,
          periodoDias: periodoDias,
          campanhaFiltro: campanhaFiltro,
          usuario: {
            username: interaction.user.username,
            displayName: interaction.member?.displayName || interaction.user.username,
            id: interaction.user.id,
            tag: interaction.user.tag
          },
          timestamp: new Date().toISOString(),
          categoria: 'discord_leads_consulta',
          operacao: 'erro_consultar_leads'
        })
      }
    }

    // Comando /cro
    else if (interaction.commandName === "cro") {
      const dataDesejada = interaction.options.getString("data_desejada")
      const finalURLDesejada = interaction.options.getString("final_da_url_desejada")
      
      // Define data de hoje se não fornecida
      let dataConsulta = new Date()
      let numDias = 1
      
      // Se data foi fornecida, valida e calcula diferença
      if (dataDesejada) {
        const validacaoData = validarEFormatarData(dataDesejada)
        if (!validacaoData.valido) {
          await interaction.reply({
            content: `${obterEmoji("errado")} **Erro na data:** ${validacaoData.erro}`,
            flags: MessageFlags.Ephemeral,
          })
          return
        }
        
        dataConsulta = validacaoData.dataObj
        const hoje = new Date()
        hoje.setHours(0, 0, 0, 0)
        
        // Calcula diferença de dias
        numDias = calcularDiasEntreDatas(dataConsulta, hoje)
        
        // Se a data é futura, não é possível consultar
        if (dataConsulta > hoje) {
          await interaction.reply({
            content: `${obterEmoji("errado")} **Erro na data:** Não é possível consultar dados de datas futuras`,
            flags: MessageFlags.Ephemeral,
          })
          return
        }
      }
      
      // Constrói URL completa se fornecida
      let urlCompleta = null
      let urlParaFiltro = null
      let tipoAnalise = "dados consolidados do site"
      
      if (finalURLDesejada && finalURLDesejada.trim() !== "") {
        urlCompleta = construirURLCompleta(finalURLDesejada)
        urlParaFiltro = urlCompleta
        tipoAnalise = `página específica "${urlCompleta}"`
      } else {
        // Sem filtro de URL = dados consolidados de todo o site
        urlCompleta = "Todo o site (dados consolidados)"
        urlParaFiltro = null
        tipoAnalise = "dados consolidados de todo o site"
      }
      
      // Resposta inicial
      const dataFormatada = dataConsulta.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
      
      await interaction.reply(`${obterEmoji("loading")} Buscando ${tipoAnalise} do dia ${dataFormatada}...`)

      // Busca dados principais do Clarity
      const resultado = await buscarDadosClarity(numDias, urlParaFiltro)
      
      if (resultado.success) {
        // Processa os dados principais
        const dadosProcessados = processarDadosClarity(resultado.data, urlParaFiltro)
        
        if (dadosProcessados.success) {
          // Busca dados de eventos inteligentes
          const resultadoEventos = await buscarEventosInteligentesClarity(numDias, urlParaFiltro)
          let dadosEventos = { totalEventos: 0, eventosFormulario: 0 }
          
          if (resultadoEventos.success) {
            dadosEventos = processarEventosInteligentes(resultadoEventos.data)
            // Por enquanto, os dados inteligentes não estão sendo enviados
            // para o usuário como resposta ao comando.
            // Os eventos inteligentes não estão retornando o número correto.
          }
          
          const { resumo, detalhes, totalItens } = dadosProcessados
          
          // Prepara os campos do embed
          const embedFields = [
            {
              name: `${obterEmoji("planeta")} Análise realizada`,
              value: `\`${urlCompleta}\``,
              inline: false,
            },
            {
              name: `${obterEmoji("relogio")} Período analisado`,
              value: `\`${dataFormatada}\` (${numDias} dia${numDias > 1 ? 's' : ''})`,
              inline: true,
            },
            {
              name: `${obterEmoji("usuarios")} Total de sessões`,
              value: `\`${formatarNumero(resumo.totalSessoes)}\``,
              inline: true,
            },
            {
              name: `${obterEmoji("equipe")} Sessões reais`,
              value: `\`${formatarNumero(resumo.sessaosSemBots)}\``,
              inline: true,
            }
          ]
          
          // Adiciona detalhes se disponíveis e se é página específica
          if (detalhes && detalhes.length > 0 && urlParaFiltro) {
            let detalhesTexto = ""
            detalhes.forEach((item, index) => {
              const label = item.OS || item.Page || `Item ${index + 1}`
              const sessoes = formatarNumero(item.totalSessionCount || 0)
              detalhesTexto += `• **${truncarTexto(label, 30)}**: ${sessoes} sessões\n`
            })
            
            if (totalItens > 5) {
              detalhesTexto += `*... e mais ${totalItens - 5} itens*`
            }
            
            embedFields.push({
              name: `${obterEmoji("info")} Detalhes`,
              value: detalhesTexto || "Nenhum detalhe disponível",
              inline: false,
            })
          } else if (!urlParaFiltro && detalhes && detalhes.length > 0) {
            // Para dados consolidados, mostra top 5 sistemas operacionais ordenados
            let detalhesTexto = ""
            detalhes.forEach((item, index) => {
              let os = item.OS || `Sistema ${index + 1}`
              // Substitui "Other" por "Outros" em português
              if (os.toLowerCase() === "other") {
                os = "Outros"
              }
              const sessoes = formatarNumero(item.totalSessionCount || 0)
              detalhesTexto += `• **${os}**: ${sessoes} sessões\n`
            })
            
            if (totalItens > 5) {
              detalhesTexto += `*... e mais ${totalItens - 5} sistemas*`
            }
            
            embedFields.push({
              name: `${obterEmoji("info")} Top 5 sistemas operacionais`,
              value: detalhesTexto || "Nenhum detalhe disponível",
              inline: false,
            })
          }
          
          // Cria embed de sucesso
          const embed = {
            color: 0xff4f00,
            title: `${obterEmoji("certo")} Dados de performance (CRO)`,
            description: "**Estatísticas de desempenho obtidas:**",
            fields: embedFields,
            footer: {
              text: "4.events Marketing Bot • Dados obtidos do Microsoft Clarity",
            },
            timestamp: new Date().toISOString(),
          }

          await interaction.editReply({
            content: "",
            embeds: [embed],
          })

          // Prepara dados do usuário para log
          const usuario = {
            username: interaction.user.username,
            displayName: interaction.member?.displayName || interaction.user.username,
            id: interaction.user.id,
            tag: interaction.user.tag,
          }

          logger.info("✅ Dados do Clarity consultados:", {
            urlCompleta: urlCompleta,
            dataFormatada: dataFormatada,
            numDias: numDias,
            tipoAnalise: tipoAnalise,
            urlParaFiltro: urlParaFiltro,
            usuario: {
              username: usuario.username,
              displayName: usuario.displayName,
              id: usuario.id,
              tag: usuario.tag
            },
            resumo: dadosProcessados.resumo,
            totalItens: dadosProcessados.totalItens,
            timestamp: new Date().toISOString(),
            categoria: 'discord_clarity_consulta',
            operacao: 'consulta_clarity_sucesso'
          })

        } else {
          // Erro no processamento
          await interaction.editReply({
            content: `❌ **Erro ao processar dados**\n\`\`\`${dadosProcessados.erro}\`\`\`\nTente novamente ou verifique os parâmetros.`,
          })
          
          logger.error("❌ Erro ao processar dados do Clarity:", {
            erro: dadosProcessados.erro,
            urlCompleta: urlCompleta,
            dataFormatada: dataFormatada,
            numDias: numDias,
            tipoAnalise: tipoAnalise,
            urlParaFiltro: urlParaFiltro,
            usuario: {
              username: usuario.username,
              displayName: usuario.displayName,
              id: usuario.id,
              tag: usuario.tag
            },
            dadosProcessados: dadosProcessados,
            timestamp: new Date().toISOString(),
            categoria: 'discord_clarity_consulta',
            operacao: 'erro_processar_dados_clarity'
          })
        }
        
      } else {
        // Erro na consulta
        await interaction.editReply({
          content: `❌ **Erro ao consultar Microsoft Clarity**\n\`\`\`${resultado.error}\`\`\`\nTente novamente ou entre em contato com o suporte.`,
        })
        
        logger.error("❌ Erro ao consultar Clarity API:", {
          erro: resultado.error,
          urlCompleta: urlCompleta,
          dataFormatada: dataFormatada,
          numDias: numDias,
          tipoAnalise: tipoAnalise,
          urlParaFiltro: urlParaFiltro,
          clarityApiUrl: `${CLARITY_BASE_URL}/project-live-insights`,
          usuario: {
            username: usuario.username,
            displayName: usuario.displayName,
            id: usuario.id,
            tag: usuario.tag
          },
          timestamp: new Date().toISOString(),
          categoria: 'discord_clarity_consulta',
          operacao: 'erro_consultar_clarity_api'
        })
      }
    }

    // Comando /midiakit
    else if (interaction.commandName === "midiakit") {
        // Criar o container com os novos components V2
        const components = [
            new ContainerBuilder()
                .setAccentColor(16731904) // Cor laranja da 4.events (0xff4f00)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`### ${obterEmoji("info")} Mídia Kit Oficial 4.events`),
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent("Acesse todos os materiais visuais e audiovisuais oficiais da 4.events"),
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`### ${obterEmoji("foto")} Logos oficiais da 4.events`),
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent("• Logos em diferentes versões (horizontal, profile, negativo, etc)\n• Diferentes formatos em alta resolução\n• Versões para fundo claro e escuro"),
                )
                .addActionRowComponents(
                    new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setStyle(ButtonStyle.Link)
                                .setLabel("Acessar logos oficiais")
                                .setURL("https://drive.google.com/drive/folders/1N24emGD_ZnB4Eu88UXfdNhZVnY8-uul0?usp=sharing"),
                        ),
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`### ${obterEmoji("safira")} Ícones dos produtos e features`),
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent("• Ícones de todas as funcionalidades (features) dos apps 4.events"),
                )
                .addActionRowComponents(
                    new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setStyle(ButtonStyle.Link)
                                .setLabel("Acessar ícones de features")
                                .setURL("https://drive.google.com/drive/folders/1TbxLIiJFNF9PdjtuzUCBmjc9rIONoqZT?usp=sharing"),
                        ),
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`### ${obterEmoji("youtube")} Materiais audiovisuais e animações`),
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent("• Logos animados\n• Intros e outros materiais para vídeos\n• Elementos visuais em movimento para apresentações"),
                )
                .addActionRowComponents(
                    new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setStyle(ButtonStyle.Link)
                                .setLabel("Acessar materiais audiovisuais")
                                .setURL("https://drive.google.com/drive/folders/1QVlCzr8clpLih7vUEEzjVD6Ey53xeSyw?usp=sharing"),
                        ),
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`${obterEmoji("warn")} **Importante:**\n• Mantenha as proporções originais dos logos\n• Respeite as cores oficiais da marca\n• Para dúvidas sobre uso, consulte o time de marketing`),
                ),
        ];

        await interaction.reply({
            components: components,
            flags: MessageFlags.IsComponentsV2
        })

        // Prepara dados do usuário para log
        const usuario = {
            username: interaction.user.username,
            displayName: interaction.member?.displayName || interaction.user.username,
            id: interaction.user.id,
            tag: interaction.user.tag,
        }

        logger.info("✅ Mídia kit acessado:", {
            usuario: {
                username: usuario.username,
                displayName: usuario.displayName,
                id: usuario.id,
                tag: usuario.tag
            },
            comando: "midiakit",
            timestamp: new Date().toISOString(),
            categoria: 'discord_comando_acesso',
            operacao: 'midiakit_acessado'
        })
    }

    // Comando /apresentações
    else if (interaction.commandName === "apresentações") {
      // Criar o container com os novos components V2
      const components = [
        new ContainerBuilder()
          .setAccentColor(16731905)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### ${obterEmoji("info")} Apresentações Comerciais 4.events`),
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("👇 Clique no botão abaixo e acesse todas as apresentações comerciais oficiais da 4.events"),
          )
          .addActionRowComponents(
            new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Link)
                  .setLabel("Acessar drive apresentações")
                  .setURL("https://drive.google.com/drive/u/1/folders/1Pgveln9kAC5RBaUce78ST6JakIPNIKOW"),
              ),
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`${obterEmoji("warn")} **Importante:**\n• Este drive é de uso interno exclusivo da 4.events\n• Não compartilhe o drive externamente sem autorização`),
          ),
      ];

      await interaction.reply({
        components: components,
        flags: MessageFlags.IsComponentsV2
      })

      // Prepara dados do usuário para log
      const usuario = {
        username: interaction.user.username,
        displayName: interaction.member?.displayName || interaction.user.username,
        id: interaction.user.id,
        tag: interaction.user.tag,
      }

      logger.info("✅ Apresentações acessadas:", {
        usuario: {
          username: usuario.username,
          displayName: usuario.displayName,
          id: usuario.id,
          tag: usuario.tag
        },
        comando: "apresentações",
        timestamp: new Date().toISOString(),
        categoria: 'discord_comando_acesso',
        operacao: 'apresentacoes_acessadas'
      })
    }

    // Comando /modelos
    else if (interaction.commandName === "modelos") {
      // Criar o container com os novos components V2
      const components = [
        new ContainerBuilder()
          .setAccentColor(16731905)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### ${obterEmoji("info")} Modelos/Templates de Documentos 4.events`),
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("👇 Clique no botão abaixo e acesse o drive com todos os modelos de documentos e templates com branding da 4.events"),
          )
          .addActionRowComponents(
            new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Link)
                  .setLabel("Acessar drive de modelos de docs")
                  .setURL("https://drive.google.com/drive/u/1/folders/1XlQOqlj7V6MV4O44goL51Zv_VjwDd8q6?usp=sharing"),
              ),
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`${obterEmoji("warn")} **Importante:**\n• Não compartilhe a pasta externamente sem autorização\n• Mantenha sempre a identidade visual padrão`),
          ),
      ];

      await interaction.reply({
        components: components,
        flags: MessageFlags.IsComponentsV2
      })

      // Prepara dados do usuário para log
      const usuario = {
        username: interaction.user.username,
        displayName: interaction.member?.displayName || interaction.user.username,
        id: interaction.user.id,
        tag: interaction.user.tag,
      }

      logger.info("✅ Modelos acessados:", {
        usuario: {
          username: usuario.username,
          displayName: usuario.displayName,
          id: usuario.id,
          tag: usuario.tag
        },
        comando: "modelos",
        timestamp: new Date().toISOString(),
        categoria: 'discord_comando_acesso',
        operacao: 'modelos_acessados'
      })
    }

    // Comando /ping
    else if (interaction.commandName === "ping") {
      const ping = Math.round(client.ws.ping)
      
      // Criar o container com os novos components V2
      const components = [
        new ContainerBuilder()
          .setAccentColor(16731904) // Cor laranja da 4.events (0xff4f00)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### ${obterEmoji("pingpong")} Pong!`),
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**Latência:** \`${ping} ms\``),
          )
      ];

      await interaction.reply({
        components: components,
        flags: MessageFlags.IsComponentsV2
      })
    }

    // Comando /capa-linkedin
    else if (interaction.commandName === "capa-linkedin") {
      const mensagem = `https://agenciam2a.com.br/externo/4events-Capa-LinkedIn-Pessoal-Time.png`

      await interaction.reply({
        content: mensagem,
        flags: MessageFlags.Ephemeral,
      })

      // Prepara dados do usuário para log
      const usuario = {
        username: interaction.user.username,
        displayName: interaction.member?.displayName || interaction.user.username,
        id: interaction.user.id,
        tag: interaction.user.tag,
      }

      logger.info("✅ Capa LinkedIn acessada:", {
        usuario: {
          username: usuario.username,
          displayName: usuario.displayName,
          id: usuario.id,
          tag: usuario.tag
        },
        comando: "capa-linkedin",
        timestamp: new Date().toISOString(),
        categoria: 'discord_comando_acesso',
        operacao: 'capa_linkedin_acessada'
      })
    }

    // Comando /fundo-escritorio
    else if (interaction.commandName === "fundo-escritorio") {

      const mensagem = `https://agenciam2a.com.br/externo/4events-fundo-escritorio.png`

      await interaction.reply({
        content: mensagem,
        flags: MessageFlags.Ephemeral,
      })

      // Prepara dados do usuário para log
      const usuario = {
        username: interaction.user.username,
        displayName: interaction.member?.displayName || interaction.user.username,
        id: interaction.user.id,
        tag: interaction.user.tag,
      }

      logger.info("✅ Fundo de escritório acessado:", {
        usuario: {
          username: usuario.username,
          displayName: usuario.displayName,
          id: usuario.id,
          tag: usuario.tag
        },
        comando: "fundo-escritorio",
        timestamp: new Date().toISOString(),
        categoria: 'discord_comando_acesso',
        operacao: 'fundo_escritorio_acessado'
      })
    }

    // Comando /help
    else if (interaction.commandName === "help") {
      const components = criarContainerInicialHelp();

      await interaction.reply({
        components: components,
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      })

      // Prepara dados do usuário para log
      const usuario = {
        username: interaction.user.username,
        displayName: interaction.member?.displayName || interaction.user.username,
        id: interaction.user.id,
        tag: interaction.user.tag,
      }

      logger.info("✅ Central de ajuda acessada:", {
        usuario: {
          username: usuario.username,
          displayName: usuario.displayName,
          id: usuario.id,
          tag: usuario.tag
        },
        comando: "help",
        timestamp: new Date().toISOString(),
        categoria: 'discord_comando_acesso',
        operacao: 'help_acessado'
      })
    }

  } catch (error) {
      logger.error("❌ Erro ao processar comando:", {
        comando: interaction.commandName,
        erro: error.message,
        stack: error.stack,
        usuario: {
          username: interaction.user?.username,
          displayName: interaction.member?.displayName || interaction.user?.username,
          id: interaction.user?.id,
          tag: interaction.user?.tag
        },
        servidor: {
          id: interaction.guildId,
          nome: interaction.guild?.name
        },
        timestamp: new Date().toISOString(),
        categoria: 'discord_comando_erro',
        operacao: 'processamento_comando_falhou'
      })
    
    const errorMessage = `${obterEmoji("errado")} Ocorreu um erro interno. Tente novamente ou contate o suporte.`
    
    if (interaction.replied) {
      await interaction.editReply(errorMessage)
    } else {
      await interaction.reply({
        content: errorMessage,
        flags: MessageFlags.Ephemeral,
      })
    }
  }
})

// Evento: Processar mensagens "comuns" (que não são comandos slash) e que tem menção ao bot
client.on("messageCreate", async (message) => {
  try {
    // Ignora mensagens do próprio bot
    if (message.author.bot) return
    
    // Verifica se o bot foi mencionado
    if (!message.mentions.has(client.user)) return
    
    // Verifica se a mensagem contém "log" ou "logs"
    const conteudo = message.content.toLowerCase()
    if (!conteudo.includes('log') && !conteudo.includes('logs')) return
    
    // Verifica se o usuário está autorizado (administrador do bot)
    const usuarioAutorizado = BOT_ADMIN_DISCORD_USERS_ID.includes(message.author.id)
    
    if (!usuarioAutorizado) {
      // Reage com emoji de erro
      await message.react(obterEmoji("errado") || "❌")
      
      // Responde com container de erro
      const containerErro = new ContainerBuilder()
        .setAccentColor(16711680) // Vermelho
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`### ${obterEmoji("errado")} Acesso negado`),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("**Você não tem permissão para acessar os logs do sistema.**\n\nEste comando é restrito a administradores autorizados do bot."),
        )
      
      await message.reply({
        components: [containerErro],
        flags: MessageFlags.Ephemeral,
      })
      
      logger.warn("🚫 Tentativa de acesso não autorizado aos logs:", {
        usuario: {
          id: message.author.id,
          username: message.author.username,
          tag: message.author.tag
        },
        servidor: {
          id: message.guild?.id,
          nome: message.guild?.name
        },
        canal: {
          id: message.channel.id,
          nome: message.channel.name
        },
        mensagem: message.content,
        timestamp: new Date().toISOString(),
        categoria: 'discord_comando_logs',
        operacao: 'acesso_negado'
      })
      
      return
    }
    
    // Reage com emoji de sucesso
    await message.react(obterEmoji("certo") || "✅")

    // Carregar logs da categoria 'geral' imediatamente
    const resultadoLogsGeral = await lerArquivosLog('geral')
    
    // Envia container inicial já com dados dos logs da categoria 'geral'
    const componentsIniciais = criarContainerInicialLogs('geral', resultadoLogsGeral)
    const respostaInicial = await message.reply({
      components: componentsIniciais,
      flags: MessageFlags.IsComponentsV2
    })

    // Collector para os select menus
    const collector = respostaInicial.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 300000 // 5 minutos
    })

    collector.on('collect', async (interaction) => {
      // Verifica se quem selecionou é um administrador autorizado
      if (!BOT_ADMIN_DISCORD_USERS_ID.includes(interaction.user.id)) {
        await interaction.reply({
          content: `${obterEmoji("errado")} Apenas administradores autorizados podem usar este menu.`,
          flags: MessageFlags.Ephemeral
        })
        return
      }
      
      // Pega a categoria selecionada
      const tipoLog = interaction.values[0]
      const resultadoNavegacao = await lerArquivosLog(tipoLog)
      
      // Cria container atualizado com os logs da categoria selecionada
      const componentsAtualizados = criarContainerInicialLogs(tipoLog, resultadoNavegacao)
      
      await interaction.update({
        components: componentsAtualizados,
        flags: MessageFlags.IsComponentsV2
      })
      
      logger.info("✅ Categoria de logs selecionada:", {
        usuario: {
          id: interaction.user.id,
          username: interaction.user.username,
          tag: interaction.user.tag
        },
        categoria: tipoLog,
        sucesso: resultadoNavegacao.success,
        logsEncontrados: resultadoNavegacao.success ? resultadoNavegacao.total : 0,
        timestamp: new Date().toISOString(),
        categoria_log: 'discord_comando_logs',
        operacao: 'categoria_selecionada'
      })
    })
    
    collector.on('end', () => {
      // Container para informar que o tempo expirou
      const containerExpirado = new ContainerBuilder()
        .setAccentColor(16731904)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`### ${obterEmoji("relogio")} Sessão expirada`),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("Esta sessão de visualização de logs expirou. Mencione o bot novamente com 'logs' para abrir uma nova sessão."),
        )

      respostaInicial.edit({
        components: [containerExpirado],
        flags: MessageFlags.IsComponentsV2
      }).catch(() => {
        // Ignora erros se a mensagem já foi deletada
      })
    })
    
    // Log da execução bem-sucedida
    logger.info("✅ Comando de logs executado com sucesso:", {
      usuario: {
        id: message.author.id,
        username: message.author.username,
        tag: message.author.tag
      },
      servidor: {
        id: message.guild?.id,
        nome: message.guild?.name
      },
      canal: {
        id: message.channel.id,
        nome: message.channel.name
      },
      componenteUsado: 'container_v2_com_select_menu',
      timestamp: new Date().toISOString(),
      categoria: 'discord_comando_logs',
      operacao: 'logs_iniciado_sucesso'
    })
    
  } catch (error) {
    logger.error("❌ Erro ao processar comando de logs:", {
      erro: error.message,
      stack: error.stack,
      usuario: {
        id: message.author?.id,
        username: message.author?.username,
        tag: message.author?.tag
      },
      mensagem: message?.content,
      timestamp: new Date().toISOString(),
      categoria: 'discord_comando_logs',
      operacao: 'erro_processar_comando_logs'
    })
    
    try {
      const containerErro = new ContainerBuilder()
        .setAccentColor(16711680)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`### ${obterEmoji("errado")} Erro Interno`),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("Ocorreu um erro interno ao processar o comando de logs. Tente novamente."),
        )

      await message.reply({
        components: [containerErro],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
      })
    } catch {
      // Ignora erros de resposta
    }
  }
})

// Evento: Log de erros
client.on("error", (error) => {
  logger.error("❌ Erro do cliente Discord:", {
    erro: error.message,
    stack: error.stack,
    name: error.name,
    code: error.code,
    timestamp: new Date().toISOString(),
    categoria: 'discord_cliente_erro',
    operacao: 'cliente_discord_erro'
  })
})

// Evento: Bot desconectado
client.on("disconnect", () => {
  logger.warn("⚠️ Bot desconectado do Discord", {
    evento: 'disconnect',
    timestamp: new Date().toISOString(),
    categoria: 'discord_conexao',
    operacao: 'bot_desconectado',
    status: 'desconectado'
  })
})

// Evento: Bot reconectado
client.on("reconnecting", () => {
  logger.info("🔄 Reconectando ao Discord...", {
    evento: 'reconnecting',
    timestamp: new Date().toISOString(),
    categoria: 'discord_conexao',
    operacao: 'bot_reconectando',
    status: 'reconectando'
  })
})

// Tratamento de erros não capturados
process.on("unhandledRejection", (reason, promise) => {
  logger.error("❌ Unhandled Rejection em:", {
    promise: promise,
    reason: reason,
    stack: reason?.stack,
    timestamp: new Date().toISOString(),
    categoria: 'process_erro_critico',
    operacao: 'unhandled_rejection',
    tipo_erro: 'unhandled_rejection'
  })
})

process.on("uncaughtException", (error) => {
  logger.error("❌ Uncaught Exception:", {
    erro: error.message,
    stack: error.stack,
    name: error.name,
    timestamp: new Date().toISOString(),
    categoria: 'process_erro_critico',
    operacao: 'uncaught_exception',
    tipo_erro: 'uncaught_exception'
  })
  process.exit(1)
})

// Encerramento por pedido de shutdown
process.on("SIGINT", async () => {
  logger.info("🛑 Recebido SIGINT. Encerrando bot...", {
    sinal: 'SIGINT',
    timestamp: new Date().toISOString(),
    categoria: 'process_lifecycle',
    operacao: 'shutdown_graceful',
    motivo: 'SIGINT_recebido'
  })

  // Parar o Cloudflare tunnel antes de encerrar
  tunnel.stop()
  
  // Encerra API
  await apiServer.stop()
  
  // Encerra banco
  await database.close()
  
  // Encerra bot Discord
  client.destroy()
  process.exit(0)
})

process.on("SIGTERM", async () => {
  logger.info("🛑 Recebido SIGTERM. Encerrando bot...", {
    sinal: 'SIGTERM',
    timestamp: new Date().toISOString(),
    categoria: 'process_lifecycle',
    operacao: 'shutdown_graceful',
    motivo: 'SIGTERM_recebido'
  })

  // Parar o Cloudflare tunnel antes de encerrar
  tunnel.stop()
  
  // Encerra API
  await apiServer.stop()
  
  // Encerra banco
  await database.close()
  
  // Encerra bot Discord
  client.destroy()
  process.exit(0)
})

// Conecta o bot ao Discord
client.login(process.env.BOT_TOKEN)