
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
 if(id==='mapview')setTimeout(()=>{initMap();map.invalidateSize();if(current){renderMap();renderTacticalMarkers();applyTacticalZones(false)}},100);
 if(id==='history')renderHistory();
 if(id==='ics')loadICSView();
 if(id==='operations')loadOperations();
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
 const inc=current,ics=getICSPlan(),ops=getOps()||collectOperations();
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
 const wx=getTactical()?.weather;
 const windTxt=wx?`${Math.round(wx.windDir||current.bearing)}° · ${wx.windSpeed??'-'} km/h`:`${Math.round(current.bearing)}°`;
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
