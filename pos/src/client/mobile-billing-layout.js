
/* TABLEWISE_MOBILE_SCROLL_AND_PARCELS_V1
 * UI-only mobile fixes. No changes to orders, bills, menu or payment data.
 */
(function(){
  "use strict";
  var mobileMedia=window.matchMedia("(max-width: 760px)");
  var style=document.createElement("style");
  style.id="tw-mobile-scroll-parcels-v1";
  style.textContent=[
    "@media(max-width:760px){",
    "html,body{height:auto;min-height:100%;overflow-x:hidden;}",
    "body:not(.fl-options-open):not(.fl-printing){overflow-y:auto!important;}",
    ".layout,.main{height:auto!important;max-height:none!important;min-height:0!important;overflow-y:visible!important;}",
    "#content.fl-content{padding-bottom:calc(190px + env(safe-area-inset-bottom))!important;overflow:visible!important;max-height:none!important;min-height:0!important;}",
    ".fl-root,.fl-billing,.fl-columns,.fl-menu,.fl-order,.fl-payment{height:auto!important;max-height:none!important;min-height:0!important;overflow:visible!important;}",
    ".fl-billing{padding-bottom:22px!important;}",
    ".fl-columns{display:flex!important;flex-direction:column!important;min-height:0!important;overflow:visible!important;}",
    ".fl-menu,.fl-order,.fl-payment{width:100%!important;min-width:0!important;flex:none!important;border-right:0!important;}",
    ".fl-menu,.fl-order{border-bottom:1px solid #dce6ed!important;}",
    ".fl-items{max-height:45dvh!important;min-height:0!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior-y:auto!important;touch-action:pan-y!important;}",
    ".fl-lines{max-height:none!important;height:auto!important;min-height:0!important;overflow:visible!important;flex:none!important;touch-action:pan-y!important;}",
    ".fl-order-total,.fl-payment,.fl-totals,.fl-complete{position:static!important;transform:none!important;}",
    ".fl-bill-head,.fl-order,.fl-payment,.fl-parcels{scroll-margin-top:calc(78px + env(safe-area-inset-top));}",
    ".fl-payment{padding-bottom:24px!important;}",
    ".fl-shortcuts{padding-bottom:20px;}",
    ".fl-parcels{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:10px!important;width:100%!important;}",
    ".fl-parcels>button{width:100%!important;min-width:0!important;min-height:64px!important;display:flex!important;flex-wrap:wrap!important;gap:10px!important;align-items:center!important;justify-content:space-between!important;touch-action:manipulation!important;}",
    ".fl-parcels>button strong,.fl-parcels>button b{overflow-wrap:anywhere;}",
    ".fl-root .fl-section.tw-parcel-section{margin-top:18px!important;}",
    ".fl-root .fl-section.tw-parcel-section strong{color:#087a51!important;}",
    ".tw-mobile-pending-button{display:flex;align-items:center;justify-content:center;min-height:44px;padding:10px 14px;border:1px solid #11945c;border-radius:9px;background:#e8f7ee;color:#12633e;font-weight:800;font-size:13px;width:100%;}",
    ".fl-stats .tw-mobile-pending-button{flex:1 1 100%;}",
    "#cartShortcut{bottom:calc(79px + env(safe-area-inset-bottom));}",
    "}",
  ].join("");
  document.head.appendChild(style);

  function mobileUpdate(){
    if(!mobileMedia.matches||tab!=="pos")return;
    var floor=document.querySelector("#content .fl-root:not(.fl-billing)");
    if(!floor)return;
    var parcels=floor.querySelector(".fl-parcels");
    var tableGrid=floor.querySelector(".fl-table-grid");
    if(!parcels||!tableGrid)return;
    var parcelButtons=Array.from(parcels.querySelectorAll('button[data-fl="parcel-open"]'));
    if(!parcelButtons.length)return;
    var parcelTitle=parcels.previousElementSibling;
    var tableTitle=tableGrid.previousElementSibling;
    if(!parcelTitle||!tableTitle||!parcelTitle.classList.contains("fl-section")||!tableTitle.classList.contains("fl-section"))return;
    parcelTitle.classList.add("tw-parcel-section");
    // Keep pending parcels ahead of the dine-in table grid on small screens.
    floor.insertBefore(parcelTitle,tableTitle);
    floor.insertBefore(parcels,tableTitle);
    var stats=floor.querySelector(".fl-stats");
    if(stats&&!stats.querySelector(".tw-mobile-pending-button")){
      var btn=document.createElement("button");
      btn.type="button";
      btn.className="tw-mobile-pending-button";
      btn.textContent="Pending parcel orders ("+parcelButtons.length+")";
      btn.setAttribute("aria-label","Jump to "+parcelButtons.length+" pending parcel orders");
      btn.addEventListener("click",function(){
        parcelTitle.scrollIntoView({behavior:"smooth",block:"start"});
      });
      stats.appendChild(btn);
    }
  }

  var previousDraw=draw;
  draw=function(){
    var result=previousDraw.apply(this,arguments);
    if(mobileMedia.matches)requestAnimationFrame(mobileUpdate);
    return result;
  };
  // Covers browser rotation/resizing without recreating or changing open orders.
  mobileMedia.addEventListener?.("change",function(){
    if(mobileMedia.matches)requestAnimationFrame(mobileUpdate);
  });
})();
