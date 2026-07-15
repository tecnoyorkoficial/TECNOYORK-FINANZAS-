// js/ui.js — render de pantallas, tabs, modales, formularios rápidos

const $=id=>document.getElementById(id);
async function crearCuentaEquipo(){
  const nombre=(document.getElementById("nuevoMiembroNombre")?.value||"").trim();
  const email=(document.getElementById("nuevoMiembroEmail")?.value||"").toLowerCase().trim();
  const pass=(document.getElementById("nuevoMiembroPass")?.value||"");
  const rol=document.getElementById("nuevoMiembroRol")?.value||"tecnico";

  if(!nombre){toast("⚠️ Ingresa el nombre");return;}
  if(!email||!email.includes("@")){toast("⚠️ Correo inválido");return;}
  if(!pass||pass.length<6){toast("⚠️ La contraseña debe tener al menos 6 caracteres");return;}
  if(!window.db||!window.auth?.currentUser){toast("❌ Sin conexión");return;}

  const btn=document.querySelector("#cardEquipo .primary");
  if(btn){btn.disabled=true;btn.textContent="⏳ Creando...";}

  try{
    // 1. Crear la cuenta en Firebase Auth usando la API REST (sin cerrar la sesión actual)
    const apiKey=window.auth.app.options.apiKey;
    const resp=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({email,password:pass,returnSecureToken:true})
    });
    const data=await resp.json();
    if(data.error){throw new Error(data.error.message);}
    const nuevoUid=data.localId;

    // 2. Guardar displayName vía API REST
    await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({idToken:data.idToken,displayName:nombre,returnSecureToken:false})
    });

    // 3. Guardar perfil en Firestore bajo usuarios_perfil/{nuevoUid}
    const negId=negocioId||window.auth.currentUser.uid;
    await window.fbSetDoc(window.fbDoc(window.db,"usuarios_perfil",nuevoUid),{
      negocioId:negId, rol, nombre, email,
      creadoPor:window.auth.currentUser.uid,
      creadoEn:new Date().toISOString()
    });

    // 4. Agregar al equipo en negocio_data
    const negDocRef=window.fbDoc(window.db,"negocio_data",negId);
    const negSnap=await window.fbGetDoc(negDocRef);
    let equipo=(negSnap.exists()&&negSnap.data().equipo)?negSnap.data().equipo:[];
    const idx=equipo.findIndex(m=>(m.email||"").toLowerCase()===email);
    if(idx!==-1){equipo[idx]={...equipo[idx],uid:nuevoUid,nombre,rol,activo:true};}
    else{equipo.push({uid:nuevoUid,email,rol,nombre,activo:true});}
    await window.fbSetDoc(negDocRef,{equipo},{merge:true});

    // 5. Limpiar formulario
    if(document.getElementById("nuevoMiembroNombre")) document.getElementById("nuevoMiembroNombre").value="";
    if(document.getElementById("nuevoMiembroEmail")) document.getElementById("nuevoMiembroEmail").value="";
    if(document.getElementById("nuevoMiembroPass")) document.getElementById("nuevoMiembroPass").value="";

    toast("✅ Cuenta creada: "+nombre+" ("+etiquetaRol(rol)+")");
    renderEquipoAdmin();
  }catch(e){
    console.error(e);
    const msg=e.message||"";
    if(msg.includes("EMAIL_EXISTS")) toast("❌ Ese correo ya está registrado");
    else if(msg.includes("WEAK_PASSWORD")) toast("❌ Contraseña muy débil, mínimo 6 caracteres");
    else toast("❌ Error: "+msg);
  }finally{
    if(btn){btn.disabled=false;btn.textContent="➕ Crear cuenta";}
  }
}
async function crearInvitacion(email, rol){
  email=(email||"").toLowerCase().trim();
  if(!email||!email.includes("@")){toast("⚠️ Correo inválido");return;}
  if(!window.db||!window.auth?.currentUser){toast("❌ Sin conexión");return;}
  try{
    const negId=negocioId||window.auth.currentUser.uid;
    await window.fbSetDoc(window.fbDoc(window.db,"invitaciones_globales",email),{
      negocioId: negId, rol, creadoPor: window.auth.currentUser.uid, creadoEn: new Date().toISOString()
    });
    const negDocRef=window.fbDoc(window.db,"negocio_data",negId);
    const negSnap=await window.fbGetDoc(negDocRef);
    let equipo=(negSnap.exists()&&negSnap.data().equipo)?negSnap.data().equipo:[];
    const idx=equipo.findIndex(m=>(m.email||"").toLowerCase()===email);
    if(idx!==-1){equipo[idx].rol=rol;equipo[idx].activo=false;}
    else{equipo.push({uid:null,email,rol,nombre:email.split("@")[0],activo:false});}
    await window.fbSetDoc(negDocRef,{equipo},{merge:true});
    toast("✅ Invitación creada para "+email);
    renderEquipoAdmin();
  }catch(e){console.error(e);toast("❌ Error creando invitación");}
}
async function renderEquipoAdmin(){
  const cont=document.getElementById("listaEquipo");
  if(!cont)return;
  if(!window.db||!negocioId){cont.innerHTML='<div class="alert mid">Sin conexión</div>';return;}
  try{
    const snap=await window.fbGetDoc(window.fbDoc(window.db,"negocio_data",negocioId));
    const equipo=(snap.exists()&&snap.data().equipo)?snap.data().equipo:[];
    if(!equipo.length){cont.innerHTML='<div class="alert mid">Sin miembros invitados todavía</div>';return;}
    cont.innerHTML=equipo.map(m=>`
      <div class="item" style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:600;font-size:12px;">${m.activo?"✅":"⏳"} ${m.nombre||m.email}</div>
          <div class="small">${m.email} · ${etiquetaRol(m.rol)} ${m.activo?"":"(pendiente, falta que se registre)"}</div>
        </div>
        <button class="small-btn" onclick="eliminarMiembroEquipo('${m.email}')" style="background:rgba(239,68,68,.15);color:var(--bad);">🗑️</button>
      </div>`).join("");
  }catch(e){console.error(e);cont.innerHTML='<div class="alert mid">Error cargando equipo</div>';}
}
window.renderEquipoAdmin = renderEquipoAdmin;
async function eliminarMiembroEquipo(email){
  if(!confirm("¿Quitar a "+email+" del equipo? Ya no podrá entrar al negocio.")) return;
  try{
    try{await window.fbDeleteDoc(window.fbDoc(window.db,"invitaciones_globales",email));}catch(e){}
    const negDocRef=window.fbDoc(window.db,"negocio_data",negocioId);
    const snap=await window.fbGetDoc(negDocRef);
    let equipo=(snap.exists()&&snap.data().equipo)?snap.data().equipo:[];
    equipo=equipo.filter(m=>(m.email||"").toLowerCase()!==email.toLowerCase());
    await window.fbSetDoc(negDocRef,{equipo},{merge:true});
    toast("🗑️ Miembro eliminado");
    renderEquipoAdmin();
  }catch(e){console.error(e);toast("❌ Error eliminando miembro");}
}
function aplicarRestriccionesRol() {
  // ── Card equipo: solo admin ──
  const cardEquipo = document.getElementById("cardEquipo");
  if (cardEquipo) cardEquipo.style.display = esAdmin() ? "block" : "none";
  if (esAdmin()) renderEquipoAdmin();
  
  // ── Contexto personal: solo admin ──
const ctxWrap = document.querySelector(".ctx-wrap");
if (ctxWrap) ctxWrap.style.display = puedeVerModoPersonal() ? "flex" : "none";
if (!puedeVerModoPersonal() && contexto === "personal") {
  contexto = "negocio";
  localStorage.setItem("contexto", "negocio");
}
// Reconstruir nav con el rol ya cargado
actualizarNavNegocio();
  
  // ── Saldo top: ocultar si no puede ver dinero ──
  const saldoTop = document.getElementById("saldoTop");
  const streakBox = document.getElementById("streakBox");
  const headerIngresos = document.getElementById("headerIngresos");
  const headerGastos = document.getElementById("headerGastos");
  const headerHoy = document.getElementById("headerHoy");
  if (!puedeVerDinero()) {
  if (saldoTop) saldoTop.textContent = "🔒 Sin acceso";
  const elStreak = document.getElementById("streakBox");
  const elIng = document.getElementById("headerIngresos");
  const elGas = document.getElementById("headerGastos");
  const elHoy = document.getElementById("headerHoy");
  if (elStreak) elStreak.textContent = "—";
  if (elIng) elIng.textContent = "—";
  if (elGas) elGas.textContent = "—";
  if (elHoy) elHoy.textContent = "—";
  const headerIngresos = document.getElementById("headerIngresos");
  const headerGastos = document.getElementById("headerGastos");
  const headerHoy = document.getElementById("headerHoy");
  const headerBalance = document.getElementById("headerBalance") || document.querySelector(".balance-label") || null;
  if (headerIngresos) headerIngresos.textContent = "—";
  if (headerGastos) headerGastos.textContent = "—";
  if (headerHoy) headerHoy.textContent = "—";
    if (streakBox) streakBox.textContent = "—";
    if (headerIngresos) headerIngresos.textContent = "—";
    if (headerGastos) headerGastos.textContent = "—";
    if (headerHoy) headerHoy.textContent = "—";
  }
  
  // ── Nav: técnico → solo inventario y settings, reconstruir nav ──
if (esTecnico()) actualizarNavNegocio();
  
  // ── Contabilidad: ocultar tab home (finanzas personales) ──
  if (esContabilidad() && !esAdmin()) {
    // Puede ver todo excepto modo personal
    // El ctx-wrap ya lo manejamos arriba
  }
  
  // ── Badge de rol en header ──
  const userInfoBlock = document.getElementById("userInfoBlock");
  if (userInfoBlock && perfilUsuario) {
    const rolBadge = userInfoBlock.querySelector(".rol-badge-header");
    if (!rolBadge) {
      const badge = document.createElement("div");
      badge.className = "rol-badge-header";
      badge.style.cssText = "display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;margin-top:4px;background:rgba(59,130,246,.2);color:var(--primary);";
      badge.textContent = etiquetaRol(miRol);
      userInfoBlock.appendChild(badge);
    }
  }
  
  // ── Configuración de negocio y finanzas: ocultar para técnico ──
const cardConfigNegocio = document.getElementById("cardConfigNegocio");
if (cardConfigNegocio) cardConfigNegocio.style.display = esAdmin() ? "block" : "none";

// ── Tab quotes: técnico ve solo órdenes, contabilidad ve todo ──
const btnCot = document.getElementById("subtabBtnCotizaciones");
const btnFac = document.getElementById("subtabBtnFacturas");
const btnOrd = document.getElementById("subtabBtnOrdenes");
if (esTecnico()) {
  // Técnico: ocultar cotizaciones y facturas, solo órdenes
  if (btnCot) btnCot.style.display = "none";
  if (btnFac) btnFac.style.display = "none";
  if (btnOrd) btnOrd.style.display = "";
  document.querySelectorAll("#quotesSubTabs .tab-mini").forEach(t => t.classList.remove("active"));
  if (btnOrd) btnOrd.classList.add("active");
  const subCot = document.getElementById("subtab-cotizaciones");
  const subFac = document.getElementById("subtab-facturas");
  const subOrd = document.getElementById("subtab-ordenes");
  if (subCot) subCot.style.display = "none";
  if (subFac) subFac.style.display = "none";
  if (subOrd) subOrd.style.display = "block";
} else {
  // Admin y contabilidad: ver todo
  if (btnCot) btnCot.style.display = "";
  if (btnFac) btnFac.style.display = "";
  if (btnOrd) btnOrd.style.display = "";
}

// ── Tab inventario: técnico solo ve catálogo en lectura ──
const invTabCat = document.getElementById("invTabCatalogo");
const invTabProv = document.getElementById("invTabProveedores");
const invTabComp = document.getElementById("invTabCompras");
const btnNuevoProd = document.querySelector("#invsub-catalogo .primary");
const btnImportarTY2 = document.getElementById("btnImportarTY");
const btnAjusteStock = document.querySelector(".warn-btn[onclick='mostrarFormAjusteStock()']");

if (esTecnico()) {
  // Ocultar subtabs proveedores y compras — forzar catálogo
  if (invTabProv) invTabProv.style.display = "none";
  if (invTabComp) invTabComp.style.display = "none";
  if (invTabCat) invTabCat.style.display = "";
  document.querySelectorAll("#invSubTabs .tab-mini").forEach(t => t.classList.remove("active"));
  if (invTabCat) invTabCat.classList.add("active");
  // Mostrar solo el sub-panel catálogo
  document.querySelectorAll("#tab-inventario [id^='invsub-']").forEach(s => s.style.display = "none");
  const subCat = document.getElementById("invsub-catalogo");
  if (subCat) subCat.style.display = "block";
  // Ocultar botones de edición
  if (btnNuevoProd) btnNuevoProd.style.display = "none";
  if (btnImportarTY2) btnImportarTY2.style.display = "none";
  if (btnAjusteStock) btnAjusteStock.style.display = "none";
  const formProd = document.getElementById("formProducto");
  if (formProd) formProd.style.display = "none";
  const formAjuste = document.getElementById("formAjusteStock");
  if (formAjuste) formAjuste.style.display = "none";

  // ── Settings: técnico solo ve Mi cuenta y Tema ──
  const soloAdmin = ["cardConfigNegocio","cardEquipo","cardNotificaciones",
    "cardHistorialMeses","cardAdminHistorial","cardCuentas","cardCategorias",
    "cardManual","cardLimpiar","cardDiagnostico"];
  soloAdmin.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
  // Ocultar también el card de tema para que no quede visible al restaurar
  const cardTema = document.querySelector("#tab-settings .card:has(.title)");
} else {
  // Admin y contabilidad: ver todo en inventario
  if (invTabProv) invTabProv.style.display = "";
  if (invTabComp) invTabComp.style.display = "";
  if (invTabCat) invTabCat.style.display = "";
  if (btnNuevoProd) btnNuevoProd.style.display = "";
  if (btnImportarTY2) btnImportarTY2.style.display = "";
  if (btnAjusteStock) btnAjusteStock.style.display = "";
  // Restaurar todos los cards de settings
  const soloAdmin = ["cardConfigNegocio","cardEquipo","cardNotificaciones",
    "cardHistorialMeses","cardAdminHistorial","cardCuentas","cardCategorias",
    "cardManual","cardLimpiar","cardDiagnostico"];
  soloAdmin.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "";
  });
  // Re-aplicar restricción de cardConfigNegocio y cardEquipo solo para admin
  const cardConfigNegocio2 = document.getElementById("cardConfigNegocio");
if (cardConfigNegocio2) cardConfigNegocio2.style.display = "";
const cardEquipo2 = document.getElementById("cardEquipo");
if (cardEquipo2) cardEquipo2.style.display = esAdmin() ? "block" : "none";
}
}
function togglePassword(id, btn) {
          const input = document.getElementById(id);
          if (input.type === "password") {
              input.type = "text";
              btn.innerHTML = "👁️";
          } else {
              input.type = "password";
              btn.innerHTML = "👁️";
          }
      }
function abrirNuevaOrden(ordenData = null) {
  ordenEditandoId = ordenData ? ordenData.id : null;
  fotosOrdenActual = ordenData ? [...(ordenData.fotos || [])] : [];
  ordenProductoSeleccionadoId = ordenData?.productoId || null;
  
  $("ordenNumero").value = ordenData ? ordenData.numero : generarNumeroOrden();
    $("ordenClienteNombre").value = ordenData?.clienteNombre || "";
    $("ordenClienteTelefono").value = ordenData?.clienteTelefono || "";
    $("ordenMarca").value = ordenData?.marca || "";
    $("ordenModelo").value = ordenData?.modelo || "";
    $("ordenProblema").value = ordenData?.problema || "";
    $("ordenObservaciones").value = ordenData?.observaciones || "";
    const contExtra = $("camposOrdenExtraContainer");
if (contExtra) {
  const campos = configNegocio.camposOrdenExtra || [];
  contExtra.innerHTML = campos.map(c =>
    `<label>${c.label}</label><input type="text" id="ordenExtra_${c.id}" value="${(ordenData?.camposExtra?.[c.id] || "").replace(/"/g,'&quot;')}">`
  ).join("");
}
    $("ordenPrecioEstimado").value = ordenData?.precioEstimado ? Number(ordenData.precioEstimado).toLocaleString("es-CO") : "";
    $("ordenEstado").value = ordenData?.estado || "recibido";
  $("ordenGarantiaDias").value = ordenData?.garantiaDias ?? 30;

renderFotosOrdenPreview();
if ($("buscarProdOrden")) $("buscarProdOrden").value = "";
$("modalOrden").classList.add("open");
}
function cambiarEstadoOrden(id, nuevoEstado) {
    const orden = ordenes.find(o => o.id === id);
    if (!orden) return;
  
    if (nuevoEstado === "entregado") {
      abrirModalEntregaOrden(id);
      return;
    }
  
    orden.estado = nuevoEstado;
  orden.actualizadoEn = new Date().toISOString();
  if (!orden.historialEstados) orden.historialEstados = [];
  orden.historialEstados.push({ estado: nuevoEstado, fecha: new Date().toISOString(), nota: "Cambio automático" });
  guardarOrdenesNegocio();
  renderListaOrdenes();
  toast("✔ Estado actualizado: " + nuevoEstado);
  }
function abrirModalEntregaOrden(id) {
    const orden = ordenes.find(o => o.id === id);
    if (!orden) return;
    ordenEditandoId = id;
    $("entregaPrecioFinal").value = orden.precioEstimado ? Number(orden.precioEstimado).toLocaleString("es-CO") : "";
    $("modalEntregaOrden").classList.add("open");
  }
function confirmarEntregaOrden() {
    const orden = ordenes.find(o => o.id === ordenEditandoId);
    if (!orden) { toast("❌ Orden no encontrada"); return; }
    let precioFinal = parseMonto($("entregaPrecioFinal").value);
    if (orden.esGarantiaSinCobro) precioFinal = 0;
    else if (precioFinal <= 0) { toast("Ingresa el precio final cobrado"); return; }
    
    orden.estado = "entregado";
orden.precioFinal = precioFinal;
orden.actualizadoEn = new Date().toISOString();
orden.fechaEntrega = fechaHoyColombia();

if (orden.productoId && !orden.stockDescontado) {
  registrarMovimientoStock(orden.productoId, "salida", 1, "Entrega orden " + orden.numero, orden.id);
  orden.stockDescontado = true;
  renderListaCatalogo();
}

if (precioFinal > 0) {
      const factura = {
        id: "fact_" + Date.now(),
        numero: generarNumeroFactura(),
        cotizacionId: null,
        ordenId: orden.id,
        clienteId: null,
        clienteNombre: orden.clienteNombre,
        clienteEmpresa: "",
        clienteNIT: "",
        clienteEmail: "",
        productos: [{
          productoId: null,
          codigo: orden.numero,
          nombre: "Reparación " + orden.marca + " " + (orden.modelo || ""),
          descripcion: orden.problema,
          precioUnitario: precioFinal,
          iva: 0,
          cantidad: 1,
          descuento: 0
        }],
        subtotal: precioFinal,
        iva: 0,
        total: precioFinal,
        estado: "pendiente",
        fecha: fechaHoyColombia(),
        fechaPago: null,
        cuentaPago: null,
        movimientoId: null,
        firmaCliente: null,
        firmaEncargado: null,
        createdAt: new Date().toISOString()
      };
      facturas.push(factura);
      orden.facturaId = factura.id;
      guardarDatosNegocio();
      toast("✅ Equipo entregado — factura " + factura.numero + " generada");
    } else {
      toast("🛡️ Equipo entregado bajo garantía — sin cobro ni factura");
    }
    
    guardarOrdenesNegocio();
    $("modalEntregaOrden").classList.remove("open");
    ordenEditandoId = null;
    renderListaOrdenes();
    renderListaFacturas();
  }
function eliminarOrden(id) {
    if (!confirm("¿Eliminar esta orden de trabajo?")) return;
    ordenes = ordenes.filter(o => o.id !== id);
    guardarOrdenesNegocio();
    renderListaOrdenes();
    toast("🗑️ Orden eliminada");
  }
function reclamarGarantia(id) {
    const orig = ordenes.find(o => o.id === id);
    if (!orig) { toast("❌ Orden no encontrada"); return; }
    const dias = Math.floor((new Date() - new Date(orig.fechaEntrega + "T00:00:00")) / 86400000);
const limite = orig.garantiaDias ?? 30;
if (dias > limite) {
  toast("❌ La garantía venció hace " + (dias - limite) + " día" + ((dias - limite) !== 1 ? "s" : ""));
  return;
}
if (!confirm(`🛡️ Dentro de garantía (${dias}/${limite} días). ¿Crear orden de garantía sin cobro?`)) return;
    const nueva = {
      id: "orden_" + Date.now(),
      numero: generarNumeroOrden(),
      clienteNombre: orig.clienteNombre,
      clienteTelefono: orig.clienteTelefono,
      marca: orig.marca, modelo: orig.modelo || "",
      problema: "🛡️ GARANTÍA — " + orig.problema,
  observaciones: "Reclamo de garantía de orden " + orig.numero + " (entregada " + orig.fechaEntrega + ")",
      precioEstimado: 0, precioFinal: null,
      estado: "recibido", fotos: [], facturaId: null,
      garantiaDias: orig.garantiaDias ?? 30,
      ordenOrigenGarantiaId: orig.id,
      esGarantiaSinCobro: true,
      fecha: fechaHoyColombia(), createdAt: new Date().toISOString(), actualizadoEn: new Date().toISOString()
    };
    ordenes.push(nueva);
    guardarOrdenesNegocio();
    renderListaOrdenes();
    toast("✅ Orden de garantía creada: " + nueva.numero);
  }
function filtrarOrdenes(filtro, btn) {
    ordenFiltroActual = filtro;
    document.querySelectorAll("#subtab-ordenes .tab-mini").forEach(t => t.classList.remove("active"));
    if (btn) btn.classList.add("active");
    renderListaOrdenes();
  }
function renderListaOrdenes() {
    const cont = $("listaOrdenes");
    if (!cont) return;
    
    let filtradas = ordenes;
    if (ordenFiltroActual !== "todas") {
      filtradas = ordenes.filter(o => o.estado === ordenFiltroActual);
    }
    const busq = ($("searchOrden")?.value || "").toLowerCase().trim();
    if (busq) {
      filtradas = filtradas.filter(o =>
        o.numero?.toLowerCase().includes(busq) ||
        o.clienteNombre?.toLowerCase().includes(busq) ||
        o.marca?.toLowerCase().includes(busq) ||
        o.modelo?.toLowerCase().includes(busq)
      );
    }
    
    filtradas.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const hoyMs = new Date();
    
    if (filtradas.length === 0) {
      cont.innerHTML = '<div class="alert mid">No hay órdenes de trabajo</div>';
      return;
    }
    
    cont.innerHTML = filtradas.map(o => {
      const est = ESTADOS_ORDEN[o.estado] || ESTADOS_ORDEN.recibido;
      const siguienteEstado = { recibido: "diagnostico", diagnostico: "en_reparacion", en_reparacion: "listo", listo: "entregado" } [o.estado];
      const diasDesdeEntrega = o.fechaEntrega ? Math.floor((new Date() - new Date(o.fechaEntrega + "T00:00:00")) / 86400000) : null;
      const garantiaVencida = diasDesdeEntrega !== null && diasDesdeEntrega > (o.garantiaDias ?? 30);
      return `
        <div class="quote-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-weight:700;font-size:14px;">${o.numero}</span>
            <span class="quote-status" style="background:${est.color}22;color:${est.color};">${est.label}</span>
          </div>
          <div style="font-size:12px;margin-bottom:2px;">👤 ${o.clienteNombre} ${o.clienteTelefono ? '· 📞 ' + o.clienteTelefono : ''}</div>
          <div style="font-size:12px;margin-bottom:4px;color:var(--muted);">📱 ${o.marca} ${o.modelo || ''} — ${o.problema}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:700;font-size:14px;color:var(--ok);">${o.precioFinal ? money(o.precioFinal) : (o.precioEstimado ? 'Est: ' + money(o.precioEstimado) : 'Sin precio')}</span>
            <span class="small">${o.fecha}</span>
          </div>
          <div style="display:flex;gap:4px;margin-top:8px;flex-wrap:wrap;">
            <button class="small-btn" onclick="verOrden('${o.id}')">👁 Ver</button>
  <button class="small-btn" onclick="verHistorialOrden('${o.id}')" style="background:rgba(139,92,246,.15);color:#a78bfa;">📋 Log</button>
            <button class="small-btn success-btn" onclick="generarReciboOrdenPDF('${o.id}')">📄 Recibo</button>
            ${siguienteEstado ? `<button class="small-btn warn-btn" onclick="cambiarEstadoOrden('${o.id}','${siguienteEstado}')">➡️ ${ESTADOS_ORDEN[siguienteEstado].label}</button>` : ''}
            ${(o.facturaId && !esTecnico()) ? `<button class="small-btn" style="background:rgba(34,197,94,.15);color:var(--ok);" onclick="switchQuotesSubTab('facturas',null);document.querySelectorAll('.tab-mini')[1]?.click();">🧾 Ver factura</button>` : ''}
  ${o.estado === "entregado" ? (garantiaVencida
    ? `<button class="small-btn" disabled title="Garantía vencida (${diasDesdeEntrega}/${o.garantiaDias ?? 30} días)" style="background:rgba(148,163,184,.15);color:var(--muted);cursor:not-allowed;opacity:.6;">🛡️ Garantía vencida</button>`
    : `<button class="small-btn" style="background:rgba(34,197,94,.15);color:var(--ok);" onclick="reclamarGarantia('${o.id}')">🛡️ Garantía</button>`
  ) : '' }
  <button class="small-btn" onclick="enviarWhatsAppOrden('${o.id}')" style="background:rgba(34,197,94,.15);color:#25d366;">📲 WA</button>
  <button class="small-btn" onclick="eliminarOrden('${o.id}')" style="background:rgba(239,68,68,.15);color:var(--bad);">🗑️</button> </div> </div>
  `;
    }).join("");
  }
window.renderListaOrdenes = renderListaOrdenes;
function abrirModalClientes() {
        renderListaClientes();
        $("modalClientes").classList.add("open");
        $("formCliente").style.display = "none";
      }
function renderListaClientes() {
    const cont = $("listaClientesModal");
    if (!cont) return;
    if (clientes.length === 0) {
      cont.innerHTML = '<div class="alert mid">No hay clientes registrados</div>';
      return;
    }
    cont.innerHTML = clientes.map((c) => `
      <div class="item" style="display:flex;justify-content:space-between;align-items:center;">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:13px;">${c.nombre}</div>
          <div class="small">${c.empresa||'Sin empresa'} ${c.nit?'· NIT: '+c.nit:''}</div>
          <div class="small">${c.email||''} ${c.telefono||''}</div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0;">
          <button class="small-btn warn-btn" onclick="seleccionarClienteCot('${c.id}')" style="font-size:9px;">✅</button>
          <button class="small-btn" onclick="abrirEditarCliente('${c.id}')" style="font-size:9px;background:rgba(245,158,11,.15);color:var(--warn);">✏️</button>
          <button class="small-btn" onclick="eliminarCliente('${c.id}')" style="font-size:9px;background:rgba(239,68,68,.15);color:var(--bad);">🗑️</button>
        </div>
      </div>
    `).join("");
  }
function cancelarFormCliente() {
    delete $("formCliente").dataset.editandoId;
    ["clienteNombre","clienteEmpresa","clienteNIT",
     "clienteEmail","clienteTelefono","clienteDireccion"]
      .forEach(id => { const el = $(id); if(el) el.value = ""; });
    $("formCliente").querySelector("button.primary").textContent = "💾 Guardar Cliente";
    $("formCliente").style.display = "none";
  }
