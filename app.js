/* ═══════════════════════════════════════════
   ATLAS HISTÓRICO — APP.JS — LF STUDIO
   Mapa interativo com zoom/pan, animações GSAP
═══════════════════════════════════════════ */

/* ── REFS ── */
const mapCanvas = document.getElementById('map-canvas');
const ctx = mapCanvas.getContext('2d');
const pCanvas = document.getElementById('particles-canvas');
const pCtx = pCanvas.getContext('2d');
const pinsLayer = document.getElementById('pins-layer');
const yearDisplay = document.getElementById('year-display');
const yearSlider = document.getElementById('year-slider');
const panelEl = document.getElementById('panel');
const panelBody = document.getElementById('panel-body');
const panelYear = document.getElementById('panel-year');
const panelClose = document.getElementById('panel-close');
const tooltip = document.getElementById('tooltip');
const counter = document.getElementById('counter');
const qbtns = document.getElementById('qbtns');
const tlTrack = document.getElementById('tl-track');

/* ── STATE ── */
let W, H;
let cam = { x:0, y:0, zoom:1, tX:0, tY:0, tZ:1 };
let drag = { on:false, sx:0, sy:0, cx:0, cy:0 };
let mouse = { x:0, y:0 };
let currentYear = 1945;
let currentFilter = 'all';
let hoverCountry = null;
let mapGeo = null;

/* ── RESIZE ── */
function resize(){
  W = window.innerWidth; H = window.innerHeight;
  mapCanvas.width = W; mapCanvas.height = H;
  pCanvas.width = W; pCanvas.height = H;
  drawMap();
}
window.addEventListener('resize', resize);

/* ── PROJECTION ── */
function lonLatToXY(lon, lat){
  const cx = W/2 + cam.x, cy = H/2 + cam.y;
  const scale = Math.min(W,H)/3.2 * cam.zoom;
  const x = cx + (lon/180) * scale * 1.7;
  const latRad = lat * Math.PI/180;
  const y = cy - (Math.log(Math.tan(Math.PI/4+latRad/2))) / Math.PI * scale;
  return [x,y];
}
function xyToLonLat(px, py){
  const cx = W/2 + cam.x, cy = H/2 + cam.y;
  const scale = Math.min(W,H)/3.2 * cam.zoom;
  const lon = (px - cx) / (scale*1.7) * 180;
  const mercY = -(py - cy) / scale * Math.PI;
  const lat = (2*Math.atan(Math.exp(mercY)) - Math.PI/2) * 180/Math.PI;
  return [lon,lat];
}

