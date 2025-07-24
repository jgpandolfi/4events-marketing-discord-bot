import {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
} from "discord.js"
import dotenv from "dotenv"
import fetch from "node-fetch"

import { createRequire } from "module"
const require = createRequire(import.meta.url)
const emojis = require("./emojis.json")

dotenv.config()


// Validação das variáveis de ambiente
if (!process.env.BOT_TOKEN) {
  console.error("❌ Erro: BOT_TOKEN não está configurado no arquivo .env")
  process.exit(1)
}

if (!process.env.CANAL_MARKETING) {
  console.error("❌ Erro: CANAL_MARKETING não está configurado no arquivo .env")
  process.exit(1)
}


// Configuração da webhook do N8N
const WEBHOOK_URL = process.env.WEBHOOK
const WEBHOOK_URL_PARCERIA = process.env.WEBHOOK_PARCERIA

// Cria o cliente do Discord com as intents necessárias
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
})


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
    console.error(`❌ O emoji personalizado de nome ${nomeEmoji} não existe`)
    return ""
  } catch (erro) {
    console.error(`❌ Erro ao obter emoji ${nomeEmoji}: ${erro.message}`)
    return ""
  }
}

// Define o comando slash /marketing
const cmdMarketing = new SlashCommandBuilder()
  .setName("marketing")
  .setDescription("📋 Cria uma nova solicitação de tarefa de marketing")
  .addStringOption((option) =>
    option
      .setName("nome_demanda")
      .setDescription("Nome/título da tarefa de marketing")
      .setRequired(true)
      .setMaxLength(100)
  )
  .addStringOption((option) =>
    option
      .setName("detalhes_demanda")
      .setDescription("Detalhes e descrição da tarefa")
      .setRequired(true)
      .setMaxLength(1000)
  )
  .addStringOption((option) =>
    option
      .setName("prazo")
      .setDescription("Data limite para conclusão (formato: DD/MM/AAAA)")
      .setRequired(true)
      .setMaxLength(10)
  )

// Define o comando slash /parceria
const cmdParceria = new SlashCommandBuilder()
  .setName("parceria")
  .setDescription("🤝 Registra uma nova parceria comercial")
  .addStringOption((option) =>
    option
      .setName("url_do_card")
      .setDescription("URL do card no sistema (ex: https://app.pipe.run/...)")
      .setRequired(true)
      .setMaxLength(500)
  )
  .addStringOption((option) =>
    option
      .setName("data_do_evento")
      .setDescription("Data do evento (formato: DD/MM/AAAA)")
      .setRequired(true)
      .setMaxLength(10)
  )


// Define o comando /ping para teste
const cmdPing = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("🏓 Testa a conectividade do bot")


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


    console.log("📤 Enviando dados para N8N (Marketing):", JSON.stringify(body, null, 2))

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
    
    console.log("✅ Resposta do N8N (Marketing):", result)
    return { success: true, data: result }

  } catch (error) {
    console.error("❌ Erro ao enviar para N8N (Marketing):", error.message)
    return { success: false, error: error.message }
  }
}

// Função para enviar dados de parceria para a webhook do N8N
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

    console.log("📤 Enviando dados de parceria para N8N:", JSON.stringify(body, null, 2))

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
    
    console.log("✅ Resposta do N8N (Parceria):", result)
    return { success: true, data: result }

  } catch (error) {
    console.error("❌ Erro ao enviar parceria para N8N:", error.message)
    return { success: false, error: error.message }
  }
}