function eliminarCliente(id) {
        if (!confirm("¿Eliminar este cliente?")) return;
        clientes = clientes.filter(c => c.id !== id);
        guardarDatosNegocio();
        renderListaClientes();
        poblarSelectClientes();
        toast("🗑️ Cliente eliminado");
      }
function abrirEditarCliente(id) {
    const c = clientes.find(x => x.id === id);
    if (!c) return;
    $("formCliente").style.display = "block";
    $("clienteNombre").value    = c.nombre    || "";
    $("clienteEmpresa").value   = c.empresa   || "";
    $("clienteNIT").value       = c.nit       || "";
    $("clienteEmail").value     = c.email     || "";
    $("clienteTelefono").value  = c.telefono  || "";
    $("clienteDireccion").value = c.direccion || "";
    $("formCliente").dataset.editandoId = id;
    $("formCliente").querySelector("button.primary").textContent = "💾 Actualizar Cliente";
  }
function poblarSelectClientes() {
        const sel = $("cotCliente");
        if (!sel) return;
        sel.innerHTML = '<option value="">Seleccionar cliente...</option>';
        clientes.forEach(c => {
          sel.innerHTML += `<option value="${c.id}">${c.nombre} ${c.empresa?'- '+c.empresa:''}</option>`;
        });
      }
function abrirModalCatalogo() {
        renderListaCatalogo();
        $("modalCatalogo").classList.add("open");
        $("formProducto").style.display = "none";
        delete $("formProducto").dataset.editandoId;
        $("formProducto").querySelector("button.primary").textContent = "💾 Guardar Producto";
      }
let _renderCatalogoTimer = null;
function renderListaCatalogo() {
  // Debounce: evita renders en cascada cuando Firebase dispara múltiples updates
  clearTimeout(_renderCatalogoTimer);
  _renderCatalogoTimer = setTimeout(_renderListaCatalogoReal, 80);
}
function _renderListaCatalogoReal() {
  const cont = $("listaCatalogoModal");
  if (!cont) return;

  if (catalogo.length === 0) {
    cont.innerHTML = '<div class="alert mid">No hay productos en el catálogo</div>';
    actualizarKpisInventario();
    return;
  }

  const busq = ($("buscarCatalogoModal")?.value || $("buscarCatalogoInv")?.value || "").toLowerCase().trim();
  let filtrados = catalogo;

  if (busq) {
    filtrados = catalogo.filter(p =>
      (p.nombre || "").toLowerCase().includes(busq) ||
      (p.codigo || "").toLowerCase().includes(busq) ||
      (p.descripcion || "").toLowerCase().includes(busq) ||
      (p.categoria || "").toLowerCase().includes(busq)
    );
  }

  if (filtroCatalogoActual === "bajo") {
    filtrados = filtrados.filter(p => (p.stockMinimo || 0) > 0 && (p.stock || 0) > 0 && (p.stock || 0) <= (p.stockMinimo || 0));
  } else if (filtroCatalogoActual === "sin") {
    filtrados = filtrados.filter(p => (p.stock || 0) <= 0);
  }

  const cEl = $("catalogoCount");
  if (cEl) cEl.innerText = filtrados.length + " de " + catalogo.length + " producto(s)";

  if (filtrados.length === 0) {
    cont.innerHTML = '<div class="alert mid">Sin resultados</div>';
    actualizarKpisInventario();
    return;
  }

  // Paginación: mostrar solo los primeros 50 para no congelar el DOM
  const PAGINA = 50;
  const pagActual = cont._pagina || 0;
  const slice = filtrados.slice(0, PAGINA * (pagActual + 1));
  const hayMas = slice.length < filtrados.length;

  cont.innerHTML = slice.map((p) => {
    const stock = p.stock ?? null;
    const stockMin = p.stockMinimo || 0;
    let stockBadge = "";
    if (stock !== null) {
      let color = "var(--ok)", icono = "✅";
      if (stock <= 0) { color = "var(--bad)"; icono = "🚫"; }
      else if (stockMin > 0 && stock <= stockMin) { color = "var(--warn)"; icono = "⚠️"; }
      stockBadge = `<span class="badge" style="background:${color}22;color:${color};">${icono} Stock: ${stock}${stockMin > 0 ? ' / mín ' + stockMin : ''}</span>`;
    }
    return `
      <div class="item" style="display:flex;justify-content:space-between;align-items:center;">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:13px;">${p.codigo ? '[' + p.codigo + '] ' : ''}${p.nombre} ${stockBadge}</div>
          <div class="small">${p.descripcion || ''} | Precio: ${money(p.precio)} | IVA: ${p.iva}%</div>
          ${!esTecnico() ? `<div class="small" style="color:${(p.precio || 0) - (p.costo || 0) >= 0 ? 'var(--ok)' : 'var(--bad)'}">Costo: ${money(p.costo || 0)} · Margen: ${money((p.precio || 0) - (p.costo || 0))} (${p.costo > 0 ? (((p.precio - p.costo) / p.precio) * 100).toFixed(0) : 100}%)</div>` : ''}
          <div class="small">Cat: ${p.categoria || 'General'}</div>
        </div>
        ${!esTecnico() ? `
        <div style="display:flex;gap:4px;flex-shrink:0;">
          <button class="small-btn warn-btn" onclick="abrirEditarProducto('${p.id}')" style="font-size:9px;">✏️</button>
          <button class="small-btn" onclick="eliminarProducto('${p.id}')" style="font-size:9px;background:rgba(239,68,68,.15);color:var(--bad);">🗑️</button>
        </div>` : ''}
      </div>
    `;
  }).join("");

  if (hayMas) {
    cont.innerHTML += `<button class="secondary" style="width:100%;margin-top:8px;font-size:12px;" 
      onclick="(function(el){ el._pagina=(el._pagina||0)+1; window._renderListaCatalogoReal(); })(document.getElementById('listaCatalogoModal'))">
      ➕ Ver más (${filtrados.length - slice.length} restantes)
    </button>`;
  }

  actualizarKpisInventario();
}
window._renderListaCatalogoReal = _renderListaCatalogoReal;
function mostrarFormProducto() {
  delete $("formProducto").dataset.editandoId;
  $("formProducto").querySelector("button.primary").textContent = "💾 Guardar Producto";
  $("prodIVA").value = "19";
  $("formProducto").style.display = "block";
  ["prodCodigo", "prodNombre", "prodDescripcion", "prodPrecio", "prodCosto", "prodCategoria", "prodStock", "prodStockMin"].forEach(id => {
    const el = $(id);
    if (el) el.value = "";
  });
}
function eliminarProducto(id) {
    if (!confirm("¿Eliminar este producto?")) return;
    catalogo = catalogo.filter(p => p.id !== id);
    guardarCatalogoNegocio();
    renderListaCatalogo();
    toast("🗑️ Producto eliminado");
  }
function abrirEditarProducto(id) {
  const p = catalogo.find(x => x.id === id);
  if (!p) return;
  // Reutilizar el formProducto existente con datos precargados
  $("formProducto").style.display = "block";
  $("prodCodigo").value = p.codigo || "";
  $("prodNombre").value = p.nombre || "";
  $("prodDescripcion").value = p.descripcion || "";
  $("prodPrecio").value = p.precio || "";
  $("prodIVA").value = p.iva ?? 19;
  $("prodCosto").value = p.costo || "";
  $("prodCategoria").value = p.categoria || "";
  $("prodStock").value = p.stock ?? 0;
  $("prodStockMin").value = p.stockMinimo ?? 0;
  // Guardar ID editando
  $("formProducto").dataset.editandoId = id;
  // Cambiar texto del botón
  $("formProducto").querySelector("button.primary").textContent = "💾 Actualizar Producto";
  $("formProducto").scrollIntoView({ behavior: "smooth", block: "start" });
}
function abrirNuevaCotizacion(cotData = null) {
        productosCotActual = cotData ? [...(cotData.productos||[])] : [];
        cotEditandoId = cotData ? cotData.id : null;
        poblarSelectClientes();
        // Al inicio de abrirNuevaCotizacion, después de poblarSelectClientes():
  if ($("buscarClienteCot")) $("buscarClienteCot").value = "";
  if ($("listaChipsClientes")) $("listaChipsClientes").style.display = "none";
  const selDiv = $("clienteSeleccionado");
  if (selDiv) selDiv.style.display = "none";
  if ($("cotCliente")) $("cotCliente").value = "";
  
  // Si cotData tiene cliente, precargarlo:
  if (cotData && cotData.clienteId) {
    elegirCliente(cotData.clienteId);
  }
        if (cotData) {
          if ($("cotCliente")) $("cotCliente").value = cotData.clienteId || "";
          if ($("cotValidez")) $("cotValidez").value = cotData.validez || "15 días";
          if ($("cotNumero")) $("cotNumero").value = cotData.numero || "";
          if ($("cotNotas")) $("cotNotas").value = cotData.notas || "";
        } else {
          if ($("cotCliente")) $("cotCliente").value = "";
          if ($("cotValidez")) $("cotValidez").value = "15 días";
          if ($("cotNumero")) $("cotNumero").value = generarNumeroCot();
          if ($("cotNotas")) $("cotNotas").value = "";
        }
        renderProductosCotizacion();
        actualizarTotalesCot();
        $("modalCotizacion").classList.add("open");
      }
function agregarProductoCotizacion() {
    if (catalogo.length === 0) {
      toast("📦 Primero agrega productos al catálogo");
      abrirModalCatalogo();
      return;
    }
  
    // Cerrar modal de cotización temporalmente
    document.getElementById("modalCotizacion").classList.remove("open");
  
    function renderItems(q) {
      const query = (q || "").toLowerCase().trim();
      const items = query
        ? catalogo.filter(p =>
            p.nombre.toLowerCase().includes(query) ||
            (p.codigo||"").toLowerCase().includes(query) ||
            (p.descripcion||"").toLowerCase().includes(query) ||
            (p.categoria||"").toLowerCase().includes(query)
          )
        : catalogo;
      const lista = document.getElementById("_prodSearchList");
      const counter = document.getElementById("_prodCount");
      if (counter) counter.innerText = items.length + " producto(s)";
      if (!lista) return;
      lista.innerHTML = items.length === 0
        ? '<div class="alert mid">Sin resultados</div>'
        : items.map(p => `
            <div class="item" style="cursor:pointer;margin-bottom:6px;padding:10px;"
              onclick="agregarProdACot('${p.id}')">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                <div>
                  <div style="font-weight:700;font-size:13px;">${p.codigo ? '['+p.codigo+'] ' : ''}${p.nombre}</div>
                  <div class="small">${p.descripcion||p.categoria||''} · IVA ${p.iva}%</div>
                </div>
                <div style="font-weight:800;color:var(--ok);white-space:nowrap;">${money(p.precio)}</div>
              </div>
            </div>`).join('');
    }
  
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay open";
    overlay.id = "modalSelProd";
    overlay.style.zIndex = "3000";
    overlay.onclick = e => { if (e.target === overlay) { overlay.remove(); document.getElementById("modalCotizacion").classList.add("open"); } };
    overlay.innerHTML = `
      <div class="modal" style="max-width:460px;width:90%;padding:16px;">
        <h3 style="margin-bottom:10px;">📦 Seleccionar Producto</h3>
        <div style="position:relative;margin-bottom:8px;">
          <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none;">🔍</span>
          <input id="_buscarProd" type="text" placeholder="Buscar por nombre, código..."
            style="padding-left:34px;margin-bottom:0;"
            oninput="(function(el){ window._renderProdItems(el.value); })(this)">
        </div>
        <div class="small" id="_prodCount" style="margin-bottom:6px;">${catalogo.length} producto(s)</div>
        <div id="_prodSearchList" style="max-height:50vh;overflow-y:auto;"></div>
        <button class="secondary" onclick="document.getElementById('modalSelProd').remove();document.getElementById('modalCotizacion').classList.add('open')" style="margin-top:10px;">Cancelar</button>
      </div>`;
    document.body.appendChild(overlay);
  
    window._renderProdItems = renderItems;
    renderItems("");
    setTimeout(() => { const i = document.getElementById("_buscarProd"); if(i) i.focus(); }, 100);
  }
function agregarProdACot(prodId) {
    const producto = catalogo.find(p => p.id === prodId);
    if (!producto) return;
    const existente = productosCotActual.find(p => p.productoId === prodId);
    if (existente) {
      existente.cantidad++;
    } else {
      productosCotActual.push({
        productoId: producto.id,
        codigo: producto.codigo,
        nombre: producto.nombre,
        descripcion: producto.descripcion,
        precioUnitario: producto.precio,
        iva: producto.iva,
        cantidad: 1,
        descuento: 0
      });
    }
    const modal = document.getElementById('modalSelProd');
    if (modal) modal.remove();
    document.getElementById("modalCotizacion").classList.add("open");
    renderProductosCotizacion();
    actualizarTotalesCot();
    toast("✅ Producto agregado");
  }
function renderProductosCotizacion() {
        const cont = $("cotProductosLista");
        if (!cont) return;
        if (productosCotActual.length === 0) {
          cont.innerHTML = '<div class="alert mid">Sin productos agregados</div>';
          return;
        }
        cont.innerHTML = productosCotActual.map((p, i) => `
          <div style="background:var(--cardBg);border:1px solid var(--line);border-radius:12px;padding:10px;margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
              <div style="font-weight:700;font-size:12px;flex:1;padding-right:8px;">${p.nombre}</div>
              <button class="small-btn" onclick="eliminarProductoCot(${i})" style="font-size:9px;padding:4px 8px;background:rgba(239,68,68,.15);color:var(--bad);flex-shrink:0;">✕</button>
            </div>
            <div class="grid2" style="gap:6px;margin-bottom:6px;">
              <div>
                <div style="font-size:10px;color:var(--muted);margin-bottom:3px;">Precio unit.</div>
                <input type="text" value="${Number(p.precioUnitario).toLocaleString('es-CO')}" 
                  style="width:100%;padding:5px 7px;font-size:12px;margin:0;text-align:right;"
                  oninput="editarPrecioCot(${i}, this.value)"
                  onblur="this.value=Number(productosCotActual[${i}]?.precioUnitario||0).toLocaleString('es-CO')">
              </div>
              <div>
                <div style="font-size:10px;color:var(--muted);margin-bottom:3px;">Cantidad</div>
                <input type="number" value="${p.cantidad}" min="1"
                  style="width:100%;padding:5px 7px;font-size:12px;margin:0;text-align:center;"
                  onchange="cambiarCantidadCot(${i}, this.value)">
              </div>
              <div>
                <div style="font-size:10px;color:var(--muted);margin-bottom:3px;">Descuento $</div>
                <input type="text" value="${Number(p.descuento||0).toLocaleString('es-CO')}"
                  style="width:100%;padding:5px 7px;font-size:12px;margin:0;text-align:right;"
                  oninput="editarDescuentoCot(${i}, this.value)"
                  onblur="this.value=Number(productosCotActual[${i}]?.descuento||0).toLocaleString('es-CO')">
              </div>
              <div>
                <div style="font-size:10px;color:var(--muted);margin-bottom:3px;">IVA %</div>
                <select style="width:100%;padding:5px 7px;font-size:12px;margin:0;" onchange="editarIVACot(${i}, this.value)">
                  <option value="0" ${p.iva==0?'selected':''}>0%</option>
                  <option value="5" ${p.iva==5?'selected':''}>5%</option>
                  <option value="19" ${p.iva==19?'selected':''}>19%</option>
                </select>
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding-top:6px;border-top:1px solid var(--line);">
              <span style="font-size:10px;color:var(--muted);">Subtotal${p.descuento>0?' (con desc.)':''}</span>
              <span style="font-weight:800;font-size:13px;color:var(--ok);">${money((p.precioUnitario * p.cantidad) - (p.descuento||0))}</span>
            </div>
          </div>
        `).join("");
      }
function cambiarCantidadCot(index, cantidad) {
  const cant = parseInt(cantidad) || 1;
  if (cant < 1) return;
  productosCotActual[index].cantidad = cant;
  renderProductosCotizacion();
  actualizarTotalesCot();
}
function editarIVACot(index, valor) {
  const p = productosCotActual[index];
  if (!p) return;
  p.iva = parseInt(valor) || 0;
  renderProductosCotizacion();
  actualizarTotalesCot();
}
function eliminarProductoCot(index) {
        productosCotActual.splice(index, 1);
        renderProductosCotizacion();
        actualizarTotalesCot();
      }
function renderizarConCanvas(preview) {
        const temp = document.createElement("div");
        temp.style.cssText = `position:absolute;top:-9999px;left:0;width:794px;background:#ffffff;color:#000000;font-family:Arial,sans-serif;font-size:12px;padding:20px;`;
        temp.innerHTML = preview.innerHTML
          .replace(/var\(--ok\)/g, "#16a34a")
          .replace(/var\(--bad\)/g, "#dc2626")
          .replace(/var\(--warn\)/g, "#d97706")
          .replace(/var\(--primary\)/g, "#2563eb")
          .replace(/var\(--muted\)/g, "#475569")
          .replace(/var\(--text\)/g, "#0f172a");
        document.body.appendChild(temp);
      
        html2canvas(temp, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false, width: 794 })
          .then(canvas => {
            document.body.removeChild(temp);
            const canvasEl = document.getElementById("_canvasPDF");
            if (!canvasEl) return;
            canvasEl.width = canvas.width;
            canvasEl.height = canvas.height;
            const ctx = canvasEl.getContext("2d");
            ctx.drawImage(canvas, 0, 0);
            canvasEl.style.width = "100%";
            canvasEl.style.height = "auto";
            window._pdfImageData = canvas.toDataURL("image/jpeg", 0.95);
            toast("✅ Listo — toca Compartir para guardar");
          })
          .catch(() => {
            document.body.removeChild(temp);
            usarFallbackHTML(preview);
          });
      }
function usarFallbackHTML(preview) {
        const canvas = document.getElementById("_canvasPDF");
        const fallback = document.getElementById("_fallbackPDF");
        if (canvas) canvas.style.display = "none";
        if (fallback) {
          fallback.style.display = "block";
          fallback.innerHTML = preview.innerHTML
            .replace(/var\(--ok\)/g, "#16a34a")
            .replace(/var\(--bad\)/g, "#dc2626")
            .replace(/var\(--warn\)/g, "#d97706");
          toast("✅ Usa Compartir para guardar");
        }
      }
function filtrarCotizaciones(filtro, btn) {
        cotFiltroActual = filtro;
        document.querySelectorAll("#tab-quotes .tab-mini").forEach(t => t.classList.remove("active"));
        if (btn) btn.classList.add("active");
        renderListaCotizaciones();
      }
function renderListaCotizaciones() {
        const cont = $("listaCotizaciones");
        if (!cont) return;
        
        let filtradas = cotizaciones;
      if (cotFiltroActual !== "todas") {
        filtradas = cotizaciones.filter(c => c.estado === cotFiltroActual);
      }
      const busqCot = (document.getElementById("searchCot")?.value || "").toLowerCase().trim();
      if (busqCot) {
        filtradas = filtradas.filter(c =>
          c.numero?.toLowerCase().includes(busqCot) ||
          c.clienteNombre?.toLowerCase().includes(busqCot) ||
          c.clienteEmpresa?.toLowerCase().includes(busqCot) ||
          String(c.total || "").includes(busqCot)
        );
      }
        
        filtradas.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        if (filtradas.length === 0) {
          cont.innerHTML = '<div class="alert mid">No hay cotizaciones</div>';
          return;
        }
        
        cont.innerHTML = filtradas.map(c => `
          <div class="quote-card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <span style="font-weight:700;font-size:14px;">${c.numero}</span>
              <span class="quote-status ${c.estado}">${c.estado.toUpperCase()}</span>
            </div>
            <div style="font-size:12px;margin-bottom:4px;">👤 ${c.clienteNombre} ${c.clienteEmpresa?'· '+c.clienteEmpresa:''}</div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-weight:700;font-size:15px;color:var(--ok);">${money(c.total)}</span>
              <span class="small">${c.fecha}</span>
            </div>
            <div style="display:flex;gap:4px;margin-top:8px;">
              <button class="small-btn" onclick="verCotizacion('${c.id}')">👁 Ver</button>
              <button class="small-btn success-btn" onclick="generarPDFDesdeLista('${c.id}')">📄 PDF</button>
              ${c.estado === 'borrador' ? `<button class="small-btn warn-btn" onclick="cambiarEstadoCot('${c.id}','enviada')">📤 Enviar</button>` : ''}
              ${c.estado === 'enviada' ? `<button class="small-btn success-btn" onclick="cambiarEstadoCot('${c.id}','aprobada')">✅ Aprobar</button>` : ''}
              <button class="small-btn" onclick="duplicarCotizacion('${c.id}')" style="background:rgba(139,92,246,.15);color:#a78bfa;">📋 Clonar</button>
        <button class="small-btn" onclick="eliminarCotizacion('${c.id}')" style="background:rgba(239,68,68,.15);color:var(--bad);">🗑️</button>
            </div>
          </div>
        `).join("");
      }
function cambiarEstadoCot(id, nuevoEstado) {
  const cot = cotizaciones.find(c => c.id === id);
  if (!cot) return;
  cot.estado = nuevoEstado;
  guardarDatosNegocio();
  renderListaCotizaciones();
  toast("✅ Estado actualizado: " + nuevoEstado);
  if (nuevoEstado === "aprobada") {
    if (!cot.stockDescontado) {
      (cot.productos || []).forEach(p => {
        if (p.productoId) registrarMovimientoStock(p.productoId, "salida", p.cantidad, "Venta cotización " + cot.numero, cot.id);
      });
      cot.stockDescontado = true;
      guardarDatosNegocio();
      renderListaCatalogo();
    }
    convertirCotizacionAFactura(cot);
    renderListaFacturas();
  }
}
function eliminarCotizacion(id) {
        if (!confirm("¿Eliminar esta cotización?")) return;
        cotizaciones = cotizaciones.filter(c => c.id !== id);
        guardarDatosNegocio();
        renderListaCotizaciones();
        toast("🗑️ Cotización eliminada");
      }
function renderListaFacturas() {
        const cont = $("listaFacturas");
        if (!cont) return;
        let filtradas = facturas;
        if (facFiltroActual !== "todas") filtradas = facturas.filter(f => f.estado === facFiltroActual);
        filtradas.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        if (filtradas.length === 0) { cont.innerHTML = '<div class="alert mid">No hay facturas</div>'; return; }
        cont.innerHTML = filtradas.map(f => `
          <div class="quote-card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <span style="font-weight:700;font-size:14px;">${f.numero}</span>
              <span class="quote-status ${f.estado === 'pagada' ? 'aprobada' : 'enviada'}">${f.estado === 'pagada' ? '✅ PAGADA' : '⏳ SE DEBE'}</span>
            </div>
            <div style="font-size:12px;margin-bottom:4px;">👤 ${f.clienteNombre} ${f.clienteEmpresa ? '· ' + f.clienteEmpresa : ''}</div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-weight:700;font-size:15px;color:var(--ok);">${money(f.total)}</span>
              <span class="small">${f.fecha}</span>
            </div>
            <div style="display:flex;gap:4px;margin-top:8px;flex-wrap:wrap;">
              <button class="small-btn" onclick="verFacturaPDF('${f.id}')">📄 PDF</button>
              <button class="small-btn" onclick="abrirModalFirma('${f.id}','cliente')" style="background:${f.firmaCliente ? 'rgba(34,197,94,.15)' : 'rgba(245,158,11,.15)'};color:${f.firmaCliente ? 'var(--ok)' : 'var(--warn)'};">✍️ Cliente</button>
              <button class="small-btn" onclick="abrirModalFirma('${f.id}','encargado')" style="background:${f.firmaEncargado ? 'rgba(34,197,94,.15)' : 'rgba(245,158,11,.15)'};color:${f.firmaEncargado ? 'var(--ok)' : 'var(--warn)'};">✍️ Encargado</button>
              ${f.estado === 'pendiente'
                ? `<button class="small-btn success-btn" onclick="abrirModalPagoFactura('${f.id}')">💰 Marcar pagada</button>`
                : `<button class="small-btn warn-btn" onclick="marcarFacturaPendiente('${f.id}')">↩️ Revertir</button>`}
              <button class="small-btn" onclick="eliminarFactura('${f.id}')" style="background:rgba(239,68,68,.15);color:var(--bad);">🗑️</button>
            </div>
          </div>
        `).join("");
      }
function filtrarFacturas(filtro, btn) {
        facFiltroActual = filtro;
        document.querySelectorAll("#subtab-facturas .tab-mini").forEach(t => t.classList.remove("active"));
        if (btn) btn.classList.add("active");
        renderListaFacturas();
      }
function switchQuotesSubTab(tab, btn) {
  document.querySelectorAll("#quotesSubTabs .tab-mini").forEach(t => t.classList.remove("active"));
  if (btn) btn.classList.add("active");
  $("subtab-cotizaciones").style.display = tab === "cotizaciones" ? "block" : "none";
  $("subtab-facturas").style.display = tab === "facturas" ? "block" : "none";
  $("subtab-ordenes").style.display = tab === "ordenes" ? "block" : "none";
  if (tab === "facturas") renderListaFacturas();
  if (tab === "ordenes") renderListaOrdenes();
  }
function switchInvSubTab(tab, btn) {
  invSubTabActual = tab;
  document.querySelectorAll("#invSubTabs .tab-mini").forEach(t => t.classList.remove("active"));
  if (btn) btn.classList.add("active");
  ["catalogo", "proveedores", "compras"].forEach(t => {
    const el = $("invsub-" + t);
    if (el) el.style.display = (t === tab) ? "block" : "none";
  });
  if (tab === "catalogo") {
  const cont = $("listaCatalogoModal");
  if (cont) cont.innerHTML = '<div class="alert info">⏳ Cargando catálogo...</div>';
  const cEl = $("catalogoCount");
  if (cEl) cEl.innerText = "Cargando...";
  clearTimeout(_renderCatalogoTimer); // cancelar debounce pendiente
  setTimeout(() => {
    _renderListaCatalogoReal();
    poblarSelectAjusteStock();
  }, 50);
}
  if (tab === "proveedores") renderListaProveedores();
  if (tab === "compras") renderListaCompras();
}
function setFiltroCatalogo(tipo, btn) {
        filtroCatalogoActual = tipo;
        document.querySelectorAll("#invsub-catalogo .filter-chip").forEach(c => c.classList.remove("active"));
        if (btn) btn.classList.add("active");
        renderListaCatalogo();
      }
function poblarSelectAjusteStock() {
        const sel = $("ajusteProductoSel");
        if (!sel) return;
        sel.innerHTML = "";
        catalogo.forEach(p => {
          sel.innerHTML += `<option value="${p.id}">${p.codigo ? '[' + p.codigo + '] ' : ''}${p.nombre} (stock: ${p.stock ?? 0})</option>`;
        });
      }
function renderListaMovimientosStock() {
        const cont = $("listaMovimientosStock");
        if (!cont) return;
        if (!movimientosStock.length) {
          cont.innerHTML = '<div class="alert mid">Sin movimientos de stock registrados</div>';
          return;
        }
        const ordenados = [...movimientosStock].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        cont.innerHTML = ordenados.slice(0, 100).map(m => {
          const esEntrada = m.tipo === "entrada";
          return `<div class="item" style="border-left-color:${esEntrada ? 'var(--ok)' : 'var(--bad)'};">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-weight:700;font-size:12px;">${esEntrada ? '➕' : '➖'} ${m.productoNombre}</span>
              <span style="font-weight:800;color:${esEntrada ? 'var(--ok)' : 'var(--bad)'};">${esEntrada ? '+' : '-'}${m.cantidad}</span>
            </div>
            <div class="small">${m.motivo || ''}</div>
            <div class="small" style="color:var(--muted);">${m.fecha}</div>
          </div>`;
        }).join("");
      }
