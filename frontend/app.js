import { firebaseEnabled } from './firebase.js';
import { loginWithGoogle, logoutCurrentUser, observeAuthState } from './auth.js';
import {
  completeProject,
  createCapture,
  createAchievement,
  createProject,
  createRelation,
  deleteCapture,
  getAchievements,
  getAnswers,
  getCaptures,
  getProjects,
  getRelations,
  listenAchievements,
  listenCaptures,
  listenProjects,
  listenRelations,
  loadAnswers,
  saveAnswer,
  updateCapture,
  updateProject
} from './firestore.js';

var ST = ['Capturar', 'Entender', 'Mapear', 'Decidir', 'Agir', 'Medir e aprender'];
var Q = [
  ['Capturar', ['O que trouxe isso à minha atenção?', 'Isso importa agora ou pode esperar?']],
  ['Entender', ['Qual é o problema real?', 'O que eu quero conseguir?']],
  ['Mapear', ['O que eu controlo?', 'O que eu não controlo?', 'Que dependências existem?']],
  ['Decidir', ['Quais opções existem?', 'É reversível? Qual o custo se der errado?']],
  ['Agir', ['Qual é o menor próximo passo útil?']],
  ['Medir e aprender', ['Como saberei que funcionou?', 'O que eu supunha errado?', 'O que muda daqui pra frente?']]
];
var FAST = {
  'O que trouxe isso à minha atenção?': 1,
  'O que eu quero conseguir?': 1,
  'O que eu controlo?': 1,
  'Qual é o menor próximo passo útil?': 1,
  'Como saberei que funcionou?': 1
};
var AREAS = [
  ['Trabalho', []],
  ['Negócios', [['Opportunity Score', 2], ['Landing unhas', 4]]],
  ['Estudos', [['Tutor de inglês', 4]]],
  ['Pessoal', [['Matheus OS', 1], ['Remix “Let Go”', 5]]],
  ['Finanças', []],
  ['Relações', []],
  ['Saúde', []]
];
var EXTRA = [['Landing unhas', 'Opportunity Score'], ['Tutor de inglês', 'Matheus OS']];
var NEXTQ = 'Qual é o menor próximo passo útil?';
var CX = 400, CY = 300, N = [], L = [], by = {}, sel = 'Matheus OS', mode = 'fast';
var currentUser = null;
var answerCache = {};
var answerTimers = {};
var unsubscribers = [];
var legacyStore = loadLocalStore();

const state = {
  projects: [],
  captures: [],
  relations: [],
  achievements: []
};

function loadLocalStore() {
  try {
    return JSON.parse(localStorage.getItem('mos') || '{}');
  } catch (e) {
    return {};
  }
}

function normalizeProjectId(value) {
  return String(value || 'novo-projeto').trim().replace(/[^a-zA-Z0-9\- _]/g, '').replace(/\s+/g, '-').toLowerCase().slice(0, 40) || 'novo-projeto';
}

