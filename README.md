# cmo. — agente de inbound B2B

MVP local para empresas B2B sem equipe de marketing. O cliente define uma missão, confirma o contexto da empresa, conversa com o agente, revisa entregas e acompanha sinais para a próxima decisão. O site é uma fonte de contexto e um possível canal de publicação.

## Rodar localmente

Requer Node.js 22+ e npm.

```bash
npm install
cp .env.example .env.local
# Preencha LLM_API_KEY, APP_SECRET e CRON_SECRET em .env.local
npm run dev
```

Abra `http://localhost:3740` para ver a página de venda. O produto e o onboarding ficam em `http://localhost:3740/app`. `APP_SECRET` e `CRON_SECRET` devem ser valores aleatórios longos. O projeto aceita o endpoint oficial do DeepSeek ou um gateway compatível via `LLM_BASE_URL` e `LLM_MODEL`.

Para executar o ciclo recorrente em outro processo:

```bash
npm run worker
```

O worker chama `/api/cron` ao iniciar e a cada seis horas. `npm start` inicia o servidor de produção e um worker no mesmo serviço. Use uma única réplica. A base SQLite fica em `data/` localmente; em Railway, use um volume persistente e o app grava em `RAILWAY_VOLUME_MOUNT_PATH/ai-cmo.sqlite`. Sem volume, o banco é perdido em novos deploys. O app não é adequado a funções efêmeras sem adaptar o banco e o worker.

O arquivo `railway.json` prepara build, healthcheck e uma réplica. Para uma implantação pública, crie um projeto **separado** no Railway e associe um volume ao serviço. O projeto Railway atualmente associado ao diretório é `kodus-beacon`, portanto nunca rode `railway up` daqui sem passar IDs explícitos de um novo projeto e ambiente. Configure `APP_SECRET`, `CRON_SECRET`, `LLM_API_KEY` e `GITHUB_SITE_TOKEN` no novo serviço. O token deve ter permissão Contents de escrita somente nos repositórios de clientes autorizados.

## Fluxo do produto

1. Entrada: o visitante informa o domínio e vê uma leitura básica da página inicial antes de criar a conta. O endereço segue preenchido na análise completa. Se ainda não tiver site, informa nome e uma frase sobre a empresa. A modalidade de operação fica fora do onboarding.
2. Descoberta e plano: o agente lê a página inicial e até três páginas internas relevantes, extrai o perfil da empresa com evidências e perguntas em aberto, faz uma auditoria básica verificável da página inicial (título, descrição, H1, canonical e robots) e monta diagnóstico e prioridades com DeepSeek. O cliente confere ou corrige o perfil dentro do produto. Alternativas não citadas no site aparecem apenas como hipóteses.
3. Execução: o agente cria rascunhos de páginas, artigos e posts. O cliente pode pedir ajustes, aprovar e publicar. Revisões rejeitadas voltam à fila com o feedback. Itens de pesquisa SEO/GEO geram relatório com evidências e ação verificável; alterações técnicas que o conector não suporta ficam sinalizadas como pendentes.
4. Implantação e distribuição: a equipe prepara um repositório Git por cliente, registra as URLs de prévia e domínio e acompanha diagnóstico, construção, revisão e operação em **Seu site**. O repositório deve conter `ai-cmo.json` e consumir Markdown em `content/blog` e `content/pages` (ou na pasta configurada). Após a revisão e entrada em operação, o agente cria commits de páginas e artigos no Git. O deploy do site é configurado separadamente; o produto registra o commit e não afirma que a página já está no ar. Posts são agendados no LinkedIn via Post Bridge.
5. Medição: Search Console e GA4 via OAuth acompanham o site do cliente. Semrush fornece estimativas se houver chave; DataForSEO verifica uma amostra de menções e citações no ChatGPT. A área pública interna antiga ainda registra suas próprias visitas e contatos.
6. Loop: o ciclo periódico envia itens aprovados ao Git, revisa e envia rascunhos no modo automático quando o repositório está configurado, atualiza dados, produz uma revisão semanal, revisa o plano a cada 30 dias e prepara novas pautas.

No modo `managed`, e-mails em `OPERATOR_EMAILS` conseguem abrir os espaços desse plano. O produto ainda não inclui cobrança, convites de equipe ou permissões granulares.

## Site em Git e conexões opcionais

- **GitHub:** `GITHUB_SITE_TOKEN` no servidor, com permissão Contents de escrita. Em **Seu site**, um operador em `OPERATOR_EMAILS` configura `owner/repo`, branch, pasta de conteúdo, URL de prévia e domínio. A validação exige `ai-cmo.json` na raiz, por exemplo `{ "version": 1, "contentRoot": "content" }`. O site precisa renderizar os arquivos Markdown e ter deploy ligado à branch configurada. O produto não cria o repositório nem migra o domínio automaticamente.
- **LinkedIn:** chave Post Bridge da própria empresa e perfil conectado. A aplicação agenda após aprovação manual ou revisão automática e registra o item como agendado; ainda não consulta o status final da publicação.
- **Google:** configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_REDIRECT_URI`. Cadastre exatamente a URI de retorno no cliente OAuth e habilite Search Console API, Analytics Admin API e Analytics Data API. Depois selecione o site e a propriedade GA4 na interface.
- **Semrush:** `SEMRUSH_API_KEY` para estimativas de domínio. Não são visitas medidas no site.
- **ChatGPT:** `DATAFORSEO_LOGIN` e `DATAFORSEO_PASSWORD` para executar perguntas de compra acompanhadas. Isso é uma amostra de respostas, não uma contagem de todas as recomendações do ChatGPT.

As credenciais de conexões são criptografadas com `APP_SECRET` antes de ir ao SQLite. Nunca altere esse segredo em uma instalação existente sem migrar as credenciais.

## Verificação

```bash
npm run typecheck
npm run build
python3 scripts/qa-git-site.py
```

O desenvolvimento foi validado com uma empresa fictícia: cadastro, criação de empresa, plano gerado pelo DeepSeek, artigo, rejeição com feedback, nova versão e conversa. Publicação externa e métricas dependem de contas conectadas e não devem ser testadas em canais reais sem uma empresa piloto.

O QA usa um GitHub simulado em `127.0.0.1`: verifica a configuração do repositório, o bloqueio antes da entrada em operação e a criação de um commit após a revisão. Para validar um cliente real, ainda é preciso testar o repositório, o deploy e a página publicada no domínio.

## Limites atuais

- A auditoria cobre a página inicial e elementos básicos de HTML; não substitui um crawler completo.
- A implantação do site existente ainda é um serviço manual. O app acompanha etapas e cria commits em um repositório configurado; domínio, deploy, redirecionamentos e QA visual precisam ser executados pela equipe. A área pública antiga sob `/sites/<empresa>` continua acessível para links já existentes, sem receber novas publicações.
- Tarefas de SEO/GEO que exigem alterações técnicas além de criar arquivos de conteúdo recebem uma pesquisa e permanecem como ação técnica pendente. O agente ainda não edita componentes nem páginas existentes.
- Uma falha entre o commit e o registro do resultado pode deixar um item em `publishing`. Verifique o repositório antes de tentar novamente para evitar duplicatas.
- A visibilidade do ChatGPT via DataForSEO tem custo por consulta e depende da configuração da conta externa.
