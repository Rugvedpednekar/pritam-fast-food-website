/* Daily bill history and numbering, plus phone-friendly print handoff.
   Historical invoices are retained in the cloud for audit, reports and GST. */
(function(){
 "use strict";
 navnames.reports="Reports";
 // Daily history follows each outlet's configured IST business-day cutoff.
 // The live list rolls over immediately at cutoff, without deleting old invoices.
 function activeBillDay(){
  var existing=data.openDays&&data.openDays[selected],cfg=data.branchSettings&&data.branchSettings[selected]||{};
  if(cfg.autoDayEndEnabled===true&&/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(cfg.autoDayEndTime)){
   var now=Date.now(),offset=330*60000,local=new Date(now+offset),parts=cfg.autoDayEndTime.split(":").map(Number);
   var cutoff=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate(),parts[0],parts[1])-offset;
   if(cutoff>now)cutoff-=86400000;
   return new Date(cutoff+offset).toISOString().slice(0,10);
  }
  return existing&&existing.date||today();
 }
 var twBillHistoryMode="today",twBillHistoryDate="",twBillHistoryOutlet="";
 function twBillHistoryDateOf(b){return String(b.businessDate||b.day||"");}
 function twBillHistoryPastDates(current){
  var dates={};
  (data.bills||[]).forEach(function(b){
   var d=twBillHistoryDateOf(b);
   if(b.restaurantId===selected&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&d<current)dates[d]=true;
  });
  return Object.keys(dates).sort().reverse();
 }
 function twBillHistoryRows(day){
  return (data.bills||[]).filter(function(b){return b.restaurantId===selected&&twBillHistoryDateOf(b)===day;});
 }
 // One independent invoice sequence per outlet per business day.
 // The old FY-scoped counters are kept only for legacy invoices.
 newInvoiceNumber=function(day){
  var businessDay=String(day&&day.date||activeBillDay());
  if(!/^\d{4}-\d{2}-\d{2}$/.test(businessDay))throw Error("Business day missing");
  if(!data.invoiceCounters)data.invoiceCounters={};
  var key=selected+":"+businessDay;
  var highest=(data.bills||[]).filter(function(b){
   return b.restaurantId===selected&&(b.businessDate||b.day)===businessDay;
  }).reduce(function(max,b){
   var n=Number(String(b.number||"").trim());
   return Number.isSafeInteger(n)&&n>max?n:max;
  },0);
  var value=Math.max(Number(data.invoiceCounters[key])||0,highest)+1;
  if(!Number.isSafeInteger(value)||value<1)throw Error("Daily bill number overflow");
  data.invoiceCounters[key]=value;
  return String(value);
 };
 bills=function(){
  var current=activeBillDay(),pastDates=twBillHistoryPastDates(current);
  if(twBillHistoryOutlet!==selected){twBillHistoryMode="today";twBillHistoryDate="";twBillHistoryOutlet=selected;}
  if(twBillHistoryMode==="previous"&&pastDates.indexOf(twBillHistoryDate)<0)twBillHistoryDate=pastDates[0]||"";
  var previous=twBillHistoryMode==="previous",day=previous?twBillHistoryDate:current;
  var daily=day?twBillHistoryRows(day):[];
  var buttons='<button type="button" class="btn'+(!previous?' primary':'')+'" data-tw-history="today" aria-pressed="'+(!previous)+'">Current Day</button> '+
   '<button type="button" class="btn'+(previous?' primary':'')+'" data-tw-history="previous" aria-pressed="'+previous+'">Previous Days</button>';
  var caption=previous?"View historical bills by business date. Closed bills are read-only and remain available to print.":
   "Only the current business day's bills are shown. The list clears automatically when a new business day begins.";
  var selector=previous?'<div class="tw-bill-history-filter"><label for="tw-bill-history-date">Select previous business day</label>'+
   '<select id="tw-bill-history-date" class="input" aria-label="Previous bill date"'+(pastDates.length?'':' disabled')+'>'+
   pastDates.map(function(d){return '<option value="'+e(d)+'"'+(d===day?' selected':'')+'>'+e(pretty(d))+'</option>';}).join("")+
   '</select></div>':'';
  var message=!previous?(daily.length?daily.length+' bill(s) for this business day.':"No bills for this business day yet.") :
   (day?daily.length+' saved bill(s) for '+pretty(day)+'.':"No previous-day bills are available yet.");
  return header("Bill History",(previous?"Previous Days · ":"Current Day · ")+e(pretty(current)),buttons)+
   '<div class="panel tw-bill-history-panel"><div class="tw-bill-history-heading"><div><h2 class="panel-title">'+e(selectedName())+' · '+(day?e(pretty(day)):"Previous Days")+'</h2>'+
   '<p class="panel-sub">'+e(caption)+'</p></div>'+selector+'</div>'+
   '<p class="sub">'+e(message)+'</p>'+ (day?smallTable(daily,500):'<div class="empty">There are no older bills to display.</div>')+'</div>';
 };
 if(typeof document.addEventListener==="function"){
  document.addEventListener("click",function(event){
   var target=event.target&&event.target.closest&&event.target.closest("button[data-tw-history]");
   if(!target||tab!=="bills")return;
   event.preventDefault();event.stopImmediatePropagation();
   var next=target.getAttribute("data-tw-history");
   if(next!=="today"&&next!=="previous")return;
   twBillHistoryMode=next;
   if(next==="today")twBillHistoryDate="";
   draw();
  },true);
  document.addEventListener("change",function(event){
   var target=event.target;
   if(tab!=="bills"||!target||target.id!=="tw-bill-history-date")return;
   var allowed=twBillHistoryPastDates(activeBillDay());
   if(allowed.indexOf(target.value)<0)return;
   twBillHistoryDate=target.value;twBillHistoryMode="previous";
   draw();
  },true);
 }
 var twBillHistoryCSS=document.createElement("style");
 twBillHistoryCSS.textContent='.tw-bill-history-heading{display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:14px}.tw-bill-history-heading>div:first-child{min-width:0;flex:1}.tw-bill-history-filter{display:grid;gap:7px;min-width:min(100%,245px)}.tw-bill-history-filter label{font-size:12px;font-weight:750;color:var(--muted)}.tw-bill-history-filter select{width:100%;min-height:44px}@media(max-width:600px){.tw-bill-history-filter{width:100%}.tw-bill-history-heading{align-items:stretch}.heading .quick button[data-tw-history]{flex:1}}';
 document.head.appendChild(twBillHistoryCSS);
 // Print popups often fail on iPhone/Android. Instead, show a printable
 // receipt on the same page with a real tapped Print control.
 var previousPrintBill=printBill;
 printBill=function(b){
  var isMobile=typeof navigator!=="undefined"&&/Android|iPhone|iPad|iPod/i.test(navigator.userAgent||"");
  if(!isMobile)return previousPrintBill(b);
  var prior=document.getElementById("tw-mobile-receipt-preview");
  if(prior)prior.remove();
  var cfg=b.issuer||{},restaurant=data.restaurants.find(function(r){return r.id===b.restaurantId;});
  var title=cfg.legalName||restaurant&&restaurant.name||"Restaurant";
  var lines=(b.items||[]).map(function(item){
   return '<div class="tw-mobile-receipt-line"><span>'+e(item.name)+' × '+Number(item.qty||0)+
    '</span><strong>'+money(item.total===undefined?Number(item.price||0)*Number(item.qty||0):item.total)+'</strong></div>';
  }).join("");
  var backdrop=document.createElement("div");backdrop.id="tw-mobile-receipt-preview";
  var paper='<div class="tw-mobile-receipt-paper"><h2>'+e(title)+'</h2>'+
   '<p>'+e(cfg.address||"")+'</p><p>Bill '+e(b.number)+' · '+e(b.businessDate||b.day)+
   '<br>'+e(b.sectionName||b.type||"")+'</p><hr>'+lines+'<hr>'+
   '<div class="tw-mobile-receipt-line"><span>Subtotal</span><strong>'+money(b.subtotal===undefined?b.total:b.subtotal)+'</strong></div>'+
   '<div class="tw-mobile-receipt-line"><span>Discount</span><strong>'+money(b.discount||0)+'</strong></div>'+
   '<div class="tw-mobile-receipt-line"><span>GST</span><strong>'+money((b.cgst||0)+(b.sgst||0))+'</strong></div>'+
   '<div class="tw-mobile-receipt-line tw-mobile-receipt-total"><span>TOTAL</span><strong>'+money(b.total)+'</strong></div>'+
   '<p>'+e(b.status==="cancelled"?"CANCELLED":cfg.footer||"Thank you!")+'</p>'+
   '<small>DEMO RECEIPT — NOT A VALID TAX INVOICE</small></div>';
  backdrop.innerHTML='<div class="tw-mobile-receipt-card"><h3>Receipt · '+e(title)+'</h3>'+
   paper+'<div class="tw-mobile-receipt-actions">'+
   '<button type="button" id="tw-mobile-receipt-print">Print Receipt</button>'+
   (typeof receiptPDF==="function"?'<button type="button" id="tw-mobile-receipt-pdf">Get Receipt PDF</button>':"")+
   '<button type="button" id="tw-mobile-receipt-close">Close</button></div></div>';
  document.body.appendChild(backdrop);
  backdrop.querySelector("#tw-mobile-receipt-close").onclick=function(){backdrop.remove();};
  backdrop.querySelector("#tw-mobile-receipt-print").onclick=function(){
   try{window.print();}
   catch(error){uxAlert("Phone printing unavailable. Try your browser menu → Share → Print.");}
  };
  var pdfButton=backdrop.querySelector("#tw-mobile-receipt-pdf");
  if(pdfButton)pdfButton.onclick=function(){
   try{receiptPDF(b);}catch(error){uxAlert("Receipt PDF unavailable. Use Print Receipt instead.");}
  };
 };
 var printCSS=document.createElement("style");
 printCSS.textContent="#tw-mobile-receipt-preview{position:fixed;inset:0;z-index:100000;background:#122923bd;overflow:auto;padding:12px;display:flex;align-items:flex-start;justify-content:center}"+
  ".tw-mobile-receipt-card{background:#fff;border-radius:12px;padding:17px;width:min(100%,420px);margin:10px auto}"+
  ".tw-mobile-receipt-paper{font:12px ui-monospace,monospace;color:#152d29;max-width:80mm;margin:16px auto;padding:11px;background:#fff;border:1px solid #d9e6e1}"+
  ".tw-mobile-receipt-paper h2,.tw-mobile-receipt-paper p{text-align:center;margin:8px 0}"+
  ".tw-mobile-receipt-line{display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px dotted #dae4df}"+
  ".tw-mobile-receipt-total{font-size:15px;font-weight:bold}"+
  ".tw-mobile-receipt-actions{display:flex;gap:8px;flex-wrap:wrap}"+
  ".tw-mobile-receipt-actions button{flex:1;min-width:100px;border-radius:7px;border:1px solid #b6d4c7;padding:11px;background:#eef8f3;color:#11523a;font-weight:750}"+
  "@media print{body>*:not(#tw-mobile-receipt-preview){display:none!important}"+
  "#tw-mobile-receipt-preview{position:static!important;background:#fff!important;padding:0!important;display:block!important;overflow:visible!important}"+
  ".tw-mobile-receipt-card{margin:0!important;padding:0!important;box-shadow:none!important}"+
  ".tw-mobile-receipt-card>h3,.tw-mobile-receipt-actions{display:none!important}"+
  ".tw-mobile-receipt-paper{border:none!important;margin:0 auto!important;max-width:80mm!important}}";
 document.head.appendChild(printCSS);
})();