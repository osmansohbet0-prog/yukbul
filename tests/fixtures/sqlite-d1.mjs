import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export function sqliteD1(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON;');
 sqlite.exec(readFileSync(new URL('./production-schema.sql',import.meta.url),'utf8'));
 sqlite.exec(readFileSync(new URL('../../migrations/0011_agent_limits_locations.sql',import.meta.url),'utf8'));
 sqlite.exec(readFileSync(new URL('../../migrations/0012_listing_category_detail.sql',import.meta.url),'utf8'));
 sqlite.exec(readFileSync(new URL('../../migrations/0013_directory_outreach_metrics.sql',import.meta.url),'utf8'));
 sqlite.exec(readFileSync(new URL('../../migrations/0014_mobile_tire_service.sql',import.meta.url),'utf8'));
sqlite.exec(readFileSync(new URL('../../migrations/0015_listing_thumbnails.sql',import.meta.url),'utf8'));
 return{sqlite,prepare(sql){const statement=sqlite.prepare(sql);return{args:[],bind(...args){this.args=args;return this},async first(){return statement.get(...this.args)||null},async all(){return{results:statement.all(...this.args)}},async run(){const r=statement.run(...this.args);return{meta:{changes:Number(r.changes)}}}}},async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results}catch(e){sqlite.exec('ROLLBACK');throw e}}};
}
