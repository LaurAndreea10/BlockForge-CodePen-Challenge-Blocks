'use strict';
const SIZE=8,TILE=52,LIFT=22,MAX_Z=8,STORE='blockforge.ultimate.scene',BEST='blockforge.ultimate.best';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const I18N={
 en:{eyebrow:'CodePen Challenge · Blocks',subtitle:'Build smarter, demolish harder and master every structural challenge.',blocks:'blocks',height:'height',stability:'stability',score:'score',combo:'combo',build:'Build',demolish:'Demolish',challenge:'Challenge',campaign:'Campaign',survival:'Survival',versus:'Versus',toolbox:'Toolbox',demolitionTools:'Demolition tools',editor:'Editor',duplicate:'Duplicate',mirror:'Mirror',rotate:'Rotate',selectAll:'Select all',mission:'Mission',progress:'Progress',roundSummary:'Round summary',dailyChallenge:'Daily challenge',startDaily:'Start daily',tutorial:'Tutorial',startTutorial:'Start tutorial',start:'Start',finish:'Finish',next:'Next',player:'Player',turn:'turn',budget:'Budget',wave:'Wave',level:'Level'},
 ro:{eyebrow:'Provocare CodePen · Blocuri',subtitle:'Construiește inteligent, demolează spectaculos și stăpânește fiecare provocare structurală.',blocks:'blocuri',height:'înălțime',stability:'stabilitate',score:'scor',combo:'combo',build:'Construiește',demolish:'Demolează',challenge:'Provocare',campaign:'Campanie',survival:'Supraviețuire',versus:'Duel',toolbox:'Instrumente',demolitionTools:'Unelte demolare',editor:'Editor',duplicate:'Duplică',mirror:'Oglindește',rotate:'Rotește',selectAll:'Selectează tot',mission:'Misiune',progress:'Progres',roundSummary:'Rezumat rundă',dailyChallenge:'Provocarea zilei',startDaily:'Pornește zilnica',tutorial:'Tutorial',startTutorial:'Pornește tutorialul',start:'Start',finish:'Finalizează',next:'Următorul',player:'Jucător',turn:'tură',budget:'Buget',wave:'Val',level:'Nivel'}
};
const BLOCKS=[
 {id:'core',name:{en:'Core',ro:'Nucleu'},tone:'#54f3ff',mass:3,hp:5,cost:3,power:'solid'},
 {id:'moss',name:{en:'Moss',ro:'Mușchi'},tone:'#78ff9d',mass:1,hp:2,cost:1,power:'repair'},
 {id:'ember',name:{en:'Ember',ro:'Jar'},tone:'#ff7d55',mass:1,hp:1,cost:1,power:'explosive'},
 {id:'magnet',name:{en:'Magnet',ro:'Magnet'},tone:'#b98cff',mass:2,hp:3,cost:3,power:'magnetic'},
 {id:'gel',name:{en:'Gel',ro:'Gel'},tone:'#ff59d8',mass:1,hp:3,cost:2,power:'sticky'},
 {id:'void',name:{en:'Void',ro:'Vid'},tone:'#6e78ff',mass:4,hp:7,cost:5,power:'indestructible'},
 {id:'float',name:{en:'Float',ro:'Plutitor'},tone:'#ffd166',mass:.5,hp:2,cost:2,power:'light'}
];
const TOOLS=[
 {id:'ball',icon:'⚫',name:{en:'Wrecking ball',ro:'Bilă'}},
 {id:'bomb',icon:'💣',name:{en:'Bomb',ro:'Bombă'}},
 {id:'laser',icon:'🔴',name:{en:'Laser',ro:'Laser'}},
 {id:'quake',icon:'🌋',name:{en:'Quake',ro:'Cutremur'}},
 {id:'meteor',icon:'☄️',name:{en:'Meteor',ro:'Meteorit'}},
 {id:'hammer',icon:'🔨',name:{en:'Hammer',ro:'Ciocan'}}
];
const CAMPAIGN=[
 {h:3,max:16,hits:0,types:2},{h:4,max:20,hits:1,types:3},{h:5,max:22,hits:2,types:3},{h:6,max:25,hits:2,types:4},{h:7,max:28,hits:3,types:4}
];
let state={scene:[],past:[],future:[],mode:'build',active:'core',tool:'ball',gravity:false,lang:localStorage.getItem('bf.lang')||'en',theme:localStorage.getItem('bf.theme')||'neon',spin:45,tilt:58,zoom:1,selected:new Set(),budget:40,running:false,score:0,combo:1,maxCombo:1,destroyed:0,hits:0,level:0,wave:0,player:1,turn:1,tutorial:0,daily:false};
let uid=0,drag=null,paint=false,hazardTimer=null,audio=null;
const el={stage:$('#stage'),world:$('#world'),grid:$('#grid'),blocks:$('#blocksLayer'),fx:$('#fxLayer'),hint:$('#hint'),mission:$('#missionCard'),objectives:$('#objectiveList'),summary:$('#summary'),result:$('#resultCard'),toast:$('#toast'),hazard:$('#hazardOverlay')};
const type=id=>BLOCKS.find(b=>b.id===id),column=(x,y)=>state.scene.filter(b=>b.x===x&&b.y===y),heightAt=(x,y)=>column(x,y).reduce((m,b)=>Math.max(m,b.z+1),0),at=(x,y,z)=>state.scene.find(b=>b.x===x&&b.y===y&&b.z===z);
function t(k){return I18N[state.lang][k]||k} function tr(en,ro){return state.lang==='ro'?ro:en}
function toast(msg){el.toast.textContent=msg;el.toast.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.toast.classList.remove('show'),1700)}
function buzz(ms=30){navigator.vibrate?.(ms)}
function beep(freq=440,d=.07){if($('#soundBtn').textContent==='🔇')return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=freq;g.gain.value=.06;o.connect(g).connect(audio.destination);o.start();g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+d);o.stop(audio.currentTime+d)}catch{}}
function init(){document.body.dataset.theme=state.theme;buildPalette();buildTools();buildGrid();bind();applyLanguage();setMode('build');render();}
function buildPalette(){const p=$('#palette');p.innerHTML='';BLOCKS.forEach(b=>{const btn=document.createElement('button');btn.type='button';btn.className='chip';btn.dataset.block=b.id;btn.style.setProperty('--tone',b.tone);btn.innerHTML=`<span class="swatch"></span><span><b>${b.name[state.lang]}</b><small>m${b.mass} · hp${b.hp} · ${b.cost}</small></span>`;btn.onclick=()=>{state.active=b.id;buildPalette();beep(650)};p.append(btn)});p.querySelector(`[data-block="${state.active}"]`)?.classList.add('active')}
function buildTools(){const g=$('#toolGrid');g.innerHTML='';TOOLS.forEach(tool=>{const b=document.createElement('button');b.type='button';b.dataset.tool=tool.id;b.innerHTML=`${tool.icon}<span>${tool.name[state.lang]}</span>`;b.onclick=()=>{state.tool=tool.id;buildTools();toast(tool.name[state.lang])};g.append(b)});g.querySelector(`[data-tool="${state.tool}"]`)?.classList.add('active')}
function buildGrid(){el.grid.innerHTML='';for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){const d=document.createElement('div');d.className='tile';d.dataset.x=x;d.dataset.y=y;d.onpointerdown=e=>{e.stopPropagation();paint=true;actTile(x,y)};d.onpointerenter=()=>{if(paint&&state.mode!=='demolish')place(x,y)};el.grid.append(d)}}
