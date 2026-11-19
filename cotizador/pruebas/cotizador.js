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
const pctTxt=n=>Number.isNaN(n)?"\u2014":String(n).replace(".",",");
// Porcentaje escrito con punto o coma ("3.", "3,5", "3.5"); vac\u00edo o inv\u00e1lido = NaN
const numPct=v=>{ const t=String(v??"").trim().replace(",",".").replace(/\.$/,""); return t===""||!/^\d*\.?\d+$/.test(t)?NaN:Number(t); };
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const unidadDe=f=>{const l=FORMAS[f.forma]; return l?((l.find(x=>String(x.p)===String(f.pres))||{}).u||""):"";};
const FORMAS_ORD=Object.keys(FORMAS).sort((a,b)=>a.localeCompare(b,"es"));
const notaDup='<span style="display:block;margin-top:4px;padding:7px 10px;border-radius:8px;background:#fce8e6;border:1px solid #f5c2bc;color:#b42318;font-size:13px;font-weight:700">Materia Prima duplicada</span>';
const nota='<span class="aviso-catalogo" style="display:block;margin-top:4px;padding:7px 10px;border-radius:8px;background:#fce8e6;border:1px solid #f5c2bc;color:#b42318;font-size:13px;font-weight:600;line-height:1.4">No est\u00e1 en el cat\u00e1logo. Comun\u00edcate a Servicio al Cliente Epithelium <a class="tel-sac" href="tel:+573007514948"><b>300 7514948</b></a></span>';

