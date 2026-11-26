/* Review, validate and apply Excel/CSV employee imports to local payroll. */
(function(){
"use strict";
var impOpen=false,impPreview=null,impError="",impBusy=false;
function impIdentity(emp){
 return [String(emp.restaurantId||"").toLowerCase(),String(emp.name||"").trim().toLowerCase().replace(/\s+/g," "),String(emp.joined||"")].join("|");
}
function impReview(raw,month,restaurantId){
 var existing=new Set(tpData.employees.map(impIdentity)),seen=new Set(),used=new Set();
 var period=tpData.periods[month]||{};
 Object.keys(period.serials||{}).forEach(function(id){
  var emp=tpEmp(id),n=tpSerialValue(period.serials[id]);
  if(emp&&emp.active!==false&&!emp.left&&n!==null)used.add(String(emp.restaurantId||"")+"|"+n);
 });
 return raw.map(function(row){
  try{
   var record=tpImportNormalizeEmployee(row,data.restaurants||[],restaurantId);
   var identity=impIdentity(record);
   if(existing.has(identity)||seen.has(identity))
    return {raw:row,record:record,status:"skip",note:"Already in payroll or duplicated in this file"};
   if(record.monthlyId!==null){
    var serialKey=record.restaurantId+"|"+record.monthlyId;
    if(used.has(serialKey))return {raw:row,record:record,status:"error",note:"Monthly ID "+record.monthlyId+" already assigned for "+month};
    used.add(serialKey);
   }
   seen.add(identity);
   return {raw:row,record:record,status:"add",note:"New employee"};
  }catch(err){return {raw:row,record:null,status:"error",note:err.message||"Invalid employee"};}
 });
}
function impCounts(rows){
 return {add:rows.filter(x=>x.status==="add").length,
  skip:rows.filter(x=>x.status==="skip").length,error:rows.filter(x=>x.status==="error").length};
}
function impTemplate(){
 var csv="\uFEFF"+TP_IMPORT_COLUMNS.map(function(c){return '"'+c.label.replace(/"/g,'""')+'"';}).join(",")+"\r\n";
 var url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
 var a=document.createElement("a");a.href=url;a.download="Employee_Import_Template.csv";
 document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},2000);
}
function impDetails(){
 if(!impOpen)return "";
 var html='<div class="tp-import-panel"><div class="tp-import-control">'+
  '<label for="tp-employee-excel-file">Choose Excel file (.xlsx or .csv)</label>'+
  '<input id="tp-employee-excel-file" type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"'+(impBusy?' disabled':'')+'></div>'+
  '<p class="tp-import-hint">Use the first worksheet. Blank Restaurant uses the selected outlet. Dates: YYYY-MM-DD or DD/MM/YYYY. Salary is in INR. Leave defaults to 2 days; Parcel Boy has commission only with 5% GST deduction by default. Monthly ID (1–100) is optional for '+tpEscape(tpMonthLabel(tpPeriod))+'.</p>';
 if(impBusy)html+='<p role="status" class="tp-import-hint">Reading employee file…</p>';
 if(impError)html+='<p class="tp-import-error" role="alert">'+tpEscape(impError)+'</p>';
 if(impPreview){
  var rows=impReview(impPreview.raw,impPreview.month,impPreview.restaurantId);
  var count=impCounts(rows),stale=impPreview.month!==tpPeriod||impPreview.restaurantId!==selected;
  html+='<div class="tp-import-review-head"><h3>Review import · '+rows.length+' employees</h3>'+
   '<p class="tp-import-hint">'+tpEscape(impPreview.name)+' · '+count.add+' new · '+count.skip+' already present · '+count.error+' errors. No changes applied yet.</p></div>';
  if(stale)html+='<p class="tp-import-error">Restaurant or payroll month changed. Upload the file again.</p>';
  html+='<div class="tp-import-table-wrap"><table class="tp-import-table"><thead><tr><th>Row</th><th>Name</th>'+
   '<th>Restaurant</th><th>Type</th><th>Designation</th><th>Joining Date</th><th>Salary</th><th>Method</th><th>Monthly ID</th><th>Review</th></tr></thead><tbody>'+
   rows.map(function(item){
    var r=item.record||item.raw;
    return '<tr><td>'+tpEscape(item.raw.excelRow)+'</td><td>'+tpEscape(r.name)+'</td>'+
    '<td>'+tpEscape(r.restaurant||"Selected outlet")+'</td>'+
    '<td>'+tpEscape(r.employeeType==="parcel"?"Parcel Boy":r.employeeType==="salaried"?"Salaried":r.type||"Salaried")+'</td>'+
    '<td>'+tpEscape(r.designation||"—")+'</td><td>'+tpEscape(r.joined||"—")+'</td>'+
    '<td>'+tpEscape(item.record?(item.record.employeeType==="parcel"?"Commission only":tpMoney(item.record.salary)):r.salary||"—")+'</td>'+
    '<td>'+tpEscape(r.method||"CASH")+'</td><td>'+tpEscape(r.monthlyId===null?"—":r.monthlyId||"—")+'</td>'+
    '<td><span class="tp-import-status tp-import-'+item.status+'">'+(item.status==="add"?"Add":item.status==="skip"?"Skip":"Error")+'</span>'+
    '<small>'+tpEscape(item.note)+'</small></td></tr>';
   }).join("")+'</tbody></table></div>';
  html+='<div class="tp-actions tp-import-actions"><button type="button" class="tp-button tp-primary" data-tp-import="apply"'+(stale||count.error||!count.add?' disabled':'')+'>'+
   'Apply &amp; Save '+count.add+' Employee'+(count.add===1?'':'s')+'</button>'+
   '<button type="button" class="tp-button" data-tp-import="clear">Clear Preview</button></div>';
  if(count.error)html+='<p class="tp-import-error">Correct invalid rows in Excel and upload again. No employees will be saved until the review has zero errors.</p>';
 }
 return html+'</div>';
}
var impOriginalPage=tpEmployeesPage;
tpEmployeesPage=function(){
 var roster=impOriginalPage.apply(this,arguments);
 var box='<section class="tp-panel tp-import-root"><div class="tp-import-heading"><div><h3>Import Employees from Excel</h3>'+
 '<p class="tp-import-hint">Upload → Review → Apply &amp; Save. Existing employees and previous payroll records are never overwritten.</p></div>'+
 '<div class="tp-actions"><button class="tp-button tp-primary" type="button" data-tp-import="toggle">'+(impOpen?'Close Import':'Import Employees')+'</button>'+
 '<button class="tp-button" type="button" data-tp-import="template">Download Excel Template (CSV)</button></div></div>'+
 impDetails()+'</section>';
 return box+roster;
};
async function impRead(file){
 if(!file)throw Error("Choose an employee file.");
 if(file.size>4000000)throw Error("Employee import file must be smaller than 4 MB.");
 if(!/\.(xlsx|csv)$/i.test(file.name))throw Error("Choose an Excel .xlsx file or a .csv file.");
 var rows=/\.csv$/i.test(file.name)?tpImportCSV(await file.text()):await tpImportReadWorkbook(await file.arrayBuffer());
 return tpImportReadColumns(rows);
}
function impApply(){
 if(impBusy||!impPreview)return;
 if(impPreview.month!==tpPeriod||impPreview.restaurantId!==selected){
  impError="Payroll month or restaurant changed. Upload the file again.";draw();return;
 }
 var rows=impReview(impPreview.raw,impPreview.month,impPreview.restaurantId),counts=impCounts(rows);
 if(counts.error||!counts.add){impError=counts.error?"Fix all invalid rows before applying.":"No new employees found.";draw();return;}
 var month=tpPeriod,period=tpData.periods[month]||{};
 if(period.finalized||period.locked){impError="This payroll month is finalized or locked. Choose an unlocked month.";draw();return;}
 var backup=JSON.stringify(tpData),added=0;
 try{
  period=tpGetPeriod(month);
  rows.forEach(function(item){
   if(item.status!=="add")return;
   var employee=Object.assign({id:tpId()},item.record);
   delete employee.monthlyId;
   while(tpEmp(employee.id))employee.id=tpId();
   tpData.employees.push(employee);
   if(employee.employeeType!=="parcel")period.salaries[employee.id]=employee.salary;
   if(item.record.monthlyId!==null)period.serials[employee.id]=item.record.monthlyId;
   added++;
  });
  if(!tpSave())throw Error("Could not save this import to the browser. No employees were added.");
 }catch(err){tpData=JSON.parse(backup);impError=err.message||"Import failed, no employees were added.";draw();return;}
 impPreview=null;impError="";impOpen=false;draw();
 showToast(added+" employee"+(added===1?"":"s")+" added to payroll on this device.");
}
document.addEventListener("click",function(event){
 var button=event.target.closest&&event.target.closest("[data-tp-import]");
 if(!button||tab!=="payroll"||tpTab!=="employees")return;
 event.preventDefault();event.stopImmediatePropagation();
 var action=button.getAttribute("data-tp-import");
 if(action==="template")impTemplate();
 else if(action==="toggle"){impOpen=!impOpen;impError="";impPreview=null;draw();}
 else if(action==="clear"){impPreview=null;impError="";draw();}
 else if(action==="apply")impApply();
},true);
document.addEventListener("change",async function(event){
 if(!event.target||event.target.id!=="tp-employee-excel-file"||tab!=="payroll"||tpTab!=="employees")return;
 var file=event.target.files&&event.target.files[0];if(!file)return;
 impBusy=true;impPreview=null;impError="";
 try{var rows=await impRead(file);impPreview={name:file.name,raw:rows,month:tpPeriod,restaurantId:selected};}
 catch(err){impError=err.message||"Could not read the employee file.";}
 finally{impBusy=false;draw();}
},true);
})();