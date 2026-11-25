/* Permanently delete restaurants through a server transaction; no restore option. */
(function(){
 "use strict";
 function eligible(){return cloudReady&&!cloudConflict&&!cloudBusy&&!cloudPending;}
 function activeRestaurants(){return data.restaurants.filter(function(r){return r.active!==false;});}
 var oldSettings=settings;
 settings=function(){
  var result=oldSettings.apply(this,arguments);
  var markup='<section class="panel" id="tw-restaurants-panel" style="margin-top:18px"><div class="table-toolbar"><div><h2 class="panel-title">Manage Restaurants</h2><p class="panel-sub">Add restaurants or permanently delete an outlet and all its saved records. Deleted restaurants cannot be restored.</p></div><button type="button" class="btn primary" data-tw-restaurant="add">+ Add Restaurant</button></div>';
  markup+='<div class="tw-rest-rows">'+data.restaurants.map(function(r){
   return '<div class="metric-row" style="gap:10px;flex-wrap:wrap"><span>'+e(r.name)+' <small>'+(r.active===false?'Previously archived · delete to erase':'Active')+'</small></span><div class="quick"><button class="btn small danger" data-tw-restaurant="delete" data-id="'+e(r.id)+'">Delete Restaurant</button></div></div>';
  }).join("")+'</div><p class="sub" style="margin-top:12px">Permanent deletion erases this outlet’s bills, menu, sections, tables, orders, history and associated employee data. No Restore option is available. Download any records you need before deletion.</p></section>';
  return result+markup;
 };
 document.addEventListener("click",async function(ev){
  var btn=ev.target.closest&&ev.target.closest("button[data-tw-restaurant]");
  if(!btn)return;
  ev.preventDefault();ev.stopImmediatePropagation();
  if(tab!=="settings"||!eligible()){uxAlert("Open Settings and finish cloud synchronization before changing restaurants.");return;}
  var action=btn.dataset.twRestaurant,restaurant=data.restaurants.find(function(r){return r.id===btn.dataset.id;});
  if(action==="add"){
   if(data.restaurants.length>=50){uxAlert("Maximum 50 restaurants. Delete an unused restaurant to free a slot.");return;}
   var name=await uxPrompt("Enter the new restaurant name","");
   if(name===null)return;name=String(name).trim().slice(0,80);
   if(!name){uxAlert("Restaurant name cannot be empty.");return;}
   if(data.restaurants.some(function(r){return r.name.trim().toLowerCase()===name.toLowerCase();})){uxAlert("This restaurant name is already in use.");return;}
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
  if(action!=="delete"||!restaurant)return;
  if(restaurant.active!==false&&activeRestaurants().length<=1)return uxAlert("At least one active restaurant must remain.");
  if(selected===restaurant.id&&cart.length)return uxAlert("Finish or discard the current unsaved bill before deleting this restaurant.");
  var name=restaurant.name;
  if(!await uxConfirm('Permanently delete "'+name+'"? ALL its bills, menus, settings, tables, orders, history and employee records will be erased. THIS CANNOT BE UNDONE.'))return;
  var typed=await uxPrompt('FINAL CONFIRMATION: To permanently erase '+name+' and all its data, type DELETE:','');
  if(typed===null)return;
  if(typed!=="DELETE")return uxAlert("Deletion cancelled. Type DELETE in uppercase to confirm.");
  if(!eligible()||!data.restaurants.some(function(r){return r.id===restaurant.id&&r.name===name}))return uxAlert("Restaurant state changed. Reload and try again.");
  btn.disabled=true;
  try{
   var response=await cloudReq("/api/restaurants/delete",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({restaurantId:restaurant.id,version:cloudVersion,confirmation:typed,employeeIds:typeof window.twLocalRestaurantPayrollIds==="function"?window.twLocalRestaurantPayrollIds(restaurant.id,restaurant.name):[]})
   });
   if(!response.ok){
    if(response.status===409){cloudConflict=true;cloudStatus("Sync conflict ⚠",true);}
    return uxAlert(response.body.error||"Could not delete this restaurant.");
   }
   cloudVersion=response.body.version;data=response.body.state;
   if(!data.restaurants.some(function(r){return r.id===selected&&r.active!==false;}))selected=activeRestaurants()[0].id;
   cart=[];activeOrderId="";sectionId="";tableId="";category="All";ensureReferenceModel();
   try{localStorage.setItem(KEY,JSON.stringify(data));}catch(err){uxAlert("Cloud deletion succeeded, but browser storage could not update. Refresh the page.");}
   if(typeof window.twPurgeDeletedRestaurant==="function")window.twPurgeDeletedRestaurant(response.body.removed);
   cloudStatus("Cloud synced ✓");draw();showToast(name+" permanently deleted. All linked data has been erased.");
  }catch(error){uxAlert("Deletion failed: "+(error&&error.message||String(error)));}
  finally{btn.disabled=false;}
 },true);
})();
