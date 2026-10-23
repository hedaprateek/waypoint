export const STALE_AFTER_DAYS=90;
const timestamp=value=>{if(typeof value!=='string')return null;const n=Date.parse(value.length===10?value+'T12:00:00Z':value);return Number.isFinite(n)?n:null;};
export function formatDataDate(value){const n=timestamp(value);return n===null?'Not recorded':new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Kolkata'}).format(n);}
export function isOld(value,now=Date.now(),days=STALE_AFTER_DAYS){const time=timestamp(value);return time!==null&&now-time>days*864e5;}
export function sourceFreshness(manifest,now=Date.now()){
 const sources=manifest.sources||{},bundle=manifest.built;const checked=(source)=>source?.retrievedAt?{label:'Last downloaded',value:source.retrievedAt}:{label:'Bundled',value:bundle};
 const rail=checked(sources.rail),airports=checked(sources.airports),connections=checked(sources.connections);const generated=sources.connections?.generatedAt||manifest.flightGenerated;
 return [
  {id:'rail',label:'Rail stations & timetable',checked:rail,period:manifest.railTimetableDate?'Timetable dated '+formatDataDate(manifest.railTimetableDate):'Approximate timetable · effective date not supplied',stale:isOld(rail.value,now),source:'https://github.com/prasenjit-27/Indian-Railway-Data'},
  {id:'airports',label:'Airport directory',checked:airports,period:sources.airports?.upstreamModifiedAt?'Source file modified '+formatDataDate(sources.airports.upstreamModifiedAt):'Locations and passenger-service flags',stale:isOld(airports.value,now),source:'https://ourairports.com/data/'},
  {id:'connections',label:'Airport connections',checked:connections,period:generated?'Source snapshot '+formatDataDate(generated):'Source snapshot date not supplied',reportingPeriods:sources.connections?.reportingPeriods||[],stale:isOld(connections.value,now)||isOld(generated,now),source:'https://airportmiles.com/api'},
  {id:'estimates',label:'Fares & journey estimates',checked:{label:'Method',value:null},period:'Approximate cost and time models · recalculated for each search',stale:false,source:null}
 ];
}
