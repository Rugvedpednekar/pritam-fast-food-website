
/* Onyx-style keyboard billing for Pritam Fast Food. The data model stays unchanged. */
(function(){
"use strict";
var kb={mode:"add",step:"code",selected:0,edit:-1,item:null,search:"",cursor:0,shiftIndex:0,pendingShiftId:"",context:"",
 discount:"",discountType:"percent",instruction:"",gstin:"",gstName:"",busy:false};
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
function tableDisplayName(raw){
 var value=String(raw==null?"":raw).trim();
 return /^\d+$/.test(value)?"Table "+value:(value||"this table");
}
function screen(){
var viewing=kb.mode==="view",showEditor=!viewing||kb.step==="qty",item=kb.item,p=total(),section=selSection();
var lines=cart.map(function(v,i){var active=viewing&&kb.selected===i;
return '<button type="button" role="option" aria-selected="'+active+'" class="kb-line '+(active?'kb-on kb-current':'')+
'" data-kba="line" data-index="'+i+'"><span><b>'+e(v.name)+'</b><small>#'+e(v.code)+(v.comment?' · '+e(v.comment):'')+
'</small></span><span>'+v.qty+'</span><strong>'+money(v.price*v.qty)+'</strong></button>';}).join("");
var body='<div id="twkb" class="fl-root fl-billing"><div class="kb-head">'+button('← Tables','floor')+
'<div><small>'+e(selectedName())+' · '+e(section?.name||"")+'</small><h2>'+e(detail())+'</h2></div><b class="kb-mode">'+
(viewing?'VIEWING MODE — 0 TO ADD':'ADD ITEM — CODE OR NAME')+'</b></div>'+
'<div class="kb-shortcuts">'+(viewing?'[Esc / -] Save & Tables &nbsp; [1] Cancel table &nbsp; [3] Shift table &nbsp; [5] Print bill &nbsp; [↑ ↓] Choose &nbsp; [Del] Remove &nbsp; [0] Add item':
'[0] Add new item &nbsp; [Esc / -] '+(cart.length?'Viewing mode':'Back to Tables')+' &nbsp; [↑ ↓] Choose &nbsp; [Enter] Select / Save &nbsp; [5] Print bill')+'</div>'+
(viewing&&kb.step==="list"?
 '<div class="kb-touch-controls kb-touch-view" aria-label="Viewing Mode touch controls">'+
 '<div class="kb-touch-row kb-touch-main">'+button('0 · Add Item','add')+button('Save & Tables','floor')+button('5 · Print Bill','preview')+'</div>'+
 '<div class="kb-touch-row">'+button('1 · Cancel Table','touch-cancel-table')+button('3 · Shift Table','touch-shift')+'</div>'+
 '<div class="kb-touch-row kb-touch-nav">'+button('↑ Previous','touch-up')+button('↓ Next','touch-down')+
 button('Edit Selected','touch-edit')+button('Delete Item','touch-delete')+'</div></div>':'')+
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
'<div class="kb-editor-controls kb-actions">'+button('0 · Add new','add')+button(cart.length?'Esc / - · View':'Esc / - · Tables','view')+'</div>'+
 '<div class="kb-editor-print-control">'+button('5 · Print Bill','preview')+'</div>'+
 '<div class="kb-touch-controls kb-touch-entry" aria-label="Item entry touch controls">'+
 '<div class="kb-touch-row">'+button('Search Menu','touch-search')+
 (kb.step==="qty"?button('Save Item','touch-save'):button('Next · Quantity','touch-lookup'))+'</div></div>'+
 '<p class="kb-help kb-desktop-help">No Tab navigation. Enter moves the keyboard focus automatically.</p></section></div>';
if(kb.step==="search"){
 body+='<div class="kb-overlay"><section class="kb-dialog"><h3>Search Assistant</h3><p>↑ / ↓ to highlight · Enter to choose · Esc / − returns to this table</p>'+
 '<label for="kb-search">Search Code or Item Name</label><input id="kb-search" autocomplete="off" value="'+e(kb.search)+'">'+
 '<div class="kb-touch-controls kb-touch-search">'+button('← Back to Item Code','search-back')+'</div>'+
 '<div class="kb-results" role="listbox" aria-label="Matching menu items">'+(matches().map(function(m,i){var active=i===kb.cursor;
return '<button type="button" role="option" aria-selected="'+active+'" class="'+(active?'kb-on kb-current':'')+
 '" data-kba="choose" data-index="'+i+'"><span><b>'+e(m.name)+'</b><small>#'+e(m.code)+' · '+e(m.category||"")+'</small></span><strong>'+
 money(sectionPrice(m,sectionId))+'</strong></button>';}).join("")||'<p class="kb-empty">No matching items</p>')+'</div></section></div>';
}
if(kb.step==="shift"){
 var targets=shiftTargets();
 body+='<div class="kb-overlay"><section class="kb-dialog" role="dialog" aria-modal="true" aria-label="Shift table">'+
 '<h3>Shift Table</h3><p>Choose an empty table with ↑ / ↓, then press Enter. Esc / - goes back.</p>'+
 '<div class="kb-shift-results" role="listbox" aria-label="Available empty tables">'+
 (targets.length?targets.map(function(t,i){
  var active=i===kb.shiftIndex,sec=(data.sections[selected]||[]).find(function(v){return v.id===t.sectionId;});
  return '<button type="button" role="option" aria-selected="'+active+'" class="kb-shift-row '+(active?'kb-on kb-current':'')+
  '" data-kba="shift-to" data-index="'+i+'">'+e(t.name)+' <small>'+e(sec?.name||"")+'</small></button>';
 }).join(""):'<p class="kb-empty">No empty compatible tables are available.</p>')+
 '</div><div class="kb-actions">'+button('Esc / - · Back','shift-back')+'</div></section></div>';
}
if(kb.step==="cancel"){
 var table=(data.tables[selected]||[]).find(function(t){return t.id===tableId;});
 var tableName=tableDisplayName(table?.name);
 body+='<div class="kb-overlay kb-confirm-overlay"><section class="kb-dialog kb-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="kb-confirm-title" aria-describedby="kb-confirm-copy">'+
 '<div class="kb-confirm-symbol" aria-hidden="true">!</div>'+
 '<div class="kb-confirm-eyebrow">TABLE CANCELLATION</div>'+
 '<h3 id="kb-confirm-title">Cancel '+e(tableName)+'?</h3>'+
 '<p id="kb-confirm-copy">This will remove <strong>all '+cart.length+' item line'+(cart.length===1?"":"s")+
 '</strong> from the current order and release the table. This action cannot be undone.</p>'+
 '<div class="kb-confirm-detail"><span>Table</span><strong>'+e(tableName)+'</strong><span>Order value</span><strong>'+money(total()?.grand||0)+'</strong></div>'+
 '<div class="kb-confirm-actions">'+button('Keep Table · Esc','cancel-back')+
 '<button type="button" class="kb-danger-button" id="kb-cancel-confirm" data-kba="cancel-confirm">Cancel Entire Table · Enter</button></div>'+
 '<p class="kb-confirm-hint">Press Enter to confirm, or Esc / − to keep the order.</p></section></div>';
}
if(kb.step==="shift-confirm"){
 var destination=(data.tables[selected]||[]).find(function(t){return t.id===kb.pendingShiftId;});
 var destinationSection=(data.sections[selected]||[]).find(function(section){return section.id===destination?.sectionId;});
 body+='<div class="kb-overlay kb-confirm-overlay"><section class="kb-dialog kb-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="kb-confirm-title" aria-describedby="kb-confirm-copy">'+
 '<div class="kb-confirm-symbol kb-confirm-symbol-info" aria-hidden="true">₹</div>'+
 '<div class="kb-confirm-eyebrow">PRICE CHANGE</div>'+
 '<h3 id="kb-confirm-title">Apply destination prices?</h3>'+
 '<p id="kb-confirm-copy">Items have different prices in <strong>'+e(destinationSection?.name||"the destination section")+
 '</strong>. Confirm shifting this order to <strong>'+e(destination?.name||"the selected table")+'</strong> with the destination prices.</p>'+
 '<div class="kb-confirm-actions">'+button('Keep Current Prices · Esc','shift-confirm-back')+
 '<button type="button" class="kb-primary-button" id="kb-shift-confirm" data-kba="shift-confirm">Shift & Apply Prices · Enter</button></div>'+
 '<p class="kb-confirm-hint">Press Enter to apply prices, or Esc / − to return to available tables.</p></section></div>';
}
if(kb.step==="preview"){
 body+='<div class="kb-overlay kb-bill-preview-overlay"><section class="kb-dialog kb-bill-preview-dialog" role="dialog" aria-modal="true" aria-label="Bill Preview">'+
 '<h3>Bill Preview</h3><p class="kb-preview-hint">Enter → Instruction on Bill → Discount → Print</p>'+
 '<div id="kb-preview-receipt">'+previewReceipt()+'</div>'+
 '<label for="kb-instruction">Instruction on Bill <small>(optional)</small></label>'+
 '<input id="kb-instruction" maxlength="300" autocomplete="off" value="'+e(kb.instruction)+'" placeholder="Add a bill note, or press Enter to skip">'+
 '<div class="kb-touch-controls kb-touch-preview">'+button('Next · Discount','touch-instruction-next')+'</div>'+
 '<label for="kb-discount">Discount <small>(default % · press / to switch ₹ / %)</small></label>'+
 '<div class="kb-discount-row"><span id="kb-unit">'+(kb.discountType==="percent"?"%":"₹")+
 '</span><input id="kb-discount" type="text" inputmode="decimal" autocomplete="off" value="'+e(kb.discount)+'" placeholder="0"></div>'+
 '<div class="kb-touch-controls kb-touch-preview">'+button('Switch ₹ / %','touch-discount-kind')+
 button('Next · Print','touch-discount-next')+'</div>'+
 '<div class="kb-preview-footer"><div>'+button('F10 · Customer GST','gst')+
 (kb.gstin?' <small>'+e(kb.gstin)+'</small>':'')+'</div>'+
 '<div class="kb-actions">'+button('Back · Esc','cancel')+
 '<button type="button" id="kb-print" data-kba="print">Print Bill · Enter</button></div></div>'+
 '<p class="kb-help">Printing completes the order and releases the table. If a receipt window is blocked, this order stays open.</p></section></div>';
}
if(kb.step==="gst"){
 body+='<div class="kb-overlay"><section class="kb-dialog"><h3>Customer GST details</h3>'+
 '<label for="kb-gstin">GST Number (optional)</label><input id="kb-gstin" autocomplete="off" maxlength="15" value="'+e(kb.gstin)+'">'+
 '<label for="kb-gstname">GST Name (optional)</label><input id="kb-gstname" autocomplete="off" maxlength="120" value="'+e(kb.gstName)+'">'+
 '<div class="kb-actions"><button type="button" data-kba="gst-done" id="kb-gst-done">Save GST details · Enter</button></div></section></div>';
}
return body+'</div>';
}
function previewCalculation(){
 var prior=[discountKind,discountValue,discountReason];
 try{
  discountKind=kb.discount.trim()?kb.discountType:"none";
  discountValue=kb.discount.trim()?kb.discount:"";
  discountReason=kb.discount.trim()?"Bill discount":"";
  return {value:calculatePreview()};
 }catch(ex){return {error:ex.message||"Could not calculate this bill"};}
 finally{discountKind=prior[0];discountValue=prior[1];discountReason=prior[2];}
}
function previewReceipt(){
 var result=previewCalculation();
 if(result.error)return '<div class="kb-receipt-error kb-error">'+e(result.error)+'</div>';
 var p=result.value,section=selSection(),itemRows=(p.lines||[]).map(function(line){
  return '<div class="kb-receipt-item"><div><b>'+e(line.name)+'</b>'+
   '<small>'+line.qty+' × '+money(line.price)+' each</small></div>'+
   '<strong>'+money(line.total)+'</strong></div>';
 }).join("");
 var summary='<div class="kb-receipt-summary">'+
  '<div><span>Subtotal</span><strong>'+money(p.subtotal)+'</strong></div>'+
  '<div><span>Discount</span><strong>−'+money(p.discount)+'</strong></div>'+
  '<div><span>CGST</span><strong>'+money(p.cgst)+'</strong></div>'+
  '<div><span>SGST</span><strong>'+money(p.sgst)+'</strong></div>'+
  (p.roundOff?'<div><span>Round off</span><strong>'+money(p.roundOff)+'</strong></div>':'')+
  '<div class="kb-receipt-grand"><span>Grand total</span><strong id="kb-preview-total">'+money(p.grand)+'</strong></div></div>';
 return '<div class="kb-preview-paper"><div class="kb-preview-paper-heading">'+
  '<strong>'+e(selectedName())+'</strong><span>'+e(section?.name||"")+' · '+e(tableDisplayName(detail()))+'</span></div>'+
  '<div class="kb-preview-paper-body"><div class="kb-preview-paper-heading-row"><span>Item · Qty × Rate</span><span>Amount</span></div>'+
  (itemRows||'<p class="kb-empty">No items in order.</p>')+'</div>'+summary+'</div>';
}
function previewAmount(){
 var calc=previewCalculation();
 return calc.error?'<small class="kb-error">'+e(calc.error)+'</small>':money(calc.value.grand);
}
function refreshPreviewReceipt(){
 var el=document.getElementById("kb-preview-receipt");
 if(el)el.innerHTML=previewReceipt();
}
function refocus(){
 // When the editor is hidden in Viewing Mode, keep focus on the selected order.
 if(kb.mode==="view"&&kb.step==="list"){
  var rows=typeof document.querySelectorAll==="function"?
   document.querySelectorAll('#twkb .kb-lines button[data-kba="line"]'):[];
  var row=rows[kb.selected];
  if(row&&typeof row.focus==="function"){row.focus({preventScroll:true});return;}
 }
if(kb.step==="cancel"||kb.step==="shift-confirm"){
 var confirm=document.getElementById(kb.step==="cancel"?"kb-cancel-confirm":"kb-shift-confirm");
 if(confirm&&typeof confirm.focus==="function"){confirm.focus({preventScroll:true});return;}
}
if(kb.step==="shift"){
 var choices=typeof document.querySelectorAll==="function"?
  document.querySelectorAll('#twkb .kb-shift-results button[data-kba="shift-to"]'):[];
 var target=choices[kb.shiftIndex];
 if(target&&typeof target.focus==="function"){target.focus({preventScroll:true});return;}
}
var id=kb.step==="qty"?"kb-qty":kb.step==="search"?"kb-search":kb.step==="preview"?"kb-instruction":
kb.step==="gst"?"kb-gstin":"kb-code";
var f=document.getElementById(id);if(f){f.focus({preventScroll:true});if(id==="kb-qty")f.select();}
}
// Keep a visible selection while keyboard focus remains on Item Code / Search.
function highlightSelection(kind){
 if(typeof document.querySelectorAll!=="function")return;
 var selector=kind==="search"?'#twkb .kb-results button[data-kba="choose"]':
 kind==="shift"?'#twkb .kb-shift-results button[data-kba="shift-to"]':
 '#twkb .kb-lines button[data-kba="line"]';
 var rows=document.querySelectorAll(selector);
 var selectedIndex=kind==="search"?kb.cursor:kind==="shift"?kb.shiftIndex:kb.selected;
 for(var i=0;i<rows.length;i++){
  var active=i===selectedIndex;
  rows[i].classList.toggle("kb-on",active);
  rows[i].classList.toggle("kb-current",active);
  rows[i].setAttribute("aria-selected",String(active));
  if(active){
   // The visible selected line and actual keyboard focus should match.
   if((kind==="order"||kind==="shift")&&typeof rows[i].focus==="function")rows[i].focus({preventScroll:true});
   if(typeof rows[i].scrollIntoView==="function")rows[i].scrollIntoView({block:"nearest",inline:"nearest"});
  }
 }
}
function paint(){if(!eligible())return;document.getElementById("content").innerHTML=screen();refocus();
 if(kb.step==="search")highlightSelection("search");
 else if(kb.step==="shift")highlightSelection("shift");
 else if(kb.mode==="view"&&kb.step==="list")highlightSelection("order");
}
function reset(){
var key=selected+"|"+sectionId+"|"+tableId+"|"+activeOrderId;
if(key===kb.context)return;
kb.context=key;kb.mode="add";kb.step="code";kb.item=null;kb.edit=-1;kb.selected=0;kb.shiftIndex=0;
kb.discount="";kb.discountType="percent";kb.instruction="";kb.gstin="";kb.gstName="";
}
function enterView(){
 // Empty orders return to Tables. For parcels, Esc is a one-key save-and-return
 // shortcut: the order stays OPEN and must appear in Open Parcel Orders.
 if(!cart.length)return closeEmptyTable();
 if(isCurrentParcel())return returnToTables();
 kb.mode="view";kb.step="list";kb.item=null;kb.edit=-1;
 kb.selected=Math.min(kb.selected,Math.max(cart.length-1,0));paint();
}
function isCurrentParcel(){
 var section=selSection();
 return typeof window.twIsParcelSection==="function"?window.twIsParcelSection(section):
  !!section&&(/^(takeaway|takeout|parcel)$/i.test(String(section.kind||""))||
   /parcel|takeaway/i.test(String(section.name||"")));
}
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
 activeOrderId=order.id;
 order.restaurantId=selected;order.sectionId=sectionId;
 // A pending parcel is never a table; retain its parcel identity across saves.
 if(isCurrentParcel()){order.tableId="";if(!order.label||order.label==="Order")order.label="Parcel";}
 order.cart=JSON.parse(JSON.stringify(cart));order.updatedAt=new Date().toISOString();
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
// Leaving an empty table should release any legacy/saved empty open order
// instead of creating another open order or keeping the table occupied.
function closeEmptyTable(){
 if(cart.length)return enterView();
 var previous=JSON.stringify(data),now=new Date().toISOString();
 var opens=(data.orders||[]).filter(function(o){
  return o.restaurantId===selected&&o.status==="open"&&
   ((activeOrderId&&o.id===activeOrderId)||(tableId&&o.tableId===tableId));
 });
 // Never discard a nonempty saved order just because a stale editor appears empty.
 if(opens.some(function(o){return Array.isArray(o.cart)&&o.cart.length>0;})){
  showToast("This table has a saved order. Reopen it before closing.");return;
 }
 if(opens.length){
  opens.forEach(function(o){
   o.status="void";o.voidAt=now;o.voidReason="Empty table closed";
  });
  data.audit.push({action:"empty_table_closed",restaurantId:selected,
   tableId:tableId,orderId:activeOrderId||opens[0].id,at:now});
  if(!saveTheData(previous)){showToast("Could not release the empty table.");return;}
 }
 // Clear the active selection before navigating, so flBack cannot re-save it.
 cart=[];tableId="";activeOrderId="";kb.context="";
 kb.step="code";kb.mode="add";kb.item=null;kb.edit=-1;
 if(typeof flBack==="function"){
  try{flBack();}catch(err){showToast("Could not open Tables: "+err.message);}
 }
 draw();
}
// Return from Viewing Mode to the existing floor/table selector without billing.
function returnToTables(){
 if(!cart.length)return closeEmptyTable();
 var parcel=isCurrentParcel();
 if(!preserve())return;
 var saved=activeOrderId;
 // Clear the active editor BEFORE invoking the legacy floor navigator. Otherwise
 // the navigator may save the cart again or leave an active parcel invisible.
 cart=[];tableId="";activeOrderId="";
 kb.context="";kb.step="code";kb.mode="add";kb.item=null;kb.edit=-1;
 if(typeof flBack==="function"){
  try{flBack();}catch(err){showToast("Order saved, but could not return to Tables: "+err.message);draw();return;}
 }
 draw();
 if(saved)showToast(parcel?"Parcel saved under Open Parcel Orders.":"Order saved. Table remains occupied until billed or cancelled.");
}
function openPreview(){
 if(!cart.length){showToast("Add at least one item to print.");return;}
 // Every entry, including repeated '5', opens this same itemized preview.
 kb.step="preview";kb.discount="";kb.discountType="percent";kb.instruction="";
 paint();
}
function closePreview(){
 kb.step=kb.mode==="view"?"list":"code";
 paint();
}
function openShift(){
 if(!tableId||selSection()?.kind!=="dine-in"){showToast("Shifting is only available for dine-in tables.");return;}
 if(!shiftTargets().length){showToast("No empty compatible tables are available.");return;}
 kb.shiftIndex=0;kb.step="shift";paint();
}
function shiftTargets(){
 var current=(data.tables[selected]||[]).find(function(t){return t.id===tableId;});
 if(!current)return [];
 var sections=data.sections[selected]||[];
 var openIds=new Set((data.orders||[]).filter(function(o){
  return o.restaurantId===selected&&o.status==="open"&&o.id!==activeOrderId&&o.tableId;
 }).map(function(o){return o.tableId;}));
 return (data.tables[selected]||[]).filter(function(t){
  if(t.id===tableId||t.active===false||openIds.has(t.id))return false;
  var section=sections.find(function(x){return x.id===t.sectionId&&x.active!==false&&x.kind==="dine-in";});
  if(!section)return false;
  // Only show tables whose sections support every current menu item.
  return cart.every(function(line){
   var item=(data.menus[selected]||[]).find(function(m){return m.id===line.id});
   return !!item&&item.active!==false&&sectionPrice(item,t.sectionId)!==null;
  });
 });
}
function shiftTo(index,approved){
 var target=shiftTargets()[index];if(!target){showToast("Selected table is no longer available.");kb.step="list";paint();return;}
 var oldData=JSON.stringify(data),oldCart=JSON.parse(JSON.stringify(cart)),oldTable=tableId,oldSection=sectionId,oldOrder=activeOrderId;
 try{
  // Recheck vacancy immediately before committing the transfer.
  if(data.orders.some(function(o){return o.restaurantId===selected&&o.tableId===target.id&&o.status==="open"&&o.id!==activeOrderId;}))
   throw Error("The destination table is occupied. Choose an empty table.");
  var targetSec=(data.sections[selected]||[]).find(function(t){return t.id===target.sectionId;});
  if(!targetSec||targetSec.active===false||targetSec.kind!=="dine-in")throw Error("Destination section is not available.");
  var changed=oldSection!==target.sectionId;
  var priced=cart.map(function(line){
   var item=(data.menus[selected]||[]).find(function(m){return m.id===line.id&&m.active!==false;});
   var newPrice=sectionPrice(item,target.sectionId);
   if(!item||newPrice===null)throw Error("One of the items is unavailable at the destination.");
   return Object.assign({},line,{price:newPrice});
  });
  if(changed&&priced.some(function(line,i){return line.price!==cart[i].price})&&!approved){
   kb.pendingShiftId=target.id;kb.step="shift-confirm";paint();return;
  }
  var order=(data.orders||[]).find(function(o){return o.id===activeOrderId&&o.status==="open";});
  if(!order&&cart.length){
   order={id:"o"+data.seq++,restaurantId:selected,status:"open",createdAt:new Date().toISOString(),cart:[]};
   data.orders.push(order);
   activeOrderId=order.id;
  }
  if(order){
   order.tableId=target.id;order.sectionId=target.sectionId;order.label=target.name;
   order.cart=JSON.parse(JSON.stringify(priced));order.updatedAt=new Date().toISOString();
  }
  cart=priced;tableId=target.id;sectionId=target.sectionId;
  data.audit.push({action:"table_shifted",restaurantId:selected,orderId:activeOrderId||"",fromTableId:oldTable,toTableId:target.id,at:new Date().toISOString()});
  if(!saveTheData(oldData))throw Error("Could not save table transfer.");
  kb.context=selected+"|"+sectionId+"|"+tableId+"|"+activeOrderId;
  kb.step="list";kb.mode="view";kb.selected=0;paint();
  showToast("Order shifted to "+target.name+".");
 }catch(err){
  data=JSON.parse(oldData);cart=oldCart;tableId=oldTable;sectionId=oldSection;activeOrderId=oldOrder;
  showToast(err.message);kb.step="shift";paint();
 }
}
function cancelTable(){
 kb.step="cancel";paint();
}
function confirmCancelTable(){
 if(kb.step!=="cancel")return;
 var table=(data.tables[selected]||[]).find(function(t){return t.id===tableId;});
 var name=tableDisplayName(table?.name);
 var before=JSON.stringify(data),cancelledAt=new Date().toISOString();
 var cancelledOrders=(data.orders||[]).filter(function(o){
  return o.restaurantId===selected&&o.status==="open"&&
   (o.id===activeOrderId||(tableId&&o.tableId===tableId));
 });
 // Mark every open order for this table inactive, including duplicate/legacy open
 // records, so the floor cannot show it occupied after a successful cancellation.
 cancelledOrders.forEach(function(order){
  order.status="void";order.voidAt=cancelledAt;
  order.voidReason="Cancelled from viewing mode";
 });
 data.audit.push({action:"table_order_cancelled",restaurantId:selected,tableId:tableId,
  orderId:activeOrderId||cancelledOrders[0]?.id||"",at:cancelledAt});
 if(!saveTheData(before)){showToast("Cancellation was not saved.");return;}
 // Clear the active table/cart BEFORE calling flBack. The legacy handler can
 // otherwise re-save the still-present cart as a fresh OPEN order and reoccupy it.
 cart=[];tableId="";activeOrderId="";
 kb.context="";kb.step="code";kb.mode="add";kb.item=null;kb.edit=-1;
 if(typeof flBack==="function"){try{flBack();}catch(err){showToast("Table cancelled, but navigation failed: "+err.message);}}
 draw();showToast(name+" cancelled and released.");
}
function removeHighlighted(){
 if(!cart.length||kb.selected<0||kb.selected>=cart.length)return;
 var old=JSON.parse(JSON.stringify(cart)),removed=cart[kb.selected];
 cart.splice(kb.selected,1);kb.selected=Math.min(kb.selected,cart.length-1);
 if(!preserve()){cart=old;return;}
 kb.step="list";paint();showToast(removed.name+" removed.");
}
function invoice(calc){
var sec=selSection(),table=(data.tables[selected]||[]).find(function(t){return t.id===tableId;}),day=getOpenDay(true);
var open=(data.orders||[]).find(function(order){return order.id===activeOrderId&&order.status==="open";});
var parcel=sec?.kind==="takeaway"&&typeof window.twParcelInvoiceNumber==="function"?
 window.twParcelInvoiceNumber(open,day):"";
var number=parcel||newInvoiceNumber(day);
return {id:"b"+data.seq++,number:number,restaurantId:selected,day:day.date,businessDate:day.date,businessDayId:day.id,time:new Date().toISOString(),
type:sec?.kind||"dine-in",sectionName:sec?.name||"",sectionId:sectionId,tableName:parcel||table?.name||"",
parcelSeq:parcel?open?.parcelSeq:null,parcelDayId:parcel?open?.parcelDayId:null,status:"paid",payments:[],
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
function selectHighlightedLine(){
 var line=cart[kb.selected];if(!line)return;
 var item=menu().find(function(m){return m.id===line.id;})||line;
 pick(item,kb.selected);
}
function touchKey(k,id){
 var input=id?document.getElementById(id):null;
 if(input&&typeof input.focus==="function")input.focus();
 key({key:k,ctrlKey:false,metaKey:false,altKey:false,
  preventDefault:function(){},stopImmediatePropagation:function(){}});
}
function action(name,el){
if(name==="touch-search"){
 kb.mode="add";kb.step="search";kb.search="";kb.cursor=0;paint();return;
}
if(name==="search-back")return closeSearchToTable();
if(name==="touch-lookup")return lookup();
if(name==="touch-save")return saveQty();
if(name==="touch-cancel-table")return cancelTable();
if(name==="touch-shift")return openShift();
if(name==="touch-edit")return selectHighlightedLine();
if(name==="touch-delete")return removeHighlighted();
if(name==="touch-up"||name==="touch-down"){
 if(!cart.length)return;
 kb.selected=(kb.selected+(name==="touch-down"?1:-1)+cart.length)%cart.length;
 highlightSelection("order");return;
}
if(name==="touch-discount-kind"){
 kb.discountType=kb.discountType==="percent"?"amount":"percent";
 var unit=document.getElementById("kb-unit");
 if(unit)unit.textContent=kb.discountType==="percent"?"%":"₹";
 refreshPreviewReceipt();return;
}
if(name==="touch-discount-next")return touchKey("Enter","kb-discount");
if(name==="touch-instruction-next")return touchKey("Enter","kb-instruction");
if(name==="add")return enterAdd();
if(name==="view")return enterView();
if(name==="floor")return returnToTables();
if(name==="shift-to")return shiftTo(Number(el.dataset.index)||0);
if(name==="shift-back"){kb.step="list";paint();return;}
if(name==="cancel-back"){kb.step="list";paint();return;}
if(name==="cancel-confirm")return confirmCancelTable();
if(name==="shift-confirm-back"){kb.pendingShiftId="";kb.step="shift";paint();return;}
if(name==="shift-confirm"){
 var i=shiftTargets().findIndex(function(t){return t.id===kb.pendingShiftId;});
 if(i<0){kb.step="shift";kb.pendingShiftId="";paint();showToast("The destination table is no longer available.");return;}
 return shiftTo(i,true);
}
if(name==="line"){kb.selected=Number(el.dataset.index)||0;kb.mode="view";kb.step="list";paint();return;}
if(name==="choose"){var m=matches()[Number(el.dataset.index)||0];if(m){kb.search="";pick(m,-1);}return;}
if(name==="preview")return openPreview();
if(name==="cancel")return closePreview();
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
 if(k==="Escape"||k==="Esc"||k==="-"||k==="Subtract"||k==="NumpadSubtract"){stop();return closePreview();}
 if(k==="F10"){stop();return action("gst");}
 if(k==="/"&&id==="kb-discount"){
  stop();kb.discountType=kb.discountType==="percent"?"amount":"percent";
  document.getElementById("kb-unit").textContent=kb.discountType==="percent"?"%":"₹";
  refreshPreviewReceipt();return;
 }
 if(k!=="Enter")return;stop();
 if(id==="kb-instruction"){
  kb.instruction=document.getElementById("kb-instruction")?.value||"";
  var discount=document.getElementById("kb-discount");
  discount?.focus();discount?.select();return;
 }
 if(id==="kb-discount"){
  kb.discount=document.getElementById("kb-discount")?.value.trim()||"";
  var result=previewCalculation();
  if(result.error){showToast(result.error);return;}
  refreshPreviewReceipt();return document.getElementById("kb-print")?.focus();
 }
 if(id==="kb-print"){
  kb.instruction=document.getElementById("kb-instruction")?.value||"";
  return printAndComplete();
 }
 return;
}
if(kb.step==="cancel"){
 if(k==="Escape"||k==="Esc"||k==="-"||k==="Subtract"||k==="NumpadSubtract"){stop();kb.step="list";paint();return;}
 if(k==="Enter"){stop();return confirmCancelTable();}
 stop();return;
}
if(kb.step==="shift-confirm"){
 if(k==="Escape"||k==="Esc"||k==="-"||k==="Subtract"||k==="NumpadSubtract"){stop();return action("shift-confirm-back");}
 if(k==="Enter"){stop();return action("shift-confirm");}
 stop();return;
}
if(kb.step==="shift"){
 if(k==="Escape"||k==="Esc"||k==="-"||k==="Subtract"||k==="NumpadSubtract"){stop();kb.step="list";paint();return;}
 if(k==="ArrowDown"||k==="ArrowUp"){stop();
  var opts=shiftTargets();if(opts.length){kb.shiftIndex=(kb.shiftIndex+(k==="ArrowDown"?1:-1)+opts.length)%opts.length;highlightSelection("shift");}
  return;
 }
 if(k==="Enter"){stop();return shiftTo(kb.shiftIndex);}
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
 if(k==="Escape"||k==="Esc"||k==="-"||k==="Subtract"||k==="NumpadSubtract"){stop();return enterView();}
 if(k==="Enter"){stop();return saveQty();}
 return;
}
if(k==="Escape"||k==="Esc"||k==="-"||k==="Subtract"||k==="NumpadSubtract"){
 stop();
 if(!cart.length)return closeEmptyTable();
 return kb.mode==="view"?returnToTables():enterView();
}
if(kb.mode==="view"){
 if(k==="0"){stop();return enterAdd();}
 if(k==="1"){stop();return cancelTable();}
 if(k==="3"){stop();return openShift();}
 if(k==="5"){stop();return openPreview();}
 if(k==="ArrowDown"||k==="ArrowUp"){stop();if(cart.length){
  kb.selected=(kb.selected+(k==="ArrowDown"?1:-1)+cart.length)%cart.length;
  kb.step="list";highlightSelection("order");
 }return;}
 if(k==="Enter"){stop();return selectHighlightedLine();}
 if(k==="Delete"||k==="Backspace"){stop();return removeHighlighted();}
 if(/^[0-9a-z]$/i.test(k)){stop();if(!["0","1","3","5"].includes(k))showToast("Viewing Mode: use 0 to add, 1 to cancel, 3 to shift, or 5 to print.");}
 return;
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
"#twkb .kb-touch-controls{display:none}",
"@media(min-width:761px){#twkb .kb-edit .kb-editor-controls,#twkb .kb-edit .kb-editor-print-control,#twkb .kb-edit .kb-desktop-help{display:none!important}}",
"@media(max-width:760px){#twkb .kb-touch-controls{display:grid;gap:8px;margin:12px 0}#twkb .kb-touch-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}#twkb .kb-touch-row button{min-height:46px;padding:10px 8px;font-size:12px;font-weight:800;border-radius:9px;white-space:normal}#twkb .kb-touch-main{grid-template-columns:repeat(3,minmax(0,1fr))}#twkb .kb-touch-nav{grid-template-columns:repeat(2,minmax(0,1fr))}#twkb .kb-touch-view{margin:8px 0 12px}#twkb .kb-touch-search,#twkb .kb-touch-preview{margin:8px 0}#twkb .kb-touch-row [data-kba=touch-delete],#twkb [data-kba=touch-cancel-table]{border-color:#b35b61;color:#ffd9d7}#twkb .kb-touch-row [data-kba=touch-save],#twkb .kb-touch-row [data-kba=touch-lookup],#twkb .kb-touch-row [data-kba=preview]{background:#126b50;border-color:#32b383}#twkb .kb-editor-print-control button{width:100%}#twkb .kb-editor-controls{display:grid;grid-template-columns:1fr 1fr}#twkb .kb-desktop-help{display:none}}",
"@media(max-width:370px){#twkb .kb-touch-main{grid-template-columns:repeat(2,minmax(0,1fr))}}",
"#twkb .kb-overlay{position:fixed;inset:0;z-index:9500;background:#0a171bdc;padding:5dvh 12px;overflow:auto;display:flex;justify-content:center;align-items:flex-start}",
"#twkb .kb-dialog{background:#1b313a;border:1px solid #53747c;border-radius:13px;padding:22px;width:min(560px,100%);box-shadow:0 15px 50px #0009}",
"#twkb .kb-dialog p{font-size:13px;color:#adcbc1}#twkb .kb-pretotal{display:flex;justify-content:space-between;font-size:18px;background:#0e252e;padding:15px;border-radius:8px}",
"#twkb .kb-bill-preview-overlay{padding-top:3dvh;padding-bottom:3dvh}",
"#twkb .kb-bill-preview-dialog{max-height:94dvh;overflow-y:auto;max-width:650px}",
"#twkb .kb-preview-hint{margin:5px 0 12px}",
"#twkb .kb-preview-paper{background:#10262e;border:1px solid #3f5c65;border-radius:11px;padding:15px 16px}",
"#twkb .kb-preview-paper-heading{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding-bottom:11px;border-bottom:1px dashed #45626a;flex-wrap:wrap}",
"#twkb .kb-preview-paper-heading strong{font-size:15px;color:#ecfff2}#twkb .kb-preview-paper-heading span{font-size:11px;color:#bbd5ce}",
"#twkb .kb-preview-paper-body{max-height:185px;overflow-y:auto;padding:4px 0 8px;border-bottom:1px dashed #45626a}",
"#twkb .kb-preview-paper-heading-row{display:flex;justify-content:space-between;font-size:11px;color:#a5c0b9;padding:6px 0;font-weight:750}",
"#twkb .kb-receipt-item{display:flex;justify-content:space-between;align-items:center;gap:15px;padding:9px 0;border-top:1px solid #29434b}",
"#twkb .kb-receipt-item>div{min-width:0}#twkb .kb-receipt-item b{color:#e8faf1;display:block;font-size:13px;overflow-wrap:anywhere}",
"#twkb .kb-receipt-item small{display:block;color:#a9c6bd;font-size:11px;margin-top:3px}",
"#twkb .kb-receipt-item strong{white-space:nowrap;color:#ecfff6;font-size:13px}",
"#twkb .kb-receipt-summary{display:grid;gap:7px;margin-top:10px}",
"#twkb .kb-receipt-summary>div{display:flex;justify-content:space-between;align-items:center;gap:15px;color:#c3d7d1;font-size:12px}",
"#twkb .kb-receipt-summary strong{color:#f1fff7}",
"#twkb .kb-receipt-summary .kb-receipt-grand{margin-top:5px;padding-top:11px;border-top:1px solid #45626a;font-size:18px;font-weight:800;color:#e4fff0}",
"#twkb .kb-receipt-grand strong{font-size:20px;color:#87edbc}",
"#twkb .kb-receipt-error{border:1px solid #c56b6b;padding:14px;border-radius:9px;background:#402b30}",
"#twkb .kb-bill-preview-dialog label{margin:11px 0 5px}",
"#twkb .kb-bill-preview-dialog input#kb-instruction{min-height:40px}",
"#twkb .kb-bill-preview-dialog .kb-discount-row{display:inline-flex;width:min(185px,100%);align-items:center;gap:7px}",
"#twkb .kb-bill-preview-dialog .kb-discount-row span{min-width:23px;width:23px;font-size:18px}",
"#twkb .kb-bill-preview-dialog .kb-discount-row input{width:calc(100% - 30px);flex:1;min-width:0;min-height:39px;padding:7px 10px}",
"#twkb .kb-preview-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:14px}",
"#twkb .kb-preview-footer .kb-actions{margin:0;min-width:260px;flex:1}",
"#twkb .kb-preview-footer .kb-actions button{min-height:43px}",
"@media(max-width:760px){#twkb .kb-bill-preview-dialog{max-height:90dvh;padding:15px}#twkb .kb-preview-paper{padding:12px}#twkb .kb-preview-paper-body{max-height:32dvh}#twkb .kb-preview-footer{display:block}#twkb .kb-preview-footer .kb-actions{margin-top:12px;min-width:0}}",
"#twkb .kb-results{max-height:55dvh;overflow:auto;margin-top:12px}#twkb .kb-results button{display:flex;justify-content:space-between;gap:10px;width:100%;border:0;border-bottom:1px solid #3b5760;border-radius:0;text-align:left}",
"#twkb .kb-results small{display:block}#twkb .kb-shift-results{max-height:55dvh;overflow:auto;margin-top:12px}",
"#twkb .kb-shift-results button{display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%;text-align:left;border:1px solid #36535d;background:#132f36;color:#f1fff6;margin:6px 0}",
"#twkb .kb-shift-results button.kb-current{background:#16714c!important;border:2px solid #a6ffc0!important}",
"#twkb .kb-confirm-overlay{align-items:center;padding:18px;background:rgba(5,18,23,.78);backdrop-filter:blur(5px)}",
"#twkb .kb-confirm-dialog{width:min(100%,490px);padding:30px;border-radius:18px;background:linear-gradient(145deg,#1c343d,#10252d);border:1px solid #48616a;box-shadow:0 25px 85px rgba(0,0,0,.55)}",
"#twkb .kb-confirm-dialog h3{font-size:24px;line-height:1.2;margin:8px 0 12px;color:#f5fbf8}",
"#twkb .kb-confirm-dialog p{font-size:14px;line-height:1.6;color:#b6cfc8}",
"#twkb .kb-confirm-symbol{display:grid;place-items:center;background:#452d30;border:1px solid #bd656c;color:#f1a2a8;width:44px;height:44px;border-radius:12px;font-size:25px;font-weight:900;margin-bottom:15px}",
"#twkb .kb-confirm-symbol-info{background:#1a413c;border-color:#369b75;color:#adf3ce;font-size:19px}",
"#twkb .kb-confirm-eyebrow{color:#e2aaac;letter-spacing:1.4px;font-size:10px;font-weight:850}",
"#twkb .kb-confirm-detail{display:grid;grid-template-columns:auto 1fr;gap:9px 18px;border-top:1px solid #39535a;border-bottom:1px solid #39535a;margin-top:22px;padding:15px 0;font-size:13px;color:#bed3cd}",
"#twkb .kb-confirm-detail strong{color:#f1fff6;text-align:right}",
"#twkb .kb-confirm-actions{display:flex;gap:10px;margin-top:24px}",
"#twkb .kb-confirm-actions button{flex:1;min-height:47px;border-radius:9px;font-size:12px;white-space:normal}",
"#twkb .kb-confirm-actions .kb-danger-button{background:#ad3643;color:#fff;border:1px solid #c45461}",
"#twkb .kb-confirm-actions .kb-danger-button:hover{background:#c2404f}",
"#twkb .kb-confirm-actions .kb-primary-button{background:#127c5b;color:#fff;border:1px solid #38bb87}",
"#twkb .kb-confirm-dialog .kb-confirm-hint{font-size:11px;color:#9eb9af;margin-top:14px;text-align:center}",
"@media(max-width:480px){#twkb .kb-confirm-dialog{padding:22px 18px}#twkb .kb-confirm-actions{flex-direction:column-reverse}}",
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
if(t.id==="kb-discount"){kb.discount=t.value;refreshPreviewReceipt();}
if(t.id==="kb-instruction")kb.instruction=t.value;},true);
window.addEventListener("keydown",key,true);
// The early Escape guard in index.html calls this before older POS key handlers.
// Main billing modes execute precisely the same action as the minus shortcut.
window.twBillingIsViewing=function(){return kb.mode==="view"&&["list","code","shift","cancel","shift-confirm"].includes(kb.step);};
window.twBillingHandleShortcut=function(name){
 key({key:name,ctrlKey:false,metaKey:false,altKey:false,
  preventDefault:function(){},stopImmediatePropagation:function(){}});
};
window.twBillingHandleEscape=function(){
 window.twBillingHandleShortcut((kb.step==="preview"||kb.step==="gst")?"Escape":"-");
};
var oldDraw=draw;draw=function(){var result=oldDraw.apply(this,arguments);
if(eligible()){reset();document.getElementById("content").innerHTML=screen();refocus();}else kb.context="";
return result;};
// Reopen a pending parcel from its floor card or P-number shortcut. The
// keyboard billing workspace also opens when older floor code cannot render a
// takeaway billing pane from activeOrderId alone.
window.twOpenSavedParcelOrder=function(order){
 if(tab!=="pos"||!order||order.status!=="open"||order.restaurantId!==selected)return false;
 sectionId=order.sectionId;tableId="";activeOrderId=order.id;
 cart=JSON.parse(JSON.stringify(order.cart||[]));
 kb.context="";kb.mode="add";kb.step="code";kb.item=null;kb.edit=-1;kb.selected=0;
 draw();
 if(!eligible()){
  var content=document.getElementById("content");
  if(!content)return false;
  content.innerHTML=screen();
  refocus();
 }
 return current();
};
// Disable the legacy "Confirm changes / Complete bill" dialog inside keyboard billing.
 // Receipt generation is owned only by printAndComplete() from the itemized preview.
 var previousSaveBill=saveBill;
 saveBill=function(){
  if(current()){
   if(kb.step!=="preview")openPreview();
   return;
  }
  return previousSaveBill.apply(this,arguments);
 };
 var oldPrint=printBill;printBill=function(b){if(b&&(b.billInstruction||b.customerGstin)){return printable(b);}
 return oldPrint.apply(this,arguments);};
})();