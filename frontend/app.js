import { firebaseEnabled } from './firebase.js';
import { loginWithGoogle, observeAuthState } from './auth.js';
import { completeProject, createCapture, createProject, deleteCapture, getAnswers, listenAchievements, listenCaptures, listenProjects, listenRelations, saveAnswer, updateCapture, updateProject } from './firestore.js';

const AREAS = ['Saúde', 'Trabalho', 'Negócios', 'Estudos', 'Finanças', 'Relações', 'Pessoal'];
const STAGES = ['Capturar', 'Entender', 'Mapear', 'Decidir', 'Agir', 'Medir e aprender'];
const NEXT_QUESTION = 'Qual é o menor próximo passo útil?';
const QUESTIONS = [
  [0, 'O que trouxe isso à minha atenção?', true], [0, 'Isso importa agora ou pode esperar?', false],
  [1, 'Qual é o problema real?', false], [1, 'O que eu realmente quero conseguir com isso?', true],
  [2, 'O que eu controlo?', true], [2, 'O que eu não controlo?', false], [2, 'Que dependências existem?', false],
  [3, 'Quais opções existem?', true], [3, 'É reversível? Qual o custo se der errado?', false],
  [4, NEXT_QUESTION, true], [5, 'Como saberei que funcionou?', true], [5, 'O que eu supunha errado?', false], [5, 'O que muda daqui pra frente?', false]
];

const state = { projects: [], captures: [], relations: [], achievements: [] };
let currentUser = null;
let view = 'map';
let area = null;
let projectId = null;
let guidedIndex = 0;
let fullProject = false;
let viewMode = 'fast';
let answerCache = {};
let answerTimers = {};
let unsubscribers = [];
let sheetValue = null;

function esc(value) { return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function normalizeId(value) { return String(value || 'novo-projeto').trim().replace(/[^a-zA-Z0-9\- _]/g, '').replace(/\s+/g, '-').toLowerCase().slice(0, 40) || 'novo-projeto'; }
function stageName(stage) { return STAGES[Number(stage)] || STAGES[0]; }
function project(id) { return state.projects.find((item) => item.id === id); }
function active(item) { return item.status !== 'completed'; }
function inboxItems() { return state.captures.filter((item) => item.status === 'inbox'); }
function answers(id) { return answerCache[id] || {}; }
function today() { return new Date().toLocaleDateString('pt-BR'); }
function guidedQuestions() { return QUESTIONS.filter((item) => viewMode === 'deep' || item[2]); }

function toast(message) {
  const element = document.getElementById('toast');
  element.textContent = message;
  element.style.display = 'block';
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { element.style.display = 'none'; }, 2800);
}

function openSheet(title, body) {
  document.getElementById('sheetContent').innerHTML = '<h3>' + title + '</h3>' + body;
  document.getElementById('sheet').classList.add('on');
  document.getElementById('sheet').setAttribute('aria-hidden', 'false');
  const first = document.querySelector('#sheetContent textarea, #sheetContent input');
  if (first) setTimeout(() => first.focus(), 50);
}
function closeSheet() { document.getElementById('sheet').classList.remove('on'); document.getElementById('sheet').setAttribute('aria-hidden', 'true'); sheetValue = null; }
function nav() { document.querySelectorAll('.tab-bar button[data-view]').forEach((button) => button.classList.toggle('on', button.dataset.view === view)); }
function card(action, value, title, subtitle, dot) { return '<button class="card" data-action="' + action + '" data-value="' + esc(value) + '"><b>' + (dot == null ? '' : '<i class="dot" style="background:var(--s' + Number(dot) + ')"></i>') + title + '</b><span>' + subtitle + '</span></button>'; }

function renderToday() {
  const activeProjects = state.projects.filter(active);
  const next = activeProjects.filter((item) => item.nextAction).slice(0, 3);
  const captures = inboxItems().slice(0, 3);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  let html = '<h1>' + greeting + ', Matheus</h1><p class="sub">' + (next.length + captures.length ? 'Algumas coisas pedem sua atenção.' : 'Nada pedindo atenção agora.') + '</p><h2>Agora</h2>';
  html += next.length ? next.map((item) => card('open', item.id, esc(item.name || item.id), esc(item.nextAction), item.stage)).join('') : '<p class="sub">Nenhum próximo passo definido ainda.</p>';
  if (captures.length) html += '<h2>Inbox</h2>' + captures.map((item) => card('triage', item.id, esc(item.text), 'toque para organizar')).join('');
  html += '<h2>Contextos ativos</h2>' + (activeProjects.length ? activeProjects.slice(0, 5).map((item) => card('open', item.id, esc(item.name || item.id), esc((item.area || 'Pessoal') + ' · ' + stageName(item.stage)), item.stage)).join('') : '<p class="sub">Jogue alguma coisa na captura e transforme em projeto.</p>');
  return html;
}

