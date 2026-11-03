/**
 * ARCADIA PS2 — original browser integration for the Play! open source emulator.
 * Play! itself and its WebAssembly build are third-party, separately licensed files.
 * Game images are read with File.slice(): they are not uploaded or retained by this site.
 */

const EMULATOR_VERSION = '0.77-13-gd44bfa18';
const SUPPORTED = new Set(['iso', 'cso', 'chd', 'isz', 'bin', 'elf']);
const CONTROLS = new Set([
  'ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyA','KeyZ','KeyS','KeyX',
  'KeyT','KeyF','KeyG','KeyH','KeyI','KeyJ','KeyK','KeyL',
  'Enter','Backspace','NumpadEnter','Digit1','Digit2','Digit3',
  'Digit8','Digit9','Digit0','Numpad1','Numpad2','Numpad3',
  'Numpad8','Numpad9','Numpad0',
]);
const GAMEPAD_BUTTONS = {
  0:'KeyZ', 1:'KeyX', 2:'KeyA', 3:'KeyS',
  4:'Key1', 5:'Key8', 6:'Key2', 7:'Key9',
  8:'Backspace', 9:'Enter', 10:'Key3', 11:'Key0',
  12:'ArrowUp', 13:'ArrowDown', 14:'ArrowLeft', 15:'ArrowRight'
};
const $ = (id) => document.getElementById(id);
const canvas = $('outputCanvas');
const banner = $('banner');
const bannerTitle = $('banner-title');
const bannerText = $('banner-text');
const status = $('status');
const fps = $('fps');
const padState = $('pad-state');
const log = $('log');
const overlay = $('overlay');
const touchButton = $('touch-btn');
const fullButton = $('fullscreen-btn');
const stage = $('stage');
const fileInput = $('file');
const fileButton = $('pick-btn');
const canvasWrap = $('canvas-wrap');
const activeHolds = new Map();
let emulator = null;
let requestedFile = null;
let gameName = '';
let buildGeneration = 0;
let errors = [];
let lastPadSample = 0;

function message(text, kind='pending') {
  status.textContent = text;
  status.dataset.kind = kind;
  document.documentElement.dataset.emulator = kind;
}
function showBanner(title, description) {
  banner.hidden = false;
  bannerTitle.textContent = title;
  bannerText.textContent = description;
}
function hideBanner() { banner.hidden = true; }
function logMessage(text) {
  const s = String(text).trim();
  if (!s) return;
  errors.push(s);
  if (errors.length > 100) errors.shift();
  log.textContent = errors.join('\n');
  const version = s.match(/Play! - Version\s+(\S+)/);
  if (version) $('version').textContent = 'Play! ' + version[1];
  if (s.includes('Failed to start')) {
    message('O jogo não iniciou. Consulte o diagnóstico abaixo.', 'error');
    showBanner('Falha ao iniciar jogo','Esse arquivo ou título pode não ser compatível com o Play! Web.');
  } else if (s.includes('Starting')) {
    message('Executando: ' + gameName, 'running');
    hideBanner();
    canvas.focus({preventScroll:true});
  }
}
function keyName(input) {
  const key = input.replace('Digit','Key').replace('Numpad','Key');
  return input === 'NumpadEnter' ? 'Enter' : key;
}
function sendGameKey(code, pressed) {
  // Emscripten's Play! HTML UI listens to input events on outputCanvas.
  canvas.dispatchEvent(new KeyboardEvent(pressed ? 'keydown' : 'keyup', {
    bubbles: true, cancelable: true, repeat: false, code, key: code,
  }));
  document.querySelectorAll('[data-code="' + code + '"]').forEach(button => {
    button.classList.toggle('held', pressed);
    button.setAttribute('aria-pressed', String(pressed));
  });
}
function hold(code, down, source) {
  let sources = activeHolds.get(code);
  if (!sources) activeHolds.set(code, sources = new Set());
  const before = sources.size > 0;
  if (down) sources.add(source); else sources.delete(source);
  if (before !== (sources.size > 0)) sendGameKey(code, sources.size > 0);
}
function releasePrefix(prefix) {
  for (const [code, sources] of activeHolds) {
    const before = sources.size;
    for (const item of Array.from(sources)) if (item.startsWith(prefix)) sources.delete(item);
    if (before && !sources.size) sendGameKey(code, false);
  }
}
function releaseAll() {
  for (const [code, sources] of activeHolds) {
    if (sources.size) { sources.clear(); sendGameKey(code, false); }
  }
}
function desktopKeys(ev) {
  if (!ev.isTrusted || ev.ctrlKey || ev.metaKey || ev.altKey || !CONTROLS.has(ev.code)) return;
  if (['INPUT','TEXTAREA','SELECT'].includes(ev.target?.tagName)) return;
  ev.preventDefault();
  ev.stopPropagation();
  if (ev.repeat) return;
  const code = keyName(ev.code);
  hold(code, ev.type === 'keydown','keyboard:'+code);
}
window.addEventListener('keydown',desktopKeys,true);
window.addEventListener('keyup',desktopKeys,true);
window.addEventListener('blur',releaseAll);
document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseAll();});

