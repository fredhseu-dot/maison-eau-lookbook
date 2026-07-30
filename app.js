/* Editable reader settings — reorder, remove, or add image paths here. */
const pages = [
  'assets/page-01.jpg','assets/page-02.png','assets/page-03.png','assets/page-04.png','assets/page-05.png',
  'assets/page-06.png','assets/page-07.png','assets/page-08.png','assets/page-09.jpg','assets/page-10.jpg',
  'assets/page-11.jpg','assets/page-12.webp','assets/page-13.jpg','assets/page-14.jpg','assets/page-15.png'
];
const completionThreshold = 0.25;
const turnDuration = 620;
const returnDuration = 380;
const shadowStrength = 0.62;
const curlRadius = 132;

const canvas = document.querySelector('#magazine');
const ctx = canvas.getContext('2d');
const stage = document.querySelector('#stage');
const loading = document.querySelector('#loading');
const previous = document.querySelector('#previous');
const next = document.querySelector('#next');
const currentLabel = document.querySelector('#pageCurrent');
const totalLabel = document.querySelector('#pageTotal');
const progress = document.querySelector('#progressBar');
const hintRight = document.querySelector('.hint-right');
const hintLeft = document.querySelector('.hint-left');
const instruction = document.querySelector('#readerInstruction');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const images = [];
let dpr = 1, rect = { x: 0, y: 0, w: 1, h: 1 }, page = 0;
let gesture = null, busy = false, raf = 0;

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const easeOut = t => 1 - Math.pow(1 - t, 4);
const pad = n => String(n + 1).padStart(2, '0');

