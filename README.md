<h1 align="center">🟧 4.events Marketing Discord Bot</h1>

<p align="center">
  <img alt="José Guilherme Pandolfi" src="https://img.shields.io/badge/Dev-José%20Guilherme%20Pandolfi-8B3A8B?style=for-the-badge&color=blue">
  <img alt="User" src="https://img.shields.io/badge/User-4.events-FFD700?style=for-the-badge&color=orange">
  <img alt="Status" src="https://img.shields.io/badge/Status-Em%20Produção-28A745?style=for-the-badge">
</p>

<p align="center">
   Bot do Discord do time de Marketinda 4.events
   Auxilia no gerenciamento de solicitações de tarefas de marketing e acompanhametno de parcerias, de maneira integrada ao N8N. Além dessas funcionalidades principais, também foram implementadas funcionalidades para auxiliar em demais tarefas do dia a dia.
</p>

---

## 📋 Sobre o Projeto

Bot desenvolvido para automatizar e facilitar os processo de solicitação de tarefas de marketing e de registro de novas parcerias no sistema, através de comandos slash no Discord, com integração direta ao sistema de automação N8N da 4.events.

## ✨ Funcionalidades

- **Comando `/marketing`**: Cria solicitações de tarefas com validação de dados
- **Comando `/parceria`**: Registra novas parcerias comerciais no sistema
text
- **Comando `/leads`**: Exibe estatísticas e dados dos leads capturados pelas landing pages com relatórios detalhados
- **Comando `/cro`**: Obtém dados de desempenho e estatísticas do site e landing pages da 4.events (via Microsoft Clarity)
- **Comando `/midiakit`**: Acessa o mídia kit oficial da 4.events com logos, ícones e materiais audiovisuais
- **Comando `/apresentações`**: Acessa apresentações comerciais oficiais em PDF e editáveis online (uso interno)
- **Comando `/modelos`**: Acessa modelos de documentos e templates com branding da 4.events (uso interno)
- **Comando `/capa-linkedin`**: Acessa a capa oficial da 4.events para LinkedIn dos colaboradores
- **Comando `/fundo-escritorio`**: Acessa o papel de parede oficial da 4.events para área de trabalho
- **Comando `/capa-whatsapp`**: Gera capa de WhatsApp personalizada com logo do cliente (ideal para KAMs)
- **Comando `/botstatus`**: Exibe informações detalhadas de status, performance e saúde do bot com métricas completas
- **Comando `/ping`**: Verifica conectividade e status do bot
- **Comando `/help`**: Exibe ajuda completa dos comandos
- **Validação inteligente de datas**: Aceita múltiplos formatos (DD/MM/AAAA, D/M/AA, etc.)
- **Integração com N8N**: Envio automático de dados via webhook
- **Integração com Microsoft Clarity**: Para obter dados de performance e desempenho do website e das landing pages
- **API Fastify Integrada**: Servidor API completo para captura de eventos de marketing (pageviews, cliques, conversões)
- **Sistema de Cloudflare Inteligente**: Exposição pública da API Fastify apenas via URLs protegidas pelo Cloudflare (URL fixa ou URL temporária)
- **Banco MySQL e Relatórios Inteligentes**: Armazena dados de pageviews, cliques e conversões e gera relatórios inteligentes com cruzamento de dados
- **Resposta com link e/ou botão**: Sempre que possível retorna mensagens com URLs diretas e/ou botões para os sistemas integrados
- **Sistema de Logs Avançado com Winston**: Logging estruturado avançado com categorização, retenção automática, compressão automática e rotação diária para monitoramento e debugging
- **Robustez Avançada**: Resistência a falhas temporárias do N8N com backoff progressivo e sistema de retries
- **Discord Components V2**: O bot utiliza a mais recente tecnologia para criação de conteúdo e interfaces do Discord
- **Gerenciamento Remoto de Arquivos de Log**: Funcionalidades avançadas para gerenciamento dos arquivos de log do sistema de maneira remota (via Discord)

## 🚀 Como Usar

### Solicitando uma Tarefa para o Time de Marketing
`/marketing` → Preencha o formulário popup → Envie

### Registrando uma Nova Parceria  
`/parceria` → Preencha o formulário popup → Envie

### Obtendo Dados de Performance e Estatísticas (CRO)
`/cro data_desejada:28/07/2025 final_da_url_desejada:credenciamento`

### Acessando o Mídia Kit Oficial
`/midiakit`

### Acessando Apresentações Comerciais (Uso Interno)
`/apresentações`

### Acessando Modelos de Documentos (Uso Interno)
`/modelos`

### Acessando Capa para LinkedIn
`/capa-linkedin`

### Acessando Fundo de Escritório para Webcam
`/fundo-escritorio`

### Gerando Capa Personalizada para WhatsApp
`/capa-whatsapp logo:[anexar arquivo PNG/JPG]`