window.renderListaMovimientosStock = renderListaMovimientosStock;
function renderListaProveedores() {
        const cont = $("listaProveedoresInv");
        if (!cont) return;
        if (!proveedores.length) {
          cont.innerHTML = '<div class="alert mid">No hay proveedores registrados</div>';
          return;
        }
        cont.innerHTML = proveedores.map(p => `
          <div class="item" style="display:flex;justify-content:space-between;align-items:center;">
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;font-size:13px;">🚚 ${p.nombre}</div>
              <div class="small">${p.telefono || ''} ${p.email ? '· ' + p.email : ''}</div>
              ${p.notas ? `<div class="small" style="color:var(--muted);">${p.notas}</div>` : ''}
            </div>
            <div style="display:flex;gap:4px;flex-shrink:0;">
              <button class="small-btn warn-btn" onclick="abrirEditarProveedor('${p.id}')" style="font-size:9px;">✏️</button>
              <button class="small-btn" onclick="eliminarProveedor('${p.id}')" style="font-size:9px;background:rgba(239,68,68,.15);color:var(--bad);">🗑️</button>
            </div>
          </div>`).join("");
      }
window.renderListaProveedores = renderListaProveedores;
function mostrarFormProveedor() {
        delete $("formProveedor").dataset.editandoId;
        $("formProveedor").querySelector("button.primary").textContent = "💾 Guardar Proveedor";
        $("formProveedor").style.display = "block";
        ["provNombre", "provTelefono", "provEmail", "provNIT", "provDireccion", "provNotas"].forEach(id => {
          const el = $(id); if (el) el.value = "";
        });
      }
function cancelarFormProveedor() {
        delete $("formProveedor").dataset.editandoId;
        ["provNombre", "provTelefono", "provEmail", "provNIT", "provDireccion", "provNotas"].forEach(id => {
          const el = $(id); if (el) el.value = "";
        });
        $("formProveedor").querySelector("button.primary").textContent = "💾 Guardar Proveedor";
        $("formProveedor").style.display = "none";
      }
function abrirEditarProveedor(id) {
        const p = proveedores.find(x => x.id === id);
        if (!p) return;
        $("formProveedor").style.display = "block";
        $("provNombre").value = p.nombre || "";
        $("provTelefono").value = p.telefono || "";
        $("provEmail").value = p.email || "";
        $("provNIT").value = p.nit || "";
        $("provDireccion").value = p.direccion || "";
        $("provNotas").value = p.notas || "";
        $("formProveedor").dataset.editandoId = id;
        $("formProveedor").querySelector("button.primary").textContent = "💾 Actualizar Proveedor";
      }
function eliminarProveedor(id) {
        if (!confirm("¿Eliminar este proveedor?")) return;
        proveedores = proveedores.filter(p => p.id !== id);
        guardarInventarioNegocio();
        renderListaProveedores();
        poblarSelectProveedores();
        toast("🗑️ Proveedor eliminado");
      }
function poblarSelectProveedores() {
        const sel = $("compraProveedorSel");
        if (!sel) return;
        sel.innerHTML = '<option value="">Seleccionar proveedor...</option>';
        proveedores.forEach(p => {
          sel.innerHTML += `<option value="${p.id}">${p.nombre}</option>`;
        });
      }
function toggleFormProveedorRapido() {
        const f = $("formProveedorRapido");
        if (!f) return;
        const abriendo = f.style.display === "none";
        f.style.display = abriendo ? "block" : "none";
        if (abriendo) {
          $("provRapidoNombre").value = "";
          $("provRapidoTelefono").value = "";
        }
      }
window.toggleFormProveedorRapido = toggleFormProveedorRapido;
function abrirNuevaCompra() {
  productosCompraActual = [];
  poblarSelectProveedores();
  $("compraProveedorSel").value = "";
  $("compraNumero").value = generarNumeroCompra();
  renderProductosCompra();
  actualizarTotalesCompra();
  $("modalCompra").classList.add("open");
}
function agregarProductoCompra() {
        if (catalogo.length === 0) {
          toast("📦 Primero agrega productos al catálogo");
          return;
        }
        $("modalCompra").classList.remove("open");

        function renderItems(q) {
          const query = (q || "").toLowerCase().trim();
          const items = query
            ? catalogo.filter(p => p.nombre.toLowerCase().includes(query) || (p.codigo || "").toLowerCase().includes(query))
            : catalogo;
          const lista = document.getElementById("_compProdSearchList");
          const counter = document.getElementById("_compProdCount");
          if (counter) counter.innerText = items.length + " producto(s)";
          if (!lista) return;
          lista.innerHTML = items.length === 0
            ? '<div class="alert mid">Sin resultados</div>'
            : items.map(p => `
              <div class="item" style="cursor:pointer;margin-bottom:6px;padding:10px;" onclick="agregarProdACompra('${p.id}')">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                  <div>
                    <div style="font-weight:700;font-size:13px;">${p.codigo ? '[' + p.codigo + '] ' : ''}${p.nombre}</div>
                    <div class="small">Stock actual: ${p.stock ?? 0} · Costo actual: ${money(p.costo || 0)}</div>
                  </div>
                </div>
              </div>`).join("");
        }

        const overlay = document.createElement("div");
        overlay.className = "modal-overlay open";
        overlay.id = "modalSelProdCompra";
        overlay.style.zIndex = "3000";
        overlay.onclick = e => { if (e.target === overlay) { overlay.remove(); document.getElementById("modalCompra").classList.add("open"); } };
        overlay.innerHTML = `
          <div class="modal" style="max-width:460px;width:90%;padding:16px;">
            <h3 style="margin-bottom:10px;">📦 Seleccionar Producto</h3>
            <div style="position:relative;margin-bottom:8px;">
              <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none;">🔍</span>
              <input id="_buscarProdCompra" type="text" placeholder="Buscar por nombre, código..." style="padding-left:34px;margin-bottom:0;" oninput="(function(el){ window._renderCompProdItems(el.value); })(this)">
            </div>
            <div class="small" id="_compProdCount" style="margin-bottom:6px;">${catalogo.length} producto(s)</div>
            <div id="_compProdSearchList" style="max-height:50vh;overflow-y:auto;"></div>
            <button class="secondary" onclick="document.getElementById('modalSelProdCompra').remove();document.getElementById('modalCompra').classList.add('open')" style="margin-top:10px;">Cancelar</button>
          </div>`;
        document.body.appendChild(overlay);
        window._renderCompProdItems = renderItems;
        renderItems("");
        setTimeout(() => { const i = document.getElementById("_buscarProdCompra"); if (i) i.focus(); }, 100);
      }
function agregarProdACompra(prodId) {
        const producto = catalogo.find(p => p.id === prodId);
        if (!producto) return;
        const existente = productosCompraActual.find(p => p.productoId === prodId);
        if (existente) {
          existente.cantidad++;
        } else {
          productosCompraActual.push({
            productoId: producto.id,
            nombre: producto.nombre,
            costoUnitario: producto.costo || 0,
            cantidad: 1
          });
        }
        const modal = document.getElementById("modalSelProdCompra");
        if (modal) modal.remove();
        document.getElementById("modalCompra").classList.add("open");
        renderProductosCompra();
        actualizarTotalesCompra();
        toast("✅ Producto agregado");
      }
function renderProductosCompra() {
        const cont = $("compraProductosLista");
        if (!cont) return;
        if (!productosCompraActual.length) {
          cont.innerHTML = '<div class="alert mid">Sin productos agregados</div>';
          return;
        }
        cont.innerHTML = productosCompraActual.map((p, i) => `
          <div style="background:var(--cardBg);border:1px solid var(--line);border-radius:12px;padding:10px;margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
              <div style="font-weight:700;font-size:12px;flex:1;padding-right:8px;">${p.nombre}</div>
              <button class="small-btn" onclick="eliminarProductoCompra(${i})" style="font-size:9px;padding:4px 8px;background:rgba(239,68,68,.15);color:var(--bad);flex-shrink:0;">✕</button>
            </div>
            <div class="grid2" style="gap:6px;">
              <div>
                <div style="font-size:10px;color:var(--muted);margin-bottom:3px;">Costo unit.</div>
                <input type="text" value="${Number(p.costoUnitario).toLocaleString('es-CO')}"
                  style="width:100%;padding:5px 7px;font-size:12px;margin:0;text-align:right;"
                  oninput="editarCostoCompra(${i}, this.value)"
                  onblur="this.value=Number(productosCompraActual[${i}]?.costoUnitario||0).toLocaleString('es-CO')">
              </div>
              <div>
                <div style="font-size:10px;color:var(--muted);margin-bottom:3px;">Cantidad</div>
                <input type="number" value="${p.cantidad}" min="1"
                  style="width:100%;padding:5px 7px;font-size:12px;margin:0;text-align:center;"
                  onchange="cambiarCantidadCompra(${i}, this.value)">
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding-top:6px;border-top:1px solid var(--line);margin-top:6px;">
              <span style="font-size:10px;color:var(--muted);">Subtotal</span>
              <span style="font-weight:800;font-size:13px;color:var(--ok);">${money(p.costoUnitario * p.cantidad)}</span>
            </div>
          </div>`).join("");
      }
window.renderProductosCompra = renderProductosCompra;
function eliminarProductoCompra(i) { productosCompraActual.splice(i, 1); renderProductosCompra(); actualizarTotalesCompra(); }
function cambiarCantidadCompra(i, v) { const c = parseInt(v) || 1; if (c < 1) return; productosCompraActual[i].cantidad = c; renderProductosCompra(); actualizarTotalesCompra(); }
function filtrarCompras(filtro, btn) {
        compraFiltroActual = filtro;
        document.querySelectorAll("#invsub-compras .tab-mini").forEach(t => t.classList.remove("active"));
        if (btn) btn.classList.add("active");
        renderListaCompras();
      }
function renderListaCompras() {
        const cont = $("listaComprasInv");
        if (!cont) return;
        let filtradas = compras;
        if (compraFiltroActual !== "todas") filtradas = compras.filter(c => c.estado === compraFiltroActual);
        filtradas = [...filtradas].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const elPagar = $("comprasKpiPagar");
        const elMes = $("comprasKpiMes");
        if (elPagar) elPagar.innerText = money(compras.filter(c => c.estado === "pendiente").reduce((s, c) => s + c.total, 0));
        if (elMes) {
          const mesActual = fechaHoyColombia().slice(0, 7);
          elMes.innerText = money(compras.filter(c => c.fecha.startsWith(mesActual)).reduce((s, c) => s + c.total, 0));
        }

        if (!filtradas.length) { cont.innerHTML = '<div class="alert mid">No hay compras registradas</div>'; return; }
        cont.innerHTML = filtradas.map(c => `
          <div class="quote-card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <span style="font-weight:700;font-size:14px;">${c.numero}</span>
              <span class="quote-status ${c.estado === 'pagada' ? 'aprobada' : 'enviada'}">${c.estado === 'pagada' ? '✅ PAGADA' : '⏳ POR PAGAR'}</span>
            </div>
            <div style="font-size:12px;margin-bottom:4px;">🚚 ${c.proveedorNombre}</div>
            <div class="small">${c.productos.length} producto(s)</div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;">
              <span style="font-weight:700;font-size:15px;color:var(--bad);">${money(c.total)}</span>
              <span class="small">${c.fecha}</span>
            </div>
            <div style="display:flex;gap:4px;margin-top:8px;flex-wrap:wrap;">
              ${c.estado === 'pendiente' ? `<button class="small-btn success-btn" onclick="abrirModalPagoCompra('${c.id}')">💰 Pagar</button>` : ''}
              <button class="small-btn" onclick="eliminarCompra('${c.id}')" style="background:rgba(239,68,68,.15);color:var(--bad);">🗑️</button>
            </div>
          </div>`).join("");
      }
window.renderListaCompras = renderListaCompras;
function abrirModalPagoCompra(id) {
        compraPagandoId = id;
        const sel = $("pagoCompraCuenta");
        sel.innerHTML = "";
        cuentas.forEach(c => { sel.innerHTML += `<option value="${c.id}">${c.icon} ${c.nombre}</option>`; });
        $("modalPagoCompra").classList.add("open");
      }
