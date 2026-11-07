/* Cotizador Magistral Epithelium: se carga despu\u00e9s del ingreso */

/* ================= Motor (r\u00e9plica de la hoja COTIZACION) ================= */
const M = window.MOTOR;
const MAT = M.materias.map(([codigo,nombre,alias,costo])=>({codigo,nombre,alias,costo}));
const BYCODE = Object.fromEntries(MAT.map(m=>[m.codigo,m]));
const FORMAS = {}; M.formas.forEach(([f,p,u])=>{(FORMAS[f]=FORMAS[f]||[]).push({p,u})});
Object.values(FORMAS).forEach(a=>a.sort((x,y)=>x.p-y.p));
const EPS = 1e-9;
const piso = (x,s)=>Math.floor(x/s+EPS)*s, techo = (x,s)=>Math.ceil(x/s-EPS)*s;

const HOMOLOGA_FORMA = { "Loci\u00f3n|MA0377":"MA0208", "Emulsi\u00f3n|MA0377":"MA0203", "Gel|MA0377":"MA0208" };
function codigoEfectivo(forma,c){
  if (forma!=="Esmalte" && c==="MA0094H") return "MA0094";
  if (forma==="Esmalte" && c==="MA0094") return "MA0094H";
  return HOMOLOGA_FORMA[forma+"|"+c] || c;
}
function margen(forma,x){
  const k=String(Math.round(x));
  if (M.margenes_forma[forma+k]!==undefined) return M.margenes_forma[forma+k];
  return M.margenes[k]!==undefined ? M.margenes[k] : 0.35;
}
function cotizar(forma,pres,activos,cant,motor){
  const llave=forma+pres, combo=M.combos[llave];
  let mp=0,g=0;
  for (const [c,p] of activos){ const m=BYCODE[codigoEfectivo(forma,c)]; const gr=pres*p/100; g+=gr; mp+=gr*m.costo; }
  const base=(pres-g)*(M.bases[forma]||0);
  const r29=(mp+base+combo[0]+combo[1])*1.6;
  const p1=techo(r29/(1-margen(forma,piso(r29,500))),100), p2=techo(r29/(1-margen(forma,techo(r29,500))),100);
  const r30=Math.max(combo[2]??20000, Math.max(p1,p2));
  const mult = r30>100000 ? 1/3 : (r30<5000 ? 2/3 : M.multiplos[String(piso(r30,5000))]);
  const raw=r30/(1-mult), r32=techo(raw,100), r33=r32-piso(r32,1000);
  const pvsp = r33>=500 ? techo(raw,1000) : piso(raw,1000);
  const out={precio:r30,total:r30*cant,pvsp,envase:combo[3]};
  if (motor==="CDFLL"){ let r=null; for (const x of M.rangos_cdfll) if (x[1]<=r30) r=x; out.rango=r[0]; out.precio_cdfll=r[2]; out.pr_venta_cdfll=r[3]; }
  return out;
}

/* ================= Reglas de digitaci\u00f3n ================= */
const SUSTITUCIONES = { "antocianinas":{sust:"MA0375",agrega:[["MA0016",1]]}, "antocianidinas":{sust:"MA0375",agrega:[["MA0016",1]]} };
const SINONIMOS = { "tretinoina":"acido retinoico","pantenol":"d pantenol","kojico":"acido kojico di palmitatto","clobetazol":"clobetasol","biotina plus":"biotina","alfaestradiol":"alfa estradiol" };
const norm = s => (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9% ]+/g," ").replace(/\s+/g," ").trim();
MAT.forEach(m=>m.keys=[m.nombre,...m.alias].map(norm));
function buscar(q){
  const n=norm(q); if(!n) return [];
  const out=[], seen=new Set();
  for (const k of Object.keys(SUSTITUCIONES)) if (k.startsWith(n)) out.push({virtual:k,nombre:k[0].toUpperCase()+k.slice(1)});
  const s=Object.entries(SINONIMOS).find(([k])=>k.startsWith(n)||n.startsWith(k));
  const terms=[n]; if(s) terms.push(s[1]);
  for (const t of terms) for (const modo of ["ini","dentro"]) for (const m of MAT){
    if (seen.has(m.codigo)) continue;
    if (m.keys.some(k=>modo==="ini"?k.startsWith(t):k.includes(t))){out.push(m);seen.add(m.codigo);}
  }
  return out.slice(0,10);
}