function radial(title, items) {
  let html = '<svg class="map-svg" viewBox="0 0 360 360" role="img" aria-label="Mapa">';
  const count = Math.max(items.length, 1);
  items.forEach((item, index) => { const angle = -Math.PI / 2 + index * 2 * Math.PI / count; item.x = 180 + 120 * Math.cos(angle); item.y = 180 + 120 * Math.sin(angle); html += '<line class="link" x1="180" y1="180" x2="' + item.x + '" y2="' + item.y + '"/>'; });
  html += '<circle class="core" cx="180" cy="180" r="42"/><text class="core-label" x="180" y="185">' + esc(title) + '</text>';
  items.forEach((item) => { const label = item.label.length > 16 ? item.label.slice(0, 15) + '…' : item.label; html += '<g class="nd" tabindex="0" role="button" data-action="' + item.action + '" data-value="' + esc(item.value) + '"><circle cx="' + item.x + '" cy="' + item.y + '" r="30" style="fill:' + item.color + '"/><text x="' + item.x + '" y="' + (item.y + 46) + '">' + esc(label) + '</text></g>'; });
  return html + '</svg>';
}

function renderMap() {
  let html = '<div class="bc">' + (area ? '<button data-action="area" data-value="">Vida</button><span>/</span><span>' + esc(area) + '</span>' : '<span>Vida</span>') + '</div><h1>' + esc(area || 'Vida') + '</h1>';
  if (!area) { const items = AREAS.map((name) => ({ action: 'area', value: name, label: name, color: state.projects.some((item) => (item.area || 'Pessoal') === name && active(item)) ? 'var(--blue)' : 'var(--soft)' })); return html + '<p class="sub">Toque em uma área.</p>' + radial('Vida', items); }
  const projects = state.projects.filter((item) => (item.area || 'Pessoal') === area && active(item));
  if (!projects.length) return html + '<p class="sub">Nenhum projeto aqui ainda.</p><div class="row"><button class="btn" data-action="new-project">Criar projeto</button></div>';
  return html + '<p class="sub">A cor mostra a etapa de cada projeto.</p>' + radial(area, projects.map((item) => ({ action: 'open', value: item.id, label: item.name || item.id, color: 'var(--s' + Number(item.stage || 0) + ')' })));
}

function renderProjects() {
  const activeProjects = state.projects.filter(active);
  const completed = state.projects.filter((item) => !active(item));
  let html = '<h1>Projetos</h1><p class="sub">Cada projeto segue o mesmo caminho de perguntas.</p><h2>Ativos</h2>';
  html += activeProjects.length ? activeProjects.map((item) => card('open', item.id, esc(item.name || item.id), esc((item.area || 'Pessoal') + ' · ' + stageName(item.stage)), item.stage)).join('') : '<p class="sub">Nenhum projeto ativo.</p>';
  if (completed.length) html += '<h2>Concluídos</h2>' + completed.map((item) => card('open', item.id, esc(item.name || item.id), esc((item.area || 'Pessoal') + ' · concluído'), item.stage)).join('');
  return html + '<div class="row"><button class="btn g" data-action="new-project">Criar projeto</button></div>';
}

function renderProject() {
  const item = project(projectId);
  if (!item) return '<h1>Projeto não encontrado</h1>';
  const saved = answers(projectId);
  let html = '<div class="bc"><button data-action="back">‹ Voltar</button></div><h1>' + esc(item.name || item.id) + '</h1><p class="sub">' + esc(item.area || 'Pessoal') + ' · ' + stageName(item.stage) + '</p><div class="rib">' + STAGES.map((name, index) => '<i style="' + (index <= Number(item.stage || 0) ? 'background:var(--s' + index + ')' : '') + '" title="' + name + '"></i>').join('') + '</div><div class="row"><button class="btn g" data-action="map-project">Ver mapa completo</button><button class="btn g" data-action="mode">Modo ' + (viewMode === 'fast' ? 'profundo' : 'rápido') + '</button></div>';
  if (fullProject) { html += '<h2>Estrutura completa</h2>' + QUESTIONS.map((question) => '<div class="lbl">' + esc(question[1]) + '</div><textarea data-question="' + esc(question[1]) + '">' + esc(saved[question[1]] || '') + '</textarea>').join(''); return html + '<button class="lk" data-action="guided">Voltar ao fluxo guiado</button>'; }
  const questions = guidedQuestions();
  guidedIndex = Math.max(0, Math.min(guidedIndex, questions.length - 1));
  const current = questions[guidedIndex];
  html += '<div class="guided-meta"><span>' + (guidedIndex + 1) + ' de ' + questions.length + '</span><b>' + STAGES[current[0]] + '</b></div><p class="q">' + esc(current[1]) + '</p><textarea class="big" data-question="' + esc(current[1]) + '" placeholder="Escreva do jeito que vier.">' + esc(saved[current[1]] || '') + '</textarea><div class="row">';
  if (guidedIndex > 0) html += '<button class="btn g" data-action="previous">Anterior</button>';
  if (guidedIndex < questions.length - 1) html += '<button class="btn" data-action="next">Próxima</button>'; else html += '<button class="btn" data-action="finish-reflection">Concluir reflexão</button>';
  html += '</div><button class="lk" data-action="full">Ver estrutura completa</button>';
  if (Number(item.stage) === 5 && item.status !== 'completed') html += '<div class="close"><b>Fechar o ciclo</b><button data-action="stage" data-value="1">Ajustar e entender de novo</button><button data-action="stage" data-value="3">Ajustar e decidir de novo</button><button class="k" data-action="complete">Concluir e levar ao mural</button></div>';
  return html;
}

