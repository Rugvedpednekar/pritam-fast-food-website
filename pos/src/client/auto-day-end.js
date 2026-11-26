
/* TABLEWISE_AUTO_BUSINESS_DAY_V1 — configured per restaurant; always uses IST. */
(function(){
 "use strict";
 var twOffset=330*60000;
 function validTime(t){return typeof t==="string"&&/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(t);}
 function lastCutoff(now,time){
   var d=new Date(now.getTime()+twOffset),t=time.split(":").map(Number);
   var cut=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate(),t[0],t[1])-twOffset;
   return cut>now.getTime()?cut-86400000:cut;
 }
 function shiftDate(now,time){
   return new Date(lastCutoff(now,time)+twOffset).toISOString().slice(0,10);
 }
 var baseSettings=settings;
 settings=function(){
   var current=baseSettings.apply(this,arguments);
   var cfg=branchCfg();
   var enabled=cfg.autoDayEndEnabled===true;
   var time=validTime(cfg.autoDayEndTime)?cfg.autoDayEndTime:"03:00";
   var opening=data.openDays&&data.openDays[selected];
   var status=opening?"Open business day: "+opening.date:"No day currently open; the next completed bill will open one";
   return current+'<section class="panel tw-auto-day-panel" style="margin-top:18px">'+
     '<h2 class="panel-title">Automatic Day End</h2>'+
     '<p class="panel-sub">Automatically close the active business day at the selected time in India (IST). Pending dine-in and parcel orders stay open; the next business day opens on the first completed bill after the cutoff.</p>'+
     '<div class="detail-grid"><div class="field"><label for="tw-day-end-time">Daily cutoff time (IST)</label><input class="input" type="time" id="tw-day-end-time" value="'+e(time)+'" required></div>'+
     '<div class="field" style="display:flex;align-items:center"><label class="checkline"><input type="checkbox" id="tw-day-end-enabled" '+(enabled?'checked':'')+'> Enable automatic day-end</label></div></div>'+
     '<div class="gap"></div><button type="button" class="btn primary" id="tw-save-day-end-time">Save Day End Settings</button>'+
     '<p class="sub" style="margin-top:10px">'+e(status)+'</p>'+
     '<p class="sub">Historical bills remain saved and locked after their business day closes. Existing unsaved orders will not be deleted.</p></section>';
 };
 document.addEventListener("click",function(ev){
   var btn=ev.target.closest&&ev.target.closest("#tw-save-day-end-time");
   if(!btn)return;
   ev.preventDefault();ev.stopImmediatePropagation();
   if(tab!=="settings")return;
   if(!cloudReady||cloudConflict||cloudBusy||cloudPending){
     uxAlert("Cloud is not ready or is still syncing. Please save after it finishes.");
     return;
   }
   var field=document.getElementById("tw-day-end-time");
   var enabled=document.getElementById("tw-day-end-enabled");
   var value=field&&field.value;
   if(!validTime(value)){uxAlert("Choose a valid 24-hour time, for example 03:00.");return;}
   var before=JSON.stringify(data);
   var cfg=branchCfg();
   cfg.autoDayEndTime=value;
   cfg.autoDayEndEnabled=!!(enabled&&enabled.checked);
   if(!saveTheData(before))return;
   draw();
   showToast(cfg.autoDayEndEnabled?"Saving daily auto day-end at "+value+" IST.":"Automatic day-end disabled.");
 },true);

 // On every completed day-end, scheduled or manual, the next bill opens a
 // new business day. The older invoices and any pending orders remain intact.
 function afterLastClosedDay(baseDate){
   var latest="";
   (data.closings||[]).forEach(function(c){
     if(c.restaurantId===selected&&/^\d{4}-\d{2}-\d{2}$/.test(c.day||"")&&c.day>latest)latest=c.day;
   });
   if(latest&&baseDate<=latest){
     return new Date(Date.parse(latest+"T00:00:00Z")+86400000).toISOString().slice(0,10);
   }
   return baseDate;
 }
 var baseOpenDay=getOpenDay;
 getOpenDay=function(create){
   if(!create)return baseOpenDay(create);
   var existing=data.openDays&&data.openDays[selected];
   if(existing)return existing;
   var cfg=branchCfg(),now=new Date(),baseDate=
     cfg.autoDayEndEnabled===true&&validTime(cfg.autoDayEndTime)?
       shiftDate(now,cfg.autoDayEndTime):today();
   var opened={id:selected+"d"+data.seq++,date:afterLastClosedDay(baseDate),opened:now.toISOString()};
   if(!data.openDays)data.openDays={};
   data.openDays[selected]=opened;
   return opened;
 };
 var baseSaveBill=saveBill;
 saveBill=async function(){
   var cfg=branchCfg();
   if(cfg.autoDayEndEnabled!==true||!validTime(cfg.autoDayEndTime))return await baseSaveBill.apply(this,arguments);
   if(!cloudReady||cloudBusy||cloudConflict||cloudPending){
     uxAlert("Finish synchronizing the open order before completing the bill.");
     return;
   }
   // This GET applies any overdue day-end atomically in the server first.
   var response;
   try{response=await cloudReq("/api/state");}
   catch(err){uxAlert("Cannot check the current business day. Please retry when online.");return;}
   if(!response.ok||!response.body||!valid(response.body.state)){
     uxAlert("Could not verify the current business day. No bill was completed.");return;
   }
   if(cloudBusy||cloudPending||cloudConflict){
     uxAlert("The order is still synchronizing. Retry completing the bill.");return;
   }
   if(Number(response.body.version)!==cloudVersion){
     // Reconcile server-side day close and any other committed changes before invoicing.
     var remote=response.body.state;
     if(activeOrderId&&!(remote.orders||[]).some(function(order){return order.id===activeOrderId&&order.status==="open";})){
       uxAlert("This order was changed elsewhere. Reload the order before billing.");return;
     }
     data=remote;cloudVersion=Number(response.body.version);
     ensureReferenceModel();
     try{localStorage.setItem(KEY,JSON.stringify(data));}catch(err){}
   }
   var active=data.openDays&&data.openDays[selected],config=branchCfg();
   if(active&&Date.parse(active.opened)<lastCutoff(new Date(),config.autoDayEndTime)){
     uxAlert("Automatic day-end is still processing. Retry your bill after cloud synchronization.");return;
   }
   return await baseSaveBill.apply(this,arguments);
 };

 // Remove any legacy PDF action injected by older receipt extensions.
 function trimBillActions(){
   var content=document.getElementById("content");
   if(!content)return;
   content.classList.toggle("tw-bills-view",tab==="bills");
   if(tab!=="bills")return;
   content.querySelectorAll(".table-wrap table").forEach(function(table){
     var headings=Array.from(table.querySelectorAll("thead th"));
     var index=headings.findIndex(function(cell){return /action/i.test(cell.textContent||"");});
     if(index<0)return;
     table.querySelectorAll("tbody tr").forEach(function(tr){
       var td=tr.children[index];
       if(!td)return;
       Array.from(td.querySelectorAll("button,a")).forEach(function(button){
         var label=(button.textContent||"").trim().toLowerCase();
         var action=(button.getAttribute("data-ad")||button.getAttribute("data-action")||"").toLowerCase();
         var print=(action==="print"||label==="print")&&!/pdf/.test(label);
         var cancel=action==="cancel"||label==="cancel";
         if(!print&&!cancel)button.remove();
       });
     });
   });
 }
 var originalDraw=draw;
 draw=function(){
   var r=originalDraw.apply(this,arguments);
   trimBillActions();
   return r;
 };
 var twStyles=document.createElement("style");
 twStyles.id="tw-business-day-bills-style";
 twStyles.textContent=
   '@media(max-width:760px){#content.tw-bills-view .table-wrap table{width:100%;min-width:0;table-layout:auto}'+
   '#content.tw-bills-view .table-wrap th,#content.tw-bills-view .table-wrap td{padding:8px 5px!important;font-size:11px!important;white-space:normal;vertical-align:middle}'+
   '#content.tw-bills-view .table-wrap td:last-child{min-width:85px}'+
   '#content.tw-bills-view .table-wrap td:last-child button{min-height:33px;padding:6px 8px;font-size:11px;margin:2px}'+
   '#content.tw-bills-view .table-wrap td:nth-child(2){overflow-wrap:anywhere}}';
 document.head.appendChild(twStyles);
})();
