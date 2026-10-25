import {PROVINCES} from './turkey-locations.js';
import {fold} from './location-tools.js';
window.YUKVINC_DISTRICTS=Object.fromEntries(PROVINCES.map(p=>[fold(p.name),p.districts.map(d=>d.name)]));
