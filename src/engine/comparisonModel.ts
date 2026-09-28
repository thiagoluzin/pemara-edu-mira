import type {ComparisonRow} from '../types/lesson';
export function comparisonValue(row:ComparisonRow,column:string,index:number){
 if(index===0)return row.criteria??'';
 const normalize=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
 const key=Object.keys(row).find(k=>normalize(k)===normalize(column));
 return key?row[key]:'—';
}