for (const button of overlay.querySelectorAll('button[data-code]')) {
  const code = button.dataset.code;
  button.addEventListener('pointerdown',(event)=>{
    event.preventDefault();
    try { button.setPointerCapture(event.pointerId); } catch(e) {}
    hold(code,true,'touch:'+code+':'+event.pointerId);
  });
  for (const type of ['pointerup','pointercancel','lostpointercapture']) {
    button.addEventListener(type,(event)=>hold(code,false,'touch:'+code+':'+event.pointerId));
  }
}
function stickSetup(stick) {
  let pointer = null;
  const nub = stick.querySelector('.nub');
  const label = stick.dataset.stick;
  const states = [
    [stick.dataset.hneg,'l'],[stick.dataset.hpos,'r'],
    [stick.dataset.vneg,'u'],[stick.dataset.vpos,'d']
  ];
  function reset() {
    pointer = null;
    nub.style.transform = 'translate(-50%,-50%)';
    for (const [code,d] of states) hold(code,false,'stick:'+label+':'+d);
  }
  function move(event) {
    if (pointer !== event.pointerId) return;
    const r = stick.getBoundingClientRect(), radius = r.width / 2;
    let x = (event.clientX-r.left-radius)/radius;
    let y = (event.clientY-r.top-radius)/radius;
    const length = Math.hypot(x,y);
    if (length>1) {x/=length;y/=length;}
    nub.style.transform = 'translate(calc(-50% + '+x*radius+'px),calc(-50% + '+y*radius+'px))';
    hold(states[0][0],x<-.3,'stick:'+label+':l');
    hold(states[1][0],x>.3,'stick:'+label+':r');
    hold(states[2][0],y<-.3,'stick:'+label+':u');
    hold(states[3][0],y>.3,'stick:'+label+':d');
  }
  stick.addEventListener('pointerdown',(ev)=>{ev.preventDefault();pointer=ev.pointerId;try{stick.setPointerCapture(pointer);}catch(e){};move(ev);});
  stick.addEventListener('pointermove',move);
  stick.addEventListener('pointerup',(ev)=>{if(ev.pointerId===pointer)reset();});
  stick.addEventListener('pointercancel',(ev)=>{if(ev.pointerId===pointer)reset();});
  stick.addEventListener('lostpointercapture',(ev)=>{if(ev.pointerId===pointer)reset();});
}
for (const stick of overlay.querySelectorAll('.stick')) stickSetup(stick);
overlay.addEventListener('contextmenu',event=>event.preventDefault());

