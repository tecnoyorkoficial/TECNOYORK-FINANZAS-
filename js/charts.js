// js/charts.js — Chart.js: gráficos del coach financiero y dashboard

function renderCharts(){const saldos=calcSaldos();let ing=0,gas=0,cats={};data.forEach(x=>{const m=Number(x.Monto)||0;if(x.Tipo==="Ingreso")ing+=m;else if(x.Tipo==="Gasto"){gas+=m;cats[x.Categoría]=(cats[x.Categoría]||0)+m}});[c1,c2,c3,c4,c5,c6].forEach(c=>{if(c)c.destroy()});const ctx6=$("chart6");if(ctx6&&cuentas.length)c6=new Chart(ctx6,{type:"bar",data:{labels:cuentas.map(c=>c.icon+" "+c.nombre),datasets:[{data:cuentas.map(c=>saldos[c.id]||0),backgroundColor:cuentas.map((_,i)=>ACC_COLORS[i%ACC_COLORS.length])}]},options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:false}}}});const ctx1=$("chart1");if(ctx1&&Object.keys(cats).length)c1=new Chart(ctx1,{type:"doughnut",data:{labels:Object.keys(cats),datasets:[{data:Object.values(cats)}]}});const ctx2=$("chart2");if(ctx2)c2=new Chart(ctx2,{type:"bar",data:{labels:["Ingresos","Gastos"],datasets:[{data:[ing,gas],backgroundColor:["#22c55e","#ef4444"]}]}});const dias={};let s=0;[...data].sort((a,b)=>new Date(a.Fecha)-new Date(b.Fecha)).forEach(x=>{const m=Number(x.Monto)||0;if(x.Tipo==="Ingreso")s+=m;else if(x.Tipo==="Gasto")s-=m;dias[x.Fecha]=s});const ctx3=$("chart3");if(ctx3&&Object.keys(dias).length)c3=new Chart(ctx3,{type:"line",data:{labels:Object.keys(dias),datasets:[{data:Object.values(dias),fill:false,tension:0.3,borderColor:"#3b82f6",pointRadius:2}]}});const w=[0,0,0,0,0,0,0];data.forEach(x=>{if(x.Tipo==="Gasto")w[new Date(x.Fecha+"T00:00:00").getDay()]+=Number(x.Monto)||0});const ctx4=$("chart4");if(ctx4)c4=new Chart(ctx4,{type:"bar",data:{labels:["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"],datasets:[{data:w,backgroundColor:"#f59e0b"}]}});const fm={};data.forEach(x=>{if(x.Tipo==="Gasto")fm[x.Descripción]=(fm[x.Descripción]||0)+(Number(x.Monto)||0)});const tf=Object.entries(fm).sort((a,b)=>b[1]-a[1]).slice(0,5);const ctx5=$("chart5");if(ctx5&&tf.length)c5=new Chart(ctx5,{type:"bar",data:{labels:tf.map(x=>x[0].length>20?x[0].slice(0,18)+"…":x[0]),datasets:[{data:tf.map(x=>x[1]),backgroundColor:"#ef4444"}]},options:{indexAxis:"y"}});renderComparativa();}
function renderInversiones(){const totalInv=inversiones.reduce((a,i)=>a+(i.monto||0),0),rentEst=inversiones.reduce((a,i)=>a+((i.monto||0)*(i.rentabilidad||0)/100),0);$("inversionesResumen").innerHTML=`<div class="grid2" style="margin-bottom:10px"><div class="kpi"><span>Total invertido</span><strong style="color:#06b6d4">$${totalInv.toLocaleString("es-CO")}</strong></div><div class="kpi"><span>Rent. estimada</span><strong style="color:${rentEst>=0?'var(--ok)':'var(--bad)'}">$${rentEst.toLocaleString("es-CO")}</strong></div></div>${inversiones.map(i=>`<div class="inversion-card"><div style="display:flex;justify-content:space-between"><div><div style="font-weight:700;font-size:13px">${i.tipo==="CDT"?"🏦":i.tipo==="Acciones"?"📊":i.tipo==="Cripto"?"₿":"🏠"} ${i.nombre}</div><div class="small">$${(i.monto||0).toLocaleString("es-CO")} · ${i.rentabilidad>=0?'+':''}${i.rentabilidad}%</div></div><button class="small-btn" onclick="eliminarInversion('${i.id}')">🗑️</button></div></div>`).join("")||'<div class="alert mid">Sin inversiones</div>'}`;if(cInv)cInv.destroy();const ctx=$("chartInv");if(ctx&&inversiones.length)cInv=new Chart(ctx,{type:"doughnut",data:{labels:inversiones.map(i=>i.nombre),datasets:[{data:inversiones.map(i=>i.monto),backgroundColor:["#06b6d4","#8b5cf6","#f59e0b","#22c55e","#ef4444"]}]}})}
function grafVentasMes() {
        const grafVentas = document.getElementById("grafVentasMes");
        if (!grafVentas) return;
        const mesesData = [...historial].slice(0, 6).reverse();
        const ingActual = data.filter(d => d.Tipo === "Ingreso").reduce((s, d) => s + (d.Monto || 0), 0);
        const labels = [...mesesData.map(m => m.label.split(" ")[0]), "Este mes"];
        const valores = [...mesesData.map(m => m.ing), ingActual];
        if (window._chartVentas) window._chartVentas.destroy();
        window._chartVentas = new Chart(grafVentas, {
          type: "line",
          data: {
            labels: labels,
            datasets: [{
              label: "Ingresos",
              data: valores,
              borderColor: "#22c55e",
              backgroundColor: "rgba(34,197,94,.1)",
              fill: true,
              tension: 0.4,
              pointRadius: 4
            }]
          },
          options: { plugins: { legend: { display: false } } }
        });
      }