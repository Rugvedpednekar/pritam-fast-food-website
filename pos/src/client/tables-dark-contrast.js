/* Dark-mode contrast for the Tables & Orders overview only.
   All changes are presentational; order, shortcut and print behavior is untouched. */
(function(){
 "use strict";
 var style=document.createElement("style");
 style.id="tw-tables-orders-dark-contrast";
 style.textContent=`
  html[data-theme="dark"] #content .fl-root:not(.fl-billing) .fl-stats{
   background:#1b2d35!important;
   border-color:#36515a!important;
  }
  html[data-theme="dark"] #content .fl-root:not(.fl-billing) .fl-stats > :not(.tw-pos-quick-actions):not(.tw-pos-action-btn):not(.tw-new-zomato){
   background:#233942!important;
   color:#e6f4f0!important;
   border:1px solid #46646d!important;
   box-shadow:none!important;
  }
  html[data-theme="dark"] #content .fl-root:not(.fl-billing) .fl-stats > :not(.tw-pos-quick-actions):not(.tw-pos-action-btn):not(.tw-new-zomato) :is(strong,b,[class*="value"],[class*="number"],[class*="count"]){
   color:#ffffff!important;
   opacity:1!important;
  }
  html[data-theme="dark"] #content .fl-root:not(.fl-billing) .fl-stats > :not(.tw-pos-quick-actions):not(.tw-pos-action-btn):not(.tw-new-zomato) :is(span,small,[class*="label"]){
   color:#c9dce0!important;
   opacity:1!important;
  }
  html[data-theme="dark"] #content .fl-root:not(.fl-billing) .fl-stats > :not(.tw-pos-quick-actions):not(.tw-pos-action-btn):not(.tw-new-zomato) *{
   text-shadow:none!important;
  }
  html[data-theme="dark"] #content .fl-root:not(.fl-billing) .tw-table-jump-dark{
   background:#1b2d35!important;
   color:#eaf7f1!important;
   border:1px solid #36515a!important;
   box-shadow:none!important;
  }
  html[data-theme="dark"] #content .fl-root:not(.fl-billing) .tw-table-jump-dark :is(label,span,small,p,[class*="hint"],[class*="label"]){
   color:#c6dadf!important;
   opacity:1!important;
  }
  html[data-theme="dark"] #content .fl-root:not(.fl-billing) .tw-table-jump-dark input{
   background:#11242c!important;
   color:#f2fff8!important;
   border:1px solid #52737b!important;
   caret-color:#7af0c8!important;
   opacity:1!important;
  }
  html[data-theme="dark"] #content .fl-root:not(.fl-billing) .tw-table-jump-dark input::placeholder{
   color:#b5ced4!important;
   opacity:1!important;
  }
  html[data-theme="dark"] #content .fl-root:not(.fl-billing) .tw-table-jump-dark input:focus{
   border-color:#72dfbd!important;
   outline:2px solid #40bc99!important;
   outline-offset:1px!important;
  }
  html[data-theme="dark"] #content .fl-root:not(.fl-billing) .tw-table-jump-dark kbd{
   background:#263f48!important;
   color:#edf8f4!important;
   border:1px solid #59747b!important;
  }
  @media(max-width:760px){
   html[data-theme="dark"] #content .fl-root:not(.fl-billing) .fl-stats > :not(.tw-pos-quick-actions):not(.tw-pos-action-btn):not(.tw-new-zomato){
    min-height:48px;
   }
   html[data-theme="dark"] #content .fl-root:not(.fl-billing) .tw-table-jump-dark{
    min-width:0;
   }
  }
 `;
 document.head.appendChild(style);

 function markTableNumberRow(){
  if(tab!=="pos")return;
  var floor=document.querySelector("#content .fl-root:not(.fl-billing)");
  if(!floor)return;
  var inputs=floor.querySelectorAll('input');
  for(var i=0;i<inputs.length;i++){
   var input=inputs[i];
   var hint=(input.getAttribute("placeholder")||"")+" "+(input.getAttribute("aria-label")||"");
   var likely=/\btable\s*(?:number|no\.?)/i.test(hint)||/^\s*1\s*,\s*2\s*,\s*3/i.test(hint);
   if(!likely)continue;
   var parent=input.parentElement;
   for(var depth=0;parent&&parent!==floor&&depth<5;parent=parent.parentElement,depth++){
    var text=(parent.textContent||"").trim();
    if(/table\s*(?:number|no\.?)/i.test(text)&&
       parent.querySelectorAll("input").length===1){
     parent.classList.add("tw-table-jump-dark");
     return;
    }
   }
   // Legacy layout may place the label outside the input wrapper.
   var fallback=input.closest(".fl-shortcuts,.fl-lookup,.fl-jump,.fl-number-entry,.fl-table-jump");
   if(fallback){fallback.classList.add("tw-table-jump-dark");return;}
  }
 }
 var beforeDraw=draw;
 draw=function(){
  var result=beforeDraw.apply(this,arguments);
  markTableNumberRow();
  return result;
 };
 markTableNumberRow();
})();
