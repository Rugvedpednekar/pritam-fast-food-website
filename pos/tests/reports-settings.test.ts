import {test,expect} from "bun:test";
import {readFileSync} from "node:fs";

const html=readFileSync(new URL("../src/client/index.html",import.meta.url),"utf8");
const server=readFileSync(new URL("../src/server.ts",import.meta.url),"utf8");
const source=readFileSync(new URL("../src/client/reports-settings.js",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/client/dark-theme.css",import.meta.url),"utf8");

function mountReportsSettings(){
 const seen:string[]=[];
 const lightClasses=new Set<string>();
 const surface={classList:{contains:(name:string)=>lightClasses.has(name),add:(name:string)=>lightClasses.add(name)}};
 const content={
  classList:{toggle:(name:string,enabled:boolean)=>seen.push(name+":"+enabled)},
  querySelectorAll:()=>[surface]
 };
 const stub={
  getElementById:(id:string)=>id==="content"?content:null
 };
 const code=source.replace(/\}\)\(\);\s*$/, `return {settings, reports, draw};})();`);
 const runtime=new Function("settings","reports","draw","tab","document","window","MutationObserver","return "+code)(
  ()=>'<div class="heading">Settings</div><div class="panel">Invoice configuration</div>',
  ()=>'<section class="report-panel">Saved reports</section>',
  ()=>"rendered","reports",stub,
  {getComputedStyle:()=>({backgroundColor:"rgb(255, 255, 255)"})},undefined
 );
 return {runtime,seen,lightClasses};
}

test("Reports is absent from Workspace navigation but still has a route under Settings",()=>{
 expect(html).toContain('filter(function(k){return k!=="reports";})');
 expect(html).toContain('tab==="reports"&&k==="settings"');
 expect(html).toContain("Workspace / Settings / Reports");
 expect(server).toContain("./client/reports-settings.js");
 const {runtime}=mountReportsSettings();
 const settings=runtime.settings();
 expect(settings.indexOf("Open Reports")).toBeGreaterThan(settings.indexOf("Settings"));
 expect(settings.indexOf("Open Reports")).toBeLessThan(settings.indexOf("Invoice configuration"));
 expect(settings).toContain('data-route="reports"');
 const reports=runtime.reports();
 expect(reports).toContain('data-route="settings"');
 expect(reports).toContain("Saved reports");
});

test("Reports light surfaces receive scoped dark styling while preserving their renderer",()=>{
 const {runtime,seen,lightClasses}=mountReportsSettings();
 expect(runtime.draw()).toBe("rendered");
 expect(seen).toContain("tw-settings-reports:true");
 expect(lightClasses.has("tw-report-light-surface")).toBe(true);
 expect(css).toContain("#content.tw-settings-reports .tw-report-light-surface");
 expect(css).toContain("color:#f2faf7!important");
 expect(css).toContain("@media print");
});
