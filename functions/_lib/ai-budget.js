// Reserve before every inference. Counters include failed and timed-out requests.
// These conservative caps bound calls; actual free allowance still depends on model pricing.
export async function runBudgetedAI(env,model,input,actor='system'){
 if(!env.AI||!env.DB)throw Error('AIUnavailable');
 const day=new Date().toISOString().slice(0,10),key=String(actor).slice(0,100);
 await env.DB.prepare('INSERT OR IGNORE INTO ai_model_budget(day,actor,calls) VALUES(?,?,0)').bind(day,key).run();
 const reservation=await env.DB.prepare('UPDATE ai_model_budget SET calls=calls+1 WHERE day=? AND actor=? AND calls<12 AND (SELECT COALESCE(SUM(calls),0) FROM ai_model_budget WHERE day=?)<30').bind(day,key,day).run();
 if(!reservation.meta?.changes)throw Error('AIDailyBudget');
 let timer;try{return await Promise.race([env.AI.run(model,input),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('AITimeout')),15000)})])}finally{clearTimeout(timer)}
}
