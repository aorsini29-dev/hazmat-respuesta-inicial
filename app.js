
const CATALOG=window.GRE_CATALOG||[], T1=window.GRE_TABLE1||{}, T3=window.GRE_TABLE3||{};
const $=id=>document.getElementById(id), winds={light:0,moderate:1,strong:2};
let current=null,map,marker,isoLayer,protectLayer,windLine,measureMode=false,measurePts=[],measureLayer;
const menuBtn=document.getElementById('menuBtn'),drawer=document.getElementById('drawer'),drawerBackdrop=document.getElementById('drawerBackdrop');
function openDrawer(){drawer?.classList.add('open');drawerBackdrop?.classList.add('open')}
function closeDrawer(){drawer?.classList.remove('open');drawerBackdrop?.classList.remove('open')}
menuBtn?.addEventListener('click',openDrawer);
document.getElementById('closeDrawer')?.addEventListener('click',closeDrawer);
drawerBackdrop?.addEventListener('click',closeDrawer);
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>showView(t.dataset.view)));
function showView(id){
 document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id));
 document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.view===id));
 closeDrawer();
 if(id==='mapview')setTimeout(()=>{initMap();map.invalidateSize();if(current){renderMap();renderTacticalMarkers();applyTacticalZones(false)}},100);if(id==='advancedmap')setTimeout(()=>{initAdvancedMap();advancedMap.invalidateSize();renderAdvancedIncident()},120);
 if(id==='history')renderHistory();
 if(id==='ics')loadICSView();
 if(id==='operations')loadOperations();if(id==='ppe')loadPPE();if(id==='library')loadLibrary();if(id==='technical')loadTechnical();if(id==='weather')loadWeatherModule();
 if(id==='reports')buildReport();
 if(id==='tactical')loadTactical();
}

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
 $('resultCard').classList.remove('hidden');if(map)renderMap();updateGlobalStatus()
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
window.openIncident=id=>{let x=getHistory().find(v=>v.id===id);if(!x)return;current=x;loadForm(x);$('resultCard').classList.remove('hidden');$('chemical').textContent=`UN${x.un} — ${x.name}`;$('scenario').textContent=`${x.source||''}`;$('iso').textContent=x.isolation_m+' m';$('protect').textContent=x.protective_km+' km';showView('mapview');setTimeout(()=>{renderMap();updateGlobalStatus()},100)};
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


// ---------------- Sprint 4: Operaciones, recursos y reportes ----------------
const OPS_CHECKS=[
'Compatibilidad del EPP confirmada para la sustancia y concentración esperada.',
'SCBA inspeccionados, con autonomía suficiente y equipo de respaldo.',
'Detectores seleccionados, calibrados y con prueba funcional.',
'Descontaminación preparada antes del ingreso.',
'Equipo de entrada y respaldo registrados nominalmente.',
'Canal de comunicaciones probado.',
'Zona de rehabilitación y control médico disponible.',
'Tiempo de ingreso, presión de cilindros y rotación definidos.',
'Ruta de ingreso y egreso identificada.',
'Procedimiento de emergencia y rescate del interviniente comunicado.',
'Residuos y efluentes de descontaminación contenidos.',
'Reevaluación meteorológica y de zonas programada.'
];
const DEFAULT_EQUIPMENT={
 ppe:[['SCBA','2','Disponible'],['Traje químico encapsulado','2','Disponible']],
 monitor:[['Detector multigás','1','Disponible'],['Tubos colorimétricos / sensor específico','1','Pendiente']],
 decon:[['Línea de descontaminación','1','Disponible'],['Contención de efluentes','1','Pendiente']],
 unit:[['Unidad HazMat','1','Asignado'],['Ambulancia / EMS','1','Asignado']]
};
const DEFAULT_TASKS=[
['Confirmar identificación del producto','Grupo HazMat','Pendiente'],
['Establecer monitoreo a barlovento y perímetro','Monitoreo','Pendiente'],
['Preparar descontaminación','Descontaminación','Pendiente'],
['Evaluar control defensivo de la liberación','Supervisor HazMat','Pendiente']
];

function opsKey(){return current?`hazmatOPS:${current.id}`:'hazmatOPS:draft'}
function getOps(){try{return JSON.parse(localStorage.getItem(opsKey())||'null')}catch{return null}}

function addEquipmentRow(containerId,name='',qty='1',status='Disponible'){
 const d=document.createElement('div');d.className='equipment-row';
 d.innerHTML=`<input class="eq-name" value="${escapeHtml(name)}" placeholder="Equipo"><input class="eq-qty" value="${escapeHtml(qty)}" placeholder="Cantidad"><select class="eq-status"><option>Disponible</option><option>Asignado</option><option>En uso</option><option>Pendiente</option><option>Fuera de servicio</option></select><button class="danger">Quitar</button>`;
 d.querySelector('.eq-status').value=status;d.querySelector('button').onclick=()=>d.remove();$(containerId).appendChild(d)
}
function addTaskRow(task='',owner='',status='Pendiente'){
 const d=document.createElement('div');d.className='task-row';
 d.innerHTML=`<input class="task-name" value="${escapeHtml(task)}" placeholder="Tarea"><input class="task-owner" value="${escapeHtml(owner)}" placeholder="Responsable"><select class="task-status"><option>Pendiente</option><option>En curso</option><option>Completada</option><option>Cancelada</option></select><button class="danger">Quitar</button>`;
 d.querySelector('.task-status').value=status;d.querySelector('button').onclick=()=>d.remove();$('taskList').appendChild(d)
}
function addLogRow(time='',actor='',event=''){
 const d=document.createElement('div');d.className='log-row';
 const now=new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
 d.innerHTML=`<input class="log-time" value="${escapeHtml(time||now)}" placeholder="Hora"><input class="log-actor" value="${escapeHtml(actor)}" placeholder="Responsable"><input class="log-event" value="${escapeHtml(event)}" placeholder="Decisión / evento"><button class="danger">Quitar</button>`;
 d.querySelector('button').onclick=()=>d.remove();$('logList').appendChild(d)
}
$('addPPE').onclick=()=>addEquipmentRow('ppeList');
$('addMonitor').onclick=()=>addEquipmentRow('monitorList');
$('addDecon').onclick=()=>addEquipmentRow('deconList');
$('addUnit').onclick=()=>addEquipmentRow('unitList');
$('addTask').onclick=()=>addTaskRow();
$('addLog').onclick=()=>addLogRow();

function renderOpsChecklist(checked=[]){
 $('opsChecklist').innerHTML=OPS_CHECKS.map((x,i)=>`<label class="checkrow"><input type="checkbox" data-ops-check="${i}" ${checked[i]?'checked':''}><span>${escapeHtml(x)}</span></label>`).join('');
 document.querySelectorAll('[data-ops-check]').forEach(x=>x.onchange=updateOpsProgress)
}
function updateOpsProgress(){
 const a=[...document.querySelectorAll('[data-ops-check]')],n=a.filter(x=>x.checked).length;
 $('opsProgressText').textContent=`${n} de ${a.length} completados`;$('opsProgressBar').style.width=`${a.length?n/a.length*100:0}%`
}
function collectEquipment(containerId){return [...$(containerId).querySelectorAll('.equipment-row')].map(r=>({name:r.querySelector('.eq-name').value.trim(),qty:r.querySelector('.eq-qty').value.trim(),status:r.querySelector('.eq-status').value})).filter(x=>x.name)}
function collectOperations(){
 return {
  version:'0.5',incidentId:current?.id||null,updatedAt:new Date().toISOString(),
  equipment:{ppe:collectEquipment('ppeList'),monitor:collectEquipment('monitorList'),decon:collectEquipment('deconList'),unit:collectEquipment('unitList')},
  tasks:[...$('taskList').querySelectorAll('.task-row')].map(r=>({task:r.querySelector('.task-name').value.trim(),owner:r.querySelector('.task-owner').value.trim(),status:r.querySelector('.task-status').value})).filter(x=>x.task),
  log:[...$('logList').querySelectorAll('.log-row')].map(r=>({time:r.querySelector('.log-time').value.trim(),actor:r.querySelector('.log-actor').value.trim(),event:r.querySelector('.log-event').value.trim()})).filter(x=>x.event),
  checks:[...document.querySelectorAll('[data-ops-check]')].map(x=>x.checked)
 }
}
function loadOperations(){
 const p=getOps();
 ['ppeList','monitorList','deconList','unitList','taskList','logList'].forEach(id=>$(id).innerHTML='');
 const eq=p?.equipment||{};
 (eq.ppe||DEFAULT_EQUIPMENT.ppe.map(x=>({name:x[0],qty:x[1],status:x[2]}))).forEach(x=>addEquipmentRow('ppeList',x.name,x.qty,x.status));
 (eq.monitor||DEFAULT_EQUIPMENT.monitor.map(x=>({name:x[0],qty:x[1],status:x[2]}))).forEach(x=>addEquipmentRow('monitorList',x.name,x.qty,x.status));
 (eq.decon||DEFAULT_EQUIPMENT.decon.map(x=>({name:x[0],qty:x[1],status:x[2]}))).forEach(x=>addEquipmentRow('deconList',x.name,x.qty,x.status));
 (eq.unit||DEFAULT_EQUIPMENT.unit.map(x=>({name:x[0],qty:x[1],status:x[2]}))).forEach(x=>addEquipmentRow('unitList',x.name,x.qty,x.status));
 (p?.tasks||DEFAULT_TASKS.map(x=>({task:x[0],owner:x[1],status:x[2]}))).forEach(x=>addTaskRow(x.task,x.owner,x.status));
 (p?.log||[]).forEach(x=>addLogRow(x.time,x.actor,x.event));
 renderOpsChecklist(p?.checks||[]);updateOpsProgress()
}
$('saveOperations').onclick=()=>{const p=collectOperations();localStorage.setItem(opsKey(),JSON.stringify(p));alert('Plan operativo guardado localmente')};
$('exportOperations').onclick=()=>{const p=collectOperations();download(`Operaciones_${safeName(current?.title||'Incidente')}.json`,JSON.stringify(p,null,2),'application/json')};

