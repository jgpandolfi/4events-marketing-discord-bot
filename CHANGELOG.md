# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Não Publicado]
### Em Desenvolvimento
- Funcionalidades futuras serão listadas aqui

## [1.0.3] - 2025-07-29

### ✨ Adicionado
- **Comando `/cro`**: Integração com Microsoft Clarity para obter dados e estatísticas de performance do site e landing pages da 4.events.
  - Parâmetros opcionais para consulta por data e filtro por final da URL.
  - Exibição formatada em embed dentro do Discord.
  - Ranking dos top 5 sistemas operacionais com sessões ordenadas decrescentemente.

### 🔧 Modificado
- Atualização da documentação interna e do comando `/help` para incluir o novo comando `/cro` e suas funcionalidades.

## [1.0.2] - 2025-07-24

### ✨ Adicionado
- **Comando `/parceria`**: Novo comando para registro de parcerias comerciais com notificação (aviso) no canal de parcerias
  - Parâmetros: `url_do_card` (URL do card no sistema) e `data_do_evento` (data do evento)
  - Validação inteligente de URLs para domínios Pipe.run e 4.works e validação de datas (aceita eventos passados, diferente do comando marketing)

  ### 🔧 Modificado
- **Comando `/help`**: Atualizado para incluir documentação completa do novo comando `/parceria`
- **Estrutura de Webhooks**: Separação de webhooks para diferentes tipos de solicitação
  - `WEBHOOK_URL` para tarefas de marketing
  - `WEBHOOK_URL_PARCERIA` para registro de parcerias
- **Validação de Datas**: Aprimorada a função de validação de datas para suportar diferentes contextos
  - Marketing: não aceita datas no passado
  - Parceria: aceita datas passadas (eventos já realizados)


## [1.0.1] - 2025-07-22

### ✨ Adicionado
- **Sistema de Alertas Automáticos**: Implementado sistema de notificações automáticas no canal de marketing
  - Mensagens de alerta (com menção) são enviadas automaticamente ao canal de marketing após registro bem-sucedido de demanda

### 🔧 Modificado
- **Comando `/help`**: Atualizado para incluir informação sobre alerta automático nas funcionalidades

## [1.0.0] - 2025-07-22

### 🎉 Lançamento Inicial
- **Bot de Discord Funcional**: Primeira versão estável do 4.events Marketing Bot que registra demandas no 4.works através do N8N.

## 🔗 Links

- [Repositório GitHub](https://github.com/jgpandolfi/4events-marketing-discord-bot)
- [Discord Developer Portal](https://discord.com/developers/applications)
- [Documentação N8N](https://docs.n8n.io/)

---

*Este projeto segue [Conventional Commits](https://conventionalcommits.org/) para mensagens de commit padronizadas.*
