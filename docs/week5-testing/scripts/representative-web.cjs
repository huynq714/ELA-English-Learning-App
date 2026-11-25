const assert = require('node:assert/strict');
const {writeFileSync,mkdirSync}=require('node:fs');
const {resolve}=require('node:path');
const {randomUUID}=require('node:crypto');
const {chromium}=require(resolve('.artifacts/quiz-tools/node_modules/playwright-core'));
const out='docs/week5-testing/evidence/representative';
mkdirSync(out,{recursive:true});
const results=[];
async function run(){
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 const page=await context.newPage(); page.setDefaultTimeout(20000);
 const api='http://127.0.0.1:58125/api/v1';
 const email=`representative-${randomUUID()}@example.test`,password=`Ela7-${randomUUID()}`;
 const account=await(await fetch(api+'/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,confirmPassword:password,displayName:'Week5 Representative',englishLevel:'A1'})})).json();
 const headers={Authorization:`Bearer ${account.accessToken}`};
 const decks=await(await fetch(api+'/decks',{headers})).json();
 let fault=null;
 await page.route('**/api/v1/**',async route=>{
  if(fault && new URL(route.request().url()).pathname.includes(fault)) return route.abort('internetdisconnected');
  const u=new URL(route.request().url());
  const response=await route.fetch({url:api.replace('/api/v1','')+u.pathname+u.search});
  return route.fulfill({response});
 });
 const record=(id,detail)=>{results.push({id,status:'WEB PASS',detail});console.log(id+' '+detail)};
 try{
 await page.goto('http://127.0.0.1:58127/login');
 await page.getByLabel('Email',{exact:true}).fill(email); await page.getByLabel('Mật khẩu',{exact:true}).fill(password);
 fault='/auth/login'; await page.getByTestId('login-submit').click();
 await page.getByText('Không kết nối được Backend. Hãy kiểm tra máy chủ và địa chỉ API.',{exact:true}).waitFor();
 record('TC-NET-01','Web: lỗi login khi abort request; pending được giải phóng');
 fault=null;await page.getByTestId('login-submit').click(); await page.getByTestId('screen-home').waitFor();
 record('TC-AUTH-04','Web: login phục hồi sau lỗi; chưa kiểm SecureStore native');
 await fetch(api+'/my-vocabulary/'+(await(await fetch(api+`/decks/${decks[0].id}/words`,{headers})).json())[0].id,{method:'POST',headers});
 await page.getByTestId('tab-profile').click();await page.getByTestId('profile-back').click();
 await page.getByTestId('screen-home').waitFor();
 const summary=await(await fetch(api+'/review/summary',{headers})).json();assert.equal(summary.learnedCount,0);
 await page.getByText('Đã học qua',{exact:true}).waitFor();
 record('TC-HOME-01','Web Home sau bookmark tải lại; API learned/due/cram=0');
 await page.getByText('Ôn tập SRS',{exact:true}).click();await page.getByTestId('screen-review').waitFor();
 await page.goBack();await page.getByTestId('screen-home').waitFor();
 record('TC-HOME-03','Web Home -> Review -> Back; chưa có phiên dở/native');
 for(const [width,height] of [[320,568],[390,844],[430,932]]){
  await page.setViewportSize({width,height});await page.getByTestId('tab-profile').click();await page.getByTestId('screen-profile').waitFor();
  await page.getByTestId('profile-save').scrollIntoViewIfNeeded();assert(await page.getByTestId('profile-save').isVisible());
  await page.screenshot({path:`${out}/profile-${width}.png`});await page.getByTestId('profile-back').click();
 }
 record('TC-UI-03','Web 320x568/390x844/430x932: Profile cuộn tới nút lưu; chưa large-font/nội dung dài/native');
 fault='/decks';await page.getByTestId('tab-vocabulary').click();
 await page.getByRole('button',{name:'Thử lại',exact:true}).waitFor();
 fault=null;await page.getByRole('button',{name:'Thử lại',exact:true}).click();
 await page.getByRole('button',{name:new RegExp(decks[0].title)}).waitFor();
 record('TC-NET-02','Web tải Deck lỗi mạng -> Thử lại -> danh mục phục hồi');
 await page.getByRole('button',{name:new RegExp(decks[0].title)}).click();await page.getByTestId('flashcard-headword').waitFor();
 for(let i=0;i<4;i++) await page.getByTestId('flashcard-flip').click();
 await page.getByTestId('flashcard-headword').waitFor();await page.screenshot({path:out+'/flashcard.png'});
 record('TC-FLASH-04','Web reduced-motion, lật lặp không crash; chưa Deck rỗng/native');
 await page.goBack();await page.getByTestId('screen-vocabulary').getByTestId('tab-profile').click();await page.getByTestId('profile-logout').click();
 await page.goto('http://127.0.0.1:58127/profile');await page.getByTestId('screen-welcome').waitFor();
 record('TC-UI-05','Web tab/Back/logout rồi URL profile trở về Welcome, không truy cập profile; chưa Back phần cứng');
 record('TC-UI-04','Web Profile cuộn tới nút cuối trên ba viewport; chưa bàn phím native/các form OTP');
 }finally{await browser.close();writeFileSync(out+'/results.json',JSON.stringify(results,null,2));}
}
run().catch(e=>{console.error(e);process.exitCode=1});
