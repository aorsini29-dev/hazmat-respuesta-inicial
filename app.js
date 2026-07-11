
const CATALOG=window.GRE_CATALOG||[], T1=window.GRE_TABLE1||{}, T3=window.GRE_TABLE3||{};
const $=id=>document.getElementById(id), winds={light:0,moderate:1,strong:2};
let current=null,map,marker,isoLayer,protectLayer,windLine,measureMode=false,measurePts=[],measureLayer;
function showView(id){document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id));document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.view===id));if(id==='mapview')setTimeout(()=>{initMap();map.invalidateSize();if(current)renderMap()},80);if(id==='history')renderHistory();if(id==='ics')loadICSView()}
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>showView(t.dataset.view));

const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function searchableRows(q){
 q=normalize(q).trim();
 let rows=q?CATALOG.filter(x=>x.un.includes(q)||normalize(x.name).includes(q)):CATALOG.slice(0,120);
 const seen=new Set();return rows.filter(x=>{let k=x.un+'|'+x.name;if(seen.has(k))return false;seen.add(k);return true}).slice(0,250)
}
function fillUN(query=''){
 const rows=searchableRows(query);
 $('un').innerHTML=rows.map(x=>`<option value="${x.un}" data-name="${escapeHtml(x.name)}" data-guide="${x.guide}">UN${x.un} · G${x.guide} — ${escapeHtml(x.name)}</option>`).join('');
 if(!rows.length)$('un').innerHTML='<option value="">Sin coincidencias</option>';
 updateScenarioControls()
}
$('searchChemical').oninput=e=>fillUN(e.target.value);
$('un').onchange=updateScenarioControls;
$('spillSize').onchange=updateScenarioControls;

function selectedRec(){
 const opt=$('un').selectedOptions[0]; if(!opt||!opt.value)return null;
 return {un:opt.value,name:opt.dataset.name||'',guide:opt.dataset.guide||''}
}
function updateScenarioControls(){
 const r=selectedRec(),size=$('spillSize').value,wrap=$('containerWrap');
 if(!r){wrap.style.display='none';return}
 const hasT3=!!T3[r.un]&&size==='large';
 wrap.style.display=hasT3?'block':'none';
 if(hasT3){
   $('container').innerHTML=Object.entries(T3[r.un].containers).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')
 }
}
$('windPreset').onchange=e=>{if(e.target.value!=='')$('bearing').value=e.target.value};
$('gps').onclick=()=>navigator.geolocation?navigator.geolocation.getCurrentPosition(p=>{$('lat').value=p.coords.latitude.toFixed(7);$('lon').value=p.coords.longitude.toFixed(7);if(map)map.setView([p.coords.latitude,p.coords.longitude],15)},e=>alert('No fue posible obtener el GPS: '+e.message),{enableHighAccuracy:true}):alert('GPS no disponible');
$('compass').onclick=async()=>{try{if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){let r=await DeviceOrientationEvent.requestPermission();if(r!=='granted')throw new Error('Permiso denegado')}const h=e=>{let a=e.webkitCompassHeading??(360-e.alpha);if(Number.isFinite(a)){$('bearing').value=Math.round(a);window.removeEventListener('deviceorientation',h);alert('Rumbo cargado: '+Math.round(a)+'°')}};window.addEventListener('deviceorientation',h,true);setTimeout(()=>window.removeEventListener('deviceorientation',h),8000)}catch(e){alert('No fue posible usar la brújula: '+e.message)}};
$('calc').onclick=calculate;

