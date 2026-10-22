# Contexto do produto

## Problema

O mercado de commodities agrícolas é acompanhado por ferramentas fragmentadas:
portais com paywall, planilhas de corretora e grupos de mensagem. O produtor vê o preço
do dia, mas não vê a série, a variação ou a tendência com rastreabilidade.

## Proposta

Uma plataforma enxuta que responde três perguntas em uma tela:

1. **Quanto está agora?** — preço mais recente por commodity.
2. **Para onde está indo?** — variação absoluta/percentual e média móvel.
3. **De onde veio esse número?** — histórico e origem (`Source`) de cada cotação.

## Públicos

| Público | O que usa | O que espera |
| --- | --- | --- |
| Produtor rural | cartões de preço, variação | leitura em segundos, no celular |
| Analista de mercado | gráfico histórico, tabela de leituras | série confiável, exportável no futuro |
| Avaliador técnico (recrutador/dev) | `/swagger`, README, código | arquitetura clara, testes, trade-offs documentados |

## Escopo atual (v3)

- Ingestão horária de soja e milho (simulada, determinística).
- API REST somente leitura com tendência e média móvel.
- Dashboard com polling, gráfico histórico real e tabela de leituras.
- CI/CD por domínio, Docker, deploy em Render + GitHub Pages.

## Fora de escopo (por ora)

- Autenticação e escrita via API ([ADR 0004](./adr/0004-public-read-only-api.md)).
- Fonte pública real de preços (CEPEA/CBOT) — contrato do coletor HTTP já preparado.
- Alertas, notificações e exportação de relatórios.

## Métricas de sucesso

- Dashboard carrega em < 2 s em 3G rápido (bundle inicial ~74 kB gzip).
- Pipeline horário com taxa de sucesso ≥ 99% e erro isolado por símbolo.
- Zero regressões nos três conjuntos de testes a cada merge.
