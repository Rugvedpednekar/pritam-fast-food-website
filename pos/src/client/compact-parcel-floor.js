/* Compact occupied tables and day-scoped P-1, P-2 parcel keyboard workflow. */
(function(){
"use strict";
var css=document.createElement("style");
css.id="tw-compact-occupied-parcels-v1";
css.textContent=[
 // The old floor remains responsible for hit targets/order state.
 "#content .fl-root:not(.fl-billing) .fl-table-grid{display:grid!important;grid-template-columns:repeat(auto-fill,96px)!important;justify-content:start!important;align-items:start!important;gap:12px!important}",
 "#content .fl-root:not(.fl-billing) .fl-table-grid>button{box-sizing:border-box!important;width:96px!important;min-width:96px!important;max-width:96px!important;height:102px!important;min-height:102px!important;max-height:102px!important;padding:9px 7px!important;border-radius:10px!important;overflow:hidden!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:0!important;line-height:1.1!important;text-align:center!important}",
"#content .fl-root:not(.fl-billing) .fl-table-grid>button.tw-table-number-card>*:not(.tw-table-only-number){display:none!important}",
"#content .fl-root:not(.fl-billing) .fl-table-grid>button.tw-table-number-card .tw-table-only-number{display:block!important;width:100%;color:#f1fff8!important;font-weight:850!important;font-size:32px!important;line-height:1!important;text-align:center!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}",
 "#content .fl-root:not(.fl-billing) .fl-table-grid>button :is(strong,b){font-size:26px!important;line-height:1.1!important}",
 "#content .fl-root:not(.fl-billing) .fl-table-grid>button :is(small,span){font-size:11px!important;max-width:100%;overflow:hidden!important;text-overflow:ellipsis!important}",
 // Free tables are reachable by typing the table number; only active orders show tiles.
 "#content .fl-root:not(.fl-billing) .fl-table-grid>button:not(.tw-table-occupied):not(.occupied):not([data-status='occupied']){display:none!important}",
 "#content .fl-root:not(.fl-billing) .fl-parcels{display:grid!important;grid-template-columns:repeat(auto-fill,110px)!important;justify-content:start!important;align-items:start!important;gap:12px!important;background:transparent!important;border:0!important;box-shadow:none!important}",
 "#content .fl-root:not(.fl-billing) .fl-parcels>button[data-fl='parcel-open']{box-sizing:border-box!important;width:110px!important;min-width:110px!important;max-width:110px!important;height:68px!important;min-height:68px!important;max-height:68px!important;padding:9px 10px!important;display:flex!important;align-items:center!important;justify-content:center!important;text-align:center!important;border:1px solid #4aa48a!important;border-radius:9px!important;background:#193b38!important;color:#f3fff8!important;box-shadow:none!important;font-size:20px!important;font-weight:850!important;letter-spacing:.3px!important}",
 "#content .fl-root:not(.fl-billing) .fl-parcels>button[data-fl='parcel-open']:hover{background:#21664e!important;border-color:#71dfaa!important}",
 "#content .fl-root:not(.fl-billing) .fl-parcels .tw-parcel-card-number{font-size:19px!important;font-weight:850!important;color:inherit!important}",
 "@media(max-width:760px){#content .fl-root:not(.fl-billing) .fl-parcels{grid-template-columns:repeat(auto-fill,110px)!important;gap:10px!important}#content .fl-root:not(.fl-billing) .fl-parcels>button[data-fl='parcel-open']{width:110px!important;min-width:110px!important;max-width:110px!important;height:68px!important;min-height:68px!important;max-height:68px!important;justify-content:center!important}}"
].join("");
document.head.appendChild(css);
function isTakeaway(order){
 if(!order||order.restaurantId!==selected)return false;
 var sec=(data.sections[selected]||[]).find(function(x){return String(x.id)===String(order.sectionId);});
 if(sec&&(/^(takeaway|takeout|parcel)$/i.test(String(sec.kind||""))||/parcel|takeaway/i.test(String(sec.name||""))))return true;
 // Older orders may retain the Parcel label even if a section was renamed or deleted.
 return !order.tableId&&(/^(parcel|p-\d+)(\s|$)/i.test(String(order.label||""))||
  /^(parcel|takeaway)$/i.test(String(order.channel||order.type||"")));
}
function isParcelSection(sec){
 return !!sec&&(/^(takeaway|takeout|parcel)$/i.test(String(sec.kind||""))||
  /parcel|takeaway/i.test(String(sec.name||"")));
}
window.twIsParcelSection=isParcelSection;
function dayFor(iso){
 var d=new Date(iso||Date.now());
 return Number.isFinite(d.getTime())?new Date(d.getTime()+330*60000).toISOString().slice(0,10):"";
}
function keyFor(order){
 if(order.parcelDayId)return String(order.parcelDayId);
 if(order.parcelDay)return String(order.parcelDay);
 var active=data.openDays&&data.openDays[selected];
 // Historical, unnumbered orders use their actual date, not the current day.
 return dayFor(order.createdAt)||active?.date||"";
}
function currentDay(){
 var day=data.openDays&&data.openDays[selected];
 return day||getOpenDay(true);
}
function parcelOrders(){
 return (data.orders||[]).filter(isTakeaway);
}
function parcelSequence(order,dayId){
 var value=Number(order.parcelSeq);
 return Number.isSafeInteger(value)&&value>0&&String(order.parcelDayId||order.parcelDay)===String(dayId)?value:0;
}
function sequenceFor(dayId,existing){
 var used=new Set();
 parcelOrders().forEach(function(order){
  var value=parcelSequence(order,dayId);
  if(value)used.add(value);
 });
 (data.bills||[]).filter(function(b){return b.restaurantId===selected;}).forEach(function(b){
  if(String(b.parcelDayId||b.businessDayId||b.day)!==String(dayId))return;
  var n=Number(b.parcelSeq)||Number(String(b.number||"").match(/^P-(\d+)$/i)?.[1]);
  if(Number.isSafeInteger(n)&&n>0)used.add(n);
 });
 if(existing)used.delete(existing);
 var next=1;while(used.has(next))next++;
 return next;
}
function ensureNumbers(opts){
 opts=opts||{};
 // Assign all currently unnumbered open parcel orders before sync. Existing
 // tokens never change when a bill or a new order is created.
 var orders=parcelOrders().filter(function(o){return o.status==="open";}).sort(function(a,b){
  return String(a.createdAt||"").localeCompare(String(b.createdAt||""));
 });
 var changed=false,activeDay=null;
 orders.forEach(function(o){
  if(o.parcelSeq&&o.parcelDayId)return;
  if(!activeDay)activeDay=currentDay();
  var oldDate=dayFor(o.createdAt);
  var dayId=oldDate&&activeDay.date!==oldDate?oldDate:activeDay.id;
  o.parcelSeq=sequenceFor(dayId);
  o.parcelDayId=dayId;
  o.parcelDay=dayId===activeDay.id?activeDay.date:oldDate||activeDay.date;
  if(!/^zomato\b/i.test(String(o.label||"")))o.label="P-"+o.parcelSeq;
  changed=true;
 });
 return changed;
}
function readPending(){
 var list=parcelOrders().filter(function(o){return o.status==="open";});
 return list.sort(function(a,b){return String(a.createdAt||"").localeCompare(String(b.createdAt||""));});
}
function displayNumbers(){
 var orders=readPending(),tokens=new Map();
 var active=data.openDays&&data.openDays[selected];
 // Unnumbered legacy parcels still receive deterministic temporary labels.
 var byDay=new Map();
 orders.forEach(function(o){
  var day=o.parcelDayId||keyFor(o)||"unknown";
  if(!byDay.has(day))byDay.set(day,new Set());
  var n=parcelSequence(o,day);
  if(n)byDay.get(day).add(n);
 });
 orders.forEach(function(o){
  var day=o.parcelDayId||keyFor(o)||"unknown",used=byDay.get(day);
  var n=parcelSequence(o,day);
  if(!n){n=1;while(used.has(n))n++;used.add(n);}
  tokens.set(String(o.id),{order:o,number:n,label:"P-"+n,day:day,dayDate:o.parcelDay||dayFor(o.createdAt)||active?.date||""});
 });
 return tokens;
}
function findFloor(){
 if(tab!=="pos")return null;
 return document.querySelector("#content .fl-root:not(.fl-billing)");
}
function tableInput(floor){
 if(!floor)return null;
 var candidates=floor.querySelectorAll("input");
 for(var i=0;i<candidates.length;i++){
  var input=candidates[i];
  var hint=(input.getAttribute("placeholder")||"")+" "+(input.getAttribute("aria-label")||"");
  if(/table\s*(?:number|no\.?)/i.test(hint)||/^\s*1\s*,\s*2\s*,\s*3/i.test(hint))return input;
  var wrapper=input.parentElement;
  if(wrapper&&/table\s*(?:number|no\.?)/i.test(wrapper.textContent||"")&&
    wrapper.querySelectorAll("input").length===1)return input;
 }
 return null;
}
function applyTableNumbers(floor){
 var grid=floor.querySelector(".fl-table-grid");if(!grid)return;
 var tables=data.tables[selected]||[];
 var openIds=new Set((data.orders||[]).filter(function(o){
  return o.restaurantId===selected&&o.status==="open"&&o.tableId;
 }).map(function(o){return String(o.tableId);}));
 Array.from(grid.querySelectorAll("button")).forEach(function(btn){
  var id=btn.dataset.tableId||btn.dataset.id||btn.getAttribute("data-table-id")||
   btn.getAttribute("data-id")||"";
  var first=btn.querySelector("strong,b");
  var displayed=first?first.textContent.trim():btn.textContent.trim().match(/^\d+/)?.[0]||"";
  var table=tables.find(function(t){return String(t.id)===String(id);})||
   tables.find(function(t){return String(t.name).trim()===displayed;});
  if(!table)return;
  var occupied=openIds.has(String(table.id));
  btn.classList.toggle("tw-table-number-card",occupied);
  btn.classList.toggle("tw-table-occupied",occupied);
  btn.classList.toggle("tw-table-hidden",!occupied);
  if(!occupied)return;
  var label=btn.querySelector(".tw-table-only-number");
  if(!label){label=document.createElement("span");label.className="tw-table-only-number";btn.appendChild(label);}
  if(label.textContent!==String(table.name))label.textContent=String(table.name);
  btn.setAttribute("aria-label","Open occupied table "+table.name);
 });
}
function renderFloor(){
 var floor=findFloor();if(!floor)return;
 applyTableNumbers(floor);
 var lookup=tableInput(floor);
 if(lookup){
  lookup.setAttribute("autocomplete","off");
  lookup.setAttribute("aria-label","Table number or P parcel number");
  lookup.setAttribute("placeholder","Table no. / P / P1");
 }
 var parcels=floor.querySelector(".fl-parcels");if(!parcels)return;
 var orders=readPending(),tokens=displayNumbers();
 var existing=Array.from(parcels.querySelectorAll('button[data-fl="parcel-open"]'));
 var used=new Set();
 var cards=orders.map(function(order,i){
  var id=String(order.id);
  var original=existing.find(function(b){return b.dataset.id===id||b.dataset.orderId===id||
   b.dataset.twParcelOrderId===id||b.getAttribute("data-order-id")===id;});
  if(!original&&existing.length===orders.length)original=existing[i];
  if(original&&used.has(original))original=null;
  var btn=original||document.createElement("button");
  used.add(btn);
  btn.type="button";btn.dataset.fl="parcel-open";btn.dataset.id=id;
  btn.dataset.orderId=id;btn.dataset.twParcelOrderId=id;
  if(!original)btn.addEventListener("click",function(ev){
   // New cards are linked directly to the saved order; no temporary bill is created.
   if(ev&&typeof ev.stopImmediatePropagation==="function")ev.stopImmediatePropagation();
   openPendingParcel(id);
  },true);
  var token=tokens.get(id);
  btn.textContent=token?token.label:"Parcel";
  btn.title=(token?token.label:"Parcel")+" · "+(order.cart||[]).length+" item lines";
  btn.setAttribute("aria-label","Open pending parcel "+btn.textContent);
  return btn;
 });
 if(typeof parcels.replaceChildren==="function"){
  if(cards.length)parcels.replaceChildren.apply(parcels,cards);
  else {
   var empty=document.createElement("span");
   empty.className="tw-empty-parcel-message";
   empty.textContent="No open parcel orders.";
   parcels.replaceChildren(empty);
  }
 }
}
function openPendingParcel(orderId){
 var order=(data.orders||[]).find(function(o){return String(o.id)===String(orderId)&&o.status==="open"&&isTakeaway(o);});
 if(!order){showToast("This parcel is no longer pending.");return false;}
 // Restore the saved order in the same billing workspace used for dine-in tables.
 sectionId=order.sectionId;tableId="";
 activeOrderId=order.id;cart=JSON.parse(JSON.stringify(order.cart||[]));
 draw();
 return true;
}
function nextOrderCandidate(number){
 var all=Array.from(displayNumbers().values()).filter(function(x){return x.number===number});
 if(!all.length)return null;
 var active=data.openDays&&data.openDays[selected];
 return all.sort(function(a,b){
  var aToday=active&&(a.day===active.id||a.dayDate===active.date)?1:0;
  var bToday=active&&(b.day===active.id||b.dayDate===active.date)?1:0;
  return bToday-aToday||String(b.order.createdAt||"").localeCompare(String(a.order.createdAt||""));
 })[0];
}
function clickParcelButton(floor,orderId){
 var buttons=Array.from(floor.querySelectorAll('.fl-parcels button[data-fl="parcel-open"]'));
 var match=buttons.find(function(btn){
  return btn.dataset.twParcelOrderId===orderId||
   btn.dataset.id===orderId||btn.dataset.orderId===orderId||
   btn.getAttribute("data-order-id")===orderId;
 });
 if(!match){renderFloor();match=Array.from(floor.querySelectorAll('.fl-parcels button[data-fl="parcel-open"]')).find(function(btn){return btn.dataset.twParcelOrderId===orderId;});}
 if(!match)return openPendingParcel(orderId);
 match.click();return true;
}
function newParcel(floor){
 var parcel=Array.from(floor.querySelectorAll("button")).find(function(el){
  return /(?:\+\s*|＋\s*)?new\s+parcel\b/i.test(el.textContent||"");
 });
 if(!parcel){showToast("New Parcel action is unavailable.");return false;}
 parcel.click();return true;
}
function jump(value){
 var floor=findFloor();if(!floor)return;
 var text=String(value).trim().toUpperCase();
 if(!/^P\d*$/.test(text))return;
 if(text==="P"){newParcel(floor);return;}
 var number=Number(text.slice(1));
 if(!Number.isSafeInteger(number)||number<1){showToast("Use P1, P2, etc. to open a pending parcel.");return;}
 var match=nextOrderCandidate(number);
 if(!match){showToast("No pending parcel P-"+number+" found.");return;}
 if(!clickParcelButton(floor,String(match.order.id))){
  showToast("Could not open parcel P-"+number+". Select its card to resume.");
 }
}
window.twFloorParcelShortcut=function(ev){
 var floor=findFloor();if(!floor||ev.ctrlKey||ev.altKey||ev.metaKey||
   document.querySelector("dialog[open],#cloudGate:not(.hidden)"))return false;
 var input=tableInput(floor);if(!input)return false;
 var key=ev.key,active=ev.target,focused=active===input;
 // Other text fields retain native typing; only the table-number input is special.
 if(key.toLowerCase()==="p"&&(!active||active===document.body||focused||
  (typeof active.closest==="function"&&active.closest("#content .fl-root:not(.fl-billing)")&&!/^(INPUT|TEXTAREA|SELECT)$/i.test(active.tagName||"")))){
  ev.preventDefault();ev.stopImmediatePropagation();
  // Do not fire a synthetic input event for P: older POS listeners can
  // treat that as an immediate Parcel shortcut. Enter is the only opener.
  input.value="P";
  input.focus({preventScroll:true});
  return true;
 }
 if(key==="Enter"&&focused&&/^\s*p\d*\s*$/i.test(input.value)){
  ev.preventDefault();ev.stopImmediatePropagation();
  var v=input.value;input.value="";input.dispatchEvent(new Event("input",{bubbles:true}));
  jump(v);return true;
 }
 return false;
};
window.twFloorParcelKeyup=function(ev){
 var floor=findFloor();if(!floor)return false;
 var input=tableInput(floor);if(!input)return false;
 if(ev.key.toLowerCase()==="p"&&ev.target===input){
  ev.preventDefault();ev.stopImmediatePropagation();return true;
 }
 return false;
};
window.twParcelInvoiceNumber=function(order,day){
 if(!order||!isTakeaway(order))return "";
 ensureNumbers();
 var seq=Number(order.parcelSeq);
 if(!seq){
  var dayId=order.parcelDayId||day?.id||currentDay().id;
  seq=sequenceFor(dayId);order.parcelSeq=seq;order.parcelDayId=dayId;
  order.parcelDay=day?.date||dayFor(order.createdAt);
 }
 return "P-"+seq;
};
var baseSave=saveTheData;
saveTheData=function(before){
 // Tag open parcel orders in the same atomic snapshot write that stores them.
 if(tab==="pos"&&parcelOrders().some(function(o){return o.status==="open"&&!o.parcelSeq;})){
  ensureNumbers();
 }
 return baseSave.apply(this,arguments);
};
var previousDraw=draw;
draw=function(){
 var result=previousDraw.apply(this,arguments);
 renderFloor();return result;
};
renderFloor();
})();