function tableRows(items,cols){
 if(!items?.length)return '<tr><td colspan="'+cols.length+'">Sin registros</td></tr>';
 return items.map(x=>'<tr>'+cols.map(c=>`<td>${escapeHtml(x[c]??'')}</td>`).join('')+'</tr>').join('')
}
function buildReport(){
 if(!$('reportPreview'))return;
 const inc=current,ics=getICSPlan(),ops=getOps()||collectOperations(),ppe=getSavedPPE();
 const author=$('reportAuthor')?.value||'',status=$('incidentStatus')?.value||'En evaluación';
 const conclusion=$('reportConclusion')?.value||'',next=$('nextActions')?.value||'';
 if(!inc){$('reportPreview').innerHTML='<h1>Reporte HazMat</h1><p>No hay un incidente activo.</p>';return}
 const roles=ics?.roles||{},checksIcs=ics?.checks||[],checksOps=ops?.checks||[];
 const icsDone=checksIcs.filter(Boolean).length,opsDone=checksOps.filter(Boolean).length;
 const allEq=[...(ops.equipment?.ppe||[]),...(ops.equipment?.monitor||[]),...(ops.equipment?.decon||[]),...(ops.equipment?.unit||[])];
 $('reportPreview').innerHTML=`
 <h1>${escapeHtml(inc.title)}</h1>
 <p><b>Estado:</b> ${escapeHtml(status)}<br><b>Responsable del reporte:</b> ${escapeHtml(author||'No informado')}<br><b>Fecha:</b> ${new Date().toLocaleString()}</p>
 <h2>Identificación y escenario</h2>
 <table><tr><th>ONU</th><td>${inc.un}</td><th>Sustancia</th><td>${escapeHtml(inc.name)}</td></tr>
 <tr><th>Guía</th><td>${escapeHtml(inc.guide||'')}</td><th>Fuente</th><td>${escapeHtml(inc.source||'')}</td></tr>
 <tr><th>Aislamiento</th><td>${inc.isolation_m} m</td><th>Acción protectora</th><td>${inc.protective_km} km</td></tr>
 <tr><th>Ubicación</th><td colspan="3">${inc.lat.toFixed(6)}, ${inc.lon.toFixed(6)}</td></tr></table>
 <h2>Comando y organización</h2>
 <table><tr><th>Función</th><th>Asignación</th></tr>
 ${Object.entries(roles).filter(([,v])=>v).map(([k,v])=>`<tr><td>${escapeHtml(roleLabel(k))}</td><td>${escapeHtml(v)}</td></tr>`).join('')||'<tr><td colspan="2">Sin asignaciones</td></tr>'}</table>
 <p><b>Checklist SCI:</b> ${icsDone}/${checksIcs.length||0}</p>
 <h2>Objetivos</h2><ol>${(ics?.objectives||[]).map(x=>`<li>${escapeHtml(x)}</li>`).join('')||'<li>Sin objetivos registrados</li>'}</ol>
 <h2>Recursos y equipos</h2>
 <table><tr><th>Recurso</th><th>Cantidad</th><th>Estado</th></tr>${tableRows(allEq,['name','qty','status'])}</table>
 <h2>Plan de tareas</h2>
 <table><tr><th>Tarea</th><th>Responsable</th><th>Estado</th></tr>${tableRows(ops.tasks,['task','owner','status'])}</table>
 <h2>Registro cronológico</h2>
 <table><tr><th>Hora</th><th>Responsable</th><th>Evento / decisión</th></tr>${tableRows(ops.log,['time','actor','event'])}</table>
 <p><b>Checklist operativo:</b> ${opsDone}/${checksOps.length||0}</p>
 ${ppe?.result?`<h2>Evaluación preliminar de EPP</h2>
 <table><tr><th>Nivel</th><td>${escapeHtml(ppe.result.level)}</td></tr>
 <tr><th>Respiratoria</th><td>${escapeHtml(ppe.result.respiratory)}</td></tr>
 <tr><th>Traje</th><td>${escapeHtml(ppe.result.suit)}</td></tr>
 <tr><th>Advertencias</th><td>${escapeHtml((ppe.result.warnings||[]).join(' | ')||'Sin advertencias registradas')}</td></tr></table>`:''}
 <h2>Situación actual</h2><p>${escapeHtml(conclusion||'Sin conclusión registrada')}</p>
 <h2>Próximas acciones</h2><p>${escapeHtml(next||'Sin acciones registradas')}</p>
 <h2>Advertencia</h2><p>Documento de apoyo. Verificar siempre con la GRE 2024, procedimientos locales, monitoreo atmosférico y autoridad competente.</p>`;
}
$('buildReport').onclick=buildReport;
$('printReport').onclick=()=>{buildReport();window.print()};
$('exportReport').onclick=()=>{buildReport();const html=`<!doctype html><meta charset="utf-8"><title>Reporte HazMat</title><style>body{font-family:Arial,sans-serif;max-width:900px;margin:30px auto;line-height:1.45}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:7px;text-align:left}h2{border-bottom:1px solid #ccc}</style>${$('reportPreview').innerHTML}`;download(`Reporte_${safeName(current?.title||'HazMat')}.html`,html,'text/html')};