/* ── DRAW MAP ── */
function drawMap(){
  ctx.clearRect(0,0,W,H);
  /* ocean */
  ctx.fillStyle='#0a1218';
  ctx.fillRect(0,0,W,H);
  /* grid */
  ctx.strokeStyle='rgba(74,222,128,.04)';
  ctx.lineWidth=.5;
  for(let lon=-180;lon<=180;lon+=30){
    ctx.beginPath();
    const [x1,y1]=lonLatToXY(lon,-80), [x2,y2]=lonLatToXY(lon,84);
    ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  }
  for(let lat=-60;lat<=80;lat+=20){
    ctx.beginPath();
    for(let lon=-180;lon<=180;lon+=2){
      const [x,y]=lonLatToXY(lon,lat);
      lon===-180?ctx.moveTo(x,y):ctx.lineTo(x,y);
    }
    ctx.stroke();
  }
  /* equator */
  ctx.strokeStyle='rgba(74,222,128,.08)';ctx.lineWidth=1;
  ctx.beginPath();
  for(let lon=-180;lon<=180;lon+=2){
    const [x,y]=lonLatToXY(lon,0);
    lon===-180?ctx.moveTo(x,y):ctx.lineTo(x,y);
  }
  ctx.stroke();
  /* countries */
  if(!mapGeo || !mapGeo.features) return;
  mapGeo.features.forEach(f=>{
    const name = f.properties.name;
    const isHover = name===hoverCountry;
    const polys = f.geometry.type==='Polygon' ? [f.geometry.coordinates] : (f.geometry.type==='MultiPolygon' ? f.geometry.coordinates : []);
    polys.forEach(poly=>{
      poly.forEach(ring=>{
        ctx.beginPath();
        ring.forEach((c,i)=>{
          const [x,y]=lonLatToXY(c[0],c[1]);
          i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
        });
        ctx.closePath();
        ctx.fillStyle = isHover ? 'rgba(74,222,128,.18)' : 'rgba(20,50,32,.6)';
        ctx.fill();
        ctx.strokeStyle = isHover ? 'rgba(74,222,128,.5)' : 'rgba(74,222,128,.12)';
        ctx.lineWidth = isHover ? 1.2 : .5;
        ctx.stroke();
      });
    });
    /* country labels at high zoom */
    if(cam.zoom >= 2.5 && f.geometry.type==='Polygon'){
      const coords = f.geometry.coordinates[0];
      let cx=0,cy=0;
      coords.forEach(c=>{cx+=c[0];cy+=c[1]});
      cx/=coords.length; cy/=coords.length;
      const [lx,ly]=lonLatToXY(cx,cy);
      if(lx>0&&lx<W&&ly>0&&ly<H){
        ctx.fillStyle='rgba(237,250,242,.2)';
        ctx.font='600 8px Inter';ctx.textAlign='center';
        ctx.fillText(name,lx,ly);
      }
    }
  });
}

/* ── HIT TEST ── */
function getCountryAt(px,py){
  if(!mapGeo||!mapGeo.features)return null;
  for(let i=mapGeo.features.length-1;i>=0;i--){
    const f=mapGeo.features[i];
    const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:(f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[]);
    for(const poly of polys){
      for(const ring of poly){
        ctx.beginPath();
        ring.forEach((c,j)=>{
          const [x,y]=lonLatToXY(c[0],c[1]);
          j===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
        });
        ctx.closePath();
        if(ctx.isPointInPath(px,py))return f.properties.name;
      }
    }
  }
  return null;
}

/* ── CAMERA / ZOOM / PAN ── */
mapCanvas.addEventListener('wheel', e=>{
  e.preventDefault();
  const zf = e.deltaY < 0 ? 1.12 : 0.89;
  cam.tZ = Math.max(.6, Math.min(14, cam.tZ * zf));
},{passive:false});

mapCanvas.addEventListener('mousedown', e=>{
  drag.on=true; drag.sx=e.clientX; drag.sy=e.clientY; drag.cx=cam.tX; drag.cy=cam.tY;
  mapCanvas.style.cursor='grabbing';
});
window.addEventListener('mousemove', e=>{
  mouse.x=e.clientX; mouse.y=e.clientY;
  if(drag.on){
    cam.tX = drag.cx + (e.clientX - drag.sx);
    cam.tY = drag.cy + (e.clientY - drag.sy);
  }
  /* cursor */
  gsap.to('#cursor-dot',{x:e.clientX,y:e.clientY,duration:.08,overwrite:true});
  gsap.to('#cursor-ring',{x:e.clientX,y:e.clientY,duration:.22,overwrite:true});
  /* hover */
  const cn = getCountryAt(e.clientX,e.clientY);
  if(cn!==hoverCountry){
    hoverCountry=cn;
    document.getElementById('cursor-ring').classList.toggle('hover',!!cn);
    if(cn) showCountryTooltip(cn,e.clientX,e.clientY);
    else hideTooltip();
    drawMap(); drawPins();
  }
  if(cn) moveTooltip(e.clientX,e.clientY);
});
window.addEventListener('mouseup', ()=>{
  drag.on=false; mapCanvas.style.cursor='';
});

/* ── FLY TO ── */
function flyTo(lon,lat,z){
  const scale=Math.min(W,H)/3.2*z;
  cam.tX = -(lon/180)*scale*1.7;
  cam.tY = (Math.log(Math.tan(Math.PI/4+(lat*Math.PI/180)/2)))/Math.PI*scale;
  cam.tZ = z;
}

