export const DEFAULT_AI_MODERATION={enabled:true,image_review:true,auto_publish:true,sensitivity:'balanced'};
export async function readAiModeration(db){
 try{const row=await db.prepare("SELECT value_json FROM site_settings WHERE setting_key='ai_moderation'").first();if(!row?.value_json)return{...DEFAULT_AI_MODERATION};const value=JSON.parse(row.value_json);return{enabled:value.enabled!==false,image_review:value.image_review!==false,auto_publish:value.auto_publish!==false,sensitivity:value.sensitivity==='strict'?'strict':'balanced'}}catch{return{...DEFAULT_AI_MODERATION}}
}
export function cleanAiModeration(input){
 if(!input||typeof input!=='object'||typeof input.enabled!=='boolean'||typeof input.image_review!=='boolean'||typeof input.auto_publish!=='boolean'||!['balanced','strict'].includes(input.sensitivity))return null;
 return{enabled:input.enabled,image_review:input.image_review,auto_publish:input.auto_publish,sensitivity:input.sensitivity};
}