window.abrirModalPagoCompra = abrirModalPagoCompra;
async function confirmarPagoCompra() {
  const compra = compras.find(c => c.id === compraPagandoId);
  if (!compra) { toast("❌ Compra no encontrada"); return; }
  const cuentaId = $("pagoCompraCuenta").value;
  if (!cuentaId) { toast("Selecciona una cuenta"); return; }
  
  // Verificar saldo suficiente
  const saldos = calcSaldos();
  const saldoCuenta = saldos[cuentaId] || 0;
  if (compra.total > saldoCuenta) {
    toast(`❌ Saldo insuficiente. Tienes ${money(saldoCuenta)} en esa cuenta`);
    return;
  }
  
  const ctxGuardar = "negocio"; // las compras siempre son del negocio
  const datos = {
    Fecha: fechaHoyColombia(),
    Tipo: "Gasto",
    Cuenta: cuentaId,
    Categoría: "📦 Inventario",
    Descripción: "Compra " + compra.numero + " - " + compra.proveedorNombre,
    Monto: compra.total,
    Nota: "Pago compra a proveedor",
    Contexto: ctxGuardar
  };
  
  const idMov = await guardarConOffline(datos, ctxGuardar);
  
  // Si estamos en contexto negocio, deduplicar y actualizar la vista
  if (contexto === "negocio") {
    const seen = new Set();
    data = data.filter(d => {
      const id = String(d.ID);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    guardarDatos();
    render();
  }
  
  // Marcar la compra como pagada
  compra.estado = "pagada";
  compra.fechaPago = fechaHoyColombia();
  compra.cuentaPago = cuentaId;
  compra.movimientoId = idMov;
  guardarInventarioNegocio();
  
  $("modalPagoCompra").classList.remove("open");
  compraPagandoId = null;
  renderListaCompras();
  toast("✅ Compra pagada — gasto de " + money(compra.total) + " registrado");
}
function eliminarCompra(id) {
        if (!confirm("¿Eliminar esta compra? El stock que se sumó NO se revertirá automáticamente, ajústalo manualmente en Movimientos si corresponde.")) return;
        compras = compras.filter(c => c.id !== id);
        guardarInventarioNegocio();
        renderListaCompras();
        toast("🗑️ Compra eliminada");
      }
function eliminarFactura(facturaId) {
        if (!confirm("¿Eliminar esta factura? Esto no afecta el movimiento contable ya registrado.")) return;
        facturas = facturas.filter(f => f.id !== facturaId);
        guardarDatosNegocio();
        renderListaFacturas();
        toast("🗑️ Factura eliminada");
      }
function initSignaturePad() {
        sigCanvas = document.getElementById("sigPad");
        if (!sigCanvas) return;
        sigCtx = sigCanvas.getContext("2d");
        sigCtx.fillStyle = "#fff";
        sigCtx.fillRect(0, 0, sigCanvas.width, sigCanvas.height);
        sigCtx.strokeStyle = "#000";
        sigCtx.lineWidth = 2.5;
        sigCtx.lineCap = "round";
        sigDrawing = false;
  
        function getPos(e) {
          const rect = sigCanvas.getBoundingClientRect();
          const scaleX = sigCanvas.width / rect.width;
          const scaleY = sigCanvas.height / rect.height;
          const clientX = e.touches ? e.touches[0].clientX : e.clientX;
          const clientY = e.touches ? e.touches[0].clientY : e.clientY;
          return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
        }
        function start(e) { e.preventDefault(); sigDrawing = true; const p = getPos(e); sigCtx.beginPath(); sigCtx.moveTo(p.x, p.y); }
        function move(e) { if (!sigDrawing) return; e.preventDefault(); const p = getPos(e); sigCtx.lineTo(p.x, p.y); sigCtx.stroke(); }
        function end() { sigDrawing = false; }
  
        sigCanvas.onmousedown = start; sigCanvas.onmousemove = move; sigCanvas.onmouseup = end; sigCanvas.onmouseleave = end;
        sigCanvas.ontouchstart = start; sigCanvas.ontouchmove = move; sigCanvas.ontouchend = end;
      }
function abrirModalFirma(facturaId, tipo) {
        firmaActualFacturaId = facturaId;
        firmaActualTipo = tipo;
        $("firmaModalTitulo").innerText = tipo === "cliente" ? "✍️ Firma del Cliente" : "✍️ Firma del Encargado";
        $("modalFirma").classList.add("open");
        setTimeout(initSignaturePad, 50);
      }
function abrirModalPagoFactura(facturaId) {
        facturaPagandoId = facturaId;
        const sel = $("pagoFacturaCuenta");
        sel.innerHTML = "";
        cuentas.forEach(c => { sel.innerHTML += `<option value="${c.id}">${c.icon} ${c.nombre}</option>`; });
        $("modalPagoFactura").classList.add("open");
      }
async function confirmarPagoFactura() {
        const fact = facturas.find(f => f.id === facturaPagandoId);
        if (!fact) { toast("❌ Factura no encontrada"); return; }
        const cuentaId = $("pagoFacturaCuenta").value;
        if (!cuentaId) { toast("Selecciona una cuenta"); return; }
  
        const datos = {
          Fecha: fechaHoyColombia(),
          Tipo: "Ingreso",
          Cuenta: cuentaId,
          Categoría: "💰 Ventas",
          Descripción: "Pago factura " + fact.numero + (fact.clienteNombre ? " - " + fact.clienteNombre : ""),
          Monto: fact.total,
          Nota: "Generado automáticamente al pagar factura",
          Contexto: "negocio"
        };
        const idMov = await guardarConOffline(datos, "negocio");
        if (contexto === "negocio") {
          const seen = new Set();
          data = data.filter(d => { const id = String(d.ID); if (seen.has(id)) return false; seen.add(id); return true; });
          guardarDatos();
          render();
        }
        fact.estado = "pagada";
        fact.fechaPago = fechaHoyColombia();
        fact.cuentaPago = cuentaId;
        fact.movimientoId = idMov;
        guardarDatosNegocio();
        $("modalPagoFactura").classList.remove("open");
        renderListaFacturas();
        toast("✅ Factura pagada — movimiento registrado");
      }
function capturarFotoOrden(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (fotosOrdenActual.length >= 3) { toast("❌ Máximo 3 fotos"); return; }
    if (file.size > 4 * 1024 * 1024) { toast("❌ Imagen muy pesada, máx 4MB"); return; }
  
    const reader = new FileReader();
    reader.onerror = () => toast("❌ Error al leer la imagen");
    reader.onload = function(e) {
      const img = new Image();
      img.onerror = () => toast("❌ Archivo no es una imagen válida");
      img.onload = function() {
        const canvas = document.createElement("canvas");
        const maxW = 900;
        const scale = Math.min(1, maxW / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        const comprimida = canvas.toDataURL("image/jpeg", 0.75);
        fotosOrdenActual.push(comprimida);
        renderFotosOrdenPreview();
        toast("📷 Foto agregada (" + fotosOrdenActual.length + "/3)");
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }
function abrirCamaraOrden() {
    if (fotosOrdenActual.length >= 3) { toast("❌ Máximo 3 fotos"); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast("❌ Cámara no disponible aquí, usa Galería");
      return;
    }
  
    const overlay = document.createElement("div");
    overlay.id = "_camOverlay";
    overlay.style.cssText = "position:fixed;inset:0;z-index:99999;background:#000;display:flex;flex-direction:column;";
    overlay.innerHTML = `
      <video id="_camVideo" autoplay playsinline muted style="flex:1;width:100%;object-fit:cover;background:#000;"></video>
      <div style="display:flex;gap:10px;padding:16px;background:#000;justify-content:center;">
        <button id="_camCancelar" type="button" style="flex:1;max-width:140px;padding:14px;background:#333;color:#fff;border:none;border-radius:12px;font-weight:700;">✕ Cancelar</button>
        <button id="_camCapturar" type="button" style="flex:1;max-width:140px;padding:14px;background:#22c55e;color:#fff;border:none;border-radius:12px;font-weight:700;">📷 Capturar</button>
      </div>
    `;
    document.body.appendChild(overlay);
  
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then(stream => {
        _camStream = stream;
        document.getElementById("_camVideo").srcObject = stream;
      })
      .catch(err => {
        console.error("Error cámara:", err);
        toast("❌ No se pudo abrir la cámara. Usa Galería");
        cerrarCamaraOrden();
      });
  
    document.getElementById("_camCancelar").onclick = cerrarCamaraOrden;
    document.getElementById("_camCapturar").onclick = capturarFotoDesdeCamara;
  }
function cerrarCamaraOrden() {
    if (_camStream) { _camStream.getTracks().forEach(t => t.stop()); _camStream = null; }
    const overlay = document.getElementById("_camOverlay");
    if (overlay) overlay.remove();
  }
function capturarFotoDesdeCamara() {
    const video = document.getElementById("_camVideo");
    if (!video || !video.videoWidth) { toast("⏳ Espera a que cargue la cámara"); return; }
    const maxW = 900;
    const scale = Math.min(1, maxW / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    fotosOrdenActual.push(canvas.toDataURL("image/jpeg", 0.75));
    cerrarCamaraOrden();
    renderFotosOrdenPreview();
    toast("📷 Foto agregada (" + fotosOrdenActual.length + "/3)");
  }
function eliminarFotoOrden(idx) {
    fotosOrdenActual.splice(idx, 1);
    renderFotosOrdenPreview();
  }
function renderFotosOrdenPreview() {
    const cont = $("fotosOrdenPreview");
    if (!cont) return;
    const botones = fotosOrdenActual.length < 3 ? `
      <button onclick="abrirCamaraOrden()" type="button" style="display:inline-flex;flex-direction:column;align-items:center;justify-content:center;width:70px;height:70px;border:2px dashed var(--line);border-radius:10px;cursor:pointer;margin:4px;color:var(--muted);font-size:10px;gap:2px;background:transparent;">
    📷<span>Cámara</span>
  </button>
      <label style="display:inline-flex;flex-direction:column;align-items:center;justify-content:center;width:70px;height:70px;border:2px dashed var(--line);border-radius:10px;cursor:pointer;margin:4px;color:var(--muted);font-size:10px;gap:2px;">
        🖼️<span>Galería</span>
        <input type="file" accept="image/*" style="display:none" onchange="capturarFotoOrden(event)">
      </label>` : "";
    cont.innerHTML = fotosOrdenActual.map((f, i) => `
      <div style="position:relative;display:inline-block;margin:4px;">
        <img src="${f}" style="width:70px;height:70px;object-fit:cover;border-radius:10px;border:1px solid var(--line);">
        <button onclick="eliminarFotoOrden(${i})" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:var(--bad);color:#fff;border:none;font-size:11px;padding:0;cursor:pointer;">✕</button>
      </div>
    `).join("") + botones;
  }
window.addEventListener("offline",actualizarStatusBar);
function switchLoginTab(t){$("formLogin").style.display=t==="login"?"block":"none";$("formRegister").style.display=t==="register"?"block":"none";$("tabLoginBtn").classList.toggle("active",t==="login");$("tabRegisterBtn").classList.toggle("active",t==="register");$("loginError").classList.remove("visible");}
function showError(m){$("loginError").textContent=m;$("loginError").classList.add("visible")}
async function iniciarSesion(){
    const e=$("loginEmail").value.trim(), p=$("loginPass").value;
    if(!e||!p){showError("Completa los campos");return}
    $("loginError").classList.remove("visible");
    $("loginBtn").disabled = true;
$("loginBtn").textContent = "Verificando...";
$("loginBtn").classList.add("loading");
    const resetBtn=()=>{$("loginBtn").disabled=false;$("loginBtn").textContent="Entrar →"};
    const t=setTimeout(()=>{resetBtn();showError("Tiempo agotado. Recarga e intenta.");},10000);
    try{
      await window.fbLogin(e,p);
      clearTimeout(t);
    }catch(err){
      clearTimeout(t);
      resetBtn();
      let msg="Error al iniciar sesión";
      if(err.code==="auth/user-not-found") msg="Usuario no encontrado";
      else if(err.code==="auth/wrong-password") msg="Contraseña incorrecta";
      else if(err.code==="auth/invalid-credential") msg="Correo o contraseña incorrectos";
      else if(err.code==="auth/invalid-email") msg="Correo inválido";
      else if(err.code==="auth/too-many-requests") msg="Demasiados intentos. Espera un momento.";
      else if(err.message) msg=err.message;
      showError(msg);
    }
  }
async function registrarUsuario(){const n=$("regName").value.trim(),e=$("regEmail").value.trim(),p=$("regPass").value;if(!n||!e||!p||p.length<6){showError("Completa (mín. 6)");return}$("loginError").classList.remove("visible");$("registerBtn").disabled=true;$("registerBtn").textContent="⏳...";try{const cred=await window.fbRegister(e,p);await window.fbUpdateProfile(cred.user,{displayName:n});try{await window.fbAddDoc(window.fbCollection(window.db,"users"),{uid:cred.user.uid,email:e,displayName:n,createdAt:fechaHoyColombia()});}catch(ex){console.error("Error guardando registro de usuario:",ex);}}catch(err){$("registerBtn").disabled=false;$("registerBtn").textContent="Crear cuenta →";showError("Error: "+err.message);}}
function actualizarUI(user) {
    const dn = user.displayName || (user.email || "").split("@")[0];
    const ini = dn.split(/[\s._-]+/).filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0,2) || "U";
    
    // Estos elementos no existen en el HTML - comentados
    // const avatarEl = $("userAvatar");
    // if (avatarEl) avatarEl.textContent = ini;
    
    // const nameEl = $("userName");
    // if (nameEl) nameEl.textContent = dn.split(" ")[0];
    
    const infoBlock = $("userInfoBlock");
    if (infoBlock) {
        infoBlock.innerHTML = '<div style="display:flex;align-items:center;gap:10px">' +
            '<div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#7c3aed);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:#fff">' + ini + '</div>' +
            '<div><div style="font-weight:700">' + dn + '</div><div class="small">' + (user.email || "") + '</div></div>' +
        '</div>';
    }
}
function poblarSelects(){["cuentaSel","cuentaOrigen","cuentaDestino","recCuentaSel","prestamoCuenta"].forEach(id=>{const s=$(id);if(!s)return;s.innerHTML="";cuentas.forEach(c=>{s.innerHTML+='<option value="'+c.id+'">'+c.icon+' '+c.nombre+'</option>';});});poblarCat("ingreso");const fs=$("filterCuentaSel");if(fs){fs.innerHTML='<option value="">Todas</option>';cuentas.forEach(c=>{fs.innerHTML+='<option value="'+c.id+'">'+c.icon+' '+c.nombre+'</option>';});}const bs=$("budgetCatSel");if(bs){bs.innerHTML="";categorias.filter(c=>c.tipo==="gasto"||c.tipo==="ambos").forEach(c=>{bs.innerHTML+='<option value="'+c.icon+' '+c.nombre+'">'+c.icon+' '+c.nombre+'</option>';});}const rs=$("recCatSel");if(rs){rs.innerHTML="";categorias.filter(c=>c.tipo==="gasto"||c.tipo==="ambos").forEach(c=>{rs.innerHTML+='<option value="'+c.icon+' '+c.nombre+'">'+c.icon+' '+c.nombre+'</option>';});}poblarSelectClientes();}
function poblarCat(modo){
        const s=$("categoria");
        if(!s)return;
        s.innerHTML="";
        if(!categorias||categorias.length===0){
          // Categorías de respaldo si Firebase aún no cargó
          const uid_val=window.currentUser?.uid||"guest";
          const defCat=[
            {id:"ingreso_"+uid_val,nombre:"Ingreso",icon:"💰",tipo:"ingreso"},
            {id:"comida_"+uid_val,nombre:"Comida",icon:"🍔",tipo:"gasto"},
            {id:"vivienda_"+uid_val,nombre:"Vivienda",icon:"🏠",tipo:"gasto"},
            {id:"transporte_"+uid_val,nombre:"Transporte",icon:"🚗",tipo:"gasto"},
            {id:"servicios_"+uid_val,nombre:"Servicios",icon:"💡",tipo:"gasto"},
            {id:"ahorro_"+uid_val,nombre:"Ahorro",icon:"🏦",tipo:"ambos"}
          ];
          defCat.filter(c=>c.tipo==="ambos"||c.tipo===modo).forEach(c=>{
            s.innerHTML+='<option value="'+c.icon+' '+c.nombre+'">'+c.icon+' '+c.nombre+'</option>';
          });
          return;
        }
        categorias.filter(c=>c.tipo==="ambos"||c.tipo===modo).forEach(c=>{
          s.innerHTML+='<option value="'+c.icon+' '+c.nombre+'">'+c.icon+' '+c.nombre+'</option>';
        });
      }
function poblarTraspaso(){const so=$("traspasoOrigen"),sd=$("traspasoDestino"),dir=$("traspasoDireccion").value;if(!so||!sd)return;const co=dir==="p2n"?"personal":"negocio",cd=dir==="p2n"?"negocio":"personal";const cO=JSON.parse(localStorage.getItem(keyForCtx("cuentas",co))||"[]"),cD=JSON.parse(localStorage.getItem(keyForCtx("cuentas",cd))||"[]");so.innerHTML="";cO.forEach(c=>{so.innerHTML+='<option value="'+c.id+'">'+(c.icon||"")+' '+c.nombre+'</option>'});sd.innerHTML="";cD.forEach(c=>{sd.innerHTML+='<option value="'+c.id+'">'+(c.icon||"")+' '+c.nombre+'</option>'});}
function actualizarNavNegocio() {
  const nav = document.getElementById("mainNav");
  if (!nav) return;
  
  // Detectar qué tab está activo ANTES de reconstruir el nav
  const tabActiva = document.querySelector(".tab.active")?.id?.replace("tab-", "") || "home";
  
  // Mapa de tab → índice de botón en cada contexto
  const idxNegocio = { home: 0, dashboard: 1, goals: 2, list: 3, quotes: 4, inventario: 5, settings: 6 };
  const idxPersonal = { home: 0, dashboard: 1, goals: 2, list: 3, settings: 4 };
  
  if (contexto === "negocio") {
  if (esTecnico()) {
  // Técnico: órdenes de trabajo, catálogo (lectura) y configuración
  nav.style.gridTemplateColumns = "repeat(3,1fr)";
  nav.innerHTML = `
        <button onclick="goTab('quotes',this)">🔧</button>
        <button onclick="goTab('inventario',this)">📦</button>
        <button onclick="goTab('settings',this)">⚙️</button>
      `;
    // Marcar botón activo según tab actual
const btns = nav.querySelectorAll("button");
if (tabActiva === "settings") {
  if (btns[2]) btns[2].classList.add("active");
} else if (tabActiva === "inventario") {
  if (btns[1]) btns[1].classList.add("active");
  setTimeout(() => switchInvSubTab("catalogo", document.querySelector("#invSubTabs .tab-mini")), 100);
} else {
  // Por defecto: ir a órdenes
  if (btns[0]) btns[0].classList.add("active");
  goTab("quotes", btns[0]);
  setTimeout(() => {
    const btnOrd = document.getElementById("subtabBtnOrdenes");
    if (btnOrd) switchQuotesSubTab("ordenes", btnOrd);
  }, 100);
}
  } else {
    nav.style.gridTemplateColumns = "repeat(7,1fr)";
    nav.innerHTML = `
        <button onclick="goTab('home',this)">🏠</button>
        <button onclick="goTab('dashboard',this)">📊</button>
        <button onclick="goTab('goals',this)">🎯</button>
        <button onclick="goTab('list',this)">📋</button>
        <button onclick="goTab('quotes',this)">📄</button>
        <button onclick="goTab('inventario',this)">📦</button>
        <button onclick="goTab('settings',this)">⚙️</button>
      `;
    const accesos = document.getElementById("cardNegocioAccesos");
    if (accesos) accesos.style.display = "block";
    const config = document.getElementById("cardConfigNegocio");
    if (config) config.style.display = "block";
    // Restaurar botón activo
    const idx = idxNegocio[tabActiva] ?? 0;
    const btns = nav.querySelectorAll("button");
    if (btns[idx]) btns[idx].classList.add("active");
  }
    
  } else {
    nav.style.gridTemplateColumns = "repeat(5,1fr)";
    nav.innerHTML = `
      <button onclick="goTab('home',this)">🏠</button>
      <button onclick="goTab('dashboard',this)">📊</button>
      <button onclick="goTab('goals',this)">🎯</button>
      <button onclick="goTab('list',this)">📋</button>
      <button onclick="goTab('settings',this)">⚙️</button>
    `;
    const accesos = document.getElementById("cardNegocioAccesos");
    if (accesos) accesos.style.display = "none";
    const config = document.getElementById("cardConfigNegocio");
    if (config) config.style.display = "none";
    
    // Restaurar botón activo
    // Si estabas en quotes o inventario (solo negocio), ir a home
    const tabEnPersonal = (tabActiva === "quotes" || tabActiva === "inventario") ? "home" : tabActiva;
    const idx = idxPersonal[tabEnPersonal] ?? 0;
    const btns = nav.querySelectorAll("button");
    if (btns[idx]) btns[idx].classList.add("active");
  }
}
function actualizarLabels(){const l=contexto==="negocio"?{c:"negocio",t:"Negocio"}:{c:"personal",t:"Personal"};["movCtxLabel","goalCtxLabel","cierreCtxLabel","budgetCtxLabel","recCtxLabel"].forEach(id=>{const el=$(id);if(el){el.className="ctx-label "+l.c;el.innerText=l.t;}});$("cuentasTitle").innerHTML=(contexto==="negocio"?"🏪":"🏦")+" Mis cuentas";$("ctxSaldoLabel").innerText=contexto==="negocio"?"Capital":"Saldo disponible";}
async function delCuenta(id){const cuenta=cuentas.find(c=>c.id===id);if(!cuenta){toast("❌ Cuenta no encontrada");return;}const saldos=calcSaldos();const saldoActual=saldos[id]||0;if(Math.abs(saldoActual)>0.01){toast(`❌ No puedes eliminar "${cuenta.nombre}" porque tiene ${money(saldoActual)}. Transfiere o gasta ese dinero primero.`);return;}const movimientosAsociados=data.filter(m=>m.Cuenta===id||m.CuentaOrigen===id||m.CuentaDestino===id);if(movimientosAsociados.length>0&&!confirm(`⚠️ Esta cuenta tiene ${movimientosAsociados.length} movimientos históricos. ¿Eliminar de todas formas? Los movimientos quedarán sin cuenta asociada.`)){return;}if(!confirm(`¿Eliminar cuenta "${cuenta.nombre}"?`))return;if(movimientosAsociados.length>0){for(const mov of movimientosAsociados){if(mov.Cuenta===id)mov.Cuenta="eliminada_"+id;if(mov.CuentaOrigen===id)mov.CuentaOrigen="eliminada_"+id;if(mov.CuentaDestino===id)mov.CuentaDestino="eliminada_"+id;}guardarDatos();toast(`⚠️ ${movimientosAsociados.length} movimientos actualizados`);}cuentas=cuentas.filter(c=>c.id!==id);await guardarCuentas(contexto);guardarDatos();poblarSelects();render();renderCuentasAdmin();toast(`🗑️ Cuenta "${cuenta.nombre}" eliminada`);}
function abrirEditarCuenta(id) {
    const c = cuentas.find(x => x.id === id);
    if (!c) return;
  
    // Reutilizar los inputs existentes de nueva cuenta
    $("newCuentaNombre").value = c.nombre;
    $("newCuentaIcon").value   = c.icon || "🏦";
  
    // Guardar ID editando en el input
    $("newCuentaNombre").dataset.editandoId = id;
  
    // Cambiar texto del botón
    const btn = document.querySelector("button[onclick='addCuenta()']");
    if (btn) btn.textContent = "✏️ Actualizar cuenta";
  
    // Scroll hacia el formulario
    $("newCuentaNombre").scrollIntoView({ behavior: "smooth" });
    $("newCuentaNombre").focus();
  }
async function addCuenta() {
    const nombre = $("newCuentaNombre").value.trim();
    const icon   = $("newCuentaIcon").value;
    if (!nombre) { toast("Ingresa un nombre"); return; }
  
    const editandoId = $("newCuentaNombre").dataset.editandoId || null;
  
    if (editandoId) {
      // ── EDITAR existente ──
      const idx = cuentas.findIndex(c => c.id === editandoId);
      if (idx !== -1) {
        cuentas[idx] = { ...cuentas[idx], nombre, icon };
        await guardarCuentas(contexto);
        guardarDatos();
        toast("✅ Cuenta actualizada: " + nombre);
      }
      delete $("newCuentaNombre").dataset.editandoId;
      const btn = document.querySelector("button[onclick='addCuenta()']");
      if (btn) btn.textContent = "➕ Agregar";
    } else {
      // ── NUEVA ──
      const uid  = window.auth?.currentUser?.uid || "guest";
      const nuevoId = nombre.toLowerCase().replace(/\s+/g,"_") + "_" + Date.now() + "_" + uid;
      const existe  = cuentas.some(c => c.nombre.toLowerCase() === nombre.toLowerCase());
      if (existe) { toast("❌ Ya existe una cuenta con ese nombre"); return; }
      cuentas.push({
        id: nuevoId, nombre, icon,
        saldoInicial: 0,
        creadaPor: uid,
        creadaEn: contexto,
        fechaCreacion: new Date().toISOString()
      });
      await guardarCuentas(contexto);
      guardarDatos();
      toast("✔ Cuenta agregada: " + nombre);
    }
  
    $("newCuentaNombre").value = "";
    poblarSelects();
    render();
    renderCuentasAdmin();
  }
function goTab(tab,btn){document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));const targetTab=document.getElementById("tab-"+tab);if(targetTab)targetTab.classList.add("active");document.querySelectorAll(".nav button").forEach(x=>x.classList.remove("active"));if(btn)btn.classList.add("active");if(tab==="list"){renderHistorial();renderLista();}if(tab==="settings"){setTimeout(()=>{renderCuentasAdmin();renderCatsAdmin();renderHistorialAdmin();cargarConfigNegocioUI();},100);}if(tab==="dashboard"){setTimeout(()=>{renderCharts();renderInversiones();renderPrestamos();if(contexto==="negocio")renderDashboardNegocio();},400);}if(tab==="goals"){renderBudgets();renderRecList();}if(tab==="quotes"){renderListaCotizaciones();}if(tab==="inventario"){const _subInv=esTecnico()?"catalogo":invSubTabActual;switchInvSubTab(_subInv,document.querySelector(`#invSubTabs .tab-mini:nth-child(${_subInv==="catalogo"?1:_subInv==="proveedores"?2:3})`));}if(false){switchInvSubTab(invSubTabActual,document.querySelector(`#invSubTabs .tab-mini:nth-child(${invSubTabActual==="catalogo"?1:invSubTabActual==="proveedores"?2:3})`));}}
function renderCoachPersonal(ing,gas,ah,cats,saldos){
    const coachEl=document.getElementById("coach");
    if(!coachEl){setTimeout(()=>renderCoachPersonal(ing,gas,ah,cats,saldos),100);return;}
  
    const hoy=hoyColombia();
    const diaActual=hoy.getDate();
    const diasMes=new Date(hoy.getFullYear(),hoy.getMonth()+1,0).getDate();
    const diasRestantes=diasMes-diaActual;
    const bal=ing-gas;
    const saldoTotal=Object.values(saldos).reduce((a,b)=>a+b,0);
  
    // ── Ratios financieros clave ──
    const tasaAhorro=ing>0?((bal/ing)*100):0;
    const tasaGasto=ing>0?((gas/ing)*100):0;
    const gastoPromedioHoy=gas/Math.max(diaActual,1);
    const proyeccionGastoMes=gastoPromedioHoy*diasMes;
    const proyeccionBalanceMes=ing-proyeccionGastoMes;
    const capacidadDiariaRestante=diasRestantes>0?Math.max(bal/diasRestantes,0):0;
    const autonomiaDias=gastoPromedioHoy>0?saldoTotal/gastoPromedioHoy:999;
  
    // ── Presupuestos y alertas ──
    const presupuestos=JSON.parse(localStorage.getItem(keyFor("budgets"))||"{}");
    const alerts=[];
    Object.entries(presupuestos).forEach(([cat,lim])=>{
      const g=cats[cat]||0;
      const pct=(g/lim)*100;
      const diasTranscurridosPct=(diaActual/diasMes)*100;
      if(pct>=100) alerts.push({lvl:"critical",emoji:"🚨",msg:`<b>${cat}</b> EXCEDIDO — gastaste ${money(g-lim)} extra`,sub:`Límite: ${money(lim)} · Gastado: ${money(g)}`});
      else if(pct>diasTranscurridosPct+20) alerts.push({lvl:"warn",emoji:"⚡",msg:`<b>${cat}</b> va al ${pct.toFixed(0)}% con solo el ${diasTranscurridosPct.toFixed(0)}% del mes`,sub:`Ritmo actual: proyectas ${money(g/diaActual*diasMes)} al cierre`});
      else if(pct>=80) alerts.push({lvl:"warn",emoji:"⚠️",msg:`<b>${cat}</b> al ${pct.toFixed(0)}%`,sub:`Quedan ${money(lim-g)} para ${diasRestantes} días`});
    });
  
    // ── Score de salud ──
    let score=70;
    if(tasaAhorro>=20) score+=15; else if(tasaAhorro>=10) score+=8; else if(tasaAhorro<0) score-=35; else if(tasaAhorro<5) score-=15;
    if(tasaGasto>90) score-=20; else if(tasaGasto>75) score-=8;
    if(autonomiaDias>60) score+=10; else if(autonomiaDias<15) score-=15; else if(autonomiaDias<7) score-=25;
    const excedidos=alerts.filter(a=>a.lvl==="critical").length;
    score-=excedidos*10;
    score=Math.min(100,Math.max(0,score));
    const scoreLabel=score>=80?"EXCELENTE":score>=65?"BUENA":score>=45?"REGULAR":score>=25?"CRÍTICA":"URGENTE";
    const scoreColor=score>=80?"#22c55e":score>=65?"#4ade80":score>=45?"#f59e0b":score>=25?"#f97316":"#ef4444";
  
    // ── Top categorías con análisis ──
    const topCats=Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([cat,monto])=>{
      const pctGasto=gas>0?(monto/gas*100):0;
      const bud=presupuestos[cat];
      const estado=bud?(monto/bud>=1?"🔴":monto/bud>=0.8?"🟡":"🟢"):(pctGasto>40?"🔴":pctGasto>25?"🟡":"🟢");
      return{cat,monto,pctGasto,estado,bud};
    });
  
    // ── Tendencia vs historial ──
    let tendenciaHtml="";
    if(historial.length>=1){
      const mesPasado=historial[0];
      const cambioGas=mesPasado.gas>0?((proyeccionGastoMes-mesPasado.gas)/mesPasado.gas*100):0;
      const cambioBal=mesPasado.gas>0?((proyeccionBalanceMes-mesPasado.balance)/Math.abs(mesPasado.balance||1)*100):0;
      const colorGas=cambioGas>10?"var(--bad)":cambioGas<-10?"var(--ok)":"var(--warn)";
      tendenciaHtml=`
        <div style="background:rgba(139,92,246,.08);border:1px solid rgba(139,92,246,.2);border-radius:12px;padding:10px;margin-bottom:10px;">
          <div style="font-size:10px;font-weight:700;color:#a78bfa;margin-bottom:6px;">📊 VS MES ANTERIOR (${mesPasado.label})</div>
          <div class="grid2">
            <div class="kpi"><span>Gasto proyectado</span><strong style="color:${colorGas}">${cambioGas>0?"+":""}${cambioGas.toFixed(0)}%</strong></div>
            <div class="kpi"><span>Balance previo</span><strong style="color:var(--muted)">${money(mesPasado.balance)}</strong></div>
          </div>
          <div style="font-size:10px;color:var(--muted);margin-top:6px;">
            ${cambioGas>15?`⚠️ Vas a gastar ${money(proyeccionGastoMes-mesPasado.gas)} más que el mes pasado`:cambioGas<-15?`✅ Proyectas ahorrar ${money(mesPasado.gas-proyeccionGastoMes)} vs el mes pasado`:`→ Ritmo de gasto similar al mes anterior`}
          </div>
        </div>`;
    }
  
    // ── Consejos priorizados y específicos ──
    const consejos=[];
    if(bal<0) consejos.push({prio:1,ico:"🔴",txt:`Gastas ${money(Math.abs(bal))} más de lo que ingresas. Debes reducir ${money(Math.abs(bal/diasRestantes))} diarios para cerrar en cero.`});
    if(tasaAhorro>0&&tasaAhorro<10&&ing>0) consejos.push({prio:2,ico:"🟠",txt:`Ahorras solo el ${tasaAhorro.toFixed(0)}% (${money(bal)}). Para llegar al 10% necesitas gastar ${money(ing*0.9)} — reducir ${money(gas-ing*0.9)}.`});
    if(tasaAhorro>=10&&tasaAhorro<20) consejos.push({prio:3,ico:"🟡",txt:`Buen ahorro (${tasaAhorro.toFixed(0)}%). Para el 20% ideal te falta recortar ${money(gas-ing*0.8)} más o aumentar ingresos.`});
    if(autonomiaDias<30&&autonomiaDias>0) consejos.push({prio:2,ico:"⏳",txt:`Tu saldo cubre ${Math.floor(autonomiaDias)} días al ritmo actual. Intenta llegar a 60+ días de autonomía.`});
    if(capacidadDiariaRestante>0) consejos.push({prio:4,ico:"📅",txt:`Puedes gastar máx ${money(capacidadDiariaRestante)}/día en los próximos ${diasRestantes} días para cerrar en positivo.`});
    if(topCats.length>0&&topCats[0].pctGasto>40) consejos.push({prio:3,ico:"📂",txt:`"${topCats[0].cat}" representa el ${topCats[0].pctGasto.toFixed(0)}% de tus gastos (${money(topCats[0].monto)}). Reducirlo un 20% libera ${money(topCats[0].monto*0.2)}.`});
    if(Object.keys(presupuestos).length===0&&gas>0) consejos.push({prio:3,ico:"📋",txt:`No tienes presupuestos definidos. Ir a Metas → Presupuestos te dará alertas automáticas por categoría.`});
    if(inversiones.length===0&&tasaAhorro>=15) consejos.push({prio:4,ico:"📈",txt:`Ahorras bien (${tasaAhorro.toFixed(0)}%). Registra tus inversiones en la pestaña 📊 para trackear tu patrimonio total.`});
    consejos.sort((a,b)=>a.prio-b.prio);
  
    // ── HTML final ──
    let html=`
      <!-- HEADER SCORE -->
      <div style="background:linear-gradient(135deg,rgba(59,130,246,.12),rgba(139,92,246,.08));border:1px solid rgba(139,92,246,.2);border-radius:16px;padding:14px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div>
            <div style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:1px;">SALUD FINANCIERA</div>
            <div style="font-size:28px;font-weight:900;color:${scoreColor};line-height:1;">${score}<span style="font-size:14px;font-weight:700;">/100</span></div>
            <div style="font-size:10px;font-weight:700;color:${scoreColor};letter-spacing:1px;">${scoreLabel}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:10px;color:var(--muted);">Día ${diaActual} de ${diasMes} · ${diasRestantes} restantes</div>
            <div style="font-size:13px;font-weight:700;margin-top:4px;">Proyección cierre</div>
            <div style="font-size:16px;font-weight:800;color:${proyeccionBalanceMes>=0?"var(--ok)":"var(--bad)"};">${money(proyeccionBalanceMes)}</div>
            <div style="font-size:9px;color:var(--muted);">si mantienes el ritmo actual</div>
          </div>
        </div>
        <div style="height:6px;background:rgba(255,255,255,.08);border-radius:6px;overflow:hidden;">
          <div style="height:100%;width:${score}%;background:linear-gradient(90deg,${scoreColor},${scoreColor}aa);border-radius:6px;transition:width .4s;"></div>
        </div>
      </div>
  
      <!-- KPIs CLAVE -->
      <div class="grid4" style="margin-bottom:10px;">
        <div class="kpi"><span>💰 Balance</span><strong style="color:${bal>=0?"var(--ok)":"var(--bad)"}">${money(bal)}</strong></div>
        <div class="kpi"><span>💸 Tasa ahorro</span><strong style="color:${tasaAhorro>=20?"var(--ok)":tasaAhorro>=10?"var(--warn)":"var(--bad)"}">${tasaAhorro.toFixed(0)}%</strong></div>
        <div class="kpi"><span>📅 Gasto/día</span><strong>${money(gastoPromedioHoy)}</strong></div>
        <div class="kpi"><span>🛡️ Autonomía</span><strong style="color:${autonomiaDias>=60?"var(--ok)":autonomiaDias>=30?"var(--warn)":"var(--bad)"}">${Math.floor(autonomiaDias)}d</strong></div>
      </div>
  
      <!-- CAPACIDAD DIARIA RESTANTE -->
      ${diasRestantes>0&&bal>0?`
      <div style="background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);border-radius:12px;padding:10px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:10px;color:var(--muted);">PUEDES GASTAR HOY</div>
          <div style="font-size:20px;font-weight:900;color:var(--ok);">${money(capacidadDiariaRestante)}</div>
          <div style="font-size:9px;color:var(--muted);">para cerrar el mes en positivo</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:9px;color:var(--muted);">Proyección mes</div>
          <div style="font-size:13px;font-weight:700;">${money(proyeccionGastoMes)}</div>
          <div style="font-size:9px;color:var(--muted);">en gastos totales</div>
        </div>
      </div>`:`
      <div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:12px;padding:10px;margin-bottom:10px;">
        <div style="font-size:10px;color:var(--bad);font-weight:700;">⚠️ ${bal<=0?"GASTOS SUPERAN INGRESOS":"MES CASI CERRADO"}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px;">${bal<=0?`Estás ${money(Math.abs(bal))} en negativo`:`${diasRestantes} días restantes`}</div>
      </div>`}
  
      <!-- TENDENCIA -->
      ${tendenciaHtml}
  
      <!-- ALERTAS DE PRESUPUESTO -->
      ${alerts.length>0?`
      <div style="background:var(--cardBg);border:1px solid var(--line);border-radius:12px;padding:10px;margin-bottom:10px;">
        <div style="font-size:10px;font-weight:700;color:var(--warn);letter-spacing:1px;margin-bottom:6px;">⚡ ALERTAS DE PRESUPUESTO (${alerts.length})</div>
        ${alerts.map(a=>`
          <div style="padding:7px 0;border-bottom:1px solid var(--line);last-child:border-none;">
            <div style="font-size:11px;">${a.emoji} ${a.msg}</div>
            <div style="font-size:10px;color:var(--muted);">${a.sub}</div>
          </div>`).join("")}
      </div>`:""}
  
      <!-- TOP GASTOS CON BARRA -->
      ${topCats.length>0?`
      <div style="background:var(--cardBg);border:1px solid var(--line);border-radius:12px;padding:10px;margin-bottom:10px;">
        <div style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:1px;margin-bottom:8px;">📂 DISTRIBUCIÓN DE GASTOS</div>
        ${topCats.map(({cat,monto,pctGasto,estado,bud})=>`
          <div style="margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
              <span style="font-size:11px;">${estado} ${cat}</span>
              <span style="font-size:11px;font-weight:700;">${money(monto)} <span style="color:var(--muted);font-weight:400;">(${pctGasto.toFixed(0)}%)</span></span>
            </div>
            <div style="height:4px;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden;">
              <div style="height:100%;width:${Math.min(pctGasto*2,100)}%;background:${pctGasto>40?"var(--bad)":pctGasto>25?"var(--warn)":"var(--ok)"};border-radius:4px;"></div>
            </div>
            ${bud?`<div style="font-size:9px;color:var(--muted);margin-top:1px;">Presupuesto: ${money(bud)} · ${((monto/bud)*100).toFixed(0)}% usado</div>`:""}
          </div>`).join("")}
      </div>`:""}
  
      <!-- CONSEJOS ESPECÍFICOS -->
      ${consejos.length>0?`
      <div style="background:var(--cardBg);border:1px solid var(--line);border-radius:12px;padding:10px;">
        <div style="font-size:10px;font-weight:700;color:var(--primary);letter-spacing:1px;margin-bottom:8px;">💡 ACCIONES CONCRETAS</div>
        ${consejos.slice(0,4).map(c=>`
          <div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--line);">
            <span style="font-size:14px;flex-shrink:0;">${c.ico}</span>
            <span style="font-size:11px;color:var(--text);line-height:1.4;">${c.txt}</span>
          </div>`).join("")}
      </div>`:""}
    `;
    coachEl.innerHTML=html;
  }
function renderCoachNegocio(ing,gas,ah,cats,saldos){
    const coachEl=document.getElementById("coach");
    if(!coachEl){setTimeout(()=>renderCoachNegocio(ing,gas,ah,cats,saldos),100);return;}
  
    const hoy=hoyColombia();
    const diaActual=hoy.getDate();
    const diasMes=new Date(hoy.getFullYear(),hoy.getMonth()+1,0).getDate();
    const diasRestantes=diasMes-diaActual;
    const utilidad=ing-gas;
    const capitalTotal=Object.values(saldos).reduce((a,b)=>a+b,0);
  
    // ── KPIs de negocio ──
    const margen=ing>0?((utilidad/ing)*100):0;
    const burnRate=gas/Math.max(diaActual,1); // gasto diario
    const proyeccionGas=burnRate*diasMes;
    const proyeccionUtil=ing-proyeccionGas;
    const breakEvenDiario=gas>0?(gas/diasMes):0;
    const ingresoDiario=ing/Math.max(diaActual,1);
    const cubreBurnRate=breakEvenDiario>0?(ingresoDiario/breakEvenDiario*100):0;
  
    // ── Métricas de cotizaciones ──
    const cotTotal=cotizaciones.length;
    const cotAprobadas=cotizaciones.filter(c=>c.estado==="aprobada").length;
    const cotEnviadas=cotizaciones.filter(c=>c.estado==="enviada").length;
    const cotRechazadas=cotizaciones.filter(c=>c.estado==="rechazada").length;
    const cotBorrador=cotizaciones.filter(c=>c.estado==="borrador").length;
    const valorAprobado=cotizaciones.filter(c=>c.estado==="aprobada").reduce((s,c)=>s+(c.total||0),0);
    const valorPendiente=cotizaciones.filter(c=>c.estado==="enviada").reduce((s,c)=>s+(c.total||0),0);
    const conversionRate=cotTotal>0?(cotAprobadas/cotTotal*100):0;
    const ticketPromedio=cotAprobadas>0?(valorAprobado/cotAprobadas):0;
    const ticketPromedioTotal=cotTotal>0?(cotizaciones.reduce((s,c)=>s+(c.total||0),0)/cotTotal):0;
  
    // ── Top clientes ──
    const mapaClientes={};
    cotizaciones.forEach(c=>{
      const k=c.clienteId||c.clienteNombre||"Sin cliente";
      if(!mapaClientes[k])mapaClientes[k]={nombre:c.clienteNombre||k,totalAprobado:0,totalPendiente:0,count:0};
      if(c.estado==="aprobada")mapaClientes[k].totalAprobado+=(c.total||0);
      else if(c.estado==="enviada")mapaClientes[k].totalPendiente+=(c.total||0);
      mapaClientes[k].count++;
    });
    const topClientes=Object.values(mapaClientes).sort((a,b)=>b.totalAprobado-a.totalAprobado).slice(0,3);
  
    // ── Alertas presupuesto ──
    const presupuestos=JSON.parse(localStorage.getItem(keyFor("budgets"))||"{}");
    const alerts=[];
    Object.entries(presupuestos).forEach(([cat,lim])=>{
      const g=cats[cat]||0;
      const pct=(g/lim)*100;
      if(pct>=100) alerts.push({lvl:"critical",emoji:"🚨",msg:`<b>${cat}</b> EXCEDIDO en ${money(g-lim)}`,sub:`Presupuesto: ${money(lim)}`});
      else if(pct>=80) alerts.push({lvl:"warn",emoji:"⚠️",msg:`<b>${cat}</b> al ${pct.toFixed(0)}% del presupuesto`,sub:`Restan ${money(lim-g)}`});
    });
  
    // ── Cotizaciones vencidas ──
    const hoyTS=new Date();
    const cotVencidas=cotizaciones.filter(c=>{
      if(c.estado!=="enviada")return false;
      const dias=parseInt(c.validez)||15;
      return Math.floor((hoyTS-new Date(c.createdAt))/(86400000))>dias;
    });
    if(cotVencidas.length>0) alerts.push({lvl:"warn",emoji:"⏰",msg:`${cotVencidas.length} cotización(es) enviada(s) sin respuesta — plazo vencido`,sub:`${money(cotVencidas.reduce((s,c)=>s+(c.total||0),0))} en riesgo`});
  
    // ── Score de salud del negocio ──
    let score=60;
    if(margen>=40) score+=20; else if(margen>=20) score+=10; else if(margen>=10) score+=3; else if(margen<0) score-=30;
    if(cubreBurnRate>=120) score+=10; else if(cubreBurnRate>=100) score+=5; else if(cubreBurnRate<80) score-=15;
    if(conversionRate>=50) score+=10; else if(conversionRate>=30) score+=5; else if(conversionRate<15&&cotTotal>3) score-=10;
    if(cotVencidas.length>0) score-=cotVencidas.length*5;
    if(capitalTotal<0) score-=20;
    score=Math.min(100,Math.max(0,score));
    const scoreLabel=score>=80?"RENTABLE":score>=65?"ESTABLE":score>=45?"AJUSTADO":score>=25?"CRÍTICO":"PELIGRO";
    const scoreColor=score>=80?"#22c55e":score>=65?"#4ade80":score>=45?"#f59e0b":score>=25?"#f97316":"#ef4444";
  
    // ── Tendencia vs mes anterior ──
    let tendenciaHtml="";
    if(historial.length>=1){
      const mp=historial[0];
      const dif=proyeccionUtil-mp.balance;
      const difPct=mp.balance!==0?((dif/Math.abs(mp.balance))*100):0;
      tendenciaHtml=`
        <div style="background:rgba(139,92,246,.08);border:1px solid rgba(139,92,246,.2);border-radius:12px;padding:10px;margin-bottom:10px;">
          <div style="font-size:10px;font-weight:700;color:#a78bfa;margin-bottom:6px;">📊 VS MES ANTERIOR (${mp.label})</div>
          <div class="grid2">
            <div class="kpi"><span>Utilidad previa</span><strong style="color:var(--muted)">${money(mp.balance)}</strong></div>
            <div class="kpi"><span>Proyección actual</span><strong style="color:${proyeccionUtil>=0?"var(--ok)":"var(--bad)"}">${money(proyeccionUtil)}</strong></div>
          </div>
          <div style="font-size:10px;color:var(--muted);margin-top:6px;">
            ${dif>0?`✅ Proyectas ${money(dif)} más que el mes anterior (+${difPct.toFixed(0)}%)`:dif<0?`⚠️ Proyectas ${money(Math.abs(dif))} menos que el mes anterior (${difPct.toFixed(0)}%)`:`→ Rendimiento similar al mes anterior`}
          </div>
        </div>`;
    }
  
    // ── Consejos específicos de negocio ──
    const consejos=[];
    if(utilidad<0) consejos.push({prio:1,ico:"🔴",txt:`Estás perdiendo ${money(Math.abs(utilidad))} este mes. Necesitas ${money(gas)} en ingresos para empatar. Faltan ${money(gas-ing)}.`});
    if(margen>0&&margen<15) consejos.push({prio:2,ico:"⚡",txt:`Margen del ${margen.toFixed(0)}% es bajo. Un margen saludable es 25-40%. Sube precios un 10% o reduce ${money(gas*0.1)} en gastos.`});
    if(cotEnviadas>0) consejos.push({prio:2,ico:"📤",txt:`Tienes ${cotEnviadas} cotización(es) enviada(s) por ${money(valorPendiente)} esperando respuesta. Haz seguimiento hoy.`});
    if(conversionRate<30&&cotTotal>=3) consejos.push({prio:3,ico:"📉",txt:`Conviertes solo el ${conversionRate.toFixed(0)}% de tus cotizaciones. Revisa objeciones frecuentes de tus clientes.`});
    if(cotBorrador>0) consejos.push({prio:3,ico:"📝",txt:`Tienes ${cotBorrador} cotización(es) en borrador sin enviar. Cada día sin enviarlas es ingreso potencial perdido.`});
    if(capitalTotal<gas&&gas>0) consejos.push({prio:2,ico:"🏦",txt:`Tu capital (${money(capitalTotal)}) no cubre ni un mes de gastos (${money(gas)}). Prioriza cobros pendientes.`});
    if (clientes.length > 0 && topClientes.length > 0 && topClientes[0].totalAprobado > valorAprobado * 0.6) consejos.push({ prio: 3, ico: "⚠️", txt: `"${topClientes[0].nombre}" representa más del 60% de tus ingresos. Diversifica tu base de clientes.` });
if (catalogo.length === 0) consejos.push({ prio: 4, ico: "📦", txt: `Sin catálogo definido, tus cotizaciones tardan más. Agrega tus productos/servicios en Catálogo.` });
if (margen >= 30 && cotTotal >= 5) consejos.push({ prio: 4, ico: "🚀", txt: `Margen del ${margen.toFixed(0)}% con ${cotAprobadas} aprobaciones. Momento de escalar: más canales de venta o subir ticket promedio.` });
if (consejos.length === 0) {
  if (margen >= 15 && utilidad >= 0) {
    consejos.push({ prio: 4, ico: "✅", txt: `Tu negocio va estable: margen del ${margen.toFixed(0)}% y utilidad de ${money(utilidad)} este mes. Sigue así y considera reinvertir en inventario o marketing.` });
  } else {
    consejos.push({ prio: 4, ico: "📊", txt: `Margen actual: ${margen.toFixed(0)}% · Utilidad: ${money(utilidad)}. Sigue registrando cotizaciones y gastos para consejos más precisos.` });
  }
  if (cotTotal === 0) {
    consejos.push({ prio: 4, ico: "📄", txt: `Aún no tienes cotizaciones registradas este mes. Crea tu primera cotización para ver métricas de conversión.` });
  }
}
consejos.sort((a, b) => a.prio - b.prio);
  
    // ── HTML FINAL ──
    let html=`
      <!-- HEADER SCORE -->
      <div style="background:linear-gradient(135deg,rgba(245,158,11,.15),rgba(249,115,22,.08));border:1px solid rgba(245,158,11,.25);border-radius:16px;padding:14px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div>
            <div style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:1px;">ESTADO DEL NEGOCIO</div>
            <div style="font-size:28px;font-weight:900;color:${scoreColor};line-height:1;">${score}<span style="font-size:14px;font-weight:700;">/100</span></div>
            <div style="font-size:10px;font-weight:700;color:${scoreColor};letter-spacing:1px;">${scoreLabel}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:10px;color:var(--muted);">Día ${diaActual} · ${diasRestantes} restantes</div>
            <div style="font-size:13px;font-weight:700;margin-top:4px;">Utilidad proyectada</div>
            <div style="font-size:16px;font-weight:800;color:${proyeccionUtil>=0?"var(--ok)":"var(--bad)"};">${money(proyeccionUtil)}</div>
            <div style="font-size:9px;color:var(--muted);">al ritmo actual</div>
          </div>
        </div>
        <div style="height:6px;background:rgba(255,255,255,.08);border-radius:6px;overflow:hidden;">
          <div style="height:100%;width:${score}%;background:linear-gradient(90deg,${scoreColor},${scoreColor}aa);border-radius:6px;"></div>
        </div>
      </div>
  
      <!-- KPIs FINANCIEROS -->
      <div class="grid4" style="margin-bottom:10px;">
        <div class="kpi"><span>💵 Ingresos</span><strong style="color:var(--ok)">${money(ing)}</strong></div>
        <div class="kpi"><span>💸 Gastos</span><strong style="color:var(--bad)">${money(gas)}</strong></div>
        <div class="kpi"><span>📈 Margen</span><strong style="color:${margen>=25?"var(--ok)":margen>=10?"var(--warn)":"var(--bad)"}">${margen.toFixed(0)}%</strong></div>
        <div class="kpi"><span>🏦 Capital</span><strong>${money(capitalTotal)}</strong></div>
      </div>
  
      <!-- BURN RATE Y COBERTURA -->
      <div style="background:${cubreBurnRate>=100?"rgba(34,197,94,.08)":"rgba(239,68,68,.08)"};border:1px solid ${cubreBurnRate>=100?"rgba(34,197,94,.2)":"rgba(239,68,68,.2)"};border-radius:12px;padding:10px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:10px;color:var(--muted);">BURN RATE DIARIO</div>
            <div style="font-size:18px;font-weight:800;color:var(--bad);">${money(burnRate)}<span style="font-size:11px;font-weight:500;">/día</span></div>
            <div style="font-size:9px;color:var(--muted);">Ingreso diario: ${money(ingresoDiario)}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:10px;color:var(--muted);">COBERTURA</div>
            <div style="font-size:22px;font-weight:900;color:${cubreBurnRate>=100?"var(--ok)":cubreBurnRate>=80?"var(--warn)":"var(--bad)"};">${cubreBurnRate.toFixed(0)}%</div>
            <div style="font-size:9px;color:var(--muted);">${cubreBurnRate>=100?"Ingresos cubren gastos":"⚠️ Déficit operativo"}</div>
          </div>
        </div>
      </div>
  
      <!-- KPIs DE COTIZACIONES -->
      <div style="background:var(--cardBg);border:1px solid var(--line);border-radius:12px;padding:10px;margin-bottom:10px;">
        <div style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:1px;margin-bottom:8px;">📄 EMBUDO DE COTIZACIONES</div>
        <div class="grid4" style="margin-bottom:8px;">
          <div class="kpi"><span>🔄 Total</span><strong>${cotTotal}</strong></div>
          <div class="kpi"><span>✅ Aprob.</span><strong style="color:var(--ok)">${cotAprobadas}</strong></div>
          <div class="kpi"><span>📤 Enviadas</span><strong style="color:var(--warn)">${cotEnviadas}</strong></div>
          <div class="kpi"><span>🎯 Conversión</span><strong style="color:${conversionRate>=40?"var(--ok)":conversionRate>=20?"var(--warn)":"var(--bad)"}">${conversionRate.toFixed(0)}%</strong></div>
        </div>
        ${cotTotal>0?`
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-bottom:4px;">
          <span>Valor aprobado: <b style="color:var(--ok)">${money(valorAprobado)}</b></span>
          <span>Pendiente: <b style="color:var(--warn)">${money(valorPendiente)}</b></span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);">
          <span>Ticket prom. aprobado: <b>${money(ticketPromedio)}</b></span>
          <span>Prom. general: <b>${money(ticketPromedioTotal)}</b></span>
        </div>`:"<div class='small'>Crea tu primera cotización para ver métricas</div>"}
      </div>
  
      <!-- TENDENCIA -->
      ${tendenciaHtml}
  
      <!-- ALERTAS -->
      ${alerts.length>0?`
      <div style="background:var(--cardBg);border:1px solid var(--line);border-radius:12px;padding:10px;margin-bottom:10px;">
        <div style="font-size:10px;font-weight:700;color:var(--warn);letter-spacing:1px;margin-bottom:6px;">⚡ ALERTAS (${alerts.length})</div>
        ${alerts.map(a=>`
          <div style="padding:7px 0;border-bottom:1px solid var(--line);">
            <div style="font-size:11px;">${a.emoji} ${a.msg}</div>
            <div style="font-size:10px;color:var(--muted);">${a.sub}</div>
          </div>`).join("")}
      </div>`:""}
  
      <!-- TOP CLIENTES -->
      ${topClientes.length>0?`
      <div style="background:var(--cardBg);border:1px solid var(--line);border-radius:12px;padding:10px;margin-bottom:10px;">
        <div style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:1px;margin-bottom:8px;">🏆 TOP CLIENTES</div>
        ${topClientes.map((c,i)=>`
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--line);">
            <div>
              <div style="font-size:11px;font-weight:700;">${["🥇","🥈","🥉"][i]} ${c.nombre}</div>
              ${c.totalPendiente>0?`<div style="font-size:9px;color:var(--warn);">${money(c.totalPendiente)} pendiente de aprobación</div>`:""}
            </div>
            <div style="text-align:right;">
              <div style="font-size:12px;font-weight:800;color:var(--ok);">${money(c.totalAprobado)}</div>
              <div style="font-size:9px;color:var(--muted);">${c.count} cotización(es)</div>
            </div>
          </div>`).join("")}
      </div>`:""}
  
      <!-- ACCIONES CONCRETAS -->
      ${consejos.length>0?`
      <div style="background:var(--cardBg);border:1px solid var(--line);border-radius:12px;padding:10px;">
        <div style="font-size:10px;font-weight:700;color:#f59e0b;letter-spacing:1px;margin-bottom:8px;">⚡ ACCIONES CONCRETAS</div>
        ${consejos.slice(0,4).map(c=>`
          <div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--line);">
            <span style="font-size:14px;flex-shrink:0;">${c.ico}</span>
            <span style="font-size:11px;color:var(--text);line-height:1.4;">${c.txt}</span>
          </div>`).join("")}
      </div>`:""}
    `;
    coachEl.innerHTML=html;
  }
function renderCoach(ing,gas,ah,cats,saldos){if(contexto==="negocio"){renderCoachNegocio(ing,gas,ah,cats,saldos);}else{renderCoachPersonal(ing,gas,ah,cats,saldos);}}
function render(){const seen=new Set();data=data.filter(d=>{const id=String(d.ID);if(seen.has(id))return false;seen.add(id);return true;});let ing=0,gas=0,ah=0,cats={};[...data].sort((a,b)=>new Date(b.Fecha)-new Date(a.Fecha)).forEach(x=>{const m=Number(x.Monto)||0;if(x.Tipo==="Ingreso")ing+=m;else if(x.Tipo==="Gasto"){gas+=m;cats[x.Categoría]=(cats[x.Categoría]||0)+m}if(String(x.Categoría||"").includes("Ahorro"))ah+=m;});const saldos=calcSaldos(),total=Object.values(saldos).reduce((a,b)=>a+b,0);if(puedeVerDinero())$("saldoTop").innerText=money(total);else $("saldoTop").innerText="🔒 Sin acceso";
if(puedeVerDinero()){$("streakBox").innerText=money(ing-gas);const hi=$("headerIngresos"); if(hi) hi.innerText=money(ing);const hg=$("headerGastos"); if(hg) hg.innerText=money(gas);}else{$("streakBox").innerText="—";const hi=$("headerIngresos"); if(hi) hi.innerText="—";const hg=$("headerGastos"); if(hg) hg.innerText="—";}
$("cuentasResumen").innerHTML=$("distBar").innerHTML=$("distLegend").innerHTML="";;const tp=cuentas.reduce((a,c)=>a+Math.max(saldos[c.id]||0,0),1)||1;cuentas.forEach((c,i)=>{const s=saldos[c.id]||0,color=ACC_COLORS[i%ACC_COLORS.length];$("cuentasResumen").innerHTML+=`<div class="cuenta-card"><div class="cuenta-left"><div class="cuenta-icon">${c.icon}</div><div class="cuenta-name">${c.nombre}</div></div><div class="cuenta-saldo ${s>=0?"positive":"negative"}">${money(s)}</div></div>`;$("distBar").innerHTML+=`<div class="dist-seg" style="width:${Math.max(s,0)/tp*100}%;background:${color}"></div>`;$("distLegend").innerHTML+=`<div class="dist-item"><div class="dist-dot" style="background:${color}"></div>${c.icon} ${c.nombre}</div>`;});const hoy=hoyColombia(),ts=hoy.getFullYear()+"-"+String(hoy.getMonth()+1).padStart(2,"0")+"-"+String(hoy.getDate()).padStart(2,"0");const hoyG=data.filter(x=>x.Fecha===ts&&x.Tipo==="Gasto").reduce((a,b)=>a+Number(b.Monto||0),0);
const hh=$("headerHoy"); if(hh) hh.innerText=money(hoyG);
const hm=$("headerMovs"); if(hm) hm.innerText = esTecnico() ? "—" : data.length;
const hf=$("headerFecha"); if(hf) hf.innerText=new Date().toLocaleDateString("es-CO",{weekday:"short",day:"numeric",month:"short"});
$("cockpit").innerHTML=`<div class="grid2"><div class="kpi"><span>Hoy</span><strong>${money(hoyG)}</strong></div><div class="kpi"><span>Balance</span><strong>${money(ing-gas)}</strong></div><div class="kpi"><span>Ahorro</span><strong>${money(ah)}</strong></div><div class="kpi"><span>Disp/día</span><strong>${money(Math.max((ing-gas)/Math.max(hoy.getDate(),1),0))}</strong></div></div>`;renderCoach(ing,gas,ah,cats,saldos);const favs={};data.forEach(x=>{if(x.Tipo==="Transferencia"||x.Tipo?.includes("Traspaso"))return;const k=x.Categoría+"|"+x.Descripción+"|"+x.Monto+"|"+(x.Cuenta||"");if(!favs[k])favs[k]={cat:x.Categoría,des:x.Descripción,monto:x.Monto,cuenta:x.Cuenta,count:0};favs[k].count++;});const topFavs=Object.values(favs).sort((a,b)=>b.count-a.count).slice(0,4);$("favList").innerHTML=topFavs.length?topFavs.map(f=>`<button class="secondary" onclick="usarFav('${f.cat}','${f.des}',${f.monto},'${f.cuenta||""}')" style="font-size:10px;padding:6px">${f.cat}<br><small>${f.des}</small><br><small>${money(f.monto)}</small></button>`).join(""):'<div class="small">Sin favoritos</div>';const goalsFiltradas=goals.filter(g=>(g.contexto||"personal")===contexto);const goalsIndices=goals.map((g,i)=>({g,i})).filter(({g})=>(g.contexto||"personal")===contexto);$("goalList").innerHTML=goalsIndices.length?goalsIndices.map(({g,i})=>{const ab=g.abonado||0;const p=Math.min((ab/g.valor)*100,100);const cumplida=ab>=g.valor;return`<div class="item" style="border-left-color:${cumplida?'var(--ok)':'var(--primary)'}"><div style="font-weight:700;font-size:12px">${cumplida?'🎉 ':''}${g.nombre}</div><div class="small">${money(ab)} / ${money(g.valor)} (${p.toFixed(0)}%)</div><div class="progress"><div class="bar" style="width:${p}%;background:${cumplida?'var(--ok)':'linear-gradient(90deg,var(--primary),#7c3aed)'}"></div></div><div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap;"><button class="small-btn success-btn" onclick="abonarMeta(${i})" ${cumplida?'disabled':''}>💰 Abonar</button><button class="small-btn warn-btn" onclick="retirarMeta(${i})" ${ab<=0?'disabled':''}>↩️ Retirar</button><button class="small-btn" onclick="delGoal(${i})" style="background:rgba(239,68,68,.15);color:var(--bad);">🗑️</button></div></div>`}).join(""):'<div class="alert mid">Sin metas para '+( contexto==="negocio"?"🏪 Negocio":"👤 Personal")+'</div>';actualizarContadorPendientes();}
function usarFav(cat,des,monto,cuenta){setMode("gasto",document.querySelectorAll(".mode-tab")[1]);$("categoria").value=cat;$("descripcion").value=des;$("montoInput").value=Number(monto).toLocaleString("es-CO");if(cuenta)$("cuentaSel").value=cuenta;toast("Cargado");}
function setFiltro(tipo,btn){filtroTipo=tipo;document.querySelectorAll(".filter-chip").forEach(c=>c.classList.remove("active"));btn.classList.add("active");renderLista();}
function renderLista(){const busq=($("searchInput")?.value||"").toLowerCase().trim(),cf=$("filterCuentaSel")?.value||"",orden=$("filterOrden")?.value||"fecha_desc";let f=[...data].filter(x=>{if(filtroTipo==="ingreso"&&x.Tipo!=="Ingreso")return false;if(filtroTipo==="gasto"&&x.Tipo!=="Gasto")return false;if(filtroTipo==="transferencia"&&x.Tipo!=="Transferencia")return false;if(filtroTipo==="traspaso"&&x.Tipo!=="TraspasoSalida"&&x.Tipo!=="TraspasoEntrada")return false;if(cf&&x.Cuenta!==cf&&x.CuentaOrigen!==cf&&x.CuentaDestino!==cf)return false;if(busq&&!((x.Descripción||"")+" "+(x.Categoría||"")+" "+(x.Nota||"")).toLowerCase().includes(busq))return false;return true;});f.sort((a,b)=>{if(orden==="fecha_desc")return new Date(b.Fecha||0)-new Date(a.Fecha||0);if(orden==="fecha_asc")return new Date(a.Fecha||0)-new Date(b.Fecha||0);if(orden==="monto_desc")return Number(b.Monto||0)-Number(a.Monto||0);if(orden==="monto_asc")return Number(a.Monto||0)-Number(b.Monto||0);return 0;});$("searchResultCount").innerText=f.length+" resultado"+(f.length!==1?"s":"");$("lista").innerHTML="";if(!f.length){$("lista").innerHTML='<div class="alert mid">Sin resultados</div>';return}let ld="";f.forEach(x=>{const m=Number(x.Monto)||0,cls=x.Tipo==="Ingreso"?"ingreso":x.Tipo==="Gasto"?"gasto":x.Tipo==="Transferencia"?"transferencia":"traspaso";if(orden.startsWith("fecha")&&x.Fecha!==ld){$("lista").innerHTML+=`<div class="timeline-day">${labelDay(x.Fecha)}</div>`;ld=x.Fecha}let cl="";if(x.Tipo==="Transferencia"){const o=cuentas.find(c=>c.id===x.CuentaOrigen),d=cuentas.find(c=>c.id===x.CuentaDestino);cl=`<span class="badge">🔄 ${o?.icon||""}→${d?.icon||""}</span>`;}else if(x.Cuenta){const c=cuentas.find(cu=>cu.id===x.Cuenta);if(c)cl=`<span class="badge">${c.icon} ${c.nombre}</span>`;}$("lista").innerHTML+=`<div class="item ${cls}"><div>${x.Categoría||""} - ${x.Descripción||""}${cl}</div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:3px"><b>${money(m)}</b><div style="display:flex;gap:4px">${(x.Tipo==="Ingreso"||x.Tipo==="Gasto")?`<button class="warn-btn" onclick="abrirEditar('${x.ID}')" style="padding:3px 6px;font-size:9px">✏️</button>`:""}<button class="small-btn" onclick="borrar('${x.ID}')" style="padding:3px 6px;font-size:9px">🗑️</button></div></div></div>`;});}
function abrirEditar(id){const x=data.find(d=>String(d.ID)===String(id));if(!x||x.Tipo==="Transferencia"||x.Tipo?.includes("Traspaso")){toast("No editable");return}editandoId=String(id);const ec=$("editCategoria");ec.innerHTML="";const modo=x.Tipo==="Ingreso"?"ingreso":"gasto";categorias.filter(c=>c.tipo==="ambos"||c.tipo===modo).forEach(c=>{const o=document.createElement("option");o.value=c.icon+" "+c.nombre;o.textContent=c.icon+" "+c.nombre;if(o.value===x.Categoría)o.selected=true;ec.appendChild(o);});const ecu=$("editCuenta");ecu.innerHTML="";cuentas.forEach(c=>{const o=document.createElement("option");o.value=c.id;o.textContent=c.icon+" "+c.nombre;if(c.id===x.Cuenta)o.selected=true;ecu.appendChild(o);});$("editFecha").value=x.Fecha||"";$("editDescripcion").value=x.Descripción||"";$("editMonto").value=Number(x.Monto||0).toLocaleString("es-CO");$("editNota").value=x.Nota||"";$("modalEditar").classList.add("open");}
async function confirmarEdicion(){const x=data.find(d=>String(d.ID)===String(editandoId));if(!x){$("modalEditar").classList.remove("open");return}const m=parseMonto($("editMonto").value);if(!$("editDescripcion").value.trim()||m<=0){toast("Completa");return}x.Fecha=$("editFecha").value;x.Categoría=$("editCategoria").value;x.Descripción=$("editDescripcion").value.trim();x.Monto=m;x.Cuenta=$("editCuenta").value;x.Nota=$("editNota").value.trim();guardarDatos();$("modalEditar").classList.remove("open");if(window.db&&window.auth?.currentUser&&!String(editandoId).startsWith("local_")){try{const ctx=x.Contexto||contexto;const colName=ctx==="negocio"?"movimientos_negocio":"movimientos_personal";await window.fbUpdateDoc(window.fbDoc(window.db,"users",window.auth.currentUser.uid,colName,String(editandoId)),{Fecha:x.Fecha,Categoría:x.Categoría,Descripción:x.Descripción,Monto:x.Monto,Cuenta:x.Cuenta,Nota:x.Nota});}catch(e){}}render();editandoId=null;toast("✔ Actualizado");}
function cancelarFormProducto() {
    delete $("formProducto").dataset.editandoId;
  ["prodCodigo", "prodNombre", "prodDescripcion", "prodPrecio", "prodCosto", "prodCategoria"]
  .forEach(id => { const el = $(id); if (el) el.value = ""; });
  $("prodIVA").value = "19";
  $("formProducto").querySelector("button.primary").textContent = "💾 Guardar Producto";
  $("formProducto").style.display = "none";
  }
function renderHistorial(){if(!historial.length){$("historialCard").style.display="none";return}$("historialCard").style.display="block";$("historialLista").innerHTML=historial.map((m,i)=>`<div class="item" style="cursor:pointer" onclick="toggleMes(${i})"><div style="display:flex;justify-content:space-between"><span style="font-weight:700">📅 ${m.label}</span><span id="ma${i}">▶</span></div><div class="small">Ing: ${money(m.ing)} · Gas: ${money(m.gas)} · Bal: ${money(m.ing-m.gas)}</div><div style="display:none;margin-top:4px" id="mb${i}">${m.movimientos?.slice(0,3).map(x=>`<div>${x.Categoría||""} - ${x.Descripción||""}: ${money(x.Monto)}</div>`).join("")}</div></div>`).join("")}
function abrirCierre(){const s=calcSaldos(),ing=data.filter(x=>x.Tipo==="Ingreso").reduce((a,x)=>a+Number(x.Monto||0),0),gas=data.filter(x=>x.Tipo==="Gasto").reduce((a,x)=>a+Number(x.Monto||0),0);let h=`<div class="grid2" style="margin-bottom:8px"><div class="kpi"><span>Ingresos</span><strong style="color:var(--ok)">${money(ing)}</strong></div><div class="kpi"><span>Gastos</span><strong style="color:var(--bad)">${money(gas)}</strong></div></div>`;cuentas.forEach(c=>{h+=`<div style="font-size:11px;margin-bottom:3px">${c.icon} ${c.nombre}: ${money(s[c.id]||0)}</div>`});$("modalResumen").innerHTML=h;$("modalCierre").classList.add("open");}
function verHistorialCompleto(){if(historial.length===0){toast("📭 No hay meses cerrados aún");return;}let html=`<div class="modal" style="max-width: 500px;"><h3>📆 Historial de Meses Cerrados</h3><div style="max-height: 60vh; overflow-y: auto;">`;historial.forEach((mes,i)=>{html+=`<div class="item" style="margin-bottom: 8px;"><div style="display: flex; justify-content: space-between;"><span style="font-weight: 700;">📅 ${mes.label}</span><span class="small">${mes.fecha||''}</span></div><div class="grid2" style="margin-top: 6px;"><div class="kpi"><span>💵 Ingresos</span><strong style="color: var(--ok)">${money(mes.ing)}</strong></div><div class="kpi"><span>💸 Gastos</span><strong style="color: var(--bad)">${money(mes.gas)}</strong></div><div class="kpi"><span>⚖️ Balance</span><strong>${money(mes.balance)}</strong></div><div class="kpi"><span>📊 Movimientos</span><strong>${mes.movimientos?.length||0}</strong></div></div><button class="small-btn" style="margin-top: 6px;" onclick="verDetalleMes(${i})">🔍 Ver detalles</button><button class="small-btn warn-btn" style="margin-top: 6px;" onclick="exportarMes(${i})">📥 Exportar CSV</button></div>`;});html+=`</div><div class="modal-btns" style="margin-top: 12px;"><button class="primary" onclick="this.closest('.modal-overlay').classList.remove('open')">Cerrar</button></div></div>`;let modal=document.getElementById('modalHistorial');if(!modal){modal=document.createElement('div');modal.id='modalHistorial';modal.className='modal-overlay';document.body.appendChild(modal);}modal.innerHTML=html;modal.classList.add('open');}
function verDetalleMes(index){const mes=historial[index];if(!mes)return;let html=`<div class="modal"><h3>📅 ${mes.label}</h3><div class="grid2" style="margin-bottom: 12px;"><div class="kpi"><span>💰 Ingresos</span><strong style="color:var(--ok)">${money(mes.ing)}</strong></div><div class="kpi"><span>💸 Gastos</span><strong style="color:var(--bad)">${money(mes.gas)}</strong></div><div class="kpi"><span>⚖️ Balance</span><strong>${money(mes.balance)}</strong></div><div class="kpi"><span>🏦 Ahorro</span><strong>${mes.ing>0?((mes.ing-mes.gas)/mes.ing*100).toFixed(0):0}%</strong></div></div><div class="title" style="font-size: 14px;">🏦 Saldos de cierre</div>${mes.cuentas?.map(c=>`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--line);"><span>${c.icon} ${c.nombre}</span><span class="${c.saldoFinal>=0?'positive':'negative'}">${money(c.saldoFinal)}</span></div>`).join('')||''}<div class="modal-btns" style="margin-top: 12px;"><button class="secondary" onclick="this.closest('.modal-overlay').classList.remove('open')">Cerrar</button></div></div>`;let modal=document.getElementById('modalDetalleMes');if(!modal){modal=document.createElement('div');modal.id='modalDetalleMes';modal.className='modal-overlay';document.body.appendChild(modal);}modal.innerHTML=html;modal.classList.add('open');}
function renderComparativa(){const el=$("compareContent");if(!el)return;const meses=[];historial.slice(0,5).forEach(m=>meses.push({label:m.label,ing:m.ing,gas:m.gas}));const ingA=data.filter(x=>x.Tipo==="Ingreso").reduce((a,x)=>a+Number(x.Monto||0),0),gasA=data.filter(x=>x.Tipo==="Gasto").reduce((a,x)=>a+Number(x.Monto||0),0);meses.unshift({label:"Este mes",ing:ingA,gas:gasA,actual:true});const maxV=Math.max(...meses.map(m=>Math.max(m.ing,m.gas)),1);el.innerHTML=meses.map(m=>`<div style="margin-bottom:10px;padding:10px;background:var(--cardBg);border-radius:12px;border:1px solid ${m.actual?"var(--primary)":"var(--line)"}"><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-weight:700;font-size:12px">${m.label}${m.actual?' <span class="badge">actual</span>':""}</span><span style="font-size:11px;color:${m.ing-m.gas>=0?"var(--ok)":"var(--bad)"}">Bal: ${money(m.ing-m.gas)}</span></div><div class="compare-bar-wrap"><div class="compare-label">💰 Ing: ${money(m.ing)}</div><div class="compare-bar-bg"><div class="compare-bar-fill" style="width:${(m.ing/maxV*100).toFixed(1)}%;background:var(--ok)"></div></div></div><div class="compare-bar-wrap"><div class="compare-label">💸 Gas: ${money(m.gas)}</div><div class="compare-bar-bg"><div class="compare-bar-fill" style="width:${(m.gas/maxV*100).toFixed(1)}%;background:var(--bad)"></div></div></div></div>`).join("")}
function agregarInversion(){const tipo=$("invTipo").value,nombre=$("invNombre").value.trim(),monto=parseFloat(($("invMonto").value||"0").replace(/\./g,"").replace(",","."))||0,rent=parseFloat(($("invRentabilidad").value||"0").replace(",","."))||0;if(!nombre||monto<=0){toast("Completa");return}inversiones.push({id:"inv_"+Date.now(),tipo,nombre,monto,rentabilidad:rent,fecha:fechaHoyColombia()});guardarDatos();$("invNombre").value=$("invMonto").value=$("invRentabilidad").value="";$("formInversion").style.display="none";renderInversiones();toast("📈 Inversión agregada")}
function eliminarInversion(id){inversiones=inversiones.filter(i=>i.id!==id);guardarDatos();renderInversiones()}
function mostrarFormPrestamo(){$("formPrestamo").style.display=$("formPrestamo").style.display==="none"?"block":"none";if($("formPrestamo").style.display==="block"){const sel=$("prestamoCuenta");sel.innerHTML="";cuentas.forEach(c=>{sel.innerHTML+=`<option value="${c.id}">${c.icon} ${c.nombre}</option>`})}}
function switchPrestamoTab(tipo,btn){prestamoFiltro=tipo;document.querySelectorAll("#dash-prestamos .tab-mini").forEach(t=>t.classList.remove("active"));btn.classList.add("active");renderPrestamos()}
function agregarPrestamo(){const tipo=$("prestamoTipo").value,persona=$("prestamoPersona").value.trim(),monto=parseMonto($("prestamoMonto").value),cuenta=$("prestamoCuenta").value,vencimiento=$("prestamoVencimiento").value,nota=$("prestamoNota").value.trim(),interes=parseFloat(($("prestamoInteres").value||"0").replace(",","."))||0;if(!persona||monto<=0||!vencimiento){toast("Completa persona, monto y fecha");return}prestamos.push({id:"prestamo_"+Date.now(),tipo,persona,monto,cuenta,vencimiento,nota,interes,fecha:fechaHoyColombia(),pagos:[],estado:"pendiente"});guardarDatos();$("prestamoPersona").value=$("prestamoMonto").value=$("prestamoNota").value=$("prestamoInteres").value="";$("formPrestamo").style.display="none";renderPrestamos();toast("💳 Préstamo registrado")}
function registrarPagoPrestamo(id){const p=prestamos.find(x=>x.id===id);if(!p)return;const monto=parseFloat(prompt("Monto del pago:","0")||"0");if(monto<=0)return;p.pagos.push({monto,fecha:fechaHoyColombia()});const totalPagado=p.pagos.reduce((a,x)=>a+x.monto,0);if(totalPagado>=p.monto)p.estado="pagado";else if(new Date(p.vencimiento)<hoyColombia())p.estado="atrasado";guardarDatos();renderPrestamos()}
function eliminarPrestamo(id){if(!confirm("¿Eliminar?"))return;prestamos=prestamos.filter(p=>p.id!==id);guardarDatos();renderPrestamos()}
function renderPrestamos(){let filtrados=prestamos;if(prestamoFiltro==="recibidos")filtrados=prestamos.filter(p=>p.tipo==="recibido");else if(prestamoFiltro==="otorgados")filtrados=prestamos.filter(p=>p.tipo==="otorgado");$("prestamosLista").innerHTML=filtrados.length?filtrados.map(p=>{const totalPagado=p.pagos.reduce((a,x)=>a+x.monto,0),restante=p.monto-totalPagado,pct=Math.min((totalPagado/p.monto)*100,100);return`<div class="prestamo-card prestamo-${p.tipo==="recibido"?"recibido":"otorgado"}"><div style="display:flex;justify-content:space-between;align-items:start"><div><div style="font-weight:700;font-size:13px">${p.tipo==="recibido"?"📥":"📤"} ${p.persona}</div><div class="small">${money(p.monto)} · ${p.interes>0?`Interés: ${p.interes}%`:'Sin interés'}</div><div class="small">Vence: ${new Date(p.vencimiento+'T00:00:00').toLocaleDateString("es-CO")}</div><div class="small">Restante: ${money(restante)}</div><span class="prestamo-status ${p.estado}">${p.estado==="pendiente"?"Pendiente":p.estado==="pagado"?"Pagado":"Atrasado"}</span></div><div style="display:flex;flex-direction:column;gap:4px">${p.estado!=="pagado"?`<button class="success-btn" onclick="registrarPagoPrestamo('${p.id}')">💵 Pagar</button>`:''}<button class="small-btn" onclick="eliminarPrestamo('${p.id}')">🗑️</button></div></div><div class="progress" style="margin-top:6px"><div class="bar" style="width:${pct}%;background:${pct>=100?'var(--ok)':'var(--warn)'}"></div></div><div class="small" style="text-align:right;margin-top:2px">${pct.toFixed(0)}% pagado</div></div>`}).join(""):'<div class="alert mid">Sin préstamos</div>';const totalDebe=prestamos.filter(p=>p.tipo==="recibido"&&p.estado!=="pagado").reduce((a,p)=>a+(p.monto-p.pagos.reduce((s,x)=>s+x.monto,0)),0);const totalLeDeben=prestamos.filter(p=>p.tipo==="otorgado"&&p.estado!=="pagado").reduce((a,p)=>a+(p.monto-p.pagos.reduce((s,x)=>s+x.monto,0)),0);$("prestamosResumen").innerHTML=`<div class="grid2"><div class="kpi"><span>Debes</span><strong style="color:var(--bad)">${money(totalDebe)}</strong></div><div class="kpi"><span>Te deben</span><strong style="color:var(--ok)">${money(totalLeDeben)}</strong></div><div class="kpi"><span>Balance neto</span><strong style="color:${totalLeDeben-totalDebe>=0?'var(--ok)':'var(--bad)'}">${money(totalLeDeben-totalDebe)}</strong></div><div class="kpi"><span>⚠️ Atrasados</span><strong style="color:var(--bad)">${prestamos.filter(p=>p.estado==="atrasado").length}</strong></div></div>`}
function switchDashTab(tab,btn){["finanzas","inversiones","prestamos","negocio"].forEach(t=>{const el=$("dash-"+t);if(el)el.style.display="none"});document.querySelectorAll("#tab-dashboard .tab-mini").forEach(t=>t.classList.remove("active"));btn.classList.add("active");const el=$("dash-"+tab);if(el)el.style.display="block";if(tab==="finanzas")setTimeout(renderCharts,300);if(tab==="inversiones")renderInversiones();if(tab==="prestamos")renderPrestamos();if(tab==="negocio")renderDashboardNegocio()}
function setMode(mode,btn){modoActual=mode;document.querySelectorAll(".mode-tab").forEach(t=>t.classList.remove("active"));btn.classList.add("active");document.querySelectorAll(".form-section").forEach(s=>s.classList.remove("active"));if(mode==="transferencia")$("fs-transfer").classList.add("active");else if(mode==="traspaso"){$("fs-traspaso").classList.add("active");poblarTraspaso();}else{$("fs-normal").classList.add("active");poblarCat(mode==="ingreso"?"ingreso":"gasto")}}
function addCategoria(){const icon=$("newCatIcon").value.trim()||"📌",nombre=$("newCatNombre").value.trim(),tipo=$("newCatTipo").value;if(!nombre){toast("Nombre");return}categorias.push({id:nombre.toLowerCase().replace(/\s+/g,"_")+"_"+Date.now(),nombre,icon,tipo});guardarDatos();$("newCatIcon").value=$("newCatNombre").value="";renderCatsAdmin();poblarCat("ingreso");toast("✔ Agregada")}
function delCategoria(id){categorias=categorias.filter(c=>c.id!==id);guardarDatos();renderCatsAdmin();poblarCat("ingreso")}
function renderCatsAdmin(){
    // Si categorias está vacío, intentar recuperar desde localStorage
    if(!categorias || categorias.length === 0){
      const guardadas = localStorage.getItem(keyForCtx("categorias", contexto));
      if(guardadas) categorias = JSON.parse(guardadas);
    }
    // Si sigue vacío, mostrar mensaje
    if(!categorias || categorias.length === 0){
      $("catsAdmin").innerHTML = '<div class="alert mid">Sin categorías. Agrega una abajo.</div>';
      return;
    }
   $("catsAdmin").innerHTML = categorias.map(c =>
      `<div class="cat-chip">${c.icon} ${c.nombre} <button onclick="delCategoria('${c.id}')">✕</button></div>`
    ).join("");
  }
function renderCuentasAdmin(){
        const cont=$("cuentasAdmin");
        if(!cont)return;
        if(!cuentas||cuentas.length===0){
          cont.innerHTML='<div class="alert mid">Sin cuentas. Agrega una abajo.</div>';
          return;
        }
        const saldos=calcSaldos();
        cont.innerHTML=cuentas.map(c=>{
          const s=saldos[c.id]||0;
          return `<div class="cuenta-card">
            <div class="cuenta-left">
              <div class="cuenta-icon">${c.icon}</div>
              <div>
                <div class="cuenta-name">${c.nombre}</div>
                <div class="cuenta-saldo ${s>=0?"positive":"negative"}">${money(s)}</div>
              </div>
            </div>
            <div style="display:flex;gap:4px;">
              <button class="small-btn warn-btn" onclick="abrirEditarCuenta('${c.id}')" style="font-size:9px;">✏️</button>
              <button class="small-btn" onclick="delCuenta('${c.id}')" style="font-size:9px;background:rgba(239,68,68,.15);color:var(--bad);">🗑️</button>
            </div>
          </div>`;
        }).join("");
      }
function renderBudgets(){const el=$("budgetList"),b=getBudgets();if(!Object.keys(b).length){el.innerHTML='<div class="alert mid">Sin presupuestos</div>';return}const gr={};data.filter(x=>x.Tipo==="Gasto").forEach(x=>{gr[x.Categoría]=(gr[x.Categoría]||0)+Number(x.Monto||0)});el.innerHTML=Object.entries(b).map(([cat,lim])=>{const g=gr[cat]||0,pct=Math.min((g/lim)*100,100);return`<div class="item"><div style="display:flex;justify-content:space-between"><span>${cat}</span><button class="small-btn" onclick="delBudget('${cat.replace(/'/g,"\\'")}')">🗑️</button></div><div class="small">${money(g)} / ${money(lim)} (${pct.toFixed(0)}%)</div><div class="progress"><div class="bar" style="width:${pct}%;background:${pct>=100?'var(--bad)':pct>=80?'var(--warn)':'var(--ok)'}"></div></div></div>`}).join("")}
function renderRecList(){const el=$("recList"),r=JSON.parse(localStorage.getItem(keyFor("recurrentes"))||"[]");if(!r.length){el.innerHTML='<div class="alert mid">Sin recurrentes</div>';return}el.innerHTML='<div class="small" style="margin-bottom:6px">Total fijo: <b>'+money(r.reduce((a,x)=>a+(x.monto||0),0))+'</b></div>'+r.map(x=>'<div class="item" style="display:flex;justify-content:space-between"><div><div style="font-weight:600;font-size:12px">'+x.cat+' · '+x.desc+'</div><div class="small">'+x.cuenta+' · <b>'+money(x.monto)+'</b></div></div><button class="small-btn" onclick="delRec(\''+x.id+'\')">🗑️</button></div>').join("")}
function startVoice(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  recognition=new SR();
  recognition.lang="es-CO";
  recognition.interimResults=true;
  $("voiceBtn").classList.add("listening");
  $("voiceBtn").innerHTML="🎤...";
  $("voiceFeedback").classList.add("active");
  $("voiceFeedback").innerHTML="👂 Habla...";
  isListening=true;
  
  recognition.onresult=(e)=>{
  const t=e.results[0][0].transcript;
  if(!e.results[0].isFinal){
  $("voiceFeedback").innerHTML='📝 "'+t+'"';
  } else {
  let monto=0;
  const texto=t.toLowerCase().trim();
  
  // ── Millones ──
  const m1=texto.match(/(\d+[\d.,]*)\s*millones?/i);
  // ── Miles con número escrito: "10 mil", "10.000", "10,000" ──
  const m2=texto.match(/(\d+[\d.,]*)\s*mil/i);
  // ── Números con punto o coma como separador de miles: 10.000 / 10,000 ──
  const m3=texto.match(/(\d{1,3})[.,](\d{3})(?:[.,]\d+)?/);
  // ── Número simple ──
  const m4=texto.match(/(\d[\d.,]*)/);
  
  if(m1){
  monto=parseFloat(m1[1].replace(/\./g,"").replace(",","."))*1e6;
  } else if(m2){
  monto=parseFloat(m2[1].replace(/\./g,"").replace(",","."))*1e3;
  } else if(m3){
  // "10.000" o "10,000" → 10000
  monto=parseInt(m3[1]+m3[2]);
  } else if(m4){
  monto=parseFloat(m4[1].replace(/\./g,"").replace(",","."));
  }
  
  monto=Math.round(monto);
  
  if(monto>0){
  setMode("gasto",document.querySelectorAll(".mode-tab")[1]);
  $("descripcion").value=texto;
  $("montoInput").value=monto.toLocaleString("es-CO");
  $("voiceFeedback").innerHTML="✅ $"+monto.toLocaleString("es-CO")+"<br><small>Revisa y guarda</small>";
  } else {
  $("voiceFeedback").innerHTML="❌ No detecté monto. Intenta de nuevo";
  }
  stopVoice();
  }
  };
  
  recognition.onerror=()=>{
  $("voiceFeedback").innerHTML="❌ Error de micrófono";
  stopVoice();
  };
  recognition.start();
  }
function stopVoice(){if(recognition)recognition.stop();$("voiceBtn").classList.remove("listening");$("voiceBtn").innerHTML="🎤 Voz";isListening=false}
function diag(){$("diagContent").innerHTML="✅ Firebase: "+(window.db?"OK":"NO")+"<br>👤 "+(window.auth?.currentUser?.email||"Sin sesión")+"<br>💾 "+data.length+" movimientos<br>📡 "+(navigator.onLine?"Online":"Offline")+"<br>🎨 Tema: "+temaActual+"<br>📈 Inv: "+inversiones.length+"<br>💳 Prest: "+prestamos.length+"<br>👥 Clientes: "+clientes.length+"<br>📦 Catálogo: "+catalogo.length+"<br>📄 Cotizaciones: "+cotizaciones.length}
function aplicarTema(tema){temaActual=tema;localStorage.setItem("tema",tema);document.body.className=document.body.className.replace(/tema-\w+/g,"");document.body.classList.add("tema-"+tema);document.querySelectorAll(".tema-preview").forEach(t=>t.classList.remove("activo"));const p=$("tema"+tema.charAt(0).toUpperCase()+tema.slice(1));if(p)p.classList.add("activo");if(contexto==="negocio")document.body.classList.add("modo-negocio");toast("🎨 Tema "+tema)}
function renderHistorialAdmin(){const el=$("historialAdminLista");if(!el)return;const cardAdmin=$("cardAdminHistorial");const cardHist=$("cardHistorialMeses");if(esTecnico()){if(cardAdmin)cardAdmin.style.display="none";if(cardHist)cardHist.style.display="none";return;}if(cardAdmin)cardAdmin.style.display="";if(cardHist)cardHist.style.display="";if(!historial.length){el.innerHTML='<div class="alert mid">No hay meses cerrados en el historial</div>';return}el.innerHTML=historial.map((m,i)=>`<div class="item" style="display:flex;justify-content:space-between;align-items:center"><div><div style="font-weight:700;font-size:13px">📅 ${m.label}</div><div class="small">Ing: ${money(m.ing)} · Gas: ${money(m.gas)} · Bal: ${money(m.ing-m.gas)}</div><div class="small">${m.movimientos?.length||0} movimientos</div></div><button class="small-btn" onclick="eliminarMesHistorial(${i})" style="width:auto;background:rgba(239,68,68,.15);color:var(--bad)">🗑️</button></div>`).join("")}
function eliminarMesHistorial(index){const mes=historial[index];if(!confirm(`¿Eliminar "${mes.label}" del historial?`))return;historial.splice(index,1);localStorage.setItem(keyFor("historialMeses"),JSON.stringify(historial));renderHistorialAdmin();toast("🗑️ Mes eliminado: "+mes.label)}
function renderDashboardNegocio(){
        if(!$("kpiNegocio"))return;const kpis=document.getElementById("kpiNegocio");const ultCot=document.getElementById("ultimasCotizaciones");const                         topCli=document.getElementById("topClientes");if(kpis){const totalCotizaciones=cotizaciones.length;
        const cotAprobadas=cotizaciones.filter(c=>c.estado==="aprobada").length;
        const totalAprobado=cotizaciones.filter(c=>c.estado==="aprobada").reduce((sum,c)=>sum+(c.total||0),0);
        const ventasTotales=data.filter(d=>d.Tipo==="Ingreso").reduce((sum,d)=>sum+(d.Monto||0),0);
        const utilidadRealAprobada=cotizaciones.filter(c=>c.estado==="aprobada").reduce((sum,c)=>{
          return sum+(c.productos||[]).reduce((s,p)=>{
            const prod=catalogo.find(x=>x.id===p.productoId);
            return s+((p.precioUnitario||0)-(prod?.costo||0))*p.cantidad;
          },0);
        },0);
        kpis.innerHTML=`<div class="kpi"><span>📄 Cotizaciones</span><strong>${totalCotizaciones}</strong></div><div class="kpi"><span>✅ Aprobadas</span><strong>${cotAprobadas}</strong></div><div class="kpi"><span>💰 Ventas</span><strong>${money(ventasTotales)}</strong></div><div class="kpi"><span>📊 Conversión</span><strong>${totalCotizaciones>0?((cotAprobadas/totalCotizaciones)*100).toFixed(0):0}%</strong></div><div class="kpi" style="grid-column:span 2"><span>💎 Utilidad real (precio − costo)</span><strong style="color:${utilidadRealAprobada>=0?'var(--ok)':'var(--bad)'}">${money(utilidadRealAprobada)}</strong></div>`;}if(ultCot){const ultimas=cotizaciones.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,3);if(ultimas.length){ultCot.innerHTML=ultimas.map(c=>`<div style="font-size:11px;padding:6px;border-bottom:1px solid var(--line)">${c.numero} - ${c.clienteNombre} - ${money(c.total)}</div>`).join("");}else ultCot.innerHTML='<div class="alert mid">Sin cotizaciones</div>';}if(topCli){const clientesTop={};cotizaciones.forEach(c=>{const key=c.clienteId||c.clienteNombre||'Sin cliente';if(!clientesTop[key])clientesTop[key]={nombre:c.clienteNombre||key,total:0};clientesTop[key].total+=(c.total||0);});const top=Object.values(clientesTop).sort((a,b)=>b.total-a.total).slice(0,3);if(top.length){topCli.innerHTML=top.map(c=>`<div style="font-size:11px;padding:6px;">👤 ${c.nombre} - ${money(c.total)}</div>`).join("");}else topCli.innerHTML='<div class="alert mid">Sin clientes con cotizaciones</div>';}// Al final de renderDashboardNegocio, antes del último }
  grafVentasMes();
  renderCobrarVsCapital();
  renderRentabilidadCat();
  }