/* ================= Estado y utilidades ================= */
const MAX=12, S={motor:"EPITHELIUM",acts:[],intento:false};
let R=null;   // resultado: solo existe despu\u00e9s de tocar \u00abCotizar\u00bb
const $=id=>document.getElementById(id);
const fmt=n=>"$ "+Math.round(n).toLocaleString("es-CO");
const pctTxt=n=>String(n).replace(".",",");
const nuevaFila=()=>({codigo:"",texto:"",pct:""});
const unidad=()=>{const f=FORMAS[$("forma").value]; return f?((f.find(x=>String(x.p)===$("pres").value)||{}).u||""):"";};

function initFormas(){
  $("forma").innerHTML=`<option value="">Elige la forma</option>`+Object.keys(FORMAS).sort((a,b)=>a.localeCompare(b,"es")).map(f=>`<option>${f}</option>`).join("");
}
function fillPres(keep){
  const f=FORMAS[$("forma").value];
  if(!f){ $("pres").innerHTML=`<option value="">Primero elige la forma</option>`; $("pres").disabled=true; return; }
  $("pres").disabled=false;
  $("pres").innerHTML=`<option value="">Elige la presentaci\u00f3n</option>`+f.map(x=>`<option value="${x.p}">${x.p} ${x.u}</option>`).join("");
  if (keep!=null && f.some(x=>String(x.p)===String(keep))) $("pres").value=keep;
}
// Cualquier cambio en la f\u00f3rmula borra la cotizaci\u00f3n: hay que volver a tocar \u00abCotizar\u00bb
function cambio(){ R=null; update(); }

