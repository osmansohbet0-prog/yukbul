import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext,Script} from 'node:vm';

const code=readFileSync(new URL('../edge/v222-google-auth.js',import.meta.url),'utf8');

function harness({session=true,next=''}={}){
  const elements=new Map(),selectors={},posts=[],redirects=[],status={};
  let googleCallback=null,captchaRenders=0,captchaResets=0;
  function element(id){
    if(elements.has(id))return elements.get(id);
    const events={};
    const v={id,textContent:'',hidden:false,disabled:false,style:{},value:'',
      dataset:{},attributes:{},className:'',
      classList:{toggle(){},contains(){return false}},
      setAttribute(k,val){this.attributes[k]=val},
      removeAttribute(k){delete this.attributes[k]},
      addEventListener(k,fn){events[k]=fn},
      insertAdjacentElement(){},
      replaceChildren(){},
      querySelector(q){if(q==='.form-hint')return element('google-help');return null},
      emit(k){return events[k]?.({preventDefault(){},currentTarget:this})}
    };
    elements.set(id,v);return v;
  }
  const tabs=[element('tab-login'),element('tab-register')];
  tabs[0].dataset.authTab='login';tabs[1].dataset.authTab='register';
  const form=element('auth-form');
  form.elements={email:{value:'demo@example.com'},website:{value:''}};
  const pass=element('password');pass.value='secret-example-1234';
  const confirm=element('confirm');confirm.value=pass.value;
  form.querySelector=q=>q==='input[name="password"]'?pass:q==='input[name="confirm"]'?confirm:null;
  element('google-auth-container');
  element('google-auth-button');
  element('auth-submit');
  element('auth-status');
  element('password-confirm-wrap');
  element('turnstile-box');
  const html={dataset:{},classList:{toggle(){}}};
  const document={
    documentElement:html,
    body:{classList:{toggle(){}}},
    head:{append(){}},
    createElement:()=>element('new-'+elements.size),
    querySelector(sel){return element(sel.slice(1))},
    querySelectorAll(sel){return sel==='[data-auth-tab]'?tabs:[]}
  };
  const window={
    __YV_AUTH_CONFIG:{turnstile_site_key:'site-test',google_client_id:'google-test'},
    turnstile:{render(){captchaRenders++;return 42},getResponse(){return 'captcha-token'},reset(){captchaResets++}},
    google:{accounts:{id:{initialize(config){googleCallback=config.callback},renderButton(){}}}}
  };
  const location={origin:'https://yukvinc.com.tr',search:next?('?next='+encodeURIComponent(next)):'',replace(u){redirects.push(u)}};
  const fetch=async(url,options={})=>{
    if(url==='/api/auth/google'){
      posts.push({url,body:JSON.parse(options.body)});
      return{ok:true,json:async()=>({ok:true,user:{id:'member-test',email:'demo@example.com'}})};
    }
    if(url==='/api/auth/me')return {ok:session,json:async()=>session?{user:{id:'member-test'}}:{}};
    throw Error('Unexpected URL: '+url);
  };
  const scope={document,window,location,fetch,URL,URLSearchParams,AbortController,AbortSignal,console,setTimeout,clearTimeout};
  runInNewContext(code,scope);
  return{
    tabs,form,posts,redirects,status,
    callback:()=>googleCallback,
    captchaRenders:()=>captchaRenders,
    captchaResets:()=>captchaResets
  };
}
test('client JS is syntactically valid and blocks navigation until session is checked',()=>{
  assert.doesNotThrow(()=>new Script(code));
  assert.match(code,/if\(!await checkSession\(\)\)/);
  assert.match(code,/const verified=await checkSession\(\)/);
  assert.match(code,/if\(busy\)return/);
});
test('tab changes keep the same captcha token and a Google callback starts only one POST',async()=>{
  const h=harness();
  h.tabs[1].emit('click');
  h.tabs[0].emit('click');
  assert.equal(h.captchaRenders(),1);
  await Promise.all([
    h.callback()({credential:'fake.test.credential'}),
    h.callback()({credential:'fake.test.credential'})
  ]);
  assert.equal(h.posts.length,1);
  assert.equal(h.posts[0].body.turnstile_token,'captcha-token');
  assert.equal(h.redirects.length,1);
  assert.equal(h.redirects[0],'/hesabim/');
  assert.equal(h.captchaResets(),0);
});
test('untrusted redirect is rejected even after successful Google login',async()=>{
  const h=harness({next:'//malicious.example/logout'});
  await h.callback()({credential:'fake.test.credential'});
  assert.deepEqual(h.redirects,['/hesabim/']);
});
test('worker only swaps the login script and preserves original authentication endpoints',()=>{
  const worker=readFileSync(new URL('../edge/v222-extras.worker.mjs',import.meta.url),'utf8');
  assert.match(worker,/script\[src\^="\/assets\/auth\.js"\]/);
  assert.match(worker,/path\.startsWith\('\/giris'\)/);
  assert.match(worker,/const AUTH_ROUTE = '\/assets\/yv-v222-auth\.js'/);
  assert.doesNotMatch(worker,/if\(path==='\/api\/auth\/google'\)/);
});
