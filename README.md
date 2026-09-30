# Matheus OS

Este projeto mantém o Matheus OS em HTML, CSS e JavaScript puro, com uma camada inicial de autenticação e preparação para Firestore, sem perder a essência do mapa mental e do fluxo cognitivo.

## Objetivo desta fase

- manter a interface existente estável;
- preparar o projeto para Firebase Authentication;
- preparar base para Firestore por usuário;
- manter `localStorage` apenas como backup de migração, enquanto o Firestore é a fonte principal;
- deixar o projeto pronto para deploy na Vercel com Vite.

## Como rodar localmente

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Inicie o ambiente de desenvolvimento:
   ```bash
   npm run dev
   ```
3. Abra a URL exibida pelo Vite, normalmente:
   ```text
   http://localhost:5173
   ```
4. Gere a build de produção:
   ```bash
   npm run build
   ```

## Firebase

Crie um projeto no Firebase Console e preencha as variáveis no arquivo `.env` a partir de `.env.example`:

```bash
cp .env.example .env
```

Variáveis esperadas:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Depois:

1. habilite Authentication;
2. habilite Google Sign-In;
3. adicione `localhost` aos domínios autorizados;
4. configure Firestore;
5. publique `firestore.rules` e `firestore.indexes.json`.

## Estrutura atual

```text
matheus-os/
├── frontend/
│   ├── app.js
│   ├── auth.js
│   ├── firebase.js
│   ├── firestore.js
│   ├── index.html
│   └── styles.css
├── docs/
│   ├── architecture.md
│   └── cognitive-model.md
├── .env.example
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── package.json
├── README.md
├── vite.config.js
├── matheus-os.html
└── .gitignore
```

## Vercel

Para publicar:

1. importe este repositório para a Vercel;
2. use o framework preset `Vite`;
3. defina as variáveis de ambiente com os valores do Firebase;
4. mantenha o build como `npm run build` e output `dist`.

## Observação importante

A autenticação, a sincronização em tempo real e a estrutura de Firestore estão ativas. O `localStorage` antigo só é usado para oferecer uma importação explícita, preservando o backup local sem competir com os dados da conta.
