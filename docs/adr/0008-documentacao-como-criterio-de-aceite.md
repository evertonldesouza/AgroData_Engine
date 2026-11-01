# ADR 0008 — Documentação é critério de aceite, e é verificada por CI

- **Status:** aceito
- **Data:** 2026-11-01

## Contexto

O projeto acumulou decisões boas que sobreviviam apenas em dois lugares frágeis: a
mensagem do PR (que ninguém relê) e a memória de quem escreveu o código. Sintomas
concretos, todos já observados aqui:

- o README anunciava "146 testes" quando a suíte tinha 265;
- `docs/arquitetura.md` listava o coletor CEPEA como roadmap depois de ele estar
  implementado e testado;
- controles de segurança (CORS, rate limit, imagem non-root, CodeQL) estavam no
  código, mas não em nenhum lugar que um revisor pudesse auditar de cima;
- o pipeline de CI existia em seis workflows sem um documento dizendo **qual é o
  gate** e o que fazer quando ele falha.

O padrão que causou isso é sempre o mesmo: a informação ficou no PR porque "depois
eu documento". Documentação sem verificação apodrece igual a teste sem CI.

## Decisão

Documentação passa a ser **parte da definição de pronto**, com três peças:

1. **Documentos com dono único** — [`docs/README.md`](../README.md) diz qual
   documento responde qual pergunta (`api.md` = contrato, `testes.md` = estratégia,
   `seguranca.md` = controles, `ci-cd.md` = processo, ADR = decisão estrutural).
2. **Verificação automática** — [`scripts/check_docs.py`](../../scripts/check_docs.py)
   roda no workflow `CI · Docs` e reprova: documento obrigatório ausente, página
   fora do índice, ADR fora da tabela, link relativo quebrado, cerca de código sem
   par.
3. **Checklist no PR** — o template pede o documento tocado e o `CHANGELOG`;
   o workflow emite aviso quando `src/` muda sem nenhum documento acompanhar.

## Justificativa

- **Link quebrado é bug de documentação.** O check pega isso de graça e é a parte
  que mais apodrece sozinha.
- **Índice é contrato.** Exigir que toda página esteja em `docs/README.md` impede
  a criação de documento órfão — quem procura encontra.
- **ADR indexado = decisão rastreável.** A tabela de `docs/adr/README.md` é
  verificada, então "abrir um ADR" tem uma definição mecânica de concluído.
- **Aviso, não bloqueio, para mudança de código sem doc.** Um fix de typo em
  `src/` não precisa de documento novo; transformar isso em falha ensinaria o time
  a burlar o gate.

## Consequências

**Positivas**

- O estado do projeto (testes, cobertura, controles, gates) tem uma fonte única e
  verificada; números errados passam a ser detectáveis.
- Revisor ganha um roteiro: contrato → `api.md`, segurança → `seguranca.md`.
- Onboarding deixa de depender de conversa.

**Negativas / limites**

- **Custo real por PR**: alguns minutos para atualizar tabela/entrada — assumido
  conscientemente.
- O check valida **estrutura**, não verdade. Um número errado em documento
  existente continua passando; isso é trabalho de revisão (e a tabela de
  `testes.md` é o lugar de conferir).
- Anchors (`#secao`) não são validados: a regra de slug do GitHub é instável
  demais para valer um falso positivo por semana.
- Documentação em português: decisão de produto (público brasileiro), com o
  resumo em inglês no README para quem chega de fora.

## Alternativas descartadas

- **Wiki do GitHub:** sai do versionamento, não aparece em PR, não tem link check.
- **Gerar docs do código (DocFX/Sphinx):** resolveria referência de API, não
  resolveria as decisões e padrões que são o que se perde de fato — e adicionaria
  uma toolchain inteira.
- **Só `CONTRIBUTING.md`:** um arquivo grande vira parágrafo ignorado; documentos
  por assunto têm dono e link direto.
- **Bloquear PR sem doc:** transformaria exceções legítimas (dependabot, typo) em
  fricção, e o gate seria contornado com `skip` em vez de cumprido.
