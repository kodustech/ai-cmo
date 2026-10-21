import type { Metadata } from "next";
import Link from "next/link";
import "./marketing.css";

export const metadata: Metadata = {
  title: "CMO — Um agente para tocar seu marketing B2B",
  description:
    "O CMO pesquisa oportunidades, cria páginas, artigos e posts para LinkedIn e acompanha a execução do inbound para empresas B2B sem time de marketing.",
  openGraph: {
    title: "CMO — Um agente para tocar seu marketing B2B",
    description: "Pesquisa, plano, páginas, artigos e LinkedIn em uma operação de inbound para empresas B2B sem time de marketing.",
    type: "website",
  },
};

const outputs = [
  { number: "01", title: "Um plano de trabalho", text: "O agente propõe pautas a partir da sua oferta, do site e das perguntas que aparecem nas vendas.", color: "blue" },
  { number: "02", title: "Páginas para o site", text: "Páginas de solução e comparação para responder o que um comprador pesquisa antes de falar com você.", color: "pink" },
  { number: "03", title: "Artigos e LinkedIn", text: "Artigos para busca e posts para o perfil do founder, com o contexto e as opiniões que você fornecer.", color: "yellow" },
  { number: "04", title: "Registro da execução", text: "Veja o que foi criado, o que espera revisão e os dados de busca e tráfego disponíveis no painel.", color: "lime" },
];

const steps = [
  { number: "01", label: "Comece pelo site", title: "O agente lê sua empresa.", text: "Você informa o endereço da empresa. O agente analisa a oferta e você corrige o que ele entendeu sobre o negócio." },
  { number: "02", label: "Revise o plano", title: "Escolha a primeira pauta.", text: "O plano traz temas para site, blog e LinkedIn. Você pode mudar a ordem e incluir o que ouviu dos compradores." },
  { number: "03", label: "Acompanhe a produção", title: "O conteúdo sai da fila.", text: "O agente escreve páginas, artigos e posts. A publicação depende dos canais conectados e do modo de revisão escolhido." },
  { number: "04", label: "Volte ao painel", title: "Veja o que aconteceu.", text: "O painel reúne tarefas, publicações e dados disponíveis de busca e tráfego para decidir o próximo trabalho." },
];

function Arrow() { return <span aria-hidden="true">↗</span>; }