function esc(value) {
  return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function updateAuthBadge(user) {
  var el = document.getElementById('authUser');
  if (!el) return;
  if (!user) {
    el.innerHTML = '';
    return;
  }
  var name = String(user.displayName || user.email || 'Usuário').split(' ')[0];
  el.innerHTML = '<span>' + esc(name) + '</span><button id="logoutBtn" type="button">Sair</button>';
  var btn = document.getElementById('logoutBtn');
  if (btn) btn.addEventListener('click', function () { logoutCurrentUser().catch(console.warn); });
}

function showAuthGate(visible) {
  var gate = document.getElementById('authGate');
  if (gate) gate.classList.toggle('hidden', !visible);
}

function showMigrationGate(visible) {
  var gate = document.getElementById('migrationGate');
  if (gate) gate.classList.toggle('hidden', !visible);
}

function projectById(id) {
  return state.projects.find(function (project) { return project.id === id; }) || null;
}

function projectData(id) {
  var normalizedId = normalizeProjectId(id);
  var remote = projectById(normalizedId);
  if (remote) return remote;
  for (var i = 0; i < AREAS.length; i++) {
    for (var j = 0; j < AREAS[i][1].length; j++) {
      if (AREAS[i][1][j][0] === id) return { id: normalizedId, name: id, area: AREAS[i][0], stage: AREAS[i][1][j][1], status: 'active' };
    }
  }
  return { id: normalizedId, name: id, area: 'Pessoal', stage: 0, status: 'active' };
}

function alive(id) {
  return projectData(id).status !== 'completed' && !legacyStore[id]?.done;
}

function stageOf(id) {
  var project = projectData(id);
  return project.stage != null ? Number(project.stage) : 0;
}

function answersFor(id) {
  return answerCache[normalizeProjectId(id)] || {};
}

function projectNodes() {
  var result = [];
  AREAS.forEach(function (area) {
    area[1].forEach(function (project) { result.push({ id: project[0], area: area[0], stage: project[1] }); });
  });
  state.projects.forEach(function (project) {
    if (!result.some(function (item) { return normalizeProjectId(item.id) === project.id; })) {
      result.push({ id: project.name, area: project.area || 'Pessoal', stage: project.stage || 0 });
    }
  });
  return result;
}

function pol(angle, radius) {
  return [CX + radius * Math.cos(angle), CY + radius * Math.sin(angle)];
}

function build() {
  N = [];
  L = [];
  by = {};
  var nodes = projectNodes();
  var grouped = {};
  AREAS.forEach(function (area) { grouped[area[0]] = []; });
  nodes.forEach(function (project) { (grouped[project.area] || grouped.Pessoal).push(project); });

  AREAS.forEach(function (area, i) {
    var projects = grouped[area[0]] || [];
    var angle = -Math.PI / 2 + i * 2 * Math.PI / AREAS.length;
    var areaPoint = pol(angle, 135);
    var areaNode = { id: area[0], k: 'a', x: areaPoint[0], y: areaPoint[1], empty: !projects.length };
    N.push(areaNode);
    by[areaNode.id] = areaNode;
    L.push(['core', areaNode.id]);
    projects.forEach(function (project, index) {
      var point = pol(angle + (index - (projects.length - 1) / 2) * 0.36, 250);
      var projectNode = { id: project.id, k: 'p', x: point[0], y: point[1], st: project.stage };
      N.push(projectNode);
      by[projectNode.id] = projectNode;
      L.push([areaNode.id, projectNode.id]);
    });
  });
  by.core = { x: CX, y: CY };
}

function draw() {
  var svg = '<svg viewBox="0 0 800 600" role="img" aria-label="Mapa de áreas e projetos">';
  L.forEach(function (link) {
    if (!alive(link[0]) || !alive(link[1])) return;
    var a = by[link[0]], b = by[link[1]], hot = link[0] === sel || link[1] === sel ? ' hot' : '';
    svg += '<line class="lk' + hot + '" x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '"/>';
  });
  state.relations.forEach(function (relation) {
    var a = by[relation.from], b = by[relation.to];
    if (!a || !b || !alive(relation.from) || !alive(relation.to)) return;
    var hot = relation.from === sel || relation.to === sel ? ' hot' : '';
    svg += '<line class="lk x' + hot + '" x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '"/>';
  });
  EXTRA.forEach(function (link) {
    if (!by[link[0]] || !by[link[1]] || !alive(link[0]) || !alive(link[1])) return;
    var a = by[link[0]], b = by[link[1]], hot = link[0] === sel || link[1] === sel ? ' hot' : '';
    svg += '<line class="lk x' + hot + '" x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '"/>';
  });
  svg += '<g class="core"><circle cx="' + CX + '" cy="' + CY + '" r="40"/><text x="' + CX + '" y="' + (CY + 4) + '" text-anchor="middle">Mapa-mãe</text></g>';
  N.forEach(function (node) {
    if (!alive(node.id)) return;
    var cls = node.k === 'a' ? 'n a' + (node.empty ? ' empty' : '') : 'n p';
    var radius = node.k === 'a' ? 36 : 30;
    if (node.id === sel) cls += ' sel';
    svg += '<g class="' + cls + '" tabindex="0" role="button" data-id="' + esc(node.id) + '" aria-label="' + esc(node.id) + '">';
    if (node.k === 'p') svg += '<circle class="b" cx="' + node.x + '" cy="' + node.y + '" r="' + radius + '" style="fill:var(--s' + stageOf(node.id) + ')"/>';
    else svg += '<circle cx="' + node.x + '" cy="' + node.y + '" r="' + radius + '"/>';
    svg += '<circle class="r" cx="' + node.x + '" cy="' + node.y + '" r="' + (radius + 5) + '"/>';
    svg += '<text x="' + node.x + '" y="' + (node.k === 'p' ? node.y + radius + 17 : node.y + 4) + '">' + esc(node.id) + '</text></g>';
  });
  document.getElementById('map').innerHTML = svg + '</svg>';
}

function panel() {
  var selected = projectData(sel);
  var isProject = !!by[sel] && by[sel].k === 'p';
  var html = '<h2>' + esc(sel) + '</h2><p class="sub">' + (isProject ? 'Projeto' : 'Área') + '</p>';
  if (isProject) {
    html += '<div class="rib">';
    ST.forEach(function (title, index) {
      html += '<button data-st="' + index + '" class="' + (stageOf(sel) === index ? 'on' : '') + '" style="' + (stageOf(sel) === index ? 'background:var(--s' + index + ')' : '') + '">' + title + '</button>';
    });
    html += '</div><div class="loop"></div><p class="lc">o que aprendi volta para a próxima decisão</p>';
    if (stageOf(sel) === 5 && selected.status !== 'completed') {
      html += '<div class="close"><b>Fechar o ciclo</b><button data-x="u">Ajustar e entender de novo</button><button data-x="d">Ajustar e decidir de novo</button><button class="k" data-x="k">Concluir e levar ao mural</button></div>';
    }
  }
  html += '<div class="seg"><button data-m="fast" class="' + (mode === 'fast' ? 'on' : '') + '">Modo rápido</button><button data-m="deep" class="' + (mode === 'deep' ? 'on' : '') + '">Modo profundo</button></div>';
  Q.forEach(function (group, groupIndex) {
    var questions = group[1].filter(function (question) { return mode === 'deep' || FAST[question]; });
    if (!questions.length) return;
    html += '<div class="grp"><h3><i style="background:var(--s' + groupIndex + ')"></i>' + group[0] + '</h3>';
    questions.forEach(function (question) {
      var value = answersFor(sel)[question] || (legacyStore[sel]?.a?.[question]) || '';
      html += '<label><span>' + question + '</span><textarea data-q="' + esc(question) + '">' + esc(value) + '</textarea></label>';
    });
    html += '</div>';
  });
  html += '<p class="hint">Linhas tracejadas ligam projetos que se relacionam. A cor do círculo mostra em que etapa o projeto está.</p>';
  document.getElementById('panel').innerHTML = html;
}

function renderAll() {
  build();
  if (!by[sel] || !alive(sel)) sel = 'Pessoal';
  draw();
  panel();
  home();
  mural();
  steps();
  inbox();
}

function pick(id) {
  sel = id;
  renderAll();
  if (window.innerWidth <= 820) document.getElementById('panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (by[id]?.k === 'p' && currentUser) loadProjectAnswers(id);
}

async function ensureProject(id) {
  var project = projectData(id);
  var normalizedId = normalizeProjectId(id);
  if (!currentUser) return normalizedId;
  if (!projectById(normalizedId)) {
    await createProject(currentUser.uid, normalizedId, {
      name: project.name || id,
      area: project.area || 'Pessoal',
      stage: project.stage || 0,
      status: 'active',
      mode: mode,
      nextAction: ''
    });
  }
  return normalizedId;
}

async function loadProjectAnswers(projectId) {
  var id = normalizeProjectId(projectId);
  if (!currentUser || answerCache[id]) return;
  try {
    var answers = await loadAnswers(currentUser.uid, id);
    answerCache[id] = {};
    answers.forEach(function (item) { answerCache[id][item.question] = item.answer || ''; });
    if (sel === projectId) panel();
  } catch (error) {
    console.warn('Não foi possível carregar respostas:', error);
  }
}

async function importLocalDataToFirebase(uid) {
  var data = loadLocalStore();
  var captures = data.inbox || [];
  for (var i = 0; i < captures.length; i++) await createCapture(uid, captures[i]);
  var imported = {};
  (data.custom || []).forEach(function (item) { imported[normalizeProjectId(item[0])] = { name: item[0], area: item[1] }; });
  Object.keys(data).forEach(function (key) {
    if (['custom', 'inbox', 'mural', 'mosMigrated'].includes(key) || !data[key]?.st) return;
    imported[normalizeProjectId(key)] = { name: key, area: 'Pessoal', stage: data[key].st, completed: !!data[key].done };
  });
  for (var id in imported) {
    var item = imported[id];
    await createProject(uid, id, { name: item.name, area: item.area || 'Pessoal', stage: item.stage || 0, status: item.completed ? 'completed' : 'active', mode: 'fast', nextAction: '', completedAt: item.completed ? new Date() : null });
    var answers = data[item.name]?.a || {};
    for (var question in answers) await saveAnswer(uid, id, question, answers[question]);
  }
  for (var relationIndex = 0; relationIndex < (data.relations || []).length; relationIndex++) {
    await createRelation(uid, data.relations[relationIndex]);
  }
  for (var achievementIndex = 0; achievementIndex < (data.mural || []).length; achievementIndex++) {
    var achievement = data.mural[achievementIndex];
    await createAchievement(uid, {
      title: achievement.t,
      area: achievement.a || '',
      projectId: normalizeProjectId(achievement.t) + '-' + achievementIndex,
      completedAt: new Date()
    });
  }
}

async function checkMigration(user) {
  var data = loadLocalStore();
  if (!Object.keys(data).length || localStorage.getItem('mosMigrated')) return;
  var remoteProjects = await getProjects(user.uid);
  var remoteCaptures = await getCaptures(user.uid);
  var remoteRelations = await getRelations(user.uid);
  var remoteAchievements = await getAchievements(user.uid);
  if (!remoteProjects.length && !remoteCaptures.length && !remoteRelations.length && !remoteAchievements.length) showMigrationGate(true);
}

function subscribeUserData(user) {
  unsubscribers.forEach(function (unsubscribe) { unsubscribe(); });
  unsubscribers = [];
  answerCache = {};
  unsubscribers.push(listenProjects(user.uid, function (items) { state.projects = items; renderAll(); }));
  unsubscribers.push(listenCaptures(user.uid, function (items) { state.captures = items; inbox(); }));
  unsubscribers.push(listenRelations(user.uid, function (items) { state.relations = items; draw(); }));
  unsubscribers.push(listenAchievements(user.uid, function (items) { state.achievements = items; mural(); }));
  loadProjectAnswers(sel);
}

async function handleAuthState(user) {
  currentUser = user;
  if (!firebaseEnabled) {
    showAuthGate(false);
    updateAuthBadge(null);
    return;
  }
  if (!user) {
    unsubscribers.forEach(function (unsubscribe) { unsubscribe(); });
    unsubscribers = [];
    state.projects = [];
    state.captures = [];
    state.relations = [];
    state.achievements = [];
    showAuthGate(true);
    updateAuthBadge(null);
    renderAll();
    return;
  }
  showAuthGate(false);
  updateAuthBadge(user);
  subscribeUserData(user);
  try { await checkMigration(user); } catch (error) { console.warn('Não foi possível verificar a migração:', error); }
}

function today() {
  return new Date().toLocaleDateString('pt-BR');
}

function home() {
  var activeProjects = state.projects.filter(function (project) { return project.status !== 'completed'; });
  var activeSteps = activeProjects.filter(function (project) { return project.nextAction; }).slice(0, 3);
  var recentCaptures = state.captures.filter(function (capture) { return capture.status === 'inbox'; }).slice(0, 3);
  var recentAchievements = state.achievements.slice(0, 2);
  var html = '<div class="home-heading"><div><span class="eyebrow">PAINEL DE CLAREZA</span><h2>O que merece sua atenção agora?</h2><p>Um resumo leve do que está vivo no seu sistema.</p></div><a class="home-action" href="#cap">＋ Capturar pensamento</a></div>';
  html += '<div class="home-grid">';
  html += '<article class="focus-card"><span class="card-kicker">FOCO ATUAL</span><strong>' + esc(activeSteps[0]?.nextAction || 'Nada precisa ser resolvido agora.') + '</strong><span>' + esc(activeSteps[0] ? activeSteps[0].name + ' · ' + stageName(activeSteps[0].stage) : 'Você pode começar por uma captura.') + '</span></article>';
  html += '<article class="summary-card"><span class="card-kicker">PROJETOS ATIVOS</span><strong>' + activeProjects.length + '</strong><span>contextos em movimento</span></article>';
  html += '<article class="summary-card"><span class="card-kicker">CAPTURAS PENDENTES</span><strong>' + recentCaptures.length + '</strong><span>ideias aguardando espaço</span></article>';
  html += '</div>';
  html += '<div class="home-columns"><article class="home-list"><div class="section-head"><div><span class="card-kicker">PRÓXIMOS PASSOS</span><h3>Pequenos movimentos</h3></div><a href="#next">Ver todos</a></div>';
  if (!activeSteps.length) html += '<p class="empty-copy">Nenhum próximo passo registrado ainda.</p>';
  activeSteps.forEach(function (project) { html += '<a class="home-step" href="#panel" data-home-project="' + esc(project.name) + '"><i style="background:var(--s' + Number(project.stage || 0) + ')"></i><span><b>' + esc(project.name) + '</b><small>' + esc(project.nextAction) + '</small></span><em>' + esc(stageName(project.stage)) + '</em></a>'; });
  html += '</article><article class="home-list"><div class="section-head"><div><span class="card-kicker">MEMÓRIA RECENTE</span><h3>O que está chegando</h3></div><a href="#cap">Inbox</a></div>';
  if (!recentCaptures.length && !recentAchievements.length) html += '<p class="empty-copy">Sua cabeça está limpa por aqui.</p>';
  recentCaptures.forEach(function (capture) { html += '<div class="home-capture"><span class="capture-mark">＋</span><span>' + esc(capture.text) + '</span></div>'; });
  recentAchievements.forEach(function (achievement) { html += '<div class="home-capture"><span class="capture-mark achievement-mark">✦</span><span>' + esc(achievement.title) + '</span></div>'; });
  html += '</article></div>';
  document.getElementById('home').innerHTML = html;
  document.querySelectorAll('[data-home-project]').forEach(function (link) { link.addEventListener('click', function () { pick(link.dataset.homeProject); }); });
}

function stageName(value) {
  return ST[Number(value)] || 'Capturar';
}

function mural() {
  var achievements = [{ title: 'Primeiro protótipo do Matheus OS', area: 'Pessoal', completedAt: '30/09/2026' }].concat(state.achievements);
  var html = '<h2>Mural de conquistas</h2><p class="sub">Tudo o que você conclui, ou já fez antes, fica aqui.</p><div class="wall">';
  achievements.forEach(function (item) {
    var date = item.completedAt?.toDate ? item.completedAt.toDate().toLocaleDateString('pt-BR') : (item.completedAt || today());
    html += '<div class="bd"><div class="hx">★</div><b>' + esc(item.title || item.t) + '</b><span>' + esc(item.area ? item.area + ', ' + date : date) + '</span></div>';
  });
  for (var i = 0; i < Math.max(0, 3 - state.achievements.length); i++) html += '<div class="bd lock"><div class="hx">?</div><b>por conquistar</b></div>';
  html += '</div><div class="add"><input id="nw" placeholder="Algo que você já fez" maxlength="60"><button id="na">Adicionar ao mural</button></div>';
  document.getElementById('mural').innerHTML = html;
}

function steps() {
  var html = '<h2>Próximos passos</h2><p class="sub">O menor passo útil de cada projeto ativo. Toque para abrir.</p><ul class="nx">';
  N.forEach(function (node) {
    if (node.k !== 'p' || !alive(node.id)) return;
    var value = answersFor(node.id)[NEXTQ] || legacyStore[node.id]?.a?.[NEXTQ] || '';
    html += '<li><button data-p="' + esc(node.id) + '"><i style="background:var(--s' + stageOf(node.id) + ')"></i><b>' + esc(node.id) + '</b><span' + (value ? '' : ' class="e"') + '>' + esc(value || 'defina o próximo passo') + '</span></button></li>';
  });
  document.getElementById('next').innerHTML = html + '</ul>';
}

function inbox() {
  var areas = AREAS.map(function (area) { return '<option>' + esc(area[0]) + '</option>'; }).join('');
  var html = '';
  state.captures.filter(function (capture) { return capture.status !== 'discarded' && capture.status !== 'converted'; }).forEach(function (capture) {
    html += '<li><span>' + esc(capture.text) + '</span><select data-id="' + esc(capture.id) + '" aria-label="Área"><option value="">Área…</option>' + areas + '</select><button data-c="' + esc(capture.id) + '">Virar projeto</button><button data-r="' + esc(capture.id) + '" aria-label="Descartar">×</button></li>';
  });
  document.getElementById('inbox').innerHTML = html;
}

async function capture() {
  var input = document.getElementById('ci');
  var value = input.value.trim();
  if (!value || !currentUser) return;
  await createCapture(currentUser.uid, value);
  input.value = '';
  input.focus();
}

document.getElementById('map').addEventListener('click', function (event) {
  var node = event.target.closest('.n');
  if (node) pick(node.dataset.id);
});

document.getElementById('map').addEventListener('keydown', function (event) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  var node = event.target.closest('.n');
  if (node) { event.preventDefault(); pick(node.dataset.id); }
});

document.getElementById('panel').addEventListener('click', async function (event) {
  var button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.m) { mode = button.dataset.m; panel(); return; }
  if (button.dataset.st != null) {
    var id = await ensureProject(sel);
    await updateProject(currentUser.uid, id, { stage: Number(button.dataset.st), mode });
    return;
  }
  if (button.dataset.x) {
    var action = button.dataset.x;
    var id = await ensureProject(sel);
    if (action === 'u') await updateProject(currentUser.uid, id, { stage: 1 });
    else if (action === 'd') await updateProject(currentUser.uid, id, { stage: 3 });
    else { await completeProject(currentUser.uid, id, sel); sel = projectData(sel).area || 'Pessoal'; }
  }
});

