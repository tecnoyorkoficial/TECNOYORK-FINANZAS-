// js/reports.js — generación de PDF, comprobantes, manual y exportes

function generarReciboOrdenPDF(id) {
    const orden = ordenes.find(o => o.id === id);
    if (!orden) { toast("❌ Orden no encontrada"); return; }
    
    const fechaFormateada = new Date(orden.fecha + "T00:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
    const colorBase = configNegocio.colorDocumentos || "#22c55e";
    const colorOscuro = hexAOscuro(colorBase);
    const colorClaro = hexAClaro(colorBase);
    const est = ESTADOS_ORDEN[orden.estado] || ESTADOS_ORDEN.recibido;
    
    const fotosHTML = (orden.fotos && orden.fotos.length) ? `
      <div style="padding:0 28px 16px;">
        <div style="font-size:11px;font-weight:700;color:${colorBase};letter-spacing:1px;margin-bottom:8px;">ESTADO FÍSICO DEL EQUIPO AL RECIBIR</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          ${orden.fotos.map(f => `<img src="${f}" style="width:140px;height:140px;object-fit:cover;border-radius:8px;border:1px solid #ddd;">`).join("")}
        </div>
      </div>` : '';
    
    const html = `
      <div style="font-family:Arial,sans-serif;color:#1a1a1a;background:#fff;padding:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;background:#fff;padding:24px 28px 16px;border-bottom:3px solid ${colorBase};">
          <div style="display:flex;align-items:center;gap:16px;">
            ${configNegocio.logo ? `<img src="${configNegocio.logo}" style="max-width:150px;max-height:120px;object-fit:contain;">` : ''}
            <div>
              <div style="font-size:20px;font-weight:900;">${configNegocio.razonSocial || 'MI EMPRESA'}</div>
              <div style="font-size:11px;color:#555;margin-top:2px;">${configNegocio.direccion || ''}</div>
              <div style="font-size:11px;color:#555;">${configNegocio.telefono ? '📞 ' + configNegocio.telefono : ''} ${configNegocio.email ? '✉️ ' + configNegocio.email : ''}</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:28px;font-weight:900;letter-spacing:1px;">RECIBO DE EQUIPO</div>
            <div style="font-size:18px;font-weight:700;color:${colorBase};margin-top:4px;">${orden.numero}</div>
            <div style="font-size:11px;color:#555;margin-top:6px;">📅 ${fechaFormateada}</div>
            <div style="font-size:11px;font-weight:700;color:${est.color};">${est.label}</div>
          </div>
        </div>
  
        <div style="padding:16px 28px;">
          <div style="background:${colorClaro};border:1px solid ${colorBase}55;border-radius:10px;padding:14px 18px;">
            <div style="font-size:11px;font-weight:700;color:${colorBase};letter-spacing:1px;margin-bottom:8px;">DATOS DEL CLIENTE</div>
            <div style="font-size:13px;font-weight:700;">${orden.clienteNombre}</div>
            ${orden.clienteTelefono ? `<div style="font-size:11px;color:#666;">📞 ${orden.clienteTelefono}</div>` : ''}
          </div>
        </div>
  
        <div style="padding:0 28px 16px;">
          <div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px 18px;">
            <div style="font-size:11px;font-weight:700;color:${colorBase};letter-spacing:1px;margin-bottom:8px;">DATOS DEL EQUIPO</div>
            <div style="font-size:12px;margin-bottom:4px;"><b>Marca/Modelo:</b> ${orden.marca} ${orden.modelo || ''}</div>
            <div style="font-size:12px;margin-bottom:4px;"><b>Problema reportado:</b> ${orden.problema}</div>
            ${Object.entries(orden.camposExtra || {}).filter(([k,v])=>v).map(([k,v]) => {
              const campo = (configNegocio.camposOrdenExtra||[]).find(c=>c.id===k);
              return campo ? `<div style="font-size:12px;margin-bottom:4px;"><b>${campo.label}:</b> ${v}</div>` : '';
            }).join('')}
            ${orden.observaciones ? `<div style="font-size:12px;color:#555;"><b>Observaciones:</b> ${orden.observaciones}</div>` : ''}
          </div>
        </div>
  
        ${fotosHTML}
  
        <div style="padding:0 28px 16px;display:flex;justify-content:flex-end;">
          <div style="background:${colorClaro};border:1px solid ${colorBase}55;border-radius:10px;padding:14px 20px;min-width:200px;">
            <div style="display:flex;justify-content:space-between;font-size:12px;">
              <span>${orden.precioFinal ? 'Total cobrado:' : 'Precio estimado:'}</span>
              <span style="font-weight:800;color:${colorOscuro};">${money(orden.precioFinal || orden.precioEstimado || 0)}</span>
            </div>
          </div>
        </div>
  
        <div style="padding:0 28px 16px;">
          <div style="font-size:10px;color:#888;">${configNegocio.terminos || 'El equipo no reclamado en 30 días será considerado abandonado.'}</div>
        </div>
  
        <div style="background:${colorOscuro};color:#fff;padding:14px 28px;display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
    <div style="font-size:11px;">${configNegocio.direccion ? '📍 ' + configNegocio.direccion : ''}</div>
    <div style="font-size:11px;text-align:center;font-weight:700;">${configNegocio.razonSocial || ''}</div>
    <div style="font-size:11px;text-align:right;">${configNegocio.telefono ? '📞 ' + configNegocio.telefono : ''}</div>
  </div>
  </div>
  `;
  $("pdfPreview").innerHTML = html;
  $("modalPDF").classList.add("open");
  }
let datosPDFActual = null;
function generarCotizacionPDF() {
        const clienteId = $("cotCliente").value;
        if (!clienteId) { toast("Selecciona un cliente"); return; }
        if (productosCotActual.length === 0) { toast("Agrega al menos un producto"); return; }
        
        datosPDFActual = {
          clienteId: clienteId,
          productos: JSON.parse(JSON.stringify(productosCotActual)),
          validez: $("cotValidez").value,
          notas: $("cotNotas").value
        };
        
        mostrarVistaPreviaPDF();
      }
function mostrarVistaPreviaPDF() {
    const clienteId = datosPDFActual ? datosPDFActual.clienteId : $("cotCliente")?.value;
    const productos = datosPDFActual ? datosPDFActual.productos : productosCotActual;
    const validez = datosPDFActual ? datosPDFActual.validez : ($("cotValidez")?.value || "15 días");
    const notas = datosPDFActual ? datosPDFActual.notas : ($("cotNotas")?.value || "");
  
    if (!clienteId || productos.length === 0) { toast("❌ Sin datos para generar PDF"); return; }
  
    const cliente = clientes.find(c => c.id === clienteId);
    let subtotal = 0, ivaTotal = 0;
    productos.forEach(p => { subtotal += p.precioUnitario * p.cantidad; });
    if ((configNegocio.modoIVA || "producto") === "producto") {
      productos.forEach(p => { ivaTotal += (p.precioUnitario * p.cantidad) * (p.iva / 100); });
    } else {
      ivaTotal = subtotal * ((configNegocio.ivaGeneral ?? 19) / 100);
    }
    const total = subtotal + ivaTotal;
  
    let numCot = "COT-PREV-" + new Date().getFullYear();
    if (cotEditandoId) {
      const cotExistente = cotizaciones.find(c => c.id === cotEditandoId);
      if (cotExistente) numCot = cotExistente.numero;
    }
  
    const fechaFormateada = new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
    const colorBase = configNegocio.colorDocumentos || "#22c55e";
    const colorOscuro = hexAOscuro(colorBase);
    const colorClaro = hexAClaro(colorBase);
  
    const html = `
  <div style="font-family:Arial,sans-serif;color:#1a1a1a;background:#fff;padding:0;">
    
    <!-- HEADER -->
    <div style="display:flex;justify-content:space-between;align-items:center;background:#fff;padding:24px 28px 16px;border-bottom:3px solid ${colorBase};">
      <div style="display:flex;align-items:center;gap:16px;">
        ${configNegocio.logo ? `<img src="${configNegocio.logo}" style="max-width:150px;max-height:120px;object-fit:contain;">` : ''}
        <div>
          <div style="font-size:20px;font-weight:900;color:#1a1a1a;">${configNegocio.razonSocial || 'MI EMPRESA'}</div>
          <div style="font-size:11px;color:#555;margin-top:2px;">${configNegocio.direccion || ''}</div>
          <div style="font-size:11px;color:#555;">${configNegocio.telefono ? '📞 ' + configNegocio.telefono : ''} ${configNegocio.email ? '✉️ ' + configNegocio.email : ''}</div>
          <div style="font-size:11px;color:#555;">${configNegocio.nit ? 'NIT: ' + configNegocio.nit : ''}</div>
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:32px;font-weight:900;color:#1a1a1a;letter-spacing:2px;">COTIZACIÓN</div>
        <div style="font-size:18px;font-weight:700;color:${colorBase};margin-top:4px;">${numCot}</div>
        <div style="font-size:11px;color:#555;margin-top:6px;">📅 Fecha: ${fechaFormateada}</div>
        <div style="font-size:11px;color:#555;">⏱ Validez: ${validez}</div>
      </div>
    </div>
    
    <!-- DATOS CLIENTE -->
    <div style="padding:16px 28px;">
      <div style="background:${colorClaro};border:1px solid ${colorBase}55;border-radius:10px;padding:14px 18px;">
        <div style="font-size:11px;font-weight:700;color:${colorBase};letter-spacing:1px;margin-bottom:8px;">DATOS DEL CLIENTE</div>
            <div style="display:flex;gap:40px;flex-wrap:wrap;">
              <div>
                <div style="font-size:13px;font-weight:700;">${cliente?.nombre || 'N/A'}</div>
                ${cliente?.empresa ? `<div style="font-size:12px;color:#444;">${cliente.empresa}</div>` : ''}
                ${cliente?.nit ? `<div style="font-size:11px;color:#666;">NIT: ${cliente.nit}</div>` : ''}
              </div>
              <div>
                ${cliente?.email ? `<div style="font-size:11px;color:#555;">✉️ ${cliente.email}</div>` : ''}
                ${cliente?.telefono ? `<div style="font-size:11px;color:#555;">📞 ${cliente.telefono}</div>` : ''}
                ${cliente?.direccion ? `<div style="font-size:11px;color:#555;">📍 ${cliente.direccion}</div>` : ''}
              </div>
            </div>
          </div>
        </div>
  
        <!-- TABLA PRODUCTOS -->
        <div style="padding:0 28px;">
          <table style="width:100%;border-collapse:collapse;font-size:11px;">
            <thead>
              <tr style="background:${colorBase};color:#fff;">
                <th style="padding:10px 8px;text-align:center;width:30px;">#</th>
                <th style="padding:10px 8px;text-align:left;">CONCEPTO</th>
                <th style="padding:10px 8px;text-align:left;">DESCRIPCIÓN</th>
                <th style="padding:10px 8px;text-align:center;width:40px;">CANT.</th>
                <th style="padding:10px 8px;text-align:right;">P. UNITARIO</th>
                <th style="padding:10px 8px;text-align:right;">SUBTOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${productos.map((p, i) => `
                <tr style="border-bottom:1px solid #e5e7eb;background:${i % 2 === 0 ? '#fff' : '#f9fafb'};">
                  <td style="padding:10px 8px;text-align:center;color:${colorBase};font-weight:700;">${i + 1}</td>
                  <td style="padding:10px 8px;font-weight:600;">${p.nombre}</td>
                  <td style="padding:10px 8px;color:#555;">${p.descripcion || ''}</td>
                  <td style="padding:10px 8px;text-align:center;">${p.cantidad}</td>
                  <td style="padding:10px 8px;text-align:right;">${money(p.precioUnitario)}</td>
                  <td style="padding:10px 8px;text-align:right;font-weight:600;">${money(p.precioUnitario * p.cantidad)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
  
        <!-- TOTALES -->
        <div style="padding:16px 28px;display:flex;justify-content:flex-end;">
          <div style="background:${colorClaro};border:1px solid ${colorBase}55;border-radius:10px;padding:16px 24px;min-width:220px;">
    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px;">
      <span style="color:#555;">Subtotal:</span>
      <span style="font-weight:600;">${money(subtotal)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid ${colorBase}55;">
      <span style="color:#555;">IVA:</span>
      <span style="font-weight:600;">${money(ivaTotal)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:900;">
      <span>TOTAL:</span>
      <span style="color:${colorOscuro};">${money(total)}</span>
    </div>
  </div>
        </div>
  
        <!-- NOTAS Y TÉRMINOS -->
        <div style="padding:0 28px 16px;">
          <div style="border-top:1px solid #e5e7eb;padding-top:12px;">
            ${notas ? `<div style="font-size:11px;color:#555;margin-bottom:8px;"><strong>Notas:</strong> ${notas}</div>` : ''}
            <div style="font-size:10px;color:#888;"><strong>Términos y condiciones:</strong> ${configNegocio.terminos || 'Pago contra entrega.'}</div>
          </div>
        </div>
  
        <!-- FOOTER -->
        <div style="background:${colorOscuro};color:#fff;padding:14px 28px;display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
          <div style="font-size:11px;">
            ${configNegocio.direccion ? `📍 ${configNegocio.direccion}` : ''}
          </div>
          <div style="font-size:11px;text-align:center;font-weight:700;">
            ${configNegocio.razonSocial || ''}
          </div>
          <div style="font-size:11px;text-align:right;">
            ${configNegocio.telefono ? `📞 ${configNegocio.telefono}` : ''}
            ${configNegocio.email ? `<br>✉️ ${configNegocio.email}` : ''}
          </div>
        </div>
  
      </div>
    `;
  
    $("pdfPreview").innerHTML = html;
    $("modalPDF").classList.add("open");
    $("modalCotizacion").classList.remove("open");
  }
async function descargarPDF() {
  const preview = document.getElementById("pdfPreview");
  if (!preview || !preview.innerHTML.trim()) {
    toast("❌ Sin contenido que descargar");
    return;
  }

  let nombreArchivo = "documento_" + fechaHoyColombia();
  const tituloEl = preview.querySelector("div[style*='font-size:32px'], div[style*='font-size:28px']");
  if (tituloEl) {
    const txt = tituloEl.innerText.toLowerCase().trim();
    if (txt.includes("cotización")) nombreArchivo = "Cotizacion_" + fechaHoyColombia();
    else if (txt.includes("factura")) nombreArchivo = "Factura_" + fechaHoyColombia();
    else if (txt.includes("recibo")) nombreArchivo = "Recibo_Orden_" + fechaHoyColombia();
  }

  toast("🖨️ Abriendo vista de impresión...");

  // Usamos impresión nativa del navegador (iframe oculto) en vez de
  // html2canvas/html2pdf, que generaba páginas en blanco en algunos
  // navegadores/WebView de Android.
  let iframe = document.getElementById("_pdfPrintFrame");
  if (iframe) iframe.remove();
  iframe = document.createElement("iframe");
  iframe.id = "_pdfPrintFrame";
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${nombreArchivo}</title>
<style>
  * { box-sizing: border-box; }
  body { margin:0; padding:0; background:#fff; font-family:Arial,sans-serif; }
  img { max-width:100%; }
  @page { size: A4; margin: 10mm; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>${preview.innerHTML}</body>
</html>`;

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  // Esperar a que todas las imágenes (logo, fotos del equipo, firmas) carguen
  const imgs = Array.from(doc.images || []);
  await Promise.all(imgs.map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
  }));

  await new Promise(r => setTimeout(r, 200));

  try {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    toast("✅ Elige 'Guardar como PDF' en el diálogo");
  } catch (e) {
    console.error("Error al imprimir:", e);
    toast("❌ No se pudo abrir la impresión. Usa 'Copiar texto / Compartir'.");
  }
}
async function compartirPDF() {
  // Ahora el PDF se descarga directamente con descargarPDF()
  // Esta función comparte el texto de la cotización
  await compartirTextoPDF();
}
async function compartirTextoPDF() {
  const texto = obtenerTextoCotizacion();
  if (navigator.share) {
    try {
      await navigator.share({ title: "Cotización TecnoYork", text: texto });
      toast("✅ Compartido");
      return;
    } catch (e) {
      // usuario canceló o falló
    }
  }
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(texto);
      toast("📋 Texto copiado al portapapeles");
      return;
    } catch (e) {}
  }
  toast("❌ No se pudo compartir en este dispositivo");
}
window.compartirTextoPDF = compartirTextoPDF;
function mostrarPDFComoImagen() {
  // Redirigir al nuevo flujo PDF
  descargarPDF();
  return;
  // Eliminar visor anterior si existe
  const anterior = document.getElementById("_visorPDF");
  if (anterior) anterior.remove();
      
        const preview = document.getElementById("pdfPreview");
        if (!preview || !preview.innerHTML.trim()) {
          toast("❌ Sin contenido para generar imagen");
          return;
        }
      
        // Crear overlay fullscreen
        const overlay = document.createElement("div");
        overlay.id = "_visorPDF";
        overlay.style.cssText = `
          position:fixed;inset:0;z-index:99999;
          background:#1a1a1a;display:flex;flex-direction:column;
        `;
      
        // Barra superior con botones
        overlay.innerHTML = `
          <div style="background:#f59e0b;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">
            <span style="font-weight:800;color:#000;font-size:14px;">📄 Cotización</span>
            <button onclick="document.getElementById('_visorPDF').remove()" 
              style="background:rgba(0,0,0,0.3);border:none;color:#fff;padding:6px 12px;border-radius:8px;font-size:13px;cursor:pointer;">
              ✕ Cerrar
            </button>
          </div>
          <div style="background:#f59e0b;padding:0 12px 12px;display:flex;gap:8px;flex-shrink:0;">
            <button id="_btnCompartir"
              style="flex:1;padding:10px;background:#000;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">
              📤 Compartir / Descargar
            </button>
            <button onclick="copiarTextoCot()"
              style="padding:10px;background:#1e293b;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">
              📋 Copiar Texto
            </button>
          </div>
          <div id="_scrollPDF" style="flex:1;overflow-y:auto;padding:12px;">
            <canvas id="_canvasPDF" style="width:100%;border-radius:8px;display:block;"></canvas>
            <div id="_fallbackPDF" style="display:none;background:#fff;border-radius:8px;padding:16px;color:#000;font-family:Arial,sans-serif;font-size:12px;"></div>
          </div>
        `;
      
        document.body.appendChild(overlay);
      
        // Renderizar con html2canvas
        if (typeof html2canvas !== "undefined") {
          renderizarConCanvas(preview);
        } else {
          const script = document.createElement("script");
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
          script.onload = () => renderizarConCanvas(preview);
          script.onerror = () => usarFallbackHTML(preview);
          document.head.appendChild(script);
        }
      
        document.getElementById("_btnCompartir").onclick = () => compartirPDF();
      }
