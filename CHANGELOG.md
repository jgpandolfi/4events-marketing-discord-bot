# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Não Publicado]
### Em Desenvolvimento
- Funcionalidades futuras serão listadas aqui

## [1.0.10] - 2025-08-30

### ✨ Adicionado
- **Interface Moderna com Components V2**: Migração completa de respostas embeds antigas para os novos Components V2 do Discord.js
  - **ContainerBuilder**: Implementação de containers estruturados para organização visual aprimorada
  - **TextDisplayBuilder**: Componentes de texto mais flexíveis e bem formatados
  - **SeparatorBuilder**: Separadores visuais com espaçamento configurável para melhor organização
  - **SectionBuilder**: Seções organizadas para conteúdo estruturado
  - **Cores personalizadas**: Aplicação da cor laranja oficial da 4.events (0xff4f00) em todos os containers

### 🔧 Modificado
- **Interface Completa de Todos os Comandos**: Substituição das antigas embeds por Components V2
  - **Comando `/midiakit`**: Layout estruturado com seções bem definidas para cada categoria de material
  - **Comando `/apresentações`**: Interface limpa com avisos destacados sobre uso interno
  - **Comando `/modelos`**: Apresentação organizada com separadores e avisos de confidencialidade
  - **Comando `/help`**: Sistema de ajuda completamente redesenhado com navegação por containers
  - **Comando `/ping`**: Resposta simples em container moderno
  - **Sistema de Logs**: Interface administrativa renovada com containers para melhor visualização dos logs

- **Sistema de Ajuda Interativo**: Reformulação completa do comando `/help`
  - **Navegação por containers**: Menu principal com select dropdown para categorias
  - **Botão "Voltar"**: Implementação de botões para navegação fluida entre seções
  - **Documentação estruturada**: Cada comando possui sua própria seção detalhada
  - **Organização visual**: Separadores e cores para melhor experiência de leitura

- **Comando Oculto de Logs Administrativo**: Modernização da interface de logs para administradores
  - **Containers organizados**: Visualização estruturada dos logs por categoria
  - **Select menu interativo**: Navegação entre diferentes tipos de logs
  - **Apresentação melhorada**: Formatação mais clara dos dados de log

### 📚 Técnico
- **Discord.js Components V2**: Implementação completa dos novos componentes de interface
- **MessageFlags.IsComponentsV2**: Aplicação da nova flag para compatibilidade com Components V2
- **Código Limpo**: Refatoração para uso consistente dos novos builders de componentes

## [1.0.9] - 2025-08-28

### ✨ Adicionado
- **Sistema de Logging Avançado com Winston**: Implementado sistema completo de logs estruturados
  - **Logs rotativos diários**: Arquivos de log organizados por data com rotação automática
  - **Categorização por tipo**: Logs separados para comandos, erros, exceções e rejeições
  - **Níveis de log configuráveis**: Suporte a diferentes níveis (info, warn, error, debug)
  - **Formato JSON estruturado**: Logs em formato JSON para melhor análise e filtragem
  - **Sanitização automática**: Remoção automática de dados sensíveis (tokens, senhas)
  - **Retenção inteligente**: Arquivos compactados automaticamente com política de retenção
  - **Logging de performance**: Métricas detalhadas de operações e tempos de resposta

- **Comando de Logs via Menção**: Sistema oculto para administradores acessarem logs do sistema
  - **Acesso restrito**: Apenas usuários autorizados podem consultar logs pelo Discord
  - **Interface interativa**: Botões para navegar entre diferentes tipos de logs

### 🔧 Modificado
- **Sistema de Logging Avançado e Global**: Substituído sistema básico por Winston com configuração profissional seguindo boas práticas do desenvolvimento moderno
  - Logs estruturados em JSON com metadados completos
  - Separação de transports por tipo e criticidade de log
  - Configuração de retenção e compactação automática
- **Tratamento de Erros**: Aprimorado para capturar exceções não tratadas e promises rejeitadas
- **Logs de Comandos**: Implementado tracking detalhado de todas as interações dos usuários
- **Variáveis de Ambiente**: Adicionada validação obrigatória para `BOT_ADMIN_DISCORD_USERS_ID`, variável para acesso a comandos restritos apenas a administradores

### 📚 Técnico
- **Winston Logger**: Configuração completa com múltiplos transports e formatação personalizada
- **Daily Rotate File**: Implementação de rotação diária de arquivos de log
- **Structured Logging**: Logs estruturados com metadados consistentes para análise
- **Error Handling**: Captura abrangente de erros não tratados em nível de processo

## [1.0.8] - 2025-08-16

### ✨ Adicionado
- **Sistema de Modals para Comandos Principais**: Implementados formulários popup (modals) para os comandos `/marketing` e `/parceria`
  - **Interface mais intuitiva**: Usuários preenchem formulários estruturados em vez de parâmetros diretos
  - **Campos de texto multilinha**: Suporte a descrições mais detalhadas com `TextInputStyle.Paragraph`
  - **Validação visual aprimorada**: Placeholders explicativos e organização melhor dos campos

### 🔧 Modificado
- **Comando `/marketing`**: Removidos parâmetros diretos, implementado modal com 3 campos estruturados
  - Campo "Nome/Título da Tarefa" com limite de 100 caracteres
  - Campo "Detalhes e Descrição" em formato de parágrafo com limite de 1000 caracteres  
  - Campo "Data Limite" com formato DD/MM/AAAA e placeholder explicativo
- **Comando `/parceria`**: Removidos parâmetros diretos, implementado modal com 2 campos estruturados
  - Campo "URL do Card no Sistema" com limite de 500 caracteres
  - Campo "Data do Evento" com formato DD/MM/AAAA e placeholder explicativo
- **Comando `/help`**: Atualizado para documentar o novo fluxo de uso dos comandos com modals
- **Event Handler**: Reestruturado o evento `interactionCreate` para processar modals antes de comandos
- **Imports Discord.js**: Adicionados imports necessários para modals (`ModalBuilder`, `TextInputBuilder`, `TextInputStyle`, `ActionRowBuilder`)

## [1.0.7] - 2025-08-16

### 🔧 Modificado
- **Migração para MessageFlags**: Atualizada a implementação de mensagens ephemeral para usar a nova API `MessageFlags.Ephemeral`
  - Substituída a propriedade `ephemeral: true` pela nova implementação `flags: MessageFlags.Ephemeral`
  - Consistência com as APIs mais recentes do Discord.js v14

- **Comando slash /ping**: Passa a ter uma resposta de visibilidade pública (não ephemeral)

### 📚 Técnico
- **Discord.js API**: Alinhamento com as melhores práticas e recomendações da versão 14.x do Discord.js
- **Compatibilidade**: Preparação para futuras atualizações da biblioteca Discord.js

## [1.0.6] - 2025-08-16

### ✨ Adicionado
- **Comando `/capa-linkedin`**: Novo comando para disponibilizar a imagem de capa do time 4.events para perfil do LinkedIn dos colaboradores
  
- **Comando `/fundo-escritorio`**: Novo comando para disponibilizar a imagem oficial de fundo do escritório para webcam em reuniões, ideal para home office

### 🔧 Modificado
- **Comando `/help`**: Atualizado para incluir documentação completa dos dois novos comandos
  - Adicionadas instruções de uso para `/capa-linkedin` e `/fundo-escritorio`
  - Incluídas descrições das funcionalidades de cada comando

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
