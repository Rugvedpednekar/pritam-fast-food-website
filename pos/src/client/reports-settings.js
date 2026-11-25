/* Reports now lives under Settings, with existing report logic and exports intact.
   The legacy report workspace remains a routed subview so its date, show, export,
   and selection event handlers continue working as originally implemented. */
(function(){
 "use strict";

 var originalSettings=settings;
 settings=function(){
  var markup=originalSettings.apply(this,arguments);
  var card='<section class="panel tw-settings-report-entry">'+
   '<div class="tw-settings-report-entry-head"><div>'+
   '<h2 class="panel-title">Reports</h2>'+
   '<p class="panel-sub">View sales, choose a date range and export reports without leaving the Settings area.</p>'+
   '</div><button type="button" class="btn primary" data-route="reports">Open Reports</button></div>'+
   '</section>';
  // Insert after the Settings heading and before its first settings card.
  var match=/<(?:div|section)\b[^>]*class="[^"]*\bpanel\b[^"]*"/.exec(markup);
  return match?markup.slice(0,match.index)+card+markup.slice(match.index):markup+card;
 };

 var originalReports=reports;
 reports=function(){
  return '<div class="tw-reports-back"><button type="button" class="btn" data-route="settings" aria-label="Back to Settings">← Back to Settings</button></div>'+
   originalReports.apply(this,arguments);
 };

 var observer=null;
 function detectLightSurfaces(root){
  if(!root||typeof window.getComputedStyle!=="function")return;
  root.querySelectorAll("div,section,article,form,button").forEach(function(el){
   if(el.classList.contains("tw-report-light-surface"))return;
   var color=window.getComputedStyle(el).backgroundColor;
   var rgba=/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s\/]+([\d.]+))?\s*\)$/.exec(color);
   if(!rgba)return;
   var r=Number(rgba[1]),g=Number(rgba[2]),b=Number(rgba[3]),a=rgba[4]===undefined?1:Number(rgba[4]);
   if(r>=225&&g>=225&&b>=225&&a>=0.9)el.classList.add("tw-report-light-surface");
  });
 }
 var originalDraw=draw;
 draw=function(){
  var result=originalDraw.apply(this,arguments);
  var content=document.getElementById("content");
  if(!content)return result;
  var showingReports=tab==="reports";
  content.classList.toggle("tw-settings-reports",showingReports);
  if(observer){observer.disconnect();observer=null;}
  if(showingReports){
   detectLightSurfaces(content);
   if(typeof MutationObserver==="function"){
    observer=new MutationObserver(function(){detectLightSurfaces(content);});
    observer.observe(content,{subtree:true,childList:true});
   }
  }
  return result;
 };
})();
