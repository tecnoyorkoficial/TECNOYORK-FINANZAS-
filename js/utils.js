// js/utils.js — funciones puras: formato de dinero, fechas, roles

function hoyColombia(){const a=new Date();return new Date(a.getFullYear(),a.getMonth(),a.getDate())}
function fechaHoyColombia(){const a=new Date();return a.getFullYear()+"-"+String(a.getMonth()+1).padStart(2,"0")+"-"+String(a.getDate()).padStart(2,"0")}
function fechaParaInput(){const a=new Date();return a.getFullYear()+"-"+String(a.getMonth()+1).padStart(2,"0")+"-"+String(a.getDate()).padStart(2,"0")}
function esAdmin(){return miRol==="admin"}
function esContabilidad(){return miRol==="contabilidad"||miRol==="admin"}
function esTecnico(){return miRol==="tecnico"}
function esGerente(){return miRol==="gerente"}
function puedeVerDinero(){return miRol==="admin"||miRol==="contabilidad"||miRol==="gerente"}
function puedeVerModoPersonal(){return miRol==="admin"}
function money(n){if(hidden)return"••••••";return"$"+Number(n).toLocaleString("es-CO")}
function parseMonto(s){return Number(String(s).replace(/\./g,"").replace(",","."))||0}