/* ================= Activos ================= */
function addAct(){ if(S.acts.length>=MAX) return; S.acts.push(nuevaFila()); renderActs(); }
function renderActs(){
  const box=$("acts"); box.innerHTML="";
  S.acts.forEach((a,i)=>{
    const el=document.createElement("div"); el.className="act";
    el.innerHTML=`<div class="who"><input id="act-n-${i}" autocomplete="off" placeholder="Busca por nombre" aria-label="Activo ${i+1}">
      <div class="meta">${!a.codigo&&a.texto?`<span class="nota">No est\u00e1 en el cat\u00e1logo. Elige una opci\u00f3n de la lista.</span>`:""}</div></div>
      <div class="pct"><input id="act-p-${i}" class="num" type="number" step="0.001" min="0" inputmode="decimal" placeholder="0" aria-label="Concentraci\u00f3n ${i+1}"></div>
      <button type="button" class="quitar" aria-label="Quitar activo ${i+1}" title="Quitar">\u00d7</button>`;
    box.appendChild(el);
    const inp=el.querySelector("#act-n-"+i), pin=el.querySelector("#act-p-"+i);
    inp.value=a.codigo?BYCODE[a.codigo].nombre:a.texto; pin.value=a.pct;
    inp.addEventListener("input",()=>{a.codigo="";a.texto=inp.value;sugerir(el,inp,a);cambio()});
    inp.addEventListener("focus",()=>{if(!a.codigo&&inp.value)sugerir(el,inp,a)});
    inp.addEventListener("keydown",e=>navegar(e,el));
    inp.addEventListener("blur",()=>setTimeout(()=>{el.querySelector(".sug")?.remove(); const m=el.querySelector(".meta"); if(m) m.innerHTML=!a.codigo&&a.texto?`<span class="nota">No est\u00e1 en el cat\u00e1logo. Elige una opci\u00f3n de la lista.</span>`:"";},150));
    pin.addEventListener("input",()=>{a.pct=pin.value;cambio()});
    el.querySelector(".quitar").addEventListener("click",()=>{S.acts.splice(i,1);if(!S.acts.length)S.acts.push(nuevaFila());R=null;renderActs()});
  });
  $("add").disabled=S.acts.length>=MAX;
  update();
}
function sugerir(el,inp,a){
  el.querySelector(".sug")?.remove();
  const res=buscar(inp.value); if(!res.length) return;
  const s=document.createElement("div"); s.className="sug"; s.setAttribute("role","listbox");
  res.forEach((m,k)=>{const b=document.createElement("button");b.type="button";if(!k)b.className="on";
    b.innerHTML=`<span>${m.nombre}</span>`;
    b.addEventListener("mousedown",e=>{e.preventDefault();elegir(a,m)}); s.appendChild(b)});
  el.querySelector(".who").appendChild(s);
}
function navegar(e,el){
  const s=el.querySelector(".sug"); if(!s) return; const bs=[...s.querySelectorAll("button")]; let i=bs.findIndex(b=>b.classList.contains("on"));
  if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();bs[i]?.classList.remove("on");i=(i+(e.key==="ArrowDown"?1:-1)+bs.length)%bs.length;bs[i].classList.add("on");bs[i].scrollIntoView({block:"nearest"})}
  if(e.key==="Enter"){e.preventDefault();bs[i]?.dispatchEvent(new MouseEvent("mousedown"))}
  if(e.key==="Escape") s.remove();
}
function elegir(a,m){
  if (m.virtual){ const r=SUSTITUCIONES[m.virtual]; a.codigo=r.sust; a.texto="";   // Antocianinas -> Ar\u00e1ndanos (mismo %) + Vitamina C 1 %
    r.agrega.forEach(([c,p])=>{ if(!S.acts.some(x=>x.codigo===c)) S.acts.push({codigo:c,texto:"",pct:p}); });
  } else { a.codigo=m.codigo; a.texto=""; }
  R=null; renderActs(); const i=S.acts.indexOf(a); setTimeout(()=>{const p=$("act-p-"+i); if(p&&!p.value)p.focus()},0);
}

/* ================= Validaci\u00f3n (C46\u2013C50): solo se muestra lo que falta ================= */
function validar(){
  const forma=$("forma").value, pres=Number($("pres").value);
  const filas=S.acts.filter(a=>a.codigo||a.texto||a.pct!=="");
  const hay=filas.some(a=>a.codigo);
  const cods=filas.every(a=>!(a.texto&&!a.codigo));
  const conc=filas.every(a=>(a.codigo||a.texto)?Number(a.pct)>0:a.pct==="");
  const suma=filas.reduce((s,a)=>s+(Number(a.pct)||0),0);
  const comb=!!forma&&!!pres&&(FORMAS[forma]||[]).some(x=>x.p===pres)&&!!M.combos[forma+pres];
  const faltas=[];
  if(!hay) faltas.push("Agrega al menos un principio activo");
  if(!cods) faltas.push("Hay un activo que no est\u00e1 en el cat\u00e1logo: el\u00edgelo de la lista");
  if(!conc) faltas.push("Cada activo necesita su concentraci\u00f3n (mayor que 0 %)");
  if(suma>=100) faltas.push(`Los activos suman ${pctTxt(+suma.toFixed(3))} %: deben sumar menos de 100 %`);
  if(!forma) faltas.push("Elige la forma farmac\u00e9utica");
  else if(!pres) faltas.push("Elige la presentaci\u00f3n");
  else if(!comb) faltas.push("Esa presentaci\u00f3n no existe en el cat\u00e1logo");
  return {faltas, ok:!faltas.length};
}

