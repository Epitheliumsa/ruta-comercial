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
const MAX=12, MAXF=5;
const nuevaFila=()=>({codigo:"",texto:"",pct:""});
const nuevaFormula=()=>({acts:[nuevaFila()],forma:"",pres:"",cant:1,R:null});
const S={motor:"EPITHELIUM",formulas:[nuevaFormula()],intento:false};
const $=id=>document.getElementById(id);
const fmt=n=>"$ "+Math.round(n).toLocaleString("es-CO");
const pctTxt=n=>String(n).replace(".",",");
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const unidadDe=f=>{const l=FORMAS[f.forma]; return l?((l.find(x=>String(x.p)===String(f.pres))||{}).u||""):"";};
const FORMAS_ORD=Object.keys(FORMAS).sort((a,b)=>a.localeCompare(b,"es"));
const nota='<span class="nota">No est\u00e1 en el cat\u00e1logo. Elige una opci\u00f3n de la lista.</span>';

/* ================= F\u00f3rmulas (hasta 5) ================= */
function renderFormulas(){
  const box=$("formulas"); box.innerHTML="";
  S.formulas.forEach((f,fi)=>{
    const el=document.createElement("div"); el.className="formula";
    el.innerHTML=`<div class="f-head"><h2>F\u00f3rmula ${fi+1}</h2>${S.formulas.length>1?`<button type="button" class="f-quitar">Quitar f\u00f3rmula</button>`:""}</div>
      <section><div class="sec-h"><h2 style="font-size:14px">Principios activos</h2><span class="cnt"></span></div>
        <div class="acts"></div><button type="button" class="agregar add-act">+ Agregar activo</button></section>
      <section><div class="sec-h"><h2 style="font-size:14px">Forma y presentaci\u00f3n</h2></div>
        <div class="fila fila-forma">
          <label class="campo">Forma farmac\u00e9utica<select class="sel-forma"></select></label>
          <label class="campo">Presentaci\u00f3n<select class="sel-pres"></select></label>
          <label class="campo campo-cant">Unidades<input class="num in-cant" type="number" min="1" step="1" inputmode="numeric"></label>
        </div></section>`;
    box.appendChild(el);
    const sf=el.querySelector(".sel-forma"), sp=el.querySelector(".sel-pres"), ic=el.querySelector(".in-cant");
    sf.innerHTML=`<option value="">Elige la forma</option>`+FORMAS_ORD.map(x=>`<option>${x}</option>`).join(""); sf.value=f.forma;
    const llenarPres=()=>{const l=FORMAS[f.forma];
      if(!l){sp.innerHTML=`<option value="">Primero elige la forma</option>`;sp.disabled=true;return;}
      sp.disabled=false; sp.innerHTML=`<option value="">Elige la presentaci\u00f3n</option>`+l.map(x=>`<option value="${x.p}">${x.p} ${x.u}</option>`).join("");
      if(!l.some(x=>String(x.p)===String(f.pres))) f.pres=""; sp.value=f.pres;};
    llenarPres(); ic.value=f.cant;
    sf.addEventListener("change",()=>{f.forma=sf.value;llenarPres();f.R=null;update();});
    sp.addEventListener("change",()=>{f.pres=sp.value;f.R=null;update();});
    ic.addEventListener("input",()=>{f.cant=Math.max(1,Number(ic.value)||1); if(f.R) f.R=calcular(f); update();});
    el.querySelector(".add-act").addEventListener("click",()=>{if(f.acts.length>=MAX)return;f.acts.push(nuevaFila());renderActs(f,el);el.querySelector(`.act:last-child input`).focus();});
    el.querySelector(".f-quitar")?.addEventListener("click",()=>{S.formulas.splice(fi,1);renderFormulas();});
    renderActs(f,el);
  });
  $("addFormula").hidden=S.formulas.length>=MAXF;
  update();
}
function renderActs(f,el){
  const box=el.querySelector(".acts"); box.innerHTML="";
  f.acts.forEach((a,i)=>{
    const r=document.createElement("div"); r.className="act";
    r.innerHTML=`<div class="who"><input autocomplete="off" placeholder="Busca por nombre" aria-label="Activo ${i+1}"><div class="meta">${!a.codigo&&a.texto?nota:""}</div></div>
      <div class="pct"><input class="num" type="number" step="0.001" min="0" inputmode="decimal" placeholder="0" aria-label="Concentraci\u00f3n ${i+1}"></div>
      <button type="button" class="quitar" aria-label="Quitar activo ${i+1}" title="Quitar">\u00d7</button>`;
    box.appendChild(r);
    const [inp,pin]=r.querySelectorAll("input");
    inp.value=a.codigo?BYCODE[a.codigo].nombre:a.texto; pin.value=a.pct;
    inp.addEventListener("input",()=>{a.codigo="";a.texto=inp.value;sugerir(r,inp,a,f,el);f.R=null;update();});
    inp.addEventListener("focus",()=>{if(!a.codigo&&inp.value)sugerir(r,inp,a,f,el)});
    inp.addEventListener("keydown",e=>navegar(e,r));
    inp.addEventListener("blur",()=>setTimeout(()=>{r.querySelector(".sug")?.remove(); const m=r.querySelector(".meta"); if(m) m.innerHTML=!a.codigo&&a.texto?nota:"";},150));
    pin.addEventListener("input",()=>{a.pct=pin.value;f.R=null;update();});
    r.querySelector(".quitar").addEventListener("click",()=>{f.acts.splice(i,1);if(!f.acts.length)f.acts.push(nuevaFila());f.R=null;renderActs(f,el);});
  });
  el.querySelector(".add-act").disabled=f.acts.length>=MAX;
  el.querySelector(".cnt").textContent=`${f.acts.filter(a=>a.codigo).length} de ${MAX}`;
  update();
}
function sugerir(r,inp,a,f,el){
  r.querySelector(".sug")?.remove();
  const res=buscar(inp.value); if(!res.length) return;
  const s=document.createElement("div"); s.className="sug"; s.setAttribute("role","listbox");
  res.forEach((m,k)=>{const b=document.createElement("button");b.type="button";if(!k)b.className="on";
    b.innerHTML=`<span>${esc(m.nombre)}</span>`;
    b.addEventListener("mousedown",e=>{e.preventDefault();elegir(a,m,f,el)}); s.appendChild(b)});
  r.querySelector(".who").appendChild(s);
}
function navegar(e,r){
  const s=r.querySelector(".sug"); if(!s) return; const bs=[...s.querySelectorAll("button")]; let i=bs.findIndex(b=>b.classList.contains("on"));
  if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();bs[i]?.classList.remove("on");i=(i+(e.key==="ArrowDown"?1:-1)+bs.length)%bs.length;bs[i].classList.add("on");bs[i].scrollIntoView({block:"nearest"})}
  if(e.key==="Enter"){e.preventDefault();bs[i]?.dispatchEvent(new MouseEvent("mousedown"))}
  if(e.key==="Escape") s.remove();
}
function elegir(a,m,f,el){
  if (m.virtual){ const r=SUSTITUCIONES[m.virtual]; a.codigo=r.sust; a.texto="";   // Antocianinas -> Ar\u00e1ndanos (mismo %) + Vitamina C 1 %
    r.agrega.forEach(([c,p])=>{ if(!f.acts.some(x=>x.codigo===c)) f.acts.push({codigo:c,texto:"",pct:p}); });
  } else { a.codigo=m.codigo; a.texto=""; }
  f.R=null; renderActs(f,el); const i=f.acts.indexOf(a);
  setTimeout(()=>{const p=el.querySelectorAll(".act")[i]?.querySelector(".pct input"); if(p&&!p.value)p.focus()},0);
}

