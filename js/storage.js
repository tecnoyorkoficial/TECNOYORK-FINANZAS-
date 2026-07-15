// js/storage.js — CRUD Firestore/localStorage: guardar/cargar datos

async function cargarPerfilUsuario(){
  const uid=window.auth?.currentUser?.uid;
  if(!uid){negocioId=null;perfilUsuario=null;miRol="admin";return;}
  try{
    const snap=await window.fbGetDoc(window.fbDoc(window.db,"usuarios_perfil",uid));
    if(snap.exists()){
      perfilUsuario=snap.data();
      negocioId=perfilUsuario.negocioId||uid;
      miRol=perfilUsuario.rol||"admin";
      return;
    }
    // No tiene perfil aún -> revisar si hay invitación pendiente para su email
    const email=(window.auth.currentUser.email||"").toLowerCase().trim();
    let invitacion=null;
    if(email){
      try{
        const invSnap=await window.fbGetDoc(window.fbDoc(window.db,"invitaciones_globales",email));
        if(invSnap.exists()) invitacion=invSnap.data();
      }catch(e){console.error("Error revisando invitación:",e);}
    }
    if(invitacion){
      perfilUsuario={
        negocioId: invitacion.negocioId,
        rol: invitacion.rol||"tecnico",
        nombre: window.auth.currentUser.displayName||email.split("@")[0],
        email
      };
      negocioId=invitacion.negocioId;
      miRol=perfilUsuario.rol;
      await window.fbSetDoc(window.fbDoc(window.db,"usuarios_perfil",uid),{
        ...perfilUsuario, creadoEn:new Date().toISOString()
      });
      // Limpiar invitación usada
      try{await window.fbDeleteDoc(window.fbDoc(window.db,"invitaciones_globales",email));}catch(e){}
      try{
        const negDocRef=window.fbDoc(window.db,"negocio_data",negocioId);
        const negSnap=await window.fbGetDoc(negDocRef);
        let equipo=(negSnap.exists()&&negSnap.data().equipo)?negSnap.data().equipo:[];
        const idx=equipo.findIndex(m=>(m.email||"").toLowerCase()===email);
        if(idx!==-1){equipo[idx].uid=uid;equipo[idx].nombre=perfilUsuario.nombre;equipo[idx].activo=true;}
        else{equipo.push({uid,email,rol:miRol,nombre:perfilUsuario.nombre,activo:true});}
        await window.fbSetDoc(negDocRef,{equipo},{merge:true});
      }catch(e){console.error("Error actualizando equipo:",e);}
      toast("✅ Te uniste al equipo como "+etiquetaRol(miRol));
    } else {
      // Usuario independiente -> es admin de su propio negocio (comportamiento legacy)
      perfilUsuario={negocioId:uid, rol:"admin", nombre:window.auth.currentUser.displayName||email.split("@")[0]||"Usuario", email};
      negocioId=uid;
      miRol="admin";
      await window.fbSetDoc(window.fbDoc(window.db,"usuarios_perfil",uid),{
        ...perfilUsuario, creadoEn:new Date().toISOString()
      });
    }
  }catch(e){
    console.error("Error cargando perfil:",e);
    negocioId=uid; miRol="admin";
  }
}
function guardarCatalogoNegocio() {
  localStorage.setItem("biz_catalogo", JSON.stringify(catalogo));
  
  if (window.db && window.auth?.currentUser && navigator.onLine) {
    const uid = negocioId || window.auth.currentUser.uid;
    window.fbSetDoc(
        window.fbDoc(window.db, "negocio_catalogo", uid),
        { catalogo: catalogo, actualizado: new Date().toISOString() },
        { merge: false } // merge:false porque queremos sobreescribir el array completo, no mezclar
      ).catch(e => console.error("Error guardando catálogo:", e));
    }
  }
function guardarOrdenesNegocio() {
  localStorage.setItem("biz_ordenes", JSON.stringify(ordenes));
  
  if (window.db && window.auth?.currentUser && navigator.onLine) {
    const uid = negocioId || window.auth.currentUser.uid;
    // Las fotos van sin comprimir doble; ya vienen comprimidas al capturarlas
    window.fbSetDoc(
        window.fbDoc(window.db, "negocio_ordenes", uid),
        { ordenes: ordenes, actualizado: new Date().toISOString() },
        { merge: false }
      ).catch(e => console.error("Error guardando órdenes:", e));
    }
  }
function guardarInventarioNegocio() {
    localStorage.setItem("biz_proveedores", JSON.stringify(proveedores));
    localStorage.setItem("biz_compras", JSON.stringify(compras));
    localStorage.setItem("biz_arqueos", JSON.stringify(arqueos));
    if (movimientosStock.length > 300) movimientosStock = movimientosStock.slice(0, 300);
    localStorage.setItem("biz_movstock", JSON.stringify(movimientosStock));

    if (window.db && window.auth?.currentUser && navigator.onLine) {
  const uid = negocioId || window.auth.currentUser.uid;
  window.fbSetDoc(
      window.fbDoc(window.db, "negocio_inventario", uid),
        {
          proveedores: proveedores,
          compras: compras,
          arqueos: arqueos,
          movimientosStock: movimientosStock,
          actualizado: new Date().toISOString()
        },
        { merge: false }
      ).catch(e => console.error("Error guardando inventario:", e));
    }
  }
async function cargarInventarioNegocio() {
  proveedores = JSON.parse(localStorage.getItem("biz_proveedores") || "[]");
  compras = JSON.parse(localStorage.getItem("biz_compras") || "[]");
  arqueos = JSON.parse(localStorage.getItem("biz_arqueos") || "[]");
  movimientosStock = JSON.parse(localStorage.getItem("biz_movstock") || "[]");
  
  if (window.db && window.auth?.currentUser && navigator.onLine) {
  try {
    const snap = await window.fbGetDoc(window.fbDoc(window.db, "negocio_inventario", negocioId || window.auth.currentUser.uid));
      if (snap.exists()) {
        const d = snap.data();
        if (d.proveedores) proveedores = d.proveedores;
        if (d.compras) compras = d.compras;
        if (d.arqueos) arqueos = d.arqueos;
        if (d.movimientosStock) movimientosStock = d.movimientosStock;
        localStorage.setItem("biz_proveedores", JSON.stringify(proveedores));
        localStorage.setItem("biz_compras", JSON.stringify(compras));
        localStorage.setItem("biz_arqueos", JSON.stringify(arqueos));
        localStorage.setItem("biz_movstock", JSON.stringify(movimientosStock));
      }
    } catch (e) {
      console.error("Error cargando inventario:", e);
    }
  }
}
async function cargarOrdenesNegocio() {
    ordenes = JSON.parse(localStorage.getItem("biz_ordenes") || "[]");
    renderListaOrdenes();
  
    if (window.db && window.auth?.currentUser && navigator.onLine) {
  try {
    const snap = await window.fbGetDoc(window.fbDoc(window.db, "negocio_ordenes", negocioId || window.auth.currentUser.uid));
        if (snap.exists() && snap.data().ordenes) {
          ordenes = snap.data().ordenes;
          localStorage.setItem("biz_ordenes", JSON.stringify(ordenes));
          renderListaOrdenes();
        }
      } catch (e) {
        console.error("Error cargando órdenes:", e);
      }
    }
  }
