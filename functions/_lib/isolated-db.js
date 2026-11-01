export async function isolatedDb(env){
 if(!env.TEST_DB)throw new Error('Yalıtılmış test veritabanı bağlı değil.');
 const db=env.TEST_DB;
 // Refuse to write to production if the test binding is misconfigured.
 if(await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('listings','admin_sessions','user_sessions') LIMIT 1").first())throw new Error('Test veritabanı ayrımı doğrulanamadı.');
 const identity=await db.prepare('SELECT purpose FROM lab_identity WHERE id=1').first();
 if(identity?.purpose!=='yukvinc-isolated-test-v1')throw new Error('Test veritabanı kimliği doğrulanamadı.');
 return db;
}