// Função para enviar alerta no canal de marketing
async function enviarAlertaCanal(nomeDemanda, detalhesDemanda, validacaoData, usuario, taskUrl = null) {
  try {
    const canalMarketing = client.channels.cache.get(process.env.CANAL_MARKETING)
    
    if (!canalMarketing) {
      console.error("❌ Canal de marketing não encontrado!")
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

    console.log(`📢 Alerta enviado no canal de marketing para a tarefa: "${nomeDemanda}"`)

  } catch (error) {
    console.error("❌ Erro ao enviar alerta no canal de marketing:", error.message)
  }
}

// Função para enviar notificação de parceria no canal específico
async function enviarNotificacaParceria(cardURL, dataEvento, usuario, nomeCard = null) {
  try {
    const canalParceria = client.channels.cache.get("1397497396606537738")
    
    if (!canalParceria) {
      console.error("❌ Canal de parceria não encontrado!")
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

    console.log(`📢 Notificação de parceria enviada para: "${nomeCard || 'Card não identificado'}"`)

  } catch (error) {
    console.error("❌ Erro ao enviar notificação de parceria:", error.message)
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

// Evento: Bot está pronto
client.once("ready", async () => {
  try {
    console.log(`✅ Bot 4.events Marketing online como ${client.user.tag}`)
    
    // Registra comandos do bot (global)
    await client.application.commands.set([
      cmdMarketing,
      cmdParceria,
      cmdPing,
      cmdHelp,
    ])
    
    console.log("✅ Comandos slash atualizados globalmente")
    
    client.user.setActivity("solicitações de marketing e parcerias", { type: "WATCHING" })
    
  } catch (error) {
    console.error(`❌ Erro na inicialização do bot: ${error.message}`)
  }
})

// Evento: Processar interações (comandos slash)
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return

  try {
    // Comando /marketing
    if (interaction.commandName === "marketing") {
      const nomeDemanda = interaction.options.getString("nome_demanda")
      const detalhesDemanda = interaction.options.getString("detalhes_demanda")
      const prazoInput = interaction.options.getString("prazo")
      
      // Valida os dados de entrada
      if (!nomeDemanda || nomeDemanda.trim().length === 0) {
        await interaction.reply({
          content: "❌ O nome da tarefa não pode estar vazio!",
          ephemeral: true,
        })
        return
      }

      if (!detalhesDemanda || detalhesDemanda.trim().length === 0) {
        await interaction.reply({
          content: "❌ Os detalhes da tarefa não podem estar vazios!",
          ephemeral: true,
        })
        return
      }

      // Valida a data do prazo
      const validacaoData = validarEFormatarData(prazoInput)
      if (!validacaoData.valido) {
        await interaction.reply({
          content: `❌ **Erro na data:** ${validacaoData.erro}`,
          ephemeral: true,
        })
        return
      }

      // Verifica se a data não é no passado para marketing
      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)
      
      if (validacaoData.dataObj < hoje) {
        await interaction.reply({
          content: "❌ **Erro na data:** A data não pode ser no passado",
          ephemeral: true,
        })
        return
      }

      // Resposta inicial
      await interaction.reply(`${obterEmoji("loading")} Criando solicitação de tarefa para o marketing...`)

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

      // Envia para o N8N
      const resultado = await enviarParaN8N(
        nomeDemanda.trim(),
        detalhesDemanda.trim(),
        dadosPrazo,
        usuario
      )

      if (resultado.success) {
        // Captura a URL da tarefa se disponível
        let taskUrl = null
        if (resultado.data) {
          // Se for um array, pega o primeiro elemento
          if (Array.isArray(resultado.data) && resultado.data.length > 0) {
            taskUrl = resultado.data[0].url || 
                      resultado.data[0].taskUrl || 
                      resultado.data[0].cardUrl
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
        console.log(`✅ Solicitação criada por ${usuario.displayName}: "${nomeDemanda}" - Prazo: ${validacaoData.dataFormatada}`)

      } else {
        // Erro - edita a resposta
        await interaction.editReply({
          content: `❌ **Erro ao criar solicitação**\n\`\`\`${resultado.error}\`\`\`\nTente novamente ou entre em contato com o suporte.`,
        })

        console.error(`❌ Falha ao criar solicitação para ${usuario.displayName}: ${resultado.error}`)
      }
    }

    // Comando /parceria
    else if (interaction.commandName === "parceria") {
      const urlDoCard = interaction.options.getString("url_do_card")
      const dataDoEvento = interaction.options.getString("data_do_evento")
      
      // Valida a URL
      const validacaoURL = validarURL(urlDoCard)
      if (!validacaoURL.valido) {
        await interaction.reply({
          content: `❌ **Erro na URL:** ${validacaoURL.erro}`,
          ephemeral: true,
        })
        return
      }

      // Valida a data do evento
      const validacaoData = validarEFormatarData(dataDoEvento)
      if (!validacaoData.valido) {
        await interaction.reply({
          content: `❌ **Erro na data:** ${validacaoData.erro}`,
          ephemeral: true,
        })
        return
      }

      // Resposta inicial
      await interaction.reply(`${obterEmoji("loading")} Registrando parceria comercial...`)

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

      // Envia para o N8N
      const resultado = await enviarParceriaParaN8N(
        validacaoURL.url,
        dadosEvento,
        usuario
      )

      if (resultado.success) {
        // Captura o nome do card se disponível
        let nomeCard = null
        if (resultado.data && Array.isArray(resultado.data) && resultado.data.length > 0) {
          nomeCard = resultado.data[0].name
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

        console.log(`✅ Parceria registrada por ${usuario.displayName}: "${nomeCard || 'Card não identificado'}" - Data: ${validacaoData.dataFormatada}`)

      } else {
        // Erro - edita a resposta
        await interaction.editReply({
          content: `❌ **Erro ao registrar parceria**\n\`\`\`${resultado.error}\`\`\`\nTente novamente ou entre em contato com o suporte.`,
        })

        console.error(`❌ Falha ao registrar parceria para ${usuario.displayName}: ${resultado.error}`)
      }
    }

    // Comando /ping
    else if (interaction.commandName === "ping") {
      const ping = Math.round(client.ws.ping)
      await interaction.reply({
        embeds: [{
          color: 0xff4f00,
          title: `${obterEmoji("pingpong")} Pong!`,
          description: "**Status de Conectividade do Bot**",
          fields: [
            {
              name: `${obterEmoji("server")} Latência`,
              value: `\`${ping}ms\``,
              inline: true,
            },
            {
              name: `${obterEmoji("relogio")} Tempo online`,
              value: `\`${Math.floor(process.uptime())}s\``,
              inline: true,
            },
            {
              name: `${obterEmoji("ligado")} Status`,
              value: "`Conectado`",
              inline: true,
            }
          ],
          footer: {
            text: "4.events Marketing Bot",
          },
          timestamp: new Date().toISOString(),
        }],
        ephemeral: true,
      })
    }

    // Comando /help
    else if (interaction.commandName === "help") {
      const embed = {
        color: 0xff4f00,
        title: `${obterEmoji("faq")} Central de ajuda`,
        description: "**Bot para criação de solicitações de tarefas de marketing e registro de parcerias**\n" +
                     "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        fields: [
          {
            name: "🔧 **COMANDOS DISPONÍVEIS**",
            value: "` `",
            inline: false,
          },
          {
            name: "📋 `/marketing`",
            value: "**Descrição:** Cria uma nova solicitação de tarefa de marketing\n" +
                   "**Parâmetros:**\n" +
                   "• `nome` - Título da tarefa *(máx: 100 caracteres)*\n" +
                   "• `detalhes` - Descrição detalhada *(máx: 1000 caracteres)*\n" +
                   "• `prazo` - Data limite no formato **DD/MM/AAAA**\n\n" +
                   "**Exemplo:** `/marketing nome:Campanha redes sociais detalhes:Criar posts para Instagram prazo:30/12/2025`",
            inline: false,
          },
          {
            name: "🤝 `/parceria`",
            value: "**Descrição:** Registra uma nova parceria comercial\n" +
                   "**Parâmetros:**\n" +
                   "• `url_do_card` - URL do card no sistema *(máx: 500 caracteres)*\n" +
                   "• `data_do_evento` - Data do evento no formato **DD/MM/AAAA**\n\n" +
                   "**Exemplo:** `/parceria url_do_card:https://app.pipe.run/... data_do_evento:15/08/2025`",
            inline: false,
          },
          {
            name: "🏓 `/ping`",
            value: "**Descrição:** Verifica a conectividade e latência do bot\n" +
                   "**Uso:** Digite `/ping` para testar a conexão",
            inline: false,
          },
          {
            name: "❓ `/help`",
            value: "**Descrição:** Exibe esta mensagem de ajuda\n" +
                   "**Uso:** Digite `/help` para ver todos os comandos",
            inline: false,
          },
          {
            name: "📅 **FORMATOS DE DATA ACEITOS**",
            value: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            inline: false,
          },
          {
            name: "✅ **Exemplos Válidos**",
            value: "• `25/12/2025` - Formato padrão\n" +
                   "• `5/3/25` - Dia e mês com 1 dígito, ano com 2\n" +
                   "• `15/3/25` - Dia com 2 dígitos, mês com 1\n" +
                   "• `5/03/2025` - Mês com zero à esquerda\n" +
                   "• `05/12/25` - Dia com zero à esquerda",
            inline: true,
          },
          {
            name: "❌ **Regras Importantes**",
            value: "• Marketing: Não aceita datas no passado\n" +
                   "• Parceria: Aceita datas passadas\n" +
                   "• Use apenas números e barras `/`\n" +
                   "• Anos de 2 dígitos assumem 20XX\n" +
                   "• Validação automática de datas",
            inline: true,
          },
          {
            name: "🔗 **RECURSOS ADICIONAIS**",
            value: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            inline: false,
          },
          {
            name: "⚡ **Funcionalidades**",
            value: "• Integração automática com sistema de tarefas\n" +
                   "• Link direto para tarefas/cards criados\n" +
                   "• Validação inteligente de dados e URLs\n" +
                   "• Confirmação visual com embed\n" +
                   "• Registro de quem solicitou/registrou\n" +
                   "• Alertas automáticos nos canais específicos",
            inline: false,
          }
        ],
        footer: {
          text: "Desenvolvido para 4.events • Use os comandos em qualquer canal do servidor",
        },
        timestamp: new Date().toISOString(),
      }

      await interaction.reply({
        embeds: [embed],
        ephemeral: true,
      })
    }

  } catch (error) {
    console.error(`❌ Erro ao processar comando ${interaction.commandName}:`, error.message)
    
    const errorMessage = "❌ Ocorreu um erro interno. Tente novamente ou contate o suporte."
    
    if (interaction.replied) {
      await interaction.editReply(errorMessage)
    } else {
      await interaction.reply({
        content: errorMessage,
        ephemeral: true,
      })
    }
  }
})

// Evento: Log de erros
client.on("error", (error) => {
  console.error("❌ Erro do cliente Discord:", error.message)
})

// Evento: Bot desconectado
client.on("disconnect", () => {
  console.log("⚠️ Bot desconectado do Discord")
})

// Evento: Bot reconectado
client.on("reconnecting", () => {
  console.log("🔄 Reconectando ao Discord...")
})

// Tratamento de erros não capturados
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", promise)
})

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error.message)
  process.exit(1)
})

// Encerramento por pedido de shutdown
process.on("SIGINT", () => {
  console.log("🛑 Recebido SIGINT. Encerrando bot...")
  client.destroy()
  process.exit(0)
})

process.on("SIGTERM", () => {
  console.log("🛑 Recebido SIGTERM. Encerrando bot...")
  client.destroy()
  process.exit(0)
})

// Conecta o bot ao Discord
client.login(process.env.BOT_TOKEN)