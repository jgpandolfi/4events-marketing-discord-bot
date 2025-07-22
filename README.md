# 4.events Marketing Bot

Bot do Discord para criação e gerenciamento de solicitações de tarefas de marketing integrado ao sistema N8N.

## 📋 Sobre o Projeto

Bot desenvolvido para automatizar o processo de solicitação de tarefas de marketing através de comandos slash no Discord, com integração direta ao sistema de automação N8N da 4.events.

## ✨ Funcionalidades

- **Comando `/marketing`**: Cria solicitações de tarefas com validação de dados
- **Comando `/ping`**: Verifica conectividade e status do bot
- **Comando `/help`**: Exibe ajuda completa dos comandos
- **Validação inteligente de datas**: Aceita múltiplos formatos (DD/MM/AAAA, D/M/AA, etc.)
- **Integração com N8N**: Envio automático via webhook
- **Resposta com link**: Retorna URL direta da tarefa criada

## 🚀 Como Usar

### Criando uma Tarefa
`/marketing nome:Campanha Instagram detalhes:Criar 5 posts para o feed prazo:30/12/2025`

### Verificando Status
`/ping`

### Obtendo Ajuda
`/help`

## ⚙️ Instalação

1. **Clone o repositório**
   `git clone <url-do-repositorio>`
   `cd 4events-marketing-bot`

2. **Instale as dependências**
   `npm install`

3. **Configure as variáveis de ambiente (dotenv)**
   ```
   BOT_TOKEN=seu_token_do_discord
   WEBHOOK=url_webhook
   ```

4. **Inicie o bot**
   `npm start`

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

## 📝 Formato de Dados Aceitos

- **Datas**: DD/MM/AAAA, D/M/AA, DD/M/AA, D/MM/AAAA
- **Nome da tarefa**: Até 100 caracteres
- **Detalhes**: Até 1000 caracteres

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