function pollGamepad(time=0) {
  requestAnimationFrame(pollGamepad);
  if (time - lastPadSample < 15) return;
  lastPadSample = time;
  const pads = navigator.getGamepads?.() || [];
  const pad = Array.from(pads).find(x=>x?.connected);
  if (!pad) {padState.textContent='';releasePrefix('pad:');return;}
  padState.textContent='CONTROLE CONECTADO';
  for (const [idx,code] of Object.entries(GAMEPAD_BUTTONS)) {
    const button = pad.buttons[Number(idx)];
    hold(code,!!(button && (button.pressed || button.value>.45)),'pad:b'+idx);
  }
  const axes = pad.axes || [];
  function analog(value, negative, positive, suffix) {
    hold(negative, value<-.35,'pad:'+suffix+'n');
    hold(positive, value>.35,'pad:'+suffix+'p');
  }
  analog(axes[0]||0,'KeyF','KeyH','lx');
  analog(axes[1]||0,'KeyT','KeyG','ly');
  analog(axes[2]||0,'KeyJ','KeyL','rx');
  analog(axes[3]||0,'KeyI','KeyK','ry');
}
requestAnimationFrame(pollGamepad);
function setTouch(enabled, persist=false) {
  overlay.hidden=!enabled;
  touchButton.setAttribute('aria-pressed',String(enabled));
  touchButton.textContent=enabled?'⊞ Ocultar controle':'⊞ Controle na tela';
  if (persist) try{localStorage.setItem('arcadia-touch',enabled?'1':'0');}catch(e){}
  if (!enabled) releasePrefix('touch:');
}
let touchDefault=matchMedia('(pointer:coarse)').matches;
try {const v=localStorage.getItem('arcadia-touch');if (v==='1'||v==='0')touchDefault=(v==='1');}catch(e){}
setTouch(touchDefault);
touchButton.addEventListener('click',()=>setTouch(overlay.hidden,true));
async function fullScreen() {
  const current = document.fullscreenElement || document.webkitFullscreenElement;
  if(current) {try{await (document.exitFullscreen||document.webkitExitFullscreen).call(document);}catch(e){};return;}
  if(stage.classList.contains('immersive')) {stage.classList.remove('immersive');document.body.classList.remove('immersive-body');return;}
  const req=stage.requestFullscreen||stage.webkitRequestFullscreen;
  if(req) try{await req.call(stage);return;}catch(e){}
  stage.classList.add('immersive');document.body.classList.add('immersive-body');
}
fullButton.addEventListener('click',fullScreen);
fileButton.addEventListener('click',()=>fileInput.click());
fileInput.addEventListener('change',()=>{
  const file=fileInput.files?.[0];fileInput.value='';if(file)bootFile(file);
});
for (const name of ['dragover','drop']) document.addEventListener(name,e=>{
  if (!e.dataTransfer?.types?.includes('Files')) return;
  e.preventDefault();
  canvasWrap.classList.toggle('dragover',name==='dragover');
  if (name==='drop' && e.dataTransfer.files.length) bootFile(e.dataTransfer.files[0]);
});
document.addEventListener('dragleave',(e)=>{if(!e.relatedTarget)canvasWrap.classList.remove('dragover');});

