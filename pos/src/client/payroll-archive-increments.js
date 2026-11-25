/* Tablewise left-employees archive, rejoining and salary increments.
   Runs inside payroll-preview.js closure. Historical payroll keys are never reused. */
(function(){
"use strict";
TP_SECTIONS.splice(TP_SECTIONS.indexOf("sheets")+1,0,"left");
TP_TITLES.left="Resigned Employees";
var tpArcForm=null,tpArcIncrementEmployee="",tpArcOriginalEmployees=tpEmployees;
function tpArcNextSalaryDate(){return tpMonth(1)+"-01";}
/* The POS restaurant selector is scoped to the outer application; payroll uses the same selection. */
function tpPayrollSelectedRestaurant(){
 if(typeof selected==="undefined"||selected===null)return null;
 var match=(data.restaurants||[]).find(function(r){return r.id===selected;});
 return match?match.name:null;
}
function tpPayrollMatchesRestaurant(employee){
 var name=tpPayrollSelectedRestaurant();
 if(!name)return true;
 if(!employee)return false;
 if(employee.restaurantId&&typeof selected!=="undefined")return employee.restaurantId===selected;
 return String(employee.restaurant||"").trim().toLowerCase()===String(name).trim().toLowerCase();
}
function tpArcPersonId(emp){return emp.personId||emp.id;}
function tpArcCareer(emp){
 var person=tpArcPersonId(emp);
 return tpData.employees.filter(function(e){return tpArcPersonId(e)===person;})
  .sort(function(a,b){return String(a.joined||"").localeCompare(String(b.joined||""));});
}
function tpArcLeft(emp){return emp.left===true&&emp.active===false&&!emp.rejoinedAs;}
function tpArcDate(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||""))return false;
 var d=new Date(value+"T12:00:00Z");
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
}
function tpArcRestaurantOptions(selected){
 var names=(data.restaurants||[]).filter(function(r){return r.active!==false;}).map(function(r){return r.name;});
 if(selected&&!names.includes(selected))names.push(selected);
 if(!names.length)names=["Pritam Fast Food"];
 return names.map(function(n){return '<option value="'+tpEscape(n)+'" '+(n===selected?"selected":"")+'>'+tpEscape(n)+'</option>';}).join("");
}
tpEmployees=function(includeInactive){
 return tpArcOriginalEmployees(includeInactive).filter(function(emp){return tpPayrollMatchesRestaurant(emp)&&(includeInactive||emp.left!==true);});
};
tpHistoricEmployees=function(month){
 var p=tpGetPeriod(month);
 return tpData.employees.filter(function(emp){
  var saved=[p.days,p.serials,p.salaries,p.advances,p.snapshots,p.commissions].some(function(obj){
   return obj&&Object.prototype.hasOwnProperty.call(obj,emp.id);
  });
  return tpPayrollMatchesRestaurant(emp)&&(saved||(emp.active!==false&&emp.left!==true&&month>=String(emp.joined||"").slice(0,7)));
 });
};
function tpArcHistory(emp){
 var career=tpArcCareer(emp),personIds=career.map(function(e){return e.id;});
 var periods=career.map(function(e){
  return '<tr><td>'+tpDate(e.joined)+'</td><td>'+tpDate(e.leftAt||e.lastWorkingDate)+'</td>'+
    '<td>'+tpEscape(e.designation)+'</td><td>'+tpEscape(e.restaurant)+'</td>'+
    '<td>'+(tpIsParcel(e)?"Commission only":tpMoney(e.initialSalary||e.salary))+'</td>'+
    '<td>'+(e.active!==false?"Active":e.rejoinedAs?"Rejoined":"Resigned")+'</td></tr>';
 });
 var ids=[],advances=[];
 Object.keys(tpData.periods).sort().forEach(function(month){
  var p=tpGetPeriod(month);
  career.forEach(function(e){
   var serial=tpSerialValue(p.serials[e.id]),advance=p.advances[e.id];
   if(serial!==null)ids.push('<tr><td>'+tpEscape(month)+'</td><td>'+tpEscape(e.designation)+'</td><td>'+serial+'</td></tr>');
   if(advance&&Number.isSafeInteger(advance.amount))advances.push('<tr><td>'+tpEscape(month)+'</td><td>'+tpEscape(e.designation)+'</td><td>'+tpMoney(advance.amount)+'</td></tr>');
  });
 });
 var raises=(tpData.salaryChanges||[]).filter(function(c){return personIds.includes(c.employeeId);})
  .sort(function(a,b){return String(a.effectiveDate||a.effectiveMonth).localeCompare(String(b.effectiveDate||b.effectiveMonth));});
 return '<div class="tp-salary-log"><h3>Employment periods</h3>'+
  tpTable(["Joined","Last working date","Designation","Restaurant","Starting salary","Status"],periods)+
  '<h3>Previous monthly IDs</h3>'+(ids.length?tpTable(["Payroll month","Designation","Monthly ID"],ids):'<p class="tp-note">No monthly IDs have been assigned.</p>')+
  '<h3>Advance history</h3>'+(advances.length?tpTable(["Payroll month","Designation","Advance"],advances):'<p class="tp-note">No advances have been recorded.</p>')+
  '<h3>Complete salary history</h3>'+(raises.length?tpTable(["Effective date","Previous salary","Revised salary","Change","Reason"],raises.map(function(c){
   var delta=c.newSalary-c.previousSalary;
   return '<tr><td>'+tpEscape(c.effectiveDate||c.effectiveMonth)+'</td><td>'+tpMoney(c.previousSalary)+'</td>'+
    '<td>'+tpMoney(c.newSalary)+'</td><td>'+tpMoney(delta)+'</td><td>'+tpEscape(c.reason||c.source||"Profile")+'</td></tr>';
  })):'<p class="tp-note">No recorded salary changes.</p>')+'</div>';
}
var tpArcBaseProfile=tpEmployeeProfile;
tpEmployeeProfile=function(emp){
 var html=tpArcBaseProfile(emp),close=tpButton("close-profile","Close","tp-light"),extra="";
 if(tpArcLeft(emp)){
  html=html.replace('data-tp-action="restore-employee"','data-tp-action="rejoin-employee"')
   .replace("Restore employee","Rejoin Employee");
  extra='<div class="tp-note"><strong>Resigned · Last working date: '+tpDate(emp.leftAt||emp.lastWorkingDate)+'</strong>. This profile is excluded from active salary processing.</div>';
 }else if(emp.active!==false){
  html=html.replace('<div class="tp-profile-menu">',
   '<div class="tp-profile-menu">'+tpButton("mark-left","Record Resignation","tp-light",'data-id="'+tpEscape(emp.id)+'"'));
  extra=tpIsParcel(emp)?"":'<form id="tp-profile-salary-form" class="tp-form tp-profile-salary" data-id="'+tpEscape(emp.id)+'">'+
    '<h3>Update Monthly Salary</h3><p class="tp-note">Current salary: <strong>'+tpMoney(tpMonthSalary(emp,tpMonth(0)))+
    '</strong>. Revised salary starts on <strong>'+tpDate(tpArcNextSalaryDate())+'</strong> (1st of next month). The current month stays at its original rate.</p>'+
    '<div class="tp-field"><label for="tp-profile-new-salary">New monthly salary (₹) *</label>'+
    '<input id="tp-profile-new-salary" name="newSalary" type="number" required min="1" max="10000000" step="1" inputmode="numeric" placeholder="Enter whole rupees"></div>'+
    '<div class="tp-actions"><button class="tp-button tp-primary" type="submit">Save New Salary</button></div></form>';
 }
 var actionsEnd=close+'</div>';
 if(html.includes(actionsEnd))html=html.replace(actionsEnd,actionsEnd+extra);
 else html=html.replace(close,close+extra);
 var pos=html.lastIndexOf("</section>");
 return pos>=0?html.slice(0,pos)+tpArcHistory(emp)+html.slice(pos):html+tpArcHistory(emp);
};
function tpArcLeftForm(emp){
 return '<section class="tp-panel tp-archive-form"><h3>Mark '+tpEscape(emp.name)+' as LEFT</h3>'+
 '<p class="tp-note">Enter the last actual working date. Earlier attendance, salary sheets, monthly IDs and advances remain available in Payroll History. This employee will no longer appear in active salary totals.</p>'+
 '<form id="tp-left-form" class="tp-form" data-id="'+tpEscape(emp.id)+'"><div class="tp-form-grid">'+
 '<div class="tp-field"><label for="tp-left-date">Last working date *</label><input id="tp-left-date" type="date" required value="'+tpEscape(tpToday())+'" min="'+tpEscape(emp.joined)+'" max="'+tpEscape(tpToday())+'"></div></div>'+
 '<div class="tp-actions"><button type="submit" class="tp-button tp-danger">Confirm Mark as LEFT</button>'+tpButton("cancel-archive","Cancel","tp-light")+'</div></form></section>';
}
function tpArcRejoinForm(emp){
 var now=tpToday(),oldSalary=tpIsParcel(emp)?0:tpMonthSalary(emp,String(emp.leftAt||now).slice(0,7));
 return '<section class="tp-panel tp-archive-form"><h3>Rejoin Employee — '+tpEscape(emp.name)+'</h3>'+
 '<p class="tp-note">Creates a new employment period with a new payroll record ID. All old employment periods, advances, payment sheets and monthly IDs will remain unchanged.</p>'+
 '<form id="tp-rejoin-form" class="tp-form" data-id="'+tpEscape(emp.id)+'"><div class="tp-form-grid">'+
 '<div class="tp-field"><label for="tp-rejoin-date">New joining date *</label><input id="tp-rejoin-date" required type="date" min="'+tpEscape(emp.leftAt||emp.joined)+'" max="'+tpEscape(now)+'" value="'+tpEscape(now)+'"></div>'+
 '<div class="tp-field"><label for="tp-rejoin-designation">Designation *</label><input id="tp-rejoin-designation" required maxlength="90" placeholder="Enter designation manually" value="'+tpEscape(emp.designation)+'"></div>'+
 '<div class="tp-field"><label for="tp-rejoin-restaurant">Restaurant *</label><select id="tp-rejoin-restaurant">'+tpArcRestaurantOptions(emp.restaurant)+'</select></div>'+
 (tpIsParcel(emp)?'<div class="tp-field"><label>Salary</label><p class="tp-note">Commission-only employee — no fixed salary.</p></div>':
 '<div class="tp-field"><label for="tp-rejoin-salary">New starting monthly salary (₹) *</label><input id="tp-rejoin-salary" required inputmode="decimal" value="'+tpRupees(oldSalary)+'"></div>')+
 '</div>'+
 '<div class="tp-actions"><button type="submit" class="tp-button tp-primary">Confirm Rejoining</button>'+tpButton("cancel-archive","Cancel","tp-light")+'</div></form></section>';
}
var tpArcBaseEmployeesPage=tpEmployeesPage;
tpEmployeesPage=function(){
 var html=tpArcBaseEmployeesPage(),all=tpEmployees(),deleted=tpData.employees.filter(function(e){return tpPayrollMatchesRestaurant(e)&&e.active===false&&e.left!==true;});
 // Rebuild the roster so the inactive LEFT group is not mixed into Deleted Employees.
 var out='<section class="tp-panel">'+tpToolbar("Active Employees",all.length+" currently employed · Resigned Employees have their own separate archive.",tpButton("new-employee","+ Add Employee","tp-primary"))+
 '<div class="tp-employee-grid">'+all.map(function(emp){
  return '<article class="tp-person">'+tpAvatar(emp)+'<div class="tp-person-main"><h3>'+tpEscape(emp.name)+'</h3><p>'+tpEscape(emp.designation)+'</p><small>'+tpEscape(emp.restaurant)+'</small></div>'+
  '<div class="tp-person-extra"><strong>'+(tpIsParcel(emp)?"Commission only":tpMoney(emp.salary))+'</strong><small>Joined '+tpDate(emp.joined)+'</small>'+tpBadge(emp.method,emp.method==="CASH")+'</div>'+
  '<div class="tp-person-buttons">'+tpButton("view-employee","View","tp-light",'data-id="'+tpEscape(emp.id)+'"')+
   tpButton("edit-employee","Edit","tp-light",'data-id="'+tpEscape(emp.id)+'"')+
   tpButton("mark-left","Record Resignation","tp-danger",'data-id="'+tpEscape(emp.id)+'"')+'</div></article>';
 }).join("")+'</div>'+(all.length?"":'<p class="tp-note">No active employees. Use Rejoin Employee from the Resigned Employees tab or add a new person.</p>')+'</section>';
 if(deleted.length){
  out+='<details class="tp-panel tp-deleted-people"><summary>Deleted Employees ('+deleted.length+') · Restore</summary>'+
   '<p class="tp-note">Deleted is distinct from resignation. Deleted profiles stay outside active payroll.</p><div class="tp-deleted-list">'+
    deleted.map(function(emp){return '<div class="tp-deleted-row">'+tpAvatar(emp,"small")+
    '<div><strong>'+tpEscape(emp.name)+'</strong><small>'+tpEscape(emp.designation)+'</small></div>'+
    tpButton("restore-employee","Restore","tp-light",'data-id="'+tpEscape(emp.id)+'"')+'</div>';}).join("")+'</div></details>';
 }
 if(tpArcForm&&tpArcForm.type==="left"){var e=tpEmp(tpArcForm.id);if(e)out=tpArcLeftForm(e)+out;}
 else if(tpEditing!==null)out=tpEmployeeForm(tpEditing==="new"?null:tpEmp(tpEditing))+out;
 else if(tpViewing){var current=tpEmp(tpViewing);if(current)out=tpEmployeeProfile(current)+out;}
 return out;
};
function tpArcLeftPage(){
 var list=tpData.employees.filter(function(e){return tpPayrollMatchesRestaurant(e)&&tpArcLeft(e);}).sort(function(a,b){return String(b.leftAt||"").localeCompare(String(a.leftAt||""));});
 var out='<section class="tp-panel">'+tpToolbar("Left Employees (Without Salary)",list.length+" archived profiles · Excluded from active attendance, salary calculations and CASH/CHEQUE totals.","")+
 '<div class="tp-note">These profiles are retained only for reference. Rejoining creates a new employment period; it does not overwrite historic payroll or monthly employee IDs.</div>'+
 '<div class="tp-employee-grid">'+list.map(function(emp){
 return '<article class="tp-person">'+tpAvatar(emp)+'<div class="tp-person-main"><h3>'+tpEscape(emp.name)+'</h3><p>'+tpEscape(emp.designation)+' · '+tpEscape(emp.restaurant)+'</p>'+
 '<small>Last working date: '+tpDate(emp.leftAt||emp.lastWorkingDate)+'</small></div>'+
 '<div class="tp-person-buttons">'+tpButton("view-employee","View history","tp-light",'data-id="'+tpEscape(emp.id)+'"')+
 tpButton("rejoin-employee","Rejoin Employee","tp-primary",'data-id="'+tpEscape(emp.id)+'"')+'</div></article>';
 }).join("")+'</div>'+(list.length?"":'<p class="tp-note">No employees are currently marked LEFT.</p>')+'</section>';
 if(tpArcForm&&tpArcForm.type==="rejoin"){var e=tpEmp(tpArcForm.id);if(e&&tpArcLeft(e))out=tpArcRejoinForm(e)+out;}
 else if(tpViewing){var e2=tpEmp(tpViewing);if(e2&&tpArcLeft(e2))out=tpEmployeeProfile(e2)+out;}
 return out;
}
var tpArcBaseRender=tpRender;
tpRender=function(){
 // Restaurant changes invalidate editing/viewing state from the previous branch.
 if(tpViewing&&!tpPayrollMatchesRestaurant(tpEmp(tpViewing)))tpViewing=null;
 if(tpEditing&&tpEditing!=="new"&&!tpPayrollMatchesRestaurant(tpEmp(tpEditing)))tpEditing=null;
 if(tpArcForm&&tpArcForm.id&&!tpPayrollMatchesRestaurant(tpEmp(tpArcForm.id)))tpArcForm=null;
 if(tpCommissionOpen&&!tpPayrollMatchesRestaurant(tpEmp(tpCommissionOpen)))tpCommissionOpen=null;
 if(tpTab==="left"){
  return tpTop()+tpArcLeftPage()+'<footer class="tp-footer">Archived employees are outside active payroll · Browser-local demonstration</footer></div>';
 }
 return tpArcBaseRender();
};
payroll=tpRender;
var tpArcBaseAction=tpHandleAction;
tpHandleAction=function(button){
 var action=button.dataset.tpAction,id=button.dataset.id,emp=tpEmp(id);
 if(emp&&!tpPayrollMatchesRestaurant(emp))return uxAlert("Select the employee\u2019s restaurant to manage this record.");
 if(action==="mark-left"){
  if(!emp||emp.active===false||emp.left===true)return;
  tpArcForm={type:"left",id:id};tpEditing=null;tpViewing=null;tpTab="employees";draw();return;
 }
 if(action==="rejoin-employee"){
  if(!emp||!tpArcLeft(emp))return;
  tpArcForm={type:"rejoin",id:id};tpEditing=null;tpViewing=null;tpTab="left";draw();return;
 }
 if(action==="cancel-archive"){tpArcForm=null;draw();return;}
 if(action==="go-increments"){
  tpArcIncrementEmployee=id||"";tpArcForm=null;tpSetTab("settings");
  var target=document.getElementById("tp-increment-settings");if(target)target.scrollIntoView({block:"start",behavior:"smooth"});
  return;
 }
 if(action==="pdf-increments")return tpArcDownloadIncrements();
 if(action==="edit-employee"&&emp&&emp.active===false){uxAlert("This employment period is closed. Use Rejoin Employee to start a new period.");return;}
 if(action==="restore-employee"&&emp&&emp.left===true){uxAlert("Use Rejoin Employee for resigned employees.");return;}
 return tpArcBaseAction(button);
};
var tpArcBaseTab=tpSetTab;
tpSetTab=function(tabName){tpArcForm=null;return tpArcBaseTab(tabName);};
document.addEventListener("submit",function(ev){
 if(!ev.target||ev.target.id!=="tp-left-form")return;
 ev.preventDefault();ev.stopImmediatePropagation();
 var form=ev.target,emp=tpEmp(form.dataset.id),date=form.querySelector("#tp-left-date").value;
 if(!emp||!tpPayrollMatchesRestaurant(emp)||emp.active===false||emp.left)return uxAlert("Employee is no longer active in the selected restaurant.");
 if(!tpArcDate(date)||date<emp.joined||date>tpToday())return uxAlert("Choose a valid last working date between the joining date and today.");
 if(!confirm('Mark '+emp.name+' as LEFT, effective '+date+'? They will disappear from active salary sheets. Historical payroll will be preserved.'))return;
 var before=JSON.stringify(tpData);
 emp.left=true;emp.active=false;emp.leftAt=date;emp.lastWorkingDate=date;emp.closedAt=tpStamp();
 if(!tpSave()){tpData=JSON.parse(before);return;}
 tpArcForm=null;tpViewing=null;tpTab="left";draw();showToast(emp.name+" moved to Left Employees."); 
},true);
document.addEventListener("submit",function(ev){
 if(!ev.target||ev.target.id!=="tp-rejoin-form")return;
 ev.preventDefault();ev.stopImmediatePropagation();
 var form=ev.target,old=tpEmp(form.dataset.id);
 if(!old||!tpArcLeft(old))return uxAlert("This archive entry is no longer eligible to rejoin.");
 var joined=form.querySelector("#tp-rejoin-date").value;
 var designation=tpTrim(form.querySelector("#tp-rejoin-designation").value,90);
 var restaurant=tpTrim(form.querySelector("#tp-rejoin-restaurant").value,90);
 var salary=tpIsParcel(old)?0:parsePaise(form.querySelector("#tp-rejoin-salary").value);
 if(!tpArcDate(joined)||joined<(old.leftAt||old.joined)||joined>tpToday()||!designation||!restaurant||
 (!tpIsParcel(old)&&(salary===null||salary<=0||salary>1000000000))){
  uxAlert("Enter a valid new joining date, designation, restaurant and starting salary.");return;
 }
 if(!confirm("Rejoin "+old.name+" on "+joined+"? A new employment period and monthly ID will be created without changing any historical records."))return;
 var before=JSON.stringify(tpData),newId=tpId(),person=tpArcPersonId(old);
 var next=Object.assign({},old,{id:newId,personId:person,previousEmploymentId:old.id,joined:joined,
  designation:designation,restaurant:restaurant,restaurantId:tpResolveRestaurantId(restaurant,null),salary:salary,initialSalary:salary,
  active:true,left:false,createdAt:tpStamp(),employmentPeriodStartedAt:tpStamp()});
 delete next.leftAt;delete next.lastWorkingDate;delete next.closedAt;delete next.rejoinedAs;delete next.deletedAt;delete next.exitType;delete next.finalSettlement;
 old.rejoinedAs=newId;old.rejoinedAt=tpStamp();
 tpData.employees.push(next);
 var month=joined.slice(0,7),period=tpGetPeriod(month),taken=new Set(Object.keys(period.serials).filter(function(id){
  var employee=tpEmp(id);return employee&&employee.active!==false&&tpSameRestaurant(employee,next);
 }).map(function(id){return tpSerialValue(period.serials[id]);}));
 var serial=1;
 while(taken.has(serial))serial++;
 period.serials[newId]=serial;
 if(!tpIsParcel(next))period.salaries[newId]=salary;
 period.updatedAt=tpStamp();
 if(!tpSave()){tpData=JSON.parse(before);return;}
 tpArcForm=null;tpViewing=newId;tpTab="employees";draw();
 showToast(old.name+" rejoined · new restaurant-specific monthly ID "+serial+".");
},true);
function tpArcRaiseRecords(){
 return (tpData.salaryChanges||[]).filter(function(c){return ["Salary Increment","Salary Revision"].includes(c.source)&&tpPayrollMatchesRestaurant(tpEmp(c.employeeId));})
  .sort(function(a,b){return String(b.effectiveDate||b.effectiveMonth).localeCompare(String(a.effectiveDate||a.effectiveMonth));});
}
function tpArcIncrementPage(){
 var employees=tpEmployees().filter(function(e){return !tpIsParcel(e);}),records=tpArcRaiseRecords();
 var selection=tpArcIncrementEmployee&&employees.some(function(e){return e.id===tpArcIncrementEmployee;})?tpArcIncrementEmployee:(employees[0]&&employees[0].id||"");
 var options=employees.map(function(e){return '<option value="'+tpEscape(e.id)+'" '+(selection===e.id?"selected":"")+'>'+tpEscape(e.name)+' — '+tpEscape(e.restaurant)+'</option>';}).join("");
 var html='<section class="tp-panel" id="tp-increment-settings">'+tpToolbar("Salary Increases / Increments",
  "Update salaries by revised amount, fixed increment or percentage. Effective dates and complete histories are retained.",
  tpButton("pdf-increments","Download Increment Report PDF","tp-light"))+
 '<p class="tp-note">Salary increases are effective only from the 1st of the next calendar month, never mid-month.</p>'+
 '<form id="tp-increment-form" class="tp-form"><div class="tp-form-grid">'+
 '<div class="tp-field"><label for="tp-inc-employee">Employee *</label><select id="tp-inc-employee" required>'+options+'</select></div>'+
 '<div class="tp-field"><label for="tp-inc-date">Effective date (fixed)</label><input id="tp-inc-date" required type="date" readonly min="'+tpArcNextSalaryDate()+'" max="'+tpArcNextSalaryDate()+'" value="'+tpArcNextSalaryDate()+'"></div>'+
 '<div class="tp-field"><label for="tp-inc-mode">Increase method *</label><select id="tp-inc-mode"><option value="new">New monthly salary (₹)</option><option value="fixed">Fixed increase (₹)</option><option value="percent">Percentage increase (%)</option></select></div>'+
 '<div class="tp-field"><label for="tp-inc-value">Amount or percentage *</label><input id="tp-inc-value" required type="number" min="0.01" max="10000000" step="0.01" inputmode="decimal" placeholder="Enter amount"></div>'+
 '<div class="tp-field"><label for="tp-inc-reason">Reason / remarks</label><input id="tp-inc-reason" maxlength="180" placeholder="Annual increment, promotion…"></div></div>'+
 '<div class="tp-actions"><button class="tp-button tp-primary" type="submit" '+(!employees.length?"disabled":"")+'>Save Salary Increment</button></div></form>'+
 '<h3 style="margin-top:25px">Salary Increment History</h3>'+
 (records.length?tpTable(["Effective date","Employee","Restaurant","Previous","New","Increase","Reason"],records.map(function(c){
  var e=tpEmp(c.employeeId),delta=c.newSalary-c.previousSalary;
  return '<tr><td>'+tpEscape(c.effectiveDate||c.effectiveMonth)+'</td><td>'+tpEscape(c.employeeName||e&&e.name||"Employee")+'</td>'+
   '<td>'+tpEscape(e&&e.restaurant||"—")+'</td><td>'+tpMoney(c.previousSalary)+'</td><td>'+tpMoney(c.newSalary)+'</td>'+
   '<td>'+tpMoney(delta)+' ('+(c.previousSalary?((delta/c.previousSalary)*100).toFixed(1):"0")+'%)</td>'+
   '<td>'+tpEscape(c.reason||"—")+'</td></tr>';
 })):'<p class="tp-note">No salary increments have been recorded.</p>')+
 '<div class="tp-form-grid tp-arc-pdf-filters">'+
 '<div class="tp-field"><label for="tp-inc-filter-restaurant">PDF report · Restaurant</label><select id="tp-inc-filter-restaurant"><option value="">All restaurants</option>'+
 Array.from(new Set(tpEmployees(true).map(function(e){return e.restaurant;}))).filter(Boolean).map(function(n){return '<option value="'+tpEscape(n)+'">'+tpEscape(n)+'</option>';}).join("")+
 '</select></div><div class="tp-field"><label for="tp-inc-filter-employee">Employee</label><select id="tp-inc-filter-employee"><option value="">All employees</option>'+
 tpEmployees(true).map(function(e){return '<option value="'+tpEscape(e.id)+'">'+tpEscape(e.name)+' ('+tpEscape(e.joined)+')</option>';}).join("")+
 '</select></div><div class="tp-field"><label for="tp-inc-filter-from">From date</label><input id="tp-inc-filter-from" type="date"></div>'+
 '<div class="tp-field"><label for="tp-inc-filter-to">Through date</label><input id="tp-inc-filter-to" type="date"></div></div></section>';
 return html;
}
var tpArcSettings=tpSettings;
tpSettings=function(){return tpArcSettings();};
document.addEventListener("submit",function(ev){
 if(!ev.target||ev.target.id!=="tp-profile-salary-form")return;
 ev.preventDefault();ev.stopImmediatePropagation();
 var form=ev.target,emp=tpEmp(form.dataset.id),today=tpToday(),effectiveDate=tpArcNextSalaryDate(),
  month=effectiveDate.slice(0,7),input=form.querySelector("#tp-profile-new-salary"),
  nextSalary=input&&parsePaise(String(input.value).trim());
 if(!emp||!tpPayrollMatchesRestaurant(emp)||emp.active===false||emp.left||tpIsParcel(emp))
  return uxAlert("Choose an active salaried employee in the selected restaurant.");
 if(today<emp.joined)return uxAlert("Salary changes must be on or after the employment start date.");
 if(!Number.isSafeInteger(nextSalary)||nextSalary<=0||nextSalary>1000000000)
  return uxAlert("Enter a whole-rupee salary from ₹1 to ₹1,00,00,000.");
 var previous=tpMonthSalary(emp,month),period=tpGetPeriod(month);
 if(nextSalary===previous)return uxAlert("Enter an amount different from the next month's scheduled salary.");
 if(period.finalized===true||period.locked===true)
  return uxAlert("Next month's payroll is locked or finalized and salary cannot be scheduled.");
 if(!confirm("Change "+emp.name+"'s salary from "+tpMoney(previous)+" to "+tpMoney(nextSalary)+
  " effective "+effectiveDate+"? The current and previous months will not change."))return;
 var backup=JSON.stringify(tpData);
 try{
  tpSetMonthSalary(emp,month,nextSalary,"Salary Revision");
  var change=tpData.salaryChanges[tpData.salaryChanges.length-1];
  change.effectiveDate=effectiveDate;change.reason="Updated from Employee Profile";
  change.employmentPeriodId=emp.id;change.restaurant=emp.restaurant;
  change.designation=emp.designation;
  period.updatedAt=tpStamp();
  if(!tpSave()){tpData=JSON.parse(backup);return;}
  tpTab="employees";tpViewing=emp.id;draw();showToast("New salary takes effect "+effectiveDate+".");
 }catch(error){tpData=JSON.parse(backup);uxAlert(error.message||"Could not save salary.");}
},true);
document.addEventListener("submit",function(ev){
 if(!ev.target||ev.target.id!=="tp-increment-form")return;
 ev.preventDefault();ev.stopImmediatePropagation();
 var form=ev.target,emp=tpEmp(form.querySelector("#tp-inc-employee").value),date=form.querySelector("#tp-inc-date").value;
 var mode=form.querySelector("#tp-inc-mode").value,value=Number(form.querySelector("#tp-inc-value").value);
 var reason=tpTrim(form.querySelector("#tp-inc-reason").value,180);
 if(!emp||emp.active===false||emp.left||tpIsParcel(emp))return uxAlert("Choose an active salaried employee.");
 if(date!==tpArcNextSalaryDate())return uxAlert("New salary changes start only on "+tpArcNextSalaryDate()+".");
 if(date<emp.joined)return uxAlert("Effective date must be after the employment start date.");
 var month=date.slice(0,7),old=tpMonthSalary(emp,month),newSalary;
 if(!Number.isFinite(value)||value<=0||!["new","fixed","percent"].includes(mode))return uxAlert("Enter a positive salary amount or percentage.");
 if(mode==="new")newSalary=parsePaise(form.querySelector("#tp-inc-value").value);
 else if(mode==="fixed"){var increment=parsePaise(form.querySelector("#tp-inc-value").value);newSalary=increment===null?null:old+increment;}
 else newSalary=Math.round(old*(1+value/100));
 if(!Number.isSafeInteger(newSalary)||newSalary<=old||newSalary>1000000000)return uxAlert("The revised salary must be higher than the current salary and at most ₹1,00,00,000.");
 if((tpData.salaryChanges||[]).some(function(c){return c.employeeId===emp.id&&c.effectiveMonth===date.slice(0,7);}))
  return uxAlert("A salary increment already exists for this employee and effective date. Please choose another date.");
 var targetPeriod=tpGetPeriod(month);
 if(targetPeriod.finalized===true||targetPeriod.locked===true)return uxAlert("This payroll month is finalized or locked and cannot be changed.");
 if(month<=tpMonth(0))return uxAlert("Salary changes can take effect only next month.");
 if(!confirm("Increase "+emp.name+"'s monthly salary from "+tpMoney(old)+" to "+tpMoney(newSalary)+" effective "+date+"?"))return;
 var before=JSON.stringify(tpData);
 try{
  if(!tpSetMonthSalary(emp,month,newSalary,"Salary Increment"))return;
  var change=tpData.salaryChanges[tpData.salaryChanges.length-1];
  change.effectiveDate=date;change.reason=reason;change.employmentPeriodId=emp.id;change.restaurant=emp.restaurant;
  change.designation=emp.designation;
  if(!tpSave()){tpData=JSON.parse(before);return;}
  tpArcIncrementEmployee=emp.id;draw();showToast("Salary increment saved effective "+date+".");
 }catch(err){tpData=JSON.parse(before);uxAlert(err.message||"Could not save salary increment.");}
},true);
// Preserve legacy proration only for previously recorded historical mid-month changes.
 // New changes always take effect on the 1st of next month.
