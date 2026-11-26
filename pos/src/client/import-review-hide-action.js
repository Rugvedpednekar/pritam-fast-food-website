/* Hide the Action column ONLY in the Excel menu "Review import" preview.
   The import/apply logic and every other menu or reporting table are unchanged. */
(function(){
 "use strict";
 const CLASS_NAME="tw-import-review-no-action";

 function isReviewHeading(el){
  return /^Review import\b/i.test((el.textContent||"").trim());
 }
 function actionColumnIndex(table){
  var columns=Array.from(table.querySelectorAll("thead tr:first-child > th, thead tr:first-child > td"));
  if(!columns.length){
   var first=table.querySelector("tr");
   if(first)columns=Array.from(first.children||[]).filter(function(c){
    return c.tagName==="TH"||c.tagName==="TD";
   });
  }
  return columns.findIndex(function(c){return (c.textContent||"").trim().toLowerCase()==="action";});
 }
 function reviewTableFor(heading){
  var root=heading.parentElement;
  // Prefer the smallest enclosing panel; do not change unrelated tables.
  while(root&&root!==document.body){
   var tables=root.querySelectorAll("table");
   for(var i=0;i<tables.length;i++)if(actionColumnIndex(tables[i])>=0)return tables[i];
   root=root.parentElement;
  }
  return null;
 }
 function update(){
  var titles=document.querySelectorAll("h1,h2,h3,h4,h5,h6");
  for(var i=0;i<titles.length;i++){
   if(!isReviewHeading(titles[i]))continue;
   var table=reviewTableFor(titles[i]);
   if(!table)return;
   var index=actionColumnIndex(table);
   if(index<0)return;
   if(!table.classList.contains(CLASS_NAME))table.classList.add(CLASS_NAME);
   // Re-apply to newly rendered rows, without changing unrelated tables.
   table.querySelectorAll("tr").forEach(function(row){
    var cell=row.children[index];
    if(cell&&(cell.tagName==="TD"||cell.tagName==="TH"))cell.classList.add("tw-import-review-action-cell");
   });
   return;
  }
 }

 var style=document.createElement("style");
 style.id="tw-import-review-hide-action-style";
 style.textContent="table."+CLASS_NAME+" .tw-import-review-action-cell{display:none!important}"+
  "table."+CLASS_NAME+"{width:100%}";
 document.head.appendChild(style);
 update();
 if(typeof MutationObserver==="function"){
  new MutationObserver(function(mutations){
   // Only react to new table/content nodes, not to our own class/style changes.
   if(mutations.some(function(m){return m.type==="childList"&&m.addedNodes.length;}))update();
  }).observe(document.body,{childList:true,subtree:true});
 }
 document.addEventListener("DOMContentLoaded",update,{once:true});
})();
