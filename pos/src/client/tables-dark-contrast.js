/* Dark-mode contrast for the Tables & Orders overview only.
   All changes are presentational; order, shortcut and print behavior is untouched. */
(function(){
 "use strict";
 var style=document.createElement("style");
 style.id="tw-tables-orders-dark-contrast";
 style.textContent=`
  html[data-theme="dark"] #content .fl-root:not(.fl-billing) .fl-stats{
   background:transparent!important;
   border:0!important;
   box-shadow:none!important;
   padding:0!important;
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
  /* Remove the broad gray backing panels while retaining individual table
     cards, counters, entry fields, and Parcel/Zomato action buttons. */
  html[data-theme="dark"] #content .fl-root:not(.fl-billing) :is(
    .fl-shortcuts,.fl-lookup,.fl-section,.fl-table-grid,.fl-parcels,
    .tw-table-jump-dark
  ){
   background:transparent!important;
   border-color:transparent!important;
   box-shadow:none!important;
  }
  html[data-theme="dark"] #content .fl-root:not(.fl-billing) .tw-table-jump-dark{
   border:0!important;
  }
  html[data-theme="dark"] #content .fl-root:not(.fl-billing) .fl-section{
   border:0!important;
  }
  /* An occupied dine-in table must be visually green, not the neutral gray
     or amber shades inherited from older POS themes. */
  html[data-theme="dark"] #content .fl-root:not(.fl-billing) .fl-table-grid button.tw-table-occupied,
  html[data-theme="dark"] #content .fl-root:not(.fl-billing) .fl-table-grid button.occupied,
  html[data-theme="dark"] #content .fl-root:not(.fl-billing) .fl-table-grid button[data-status="occupied"]{
   background:#17684f!important;
   color:#f4fff8!important;
   border:1px solid #47b78e!important;
   box-shadow:inset 0 0 0 1px #236b56!important;
  }
  html[data-theme="dark"] #content .fl-root:not(.fl-billing) .fl-table-grid button.tw-table-occupied :is(strong,b,span,small,div,p){
   color:#f0fff8!important;
   opacity:1!important;
  }
  html[data-theme="dark"] #content .fl-root:not(.fl-billing) .fl-table-grid button.tw-table-occupied:hover{
   background:#218366!important;
   border-color:#6cd6ad!important;
  }
  /* Only the three requested instructional lines are removed. */
  #content .fl-root:not(.fl-billing) .tw-unwanted-pos-hint{
   display:none!important;
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
 function updateFloorTables(){
  if(tab!=="pos")return;
  var floor=document.querySelector("#content .fl-root:not(.fl-billing)");
  if(!floor)return;
  var grid=typeof floor.querySelector==="function"?floor.querySelector(".fl-table-grid"):null;
  if(grid){
   var buttons=grid.querySelectorAll("button");
   for(var i=0;i<buttons.length;i++){
    var button=buttons[i];
    // The POS already displays "Occupied" for tables holding open orders.
    // Use that existing status rather than changing any order state.
    var occupied=/\boccupied\b/i.test(button.textContent||"")||
      button.classList.contains("occupied")||
      button.getAttribute("data-status")==="occupied";
    button.classList.toggle("tw-table-occupied",occupied);
   }
  }
  var unwanted=[
   /^white\s*=\s*available\s*[·•.\-]\s*green\s*=\s*open\s+order$/i,
   /^resume\s+any\s+saved\s+parcel$/i,
   /^type\s+table\s+number\s*\+\s*enter\s*[·•.\-]\s*press\s*p\s+for\s+parcel$/i
  ];
  // Match the entire instruction in its smallest enclosing element; this
  // keeps DINE-IN / OPEN PARCEL ORDERS headings and the editable input.
  var candidates=floor.querySelectorAll("small,p,span,div,label");
  for(var j=0;j<candidates.length;j++){
   var el=candidates[j];
   if(el.classList.contains("tw-unwanted-pos-hint"))continue;
   var content=(el.textContent||"").replace(/\s+/g," ").trim();
   if(!unwanted.some(function(rule){return rule.test(content);}))continue;
   if(el.querySelector("input,button,select,textarea"))continue;
   el.classList.add("tw-unwanted-pos-hint");
  }
 }
 var beforeDraw=draw;
 draw=function(){
  var result=beforeDraw.apply(this,arguments);
  markTableNumberRow();
  updateFloorTables();
  return result;
 };
 markTableNumberRow();
 updateFloorTables();
})();
