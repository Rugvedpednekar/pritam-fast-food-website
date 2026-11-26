
/* Onyx-style keyboard billing for Pritam Fast Food. The data model stays unchanged. */
(function(){
"use strict";
var kb={mode:"add",step:"code",selected:0,edit:-1,item:null,search:"",cursor:0,context:"",
 discount:"",discountType:"amount",instruction:"",gstin:"",gstName:"",busy:false};
function current(){return tab==="pos"&&!!document.getElementById("twkb");}
function eligible(){return tab==="pos"&&!!document.querySelector("#content .fl-billing");}
function menu(){return (data.menus[selected]||[]).filter(function(m){return m.active!==false&&m.available!==false&&sectionPrice(m,sectionId)!==null;});}
function findCode(code){return menu().find(function(m){return String(m.code).toLowerCase()===String(code).trim().toLowerCase();});}
function matches(){var s=kb.search.toLowerCase();return menu().filter(function(m){return (m.name+" "+m.code+" "+(m.category||"")).toLowerCase().includes(s);}).slice(0,150);}
function qty(n){n=Number(n);return Number.isInteger(n)&&n>=1&&n<=999?n:null;}
function total(){try{return calculatePreview();}catch(ex){return null;}}
function detail(){var t=(data.tables[selected]||[]).find(function(v){return v.id===tableId;});
var o=(data.orders||[]).find(function(v){return v.id===activeOrderId&&v.status==="open";});
return t?.name||o?.label||"Parcel";}
function button(label,act){return '<button type="button" data-kba="'+act+'">'+label+'</button>';}
function screen(){
var viewing=kb.mode==="view",showEditor=!viewing||kb.step==="qty",item=kb.item,p=total(),section=selSection();
var lines=cart.map(function(v,i){var active=viewing&&kb.selected===i;
return '<button type="button" role="option" aria-selected="'+active+'" class="kb-line '+(active?'kb-on kb-current':'')+
'" data-kba="line" data-index="'+i+'"><span><b>'+e(v.name)+'</b><small>#'+e(v.code)+(v.comment?' · '+e(v.comment):'')+
'</small></span><span>'+v.qty+'</span><strong>'+money(v.price*v.qty)+'</strong></button>';}).join("");
var body='<div id="twkb" class="fl-root fl-billing"><div class="kb-head">'+button('← Tables','floor')+
'<div><small>'+e(selectedName())+' · '+e(section?.name||"")+'</small><h2>'+e(detail())+'</h2></div><b class="kb-mode">'+
(viewing?'VIEWING MODE — 0 TO ADD':'ADD ITEM — CODE OR NAME')+'</b></div>'+
'<div class="kb-shortcuts">[0] Add new item &nbsp; [Esc / -] Viewing mode &nbsp; [↑ ↓] Choose &nbsp; [Enter] Select / Save &nbsp; [5] Print bill</div>'+
'<div class="kb-grid'+(showEditor?'':' kb-view-only')+'"><section class="kb-box"><h3>Order Details</h3><div class="kb-table-head"><span>Item</span><span>Qty</span><span>Amount</span></div>'+
'<div class="kb-lines">'+(lines||'<p class="kb-empty">No items yet. Enter an item code.</p>')+'</div>'+
'<div class="kb-totals"><div>Subtotal <b>'+money(p?.subtotal||0)+'</b></div><div>CGST + SGST <b>'+money((p?.cgst||0)+(p?.sgst||0))+
'</b></div><div class="kb-grand">Total <b>'+money(p?.grand||0)+'</b></div></div></section>'+
'<section class="kb-box kb-edit"><h3>'+((kb.step==="qty"&&kb.edit>=0)?'Edit Item':'Item Entry')+'</h3>'+
'<label for="kb-code">Item Code</label><input id="kb-code" inputmode="numeric" autocomplete="off" placeholder="'+(viewing?'Press 0 to add another item':'Type code or alphabet')+
'" '+(viewing&&kb.step!=="qty"?'readonly':'')+'>'+
'<div class="kb-item"><small>Selected Item</small><strong id="kb-live-name">'+e(item?.name||"—")+'</strong><small id="kb-live-price">'+(item?money(item.price):"Enter code to select")+'</small></div>'+
'<label for="kb-qty">Quantity</label><input id="kb-qty" inputmode="numeric" maxlength="3" autocomplete="off" value="'+(item?.qty||1)+'"'+(kb.step==="qty"?'':' readonly')+'>'+
'<label for="kb-comment">Item comment (optional)</label><input id="kb-comment" maxlength="150" autocomplete="off" value="'+e(item?.comment||"")+'"'+(kb.step==="qty"?'':' readonly')+'>'+
'<div class="kb-actions">'+button('0 · Add new','add')+button('Esc / - · View','view')+'</div>'+button('5 · Print Bill','preview')+
'<p class="kb-help">No Tab navigation. Enter moves the keyboard focus automatically.</p></section></div>';
if(kb.step==="search"){
 body+='<div class="kb-overlay"><section class="kb-dialog"><h3>Search Assistant</h3><p>↑ / ↓ to highlight · Enter to choose · Esc / − returns to this table</p>'+
 '<label for="kb-search">Search Code or Item Name</label><input id="kb-search" autocomplete="off" value="'+e(kb.search)+'">'+
 '<div class="kb-results" role="listbox" aria-label="Matching menu items">'+(matches().map(function(m,i){var active=i===kb.cursor;
return '<button type="button" role="option" aria-selected="'+active+'" class="'+(active?'kb-on kb-current':'')+
 '" data-kba="choose" data-index="'+i+'"><span><b>'+e(m.name)+'</b><small>#'+e(m.code)+' · '+e(m.category||"")+'</small></span><strong>'+
 money(sectionPrice(m,sectionId))+'</strong></button>';}).join("")||'<p class="kb-empty">No matching items</p>')+'</div></section></div>';
}
if(kb.step==="preview"){
 body+='<div class="kb-overlay"><section class="kb-dialog"><h3>Bill Preview</h3><p>Enter → Discount → Instruction on Bill → Print</p>'+
 '<div class="kb-pretotal"><span>Grand total</span><strong id="kb-preview-total">'+previewAmount()+'</strong></div>'+
 '<label for="kb-discount">Discount (₹; press / to switch to %)</label><div class="kb-discount-row"><span id="kb-unit">'+(kb.discountType==="percent"?"%":"₹")+
 '</span><input id="kb-discount" inputmode="decimal" value="'+e(kb.discount)+'" placeholder="0"></div>'+
 '<label for="kb-instruction">Instruction on Bill (optional)</label><input id="kb-instruction" maxlength="300" autocomplete="off" value="'+e(kb.instruction)+'">'+
 '<p>'+button('F10 · Customer GST','gst')+(kb.gstin?' <small>'+e(kb.gstin)+'</small>':'')+'</p>'+
 '<div class="kb-actions">'+button('Back · Esc','cancel')+'<button type="button" id="kb-print" data-kba="print">Print Bill · Enter</button></div>'+
 '<p class="kb-help">Printing automatically completes the order and frees the table. A blocked popup leaves the order open.</p></section></div>';
}
if(kb.step==="gst"){
 body+='<div class="kb-overlay"><section class="kb-dialog"><h3>Customer GST details</h3>'+
 '<label for="kb-gstin">GST Number (optional)</label><input id="kb-gstin" autocomplete="off" maxlength="15" value="'+e(kb.gstin)+'">'+
 '<label for="kb-gstname">GST Name (optional)</label><input id="kb-gstname" autocomplete="off" maxlength="120" value="'+e(kb.gstName)+'">'+
 '<div class="kb-actions"><button type="button" data-kba="gst-done" id="kb-gst-done">Save GST details · Enter</button></div></section></div>';
}
return body+'</div>';
}
function previewAmount(){
var a=[discountKind,discountValue,discountReason];
try{discountKind=kb.discount.trim()?kb.discountType:"none";discountValue=kb.discount.trim()?kb.discount:"";
discountReason=kb.discount.trim()?"Bill discount":"";return money(calculatePreview().grand);}
catch(ex){return '<small class="kb-error">'+e(ex.message)+'</small>';}
finally{discountKind=a[0];discountValue=a[1];discountReason=a[2];}
}
function refocus(){
 // When the editor is hidden in Viewing Mode, keep focus on the selected order.
 if(kb.mode==="view"&&kb.step==="list"){
  var rows=typeof document.querySelectorAll==="function"?
   document.querySelectorAll('#twkb .kb-lines button[data-kba="line"]'):[];
  var row=rows[kb.selected];
  if(row&&typeof row.focus==="function"){row.focus({preventScroll:true});return;}
 }
var id=kb.step==="qty"?"kb-qty":kb.step==="search"?"kb-search":kb.step==="preview"?"kb-discount":
kb.step==="gst"?"kb-gstin":"kb-code";
var f=document.getElementById(id);if(f){f.focus({preventScroll:true});if(id==="kb-qty"||id==="kb-discount")f.select();}
}
// Keep a visible selection while keyboard focus remains on Item Code / Search.
function highlightSelection(kind){
 if(typeof document.querySelectorAll!=="function")return;
 var selector=kind==="search"?'#twkb .kb-results button[data-kba="choose"]':'#twkb .kb-lines button[data-kba="line"]';
 var rows=document.querySelectorAll(selector);
 var selectedIndex=kind==="search"?kb.cursor:kb.selected;
 for(var i=0;i<rows.length;i++){
  var active=i===selectedIndex;
  rows[i].classList.toggle("kb-on",active);
  rows[i].classList.toggle("kb-current",active);
  rows[i].setAttribute("aria-selected",String(active));
  if(active){
   // The visible selected line and actual keyboard focus should match.
   if(kind==="order"&&typeof rows[i].focus==="function")rows[i].focus({preventScroll:true});
   if(typeof rows[i].scrollIntoView==="function")rows[i].scrollIntoView({block:"nearest",inline:"nearest"});
  }
 }
}
function paint(){if(!eligible())return;document.getElementById("content").innerHTML=screen();refocus();
 if(kb.step==="search")highlightSelection("search");
 else if(kb.mode==="view"&&kb.step==="list")highlightSelection("order");
}
function reset(){
var key=selected+"|"+sectionId+"|"+tableId+"|"+activeOrderId;
if(key===kb.context)return;
kb.context=key;kb.mode="add";kb.step="code";kb.item=null;kb.edit=-1;kb.selected=0;
kb.discount="";kb.discountType="amount";kb.instruction="";kb.gstin="";kb.gstName="";
}
function enterView(){kb.mode="view";kb.step="list";kb.item=null;kb.edit=-1;kb.selected=Math.min(kb.selected,Math.max(cart.length-1,0));paint();}
function enterAdd(){kb.mode="add";kb.step="code";kb.item=null;kb.edit=-1;paint();}
function closeSearchToTable(){
 // Do not navigate to the floor or switch to Viewing Mode when cancelling a search.
 // The same table/order stays open and Item Code is ready again.
 kb.search="";kb.cursor=0;kb.step="code";kb.mode="add";kb.item=null;kb.edit=-1;
 paint();
}
function pick(item,index){
kb.edit=index;kb.item={id:item.id,name:item.name,code:item.code,price:index>=0?cart[index].price:sectionPrice(item,sectionId),
 qty:index>=0?cart[index].qty:1,comment:index>=0?cart[index].comment||"":"",cgstBP:item.cgstBP,sgstBP:item.sgstBP,priceType:item.priceType};
kb.step="qty";paint();
}
// Show an exact code match immediately, without moving focus or adding an order line.
// Only Enter advances to the highlighted Quantity field.
function previewCode(){
 if(kb.mode!=="add"||kb.step!=="code")return;
 var code=document.getElementById("kb-code")?.value||"";
 var match=findCode(code);
 var name=document.getElementById("kb-live-name");
 var price=document.getElementById("kb-live-price");
 if(name)name.textContent=match?match.name:"—";
 if(price)price.textContent=match?money(sectionPrice(match,sectionId)):
   (code.trim()?"No exact item code yet":"Enter code to select");
}
function lookup(){
var code=document.getElementById("kb-code")?.value||"",item=findCode(code);
if(!code.trim())return;if(!item){showToast("Unknown item code "+code+". Type a letter to search.");return;}pick(item,-1);
}
function preserve(){
if(!cart.length&&!activeOrderId)return true;
var prev=JSON.stringify(data),old=activeOrderId;
try{
 var order=(data.orders||[]).find(function(o){return o.id===activeOrderId&&o.status==="open";});
 if(!order&&tableId)order=(data.orders||[]).find(function(o){return o.restaurantId===selected&&o.tableId===tableId&&o.status==="open";});
 if(!order){
  var sec=selSection(),table=(data.tables[selected]||[]).find(function(t){return t.id===tableId;});
  order={id:"o"+data.seq++,restaurantId:selected,sectionId:sectionId,tableId:tableId||"",status:"open",
   label:table?.name||((sec?.kind==="takeaway")?"Parcel":"Order"),createdAt:new Date().toISOString(),cart:[]};
  data.orders.push(order);
 }
 activeOrderId=order.id;order.cart=JSON.parse(JSON.stringify(cart));order.updatedAt=new Date().toISOString();
 if(!saveTheData(prev)){activeOrderId=old;return false;}
 kb.context=selected+"|"+sectionId+"|"+tableId+"|"+activeOrderId;
 return true;
}catch(ex){data=JSON.parse(prev);activeOrderId=old;showToast("Could not save order.");return false;}
}
function saveQty(){
if(kb.step!=="qty"||!kb.item)return;
var v=qty(document.getElementById("kb-qty")?.value);
if(!v){showToast("Enter quantity from 1 to 999.");return;}
var comment=(document.getElementById("kb-comment")?.value||"").trim().slice(0,150);
var old=JSON.parse(JSON.stringify(cart)),view=kb.mode==="view";
if(kb.edit>=0&&cart[kb.edit]){cart[kb.edit].qty=v;cart[kb.edit].comment=comment;}
else cart.push(Object.assign({},kb.item,{qty:v,comment:comment,addedAt:new Date().toISOString()}));
if(!preserve()){cart=old;return;}
kb.item=null;kb.edit=-1;kb.step=view?"list":"code";kb.mode=view?"view":"add";paint();
}
function openPreview(){if(!cart.length){showToast("Add an item before printing.");return;}kb.step="preview";kb.discount="";kb.discountType="amount";paint();}
function invoice(calc){
var sec=selSection(),table=(data.tables[selected]||[]).find(function(t){return t.id===tableId;}),day=getOpenDay(true),number=newInvoiceNumber(day);
return {id:"b"+data.seq++,number:number,restaurantId:selected,day:day.date,businessDate:day.date,businessDayId:day.id,time:new Date().toISOString(),
type:sec?.kind||"dine-in",sectionName:sec?.name||"",sectionId:sectionId,tableName:table?.name||"",status:"paid",payments:[],
subtotal:calc.subtotal,discount:calc.discount,discountKind:discountKind,discountReason:discountReason,taxable:calc.taxable,
cgst:calc.cgst,sgst:calc.sgst,roundOff:calc.roundOff,total:calc.grand,issuer:JSON.parse(JSON.stringify(branchCfg())),
customerGstin:kb.gstin,customerGstName:kb.gstName,billInstruction:kb.instruction,
items:calc.lines.map(function(x,i){return Object.assign({},x,{comment:cart[i]?.comment||""});})};
}
function printable(b,win){
var w=win||window.open("","_blank","width=440,height=700");if(!w)return false;
var cfg=b.issuer||{},rows=(b.items||[]).map(function(x,i){
return '<tr><td>'+Number(i+1)+'</td><td>'+e(x.name)+'</td><td>'+x.qty+'</td><td>'+money(x.price)+'</td><td>'+money(x.total)+'</td></tr>';
}).join("");
var doc='<!doctype html><html><head><meta charset="utf-8"><title>Bill '+e(b.number)+'</title><style>@page{size:'+
(cfg.receiptWidth==="58"?"58":"80")+'mm auto;margin:2mm}body{font:12px Arial;max-width:350px;margin:auto;color:#111}h3,p{text-align:center}table{width:100%;border-collapse:collapse;margin:12px 0}td,th{padding:5px 2px;border-bottom:1px dotted #aaa;text-align:right}td:nth-child(2),th:nth-child(2){text-align:left}.total{display:flex;justify-content:space-between;padding:5px 0}.grand{font-size:17px;border-top:1px solid #222;font-weight:800}</style></head><body>'+
'<h3>'+e(cfg.legalName||selectedName())+'</h3><p>'+e(cfg.address||"")+'<br>Bill #'+e(b.number)+' · '+e(b.businessDate||b.day)+'<br>'+e(b.sectionName||"")+' '+e(b.tableName||"")+'</p>'+
(b.customerGstin?'<p>Customer GSTIN: '+e(b.customerGstin)+'<br>'+e(b.customerGstName||"")+'</p>':"")+
'<table><thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>'+rows+'</tbody></table>'+
'<div class="total">Subtotal <b>'+money(b.subtotal)+'</b></div><div class="total">Discount <b>− '+money(b.discount||0)+'</b></div>'+
'<div class="total">CGST <b>'+money(b.cgst||0)+'</b></div><div class="total">SGST <b>'+money(b.sgst||0)+'</b></div>'+
'<div class="total grand">TOTAL <b>'+money(b.total)+'</b></div>'+
(b.billInstruction?'<p>Instruction on Bill: '+e(b.billInstruction)+'</p>':"")+
'<p>'+e(cfg.footer||"Thank you!")+'</p><p><small>DEMO RECEIPT — NOT A VALID TAX INVOICE</small></p></body></html>';
try{w.document.open();w.document.write(doc);w.document.close();w.focus();
setTimeout(function(){try{if(!w.closed)w.print();}catch(ex){}},160);return true;}
catch(ex){try{w.close();}catch(ignored){}return false;}
}
function printAndComplete(){
if(kb.busy)return;
if(!cart.length)return;
if(!cloudReady||cloudBusy||cloudPending||cloudConflict){showToast("Wait for Cloud synced ✓ before printing.");return;}
if(selSection()?.kind==="dine-in"&&!tableId){showToast("Select a table to print.");return;}
if(kb.gstin&&!/^[A-Z0-9]{15}$/.test(kb.gstin)){showToast("Customer GSTIN must have 15 letters/digits.");return;}
kb.busy=true;
var old=JSON.stringify(data),oldDiscount=[discountKind,discountValue,discountReason],popup=null,saved=false;
try{
 discountKind=kb.discount.trim()?kb.discountType:"none";discountValue=kb.discount.trim()?kb.discount:"";
 discountReason=kb.discount.trim()?"Bill discount":"";
 var calc=calculatePreview();if(calc.grand<=0)throw Error("Bill total must be above zero.");
 popup=window.open("","_blank","width=440,height=700");if(!popup)throw Error("Printer popup blocked. Bill stays open.");
 var b=invoice(calc),order=(data.orders||[]).find(function(o){return o.id===activeOrderId&&o.status==="open";});
 if(order)order.status="billed";data.bills.push(b);data.audit.push({action:"bill_completed",billNumber:b.number,restaurantId:selected,at:b.time});
 if(!saveTheData(old))throw Error("Bill could not be saved.");
 saved=true;
 // An invoice must never remain editable once saved, even if its print window fails.
 // Otherwise retrying Print could issue a duplicate invoice for the same order.
 var printOpened=printable(b,popup);
 cart=[];tableId="";activeOrderId="";discountKind="none";discountValue="";discountReason="";
 kb.context="";kb.mode="add";kb.step="code";draw();
 if(!printOpened){showToast("Bill "+b.number+" completed, but receipt printing failed. Reprint from Bill History.");return;}
 showToast("Bill "+b.number+" completed. Table is free.");
}catch(ex){if(!saved){data=JSON.parse(old);if(popup)try{popup.close();}catch(ignored){}}showToast(ex.message||"Print failed.");}
finally{kb.busy=false;if(!saved){discountKind=oldDiscount[0];discountValue=oldDiscount[1];discountReason=oldDiscount[2];}}
}
function action(name,el){
if(name==="add")return enterAdd();
if(name==="view")return enterView();
if(name==="floor"){cart=[];tableId="";activeOrderId="";kb.context="";draw();return;}
if(name==="line"){kb.selected=Number(el.dataset.index)||0;kb.mode="view";kb.step="list";paint();return;}
if(name==="choose"){var m=matches()[Number(el.dataset.index)||0];if(m){kb.search="";pick(m,-1);}return;}
if(name==="preview")return openPreview();
if(name==="cancel"){kb.step="code";paint();return;}
if(name==="print")return printAndComplete();
if(name==="gst"){kb.step="gst";paint();return;}
if(name==="gst-done"){kb.gstin=(document.getElementById("kb-gstin")?.value||"").trim().toUpperCase();
 kb.gstName=(document.getElementById("kb-gstname")?.value||"").trim();kb.step="preview";paint();return;}
}
function key(ev){
if(!current()||ev.ctrlKey||ev.metaKey||ev.altKey)return;
if(document.querySelector("dialog[open],#cloudGate:not(.hidden)"))return;
var k=ev.key,id=document.activeElement?.id||"";
function stop(){ev.preventDefault();ev.stopImmediatePropagation();}
if(k==="Tab"){stop();return;}
if(kb.step==="gst"){
 if(k==="Escape"){stop();kb.step="preview";paint();return;}
 if(k!=="Enter")return;stop();
 if(id==="kb-gstin")return document.getElementById("kb-gstname")?.focus();
 if(id==="kb-gstname")return document.getElementById("kb-gst-done")?.focus();
 return action("gst-done");
}
if(kb.step==="preview"){
 if(k==="Escape"){stop();kb.step="code";paint();return;}
 if(k==="F10"){stop();return action("gst");}
 if(k==="/"&&id==="kb-discount"){stop();kb.discountType=kb.discountType==="percent"?"amount":"percent";document.getElementById("kb-unit").textContent=kb.discountType==="percent"?"%":"₹";return;}
 if(k!=="Enter")return;stop();
 if(id==="kb-discount"){
  kb.discount=document.getElementById("kb-discount")?.value||"";
  var label=previewAmount();if(label.includes("kb-error")){showToast("Enter a valid discount.");return;}
  document.getElementById("kb-preview-total").innerHTML=label;return document.getElementById("kb-instruction")?.focus();
 }
 if(id==="kb-instruction"){kb.instruction=document.getElementById("kb-instruction")?.value||"";return document.getElementById("kb-print")?.focus();}
 if(id==="kb-print"){kb.instruction=document.getElementById("kb-instruction")?.value||"";return printAndComplete();}
 return;
}
if(kb.step==="search"){
 if(k==="Escape"||k==="Esc"||k==="-"||k==="Subtract"||k==="NumpadSubtract"){stop();return closeSearchToTable();}
 if(k==="ArrowDown"||k==="ArrowUp"){
  stop();var a=matches();
  if(a.length){kb.cursor=Math.max(0,Math.min(a.length-1,kb.cursor+(k==="ArrowDown"?1:-1)));highlightSelection("search");}
  return;
 }
 if(k==="Enter"){stop();var m=matches()[kb.cursor];if(m){kb.search="";pick(m,-1);}return;}
 return;
}
if(kb.step==="qty"){
 if(k==="Escape"||k==="-"){stop();return enterView();}
 if(k==="Enter"){stop();return saveQty();}
 return;
}
if(k==="Escape"||k==="-"){stop();return enterView();}
if(kb.mode==="view"){
 if(k==="0"){stop();return enterAdd();}
 if(k==="5"){stop();return openPreview();}
 if(k==="ArrowDown"||k==="ArrowUp"){stop();if(cart.length){
  kb.selected=(kb.selected+(k==="ArrowDown"?1:-1)+cart.length)%cart.length;
  kb.step="list";highlightSelection("order");
 }return;}
 if(k==="Enter"){stop();var row=cart[kb.selected];if(row){var m=menu().find(function(x){return x.id===row.id;})||row;pick(m,kb.selected);}return;}
 if(k==="Delete"){stop();var row=cart[kb.selected];if(!row)return;
  if(!window.confirm("Remove "+row.name+" from this order?"))return;
  var old=JSON.parse(JSON.stringify(cart));cart.splice(kb.selected,1);kb.selected=Math.max(0,Math.min(kb.selected,cart.length-1));
  if(!preserve()){cart=old;return;}kb.step="list";paint();return;}
 if(/^[0-9a-z]$/i.test(k)){stop();if(k!=="0")showToast("Press 0 to add an item.");}return;
}
if(kb.mode==="add"){
 if(id==="kb-code"&&/^[a-z]$/i.test(k)){stop();kb.step="search";kb.search=k;kb.cursor=0;paint();return;}
 if(k==="Enter"){stop();return lookup();}
}
}
var css=document.createElement("style");css.id="twkb-style";css.textContent=[
"#twkb{color:#eef9f2;max-width:1460px;margin:auto}",
"#twkb .kb-head{display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin:0 0 12px}",
"#twkb h2{margin:3px 0;font-size:26px}#twkb h3{margin:2px 0 16px;font-size:18px}#twkb small{color:#9cbfb4}",
"#twkb .kb-mode{background:#176a50;color:#fff;padding:9px 12px;border-radius:8px;font-size:12px}",
"#twkb .kb-shortcuts{background:#19313b;padding:13px;margin:10px 0 15px;border-radius:8px;color:#c4dbd5;font-size:13px}",
"#twkb .kb-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(310px,.85fr);gap:15px}",
"#twkb .kb-grid.kb-view-only{grid-template-columns:minmax(0,1fr)!important}",
"#twkb .kb-grid.kb-view-only .kb-edit{display:none!important}",
"#twkb .kb-box{background:#162c34;border:1px solid #36545b;border-radius:12px;padding:17px;min-width:0}",
"#twkb .kb-table-head,#twkb .kb-line{display:grid;grid-template-columns:minmax(0,1fr) 45px 108px;gap:8px;align-items:center;text-align:left}",
"#twkb .kb-table-head{background:#0e2029;color:#a5c9bc;border-radius:8px;padding:10px 12px;font-size:12px}",
"#twkb .kb-table-head span:last-child,#twkb .kb-line strong{text-align:right}",
"#twkb .kb-lines{min-height:180px;max-height:55dvh;overflow:auto}",
"#twkb .kb-line{width:100%;border:1px solid transparent;border-bottom-color:#38525c;color:#eef9f5;background:transparent;padding:12px;text-align:left;cursor:pointer}",
"#twkb .kb-line small{display:block;font-size:11px;margin-top:3px}#twkb .kb-on{background:#19563e!important;border-color:#5bcc91!important}",
"#twkb .kb-lines button.kb-current,#twkb .kb-results button.kb-current{background:#16714c!important;color:#ffffff!important;border:2px solid #a6ffc0!important;border-left:6px solid #c4ff80!important;box-shadow:0 0 0 2px #38b77f99,inset 0 0 0 1px #165a43!important;font-weight:800!important}",
"#twkb .kb-lines button.kb-current :is(b,span,strong,small),#twkb .kb-results button.kb-current :is(b,span,strong,small){color:#ffffff!important}",
"#twkb .kb-totals{border-top:1px solid #3f5961;padding-top:10px}#twkb .kb-totals div{display:flex;justify-content:space-between;margin:9px 0;font-size:13px}",
"#twkb .kb-totals .kb-grand{font-size:18px;font-weight:800;border-top:1px solid #43595e;padding-top:12px;color:#81f1ba}",
"#twkb label{display:block;margin:14px 0 6px;font-weight:750;font-size:12px;color:#c1dad1}",
"#twkb input{background:#0c1f26;border:1px solid #53717a;color:#fff;border-radius:8px;width:100%;min-height:44px;padding:10px 12px}",
"#twkb input:focus,#twkb button:focus-visible{outline:3px solid #5cd6a4;outline-offset:2px}",
"#twkb input[readonly]{opacity:.72}#twkb button{border:1px solid #54746e;background:#233c44;color:#f0fcf5;border-radius:8px;padding:11px;font-weight:750;cursor:pointer}",
"#twkb button[data-kba=preview],#twkb button[data-kba=print]{background:#126b50;border-color:#32b383}",
"#twkb .kb-item{background:#0d252b;border-radius:8px;padding:13px;margin:15px 0;display:grid;gap:5px}",
"#twkb .kb-item strong{font-size:17px}#twkb .kb-actions{display:flex;gap:9px;margin:17px 0}",
"#twkb .kb-actions button{flex:1}#twkb .kb-help,#twkb .kb-empty{font-size:12px;color:#a4beb6;padding:10px}",
"#twkb .kb-overlay{position:fixed;inset:0;z-index:9500;background:#0a171bdc;padding:5dvh 12px;overflow:auto;display:flex;justify-content:center;align-items:flex-start}",
"#twkb .kb-dialog{background:#1b313a;border:1px solid #53747c;border-radius:13px;padding:22px;width:min(560px,100%);box-shadow:0 15px 50px #0009}",
"#twkb .kb-dialog p{font-size:13px;color:#adcbc1}#twkb .kb-pretotal{display:flex;justify-content:space-between;font-size:18px;background:#0e252e;padding:15px;border-radius:8px}",
"#twkb .kb-results{max-height:55dvh;overflow:auto;margin-top:12px}#twkb .kb-results button{display:flex;justify-content:space-between;gap:10px;width:100%;border:0;border-bottom:1px solid #3b5760;border-radius:0;text-align:left}",
"#twkb .kb-results small{display:block}#twkb .kb-discount-row{display:flex;gap:10px;align-items:center}#twkb .kb-discount-row span{min-width:30px;text-align:center;font-weight:bold;font-size:20px}",
"#twkb .kb-error{color:#ffb9a2}",
"@media(max-width:760px){#twkb .kb-grid{grid-template-columns:1fr}#twkb .kb-lines{max-height:32dvh}#twkb h2{font-size:21px}#twkb .kb-table-head,#twkb .kb-line{grid-template-columns:minmax(0,1fr) 34px 94px}}"
].join("");document.head.appendChild(css);
document.addEventListener("click",function(ev){var el=ev.target?.closest?.("[data-kba]");
if(!el||!current())return;ev.preventDefault();ev.stopImmediatePropagation();action(el.dataset.kba,el);},true);
document.addEventListener("input",function(ev){var t=ev.target;if(!current())return;
if(t.id==="kb-code"){previewCode();return;}
if(t.id==="kb-search"){var at=t.selectionStart;kb.search=t.value;kb.cursor=0;paint();
var fresh=document.getElementById("kb-search");fresh?.focus();try{fresh?.setSelectionRange(at,at);}catch(ex){}}
if(t.id==="kb-discount"){kb.discount=t.value;document.getElementById("kb-preview-total").innerHTML=previewAmount();}
if(t.id==="kb-instruction")kb.instruction=t.value;},true);
window.addEventListener("keydown",key,true);
var oldDraw=draw;draw=function(){var result=oldDraw.apply(this,arguments);
if(eligible()){reset();document.getElementById("content").innerHTML=screen();refocus();}else kb.context="";
return result;};
var oldPrint=printBill;printBill=function(b){if(b&&(b.billInstruction||b.customerGstin)){return printable(b);}
return oldPrint.apply(this,arguments);};
})();