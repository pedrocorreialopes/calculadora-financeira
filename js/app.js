/**
 * RPN Financial Calculator (inspirada na experiência da 12C Platinum)
 * Implementação: Vanilla JS, foco em performance e previsibilidade.
 *
 * Nota: este arquivo implementa o motor RPN + UI. Funções financeiras avançadas
 * serão expandidas em etapas (TVM, NPV/IRR, AMORT, datas, estatística).
 */

const $ = (sel, root = document) => root.querySelector(sel);

// ---------- Utilidades (format/parse) ----------
const LOCALE = 'pt-BR';

function round2(n){
  // Evita problemas comuns de floating point na apresentação.
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function formatMoney(n){
  const v = Number.isFinite(n) ? round2(n) : 0;
  return v.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function clamp(n, a, b){
  return Math.min(b, Math.max(a, n));
}

function debounce(fn, wait = 120){
  let t;
  return (...args) => {
    window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), wait);
  };
}

// ---------- Estado (persistência local) ----------
const STORAGE_KEY = 'rpn12c_state_v1';

const defaultState = () => ({
  // stack
  x: 0, y: 0, z: 0, t: 0,
  lastX: 0,
  // entrada
  entry: '',
  entering: false,
  shift: null, // 'f' | 'g' | null
  // modos
  begin: false,
  is12x: true,
  dayCount: '30/360', // ou 'ACT/ACT'
  // registros
  regs: Array.from({length: 10}, () => 0),
  // TVM
  tvm: { n: null, i: null, pv: null, pmt: null, fv: null },
  // Cash flow
  cf: { c0: null, cfs: [], njs: [] },
  // estatística (Σ)
  stats: { n: 0, sumX: 0, sumX2: 0 },
});

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
  }catch{
    return defaultState();
  }
}

