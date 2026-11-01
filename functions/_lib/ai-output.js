export function parseAIObject(value){
 if(value&&typeof value==='object'&&!Array.isArray(value))return value;
 let text=String(value??'').trim().replace(/^\uFEFF/,'');
 text=text.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
 try{
  const parsed=JSON.parse(text);
  if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))return parsed;
 }catch{}
 const start=text.indexOf('{'),end=text.lastIndexOf('}');
 if(start>=0&&end>start){
  const parsed=JSON.parse(text.slice(start,end+1));
  if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))return parsed;
 }
 throw new Error('InvalidAIJson');
}

const foldText=value=>String(value??'').normalize('NFKC').toLocaleLowerCase('tr').replace(/ı/g,'i').normalize('NFD').replace(/\p{Diacritic}/gu,'');
const numericFacts=value=>new Set((String(value??'').match(/\d+(?:[.,]\d+)*/g)||[]).map(x=>x.replace(/\D/g,'')));
const unsupportedClaimTerms=['garantili','garanti','sertifikali','sertifika','belgeli','yetkili','sigortali','bakimli','sifir','arizasiz','orijinal','7/24'];

// AI text is a user-reviewed draft. Never allow generated contact details,
// links, markup, or numeric/quality claims that were absent from the source note.
export function isSafeListingSuggestion(value,{sourceNote='',selectedCategory=''}={}){
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const {title,description,category}=value;
 if(typeof title!=='string'||title.trim().length<5||title.length>120||typeof description!=='string'||description.trim().length<20||description.length>1200)return false;
 const allowed=['crane','tow','mobile_tire','basket','machine','manlift','lift','operator'];
 if(!allowed.includes(category)||(selectedCategory&&category!==selectedCategory))return false;
 const output=`${title}\n${description}`;
 if(/[<>`]/.test(output)||/(?:https?:\/\/|www\.|t\.me\/|wa\.me\/)/i.test(output)||/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(output)||/(?:\+?90[\s-]?)?(?:0?[2-5]\d{2})[\s().-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/.test(output))return false;
 const source=foldText(sourceNote),generated=foldText(output),sourceNumbers=numericFacts(sourceNote);
 for(const number of numericFacts(output))if(!sourceNumbers.has(number))return false;
 for(const term of unsupportedClaimTerms)if(generated.includes(term)&&!source.includes(term))return false;
 return true;
}

export async function runAIObjectWithFallback(ai,models,input,{validate=()=>true,onFallback=()=>{}}={}){
 let lastError;
 for(let index=0;index<models.length;index++){
  const model=models[index];
  try{
   const result=await ai.run(model,input),value=parseAIObject(result?.response??result?.output_text??result);
   if(!validate(value))throw new Error('InvalidAIOutput');
   return{value,model};
  }catch(error){
   lastError=error;
   if(index<models.length-1)onFallback({model,nextModel:models[index+1],error});
  }
 }
 throw lastError||new Error('AIUnavailable');
}