var tpArcBaseCompute=tpCompute;
tpCompute=function(emp,period,override,month){
 var result=tpArcBaseCompute(emp,period,override,month);
 if(!result||tpIsParcel(emp)||period.finalized===true||period.locked===true)return result;
 var m=month||tpPeriod,changes=(tpData.salaryChanges||[]).filter(function(c){
  return c.employeeId===emp.id&&["Salary Increment","Salary Revision"].includes(c.source)&&c.effectiveDate&&c.effectiveDate.slice(0,7)===m;
 }).sort(function(a,b){return a.effectiveDate.localeCompare(b.effectiveDate)||a.changedAt.localeCompare(b.changedAt);});
 if(!changes.length||changes.every(function(c){return c.effectiveDate.slice(8)==="01";}))return result;
 // Mid-month proration remains only for legacy changes with non-first-day dates.
 var dailyTotal=0,rate=changes[0].previousSalary,idx=0;
 for(var d=1;d<=30;d++){
  while(idx<changes.length&&Math.min(30,Number(changes[idx].effectiveDate.slice(8)))<=d){
   rate=changes[idx].newSalary;idx++;
  }
  dailyTotal+=rate/30;
 }
 var effective=Math.round(dailyTotal);
 result.gross=tpRound(effective*result.days/TP_BASIS);
 result.leavePay=tpRound(effective*result.leaveEarned/TP_BASIS);
 result.earned=result.gross+result.leavePay;
 result.withheld=result.paidAdvance+result.fine+result.other;
 result.net=Math.max(0,result.earned-result.withheld);
 result.shortfall=Math.max(0,result.withheld-result.earned);
 result.proratedMonthly=effective;
 return result;
};
function tpArcDownloadIncrements(){
 var records=tpArcRaiseRecords(),byRestaurant=document.getElementById("tp-inc-filter-restaurant"),
  byEmployee=document.getElementById("tp-inc-filter-employee"),from=document.getElementById("tp-inc-filter-from"),to=document.getElementById("tp-inc-filter-to");
 var restaurant=byRestaurant&&byRestaurant.value||tpPayrollSelectedRestaurant()||"",employee=byEmployee&&byEmployee.value||"",
  since=from&&from.value||"",until=to&&to.value||"";
 records=records.filter(function(c){
  var emp=tpEmp(c.employeeId),date=c.effectiveDate||c.effectiveMonth+"-01";
  return (!restaurant||c.restaurant===restaurant||emp&&emp.restaurant===restaurant)&&
   (!employee||c.employeeId===employee)&&(!since||date>=since)&&(!until||date<=until);
 });
 if(!records.length)return uxAlert("No salary increments match these report filters.");
 try{
  var pages=[],maxRows=15;
  for(var start=0;start<records.length;start+=maxRows){
   var page=tpPdfCanvas(),ctx=page.ctx;
   tpPdfHeader(ctx,"SALARY INCREMENT REPORT",tpPeriod,"Salary changes by effective date · "+records.length+" entries");
   ctx.fillStyle="#e9f4ef";ctx.fillRect(38,140,519,31);
   var cols=[["DATE",45],["EMPLOYEE",111],["RESTAURANT",93],["OLD",86],["NEW",86],["RAISE",98]],x=38;
   cols.forEach(function(col){tpPdfText(ctx,col[0],x+5,159,8,true,"#346254",col[1]-8);x+=col[1];});
   records.slice(start,start+maxRows).forEach(function(c,i){
    var e=tpEmp(c.employeeId),y=195+i*33,values=[c.effectiveDate||c.effectiveMonth,
     c.employeeName||e&&e.name||"Employee",c.restaurant||e&&e.restaurant||"",
     tpMoney(c.previousSalary),tpMoney(c.newSalary),tpMoney(c.newSalary-c.previousSalary)];
    if(i%2===0){ctx.fillStyle="#f7faf9";ctx.fillRect(38,y-19,519,31);}
    var at=38;values.forEach(function(v,j){tpPdfText(ctx,v,at+5,y,9,j===0||j===5,"#243e4b",cols[j][1]-9);at+=cols[j][1];});
   });
   tpPdfText(ctx,"Generated "+tpDate(tpToday())+" · Filtered report · Historical entries are retained",40,733,9,false,"#627b7b",510);
   tpPdfFooter(ctx,pages.length+1);pages.push(tpPdfImage(page));
  }
  var file=tpPdfBuild(pages);
  tpDeliverPdf(file,"restaurant-salary-increment-report-"+tpToday()+".pdf");
 }catch(err){uxAlert("Could not create increment PDF: "+(err.message||"Unknown error"));}
}
var arcCSS=document.createElement("style");
arcCSS.textContent=".tp-profile-salary{margin:18px 0;padding:15px;background:#f5faf8;border:1px solid #d7e8df;border-radius:12px}.tp-profile-salary .tp-field{max-width:360px}.tp-profile-salary h3{margin:0 0 8px} .tp-archive-form{border-color:#d4c9a0}.tp-archive-form .tp-note{max-width:850px}#tp-increment-settings{scroll-margin-top:20px}#tp-increment-settings .tp-form{margin:15px 0 20px}.tp-arc-pdf-filters{margin-top:22px;border-top:1px solid #e2ebed;padding-top:18px}.tp-archive-form .tp-form-grid{max-width:900px}";
document.head.appendChild(arcCSS);

