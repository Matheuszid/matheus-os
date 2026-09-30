# MCP Tools - Fase 1

Todas as tools operam exclusivamente em `users/{MATHEUS_OS_UID}` por meio do Firebase Admin SDK. Nenhuma recebe `uid`.

Em produção, as tools são acessíveis pelo endpoint Streamable HTTP `/mcp`, protegido pelo header `Authorization: Bearer $MCP_API_KEY`. O endpoint `GET /health` não retorna dados do Firestore.

## `list_projects`

Lista projetos sem retornar respostas completas.

Input opcional:

```json
{"area":"Estudos","stage":"Agir","status":"active"}
```

Retorna `id`, `name`, `area`, `stage`, `status` e `nextAction`. Não altera dados.

## `get_project`

Consulta o contexto de um projeto.

Input:

```json
{"projectId":"matheus-os"}
```

Também aceita `name`. Se houver mais de um projeto com o nome, retorna `AMBIGUOUS_PROJECT` e não escolhe silenciosamente. Retorna projeto, respostas, aprendizados e relações. Não altera dados.

## `add_capture`

Adiciona uma ideia na inbox.

Input:

```json
{"text":"Estudar redes"}
```

Cria uma captura com status `inbox`. Altera dados. Limite: 1 a 500 caracteres.

## `get_next_actions`

Não recebe filtros na Fase 1. Retorna `projectId`, `project`, `area`, `stage` e `nextAction` apenas para projetos ativos. Não altera dados.

## Respostas de erro

Erros são retornados como JSON compacto, sem stack trace ou conteúdo sensível. Exemplos: `PROJECT_NOT_FOUND`, `AMBIGUOUS_PROJECT`, `CONFIGURATION_ERROR` e `INTERNAL_ERROR`.