/* ================= Pantalla ================= */
function update(){
  const v=validar(), forma=$("forma").value, pres=$("pres").value, u=unidad(), cant=Math.max(1,Number($("cant").value)||1);
  $("secChecks").hidden=!(S.intento&&!v.ok);
  $("checks").innerHTML=v.faltas.map(t=>`<div class="chk mal"><b>FALTA</b><span>${t}</span></div>`).join("");
  const act=S.acts.filter(a=>a.codigo);
  $("cnt-act").textContent=`${act.length} de ${MAX}`;
  $("e-titulo").textContent=forma?(pres?`${forma} x ${pres} ${u}`:forma):"Nueva cotizaci\u00f3n";
  const pac=$("paciente").value.trim(), pdv=$("pdv").value.trim().toUpperCase();
  $("e-pac").textContent=[pac,pdv&&("PDV "+pdv),cant>1&&(cant+" unidades")].filter(Boolean).join(" \u00b7 ");
  $("e-cotiza").hidden=!window.CZ_COTIZA; $("e-cotiza").innerHTML=window.CZ_COTIZA?`Cotiza: <b>${window.CZ_COTIZA}</b>`:"";
  $("e-rx").innerHTML=act.length?act.map(a=>`<li><span>${BYCODE[a.codigo].nombre}</span><span>${a.pct===""?"\u2014":pctTxt(a.pct)+" %"}</span></li>`).join(""):`<li class="vacio">Agrega los principios activos</li>`;
  const motorTxt = S.motor==="CDFLL"?"CDFLL":"Epithelium";
  $("e-estado").innerHTML = R?`<span class="pill ok">COTIZADA \u00b7 ${motorTxt}</span>`:`<span class="pill mal">BORRADOR \u00b7 ${motorTxt}</span>`;
  const box=$("e-precio");
  if(!R) box.innerHTML=`<div class="precio"><span class="k">Precio</span><span class="v" style="color:var(--gris)">\u2014</span><span class="vacio-txt">Completa la f\u00f3rmula y toca \u00abCotizar\u00bb.</span></div>`;
  else if(S.motor==="CDFLL") box.innerHTML=`<div class="precio"><span class="k">Precio facturaci\u00f3n CDFLL</span><span class="v">${fmt(R.precio_cdfll)}</span></div>
    <dl class="kv"><dt>PVSP CDFLL</dt><dd class="fuerte">${fmt(R.pr_venta_cdfll)}</dd><dt>Rango</dt><dd>${R.rango}</dd><dt>Precio motor Epithelium</dt><dd>${fmt(R.precio)}</dd>${cant>1?`<dt>Total ${cant} unidades</dt><dd>${fmt(R.precio_cdfll*cant)}</dd>`:""}</dl>`;
  else box.innerHTML=`<div class="precio"><span class="k">Precio de facturaci\u00f3n</span><span class="v">${fmt(R.precio)}</span></div>
    <dl class="kv"><dt>PVSP</dt><dd class="fuerte">${fmt(R.pvsp)}</dd>${cant>1?`<dt>Total ${cant} unidades</dt><dd>${fmt(R.total)}</dd>`:""}</dl>`;
  $("copy-odoo").disabled=!R; $("linea-box").hidden=true;
}
function calcular(){
  const forma=$("forma").value, pres=Number($("pres").value), cant=Math.max(1,Number($("cant").value)||1);
  return cotizar(forma,pres,S.acts.filter(a=>a.codigo).map(a=>[a.codigo,Number(a.pct)]),cant,S.motor);
}
function cotizarAhora(){
  S.intento=true;
  const v=validar();
  if(!v.ok){ R=null; update(); $("secChecks").scrollIntoView({behavior:"smooth",block:"center"}); return; }
  S.intento=false; R=calcular(); update();
  if(window.matchMedia("(max-width:860px)").matches) document.querySelector(".etiqueta").scrollIntoView({behavior:"smooth",block:"start"});
}
function limpiar(){   // deja todo en blanco; el PDV se conserva
  $("paciente").value=""; $("cant").value=1; $("forma").value=""; fillPres();
  S.acts=[nuevaFila()]; S.intento=false; R=null; renderActs(); $("toast-cz").textContent="";
}

