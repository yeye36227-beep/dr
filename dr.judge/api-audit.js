/* 명세서에 적힌 그대로를 흉내내어 api.js 가 맞게 부르는지 점검 */
const { JSDOM } = require('/tmp/node_modules/jsdom');
const fs = require('fs');
const DIR = '/sessions/awesome-exciting-goodall/mnt/hackerthon /project/';

let pass=0, fail=0;
const rows=[];
const ok=(ep,n,c,e='')=>{c?pass++:fail++;rows.push([c?'OK':'!!',ep,n,c?'':e]);};

function makeApi(responder){
  const dom=new JSDOM('<!doctype html>',{url:'http://localhost:5500/',runScripts:'outside-only'});
  const w=dom.window; const m={};
  Object.defineProperty(w,'localStorage',{value:{getItem:k=>(k in m?m[k]:null),setItem:(k,v)=>{m[k]=String(v)},removeItem:k=>{delete m[k]}},configurable:true});
  const calls=[];
  Object.defineProperty(w,'fetch',{configurable:true,writable:true,value:(url,opt)=>{
    calls.push({url,method:(opt&&opt.method)||'GET',headers:(opt&&opt.headers)||{},keepalive:Boolean(opt&&opt.keepalive),body:opt&&opt.body?JSON.parse(opt.body):null});
    const r=responder(url,opt);
    return Promise.resolve({ok:r.status<400,status:r.status,json:()=>Promise.resolve(r.json)});
  }});
  w.AbortController=class{constructor(){this.signal={}}abort(){}};
  const mod=w.eval('(function(){'+fs.readFileSync(DIR+'data.js','utf8')+'\n;'+fs.readFileSync(DIR+'store.js','utf8')+'\n;'+fs.readFileSync(DIR+'api.js','utf8')+'\n; return {API:API,Store:Store}; })()');
  return {API:mod.API,Store:mod.Store,calls};
}
const TOK={accessToken:'ACC',refreshToken:'REF'};
const authed=(url)=>url.endsWith('/auth/login')?{status:200,json:{success:true,data:TOK,error:null}}:null;
const B='http://localhost:8080/api';