/* ================= Validaci\u00f3n (C46\u2013C50): solo se muestra lo que falta ================= */
function validar(f){
  const pres=Number(f.pres);
  const filas=f.acts.filter(a=>a.codigo||a.texto||a.pct!=="");
  const hay=filas.some(a=>a.codigo);
  const cods=filas.every(a=>!(a.texto&&!a.codigo));
  const conc=filas.every(a=>(a.codigo||a.texto)?Number(a.pct)>0:a.pct==="");
  const suma=filas.reduce((s,a)=>s+(Number(a.pct)||0),0);
  const comb=!!f.forma&&!!pres&&(FORMAS[f.forma]||[]).some(x=>x.p===pres)&&!!M.combos[f.forma+pres];
  const faltas=[];
  if(!hay) faltas.push("Agrega al menos un principio activo");
  if(!cods) faltas.push("Hay un activo que no est\u00e1 en el cat\u00e1logo: el\u00edgelo de la lista");
  if(!conc) faltas.push("Cada activo necesita su concentraci\u00f3n (mayor que 0 %)");
  if(suma>=100) faltas.push(`Los activos suman ${pctTxt(+suma.toFixed(3))} %: deben sumar menos de 100 %`);
  if(!f.forma) faltas.push("Elige la forma farmac\u00e9utica");
  else if(!pres) faltas.push("Elige la presentaci\u00f3n");
  else if(!comb) faltas.push("Esa presentaci\u00f3n no existe en el cat\u00e1logo");
  return faltas;
}
const todasFaltas=()=>S.formulas.flatMap((f,i)=>validar(f).map(t=>S.formulas.length>1?`F\u00f3rmula ${i+1}: ${t}`:t));