// ---------------- Sprint 5: Motor táctico, meteorología y calculadoras ----------------
let tacticalMarkers=[], tacticalLayers=[], tacticalZoneLayers=[];
const TACTICAL_ICONS={
 command:['PC','#6a1b9a'],decon:['DEC','#ef6c00'],staging:['STG','#1565c0'],medical:['MED','#2e7d32'],
 access:['ACC','#5d4037'],police:['POL','#263238'],hazmat:['HM','#f9a825'],fire:['FIRE','#c62828'],
 ambulance:['AMB','#00897b'],drone:['DRN','#3949ab'],press:['PRE','#8d6e63'],sensitive:['SEN','#ad1457']
};
function tacticalKey(){return current?`hazmatTACT:${current.id}`:'hazmatTACT:draft'}
function getTactical(){try{return JSON.parse(localStorage.getItem(tacticalKey())||'null')}catch{return null}}
function loadTactical(){
 const p=getTactical();
 tacticalMarkers=p?.markers||tacticalMarkers||[];
 if(p?.warmRadius)$('warmRadius').value=p.warmRadius;
 if(p?.coldRadius)$('coldRadius').value=p.coldRadius;
 if(p?.weather){
   $('wxTemp').value=p.weather.temp??20;$('wxHumidity').value=p.weather.humidity??60;
   $('wxWindSpeed').value=p.weather.windSpeed??10;$('wxWindDir').value=p.weather.windDir??90;
   $('wxCloud').value=p.weather.cloud||'Despejado';$('wxStability').value=p.weather.stability||'Desconocida'
 }
 renderTacticalList();if(map){renderTacticalMarkers();applyTacticalZones(false)}
}
function tacticalIcon(type){
 const [txt,color]=TACTICAL_ICONS[type]||['?','#555'];
 return L.divIcon({className:'',html:`<div style="width:34px;height:34px;border-radius:50%;background:${color};color:#fff;border:3px solid #fff;box-shadow:0 1px 5px #0008;display:flex;align-items:center;justify-content:center;font:700 10px Arial">${txt}</div>`,iconSize:[34,34],iconAnchor:[17,17]})
}
function addTacticalAtCenter(){
 initMap();const c=map.getCenter(),type=$('markerType').value,name=$('markerName').value||$('markerType').selectedOptions[0].text;
 tacticalMarkers.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),type,name,lat:c.lat,lon:c.lng,status:'Activo'});
 renderTacticalList();renderTacticalMarkers()
}
$('addTacticalMarker').onclick=addTacticalAtCenter;
function renderTacticalMarkers(){
 if(!map)return;tacticalLayers.forEach(x=>map.removeLayer(x));tacticalLayers=[];
 tacticalMarkers.forEach(m=>{
  const layer=L.marker([m.lat,m.lon],{draggable:true,icon:tacticalIcon(m.type)}).addTo(map).bindPopup(`<b>${escapeHtml(m.name)}</b><br>${escapeHtml(m.type)} · ${escapeHtml(m.status)}`);
  layer.on('dragend',e=>{const p=e.target.getLatLng();m.lat=p.lat;m.lon=p.lng;renderTacticalList()});
  tacticalLayers.push(layer)
 })
}
function renderTacticalList(){
 if(!$('tacticalMarkerList'))return;
 $('tacticalMarkerList').innerHTML=tacticalMarkers.map(m=>`<div class="marker-row">
 <input value="${escapeHtml(m.name)}" data-mid="${m.id}" data-field="name">
 <select data-mid="${m.id}" data-field="status"><option>Activo</option><option>Disponible</option><option>Asignado</option><option>Fuera de servicio</option></select>
 <span class="pill ok">${escapeHtml(m.type)}</span>
 <button class="danger" data-remove="${m.id}">Quitar</button></div>`).join('')||'<p class="small">No hay marcadores tácticos.</p>';
 tacticalMarkers.forEach(m=>{const s=document.querySelector(`[data-mid="${m.id}"][data-field="status"]`);if(s)s.value=m.status});
 document.querySelectorAll('[data-mid]').forEach(el=>el.onchange=()=>{const m=tacticalMarkers.find(x=>x.id===el.dataset.mid);if(m)m[el.dataset.field]=el.value;renderTacticalMarkers()});
 document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{tacticalMarkers=tacticalMarkers.filter(x=>x.id!==b.dataset.remove);renderTacticalList();renderTacticalMarkers()})
}
function applyTacticalZones(fit=true){
 if(!map||!current)return;
 tacticalZoneLayers.forEach(x=>map.removeLayer(x));tacticalZoneLayers=[];
 const warm=+$('warmRadius').value||0,cold=+$('coldRadius').value||0;
 if(warm>0)tacticalZoneLayers.push(L.circle([current.lat,current.lon],{radius:warm,color:'#ef6c00',weight:2,fillColor:'#fb8c00',fillOpacity:.08,dashArray:'8,6'}).addTo(map));
 if(cold>0)tacticalZoneLayers.push(L.circle([current.lat,current.lon],{radius:cold,color:'#2e7d32',weight:2,fillColor:'#43a047',fillOpacity:.05,dashArray:'10,7'}).addTo(map));
 if(fit&&tacticalZoneLayers.length)map.fitBounds(L.featureGroup(tacticalZoneLayers).getBounds().pad(.1))
}
$('applyTacticalZones').onclick=()=>{showView('mapview');setTimeout(()=>applyTacticalZones(true),120)};
$('clearTacticalZones').onclick=()=>{tacticalZoneLayers.forEach(x=>map&&map.removeLayer(x));tacticalZoneLayers=[]};
function collectTactical(){
 return {version:'0.6',incidentId:current?.id||null,warmRadius:+$('warmRadius').value||0,coldRadius:+$('coldRadius').value||0,markers:tacticalMarkers,weather:{temp:+$('wxTemp').value,humidity:+$('wxHumidity').value,windSpeed:+$('wxWindSpeed').value,windDir:+$('wxWindDir').value,cloud:$('wxCloud').value,stability:$('wxStability').value},updatedAt:new Date().toISOString()}
}
$('saveTactical').onclick=()=>{localStorage.setItem(tacticalKey(),JSON.stringify(collectTactical()));alert('Configuración táctica guardada')};
$('applyWeather').onclick=()=>{
 if(current){current.bearing=((+$('wxWindDir').value%360)+360)%360;$('bearing').value=current.bearing;if(map)renderMap();updateGlobalStatus()}
 localStorage.setItem(tacticalKey(),JSON.stringify(collectTactical()));alert('Meteorología aplicada al incidente')
};
$('exportWeather').onclick=()=>download(`Meteorologia_${safeName(current?.title||'Incidente')}.json`,JSON.stringify(collectTactical().weather,null,2),'application/json');

$('convertDistance').onclick=()=>{
 let m=parseFloat($('meters').value);if(!Number.isFinite(m)){let km=parseFloat($('kilometers').value),ft=parseFloat($('feet').value),mi=parseFloat($('miles').value);if(Number.isFinite(km))m=km*1000;else if(Number.isFinite(ft))m=ft/3.280839895;else if(Number.isFinite(mi))m=mi*1609.344}
 if(!Number.isFinite(m))return alert('Ingrese un valor');$('meters').value=m.toFixed(3);$('kilometers').value=(m/1000).toFixed(6);$('feet').value=(m*3.280839895).toFixed(3);$('miles').value=(m/1609.344).toFixed(6)
};
$('convertVolume').onclick=()=>{let l=parseFloat($('liters').value);if(!Number.isFinite(l)){let g=parseFloat($('gallons').value);if(Number.isFinite(g))l=g*3.785411784}if(!Number.isFinite(l))return alert('Ingrese un valor');$('liters').value=l.toFixed(3);$('gallons').value=(l/3.785411784).toFixed(3)};
$('convertTemp').onclick=()=>{let c=parseFloat($('celsius').value);if(!Number.isFinite(c)){let f=parseFloat($('fahrenheit').value);if(Number.isFinite(f))c=(f-32)*5/9}if(!Number.isFinite(c))return alert('Ingrese un valor');$('celsius').value=c.toFixed(2);$('fahrenheit').value=(c*9/5+32).toFixed(2)};
$('convertConcentration').onclick=()=>{let ppm=parseFloat($('ppm').value),mw=parseFloat($('mw').value),mg=parseFloat($('mgm3').value);if(!Number.isFinite(mw)||mw<=0)return alert('Peso molecular inválido');if(Number.isFinite(ppm))mg=ppm*mw/24.45;else if(Number.isFinite(mg))ppm=mg*24.45/mw;else return alert('Ingrese ppm o mg/m³');$('ppm').value=ppm.toFixed(3);$('mgm3').value=mg.toFixed(3)};

function tacticalGeoJSON(){
 const p=collectTactical(),features=[];
 if(current){
  features.push({type:'Feature',properties:{kind:'incident',un:current.un,name:current.name},geometry:{type:'Point',coordinates:[current.lon,current.lat]}});
  const circles=[['warm_zone',p.warmRadius],['cold_zone',p.coldRadius]];
  circles.forEach(([kind,r])=>{if(r>0){let coords=[];for(let b=0;b<=360;b+=5){let [la,lo]=destination(current.lat,current.lon,b,r);coords.push([lo,la])}features.push({type:'Feature',properties:{kind,radius_m:r},geometry:{type:'Polygon',coordinates:[coords]}})}})
 }
 p.markers.forEach(m=>features.push({type:'Feature',properties:{kind:'tactical_marker',type:m.type,name:m.name,status:m.status},geometry:{type:'Point',coordinates:[m.lon,m.lat]}}));
 return {type:'FeatureCollection',features}
}
$('exportTacticalGeoJSON').onclick=()=>download(`Tactico_${safeName(current?.title||'Incidente')}.geojson`,JSON.stringify(tacticalGeoJSON(),null,2),'application/geo+json');
$('exportTacticalCSV').onclick=()=>{
 const rows=[['tipo','nombre','estado','latitud','longitud'],...tacticalMarkers.map(m=>[m.type,m.name,m.status,m.lat,m.lon])];
 const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
 download(`Marcadores_${safeName(current?.title||'Incidente')}.csv`,csv,'text/csv')
};
function tacticalKMLPlacemarks(){
 return tacticalMarkers.map(m=>`<Placemark><name>${escapeHtml(m.name)}</name><description>${escapeHtml(m.type)} · ${escapeHtml(m.status)}</description><Point><coordinates>${m.lon},${m.lat},0</coordinates></Point></Placemark>`).join('')
}
$('exportCombinedKML').onclick=()=>{
 if(!current)return alert('No hay incidente activo');
 let base=toKML(current).replace('</Document></kml>',tacticalKMLPlacemarks()+'</Document></kml>');
 download(`UN${current.un}_${safeName(current.title)}_TACTICO.kml`,base,'application/vnd.google-earth.kml+xml')
};


function updateGlobalStatus(){
 const el=document.getElementById('statusBar');if(!el)return;
 if(!current){el.textContent='Sin incidente activo';return}
 const wx=activeWeather||getTactical()?.weather;
 const wxDir=wx?.windDirection??wx?.windDir??current.bearing;const wxSpd=wx?.windSpeed;const windTxt=wx?`${Math.round(wxDir)}° · ${wxSpd??'-'} km/h`:`${Math.round(current.bearing)}°`;
 el.textContent=`UN ${current.un} | ${current.name} | Viento ${windTxt} | Aislamiento ${current.isolation_m} m | Acción protectora ${current.protective_km} km`;
}


function startApplication(){
  try{
    fillUN('1005');
    renderHistory();
    updateGlobalStatus();
    showView('incident');
  }catch(error){
    console.error('Error de inicio:', error);
    const select=document.getElementById('un');
    if(select)select.innerHTML='<option value="">Error al cargar catálogo</option>';
    alert('La aplicación no pudo iniciar correctamente. Revise que gre-data.js haya sido publicado junto con los demás archivos.');
  }
}
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',startApplication,{once:true});
}else{
  startApplication();
}