/* ── ANIMATION LOOP ── */
function loop(){
  cam.x += (cam.tX - cam.x)*.12;
  cam.y += (cam.tY - cam.y)*.12;
  cam.zoom += (cam.tZ - cam.zoom)*.1;
  if(Math.abs(cam.tX-cam.x)>.5||Math.abs(cam.tY-cam.y)>.5||Math.abs(cam.tZ-cam.zoom)>.005){
    drawMap(); drawPins();
  }
  requestAnimationFrame(loop);
}

/* ── PARTICLES ── */
const particles=[];
function initParticles(){
  for(let i=0;i<60;i++){
    particles.push({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*.2,vy:(Math.random()-.5)*.2,r:Math.random()*1.5+.3,a:Math.random()*.3+.05});
  }
}
function drawParticles(){
  pCtx.clearRect(0,0,W,H);
  particles.forEach(p=>{
    p.x+=p.vx; p.y+=p.vy;
    if(p.x<0)p.x=W; if(p.x>W)p.x=0;
    if(p.y<0)p.y=H; if(p.y>H)p.y=0;
    pCtx.beginPath(); pCtx.arc(p.x,p.y,p.r,0,Math.PI*2);
    pCtx.fillStyle=`rgba(74,222,128,${p.a})`; pCtx.fill();
  });
  requestAnimationFrame(drawParticles);
}

/* ── TOOLTIP ── */
function showCountryTooltip(name,x,y){
  document.getElementById('tt-country').textContent = name;
  const ld = LEADERS[name];
  let leader='';
  if(ld){
    const yrs=Object.keys(ld).map(Number).sort((a,b)=>a-b);
    let best=''; for(const yr of yrs){if(yr<=currentYear)best=ld[yr];}
    leader=best?'Líder: '+best:'';
  }
  document.getElementById('tt-leader').textContent=leader;
  const evts=(DB[currentYear]||[]).filter(e=>e.country===name);
  document.getElementById('tt-event').textContent=evts.length?evts[0].title:'';
  document.getElementById('tt-desc').textContent=evts.length?evts[0].desc.substring(0,100)+'…':'';
  gsap.to(tooltip,{opacity:1,duration:.2,overwrite:true});
  moveTooltip(x,y);
}
function moveTooltip(x,y){
  const offX=x>W-280?-270:16, offY=y>H-200?-120:16;
  tooltip.style.left=(x+offX)+'px'; tooltip.style.top=(y+offY)+'px';
}
function hideTooltip(){gsap.to(tooltip,{opacity:0,duration:.15,overwrite:true})}

/* ── PINS ── */
function drawPins(){
  pinsLayer.innerHTML='';
  const evts = DB[currentYear]||[];
  const filtered = currentFilter==='all' ? evts : evts.filter(e=>e.type===currentFilter);
  counter.textContent = filtered.length + ' evento'+(filtered.length!==1?'s':'');
  filtered.forEach((ev,i)=>{
    const [x,y]=lonLatToXY(ev.lon,ev.lat);
    if(x<-30||x>W+30||y<-30||y>H+30)return;
    const col=TYPE_COLORS[ev.type]||'#4ade80';
    const pin=document.createElement('div');
    pin.className='pin';
    pin.style.left=x+'px'; pin.style.top=y+'px';
    pin.innerHTML=`<div class="pin-ring" style="background:${col};box-shadow:0 0 8px ${col}"></div><div class="pin-pulse" style="border-color:${col}"></div>`;
    pin.addEventListener('mouseenter', e=>{
      showCountryTooltip(ev.country,e.clientX,e.clientY);
      document.getElementById('tt-event').textContent=ev.title;
      document.getElementById('tt-desc').textContent=ev.desc.substring(0,120)+'…';
    });
    pin.addEventListener('mouseleave', hideTooltip);
    pin.addEventListener('click', ()=>openPanel());
    /* animate in */
    pin.style.opacity='0'; pin.style.transform='translate(-50%,-50%) scale(0)';
    pinsLayer.appendChild(pin);
    gsap.to(pin,{opacity:1,scale:1,duration:.4,delay:i*.06,ease:'back.out(2.5)',
      onUpdate:function(){pin.style.transform=`translate(-50%,-50%) scale(${gsap.getProperty(pin,'scale')})`}
    });
  });
}

