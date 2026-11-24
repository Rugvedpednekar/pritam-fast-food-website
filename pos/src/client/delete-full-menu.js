
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
    '#tw-menu-bulk-controls{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;padding:13px 16px;margin:0 0 16px;background:#fff;border:1px solid #e7dadd;border-radius:12px}' +
    '#tw-menu-bulk-controls .tw-bulk-description{display:flex;flex-direction:column;gap:4px}' +
    '#tw-menu-bulk-controls strong{color:#293e50;font-size:14px}' +
    '#tw-menu-bulk-controls small{color:#697f8e;font-size:12px;line-height:1.4}' +
    '#tw-delete-full-menu{background:#fff;color:#b4232f;border:1px solid #deb9bd;min-height:42px;padding:10px 14px;border-radius:9px;font-weight:750;cursor:pointer}' +
    '#tw-delete-full-menu:hover:not(:disabled){background:#fff2f3;border-color:#b4232f}' +
    '#tw-delete-full-menu:focus-visible{outline:3px solid #cc444d;outline-offset:2px}' +
    '#tw-delete-full-menu:disabled{opacity:.55;cursor:not-allowed}' +
    '@media(max-width:560px){#tw-menu-bulk-controls{padding:12px;align-items:stretch}#tw-delete-full-menu{width:100%}}';
  document.head.appendChild(twBulkMenuStyles);

  function twRenderMenuBulkButton(){
    if(tab!=="menu")return;
    var holder=document.getElementById("content");
    if(!holder)return;
    var count=((data.menus&&data.menus[selected])||[]).length;
    var existing=document.getElementById("tw-menu-bulk-controls");
    if(existing){
      var current=existing.querySelector("#tw-delete-full-menu");
      if(current){
        current.disabled=count===0||twBulkMenuInProgress;
        current.textContent="Delete Full Menu ("+count+")";
      }
      return;
    }
    var area=document.createElement("section");
    area.id="tw-menu-bulk-controls";
    area.setAttribute("aria-label","Menu bulk actions");
    var details=document.createElement("div");
    details.className="tw-bulk-description";
    var title=document.createElement("strong");title.textContent="Full menu management";
    var description=document.createElement("small");
    description.textContent="Delete all "+count+" menu items from this restaurant only. Existing bills stay unchanged.";
    details.appendChild(title);details.appendChild(description);
    var button=document.createElement("button");
    button.id="tw-delete-full-menu";
    button.type="button";
    button.textContent="Delete Full Menu ("+count+")";
    button.disabled=count===0||twBulkMenuInProgress;
    button.setAttribute("aria-label","Delete all menu items for the selected restaurant");
    area.appendChild(details);area.appendChild(button);
    var heading=holder.querySelector(".heading");
    if(heading&&heading.parentElement===holder)heading.insertAdjacentElement("afterend",area);
    else holder.insertBefore(area,holder.firstChild);
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