/* ================= Etiquetas (derecha) ================= */
function etiquetaHTML(f,fi){
  const motorTxt=S.motor==="CDFLL"?"CDFLL":"Epithelium", R=f.R, pac=$("paciente").value.trim();
  const act=f.acts.filter(a=>a.codigo), u=unidadDe(f), pres=f.forma?(f.pres?`${f.forma} x ${f.pres} ${u}`:f.forma):"";
  const partes=act.map(a=>`${esc(BYCODE[a.codigo].nombre)} ${a.pct===""?"\u2014":pctTxt(a.pct)+" %"}`);
  const rx=act.length||pres?`<p class="rx-linea">${pac?`<b>${esc(pac)}</b>, `:""}${partes.join(" + ")}${pres?`${partes.length?" \u00b7 ":""}${esc(pres)}`:""}${pres&&f.cant>1?` \u00b7 ${f.cant} unidades`:""}</p>`:`<p class="rx-linea vacio">Agrega los principios activos</p>`;
  let precio;
  if(!R) precio=`<div class="precio"><span class="k">Precio</span><span class="v" style="color:var(--gris)">\u2014</span><span class="vacio-txt">Completa la f\u00f3rmula y toca \u00abCotizar\u00bb.</span></div>`;
  else if(S.motor==="CDFLL") precio=`<div class="precio"><span class="k">Precio facturaci\u00f3n CDFLL</span><span class="v">${fmt(R.precio_cdfll)}</span></div>
    <dl class="kv"><dt>PVSP CDFLL</dt><dd class="fuerte">${fmt(R.pr_venta_cdfll)}</dd><dt>Rango</dt><dd>${R.rango}</dd><dt>Precio motor Epithelium</dt><dd>${fmt(R.precio)}</dd>${f.cant>1?`<dt>Total ${f.cant} unidades</dt><dd>${fmt(R.precio_cdfll*f.cant)}</dd>`:""}</dl>`;
  else precio=`<div class="precio"><span class="k">Precio de facturaci\u00f3n</span><span class="v">${fmt(R.precio)}</span></div>
    <dl class="kv"><dt>PVSP</dt><dd class="fuerte">${fmt(R.pvsp)}</dd>${f.cant>1?`<dt>Total ${f.cant} unidades</dt><dd>${fmt(R.total)}</dd>`:""}</dl>`;
  const pill=`${S.formulas.length>1?`F\u00d3RMULA ${fi+1} \u00b7 `:""}${R?"COTIZADA":"BORRADOR"} \u00b7 ${motorTxt}`;
  return `<div class="etiqueta"><div class="e-top"><img src="${document.querySelector('.header-logo-img')?.getAttribute('src').replace('logo-blanco','logo')||'logo.png'}" alt="Epithelium"><span><span class="pill ${R?"ok":"mal"}">${pill}</span></span></div>
    ${rx}${precio}</div>`;
}
function update(){
  const faltas=todasFaltas();
  $("secChecks").hidden=!(S.intento&&faltas.length);
  $("checks").innerHTML=faltas.map(t=>`<div class="chk mal"><b>FALTA</b><span>${esc(t)}</span></div>`).join("");
  $("etiquetas").innerHTML=S.formulas.map(etiquetaHTML).join("");
  $("e-cotiza").hidden=!window.CZ_COTIZA; $("e-cotiza").innerHTML=window.CZ_COTIZA?`Cotiza: <b>${esc(window.CZ_COTIZA)}</b>`:"";
  document.querySelectorAll("#formulas .formula").forEach((el,i)=>{const f=S.formulas[i]; if(f) el.querySelector(".cnt").textContent=`${f.acts.filter(a=>a.codigo).length} de ${MAX}`;});
  $("copy-odoo").disabled=!S.formulas.some(f=>f.R); $("linea-box").hidden=true;
}
function calcular(f){ return cotizar(f.forma,Number(f.pres),f.acts.filter(a=>a.codigo).map(a=>[a.codigo,Number(a.pct)]),f.cant,S.motor); }
function cotizarAhora(){
  S.intento=true;
  if(todasFaltas().length){ S.formulas.forEach(f=>f.R=null); update(); $("secChecks").scrollIntoView({behavior:"smooth",block:"center"}); return; }
  S.intento=false; S.formulas.forEach(f=>f.R=calcular(f)); update();
  if(window.matchMedia("(max-width:860px)").matches) $("etiquetas").scrollIntoView({behavior:"smooth",block:"start"});
}
function limpiar(){   // todo en blanco: una sola f\u00f3rmula; el PDV (quien cotiza) se conserva
  $("paciente").value=""; S.formulas=[nuevaFormula()]; S.intento=false; renderFormulas(); $("toast-cz").textContent="";
}

