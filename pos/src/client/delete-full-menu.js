
/* MENU_DELETE_ALL_GITHUB_V1
 * A restaurant-scoped, guarded destructive control for Menu Management.
 * Items are removed; historical receipts, settings and other restaurants are preserved.
 */
(function(){
  "use strict";
  var twBulkMenuInProgress=false;

  var twBulkMenuStyles=document.createElement("style");
  twBulkMenuStyles.id="tw-bulk-menu-style";
  twBulkMenuStyles.textContent=
    '#tw-delete-full-menu{background:#c62838!important;color:white!important;border:1px solid #a9192a!important;padding:10px 14px;border-radius:9px;font-weight:800;min-height:44px;cursor:pointer;white-space:nowrap}' +
    '#tw-delete-full-menu:hover:not(:disabled){background:#a61f2e!important}' +
    '#tw-delete-full-menu:focus-visible{outline:3px solid #ed8590;outline-offset:2px}' +
    '#tw-delete-full-menu:disabled{opacity:.5;cursor:not-allowed}' +
    '.tw-delete-menu-slot{display:flex;align-items:end;flex:0 0 auto;margin-left:2px}' +
    '@media(max-width:560px){.tw-delete-menu-slot{width:auto;flex:1 1 120px}.tw-delete-menu-slot button{width:100%;font-size:11px;padding:9px 8px}}';
  document.head.appendChild(twBulkMenuStyles);

  function twRenderMenuBulkButton(){
    if(tab!=="menu")return;
    var holder=document.getElementById("content");
    if(!holder)return;
    var menu=holder.querySelector(".mm")||holder;
    var filters=menu.querySelector(".mm-filters");
    var buttons=menu.querySelector(".mm-actions");
    var count=((data.menus&&data.menus[selected])||[]).length;
    var existing=document.getElementById("tw-delete-full-menu");
    if(existing){existing.disabled=count===0||twBulkMenuInProgress;existing.textContent="Delete Full Menu ("+count+")";return;}
    var slot=document.createElement("div");
    slot.className="tw-delete-menu-slot";
    var button=document.createElement("button");
    button.id="tw-delete-full-menu";button.type="button";
    button.className="btn danger";button.disabled=count===0||twBulkMenuInProgress;
    button.textContent="Delete Full Menu ("+count+")";
    button.setAttribute("aria-label","Delete every menu item for the selected restaurant");
    slot.appendChild(button);
    if(filters){
      var categoryField=Array.from(filters.children).find(function(el){
        return /categor/i.test(el.textContent||"")||el.querySelector('select[id*="cat" i],select[name*="cat" i]');
      });
      if(categoryField)categoryField.insertAdjacentElement("afterend",slot);
      else filters.appendChild(slot);
    }else if(buttons){
      buttons.appendChild(slot);
    }else{
      (menu.querySelector(".mm-head")||menu).appendChild(slot);
    }
  }

  var twDrawBeforeBulkMenu=draw;
  draw=function(){
    var result=twDrawBeforeBulkMenu.apply(this,arguments);
    twRenderMenuBulkButton();
    return result;
  };

  window.addEventListener("click",async function(ev){
    var button=ev.target.closest&&ev.target.closest("#tw-delete-full-menu");
    if(!button)return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    if(twBulkMenuInProgress)return;
    if(tab!=="menu")return;
    twBulkMenuInProgress=true;
    button.disabled=true;
    var restaurantId=selected;
    try{
      if(!cloudReady||cloudConflict||cloudBusy){
        uxAlert("Cloud data is not ready to edit. Check the sync status and try again.");
        return;
      }
      var items=(data.menus&&data.menus[restaurantId])||[];
      if(items.length===0){
        showToast("This menu is already empty.");
        return;
      }
      var openOrders=(data.orders||[]).filter(function(order){
        return order.restaurantId===restaurantId&&order.status==="open"&&Array.isArray(order.cart)&&order.cart.length>0;
      });
      if(openOrders.length||cart.length){
        uxAlert("There are unbilled items on an open order. Complete or cancel those orders before deleting the full menu.");
        return;
      }
      var restaurantName=selectedName();
      var count=items.length;
      if(!await uxConfirm("Delete ALL "+count+" menu items from "+restaurantName+"? This cannot be undone. Existing bills and other restaurants will be kept."))return;
      var typed=await uxPrompt('Type DELETE to confirm removing all '+count+' items from '+restaurantName+':',"");
      if(typed===null)return;
      if(String(typed).trim()!=="DELETE"){
        uxAlert("Deletion cancelled. Enter DELETE in uppercase to confirm.");
        return;
      }
      if(selected!==restaurantId||!cloudReady||cloudConflict||cloudBusy){
        uxAlert("The restaurant or cloud state changed. Nothing was deleted. Please try again.");
        return;
      }
      var latest=(data.menus&&data.menus[restaurantId])||[];
      if(latest.length!==count||(data.orders||[]).some(function(order){
        return order.restaurantId===restaurantId&&order.status==="open"&&Array.isArray(order.cart)&&order.cart.length>0;
      })){
        uxAlert("The menu or open orders changed during confirmation. Nothing was deleted.");
        return;
      }
      var before=JSON.stringify(data);
      data.menus[restaurantId]=[];
      if(!Array.isArray(data.audit))data.audit=[];
      data.audit.push({action:"full_menu_deleted",restaurantId:restaurantId,itemCount:count,at:new Date().toISOString()});
      if(!saveTheData(before)){
        uxAlert("Could not save menu deletion. Your previous menu has been restored.");
        return;
      }
      query="";
      category="All";
      draw();
      showToast(count+" menu items removed. Saving the change to the cloud.");
    }catch(error){
      uxAlert("Could not delete the menu: "+(error&&error.message||String(error)));
    }finally{
      twBulkMenuInProgress=false;
      if(tab==="menu")draw();
    }
  },true);
})();
