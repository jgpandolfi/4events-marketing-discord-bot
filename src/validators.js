// Schemas no formato JSON Schema (compatível com Fastify/Ajv)
export const pageviewSchema = {
  type: 'object',
  properties: {
    session_id: { 
      type: 'string', 
      maxLength: 255,
      description: 'ID da sessão'
    },
    user_ip: { 
      type: 'string', 
      format: 'ipv4',
      description: 'IP do usuário'
    },
    user_agent: { 
      type: 'string', 
      maxLength: 1000,
      description: 'User Agent'
    },
    page_url: { 
      type: 'string', 
      format: 'uri',
      description: 'URL da página visitada'
    },
    referrer: { 
      type: 'string', 
      format: 'uri',
      description: 'URL de referência'
    },
    timestamp: { 
      type: 'string', 
      format: 'date-time',
      description: 'Timestamp do evento'
    }
  },
  required: ['session_id', 'page_url'],
  additionalProperties: false
}

export const clickCtaSchema = {
  type: 'object',
  properties: {
    session_id: { 
      type: 'string', 
      maxLength: 255,
      description: 'ID da sessão'
    },
    lead_empresa: { 
      type: 'string', 
      maxLength: 255,
      description: 'Nome da empresa do lead'
    },
    lead_nome: { 
      type: 'string', 
      maxLength: 255,
      description: 'Nome do lead'
    },
    lead_email: { 
      type: 'string', 
      format: 'email',
      maxLength: 255,
      description: 'Email do lead'
    },
    lead_telefone: { 
      type: 'string', 
      maxLength: 50,
      description: 'Telefone do lead'
    },
    lead_estado: { 
      type: 'string', 
      maxLength: 100,
      description: 'Estado do lead'
    },
    lead_cidade: { 
      type: 'string', 
      maxLength: 255,
      description: 'Cidade do lead'
    },
    source: { 
      type: 'string', 
      maxLength: 100,
      description: 'Fonte do tráfego'
    },
    medium: { 
      type: 'string', 
      maxLength: 100,
      description: 'Meio do tráfego'
    },
    campaign: { 
      type: 'string', 
      maxLength: 255,
      description: 'Campanha'
    },
    term: { 
      type: 'string', 
      maxLength: 255,
      description: 'Termo da campanha'
    },
    content: { 
      type: 'string', 
      maxLength: 255,
      description: 'Conteúdo da campanha'
    },
    landing_page: { 
      type: 'string', 
      format: 'uri',
      description: 'URL da landing page'
    },
    timestamp: { 
      type: 'string', 
      format: 'date-time',
      description: 'Timestamp do evento'
    }
  },
  required: ['session_id'],
  additionalProperties: false
}

export const submitFormSchema = {
  type: 'object',
  properties: {
    session_id: { 
      type: 'string', 
      maxLength: 255,
      description: 'ID da sessão'
    },
    lead_empresa: { 
      type: 'string', 
      maxLength: 255,
      description: 'Nome da empresa do lead'
    },
    lead_nome: { 
      type: 'string', 
      maxLength: 255,
      description: 'Nome do lead'
    },
    lead_email: { 
      type: 'string', 
      format: 'email',
      maxLength: 255,
      description: 'Email do lead'
    },
    lead_telefone: { 
      type: 'string', 
      maxLength: 50,
      description: 'Telefone do lead'
    },
    lead_estado: { 
      type: 'string', 
      maxLength: 100,
      description: 'Estado do lead'
    },
    lead_cidade: { 
      type: 'string', 
      maxLength: 255,
      description: 'Cidade do lead'
    },
    source: { 
      type: 'string', 
      maxLength: 100,
      description: 'Fonte do tráfego'
    },
    medium: { 
      type: 'string', 
      maxLength: 100,
      description: 'Meio do tráfego'
    },
    campaign: { 
      type: 'string', 
      maxLength: 255,
      description: 'Campanha'
    },
    term: { 
      type: 'string', 
      maxLength: 255,
      description: 'Termo da campanha'
    },
    content: { 
      type: 'string', 
      maxLength: 255,
      description: 'Conteúdo da campanha'
    },
    landing_page: { 
      type: 'string', 
      format: 'uri',
      description: 'URL da landing page'
    },
    timestamp: { 
      type: 'string', 
      format: 'date-time',
      description: 'Timestamp do evento'
    }
  },
  required: ['session_id'],
  additionalProperties: false
}

export const emailQuerySchema = {
  type: 'object',
  properties: {
    email: { 
      type: 'string', 
      format: 'email',
      description: 'Email para consulta'
    },
    start_date: { 
      type: 'string', 
      format: 'date',
      description: 'Data inicial'
    },
    end_date: { 
      type: 'string', 
      format: 'date',
      description: 'Data final'
    }
  },
  required: ['email'],
  additionalProperties: false
}