// ---------------- v0.7: Selector preliminar de EPP HazMat ----------------
const PPE_CHEMICAL_RULES={
 "1005":{
   name:"Amoníaco anhidro",
   hazards:["Tóxico por inhalación","Corrosivo","Posible riesgo criogénico en liberación de líquido"],
   defaultState:"gas",
   skin:"moderate",
   special:["Usar materiales compatibles con amoníaco anhidro.","Evitar materiales no compatibles según ficha del fabricante."]
 },
 "1017":{
   name:"Cloro",
   hazards:["Tóxico por inhalación","Gas oxidante","Puede producir daño respiratorio severo"],
   defaultState:"gas",
   skin:"high",
   special:["Para ingreso en nube o concentración desconocida, priorizar traje contra vapores totalmente encapsulado."]
 },
 "1040":{
   name:"Óxido de etileno",
   hazards:["Tóxico","Inflamable","Reactivo / posible polimerización"],
   defaultState:"gas",
   skin:"high",
   special:["Controlar fuentes de ignición.","Verificar compatibilidad del traje con óxido de etileno."]
 },
 "1050":{
   name:"Cloruro de hidrógeno anhidro",
   hazards:["Tóxico por inhalación","Altamente corrosivo","Reacciona con humedad formando ácido"],
   defaultState:"gas",
   skin:"high",
   special:["Proteger completamente piel y ojos.","Considerar vapores corrosivos y condensación ácida."]
 },
 "2186":{
   name:"Cloruro de hidrógeno, líquido refrigerado",
   hazards:["Tóxico por inhalación","Corrosivo","Criogénico"],
   defaultState:"liquid",
   skin:"high",
   special:["Agregar protección frente a frío extremo compatible con el traje químico."]
 },
 "1052":{
   name:"Fluoruro de hidrógeno anhidro",
   hazards:["Tóxico","Altamente corrosivo","Toxicidad sistémica grave"],
   defaultState:"liquid",
   skin:"veryhigh",
   special:["Máxima protección dérmica compatible.","Preparar descontaminación y asistencia médica específica antes del ingreso."]
 },
 "1079":{
   name:"Dióxido de azufre",
   hazards:["Tóxico por inhalación","Irritante / corrosivo en presencia de humedad"],
   defaultState:"gas",
   skin:"moderate",
   special:["Priorizar protección respiratoria autónoma en concentración desconocida o IDLH."]
 }
};

function ppeKey(){return current?`hazmatPPE:${current.id}`:'hazmatPPE:draft'}
function loadPPE(){
  $('ppeSubstance').value=current?.name||'Sin incidente activo';
  $('ppeUN').value=current?.un||'';
  const saved=getSavedPPE();
  if(saved){
    ['ppeTask','ppeState','ppeConcentration','ppeOxygen','ppeContact','ppeFire','ppeCompatibility','ppeMonitoring'].forEach(id=>{
      if(saved.inputs?.[id]!==undefined)$(id).value=saved.inputs[id]
    });
    renderPPEResult(saved.result);
  }else if(current){
    const rule=PPE_CHEMICAL_RULES[current.un];
    if(rule)$('ppeState').value=rule.defaultState
  }
}
function getSavedPPE(){try{return JSON.parse(localStorage.getItem(ppeKey())||'null')}catch{return null}}

function evaluatePPE(){
  const un=current?.un||$('ppeUN').value;
  const rule=PPE_CHEMICAL_RULES[un]||{
    name:current?.name||'Sustancia no parametrizada',
    hazards:["Peligros específicos no parametrizados"],
    defaultState:$('ppeState').value,
    skin:"unknown",
    special:["Consultar GRE, SDS y tabla de compatibilidad del fabricante."]
  };
  const task=$('ppeTask').value,state=$('ppeState').value,conc=$('ppeConcentration').value,
        oxygen=$('ppeOxygen').value,contact=$('ppeContact').value,fire=$('ppeFire').value,
        compat=$('ppeCompatibility').value,monitor=$('ppeMonitoring').value;

  const unknownAtmosphere = conc==='unknown'||conc==='idlhorhigher'||oxygen==='unknown'||oxygen==='deficient';
  const directEntry = ['recon','monitoring','rescue','control'].includes(task);
  const vaporChallenge = ['gas','aerosol','unknown'].includes(state)||['vapor','unknown'].includes(contact);
  const highSkin = ['high','veryhigh'].includes(rule.skin)||['immersion','unknown'].includes(contact);
  const splashOnly = contact==='splash'&&state==='liquid'&&!vaporChallenge;
  const supportOnly = task==='support';

  let level,respiratory,suit,gloves,boots,decision;
  const warnings=[],missing=[];

  if(supportOnly && conc==='nonhazardous' && oxygen==='normal'){
    level="EPP operativo de zona fría";
    respiratory="Sin protección respiratoria especial, salvo exigencia del procedimiento local.";
    suit="Ropa operativa acorde a la función y riesgo físico.";
    decision="Mantener fuera de zonas contaminadas y bajo control de acceso.";
  }else if(unknownAtmosphere && directEntry){
    respiratory="ERA/SCBA de presión positiva, con autonomía y equipo de respaldo.";
    if(vaporChallenge||highSkin){
      level="Nivel A orientativo";
      suit="Traje químico totalmente encapsulado, hermético a vapores, compatible con la sustancia.";
    }else{
      level="Nivel B orientativo";
      suit="Traje químico contra salpicaduras, compatible y con protección dérmica adecuada.";
    }
    decision="No autorizar ingreso hasta preparar respaldo, descontaminación, comunicaciones y rescate.";
  }else if(conc==='knownbelow' && oxygen==='normal' && monitor==='complete'){
    if(vaporChallenge && highSkin){
      level="Nivel B o A según compatibilidad y riesgo dérmico";
      respiratory="ERA/SCBA o respirador aprobado específicamente, solo si el programa respiratorio y la evaluación lo permiten.";
      suit="Protección química compatible con vapor o salpicadura según concentración y tarea.";
    }else if(splashOnly){
      level="Nivel B orientativo";
      respiratory="ERA/SCBA si existe posibilidad de atmósfera cambiante; otro respirador solo con evaluación formal.";
      suit="Traje contra salpicaduras compatible.";
    }else{
      level="Nivel C potencial, sujeto a autorización";
      respiratory="Respirador purificador únicamente si contaminante, concentración, cartucho y vida útil están definidos.";
      suit="Protección dérmica compatible con el contacto esperado.";
    }
    decision="Mantener monitoreo continuo y criterios claros de retirada.";
  }else{
    level="Protección máxima hasta completar evaluación";
    respiratory="ERA/SCBA de presión positiva.";
    suit=highSkin||vaporChallenge?"Traje totalmente encapsulado y compatible.":"Traje químico compatible con protección dérmica suficiente.";
    decision="Tratar la atmósfera como desconocida hasta contar con datos representativos.";
  }

  gloves="Doble guante químico compatible, con capa interna y externa según fabricante.";
  boots="Botas químicas integradas o compatibles, antideslizantes y selladas según el conjunto.";

  if(compat==='unknown')missing.push("Compatibilidad de traje, guantes y botas no verificada.");
  if(compat==='incompatible')warnings.push("DETENER: el material de protección es incompatible o dudoso.");
  if(monitor!=='complete')missing.push("Monitoreo insuficiente o no representativo.");
  if(oxygen==='unknown')missing.push("Concentración de oxígeno desconocida.");
  if(conc==='unknown')missing.push("Concentración del contaminante desconocida.");
  if(fire==='yes')warnings.push("El traje químico no debe considerarse protección térmica o contra llama. Evaluar estrategia defensiva y EPP de incendio por separado.");
  if(fire==='unknown')missing.push("Presencia de incendio o calor no confirmada.");
  if(un==='1005'||un==='2186')warnings.push("Evaluar exposición a frío extremo por liberación de producto refrigerado o evaporación rápida.");
  if(un==='1040')warnings.push("Controlar ignición y riesgo de atmósfera inflamable.");
  if(un==='1052')warnings.push("Asegurar descontaminación inmediata y soporte médico específico antes del ingreso.");

  const result={
    substance:rule.name,un,level,respiratory,suit,gloves,boots,decision,
    hazards:rule.hazards,special:rule.special,warnings,missing,
    generatedAt:new Date().toISOString()
  };
  return result
}
function renderPPEResult(r){
  if(!r){$('ppeResult').innerHTML='<p class="small">Sin evaluación.</p>';return}
  const warningHtml=r.warnings?.length?`<div class="ppe-item stop"><strong>Advertencias críticas</strong>${r.warnings.map(x=>'• '+escapeHtml(x)).join('<br>')}</div>`:'';
  const missingHtml=r.missing?.length?`<div class="ppe-item missing"><strong>Datos faltantes</strong>${r.missing.map(x=>'• '+escapeHtml(x)).join('<br>')}</div>`:'<div class="ppe-item good"><strong>Datos mínimos</strong>Sin faltantes críticos declarados.</div>';
  $('ppeResult').innerHTML=`
    <div class="small">RECOMENDACIÓN PRELIMINAR</div>
    <div class="ppe-level">${escapeHtml(r.level)}</div>
    <div class="ppe-list">
      <div class="ppe-item"><strong>Protección respiratoria</strong>${escapeHtml(r.respiratory)}</div>
      <div class="ppe-item"><strong>Traje químico</strong>${escapeHtml(r.suit)}</div>
      <div class="ppe-item"><strong>Guantes</strong>${escapeHtml(r.gloves)}</div>
      <div class="ppe-item"><strong>Botas</strong>${escapeHtml(r.boots)}</div>
      <div class="ppe-item"><strong>Condición para ingreso</strong>${escapeHtml(r.decision)}</div>
      <div class="ppe-item"><strong>Peligros relevantes</strong>${(r.hazards||[]).map(x=>'• '+escapeHtml(x)).join('<br>')}</div>
      <div class="ppe-item"><strong>Consideraciones específicas</strong>${(r.special||[]).map(x=>'• '+escapeHtml(x)).join('<br>')}</div>
      ${warningHtml}${missingHtml}
    </div>`
}
function collectPPEInputs(){
  return Object.fromEntries(['ppeTask','ppeState','ppeConcentration','ppeOxygen','ppeContact','ppeFire','ppeCompatibility','ppeMonitoring'].map(id=>[id,$(id).value]))
}
$('calculatePPE').onclick=()=>{
  const result=evaluatePPE();renderPPEResult(result);
  window.__lastPPE={inputs:collectPPEInputs(),result}
};
$('savePPE').onclick=()=>{
  const payload=window.__lastPPE||{inputs:collectPPEInputs(),result:evaluatePPE()};
  localStorage.setItem(ppeKey(),JSON.stringify(payload));
  renderPPEResult(payload.result);alert('Evaluación de EPP guardada')
};
$('exportPPE').onclick=()=>{
  const payload=window.__lastPPE||{inputs:collectPPEInputs(),result:evaluatePPE()};
  download(`EPP_UN${payload.result.un}_${safeName(payload.result.substance)}.json`,JSON.stringify(payload,null,2),'application/json')
};
$('copyPPE').onclick=async()=>{
  const payload=window.__lastPPE||{inputs:collectPPEInputs(),result:evaluatePPE()},r=payload.result;
  const txt=`UN ${r.un} — ${r.substance}
Recomendación: ${r.level}
Respiratoria: ${r.respiratory}
Traje: ${r.suit}
Guantes: ${r.gloves}
Botas: ${r.boots}
Condición: ${r.decision}
Advertencias: ${(r.warnings||[]).join(' | ')||'Ninguna registrada'}
Datos faltantes: ${(r.missing||[]).join(' | ')||'Ninguno registrado'}`;
  try{await navigator.clipboard.writeText(txt);alert('Resumen copiado')}catch{alert(txt)}
};


