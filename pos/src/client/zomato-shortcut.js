/* Add a red Zomato order shortcut alongside New Parcel. */
(function(){
"use strict";
var pending=null,orderTagging=false;
var css=document.createElement("style");css.id="tw-zomato-button-style";
css.textContent=[
 ".tw-new-zomato{background:#d62836!important;color:#fff!important;border:1px solid #b81928!important;cursor:pointer}",
 ".tw-new-zomato:hover{background:#a91c2a!important}",
 ".tw-new-zomato:focus-visible{outline:3px solid #ef8490;outline-offset:2px}",
 "/* Both actions sit beside the table/parcel counters, not in the page heading. */",
 "#content .fl-stats{display:flex!important;flex-wrap:wrap!important;align-items:center!important;gap:12px!important}",
 "#content .tw-pos-quick-actions{display:flex;align-items:center;gap:14px;flex-wrap:nowrap;margin-left:22px;min-width:0}",
 "#content .tw-pos-quick-actions .tw-pos-action-btn{box-sizing:border-box!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;width:200px!important;min-width:200px!important;max-width:200px!important;height:56px!important;min-height:56px!important;flex:0 0 200px!important;padding:10px 15px!important;border-radius:11px!important;font-size:16px!important;font-weight:800!important;line-height:1.2!important;white-space:nowrap!important}",
 "@media(max-width:1150px){#content .tw-pos-quick-actions{margin-left:0}}",
 "@media(max-width:760px){#content .tw-pos-quick-actions{margin:4px 0 0;width:100%;gap:10px;flex-wrap:nowrap}#content .tw-pos-quick-actions .tw-pos-action-btn{width:calc(50% - 5px)!important;min-width:0!important;max-width:none!important;flex:1 1 calc(50% - 5px)!important;height:52px!important;min-height:52px!important;padding:8px 9px!important;font-size:13px!important}}",
 "@media(max-width:360px){#content .tw-pos-quick-actions{flex-wrap:wrap}#content .tw-pos-quick-actions .tw-pos-action-btn{flex:1 1 100%!important;width:100%!important}}"
].join("");
document.head.appendChild(css);
function findNewParcel(){
 return Array.from(document.querySelectorAll("#content button")).find(function(el){
  if(el.classList.contains("tw-new-zomato"))return false;
  var label=(el.textContent||"").trim();
  return /(?:\+\s*|＋\s*)?new\s+parcel\b/i.test(label)||/^(?:\+\s*|＋\s*)parcel\b/i.test(label);
 });
}
function markZomato(){
 if(!pending||Date.now()>pending.expires){pending=null;return;}
 if(orderTagging||pending.restaurant!==selected)return;
 var orders=(data.orders||[]).filter(function(o){
  return o.restaurantId===pending.restaurant&&o.status==="open"&&
   !pending.orderIds.has(String(o.id));
 });
 if(!orders.length)return;
 var order=orders[orders.length-1];
 if(!order)return;
 orderTagging=true;
 try{
  pending=null;
  var old=JSON.stringify(data);
  order.channel="zomato";
  order.source="Zomato";
  if(!/^zomato\b/i.test(String(order.label||""))){
    order.label="Zomato · "+String(order.label||order.name||"Parcel");
  }
  if(!saveTheData(old))return;
  draw();
  showToast("Zomato order created. Add items and complete its bill normally.");
 }finally{orderTagging=false;}
}
function arrangeActions(parcel,zomato){
 // Keep both original clickable elements: this preserves Parcel's existing
 // handlers and the Zomato handler that programmatically clicks Parcel.
 var floor=document.querySelector("#content .fl-root:not(.fl-billing)");
 var stats=floor&&floor.querySelector(".fl-stats");
 if(!stats||!floor.contains(parcel))return;
 var row=stats.querySelector(".tw-pos-quick-actions");
 if(!row){
  row=document.createElement("div");
  row.className="tw-pos-quick-actions";
  stats.appendChild(row);
 }
 parcel.classList.add("tw-pos-action-btn");
 zomato.classList.add("tw-pos-action-btn");
 if(parcel.parentElement!==row)row.appendChild(parcel);
 if(zomato.parentElement!==row)row.appendChild(zomato);
}
function install(){
 if(tab!=="pos")return;
 var parcel=findNewParcel();
 if(!parcel)return;
 var zomato=document.getElementById("tw-new-zomato");
 if(!zomato){
  zomato=document.createElement("button");
  zomato.type="button";zomato.id="tw-new-zomato";zomato.className="tw-new-zomato";
  zomato.textContent="+ Zomato";
  zomato.title="Open a new Zomato-tagged parcel order";
  parcel.insertAdjacentElement("afterend",zomato);
 }
 arrangeActions(parcel,zomato);
}
document.addEventListener("click",function(ev){
 var button=ev.target.closest&&ev.target.closest("#tw-new-zomato");
 if(!button)return;
 ev.preventDefault();ev.stopImmediatePropagation();
 if(tab!=="pos"||!cloudReady||cloudConflict){uxAlert("Open billing and finish cloud synchronization before creating Zomato orders.");return;}
 var source=findNewParcel();
 if(!source){uxAlert("Open the tables/parcel screen first.");return;}
 pending={
   restaurant:selected,
   orderIds:new Set((data.orders||[]).map(function(o){return String(o.id);})),
   expires:Date.now()+120000
 };
 source.click();
 // Some workflows create the order only after a user prompt or after adding an item.
 requestAnimationFrame(markZomato);
},true);
var baseDraw=draw;
draw=function(){
 var result=baseDraw.apply(this,arguments);
 if(tab==="pos"){install();if(pending&&!orderTagging)markZomato();}
 else pending=null;
 return result;
};
})();