function generarPDFDesdeLista(id) {
        const cot = cotizaciones.find(c => c.id === id);
        if (!cot) return;
        productosCotActual = [...cot.productos];
        cotEditandoId = id;
        datosPDFActual = {
          clienteId: cot.clienteId,
          productos: JSON.parse(JSON.stringify(cot.productos)),
          validez: cot.validez,
          notas: cot.notas
        };
        mostrarVistaPreviaPDF();
      }
function verFacturaPDF(facturaId) {
    const fact = facturas.find(f => f.id === facturaId);
    if (!fact) { toast("❌ Factura no encontrada"); return; }
    const fechaFormateada = new Date(fact.fecha + "T00:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
    const colorBase = configNegocio.colorDocumentos || "#22c55e";
    const colorOscuro = hexAOscuro(colorBase);
    const colorClaro = hexAClaro(colorBase);
    
    const firmaClienteHTML = fact.firmaCliente ?
      `<img src="${fact.firmaCliente}" style="max-width:160px;max-height:60px;border-bottom:1px solid #999;">` :
      `<div style="height:60px;border-bottom:1px solid #999;width:160px;"></div>`;
    const firmaEncargadoHTML = fact.firmaEncargado ?
      `<img src="${fact.firmaEncargado}" style="max-width:160px;max-height:60px;border-bottom:1px solid #999;">` :
      `<div style="height:60px;border-bottom:1px solid #999;width:160px;"></div>`;
    
    const html = `
      <div style="font-family:Arial,sans-serif;color:#1a1a1a;background:#fff;padding:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;background:#fff;padding:24px 28px 16px;border-bottom:3px solid ${colorBase};">
          <div style="display:flex;align-items:center;gap:16px;">
            ${configNegocio.logo ? `<img src="${configNegocio.logo}" style="max-width:150px;max-height:120px;object-fit:contain;">` : ''}
            <div>
              <div style="font-size:20px;font-weight:900;">${configNegocio.razonSocial || 'MI EMPRESA'}</div>
              <div style="font-size:11px;color:#555;margin-top:2px;">${configNegocio.direccion || ''}</div>
              <div style="font-size:11px;color:#555;">${configNegocio.telefono ? '📞 ' + configNegocio.telefono : ''} ${configNegocio.email ? '✉️ ' + configNegocio.email : ''}</div>
              <div style="font-size:11px;color:#555;">${configNegocio.nit ? 'NIT: ' + configNegocio.nit : ''}</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:32px;font-weight:900;letter-spacing:2px;">FACTURA</div>
            <div style="font-size:18px;font-weight:700;color:${colorBase};margin-top:4px;">${fact.numero}</div>
            <div style="font-size:11px;color:#555;margin-top:6px;">📅 ${fechaFormateada}</div>
            <div style="font-size:11px;font-weight:700;color:${fact.estado === 'pagada' ? '#16a34a' : '#d97706'};">${fact.estado === 'pagada' ? '✅ PAGADA' : '⏳ SE DEBE'}</div>
          </div>
        </div>
  
        <div style="padding:16px 28px;">
          <div style="background:${colorClaro};border:1px solid ${colorBase}55;border-radius:10px;padding:14px 18px;">
            <div style="font-size:11px;font-weight:700;color:${colorBase};letter-spacing:1px;margin-bottom:8px;">DATOS DEL CLIENTE</div>
            <div style="font-size:13px;font-weight:700;">${fact.clienteNombre || 'N/A'}</div>
            ${fact.clienteEmpresa ? `<div style="font-size:12px;color:#444;">${fact.clienteEmpresa}</div>` : ''}
            ${fact.clienteNIT ? `<div style="font-size:11px;color:#666;">NIT: ${fact.clienteNIT}</div>` : ''}
          </div>
        </div>
  
        <div style="padding:0 28px;">
          <table style="width:100%;border-collapse:collapse;font-size:11px;">
            <thead>
              <tr style="background:${colorBase};color:#fff;">
                <th style="padding:10px 8px;text-align:center;width:30px;">#</th>
                <th style="padding:10px 8px;text-align:left;">CONCEPTO</th>
                <th style="padding:10px 8px;text-align:left;">DESCRIPCIÓN</th>
                <th style="padding:10px 8px;text-align:center;width:40px;">CANT.</th>
                <th style="padding:10px 8px;text-align:right;">P. UNITARIO</th>
                <th style="padding:10px 8px;text-align:right;">SUBTOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${fact.productos.map((p, i) => `
                <tr style="border-bottom:1px solid #e5e7eb;background:${i % 2 === 0 ? '#fff' : '#f9fafb'};">
                  <td style="padding:10px 8px;text-align:center;color:${colorBase};font-weight:700;">${i + 1}</td>
                  <td style="padding:10px 8px;font-weight:600;">${p.nombre}</td>
                  <td style="padding:10px 8px;color:#555;">${p.descripcion || ''}</td>
                  <td style="padding:10px 8px;text-align:center;">${p.cantidad}</td>
                  <td style="padding:10px 8px;text-align:right;">${money(p.precioUnitario)}</td>
                  <td style="padding:10px 8px;text-align:right;font-weight:600;">${money(p.precioUnitario * p.cantidad)}</td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>
  
        <div style="padding:16px 28px;display:flex;justify-content:flex-end;">
          <div style="background:${colorClaro};border:1px solid ${colorBase}55;border-radius:10px;padding:16px 24px;min-width:220px;">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px;"><span>Subtotal:</span><span style="font-weight:600;">${money(fact.subtotal)}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid ${colorBase}55;"><span>IVA:</span><span style="font-weight:600;">${money(fact.iva)}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:900;"><span>TOTAL:</span><span style="color:${colorOscuro};">${money(fact.total)}</span></div>
          </div>
        </div>
  
        <div style="padding:24px 28px;display:flex;justify-content:space-between;gap:20px;">
          <div style="text-align:center;">
            ${firmaClienteHTML}
            <div style="font-size:11px;font-weight:700;margin-top:4px;">${fact.clienteNombre || 'Cliente'}</div>
            <div style="font-size:9px;color:#888;">Firma del cliente</div>
          </div>
          <div style="text-align:center;">
            ${firmaEncargadoHTML}
            <div style="font-size:11px;font-weight:700;margin-top:4px;">${configNegocio.encargadoNombre || 'Encargado'}</div>
            <div style="font-size:9px;color:#888;">Firma autorizada — ${configNegocio.razonSocial || ''}</div>
          </div>
        </div>
  
        <div style="background:${colorOscuro};color:#fff;padding:14px 28px;display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
          <div style="font-size:11px;">${configNegocio.direccion ? '📍 ' + configNegocio.direccion : ''}</div>
          <div style="font-size:11px;text-align:center;font-weight:700;">${configNegocio.razonSocial || ''}</div>
          <div style="font-size:11px;text-align:right;">${configNegocio.telefono ? '📞 ' + configNegocio.telefono : ''}</div>
        </div>
      </div>
    `;
    $("pdfPreview").innerHTML = html;
    $("modalPDF").classList.add("open");
  }
function exportarMes(index){const mes=historial[index];if(!mes)return;const dataExport=mes.movimientos.map(x=>[x.Fecha||"",x.Tipo||"",x.Categoría||"",x.Descripción||"",x.Monto||0,x.Cuenta||""]);const csv="Fecha,Tipo,Categoría,Descripción,Monto,Cuenta\n"+dataExport.map(r=>r.join(",")).join("\n");const blob=new Blob(["\uFEFF"+csv],{type:"text/csv"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`mes_${mes.label.replace(/\s/g,"_")}.csv`;a.click();toast(`📥 Exportado: ${mes.label}`);}
function exportarCSV(){const f=data.map(x=>[x.Fecha||"",x.Tipo||"",x.Categoría||"",(x.Descripción||"").replace(/,/g,";"),x.Monto||0,x.Cuenta||x.CuentaOrigen||"",x.Nota||""]);const csv="Fecha,Tipo,Categoría,Descripción,Monto,Cuenta,Nota\n"+f.map(r=>r.join(",")).join("\n");const b=new Blob(["\uFEFF"+csv]),url=URL.createObjectURL(b),a=document.createElement("a");a.href=url;a.download="movimientos_"+fechaHoyColombia().slice(0,7)+".csv";a.click();toast("📥 CSV exportado")}
window.exportarCSV=exportarCSV;
function imprimirPDF() {
        const contenido = document.getElementById("pdfPreview")?.innerHTML;
        if (!contenido || contenido.trim() === "") {
          toast("❌ Sin contenido para imprimir");
          return;
        }
        const ventana = window.open('', '_blank');
        if (!ventana) {
          toast("❌ Pop-up bloqueado. Permite ventanas emergentes.");
          return;
        }
        ventana.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Cotización</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background: #f59e0b; color: white; }
              .text-center { text-align: center; }
              .text-right { text-align: right; }
              @media print {
                button, .no-print { display: none; }
                body { padding: 0; }
              }
            </style>
          </head>
          <body>
            ${contenido}
            <div class="no-print" style="text-align: center; margin-top: 20px;">
              <button onclick="window.print()" style="padding: 8px 16px; background: #f59e0b; border: none; border-radius: 8px; cursor: pointer;">🖨️ Imprimir / Guardar PDF</button>
            </div>
          </body>
          </html>
        `);
        ventana.document.close();
        ventana.focus();
        setTimeout(() => ventana.print(), 500);
      }
function descargarManualPDF() {
  try {
    const a = document.createElement("a");
    a.href = "assets/docs/MANUAL_TECNOYORK_GESTION_2.0.pdf";
    a.download = "MANUAL_TECNOYORK_GESTION_2.0.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast("📥 Descargando manual...");
  } catch(e) {
    toast("❌ Error al descargar el manual");
    console.error(e);
  }
}
window.descargarManualPDF = descargarManualPDF;