async function cargarDatosNegocio() {
    // Cargar localStorage primero
    clientes = JSON.parse(localStorage.getItem("biz_clientes") || "[]");
    catalogo = JSON.parse(localStorage.getItem("biz_catalogo") || "[]");
    cotizaciones = JSON.parse(localStorage.getItem("biz_cotizaciones") || "[]");
    facturas = JSON.parse(localStorage.getItem("biz_facturas") || "[]");
    configNegocio = JSON.parse(localStorage.getItem("biz_config") || '{"razonSocial":"","nit":"","direccion":"","telefono":"","email":"","terminos":"Pago contra entrega. Validez: 15 días.","logo":""}');
    
    cargarConfigNegocioUI();
    renderListaCatalogo();
    renderListaClientes();
    renderListaCotizaciones();
    renderListaFacturas();
    cargarOrdenesNegocio();
    await cargarInventarioNegocio();
    
    if (window.db && window.auth?.currentUser && navigator.onLine) {
      // ✅ Usar negocioId (puede ser del admin principal si soy subcuenta)
      const uid = negocioId || window.auth.currentUser.uid;
      try {
        // ✅ Cargar datos, catálogo y logo en paralelo (catálogo va en doc separado)
        const [docSnap, catSnap, logoSnap] = await Promise.all([
          window.fbGetDoc(window.fbDoc(window.db, "negocio_data", uid)),
          window.fbGetDoc(window.fbDoc(window.db, "negocio_catalogo", uid)),
          window.fbGetDoc(window.fbDoc(window.db, "negocio_logo", uid))
        ]);
      
      if (docSnap.exists()) {
        const d = docSnap.data();
        if (d.clientes) clientes = d.clientes;
        if (d.cotizaciones) cotizaciones = d.cotizaciones;
        if (d.facturas) facturas = d.facturas;
        
        if (d.configNegocio) {
          // ✅ Preservar logo local mientras llega el de Firebase
          const logoLocal = configNegocio.logo || localStorage.getItem("biz_logo_backup") || "";
          configNegocio = { ...d.configNegocio, logo: logoLocal };
        }
        
        localStorage.setItem("biz_clientes", JSON.stringify(clientes));
        localStorage.setItem("biz_cotizaciones", JSON.stringify(cotizaciones));
        localStorage.setItem("biz_facturas", JSON.stringify(facturas));
      }
      
      if (catSnap.exists() && catSnap.data().catalogo) {
        catalogo = catSnap.data().catalogo;
        localStorage.setItem("biz_catalogo", JSON.stringify(catalogo));
      }
        
        // ✅ Logo desde colección separada — siempre tiene prioridad
        if (logoSnap.exists() && logoSnap.data().logo) {
          configNegocio.logo = logoSnap.data().logo;
          localStorage.setItem("biz_logo_backup", configNegocio.logo);
        }
        
        localStorage.setItem("biz_config", JSON.stringify(configNegocio));
        cargarConfigNegocioUI();
        renderListaCatalogo();
        renderListaClientes();
        renderListaCotizaciones();
        renderListaFacturas();
        cargarOrdenesNegocio();
      } catch (e) {
        console.error("Error cargando negocio desde Firebase:", e);
      }
    }
  }