function t1Record(un,name){
 const arr=T1[un]||[];
 return arr.find(x=>normalize(x.name)===normalize(name))||arr[0]||null
}
function calculate(){
 const r=selectedRec();if(!r)return alert('Seleccione una sustancia');
 const size=$('spillSize').value,p=$('period').value,w=$('wind').value;
 let iso,prot,source,container='',containerLabel='',warning='';
 if(size==='large'&&T3[r.un]){
   const c=$('container').value,row=T3[r.un].containers[c];
   iso=row.iso;prot=row[p][winds[w]];source='GRE 2024 · Tabla 3';container=c;containerLabel=row.label
 } else {
   const row=t1Record(r.un,r.name);
   if(!row)return alert('La sustancia está en el catálogo, pero esta versión todavía no tiene una fila estructurada de Tabla 1 para calcular distancias. Consulte la GRE 2024.');
   const block=row[size];
   if(block.table3)return alert('Para derrame grande, esta sustancia requiere Tabla 3 y selección de recipiente.');
   iso=block.iso_m;prot=block[p+'_km'];source='GRE 2024 · Tabla 1';
 }
 current={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),createdAt:new Date().toISOString(),title:$('title').value||'Incidente HazMat',notes:$('notes').value||'',un:r.un,name:r.name,guide:r.guide,spillSize:size,container,containerLabel,period:p,wind:w,bearing:((+$('bearing').value%360)+360)%360,lat:+$('lat').value,lon:+$('lon').value,isolation_m:+iso,protective_km:prot,source};
 $('chemical').textContent=`UN${r.un} — ${r.name}`;
 $('scenario').textContent=`Guía ${r.guide} · ${size==='small'?'derrame pequeño':'derrame grande'}${containerLabel?' · '+containerLabel:''} · ${p==='day'?'Día':'Noche'} · viento ${w==='light'?'leve':w==='moderate'?'moderado':'fuerte'}`;
 $('iso').textContent=`${iso} m`;$('protect').textContent=`${prot} km`;
 $('warn').innerHTML=(String(prot).includes('+')?'<b>Distancia con “+”:</b> puede ser mayor en ciertas condiciones atmosféricas.<br>':'')+`<b>${source}.</b> Aproxímese desde barlovento, terreno elevado y corriente arriba. Confirme producto, recipiente, liberación y viento real.`;
 $('resultCard').classList.remove('hidden');if(map)renderMap()
}
$('goMap').onclick=()=>showView('mapview');
$('save').onclick=()=>{if(!current)return;let arr=getHistory();let i=arr.findIndex(x=>x.id===current.id);if(i>=0)arr[i]=current;else arr.unshift(current);localStorage.setItem('hazmatHistory',JSON.stringify(arr.slice(0,100)));alert('Incidente guardado');renderHistory()};

function initMap(){if(map)return;map=L.map('map').setView([+$('lat').value,+$('lon').value],14);const osm=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}),sat=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Esri'});osm.addTo(map);L.control.layers({'Calles':osm,'Satelital':sat},null,{collapsed:true}).addTo(map);map.on('click',e=>{if(measureMode)return addMeasurePoint(e.latlng);$('lat').value=e.latlng.lat.toFixed(7);$('lon').value=e.latlng.lng.toFixed(7);if(current){current.lat=e.latlng.lat;current.lon=e.latlng.lng;renderMap()}})}
function destination(lat,lon,bearing,dist){const R=6378137,d=dist/R,b=bearing*Math.PI/180,p1=lat*Math.PI/180,l1=lon*Math.PI/180,p2=Math.asin(Math.sin(p1)*Math.cos(d)+Math.cos(p1)*Math.sin(d)*Math.cos(b)),l2=l1+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(p1),Math.cos(d)-Math.sin(p1)*Math.sin(p2));return[p2*180/Math.PI,l2*180/Math.PI]}
function sectorLatLngs(c){let km=parseFloat(String(c.protective_km).replace('+','')),down=(c.bearing+180)%360,a=[[c.lat,c.lon]];for(let i=0;i<=48;i++)a.push(destination(c.lat,c.lon,down-22.5+45*i/48,km*1000));a.push([c.lat,c.lon]);return a}
function renderMap(){initMap();if(!current)return;[marker,isoLayer,protectLayer,windLine].forEach(x=>x&&map.removeLayer(x));marker=L.marker([current.lat,current.lon],{draggable:true}).addTo(map).bindPopup(`<b>${escapeHtml(current.title)}</b><br>UN${current.un} — ${escapeHtml(current.name)}<br>${current.source}`);marker.on('dragend',e=>{let p=e.target.getLatLng();current.lat=p.lat;current.lon=p.lng;$('lat').value=p.lat.toFixed(7);$('lon').value=p.lng.toFixed(7);renderMap()});isoLayer=L.circle([current.lat,current.lon],{radius:current.isolation_m,color:'#c62828',weight:3,fillColor:'#ef5350',fillOpacity:.28}).addTo(map);protectLayer=L.polygon(sectorLatLngs(current),{color:'#f9a825',weight:3,fillColor:'#fdd835',fillOpacity:.26}).addTo(map);const end=destination(current.lat,current.lon,(current.bearing+180)%360,Math.min(parseFloat(String(current.protective_km).replace('+',''))*1000,2500));windLine=L.polyline([[current.lat,current.lon],end],{color:'#1565c0',weight:5}).addTo(map);map.fitBounds(L.featureGroup([isoLayer,protectLayer]).getBounds().pad(.12))}
$('centerMap').onclick=()=>current&&map.setView([current.lat,current.lon],15);
$('measure').onclick=()=>{measureMode=!measureMode;measurePts=[];if(measureLayer)map.removeLayer(measureLayer);$('measureStatus').textContent=measureMode?'Tocá dos puntos del mapa.':'Medición desactivada.'};
$('clearMeasure').onclick=()=>{measurePts=[];if(measureLayer)map.removeLayer(measureLayer);$('measureStatus').textContent='Medición desactivada.';measureMode=false};
function addMeasurePoint(p){measurePts.push(p);if(measurePts.length===2){let d=map.distance(measurePts[0],measurePts[1]);measureLayer=L.polyline(measurePts,{color:'#6a1b9a',weight:4,dashArray:'8,8'}).addTo(map);$('measureStatus').textContent=`Distancia: ${d<1000?d.toFixed(0)+' m':(d/1000).toFixed(2)+' km'}`;measureMode=false}}