/* Departure types and final salary settlements (archived independently from active payroll). */
TP_TITLES.left="Resigned Employees";
function tpDepartureStatus(emp){
 var s=emp&&emp.finalSettlement;
 return !s?"Resigned · Final salary not yet recorded":s.status==="PAID"?"Resigned · Salary paid":"Resigned · Salary due";
}
function tpDepartureMaxDays(emp,date){
 var cap=Math.min(30,Number(String(date).slice(8)));
 if(String(emp.joined).slice(0,7)===date.slice(0,7))cap-=Math.max(0,Number(String(emp.joined).slice(8))-1);
 return Math.max(0,cap);
}
tpArcLeftForm=function(emp){
 var historic=emp.active===false&&tpArcLeft(emp)&&!emp.finalSettlement,
 date=historic?(emp.leftAt||emp.lastWorkingDate||tpToday()):tpToday(),
 p=tpGetPeriod(date.slice(0,7)),saved=p.days[emp.id],
 maxDays=tpDepartureMaxDays(emp,date);
 if(tpInputDays(saved)===null||Number(saved)>maxDays)saved="";
 return '<section class="tp-panel tp-archive-form"><h3>'+(historic?"Complete Resignation Settlement":"Record Employee Resignation")+' — '+tpEscape(emp.name)+'</h3>'+
 '<p class="tp-note">Record the last working day and the final salary earned. Mark the payment <strong>Paid</strong> if already settled, or <strong>Due</strong> to record payment later. Previous attendance, advances, and employment history remain available for rejoining.</p>'+
 '<form id="tp-departure-form" class="tp-form" data-id="'+tpEscape(emp.id)+'"><div class="tp-form-grid">'+
 '<div class="tp-field"><label for="tp-departure-date">Last working date *</label><input id="tp-departure-date" type="date" required min="'+tpEscape(historic?date:emp.joined)+'" max="'+tpEscape(historic?date:tpToday())+'" value="'+tpEscape(date)+'"></div>'+
 (tpIsParcel(emp)?'<div class="tp-note">Parcel Boy: enter the final monthly commission in Attendance before resigning. Commission and GST will be used for settlement.</div>':
 '<div class="tp-field"><label for="tp-departure-days">Actual days worked until leaving *</label><input id="tp-departure-days" required type="number" min="0" max="30" step="0.5" inputmode="decimal" value="'+tpEscape(saved===undefined?"":saved)+'" placeholder="e.g. 17.5">'+
 '<small>Enter actual worked days up to the last working day. Standard salary uses the existing 30-day basis, earned leave, and recorded deductions.</small></div>')+
 '<div class="tp-field"><label for="tp-departure-payment">Final salary status *</label>'+
 '<select id="tp-departure-payment"><option value="DUE">Due — salary not yet paid</option><option value="PAID">Paid — salary already settled</option></select></div>'+
 '<div class="tp-field"><label for="tp-departure-paid-date">Date paid (if marked paid)</label><input id="tp-departure-paid-date" type="date" max="'+tpEscape(tpToday())+'" value="'+tpEscape(tpToday())+'"></div>'+
 '<div class="tp-field"><label for="tp-departure-method">Payment method *</label><select id="tp-departure-method"><option value="CASH" '+(emp.method==="CASH"?"selected":"")+'>CASH</option>'+
 '<option value="CHEQUE" '+(emp.method==="CHEQUE"?"selected":"")+'>CHEQUE</option></select></div>'+
 '<div class="tp-field"><label for="tp-departure-notes">Remarks</label><input id="tp-departure-notes" maxlength="180" placeholder="Optional resignation notes"></div></div>'+
 '<p class="tp-note">Final settlements are tracked outside active salary totals. This keeps any remaining amount due visible without adding an extra active salary.</p>'+
 '<div class="tp-actions"><button class="tp-button tp-primary" type="submit">'+(historic?"Save Final Settlement":"Confirm Resignation")+'</button>'+
 tpButton("cancel-archive","Cancel","tp-light")+'</div></form></section>';
};
function tpDeparturePaymentForm(emp){
 var s=emp.finalSettlement;
 return '<section class="tp-panel tp-archive-form"><h3>Record Final Salary Payment — '+tpEscape(emp.name)+'</h3>'+
 '<p class="tp-note">Outstanding final salary: <strong>'+tpMoney(s.net)+'</strong>. This updates settlement status only, not active monthly salary sheets.</p>'+
 '<form id="tp-settle-payment-form" class="tp-form" data-id="'+tpEscape(emp.id)+'"><div class="tp-form-grid">'+
 '<div class="tp-field"><label for="tp-settle-date">Payment date *</label><input id="tp-settle-date" type="date" required value="'+tpEscape(tpToday())+'" max="'+tpEscape(tpToday())+'"></div>'+
 '<div class="tp-field"><label for="tp-settle-method">Payment method *</label><select id="tp-settle-method">'+
 '<option value="CASH" '+(s.method==="CASH"?"selected":"")+'>CASH</option><option value="CHEQUE" '+(s.method==="CHEQUE"?"selected":"")+'>CHEQUE</option></select></div>'+
 '</div><div class="tp-actions"><button class="tp-button tp-primary" type="submit">Confirm Salary Paid</button>'+
 tpButton("cancel-archive","Cancel","tp-light")+'</div></form></section>';
}
tpArcLeftPage=function(){
 var resigned=tpData.employees.filter(function(e){return tpPayrollMatchesRestaurant(e)&&tpArcLeft(e);})
   .sort(function(a,b){return String(b.leftAt||"").localeCompare(String(a.leftAt||""));});
 var paid=resigned.reduce(function(t,e){return t+(e.finalSettlement&&e.finalSettlement.status==="PAID"?e.finalSettlement.net:0);},0);
 var due=resigned.reduce(function(t,e){return t+(e.finalSettlement&&e.finalSettlement.status==="DUE"?e.finalSettlement.net:0);},0);
 var out='<div class="tp-stats tp-stats-three">'+tpCard("Resigned employees",resigned.length,"Archived employment records","♙")+
   tpCard("Final salary paid",tpMoney(paid),"Settled resignation salaries","₹")+
   tpCard("Final salary due",tpMoney(due),"Outstanding final salaries","▤")+'</div>'+
 '<section class="tp-panel">'+tpToolbar("Resigned Employees",resigned.length+' archived records for '+tpEscape(tpPayrollSelectedRestaurant()||"the selected restaurant"),"")+
 '<p class="tp-note">Resigned employees are excluded from ongoing Attendance and Payment Sheets. Use Paid / Due to track their final earned salary. Older records without a settlement can be completed here; past payroll history is retained.</p>'+
 (resigned.length?'<div class="tp-employee-grid">'+resigned.map(function(emp){
  var s=emp.finalSettlement;
  return '<article class="tp-person">'+tpAvatar(emp)+'<div class="tp-person-main"><h3>'+tpEscape(emp.name)+'</h3>'+
   '<p>'+tpEscape(emp.designation)+' · '+tpEscape(emp.restaurant)+'</p>'+
   '<small>Last working date: '+tpDate(emp.leftAt||emp.lastWorkingDate)+'</small>'+
   '<small>'+tpEscape(tpDepartureStatus(emp))+(s?' · Final salary '+tpMoney(s.net):'')+'</small></div>'+
   '<div class="tp-person-buttons">'+tpButton("view-employee","View History","tp-light",'data-id="'+tpEscape(emp.id)+'"')+
   (s?tpButton("pdf-final-salary","Settlement PDF","tp-light",'data-id="'+tpEscape(emp.id)+'"'):"")+
   (s&&s.status==="DUE"?tpButton("record-final-paid","Record Paid","tp-light",'data-id="'+tpEscape(emp.id)+'"'):"")+
   (!s?tpButton("complete-final-settlement","Record Final Salary","tp-light",'data-id="'+tpEscape(emp.id)+'"'):"")+
   tpButton("rejoin-employee","Rejoin Employee","tp-primary",'data-id="'+tpEscape(emp.id)+'"')+'</div></article>';
 }).join("")+'</div>':'<p class="tp-note">No resigned employees have been recorded for this restaurant.</p>')+'</section>';
 if(tpArcForm&&tpArcForm.type==="rejoin"){var e=tpEmp(tpArcForm.id);if(e&&tpArcLeft(e))out=tpArcRejoinForm(e)+out;}
 else if(tpArcForm&&tpArcForm.type==="settlement"){var old=tpEmp(tpArcForm.id);if(old&&tpArcLeft(old)&&!old.finalSettlement)out=tpArcLeftForm(old)+out;}
 else if(tpArcForm&&tpArcForm.type==="payment"){var payee=tpEmp(tpArcForm.id);if(payee&&tpArcLeft(payee)&&payee.finalSettlement&&payee.finalSettlement.status==="DUE")out=tpDeparturePaymentForm(payee)+out;}
 else if(tpViewing){var viewed=tpEmp(tpViewing);if(viewed&&tpArcLeft(viewed))out=tpEmployeeProfile(viewed)+out;}
 return out;
};
var tpDepartureOriginalAction=tpHandleAction;
tpHandleAction=function(button){
 var act=button.dataset.tpAction,emp=tpEmp(button.dataset.id);
 if(emp&&!tpPayrollMatchesRestaurant(emp))return uxAlert("Select the employee\u2019s restaurant to manage this record.");
 if(act==="complete-final-settlement"){
  if(!emp||!tpArcLeft(emp)||emp.finalSettlement)return;
  tpArcForm={type:"settlement",id:emp.id};tpEditing=null;tpViewing=null;tpTab="left";draw();return;
 }
 if(act==="record-final-paid"){
  if(!emp||!tpArcLeft(emp)||!emp.finalSettlement||emp.finalSettlement.status!=="DUE")return;
  tpArcForm={type:"payment",id:emp.id};tpEditing=null;tpViewing=null;tpTab="left";draw();return;
 }
 if(act==="pdf-final-salary")return tpDepartureDownloadPDF(emp);
 return tpDepartureOriginalAction(button);
};
var tpDeparturePreviousProfile=tpEmployeeProfile;
tpEmployeeProfile=function(emp){
 var html=tpDeparturePreviousProfile(emp);
 if(!emp||!emp.left)return html;
 var s=emp.finalSettlement;
 var block='<div class="tp-note"><strong>'+tpEscape(tpDepartureStatus(emp))+'</strong> · Last working date: '+tpDate(emp.leftAt||emp.lastWorkingDate)+
 '</div>'+(s?'<div class="tp-note"><strong>Final salary: '+tpMoney(s.net)+'</strong> · '+(s.status==="PAID"?"Paid on "+tpDate(s.paidAt):"Payment due")+
 ' · '+tpEscape(s.method||emp.method)+'</div>'+
 '<div class="tp-actions">'+
 tpButton("pdf-final-salary","Download Final Salary PDF","tp-light",'data-id="'+tpEscape(emp.id)+'"')+
 (s.status==="DUE"?tpButton("record-final-paid","Record Salary Paid","tp-primary",'data-id="'+tpEscape(emp.id)+'"'):"")+'</div>':"");
 var pos=html.lastIndexOf("</section>");
 return pos>=0?html.slice(0,pos)+block+html.slice(pos):html+block;
};
var tpDepartureBaseHistory=tpArcHistory;
tpArcHistory=function(emp){
 var output=tpDepartureBaseHistory(emp),records=tpArcCareer(emp).filter(function(e){return e.finalSettlement;});
 var rows=records.map(function(e){
  var s=e.finalSettlement;
  return '<tr><td>'+tpDate(e.leftAt||e.lastWorkingDate)+'</td><td>'+tpEscape(s.month)+'</td><td>'+tpMoney(s.net)+'</td>'+
   '<td>'+tpEscape(s.status==="PAID"?"Paid":"Due")+'</td><td>'+tpDate(s.paidAt)+'</td><td>'+tpEscape(s.method||e.method)+'</td></tr>';
 });
 var at=output.lastIndexOf('</div>');
 var addition='<h3>Final salary settlement history</h3>'+
   (rows.length?tpTable(["Last working day","Salary month","Net payable","Status","Payment date","Method"],rows):
   '<p class="tp-note">No final resignation settlements recorded.</p>');
 return at>=0?output.slice(0,at)+addition+output.slice(at):output+addition;
};
document.addEventListener("submit",function(ev){
 if(!ev.target||ev.target.id!=="tp-departure-form")return;
 ev.preventDefault();ev.stopImmediatePropagation();
 var form=ev.target,emp=tpEmp(form.dataset.id),
     date=form.querySelector("#tp-departure-date").value,
     oldEntry=emp&&tpArcLeft(emp)&&!emp.finalSettlement;
 if(!emp||!tpPayrollMatchesRestaurant(emp)||emp.finalSettlement||(!oldEntry&&emp.active===false))
  return uxAlert("Employee resignation is not eligible in this restaurant.");
 if(!tpArcDate(date)||date<emp.joined||date>tpToday()||
  (oldEntry&&date!==(emp.leftAt||emp.lastWorkingDate)))
  return uxAlert("Enter a valid last working date for this employment period.");
 var month=date.slice(0,7),period=tpGetPeriod(month),days=null,calc=null;
 if(period.finalized===true||period.locked===true)
  return uxAlert("This payroll month is finalized or locked and cannot be changed.");
 if(tpIsParcel(emp)){
  calc=tpCommissionCalculate(emp,period);
  if(!calc)return uxAlert("Enter final commission in Attendance before recording a parcel boy's resignation.");
 }else{
  var field=form.querySelector("#tp-departure-days"),cap=tpDepartureMaxDays(emp,date);
  days=tpInputDays(field&&field.value);
  if(days===null||days>cap)return uxAlert("Actual worked days must be between 0 and "+cap+" for this employment period.");
  calc=tpCompute(emp,period,days,month);
  if(!calc)return uxAlert("Could not calculate the final salary.");
 }
 var status=form.querySelector("#tp-departure-payment").value,
     method=form.querySelector("#tp-departure-method").value,
     paidAt=form.querySelector("#tp-departure-paid-date").value,
     notes=tpTrim(form.querySelector("#tp-departure-notes").value,180);
 if(!["DUE","PAID"].includes(status)||!["CASH","CHEQUE"].includes(method))return uxAlert("Choose Paid or Due and a payment method.");
 if(status==="PAID"&&(!tpArcDate(paidAt)||paidAt>tpToday()))return uxAlert("Enter a valid date when final salary was paid.");
 if(!confirm("Record "+emp.name+"'s final earned salary "+tpMoney(calc.net)+
  " as "+(status==="PAID"?"PAID":"DUE")+"? Employment history will be preserved."))return;
 var before=JSON.stringify(tpData);
 emp.active=false;emp.left=true;emp.leftAt=date;emp.lastWorkingDate=date;emp.closedAt=emp.closedAt||tpStamp();
 emp.exitType="resigned";
 if(days!==null&&!oldEntry){
  period.days[emp.id]=String(days);
  period.snapshots[emp.id]=tpSnapshot(emp,calc,days);
 }
 emp.finalSettlement={month:month,net:calc.net,gross:calc.gross,earned:calc.earned,leavePay:calc.leavePay||0,
   deductions:calc.withheld||0,advance:calc.paidAdvance||0,workedDays:days,
   commission:calc.commissionTotal||0,gst:calc.gst||0,
   method:method,status:status,paidAt:status==="PAID"?paidAt:null,notes:notes,recordedAt:tpStamp()};
 period.updatedAt=tpStamp();
 if(!tpSave()){tpData=JSON.parse(before);return;}
 tpArcForm=null;tpViewing=null;tpTab="left";draw();
 showToast(emp.name+" resigned · final salary "+(status==="PAID"?"paid":"due")+".");
},true);
document.addEventListener("submit",function(ev){
 if(!ev.target||ev.target.id!=="tp-settle-payment-form")return;
 ev.preventDefault();ev.stopImmediatePropagation();
 var form=ev.target,emp=tpEmp(form.dataset.id),settlement=emp&&emp.finalSettlement;
 if(!emp||!tpPayrollMatchesRestaurant(emp)||!tpArcLeft(emp)||!settlement||settlement.status!=="DUE")return uxAlert("There is no unpaid final salary settlement in this restaurant.");
 var date=form.querySelector("#tp-settle-date").value,method=form.querySelector("#tp-settle-method").value;
 if(!tpArcDate(date)||date>tpToday()||!["CASH","CHEQUE"].includes(method))return uxAlert("Enter a valid final salary payment date and method.");
 if(!confirm("Confirm "+tpMoney(settlement.net)+" final salary paid to "+emp.name+" by "+method+" on "+date+"?"))return;
 var before=JSON.stringify(tpData);
 settlement.status="PAID";settlement.paidAt=date;settlement.method=method;settlement.updatedAt=tpStamp();
 if(!tpSave()){tpData=JSON.parse(before);return;}
 tpArcForm=null;tpViewing=emp.id;tpTab="left";draw();showToast("Final salary payment recorded.");
},true);
function tpDepartureDownloadPDF(emp){
 if(!emp||!emp.finalSettlement)return uxAlert("No final salary settlement for this employee.");
 var s=emp.finalSettlement;
 try{
  var page=tpPdfCanvas(),ctx=page.ctx;
  tpPdfHeader(ctx,"FINAL SALARY SETTLEMENT",s.month,"Archive · Employee's last working date "+String(emp.leftAt||""));
  var rows=[["Employee",emp.name],["Designation",emp.designation],["Restaurant",emp.restaurant],
   ["Joining date",emp.joined],["Last working date",emp.leftAt||emp.lastWorkingDate],
   ["Salary period",s.month],["Worked days",s.workedDays===null?"Commission-based":String(s.workedDays)],
   ["Gross / commission",tpMoney(s.gross)],["Earned leave",tpMoney(s.leavePay)],
   ["Deductions",tpMoney(s.deductions)],["Net final salary",tpMoney(s.net)],
   ["Payment status",s.status==="PAID"?"PAID":"DUE"],["Date paid",s.paidAt||"—"],
   ["Payment method",s.method],
    ["Remarks",s.notes||"—"]];
  rows.forEach(function(row,i){
   var y=165+i*35;
   if(i%2===0){ctx.fillStyle="#f5f8f7";ctx.fillRect(38,y-19,519,31);}
   tpPdfText(ctx,row[0],48,y,10,true,"#56727a",173);
   tpPdfText(ctx,row[1],230,y,10,i===10||i===11,"#234353",317);
  });
  tpPdfFooter(ctx,1);
  var file=tpPdfBuild([tpPdfImage(page)]);
  tpDeliverPdf(file,"final-salary-settlement-"+String(emp.name).replace(/[^a-z0-9_-]+/gi,"-")+"-"+s.month+".pdf");
 }catch(error){uxAlert("Could not create final salary PDF: "+(error&&error.message||"Unknown error"));}
}
var depCSS=document.createElement("style");
depCSS.textContent="#tp-departure-pay-fields[hidden]{display:none!important}#tp-departure-pay-fields{background:#fafcfb;border:1px solid #dfebe4;border-radius:11px;padding:15px}";
document.head.appendChild(depCSS);

})();