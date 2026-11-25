/* Employee outlet transfers: a single transfer workflow (no transfer types).
   Nested inside payroll-bonus-list.js to share bonus ledger functions. */
(function(){
"use strict";
var tpTransferOpenId=null;
function tpTransferHistoryFor(emp){
 var person=tpArcPersonId(emp);
 return (tpData.transfers||[]).filter(function(t){return t.personId===person;})
  .slice().sort(function(a,b){return String(a.date).localeCompare(String(b.date));});
}
function tpTransferEffectiveDate(){
 return tpBonusMonthShift(tpMonth(0),1)+"-01";
}
function tpTransferAssignedId(period,restaurantId,excludeId){
 var taken=new Set(Object.keys(period.serials||{}).filter(function(id){
  var emp=tpEmp(id);
  return emp&&id!==excludeId&&emp.active!==false&&emp.left!==true&&
   tpSameRestaurant(emp,{restaurantId:restaurantId,restaurant:(data.restaurants||[]).find(function(r){return r.id===restaurantId;})?.name||""});
 }).map(function(id){return tpSerialValue(period.serials[id]);}));
 var next=1;while(taken.has(next))next++;
 return next;
}
function tpTransferActivatePending(){
 var changed=false;
 tpData.employees.forEach(function(emp){
  var pending=emp.pendingTransfer;
  if(!pending||pending.date>tpToday()||emp.active===false||emp.left)return;
  var destination=(data.restaurants||[]).find(function(r){return r.id===pending.toRestaurantId&&r.active!==false;});
  if(!destination)return;
  var month=pending.date.slice(0,7),period=tpGetPeriod(month);
  // Never move a month with attendance already recorded under the previous
  // outlet; it would make the bonus ledger misattribute past workdays.
  if(tpInputDays(period.days[emp.id])!==null)return;
  var oldRestaurant=emp.restaurant,oldId=emp.restaurantId||tpResolveRestaurantId(oldRestaurant,emp);
  var previousMonth=tpBonusMonthShift(month,-1);
  var previousCode=tpSerialValue(tpGetPeriod(previousMonth).serials[emp.id]);
  var nextCode=tpTransferAssignedId(period,destination.id,emp.id);
  emp.restaurant=destination.name;emp.restaurantId=destination.id;
  period.serials[emp.id]=nextCode;period.updatedAt=tpStamp();
  delete emp.pendingTransfer;
  var transfer=(tpData.transfers||[]).find(function(t){return t.id===pending.transferId;});
  if(transfer){
   transfer.status="Completed";transfer.fromMonthlyId=previousCode;
   transfer.toMonthlyId=nextCode;transfer.appliedAt=tpStamp();
  }else{
   if(!Array.isArray(tpData.transfers))tpData.transfers=[];
   tpData.transfers.push({id:pending.transferId,personId:tpArcPersonId(emp),
    employeeId:emp.id,date:pending.date,fromRestaurant:oldRestaurant,
    fromRestaurantId:oldId,toRestaurant:destination.name,toRestaurantId:destination.id,
    fromMonthlyId:previousCode,toMonthlyId:nextCode,status:"Completed",appliedAt:tpStamp()});
  }
  changed=true;
 });
 if(changed)tpSave();
}
function tpTransferAvailableOutlets(emp){
 var key=emp.restaurantId||tpResolveRestaurantId(emp.restaurant,emp);
 return (data.restaurants||[]).filter(function(outlet){
  return outlet.active!==false&&(key?outlet.id!==key:String(outlet.name||"")!==String(emp.restaurant||""));
 });
}
function tpTransferForm(emp){
 var available=tpTransferAvailableOutlets(emp),date=tpTransferEffectiveDate(),
     options=available.map(function(r){return '<option value="'+tpEscape(r.id)+'">'+tpEscape(r.name)+'</option>';}).join("");
 return '<section class="tp-panel tp-transfer-panel" id="tp-transfer-panel">'+
 tpToolbar("Transfer Employee — "+tpEscape(emp.name),
  "Transfers happen only between months. No temporary/permanent choices and no split-month attendance.","")+
 '<form id="tp-transfer-form" class="tp-form" data-id="'+tpEscape(emp.id)+'">'+
 '<div class="tp-form-grid">'+
 '<div class="tp-field"><label>Current outlet</label><strong>'+tpEscape(emp.restaurant)+'</strong></div>'+
 '<div class="tp-field"><label for="tp-transfer-outlet">Destination outlet *</label>'+
 '<select id="tp-transfer-outlet" required><option value="">Select destination outlet</option>'+options+'</select>'+
 '<small class="tp-transfer-destinations">'+(available.length?
  'Available: '+available.map(function(r){return tpEscape(r.name);}).join(" · "):
  'No other active outlets configured.')+'</small></div>'+
 '<div class="tp-field"><label>Transfer takes effect</label><strong>'+tpDate(date)+'</strong>'+
 '<small>First day of the next calendar month</small></div></div>'+
 '<p class="tp-note">All workdays and monthly IDs remain with the current outlet through the end of this month. On '+tpDate(date)+
 ', the employee moves to the destination outlet and gets an available monthly ID there. Nothing is split across outlets within a month.</p>'+
 '<div class="tp-actions"><button type="submit" class="tp-button tp-primary"'+(!available.length?' disabled':'')+
 '>Schedule Transfer</button>'+tpButton("cancel-transfer","Cancel","tp-light")+'</div></form></section>';
}
var tpTransferPreviousProfile=tpEmployeeProfile;
tpEmployeeProfile=function(emp){
 var html=tpTransferPreviousProfile(emp);
 if(!emp)return html;
 if(emp.active!==false&&!emp.left){
  html=html.replace('<div class="tp-profile-menu">',
   '<div class="tp-profile-menu">'+
   tpButton("transfer-employee","Transfer Employee","tp-light",'data-id="'+tpEscape(emp.id)+'"'));
 }
 var history=tpTransferHistoryFor(emp),rows=history.map(function(t){
  return '<tr><td>'+tpDate(t.date)+'</td><td>'+tpEscape(t.fromRestaurant)+'</td>'+
   '<td>'+tpEscape(t.toRestaurant)+'</td>'+
   '<td>'+(t.fromMonthlyId==null?"—":t.fromMonthlyId)+'</td>'+
   '<td>'+(t.toMonthlyId==null?"On transfer":t.toMonthlyId)+'</td>'+
   '<td>'+tpEscape(t.status||"Completed")+'</td></tr>';
 });
 var extra='<div class="tp-transfer-history"><h3>Outlet Transfer History</h3>'+
  (rows.length?tpTable(["Effective date","From outlet","To outlet","Previous ID","New ID","Status"],rows):
   '<p class="tp-note">No outlet transfers have been recorded.</p>')+
  '</div>'+
   (emp.pendingTransfer?'<p class="tp-note"><strong>Transfer scheduled:</strong> '+tpDate(emp.pendingTransfer.date)+
   ' → '+tpEscape(emp.pendingTransfer.toRestaurant)+'. The employee stays at the current outlet until then.</p>'+
   '<div class="tp-actions">'+tpButton("cancel-scheduled-transfer","Cancel Scheduled Transfer","tp-light",'data-id="'+tpEscape(emp.id)+'"')+'</div>':"")+
  (tpTransferOpenId===emp.id&&emp.active!==false&&!emp.left&&!emp.pendingTransfer&&tpPayrollMatchesRestaurant(emp)?tpTransferForm(emp):"");
 var end=html.lastIndexOf("</section>");
 return end>=0?html.slice(0,end)+extra+html.slice(end):html+extra;
};
var tpTransferPreviousAction=tpHandleAction;
tpHandleAction=function(button){
 var action=button.dataset.tpAction,id=button.dataset.id,emp=tpEmp(id);
 if(action==="transfer-employee"){
  if(!emp||emp.active===false||emp.left||!tpPayrollMatchesRestaurant(emp))
   return uxAlert("Only active employees in the selected outlet may be transferred.");
  if(emp.pendingTransfer)return uxAlert("This employee already has a transfer scheduled. Cancel it before scheduling another.");
  if(!tpTransferAvailableOutlets(emp).length)return uxAlert("Create another active restaurant outlet before transferring employees.");
  tpTransferOpenId=id;tpViewing=id;tpEditing=null;tpTab="employees";draw();
  var panel=document.getElementById("tp-transfer-panel");
  if(panel&&panel.scrollIntoView)panel.scrollIntoView({behavior:"smooth",block:"center"});
  return;
 }
 if(action==="cancel-transfer"){tpTransferOpenId=null;draw();return;}
 if(action==="cancel-scheduled-transfer"){
  if(!emp||!emp.pendingTransfer||!tpPayrollMatchesRestaurant(emp))return;
  if(!confirm("Cancel the scheduled outlet transfer for "+emp.name+"?"))return;
  var old=JSON.stringify(tpData),transferId=emp.pendingTransfer.transferId;
  delete emp.pendingTransfer;
  tpData.transfers=(tpData.transfers||[]).filter(function(t){return t.id!==transferId;});
  if(!tpSave()){tpData=JSON.parse(old);return;}
  tpTransferOpenId=null;draw();showToast("Scheduled transfer cancelled.");return;
 }
 return tpTransferPreviousAction(button);
};
var tpTransferPreviousSetTab=tpSetTab;
tpSetTab=function(section){
 tpTransferOpenId=null;
 return tpTransferPreviousSetTab(section);
};
document.addEventListener("submit",function(event){
 if(!event.target||event.target.id!=="tp-transfer-form")return;
 event.preventDefault();event.stopImmediatePropagation();
 var form=event.target,emp=tpEmp(form.dataset.id);
 if(!emp||emp.active===false||emp.left||!tpPayrollMatchesRestaurant(emp))
  return uxAlert("The employee must be active at the selected outlet.");
 if(emp.pendingTransfer)return uxAlert("This employee already has a transfer scheduled.");
 var destId=form.querySelector("#tp-transfer-outlet")?.value,
  dest=tpTransferAvailableOutlets(emp).find(function(r){return r.id===destId;});
 if(!dest)return uxAlert("Choose a destination outlet different from the current outlet.");
 var date=tpTransferEffectiveDate(),month=tpBonusMonthShift(date.slice(0,7),-1),
     oldPeriod=tpGetPeriod(month),target=tpGetPeriod(date.slice(0,7));
 if(target.finalized||target.locked)return uxAlert("The destination month's payroll is finalized or locked.");
 if(tpInputDays(target.days[emp.id])!==null)
  return uxAlert("Cannot schedule a transfer into a month where this employee already has attendance.");
 if(!confirm("Schedule "+emp.name+"'s transfer from "+emp.restaurant+" to "+dest.name+
  " effective "+tpDate(date)+"? This month’s attendance and salary stay unchanged."))return;
 var prior=JSON.stringify(tpData),transferId=tpId(),oldId=emp.restaurantId||tpResolveRestaurantId(emp.restaurant,emp);
 emp.pendingTransfer={transferId:transferId,date:date,toRestaurantId:dest.id,toRestaurant:dest.name};
 if(!Array.isArray(tpData.transfers))tpData.transfers=[];
 tpData.transfers.push({id:transferId,employeeId:emp.id,personId:tpArcPersonId(emp),
  name:emp.name,date:date,month:date.slice(0,7),status:"Scheduled",
  fromRestaurant:emp.restaurant,fromRestaurantId:oldId,
  toRestaurant:dest.name,toRestaurantId:dest.id,
  fromMonthlyId:tpSerialValue(oldPeriod.serials[emp.id]),toMonthlyId:null,recordedAt:tpStamp()});
 if(!tpSave()){tpData=JSON.parse(prior);return;}
 tpTransferOpenId=null;tpTab="employees";tpViewing=emp.id;
 draw();showToast("Transfer scheduled for "+tpDate(date)+".");
},true);
var tpTransferBeforeRender=tpRender;
tpRender=function(){
 tpTransferActivatePending();
 return tpTransferBeforeRender();
};
payroll=tpRender;
var tpTransferCss=document.createElement("style");
tpTransferCss.textContent=".tp-transfer-panel{border-color:#cee5db;margin:18px 0;scroll-margin-top:24px}.tp-transfer-destinations{display:block;margin:7px 0;font-weight:600;color:#1a7161;line-height:1.5}.tp-transfer-panel .tp-form-grid{margin-top:15px}.tp-transfer-panel .tp-field strong{display:block;padding:12px;background:#f2f8f5;border-radius:8px}.tp-transfer-history{padding-top:18px;margin-top:18px;border-top:1px solid #e3ebe8}.tp-transfer-history h3{margin-bottom:12px}.tp-transfer-panel .tp-warning{padding:10px 13px;background:#fff5e8;border-radius:8px;color:#915929}";
document.head.appendChild(tpTransferCss);
})();