function getHistory(){try{return JSON.parse(localStorage.getItem('hazmatHistory')||'[]')}catch{return[]}}
function renderHistory(){const arr=getHistory(),box=$('historyList');if(!arr.length){box.innerHTML='<p class="small">No hay incidentes guardados.</p>';return}box.innerHTML=arr.map(x=>`<div class="history-item"><div class="history-title">${escapeHtml(x.title)}</div><div class="history-meta">UN${x.un} · ${escapeHtml(x.name)} · ${new Date(x.createdAt).toLocaleString()}<br>${x.source||''}<br>${x.lat.toFixed(5)}, ${x.lon.toFixed(5)}</div><div class="mini-actions"><button class="secondary" onclick="openIncident('${x.id}')">Abrir</button><button class="secondary" onclick="exportSaved('${x.id}','kml')">KML</button><button class="danger" onclick="deleteIncident('${x.id}')">Eliminar</button></div></div>`).join('')}
window.openIncident=id=>{let x=getHistory().find(v=>v.id===id);if(!x)return;current=x;loadForm(x);$('resultCard').classList.remove('hidden');$('chemical').textContent=`UN${x.un} — ${x.name}`;$('scenario').textContent=`${x.source||''}`;$('iso').textContent=x.isolation_m+' m';$('protect').textContent=x.protective_km+' km';showView('mapview');setTimeout(renderMap,100)};
function loadForm(x){$('searchChemical').value=x.un;fillUN(x.un);$('un').value=x.un;$('spillSize').value=x.spillSize||'large';updateScenarioControls();if(x.container)$('container').value=x.container;$('period').value=x.period;$('wind').value=x.wind;$('bearing').value=x.bearing;$('lat').value=x.lat;$('lon').value=x.lon;$('title').value=x.title;$('notes').value=x.notes||''}
window.deleteIncident=id=>{localStorage.setItem('hazmatHistory',JSON.stringify(getHistory().filter(x=>x.id!==id)));renderHistory()};
$('clearHistory').onclick=()=>{if(confirm('¿Eliminar todo el historial local?')){localStorage.removeItem('hazmatHistory');renderHistory()}};
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}