function renderMe() {
  const achievements = [{ title: 'Primeiro protótipo do Matheus OS', area: 'Pessoal', date: '30/09/2026' }].concat(state.achievements.map((item) => ({ title: item.title, area: item.area, date: item.completedAt?.toDate ? item.completedAt.toDate().toLocaleDateString('pt-BR') : today() })));
  let html = '<h1>Eu</h1><p class="sub">Mural de conquistas</p><div class="wall">';
  achievements.forEach((item) => { html += '<div class="bd"><div class="hx">★</div><b>' + esc(item.title) + '</b><span>' + esc(item.area ? item.area + ', ' + item.date : item.date) + '</span></div>'; });
  for (let index = achievements.length; index < 4; index += 1) html += '<div class="bd lock"><div class="hx">?</div><b>por conquistar</b></div>';
  return html + '</div><input id="achievementInput" placeholder="Algo que você já fez" maxlength="60"><div class="row"><button class="btn" data-action="add-achievement">Adicionar ao mural</button></div>';
}
function renderCaptures() { const captures = inboxItems(); return '<div class="bc"><button data-action="tab" data-view="today">‹ Hoje</button></div><h1>Inbox</h1><p class="sub">Toque em um pensamento para decidir o que ele virou.</p><h2>' + (captures.length ? 'Para organizar' : 'Tudo organizado') + '</h2>' + (captures.length ? captures.map((item) => card('triage', item.id, esc(item.text), 'toque para organizar')).join('') : '<p class="sub">Sua cabeça está limpa por aqui.</p>'); }
function render() { document.getElementById('v').innerHTML = projectId ? renderProject() : view === 'today' ? renderToday() : view === 'map' ? renderMap() : view === 'projects' ? renderProjects() : view === 'me' ? renderMe() : renderCaptures(); nav(); window.scrollTo(0, 0); }

async function openProject(id) { projectId = id; area = null; view = 'map'; fullProject = false; const item = project(id); const questions = guidedQuestions(); guidedIndex = Math.max(0, questions.findIndex((question) => question[0] === Number(item?.stage || 0))); if (currentUser && !answerCache[id]) { const saved = await getAnswers(currentUser.uid, id); answerCache[id] = {}; saved.forEach((answer) => { answerCache[id][answer.question] = answer.answer || ''; }); } render(); }
async function createNewProject(name, projectArea) { if (!currentUser) return; const id = normalizeId(name); if (project(id)) { toast('Esse projeto já existe.'); return; } await createProject(currentUser.uid, id, { name: name.trim().slice(0, 120), area: projectArea, stage: 0, status: 'active', mode: viewMode, nextAction: '' }); closeSheet(); await openProject(id); }
function newProjectSheet() { openSheet('Novo projeto', '<input id="newProjectName" placeholder="Nome do projeto" maxlength="120"><div class="row">' + AREAS.map((name) => '<button class="btn g" data-action="choose-area" data-value="' + esc(name) + '">' + name + '</button>').join('') + '</div>'); }
function captureSheet() { openSheet('O que está na sua cabeça?', '<textarea id="captureText" class="big" placeholder="Escreva do jeito que vier."></textarea><div class="row"><button class="btn" data-action="save-capture">Capturar</button><button class="btn g" data-action="close-sheet">Fechar</button></div>'); }
function triage(id) { const item = state.captures.find((capture) => capture.id === id); if (!item) return; openSheet('O que isso virou?', '<p class="quote">' + esc(item.text) + '</p><button class="card" data-action="convert-capture" data-value="' + id + '"><b>Virar projeto</b></button><button class="card" data-action="discard-capture" data-value="' + id + '"><b>Descartar</b></button>'); }