export default function MarketingPage() {
  return <main className="marketing" id="topo">
    <div className="m-announcement"><span className="m-live-dot" /> INBOUND B2B PARA EMPRESAS SEM TIME DE MARKETING</div>
    <header className="m-header">
      <Link href="#topo" className="m-logo" aria-label="CMO, voltar ao início"><span className="m-logo-symbol" aria-hidden="true">✳</span>cmo<span className="m-logo-dot">.</span></Link>
      <nav aria-label="Navegação principal">
        <a href="#como-funciona">Como funciona</a>
        <a href="#entregas">O que entrega</a>
        <a href="#planos">Planos</a>
      </nav>
      <Link className="m-header-cta" href="/app">Criar meu plano <Arrow /></Link>
    </header>

    <section className="m-hero" aria-labelledby="hero-title">
      <div className="m-hero-copy">
        <div className="m-kicker"><span className="m-kicker-line" /> PARA FOUNDERS B2B SEM TIME DE MARKETING</div>
        <h1 id="hero-title">Um agente<br /><span>para tocar seu</span><br />marketing<span className="m-title-dot">.</span></h1>
        <p>Mostre sua empresa ao CMO. Ele propõe um plano de inbound, escreve páginas e artigos para o site e prepara posts para LinkedIn. Você revisa as decisões e vê o trabalho no painel.</p>
        <div className="m-hero-actions"><Link href="/app" className="m-button m-button-dark">Criar meu primeiro plano <Arrow /></Link><a href="#como-funciona" className="m-text-link">Ver como funciona <span aria-hidden="true">↓</span></a></div>
        <div className="m-hero-note"><span className="m-note-icon">✓</span><span>Comece com o endereço da sua empresa.</span></div>
      </div>
      <div className="m-hero-art" aria-label="Visão ilustrativa do trabalho do agente: oportunidade, entregas e acompanhamento">
        <div className="m-orbit m-orbit-one" /><div className="m-orbit m-orbit-two" />
        <div className="m-art-label m-art-label-top">EXEMPLO DE UM CICLO <span>↘</span></div>
        <div className="m-site-window">
          <div className="m-window-bar"><span /><span /><span /><i>cmo / oportunidades</i></div>
          <div className="m-window-body"><div className="m-window-logo">SEU PLANO <span>↗</span></div><div className="m-window-kicker">PAUTA EM REVISÃO</div><strong>Como sua solução<br />se compara?</strong><div className="m-window-evidence"><span>Origem: pergunta feita em vendas</span><span>Entrega: página de comparação</span></div><div className="m-window-button">Revisar pauta →</div></div>
        </div>
        <div className="m-agent-card"><div className="m-agent-card-top"><span className="m-mini-star">✳</span><span>AGENTE CMO</span><span className="m-green-dot" /></div><strong>Fila de produção</strong><div><span className="m-task-check">✓</span> Página de comparação <small>rascunho</small></div><div><span className="m-task-check">✓</span> Artigo para busca <small>em revisão</small></div><div><span className="m-task-empty">○</span> Post do founder <small>planejado</small></div></div>
        <div className="m-search-card"><span>↗</span><div><strong>Uma pauta.</strong><small>Peças para site e LinkedIn.</small></div></div>
        <div className="m-art-label m-art-label-bottom">DO PLANO À PUBLICAÇÃO</div>
      </div>
    </section>

    <section className="m-problem" aria-labelledby="problem-title"><div className="m-section-index">01 / O PROBLEMA</div><div className="m-problem-main"><h2 id="problem-title">Você responde às mesmas perguntas de vendas <em>toda semana.</em></h2><p>Essas respostas podem estar no seu site e nos posts do founder. O CMO ajuda a transformá-las em conteúdo que o próximo comprador encontra antes da reunião.</p></div><aside className="m-problem-example" aria-label="Exemplo de uma oportunidade de marketing"><span>EXEMPLO DE UMA PAUTA</span><strong>“Como vocês se comparam ao que usamos hoje?”</strong><div><b>01</b><p>Você conta como responderia a essa pergunta.</p></div><div><b>02</b><p>O agente escreve uma página de comparação e um post com seu ponto de vista.</p></div><div><b>03</b><p>Você revisa o conteúdo e acompanha a publicação no painel.</p></div></aside></section>

    <section className="m-process" id="como-funciona" aria-labelledby="process-title"><div className="m-section-heading"><div><span className="m-section-index">02 / COMO FUNCIONA</span><h2 id="process-title">Do primeiro plano<br /><span>ao conteúdo publicado.</span></h2></div><p>Você começa com o site da empresa, revisa as prioridades e acompanha cada peça até a publicação.</p></div><div className="m-steps">{steps.map((step) => <article className="m-step" key={step.number}><div className="m-step-top"><span>{step.number}</span></div><small>{step.label}</small><h3>{step.title}</h3><p>{step.text}</p></article>)}</div><div className="m-process-foot"><span className="m-process-loop" aria-hidden="true">↻</span><strong>O próximo plano parte do que foi entregue.</strong><span>Pesquisar → planejar → escrever → publicar → revisar os dados.</span></div></section>

    <section className="m-showcase" aria-labelledby="showcase-title"><div className="m-showcase-copy"><span className="m-section-index">03 / DENTRO DO PRODUTO</span><h2 id="showcase-title">Veja o trabalho<br /><span>e o que falta decidir.</span></h2><p>O painel reúne o plano, os rascunhos e as tarefas que precisam da sua revisão. Você também pode conversar com o agente para mudar uma prioridade ou adicionar contexto.</p><Link href="/app" className="m-button m-button-light">Abrir o produto <Arrow /></Link></div><div className="m-product-board" aria-label="Exemplo de painel com plano, tarefas e sinais"><div className="m-board-head"><span>✳ &nbsp; SEU CMO</span><span>EXEMPLO DE PAINEL &nbsp; ●</span></div><div className="m-board-intro"><small>PAUTA ATUAL</small><strong>Explicar como sua solução se compara à alternativa mais citada em vendas.</strong></div><div className="m-board-grid"><div className="m-board-main"><small>NA FILA</small><div><span className="m-board-bullet purple">↗</span><span>Página de comparação<br /><small>Pronta para revisão</small></span><b>REVISAR</b></div><div><span className="m-board-bullet blue">↗</span><span>Artigo para busca<br /><small>Rascunho criado</small></span><b>VER</b></div><div><span className="m-board-bullet pink">↗</span><span>Post para LinkedIn<br /><small>Na fila da semana</small></span><b>VER</b></div></div><div className="m-board-side"><small>POR QUE ESTA PAUTA?</small><strong>O comprador pediu uma comparação.</strong><p>Sua resposta comercial orienta a página e o post.</p><span>Ver contexto da pauta ↗</span></div></div><div className="m-board-bottom">PUBLICAÇÕES &nbsp;·&nbsp; RASCUNHOS &nbsp;·&nbsp; DECISÕES PENDENTES</div></div></section>

    <section className="m-outputs" id="entregas" aria-labelledby="outputs-title"><div className="m-section-heading"><div><span className="m-section-index">04 / ENTREGAS</span><h2 id="outputs-title">O que o agente<br /><span>coloca em produção.</span></h2></div><p>Da escolha da pauta ao rascunho, você vê o motivo de cada trabalho e o estado de cada entrega.</p></div><div className="m-output-grid">{outputs.map((output) => <article key={output.number} className={`m-output-card m-output-${output.color}`}><div className="m-output-top"><span>{output.number} / ENTREGA</span></div><h3>{output.title}</h3><p>{output.text}</p></article>)}</div></section>

    <section className="m-plans" id="planos" aria-labelledby="plans-title"><div className="m-plans-intro"><span className="m-section-index">05 / PLANOS</span><h2 id="plans-title">Opere com o agente<br /><span>ou com a nossa equipe.</span></h2><p>Nos dois casos, você tem acesso ao plano e ao painel. Escolha quem vai conduzir a rotina de marketing.</p></div><div className="m-plan-cards"><article className="m-plan-card"><div className="m-plan-top"><span>01 / AGENTE</span><span>VOCÊ DIRIGE</span></div><h3>Agente CMO</h3><p>O agente propõe pautas e produz conteúdo. Você conversa com ele, muda prioridades e escolhe como revisar publicações.</p><ul><li>Plano e fila de tarefas</li><li>Páginas, artigos e LinkedIn</li><li>Publicação nos canais conectados</li></ul><Link href="/app" className="m-plan-link">Começar com o agente <Arrow /></Link></article><article className="m-plan-card m-plan-managed"><div className="m-plan-top"><span>02 / COM EQUIPE</span><span>NÓS CONDUZIMOS</span></div><h3>CMO com equipe</h3><p>Nossa equipe cuida da implantação, revisa a estratégia e conduz a produção com o agente. Você acompanha e participa das decisões.</p><ul><li>Implantação do site e dos canais</li><li>Revisão humana do conteúdo</li><li>Rotina de produção acompanhada</li></ul><Link href="/app" className="m-plan-link">Conversar com a equipe <Arrow /></Link></article></div></section>

    <section className="m-fit" aria-labelledby="fit-title"><div><span className="m-section-index">PARA QUEM</span><h2 id="fit-title">Você vende B2B.<br /><span>O marketing ainda depende de você.</span></h2></div><p>O CMO foi pensado para founders de SaaS e serviços B2B que conhecem seus compradores, mas ainda precisam fazer o marketing entre uma venda e outra.</p></section>

    <section className="m-final" aria-labelledby="final-title"><span className="m-section-index">COMECE PELO ENDEREÇO DA SUA EMPRESA</span><h2 id="final-title">Veja o primeiro plano<br /><span>para o seu negócio.</span></h2><p>O agente lê o seu site, apresenta o que entendeu e propõe as primeiras pautas. Você corrige o contexto antes de seguir para a produção.</p><Link href="/app" className="m-button m-button-dark">Criar meu plano <Arrow /></Link><small>Você escolhe o modo de revisão antes de publicar.</small></section>

    <footer className="m-footer"><Link href="#topo" className="m-logo" aria-label="CMO, voltar ao início"><span className="m-logo-symbol" aria-hidden="true">✳</span>cmo<span className="m-logo-dot">.</span></Link><p>Marketing de conteúdo B2B com um agente e uma equipe quando você precisar.</p><div><a href="#como-funciona">Como funciona</a><a href="#planos">Planos</a><Link href="/app">Entrar no produto ↗</Link></div><span>© {new Date().getFullYear()} CMO</span></footer>
  </main>;
}
