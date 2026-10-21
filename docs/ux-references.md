# Referências para a experiência do produto

Pesquisa de 20/10/2026. A referência principal de experiência é um agente persistente que assume um trabalho específico, executa, pede decisões e presta contas. Ferramentas de marketing ajudam a definir as capacidades; não devem ditar a experiência central.

## Experiência de agente: referências primárias

| Produto | Padrão de produto | Tradução para inbound B2B |
| --- | --- | --- |
| [Polsia](https://polsia.com/) | Agente que assume a operação de um negócio | O cliente entrega a missão e acompanha o que o agente fez, o que está fazendo e o que precisa decidir |
| [Grok Bot](https://x.ai/news/introducing-grok-bot) | Delegação por conversa a um agente que trabalha em ferramentas reais e volta com o resultado | Pedidos como “melhore nossa presença para esta busca” viram tarefas acompanháveis e entregáveis verificáveis |
| [CoFounder.AI](https://cofounder.ai/) | Um agente central mantém prioridades e delega a especialistas | Uma única relação com o agente de inbound, mesmo que SEO, conteúdo e social sejam executados por rotinas diferentes |
| [Agentfounder](https://agentfounder.ai/) | Trabalho em ciclos, memória persistente e caixa de decisões do fundador | Operação semanal contínua, memória do negócio e uma caixa clara para aprovações e bloqueios |

No Refero, as buscas por Polsia e Grok Bot não trouxeram telas dos produtos. O [Cofounder](https://refero.design/websites/746), com proposta de assistente/automação, oferece fluxos observáveis mais próximos da experiência de agente.

## Fluxos de agente vistos no Refero

| Referência | O que foi observado | Adaptação proposta |
| --- | --- | --- |
| [Cofounder: onboarding](https://refero.design/flows/7892) | Coleta site, pesquisa dados automaticamente, mostra perfil para edição e apresenta memória e integrações | Site primeiro; descobertas revisáveis; conectar fontes e canais quando a primeira ação precisar delas |
| [Cofounder: perfil descoberto](https://refero.design/pages/f5a072a1-322b-4ccd-8bca-83eb0e1a54c9) | Resumo “o que descobri sobre sua empresa” com Editar e Continuar | Mostrar fatos, hipóteses e fontes em linguagem simples antes de pedir mais dados |
| [Cofounder: workspace](https://refero.design/flows/7893) | Conversa central, memória, integrações e ações sugeridas | Abrir com o estado do agente, decisões pendentes e próximos trabalhos, com chat sempre acessível |
| [Intercom: Fin AI Agent](https://refero.design/pages/1ca4151b-aa42-41bc-8775-db41ca1c50a1) | Área dedicada ao agente com conteúdo ingerido e métricas da função | Mostrar o que o agente sabe e o resultado de sua operação em vez de indicadores soltos |

## Produtos próximos da proposta

| Produto | Oferta pública relevante | Referência para o MVP |
| --- | --- | --- |
| [AdamX](https://adamx.ai/ai-marketing-agency) | Agentes executam site, SEO/AEO, conteúdo e social para B2B, com supervisão humana | Plano operado por nós, aprovações e visibilidade do trabalho entregue |
| [Tenet](https://yourtenet.com/llms) | Agente aprende marca e ICP e conduz estratégia, produção e distribuição | Memória da empresa e conversa com o agente como interface de trabalho |
| [Sprites](https://www.sprites.ai/b2b-marketing) | Conecta canais e CRM, propõe mudanças e acompanha pipeline e visibilidade em busca por IA | Explicar dados em decisões e registrar resultado de cada ação |

As buscas por esses três nomes no Refero não retornaram telas dos próprios produtos. Para a UX/UI, usar produtos de marketing encontrados no acervo e manter a autoria explícita.

## Ferramentas de marketing: referências secundárias de interface

| Referência | O que foi observado | Adaptação proposta |
| --- | --- | --- |
| [Jasper: onboarding completo](https://refero.design/flows/5281) | Perguntas curtas, captura de URL do negócio, escolha do plano e pagamento, depois tour e lista de próximas ações | Capturar o site, mostrar o que foi aprendido, deixar plano e contratação em etapas claras; indicar o próximo trabalho no produto |
| [Jasper: pedido de URL](https://refero.design/pages/2fd69a75-51b4-4f1a-b46b-bd89b7468f51) | A URL é solicitada para conhecer a voz e o contexto da marca | Usar o site como ponto de partida e pedir correção só dos fatos incertos |
| [Jasper: início do workspace](https://refero.design/pages/4fd4c55b-6509-42c7-a1a6-a65fed4b0dc1) | Conversa com o assistente ao lado de ações sugeridas e checklist | Unir conversa, próximo passo e execução no mesmo contexto |
| [Copy.ai: workflows](https://refero.design/pages/579e1241-d34e-4f85-82a2-d7e2f09002eb) | Ações de blog, LinkedIn e reaproveitamento aparecem como tarefas reconhecíveis | Mostrar entregáveis concretos da semana em vez de catálogo genérico de ferramentas |

## Decisões de interface

1. A primeira tela pede somente o domínio; o produto extrai o perfil e exibe fontes e hipóteses para revisão.
2. Falha de geração exige tentativa de recuperação e uma mensagem que explique o próximo passo; erro técnico de JSON não deve aparecer ao cliente.
3. O dashboard apresenta o diagnóstico em poucas linhas, uma decisão e uma próxima ação. Detalhes e dados brutos ficam disponíveis ao abrir o plano.
4. A escolha entre agente e operação humana pertence à contratação. O onboarding descobre o negócio.
5. Cada ação deve mostrar motivo, estado, aprovação necessária e sinal que será acompanhado depois da publicação.