document.getElementById('panel').addEventListener('input', function (event) {
  var textarea = event.target;
  if (!textarea.dataset.q || !currentUser) return;
  var id = normalizeProjectId(sel);
  answerCache[id] = answerCache[id] || {};
  answerCache[id][textarea.dataset.q] = textarea.value;
  var timerId = id + textarea.dataset.q;
  clearTimeout(answerTimers[timerId]);
  answerTimers[timerId] = setTimeout(async function () {
    try {
      await ensureProject(sel);
      await saveAnswer(currentUser.uid, id, textarea.dataset.q, textarea.value);
    } catch (error) { console.warn('Não foi possível salvar resposta:', error); }
  }, 1000);
  if (textarea.dataset.q === NEXTQ) steps();
});

document.getElementById('next').addEventListener('click', function (event) {
  var button = event.target.closest('button');
  if (button) pick(button.dataset.p);
});

document.getElementById('cb').addEventListener('click', function () { capture().catch(console.warn); });
document.getElementById('ci').addEventListener('keydown', function (event) { if (event.key === 'Enter') capture().catch(console.warn); });

document.getElementById('inbox').addEventListener('click', async function (event) {
  var button = event.target.closest('button');
  if (!button || !currentUser) return;
  var id = button.dataset.r || button.dataset.c;
  if (button.dataset.r) { await deleteCapture(currentUser.uid, id); return; }
  var select = document.querySelector('#inbox select[data-id="' + id + '"]');
  if (!select.value) { select.focus(); return; }
  var item = state.captures.find(function (captureItem) { return captureItem.id === id; });
  if (!item) return;
  var projectId = normalizeProjectId(item.text);
  await createProject(currentUser.uid, projectId, { name: item.text, area: select.value, stage: 0, status: 'active', mode: 'fast', nextAction: '' });
  await updateCapture(currentUser.uid, id, { status: 'converted', convertedProjectId: projectId });
  sel = item.text;
});

