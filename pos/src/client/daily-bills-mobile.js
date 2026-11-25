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
 // On mobile, the installed receipt-PDF module is more compatible than the
 // popup-only desktop print flow. Users can open, share and print that PDF.
 var previousPrintBill=printBill;
 printBill=function(b){
  var isMobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent||"");
  if(isMobile&&typeof receiptPDF==="function"){
   try{return receiptPDF(b);}
   catch(error){console.warn("Receipt PDF unavailable; opening printable receipt",error);}
  }
  return previousPrintBill(b);
 };
})();