// ---------------- v0.8: Biblioteca completa de identificación GRE ----------------
const FULL_CATALOG=window.GRE_FULL_CATALOG||[];
const GROUPED_UN=window.GRE_GROUPED_UN||[];
let libraryInitialized=false;

function normalizedText(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}
function loadLibrary(){
  if(!libraryInitialized){
    const guides=[...new Set(FULL_CATALOG.map(x=>x.guide))].sort((a,b)=>parseInt(a)-parseInt(b)||a.localeCompare(b));
    $('libraryGuide').innerHTML='<option value="">Todas las guías</option>'+guides.map(g=>`<option value="${g}">Guía ${g}</option>`).join('');
    $('statUN').textContent=GROUPED_UN.length.toLocaleString('es-AR');
    $('statNames').textContent=FULL_CATALOG.length.toLocaleString('es-AR');
    ['librarySearch','libraryGuide','libraryFilter','librarySort'].forEach(id=>{
      $(id).addEventListener(id==='librarySearch'?'input':'change',renderLibrary)
    });
    libraryInitialized=true
  }
  renderLibrary()
}
function filteredLibrary(){
  const q=normalizedText($('librarySearch').value).trim(),guide=$('libraryGuide').value,filter=$('libraryFilter').value;
  let rows=GROUPED_UN.filter(x=>{
    if(guide&&!x.guides.includes(guide))return false;
    if(filter==='table1'&&!x.table1)return false;
    if(filter==='table3'&&!x.table3)return false;
    if(filter==='ppe'&&!x.ppe)return false;
    if(filter==='polymerization'&&!x.polymerization)return false;
    if(q){
      const hay=normalizedText(x.un+' '+x.guides.join(' ')+' '+x.names.join(' '));
      if(!hay.includes(q))return false
    }
    return true
  });
  const sort=$('librarySort').value;
  rows.sort(sort==='name'?(a,b)=>(a.names[0]||'').localeCompare(b.names[0]||'','es'):(a,b)=>a.un.localeCompare(b.un));
  return rows
}
function renderLibrary(){
  const rows=filteredLibrary();
  $('statResults').textContent=rows.length.toLocaleString('es-AR');
  const visible=rows.slice(0,400);
  $('libraryList').innerHTML=visible.map(x=>{
    const aliases=x.names.slice(0,8);
    const more=x.names.length-aliases.length;
    return `<div class="substance-card">
      <div class="substance-title">UN ${x.un} — ${escapeHtml(x.names[0]||'Sin denominación')}</div>
      <div class="substance-meta">Guía(s): ${x.guides.map(escapeHtml).join(', ')}</div>
      <div>
        ${x.table1?'<span class="tag green">Tabla 1</span>':''}
        ${x.table3?'<span class="tag green">Tabla 3</span>':''}
        ${x.ppe?'<span class="tag orange">Selector EPP</span>':''}
        ${x.polymerization?'<span class="tag red">Polimerización P</span>':''}
      </div>
      <div class="aliases"><strong>Denominaciones:</strong><br>${aliases.map(escapeHtml).join('<br>')}${more>0?`<br><em>+ ${more} alias adicionales</em>`:''}</div>
      <div class="library-actions">
        <button class="primary" onclick="selectLibraryUN('${x.un}')">Usar en incidente</button>
        ${TECH_DB[x.un]?`<button class="secondary" onclick="openTechnicalFromLibrary('${x.un}')">Ficha técnica</button>`:''}${x.ppe?`<button class="secondary" onclick="selectLibraryPPE('${x.un}')">Evaluar EPP</button>`:''}
      </div>
    </div>`
  }).join('')+(rows.length>400?`<div class="warning">Se muestran los primeros 400 resultados. Refine la búsqueda para ver registros específicos.</div>`:'');
}
window.selectLibraryUN=un=>{
  showView('incident');
  $('searchChemical').value=un;
  fillUN(un);
  const option=[...$('un').options].find(o=>o.value===un);
  if(option){$('un').value=un;updateScenarioControls()}
  window.scrollTo({top:0,behavior:'smooth'})
};
window.selectLibraryPPE=un=>{
  const rec=GROUPED_UN.find(x=>x.un===un);
  if(!rec)return;
  current=current||{id:'library-'+un,title:`UN ${un}`,un,name:rec.names[0]||'',guide:rec.guides[0]||'',lat:+$('lat').value,lon:+$('lon').value,bearing:+$('bearing').value,isolation_m:0,protective_km:0,source:'Biblioteca GRE 2024'};
  current.un=un;current.name=rec.names[0]||current.name;current.guide=rec.guides[0]||current.guide;
  showView('ppe');loadPPE()
};


// ---------------- v0.9: Fichas técnicas enriquecidas ----------------
const TECH_DB=window.HAZMAT_TECHNICAL||{};
let activeTechnicalUN=null;

const GHS_LABELS={
 GHS01:"Explosivo",GHS02:"Inflamable",GHS03:"Oxidante",GHS04:"Gas a presión",
 GHS05:"Corrosivo",GHS06:"Toxicidad aguda",GHS07:"Irritante",GHS08:"Peligro crónico",GHS09:"Ambiente"
};
function technicalOptions(query=''){
 const q=normalizedText(query);
 return Object.entries(TECH_DB).filter(([un,r])=>!q||normalizedText(un+' '+r.name).includes(q))
   .sort((a,b)=>a[0].localeCompare(b[0]));
}
function fillTechnicalSelect(query=''){
 const rows=technicalOptions(query);
 $('techSelect').innerHTML=rows.map(([un,r])=>`<option value="${un}">UN ${un} — ${escapeHtml(r.name)}</option>`).join('');
 if(!rows.length)$('techSelect').innerHTML='<option value="">Sin coincidencias</option>'
}
function loadTechnical(){
 if(!$('techSelect').options.length)fillTechnicalSelect(current?.un||'');
 if(current?.un&&TECH_DB[current.un]){
   $('techSearch').value=current.un;fillTechnicalSelect(current.un);$('techSelect').value=current.un;renderTechnical(current.un)
 }
}
$('techSearch').addEventListener('input',e=>fillTechnicalSelect(e.target.value));
$('openTechnical').onclick=()=>renderTechnical($('techSelect').value);