/* ================= L\u00edneas para la plantilla MI de Odoo (una por f\u00f3rmula cotizada) ================= */
const sinTilde=s=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const tituloProp=s=>s.toLowerCase().replace(/(^|\s)\S/g,c=>c.toUpperCase());
function lineaOdoo(f){
  const u=unidadDe(f), R=f.R;
  const acts=f.acts.filter(a=>a.codigo).map(a=>`${BYCODE[codigoEfectivo(f.forma,a.codigo)].nombre} ${pctTxt(a.pct)}%`);
  const pac=$("paciente").value.trim(), pdv=$("pdv").value.trim();
  const nombre=[pac&&tituloProp(pac),...acts,`${f.forma} x ${f.pres} ${u}`].filter(Boolean).join(", ")+(pdv?` - ${pdv}`:"");
  const precio=S.motor==="CDFLL"?R.precio_cdfll:R.precio;
  return [nombre,"Magistral Individual","Magistral Individual",sinTilde(f.forma),R.envase,f.pres,u,"Magistral Individual",precio,"","IVA Exento","False"].join("\t");
}
async function copiar(){
  const t=S.formulas.filter(f=>f.R).map(lineaOdoo).join("\n"); if(!t) return;
  const n=t.split("\n").length; $("linea").textContent=t;
  try{ await navigator.clipboard.writeText(t); $("toast-cz").textContent=n>1?`${n} l\u00edneas copiadas. P\u00e9galas en la plantilla de creaci\u00f3n MI.`:"L\u00ednea copiada. P\u00e9gala en la plantilla de creaci\u00f3n MI."; }
  catch{ $("linea-box").hidden=false; $("toast-cz").textContent="Selecciona las l\u00edneas de abajo y c\u00f3pialas."; }
  setTimeout(()=>$("toast-cz").textContent="",4000);
}

/* ================= Arranque: siempre en blanco ================= */
function setMotor(m){ S.motor=m; $("m-epi").setAttribute("aria-pressed",m==="EPITHELIUM"); $("m-cdfll").setAttribute("aria-pressed",m==="CDFLL"); S.formulas.forEach(f=>{if(f.R) f.R=calcular(f);}); update(); }
$("pdv").value=window.CZ_PDV||"";
$("paciente").addEventListener("input",update);
$("addFormula").addEventListener("click",()=>{ if(S.formulas.length>=MAXF) return; S.formulas.push(nuevaFormula()); renderFormulas(); const els=document.querySelectorAll("#formulas .formula"); const ul=els[els.length-1]; ul.scrollIntoView({behavior:"smooth",block:"start"}); ul.querySelector(".act input")?.focus(); });
$("btnCotizar").addEventListener("click",cotizarAhora);
$("reset").addEventListener("click",limpiar);
$("m-epi").addEventListener("click",()=>setMotor("EPITHELIUM"));
$("m-cdfll").addEventListener("click",()=>setMotor("CDFLL"));
$("copy-odoo").addEventListener("click",copiar);
$("form").addEventListener("submit",e=>e.preventDefault());
$("pie").innerHTML=`Motor ${M.version} (${M.fecha}) \u00b7 ${MAT.length} principios activos \u00b7 ${Object.keys(FORMAS).length} formas.<br>\u00a9 ${new Date().getFullYear()} Epithelium S.A. Informaci\u00f3n confidencial y de uso exclusivo para usuarios autorizados.`;
(function(){const ok=window.CZ_MOTORES||["EPITHELIUM","CDFLL"];$("m-epi").hidden=!ok.includes("EPITHELIUM");$("m-cdfll").hidden=!ok.includes("CDFLL");if(ok.length<2)$("m-epi").parentNode.hidden=true;if(!ok.includes("EPITHELIUM"))S.motor="CDFLL";})();
renderFormulas();
setMotor(S.motor);
