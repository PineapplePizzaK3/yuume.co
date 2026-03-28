# Diretriz de Moeda da Plataforma

Esta diretriz define a regra oficial para todos os fluxos financeiros do projeto.

## Regra oficial

- Moeda base interna: `JPY` (iene).
- Moeda final para cliente: `BRL` (real), sempre derivada por conversão a partir do valor base em iene.

Em outras palavras:

- O valor de referencia do sistema deve nascer e ser mantido em `JPY`.
- O valor em `BRL` deve ser tratado como valor convertido, nunca como fonte primaria.

## Regras de implementacao

- Sempre que possivel, persistir valor base em `JPY`.
- Se um fluxo exigir armazenamento em `BRL` por legado/integracao, registrar claramente no codigo que se trata de valor convertido.
- Evitar inferencia de moeda por contexto (ex.: status do pedido); prefira campo explicito de moeda.
- Em UI, priorizar exibicao em `JPY` e, quando necessario, mostrar `BRL` como "convertido".
- Nao criar novos campos de valor sem definir a moeda explicitamente no schema/nome/documentacao.
- Em `payments`, sempre persistir `currency` explicitamente (`JPY` por padrao, `BRL` apenas legado).

## Checklist para PRs que tocam pagamentos/referral/carteira

- O valor base permanece em `JPY`?
- A exibicao/cobranca em `BRL` esta vindo de conversao do `JPY`?
- Existe algum default de moeda incoerente (`BRL` como base)?
- O codigo evita misturar valores de moedas diferentes no mesmo calculo?
- O arquivo alterado menciona claramente a moeda de cada campo financeiro?

## Observacoes de legado

Alguns fluxos antigos podem manter campos em `BRL`. Nesses casos:

- nao expandir o legado;
- adicionar comentario explicito no ponto de uso;
- planejar migracao para base `JPY` quando o modulo for evoluido.