function listHtml(items){
 return items?.length?`<ul>${items.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul>`:'<p class="small">Sin datos estructurados.</p>'
}
function renderTechnical(un){
 const r=TECH_DB[un];activeTechnicalUN=un;
 if(!r){$('technicalContent').innerHTML='<div class="tech-empty">No hay ficha enriquecida para esta sustancia.</div>';return}
 $('technicalContent').innerHTML=`
 <div class="tech-head">
   <div><h2>UN ${un} — ${escapeHtml(r.name)}</h2><div class="small">Revisión: ${escapeHtml(r.reviewed||'No informada')}</div></div>
   <span class="validation ${escapeHtml(r.validation)}">${escapeHtml(r.validation.toUpperCase())}</span>
 </div>
 <div class="tech-section"><h3>Estado físico y comportamiento</h3><p>${escapeHtml(r.physical)}</p></div>
 <div class="nfpa-wrap">
   <div class="nfpa-diamond">
    <div class="nfpa-cell nfpa-health"><span>${r.nfpa.health}</span></div>
    <div class="nfpa-cell nfpa-fire"><span>${r.nfpa.fire}</span></div>
    <div class="nfpa-cell nfpa-react"><span>${r.nfpa.reactivity}</span></div>
    <div class="nfpa-cell nfpa-special"><span>${escapeHtml(r.nfpa.special||'')}</span></div>
   </div>
   <div><h3>NFPA 704</h3><p class="small">Salud ${r.nfpa.health} · Inflamabilidad ${r.nfpa.fire} · Inestabilidad ${r.nfpa.reactivity}${r.nfpa.special?' · Especial '+escapeHtml(r.nfpa.special):''}</p></div>
 </div>
 <div class="tech-section"><h3>Pictogramas GHS</h3><div class="ghs-row">${r.ghs.map(g=>`<div class="ghs-icon" title="${escapeHtml(GHS_LABELS[g]||g)}"><span>${escapeHtml(g)}<br>${escapeHtml(GHS_LABELS[g]||'')}</span></div>`).join('')}</div></div>
 <div class="tech-section"><h3>Riesgos principales</h3>${listHtml(r.hazards)}</div>
 <div class="tech-section"><h3>Incompatibilidades</h3>${listHtml(r.incompatibilities)}</div>
 <div class="tech-section"><h3>Agentes y estrategia de extinción</h3>${listHtml(r.extinguishing)}</div>
 <div class="tech-section"><h3>Productos peligrosos de combustión o descomposición</h3>${listHtml(r.combustion)}</div>
 <div class="tech-section"><h3>Primeros auxilios iniciales</h3>${listHtml(r.firstAid)}</div>
 <div class="tech-section"><h3>EPP preliminar</h3><p>${escapeHtml(r.ppe)}</p></div>
 <div class="tech-section"><h3>Observaciones operativas</h3>${listHtml(r.notes)}</div>
 <p class="source-note">Estado de validación: ${escapeHtml(r.validation)}. Confirmar siempre con SDS, fabricante y evaluación del incidente.</p>`
}
window.openTechnicalFromLibrary=un=>{
 showView('technical');$('techSearch').value=un;fillTechnicalSelect(un);$('techSelect').value=un;renderTechnical(un)
};
$('exportTechnical').onclick=()=>{
 if(!activeTechnicalUN||!TECH_DB[activeTechnicalUN])return alert('Seleccione una ficha');
 download(`Ficha_UN${activeTechnicalUN}_${safeName(TECH_DB[activeTechnicalUN].name)}.json`,
 JSON.stringify({un:activeTechnicalUN,...TECH_DB[activeTechnicalUN]},null,2),'application/json')
};
$('exportTechnicalDB').onclick=()=>download('HazMat_base_enriquecida_v0.9.json',
 JSON.stringify({version:'0.9.0',updated:'2026-07-12',records:TECH_DB},null,2),'application/json');
$('copyTechnical').onclick=async()=>{
 if(!activeTechnicalUN||!TECH_DB[activeTechnicalUN])return alert('Seleccione una ficha');
 const r=TECH_DB[activeTechnicalUN];
 const text=`UN ${activeTechnicalUN} — ${r.name}
Validación: ${r.validation}
NFPA 704: Salud ${r.nfpa.health}, Inflamabilidad ${r.nfpa.fire}, Inestabilidad ${r.nfpa.reactivity}, Especial ${r.nfpa.special||'-'}
Riesgos: ${r.hazards.join(' | ')}
Incompatibilidades: ${r.incompatibilities.join(' | ')}
Extinción: ${r.extinguishing.join(' | ')}
EPP: ${r.ppe}`;
 try{await navigator.clipboard.writeText(text);alert('Ficha copiada')}catch{alert(text)}
};


// ---------------- v1.0: Meteorología automática ----------------
let remoteWeather=null,activeWeather=null;

function weatherKey(){return current?`hazmatWX:${current.id}`:'hazmatWX:draft'}
function savedWeather(){try{return JSON.parse(localStorage.getItem(weatherKey())||'null')}catch{return null}}

function loadWeatherModule(){
 const saved=savedWeather();
 if(saved){remoteWeather=saved.remote||null;activeWeather=saved.active||null;$('weatherNotes').value=saved.notes||'';$('weatherConfidence').value=saved.confidence||'medium'}
 if(remoteWeather)renderRemoteWeather(remoteWeather);
 if(activeWeather)renderActiveWeather();
 updateWeatherSourceCards();
}