function guardarOrden() {
    const clienteNombre = $("ordenClienteNombre").value.trim();
    const marca = $("ordenMarca").value.trim();
    const modelo = $("ordenModelo").value.trim();
    const problema = $("ordenProblema").value.trim();
    if (!clienteNombre || !marca || !problema) { toast("Completa cliente, marca y problema reportado"); return; }
  
    const orden = {
      id: ordenEditandoId || "orden_" + Date.now(),
      numero: $("ordenNumero").value.trim() || generarNumeroOrden(),
      clienteNombre,
      clienteTelefono: $("ordenClienteTelefono").value.trim(),
      marca,
      modelo,
      problema,
      clave: $("ordenClave").value.trim(),
      imei: $("ordenIMEI").value.trim(),
      observaciones: $("ordenObservaciones").value.trim(),
      precioEstimado: parseMonto($("ordenPrecioEstimado").value),
      precioFinal: ordenEditandoId ? (ordenes.find(o => o.id === ordenEditandoId)?.precioFinal || null) : null,
      estado: $("ordenEstado").value,
      fotos: [...fotosOrdenActual],
    garantiaDias: parseInt($("ordenGarantiaDias").value) || 30,
    facturaId: ordenEditandoId ? (ordenes.find(o => o.id === ordenEditandoId)?.facturaId || null) : null,
      fecha: ordenEditandoId ? (ordenes.find(o => o.id === ordenEditandoId)?.fecha || fechaHoyColombia()) : fechaHoyColombia(),
    createdAt: ordenEditandoId ? (ordenes.find(o => o.id === ordenEditandoId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
    actualizadoEn: new Date().toISOString(),
    historialEstados: (() => {
    if (!ordenEditandoId) return [{ estado: "recibido", fecha: new Date().toISOString(), nota: "Orden creada" }];
    const orig = ordenes.find(o => o.id === ordenEditandoId);
    const hist = orig?.historialEstados ? [...orig.historialEstados] : [];
    const nuevoEst = $("ordenEstado").value;
    if (orig && orig.estado !== nuevoEst) {
      hist.push({ estado: nuevoEst, fecha: new Date().toISOString(), nota: "Cambio desde editor" });
    }
    return hist;
  })(),
  productoId: ordenProductoSeleccionadoId,
  stockDescontado: ordenEditandoId ? (ordenes.find(o => o.id === ordenEditandoId)?.stockDescontado || false) : false
};
  
    if (ordenEditandoId) {
      const idx = ordenes.findIndex(o => o.id === ordenEditandoId);
      if (idx !== -1) ordenes[idx] = orden;
    } else {
      ordenes.push(orden);
    }
  
    guardarOrdenesNegocio();
    $("modalOrden").classList.remove("open");
    ordenEditandoId = null;
    fotosOrdenActual = [];
    renderListaOrdenes();
    toast("✅ Orden " + orden.numero + " guardada");
  }
function guardarCliente() {
    const nombre = $("clienteNombre").value.trim();
    if (!nombre) { toast("Nombre requerido"); return; }
  
    const editandoId = $("formCliente").dataset.editandoId || null;
  
    if (editandoId) {
      // ── EDITAR existente ──
      const idx = clientes.findIndex(c => c.id === editandoId);
      if (idx !== -1) {
        clientes[idx] = {
          ...clientes[idx],
          nombre,
          empresa:   $("clienteEmpresa").value.trim(),
          nit:       $("clienteNIT").value.trim(),
          email:     $("clienteEmail").value.trim(),
          telefono:  $("clienteTelefono").value.trim(),
          direccion: $("clienteDireccion").value.trim(),
          actualizadoEn: new Date().toISOString()
        };
        guardarDatosNegocio();
        toast("✅ Cliente actualizado: " + nombre);
      }
      delete $("formCliente").dataset.editandoId;
    } else {
      // ── NUEVO ──
      const cliente = {
        id:        "cli_" + Date.now(),
        nombre,
        empresa:   $("clienteEmpresa").value.trim(),
        nit:       $("clienteNIT").value.trim(),
        email:     $("clienteEmail").value.trim(),
        telefono:  $("clienteTelefono").value.trim(),
        direccion: $("clienteDireccion").value.trim(),
        createdAt: new Date().toISOString()
      };
      clientes.push(cliente);
      guardarDatosNegocio();
      toast("✅ Cliente guardado: " + nombre);
    }
  
    cancelarFormCliente();
    renderListaClientes();
    poblarSelectClientes();
  }
function guardarProducto() {
  const nombre = $("prodNombre").value.trim();
  const precio = parseMonto($("prodPrecio").value);
  if (!nombre || precio <= 0) { toast("Nombre y precio requeridos"); return; }
  
  const ivaParseado = parseInt($("prodIVA").value);
  const ivaVal = Number.isNaN(ivaParseado) ? 19 : ivaParseado;
  const stockVal = parseInt($("prodStock")?.value) || 0;
  const stockMinVal = parseInt($("prodStockMin")?.value) || 0;
  
  const editandoId = $("formProducto").dataset.editandoId || null;
  
  if (editandoId) {
    // ── EDITAR existente ──
    const idx = catalogo.findIndex(p => p.id === editandoId);
    if (idx !== -1) {
      catalogo[idx] = {
        ...catalogo[idx],
        codigo: $("prodCodigo").value.trim(),
        nombre,
        descripcion: $("prodDescripcion").value.trim(),
        precio,
        costo: parseMonto($("prodCosto").value) || 0,
        iva: ivaVal,
        categoria: $("prodCategoria").value.trim() || "General",
        stock: stockVal,
        stockMinimo: stockMinVal,
        actualizadoEn: new Date().toISOString()
      };
      guardarCatalogoNegocio();
      renderListaCatalogo();
      toast("✅ Producto actualizado: " + nombre);
    } else {
      toast("⚠️ No se encontró el producto — revisa el catálogo");
    }
    delete $("formProducto").dataset.editandoId;
    $("formProducto").querySelector("button.primary").textContent = "💾 Guardar Producto";
    $("formProducto").style.display = "none";
    return;
  } else {
    // ── NUEVO ──
    const producto = {
      id: "prod_" + Date.now(),
      codigo: $("prodCodigo").value.trim(),
      nombre,
      descripcion: $("prodDescripcion").value.trim(),
      precio,
      costo: parseMonto($("prodCosto").value) || 0,
      iva: ivaVal,
      categoria: $("prodCategoria").value.trim() || "General",
      stock: stockVal,
      stockMinimo: stockMinVal,
      actualizadoEn: new Date().toISOString()
    };
    catalogo.push(producto);
    guardarCatalogoNegocio();
    toast("✅ Producto guardado: " + nombre);
  }
  
  // Reset form
  ["prodCodigo", "prodNombre", "prodDescripcion", "prodPrecio", "prodCosto", "prodCategoria", "prodStock", "prodStockMin"]
  .forEach(id => { const el = $(id); if (el) el.value = ""; });
  $("prodIVA").value = "19";
  $("formProducto").querySelector("button.primary").textContent = "💾 Guardar Producto";
  $("formProducto").style.display = "none";
  renderListaCatalogo();
}
function guardarCotizacion(estado) {
        const clienteId = $("cotCliente").value;
        if (!clienteId) { toast("Selecciona un cliente"); return; }
        if (productosCotActual.length === 0) { toast("Agrega al menos un producto"); return; }
        
        const cliente = clientes.find(c => c.id === clienteId);
        let subtotal = 0, ivaTotal = 0;
        productosCotActual.forEach(p => { subtotal += p.precioUnitario * p.cantidad; });
        if ((configNegocio.modoIVA || "producto") === "producto") {
          productosCotActual.forEach(p => { ivaTotal += (p.precioUnitario * p.cantidad) * (p.iva / 100); });
        } else {
          ivaTotal = subtotal * ((configNegocio.ivaGeneral ?? 19) / 100);
        }
        const total = subtotal + ivaTotal;
        
        const cotizacion = {
          id: cotEditandoId || "cot_" + Date.now(),
          numero: $("cotNumero")?.value.trim() || (cotEditandoId ? (cotizaciones.find(c => c.id === cotEditandoId)?.numero || generarNumeroCot()) : generarNumeroCot()),
          clienteId: clienteId,
          clienteNombre: cliente?.nombre || "",
          clienteEmpresa: cliente?.empresa || "",
          clienteNIT: cliente?.nit || "",
          clienteEmail: cliente?.email || "",
          productos: [...productosCotActual],
          subtotal: subtotal,
          iva: ivaTotal,
          total: total,
          validez: $("cotValidez").value,
          notas: $("cotNotas").value.trim(),
          estado: estado,
          fecha: fechaHoyColombia(),
          createdAt: new Date().toISOString()
        };
        
        if (cotEditandoId) {
          const idx = cotizaciones.findIndex(c => c.id === cotEditandoId);
          if (idx !== -1) cotizaciones[idx] = cotizacion;
          else cotizaciones.push(cotizacion);
        } else {
          cotizaciones.push(cotizacion);
        }
        
        guardarDatosNegocio();
        $("modalCotizacion").classList.remove("open");
        cotEditandoId = null;
        productosCotActual = [];
        renderListaCotizaciones();
        renderListaFacturas();
        toast("✅ Cotización " + cotizacion.numero + " guardada como " + estado);
      }
function guardarAjusteStock() {
        const prodId = $("ajusteProductoSel").value;
        const tipo = $("ajusteTipo").value;
        const cantidad = parseInt($("ajusteCantidad").value) || 0;
        const motivo = $("ajusteMotivo").value.trim();
        if (!prodId) { toast("Selecciona un producto"); return; }
        if (cantidad <= 0) { toast("Ingresa una cantidad válida"); return; }
        if (!motivo) { toast("Ingresa el motivo del ajuste"); return; }
        registrarMovimientoStock(prodId, tipo, cantidad, "Ajuste manual: " + motivo, null);
        $("ajusteCantidad").value = "";
        $("ajusteMotivo").value = "";
        mostrarFormAjusteStock();
        renderListaMovimientosStock();
        renderListaCatalogo();
        toast("✅ Stock ajustado");
      }
function guardarProveedor() {
        const nombre = $("provNombre").value.trim();
        if (!nombre) { toast("El nombre es obligatorio"); return; }
        const editandoId = $("formProveedor").dataset.editandoId || null;
        const datosProv = {
          nombre,
          telefono: $("provTelefono").value.trim(),
          email: $("provEmail").value.trim(),
          nit: $("provNIT").value.trim(),
          direccion: $("provDireccion").value.trim(),
          notas: $("provNotas").value.trim()
        };
        if (editandoId) {
          const idx = proveedores.findIndex(p => p.id === editandoId);
          if (idx !== -1) {
            proveedores[idx] = { ...proveedores[idx], ...datosProv, actualizadoEn: new Date().toISOString() };
            toast("✅ Proveedor actualizado: " + nombre);
          }
        } else {
          proveedores.push({ id: "prov_" + Date.now(), ...datosProv, createdAt: new Date().toISOString() });
          toast("✅ Proveedor guardado: " + nombre);
        }
        guardarInventarioNegocio();
        cancelarFormProveedor();
        renderListaProveedores();
        poblarSelectProveedores();
      }
function guardarProveedorRapido() {
        const nombre = ($("provRapidoNombre")?.value || "").trim();
        if (!nombre) { toast("⚠️ El nombre es obligatorio"); return; }
        const prov = {
          id: "prov_" + Date.now(),
          nombre,
          telefono: ($("provRapidoTelefono")?.value || "").trim(),
          email: "", nit: "", direccion: "", notas: "",
          createdAt: new Date().toISOString()
        };
        proveedores.push(prov);
        guardarInventarioNegocio();
        poblarSelectProveedores();
        $("compraProveedorSel").value = prov.id;
        toggleFormProveedorRapido();
        toast("✅ Proveedor guardado y seleccionado: " + nombre);
      }
function guardarCompra() {
        const proveedorId = $("compraProveedorSel").value;
        if (!proveedorId) { toast("Selecciona un proveedor"); return; }
        if (!productosCompraActual.length) { toast("Agrega al menos un producto"); return; }
        const proveedor = proveedores.find(p => p.id === proveedorId);
const total = productosCompraActual.reduce((s, p) => s + (p.costoUnitario * p.cantidad), 0);
const compra = {
  id: "compra_" + Date.now(),
  numero: $("compraNumero").value.trim() || generarNumeroCompra(),
  proveedorId,
  proveedorNombre: proveedor?.nombre || "",
  productos: [...productosCompraActual],
  total,
  estado: "pendiente",
  fecha: fechaHoyColombia(),
  fechaPago: null,
  cuentaPago: null,
  movimientoId: null,
  createdAt: new Date().toISOString()
};
        compras.push(compra);

        // Sumar al stock y actualizar costo de cada producto comprado
        productosCompraActual.forEach(p => {
          registrarMovimientoStock(p.productoId, "entrada", p.cantidad, "Compra " + compra.numero + (proveedor ? " - " + proveedor.nombre : ""), compra.id);
          const prod = catalogo.find(x => x.id === p.productoId);
          if (prod) prod.costo = p.costoUnitario;
        });
        guardarCatalogoNegocio();
        guardarInventarioNegocio();

        $("modalCompra").classList.remove("open");
        productosCompraActual = [];
        renderListaCompras();
        renderListaCatalogo();
        toast("✅ Compra " + compra.numero + " guardada — stock actualizado");
      }
function guardarFirma() {
        if (!sigCanvas) return;
        const dataURL = sigCanvas.toDataURL("image/png");
        const fact = facturas.find(f => f.id === firmaActualFacturaId);
        if (!fact) { toast("❌ Factura no encontrada"); return; }
        if (firmaActualTipo === "cliente") fact.firmaCliente = dataURL;
        else fact.firmaEncargado = dataURL;
        guardarDatosNegocio();
        $("modalFirma").classList.remove("open");
        renderListaFacturas();
        toast("✅ Firma guardada");
      }
function cargarConfigNegocioUI() {
    if ($("bizRazonSocial")) $("bizRazonSocial").value = configNegocio.razonSocial || "";
    if ($("bizNIT")) $("bizNIT").value = configNegocio.nit || "";
    if ($("bizDireccion")) $("bizDireccion").value = configNegocio.direccion || "";
    if ($("bizTelefono")) $("bizTelefono").value = configNegocio.telefono || "";
    if ($("bizEmail")) $("bizEmail").value = configNegocio.email || "";
    if ($("bizEncargado")) $("bizEncargado").value = configNegocio.encargadoNombre || "";
    if ($("bizTerminos")) $("bizTerminos").value = configNegocio.terminos || "Pago contra entrega. Validez: 15 días.";
  if ($("bizModoIVA")) $("bizModoIVA").value = configNegocio.modoIVA || "producto";
  if ($("bizIVAGeneral")) $("bizIVAGeneral").value = configNegocio.ivaGeneral ?? 19;
    
    const logoImg = $("logoPreviewImg");
    const logoPlaceholder = $("logoPlaceholder");
    if (logoImg && logoPlaceholder) {
      if (configNegocio.logo) {
        logoImg.src = configNegocio.logo;
        logoImg.style.display = "block";
        logoPlaceholder.style.display = "none";
      } else {
        logoImg.style.display = "none";
        logoPlaceholder.style.display = "block";
      }
    }
  }
function cargarLogo(event) {
    const file = event.target.files[0];
    if (!file) return;
  
    if(file.size > 2 * 1024 * 1024){
      toast("❌ Logo muy pesado, máx 2MB");
      return;
    }
  
    const reader = new FileReader();
  reader.onerror = function() {
    toast("❌ Error al leer el archivo de imagen");
  };
  reader.onload = function(e) {
      const img = new Image();
      img.onerror = function() {
        toast("❌ El archivo no es una imagen válida");
      };
      img.onload = function() {
        const canvas = document.createElement("canvas");
        const maxW = 400;
        const scale = Math.min(1, maxW / img.width);
        canvas.width  = img.width  * scale;
        canvas.height = img.height * scale;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        const logoComprimido = canvas.toDataURL("image/jpeg", 0.8);
        configNegocio.logo = logoComprimido;
  localStorage.setItem("biz_logo_backup", logoComprimido);
  guardarDatosNegocio();
        setTimeout(() => {
          const logoImg = document.getElementById("logoPreviewImg");
          const logoPlaceholder = document.getElementById("logoPlaceholder");
          if(logoImg){ logoImg.src = logoComprimido; logoImg.style.display = "block"; }
          if(logoPlaceholder) logoPlaceholder.style.display = "none";
        }, 100);
        toast("✅ Logo guardado");
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
function guardarConfigNegocio() {
    const logoActual = configNegocio.logo || "";
    
    configNegocio.razonSocial = $("bizRazonSocial").value.trim();
    configNegocio.nit = $("bizNIT").value.trim();
    configNegocio.direccion = $("bizDireccion").value.trim();
    configNegocio.telefono = $("bizTelefono").value.trim();
    configNegocio.email = $("bizEmail").value.trim();
    configNegocio.encargadoNombre = $("bizEncargado").value.trim();
  configNegocio.terminos = $("bizTerminos").value.trim();
  configNegocio.modoIVA = $("bizModoIVA").value;
  configNegocio.ivaGeneral = parseFloat($("bizIVAGeneral").value) || 19;
  configNegocio.logo = logoActual;
    
    localStorage.setItem("biz_config", JSON.stringify(configNegocio));
  
    // ✅ SOLO guardar configNegocio, NUNCA catalogo ni cotizaciones aquí
    if (window.db && window.auth?.currentUser && navigator.onLine) {
      const uid = window.auth.currentUser.uid;
      const configSinLogo = { ...configNegocio, logo: "" };
      window.fbSetDoc(
        window.fbDoc(window.db, "negocio_data", uid),
        { configNegocio: configSinLogo },  // solo este campo
        { merge: true }
      ).then(() => toast("✅ Configuración guardada"))
       .catch(e => console.error(e));
    } else {
      toast("✅ Configuración guardada localmente");
    }
  }
async function guardarEnCola(movimiento){const db=await initIndexedDB();const tx=db.transaction("pendingQueue","readwrite");tx.objectStore("pendingQueue").add({...movimiento,createdAt:Date.now()});await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=reject});await actualizarContadorPendientes();}
async function guardarConOffline(datos,ctx){const idLocal="local_"+Date.now()+"_"+Math.random().toString(36).substr(2,8);const datosConId={...datos,ID:idLocal};if(ctx===contexto){data.push(datosConId);guardarDatos();}else{const otraData=JSON.parse(localStorage.getItem(keyForCtx("dataCache",ctx))||"[]");otraData.push(datosConId);localStorage.setItem(keyForCtx("dataCache",ctx),JSON.stringify(otraData));}if(navigator.onLine&&window.db&&window.auth?.currentUser){try{const colName=ctx==="negocio"?"movimientos_negocio":"movimientos_personal";const fbRef=await window.fbAddDoc(window.fbCollection(window.db,"users",window.auth.currentUser.uid,colName),datos);const fbId=fbRef.id;if(ctx===contexto){const idx=data.findIndex(d=>String(d.ID)===idLocal);if(idx!==-1)data[idx].ID=fbId;guardarDatos();}else{const otraData=JSON.parse(localStorage.getItem(keyForCtx("dataCache",ctx))||"[]");const idx=otraData.findIndex(d=>String(d.ID)===idLocal);if(idx!==-1)otraData[idx].ID=fbId;localStorage.setItem(keyForCtx("dataCache",ctx),JSON.stringify(otraData));}return fbId;}catch(e){await guardarEnCola({idLocal,datos,contexto:ctx});toast("📡 Pendiente");return idLocal;}}else{await guardarEnCola({idLocal,datos,contexto:ctx});toast("📡 Pendiente");return idLocal;}}
async function cargarDesdeFirebase(){if(!window.db||!window.auth?.currentUser)return false;const colNamePersonal="movimientos_personal";const colNameNegocio="movimientos_negocio";const uidCarga=negocioId||window.auth.currentUser.uid;try{const snapPersonal=await window.fbGetDocs(window.fbCollection(window.db,"users",uidCarga,colNamePersonal));const fbPersonal=[];snapPersonal.forEach(doc=>fbPersonal.push({...doc.data(),ID:doc.id}));const snapNegocio=await window.fbGetDocs(window.fbCollection(window.db,"users",uidCarga,colNameNegocio));const fbNegocio=[];snapNegocio.forEach(doc=>fbNegocio.push({...doc.data(),ID:doc.id}));localStorage.setItem(keyForCtx("dataCache","personal"),JSON.stringify(fbPersonal));localStorage.setItem(keyForCtx("dataCache","negocio"),JSON.stringify(fbNegocio));if(contexto==="personal")data=fbPersonal;else data=fbNegocio;const pendientes=await obtenerCola();const pendientesPorContexto=pendientes.filter(p=>p.contexto===contexto);for(const p of pendientesPorContexto){if(!data.some(d=>String(d.ID)===String(p.idLocal)))data.push({...p.datos,ID:p.idLocal});}guardarDatos();return true;}catch(e){if(contexto==="personal")data=JSON.parse(localStorage.getItem(keyForCtx("dataCache","personal"))||"[]");else data=JSON.parse(localStorage.getItem(keyForCtx("dataCache","negocio"))||"[]");return false;}}
async function cargarTodosLosDatosFirebase() {
  if (!window.db || !window.auth?.currentUser || !navigator.onLine) {
    prestamos = JSON.parse(localStorage.getItem("prestamos") || "[]");
    inversiones = JSON.parse(localStorage.getItem("inversiones") || "[]");
    goals = JSON.parse(localStorage.getItem(keyFor("goals")) || "[]");
    return;
  }
  const uid = window.auth.currentUser.uid;
  const sb = document.getElementById("syncBadge");
  if (sb) { sb.innerText = "⏳ Sync..."; sb.style.background = "rgba(245,158,11,.2)"; sb.style.color = "#f59e0b"; }
  try {
    const [prestamosSnap, inversionesSnap, metasSnap, presupuestosSnap, recurrentesSnap] = await Promise.all([
      window.fbGetDoc(window.fbDoc(window.db, "usuarios_prestamos", uid)).catch(() => null),
      window.fbGetDoc(window.fbDoc(window.db, "usuarios_inversiones", uid)).catch(() => null),
      window.fbGetDoc(window.fbDoc(window.db, "usuarios_metas", uid)).catch(() => null),
      window.fbGetDoc(window.fbDoc(window.db, "usuarios_presupuestos", uid)).catch(() => null),
      window.fbGetDoc(window.fbDoc(window.db, "usuarios_recurrentes", uid)).catch(() => null),
    ]);
    if (prestamosSnap?.exists() && prestamosSnap.data().prestamos) {
      prestamos = prestamosSnap.data().prestamos;
      localStorage.setItem("prestamos", JSON.stringify(prestamos));
    }
    if (inversionesSnap?.exists() && inversionesSnap.data().inversiones) {
      inversiones = inversionesSnap.data().inversiones;
      localStorage.setItem("inversiones", JSON.stringify(inversiones));
    }
    if (metasSnap?.exists() && metasSnap.data().goals) {
      goals = metasSnap.data().goals;
      localStorage.setItem(keyFor("goals"), JSON.stringify(goals));
    }
    if (presupuestosSnap?.exists()) {
      const d = presupuestosSnap.data();
      const keyP = "budgets_" + contexto;
      if (d[keyP]) localStorage.setItem(keyFor("budgets"), JSON.stringify(d[keyP]));
    }
    if (recurrentesSnap?.exists() && recurrentesSnap.data().recurrentes) {
      localStorage.setItem(keyFor("recurrentes"), JSON.stringify(recurrentesSnap.data().recurrentes));
    }
    if (sb) { sb.innerText = "✅ Sync"; sb.style.background = "rgba(34,197,94,.2)"; sb.style.color = "#22c55e"; }
  } catch (e) {
    console.error("Error sync total:", e);
    prestamos = JSON.parse(localStorage.getItem("prestamos") || "[]");
    inversiones = JSON.parse(localStorage.getItem("inversiones") || "[]");
    goals = JSON.parse(localStorage.getItem(keyFor("goals")) || "[]");
    if (sb) { sb.innerText = "⚠️ Error"; sb.style.background = "rgba(239,68,68,.2)"; sb.style.color = "#ef4444"; }
  }
}
async function cargarHistorialDesdeFirebase(){if(!window.db||!window.auth?.currentUser)return;try{const colHistorico="historial_mensual";const snapshot=await window.fbGetDocs(window.fbCollection(window.db,"users",window.auth.currentUser.uid,colHistorico));const historialFirebase=[];snapshot.forEach(doc=>historialFirebase.push({...doc.data(),id:doc.id}));if(historialFirebase.length>0){const existingIds=new Set(historial.map(h=>h.id));const nuevos=historialFirebase.filter(h=>!existingIds.has(h.id));historial.push(...nuevos);historial.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));localStorage.setItem(keyFor("historialMeses"),JSON.stringify(historial));}}catch(e){console.error("Error cargando historial:",e);}}
document.addEventListener("DOMContentLoaded",()=>{
    initIndexedDB();
    // $("today") no existe en el HTML - comentado
    // $("today").innerText = hoyColombia().toLocaleDateString("es-CO",{weekday:"long",day:"numeric",month:"long"});
    const fechaEl = $("fecha");
    if (fechaEl) fechaEl.value = fechaParaInput();
    aplicarTema(temaActual);aplicarTema(temaActual);$("tabLoginBtn").onclick=()=>switchLoginTab("login");$("tabRegisterBtn").onclick=()=>switchLoginTab("register");$("loginBtn").onclick=iniciarSesion;$("registerBtn").onclick=registrarUsuario;$("traspasoDireccion")?.addEventListener("change",poblarTraspaso);$("toggleDiario").checked=localStorage.getItem("notiDiaria")==="1";$("horaRecordatorio").value=localStorage.getItem("horaNoti")||"20";cargarDatosNegocio();actualizarStatusBar();setInterval(actualizarStatusBar,10000);checkFB();setTimeout(verificarCotizacionesVencidas, 3000);verificarCierreAutomatico();setInterval(verificarCierreAutomatico,60000);});
async function guardarCuentas(ctx) {
        // SIEMPRE usar el ctx pasado explícitamente, nunca asumir
        const contextoReal = ctx || contexto;
        const lsKey = uid() + "_" + (contextoReal === "negocio" ? "Negocio" : "") + "cuentas";
      
        if (!window.auth?.currentUser) {
          localStorage.setItem(lsKey, JSON.stringify(cuentas));
          return;
        }
      
        const uidVal = window.auth.currentUser.uid;
        try {
          const docRef = window.fbDoc(window.db, "usuarios_cuentas", uidVal + "_" + contextoReal);
          await window.fbSetDoc(docRef, {
            cuentas: cuentas,
            actualizado: new Date().toISOString()
          });
          localStorage.setItem(lsKey, JSON.stringify(cuentas));
        } catch (e) {
          console.error("Error guardando cuentas:", e);
          localStorage.setItem(lsKey, JSON.stringify(cuentas));
        }
      }
async function cargarCuentas(){if(!window.auth?.currentUser)return false;const uid=window.auth.currentUser.uid;const defC={personal:[{id:"nequi_"+uid,nombre:"Nequi",icon:"📱",saldoInicial:0},{id:"davivienda_"+uid,nombre:"Davivienda",icon:"🏦",saldoInicial:0},{id:"efectivo_"+uid,nombre:"Efectivo",icon:"💵",saldoInicial:0}],negocio:[{id:"caja_neg_"+uid,nombre:"Caja Negocio",icon:"🏪",saldoInicial:0},{id:"banco_neg_"+uid,nombre:"Banco Negocio",icon:"🏦",saldoInicial:0}]};
  try{
  const docRef=window.fbDoc(window.db,"usuarios_cuentas",(negocioId||uid)+"_"+contexto);
  const docSnap=await window.fbGetDoc(docRef);

  if(docSnap.exists() && docSnap.data()["cuentas"] && docSnap.data()["cuentas"].length > 0){
    cuentas = docSnap.data()["cuentas"];
    cuentas = cuentas.map(c=>({...c, saldoInicial: c.saldoInicial||0}));
  } else {
    // No hay cuentas en Firebase — crear las predeterminadas
    cuentas = defC[contexto] || defC.personal;
    await guardarCuentas(contexto);
    toast("🏦 Cuentas predeterminadas creadas");
  }

  // Doble verificación — si por alguna razón quedó vacío igual las pone
  if(!cuentas || cuentas.length === 0){
    cuentas = defC[contexto] || defC.personal;
    await guardarCuentas(contexto);
  }

  const uidReal = window.auth?.currentUser?.uid || localStorage.getItem("uid") || "guest";
  const lsKey2 = uidReal + "_" + (contexto==="negocio"?"Negocio":"") + "cuentas";
  localStorage.setItem(lsKey2, JSON.stringify(cuentas));
  return true;

}catch(e){
  console.error("Error cargando cuentas:",e);
  // Si falla Firebase, intentar desde localStorage
  const saved = localStorage.getItem(keyFor("cuentas"));
  if(saved){
    cuentas = JSON.parse(saved);
  }
  // Si localStorage también está vacío, poner predeterminadas localmente
  if(!cuentas || cuentas.length === 0){
    cuentas = defC[contexto] || defC.personal;
    localStorage.setItem(keyFor("cuentas"), JSON.stringify(cuentas));
    toast("🏦 Cuentas predeterminadas cargadas (sin conexión)");
  }
  return false;
}}
async function cargarCategorias(){
    if(!window.auth?.currentUser) return false;
    const uid = window.auth.currentUser.uid;
    const defCat = {
      personal:[
        {id:"ingreso_"+uid,nombre:"Ingreso",icon:"💰",tipo:"ingreso"},
        {id:"comida_"+uid,nombre:"Comida",icon:"🍔",tipo:"gasto"},
        {id:"vivienda_"+uid,nombre:"Vivienda",icon:"🏠",tipo:"gasto"},
        {id:"transporte_"+uid,nombre:"Transporte",icon:"🚗",tipo:"gasto"},
        {id:"servicios_"+uid,nombre:"Servicios",icon:"💡",tipo:"gasto"},
        {id:"entretenimiento_"+uid,nombre:"Entretenimiento",icon:"🎮",tipo:"gasto"},
        {id:"ahorro_"+uid,nombre:"Ahorro",icon:"🏦",tipo:"ambos"}
      ],
      negocio:[
        {id:"ventas_"+uid,nombre:"Ventas",icon:"💰",tipo:"ingreso"},
        {id:"inventario_"+uid,nombre:"Inventario",icon:"📦",tipo:"gasto"},
        {id:"nomina_"+uid,nombre:"Nómina",icon:"👷",tipo:"gasto"},
        {id:"servicios_pub_"+uid,nombre:"Servicios",icon:"💡",tipo:"gasto"}
      ]
    };
    try {
      const docRef = window.fbDoc(window.db,"usuarios_categorias",uid);
      const docSnap = await window.fbGetDoc(docRef);
      const key = "categorias_" + contexto;
  
      if(docSnap.exists()){
        const d = docSnap.data();
        if(d[key] && d[key].length > 0){
          // Clave nueva con datos ✅
          categorias = d[key];
        } else if(d["categorias"] && d["categorias"].length > 0){
          // Clave vieja — migrar automáticamente ✅
          categorias = d["categorias"];
          // Guardar en la clave correcta para que quede bien de ahora en adelante
          await window.fbSetDoc(docRef, {
            ["categorias_personal"]: categorias,
            ["categorias_negocio"]: defCat.negocio
          }, {merge: true});
          toast("✅ Categorías migradas correctamente");
        } else {
          categorias = defCat[contexto] || defCat.personal;
          await window.fbSetDoc(docRef,{[key]:categorias},{merge:true});
        }
      } else {
        categorias = defCat[contexto] || defCat.personal;
        await window.fbSetDoc(docRef,{[key]:categorias},{merge:true});
      }
  
      localStorage.setItem(keyForCtx("categorias", contexto), JSON.stringify(categorias));
      return true;
    } catch(e) {
      console.error("Error cargando categorías:",e);
      categorias = defCat[contexto] || defCat.personal;
      return false;
    }
  }
function guardarDatos() {
        // Guardar en localStorage
        localStorage.setItem(keyFor("dataCache"), JSON.stringify(data));
        localStorage.setItem(keyFor("cuentas"), JSON.stringify(cuentas));
        localStorage.setItem(keyForCtx("categorias", contexto), JSON.stringify(categorias));
        localStorage.setItem(keyFor("goals"), JSON.stringify(goals));
        localStorage.setItem("prestamos", JSON.stringify(prestamos));
        localStorage.setItem("inversiones", JSON.stringify(inversiones));
        localStorage.setItem(keyFor("budgets"), JSON.stringify(getBudgets()));
        localStorage.setItem(keyFor("recurrentes"), JSON.stringify(JSON.parse(localStorage.getItem(keyFor("recurrentes")) || "[]")));
        
        // Guardar en Firebase si hay usuario y conexión
        if (window.db && window.auth?.currentUser && navigator.onLine) {
          const uid = window.auth.currentUser.uid;
          
          
          // Guardar categorías
          window.fbSetDoc(window.fbDoc(window.db, "usuarios_categorias", uid), {
            ["categorias_" + contexto]: categorias
          }, { merge: true });
          
          // Guardar metas
          window.fbSetDoc(window.fbDoc(window.db, "usuarios_metas", uid), { goals: goals }, { merge: true });
          
          // Guardar presupuestos
          window.fbSetDoc(window.fbDoc(window.db, "usuarios_presupuestos", uid), {
            ["budgets_" + contexto]: getBudgets()
          }, { merge: true });
          
          // Guardar recurrentes
          const recurrentes = JSON.parse(localStorage.getItem(keyFor("recurrentes")) || "[]");
          window.fbSetDoc(window.fbDoc(window.db, "usuarios_recurrentes", uid), { recurrentes: recurrentes }, { merge: true });
          
          // Guardar préstamos
          window.fbSetDoc(window.fbDoc(window.db, "usuarios_prestamos", uid), { prestamos: prestamos }, { merge: true });
          
          // Guardar inversiones
          window.fbSetDoc(window.fbDoc(window.db, "usuarios_inversiones", uid), { inversiones: inversiones }, { merge: true });
          
         // Guardar datos de negocio (catálogo va en su propio documento, ver guardarCatalogoNegocio)
          const configSinLogo = { ...configNegocio, logo: "" };
  window.fbSetDoc(window.fbDoc(window.db, "negocio_data", uid), {
    clientes: clientes,
    cotizaciones: cotizaciones,
          facturas: facturas,
          configNegocio: configSinLogo,
  }, { merge: true });
        }
      }
function setContexto(ctx) {
    // Guardar datos actuales ANTES de cambiar contexto
    const ctxAnterior = contexto;
    guardarDatos(); // guarda con ctxAnterior aún activo ✅
    
    contexto = ctx;
        localStorage.setItem("contexto", ctx);
        
        // ✅ LIMPIAR cuentas, categorías y datos antes de cargar el nuevo contexto
        cuentas = [];
        categorias = [];
        data = [];
        document.body.classList.toggle("modo-negocio", ctx === "negocio");
        
        document.getElementById("ctxPersonal")?.classList.toggle("ctx-active", ctx === "personal");
        document.getElementById("ctxNegocio")?.classList.toggle("ctx-active", ctx === "negocio");
        
        actualizarNavNegocio();
        
        // Recargar datos del nuevo contexto desde Firebase
        cargarCuentas().then(() => {
        cargarCategorias().then(() => {
        cargarDesdeFirebase().then(() => {
          cargarDatosNegocio();
          poblarSelects();
          actualizarLabels();
          render();
  
          // ✅ Re-renderizar la pestaña activa automáticamente
          const tabActiva = document.querySelector(".tab.active");
          const idTab = tabActiva?.id?.replace("tab-", "");
  
          if(idTab === "list"){
            renderHistorial();
            renderLista();
          }
          if(idTab === "settings"){
            renderCuentasAdmin();
renderCatsAdmin();
renderHistorialAdmin();
cargarConfigNegocioUI();
renderEquipoAdmin();
          }
          if(idTab === "dashboard"){
            setTimeout(() => {
              renderCharts();
              renderInversiones();
              renderPrestamos();
              if(contexto === "negocio") renderDashboardNegocio();
            }, 400);
          }
          if(idTab === "goals"){
            renderBudgets();
            renderRecList();
          }
          if(idTab === "quotes"){
            renderListaCotizaciones();
          }
  
          toast(`🔄 Cambiado a ${ctx === "personal" ? "Personal" : "Negocio"}`);
        });
      });
    });
      }
async function guardar(){if(modoActual==="traspaso"){await guardarTraspaso();return;}const saldos=calcSaldos();let datos;if(modoActual==="transferencia"){const m=parseMonto($("montoTransfer").value);if(m<=0){toast("Monto requerido");return}if($("cuentaOrigen").value===$("cuentaDestino").value){toast("Origen ≠ Destino");return}if(m>(saldos[$("cuentaOrigen").value]||0)){toast("❌ Saldo insuficiente");return}datos={Fecha:$("fecha").value,Tipo:"Transferencia",CuentaOrigen:$("cuentaOrigen").value,CuentaDestino:$("cuentaDestino").value,Descripción:$("descTransfer").value.trim()||"Transferencia",Monto:m,Categoría:"🔄 Transferencia",Contexto:contexto};$("montoTransfer").value=$("descTransfer").value="";}else{const m=parseMonto($("montoInput").value);if(!$("descripcion").value.trim()||m<=0){toast("Completa");return}if(modoActual==="gasto"&&m>(saldos[$("cuentaSel").value]||0)){toast("❌ Saldo insuficiente");return}datos={Fecha:$("fecha").value,Tipo:modoActual==="ingreso"?"Ingreso":"Gasto",Cuenta:$("cuentaSel").value,Categoría:$("categoria").value,Descripción:$("descripcion").value.trim(),Monto:m,Nota:$("notaInput").value.trim(),Contexto:contexto};$("descripcion").value=$("montoInput").value=$("notaInput").value="";}const idGuardado=await guardarConOffline(datos,contexto);if(!String(idGuardado).startsWith("local_"))toast("✔ Guardado ☁");else toast("📡 Pendiente");$("fecha").value=fechaParaInput();const seen=new Set();data=data.filter(d=>{const id=String(d.ID);if(seen.has(id))return false;seen.add(id);return true});guardarDatos();render();const sc=$("syncCount");if(sc)sc.innerText=data.length;}
async function guardarTraspaso(){const m=parseMonto($("montoTrspaso").value),desc=$("descTrspaso").value.trim()||"Traspaso",dir=$("traspasoDireccion").value,co=$("traspasoOrigen").value,cd=$("traspasoDestino").value,f=$("fecha").value;if(m<=0){toast("Monto");return}const ctxO=dir==="p2n"?"personal":"negocio",ctxD=dir==="p2n"?"negocio":"personal";const rO={Fecha:f,Tipo:"TraspasoSalida",Cuenta:co,Categoría:"🔀 Traspaso",Descripción:desc+" → "+(ctxD==="negocio"?"🏪":"👤"),Monto:m,Contexto:ctxO};const rD={Fecha:f,Tipo:"TraspasoEntrada",Cuenta:cd,Categoría:"🔀 Traspaso",Descripción:desc+" ← "+(ctxO==="negocio"?"🏪":"👤"),Monto:m,Contexto:ctxD};await guardarConOffline(rO,ctxO);await guardarConOffline(rD,ctxD);if(ctxO===contexto)data=data.filter(d=>String(d.ID)!==String(rO.ID));if(ctxD===contexto)data=data.filter(d=>String(d.ID)!==String(rD.ID));guardarDatos();$("montoTrspaso").value=$("descTrspaso").value="";$("fecha").value=fechaParaInput();render();toast("✔ Traspaso: "+money(m));}
function addBudget(){const cat=$("budgetCatSel").value,m=parseMonto($("budgetMonto").value);if(!cat||m<=0){toast("Completa");return}const b=getBudgets();b[cat]=m;localStorage.setItem(keyFor("budgets"),JSON.stringify(b));guardarDatos();$("budgetMonto").value="";renderBudgets();toast("✔ Guardado")}
function delBudget(cat){const b=getBudgets();delete b[cat];localStorage.setItem(keyFor("budgets"),JSON.stringify(b));guardarDatos();renderBudgets()}
function addRecurrente(){const c=$("recCuentaSel").value,cat=$("recCatSel").value,d=$("recDesc").value.trim(),m=parseMonto($("recMonto").value);if(!d||m<=0){toast("Completa");return}const r=JSON.parse(localStorage.getItem(keyFor("recurrentes"))||"[]");r.push({id:"rec_"+Date.now(),cuenta:c,cat,desc:d,monto:m});localStorage.setItem(keyFor("recurrentes"),JSON.stringify(r));guardarDatos();$("recDesc").value=$("recMonto").value="";renderRecList();toast("✔ Agregado")}
function delRec(id){const r=JSON.parse(localStorage.getItem(keyFor("recurrentes"))||"[]").filter(x=>x.id!==id);localStorage.setItem(keyFor("recurrentes"),JSON.stringify(r));guardarDatos();renderRecList()}
async function aplicarRecurrentes(){const r=JSON.parse(localStorage.getItem(keyFor("recurrentes"))||"[]");if(!r.length){toast("Sin recurrentes");return}if(!confirm("¿Aplicar "+r.length+" gastos?"))return;const f=fechaHoyColombia();for(const x of r){const datos={Fecha:f,Tipo:"Gasto",Cuenta:x.cuenta,Categoría:x.cat,Descripción:x.desc+" (rec)",Monto:x.monto,Nota:"Auto",Contexto:contexto};await guardarConOffline(datos,contexto);}render();toast("✔ "+r.length+" aplicados")}
async function limpiarCache(ctx){if(!confirm(`⚠️ ¿Limpiar caché de ${ctx==="personal"?"👤 Personal":"🏪 Negocio"}? Los datos se recargarán desde Firebase automáticamente.`))return;localStorage.removeItem(keyForCtx("dataCache",ctx));localStorage.removeItem(keyForCtx("cuentas",ctx));localStorage.removeItem(keyForCtx("categorias",ctx));localStorage.removeItem(keyForCtx("budgets",ctx));localStorage.removeItem(keyForCtx("recurrentes",ctx));localStorage.removeItem(keyForCtx("goals",ctx));if(ctx===contexto){data=[];cuentas=[];categorias=[];toast("🔄 Recargando datos desde Firebase...");await cargarCuentas();await cargarCategorias();
      poblarSelects();
      await cargarDesdeFirebase();await cargarHistorialDesdeFirebase();cargarDatosNegocio();historial=JSON.parse(localStorage.getItem(keyFor("historialMeses"))||"[]");if(window.db&&window.auth?.currentUser){try{const metasDoc=await window.fbGetDoc(window.fbDoc(window.db,"usuarios_metas",window.auth.currentUser.uid));if(metasDoc.exists()&&metasDoc.data().goals)goals=metasDoc.data().goals;else goals=JSON.parse(localStorage.getItem(keyFor("goals"))||"[]")}catch(e){goals=JSON.parse(localStorage.getItem(keyFor("goals"))||"[]")}}poblarSelects();actualizarLabels();render();const sc=$("syncCount");if(sc)sc.innerText=data.length;toast(`✅ Caché de ${ctx==="personal"?"👤 Personal":"🏪 Negocio"} limpiado y recargado`)}else{toast(`✅ Caché de ${ctx==="personal"?"👤 Personal":"🏪 Negocio"} limpiado`)}await actualizarContadorPendientes()}
function guardarClienteRapido() {
  const nombre = (document.getElementById("cliRapidoNombre")?.value || "").trim();
  if (!nombre) { toast("⚠️ El nombre es obligatorio"); return; }

  const cliente = {
    id: "cli_" + Date.now(),
    nombre,
    empresa:   (document.getElementById("cliRapidoEmpresa")?.value  || "").trim(),
    nit:       (document.getElementById("cliRapidoNIT")?.value      || "").trim(),
    email:     (document.getElementById("cliRapidoEmail")?.value    || "").trim(),
    telefono:  (document.getElementById("cliRapidoTelefono")?.value || "").trim(),
    direccion: "",
    createdAt: new Date().toISOString()
  };

  clientes.push(cliente);
  guardarDatosNegocio();
  poblarSelectClientes();

  // Seleccionarlo automáticamente en la cotización
  elegirCliente(cliente.id);

  // Cerrar el formulario y limpiar
  toggleFormClienteRapido();
  toast("✅ Cliente guardado y seleccionado: " + nombre);
}
function guardarProductoRapido() {
  const nombre = (document.getElementById("prodRapidoNombre")?.value || "").trim();
  const precio = parseMonto(document.getElementById("prodRapidoPrecio")?.value || "");
  if (!nombre || precio <= 0) { toast("⚠️ Nombre y precio son obligatorios"); return; }

  const ivaParseadoRapido = parseInt(document.getElementById("prodRapidoIVA")?.value);
  const ivaValRapido = Number.isNaN(ivaParseadoRapido) ? 19 : ivaParseadoRapido;

  const producto = {
    id:          "prod_" + Date.now(),
    codigo:      "",
    nombre,
    descripcion: "",
    precio,
    costo:       parseMonto(document.getElementById("prodRapidoCosto")?.value || "") || 0,
    iva:         ivaValRapido,
    categoria:   (document.getElementById("prodRapidoCategoria")?.value || "").trim() || "General",
    actualizadoEn: new Date().toISOString()
  };
catalogo.push(producto);
  guardarCatalogoNegocio();

  // Agregarlo directo a la cotización actual
  productosCotActual.push({
    productoId:     producto.id,
    codigo:         producto.codigo,
    nombre:         producto.nombre,
    descripcion:    producto.descripcion,
    precioUnitario: producto.precio,
    iva:            producto.iva,
    cantidad:       1,
    descuento:      0
  });

  renderProductosCotizacion();
  actualizarTotalesCot();
  toggleFormProductoRapido();
  toast("✅ Producto guardado y agregado: " + nombre);
}