/* ================= L\u00ednea para la plantilla MI de Odoo ================= */
const sinTilde=s=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const titulo=s=>s.toLowerCase().replace(/(^|\s)\S/g,c=>c.toUpperCase());
function lineaOdoo(){
  const forma=$("forma").value, pres=$("pres").value, u=unidad();
  const acts=S.acts.filter(a=>a.codigo).map(a=>`${BYCODE[codigoEfectivo(forma,a.codigo)].nombre} ${pctTxt(a.pct)}%`);
  const pac=$("paciente").value.trim(), pdv=$("pdv").value.trim().toUpperCase();
  const nombre=[pac&&titulo(pac),...acts,`${forma} x ${pres} ${u}`].filter(Boolean).join(", ")+(pdv?` - ${pdv}`:"");
  const precio=S.motor==="CDFLL"?R.precio_cdfll:R.precio;
  return [nombre,"Magistral Individual","Magistral Individual",sinTilde(forma),R.envase,pres,u,"Magistral Individual",precio,"","IVA Exento","False"].join("\t");
}
async function copiar(){
  if(!R) return;
  const t=lineaOdoo(); $("linea").textContent=t;
  try{ await navigator.clipboard.writeText(t); $("toast-cz").textContent="L\u00ednea copiada. P\u00e9gala en la plantilla de creaci\u00f3n MI."; }
  catch{ $("linea-box").hidden=false; $("toast-cz").textContent="Selecciona la l\u00ednea de abajo y c\u00f3piala."; }
  setTimeout(()=>$("toast-cz").textContent="",4000);
}

/* ================= Arranque: siempre en blanco ================= */
function setMotor(m){ S.motor=m; $("m-epi").setAttribute("aria-pressed",m==="EPITHELIUM"); $("m-cdfll").setAttribute("aria-pressed",m==="CDFLL"); if(R) R=calcular(); update(); }
initFormas(); fillPres();
$("forma").addEventListener("change",()=>{fillPres($("pres").value);cambio()});
$("pres").addEventListener("change",cambio);
$("cant").addEventListener("input",()=>{ if(R) R=calcular(); update(); });
["paciente","pdv"].forEach(id=>$(id).addEventListener("input",update));
$("add").addEventListener("click",()=>{addAct();$("act-n-"+(S.acts.length-1))?.focus()});
$("btnCotizar").addEventListener("click",cotizarAhora);
$("reset").addEventListener("click",limpiar);
$("m-epi").addEventListener("click",()=>setMotor("EPITHELIUM"));
$("m-cdfll").addEventListener("click",()=>setMotor("CDFLL"));
$("copy-odoo").addEventListener("click",copiar);
$("form").addEventListener("submit",e=>e.preventDefault());
$("pie").innerHTML=`Motor ${M.version} (${M.fecha}) \u00b7 ${MAT.length} principios activos \u00b7 ${Object.keys(FORMAS).length} formas.<br>\u00a9 ${new Date().getFullYear()} Epithelium S.A. Informaci\u00f3n confidencial y de uso exclusivo para usuarios autorizados.`;
(function(){const ok=window.CZ_MOTORES||["EPITHELIUM","CDFLL"];$("m-epi").hidden=!ok.includes("EPITHELIUM");$("m-cdfll").hidden=!ok.includes("CDFLL");if(ok.length<2)$("m-epi").parentNode.hidden=true;if(!ok.includes("EPITHELIUM"))S.motor="CDFLL";})();
S.acts=[nuevaFila()];
renderActs();
setMotor(S.motor);
