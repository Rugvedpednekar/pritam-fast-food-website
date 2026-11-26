import {test,expect} from "bun:test";
import {readFileSync} from "node:fs";
import {deflateRawSync} from "node:zlib";
const core=readFileSync(new URL("../src/client/payroll-employee-import-core.js",import.meta.url),"utf8");
const ui=readFileSync(new URL("../src/client/payroll-employee-import-ui.js",import.meta.url),"utf8");
const server=readFileSync(new URL("../src/server.ts",import.meta.url),"utf8");
const api:any=new Function(core+";return {tpImportCSV,tpImportReadColumns,tpImportNormalizeEmployee,tpImportReadWorkbook,tpImportZipRead,tpImportExcelDate,TP_IMPORT_COLUMNS};")();
const restaurants=[{id:"r1",name:"Pritam Fast Food",active:true},{id:"r2",name:"Classic Veg",active:true}];
const headings=api.TP_IMPORT_COLUMNS.map((x:any)=>x.label);
function csv(rows:string[][]){return [headings,...rows].map(row=>row.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(",")).join("\r\n");}
function row(overrides:Record<string,string>={}){
 const data:any={name:"Meera",designation:"Cashier",joined:"10/11/2026",restaurant:"Pritam Fast Food",type:"Salaried",
 salary:"25000",method:"CHEQUE",leave:"2",gst:"",monthlyId:"10",...overrides};
 return api.TP_IMPORT_COLUMNS.map((col:any)=>data[col.key]??"");
}
// XLSX minimum viable ZIP with both compressed and uncompressed members.
function zip(entries:Record<string,string>,compressed=false){
 const encoder=new TextEncoder(),files:any[]=[],centrals:any[]=[];
 let offset=0;
 const u16=(v:DataView,i:number,n:number)=>v.setUint16(i,n,true);
 const u32=(v:DataView,i:number,n:number)=>v.setUint32(i,n,true);
 for(const [path,value] of Object.entries(entries)){
  const name=encoder.encode(path),payload=encoder.encode(value);
  const encoded=compressed?new Uint8Array(deflateRawSync(payload)):payload;
  const local=new Uint8Array(30+name.length+encoded.length),lv=new DataView(local.buffer);
  u32(lv,0,0x04034b50);u16(lv,8,compressed?8:0);u32(lv,18,encoded.length);u32(lv,22,payload.length);u16(lv,26,name.length);
  local.set(name,30);local.set(encoded,30+name.length);files.push(local);
  const central=new Uint8Array(46+name.length),cv=new DataView(central.buffer);
  u32(cv,0,0x02014b50);u16(cv,10,compressed?8:0);u32(cv,20,encoded.length);u32(cv,24,payload.length);
  u16(cv,28,name.length);u32(cv,42,offset);central.set(name,46);centrals.push(central);offset+=local.length;
 }
 const centralStart=offset,centralBytes=centrals.reduce((n,a)=>n+a.length,0),total=centralStart+centralBytes+22;
 const out=new Uint8Array(total);let pos=0;
 for(const x of [...files,...centrals]){out.set(x,pos);pos+=x.length;}
 const ev=new DataView(out.buffer);u32(ev,pos,0x06054b50);u16(ev,pos+8,centrals.length);u16(ev,pos+10,centrals.length);
 u32(ev,pos+12,centralBytes);u32(ev,pos+16,centralStart);
 return out.buffer;
}
const xmlEsc=(s:string)=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
function workbookXlsx(){
 const all=[headings,row({name:"Aarav"}),row({name:"Priya",type:"Parcel Boy",salary:"",joined:"46321",method:"CASH",monthlyId:"11"})];
 const strings=all.flat().map(String),cells=all.map((r,j)=>'<row r="'+(j+1)+'">'+r.map((v,k)=>{
  const col=String.fromCharCode(65+k),id=strings.indexOf(String(v));
  // Excel numeric date should be converted using column Joining Date's numeric cell.
  if(j===2&&k===2)return '<c r="'+col+(j+1)+'"><v>46321</v></c>';
  return '<c r="'+col+(j+1)+'" t="s"><v>'+id+'</v></c>';
 }).join("")+'</row>').join("");
 const shared='<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+strings.map(x=>'<si><t>'+xmlEsc(x)+'</t></si>').join("")+'</sst>';
 return zip({
  "xl/workbook.xml":'<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Employees" sheetId="1" r:id="rId1"/></sheets></workbook>',
  "xl/_rels/workbook.xml.rels":'<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
  "xl/sharedStrings.xml":shared,
  "xl/worksheets/sheet1.xml":'<worksheet><sheetData>'+cells+'</sheetData></worksheet>'
 },true);
}
test("CSV Excel template fields, escaped commas and salaried/parcel employee validation",()=>{
 const parsed=api.tpImportCSV(csv([row({name:'Aarav, Patil'}),row({name:"Parcel Boy One",type:"Parcel Boy",designation:"",salary:"0",gst:"5"})]));
 const rows=api.tpImportReadColumns(parsed);
 expect(rows).toHaveLength(2);
 const salaried=api.tpImportNormalizeEmployee(rows[0],restaurants,"r1");
 const parcel=api.tpImportNormalizeEmployee(rows[1],restaurants,"r1");
 expect(salaried).toMatchObject({name:"Aarav, Patil",salary:2500000,joined:"2026-11-10",restaurantId:"r1",method:"CHEQUE",leaveAllowance:2});
 expect(parcel).toMatchObject({employeeType:"parcel",designation:"Parcel Boy",salary:0,commissionGstRate:5});
 expect(api.tpImportNormalizeEmployee({...rows[1],restaurant:""},restaurants,"r2").restaurantId).toBe("r2");
});
test("Real compressed Excel XLSX is parsed from first sheet with Excel joining dates",async()=>{
 const rows=api.tpImportReadColumns(await api.tpImportReadWorkbook(workbookXlsx()));
 expect(rows).toHaveLength(2);
 expect(rows[0].name).toBe("Aarav");
 expect(rows[1].name).toBe("Priya");
 expect(api.tpImportNormalizeEmployee(rows[1],restaurants,"r1").joined).toMatch(/^2026-/);
});
test("Bad salary, date, outlet, payment and monthly ID are blocked",()=>{
 const base=api.tpImportReadColumns(api.tpImportCSV(csv([row()])))[0];
 for(const change of [{salary:"-5"},{joined:"31/02/2026"},{restaurant:"Not An Outlet"},{method:"UPI"},{monthlyId:"101"},{type:"Salaried",designation:""}])
  expect(()=>api.tpImportNormalizeEmployee({...base,...change},restaurants,"r1")).toThrow();
});
test("Employee import file does not modify the existing menu importer",()=>{
 expect(server).toContain("./client/payroll-employee-import-core.js");
 expect(server).toContain("./client/payroll-employee-import-ui.js");
 expect(server).toContain("./client/payroll-employee-import.css");
 expect(server).toContain("/*__MENU_EXCEL_IMPORT_JS__*/");
 expect(ui).toContain("Upload → Review → Apply");
 expect(ui).toContain("Apply &amp; Save");
});