function openMeteoURL(lat,lon){
 const currentVars=[
  'temperature_2m','relative_humidity_2m','apparent_temperature','cloud_cover',
  'surface_pressure','wind_speed_10m','wind_direction_10m','wind_gusts_10m',
  'weather_code','is_day'
 ].join(',');
 const hourlyVars=['temperature_2m','relative_humidity_2m','wind_speed_10m','wind_direction_10m','wind_gusts_10m','cloud_cover'].join(',');
 return `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=${currentVars}&hourly=${hourlyVars}&forecast_hours=12&wind_speed_unit=kmh&timezone=auto`;
}
async function fetchAutomaticWeather(){
 const lat=current?.lat??+$('lat').value,lon=current?.lon??+$('lon').value;
 if(!Number.isFinite(lat)||!Number.isFinite(lon))return setWeatherStatus('Coordenadas inválidas.','error');
 setWeatherStatus('Consultando Open-Meteo…','warn');
 try{
  const response=await fetch(openMeteoURL(lat,lon),{cache:'no-store'});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  const data=await response.json();
  if(!data.current)throw new Error('Respuesta sin condiciones actuales');
  remoteWeather={
   source:'Open-Meteo',
   providerType:'modelo meteorológico',
   latitude:data.latitude,longitude:data.longitude,elevation:data.elevation,
   timezone:data.timezone,timezoneAbbreviation:data.timezone_abbreviation,
   fetchedAt:new Date().toISOString(),
   observedAt:data.current.time,
   interval:data.current.interval,
   temperature:data.current.temperature_2m,
   relativeHumidity:data.current.relative_humidity_2m,
   apparentTemperature:data.current.apparent_temperature,
   cloudCover:data.current.cloud_cover,
   surfacePressure:data.current.surface_pressure,
   windSpeed:data.current.wind_speed_10m,
   windDirection:data.current.wind_direction_10m,
   windGust:data.current.wind_gusts_10m,
   weatherCode:data.current.weather_code,
   isDay:data.current.is_day,
   units:data.current_units,
   hourly:extractHourly(data)
  };
  renderRemoteWeather(remoteWeather);
  activeWeather=remoteWeather;
  renderActiveWeather();
  updateWeatherSourceCards();
  setWeatherStatus(`Datos recibidos para ${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}.`, 'ok');
 }catch(error){
  console.error(error);
  setWeatherStatus(`No fue posible obtener meteorología automática: ${error.message}`, 'error')
 }
}
function extractHourly(data){
 const h=data.hourly||{},times=h.time||[];
 return times.slice(0,12).map((time,i)=>({
   time,
   temperature:h.temperature_2m?.[i],
   relativeHumidity:h.relative_humidity_2m?.[i],
   windSpeed:h.wind_speed_10m?.[i],
   windDirection:h.wind_direction_10m?.[i],
   windGust:h.wind_gusts_10m?.[i],
   cloudCover:h.cloud_cover?.[i]
 }))
}
function cardinal(deg){
 const dirs=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO'];
 return dirs[Math.round((((+deg%360)+360)%360)/22.5)%16]
}
function fmt(v,suffix=''){return Number.isFinite(+v)?`${Math.round(+v*10)/10}${suffix}`:'—'}
function renderRemoteWeather(w){
 $('wxCurrentTemp').textContent=fmt(w.temperature,' °C');
 $('wxCurrentRH').textContent=fmt(w.relativeHumidity,' %');
 $('wxCurrentWind').textContent=fmt(w.windSpeed,' km/h');
 $('wxCurrentDir').textContent=Number.isFinite(+w.windDirection)?`${Math.round(w.windDirection)}° ${cardinal(w.windDirection)}`:'—';
 $('wxCurrentGust').textContent=fmt(w.windGust,' km/h');
 $('wxCurrentCloud').textContent=fmt(w.cloudCover,' %');
 $('wxCurrentPressure').textContent=fmt(w.surfacePressure,' hPa');
 $('wxCurrentTime').textContent=w.observedAt?new Date(w.observedAt).toLocaleString():'—';
 $('weatherForecast').innerHTML=(w.hourly||[]).slice(0,6).map(x=>`<div class="wx-hour">
 <strong>${new Date(x.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</strong>
 Temp: ${fmt(x.temperature,' °C')}<br>
 Viento: ${fmt(x.windSpeed,' km/h')}<br>
 Desde: ${Number.isFinite(+x.windDirection)?Math.round(x.windDirection)+'° '+cardinal(x.windDirection):'—'}<br>
 Ráfaga: ${fmt(x.windGust,' km/h')}<br>
 Nubes: ${fmt(x.cloudCover,' %')}
 </div>`).join('')||'<div class="small">Sin pronóstico.</div>'
}
function manualWeatherRecord(){
 const p=collectTactical();
 return {
  source:'Ingreso manual',
  providerType:'manual',
  observedAt:new Date().toISOString(),
  temperature:p.weather.temp,
  relativeHumidity:p.weather.humidity,
  windSpeed:p.weather.windSpeed,
  windDirection:p.weather.windDir,
  cloudCover:null,
  windGust:null,
  surfacePressure:null
 }
}
function localWeatherRecord(){
 return {
  source:'Medición local',
  providerType:'instrumento en escena',
  observedAt:new Date().toISOString(),
  temperature:+$('wxTemp').value,
  relativeHumidity:+$('wxHumidity').value,
  windSpeed:+$('wxWindSpeed').value,
  windDirection:+$('wxWindDir').value,
  cloudCover:null,
  windGust:null,
  surfacePressure:null
 }
}
function renderActiveWeather(){
 $('activeWeatherSource').value=activeWeather?.source||'Sin definir';
 $('activeWeatherTime').value=activeWeather?.observedAt?new Date(activeWeather.observedAt).toLocaleString():'';
 updateGlobalStatus()
}
function updateWeatherSourceCards(){
 ['sourceLocal','sourceManual','sourceRemote'].forEach(id=>$(id)?.classList.remove('active'));
 if(!activeWeather)return;
 if(activeWeather.source==='Medición local')$('sourceLocal')?.classList.add('active');
 if(activeWeather.source==='Ingreso manual')$('sourceManual')?.classList.add('active');
 if(activeWeather.source==='Open-Meteo')$('sourceRemote')?.classList.add('active')
}
function setWeatherStatus(text,type='warn'){
 const el=$('weatherStatus');el.textContent=text;el.className=`wx-status wx-${type}`
}
$('fetchWeather').onclick=fetchAutomaticWeather;
$('refreshWeather').onclick=fetchAutomaticWeather;
$('useDeviceLocationWeather').onclick=()=>{
 if(!navigator.geolocation)return setWeatherStatus('GPS no disponible.','error');
 navigator.geolocation.getCurrentPosition(p=>{
   $('lat').value=p.coords.latitude.toFixed(7);$('lon').value=p.coords.longitude.toFixed(7);
   if(current){current.lat=p.coords.latitude;current.lon=p.coords.longitude}
   fetchAutomaticWeather()
 },e=>setWeatherStatus(`No fue posible obtener GPS: ${e.message}`,'error'),{enableHighAccuracy:true})
};
$('activateLocalWeather').onclick=()=>{activeWeather=localWeatherRecord();renderActiveWeather();updateWeatherSourceCards();setWeatherStatus('Medición local seleccionada como fuente activa.','ok')};
$('activateManualWeather').onclick=()=>{activeWeather=manualWeatherRecord();renderActiveWeather();updateWeatherSourceCards();setWeatherStatus('Ingreso manual seleccionado como fuente activa.','ok')};
$('activateRemoteWeather').onclick=()=>{
 if(!remoteWeather)return setWeatherStatus('Primero obtenga datos automáticos.','warn');
 activeWeather=remoteWeather;renderActiveWeather();updateWeatherSourceCards();setWeatherStatus('Open-Meteo seleccionado como fuente activa.','ok')
};
$('applyActiveWeather').onclick=()=>{
 if(!activeWeather)return alert('Seleccione una fuente meteorológica');
 if(current){
   current.bearing=((+activeWeather.windDirection%360)+360)%360;
   current.weather={...activeWeather,confidence:$('weatherConfidence').value,notes:$('weatherNotes').value};
   $('bearing').value=current.bearing;
   if(map)renderMap();
 }
 $('wxWindDir').value=activeWeather.windDirection??'';
 $('wxWindSpeed').value=activeWeather.windSpeed??'';
 if(Number.isFinite(+activeWeather.temperature))$('wxTemp').value=activeWeather.temperature;
 if(Number.isFinite(+activeWeather.relativeHumidity))$('wxHumidity').value=activeWeather.relativeHumidity;
 updateGlobalStatus();alert('Meteorología aplicada al incidente y al mapa')
};
$('saveWeatherRecord').onclick=()=>{
 const payload={version:'1.0',incidentId:current?.id||null,remote:remoteWeather,active:activeWeather,notes:$('weatherNotes').value,confidence:$('weatherConfidence').value,savedAt:new Date().toISOString()};
 localStorage.setItem(weatherKey(),JSON.stringify(payload));alert('Registro meteorológico guardado')
};
$('exportWeatherRecord').onclick=()=>{
 const payload={version:'1.0',incident:current?{id:current.id,title:current.title,lat:current.lat,lon:current.lon}:null,remote:remoteWeather,active:activeWeather,notes:$('weatherNotes').value,confidence:$('weatherConfidence').value,exportedAt:new Date().toISOString()};
 download(`Meteorologia_${safeName(current?.title||'Incidente')}.json`,JSON.stringify(payload,null,2),'application/json')
};


