/* Native phone Back / gesture navigation follows the POS screen hierarchy and ends at Home. */
(function(){
"use strict";
var media=window.matchMedia("(max-width: 760px)");
var initialized=false, replaying=false,lastKey="";
function mode(){
 if(tab==="pos"){
  if(document.querySelector('#content .fl-billing, #content .fl-order'))return "bill";
  return "floor";
 }
 return "page";
}
function current(){return {twAppNavigation:true,tab:tab,view:mode()};}
function keyOf(state){return state.tab+"|"+state.view;}
function record(){
 if(!media.matches||replaying||!cloudReady)return;
 var state=current(),key=keyOf(state);
 if(!initialized){
  initialized=true;
  // The first back gesture on Home stays in Home, rather than leaving the POS.
  history.replaceState({twAppNavigation:true,tab:"dashboard",view:"page"},document.title,location.href);
  history.pushState(state,document.title,location.href);
  lastKey=key;
  return;
 }
 if(key===lastKey)return;
 history.pushState(state,document.title,location.href);
 lastKey=key;
}
var baseDraw=draw;
draw=function(){
 var result=baseDraw.apply(this,arguments);
 record();return result;
};
function sendEscape(){
 var ev=new KeyboardEvent("keydown",{key:"Escape",code:"Escape",bubbles:true,cancelable:true});
 document.dispatchEvent(ev);
}
function returnToFloor(){
 sendEscape();
 if(tab!=="pos")tab="pos";
 if(document.querySelector('#content .fl-billing')&&typeof flBack==="function"){
   try{flBack();}catch(err){console.warn("POS mobile Back fallback:",err.message);}
 }
}
window.addEventListener("popstate",function(event){
 if(!media.matches)return;
 var target=event.state&&event.state.twAppNavigation?event.state:{tab:"dashboard",view:"page"};
 var currentRoute=current();
 var openDialog=document.querySelector("dialog[open]");
 if(openDialog){
   if(typeof openDialog.close==="function")openDialog.close();
   // Closing a modal consumes this Back press; retain the current screen.
   history.pushState(currentRoute,document.title,location.href);
   lastKey=keyOf(currentRoute);
   return;
 }
 replaying=true;
 try{
   document.body.classList.remove("nav-open");
   if(currentRoute.tab==="pos"&&currentRoute.view==="bill"&&target.tab==="pos"&&target.view==="floor"){
     returnToFloor();
   }else if(target.tab==="pos"){
     tab="pos";
     if(target.view==="floor"&&mode()==="bill")returnToFloor();
     draw();
   }else{
     tab=(navnames[target.tab]||target.tab==="dashboard")?target.tab:"dashboard";
     draw();
   }
   lastKey=keyOf(current());
   if(!event.state||!event.state.twAppNavigation){
     // Prevent accidentally exiting the restaurant UI on the first terminal Back.
     tab="dashboard";draw();
     history.replaceState({twAppNavigation:true,tab:"dashboard",view:"page"},document.title,location.href);
     lastKey="dashboard|page";
   }
 }finally{replaying=false;}
});
})();
