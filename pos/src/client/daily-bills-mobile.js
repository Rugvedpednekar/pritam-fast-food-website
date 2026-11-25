/* Daily bill history and numbering, plus phone-friendly print handoff.
   Historical invoices are retained in the cloud for audit, reports and GST. */
(function(){
 "use strict";
 navnames.reports="Reports";
 function activeBillDay(){
  var existing=data.openDays&&data.openDays[selected];
  return existing&&existing.date||today();
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
  var day=activeBillDay(),daily=dayBills(selected,day);
  return header("Bill History","Today's "+e(pretty(day))+" bills. Numbering restarts at 1 for each restaurant every day.",'')+
   '<div class="panel"><h2 class="panel-title">'+e(selectedName())+' · '+e(pretty(day))+'</h2>'+
   '<p class="panel-sub">'+daily.length+' bill(s) today. Older invoices remain securely stored for reporting and audit.</p>'+
   smallTable(daily,500)+'</div>';
 };
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