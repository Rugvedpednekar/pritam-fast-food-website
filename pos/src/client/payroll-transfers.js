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
function tpTransferMonthlyState(emp){
 var month=tpMonth(0),period=tpGetPeriod(month);
 var raw=period.days[emp.id],total=tpInputDays(raw),allocation=period.bonusOutlets&&period.bonusOutlets[emp.id];
 var past=allocation&&Array.isArray(allocation.segments)?
  allocation.segments.slice(0,-1).reduce(function(sum,s){return sum+(Number(s.days)||0);},0):0;
 var current=total===null?0:Math.max(0,total-past);
 return {month:month,period:period,total:total,past:past,current:current,allocation:allocation};
}
function tpTransferAvailableOutlets(emp){
 var key=emp.restaurantId||tpResolveRestaurantId(emp.restaurant,emp);
 return (data.restaurants||[]).filter(function(outlet){
  return outlet.active!==false&&outlet.id!==key&&String(outlet.name||"")!==String(emp.restaurant||"");
 });
}
function tpTransferForm(emp){
 var available=tpTransferAvailableOutlets(emp),state=tpTransferMonthlyState(emp);
 var options=available.map(function(outlet){
  return '<option value="'+tpEscape(outlet.id)+'">'+tpEscape(outlet.name)+'</option>';
 }).join("");
 var oldCode=state.allocation&&state.allocation.segments&&state.allocation.segments.length?
  state.allocation.segments[state.allocation.segments.length-1].monthlyId:
  tpSerialValue(state.period.serials[emp.id]);
 return '<section class="tp-panel tp-transfer-panel" id="tp-transfer-panel">'+
  tpToolbar("Transfer Employee — "+tpEscape(emp.name),
   "Move this employee to another outlet without resignation or creating a new employee profile.","")+
  '<form id="tp-transfer-form" class="tp-form" data-id="'+tpEscape(emp.id)+'">'+
  '<div class="tp-form-grid">'+
  '<div class="tp-field"><label>From outlet</label><strong>'+tpEscape(emp.restaurant)+'</strong>'+
  '<small>Current monthly ID: '+(oldCode===null?"Unassigned":oldCode)+'</small></div>'+
  '<div class="tp-field"><label for="tp-transfer-outlet">To outlet *</label><select id="tp-transfer-outlet" required>'+
  '<option value="">Select destination outlet</option>'+options+'</select></div>'+
  '<div class="tp-field"><label for="tp-transfer-date">Transfer effective date *</label>'+
  '<input id="tp-transfer-date" required type="date" min="'+tpEscape(state.month+"-01")+
  '" max="'+tpEscape(tpToday())+'" value="'+tpEscape(tpToday())+'"></div>'+
  '<div class="tp-field"><label for="tp-transfer-old-days">Days worked at the current outlet before transfer, this month *</label>'+
  '<input id="tp-transfer-old-days" required type="number" min="0" max="'+state.current+
  '" step="0.5" inputmode="decimal" value="'+state.current+'">'+
  '<small>'+tpEscape(tpMonthLabel(state.month))+' · Attendance already recorded: '+
   (state.total===null?"Not entered":state.total)+" days"+
   (state.past?" · "+state.past+" days allocated to earlier outlets":"")+'</small></div>'+
  '</div><p class="tp-note">The existing month’s total worked days will not change. Enter how many of the recorded days belong to the outlet you are leaving; any remainder and future attendance days will belong to the destination. New monthly ID starts at the first available number at the destination, including 1.</p>'+
  (state.total===null?'<p class="tp-warning">No attendance has been entered for this month. You can transfer with 0 days attributed to the former outlet, or enter attendance before the transfer if the employee has already worked this month.</p>':"")+
  '<p class="tp-note">Transfer dates are limited to the current month to protect previously finalized payroll. Earlier-month transfer corrections require a separate historical adjustment.</p>'+
  '<div class="tp-actions"><button type="submit" class="tp-button tp-primary" '+(!available.length?"disabled":"")+'>Confirm Transfer</button>'+
  tpButton("cancel-transfer","Cancel","tp-light")+'</div></form></section>';
}
var tpTransferPreviousProfile=tpEmployeeProfile;
tpEmployeeProfile=function(emp){
 var html=tpTransferPreviousProfile(emp);
 if(!emp)return html;
 var history=tpTransferHistoryFor(emp),rows=history.map(function(t){
  return '<tr><td>'+tpDate(t.date)+'</td><td>'+tpEscape(t.fromRestaurant)+'</td>'+
   '<td>'+tpEscape(t.toRestaurant)+'</td>'+
   '<td>'+(t.fromMonthlyId===null?"—":t.fromMonthlyId)+'</td>'+
   '<td>'+t.toMonthlyId+'</td>'+
   '<td>'+tpEscape(String(t.daysAtPreviousOutlet))+'</td></tr>';
 });
 var extra='<div class="tp-transfer-history"><h3>Outlet Transfer History</h3>'+
  (rows.length?tpTable(["Transfer date","From outlet","To outlet","Previous monthly ID","New monthly ID","Days at former outlet"],rows):
   '<p class="tp-note">No outlet transfers have been recorded.</p>')+
  (emp.active!==false&&!emp.left?
   '<div class="tp-actions">'+tpButton("transfer-employee","Transfer Employee","tp-primary",'data-id="'+tpEscape(emp.id)+'"')+'</div>':"")+
  '</div>';
 var end=html.lastIndexOf("</section>");
 return end>=0?html.slice(0,end)+extra+html.slice(end):html+extra;
};
var tpTransferPreviousEmployeesPage=tpEmployeesPage;
tpEmployeesPage=function(){
 var html=tpTransferPreviousEmployeesPage();
 if(!tpTransferOpenId)return html;
 var emp=tpEmp(tpTransferOpenId);
 if(!emp||!tpPayrollMatchesRestaurant(emp)||emp.active===false||emp.left)return html;
 return tpTransferForm(emp)+html;
};
var tpTransferPreviousAction=tpHandleAction;
tpHandleAction=function(button){
 var action=button.dataset.tpAction,id=button.dataset.id,emp=tpEmp(id);
 if(action==="transfer-employee"){
  if(!emp||emp.active===false||emp.left||!tpPayrollMatchesRestaurant(emp))
   return uxAlert("Only active employees in the selected outlet may be transferred.");
  if(!tpTransferAvailableOutlets(emp).length)return uxAlert("Create another active restaurant outlet before transferring employees.");
  tpTransferOpenId=id;tpViewing=id;tpEditing=null;tpTab="employees";draw();return;
 }
 if(action==="cancel-transfer"){tpTransferOpenId=null;draw();return;}
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
  return uxAlert("This employee is not currently active in the selected outlet.");
 var destinationId=form.querySelector("#tp-transfer-outlet")?.value;
 var destination=tpTransferAvailableOutlets(emp).find(function(r){return r.id===destinationId;});
 if(!destination)return uxAlert("Choose an active destination outlet different from the current outlet.");
 var date=form.querySelector("#tp-transfer-date")?.value,state=tpTransferMonthlyState(emp);
 if(!tpArcDate(date)||date.slice(0,7)!==state.month||date>tpToday()||date<emp.joined)
  return uxAlert("Choose a valid transfer date during the current month and after the joining date.");
 if(state.period.finalized||state.period.locked)
  return uxAlert("This month's payroll is locked/finalized; outlet attendance cannot be reallocated.");
 var field=form.querySelector("#tp-transfer-old-days"),oldOutletDays=tpInputDays(field&&field.value);
 if(oldOutletDays===null||oldOutletDays>state.current)
  return uxAlert("Days at the former outlet must be between 0 and "+state.current+
   ". Enter the total monthly attendance first if more days have already been worked.");
 var currentCode=state.allocation&&state.allocation.segments&&state.allocation.segments.length?
  tpSerialValue(state.allocation.segments[state.allocation.segments.length-1].monthlyId):
  tpSerialValue(state.period.serials[emp.id]);
 var taken=new Set(Object.keys(state.period.serials||{}).filter(function(id){
  var other=tpEmp(id);return other&&other.id!==emp.id&&other.active!==false&&tpSameRestaurant(other,{restaurant:destination.name,restaurantId:destination.id});
 }).map(function(id){return tpSerialValue(state.period.serials[id]);}));
 var newCode=1;
 while(taken.has(newCode))newCode++;
 var currentOutlet=emp.restaurant,fromId=emp.restaurantId||tpResolveRestaurantId(emp.restaurant,emp);
 var already=state.allocation&&Array.isArray(state.allocation.segments)?
  state.allocation.segments.map(function(item){return Object.assign({},item);}):[];
 if(!already.length)already.push({restaurant:currentOutlet,restaurantId:fromId,monthlyId:currentCode,days:0});
 // Previous outlets have fixed attendance amounts; only the latest one changes.
 already[already.length-1].days=oldOutletDays;
 already.push({restaurant:destination.name,restaurantId:destination.id,monthlyId:newCode,days:null});
 var before=JSON.stringify(tpData);
 if(!confirm("Transfer "+emp.name+" from "+currentOutlet+" to "+destination.name+" on "+date+
  "? "+oldOutletDays+" recorded workdays will remain with the former outlet. Salary and total workdays will not change."))return;
 if(!state.period.bonusOutlets)state.period.bonusOutlets={};
 state.period.bonusOutlets[emp.id]={segments:already,updatedAt:tpStamp()};
 state.period.serials[emp.id]=newCode;
 if(!Array.isArray(tpData.transfers))tpData.transfers=[];
 tpData.transfers.push({employeeId:emp.id,personId:tpArcPersonId(emp),
  name:emp.name,date:date,month:state.month,fromRestaurant:currentOutlet,fromRestaurantId:fromId,
  toRestaurant:destination.name,toRestaurantId:destination.id,
  fromMonthlyId:currentCode,toMonthlyId:newCode,daysAtPreviousOutlet:oldOutletDays,recordedAt:tpStamp()});
 emp.restaurant=destination.name;emp.restaurantId=destination.id;
 state.period.updatedAt=tpStamp();
 if(!tpSave()){tpData=JSON.parse(before);return;}
 tpTransferOpenId=null;tpTab="employees";tpViewing=emp.id;tpPeriod=state.month;
 selected=destination.id;
 draw();
 showToast(emp.name+" transferred to "+destination.name+" · New monthly ID "+newCode+".");
},true);
var tpTransferCss=document.createElement("style");
tpTransferCss.textContent=".tp-transfer-panel{border-color:#cee5db}.tp-transfer-panel .tp-form-grid{margin-top:15px}.tp-transfer-panel .tp-field strong{display:block;padding:12px;background:#f2f8f5;border-radius:8px}.tp-transfer-history{padding-top:18px;margin-top:18px;border-top:1px solid #e3ebe8}.tp-transfer-history h3{margin-bottom:12px}.tp-transfer-panel .tp-warning{padding:10px 13px;background:#fff5e8;border-radius:8px;color:#915929}";
document.head.appendChild(tpTransferCss);
})();