/* Payroll Preview: inspect calculations without making payable transfers or finalized payslips. */
(function(){
"use strict";
var twPayrollMonth=new Date().toISOString().slice(0,7),twPayrollPreview=null,twPayrollEditCache={};
function monthDays(month){var p=String(month).split("-").map(Number);return new Date(Date.UTC(p[0],p[1],0)).getUTCDate();}
function parsePaise(value){
 var s=String(value==null?"":value).trim();
 if(!/^\d{1,8}(\.\d{1,2})?$/.test(s))return null;
 var parts=s.split(".");
 return Number(parts[0])*100+Number((parts[1]||"").padEnd(2,"0"));
}
function employeeList(){
 return (data.employees||[]).filter(function(emp){
  var owner=emp.restaurantId||emp.branchId||emp.restaurant||selected;
  return String(owner)===String(selected)&&emp.active!==false&&emp.deleted!==true;
 });
}
function employeeKey(emp,i){return String(emp.id||emp.employeeId||"legacy-"+i);}
function salaryDefault(emp){
 // These property names explicitly indicate units; ambiguous legacy salary fields are left for review.
 if(Number.isSafeInteger(emp.monthlySalaryPaise))return (emp.monthlySalaryPaise/100).toFixed(2);
 if(Number.isSafeInteger(emp.salaryPaise))return (emp.salaryPaise/100).toFixed(2);
 if(typeof emp.salaryRupees==="number")return emp.salaryRupees.toFixed(2);
 if(typeof emp.monthlySalaryRupees==="number")return emp.monthlySalaryRupees.toFixed(2);
 return "";
}
function draftKey(emp,i){return selected+":"+twPayrollMonth+":"+employeeKey(emp,i);}
function calculate(row,days){
 var gross=parsePaise(row.salary);
 var leave=Number(row.leave),allowed=Number(row.allowance);
 if(gross===null||gross<=0)throw Error("Enter a valid monthly salary above ₹0.");
 if(!Number.isInteger(leave)||leave<0||leave>days)throw Error("Leave taken must be 0–"+days+" full days.");
 if(!Number.isInteger(allowed)||allowed<0||allowed>days)throw Error("Paid leave allowance must be 0–"+days+" full days.");
 var unpaid=Math.max(0,leave-allowed);
 var deducted=Math.round(gross*unpaid/days);
 return {gross:gross,unpaidDays:unpaid,deduction:deducted,net:gross-deducted};
}
function currentRows(){
 var rows=employeeList(),days=monthDays(twPayrollMonth);
 return rows.map(function(emp,i){
  var key=draftKey(emp,i),draft=(data.payrollDrafts||{})[key]||{};
  var row=twPayrollEditCache[key]||{salary:draft.salary??salaryDefault(emp),leave:draft.leave??"0",allowance:draft.allowance??String(emp.paidLeavesPerMonth??emp.leavesPerMonth??emp.monthlyLeaves??0)};
  return {emp:emp,key:key,input:row,calc:(function(){try{return calculate(row,days);}catch(err){return null;}})()};
 });
}
function renderPayroll(){
 var rows=currentRows(),days=monthDays(twPayrollMonth);
 var total=rows.reduce(function(s,r){return s+(r.calc?r.calc.net:0);},0);
 var validRows=rows.filter(function(r){return r.calc!==null;}).length;
 var out=header("Payroll Preview","Check monthly salary and leave calculations before enabling real payroll.");
 out+='<div class="notice">TEST MODE ONLY — These are estimates, not finalized payroll, tax deductions, payslips or payment instructions. Formula: monthly salary − (unpaid full days × salary ÷ calendar days in month), rounded to paise. Leave above the paid-leave allowance is unpaid. No statutory tax, PF, ESIC, advances or half-days are calculated.</div>';
 out+='<div class="panel" style="margin-top:15px"><div class="table-toolbar"><div><h2 class="panel-title">Payroll for '+e(selectedName())+'</h2><p class="panel-sub">Choose a month, enter or verify each employee’s salary and leave, then recalculate.</p></div><div class="quick"><button class="btn" data-tw-payroll="recalculate">Recalculate</button><button class="btn primary" data-tw-payroll="save">Save Preview Draft</button><button class="btn" data-tw-payroll="csv">Export Preview CSV</button></div></div>';
 out+='<div class="field" style="max-width:220px"><label for="tw-payroll-month">Payroll month</label><input id="tw-payroll-month" class="input" type="month" value="'+e(twPayrollMonth)+'"></div>';
 if(!rows.length){out+='<div class="notice">No employees are assigned to this restaurant. Add employees first, then return to Payroll.</div><button class="btn primary" data-route="employees">Open Employees</button>';}
 else{
 out+='<div class="table-wrap tw-payroll-table" style="margin-top:16px"><table><thead><tr><th>Employee</th><th>Monthly salary (₹)</th><th>Leave taken (days)</th><th>Paid leave (days)</th><th>Unpaid days</th><th>Deduction</th><th>Estimated payable</th></tr></thead><tbody>';
 rows.forEach(function(r){
  var emp=r.emp,source=r.input;
  out+='<tr data-tw-payroll-key="'+e(r.key)+'"><td><strong>'+e(emp.name||emp.fullName||emp.employeeName||"Employee")+'</strong><div class="sub">'+e(emp.role||emp.designation||"")+'</div></td>'+
  '<td><input class="input" inputmode="decimal" type="text" data-tw-payroll-field="salary" value="'+e(source.salary)+'" placeholder="Enter salary"></td>'+
  '<td><input class="input" type="number" min="0" max="'+days+'" step="1" data-tw-payroll-field="leave" value="'+e(source.leave)+'"></td>'+
  '<td><input class="input" type="number" min="0" max="'+days+'" step="1" data-tw-payroll-field="allowance" value="'+e(source.allowance)+'"></td>'+
  '<td>'+e(r.calc?r.calc.unpaidDays:"—")+'</td><td>'+e(r.calc?money(r.calc.deduction):"—")+'</td><td><strong>'+e(r.calc?money(r.calc.net):"Check inputs")+'</strong></td></tr>';
 });
 out+='</tbody></table></div><p class="sub">Calculated: '+validRows+'/'+rows.length+' employees · '+days+' calendar days · Preview total: <strong>'+money(total)+'</strong></p>';
 }
 out+='<p class="sub">The preview is saved as a draft only. No employee is marked paid, and no real payroll records are finalized.</p></div>';
 return out;
}
payroll=renderPayroll;
function capture(){
 document.querySelectorAll("tr[data-tw-payroll-key]").forEach(function(tr){
  var key=tr.getAttribute("data-tw-payroll-key"),entry=Object.assign({},twPayrollEditCache[key]||{});
  tr.querySelectorAll("input[data-tw-payroll-field]").forEach(function(input){entry[input.dataset.twPayrollField]=input.value;});
  twPayrollEditCache[key]=entry;
 });
}
document.addEventListener("change",function(evt){
 if(evt.target.id!=="tw-payroll-month")return;
 var val=evt.target.value;
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(val))return;
 capture();twPayrollMonth=val;draw();
},true);
document.addEventListener("click",function(evt){
 var btn=evt.target.closest&&evt.target.closest("button[data-tw-payroll]");
 if(!btn)return;
 evt.preventDefault();evt.stopImmediatePropagation();
 if(tab!=="payroll")return;
 capture();
 var action=btn.dataset.twPayroll,rows=currentRows();
 var days=monthDays(twPayrollMonth);
 if(!rows.length)return uxAlert("Add an employee before calculating payroll.");
 var invalid=rows.find(function(r){try{calculate(r.input,days);return false;}catch(err){r.error=err.message;return true;}});
 if(invalid)return uxAlert((invalid.emp.name||"Employee")+": "+invalid.error);
 if(action==="recalculate"){draw();showToast("Payroll preview recalculated.");return;}
 if(action==="save"){
  if(!cloudReady||cloudBusy||cloudPending||cloudConflict)return uxAlert("Cloud synchronization must complete before saving payroll drafts.");
  var before=JSON.stringify(data);
  if(!data.payrollDrafts)data.payrollDrafts={};
  rows.forEach(function(r){data.payrollDrafts[r.key]={salary:r.input.salary,leave:r.input.leave,allowance:r.input.allowance,editedAt:new Date().toISOString()};});
  if(!saveTheData(before))return;draw();showToast("Payroll preview draft saved. Not finalized.");
  return;
 }
 if(action==="csv"){
  var dataRows=[["Month","Employee","Salary INR","Leave taken","Paid leave","Unpaid days","Deduction INR","Estimated net INR"]];
  rows.forEach(function(r){var c=calculate(r.input,days);dataRows.push([twPayrollMonth,r.emp.name||r.emp.fullName||"Employee",r.input.salary,r.input.leave,r.input.allowance,c.unpaidDays,(c.deduction/100).toFixed(2),(c.net/100).toFixed(2)]);});
  var content=dataRows.map(function(row){return row.map(function(v){return '"'+String(v).replace(/"/g,'""')+'"';}).join(",");}).join("\r\n");
  var blob=new Blob([content],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="payroll-preview-"+twPayrollMonth+".csv";document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1500);
 }
},true);
var style=document.createElement("style");
style.textContent='.tw-payroll-table table{min-width:850px}.tw-payroll-table input{min-width:88px;max-width:145px;padding:7px!important}.tw-payroll-table th{font-size:11px}.tw-payroll-table td{vertical-align:middle}';
document.head.appendChild(style);
})();