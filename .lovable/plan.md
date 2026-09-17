## Visão geral

Adicionar ao painel **Administração**, somente para o administrador global, uma seção de acompanhamento das avaliações. O relatório cruzará todos os simulados com todas as turmas cadastradas e mostrará quais já possuem resultados carregados e quais ainda estão pendentes.

## O que será criado

1. **Relatório geral**
   - Resumo com total de combinações simulado/turma, avaliadas e pendentes.
   - Progresso percentual e detalhamento por escola e por simulado.

2. **Relatório por simulado**
   - Seleção de um simulado.
   - Lista de todas as escolas e turmas, com situação **Avaliada** ou **Pendente**.
   - Para turmas avaliadas: quantidade de alunos, ausentes, respostas, última importação e situação aberta/encerrada.

3. **Relatório por escola**
   - Seleção de uma escola.
   - Lista de todos os simulados e de todas as turmas dessa escola, com situação **Avaliada** ou **Pendente**.
   - Totais e percentual de conclusão da escola.

4. **Filtros e uso**
   - Abas para alternar entre Geral, Por simulado e Por escola.
   - Filtro adicional por situação: todas, avaliadas ou pendentes.
   - Tabelas organizadas e indicadores visuais para localizar rapidamente as pendências.

## Regra de contabilização

- Todas as turmas cadastradas serão consideradas esperadas em todos os simulados.
- Uma turma será **Avaliada** quando existir ao menos um resultado importado ou um registro de aluno ausente para aquele simulado.
- Uma turma será **Pendente** quando não existir nenhum resultado nem registro de ausência para a combinação simulado + turma.
- O fechamento do lote será exibido separadamente e não mudará a condição de avaliada.

## Segurança e desempenho

- A consulta será protegida no servidor e validará obrigatoriamente o papel de administrador global.
- A seção ficará apenas no painel Administração e não aparecerá em Administração/Escola ou para outros perfis.
- Os dados serão carregados de forma agregada, sem baixar todas as respostas individuais.

## Arquivos previstos

- Nova função protegida para montar o cruzamento de escolas, turmas, simulados e importações.
- Novo componente de relatório administrativo.
- Inclusão desse componente na página Administração.
