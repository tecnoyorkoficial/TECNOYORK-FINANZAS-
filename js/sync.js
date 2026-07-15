// js/sync.js — listeners en tiempo real (onSnapshot) y sincronización

if (window.db && negocioId) {
  window.fbOnSnapshot(window.fbDoc(window.db, "negocio_data", negocioId), (snap) => {
    const equipo = (snap.exists() && snap.data().equipo) ? snap.data().equipo : [];
    const cont = document.getElementById("listaEquipo");
    if (!cont) return;
    if (!equipo.length) { cont.innerHTML = '<div class="alert mid">Sin miembros invitados todavía</div>'; return; }
    cont.innerHTML = equipo.map(m => `
      <div class="item" style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:600;font-size:12px;">${m.activo?"✅":"⏳"} ${m.nombre||m.email}</div>
          <div class="small">${m.email} · ${etiquetaRol(m.rol)} ${m.activo?"":"(pendiente, falta que se registre)"}</div>
        </div>
        <button class="small-btn" onclick="eliminarMiembroEquipo('${m.email}')" style="background:rgba(239,68,68,.15);color:var(--bad);">🗑️</button>
      </div>`).join("");
  });
}
let unsubscribeRealTime = null;
function guardarDatosNegocio() {
  localStorage.setItem("biz_clientes", JSON.stringify(clientes));
  localStorage.setItem("biz_cotizaciones", JSON.stringify(cotizaciones));
  localStorage.setItem("biz_facturas", JSON.stringify(facturas));
  localStorage.setItem("biz_config", JSON.stringify(configNegocio));// ⚠️ catalogo ya NO se guarda aquí — usa guardarCatalogoNegocio() para eso
  
    if (window.db && window.auth?.currentUser && navigator.onLine) {
  const uid = negocioId || window.auth.currentUser.uid;
  const configSinLogo = { ...configNegocio, logo: "" };
  
  // ✅ Mostrar indicador de sincronizando
  const sb = document.getElementById("syncBadge");
      if(sb){ sb.innerText = "⏳ Sync..."; sb.style.background = "rgba(245,158,11,.2)"; sb.style.color = "#f59e0b"; }
  
      window.fbSetDoc(
        window.fbDoc(window.db, "negocio_data", uid),
        {
          clientes: clientes,
          cotizaciones: cotizaciones,
          facturas: facturas,
          configNegocio: configSinLogo, // ✅ sin logo
          actualizado: new Date().toISOString()
        },
        { merge: true }
      )
      .then(() => {
        // ✅ Sincronización completada
        const sb = document.getElementById("syncBadge");
        if(sb){ sb.innerText = "✅ Sync"; sb.style.background = "rgba(34,197,94,.2)"; sb.style.color = "#22c55e"; }
        setTimeout(() => actualizarContadorPendientes(), 2000);
      })
      .catch(e => {
        // ❌ Error
        const sb = document.getElementById("syncBadge");
        if(sb){ sb.innerText = "❌ Error"; sb.style.background = "rgba(239,68,68,.2)"; sb.style.color = "#ef4444"; }
        console.error("Error guardando negocio en Firebase:", e);
      });
  
      if(configNegocio.logo){
        window.fbSetDoc(
          window.fbDoc(window.db, "negocio_logo", uid),
          { logo: configNegocio.logo, actualizado: new Date().toISOString() },
          { merge: true }
        ).catch(e => console.error("Error guardando logo:", e));
      }
    }
  }