### Verificando Status Detalhado do Bot
`/botstatus`

### Verificando Status do Bot
`/ping`

### Obtendo Ajuda para Utilizar o Bot
`/help`

## 🎯 Resumo de Comandos Disponíveis e Como Usá-los

| Comando | Descrição | Parâmetros |
|---------|-----------|------------|
| `/marketing` | Cria tarefa de marketing | **Modal com formulário** |
| `/parceria` | Registra parceria comercial | **Modal com formulário** |
| `/leads` | Exibe dados e estatísticas de leads | `periodo` (opcional), `campanha` (opcional) |
| `/cro` | Dados de performance e estatísticas | `data_desejada` (opcional), `final_da_url_desejada` (opcional) |
| `/midiakit` | Acessa mídia kit oficial | Nenhum |
| `/apresentações` | Acessa apresentações comerciais | Nenhum |
| `/modelos` | Acessa modelos de documentos | Nenhum |
| `/capa-linkedin` | Acessa capa para LinkedIn | Nenhum |
| `/fundo-escritorio` | Acessa fundo para webcam | Nenhum |
| `/capa-whatsapp` | Gera capa personalizada para WhatsApp | `logo` (arquivo obrigatório) |
| `/botstatus` | Exibe status detalhado do bot | Nenhum |
| `/ping` | Verifica status do bot | Nenhum |
| `/help` | Exibe ajuda dos comandos | Nenhum |

## 🛡️ Sistema de Retry Automático (Backoff Progressivo)

O bot conta com um **sistema automático de retry**, para os comandos `/makerting`e `/parceria`, que garante maior confiabilidade ao enviar dados para o N8N:

### 🔄 **Como Funciona**
- **3 tentativas automáticas** para erros temporários (HTTP 500)
- **Backoff progressivo**: Delays inteligentes entre tentativas (1s → 1.5s → 2.25s)
- **Detecção do tipo de erro**: Distingue erros temporários de permanentes
- **Transparência**: Feedback claro para o usuário caso haja erros na operação

## 🔗 Endpoints da API

### Eventos de Landing Pages

| Endpoint | Método | Descrição |
|----------|---------|-----------|
| `/api/events/pageview` | POST | Registra visualização de página |
| `/api/events/click-cta-mlg` | POST | Registra clique no CTA |
| `/api/events/submit-form-mlg` | POST | Registra envio de formulário |
| `/api/reports/events-by-email` | GET | Consulta eventos por email |
| `/health` | GET | Health check da API |

## 🔥 Sistema de Cloudflare Inteligente

O bot implementa um sistema avançado de tunneling para uso do Cloudflare para proteção da API:

- **API disponível via URL/DNS em vez de IP**: Conexão a API facilitada através de URL/DNS em vez de IPs dinâmicos
- **URL Fixa Prioritária**: Verifica automaticamente se a URL fixa principal (domínio fixo) está funcional
- **Tunnel Temporário**: Cria tunnel Cloudflare temporário (URL temporária) caso a URL fixa não esteja disponível  
- **Monitoramento Contínuo**: Verifica periodicamente o status da URL fixa (padrão: 30min)
- **Fallback Automático**: Alterna entre URL fixa e tunnel temporário conforme necessário
- **Proteção 100%**: Exposição pública da API apenas via URLs protegidas pelo Cloudflare, com sistemas Anti-DDoS e de proteção contra acessos maliciosos.


## 🏛️ Arquitetura do Projeto

### Representação Gráfica
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   DISCORD BOT   │    │   FASTIFY API   │    │   EXTERNAL APIs │
│                 │    │  (CLOUDFLARED)  │    │                 │
│ • /marketing    │◄──►│ • Rate Limiting │◄──►│ • Microsoft     │
│ • /parceria     │    │ • CORS & Helmet │    │   Clarity       │
│ • /leads        │    │ • JSON Schemas  │    │ • N8N Webhooks  │
│ • /cro          │    │ • Health Check  │    │ • Pipe.run      │
│ • /help         │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌──────────────────┐
                    │  MySQL DATABASE  │
                    │ 4events_marketing│
                    │                  │
                    │  pageview_events │──── • session_id
                    │                  │     • page_url
                    │                  │     • user_ip
                    │                  │     • timestamp
                    │                  │
                    │ click_cta_events │──── • lead_email
                    │                  │     • lead_cidade
                    │                  │     • campaign
                    │                  │     • source/medium
                    │                  │
                    │submit_form_events│──── • lead_dados
                    │                  │     • conversões
                    │                  │     • landing_page
                    │                  │     • tracking_utm
                    └──────────────────┘
                               │
                    ┌──────────────────┐
                    │   WINSTON LOGS   │
                    │                  │
                    │ • Daily Rotate   │
                    │ • Commands Log   │
                    │ • Error Log      │
                    │ • Exceptions     │
                    └──────────────────┘
