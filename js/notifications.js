// js/notifications.js — OneSignal push + notificaciones internas de la app

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  OneSignalDeferred.push(async function(OneSignal) {
    await OneSignal.init({
      appId: "d983fb39-f003-48e5-82f9-2cc0aeaf4f04",
      serviceWorkerParam: { scope: "/TECNOYORK-FINANZAS-/" },
      serviceWorkerPath: "sw.js"
    });
  });
  
  window.suscribirOneSignal = function(user) {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function(OneSignal) {
      try {
        await OneSignal.login(user.uid);
        if (user.email) {
          OneSignal.User.addEmail(user.email);
        }
        const permiso = await OneSignal.Notifications.permission;
        if (!permiso) {
          await OneSignal.Notifications.requestPermission();
        }
      } catch (e) {
        console.error('Error suscribiendo a OneSignal:', e);
      }
    });
  };

function onUserChanged(user){
        if (user) {
  localStorage.setItem("uid", user.uid);
  window.currentUser = user;
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async function(OneSignal) {
    try {
      await OneSignal.login(user.uid);
      await OneSignal.Notifications.requestPermission();
    } catch (e) { console.error("OneSignal:", e); }
  });
          const loginScr=$("loginScreen");
          const appCont=$("appContent");
          const overlay=$("successOverlay");
          const dn=user.displayName||(user.email||"").split("@")[0];
          const btn=$("loginBtn");
          if(btn){btn.classList.remove("loading");btn.classList.add("pulsing");setTimeout(()=>btn.classList.remove("pulsing"),1000);}
          if(overlay){
            const sn=$("successName"),ss=$("successSub");
            if(sn)sn.textContent="¡Bienvenido, "+dn.split(" ")[0]+"!";
            if(ss)ss.textContent="Cargando tu cuenta...";
            overlay.classList.add("visible");
            lanzarParticulas();
            setTimeout(lanzarParticulas,350);
          }
          if(loginScr){loginScr.classList.add("saliendo");setTimeout(()=>loginScr.classList.add("oculto"),600);}
          setTimeout(()=>{
            if(appCont)appCont.classList.add("visible");
            if(overlay)overlay.classList.remove("visible");
            actualizarUI(user);
          },1800);
          cargarPerfilUsuario().then(()=>{
            // Si no es admin, forzar contexto negocio ANTES de cargar
            if(!puedeVerModoPersonal()){
              contexto="negocio";
              localStorage.setItem("contexto","negocio");
            }
            cargarTodo().then(()=>{sincronizarPendientes();activarSincronizacionRealTime();aplicarRestriccionesRol();});
          });
          actualizarStatusBar();
        }else{
          if(unsubscribeRealTime){unsubscribeRealTime();unsubscribeRealTime=null;}
          const loginScr=$("loginScreen");
          const appCont=$("appContent");
          const overlay=$("successOverlay");
          if(loginScr){loginScr.classList.remove("oculto","saliendo");}
          if(appCont)appCont.classList.remove("visible");
          if(overlay)overlay.classList.remove("visible");
        }
        $("loginBtn").disabled=false;
        $("registerBtn").disabled=false;
        $("loginBtn").textContent="Entrar →";
        $("loginBtn").classList.remove("loading");
        $("registerBtn").textContent="Crear cuenta →";
      }
function getNotificaciones(){return JSON.parse(localStorage.getItem(notifKey())||"[]")}
function guardarNotificaciones(n){
    localStorage.setItem(notifKey(), JSON.stringify(n));
    if(window.db && window.auth?.currentUser && navigator.onLine){
      window.fbSetDoc(window.fbDoc(window.db,"usuarios_notificaciones",window.auth.currentUser.uid),{notificaciones:n},{merge:true}).catch(e=>console.error(e));
    }
  }
async function cargarNotificaciones(){
    if(window.db && window.auth?.currentUser){
      try{
        const snap=await window.fbGetDoc(window.fbDoc(window.db,"usuarios_notificaciones",window.auth.currentUser.uid));
        if(snap.exists() && snap.data().notificaciones) localStorage.setItem(notifKey(), JSON.stringify(snap.data().notificaciones));
      }catch(e){console.error(e)}
    }
    generarNotificacionesSiCorresponde();
    actualizarBadgeNotif();
  }