function saveState(){
  // Persistência barata, mas evita gravar a cada keypress de número.
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();
const saveStateDebounced = debounce(saveState, 250);

// ---------- Motor RPN (mínimo viável) ----------
function liftStack(){
  state.t = state.z;
  state.z = state.y;
  state.y = state.x;
}

function dropStack(){
  state.x = state.y;
  state.y = state.z;
  state.z = state.t;
}

function setX(v){
  state.lastX = state.x;
  state.x = Number.isFinite(v) ? v : 0;
}

function commitEntry(){
  if(!state.entering) return;
  const num = parseEntryToNumber(state.entry);
  setX(num);
  state.entry = '';
  state.entering = false;
}

function parseEntryToNumber(entry){
  if(!entry || entry === '-' || entry === '+') return 0;
  // Aceita ponto como decimal; remove milhares.
  const normalized = entry.replace(/\s/g,'');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function startEntryIfNeeded(){
  if(!state.entering){
    state.entry = '';
    state.entering = true;
  }
}

function inputDigit(d){
  startEntryIfNeeded();
  // limita tamanho para evitar overflow visual
  if(state.entry.length >= 18) return;
  if(state.entry === '0') state.entry = '';
  state.entry += String(d);
}

function inputDot(){
  startEntryIfNeeded();
  if(state.entry.includes('.')) return;
  if(state.entry === '' || state.entry === '-') state.entry += '0';
  state.entry += '.';
}

function opEnter(){
  if(state.entering){
    // ENTER termina entrada e duplica X no topo
    commitEntry();
    liftStack();
    // após lift, Y recebe X anterior (por liftStack), então repomos X
    state.x = state.y;
  }else{
    liftStack();
  }
}

function opClx(){
  state.entry = '';
  state.entering = false;
  setX(0);
}

function opClearAll(){
  state = defaultState();
  syncTogglesFromState();
  render();
  saveState();
  toast('Reset completo.');
}

function opChs(){
  if(state.entering){
    if(state.entry.startsWith('-')) state.entry = state.entry.slice(1);
    else state.entry = '-' + (state.entry || '');
  }else{
    setX(-state.x);
  }
}

function opSwap(){
  commitEntry();
  const tmp = state.x;
  state.x = state.y;
  state.y = tmp;
}

function binaryOp(fn){
  commitEntry();
  const x = state.x;
  const y = state.y;
  setX(fn(y, x));
  state.y = state.z;
  state.z = state.t;
}

function opAdd(){ binaryOp((a,b)=>a+b); }
function opSub(){ binaryOp((a,b)=>a-b); }
function opMul(){ binaryOp((a,b)=>a*b); }
function opDiv(){ binaryOp((a,b)=> b===0 ? NaN : a/b); }
function opSqrt(){ commitEntry(); setX(state.x < 0 ? NaN : Math.sqrt(state.x)); }
function opPow(){ binaryOp((a,b)=>Math.pow(a,b)); }

// ---------- UI ----------
const elDisplay = $('#display');
const elX = $('#xVal');
const elY = $('#yVal');
const elZ = $('#zVal');
const elT = $('#tVal');

const elModeBeginEnd = $('#modeBeginEnd');
const elMode12x1x = $('#mode12x1x');
const elModeDayCount = $('#modeDayCount');

const elHelp = $('#help');
const elHelpStatus = $('#helpStatus');
const elStateGrid = $('#stateGrid');

const toastEl = (() => {
  const d = document.createElement('div');
  d.className = 'toast';
  d.setAttribute('role','status');
  d.setAttribute('aria-live','polite');
  document.body.appendChild(d);
  return d;
})();

let toastTimer;
function toast(msg){
  toastEl.textContent = msg;
  toastEl.classList.add('toast--show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('toast--show'), 1400);
}

function displayValue(){
  // Se está digitando, mostra a entrada crua (com vírgula por estética).
  if(state.entering){
    const txt = state.entry || '0';
    // converte '.' -> ',' para pt-BR sem quebrar parse
    return txt.replace('.', ',');
  }
  return formatMoney(state.x);
}

function render(){
  elDisplay.textContent = displayValue();
  elX.textContent = formatMoney(state.x);
  elY.textContent = formatMoney(state.y);
  elZ.textContent = formatMoney(state.z);
  elT.textContent = formatMoney(state.t);

  elModeBeginEnd.textContent = state.begin ? 'BEGIN' : 'END';
  elMode12x1x.textContent = state.is12x ? '12×' : '1×';
  elModeDayCount.textContent = state.dayCount;

  renderStatePanel();
}

function renderStatePanel(){
  const items = [
    { title: 'LAST X', value: formatMoney(state.lastX) },
    { title: 'Shift', value: state.shift ? state.shift.toUpperCase() : '—' },
    { title: 'Reg 0..2', value: `R0=${formatMoney(state.regs[0])} • R1=${formatMoney(state.regs[1])} • R2=${formatMoney(state.regs[2])}` },
    { title: 'TVM (n,i,pv,pmt,fv)', value: `${state.tvm.n ?? '—'}, ${state.tvm.i ?? '—'}, ${state.tvm.pv ?? '—'}, ${state.tvm.pmt ?? '—'}, ${state.tvm.fv ?? '—'}` },
    { title: 'CF', value: `C0=${state.cf.c0 ?? '—'} • CFj=${state.cf.cfs.length} itens` },
    { title: 'Σ', value: `n=${state.stats.n} • Σx=${round2(state.stats.sumX)} • Σx²=${round2(state.stats.sumX2)}` },
  ];
  elStateGrid.innerHTML = items.map(i => (
    `<div class="card"><p class="card__title">${escapeHtml(i.title)}</p><p class="card__value">${escapeHtml(String(i.value))}</p></div>`
  )).join('');
}

function escapeHtml(s){
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ---------- Toggles ----------
const toggleBegin = $('#toggleBegin');
const toggle12x = $('#toggle12x');
const toggleDayCount = $('#toggleDayCount');

function syncTogglesFromState(){
  toggleBegin.checked = !!state.begin;
  toggle12x.checked = !!state.is12x;
  toggleDayCount.checked = state.dayCount === 'ACT/ACT';
}

toggleBegin.addEventListener('change', () => {
  state.begin = toggleBegin.checked;
  render();
  saveStateDebounced();
});

toggle12x.addEventListener('change', () => {
  state.is12x = toggle12x.checked;
  render();
  saveStateDebounced();
});

toggleDayCount.addEventListener('change', () => {
  state.dayCount = toggleDayCount.checked ? 'ACT/ACT' : '30/360';
  render();
  saveStateDebounced();
});

// ---------- Help / Reset ----------
$('#btnHelp').addEventListener('click', () => {
  const open = elHelp.hasAttribute('hidden') === false;
  if(open) elHelp.setAttribute('hidden','');
  else elHelp.removeAttribute('hidden');
});

$('#btnReset').addEventListener('click', () => {
  if(confirm('Resetar tudo (pilha, registros e memória local)?')) opClearAll();
});

// ---------- Delegação de eventos (teclas) ----------
const keysRoot = document.querySelector('.keys');
keysRoot.addEventListener('click', (ev) => {
  const btn = ev.target.closest('button[data-key]');
  if(!btn) return;
  handleKey(btn.dataset.key);
});

// ---------- Mapeamento de teclado físico ----------
document.addEventListener('keydown', (ev) => {
  // Não capturar se foco estiver em input (não há inputs agora, mas fica robusto)
  const tag = (ev.target?.tagName || '').toLowerCase();
  if(tag === 'input' || tag === 'textarea') return;

  const k = ev.key;
  if(/^[0-9]$/.test(k)) { handleKey(k); ev.preventDefault(); return; }
  if(k === '.' || k === ',') { handleKey('dot'); ev.preventDefault(); return; }
  if(k === 'Enter') { handleKey('enter'); ev.preventDefault(); return; }
  if(k === 'Backspace') { handleKey('clx'); ev.preventDefault(); return; }
  if(k === 'Escape') { handleKey('clear'); ev.preventDefault(); return; }
  if(k === '+') { handleKey('plus'); ev.preventDefault(); return; }
  if(k === '-') { handleKey('minus'); ev.preventDefault(); return; }
  if(k === '*') { handleKey('mul'); ev.preventDefault(); return; }
  if(k === '/') { handleKey('div'); ev.preventDefault(); return; }
  if(k === '=') { handleKey('equals'); ev.preventDefault(); return; }
  if(k === '%') { handleKey('percent'); ev.preventDefault(); return; }
  if(k.toLowerCase() === 'f') { handleKey('f'); ev.preventDefault(); return; }
  if(k.toLowerCase() === 'g') { handleKey('g'); ev.preventDefault(); return; }
  if(k.toLowerCase() === 's') { handleKey('sto'); ev.preventDefault(); return; }
  if(k.toLowerCase() === 'r') { handleKey('rcl'); ev.preventDefault(); return; }
  if(k.toLowerCase() === 'e') { handleKey('eex'); ev.preventDefault(); return; }
  if(k.toLowerCase() === 'x') { handleKey('swap'); ev.preventDefault(); return; }
  if(k.toLowerCase() === 'q') { handleKey('sqrt'); ev.preventDefault(); return; }
  if(k === '^') { handleKey('pow'); ev.preventDefault(); return; }
});

function consumeShift(){
  const s = state.shift;
  state.shift = null;
  return s;
}

function setShift(s){
  state.shift = (state.shift === s) ? null : s;
  elHelpStatus.textContent = state.shift ? `Shift ${state.shift.toUpperCase()} ativado.` : '';
  render();
}

function handleKey(key){
  // Shifts
  if(key === 'f' || key === 'g'){ setShift(key); return; }

  const shift = consumeShift();

  // Números/entrada
  if(/^[0-9]$/.test(key)){
    inputDigit(key);
    render();
    saveStateDebounced();
    return;
  }
  if(key === 'dot'){
    inputDot();
    render();
    saveStateDebounced();
    return;
  }

  // Primárias
  switch(key){
    case 'enter':
      if(shift === 'f'){
        // f ENTER = LASTx
        commitEntry();
        setX(state.lastX);
        toast('LAST X');
      }else if(shift === 'g'){
        // g ENTER = R↓ (roll down)
        commitEntry();
        const oldX = state.x;
        state.x = state.y;
        state.y = state.z;
        state.z = state.t;
        state.t = oldX;
        toast('R↓');
      }else{
        opEnter();
      }
      break;

    case 'clx':
      if(shift === 'g'){
        // g CLx = backspace na entrada
        if(state.entering && state.entry.length){
          state.entry = state.entry.slice(0, -1);
        }else{
          opClx();
        }
      }else{
        opClx();
      }
      break;

    case 'clear':
      opClearAll();
      return;

    case 'chs':
      if(shift === 'f'){
        commitEntry();
        setX(Math.abs(state.x));
        toast('ABS');
      }else{
        opChs();
      }
      break;

    case 'swap':
      if(shift === 'g'){
        commitEntry();
        setX(state.lastX);
        toast('LSTx');
      }else{
        opSwap();
      }
      break;

    case 'plus':
      if(shift === 'f'){
        // f + : média x̄
        if(state.stats.n > 0) setX(state.stats.sumX / state.stats.n);
        toast('x̄');
      }else if(shift === 'g'){
        // g + : desvio padrão s
        if(state.stats.n > 1){
          const n = state.stats.n;
          const mean = state.stats.sumX / n;
          const variance = (state.stats.sumX2 - n * mean * mean) / (n - 1);
          setX(Math.sqrt(Math.max(variance, 0)));
        }else{
          setX(NaN);
        }
        toast('s');
      }else{
        opAdd();
      }
      break;

    case 'minus':
      if(shift === 'f'){
        // f - : Σ+
        commitEntry();
        state.stats.n += 1;
        state.stats.sumX += state.x;
        state.stats.sumX2 += state.x * state.x;
        toast('Σ+');
      }else if(shift === 'g'){
        // g - : Σ-
        commitEntry();
        state.stats.n = Math.max(0, state.stats.n - 1);
        // (Simplificação) não reverte sumX/sumX2 sem histórico.
        toast('Σ- (parcial)');
      }else{
        opSub();
      }
      break;

    case 'mul':
      if(shift === 'g'){
        // g × : Δ% (variação percentual) => (x - y) / y * 100
        commitEntry();
        const y = state.y;
        const x = state.x;
        setX(y === 0 ? NaN : ((x - y) / y) * 100);
        toast('Δ%');
      }else{
        opMul();
      }
      break;

    case 'div':
      opDiv();
      break;

    case 'sqrt':
      if(shift === 'g'){
        toast('NPV (em breve)');
      }else{
        opSqrt();
      }
      break;

    case 'pow':
      if(shift === 'g'){
        toast('DATE (em breve)');
      }else{
        opPow();
      }
      break;

    case 'percent':
      // % : y * x / 100
      commitEntry();
      setX(state.y * (state.x / 100));
      toast('%');
      break;

    case 'equals':
      toast('= (execução/programação em breve)');
      break;

    case 'sto':
      toast('STO: pressione um dígito (0-9) em seguida (em breve)');
      break;

    case 'rcl':
      toast('RCL: pressione um dígito (0-9) em seguida (em breve)');
      break;

    case 'eex':
      // EEX na entrada
      startEntryIfNeeded();
      if(!/e/i.test(state.entry)) state.entry += 'e';
      break;

    case 'sum':
      if(shift === 'f'){
        state.stats = { n: 0, sumX: 0, sumX2: 0 };
        toast('CLΣ');
      }else{
        toast('Σ (painel)');
      }
      break;

    default:
      // Teclas 1..9 têm funções financeiras (f/g) — implementar próximo.
      toast('Função em breve.');
      break;
  }

  render();
  saveStateDebounced();
}

// ---------- IntersectionObserver (micro-UX leve) ----------
// Exibe dica quando o usuário rolar até o painel de estado.
const observer = new IntersectionObserver((entries) => {
  for(const e of entries){
    if(e.isIntersecting){
      $('#helpStatus').textContent = 'Dica: seus dados ficam salvos localmente (LocalStorage).';
      observer.disconnect();
      break;
    }
  }
}, { threshold: 0.2 });
observer.observe(elStateGrid);

// ---------- Service Worker (offline) ----------
if('serviceWorker' in navigator){
  window.addEventListener('load', async () => {
    try{
      await navigator.serviceWorker.register('./sw.js');
    }catch{ /* silencioso */ }
  });
}

// Inicialização
syncTogglesFromState();
render();
