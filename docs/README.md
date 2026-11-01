# Documentação

Índice da documentação e regra do jogo: **toda melhoria que muda comportamento,
contrato, padrão de qualidade ou processo entra aqui no mesmo PR**. Documentação
que não é verificada apodrece — por isso ela tem teste próprio
([`scripts/check_docs.py`](../scripts/check_docs.py)) e roda no workflow
`CI · Docs`.

## Mapa dos documentos

| Documento | Responde à pergunta | Público |
| --- | --- | --- |
| [Arquitetura](./arquitetura.md) | como os módulos se encaixam e por quê | quem vai mexer no código |
| [API](./api.md) | contrato HTTP: rotas, campos, erros, cache, métricas | quem consome a API |
| [Contexto de produto](./product-context.md) | qual problema o projeto resolve e para quem | recrutador, stakeholder |
| [Padrões de código](./padroes-codigo.md) | como escrever código aqui (C#, Python, JS, SQL) | contribuidor |
| [Testes](./testes.md) | o que testar, com que ferramenta, qual cobertura é exigida | contribuidor |
| [Segurança](./seguranca.md) | quais controles existem, onde estão e o que revisar no PR | contribuidor, revisor |
| [CI/CD](./ci-cd.md) | quais workflows existem, quais são gates, como publicar e reverter | contribuidor, mantenedor |
| [ADRs](./adr/README.md) | por que cada decisão estrutural foi tomada (e o que foi descartado) | qualquer um |
| [Changelog](../CHANGELOG.md) | o que mudou em cada versão | qualquer um |

## Onde documentar o quê

A dúvida "onde escrevo isso?" tem resposta curta:

| Mudança | Onde documentar |
| --- | --- |
| Rota, campo, status code, header, parâmetro | [`api.md`](./api.md) (e o exemplo no README se for rota principal) |
| Regra de negócio, fluxo, dependência entre camadas | [`arquitetura.md`](./arquitetura.md) |
| Escolha estrutural com trade-off (banco, cache, protocolo, observabilidade) | novo ADR em [`adr/`](./adr/README.md) |
| Convenção de código, nome, tratamento de erro | [`padroes-codigo.md`](./padroes-codigo.md) |
| Tipo de teste, meta de cobertura, ferramenta | [`testes.md`](./testes.md) |
| Controle de segurança novo (ou limite aceito) | [`seguranca.md`](./seguranca.md) |
| Workflow, gate, required check, deploy, rollback | [`ci-cd.md`](./ci-cd.md) |
| Comportamento visível ao usuário, versão | [`CHANGELOG.md`](../CHANGELOG.md) + roadmap do [README](../README.md) |

Regra prática: **se a informação vai ser necessária de novo daqui a três meses,
ela não pode morar apenas no corpo do PR.**

## Definição de pronto (documentação)

Um PR só está pronto quando:

- [ ] a mudança aparece no documento da tabela acima (não em "algum lugar");
- [ ] links novos apontam para arquivos que existem (`python scripts/check_docs.py`);
- [ ] página nova em `docs/` foi adicionada ao índice deste arquivo;
- [ ] ADR novo foi adicionado à tabela de [`adr/README.md`](./adr/README.md);
- [ ] mudança visível ao usuário tem entrada no `CHANGELOG.md`;
- [ ] números citados (contagem de testes, cobertura, versão) continuam verdadeiros.

## Verificação

```bash
python scripts/check_docs.py           # links, índice, ADRs, cercas de código
python scripts/check_docs.py --verbose # lista o que foi verificado
```

O mesmo comando roda no CI a cada PR que toca em markdown, em `docs/` ou no
próprio script. Além disso, o workflow avisa (sem bloquear) quando `src/` muda e
nenhum documento acompanha — ver [`ci-cd.md`](./ci-cd.md).