/* ── PANEL ── */
function openPanel(){
  const evts=DB[currentYear]||[];
  const filtered=currentFilter==='all'?evts:evts.filter(e=>e.type===currentFilter);
  panelYear.textContent=currentYear;
  if(!filtered.length){
    panelBody.innerHTML='<div class="no-events">Nenhum evento registrado para este ano.</div>';
  } else {
    panelBody.innerHTML=filtered.map(ev=>{
      const col=TYPE_COLORS[ev.type]; const label=TYPE_LABELS[ev.type];
      return `<div class="ecard"><span class="etag ${ev.type}">${label}</span><div class="etitle">${ev.title}</div><div class="eloc">📍 ${ev.country}</div><div class="edesc">${ev.desc}</div>${ev.leader?`<div class="eleader">👤 ${ev.leader}</div>`:''}<a class="ewiki" href="${ev.wiki||'#'}" target="_blank">→ Wikipedia</a></div>`;
    }).join('');
  }
  panelEl.classList.add('open');
  /* animate cards */
  gsap.fromTo('.ecard',{opacity:0,y:20},{opacity:1,y:0,stagger:.08,duration:.35,ease:'power2.out'});
}
function closePanel(){ panelEl.classList.remove('open'); }
panelClose.addEventListener('click', closePanel);

/* ── UPDATE YEAR ── */
function update(year){
  currentYear=year;
  yearDisplay.textContent=year;
  yearSlider.value=year;
  /* animate year display */
  gsap.fromTo('#year-display',{scale:1.3,opacity:.5},{scale:1,opacity:1,duration:.35,ease:'back.out(2)'});
  drawPins();
  if(panelEl.classList.contains('open')) openPanel();
  /* fly to first event */
  const evts=DB[year];
  if(evts && evts.length){
    flyTo(evts[0].lon,evts[0].lat,2.5);
  }
}

/* ── SLIDER ── */
yearSlider.addEventListener('input', e=>update(+e.target.value));

/* ── QUICK BUTTONS ── */
QUICK_YEARS.forEach(yr=>{
  const btn=document.createElement('button');
  btn.className='qbtn'; btn.textContent=yr;
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.qbtn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    update(yr);
  });
  qbtns.appendChild(btn);
});

/* ── FILTERS ── */
document.querySelectorAll('.fbtn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.fbtn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter=btn.dataset.t;
    drawPins();
  });
});

/* ── TIMELINE ── */
function buildTimeline(){
  tlTrack.innerHTML='';
  Object.keys(DB).sort((a,b)=>a-b).forEach(yr=>{
    const evts=DB[yr];
    evts.forEach(ev=>{
      const item=document.createElement('div');
      item.className='tl-item';
      item.innerHTML=`<div class="tl-dot" style="background:${TYPE_COLORS[ev.type]}"></div>${yr} · ${ev.title}`;
      item.addEventListener('click',()=>update(+yr));
      tlTrack.appendChild(item);
    });
  });
}