async function enviarPushNotificacion(titulo, mensaje) {
  try {
    await fetch("https://api.onesignal.com/notifications?c=push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": "Key os_v2_app_3gb7wopqaneolaxzftak5l2paqq4tvac7kie4sfxxksvkm2zoogzswxmxsxyxy2ebhivfej6veew36odum5f43i2xpviv43i2dwm4sq"
      },
      body: JSON.stringify({
        app_id: "d983fb39-f003-48e5-82f9-2cc0aeaf4f04",
        target_channel: "push",
        included_segments: ["Subscribed Users"],
        headings: { en: titulo },
        contents: { en: mensaje }
      })
    });
  } catch (e) { console.error("Error enviando push:", e); }
}
function agregarNotificacion(tipo, titulo, mensaje, refId, ctx) {
  let n = getNotificaciones();
  if (refId && n.some(x => x.refId === refId)) return;
  n.unshift({ id: "notif_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6), tipo, titulo, mensaje, fecha: new Date().toISOString(), leida: false, contexto: ctx, refId: refId || null });
  if (n.length > 100) n = n.slice(0, 100);
  guardarNotificaciones(n);
  actualizarBadgeNotif();
  enviarPushNotificacion(titulo, mensaje);
}
function generarNotificaciones(){
    (facturas||[]).forEach(f=>{
      if(f.estado==="pendiente"){
        const dias=Math.floor((new Date()-new Date(f.fecha))/86400000);
        if(dias>=7){
          agregarNotificacion("pago_atrasado","💸 Factura sin pagar",`${f.numero} de ${f.clienteNombre} lleva ${dias} días pendiente (${money(f.total)})`,"fact_"+f.id,"negocio");
        } else if(dias>=3){
          const bloque=Math.floor(dias/3);
          agregarNotificacion("recordatorio_cobro","⏰ Recordatorio de cobro",`${f.numero} de ${f.clienteNombre} (${money(f.total)}) lleva ${dias} días sin pagar`,"recordcobro_"+f.id+"_b"+bloque,"negocio");
        }
      }
    });
    (typeof verificarCotizacionesVencidas==="function"?verificarCotizacionesVencidas():[]).forEach(c=>{
      agregarNotificacion("cotizacion_vencida","📄 Cotización vencida",`${c.numero} sin respuesta de ${c.clienteNombre}`,"cotv_"+c.id,"negocio");
    });
    (prestamos||[]).forEach(p=>{
      const venc=new Date(p.vencimiento+"T00:00:00");
      const diasParaVencer=Math.floor((venc-hoyColombia())/86400000);
      if(p.estado!=="pagado" && venc<hoyColombia()){
        agregarNotificacion("prestamo_atrasado", p.tipo==="recibido"?"⚠️ Debes un pago":"⚠️ Te deben un pago",`${p.persona}: ${money(p.monto)} venció el ${venc.toLocaleDateString("es-CO")}`,"prest_"+p.id,contexto);
      } else if(p.estado!=="pagado" && diasParaVencer>=0 && diasParaVencer<=3){
        agregarNotificacion("prestamo_porvencer", p.tipo==="recibido"?"📅 Pago próximo a vencer":"📅 Te deben pronto",`${p.persona}: ${money(p.monto)} vence ${diasParaVencer===0?"hoy":"en "+diasParaVencer+" día"+(diasParaVencer>1?"s":"")}`,"prestvenc_"+p.id,contexto);
      }
    });
    (ordenes||[]).forEach(o=>{
      if(o.estado==="listo"){
        const dias=Math.floor((new Date()-new Date(o.actualizadoEn||o.createdAt))/86400000);
        if(dias>=2){
          const bloque=Math.floor(dias/3);
          agregarNotificacion("orden_sin_entregar","📦 Equipo listo sin entregar",`${o.numero} de ${o.clienteNombre} lleva ${dias} días esperando ser recogido`,"ordenlista_"+o.id+"_b"+bloque,"negocio");
        }
      }
    });
  }
function eliminarNotificacion(id){let n=getNotificaciones().filter(x=>x.id!==id);guardarNotificaciones(n);actualizarBadgeNotif();renderNotifPanel();}