// ---------------- v1.1: Mapa táctico avanzado y receptores sensibles ----------------
let advancedMap=null,advancedIncidentLayers=[],poiLayers=[],poiResults=[];
const POI_STYLE={
 hospitals:{label:'Hospital / clínica',color:'#d32f2f',icon:'H'},
 schools:{label:'Escuela / jardín',color:'#f9a825',icon:'E'},
 firestations:{label:'Bomberos',color:'#c62828',icon:'B'},
 hydrants:{label:'Hidrante',color:'#1565c0',icon:'HI'},
 waterways:{label:'Curso de agua',color:'#0288d1',icon:'A'},
 industrial:{label:'Industrial',color:'#6d4c41',icon:'I'},
 care:{label:'Residencia / cuidados',color:'#8e24aa',icon:'R'},
 police:{label:'Policía',color:'#263238',icon:'P'},
 shelters:{label:'Refugio / comunitario',color:'#2e7d32',icon:'C'}
};
function initAdvancedMap(){
 if(advancedMap)return;
 advancedMap=L.map('advancedMap').setView([+$('lat').value,+$('lon').value],13);
 const osm=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'});
 const sat=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Esri'});
 osm.addTo(advancedMap);L.control.layers({'Calles':osm,'Satelital':sat},null,{collapsed:true}).addTo(advancedMap)
}
function advancedIcon(type){
 const s=POI_STYLE[type]||{color:'#455a64',icon:'?'};
 return L.divIcon({className:'',html:`<div style="width:30px;height:30px;border-radius:50%;background:${s.color};color:#fff;border:2px solid #fff;box-shadow:0 1px 4px #0008;display:flex;align-items:center;justify-content:center;font:800 9px Arial">${s.icon}</div>`,iconSize:[30,30],iconAnchor:[15,15]})
}
function renderAdvancedIncident(){
 initAdvancedMap();advancedIncidentLayers.forEach(x=>advancedMap.removeLayer(x));advancedIncidentLayers=[];
 if(!current)return;
 const iso=L.circle([current.lat,current.lon],{radius:current.isolation_m,color:'#c62828',weight:3,fillColor:'#ef5350',fillOpacity:.25}).addTo(advancedMap);
 const protect=L.polygon(sectorLatLngs(current),{color:'#f9a825',weight:3,fillColor:'#fdd835',fillOpacity:.22}).addTo(advancedMap);
 const point=L.marker([current.lat,current.lon]).addTo(advancedMap).bindPopup(`<b>${escapeHtml(current.title)}</b><br>UN ${current.un} — ${escapeHtml(current.name)}`);
 advancedIncidentLayers=[iso,protect,point];
 advancedMap.fitBounds(L.featureGroup([iso,protect]).getBounds().pad(.1))
}
function selectedPOITypes(){return [...document.querySelectorAll('[data-poi-layer]:checked')].map(x=>x.dataset.poiLayer)}
function overpassFragments(types,r,lat,lon){
 const around=`(around:${r},${lat},${lon})`,q=[];
 if(types.includes('hospitals'))q.push(`nwr${around}["amenity"~"hospital|clinic|doctors"];`);
 if(types.includes('schools'))q.push(`nwr${around}["amenity"~"school|kindergarten|college|university"];`);
 if(types.includes('firestations'))q.push(`nwr${around}["amenity"="fire_station"];`);
 if(types.includes('hydrants'))q.push(`node${around}["emergency"="fire_hydrant"];`);
 if(types.includes('waterways'))q.push(`way${around}["waterway"];nwr${around}["natural"="water"];`);
 if(types.includes('industrial'))q.push(`nwr${around}["landuse"="industrial"];nwr${around}["industrial"];`);
 if(types.includes('care'))q.push(`nwr${around}["amenity"~"nursing_home|social_facility"]["social_facility"~"nursing_home|assisted_living|group_home"];`);
 if(types.includes('police'))q.push(`nwr${around}["amenity"="police"];`);
 if(types.includes('shelters'))q.push(`nwr${around}["amenity"~"community_centre|shelter"];`);
 return q.join('')
}
function buildOverpassQuery(){
 const lat=current?.lat??+$('lat').value,lon=current?.lon??+$('lon').value,r=+$('poiRadius').value||5000;
 return `[out:json][timeout:35];(${overpassFragments(selectedPOITypes(),r,lat,lon)});out center tags;`
}
function classifyPOI(tags={}){
 if(tags.emergency==='fire_hydrant')return'hydrants';
 if(tags.amenity==='fire_station')return'firestations';
 if(['hospital','clinic','doctors'].includes(tags.amenity))return'hospitals';
 if(['school','kindergarten','college','university'].includes(tags.amenity))return'schools';
 if(tags.amenity==='police')return'police';
 if(['community_centre','shelter'].includes(tags.amenity))return'shelters';
 if(tags.amenity==='nursing_home'||tags.social_facility)return'care';
 if(tags.waterway||tags.natural==='water')return'waterways';
 if(tags.landuse==='industrial'||tags.industrial!==undefined)return'industrial';
 return'other'
}
function poiName(tags,type,id){
 return tags.name||tags['name:es']||tags.operator||`${POI_STYLE[type]?.label||'Elemento'} ${id}`
}
function haversine(lat1,lon1,lat2,lon2){
 const R=6371000,p1=lat1*Math.PI/180,p2=lat2*Math.PI/180,dp=(lat2-lat1)*Math.PI/180,dl=(lon2-lon1)*Math.PI/180;
 const a=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))
}
function pointInPolygon(point,poly){
 const x=point[1],y=point[0];let inside=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const xi=poly[i][1],yi=poly[i][0],xj=poly[j][1],yj=poly[j][0];
  const intersect=((yi>y)!=(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi+1e-12)+xi);
  if(intersect)inside=!inside
 }
 return inside
}
async function queryPOI(){
 if(!current)return setPOIStatus('Primero cree o abra un incidente.','error');
 const types=selectedPOITypes();if(!types.length)return setPOIStatus('Seleccione al menos una capa.','warn');
 setPOIStatus('Consultando OpenStreetMap mediante Overpass…','warn');
 try{
  const response=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:'data='+encodeURIComponent(buildOverpassQuery())});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  const data=await response.json(),limit=+$('poiLimit').value||400,poly=sectorLatLngs(current);
  const seen=new Set();poiResults=[];
  for(const el of data.elements||[]){
   const lat=el.lat??el.center?.lat,lon=el.lon??el.center?.lon;if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;
   const type=classifyPOI(el.tags||{});if(type==='other'||!types.includes(type))continue;
   const key=`${type}:${Math.round(lat*1e5)}:${Math.round(lon*1e5)}`;if(seen.has(key))continue;seen.add(key);
   const distance=haversine(current.lat,current.lon,lat,lon),affected=pointInPolygon([lat,lon],poly);
   poiResults.push({id:`${el.type}/${el.id}`,type,name:poiName(el.tags||{},type,el.id),lat,lon,distance_m:distance,affected,tags:el.tags||{}})
   if(poiResults.length>=limit)break
  }
  poiResults.sort((a,b)=>a.distance_m-b.distance_m);
  renderPOI();setPOIStatus(`Consulta completada: ${poiResults.length} elementos encontrados.`,'ok')
 }catch(error){console.error(error);setPOIStatus(`No fue posible consultar Overpass: ${error.message}`,'error')}
}
function setPOIStatus(text,type='warn'){const e=$('poiStatus');e.textContent=text;e.className=`query-status query-${type}`}
function renderPOI(){
 initAdvancedMap();poiLayers.forEach(x=>advancedMap.removeLayer(x));poiLayers=[];
 poiResults.forEach(p=>{
  const marker=L.marker([p.lat,p.lon],{icon:advancedIcon(p.type)}).addTo(advancedMap)
   .bindPopup(`<b>${escapeHtml(p.name)}</b><br>${escapeHtml(POI_STYLE[p.type]?.label||p.type)}<br>${formatDistance(p.distance_m)}${p.affected?'<br><b>Dentro de acción protectora</b>':''}`);
  poiLayers.push(marker)
 });
 $('poiTotal').textContent=poiResults.length;
 $('poiAffected').textContent=poiResults.filter(x=>x.affected).length;
 $('poiSensitive').textContent=poiResults.filter(x=>['hospitals','schools','care'].includes(x.type)).length;
 $('poiHydrants').textContent=poiResults.filter(x=>x.type==='hydrants').length;
 renderPOIList()
}
function formatDistance(d){return d<1000?`${Math.round(d)} m`:`${(d/1000).toFixed(2)} km`}
function renderPOIList(){
 const filter=$('poiListFilter').value,sort=$('poiSort').value;let rows=poiResults.filter(x=>!filter||(filter==='affected'?x.affected:x.type===filter));
 rows=[...rows].sort(sort==='name'?(a,b)=>a.name.localeCompare(b.name,'es'):sort==='type'?(a,b)=>a.type.localeCompare(b.type):((a,b)=>a.distance_m-b.distance_m));
 $('poiList').innerHTML=rows.slice(0,300).map(p=>`<div class="poi-card ${p.affected?'affected':''}">
 <div class="title">${escapeHtml(p.name)}</div>
 <div class="meta">${escapeHtml(POI_STYLE[p.type]?.label||p.type)} · ${formatDistance(p.distance_m)}${p.affected?' · DENTRO DE ACCIÓN PROTECTORA':''}<br>${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}</div>
 <div class="library-actions"><button class="secondary" onclick="focusPOI('${p.id}')">Ver en mapa</button><button class="secondary" onclick="addPOIToTactical('${p.id}')">Agregar a táctico</button></div>
 </div>`).join('')||'<p class="small">Sin resultados para el filtro seleccionado.</p>'
}
$('poiListFilter').onchange=renderPOIList;$('poiSort').onchange=renderPOIList;
window.focusPOI=id=>{const p=poiResults.find(x=>x.id===id);if(p){advancedMap.setView([p.lat,p.lon],17)}};
window.addPOIToTactical=id=>{const p=poiResults.find(x=>x.id===id);if(!p)return;tacticalMarkers.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),type:'sensitive',name:p.name,lat:p.lat,lon:p.lon,status:'Activo'});localStorage.setItem(tacticalKey(),JSON.stringify(collectTactical()));alert('Receptor agregado al módulo Táctico')};
$('queryPOI').onclick=queryPOI;
$('clearPOI').onclick=()=>{poiLayers.forEach(x=>advancedMap&&advancedMap.removeLayer(x));poiLayers=[];poiResults=[];renderPOI();setPOIStatus('Capas limpiadas.','warn')};
$('fitPOI').onclick=()=>{const layers=[...advancedIncidentLayers,...poiLayers];if(layers.length)advancedMap.fitBounds(L.featureGroup(layers).getBounds().pad(.1))};

function poiGeoJSON(){return{type:'FeatureCollection',features:poiResults.map(p=>({type:'Feature',properties:{id:p.id,type:p.type,name:p.name,distance_m:Math.round(p.distance_m),affected:p.affected,...p.tags},geometry:{type:'Point',coordinates:[p.lon,p.lat]}}))}}
$('exportPOIGeoJSON').onclick=()=>download(`Receptores_${safeName(current?.title||'Incidente')}.geojson`,JSON.stringify(poiGeoJSON(),null,2),'application/geo+json');
$('exportPOICSV').onclick=()=>{const rows=[['tipo','nombre','distancia_m','dentro_accion_protectora','latitud','longitud'],...poiResults.map(p=>[p.type,p.name,Math.round(p.distance_m),p.affected?'SI':'NO',p.lat,p.lon])];const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');download(`Receptores_${safeName(current?.title||'Incidente')}.csv`,csv,'text/csv')};
$('exportPOIKML').onclick=()=>{if(!current)return alert('No hay incidente activo');const placemarks=poiResults.map(p=>`<Placemark><name>${escapeHtml(p.name)}</name><description>${escapeHtml(POI_STYLE[p.type]?.label||p.type)} | ${formatDistance(p.distance_m)} | ${p.affected?'Dentro de acción protectora':'Fuera de acción protectora'}</description><Point><coordinates>${p.lon},${p.lat},0</coordinates></Point></Placemark>`).join('');const k=toKML(current).replace('</Document></kml>',placemarks+'</Document></kml>');download(`UN${current.un}_${safeName(current.title)}_RECEPTORES.kml`,k,'application/vnd.google-earth.kml+xml')};
