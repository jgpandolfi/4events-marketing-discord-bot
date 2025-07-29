# 4.events Marketing Bot 🧡

Bot do Discord do time de Marketinda 4.events
Auxilia no gerenciamento de solicitações de tarefas de marketing e acompanhametno de parcerias, de maneira integrada ao N8N.

## 📋 Sobre o Projeto

Bot desenvolvido para automatizar e facilitar os processo de solicitação de tarefas de marketing e de registro de novas parcerias no sistema, através de comandos slash no Discord, com integração direta ao sistema de automação N8N da 4.events.

## ✨ Funcionalidades

- **Comando `/marketing`**: Cria solicitações de tarefas com validação de dados
- **Comando `/parceria`**: Registra novas parcerias comerciais no sistema
- **Comando `/cro`**: Obtém dados de desempenho e estatísticas do site e landing pages da 4.events (via Microsoft Clarity)
- **Comando `/ping`**: Verifica conectividade e status do bot
- **Comando `/help`**: Exibe ajuda completa dos comandos
- **Validação inteligente de datas**: Aceita múltiplos formatos (DD/MM/AAAA, D/M/AA, etc.)
- **Integração com N8N**: Envio automático de dados via webhook
- **Integração com Microsoft Clarity**: Para obter dados de performance e desempenho do website e das landing pages
- **Resposta com link**: Sempre que possível retorna mensagens com URLs diretas para os sistemas integrados

## 🚀 Como Usar

### Solicitando uma Tarefa para o Time de Marketing
`/marketing nome:Campanha Instagram detalhes:Criar 5 posts para o feed prazo:30/12/2025`

### Registrando uma Nova Parceria
`/parceria url_do_card:https://app.pipe.run/cards/exemplo data_do_evento:15/06/2025`

### Obtendo Dados de Performance e Estatísticas (CRO)
`/cro data_desejada:28/07/2025 final_da_url_desejada:credenciamento`

### Verificando Status do Bot
`/ping`

### Obtendo Ajuda para Utilizar o Bot
`/help`

## 🎯 Resumo de Comandos Disponíveis e Como Usá-los

| Comando | Descrição | Parâmetros |
|---------|-----------|------------|
| `/marketing` | Cria tarefa de marketing | `nome`, `detalhes`, `prazo` |
| `/parceria` | Registra parceria comercial | `url_do_card`, `data_do_evento` |
| `/cro` | Dados de performance e estatísticas | `data_desejada` (opcional), `final_da_url_desejada` (opcional) |
| `/ping` | Verifica status do bot | Nenhum |
| `/help` | Exibe ajuda dos comandos | Nenhum |

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
   ```

4. **Inicie o bot**
   `npm start` ou `node src/index.js`

## 📁 Estrutura do Projeto
```
├── src/
│   ├── index.js      # Arquivo principal do bot
│   └── emojis.json   # Configuração de emojis personalizados
├── .env              # Variáveis de ambiente (não commitado)
├── package.json      # Dependências do projeto
└── README.md         # Este arquivo

```
## 🛠️ Tecnologias Utilizadas

- **Node.js** - Runtime JavaScript
- **Discord.js** - Biblioteca para interação com Discord API
- **N8N** - Automação de workflows
- **dotenv** - Gerenciamento de variáveis de ambiente

## 🔗 Links Úteis

- [Discord Developer Portal](https://discord.com/developers/applications)
- [Discord.js Documentation](https://discord.js.org/)
- [N8N Documentation](https://docs.n8n.io/)

## 👥 Desenvolvido para 4.events

Bot criado para otimizar o fluxo de trabalho da equipe de marketing da 4.events.

---

**Status**: ✅ Ativo e funcionando  
**Versão**: 1.0.0  
**Última atualização**: Julho 2025