function circleCoords(c,r){let a=[];for(let b=0;b<=360;b+=5){let[la,lo]=destination(c.lat,c.lon,b,r);a.push(`${lo},${la},0`)}return a.join(' ')}
function sectorCoords(c){return sectorLatLngs(c).map(([la,lo])=>`${lo},${la},0`).join(' ')}
function toKML(c){return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${escapeHtml(c.title)} — UN${c.un}</name><description>${c.source}. Guía ${c.guide}. Uso inicial; verificar en campo.</description><Placemark><name>Punto de liberación</name><Point><coordinates>${c.lon},${c.lat},0</coordinates></Point></Placemark><Placemark><name>Aislamiento inicial ${c.isolation_m} m</name><Style><LineStyle><color>ff0000ff</color><width>3</width></LineStyle><PolyStyle><color>550000ff</color></PolyStyle></Style><Polygon><outerBoundaryIs><LinearRing><coordinates>${circleCoords(c,c.isolation_m)}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark><Placemark><name>Acción protectora ${c.protective_km} km</name><Style><LineStyle><color>ff00ffff</color><width>3</width></LineStyle><PolyStyle><color>5500ffff</color></PolyStyle></Style><Polygon><outerBoundaryIs><LinearRing><coordinates>${sectorCoords(c)}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></Document></kml>`}
function toGeoJSON(c){let sector=sectorLatLngs(c).map(([la,lo])=>[lo,la]);return{type:'FeatureCollection',features:[{type:'Feature',properties:{kind:'incident',un:c.un,name:c.name,guide:c.guide,source:c.source},geometry:{type:'Point',coordinates:[c.lon,c.lat]}},{type:'Feature',properties:{kind:'protective_action',distance_km:c.protective_km},geometry:{type:'Polygon',coordinates:[sector]}}]}}
function download(name,data,type){let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
$('kml').onclick=()=>current&&download(`UN${current.un}_${safeName(current.title)}.kml`,toKML(current),'application/vnd.google-earth.kml+xml');
$('geojson').onclick=()=>current&&download(`UN${current.un}_${safeName(current.title)}.geojson`,JSON.stringify(toGeoJSON(current),null,2),'application/geo+json');
$('json').onclick=()=>current&&download(`UN${current.un}_${safeName(current.title)}.json`,JSON.stringify(current,null,2),'application/json');
window.exportSaved=(id,type)=>{let c=getHistory().find(x=>x.id===id);if(c&&type==='kml')download(`UN${c.un}_${safeName(c.title)}.kml`,toKML(c),'application/vnd.google-earth.kml+xml')};
function safeName(s){return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'_').replace(/^_|_$/g,'')}
fillUN('1005');renderHistory();


// ---------------- Sprint 3: Sistema de Comando de Incidentes ----------------
const ICS_CHECKS=[
'Comando establecido, identificado y comunicado.',
'Evaluación inicial y objetivos tácticos definidos.',
'Zona caliente, tibia y fría delimitadas.',
'Dirección del viento y ruta de aproximación confirmadas.',
'Oficial de Seguridad o asistente HazMat asignado.',
'Control de acceso y registro de personal implementados.',
'Equipo de entrada identificado y con competencia/EPP adecuados.',
'Equipo de respaldo disponible y listo.',
'Corredor de descontaminación operativo antes del ingreso.',
'Plan de comunicaciones y canal táctico confirmados.',
'Monitoreo atmosférico previsto y equipos verificados.',
'Plan médico, rehabilitación y transporte definidos.',
'Recurso técnico/químico o contacto de emergencia consultado.',
'Plan de emergencia para pérdida de comunicaciones o rescate del personal.',
'Transferencia de comando y registro de decisiones previstos.'
];
const DEFAULT_OBJECTIVES=[
'Proteger la vida y evitar nuevas exposiciones.',
'Aislar el área y controlar el acceso.',
'Identificar el producto, recipiente y condiciones de liberación.',
'Establecer monitoreo, descontaminación y capacidad de rescate.',
'Estabilizar el incidente mediante acciones compatibles con el nivel de competencia.'
];
const ROLE_IDS=['roleIC','roleSafety','roleLiaison','rolePIO','roleHazmat','roleHazSafety','roleEntry','roleBackup','roleDecon','roleAccess','roleTechnical','roleMedical'];

function loadICSView(){
 if(current && !$('icsIncidentName').value)$('icsIncidentName').value=current.title||`UN${current.un}`;
 const saved=getICSPlan();
 if(saved)populateICS(saved);
 if(!$('objectives').children.length)DEFAULT_OBJECTIVES.forEach(x=>addObjectiveRow(x));
 if(!$('resources').children.length)addResourceRow('Unidad HazMat','Disponible');
 if(!$('icsChecklist').children.length)renderICSChecklist(saved?.checks||[]);
 updateICSProgress();updateICSSummary();
}
function getICSKey(){return current?`hazmatICS:${current.id}`:'hazmatICS:draft'}
function getICSPlan(){try{return JSON.parse(localStorage.getItem(getICSKey())||'null')}catch{return null}}
function renderICSChecklist(checked=[]){
 $('icsChecklist').innerHTML=ICS_CHECKS.map((x,i)=>`<label class="checkrow"><input type="checkbox" data-ics-check="${i}" ${checked[i]?'checked':''}><span>${escapeHtml(x)}</span></label>`).join('');
 document.querySelectorAll('[data-ics-check]').forEach(c=>c.onchange=()=>{updateICSProgress();updateICSSummary()})
}
function updateICSProgress(){
 const boxes=[...document.querySelectorAll('[data-ics-check]')],done=boxes.filter(x=>x.checked).length;
 $('progressText').textContent=`${done} de ${boxes.length} completados`;
 $('progressBar').style.width=boxes.length?`${done/boxes.length*100}%`:'0%';
}
function addObjectiveRow(value=''){
 const d=document.createElement('div');d.className='obj-row';
 d.innerHTML=`<input value="${escapeHtml(value)}" placeholder="Objetivo"><button class="danger" type="button">Quitar</button>`;
 d.querySelector('button').onclick=()=>{d.remove();updateICSSummary()};
 d.querySelector('input').oninput=updateICSSummary;$('objectives').appendChild(d)
}
function addResourceRow(name='',status='Asignado'){
 const d=document.createElement('div');d.className='resource-row';
 d.innerHTML=`<div class="grid"><input class="res-name" value="${escapeHtml(name)}" placeholder="Recurso / unidad"><select class="res-status"><option>Disponible</option><option>Asignado</option><option>En tránsito</option><option>Fuera de servicio</option></select></div><button class="danger" type="button">Quitar</button>`;
 d.querySelector('.res-status').value=status;
 d.querySelector('button').onclick=()=>{d.remove();updateICSSummary()};
 d.querySelectorAll('input,select').forEach(x=>x.oninput=updateICSSummary);$('resources').appendChild(d)
}
$('addObjective').onclick=()=>addObjectiveRow('');
$('addResource').onclick=()=>addResourceRow('','Asignado');
[...ROLE_IDS,'icsLevel','commandMode','icsIncidentName','operationalPeriod'].forEach(id=>$(id).addEventListener('input',updateICSSummary));

function collectICS(){
 return {
  version:'0.4',incidentId:current?.id||null,incidentName:$('icsIncidentName').value||current?.title||'Incidente HazMat',
  operationalPeriod:$('operationalPeriod').value||'Inicial',level:$('icsLevel').value,commandMode:$('commandMode').value,
  roles:Object.fromEntries(ROLE_IDS.map(id=>[id,$(id).value.trim()])),
  objectives:[...$('objectives').querySelectorAll('input')].map(x=>x.value.trim()).filter(Boolean),
  checks:[...document.querySelectorAll('[data-ics-check]')].map(x=>x.checked),
  resources:[...$('resources').querySelectorAll('.resource-row')].map(r=>({name:r.querySelector('.res-name').value.trim(),status:r.querySelector('.res-status').value})).filter(x=>x.name),
  updatedAt:new Date().toISOString(),
  incident:current?{un:current.un,name:current.name,lat:current.lat,lon:current.lon,isolation_m:current.isolation_m,protective_km:current.protective_km,source:current.source}:null
 }
}
function populateICS(p){
 $('icsIncidentName').value=p.incidentName||'';$('operationalPeriod').value=p.operationalPeriod||'Inicial';
 $('icsLevel').value=p.level||'initial';$('commandMode').value=p.commandMode||'single';
 ROLE_IDS.forEach(id=>$(id).value=p.roles?.[id]||'');
 $('objectives').innerHTML='';(p.objectives?.length?p.objectives:DEFAULT_OBJECTIVES).forEach(addObjectiveRow);
 $('resources').innerHTML='';(p.resources?.length?p.resources:[{name:'Unidad HazMat',status:'Disponible'}]).forEach(x=>addResourceRow(x.name,x.status));
 renderICSChecklist(p.checks||[])
}
function roleLabel(id){return {roleIC:'Comandante del Incidente',roleSafety:'Oficial de Seguridad',roleLiaison:'Enlace',rolePIO:'Información Pública',roleHazmat:'Supervisor Grupo HazMat',roleHazSafety:'Asistente Seguridad HazMat',roleEntry:'Equipo de Entrada',roleBackup:'Equipo de Respaldo',roleDecon:'Descontaminación',roleAccess:'Control de Acceso',roleTechnical:'Especialista Técnico',roleMedical:'Grupo Médico / EMS'}[id]||id}
function updateICSSummary(){
 if(!$('icsSummary'))return;
 const p=collectICS(),done=p.checks.filter(Boolean).length;
 const roles=Object.entries(p.roles).filter(([,v])=>v).map(([k,v])=>`• ${roleLabel(k)}: ${v}`).join('\n')||'• Sin asignaciones registradas';
 const objectives=p.objectives.map((x,i)=>`${i+1}. ${x}`).join('\n')||'Sin objetivos';
 const resources=p.resources.map(x=>`• ${x.name}: ${x.status}`).join('\n')||'Sin recursos';
 $('icsSummary').textContent=`INCIDENTE: ${p.incidentName}
PERÍODO: ${p.operationalPeriod}
COMANDO: ${p.commandMode==='unified'?'Unificado':'Único'}
ESTRUCTURA: ${p.level==='expanded'?'Expandida HazMat':'Inicial'}

ASIGNACIONES
${roles}

OBJETIVOS
${objectives}

RECURSOS
${resources}

CONTROL DE SEGURIDAD: ${done}/${p.checks.length}`;
}
$('saveICS').onclick=()=>{
 const p=collectICS();localStorage.setItem(getICSKey(),JSON.stringify(p));updateICSSummary();alert('Plan del incidente guardado localmente')
};
$('exportICS').onclick=()=>{
 const p=collectICS();download(`SCI_${safeName(p.incidentName)}.json`,JSON.stringify(p,null,2),'application/json')
};
