# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Não Publicado]
### Em Desenvolvimento
- Funcionalidades futuras serão listadas aqui

## [1.0.5] - 2025-08-15

### ✨ Adicionado
- **Comando `/midiakit`**: Novo comando para acesso ao mídia kit oficial da 4.events
  - **Acesso direto aos materiais visuais e audiovisuais** oficiais da empresa
  - **Resposta pública** para facilitar compartilhamento entre equipes

- **Comando `/apresentações`**: Novo comando para acesso às apresentações comerciais da 4.events
  - **Apresentações comerciais em PDF e editáveis** (Google Slides, PowerPoint)
  - **Aviso de uso interno exclusivo** para segurança dos materiais

- **Comando `/modelos`**: Novo comando para acesso aos modelos de documentos com branding da 4.events
  - **Templates de documentos timbrados** oficiais da empresa
  - **Templates para relatórios** e apresentações padronizadas
  - **Documentos com identidade visual** consistente
  - **Proteção de uso interno** com avisos de confidencialidade

### 🔧 Modificado
- **Comando `/help`**: Atualizado para incluir documentação completa dos três novos comandos
  - Adicionadas instruções de uso para `/midiakit`, `/apresentações` e `/modelos`
  - Incluídos avisos sobre uso interno para comandos com materiais confidenciais

## [1.0.4] - 2025-07-29

### ✨ Adicionado
- **Sistema de Retry Automático**: Implementado sistema inteligente de retry para comandos `/marketing` e `/parceria`
  - **3 tentativas automáticas** para erros HTTP 500 e erros temporários de servidor
  - **Backoff progressivo** com multiplicador de 1.5x (1s → 1.5s → 2.25s)
  - **Detecção inteligente de erros**: Distingue entre erros temporários (que justificam retry) e erros permanentes
  - **Configuração flexível** através do objeto `RETRY_CONFIG` para fácil ajuste de parâmetros
  - **Primeira tentativa silenciosa**: Usuários não percebem o sistema de retry quando tudo funciona normalmente
  - **Feedback visual progressivo**: A partir da segunda tentativa, usuários recebem informações claras sobre o status
  - **Mensagens contextuais**: Explicações específicas sobre instabilidades temporárias vs erros permanentes
  - **Sugestões de ação**: Orientações claras quando todas as tentativas falham

### 🔧 Modificado
- **Funções de Envio**: Refatoradas `enviarParaN8N` e `enviarParceriaParaN8N` para trabalhar com o sistema de retry
- **Processamento de Comandos**: Comandos `/marketing` e `/parceria` agora utilizam `executarComRetryComFeedback`
- **Configuração Centralizada**: Parâmetros de retry centralizados em `RETRY_CONFIG` para fácil manutenção
- **Comando `/help`**: Atualizado para incluir informação sobre o sistema de retry automático

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