async function marcarFacturaPendiente(facturaId) {
  const fact = facturas.find(f => f.id === facturaId);
  if (!fact) return;
  if (!confirm("¿Revertir a pendiente? Esto también eliminará el movimiento de ingreso generado automáticamente.")) return;

  // Eliminar el movimiento de ingreso asociado
  if (fact.movimientoId) {
    const idMov = String(fact.movimientoId);

    // Pausar listener para que onSnapshot no restaure el dato
    if (unsubscribeRealTime) {
      unsubscribeRealTime();
      unsubscribeRealTime = null;
    }

    // Marcar en lista negra ANTES de tocar nada
    idsRecienEliminados.add(idMov);

    // Eliminar de memoria
    data = data.filter(d => String(d.ID) !== idMov);

    // Quitar del localStorage de ambos contextos
    ["personal","negocio"].forEach(c => {
      const cache = JSON.parse(localStorage.getItem(keyForCtx("dataCache", c)) || "[]");
      localStorage.setItem(keyForCtx("dataCache", c), JSON.stringify(
        cache.filter(d => String(d.ID) !== idMov)
      ));
    });

    guardarDatos();
    render();
    renderLista();

    // Eliminar de Firebase
    if (window.db && window.auth?.currentUser && !idMov.startsWith("local_")) {
      try {
        const colName = "movimientos_negocio";
        await window.fbDeleteDoc(
          window.fbDoc(window.db, "users", window.auth.currentUser.uid, colName, idMov)
        );
      } catch(e) {
        console.error("Error eliminando movimiento de Firebase:", e);
      }
    }

    toast("🗑️ Movimiento de ingreso eliminado");

    // Reactivar listener después de que Firebase procesó el delete
    setTimeout(() => {
      idsRecienEliminados.delete(idMov);
      if (!unsubscribeRealTime && window.db && window.auth?.currentUser) {
        activarSincronizacionRealTime();
      }
    }, 3000);
  }

  // Revertir la factura
  fact.estado = "pendiente";
  fact.fechaPago = null;
  fact.cuentaPago = null;
  fact.movimientoId = null;
  guardarDatosNegocio();
  renderListaFacturas();
  toast("↩️ Factura revertida a pendiente");
}
function activarSincronizacionRealTime() {
        if (!window.db || !window.currentUser) return;
        
        if (unsubscribeRealTime) {
          unsubscribeRealTime();
          unsubscribeRealTime = null;
        }
        
        const colNamePersonal = "movimientos_personal";
        const colNameNegocio = "movimientos_negocio";
        const userId = negocioId || window.currentUser.uid;
        
        // Escuchar cambios en movimientos personales
  const qPersonal = window.fbQuery(window.fbCollection(window.db, "users", userId, colNamePersonal));
  const unsubscribePersonal = window.fbOnSnapshot(qPersonal, (snapshot) => {
  const fbData = [];
  snapshot.forEach(doc => { if (!idsRecienEliminados.has(String(doc.id))) fbData.push({ ...doc.data(), ID: doc.id }); });
  localStorage.setItem(keyForCtx("dataCache", "personal"), JSON.stringify(fbData));

  if (contexto === "personal") {
    // Conservar en memoria los que están en lista negra aunque Firebase los devuelva
    const enMemoriaPendientes = data.filter(d => idsRecienEliminados.has(String(d.ID)));
    data = fbData.filter(d => !idsRecienEliminados.has(String(d.ID)));
      // Fusionar con pendientes offline
      obtenerCola().then(pendientes => {
        const pendientesPersonales = pendientes.filter(p => p.contexto === "personal");
        for (const p of pendientesPersonales) {
          if (!data.some(d => String(d.ID) === String(p.idLocal))) {
            data.push({ ...p.datos, ID: p.idLocal });
          }
        }
        guardarDatos();
        render();
        const sc = document.getElementById("syncCount");
        if (sc) sc.innerText = data.length;
      });
    }
  });
  
  // Escuchar cambios en movimientos de negocio
  const qNegocio = window.fbQuery(window.fbCollection(window.db, "users", userId, colNameNegocio));
  const unsubscribeNegocio = window.fbOnSnapshot(qNegocio, (snapshot) => {
  const fbData = [];
  snapshot.forEach(doc => { if (!idsRecienEliminados.has(String(doc.id))) fbData.push({ ...doc.data(), ID: doc.id }); });
  localStorage.setItem(keyForCtx("dataCache", "negocio"), JSON.stringify(fbData));

  if (contexto === "negocio") {
    // Conservar en memoria los que están en lista negra aunque Firebase los devuelva
    const enMemoriaPendientes = data.filter(d => idsRecienEliminados.has(String(d.ID)));
    data = fbData.filter(d => !idsRecienEliminados.has(String(d.ID)));
      obtenerCola().then(pendientes => {
        const pendientesNegocio = pendientes.filter(p => p.contexto === "negocio");
        for (const p of pendientesNegocio) {
          if (!data.some(d => String(d.ID) === String(p.idLocal))) {
            data.push({ ...p.datos, ID: p.idLocal });
          }
        }
        guardarDatos();
        render();
        const sc = document.getElementById("syncCount");
        if (sc) sc.innerText = data.length;
      });
    }
  });
        
        // Escuchar cambios en cuentas
        const cuentasRef = window.fbDoc(window.db, "usuarios_cuentas", userId + "_personal");
        const unsubscribeCuentasPersonal = window.fbOnSnapshot(cuentasRef, (doc) => {
    if (doc.exists() && doc.data().cuentas) {
      // Siempre guardar en localStorage sin importar contexto actual
      localStorage.setItem(keyForCtx("cuentas", "personal"), JSON.stringify(doc.data().cuentas));
      // Solo actualizar memoria y render si estamos EN personal ahora mismo
      if (contexto === "personal") {
        cuentas = doc.data().cuentas;
        render();
      }
      // Si estamos en negocio, ignorar — no tocar cuentas en memoria
    }
  });
        const cuentasNegRef = window.fbDoc(window.db, "usuarios_cuentas", userId + "_negocio");
        const unsubscribeCuentasNegocio = window.fbOnSnapshot(cuentasNegRef, (doc) => {
    if (doc.exists() && doc.data().cuentas) {
      // Siempre guardar en localStorage sin importar contexto actual
      localStorage.setItem(keyForCtx("cuentas", "negocio"), JSON.stringify(doc.data().cuentas));
      // Solo actualizar memoria y render si estamos EN negocio ahora mismo
      if (contexto === "negocio") {
        cuentas = doc.data().cuentas;
        render();
      }
      // Si estamos en personal, ignorar — no tocar cuentas en memoria
    }
  });
        
        // Escuchar cambios en categorías
        const catsRef = window.fbDoc(window.db, "usuarios_categorias", userId);
        const unsubscribeCats = window.fbOnSnapshot(catsRef, (doc) => {
          if (doc.exists()) {
            if (doc.data().categorias_personal) {
              localStorage.setItem(keyForCtx("categorias", "personal"), JSON.stringify(doc.data().categorias_personal));
            }
            if (doc.data().categorias_negocio) {
              localStorage.setItem(keyForCtx("categorias", "negocio"), JSON.stringify(doc.data().categorias_negocio));
            }
            if (contexto === "personal" && doc.data().categorias_personal) {
              categorias = doc.data().categorias_personal;
              render();
            } else if (contexto === "negocio" && doc.data().categorias_negocio) {
              categorias = doc.data().categorias_negocio;
              render();
            }
          }
        });
        
        // Escuchar cambios en metas
        const metasRef = window.fbDoc(window.db, "usuarios_metas", userId);
        const unsubscribeMetas = window.fbOnSnapshot(metasRef, (doc) => {
          if (doc.exists() && doc.data().goals) {
            goals = doc.data().goals;
            localStorage.setItem(keyFor("goals"), JSON.stringify(goals));
            render();
          }
        });
        
        // Escuchar cambios en presupuestos
        const presupuestosRef = window.fbDoc(window.db, "usuarios_presupuestos", userId);
        const unsubscribePresupuestos = window.fbOnSnapshot(presupuestosRef, (doc) => {
          if (doc.exists()) {
            if (doc.data().budgets_personal) {
              localStorage.setItem(keyForCtx("budgets", "personal"), JSON.stringify(doc.data().budgets_personal));
            }
            if (doc.data().budgets_negocio) {
              localStorage.setItem(keyForCtx("budgets", "negocio"), JSON.stringify(doc.data().budgets_negocio));
            }
            render();
          }
        });
        
        // Escuchar cambios en datos de negocio (clientes, catálogo, cotizaciones)
        const negocioRef = window.fbDoc(window.db, "negocio_data", userId);
        const unsubscribeNegocioData = window.fbOnSnapshot(negocioRef, (doc) => {
          if (doc.exists()) {
            if (doc.data().clientes) {
              clientes = doc.data().clientes;
              localStorage.setItem("biz_clientes", JSON.stringify(clientes));
            }
            if (doc.data().cotizaciones) {
              cotizaciones = doc.data().cotizaciones;
              localStorage.setItem("biz_cotizaciones", JSON.stringify(cotizaciones));
            }
            if (doc.data().facturas) {
    facturas = doc.data().facturas;
    localStorage.setItem("biz_facturas", JSON.stringify(facturas));
  }
            if (doc.data().configNegocio) {
    // ✅ Conservar el logo local al recibir actualización de Firebase
    const logoLocal = configNegocio.logo || localStorage.getItem("biz_logo_backup") || "";
    configNegocio = { ...doc.data().configNegocio, logo: logoLocal };
    localStorage.setItem("biz_config", JSON.stringify(configNegocio));
    cargarConfigNegocioUI();
  }
            if (contexto === "negocio") {
              renderListaCotizaciones();
              renderListaFacturas();
              render();
            }
          }
        });
        
        // Unificar todas las unsubscriptions
        // ✅ Listener separado para el catálogo (documento independiente)
        const catalogoRef = window.fbDoc(window.db, "negocio_catalogo", userId);
        const unsubscribeCatalogo = window.fbOnSnapshot(catalogoRef, (doc) => {
  if (doc.exists() && doc.data().catalogo) {
    catalogo = doc.data().catalogo;
    localStorage.setItem("biz_catalogo", JSON.stringify(catalogo));
    const formAbierto = document.getElementById("formProducto")?.style.display !== "none";
    if (!formAbierto && invSubTabActual === "catalogo") {
      renderListaCatalogo();
    }
  }
});
  
        // Unificar todas las unsubscriptions
        unsubscribeRealTime = () => {
          unsubscribePersonal();
          unsubscribeNegocio();
          unsubscribeCuentasPersonal();
          unsubscribeCuentasNegocio();
          unsubscribeCats();
          unsubscribeMetas();
          unsubscribePresupuestos();
          unsubscribeNegocioData();
          unsubscribeCatalogo();
        };
      }
