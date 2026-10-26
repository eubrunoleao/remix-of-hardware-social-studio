# Rede social de hardware — plano em etapas

O documento descreve um produto grande. Proposta: entregar em etapas funcionais, cada uma testável, começando por uma base real (contas, banco de dados, feed).

## Etapa 1 — Base e visual (esta entrega)
- Identidade visual escura (preto-azulado, azul elétrico, roxo, lavanda) com os tokens do documento.
- Layout de três colunas no desktop (22% / 56% / 22%), laterais recolhíveis no tablet, abas inferiores no celular.
- Ativar Lovable Cloud: cadastro, login, sessão.
- Perfil do usuário + "Minha máquina" (setup com componentes do catálogo).
- Catálogo inicial: categorias, fabricantes e modelos de demonstração (marcados como fictícios/não verificados).
- Feed: criar publicação (texto, categoria, equipamentos vinculados, hashtags normalizadas, marcar como avaliação), curtir, comentar, salvar, paginação incremental, estados vazio/carregando/erro.
- Página de hashtag e página de equipamento com posts relacionados.

## Etapa 2 — Social
- Seguir pessoas e canais/comunidades, silenciar.
- Mensagens privadas com controle de acesso por conversa, bloquear, limitar desconhecidos.
- Ordenações: Para você, Seguindo, Recentes, Mais úteis.

## Etapa 3 — Mídia, moderação e privacidade
- Upload de imagens com limite de tipo/tamanho.
- Denúncias, papéis de administrador, painel de moderação, auditoria.
- Configurações de privacidade, exportação e exclusão de dados.

## Etapa 4 — IA e QA
- Assistente de IA no servidor (sugestão de tags, resumo de avaliações), funcionando mesmo se indisponível.
- Auditoria de QA do documento: responsividade 320–1440px, segurança, testes das regras.

## Detalhes técnicos
- Stack existente (TanStack Start + Lovable Cloud); regras de acesso por linha em todas as tabelas.
- Entidades conforme o documento, introduzidas por etapa; catálogo administrável sem mudar código.
- Validação no servidor, limites de hashtags/tamanho, proteção contra envio duplicado.
- Botões não implementados aparecem como "Em breve", nunca sem ação.