(async()=>{

/* ── 1.1 회원가입 ── */
{
  const a=makeApi((u)=>u.endsWith('/auth/signup')?{status:201,json:{success:true,data:{userId:5},error:null}}
    :u.endsWith('/auth/login')?{status:200,json:{success:true,data:TOK,error:null}}:{status:404,json:{}});
  const r=await a.API.signup({userId:'drjudge04',password:'test1234!',email:'test04@g.eulji.ac.kr',name:'홍길동',nickname:'저지매니아'});
  const c=a.calls[0];
  ok('1.1 회원가입','URL', c.url===B+'/auth/signup', c.url);
  ok('1.1 회원가입','POST', c.method==='POST');
  ok('1.1 회원가입','loginId 로 보냄', c.body.loginId==='drjudge04');
  ok('1.1 회원가입','필드 5개', Object.keys(c.body).sort().join(',')==='email,loginId,name,nickname,password', Object.keys(c.body).join(','));
  ok('1.1 회원가입','201 → userId 파싱', r.ok && r.data.userId===5);
}
{
  const a=makeApi(()=>({status:409,json:{success:false,data:null,error:null}}));
  const r=await a.API.signup({userId:'x',password:'y',email:'e',name:'n',nickname:'k'});
  ok('1.1 회원가입','409 → 이메일 칸 오류', r.field==='email', String(r.field));
}

/* ── 1.2 로그인 ── */
{
  const a=makeApi((u)=>u.endsWith('/auth/login')?{status:200,json:{success:true,data:TOK,error:null}}:{status:404,json:{}});
  await a.API.login({userId:'drjudge02',password:'test1234!'});
  const c=a.calls[0];
  ok('1.2 로그인','URL', c.url===B+'/auth/login', c.url);
  ok('1.2 로그인','필드 2개', Object.keys(c.body).sort().join(',')==='loginId,password');
  ok('1.2 로그인','accessToken 보관', a.API.getToken()==='ACC');
  ok('1.2 로그인','refreshToken 보관', a.API.getRefreshToken()==='REF');
}
{
  const a=makeApi(()=>({status:400,json:{success:false,data:null,error:null}}));
  const r=await a.API.login({userId:'x',password:'y'});
  ok('1.2 로그인','400 → 두 칸 모두 표시', (r.fields||[]).join(',')==='userId,password', JSON.stringify(r.fields));
}
{
  const a=makeApi(()=>({status:409,json:{success:false,data:null,error:null}}));
  const r=await a.API.login({userId:'x',password:'y'});
  ok('1.2 로그인','409 → 탈퇴 안내', r.code==='WITHDRAWN_USER');
}

/* ── 1.3 토큰 재발급 ── */
{
  const a=makeApi((u)=>authed(u) || (u.endsWith('/auth/refresh')?{status:200,json:{success:true,data:{accessToken:'ACC2',refreshToken:'REF2'},error:null}}:{status:404,json:{}}));
  await a.API.login({userId:'u',password:'p'});
  await a.API.refresh();
  const c=a.calls.find(x=>x.url.endsWith('/auth/refresh'));
  ok('1.3 재발급','URL', c.url===B+'/auth/refresh', c.url);
  ok('1.3 재발급','Authorization 헤더', c.headers.Authorization==='Bearer ACC', c.headers.Authorization);
  ok('1.3 재발급','X-Refresh-Token 헤더', c.headers['X-Refresh-Token']==='REF', c.headers['X-Refresh-Token']);
  ok('1.3 재발급','새 토큰으로 교체', a.API.getToken()==='ACC2' && a.API.getRefreshToken()==='REF2');
}

/* ── 1.4 로그아웃 ── */
{
  const a=makeApi((u)=>authed(u) || {status:200,json:{success:true,data:null,error:null}});
  await a.API.login({userId:'u',password:'p'});
  await a.API.logout();
  const c=a.calls.find(x=>x.url.endsWith('/auth/logout'));
  ok('1.4 로그아웃','URL', c && c.url===B+'/auth/logout', c&&c.url);
  ok('1.4 로그아웃','POST + Authorization', c.method==='POST' && c.headers.Authorization==='Bearer ACC');
  ok('1.4 로그아웃','data:null 도 성공 처리', a.API.getToken()===null);
}

/* ── 1.5 회원탈퇴 ── */
{
  const a=makeApi((u)=>authed(u) || {status:200,json:{success:true,data:{withdrawnAt:'2026-08-16T02:06:35.266'},error:null}});
  await a.API.login({userId:'u',password:'p'});
  const r=await a.API.withdraw();
  const c=a.calls.find(x=>x.url.endsWith('/auth/me'));
  ok('1.5 탈퇴','URL', c && c.url===B+'/auth/me', c&&c.url);
  ok('1.5 탈퇴','DELETE', c.method==='DELETE');
  ok('1.5 탈퇴','withdrawnAt 파싱', r.ok && r.data.withdrawnAt.startsWith('2026-08-16'));
}

/* ── 1.2-1 카카오 로그인 ── */
{
  const b64=(o)=>Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const JWT='h.'+b64({sub:'99'})+'.s';
  const a=makeApi(()=>({status:200,json:{success:true,data:{token:JWT,refreshToken:'REF',
    user:{nickname:'임수영'},isNewUser:false,onboardingToken:null},error:null}}));
  const r=await a.API.kakaoLogin({code:'CODE'});
  const c=a.calls[0];
  ok('1.2 카카오','URL', c.url===B+'/auth/kakao', c.url);
  ok('1.2 카카오','POST + code·redirectUri', c.method==='POST' && c.body.code==='CODE' && Boolean(c.body.redirectUri));
  ok('1.2 카카오','응답의 token 을 액세스 토큰으로', a.API.getToken()===JWT);
  ok('1.2 카카오','기존 회원은 온보딩 불필요', r.data.needsOnboarding===false);
}
{
  const a=makeApi(()=>({status:200,json:{success:true,data:{token:null,refreshToken:null,
    user:null,isNewUser:true,onboardingToken:'OTK'},error:null}}));
  const r=await a.API.kakaoLogin({code:'CODE'});
  ok('1.2 카카오','신규 회원은 온보딩 필요', r.data.needsOnboarding===true);
  ok('1.2 카카오','onboardingToken 보관', a.Store.tokens().onboardingToken==='OTK');
  ok('1.2 카카오','토큰 없으면 로그인 아님', a.Store.isLoggedIn()===false);
}
{
  const a=makeApi(()=>({status:401,json:{success:false,data:null,error:null}}));
  ok('1.2 카카오','401 → 카카오 인증 실패', (await a.API.kakaoLogin({code:'X'})).code==='KAKAO_AUTH_FAILED');
}

/* ── 1.2-2 카카오 토큰 발급 ── */
{
  const b64=(o)=>Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const JWT='h.'+b64({sub:'99'})+'.s';
  const a=makeApi((u)=>/kakao\/complete/.test(u)
    ?{status:200,json:{success:true,data:{token:JWT,refreshToken:'REF',user:{nickname:'카카오사용자'},
      isNewUser:false,onboardingToken:null},error:null}}
    :{status:200,json:{success:true,data:{token:null,refreshToken:null,user:null,
      isNewUser:true,onboardingToken:'OTK'},error:null}});
  await a.API.kakaoLogin({code:'C'});
  const r=await a.API.kakaoComplete();
  const c=a.calls.find(x=>/kakao\/complete/.test(x.url));
  ok('1.2-2 토큰발급','URL', c && c.url===B+'/auth/kakao/complete', c&&c.url);
  ok('1.2-2 토큰발급','onboardingToken 그대로 전달', c.body.onboardingToken==='OTK');
  ok('1.2-2 토큰발급','필드 1개만', Object.keys(c.body).join(',')==='onboardingToken', Object.keys(c.body).join(','));
  ok('1.2-2 토큰발급','token 받아 로그인 완료', r.data.needsOnboarding===false && a.API.getToken()===JWT);
  ok('1.2-2 토큰발급','onboardingToken 비움', a.Store.tokens().onboardingToken===null);
}
{
  const a=makeApi((u)=>({status:200,json:{success:true,data:{token:null,refreshToken:null,user:null,
    isNewUser:true,onboardingToken:/complete/.test(u)?'OTK2':'OTK'},error:null}}));
  await a.API.kakaoLogin({code:'C'});
  const r=await a.API.kakaoComplete();
  ok('1.2-2 토큰발급','200이어도 미완료면 로그인 아님', r.data.needsOnboarding===true && !a.API.getToken());
  ok('1.2-2 토큰발급','재발급된 토큰으로 교체', a.Store.tokens().onboardingToken==='OTK2');
}

/* ── 1.6 내 정보 조회 ── */
{
  const ME={status:200,json:{success:true,data:{userId:'u_1001',nickname:'닉임',
    profileImageUrl:'https://x/y.png',pointBalance:1200,
    interestCategories:['NUTRITION_SUPPLEMENT','COSMETICS'],ageGroup:'AGE_50S',
    gender:'FEMALE',createdAt:'2026-01-10T09:00:00Z'},error:null}};
  const a=makeApi((u)=>authed(u) || (/users\/me$/.test(u)?ME:{status:404,json:{}}));
  await a.API.login({userId:'u',password:'p'});
  const r=await a.API.getMe();
  const c=a.calls.find(x=>/users\/me$/.test(x.url));
  ok('1.6 내정보','URL', c && c.url===B+'/users/me', c&&c.url);
  ok('1.6 내정보','GET + Authorization', c.method==='GET' && c.headers.Authorization==='Bearer ACC');
  ok('1.6 내정보','pointBalance 파싱', r.data.pointBalance===1200);
  ok('1.6 내정보','interestCategories → 한글', r.data.interests.join(',')==='건강/면역,미용/화장품', r.data.interests.join(','));
  ok('1.6 내정보','로그인하면 자동 호출', a.calls.filter(x=>/users\/me$/.test(x.url)).length>=1);
  ok('1.6 내정보','닉네임을 기기에 반영', a.Store.current().profile.nickname==='닉임');
}
{
  const a=makeApi((u)=>authed(u) || {status:500,json:{success:false,data:null,error:null}});
  const r=await a.API.login({userId:'u',password:'p'});
  ok('1.6 내정보','실패해도 로그인은 유지', r.ok===true && a.API.getToken()==='ACC');
}

/* ── 1.7 내 정보 수정 ── */
{
  const ME={status:200,json:{success:true,data:{userId:'u_1001',nickname:'닉임',pointBalance:0,
    interestCategories:[],ageGroup:null,gender:null},error:null}};
  const OKRES={status:200,json:{success:true,data:{userId:'u_1001',nickname:'새닉네임',
    profileImageUrl:'https://...'},error:null}};
  const a=makeApi((u)=>authed(u) || (/users\/me$/.test(u)?ME:OKRES));
  await a.API.login({userId:'u',password:'p'});
  a.calls.length=0;
  const r=await a.API.updateMe({nickname:'새닉네임'});
  const c=a.calls[0];
  ok('1.7 내정보수정','URL', c && c.url===B+'/users/me/nickname', c&&c.url);
  ok('1.7 내정보수정','PATCH + Authorization', c.method==='PATCH' && c.headers.Authorization==='Bearer ACC');
  ok('1.7 내정보수정','바꿀 것만 보냄', Object.keys(c.body).join(',')==='nickname', Object.keys(c.body).join(','));
  ok('1.7 내정보수정','응답 닉네임 반영', r.ok && a.Store.current().profile.nickname==='새닉네임');
}
{
  const ME={status:200,json:{success:true,data:{userId:'u',nickname:'n',pointBalance:0,interestCategories:[]},error:null}};
  const a=makeApi((u)=>authed(u) || (/users\/me$/.test(u)?ME:{status:400,json:{success:false,data:null,error:null}}));
  await a.API.login({userId:'u',password:'p'});
  const r=await a.API.updateMe({nickname:'겹침'});
  ok('1.7 내정보수정','400 → 닉네임 칸에 표시', r.code==='NICKNAME_REJECTED' && r.field==='nickname', r.code);
}

/* ── 2.1 온보딩 ── */
{
  const a=makeApi((u)=>authed(u) || {status:201,json:{success:true,data:{interestCategories:['NUTRITION_SUPPLEMENT','COSMETICS'],ageGroup:'AGE_50S',gender:'FEMALE',onboardingCompleted:true},error:null}});
  await a.API.login({userId:'u',password:'p'});
  const r=await a.API.saveOnboarding({interests:['건강/면역','미용/화장품'],ageRange:'40~59세',gender:'여성'});
  const c=a.calls.find(x=>x.url.endsWith('/me/onboarding'));
  ok('2.1 온보딩','URL', c && c.url===B+'/me/onboarding', c&&c.url);
  ok('2.1 온보딩','POST', c.method==='POST');
  ok('2.1 온보딩','interestCategoryCodes 배열', Array.isArray(c.body.interestCategoryCodes), Object.keys(c.body).join(','));
  ok('2.1 온보딩','필드 3개', Object.keys(c.body).sort().join(',')==='ageGroup,gender,interestCategoryCodes', Object.keys(c.body).join(','));
  ok('2.1 온보딩','onboardingToken 없으면 생략', c.body.onboardingToken===undefined);
  ok('2.1 온보딩','onboardingCompleted 반영', a.Store.current().profile.onboardingCompleted===true);
}
{
  const a=makeApi((u)=>u.endsWith('/auth/login')
    ?{status:200,json:{success:true,data:{accessToken:'ACC',refreshToken:'REF',onboardingToken:'OTK'},error:null}}
    :{status:401,json:{success:false,data:null,error:null}});
  await a.API.login({userId:'u',password:'p'});
  const r=await a.API.saveOnboarding({interests:['건강/면역'],ageRange:'40~59세',gender:'여성'});
  const c=a.calls.find(x=>x.url.endsWith('/me/onboarding'));
  ok('2.1 온보딩','onboardingToken 있으면 body 에 담음', c.body.onboardingToken==='OTK');
  ok('2.1 온보딩','401 → 토큰 만료 안내(재발급 안 함)', r.code==='ONBOARDING_TOKEN_EXPIRED', r.code);
}
{
  const a=makeApi((u)=>authed(u) || {status:404,json:{success:false,data:null,error:null}});
  await a.API.login({userId:'u',password:'p'});
  ok('2.1 온보딩','404 → 계정 없음 안내', (await a.API.saveOnboarding({interests:['건강/면역'],ageRange:'40~59세',gender:'여성'})).code==='ONBOARDING_USER_NOT_FOUND');
}

/* ── 3.1 판정 요청 생성 ── */
{
  const a=makeApi((u)=>authed(u) || {status:202,json:{success:true,data:{judgmentId:1,status:'PROCESSING'},error:null}});
  await a.API.login({userId:'u',password:'p'});
  const r=await a.API.requestJudge({type:'text',text:'이 유산균은 혈당에 좋다'});
  const c=a.calls.find(x=>x.url.endsWith('/judgements'));
  ok('3.1 판정요청','URL', c && c.url===B+'/judgements', c&&c.url);
  ok('3.1 판정요청','POST + Authorization', c.method==='POST' && c.headers.Authorization==='Bearer ACC');
  ok('3.1 판정요청','inputType 대문자', c.body.inputType==='TEXT', String(c.body.inputType));
  ok('3.1 판정요청','202 → judgmentId 파싱', r.ok && r.data.judgmentId===1);
}
{
  const a=makeApi((u)=>authed(u) || {status:202,json:{success:true,data:{judgmentId:2,status:'PROCESSING'},error:null}});
  await a.API.login({userId:'u',password:'p'});
  await a.API.requestJudge({type:'image',imageBase64:'AAA'});
  const c=a.calls.find(x=>x.url.endsWith('/judgements'));
  ok('3.1 판정요청','IMAGE 는 imageBase64 만', c.body.inputType==='IMAGE' && c.body.imageBase64==='AAA' && !('text' in c.body));
}
{
  const a=makeApi((u)=>authed(u) || {status:422,json:{success:false,data:null,error:null}});
  await a.API.login({userId:'u',password:'p'});
  const r=await a.API.requestJudge({type:'image',imageBase64:'x'});
  ok('3.1 판정요청','422 → 추출 실패 화면', r.code==='OCR_FAILED');
}
{
  const a=makeApi((u)=>authed(u) || {status:429,json:{success:false,data:null,error:null}});
  await a.API.login({userId:'u',password:'p'});
  const r=await a.API.requestJudge({type:'text',text:'x'});
  ok('3.1 판정요청','429 → 한도 화면', r.code==='DAILY_LIMIT');
}

/* ── 3.2 판정 결과 조회 ── */
{
  const DONE={judgmentId:1,status:'DONE',inputType:'LINK',categoryId:3,
    extractedText:'이 영양제 먹으면 관절통이 싹 낫는다더라',
    trustLevel:'NO_EVIDENCE',trustLevelLabel:'근거 부족',evidenceSummary:'임상 근거 없음',
    conflictOfInterest:{detected:true,type:'GROUP_PURCHASE_LINK',badgeLabel:'상업적 의도 있음',description:'공동구매 링크 포함'},
    safetyNotice:'전문가와 상담하세요',
    sources:[{title:'식약처 공식 자료',url:'https://x',reliabilityType:'OFFICIAL'}],
    guideCard:{title:'확인하세요',sourceType:'OFFICIAL_STANDARD',sourceRef:'식약처 기준',tips:['a','b','c']},
    createdAt:'2026-08-09T10:00:00Z'};
  const a=makeApi((u)=>authed(u) || {status:200,json:{success:true,data:DONE,error:null}});
  await a.API.login({userId:'u',password:'p'});
  const r=await a.API.getJudgment(1);
  const c=a.calls.find(x=>/\/judgements\/1$/.test(x.url));
  ok('3.2 결과조회','URL', c && c.url===B+'/judgements/1', c&&c.url);
  ok('3.2 결과조회','GET', c.method==='GET');
  ok('3.2 결과조회','trustLevel → 등급', r.data.level==='lack');
  ok('3.2 결과조회','extractedText → 문장', r.data.claim.includes('관절통'));
  ok('3.2 결과조회','conflictOfInterest 전달', r.data.conflictBadge==='상업적 의도 있음');
  ok('3.2 결과조회','guideCard.tips 전달', r.data.guideCard.tips.length===3);
  ok('3.2 결과조회','완료 시 포인트 적립', a.Store.hasHistory('1')===true);
}
{
  const a=makeApi((u)=>authed(u) || {status:403,json:{success:false,data:null,error:null}});
  await a.API.login({userId:'u',password:'p'});
  const r=await a.API.getJudgment(1);
  ok('3.2 결과조회','403 → 남의 판정 안내', r.code==='FORBIDDEN');
}

/* ── 3.3 판정 히스토리 ── */
{
  const a=makeApi((u)=>authed(u) || {status:200,json:{success:true,data:{items:[{judgmentId:1,trustLevelLabel:'근거 부족',categoryId:3,createdAt:'2026-08-09T10:00:00Z'}],hasNext:true},error:null}});
  await a.API.login({userId:'u',password:'p'});
  const r=await a.API.getJudgmentHistory();
  const c=a.calls.find(x=>/\/judgements\?/.test(x.url));
  ok('3.3 히스토리','URL', c && c.url.startsWith(B+'/judgements?'), c&&c.url);
  ok('3.3 히스토리','page·size 기본값', c.url.includes('page=1') && c.url.includes('size=20'));
  ok('3.3 히스토리','items 파싱', r.data.items.length===1);
  ok('3.3 히스토리','hasNext 파싱', r.data.hasNext===true);
  ok('3.3 히스토리','라벨 → 뱃지', r.data.items[0].status==='vague');
}

/* ── 4.1 오늘의 브리핑 ── */
{
  const a=makeApi((u)=>authed(u) || {status:200,json:{success:true,data:{date:'2026-08-05',items:[
    {briefingId:'b_1',category:'NUTRITION_SUPPLEMENT',trustLevelLabel:'임상적 근거 있음',title:'콜라겐 얘기',summary:'요약',relatedArchiveId:'arch_0099'}]},error:null}});
  await a.API.login({userId:'u',password:'p'});
  const r=await a.API.getTodayBriefing();
  const c=a.calls.find(x=>x.url.endsWith('/briefings/today'));
  ok('4.1 브리핑','URL', c && c.url===B+'/briefings/today', c&&c.url);
  ok('4.1 브리핑','GET + Authorization', c.method==='GET' && c.headers.Authorization==='Bearer ACC');
  ok('4.1 브리핑','date 파싱', r.data.date==='2026-08-05');
  ok('4.1 브리핑','category enum → 한글', r.data.items[0].category==='건강/면역');
  ok('4.1 브리핑','relatedArchiveId 보존', r.data.items[0].archiveId==='arch_0099');
}

/* ── 4.2 특정 날짜 브리핑 ── */
{
  const a=makeApi((u)=>authed(u) || {status:200,json:{success:true,data:{date:'2026-08-01',
    items:[{briefingId:'b_1',category:'COSMETICS',trustLevelLabel:'근거 부족',title:'t',summary:'s',relatedArchiveId:null}]},error:null}});
  await a.API.login({userId:'u',password:'p'});
  const r=await a.API.getBriefing('2026-08-01');
  const c=a.calls.find(x=>/briefings/.test(x.url));
  ok('4.2 날짜브리핑','URL 에 날짜가 경로로', c && c.url===B+'/briefings/2026-08-01', c&&c.url);
  ok('4.2 날짜브리핑','GET + Authorization', c.method==='GET' && c.headers.Authorization==='Bearer ACC');
  ok('4.2 날짜브리핑','4.1 과 같은 구조로 파싱', r.data.date==='2026-08-01' && r.data.items[0].category==='미용/화장품');
  const _d=new Date(); const _today=new Date(_d.getTime()-_d.getTimezoneOffset()*60000).toISOString().slice(0,10);
  await a.API.getBriefing(_today); // 오늘은 그 사람의 시간대 기준
  ok('4.2 날짜브리핑','오늘이면 4.1 경로로', a.calls[a.calls.length-1].url===B+'/briefings/today', a.calls[a.calls.length-1].url);
  const before=a.calls.length;
  ok('4.2 날짜브리핑','형식 오류는 보내기 전에 차단', (await a.API.getBriefing('2026/08/01')).code==='INVALID_DATE' && a.calls.length===before);
}
{
  const a=makeApi((u)=>authed(u) || {status:404,json:{success:false,data:null,error:null}});
  await a.API.login({userId:'u',password:'p'});
  ok('4.2 날짜브리핑','404 → 그 날 브리핑 없음', (await a.API.getBriefing('2020-01-01')).code==='BRIEFING_NOT_FOUND');
}

/* ── 4.3 브리핑 열람 기록 ── */
{
  const a=makeApi((u)=>authed(u) || {status:200,json:{success:true,data:{opened:true},error:null}});
  await a.API.login({userId:'u',password:'p'});
  const r=await a.API.markBriefingOpened('b_20260805_1');
  const c=a.calls.find(x=>/\/open$/.test(x.url));
  ok('4.3 열람기록','URL', c && c.url===B+'/briefings/b_20260805_1/open', c&&c.url);
  ok('4.3 열람기록','POST + Authorization', c.method==='POST' && c.headers.Authorization==='Bearer ACC');
  ok('4.3 열람기록','opened 파싱', r.ok===true && r.data.opened===true);
  ok('4.3 열람기록','keepalive (이동 중에도 전송)', c.keepalive===true);
  const before=a.calls.length;
  await a.API.markBriefingOpened('b_20260805_1');
  ok('4.3 열람기록','같은 브리핑 중복 전송 안 함', a.calls.length===before);
}
{
  const a=makeApi((u)=>authed(u) || {status:404,json:{success:false,data:null,error:null}});
  await a.API.login({userId:'u',password:'p'});
  ok('4.3 열람기록','404 여도 화면에 영향 없음', (await a.API.markBriefingOpened('b_x')).ok===false);
}

/* ── 6.1 공유 링크 생성 ── */
{
  const a=makeApi((u)=>authed(u) || (/\/judgments\/1\/share$/.test(u)
    ? {status:201,json:{success:true,data:{shareToken:'9f2a7b3c1d4e5f60a1b2c3d4e5f60718',shareUrl:'https://doctorjudge.app/share/9f2a',imageUrl:'https://cdn/x.png'},error:null}}
    : {status:404,json:{}}));
  await a.API.login({userId:'u',password:'p'});
  const r=await a.API.createShareLink(1);
  const c=a.calls.find(x=>x.url.includes('/share'));
  ok('6.1 공유링크','URL (judgments — e 없음)', c && c.url===B+'/judgments/1/share', c&&c.url);
  ok('6.1 공유링크','POST + Authorization', c.method==='POST' && c.headers.Authorization==='Bearer ACC');
  ok('6.1 공유링크','shareUrl·imageUrl 파싱', r.data.shareUrl.includes('doctorjudge') && r.data.imageUrl.endsWith('.png'));
}

/* ── 6.2 공유 링크 공개 조회 ── */
{
  const a=makeApi((u)=>/\/share\/TOK$/.test(u)
    ? {status:200,json:{success:true,data:{judgmentId:1,status:'DONE',extractedText:'문장',trustLevel:'PENDING',trustLevelLabel:'판단보류',conflictOfInterest:{detected:false},sources:[],guideCard:{tips:[]}},error:null}}
    : {status:404,json:{}});
  const r=await a.API.getSharedJudgment('TOK');
  const c=a.calls[0];
  ok('6.2 공개조회','URL', c.url===B+'/share/TOK', c.url);
  ok('6.2 공개조회','인증 헤더 없음', !('Authorization' in c.headers));
  ok('6.2 공개조회','3.2 구조로 변환', r.data.level==='hold');
}
{
  const a=makeApi(()=>({status:410,json:{success:false,data:null,error:null}}));
  const r=await a.API.getSharedJudgment('X');
  ok('6.2 공개조회','410 → 만료 안내', r.code==='SHARE_GONE');
}

/* ── 6.3 공유 링크 회수 ── */
{
  const a=makeApi((u,o)=>authed(u) || (/\/judgments\/1\/share$/.test(u) && (o&&o.method)==='DELETE'
    ? {status:200,json:{success:true,data:null,error:null}} : {status:404,json:{}}));
  await a.API.login({userId:'u',password:'p'});
  const r=await a.API.revokeShareLink(1);
  const c=a.calls.find(x=>x.url.includes('/share'));
  ok('6.3 회수','URL', c && c.url===B+'/judgments/1/share', c&&c.url);
  ok('6.3 회수','DELETE + Authorization', c.method==='DELETE' && c.headers.Authorization==='Bearer ACC');
  ok('6.3 회수','data:null 성공 처리', r.ok===true);
}

/* ── 6.4 공유 피드에 게시 ── */
{
  const a=makeApi((u)=>authed(u) || (u.endsWith('/feed/posts')
    ? {status:201,json:{success:true,data:{postId:'p_5001',status:'PUBLISHED'},error:null}} : {status:404,json:{}}));
  await a.API.login({userId:'u',password:'p'});
  const r=await a.API.publishToFeed(1);
  const c=a.calls.find(x=>x.url.endsWith('/feed/posts'));
  ok('6.4 피드게시','URL', c && c.url===B+'/feed/posts', c&&c.url);
  ok('6.4 피드게시','POST + judgmentId', c.method==='POST' && c.body.judgmentId==='1');
  ok('6.4 피드게시','postId·status 파싱', r.data.postId==='p_5001' && r.data.status==='PUBLISHED');
}
{
  const a=makeApi((u)=>authed(u) || {status:400,json:{success:false,data:null,error:null}});
  await a.API.login({userId:'u',password:'p'});
  const r=await a.API.publishToFeed(1);
  ok('6.4 피드게시','400 → 게시 불가 안내', r.code==='FEED_BLOCKED');
}

/* ── 6.5 피드 전체 목록 ── */
{
  const a=makeApi((u)=>authed(u) || (/\/feed\/posts\?/.test(u)
    ? {status:200,json:{success:true,data:{items:[{postId:'p_5001',author:{userId:'u_1001',nickname:'닉네임'},trustLevelLabel:'근거 부족',summary:'요약',likeCount:12,createdAt:'2026-08-05T10:10:00Z'}],page:1,totalPages:8},error:null}}
    : {status:404,json:{}}));
  await a.API.login({userId:'u',password:'p'});
  const r=await a.API.getFeedPosts();
  const c=a.calls.find(x=>/\/feed\/posts\?/.test(x.url));
  ok('6.5 피드목록','URL', c && c.url.startsWith(B+'/feed/posts?'), c&&c.url);
  ok('6.5 피드목록','sort·page·size 기본값', c.url.includes('sort=recent')&&c.url.includes('page=1')&&c.url.includes('size=20'));
  ok('6.5 피드목록','author.nickname 추출', r.data.items[0].author==='닉네임');
  ok('6.5 피드목록','page·totalPages 파싱', r.data.page===1 && r.data.totalPages===8);
}

/* ── 6.6 내 게시물 ── */
{
  const a=makeApi((u)=>authed(u) || (/\/feed\/posts\/me\?/.test(u)
    ? {status:200,json:{success:true,data:{items:[{postId:'p_1',author:{userId:'u',nickname:'나'},trustLevelLabel:'판단보류',summary:'요약',likeCount:0,createdAt:'2026-08-05T10:10:00Z'}],page:1,totalPages:3},error:null}}
    : {status:404,json:{}}));
  await a.API.login({userId:'u',password:'p'});
  const r=await a.API.getMyFeedPosts();
  const c=a.calls.find(x=>/\/feed\/posts\/me\?/.test(x.url));
  ok('6.6 내게시물','URL', c && c.url.startsWith(B+'/feed/posts/me?'), c&&c.url);
  ok('6.6 내게시물','page·size 기본값', c.url.includes('page=1')&&c.url.includes('size=20'));
  ok('6.6 내게시물','6.5 와 같은 구조로 파싱', r.data.items[0].postId==='p_1' && r.data.totalPages===3);
}

/* ── 6.7 좋아요 토글 ── */
{
  const a=makeApi((u)=>authed(u) || (/\/feed\/posts\/p_1\/like$/.test(u)
    ? {status:200,json:{success:true,data:{liked:true,likeCount:13},error:null}} : {status:404,json:{}}));
  await a.API.login({userId:'u',password:'p'});
  const r=await a.API.toggleLike('p_1', false);
  const c=a.calls.find(x=>x.url.includes('/like'));
  ok('6.7 좋아요','URL', c && c.url===B+'/feed/posts/p_1/like', c&&c.url);
  ok('6.7 좋아요','좋아요는 POST', c.method==='POST' && c.headers.Authorization==='Bearer ACC');
  ok('6.7 좋아요','liked·likeCount 파싱', r.data.liked===true && r.data.likeCount===13);
}
{
  const a=makeApi((u)=>authed(u) || {status:200,json:{success:true,data:{liked:false,likeCount:12},error:null}});
  await a.API.login({userId:'u',password:'p'});
  await a.API.toggleLike('p_1', true);
  const c=a.calls.find(x=>x.url.includes('/like'));
  ok('6.7 좋아요','취소는 DELETE (같은 URL)', c.method==='DELETE' && c.url===B+'/feed/posts/p_1/like', c.method);
}

/* ── 6.8 게시물 삭제 ── */
{
  const a=makeApi((u,o)=>authed(u) || (/\/feed\/posts\/p_1$/.test(u) && (o&&o.method)==='DELETE'
    ? {status:200,json:{success:true,data:null,error:null}} : {status:404,json:{}}));
  await a.API.login({userId:'u',password:'p'});
  const r=await a.API.deletePost('p_1');
  const c=a.calls.find(x=>/\/feed\/posts\/p_1$/.test(x.url));
  ok('6.8 게시물삭제','URL', c && c.url===B+'/feed/posts/p_1', c&&c.url);
  ok('6.8 게시물삭제','DELETE + Authorization', c.method==='DELETE' && c.headers.Authorization==='Bearer ACC');
  ok('6.8 게시물삭제','data:null 성공 처리', r.ok===true);
}

/* ── 7.2 포인트 내역 ── */
{
  const pageOf=(all)=>(u)=>{
    const q=new URL(u,'http://x').searchParams;
    const page=Number(q.get('page')||1), size=Number(q.get('size')||20);
    return {status:200,json:{success:true,data:{items:all.slice((page-1)*size,page*size),page,totalPages:Math.max(1,Math.ceil(all.length/size))},error:null}};
  };
  const sample=[{type:'EARN',reason:'FEED_POST',amount:50,createdAt:'2026-08-10T09:00:00Z'},
                {type:'EARN',reason:'DAILY_LOGIN',amount:10,createdAt:'2026-08-09T01:00:00Z'}];
  const meRes={status:200,json:{success:true,data:{userId:'u',nickname:'n',pointBalance:60,
    interestCategories:[],ageGroup:null,gender:null},error:null}};
  const a=makeApi((u)=>authed(u) || (/users\/me$/.test(u)?meRes
    : /points\/history/.test(u)?pageOf(sample)(u):{status:404,json:{}}));
  await a.API.login({userId:'u',password:'p'});
  const r=await a.API.getPointHistory({page:2,size:5});
  const c=a.calls.find(x=>/points/.test(x.url));
  ok('7.2 포인트내역','URL', c && c.url.startsWith(B+'/users/me/points/history?'), c&&c.url);
  ok('7.2 포인트내역','GET + Authorization', c.method==='GET' && c.headers.Authorization==='Bearer ACC');
  ok('7.2 포인트내역','page·size 쿼리스트링', /page=2/.test(c.url) && /size=5/.test(c.url), c.url);
  const r1=await a.API.getPointHistory();
  ok('7.2 포인트내역','기본값 page=1 size=20', /page=1&size=20/.test(a.calls[a.calls.length-1].url));
  ok('7.2 포인트내역','items·page·totalPages 파싱', r1.data.items.length===2 && r1.data.page===1 && r1.data.totalPages===1);
  ok('7.2 포인트내역','reason 코드 → 화면 문구', r1.data.items[0].label==='공유 카드 게시', r1.data.items[0].label);
  ok('7.2 포인트내역','EARN/USE 부호', r1.data.items[0].signed===50);
  const s2=await a.API.getPointSummary();
  ok('7.2 포인트내역','잔액은 1.6 값을 그대로 (내역 안 훑음)', s2.data.total===60, String(s2.data.total));
}
{
  const a=makeApi((u)=>authed(u) || {status:500,json:{success:false,data:null,error:null}});
  await a.API.login({userId:'u',password:'p'});
  ok('7.2 포인트내역','500 → 서버 오류 안내', (await a.API.getPointHistory()).code==='SERVER_ERROR');
}

/* ── 공통 ── */
{
  const a=makeApi((u)=>authed(u) || {status:200,json:{success:true,data:{ok:1},error:null}});
  await a.API.login({userId:'u',password:'p'});
  await a.API.getJudgment(1);
  const c=a.calls.find(x=>/judgements\/1/.test(x.url));
  ok('공통','모든 인증 요청에 Bearer', c.headers.Authorization==='Bearer ACC');
  ok('공통','Content-Type: application/json', c.headers['Content-Type']==='application/json');
}
{
  let n=0;
  const a=makeApi((u)=>{
    if(u.endsWith('/auth/login')) return {status:200,json:{success:true,data:TOK,error:null}};
    if(u.endsWith('/auth/refresh')) return {status:200,json:{success:true,data:{accessToken:'ACC2',refreshToken:'REF2'},error:null}};
    // 로그인 직후 자동으로 부르는 /users/me 는 세지 않습니다 (판정 조회만 봅니다)
    if(/users\/me$/.test(u)) return {status:200,json:{success:true,data:{userId:'u',nickname:'n',pointBalance:0,interestCategories:[]},error:null}};
    return (++n===1)?{status:401,json:{success:false,data:null,error:null}}:{status:200,json:{success:true,data:{judgmentId:1,status:'DONE',trustLevel:'PENDING'},error:null}};
  });
  await a.API.login({userId:'u',password:'p'});
  const r=await a.API.getJudgment(1);
  ok('공통','401 → 재발급 후 재시도', r.ok===true && a.API.getToken()==='ACC2');
}

/* ── 출력 ── */
const w=[2,14,32];
console.log('\n' + ' '.padEnd(3) + '엔드포인트'.padEnd(20) + '항목');
console.log('─'.repeat(78));
let last='';
for (const [s,ep,n,e] of rows) {
  console.log(` ${s==='OK'?'✓':'✗'}  ${(ep===last?'':ep).padEnd(16)}${n}${e?'   ← '+e:''}`);
  last=ep;
}
console.log('─'.repeat(78));
console.log(`${pass}개 통과 / ${fail}개 실패`);
process.exit(fail?1:0);
})();
