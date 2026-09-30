# Arquitetura atual

## Visão geral

A versão atual funciona como um protótipo front-end estático com lógica client-side em JavaScript puro. A intenção da refatoração é preservar exatamente a identidade visual e a experiência do mapa mental, sem introduzir outras camadas antes que a estrutura esteja estável.

## Camadas

### Frontend

- HTML estruturado em seções: mapa, painel, captura, próximos passos e mural.
- CSS responsável por toda a identidade visual: mapa circular, cores por etapa, painel lateral, dark mode e responsividade.
- JavaScript cuida do estado em memória, renderização do SVG, painel de perguntas, inbox e mural.

### Persistência atual

- Firestore é a fonte persistente por usuário, sempre em `users/{uid}`.
- O estado em memória contém `projects`, `captures`, `relations` e `achievements` para renderização.
- `onSnapshot` sincroniza projetos, capturas, relações e conquistas em tempo real.
- Respostas ficam em `projects/{projectId}/answers` e são carregadas ao abrir o projeto.
- O `localStorage` é mantido apenas como backup e origem de uma importação explícita, nunca como gravação principal.

### Estrutura de responsabilidade

- o mapa reúne áreas e projetos em um único SVG;
- o painel seleciona o projeto ou área e mostra as perguntas de acordo com o modo rápido ou profundo;
- a captura rápida envia itens para o inbox e permite convertê-los em projetos;
- os próximos passos resumem a ação mais útil por projeto ativo;
- o mural expõe conquistas concluídas e itens adicionais do usuário.

## Dependências do protótipo

A funcionalidade atual depende de:

- Firebase Authentication para identificar o usuário;
- Firestore para persistência e sincronização;
- estado em memória em `state`;
- renderização do SVG para os projetos e relações;
- eventos de clique e input diretamente no DOM.

## Fluxos de dados

- criação, atualização e conclusão de projetos usam documentos em `users/{uid}/projects`;
- respostas usam IDs determinísticos por pergunta e debounce de 1 segundo;
- capturas usam `users/{uid}/captures` e podem ser convertidas em projetos;
- relações usam `users/{uid}/relations`;
- conclusões criam conquistas em `users/{uid}/achievements` sem apagar o projeto;
- dados locais antigos só são importados após confirmação do usuário.
