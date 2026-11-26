import {tenderApi} from './tenders.mjs';
import {guideTender} from './advisor.mjs';
import {guardianApi,runGuardian} from './guardian.mjs';
import {notificationApi,scanTenderAlerts,sendTenderAlerts} from './notifications.mjs';

const enabled=(env,name)=>env[name]==='true';
const replyError=(status,message)=>Response.json({error:message},{status,headers:{'cache-control':'private, no-store'}});
const urls={board:'/assets/yv-v12-tender-board.js',guardian:'/assets/yv-v12-guardian.js'};

export function createV12Worker(base,deps,scripts){
  return {
    async fetch(request,env,ctx){
      const url=new URL(request.url);
      const path=url.pathname.replace(/\/$/,'')||'/';
      if(!deps.hosts.includes(url.hostname))return base.fetch(request,env,ctx);
      const context={request,env,ctx};
      const tenders=enabled(env,'V12_TENDERS_ENABLED');
      const guardian=enabled(env,'V12_GUARDIAN_ENABLED');
      const alerts=enabled(env,'V12_ALERTS_ENABLED');
      try{
        if(path===urls.board||path===urls.guardian){
          const active=path===urls.board?tenders:guardian;
          if(!active)return replyError(404,'Bulunamadı.');
          if(request.method!=='GET'&&request.method!=='HEAD')return replyError(405,'Yöntem desteklenmiyor.');
          return new Response(request.method==='HEAD'?null:path===urls.board?scripts.board:scripts.guardian,
            {headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'public, max-age=300','x-content-type-options':'nosniff'}});
        }
        if(path==='/api/v12/tenders')return tenders?await tenderApi(context,deps):replyError(404,'Bulunamadı.');
        if(path==='/api/v12/tender-guide')return tenders?await guideTender(context,deps):replyError(404,'Bulunamadı.');
        if(path==='/api/v12/tender-alerts')return tenders&&alerts?await notificationApi(context,deps):replyError(404,'Bulunamadı.');
        if(path==='/admin/api/v12/guardian')return guardian?await guardianApi(context,deps.adminAccess):replyError(404,'Bulunamadı.');
      }catch(error){
        console.error('[yv-v12]',path,error?.name||'Error');
        return replyError(503,'Bu özellik şu anda kullanılamıyor.');
      }
      const result=await base.fetch(request,env,ctx);
      if(request.method!=='GET'||!result.ok||!result.headers.get('content-type')?.includes('text/html'))return result;
      if(path==='/ihale-duyurulari'&&tenders){
        return new HTMLRewriter().on('main',{element(main){
          main.prepend('<section class="section-settings" id="yv12-opportunities" data-alerts="'+Number(alerts)+'"><h2>SANA UYGUN İHALELER</h2></section>',{html:true});
        }}).on('body',{element(body){body.append('<script defer src="'+urls.board+'"></script>',{html:true})}}).transform(result);
      }
      if(path==='/admin'&&guardian){
        return new HTMLRewriter().on('#panel-usage',{element(panel){
          panel.append('<section class="section-settings" id="yv12-guardian"><h3>Sistem Sağlığı</h3><button type="button">Kontrol durumunu getir</button><div data-guardian-report role="status"></div></section>',{html:true});
        }}).on('body',{element(body){body.append('<script defer src="'+urls.guardian+'"></script>',{html:true})}}).transform(result);
      }
      return result;
    },
    async scheduled(controller,env,ctx){
      if(controller.cron==='* * * * *'){
        if(enabled(env,'V12_GUARDIAN_ENABLED'))ctx.waitUntil(runGuardian(env).catch(e=>console.error('[guardian]',e?.name||'Error')));
        if(enabled(env,'V12_TENDERS_ENABLED')&&enabled(env,'V12_ALERTS_ENABLED')){
          ctx.waitUntil(scanTenderAlerts(env).then(()=>sendTenderAlerts(env)).catch(e=>console.error('[tender-alerts]',e?.name||'Error')));
        }
      }
      return base.scheduled(controller,env,ctx);
    }
  };
}