document.getElementById('mural').addEventListener('click', function (event) {
  if (event.target.id !== 'na' || !currentUser) return;
  var input = document.getElementById('nw');
  var value = input.value.trim();
  if (!value) return;
  createAchievement(currentUser.uid, { title: value, area: '', projectId: normalizeProjectId(value) }).catch(console.warn);
});

document.getElementById('googleLoginBtn').addEventListener('click', function () {
  loginWithGoogle().catch(function (error) { console.warn(error); window.alert('Não foi possível entrar com Google. Verifique a configuração do Firebase.'); });
});

document.getElementById('migrationImportBtn').addEventListener('click', async function () {
  if (!currentUser) return;
  var button = document.getElementById('migrationImportBtn');
  button.disabled = true;
  try {
    await importLocalDataToFirebase(currentUser.uid);
    localStorage.setItem('mosMigrated', 'true');
    showMigrationGate(false);
  } catch (error) {
    button.disabled = false;
    console.warn(error);
    window.alert('Não foi possível importar os dados antigos.');
  }
});

document.getElementById('migrationIgnoreBtn').addEventListener('click', function () {
  localStorage.setItem('mosMigrated', 'true');
  showMigrationGate(false);
});

if (firebaseEnabled) {
  observeAuthState(handleAuthState);
  showAuthGate(true);
} else {
  showAuthGate(false);
}

build();
draw();
panel();
mural();
steps();
inbox();
