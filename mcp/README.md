# Matheus OS MCP

MCP server semântico do Matheus OS. A Fase 1 expõe somente `list_projects`, `get_project`, `add_capture` e `get_next_actions` via transporte stdio.

O servidor usa exclusivamente o Firebase Admin SDK e sempre opera sobre `users/{MATHEUS_OS_UID}`. O UID nunca é recebido como argumento de uma tool.

## Instalação

```bash
cd mcp
npm install
```

## Configuração

```bash
copy .env.example .env
```

Preencha:

- `FIREBASE_PROJECT_ID`: `matheus-os-fdd16`;
- `FIREBASE_CLIENT_EMAIL` e `FIREBASE_PRIVATE_KEY` de uma service account, ou use Application Default Credentials;
- `MATHEUS_OS_UID`: UID fixo da conta do Matheus OS;
- `USE_FIREBASE_EMULATOR=true` somente para desenvolvimento com o Emulator Suite.

Nunca coloque service account JSON, private key ou client email administrativo no repositório.

## Desenvolvimento

```bash
npm run dev
```

O transporte stdio usa stdout exclusivamente para o protocolo MCP. Logs vão para stderr.

## Build e produção

```bash
npm run build
npm start
```

`npm start` inicia o transporte Streamable HTTP em `0.0.0.0:$PORT`.

Endpoints:

- `GET /health`: público, retorna `{ "ok": true, "service": "matheus-os-mcp" }`;
- `POST /mcp`: protegido por `Authorization: Bearer $MCP_API_KEY`.

O endpoint MCP usa sessões Streamable HTTP e não expõe credenciais. Para publicar em Cloud Run, Railway ou Render, use o [Dockerfile](Dockerfile) e configure as variáveis privadas no painel do provedor. Não coloque `.env` ou service account no container/repositório.

O `.vscode/mcp.json` continua usando stdio para desenvolvimento local. O transporte HTTP fica separado para integração HTTPS.

## Testes

```bash
npm test
```

Os testes da Fase 1 cobrem os contratos de entrada e o mapeamento de etapas. Testes de integração com Firestore podem usar `USE_FIREBASE_EMULATOR=true` e o Emulator Suite.

## Escopo da Fase 1

Implementado:

- `list_projects`: filtros opcionais por área, etapa e status;
- `get_project`: consulta por ID ou nome, rejeitando nomes ambíguos;
- `add_capture`: cria uma captura com status `inbox`;
- `get_next_actions`: retorna próximos passos de projetos ativos.

Não implementado nesta fase: criação/atualização de projetos, respostas, aprendizados, relações, conversão de captura e conclusão de projeto.
