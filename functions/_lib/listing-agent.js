import {reviewListingInBackground} from './listings.js';
import {readAiModeration} from './ai-settings.js';

// Background jobs collect evidence; only authenticated admins publish.
export async function processListingAgent(env){
  const db=env.DB;if(!db||env.AI_ENABLED!=='true'||!env.AI)return{skipped:true,reason:'ai_unavailable'};
  const config=await readAiModeration(db);
  if(!config.enabled)return{skipped:true,reason:'disabled'};
  const {results:unreviewed=[]}=await db.prepare("SELECT l.* FROM listings l WHERE l.status='pending' AND l.created_at>unixepoch()-86400 AND NOT EXISTS(SELECT 1 FROM admin_activity a WHERE a.entity_id=l.id AND a.action IN ('ai.listing.review_completed','ai.listing.image_review_failed') AND a.created_at>=l.updated_at) AND NOT EXISTS(SELECT 1 FROM admin_activity a WHERE a.entity_id=l.id AND a.action='ai.listing.review_started' AND a.created_at>unixepoch()-600) AND (SELECT COUNT(*) FROM admin_activity a WHERE a.entity_id=l.id AND a.action='ai.listing.review_started')<3 ORDER BY l.created_at ASC LIMIT 2").all();
  for(const item of unreviewed)await reviewListingInBackground(env,item.id,item.user_id,{...item,category:item.service_category||item.category_detail||item.category});
  return{reviewed:unreviewed.length,published:0,reason:'admin_decision_required'};
}