async function sincronizarPendientes(){if(syncInProgress)return;if(!window.db||!window.auth?.currentUser)return;if(!navigator.onLine)return;syncInProgress=true;try{const cola=await obtenerCola();if(cola.length===0){syncInProgress=false;return;}toast(`🔄 Sincronizando ${cola.length}...`);for(const item of cola){try{const colName=item.contexto==="negocio"?"movimientos_negocio":"movimientos_personal";const ref=await window.fbAddDoc(window.fbCollection(window.db,"users",window.auth.currentUser.uid,colName),item.datos);const datosConId={...item.datos,ID:ref.id};if(item.contexto===contexto){data=data.filter(d=>String(d.ID)!==String(item.idLocal)&&String(d.ID)!==String(ref.id));data.push(datosConId);}else{const otraData=JSON.parse(localStorage.getItem(keyForCtx("dataCache",item.contexto))||"[]");const nuevaOtra=otraData.filter(d=>String(d.ID)!==String(item.idLocal));nuevaOtra.push(datosConId);localStorage.setItem(keyForCtx("dataCache",item.contexto),JSON.stringify(nuevaOtra));}const factAfectada=facturas.find(f=>f.movimientoId===item.idLocal);if(factAfectada){factAfectada.movimientoId=ref.id;guardarDatosNegocio();}await eliminarDeCola(item.id);}catch(e){console.error("Error:",e);}}guardarDatos();render();toast(`✅ Sincronizado`);actualizarContadorPendientes();await cargarDesdeFirebase();render();}catch(e){console.error("Error:",e);}finally{syncInProgress=false;}}
function actualizarStatusBar(){const sb=$("statusBar");if(!sb)return;if(navigator.onLine){sb.className="online";sb.innerHTML='<span class="status-dot online"></span> En línea <span id="syncBadge" class="sync-badge"></span>';actualizarContadorPendientes();sincronizarPendientes();}else{sb.className="offline";sb.innerHTML='<span class="status-dot offline"></span> Offline <span id="syncBadge" class="sync-badge"></span>';actualizarContadorPendientes();}generarNotificacionesSiCorresponde();actualizarBadgeNotif();}
window.addEventListener("online",()=>{actualizarStatusBar();sincronizarPendientes();cargarDesdeFirebase().then(()=>render());});
async function cerrarSesion(){if(!confirm("¿Cerrar sesión?"))return;if(unsubscribeRealTime){unsubscribeRealTime();unsubscribeRealTime=null;}await window.fbLogout();}
async function cargarTodo() {
  const ctxGuardado = localStorage.getItem("contexto") || "personal";
  contexto = ctxGuardado;
  document.body.classList.toggle("modo-negocio", contexto === "negocio");
  document.getElementById("ctxPersonal")?.classList.toggle("ctx-active", contexto === "personal");
  document.getElementById("ctxNegocio")?.classList.toggle("ctx-active", contexto === "negocio");
  actualizarNavNegocio();
  
  // ✅ PASO 1: Cargar localStorage y renderizar YA (instantáneo)
  const cachedData = localStorage.getItem(keyFor("dataCache"));
  if (cachedData) data = JSON.parse(cachedData);
  
  const cachedCuentas = localStorage.getItem(keyFor("cuentas"));
  if (cachedCuentas) cuentas = JSON.parse(cachedCuentas);
  
  const cachedCats = localStorage.getItem(keyForCtx("categorias", contexto));
  if (cachedCats) categorias = JSON.parse(cachedCats);
  
  goals = JSON.parse(localStorage.getItem(keyFor("goals")) || "[]");
  historial = JSON.parse(localStorage.getItem(keyFor("historialMeses")) || "[]");
  prestamos = JSON.parse(localStorage.getItem("prestamos") || "[]");
  inversiones = JSON.parse(localStorage.getItem("inversiones") || "[]");
  
  // Datos de negocio desde localStorage
  clientes = JSON.parse(localStorage.getItem("biz_clientes") || "[]");
  catalogo = JSON.parse(localStorage.getItem("biz_catalogo") || "[]");
  cotizaciones = JSON.parse(localStorage.getItem("biz_cotizaciones") || "[]");
  facturas = JSON.parse(localStorage.getItem("biz_facturas") || "[]");
  ordenes = JSON.parse(localStorage.getItem("biz_ordenes") || "[]");
  configNegocio = JSON.parse(localStorage.getItem("biz_config") || '{"razonSocial":"","nit":"","direccion":"","telefono":"","email":"","terminos":"Pago contra entrega. Validez: 15 días.","logo":""}');
  
  // Renderizar con lo que hay (inmediato)
  poblarSelects();
  actualizarLabels();
  render();
  cargarConfigNegocioUI();
  
  const sc = document.getElementById("syncCount");
  if (sc) sc.innerText = data.length;
  const hm2 = document.getElementById("headerMovs");
  if (hm2) hm2.innerText = data.length;
  
  // ✅ PASO 2: Sincronizar con Firebase en segundo plano (no bloquea UI)
  await actualizarContadorPendientes();
  
  Promise.all([
    cargarCuentas(),
    cargarCategorias(),
    cargarDesdeFirebase(),
  ]).then(() => {
    poblarSelects();
    actualizarLabels();
    render();
    const sc2 = document.getElementById("syncCount");
    if (sc2) sc2.innerText = data.length;
    const hm3 = document.getElementById("headerMovs");
    if (hm3) hm3.innerText = data.length;
  });
  
  Promise.all([
    cargarHistorialDesdeFirebase(),
    cargarTodosLosDatosFirebase(),
    cargarDatosNegocio(),
    cargarNotificaciones(),
  ]).then(() => {
    render();
  });
}
async function borrar(id){
  if(!confirm("¿Eliminar?")) return;
  const x = data.find(d => String(d.ID) === String(id));
  const ctx = x ? x.Contexto || contexto : contexto;
  const idStr = String(id);

  // 1 — Pausar listener para que onSnapshot no restaure el dato
  if(unsubscribeRealTime){
    unsubscribeRealTime();
    unsubscribeRealTime = null;
  }

  // 2 — Marcar en lista negra
  idsRecienEliminados.add(idStr);

  // 3 — Quitar de memoria inmediatamente
  data = data.filter(d => String(d.ID) !== idStr);

  // 4 — Quitar del localStorage de ambos contextos
  ["personal","negocio"].forEach(c => {
    const cache = JSON.parse(localStorage.getItem(keyForCtx("dataCache", c)) || "[]");
    localStorage.setItem(keyForCtx("dataCache", c), JSON.stringify(
      cache.filter(d => String(d.ID) !== idStr)
    ));
  });

  // 5 — Renderizar inmediatamente
  guardarDatos();
  render();
  renderLista();
  toast("🗑️ Eliminado");

  // 6 — Eliminar de Firebase
  if(window.db && window.auth?.currentUser && !idStr.startsWith("local_")){
    try{
      const colName = ctx === "negocio" ? "movimientos_negocio" : "movimientos_personal";
      await window.fbDeleteDoc(
        window.fbDoc(window.db, "users", window.auth.currentUser.uid, colName, idStr)
      );
    } catch(e){
      console.error("Error eliminando de Firebase:", e);
      toast("⚠️ Eliminado local — error en servidor");
    }
  }

  // 7 — Reactivar listener después de que Firebase procesó el delete
  setTimeout(() => {
    idsRecienEliminados.delete(idStr);
    if(!unsubscribeRealTime && window.db && window.auth?.currentUser){
      activarSincronizacionRealTime();
    }
  }, 3000);
}
async function confirmarCierre(){const s=calcSaldos();const ing=data.filter(x=>x.Tipo==="Ingreso").reduce((a,x)=>a+Number(x.Monto||0),0);const gas=data.filter(x=>x.Tipo==="Gasto").reduce((a,x)=>a+Number(x.Monto||0),0);const hoy=hoyColombia();const label=hoy.toLocaleDateString("es-CO",{month:"long",year:"numeric"});const mesKey=hoy.getFullYear()+"-"+String(hoy.getMonth()+1).padStart(2,"0");const mesCerrado={id:mesKey,label:label,fecha:fechaHoyColombia(),ing:ing,gas:gas,balance:ing-gas,saldosCierre:{...s},movimientos:[...data],cuentas:cuentas.map(c=>({id:c.id,nombre:c.nombre,icon:c.icon,saldoFinal:s[c.id]||0})),createdAt:Date.now()};historial.unshift(mesCerrado);localStorage.setItem(keyFor("historialMeses"),JSON.stringify(historial));if(window.db&&window.auth?.currentUser){try{const colHistorico="historial_mensual";const historicoRef=window.fbDoc(window.db,"users",window.auth.currentUser.uid,colHistorico,mesKey);await window.fbUpdateDoc(historicoRef,mesCerrado).catch(async()=>{await window.fbAddDoc(window.fbCollection(window.db,"users",window.auth.currentUser.uid,colHistorico),mesCerrado);});}catch(e){console.error("Error guardando en Firebase:",e);}}cuentas=cuentas.map(c=>({...c,saldoInicial:s[c.id]||0}));localStorage.setItem(keyFor("cuentas"),JSON.stringify(cuentas));await guardarCuentas(contexto);await sincronizarPendientes();if(window.db&&window.auth?.currentUser){const colNamePersonal="movimientos_personal";const colNameNegocio="movimientos_negocio";try{const snapPersonal=await window.fbGetDocs(window.fbCollection(window.db,"users",window.auth.currentUser.uid,colNamePersonal));const snapNegocio=await window.fbGetDocs(window.fbCollection(window.db,"users",window.auth.currentUser.uid,colNameNegocio));for(const doc of snapPersonal.docs)await window.fbDeleteDoc(window.fbDoc(window.db,"users",window.auth.currentUser.uid,colNamePersonal,doc.id));for(const doc of snapNegocio.docs)await window.fbDeleteDoc(window.fbDoc(window.db,"users",window.auth.currentUser.uid,colNameNegocio,doc.id));}catch(e){console.error("Error limpiando movimientos:",e);}}data=[];await limpiarCola();localStorage.setItem(keyFor("dataCache"),"[]");guardarDatos();const sc=$("syncCount");if(sc)sc.innerText=0;$("modalCierre").classList.remove("open");render();toast("✔ Mes cerrado: "+label+" - Historial guardado");}
async function verificarCierreAutomatico(){
  if(!window.auth?.currentUser) return;
  const ahora=new Date();
  const hora=ahora.getHours();
  const minuto=ahora.getMinutes();
  const dia=ahora.getDate();
  const ultimoDia=new Date(ahora.getFullYear(),ahora.getMonth()+1,0).getDate();
  if(dia!==ultimoDia||hora!==23||minuto<58) return;
  const mesKey=ahora.getFullYear()+"-"+String(ahora.getMonth()+1).padStart(2,"0");
  const claveCierre="cierreAuto_"+uid()+"_"+mesKey;
  if(localStorage.getItem(claveCierre)==="1") return;
  localStorage.setItem(claveCierre,"1");
  toast("🔒 Cerrando mes automáticamente...");
  await new Promise(r=>setTimeout(r,2000));
  const s=calcSaldos();
  const ing=data.filter(x=>x.Tipo==="Ingreso").reduce((a,x)=>a+Number(x.Monto||0),0);
  const gas=data.filter(x=>x.Tipo==="Gasto").reduce((a,x)=>a+Number(x.Monto||0),0);
  const hoy=hoyColombia();
  const label=hoy.toLocaleDateString("es-CO",{month:"long",year:"numeric"});
  const mesCerrado={id:mesKey,label:label,fecha:fechaHoyColombia(),ing,gas,balance:ing-gas,saldosCierre:{...s},movimientos:[...data],cuentas:cuentas.map(c=>({id:c.id,nombre:c.nombre,icon:c.icon,saldoFinal:s[c.id]||0})),createdAt:Date.now()};
  historial.unshift(mesCerrado);
  localStorage.setItem(keyFor("historialMeses"),JSON.stringify(historial));
  if(window.db&&window.auth?.currentUser){
    try{
      const colHistorico="historial_mensual";
      const historicoRef=window.fbDoc(window.db,"users",window.auth.currentUser.uid,colHistorico,mesKey);
      await window.fbUpdateDoc(historicoRef,mesCerrado).catch(async()=>{
        await window.fbAddDoc(window.fbCollection(window.db,"users",window.auth.currentUser.uid,colHistorico),mesCerrado);
      });
    }catch(e){console.error(e);}
  }
  cuentas=cuentas.map(c=>({...c,saldoInicial:s[c.id]||0}));
  localStorage.setItem(keyFor("cuentas"),JSON.stringify(cuentas));
  await guardarCuentas(contexto);
  await sincronizarPendientes();
  if(window.db&&window.auth?.currentUser){
    try{
      const snapP=await window.fbGetDocs(window.fbCollection(window.db,"users",window.auth.currentUser.uid,"movimientos_personal"));
      const snapN=await window.fbGetDocs(window.fbCollection(window.db,"users",window.auth.currentUser.uid,"movimientos_negocio"));
      for(const doc of snapP.docs) await window.fbDeleteDoc(window.fbDoc(window.db,"users",window.auth.currentUser.uid,"movimientos_personal",doc.id));
      for(const doc of snapN.docs) await window.fbDeleteDoc(window.fbDoc(window.db,"users",window.auth.currentUser.uid,"movimientos_negocio",doc.id));
    }catch(e){console.error(e);}
  }
  data=[];
  await limpiarCola();
  localStorage.setItem(keyFor("dataCache"),"[]");
  guardarDatos();
  render();
  if(Notification.permission==="granted"){
    new Notification("✅ Mes cerrado automáticamente",{body:`${label} archivado. ¡Nuevo mes listo!`});
  }
  toast("✅ Cierre automático completado: "+label);
}
window.confirmarRevertirCompra = async function() {
  const compra = compras.find(c => c.id === compraPagandoId);
  if (!compra) { toast("❌ Compra no encontrada"); return; }

  const cuentaId = document.getElementById("_revertirCompraCuenta")?.value;
  if (!cuentaId) { toast("Selecciona una cuenta"); return; }

  if (!confirm(`¿Revertir compra ${compra.numero}? Se creará un ingreso de ${money(compra.total)} y se reducirá el stock de los productos comprados.`)) return;

  // 1 — Eliminar movimiento de gasto original si existe
  if (compra.movimientoId) {
    const idMov = String(compra.movimientoId);

    // Pausar listener
    if (unsubscribeRealTime) { unsubscribeRealTime(); unsubscribeRealTime = null; }
    idsRecienEliminados.add(idMov);

    data = data.filter(d => String(d.ID) !== idMov);
    ["personal", "negocio"].forEach(c => {
      const cache = JSON.parse(localStorage.getItem(keyForCtx("dataCache", c)) || "[]");
      localStorage.setItem(keyForCtx("dataCache", c), JSON.stringify(
        cache.filter(d => String(d.ID) !== idMov)
      ));
    });
    guardarDatos();

    if (window.db && window.auth?.currentUser && !idMov.startsWith("local_")) {
      try {
        await window.fbDeleteDoc(window.fbDoc(window.db, "users", window.auth.currentUser.uid, "movimientos_negocio", idMov));
      } catch(e) { console.error("Error eliminando movimiento:", e); }
    }

    setTimeout(() => {
      idsRecienEliminados.delete(idMov);
      if (!unsubscribeRealTime && window.db && window.auth?.currentUser) activarSincronizacionRealTime();
    }, 3000);
  }

  // 2 — Revertir stock de los productos comprados
  (compra.productos || []).forEach(p => {
    const prod = catalogo.find(x => x.id === p.productoId);
    if (prod) {
      prod.stock = Math.max(0, (prod.stock || 0) - p.cantidad);
      prod.actualizadoEn = new Date().toISOString();
    }
    // Registrar movimiento de stock de salida (reverso)
    movimientosStock.unshift({
      id: "movstock_rev_" + Date.now() + "_" + Math.random().toString(36).slice(2,5),
      productoId: p.productoId,
      productoNombre: p.nombre,
      tipo: "salida",
      cantidad: p.cantidad,
      motivo: "↩️ Reversión compra " + compra.numero,
      refId: compra.id,
      fecha: fechaHoyColombia(),
      createdAt: new Date().toISOString()
    });
  });
  guardarCatalogoNegocio();
  guardarInventarioNegocio();

  // 3 — Marcar compra como revertida
  compra.estado = "revertida";
  compra.movimientoId = null;
  compra.cuentaPago = null;
  compra.fechaReversion = fechaHoyColombia();
  guardarInventarioNegocio();

  render();
  renderListaCompras();
  renderListaCatalogo();

  document.getElementById("_modalRevertirCompra")?.classList.remove("open");
  compraPagandoId = null;
  toast("↩️ Compra revertida — stock ajustado");
};