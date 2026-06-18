## Visão geral

O sistema deixará de exigir cadastro de alunos. Cada importação fica vinculada à escola+turma escolhidas no painel; cada linha da planilha é um aluno anônimo, identificado apenas pelo nº de chamada (coluna C). Os relatórios passam a ser gerados em três painéis (Padrão de Desempenho, Conclusão da Prova, Acerto Médio), com drill-down município → escola.

## Mudanças no banco

1. **Tabela `turmas`** – novo campo `matricula_atual` (int, ex.: 32). Usado para calcular o % de alunos que finalizaram.
2. **Tabela `respostas_alunos`** – `aluno_id` passa a ser opcional; novas colunas `turma_id` (uuid, FK turmas) e `numero_chamada` (int). Índice único `(simulado_id, turma_id, numero_chamada, questao_id)` para permitir reimportação idempotente.
3. **Campo `city` da tabela `schools`** já existe e será usado como "município" nos relatórios.
4. *Alunos*: a tela e a tabela continuam existindo (não removo dados), mas deixam de ser obrigatórias para importar respostas.

## Importação de cartões-resposta (offline)

- O painel passa a exigir: Simulado + Escola + Turma (Turma obrigatória).
- A planilha é lida exatamente como hoje (coluna C = nº de chamada, colunas L/O/R… = alternativa marcada).
- Cada linha vira N inserts em `respostas_alunos` com `turma_id`, `numero_chamada`, `simulado_id`, `questao_id`, `resposta_escolhida` (sem `aluno_id`).
- Resumo pós-importação: nº de alunos importados (linhas), total de respostas, e tabela com nº de chamada / acertos / erros / em branco / %.

## Painel "Relatórios"

Filtros: Simulado (obrigatório), Oferta. Três painéis empilhados, cada um com drill-down município → escola.

### 1) Padrão de Desempenho (% de alunos)

Faixas por nº de acertos (0–45):
- 0–11 Muito Crítico (vermelho `#ef4444`)
- 12–22 Crítico (amarelo `#eab308`)
- 23–34 Intermediário (verde `#22c55e`)
- 35–45 Adequado (azul `#3b82f6`)

Barras 100% empilhadas, uma por município. Clicar no município troca a visualização para uma barra por escola daquele município. Botão "Voltar para municípios".

### 2) % de Alunos que Finalizaram a Prova

Barra 100% por município: finalizou (alunos com ≥1 resposta na planilha) vs. não fez/não finalizou (`turma.matricula_atual` − finalizou, somado nas turmas do município/escola). Clique no município → barras por escola.

### 3) Percentual de Acerto Médio na Oferta

Barra 100% por município: % de acerto vs. % de erro (considera respostas marcadas; em branco fica de fora). Clique no município → escolas.

## Detalhes técnicos

- Migration: `ALTER TABLE turmas ADD COLUMN matricula_atual int;` `ALTER TABLE respostas_alunos ADD COLUMN turma_id uuid REFERENCES turmas(id), ADD COLUMN numero_chamada int, ALTER COLUMN aluno_id DROP NOT NULL;` índice único parcial para o novo modo.
- `src/lib/offline.functions.ts` – reescrever `importarRespostas`: input `{ simuladoId, turmaId, linhas:[{ numero_chamada, respostas }] }`. Sem busca em `alunos`. Retorno inclui `detalhes_alunos` baseados em `numero_chamada`.
- `src/components/admin/importar-respostas.tsx` – Turma vira campo obrigatório; parser usa coluna C como `numero_chamada`; tabela de resultados mostra "Nº chamada" em vez de matrícula.
- `src/components/admin/turmas-manager.tsx` – adicionar input `Matrícula atual`.
- `src/lib/relatorios.functions.ts` – novas funções:
  - `getPadraoDesempenho({ simuladoId })` → `[{ city, escolas:[{ school_id, name, faixas:{ muito_critico, critico, intermediario, adequado } }] }]`.
  - `getConclusao({ simuladoId })` → `[{ city, escolas:[{ school_id, name, finalizaram, nao_finalizaram, total_matriculados }] }]`.
  - `getAcertoMedio({ simuladoId })` → `[{ city, escolas:[{ school_id, name, acertos, erros, pct_acerto }] }]`.
  Cada uma agrega `respostas_alunos` por `turma_id` → `school_id` → `city`.
- `src/routes/_authenticated/relatorios.tsx` – substituir conteúdo pelos três painéis com drill-down (estado local `cidadeSelecionada` por painel). Usar `recharts` (`BarChart` com `stackOffset="expand"`).

## Fora do escopo

- Não remover a tabela `alunos` nem a tela de cadastro de alunos (ficam disponíveis para uso futuro).
- Não mexer em correção online por usuário logado.