```

## ⚙️ Instalação (Devs 👨‍💻)

1. **Clone o repositório**
   `git clone <url-do-repositorio>`
   `cd 4events-marketing-bot`

2. **Instale as dependências**
   `npm install`

3. **Configure as variáveis de ambiente (dotenv)**
```
   # Discord
   BOT_TOKEN=seu_token_do_discord
   WEBHOOK=url_webhook

   # N8N Endpoints
   WEBHOOK=url_da_webhook_endpoint_para_comando_/marketing
   WEBHOOK_PARCERIA=url_da_webhook_endpoint_para_comando_/parceria

   # SendPulse API Credenciais
   SENDPULSE_CLIENT_ID=client_id
   SENDPULSE_CLIENT_SECRET=client_secret

   # IDs dos usuários do Discord Administradores do bot
   BOT_ADMIN_DISCORD_USERS_ID=999999999999999,99999999999999999

   # Fastify API
   API_PORT=3000
   API_HOST=0.0.0.0

   # Banco de dados MySQL
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=4events_user
   DB_PASSWORD=senha_segura_aqui
   DB_NAME=4events_marketing

   # Cloudflare Tunnel
   CLOUDFLARE_TUNNEL_TOKEN=eyJ...SEU_TOKEN_COMPLETO_AQUI
   NODE_ENV=production
   TUNNEL_ENABLED=true
   URL_FIXA_DOMINIO=https://SEU_DOMINIO_FIXO_COM_CLOUDFLARE.com.br

   # Configurações de Logging (Winston)
   LOG_LEVEL=info
   NODE_ENV=production
```

4. **Inicie o bot**
   `npm start` ou `node src/index.js`

## 📁 Estrutura do Projeto
```
├── logs/ (não comitado)
│   ├── 4events-bot-YYYY-MM-DD.log            # Logs gerais
│   ├── 4events-bot-commands-YYYY-MM-DD.log   # Logs de comandos
│   ├── 4events-bot-error-YYYY-MM-DD.log      # Logs de erros
│   ├── 4events-bot-exceptions-YYYY-MM-DD.log # Logs de exceções
│   └── 4events-bot-rejections-YYYY-MM-DD.log # Logs de promises rejeitadas
├── src/
│   ├── index.js                 # Arquivo principal do bot
│   ├── api.js                   # Servidor API Fastify
│   ├── database.js              # Gerenciamento do banco MySQL
│   ├── logger.js                # Sistema de logging com Winston
│   ├── tunnel.js                # Cloudflare Tunnel
│   ├── validators.js            # Schemas de validação para API
│   └── emojis.json              # Emojis personalizados
├── .env                         # Variáveis de ambiente (não commitado)
├── .env.example                 # Exemplo de configuração
├── setup-database.sql           # Script de configuração do MySQL (não commitado)
├── setup-database.sql.example   # Exemplo de script de configuração do MySQL
├── CHANGELOG.md                 # Histórico de versões
├── package.json                 # Dependências do projeto
└── README.md                    # Esta documentação
```
## 🛠️ Tecnologias Utilizadas

- **Node.js** - Runtime JavaScript
- **Discord.js v14** - Biblioteca para interação com Discord API
- **Fastify** - Framework web rápido para APIs Node.js
- **Cloudflared** - Cliente oficial para Cloudflare Tunnel
- **MySQL2** - Driver MySQL para Node.js
- **@fastify/cors** - CORS para Fastify
- **@fastify/helmet** - Segurança para Fastify
- **@fastify/rate-limit** - Rate limiting para APIs
- **N8N** - Automação de workflows
- **Microsoft Clarity Data Export API** - Obtenção de dados e estatísticas de CRO
- **Winston + Winston Daily Rotate File** - Sistema de logging estruturado com rotação diária de arquivos
- **dotenv** - Gerenciamento de variáveis de ambiente

## 🔗 Links Úteis

- [Discord Developer Portal](https://discord.com/developers/applications)
- [Discord.js Documentation](https://discord.js.org/)
- [N8N Documentation](https://docs.n8n.io/)

## 📄 Licença

Este projeto está sob a licença MIT.

---

**Status**: ✅ Ativo e funcionando<br>
**Versão**: 1.0.15<br>
**Última atualização**: Setembro 2025<br>

<p align="center">
  <strong>Desenvolvido com 🧡 para 4.events</strong><br>
</p>

<p align="center">
  <img alt="GitHub last commit" src="https://img.shields.io/github/last-commit/jgpandolfi/4events-marketing-discord-bot?style=flat-square">
  <img alt="GitHub code size" src="https://img.shields.io/github/languages/code-size/jgpandolfi/4events-marketing-discord-bot?style=flat-square">
  <img alt="GitHub top language" src="https://img.shields.io/github/languages/top/jgpandolfi/4events-marketing-discord-bot?style=flat-square">
</p>

