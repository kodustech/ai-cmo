# Contrato do site em Git

Cada cliente tem um repositório próprio. A equipe constrói ou migra o site nesse repositório e configura o deploy da branch usada pelo agente.

Na raiz, crie `ai-cmo.json`:

```json
{ "version": 1, "contentRoot": "content" }
```

O site precisa renderizar arquivos Markdown em `content/blog/*.md` e `content/pages/*.md`. O diretório inicial pode ser alterado na configuração do cliente. O agente grava frontmatter com `title`, `description` e `contentId`, seguido do corpo em Markdown. O nome do arquivo usa o título e os primeiros oito caracteres do ID para evitar colisões.

O app cria commits na branch configurada usando `GITHUB_SITE_TOKEN` depois que a equipe marca o site como **Em operação**. O repositório deve estar autorizado para esse token com permissão **Contents: Read and write**. A equipe deve verificar o deploy, as URLs, formulários, redirecionamentos, SEO e o domínio antes de considerar a migração concluída. Um commit registrado pelo app não confirma que a página está pública.

O primeiro site de cada cliente ainda é construído pela equipe. O app acompanha diagnóstico, construção e revisão e recebe orientações do cliente; não faz importação ou migração automática.
