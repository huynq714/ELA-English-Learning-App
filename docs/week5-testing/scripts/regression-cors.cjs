const assert=require('node:assert/strict');
const {writeFileSync}=require('node:fs');
const {resolve}=require('node:path');
const {chromium}=require(resolve('.artifacts/quiz-tools/node_modules/playwright-core'));
(async()=>{
 const results=[];
 for(const [origin,expected] of [['http://localhost:58126',200],['https://untrusted.example',403],['http://localhost:58126.evil.example',403]]){
  const r=await fetch('http://127.0.0.1:58125/api/v1/auth/login',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});
  assert.equal(r.status,expected);results.push({origin,status:r.status,allowOrigin:r.headers.get('access-control-allow-origin')});
 }
 const r=await fetch('http://127.0.0.1:58125/api/v1/review/summary',{headers:{Origin:'http://localhost:58126'}});assert.equal(r.status,401);
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{const page=await browser.newPage();await page.goto('http://localhost:58126/login');
 const status=await page.evaluate(async()=> (await fetch('http://127.0.0.1:58125/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'missing-cors@example.test',password:'Wrong123'})})).status);
 assert.equal(status,401);results.push({browserCrossOriginPost:status,meaning:'Browser đọc được 401 từ API; không bị CORS chặn, không bypass auth'});
 }finally{await browser.close()}
 writeFileSync('docs/week5-testing/evidence/representative/cors-after.json',JSON.stringify(results,null,2));console.log('PASS allowed preflight, rejected origins, protected JWT and real browser cross-origin POST');
})().catch(e=>{console.error(e);process.exitCode=1});