/** The VM pulls disc sectors asynchronously instead of loading a multi-gigabyte ISO into RAM. */
class LocalDisc {
  constructor(mod) {this.module=mod;this.file=null;this.completed=false;}
  setFile(file){this.file=file;}
  getFileSize(){return this.file?.size || 0;}
  isDone(){return this.completed;}
  read(dst,offset,size){
    if(!this.file)throw Error('Nenhuma imagem de disco selecionada');
    this.completed=false;
    this.file.slice(offset,offset+size).arrayBuffer().then(buf=>{
      const bytes=new Uint8Array(buf);
      this.module.HEAPU8.set(bytes,dst);
      if(bytes.length<size)this.module.HEAPU8.fill(0,dst+bytes.length,dst+size);
    }).catch(error=>{
      logMessage('Leitura de disco: '+error.message);
      this.module.HEAPU8.fill(0,dst,dst+size);
    }).finally(()=>this.completed=true);
  }
}
function extension(file) {return file.name.split('.').pop().toLowerCase();}
async function bootFile(file) {
  const type=extension(file);
  if(!SUPPORTED.has(type)) {
    message('Formato não suportado: .'+type,'error');
    showBanner('Arquivo não suportado','Escolha ISO, CHD, CSO, ISZ, BIN ou ELF.');
    return;
  }
  gameName=file.name;
  if(!emulator) {
    requestedFile=file;
    message('Imagem selecionada. Aguardando núcleo WebAssembly…','pending');
    showBanner('Jogo selecionado','Iniciaremos automaticamente quando o emulador estiver pronto.');
    return;
  }
  const generation=++buildGeneration;
  releaseAll();
  message('Inicializando '+file.name+'…','pending');
  showBanner('Iniciando '+file.name,'A tela pode ficar preta durante a inicialização.');
  try {
    if(type==='elf') {
      const bytes=new Uint8Array(await file.arrayBuffer());
      if(generation!==buildGeneration)return;
      let stream;
      try{stream=emulator.FS.open(file.name,'w+');emulator.FS.write(stream,bytes,0,bytes.length,0);}
      finally{if(stream)emulator.FS.close(stream);}
      emulator.bootElf(file.name);
    } else {
      emulator.discImageDevice.setFile(file);
      emulator.bootDiscImage(file.name);
    }
    canvas.focus({preventScroll:true});
  } catch(error) {
    message('Falha ao iniciar: '+error.message,'error');
    showBanner('Falha ao iniciar',error.message);
  }
}
async function start() {
  const canWebgl=!!document.createElement('canvas').getContext('webgl2');
  if(!canWebgl)throw Error('WebGL 2 não disponível. Ative aceleração de hardware.');
  if(!window.crossOriginIsolated) {
    message('Ativando memória compartilhada; pode ocorrer recarregamento automático…','pending');
    const startTime=Date.now();
    while(!window.crossOriginIsolated && Date.now()-startTime<16000)await new Promise(r=>setTimeout(r,150));
    if(!window.crossOriginIsolated)throw Error('SharedArrayBuffer não habilitado. Use HTTPS ou localhost com COOP/COEP.');
  }
  message('Carregando Play! WebAssembly…','pending');
  showBanner('Carregando emulador','Inicializando o motor Play! WebAssembly.');
  const base=new URL('./emulator/',document.baseURI);
  const playUrl=new URL('Play.js?v='+encodeURIComponent(EMULATOR_VERSION),base).href;
  const {default:Play}=await import(playUrl);
  emulator=await Play({
    locateFile:(path)=>new URL(path+'?v='+encodeURIComponent(EMULATOR_VERSION),base).href,
    mainScriptUrlOrBlob:playUrl,
    print:(...args)=>logMessage(args.join(' ')),
    printErr:(...args)=>logMessage(args.join(' ')),
  });
  emulator.discImageDevice=new LocalDisc(emulator);
  try{emulator.FS.mkdir('/work');}catch(error){}
  emulator.ccall('initVm','',[],[]);
  setInterval(()=>{
    if(!emulator)return;
    try{fps.textContent=emulator.getFrames()+' fps';emulator.clearStats();}catch(e){}
  },1000);
  message('Emulador pronto. Selecione uma imagem ISO ou CHD.','ready');
  showBanner('Emulador pronto','Selecione uma ISO, CHD, CSO, ISZ, BIN ou ELF acima para iniciar.');
  if(requestedFile){const file=requestedFile;requestedFile=null;bootFile(file);}
}
window.addEventListener('unhandledrejection',event=>{
  logMessage('ERRO: '+(event.reason?.message || String(event.reason)));
});
window.__arcadiaDebug={get module(){return emulator;},bootFile};
start().catch(error=>{
  message('Erro ao iniciar o núcleo: '+error.message,'error');
  showBanner('Não foi possível inicializar',error.message);
  logMessage(error.stack||error.message);
});