/* ── LOAD GEO DATA ── */
function loadGeoJSON(){
  if(typeof WORLD_GEO !== 'undefined' && WORLD_GEO.features && WORLD_GEO.features.length > 0){
    mapGeo = WORLD_GEO;
    finishLoad();
  } else {
    /* Fallback: load from CDN */
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(r=>r.json())
      .then(topo=>{
        /* convert topojson to geojson inline */
        const obj = topo.objects.countries;
        const features = [];
        const arcs = topo.arcs;
        /* decode arcs */
        const qx=topo.transform.scale[0], qy=topo.transform.scale[1];
        const dx=topo.transform.translate[0], dy=topo.transform.translate[1];
        const decodedArcs = arcs.map(arc=>{
          let x=0,y=0;
          return arc.map(p=>{x+=p[0];y+=p[1];return [x*qx+dx,y*qy+dy]});
        });
        function decodeArc(i){return i<0?decodedArcs[~i].slice().reverse():decodedArcs[i]}
        function ring(arcs){let r=[];arcs.forEach(i=>r=r.concat(decodeArc(i)));return r}
        obj.geometries.forEach(g=>{
          let coords;
          if(g.type==='Polygon') coords=[g.arcs.map(a=>ring(a))];
          else if(g.type==='MultiPolygon') coords=g.arcs.map(p=>p.map(a=>ring(a)));
          else return;
          /* get country name from ID */
          const name = g.properties?.name || g.id || 'Unknown';
          if(g.type==='Polygon') features.push({type:'Feature',properties:{name},geometry:{type:'Polygon',coordinates:coords[0]}});
          else features.push({type:'Feature',properties:{name},geometry:{type:'MultiPolygon',coordinates:coords}});
        });
        mapGeo={type:'FeatureCollection',features};
        finishLoad();
      })
      .catch(()=>{
        /* ultra fallback: just show pins without country borders */
        mapGeo={type:'FeatureCollection',features:[]};
        finishLoad();
      });
  }
}

/* ── LOADING ANIMATION ── */
function startLoading(){
  const fill = document.getElementById('ld-fill');
  const pct = document.getElementById('ld-pct');
  let p = 0;
  const iv = setInterval(()=>{
    p += Math.random()*8+2;
    if(p>95) p=95;
    fill.style.width = p+'%';
    pct.textContent = Math.round(p)+'%';
  },100);
  return iv;
}

function finishLoad(){
  const fill = document.getElementById('ld-fill');
  const pct = document.getElementById('ld-pct');
  fill.style.width='100%'; pct.textContent='100%';
  resize();
  drawMap();
  drawPins();
  buildTimeline();
  initParticles();
  drawParticles();
  loop();
  /* hide loading */
  gsap.to('#loading-screen',{
    opacity:0,duration:1,delay:.5,ease:'power2.inOut',
    onComplete:()=>document.getElementById('loading-screen')?.remove()
  });
  /* reveal UI */
  gsap.to('.topbar',{y:0,duration:.6,delay:1,ease:'power3.out'});
  gsap.to('#timeline',{y:0,duration:.6,delay:1.15,ease:'power3.out'});
  gsap.to('#counter',{opacity:1,duration:.4,delay:1.3});
  gsap.to('#legend',{opacity:1,y:0,duration:.4,delay:1.4});
  /* initial fly */
  const evts=DB[currentYear];
  if(evts&&evts.length) setTimeout(()=>flyTo(evts[0].lon,evts[0].lat,2),1800);
}

/* ── KEYBOARD ── */
document.addEventListener('keydown',e=>{
  if(e.key==='Escape') closePanel();
  if(e.key==='ArrowRight'){
    const yrs=Object.keys(DB).map(Number).sort((a,b)=>a-b);
    const idx=yrs.indexOf(currentYear);
    if(idx<yrs.length-1) update(yrs[idx+1]);
  }
  if(e.key==='ArrowLeft'){
    const yrs=Object.keys(DB).map(Number).sort((a,b)=>a-b);
    const idx=yrs.indexOf(currentYear);
    if(idx>0) update(yrs[idx-1]);
  }
});

/* ── CLICK MAP TO OPEN PANEL ── */
mapCanvas.addEventListener('dblclick', ()=>openPanel());

/* ── INIT ── */
const loadIv = startLoading();
loadGeoJSON();
setTimeout(()=>clearInterval(loadIv),3000);

/* ── INITIAL HIDDEN STATES ── */
gsap.set('#counter',{opacity:0});
gsap.set('#legend',{opacity:0,y:10});