function resize() {
  const bounds = stage.getBoundingClientRect();
  dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(bounds.width * dpr); canvas.height = Math.round(bounds.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  rect = { x: 0, y: 0, w: bounds.width, h: bounds.height };
  draw();
}
function imageBox(img) {
  const pad = Math.max(12, rect.w * .027), aw = rect.w - pad * 2, ah = rect.h - pad * 2;
  const scale = Math.min(aw / img.naturalWidth, ah / img.naturalHeight);
  return { x: rect.x + (rect.w - img.naturalWidth * scale) / 2, y: rect.y + pad, w: img.naturalWidth * scale, h: img.naturalHeight * scale };
}
function drawPaper(img) {
  ctx.save(); ctx.fillStyle = '#f7efdf'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = '#dbc9a8'; ctx.lineWidth = 1; ctx.strokeRect(.5, .5, rect.w - 1, rect.h - 1);
  if (img) {
    ctx.save(); ctx.globalAlpha = .16; ctx.filter = 'blur(18px) saturate(.65)';
    const s = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.drawImage(img, (rect.w - w) / 2, (rect.h - h) / 2, w, h); ctx.restore();
    const b = imageBox(img); ctx.drawImage(img, b.x, b.y, b.w, b.h);
  }
  ctx.restore();
}
function clipPolygon(points) { ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.clip(); }
function drawCurl(g) {
  const dir = g.dir, p = g.progress, img = images[g.from], under = images[g.to];
  drawPaper(under);
  const right = rect.w, left = 0, top = 0, bottom = rect.h;
  const cornerY = g.corner === 'top' ? top : bottom;
  const startX = dir === 1 ? right : left;
  const foldX = dir === 1 ? right - p * rect.w : left + p * rect.w;
  const rawY = clamp(g.y, 0, rect.h);
  const foldY = cornerY + (rawY - cornerY) * (1 - p * .32);
  const bend = Math.sin(p * Math.PI) * Math.min(curlRadius, rect.w * .31);
  const lineA = { x: foldX, y: clamp(foldY - bend, top, bottom) };
  const lineB = { x: foldX + (dir === 1 ? bend * .18 : -bend * .18), y: clamp(foldY + bend, top, bottom) };
  ctx.save();
  if (dir === 1) clipPolygon([{x:left,y:top},{x:lineA.x,y:lineA.y},{x:lineB.x,y:lineB.y},{x:left,y:bottom}]);
  else clipPolygon([{x:right,y:top},{x:lineA.x,y:lineA.y},{x:lineB.x,y:lineB.y},{x:right,y:bottom}]);
  drawPaper(img); ctx.restore();
  ctx.save();
  const back = ctx.createLinearGradient(dir === 1 ? foldX : foldX - bend, 0, dir === 1 ? right : left, 0);
  back.addColorStop(0, '#fff8e8'); back.addColorStop(.46, '#e4d2ae'); back.addColorStop(1, '#f8f0df');
  ctx.fillStyle = back;
  if (dir === 1) { ctx.beginPath();ctx.moveTo(lineA.x,lineA.y);ctx.quadraticCurveTo(right + bend*.18,foldY,right,cornerY);ctx.lineTo(lineB.x,lineB.y);ctx.closePath(); }
  else { ctx.beginPath();ctx.moveTo(lineA.x,lineA.y);ctx.quadraticCurveTo(left - bend*.18,foldY,left,cornerY);ctx.lineTo(lineB.x,lineB.y);ctx.closePath(); }
  ctx.fill();
  // The lifted side shows a softly muted, horizontally mirrored print through its ivory paper stock.
  ctx.save(); ctx.beginPath();
  if (dir === 1) { ctx.moveTo(lineA.x,lineA.y);ctx.quadraticCurveTo(right + bend*.18,foldY,right,cornerY);ctx.lineTo(lineB.x,lineB.y); }
  else { ctx.moveTo(lineA.x,lineA.y);ctx.quadraticCurveTo(left - bend*.18,foldY,left,cornerY);ctx.lineTo(lineB.x,lineB.y); }
  ctx.closePath(); ctx.clip(); ctx.globalAlpha = .22; ctx.translate(rect.w, 0); ctx.scale(-1, 1);
  const mirrored = imageBox(img); ctx.drawImage(img, mirrored.x, mirrored.y, mirrored.w, mirrored.h); ctx.restore();
  ctx.globalAlpha = .22 + p * .2; ctx.fillStyle = '#8f795d'; ctx.save();
  if (dir === 1) clipPolygon([{x:foldX,y:top},{x:right,y:top},{x:right,y:bottom},{x:foldX,y:bottom}]);
  else clipPolygon([{x:left,y:top},{x:foldX,y:top},{x:foldX,y:bottom},{x:left,y:bottom}]);
  const shade = ctx.createLinearGradient(foldX - bend, 0, foldX + bend, 0); shade.addColorStop(0,'transparent');shade.addColorStop(.5,'#332116');shade.addColorStop(1,'transparent');ctx.fillStyle=shade;ctx.fillRect(foldX-bend,0,bend*2,rect.h);ctx.restore();
  ctx.globalAlpha = shadowStrength * (0.3 + p * .45);ctx.strokeStyle='#5b422f';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(lineA.x,lineA.y);ctx.quadraticCurveTo(foldX + dir*bend*.12,foldY,lineB.x,lineB.y);ctx.stroke();
  ctx.globalAlpha=.38;ctx.strokeStyle='#fff9e8';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(lineA.x+dir*3,lineA.y);ctx.quadraticCurveTo(foldX+dir*bend*.2,foldY,lineB.x+dir*3,lineB.y);ctx.stroke();ctx.restore();
}
function draw() { ctx.clearRect(0, 0, rect.w, rect.h); if (!images.length) return; if (gesture) drawCurl(gesture); else drawPaper(images[page]); }
function updateUI() { currentLabel.textContent = pad(page); totalLabel.textContent = String(images.length).padStart(2, '0'); progress.style.width = `${images.length > 1 ? page / (images.length - 1) * 100 : 100}%`; previous.disabled = busy || page === 0; next.disabled = busy || page === images.length - 1; hintRight.style.opacity = page === images.length - 1 ? 0 : 1; hintLeft.style.opacity = page === 0 ? 0 : .45; instruction.textContent = page === images.length - 1 ? '已到最後一頁' : page === 0 ? '拖曳右側頁角翻至下一頁' : '拖曳任一側頁角繼續翻閱'; }
function animate(from, to, duration, done) { const start=performance.now(); const run=now=>{const t=clamp((now-start)/duration,0,1); gesture.progress=from+(to-from)*easeOut(t); draw(); if(t<1) raf=requestAnimationFrame(run);else done();}; cancelAnimationFrame(raf);raf=requestAnimationFrame(run); }
function finishTurn(commit) { if (!gesture) return; busy=true; stage.classList.remove('is-dragging'); const g=gesture; const target=commit?1:0; animate(g.progress,target,reducedMotion?1:(commit?turnDuration:returnDuration),()=>{if(commit) page=g.to; gesture=null; busy=false; draw();updateUI();}); }
function pointerPoint(event) { const b=canvas.getBoundingClientRect(); return {x:event.clientX-b.left,y:event.clientY-b.top}; }
function startDrag(event) { if(busy||!images.length) return; const p=pointerPoint(event); const zone=Math.min(curlRadius,rect.w*.24); const isLeft=p.x<zone, isRight=p.x>rect.w-zone, isCorner=p.y<curlRadius||p.y>rect.h-curlRadius; if(!isCorner||(!isLeft&&!isRight))return; const dir=isRight?1:-1; if((dir===1&&page===images.length-1)||(dir===-1&&page===0))return; gesture={dir,from:page,to:page+dir,corner:p.y<rect.h/2?'top':'bottom',x:p.x,y:p.y,progress:0,pointerId:event.pointerId}; canvas.setPointerCapture(event.pointerId); stage.classList.add('is-dragging'); event.preventDefault(); draw(); }
function moveDrag(event) { if(!gesture||event.pointerId!==gesture.pointerId)return; const p=pointerPoint(event); gesture.x=clamp(p.x,0,rect.w);gesture.y=clamp(p.y,0,rect.h); const distance=gesture.dir===1?rect.w-gesture.x:gesture.x; gesture.progress=clamp(distance/rect.w,0,.98); if(gesture.progress>.015)event.preventDefault(); draw(); }
function endDrag(event) { if(!gesture||event.pointerId!==gesture.pointerId)return; const commit=gesture.progress>=completionThreshold; finishTurn(commit); }
function turn(dir) { if(busy||(dir===1&&page===images.length-1)||(dir===-1&&page===0))return; gesture={dir,from:page,to:page+dir,corner:'bottom',x:dir===1?rect.w:0,y:rect.h,progress:0};busy=true;updateUI();animate(0,1,reducedMotion?1:turnDuration,()=>{page=gesture.to;gesture=null;busy=false;draw();updateUI();}); }
async function preload() { const tasks=pages.map(src=>new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src=src;})); const loaded=await Promise.all(tasks); images.push(...loaded.filter(Boolean)); loading.textContent=images.length?'' :'NO PAGES FOUND';loading.classList.add('done');resize();updateUI(); }
canvas.addEventListener('pointerdown',startDrag);canvas.addEventListener('pointermove',moveDrag,{passive:false});canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);previous.addEventListener('click',()=>turn(-1));next.addEventListener('click',()=>turn(1));window.addEventListener('keydown',event=>{if(event.key==='ArrowLeft')turn(-1);if(event.key==='ArrowRight')turn(1)});window.addEventListener('resize',resize);preload();
