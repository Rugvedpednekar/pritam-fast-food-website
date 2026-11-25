/* Owner security and full reset. Browser-local payroll is intentionally purged per device. */
(function(){
 "use strict";
 const TP_KEY="tablewise-payroll-demo-v3",GEN_KEY="tablewise-owner-reset-generation-v1";
 let security={pinConfigured:false,resetGeneration:0,deletedRestaurants:[]},reading=false;
 function emptyPayroll(){return{version:3,employees:[],periods:{},salaryChanges:[],settings:{leaveEarnEveryDays:7},createdAt:new Date().toISOString()};}
 function clearLocalPayroll(){
  try{localStorage.setItem(TP_KEY,JSON.stringify(emptyPayroll()));return true;}catch(err){console.error("Payroll reset:",err);return false;}
 }
 function payrollIds(id,name){
  try{const p=JSON.parse(localStorage.getItem(TP_KEY)||"null");
   if(!p||!Array.isArray(p.employees))return[];
   return p.employees.filter(function(emp){return emp.restaurantId?emp.restaurantId===id:String(emp.restaurant||"").toLowerCase()===String(name||"").toLowerCase();}).map(emp=>emp.id).filter(x=>/^[a-zA-Z0-9_-]{1,90}$/.test(x));
  }catch(e){return[];}
 }
 window.twLocalRestaurantPayrollIds=payrollIds;
 function purgeLocalRestaurant(entry){
  const id=entry.restaurantId||entry.id,name=entry.name;
  if(!id)return false;
  try{
   const old=localStorage.getItem(TP_KEY);if(!old)return false;
   const p=JSON.parse(old);if(!p||!Array.isArray(p.employees))return false;
   const ids=new Set(payrollIds(id,name));if(!ids.size)return false;
   p.employees=p.employees.filter(emp=>!ids.has(emp.id));
   if(Array.isArray(p.salaryChanges))p.salaryChanges=p.salaryChanges.filter(c=>!ids.has(c.employeeId)&&c.restaurantId!==id);
   Object.values(p.periods||{}).forEach(period=>{
    if(!period||typeof period!=="object")return;
    Object.keys(period).forEach(field=>{
     const v=period[field];
     if(Array.isArray(v))period[field]=v.filter(item=>!ids.has(item?.employeeId)&&item?.restaurantId!==id);
     else if(v&&typeof v==="object")ids.forEach(empId=>delete v[empId]);
    });
   });
   p.employees.forEach(emp=>{
    if(emp.pendingTransfer?.toRestaurantId===id)delete emp.pendingTransfer;
    for(const field of ["transferHistory","employmentHistory","periodHistory"]){
     if(Array.isArray(emp[field]))emp[field]=emp[field].filter(item=>item&&item.restaurantId!==id&&item.fromRestaurantId!==id&&item.toRestaurantId!==id);
    }
   });
   localStorage.setItem(TP_KEY,JSON.stringify(p));return true;
  }catch(err){console.warn("Payroll restaurant deletion:",err);return false;}
 }
 window.twPurgeDeletedRestaurant=purgeLocalRestaurant;
 function closeModal(){document.getElementById("tw-owner-overlay")?.remove();}
 function modal(content){
  closeModal();
  const layer=document.createElement("div");layer.id="tw-owner-overlay";layer.className="tw-owner-overlay";
  layer.innerHTML='<div class="tw-owner-modal" role="dialog" aria-modal="true" aria-labelledby="tw-owner-title"><button class="tw-owner-close" data-tw-owner-close="1" aria-label="Close dialog">×</button>'+content+'</div>';
  document.body.appendChild(layer);
  layer.querySelector("input")?.focus();
 }
 function setupPin(){
  modal('<h2 id="tw-owner-title">'+(security.pinConfigured?"Change Owner PIN":"Set Owner PIN")+'</h2><p>Use 6–8 digits. Only the owner can set or change this PIN using the login password.</p>'+
   '<form id="tw-pin-form"><label>Owner login password<input id="tw-owner-password" type="password" required autocomplete="current-password"></label>'+
   '<label>New owner PIN<input id="tw-owner-pin" type="password" inputmode="numeric" pattern="[0-9]{6,8}" minlength="6" maxlength="8" autocomplete="new-password" required></label>'+
   '<label>Confirm PIN<input id="tw-owner-confirm-pin" type="password" inputmode="numeric" pattern="[0-9]{6,8}" minlength="6" maxlength="8" autocomplete="new-password" required></label>'+
   '<div class="tw-owner-actions"><button type="submit" class="btn primary">Save Owner PIN</button><button type="button" class="btn" data-tw-owner-close="1">Cancel</button></div><p class="tw-owner-feedback" id="tw-owner-feedback" role="alert"></p></form>');
 }
 function reset(){
  if(!security.pinConfigured)return uxAlert("Set an owner PIN in Settings first.");
  if(!cloudReady||cloudBusy||cloudPending||cloudConflict)return uxAlert("Finish cloud synchronization before resetting.");
  modal('<h2 id="tw-owner-title">Reset Everything</h2>'+
   '<p><strong>This permanently erases all restaurant records, menus, bills, tables, settings, orders, reports and employee photos from the shared database.</strong> It also clears payroll, attendance, advances and salary history from each signed-in browser as it reconnects.</p>'+
   '<p>Your login credentials and owner PIN will be retained. Export backups first if needed. The reset cannot be undone.</p>'+
   '<form id="tw-reset-form"><label>Type RESET EVERYTHING<input id="tw-reset-confirm" spellcheck="false" autocomplete="off" required></label>'+
   '<label>Owner PIN<input id="tw-reset-pin" type="password" inputmode="numeric" minlength="6" maxlength="8" required autocomplete="off"></label>'+
   '<div class="tw-owner-actions"><button class="btn danger" type="submit">Permanently Reset Everything</button><button type="button" class="btn" data-tw-owner-close="1">Cancel</button></div><p class="tw-owner-feedback" id="tw-owner-feedback" role="alert"></p></form>');
 }
 // Never repopulate a freshly reset restaurant with sample/demo records on reload.
 if(typeof seedPritamData==="function"){
  const originalSeedPritamData=seedPritamData;
  seedPritamData=function(){if(data&&data.factoryReset)return false;return originalSeedPritamData.apply(this,arguments);};
 }
 const previousSettings=settings;
 settings=function(){
  let output=previousSettings.apply(this,arguments);
  output=output.replace(/<button class="btn danger" data-action="reset">Reset Demo<\/button>/g,"");
  return output+'<section class="panel tw-owner-panel" style="margin-top:18px"><h2 class="panel-title">Owner Security</h2>'+
   '<p class="panel-sub">Owner PIN: <strong>'+(security.pinConfigured?"Configured":"Not configured")+'</strong>. Use the owner login password to set or change it.</p>'+
   '<button class="btn" data-tw-owner-action="pin" type="button">'+(security.pinConfigured?"Change Owner PIN":"Set Owner PIN")+'</button></section>'+
   '<section class="panel tw-owner-danger" style="margin-top:18px"><h2 class="panel-title">Danger Zone</h2>'+
   '<p class="panel-sub">Erase all data and start fresh. A server-verified owner PIN and explicit confirmation are required.</p>'+
   '<button class="btn danger" data-tw-owner-action="reset" type="button" '+(security.pinConfigured?"":'disabled title="Set the owner PIN first"')+'>Reset Everything</button></section>';
 };
 async function loadSecurity(refresh){
  if(!cloudReady||reading)return;
  reading=true;
  try{
   const r=await cloudReq("/api/owner/status");if(!r.ok)return;
   const s=r.body||{},priorPin=security.pinConfigured;
   security={pinConfigured:!!s.pinConfigured,resetGeneration:Number(s.resetGeneration)||0,deletedRestaurants:s.deletedRestaurants||[]};
   let modified=false,localGen=null;
   try{localGen=localStorage.getItem(GEN_KEY);}catch(err){}
   if(security.resetGeneration>0&&localGen!==String(security.resetGeneration)){
    modified=clearLocalPayroll();
    try{localStorage.setItem(GEN_KEY,String(security.resetGeneration));}catch(err){}
   }
   security.deletedRestaurants.forEach(entry=>{if(purgeLocalRestaurant(entry))modified=true;});
   if(modified){location.reload();return;}
   if(refresh&&tab==="settings"&&priorPin!==security.pinConfigured)draw();
  }catch(err){console.warn("Owner status sync:",err);}
  finally{reading=false;}
 }
 const oldCloudLoad=cloudLoad;
 cloudLoad=async function(){
  const value=await oldCloudLoad.apply(this,arguments);
  await loadSecurity(false);
  if(tab==="settings")draw();
  return value;
 };
 document.addEventListener("click",function(ev){
  if(ev.target.closest('[data-tw-owner-close]')){ev.preventDefault();ev.stopImmediatePropagation();closeModal();return;}
  const legacy=ev.target.closest('button[data-action="reset"]');
  if(legacy){ev.preventDefault();ev.stopImmediatePropagation();reset();return;}
  const b=ev.target.closest('button[data-tw-owner-action]');
  if(!b)return;
  ev.preventDefault();ev.stopImmediatePropagation();
  if(tab!=="settings")return;
  if(b.dataset.twOwnerAction==="pin")setupPin();
  else reset();
 },true);
 document.addEventListener("submit",async function(ev){
  const form=ev.target;
  if(form.id!=="tw-pin-form"&&form.id!=="tw-reset-form")return;
  ev.preventDefault();ev.stopImmediatePropagation();
  const button=form.querySelector('button[type="submit"]'),feedback=form.querySelector("#tw-owner-feedback");
  button.disabled=true;
  try{
   let path,body;
   if(form.id==="tw-pin-form"){
    path="/api/owner/pin";
    body={ownerPassword:document.getElementById("tw-owner-password").value,pin:document.getElementById("tw-owner-pin").value,confirmPin:document.getElementById("tw-owner-confirm-pin").value};
   }else{
    if(!cloudReady||cloudBusy||cloudPending||cloudConflict)throw Error("Cloud synchronization is not ready.");
    path="/api/owner/reset";
    body={pin:document.getElementById("tw-reset-pin").value,confirmation:document.getElementById("tw-reset-confirm").value};
    if(body.confirmation!=="RESET EVERYTHING")throw Error("Type RESET EVERYTHING exactly.");
   }
   const response=await cloudReq(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
   if(!response.ok)throw Error(response.body.error||"Owner action failed.");
   if(path==="/api/owner/pin"){security.pinConfigured=true;closeModal();draw();showToast("Owner PIN saved.");return;}
   clearLocalPayroll();
   try{
    localStorage.setItem(GEN_KEY,String(response.body.resetGeneration));
    if(response.body.state)localStorage.setItem(KEY,JSON.stringify(response.body.state));
   }catch(err){}
   cloudReady=false;closeModal();location.reload();
  }catch(err){feedback.textContent=err.message||String(err);}
  finally{button.disabled=false;}
 },true);
 document.addEventListener("keydown",ev=>{if(ev.key==="Escape"&&document.getElementById("tw-owner-overlay"))closeModal();},true);
 window.addEventListener("focus",()=>loadSecurity(false));
 setInterval(()=>loadSecurity(false),30000);
 const style=document.createElement("style");
 style.textContent=`.tw-owner-overlay{position:fixed;inset:0;z-index:999999;background:#071d21cc;display:flex;align-items:center;justify-content:center;padding:15px;overflow:auto}.tw-owner-modal{position:relative;max-width:520px;width:100%;max-height:95dvh;overflow:auto;background:var(--surface,#fff);border:1px solid var(--border,#d6e0dc);border-radius:14px;box-shadow:0 18px 75px #0005;padding:28px;color:var(--ink,#19352e)}.tw-owner-modal h2{font-size:21px;margin:0 35px 8px 0}.tw-owner-modal p{font-size:13px;line-height:1.6}.tw-owner-modal form{display:grid;gap:13px}.tw-owner-modal label{display:grid;gap:5px;font-size:13px;font-weight:700}.tw-owner-modal input{width:100%;padding:11px 12px;border:1px solid var(--border,#c8d7d2);border-radius:9px;font-size:16px;background:var(--input-bg,#fff);color:var(--ink,#19352e)}.tw-owner-close{position:absolute;right:18px;top:14px;border:0;background:var(--surface-alt,#ecf1f0);color:var(--ink,#19352e);border-radius:7px;font-size:23px;width:36px;height:36px;cursor:pointer}.tw-owner-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:5px}.tw-owner-feedback{color:#ff8589;font-weight:700;margin:0}.tw-owner-danger{border:1px solid #90565b}.tw-owner-danger .panel-title{color:#f0a5aa}.tw-owner-danger button:disabled{opacity:.5}.tw-owner-overlay .btn{min-height:42px}@media(max-width:530px){.tw-owner-modal{padding:20px}.tw-owner-actions .btn{flex:1 1 100%}}`;
 document.head.appendChild(style);
})();
