
/* TABLEWISE_NO_PAYMENT_FIELDS_V1 — do not ask cashiers for payment method. */
(function(){
 "use strict";
 var style=document.createElement("style");
 style.id="tw-no-payment-fields-v1";
 style.textContent=
 '.fl-billing .fl-methods,.fl-billing .fl-split,.fl-billing .fl-cash,'+
 '.fl-billing button[data-fl="payment"],.fl-billing button[data-fl="split"],'+
 '.fl-billing select#payment,.fl-billing #tenderedCash,.fl-billing input[data-split]'+
 '{display:none!important;}';
 document.head.appendChild(style);
 function clean(){
  if(tab!=="pos")return;
  var root=document.querySelector(".fl-billing");
  if(!root)return;
  root.querySelectorAll('.fl-methods,.fl-split,.fl-cash,button[data-fl="payment"],button[data-fl="split"],select#payment,input#tenderedCash,input[data-split]').forEach(function(x){x.remove();});
  root.querySelectorAll("label").forEach(function(label){
    var t=(label.textContent||"").trim().toLowerCase();
    if(!/^(payment method|payment type|cash received|split payment|cash tendered|choose payment)/.test(t))return;
    var group=label.closest(".field,.fl-field,.fl-form-field");
    if(group&&!group.querySelector('button[data-fl="bill"]'))group.remove();
    else label.remove();
  });
 }
 var previousDraw=draw;
 draw=function(){
   var r=previousDraw.apply(this,arguments);
   clean();
   return r;
 };
})();