async function action(event) {
  if (event.target.id === 'sheet') { closeSheet(); return; }
  const button = event.target.closest('[data-action]'); if (!button) return;
  const name = button.dataset.action; const value = button.dataset.value;
  if (name === 'tab') { view = button.dataset.view || value; projectId = null; area = null; render(); return; }
  if (name === 'capture') { captureSheet(); return; }
  if (name === 'close-sheet') { closeSheet(); return; }
  if (name === 'open') { await openProject(value); return; }
  if (name === 'area') { area = value || null; view = 'map'; render(); return; }
  if (name === 'back') { projectId = null; area = null; view = 'map'; render(); return; }
  if (name === 'new-project') { newProjectSheet(); return; }
  if (name === 'choose-area') { const projectName = document.getElementById('newProjectName')?.value || ''; if (projectName.trim()) await createNewProject(projectName, value); return; }
  if (name === 'triage') { triage(value); return; }
  if (name === 'save-capture') { const text = document.getElementById('captureText')?.value.trim(); if (text) { await createCapture(currentUser.uid, text); closeSheet(); toast('Capturado.'); } return; }
  if (name === 'discard-capture') { await deleteCapture(currentUser.uid, value); closeSheet(); toast('Descartado.'); return; }
  if (name === 'convert-capture') { const item = state.captures.find((capture) => capture.id === value); if (item) { sheetValue = value; openSheet('Escolha uma área', AREAS.map((itemArea) => '<button class="card" data-action="convert-area" data-value="' + esc(itemArea) + '"><b>' + itemArea + '</b></button>').join('')); } return; }
  if (name === 'convert-area') { const item = state.captures.find((capture) => capture.id === sheetValue); if (item) { await createNewProject(item.text, value); await updateCapture(currentUser.uid, item.id, { status: 'converted', convertedProjectId: normalizeId(item.text) }); } return; }
  if (name === 'mode') { viewMode = viewMode === 'fast' ? 'deep' : 'fast'; guidedIndex = 0; render(); return; }
  if (name === 'full' || name === 'map-project') { fullProject = true; render(); return; }
  if (name === 'guided') { fullProject = false; render(); return; }
  if (name === 'previous') { guidedIndex = Math.max(0, guidedIndex - 1); render(); return; }
  if (name === 'next') { guidedIndex = Math.min(guidedQuestions().length - 1, guidedIndex + 1); if (currentUser) await updateProject(currentUser.uid, projectId, { stage: guidedQuestions()[guidedIndex][0] }); render(); return; }
  if (name === 'finish-reflection') { fullProject = true; render(); return; }
  if (name === 'stage') { await updateProject(currentUser.uid, projectId, { stage: Number(value) }); return; }
  if (name === 'complete') { await completeProject(currentUser.uid, projectId, project(projectId)?.name); projectId = null; view = 'me'; render(); toast('Conquista desbloqueada.'); return; }
  if (name === 'add-achievement') { const title = document.getElementById('achievementInput')?.value.trim(); if (title) await createProject(currentUser.uid, normalizeId(title), { name: title, area: '', stage: 5, status: 'completed' }); }
}

function input(event) { const question = event.target.dataset.question; if (!question || !projectId || !currentUser) return; answerCache[projectId] = answerCache[projectId] || {}; answerCache[projectId][question] = event.target.value; const timer = projectId + question; clearTimeout(answerTimers[timer]); answerTimers[timer] = setTimeout(() => saveAnswer(currentUser.uid, projectId, question, event.target.value).catch(console.warn), 1000); }
function showAuth(visible) { document.getElementById('authGate').classList.toggle('hidden', !visible); }

async function authState(user) {
  currentUser = user;
  if (!firebaseEnabled) { showAuth(false); render(); return; }
  if (!user) { showAuth(true); render(); return; }
  showAuth(false);
  unsubscribers.forEach((unsubscribe) => unsubscribe());
  unsubscribers = [listenProjects(user.uid, (items) => { state.projects = items; render(); }), listenCaptures(user.uid, (items) => { state.captures = items; render(); }), listenRelations(user.uid, (items) => { state.relations = items; render(); }), listenAchievements(user.uid, (items) => { state.achievements = items; render(); })];
}

document.addEventListener('click', (event) => action(event).catch((error) => { console.warn(error); toast('Não foi possível concluir essa ação.'); }));
document.addEventListener('input', input);
document.getElementById('googleLoginBtn').addEventListener('click', () => loginWithGoogle().catch(() => toast('Não foi possível entrar com Google.')));
if (firebaseEnabled) observeAuthState(authState); else showAuth(false);
render();
