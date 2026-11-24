/* Add a red Zomato order shortcut alongside New Parcel. */
(function(){
"use strict";
var pending=null,orderTagging=false;
var css=document.createElement("style");css.id="tw-zomato-button-style";
css.textContent='.tw-new-zomato{background:#d62836!important;color:#fff!important;border:1px solid #b81928!important;border-radius:9px!important;padding:9px 14px!important;min-height:43px!important;font-weight:800!important;display:inline-flex;align-items:center;justify-content:center;gap:5px;cursor:pointer;white-space:nowrap}.tw-new-zomato:hover{background:#a91c2a!important}.tw-new-zomato:focus-visible{outline:3px solid #ef8490;outline-offset:2px}@media(max-width:760px){.tw-new-zomato{font-size:13px!important;padding:10px 12px!important}}';
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
function install(){
 if(tab!=="pos")return;
 var existing=document.getElementById("tw-new-zomato");
 if(existing)return;
 var source=findNewParcel();
 if(!source)return;
 var btn=document.createElement("button");
 btn.type="button";btn.id="tw-new-zomato";btn.className="tw-new-zomato";btn.textContent="+ Zomato";
 btn.title="Open a new Zomato-tagged parcel order";
 source.insertAdjacentElement("afterend",btn);
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