const CONECTORES_NOMBRE = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e']);
// Nombre del paciente siempre en NomProp (misma regla de Visita Comercial: conectores en min\u00fascula)
const nombrePropio = t => String(t || '').trim().replace(/\s+/g, ' ').split(' ').map((w, i) => {
  const l = w.toLocaleLowerCase('es');
  if (i && CONECTORES_NOMBRE.has(l)) return l;
  if (/\./.test(w) && w.replace(/\./g, '').length <= 4) return w.toLocaleUpperCase('es');
  return l.replace(/(^|[-'(])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase('es'));
}).join(' ');
const arreglarPaciente = () => { const v = nombrePropio($("paciente").value); if (v !== $("paciente").value) { $("paciente").value = v; update(); } };

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
      <div class="pct"><input class="num" type="text" inputmode="decimal" autocomplete="off" placeholder="0" aria-label="Concentraci\u00f3n ${i+1}"></div>
      <button type="button" class="quitar" aria-label="Quitar activo ${i+1}" title="Quitar">\u00d7</button>`;
    box.appendChild(r);
    const [inp,pin]=r.querySelectorAll("input");
    inp.value=a.codigo?BYCODE[a.codigo].nombre:a.texto; pin.value=a.pct;
    inp.addEventListener("input",()=>{a.codigo="";a.texto=inp.value;sugerir(r,inp,a,f,el);f.R=null;update();});
    inp.addEventListener("focus",()=>{if(!a.codigo&&inp.value)sugerir(r,inp,a,f,el)});
    inp.addEventListener("keydown",e=>navegar(e,r));
    inp.addEventListener("blur",()=>setTimeout(()=>{r.querySelector(".sug")?.remove(); const m=r.querySelector(".meta"); if(m&&!a.codigo) m.innerHTML=a.texto?nota:"";},150));
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

/* \u00cdndices de las filas con una materia prima que ya est\u00e1 antes en la misma f\u00f3rmula (un hom\u00f3logo cuenta como la misma) */
function repetidas(f){ const vistos=new Set(), out=[]; f.acts.forEach((a,i)=>{ if(!a.codigo) return; const k=codigoEfectivo(f.forma,a.codigo); if(vistos.has(k)) out.push(i); else vistos.add(k); }); return out; }
/* ================= Validaci\u00f3n (C46\u2013C50): solo se muestra lo que falta ================= */
function validar(f){
  const pres=Number(f.pres);
  const filas=f.acts.filter(a=>a.codigo||a.texto||a.pct!=="");
  const hay=filas.some(a=>a.codigo);
  const cods=filas.every(a=>!(a.texto&&!a.codigo));
  const conc=filas.every(a=>(a.codigo||a.texto)?numPct(a.pct)>0:a.pct==="");
  const suma=filas.reduce((s,a)=>s+(numPct(a.pct)||0),0);
  const comb=!!f.forma&&!!pres&&(FORMAS[f.forma]||[]).some(x=>x.p===pres)&&!!M.combos[f.forma+pres];
  const faltas=[];
  if(!hay) faltas.push("Agrega al menos un principio activo");
  if(!cods) faltas.push("No est\u00e1 en el cat\u00e1logo. Comun\u00edcate a Servicio al Cliente Epithelium 300 7514948");
  if(!conc) faltas.push("Cada activo necesita su concentraci\u00f3n (mayor que 0 %)");
  if(suma>=100) faltas.push(`Los activos suman ${pctTxt(+suma.toFixed(3))} %: deben sumar menos de 100 %`);
  const rep=repetidas(f);
  if(rep.length) faltas.push(`Materia Prima duplicada: ${[...new Set(rep.map(i=>BYCODE[f.acts[i].codigo].nombre))].join(", ")}`);
  if(!f.forma) faltas.push("Elige la forma farmac\u00e9utica");
  else if(!pres) faltas.push("Elige la presentaci\u00f3n");
  else if(!comb) faltas.push("Esa presentaci\u00f3n no existe en el cat\u00e1logo");
  return faltas;
}
const todasFaltas=()=>[...($("paciente").value.trim()?[]:["Escribe el nombre del paciente"]),...S.formulas.flatMap((f,i)=>validar(f).map(t=>S.formulas.length>1?`F\u00f3rmula ${i+1}: ${t}`:t))];

/* ================= Etiquetas (derecha) ================= */
function etiquetaHTML(f,fi){
  const motorTxt=S.motor==="CDFLL"?"CDFLL":"Epithelium", R=f.R, pac=$("paciente").value.trim();
  const act=f.acts.filter(a=>a.codigo), u=unidadDe(f), pres=f.forma?(f.pres?`${f.forma} x ${f.pres} ${u}`:f.forma):"";
  const partes=act.map(a=>`${esc(BYCODE[a.codigo].nombre)} ${a.pct===""?"\u2014":pctTxt(numPct(a.pct))+" %"}`);
  const rx=act.length||pres?`<p class="rx-linea">${pac?`<b>${esc(pac)}</b>, `:""}${partes.join(" + ")}${pres?`${partes.length?" \u00b7 ":""}${esc(pres)}`:""}${pres&&f.cant>1?` \u00b7 ${f.cant} unidades`:""}</p>`:`<p class="rx-linea vacio">Agrega los principios activos</p>`;
  let precio;
  if(!R) precio=`<div class="precio"><span class="k">Precio</span><span class="v" style="color:var(--gris)">\u2014</span><span class="vacio-txt">Completa la f\u00f3rmula y toca \u00abCotizar\u00bb.</span></div>`;
  else{
    const cdf=S.motor==="CDFLL", fac=cdf?R.precio_cdfll:R.precio, pvs=cdf?R.pr_venta_cdfll:R.pvsp, n=f.cant;
    precio=`<div class="precio"><span class="k">Precio de facturaci\u00f3n${cdf?" CDFLL":""}${n>1?" \u00b7 por unidad":""}</span><span class="v">${fmt(fac)}</span></div>
    <dl class="kv">${cdf?`<dt>Rango</dt><dd>${R.rango}</dd>`:""}${n>1?`<dt>Total facturaci\u00f3n \u00b7 ${n} unidades</dt><dd class="fuerte">${fmt(fac*n)}</dd>`:""}</dl>
    <div class="pvs"><div class="pvs-fila"><span>Precio Venta Sugerido${n>1?" \u00b7 por unidad":""}</span><b>${fmt(pvs)}</b></div>${n>1?`<div class="pvs-fila"><span>Precio Venta Sugerido \u00b7 total ${n} unidades</span><b>${fmt(pvs*n)}</b></div>`:""}</div>`;
  }
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
  marcarErrores();
  $("copy-odoo").disabled=!S.formulas.some(f=>f.R); $("btnPdf").disabled=!S.formulas.some(f=>f.R); $("linea-box").hidden=true;
}

/* Resalta en rojo las casillas que faltan o est\u00e1n mal (solo despu\u00e9s de tocar \u00abCotizar\u00bb) */
function marcarErrores(){
  document.querySelectorAll("#form .campo-mal").forEach(e=>e.classList.remove("campo-mal"));
  const mal=e=>e&&e.classList.add("campo-mal");
  document.querySelectorAll("#formulas .formula").forEach((el,fi)=>{   // materia prima duplicada: siempre en rojo, con su mensaje
    const f=S.formulas[fi]; if(!f) return; const rep=new Set(repetidas(f));
    el.querySelectorAll(".act").forEach((r,i)=>{ const a=f.acts[i], m=r.querySelector(".meta"); if(!a||!a.codigo||!m) return;
      m.innerHTML=rep.has(i)?notaDup:""; if(rep.has(i)) mal(r.querySelector(".who input")); });
  });
  if(!S.intento) return;
  if(!$("paciente").value.trim()) mal($("paciente"));
  document.querySelectorAll("#formulas .formula").forEach((el,fi)=>{
    const f=S.formulas[fi]; if(!f) return;
    const filas=el.querySelectorAll(".act");
    const usados=f.acts.filter(a=>a.codigo||a.texto||a.pct!=="");
    if(!usados.some(a=>a.codigo)) mal(filas[0]?.querySelector(".who input"));
    const suma=usados.reduce((t,a)=>t+(numPct(a.pct)||0),0);
    f.acts.forEach((a,i)=>{ const r=filas[i]; if(!r) return; const [n,pc]=r.querySelectorAll("input");
      if(a.texto&&!a.codigo) mal(n);
      if(!a.codigo&&!a.texto&&a.pct!=="") mal(n);
      if((a.codigo||a.texto)&&!(numPct(a.pct)>0)) mal(pc);
      if(suma>=100&&a.pct!=="") mal(pc); });
    const pres=Number(f.pres);
    if(!f.forma) mal(el.querySelector(".sel-forma"));
    else if(!pres||!(FORMAS[f.forma]||[]).some(x=>x.p===pres)||!M.combos[f.forma+pres]) mal(el.querySelector(".sel-pres"));
  });
}
function calcular(f){ return cotizar(f.forma,Number(f.pres),f.acts.filter(a=>a.codigo).map(a=>[a.codigo,numPct(a.pct)]),f.cant,S.motor); }
function cotizarAhora(){
  arreglarPaciente(); S.intento=true;
  if(todasFaltas().length){ S.formulas.forEach(f=>f.R=null); update(); $("secChecks").scrollIntoView({behavior:"smooth",block:"center"}); return; }
  S.intento=false; S.formulas.forEach(f=>f.R=calcular(f)); update();
  try{ // auditoría: queda quién cotizó, cuándo, qué y a qué precio
    const cdf=S.motor==="CDFLL", formulas=S.formulas.filter(f=>f.R).map(f=>({activos:f.acts.filter(a=>a.codigo).map(a=>({nombre:BYCODE[a.codigo].nombre,pct:numPct(a.pct)})),forma:f.forma,pres:f.pres,unidad:unidadDe(f),cant:f.cant,precio:cdf?f.R.precio_cdfll:f.R.precio,pvsp:cdf?f.R.pr_venta_cdfll:f.R.pvsp}));
    registrarCotizacion({quien:window.CZ_PDV||"",paciente:$("paciente").value.trim(),pdv:$("pdv").value.trim(),motor:S.motor,version:(window.MOTOR||{}).version||"",formulas,total:formulas.reduce((s,x)=>s+x.pvsp*x.cant,0)});
  }catch(e){ console.warn("No se pudo preparar el registro de la cotización",e); }
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
  const acts=f.acts.filter(a=>a.codigo).map(a=>`${BYCODE[codigoEfectivo(f.forma,a.codigo)].nombre} ${pctTxt(numPct(a.pct))}%`);
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


/* ================= PDF de la cotizaci\u00f3n ================= */
/* Valor en letras (pesos colombianos): 2072000 -> "DOS MILLONES SETENTA Y DOS MIL PESOS M/CTE" */
function numeroALetras(n){
  n=Math.round(n);
  const U=["","uno","dos","tres","cuatro","cinco","seis","siete","ocho","nueve","diez","once","doce","trece","catorce","quince","diecis\u00e9is","diecisiete","dieciocho","diecinueve","veinte","veintiuno","veintid\u00f3s","veintitr\u00e9s","veinticuatro","veinticinco","veintis\u00e9is","veintisiete","veintiocho","veintinueve"];
  const D=["","","","treinta","cuarenta","cincuenta","sesenta","setenta","ochenta","noventa"];
  const C=["","ciento","doscientos","trescientos","cuatrocientos","quinientos","seiscientos","setecientos","ochocientos","novecientos"];
  const menosDeMil=x=>{ if(x===100) return "cien"; const c=Math.floor(x/100), r=x%100; let t=C[c];
    const dd=r<30?U[r]:D[Math.floor(r/10)]+(r%10?" y "+U[r%10]:""); return [t,dd].filter(Boolean).join(" "); };
  const apocope=t=>t.replace(/veintiuno$/,"veinti\u00fan").replace(/uno$/,"un");
  if(n===0) return "cero pesos m/cte";
  const mill=Math.floor(n/1e6), miles=Math.floor((n%1e6)/1000), resto=n%1000, partes=[];
  if(mill) partes.push(mill===1?"un mill\u00f3n":apocope(menosDeMil(mill))+" millones");
  if(miles) partes.push(miles===1?"mil":apocope(menosDeMil(miles))+" mil");
  if(resto) partes.push(menosDeMil(resto));
  let t=partes.join(" "); if(!resto) t+=(mill&&!miles?" de":""); else t=apocope(t);
  return (t+" pesos m/cte").replace(/\s+/g," ").trim();
}
/* Escribe texto con partes en negrilla, parti\u00e9ndolo en l\u00edneas de ancho fijo. Devuelve el alto usado. */
function textoRico(doc,partes,x,y,ancho,tam,interlinea){
  const pal=[]; partes.forEach(([t,neg])=>t.split(/(\s+)/).forEach(w=>{ if(w) pal.push([w,neg]); }));
  let cx=x, cy=y, lineas=1;
  pal.forEach(([w,neg])=>{ doc.setFont("helvetica",neg?"bold":"normal"); doc.setFontSize(tam); const ww=doc.getTextWidth(w);
    if(/^\s+$/.test(w)){ if(cx>x) cx+=ww; return; }
    if(cx+ww>x+ancho && cx>x){ cx=x; cy+=interlinea; lineas++; }
    doc.text(w,cx,cy); cx+=ww; });
  return lineas*interlinea;
}

function logoDataURL(){
  return new Promise(res=>{const img=new Image(); img.onload=()=>{try{const w=360,h=Math.round(w*img.naturalHeight/img.naturalWidth),c=document.createElement("canvas");c.width=w;c.height=h;const g=c.getContext("2d");g.fillStyle="#fff";g.fillRect(0,0,w,h);g.drawImage(img,0,0,w,h);res({d:c.toDataURL("image/jpeg",0.9),w,h});}catch(e){res(null);}}; img.onerror=()=>res(null);
    img.src=(document.querySelector(".header-logo-img")?.getAttribute("src")||"logo-blanco.png").replace("logo-blanco","logo");});
}
async function generarPDF(){
  const lista=S.formulas.map((f,i)=>({f,i})).filter(x=>x.f.R); if(!lista.length) return;
  if(!window.jspdf){ $("toast-cz").textContent="No se pudo cargar el generador de PDF."; return; }
  const doc=new window.jspdf.jsPDF({unit:"mm",format:"a4"}), W=210, X=18, AN=W-2*X;
  const verde=[0,107,79], gris=[95,107,104], tinta=[31,41,55], lima=[77,124,15];
  const pac=$("paciente").value.trim(), pdv=$("pdv").value.trim(), cdf=S.motor==="CDFLL";
  const ahora=new Date(), fecha=ahora.toLocaleString("es-CO",{timeZone:"America/Bogota",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
  const lg=await logoDataURL(); let y=16;
  if(lg){ const w=38, h=w*lg.h/lg.w; doc.addImage(lg.d,"JPEG",X,y,w,h); }
  doc.setFont("helvetica","bold"); doc.setFontSize(18); doc.setTextColor(...verde); doc.text("Cotizaci\u00f3n",W-X,y+7,{align:"right"});
  doc.setFont("helvetica","normal"); doc.setFontSize(9.5); doc.setTextColor(...gris);
  doc.text(fecha,W-X,y+13,{align:"right"}); doc.text(cdf?"Centro Dermatol\u00f3gico Federico Lleras Acosta":"Epithelium S.A.",W-X,y+18,{align:"right"});
  y+=34; doc.setDrawColor(217,229,223); doc.line(X,y,W-X,y); y+=8;
  // Paciente y quien cotiza (una sola vez, arriba)
  const etQ=window.CZ_COTIZA?"Cotiza":"PDV", nomQ=window.CZ_COTIZA||pdv;
  doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.setTextColor(...gris); doc.text("Paciente",X,y); if(nomQ) doc.text(etQ,X+AN/2,y); y+=5.5;
  doc.setFont("helvetica","bold"); doc.setFontSize(12); doc.setTextColor(...tinta); doc.text(pac,X,y); if(nomQ) doc.text(nomQ,X+AN/2,y); y+=11;
  // Tabla: f\u00f3rmula y Precio Venta Sugerido en la misma l\u00ednea (sin precio de facturaci\u00f3n ni rango)
  const colP=46, anT=AN-colP-8;
  doc.setFillColor(0,107,79); doc.roundedRect(X,y,AN,9,1.5,1.5,"F");
  doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(255,255,255);
  doc.text("F\u00f3rmula",X+4,y+6); doc.text("Valor",W-X-4,y+6,{align:"right"}); y+=9;
  let total=0;
  lista.forEach(({f,i},k)=>{
    const R=f.R, n=f.cant, pvs=cdf?R.pr_venta_cdfll:R.pvsp; total+=pvs*n;
    const acts=f.acts.filter(a=>a.codigo).map(a=>`${BYCODE[a.codigo].nombre} ${pctTxt(numPct(a.pct))} %`).join(" + ");
    const partes=[[`${lista.length>1?(k+1)+". ":""}${acts} \u00b7 ${f.forma} x ${f.pres} ${unidadDe(f)}`,false]];
    if(n>1) partes.push([` \u00b7 ${n} unidades (${fmt(pvs)} c/u)`,true]);   // m\u00e1s de una unidad: resaltado en negrilla
    // alto: se mide escribiendo en una hoja de prueba
    const medida=new window.jspdf.jsPDF({unit:"mm",format:"a4"}); const alto=Math.max(10,textoRico(medida,partes,0,0,anT,10.5,5)+5);
    if(y+alto>255){ doc.addPage(); y=20; }
    if(k%2){ doc.setFillColor(255,253,246); doc.rect(X,y,AN,alto,"F"); }
    doc.setTextColor(...tinta); textoRico(doc,partes,X+4,y+6.5,anT,10.5,5);
    doc.setFont("helvetica","bold"); doc.setFontSize(11.5); doc.setTextColor(...lima); doc.text(fmt(pvs*n),W-X-4,y+6.5,{align:"right"});
    y+=alto; doc.setDrawColor(231,223,199); doc.line(X,y,W-X,y);
  });
  // Total, siempre, con el valor en letras
  if(y+24>272){ doc.addPage(); y=20; }
  doc.setFillColor(241,247,230); doc.rect(X,y,AN,11,"F");
  doc.setFont("helvetica","bold"); doc.setFontSize(11.5); doc.setTextColor(...tinta); doc.text("Total",X+4,y+7.5);
  doc.setTextColor(...lima); doc.setFontSize(12.5); doc.text(fmt(total),W-X-4,y+7.5,{align:"right"}); y+=16;
  doc.setFont("helvetica","normal"); doc.setFontSize(9.5); doc.setTextColor(...gris);
  const enLetras=doc.splitTextToSize(`Son: ${nombrePropio(numeroALetras(total)).replace(/M\/cte$/,"M/Cte")}`,AN); doc.text(enLetras,X,y); y+=enLetras.length*4.5;
  y+=8;
  doc.setFont("helvetica","normal"); doc.setFontSize(7.5); doc.setTextColor(...gris);
  doc.text(doc.splitTextToSize(`\u00a9 ${ahora.getFullYear()} Epithelium S.A. Informaci\u00f3n confidencial y de uso exclusivo para usuarios autorizados. Los precios corresponden al motor ${M.version} y pueden cambiar sin previo aviso.`,AN),X,287);
  const aaaamm=`${ahora.getFullYear()}${String(ahora.getMonth()+1).padStart(2,"0")}`;
  const nombre=`${aaaamm} Cotizacion ${sinTilde(pac).replace(/[\\/:*?"<>|]+/g," ").trim()}.pdf`;
  try{ const url=URL.createObjectURL(doc.output("blob")), a=document.createElement("a"); a.href=url; a.download=nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),4000);
    $("toast-cz").textContent=`Se descarg\u00f3 \u00ab${nombre}\u00bb.`; }
  catch(e){ $("toast-cz").textContent="Este navegador no permiti\u00f3 descargar el PDF."; }
  setTimeout(()=>$("toast-cz").textContent="",5000);
}

/* ================= Arranque: siempre en blanco ================= */
function setMotor(m){ S.motor=m; $("m-epi").setAttribute("aria-pressed",m==="EPITHELIUM"); $("m-cdfll").setAttribute("aria-pressed",m==="CDFLL"); S.formulas.forEach(f=>{if(f.R) f.R=calcular(f);}); update(); }
$("pdv").value=window.CZ_PDV||"";
$("paciente").addEventListener("input",update);
$("paciente").addEventListener("blur",arreglarPaciente);
$("btnPdf").addEventListener("click",generarPDF);
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