function renderCobrarVsCapital() {
  const el = document.getElementById("cobrarVsCapital");
  if (!el) return;
  const saldos = calcSaldos();
  const capitalReal = Object.values(saldos).reduce((a, b) => a + b, 0);
  const porCobrar = facturas.filter(f => f.estado === "pendiente").reduce((s, f) => s + (f.total || 0), 0);
  const porCobrarOrdenes = ordenes.filter(o => o.estado === "listo" && !o.facturaId).reduce((s, o) => s + (o.precioEstimado || 0), 0);
  const totalPorCobrar = porCobrar + porCobrarOrdenes;
  const capitalTotal = capitalReal + totalPorCobrar;
  const pctReal = capitalTotal > 0 ? (capitalReal / capitalTotal * 100) : 0;
  const pctCobrar = capitalTotal > 0 ? (totalPorCobrar / capitalTotal * 100) : 0;
  
  el.innerHTML = `
  <div class="grid2" style="margin-bottom:12px;">
    <div class="kpi"><span>🏦 En cuentas</span><strong style="color:var(--ok);">${money(capitalReal)}</strong></div>
    <div class="kpi"><span>📄 Por cobrar</span><strong style="color:var(--warn);">${money(totalPorCobrar)}</strong></div>
    <div class="kpi"><span>💎 Capital total</span><strong>${money(capitalTotal)}</strong></div>
    <div class="kpi"><span>📋 Facturas pend.</span><strong style="color:var(--warn);">${facturas.filter(f=>f.estado==="pendiente").length}</strong></div>
  </div>
  <div style="height:10px;border-radius:8px;overflow:hidden;display:flex;margin-bottom:8px;">
    <div style="width:${pctReal.toFixed(1)}%;background:var(--ok);transition:width .3s;"></div>
    <div style="width:${pctCobrar.toFixed(1)}%;background:var(--warn);transition:width .3s;"></div>
  </div>
  <div style="display:flex;gap:12px;font-size:10px;color:var(--muted);">
    <span>🟢 En cuentas ${pctReal.toFixed(0)}%</span>
    <span>🟡 Por cobrar ${pctCobrar.toFixed(0)}%</span>
  </div>
  ${facturas.filter(f=>f.estado==="pendiente").length > 0 ? `
  <div style="margin-top:10px;">
    <div style="font-size:10px;font-weight:700;color:var(--warn);margin-bottom:6px;">FACTURAS PENDIENTES</div>
    ${facturas.filter(f=>f.estado==="pendiente").slice(0,3).map(f=>{
    const dias = Math.floor((new Date()-new Date(f.fecha))/86400000);
    return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--line);font-size:11px;">
      <span>${f.numero} · ${f.clienteNombre}</span>
      <span style="color:${dias>14?" var(--bad)":"var(--warn)"};font-weight:700;">${money(f.total)} (${dias}d)</span>
    </div>`;
    }).join("")}
  </div>` : '<div class="alert good" style="margin-top:8px;">✅ Sin facturas pendientes</div>'}
  `;
  }
function renderRentabilidadCat() {
  const el = document.getElementById("rentabilidadCat");
  if (!el) return;
  const mapa = {};
  cotizaciones.filter(c => c.estado === "aprobada").forEach(c => {
  (c.productos || []).forEach(p => {
  const prod = catalogo.find(x => x.id === p.productoId);
  const costo = prod?.costo || 0;
  const precio = p.precioUnitario || 0;
  const cat = prod?.categoria || p.nombre?.split(" ")[0] || "Sin categoría";
  if (!mapa[cat]) mapa[cat] = { ventas: 0, costo: 0, unidades: 0 };
  mapa[cat].ventas += precio * p.cantidad;
  mapa[cat].costo += costo * p.cantidad;
  mapa[cat].unidades += p.cantidad;
  });
  });
  const cats = Object.entries(mapa)
  .map(([cat, d]) => ({ cat, ...d, utilidad: d.ventas - d.costo, margen: d.ventas > 0 ? ((d.ventas - d.costo) / d.ventas * 100) : 0 }))
  .filter(x => x.ventas > 0)
  .sort((a, b) => b.utilidad - a.utilidad)
  .slice(0, 8);
  
  if (!cats.length) {
  el.innerHTML = '<div class="alert mid">Aprueba cotizaciones con productos del catálogo para ver rentabilidad</div>';
  return;
  }
  const maxUtil = Math.max(...cats.map(x => x.utilidad), 1);
  el.innerHTML = cats.map(c => `
  <div style="margin-bottom:10px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
      <span style="font-size:11px;font-weight:600;">${c.cat}</span>
      <div style="text-align:right;">
        <span style="font-size:12px;font-weight:800;color:${c.margen>=30?" var(--ok)":c.margen>=15?"var(--warn)":"var(--bad)"};">${money(c.utilidad)}</span>
        <span style="font-size:10px;color:var(--muted);margin-left:4px;">${c.margen.toFixed(0)}%</span>
      </div>
    </div>
    <div style="height:6px;background:rgba(255,255,255,.08);border-radius:6px;overflow:hidden;">
      <div style="height:100%;width:${(c.utilidad/maxUtil*100).toFixed(1)}%;background:${c.margen>=30?" var(--ok)":c.margen>=15?"var(--warn)":"var(--bad)"};border-radius:6px;"></div>
    </div>
    <div style="font-size:9px;color:var(--muted);margin-top:2px;">Ventas: ${money(c.ventas)} · Costo: ${money(c.costo)} · ${c.unidades} ud.</div>
  </div>`).join("");
  }
window.renderCobrarVsCapital = renderCobrarVsCapital;
window.renderRentabilidadCat = renderRentabilidadCat;
function filtrarClientesChips(q) {
    const lista = $("listaChipsClientes");
    if (!lista) return;
    const query = (q || "").toLowerCase().trim();
    const filtrados = query ?
      clientes.filter(c =>
        c.nombre.toLowerCase().includes(query) ||
        (c.empresa || "").toLowerCase().includes(query) ||
        (c.nit || "").toLowerCase().includes(query)
      ) :
      clientes;
    
    if (filtrados.length === 0) {
      lista.style.display = "block";
      lista.innerHTML = '<div style="padding:10px;font-size:12px;color:var(--muted);">Sin resultados</div>';
      return;
    }
    
    lista.style.display = "block";
    lista.innerHTML = filtrados.map(c => `
      <div onclick="elegirCliente('${c.id}')"
        style="padding:10px 12px;border-bottom:1px solid var(--line);cursor:pointer;font-size:12px;display:flex;flex-direction:column;gap:2px;">
        <span style="font-weight:700;">${c.nombre}</span>
        <span style="color:var(--muted);font-size:10px;">${c.empresa||''}${c.nit?' · NIT: '+c.nit:''}</span>
      </div>
    `).join("");
  }
function seleccionarClienteCot(id) {
    elegirCliente(id);
    $("modalClientes").classList.remove("open");
  }
window.renderLista=renderLista;
window.renderBudgets=renderBudgets;
window.renderRecList=renderRecList;
window.renderCuentasAdmin=renderCuentasAdmin;
window.renderCatsAdmin=renderCatsAdmin;
window.renderPrestamos=renderPrestamos;
window.renderHistorialAdmin=renderHistorialAdmin;
window.abrirModalClientes=abrirModalClientes;
window.abrirModalCatalogo=abrirModalCatalogo;
function duplicarCotizacion(id) {
        const original = cotizaciones.find(c => c.id === id);
        if (!original) return;
        const nueva = {
          ...JSON.parse(JSON.stringify(original)),
          id: "cot_" + Date.now(),
          numero: generarNumeroCot(),
          estado: "borrador",
          fecha: fechaHoyColombia(),
          createdAt: new Date().toISOString()
        };
        cotizaciones.push(nueva);
        guardarDatosNegocio();
        renderListaCotizaciones();
        toast("📋 Cotización clonada: " + nueva.numero);
      }
function toggleFormClienteRapido() {
  const f = document.getElementById("formClienteRapido");
  if (!f) return;
  const abriendo = f.style.display === "none";
  f.style.display = abriendo ? "block" : "none";
  if (abriendo) {
    ["cliRapidoNombre","cliRapidoEmpresa","cliRapidoNIT","cliRapidoEmail","cliRapidoTelefono"]
      .forEach(id => { const el = document.getElementById(id); if(el) el.value = ""; });
    setTimeout(() => { const n = document.getElementById("cliRapidoNombre"); if(n) n.focus(); }, 100);
  }
}
function toggleFormProductoRapido() {
  const f = document.getElementById("formProductoRapido");
  if (!f) return;
  const abriendo = f.style.display === "none";
  f.style.display = abriendo ? "block" : "none";
  if (abriendo) {
    ["prodRapidoNombre","prodRapidoPrecio","prodRapidoCosto","prodRapidoCategoria"]
      .forEach(id => { const el = document.getElementById(id); if(el) el.value = ""; });
    const iva = document.getElementById("prodRapidoIVA"); if(iva) iva.value = "19";
    setTimeout(() => { const n = document.getElementById("prodRapidoNombre"); if(n) n.focus(); }, 100);
  }
}
window.toggleFormClienteRapido = toggleFormClienteRapido;
window.toggleFormProductoRapido = toggleFormProductoRapido;
async function restaurarCuentasPredeterminadas() {
  if(!confirm("¿Restaurar las cuentas predeterminadas? Solo se agregan si no existen ya.")) return;
  const uid = window.auth?.currentUser?.uid || "guest";
  const defC = {
    personal: [
      {id:"nequi_"+uid,    nombre:"Nequi",          icon:"📱", saldoInicial:0},
      {id:"davivienda_"+uid,nombre:"Davivienda",     icon:"🏦", saldoInicial:0},
      {id:"efectivo_"+uid, nombre:"Efectivo",        icon:"💵", saldoInicial:0}
    ],
    negocio: [
      {id:"caja_neg_"+uid, nombre:"Caja Negocio",   icon:"🏪", saldoInicial:0},
      {id:"banco_neg_"+uid,nombre:"Banco Negocio",  icon:"🏦", saldoInicial:0}
    ]
  };

  const predeterminadas = defC[contexto] || defC.personal;
  let agregadas = 0;

  predeterminadas.forEach(def => {
    // Solo agregar si no existe ya una cuenta con ese mismo ID
    const yaExiste = cuentas.some(c => c.id === def.id);
    if(!yaExiste){
      cuentas.push(def);
      agregadas++;
    }
  });

  if(agregadas > 0){
    await guardarCuentas(contexto);
    guardarDatos();
    poblarSelects();
    render();
    renderCuentasAdmin();
    toast("✅ " + agregadas + " cuenta(s) predeterminada(s) restaurada(s)");
  } else {
    toast("ℹ️ Las cuentas predeterminadas ya existen");
  }
}
async function importarCatalogoTecnoYork() {
  const MI_UID = "ehvt48aV7BUBDKUC8YXVaNRNjO63";
  if ((window.auth?.currentUser?.uid || "") !== MI_UID) {
    toast("🔒 Solo disponible para el administrador");
    return;
  }
  if (!confirm("¿Importar " + CATALOGO_TECNOYORK.length + " productos de TecnoYork? Los existentes se conservarán.")) return;
    const btns = [document.getElementById("btnImportarTY"), document.getElementById("btnImportarTYInv")].filter(Boolean);
btns.forEach(b => { b.disabled = true; b.textContent = "⏳ Importando..."; });
    try {
      const noTY = catalogo.filter(p => !p.id.startsWith("prod_tecnoyork_"));
      catalogo = [...noTY, ...CATALOGO_TECNOYORK];
  guardarCatalogoNegocio();
  renderListaCatalogo();
      toast("✅ " + CATALOGO_TECNOYORK.length + " productos importados");
    } catch(e) {
      toast("❌ Error: " + e.message);
      console.error(e);
    }
    btns.forEach(b => { b.disabled = false; b.textContent = "📦 Importar Catálogo TecnoYork (578 productos)"; });
  }
function buscarProdEnOrden(q) {
    const lista = document.getElementById("listaProdOrden");
    if (!lista) return;
    const query = (q || "").toLowerCase().trim();
    if (!query || query.length < 2) { lista.style.display = "none"; return; }
    const resultados = catalogo.filter(p =>
      p.nombre.toLowerCase().includes(query) ||
      (p.codigo || "").toLowerCase().includes(query) ||
      (p.categoria || "").toLowerCase().includes(query)
    ).slice(0, 10);
    if (!resultados.length) { lista.style.display = "none"; return; }
    lista.style.display = "block";
    lista.innerHTML = resultados.map(p => `
      <div onclick="seleccionarProdOrden('${p.id}')"
        style="padding:10px 12px;border-bottom:1px solid var(--line);cursor:pointer;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:700;font-size:12px;">${p.nombre}</div>
          <div style="font-size:10px;color:var(--muted);">${p.categoria || ''}</div>
        </div>
        <div style="font-weight:800;color:var(--ok);font-size:13px;white-space:nowrap;">${money(p.precio)}</div>
      </div>`).join("");
  }
function seleccionarProdOrden(prodId) {
    const p = catalogo.find(x => x.id === prodId);
    if (!p) return;
    ordenProductoSeleccionadoId = prodId;
    const inp = document.getElementById("ordenPrecioEstimado");
    if (inp) inp.value = p.precio.toLocaleString("es-CO");
    const prob = document.getElementById("ordenProblema");
    if (prob && !prob.value.trim()) prob.value = p.nombre;
    document.getElementById("listaProdOrden").style.display = "none";
    document.getElementById("buscarProdOrden").value = p.nombre;
    toast("✅ " + p.nombre + " → " + money(p.precio) + " (se descontará 1 unidad al entregar)");
  }
function verHistorialOrden(id) {
    const orden = ordenes.find(o => o.id === id);
    if (!orden) return;
    const hist = orden.historialEstados || [];
    const est = ESTADOS_ORDEN;
    let html = `<div class="modal" style="max-width:400px;">
      <h3>📋 Historial — ${orden.numero}</h3>
      <div style="font-size:12px;color:var(--muted);margin-bottom:12px;">📱 ${orden.marca} ${orden.modelo || ''} · ${orden.clienteNombre}</div>`;
    if (!hist.length) {
      html += '<div class="alert mid">Sin historial registrado</div>';
    } else {
      html += '<div style="position:relative;">';
      hist.slice().reverse().forEach((h, i) => {
        const e = est[h.estado] || { label: h.estado, color: "var(--muted)" };
        const fecha = new Date(h.fecha).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
        html += `<div style="display:flex;gap:10px;margin-bottom:12px;">
          <div style="flex-shrink:0;width:10px;height:10px;border-radius:50%;background:${e.color};margin-top:4px;box-shadow:0 0 6px ${e.color};"></div>
          <div>
            <div style="font-weight:700;font-size:12px;color:${e.color};">${e.label}</div>
            <div style="font-size:10px;color:var(--muted);">${fecha}</div>
            ${h.nota ? `<div style="font-size:11px;color:var(--text);margin-top:2px;">${h.nota}</div>` : ""}
          </div>
        </div>`;
      });
      html += '</div>';
    }
    html += `<button class="secondary" onclick="this.closest('.modal-overlay').classList.remove('open')" style="margin-top:8px;width:100%;">Cerrar</button></div>`;
    let modal = document.getElementById("_modalHistOrden");
    if (!modal) { modal = document.createElement("div"); modal.id = "_modalHistOrden"; modal.className = "modal-overlay"; document.body.appendChild(modal); }
    modal.innerHTML = html;
    modal.classList.add("open");
  }
window.abrirModalEntregaOrden = abrirModalEntregaOrden;
window.abrirModalFirma = abrirModalFirma;
window.abrirModalPagoFactura = abrirModalPagoFactura;
window.renderListaFacturas = renderListaFacturas;
function toggleNotifPanel(){
    const p=$("notifPanel"); if(!p)return;
    p.classList.toggle("open");
    if(p.classList.contains("open")) renderNotifPanel();
  }
function renderNotifPanel(){
    const cont=$("notifList");
    const n=getNotificaciones().sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
    if(!n.length){cont.innerHTML='<div class="notif-empty">Sin notificaciones 🎉</div>';return;}
    cont.innerHTML=n.map(x=>`
      <div class="notif-item ${x.leida?'read':'unread'}" onclick="marcarLeida('${x.id}')">
        <div class="notif-dot"></div>
        <div class="notif-content">
          <div class="notif-title">${x.titulo}</div>
          <div class="notif-msg">${x.mensaje}</div>
          <div class="notif-time">${new Date(x.fecha).toLocaleString("es-CO",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</div>
        </div>
        <button class="notif-del" onclick="event.stopPropagation();eliminarNotificacion('${x.id}')">🗑️</button>
      </div>`).join("");
  }
function marcarLeida(id){let n=getNotificaciones();const it=n.find(x=>x.id===id);if(it&&!it.leida){it.leida=true;guardarNotificaciones(n);actualizarBadgeNotif();renderNotifPanel();}}
function marcarTodasLeidas(){let n=getNotificaciones();n.forEach(x=>x.leida=true);guardarNotificaciones(n);actualizarBadgeNotif();renderNotifPanel();}
function abrirModalRecuperar() {
  const modal = document.getElementById("modalRecuperar");
  if (!modal) return;
  modal.classList.add("open");
  const emailInput = document.getElementById("loginEmail");
  const recuperarEmail = document.getElementById("recuperarEmail");
  if (recuperarEmail && emailInput) recuperarEmail.value = emailInput.value || "";
  const errorEl = document.getElementById("recuperarError");
  if (errorEl) errorEl.style.display = "none";
}
function cerrarModalRecuperar() {
  const modal = document.getElementById("modalRecuperar");
  if (modal) modal.classList.remove("open");
}
async function enviarRecuperacion() {
    const email = document.getElementById("recuperarEmail")?.value?.trim() || "";
    const errorEl = document.getElementById("recuperarError");
    const btn = document.getElementById("btnEnviarRecuperacion");
    
    if (!email || !email.includes("@") || !email.includes(".")) {
        if (errorEl) {
            errorEl.textContent = "📧 Ingresa un correo electrónico válido";
            errorEl.style.display = "block";
        }
        return;
    }
    
    if (errorEl) errorEl.style.display = "none";
    if (btn) { btn.disabled = true; btn.textContent = "⏳ Enviando..."; }
    
    try {
        if (typeof window.fbSendPasswordReset === "function") {
            await window.fbSendPasswordReset(email);
            toast("📧 Se envió un enlace de recuperación a " + email);
            cerrarModalRecuperar();
        } else {
            throw new Error("Firebase no está listo");
        }
    } catch (error) {
        console.error("Error al recuperar contraseña:", error);
        let msg = "❌ Error al enviar el correo de recuperación";
        if (error.code === "auth/user-not-found") {
            msg = "❌ No existe una cuenta con ese correo electrónico";
        } else if (error.code === "auth/invalid-email") {
            msg = "❌ Correo electrónico inválido";
        } else if (error.code === "auth/too-many-requests") {
            msg = "⏳ Demasiados intentos. Espera un momento.";
        }
        if (errorEl) {
            errorEl.textContent = msg;
            errorEl.style.display = "block";
        }
    }
    
    if (btn) { btn.disabled = false; btn.textContent = "Enviar enlace"; }
}
async function abonarMeta(i){const g=goals[i];if(!g)return;const restante=g.valor-(g.abonado||0);const raw=prompt(`💰 ¿Cuánto abonas a "${g.nombre}"?\nFalta: ${money(restante)}`,"");if(raw===null)return;const monto=parseMonto(raw);if(monto<=0){toast("⚠️ Monto inválido");return;}const saldos=calcSaldos();let optsHTML="";cuentas.forEach(c=>{const s=saldos[c.id]||0;optsHTML+=`<option value="${c.id}">${c.icon} ${c.nombre} (${money(s)})</option>`;});const overlayId="_modalAbonoMeta";let ov=document.getElementById(overlayId);if(ov)ov.remove();ov=document.createElement("div");ov.id=overlayId;ov.className="modal-overlay open";ov.style.zIndex="3000";ov.innerHTML=`<div class="modal" style="max-width:360px;"><h3>💰 Abonar a "${g.nombre}"</h3><p class="small" style="margin-bottom:12px;">Monto: <b>${money(monto)}</b> · Faltaba: <b>${money(restante)}</b></p><label>Cuenta origen</label><select id="_abonoCuenta" style="margin-bottom:12px;">${optsHTML}</select><div class="modal-btns"><button class="secondary" onclick="document.getElementById('${overlayId}').remove()">Cancelar</button><button class="primary" id="_btnConfirmarAbono">✔ Confirmar</button></div></div>`;document.body.appendChild(ov);document.getElementById("_btnConfirmarAbono").onclick=async()=>{const cuentaId=document.getElementById("_abonoCuenta").value;const saldoCuenta=calcSaldos()[cuentaId]||0;if(monto>saldoCuenta){toast("❌ Saldo insuficiente en esa cuenta");return;}const datos={Fecha:fechaHoyColombia(),Tipo:"Gasto",Cuenta:cuentaId,Categoría:"🎯 Meta: "+g.nombre,Descripción:"Abono meta: "+g.nombre,Monto:monto,Nota:"Abono a meta",Contexto:contexto};await guardarConOffline(datos,contexto);goals[i].abonado=(goals[i].abonado||0)+monto;guardarDatos();render();document.getElementById(overlayId).remove();toast(`✅ Abonado ${money(monto)} a "${g.nombre}" desde cuenta seleccionada`);};}
async function retirarMeta(i){const g=goals[i];if(!g||(g.abonado||0)<=0)return;const raw=prompt(`↩️ ¿Cuánto retiras de "${g.nombre}"?\nAbonado: ${money(g.abonado||0)}`,"");if(raw===null)return;const monto=parseMonto(raw);if(monto<=0){toast("⚠️ Monto inválido");return;}if(monto>(g.abonado||0)){toast("❌ No puedes retirar más de lo abonado");return;}const saldos=calcSaldos();let optsHTML="";cuentas.forEach(c=>{const s=saldos[c.id]||0;optsHTML+=`<option value="${c.id}">${c.icon} ${c.nombre} (${money(s)})</option>`;});const overlayId="_modalRetiroMeta";let ov=document.getElementById(overlayId);if(ov)ov.remove();ov=document.createElement("div");ov.id=overlayId;ov.className="modal-overlay open";ov.style.zIndex="3000";ov.innerHTML=`<div class="modal" style="max-width:360px;"><h3>↩️ Retirar de "${g.nombre}"</h3><p class="small" style="margin-bottom:12px;">Monto: <b>${money(monto)}</b> · El dinero regresa a tu cuenta</p><label>Cuenta destino</label><select id="_retiroCuenta" style="margin-bottom:12px;">${optsHTML}</select><div class="modal-btns"><button class="secondary" onclick="document.getElementById('${overlayId}').remove()">Cancelar</button><button class="primary" id="_btnConfirmarRetiro">✔ Confirmar</button></div></div>`;document.body.appendChild(ov);document.getElementById("_btnConfirmarRetiro").onclick=async()=>{const cuentaId=document.getElementById("_retiroCuenta").value;const datos={Fecha:fechaHoyColombia(),Tipo:"Ingreso",Cuenta:cuentaId,Categoría:"↩️ Retiro meta: "+g.nombre,Descripción:"Retiro meta: "+g.nombre,Monto:monto,Nota:"Retiro de meta",Contexto:contexto};await guardarConOffline(datos,contexto);goals[i].abonado=Math.max(0,(goals[i].abonado||0)-monto);guardarDatos();render();document.getElementById(overlayId).remove();toast(`↩️ Retirado ${money(monto)} de "${g.nombre}" — ingreso registrado`);};}
window.abrirModalRecuperar = abrirModalRecuperar;
window.cerrarModalRecuperar = cerrarModalRecuperar;
window.abrirEditar = function(id) {
  const x = data.find(d => String(d.ID) === String(id));
  if (!x) { toast("❌ Movimiento no encontrado"); return; }
  if (x.Tipo === "Transferencia" || (x.Tipo || "").includes("Traspaso")) {
    toast("⚠️ Las transferencias y traspasos no son editables");
    return;
  }
  editandoId = String(id);

  // Poblar categorías
  const ec = document.getElementById("editCategoria");
  if (ec) {
    ec.innerHTML = "";
    const modo = x.Tipo === "Ingreso" ? "ingreso" : "gasto";
    categorias
      .filter(c => c.tipo === "ambos" || c.tipo === modo)
      .forEach(c => {
        const val = c.icon + " " + c.nombre;
        const o = document.createElement("option");
        o.value = val;
        o.textContent = val;
        if (val === x.Categoría) o.selected = true;
        ec.appendChild(o);
      });
    // Si la categoría actual no está en la lista, agregarla al inicio
    if (x.Categoría && !Array.from(ec.options).some(o => o.value === x.Categoría)) {
      const o = document.createElement("option");
      o.value = x.Categoría;
      o.textContent = x.Categoría;
      o.selected = true;
      ec.insertBefore(o, ec.firstChild);
    }
  }

  // Poblar cuentas
  const ecu = document.getElementById("editCuenta");
  if (ecu) {
    ecu.innerHTML = "";
    cuentas.forEach(c => {
      const o = document.createElement("option");
      o.value = c.id;
      o.textContent = c.icon + " " + c.nombre;
      if (c.id === x.Cuenta) o.selected = true;
      ecu.appendChild(o);
    });
  }

  // Rellenar campos
  const ef = document.getElementById("editFecha");
  if (ef) ef.value = x.Fecha || "";
  const ed = document.getElementById("editDescripcion");
  if (ed) ed.value = x.Descripción || "";
  const em = document.getElementById("editMonto");
  if (em) em.value = Number(x.Monto || 0).toLocaleString("es-CO");
  const en = document.getElementById("editNota");
  if (en) en.value = x.Nota || "";

  const modal = document.getElementById("modalEditar");
  if (modal) modal.classList.add("open");
};
window.abrirModalRevertirCompra = function(id) {
  const compra = compras.find(c => c.id === id);
  if (!compra) { toast("❌ Compra no encontrada"); return; }
  if (compra.estado !== "pagada") { toast("⚠️ Solo se pueden revertir compras pagadas"); return; }

  compraPagandoId = id; // reutilizamos la variable global

  // Modal reutilizable — crearlo dinámicamente si no existe
  let modal = document.getElementById("_modalRevertirCompra");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "_modalRevertirCompra";
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="modal" style="max-width:380px;">
        <h3>↩️ Revertir compra</h3>
        <p class="small" id="_revertirCompraInfo" style="margin-bottom:12px;"></p>
        <div class="alert mid" style="margin-bottom:12px;font-size:11px;">
          ⚠️ Esto creará un ingreso por el monto de la compra y revertirá el stock.<br>
          El ingreso irá a la cuenta donde estaba el dinero originalmente.
        </div>
        <label>Cuenta donde regresa el dinero</label>
        <select id="_revertirCompraCuenta" style="margin-bottom:12px;"></select>
        <div class="modal-btns">
          <button class="secondary" onclick="document.getElementById('_modalRevertirCompra').classList.remove('open')">Cancelar</button>
          <button class="primary" onclick="confirmarRevertirCompra()">↩️ Revertir</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  // Rellenar info
  const info = document.getElementById("_revertirCompraInfo");
  if (info) info.textContent = `Compra ${compra.numero} · ${compra.proveedorNombre} · ${money(compra.total)}`;

  // Poblar cuentas
  const sel = document.getElementById("_revertirCompraCuenta");
  if (sel) {
    sel.innerHTML = "";
    cuentas.forEach(c => {
      const o = document.createElement("option");
      o.value = c.id;
      o.textContent = c.icon + " " + c.nombre;
      // Preseleccionar la cuenta original si existe
      if (compra.cuentaPago && c.id === compra.cuentaPago) o.selected = true;
      sel.appendChild(o);
    });
  }

  modal.classList.add("open");
};
window.confirmarPagoCompra = async function() {
  const compra = compras.find(c => c.id === compraPagandoId);
  if (!compra) { toast("❌ Compra no encontrada"); return; }
  const cuentaId = document.getElementById("pagoCompraCuenta")?.value;
  if (!cuentaId) { toast("Selecciona una cuenta"); return; }

  // Verificar saldo
  const saldos = calcSaldos();
  const saldoCuenta = saldos[cuentaId] || 0;
  if (compra.total > saldoCuenta) {
    toast(`❌ Saldo insuficiente. Tienes ${money(saldoCuenta)} en esa cuenta`);
    return;
  }

  const ctxGuardar = "negocio";
  const datos = {
    Fecha: fechaHoyColombia(),
    Tipo: "Gasto",
    Cuenta: cuentaId,
    Categoría: "📦 Inventario",
    Descripción: "Compra " + compra.numero + " - " + compra.proveedorNombre,
    Monto: compra.total,
    Nota: "Pago compra a proveedor",
    Contexto: ctxGuardar
  };

  const idMov = await guardarConOffline(datos, ctxGuardar);

  if (contexto === "negocio") {
    const seen = new Set();
    data = data.filter(d => { const id = String(d.ID); if (seen.has(id)) return false; seen.add(id); return true; });
    guardarDatos();
    render();
  }

  compra.estado = "pagada";
  compra.fechaPago = fechaHoyColombia();
  compra.cuentaPago = cuentaId;
  compra.movimientoId = idMov;
  guardarInventarioNegocio();

  document.getElementById("modalPagoCompra")?.classList.remove("open");
  compraPagandoId = null;
  renderListaCompras();
  toast("✅ Compra pagada — gasto de " + money(compra.total) + " registrado");
};
window.renderListaCompras = function() {
  const cont = document.getElementById("listaComprasInv");
  if (!cont) return;

  let filtradas = [...compras];
  if (compraFiltroActual !== "todas") filtradas = filtradas.filter(c => c.estado === compraFiltroActual);
  filtradas.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const elPagar = document.getElementById("comprasKpiPagar");
  const elMes   = document.getElementById("comprasKpiMes");
  if (elPagar) elPagar.innerText = money(compras.filter(c => c.estado === "pendiente").reduce((s, c) => s + c.total, 0));
  if (elMes) {
    const mesActual = fechaHoyColombia().slice(0, 7);
    elMes.innerText = money(compras.filter(c => c.fecha.startsWith(mesActual)).reduce((s, c) => s + c.total, 0));
  }

  if (!filtradas.length) {
    cont.innerHTML = '<div class="alert mid">No hay compras registradas</div>';
    return;
  }

  const estadoConfig = {
    pendiente: { label: "⏳ POR PAGAR",   css: "enviada"  },
    pagada:    { label: "✅ PAGADA",       css: "aprobada" },
    revertida: { label: "↩️ REVERTIDA",   css: "borrador" }
  };

  cont.innerHTML = filtradas.map(c => {
    const est = estadoConfig[c.estado] || estadoConfig.pendiente;
    const botones = [];

    if (c.estado === "pendiente") {
      botones.push(`<button class="small-btn success-btn" onclick="abrirModalPagoCompra('${c.id}')">💰 Pagar</button>`);
    }
    if (c.estado === "pagada") {
      botones.push(`<button class="small-btn warn-btn" onclick="abrirModalRevertirCompra('${c.id}')">↩️ Revertir</button>`);
    }
    botones.push(`<button class="small-btn" onclick="verReciboCompra('${c.id}')" style="background:rgba(59,130,246,.15);color:var(--primary);">📄 Recibo</button>`);
    botones.push(`<button class="small-btn" onclick="eliminarCompra('${c.id}')" style="background:rgba(239,68,68,.15);color:var(--bad);">🗑️</button>`);

    return `
      <div class="quote-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-weight:700;font-size:14px;">${c.numero}</span>
          <span class="quote-status ${est.css}">${est.label}</span>
        </div>
        <div style="font-size:12px;margin-bottom:4px;">🚚 ${c.proveedorNombre}</div>
        <div class="small">${(c.productos || []).length} producto(s) ${c.fotoFactura ? '· 📷 Con foto' : ''}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;">
          <span style="font-weight:700;font-size:15px;color:var(--bad);">${money(c.total)}</span>
          <span class="small">${c.fecha}</span>
        </div>
        <div style="display:flex;gap:4px;margin-top:8px;flex-wrap:wrap;">
          ${botones.join("")}
        </div>
      </div>`;
  }).join("");
};
window.renderListaMovimientosStock = function() {
  const cont = document.getElementById("listaMovimientosStock");
  if (!cont) return;

  if (!movimientosStock.length) {
    cont.innerHTML = '<div class="alert mid">Sin movimientos de stock registrados</div>';
    return;
  }

  // Usar DocumentFragment para evitar reflows
  const ordenados = [...movimientosStock]


  const fragment = document.createDocumentFragment();

  ordenados.forEach(m => {
    const esEntrada = m.tipo === "entrada";
    const esReversion = (m.motivo || "").startsWith("↩️");
    const div = document.createElement("div");
    div.className = "item";
    div.style.borderLeftColor = esEntrada ? "var(--ok)" : "var(--bad)";
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-weight:700;font-size:12px;">
          ${esEntrada ? "➕" : "➖"} ${m.productoNombre || "Producto"}
          ${esReversion ? '<span class="badge" style="background:rgba(245,158,11,.2);color:var(--warn);">rev.</span>' : ""}
        </span>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-weight:800;color:${esEntrada ? "var(--ok)" : "var(--bad)"};">${esEntrada ? "+" : "-"}${m.cantidad}</span>
          ${!esReversion ? `<button class="small-btn warn-btn" onclick="revertirMovimientoStock('${m.id}')" style="font-size:9px;padding:2px 6px;">↩️</button>` : ""}
        </div>
      </div>
      <div class="small">${m.motivo || ""}</div>
      <div class="small" style="color:var(--muted);">${m.fecha}</div>`;
    fragment.appendChild(div);
  });

  cont.innerHTML = "";
  cont.appendChild(fragment);

  if (movimientosStock.length > 80) {
    const more = document.createElement("div");
    more.className = "alert info";
    more.style.marginTop = "8px";
    more.textContent = `Mostrando 80 de ${movimientosStock.length} movimientos`;
    cont.appendChild(more);
  }
};
window.revertirMovimientoStock = function(movId) {
  const mov = movimientosStock.find(m => m.id === movId);
  if (!mov) { toast("❌ Movimiento no encontrado"); return; }

  const prod = catalogo.find(p => p.id === mov.productoId);
  const nombre = prod ? prod.nombre : mov.productoNombre;
  const tipoInverso = mov.tipo === "entrada" ? "salida" : "entrada";

  if (!confirm(`↩️ Revertir: ${mov.tipo === "entrada" ? "quitar" : "devolver"} ${mov.cantidad} unidad(es) de "${nombre}".\n\nEsto crea un movimiento contrario en el historial.`)) return;

  // Aplicar cambio inverso al stock
  if (prod) {
    if (tipoInverso === "salida") {
      prod.stock = Math.max(0, (prod.stock || 0) - mov.cantidad);
    } else {
      prod.stock = (prod.stock || 0) + mov.cantidad;
    }
    prod.actualizadoEn = new Date().toISOString();
  }

  // Registrar movimiento de reversión
  movimientosStock.unshift({
    id: "movstock_rev_" + Date.now(),
    productoId: mov.productoId,
    productoNombre: mov.productoNombre,
    tipo: tipoInverso,
    cantidad: mov.cantidad,
    motivo: "↩️ Reversión de: " + (mov.motivo || "movimiento anterior"),
    refId: mov.id,
    fecha: fechaHoyColombia(),
    createdAt: new Date().toISOString()
  });

  guardarCatalogoNegocio();
  guardarInventarioNegocio();
  renderListaMovimientosStock();
  renderListaCatalogo();
  toast("↩️ Movimiento revertido — stock actualizado");
};
(function inyectarCampoFotoCompra() {
  const modal = document.getElementById("modalCompra");
  if (!modal) return;

  // Verificar si ya existe
  if (document.getElementById("_fotoFacturaSec")) return;

  const div = document.createElement("div");
  div.id = "_fotoFacturaSec";
  div.style.marginBottom = "10px";
  div.innerHTML = `
    <label style="display:block;font-size:11px;font-weight:600;color:var(--muted);margin-bottom:4px;">
      📷 Foto de la factura física (opcional)
    </label>
    <div id="_fotoFacturaPreview" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;"></div>
    <div style="display:flex;gap:6px;">
      <button type="button" onclick="abrirCamaraFotoCompra()"
        style="flex:1;padding:8px;background:rgba(59,130,246,.15);color:var(--primary);border:1px solid var(--primary);border-radius:10px;font-size:11px;font-weight:700;cursor:pointer;">
        📷 Cámara
      </button>
      <label style="flex:1;padding:8px;background:rgba(59,130,246,.15);color:var(--primary);border:1px solid var(--primary);border-radius:10px;font-size:11px;font-weight:700;cursor:pointer;text-align:center;">
        🖼️ Galería
        <input type="file" accept="image/*" style="display:none" onchange="cargarFotoFactura(event)">
      </label>
    </div>`;

  // Insertar antes de los botones del modal
  const btns = modal.querySelector(".modal-btns");
  if (btns) btns.parentNode.insertBefore(div, btns);
})();
window.cargarFotoFactura = function(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (window._fotosCompraActual && window._fotosCompraActual.length >= 2) {
    toast("❌ Máximo 2 fotos de factura");
    return;
  }
  if (file.size > 5 * 1024 * 1024) { toast("❌ Imagen muy pesada, máx 5MB"); return; }

  const reader = new FileReader();
  reader.onerror = () => toast("❌ Error al leer la imagen");
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement("canvas");
      const maxW = 1200;
      const scale = Math.min(1, maxW / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      const comprimida = canvas.toDataURL("image/jpeg", 0.78);
      if (!window._fotosCompraActual) window._fotosCompraActual = [];
      window._fotosCompraActual.push(comprimida);
      renderFotoFacturaPreview();
      toast("📷 Foto de factura agregada");
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
  event.target.value = "";
};
window.abrirCamaraFotoCompra = function() {
  if (window._fotosCompraActual && window._fotosCompraActual.length >= 2) {
    toast("❌ Máximo 2 fotos");
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toast("❌ Cámara no disponible, usa Galería");
    return;
  }

  const overlay = document.createElement("div");
  overlay.id = "_camOverlayCompra";
  overlay.style.cssText = "position:fixed;inset:0;z-index:99999;background:#000;display:flex;flex-direction:column;";
  overlay.innerHTML = `
    <video id="_camVideoCompra" autoplay playsinline muted style="flex:1;width:100%;object-fit:cover;"></video>
    <div style="display:flex;gap:10px;padding:16px;background:#000;justify-content:center;">
      <button id="_camCancelarCompra" type="button" style="flex:1;max-width:140px;padding:14px;background:#333;color:#fff;border:none;border-radius:12px;font-weight:700;">✕ Cancelar</button>
      <button id="_camCapturarCompra" type="button" style="flex:1;max-width:140px;padding:14px;background:#3b82f6;color:#fff;border:none;border-radius:12px;font-weight:700;">📷 Capturar</button>
    </div>`;
  document.body.appendChild(overlay);

  navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })
    .then(stream => {
      _camStreamCompra = stream;
      document.getElementById("_camVideoCompra").srcObject = stream;
    })
    .catch(() => { toast("❌ No se pudo abrir la cámara"); cerrarCamaraCompra(); });

  document.getElementById("_camCancelarCompra").onclick = cerrarCamaraCompra;
  document.getElementById("_camCapturarCompra").onclick = function() {
    const video = document.getElementById("_camVideoCompra");
    if (!video || !video.videoWidth) { toast("⏳ Espera a que cargue la cámara"); return; }
    const canvas = document.createElement("canvas");
    const maxW = 1200;
    const scale = Math.min(1, maxW / video.videoWidth);
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    if (!window._fotosCompraActual) window._fotosCompraActual = [];
    window._fotosCompraActual.push(canvas.toDataURL("image/jpeg", 0.78));
    cerrarCamaraCompra();
    renderFotoFacturaPreview();
    toast("📷 Foto de factura tomada");
  };
};
window.cerrarCamaraCompra = function() {
  if (_camStreamCompra) { _camStreamCompra.getTracks().forEach(t => t.stop()); _camStreamCompra = null; }
  const ov = document.getElementById("_camOverlayCompra");
  if (ov) ov.remove();
};
window.renderFotoFacturaPreview = function() {
  const cont = document.getElementById("_fotoFacturaPreview");
  if (!cont) return;
  const fotos = window._fotosCompraActual || [];
  cont.innerHTML = fotos.map((f, i) => `
    <div style="position:relative;display:inline-block;">
      <img src="${f}" style="width:80px;height:80px;object-fit:cover;border-radius:10px;border:1px solid var(--line);">
      <button onclick="eliminarFotoFactura(${i})"
        style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;
               background:var(--bad);color:#fff;border:none;font-size:11px;padding:0;cursor:pointer;">✕</button>
    </div>`).join("");
};
window.eliminarFotoFactura = function(idx) {
  if (window._fotosCompraActual) window._fotosCompraActual.splice(idx, 1);
  renderFotoFacturaPreview();
};
window.guardarCompra = function() {
  // Llamamos al original
  _guardarCompraOriginal();

  // Añadir fotos a la última compra guardada
  if (window._fotosCompraActual && window._fotosCompraActual.length > 0 && compras.length > 0) {
    compras[compras.length - 1].fotoFactura = [...window._fotosCompraActual];
    window._fotosCompraActual = [];
    renderFotoFacturaPreview();
    guardarInventarioNegocio();
  }
};
window.abrirNuevaCompra = function() {
  window._fotosCompraActual = [];
  renderFotoFacturaPreview();
  _abrirNuevaCompraOriginal();
  // Asegurarse de que el campo de foto esté en el modal
  setTimeout(inyectarCampoFotoCompraDelay, 100);
};
function inyectarCampoFotoCompraDelay() {
  if (document.getElementById("_fotoFacturaSec")) return;
  const modal = document.getElementById("modalCompra");
  if (!modal) return;
  const div = document.createElement("div");
  div.id = "_fotoFacturaSec";
  div.style.marginBottom = "10px";
  div.innerHTML = `
    <label style="display:block;font-size:11px;font-weight:600;color:var(--muted);margin-bottom:4px;">
      📷 Foto de la factura física (opcional)
    </label>
    <div id="_fotoFacturaPreview" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;"></div>
    <div style="display:flex;gap:6px;">
      <button type="button" onclick="abrirCamaraFotoCompra()"
        style="flex:1;padding:8px;background:rgba(59,130,246,.15);color:var(--primary);border:1px solid var(--primary);border-radius:10px;font-size:11px;font-weight:700;cursor:pointer;">
        📷 Cámara
      </button>
      <label style="flex:1;padding:8px;background:rgba(59,130,246,.15);color:var(--primary);border:1px solid var(--primary);border-radius:10px;font-size:11px;font-weight:700;cursor:pointer;text-align:center;">
        🖼️ Galería
        <input type="file" accept="image/*" style="display:none" onchange="cargarFotoFactura(event)">
      </label>
    </div>`;
  const btns = modal.querySelector(".modal-btns");
  if (btns) btns.parentNode.insertBefore(div, btns);
}
window.verReciboCompra = function(id) {
  const compra = compras.find(c => c.id === id);
  if (!compra) { toast("❌ Compra no encontrada"); return; }

  const prov = proveedores.find(p => p.id === compra.proveedorId) || {};
  const fechaFormateada = new Date(compra.fecha + "T00:00:00").toLocaleDateString("es-CO", {
    day: "numeric", month: "long", year: "numeric"
  });

  const colorBase  = configNegocio.colorDocumentos || "#3b82f6";
  const colorOscuro = hexAOscuro(colorBase);
  const colorClaro  = hexAClaro(colorBase);

  const estadoConfig = {
    pendiente:  { label: "⏳ POR PAGAR",  color: "#f59e0b" },
    pagada:     { label: "✅ PAGADA",      color: "#22c55e" },
    revertida:  { label: "↩️ REVERTIDA",  color: "#94a3b8" }
  };
  const est = estadoConfig[compra.estado] || estadoConfig.pendiente;

  const fotosHTML = (compra.fotoFactura && compra.fotoFactura.length)
    ? `<div style="padding:0 28px 16px;">
        <div style="font-size:11px;font-weight:700;color:${colorBase};letter-spacing:1px;margin-bottom:8px;">FOTO(S) DE FACTURA</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          ${compra.fotoFactura.map(f => `<img src="${f}" style="max-width:240px;max-height:200px;object-fit:contain;border-radius:8px;border:1px solid #ddd;">`).join("")}
        </div>
      </div>`
    : "";

  const html = `
    <div style="font-family:Arial,sans-serif;color:#1a1a1a;background:#fff;padding:0;">

      <!-- HEADER -->
      <div style="display:flex;justify-content:space-between;align-items:center;background:#fff;padding:24px 28px 16px;border-bottom:3px solid ${colorBase};">
        <div style="display:flex;align-items:center;gap:16px;">
          ${configNegocio.logo ? `<img src="${configNegocio.logo}" style="max-width:100px;max-height:70px;object-fit:contain;">` : ""}
          <div>
            <div style="font-size:20px;font-weight:900;">${configNegocio.razonSocial || "MI EMPRESA"}</div>
            <div style="font-size:11px;color:#555;">${configNegocio.direccion || ""}</div>
            <div style="font-size:11px;color:#555;">${configNegocio.telefono ? "📞 " + configNegocio.telefono : ""} ${configNegocio.nit ? "· NIT: " + configNegocio.nit : ""}</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:28px;font-weight:900;letter-spacing:1px;">ORDEN DE COMPRA</div>
          <div style="font-size:18px;font-weight:700;color:${colorBase};margin-top:4px;">${compra.numero}</div>
          <div style="font-size:11px;color:#555;margin-top:6px;">📅 ${fechaFormateada}</div>
          <div style="font-size:12px;font-weight:700;color:${est.color};">${est.label}</div>
        </div>
      </div>

      <!-- DATOS PROVEEDOR -->
      <div style="padding:16px 28px;">
        <div style="background:${colorClaro};border:1px solid ${colorBase}55;border-radius:10px;padding:14px 18px;">
          <div style="font-size:11px;font-weight:700;color:${colorBase};letter-spacing:1px;margin-bottom:8px;">DATOS DEL PROVEEDOR</div>
          <div style="font-size:13px;font-weight:700;">🚚 ${compra.proveedorNombre}</div>
          ${prov.telefono ? `<div style="font-size:11px;color:#555;">📞 ${prov.telefono}</div>` : ""}
          ${prov.email    ? `<div style="font-size:11px;color:#555;">✉️ ${prov.email}</div>`    : ""}
          ${prov.nit      ? `<div style="font-size:11px;color:#555;">NIT: ${prov.nit}</div>`    : ""}
          ${prov.direccion? `<div style="font-size:11px;color:#555;">📍 ${prov.direccion}</div>`: ""}
        </div>
      </div>

      <!-- TABLA PRODUCTOS -->
      <div style="padding:0 28px;">
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead>
            <tr style="background:${colorBase};color:#fff;">
              <th style="padding:10px 8px;text-align:center;width:30px;">#</th>
              <th style="padding:10px 8px;text-align:left;">PRODUCTO</th>
              <th style="padding:10px 8px;text-align:center;width:50px;">CANT.</th>
              <th style="padding:10px 8px;text-align:right;">COSTO UNIT.</th>
              <th style="padding:10px 8px;text-align:right;">SUBTOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${(compra.productos || []).map((p, i) => `
              <tr style="border-bottom:1px solid #e5e7eb;background:${i % 2 === 0 ? "#fff" : "#f9fafb"};">
                <td style="padding:10px 8px;text-align:center;color:${colorBase};font-weight:700;">${i + 1}</td>
                <td style="padding:10px 8px;font-weight:600;">${p.nombre}</td>
                <td style="padding:10px 8px;text-align:center;">${p.cantidad}</td>
                <td style="padding:10px 8px;text-align:right;">${money(p.costoUnitario)}</td>
                <td style="padding:10px 8px;text-align:right;font-weight:600;">${money(p.costoUnitario * p.cantidad)}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>

      <!-- TOTAL -->
      <div style="padding:16px 28px;display:flex;justify-content:flex-end;">
        <div style="background:${colorClaro};border:1px solid ${colorBase}55;border-radius:10px;padding:16px 24px;min-width:200px;">
          <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:900;">
            <span>TOTAL COMPRA:</span>
            <span style="color:${colorOscuro};">${money(compra.total)}</span>
          </div>
          ${compra.fechaPago ? `<div style="font-size:10px;color:#555;margin-top:4px;">Pagado el ${compra.fechaPago}</div>` : ""}
        </div>
      </div>

      <!-- FOTOS DE FACTURA -->
      ${fotosHTML}

      <!-- PIE -->
      <div style="background:${colorOscuro};color:#fff;padding:14px 28px;display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
        <div style="font-size:11px;">${configNegocio.direccion ? "📍 " + configNegocio.direccion : ""}</div>
        <div style="font-size:11px;font-weight:700;">${configNegocio.razonSocial || ""}</div>
        <div style="font-size:11px;">${configNegocio.telefono ? "📞 " + configNegocio.telefono : ""}</div>
      </div>
    </div>`;

  const pdfPreview = document.getElementById("pdfPreview");
  if (pdfPreview) pdfPreview.innerHTML = html;
  const modalPDF = document.getElementById("modalPDF");
  if (modalPDF) modalPDF.classList.add("open");
};
window.verReciboProveedor = function(id) {
  const prov = proveedores.find(p => p.id === id);
  if (!prov) { toast("❌ Proveedor no encontrado"); return; }

  const comprasProveedor = compras.filter(c => c.proveedorId === id);
  const totalComprado    = comprasProveedor.reduce((s, c) => s + c.total, 0);
  const totalPagado      = comprasProveedor.filter(c => c.estado === "pagada").reduce((s, c) => s + c.total, 0);
  const totalPendiente   = comprasProveedor.filter(c => c.estado === "pendiente").reduce((s, c) => s + c.total, 0);

  const colorBase   = configNegocio.colorDocumentos || "#3b82f6";
  const colorOscuro = hexAOscuro(colorBase);
  const colorClaro  = hexAClaro(colorBase);

  const html = `
    <div style="font-family:Arial,sans-serif;color:#1a1a1a;background:#fff;padding:0;">

      <!-- HEADER -->
      <div style="display:flex;justify-content:space-between;align-items:center;background:#fff;padding:24px 28px 16px;border-bottom:3px solid ${colorBase};">
        <div style="display:flex;align-items:center;gap:16px;">
          ${configNegocio.logo ? `<img src="${configNegocio.logo}" style="max-width:100px;max-height:70px;object-fit:contain;">` : ""}
          <div>
            <div style="font-size:20px;font-weight:900;">${configNegocio.razonSocial || "MI EMPRESA"}</div>
            <div style="font-size:11px;color:#555;">${configNegocio.nit ? "NIT: " + configNegocio.nit : ""}</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:24px;font-weight:900;">FICHA DE PROVEEDOR</div>
          <div style="font-size:12px;color:#555;margin-top:4px;">Generado: ${new Date().toLocaleDateString("es-CO", { day:"numeric", month:"long", year:"numeric" })}</div>
        </div>
      </div>

      <!-- DATOS PROVEEDOR -->
      <div style="padding:16px 28px;">
        <div style="background:${colorClaro};border:1px solid ${colorBase}55;border-radius:10px;padding:16px 18px;">
          <div style="font-size:11px;font-weight:700;color:${colorBase};letter-spacing:1px;margin-bottom:10px;">INFORMACIÓN DEL PROVEEDOR</div>
          <div style="font-size:18px;font-weight:900;margin-bottom:6px;">🚚 ${prov.nombre}</div>
          <div style="display:flex;gap:30px;flex-wrap:wrap;">
            <div>
              ${prov.telefono  ? `<div style="font-size:12px;">📞 ${prov.telefono}</div>`  : ""}
              ${prov.email     ? `<div style="font-size:12px;">✉️ ${prov.email}</div>`     : ""}
              ${prov.nit       ? `<div style="font-size:12px;">NIT: ${prov.nit}</div>`     : ""}
            </div>
            <div>
              ${prov.direccion ? `<div style="font-size:12px;">📍 ${prov.direccion}</div>` : ""}
              ${prov.notas     ? `<div style="font-size:12px;color:#555;">📝 ${prov.notas}</div>` : ""}
            </div>
          </div>
        </div>
      </div>

      <!-- KPIs -->
      <div style="padding:0 28px 16px;display:flex;gap:12px;flex-wrap:wrap;">
        ${[
          { label: "Total comprado", val: money(totalComprado), color: "#1a1a1a" },
          { label: "Total pagado",   val: money(totalPagado),   color: "#16a34a" },
          { label: "Por pagar",      val: money(totalPendiente),color: totalPendiente > 0 ? "#dc2626" : "#16a34a" },
          { label: "# Compras",      val: comprasProveedor.length, color: colorBase }
        ].map(k => `
          <div style="background:${colorClaro};border:1px solid ${colorBase}33;border-radius:10px;padding:12px 16px;min-width:120px;flex:1;">
            <div style="font-size:10px;color:#555;margin-bottom:4px;">${k.label}</div>
            <div style="font-size:16px;font-weight:900;color:${k.color};">${k.val}</div>
          </div>`).join("")}
      </div>

      <!-- HISTORIAL DE COMPRAS -->
      <div style="padding:0 28px 16px;">
        <div style="font-size:11px;font-weight:700;color:${colorBase};letter-spacing:1px;margin-bottom:8px;">HISTORIAL DE COMPRAS</div>
        ${comprasProveedor.length === 0
          ? `<div style="font-size:12px;color:#999;padding:12px;text-align:center;">Sin compras registradas</div>`
          : `<table style="width:100%;border-collapse:collapse;font-size:11px;">
              <thead>
                <tr style="background:${colorBase};color:#fff;">
                  <th style="padding:8px;text-align:left;">N° Compra</th>
                  <th style="padding:8px;text-align:center;">Fecha</th>
                  <th style="padding:8px;text-align:right;">Total</th>
                  <th style="padding:8px;text-align:center;">Estado</th>
                </tr>
              </thead>
              <tbody>
                ${comprasProveedor
                  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                  .map((c, i) => `
                  <tr style="border-bottom:1px solid #e5e7eb;background:${i % 2 === 0 ? "#fff" : "#f9fafb"};">
                    <td style="padding:8px;font-weight:600;">${c.numero}</td>
                    <td style="padding:8px;text-align:center;">${c.fecha}</td>
                    <td style="padding:8px;text-align:right;font-weight:700;">${money(c.total)}</td>
                    <td style="padding:8px;text-align:center;">
                      <span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;
                        background:${c.estado==="pagada"?"rgba(34,197,94,.15)":c.estado==="revertida"?"rgba(148,163,184,.15)":"rgba(245,158,11,.15)"};
                        color:${c.estado==="pagada"?"#16a34a":c.estado==="revertida"?"#94a3b8":"#d97706"};">
                        ${c.estado==="pagada"?"✅ Pagada":c.estado==="revertida"?"↩️ Revertida":"⏳ Pendiente"}
                      </span>
                    </td>
                  </tr>`).join("")}
              </tbody>
             </table>`}
      </div>

      <!-- PIE -->
      <div style="background:${colorOscuro};color:#fff;padding:14px 28px;display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
        <div style="font-size:11px;">${configNegocio.razonSocial || ""}</div>
        <div style="font-size:11px;">${configNegocio.telefono ? "📞 " + configNegocio.telefono : ""}</div>
      </div>
    </div>`;

  const pdfPreview = document.getElementById("pdfPreview");
  if (pdfPreview) pdfPreview.innerHTML = html;
  const modalPDF = document.getElementById("modalPDF");
  if (modalPDF) modalPDF.classList.add("open");
};
const _renderListaProveedoresOriginal = window.renderListaProveedores;
window.renderListaProveedores = function() {
  const cont = document.getElementById("listaProveedoresInv");
  if (!cont) return;

  if (!proveedores.length) {
    cont.innerHTML = '<div class="alert mid">No hay proveedores registrados</div>';
    return;
  }

  cont.innerHTML = proveedores.map(p => {
    const nCompras = compras.filter(c => c.proveedorId === p.id).length;
    const pendiente = compras.filter(c => c.proveedorId === p.id && c.estado === "pendiente").reduce((s, c) => s + c.total, 0);
    return `
      <div class="item" style="display:flex;justify-content:space-between;align-items:center;">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:13px;">🚚 ${p.nombre}</div>
          <div class="small">${p.telefono || ""} ${p.email ? "· " + p.email : ""}</div>
          <div class="small">${nCompras} compra(s) ${pendiente > 0 ? `· <span style="color:var(--bad);">Debes ${money(pendiente)}</span>` : ""}</div>
          ${p.notas ? `<div class="small" style="color:var(--muted);">${p.notas}</div>` : ""}
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end;">
          <button class="small-btn" onclick="verReciboProveedor('${p.id}')"
            style="font-size:9px;background:rgba(59,130,246,.15);color:var(--primary);">📋 Ficha</button>
          <button class="small-btn warn-btn" onclick="abrirEditarProveedor('${p.id}')" style="font-size:9px;">✏️</button>
          <button class="small-btn" onclick="eliminarProveedor('${p.id}')"
            style="font-size:9px;background:rgba(239,68,68,.15);color:var(--bad);">🗑️</button>
        </div>
      </div>`;
  }).join("");
};
(function patchFiltroCompras() {
  const patchTab = () => {
    const tabs = document.querySelectorAll("#invsub-compras .tab-mini");
    if (!tabs.length) return;
    // Verificar si ya existe el tab Revertidas
    const yaExiste = Array.from(tabs).some(t => t.textContent.includes("Revert"));
    if (yaExiste) return;
    const ultimo = tabs[tabs.length - 1];
    const nuevoTab = document.createElement("div");
    nuevoTab.className = "tab-mini";
    nuevoTab.textContent = "↩️ Revertidas";
    nuevoTab.onclick = function() { filtrarCompras("revertida", this); };
    ultimo.parentNode.insertBefore(nuevoTab, ultimo.nextSibling);
  };

  // Intentar al cargar y cuando se abra la pestaña
  setTimeout(patchTab, 1500);
  const origSwitch = window.switchInvSubTab;
  window.switchInvSubTab = function(tab, btn) {
    origSwitch(tab, btn);
    if (tab === "compras") setTimeout(patchTab, 100);
  };
})();
window.abrirModalRevertirCompra  = window.abrirModalRevertirCompra;
window.renderFotoFacturaPreview  = window.renderFotoFacturaPreview;