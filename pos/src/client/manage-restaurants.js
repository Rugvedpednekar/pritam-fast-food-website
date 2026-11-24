/* Restaurant management — safe add / archive / restore. */
(function(){
"use strict";
function eligible(){return cloudReady&&!cloudConflict&&!cloudBusy&&!cloudPending;}
function activeRestaurants(){return data.restaurants.filter(function(r){return r.active!==false;});}
var oldSettings=settings;
settings=function(){
 var result=oldSettings.apply(this,arguments);
 var html='<section class="panel" id="tw-restaurants-panel" style="margin-top:18px"><div class="table-toolbar"><div><h2 class="panel-title">Manage Restaurants</h2><p class="panel-sub">Add restaurants, or remove one from the active workspace without deleting its bills or staff data.</p></div><button type="button" class="btn primary" data-tw-restaurant="add">+ Add Restaurant</button></div>';
 html+='<div class="tw-rest-rows">'+data.restaurants.map(function(r){
  var active=r.active!==false;
  return '<div class="metric-row" style="gap:10px;flex-wrap:wrap"><span>'+e(r.name)+' <small>'+(active?'Active':'Removed (archived)')+'</small></span><div class="quick">'+(active?'<button class="btn small danger" data-tw-restaurant="archive" data-id="'+e(r.id)+'">Remove</button>':'<button class="btn small" data-tw-restaurant="restore" data-id="'+e(r.id)+'">Restore</button>')+'</div></div>';
 }).join("")+'</div><p class="sub" style="margin-top:12px">Removed restaurants are archived, not erased. Past bills, menus, staff and audit data stay available if restored.</p></section>';
 return result+html;
};
document.addEventListener("click",async function(ev){
 var btn=ev.target.closest&&ev.target.closest("button[data-tw-restaurant]");
 if(!btn)return;
 ev.preventDefault();ev.stopImmediatePropagation();
 if(tab!=="settings"||!eligible()){uxAlert("Open Settings and finish cloud synchronization before changing restaurants.");return;}
 var action=btn.dataset.twRestaurant,restaurant=data.restaurants.find(function(r){return r.id===btn.dataset.id;});
 if(action==="add"){
   if(data.restaurants.length>=50){uxAlert("Maximum 50 restaurant records, including archived ones.");return;}
   var name=await uxPrompt("Enter the new restaurant name","");
   if(name===null)return;name=String(name).trim().slice(0,80);
   if(!name){uxAlert("Restaurant name cannot be empty.");return;}
   if(data.restaurants.some(function(r){return r.name.trim().toLowerCase()===name.toLowerCase();})){uxAlert("A restaurant with that name already exists. Restore an archived one instead.");return;}
   if(!eligible())return uxAlert("Cloud synchronization changed. Try again.");
   var before=JSON.stringify(data),id="r"+Date.now().toString(36)+Math.floor(Math.random()*1679616).toString(36);
   if(data.restaurants.some(function(r){return r.id===id;}))return uxAlert("Could not generate a unique restaurant ID. Please retry.");
   data.restaurants.push({id:id,name:name,active:true});
   data.menus[id]=[];
   ensureReferenceModel();
   if(!Array.isArray(data.audit))data.audit=[];
   data.audit.push({action:"restaurant_added",restaurantId:id,at:new Date().toISOString()});
   if(!saveTheData(before))return;
   selected=id;cart=[];activeOrderId="";sectionId="";tableId="";ensureReferenceModel();draw();
   showToast("Added "+name+"; settings and tables are ready.");
   return;
 }
 if(!restaurant)return;
 if(action==="archive"){
   if(restaurant.active===false)return;
   if(activeRestaurants().length<=1)return uxAlert("At least one restaurant must remain active.");
   if((data.orders||[]).some(function(o){return o.restaurantId===restaurant.id&&o.status==="open";}))return uxAlert("Complete or void open table/parcel orders before removing this restaurant.");
   if(selected===restaurant.id&&cart.length)return uxAlert("Finish or discard the current bill before removing this restaurant.");
   if(!await uxConfirm('Remove "'+restaurant.name+'" from the active workspace? Historical bills, menus and staff will be kept and it can be restored.'))return;
   if(!eligible())return uxAlert("Cloud changed during confirmation. Retry.");
   var old=JSON.stringify(data);
   restaurant.active=false;
   if(!Array.isArray(data.audit))data.audit=[];
   data.audit.push({action:"restaurant_archived",restaurantId:restaurant.id,at:new Date().toISOString()});
   if(!saveTheData(old))return;
   if(selected===restaurant.id){selected=activeRestaurants()[0].id;cart=[];activeOrderId="";tableId="";sectionId="";ensureReferenceModel();}
   draw();showToast("Restaurant removed from the workspace. You can restore it in Settings.");
   return;
 }
 if(action==="restore"){
   if(restaurant.active!==false)return;
   var old2=JSON.stringify(data);
   restaurant.active=true;
   if(!Array.isArray(data.audit))data.audit=[];
   data.audit.push({action:"restaurant_restored",restaurantId:restaurant.id,at:new Date().toISOString()});
   if(!saveTheData(old2))return;
   draw();showToast(restaurant.name+" restored.");
 }
},true);
})();