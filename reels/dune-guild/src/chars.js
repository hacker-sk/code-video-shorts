import {THREE,glowMat} from './lib.js';
const PI=Math.PI,V2=(a,b)=>new THREE.Vector2(a,b);
const SP=(r,a=14,b=10)=>new THREE.SphereGeometry(r,a,b);
const CAP=(r,l)=>new THREE.CapsuleGeometry(r,l,4,8);
const CY=(a,b,h,s=12)=>new THREE.CylinderGeometry(a,b,h,s);
const BX=(x,y,z)=>new THREE.BoxGeometry(x,y,z);
function put(par,g,m,p=[0,0,0],s=[1,1,1],r=[0,0,0]){const x=new THREE.Mesh(g,m);x.position.set(p[0],p[1],p[2]);x.scale.set(s[0],s[1],s[2]);x.rotation.set(r[0],r[1],r[2]);par.add(x);return x;}

// Rigged-by-hand human: kind = soldier | commander | leader | civ
export function human(M,o={}){
 const K=o.kind||'soldier',low=!!o.low,seed=o.seed||1,S=Math.sin,C=Math.cos;
 const skin=new THREE.MeshStandardMaterial({color:o.skin||0xc49478,roughness:.55,metalness:0});
 const hairM=new THREE.MeshStandardMaterial({color:o.hair||0x1a120d,roughness:.7});
 const uni=M.fabricColor(o.uni||(K==='civ'?0x6a5a3a:0x1c1f25));
 const mainM=K==='leader'?M.fabricColor(o.robe||0x3a2a1a):uni;
 const glove=new THREE.MeshStandardMaterial({color:0x121316,roughness:.6});
 const boot=new THREE.MeshStandardMaterial({color:0x17181b,roughness:.5,metalness:.2});
 const root=new THREE.Group(),hips=new THREE.Group();hips.position.y=.95;root.add(hips);
 const spine=new THREE.Group();hips.add(spine);
 put(hips,SP(1),mainM,[0,0,0],[.17,.11,.125]);
 put(spine,CY(.145,.16,.24),mainM,[0,.09,0]);
 put(spine,SP(1,16,12),mainM,[0,.33,0],[.2,.27,.125]);
 put(spine,CY(.052,.058,.14,10),skin,[0,.6,0]);
 put(spine,CY(.075,.095,.07,12),K==='leader'?mainM:uni,[0,.56,0]);
 for(const s of[-1,1])put(spine,SP(.06,10,8),mainM,[s*.2,.5,0]);
 // head
 const head=new THREE.Group();head.position.y=.62;spine.add(head);
 put(head,SP(1,16,12),skin,[0,.11,0],[.088,.115,.1]);
 put(head,SP(1,12,8),skin,[0,.03,.025],[.07,.06,.08]);
 put(head,new THREE.ConeGeometry(.015,.046,6),skin,[0,.09,.098],[1,1,1],[PI/2,0,0]);
 put(head,BX(.12,.012,.02),skin,[0,.147,.09]);
 put(head,BX(.04,.007,.008),new THREE.MeshStandardMaterial({color:0x6a3a32,roughness:.5}),[0,.046,.094]);
 put(head,BX(.034,.008,.01),new THREE.MeshStandardMaterial({color:0xa86a5a,roughness:.5}),[0,.036,.091]);
 for(const s of[-1,1])put(head,SP(1,8,6),skin,[s*.09,.11,0],[.012,.03,.02]);
 const eyes=[];
 for(const s of[-1,1]){const eg=new THREE.Group();eg.position.set(s*.034,.125,.083);head.add(eg);
  put(eg,SP(.0155,10,8),new THREE.MeshStandardMaterial({color:0xe8e4de,roughness:.3}),[0,0,0],[1,1,.8]);
  put(eg,SP(.009,8,6),new THREE.MeshStandardMaterial({color:o.eye||0x4a3a2a,roughness:.3}),[0,0,.0105]);
  put(eg,SP(.0045,6,4),new THREE.MeshBasicMaterial({color:0x050505}),[0,0,.0142]);eyes.push(eg);}
 if(K==='soldier'){
  put(head,SP(1,16,10),M.armor,[0,.125,-.002],[.105,.112,.115]);
  put(head,BX(.15,.03,.03),new THREE.MeshStandardMaterial({color:0x050607,roughness:.1,metalness:.6}),[0,.1,.1]);
  for(const s of[-1,1])put(head,BX(.02,.07,.09),M.armor,[s*.098,.07,.02]);
 }else{
  put(head,new THREE.SphereGeometry(1,16,10,0,PI*2,0,PI*.34),hairM,[0,.115,-.005],[.1,.105,.105]);
  put(head,SP(1,12,8),hairM,[0,.1,-.05],[.09,.08,.07]);
  for(const s of[-1,1])put(head,BX(.012,.05,.03),hairM,[s*.088,.11,.02]);
  if(K==='commander'){put(head,SP(1,12,8),new THREE.MeshStandardMaterial({color:0x2a1e18,transparent:true,opacity:.35,roughness:1}),[0,.03,.027],[.072,.062,.082]);
   put(head,BX(.004,.05,.005),new THREE.MeshStandardMaterial({color:0x9c6a5a,roughness:.6}),[.062,.085,.088],[1,1,1],[0,0,.3]);}
 }
 // arms
 const sh={},el={};
 for(const s of[-1,1]){const k=s>0?'L':'R';const g=new THREE.Group();g.position.set(s*.215,.5,0);spine.add(g);sh[k]=g;
  put(g,CAP(.042,.22),mainM,[0,-.15,0]);
  const e=new THREE.Group();e.position.y=-.3;g.add(e);el[k]=e;
  put(e,CAP(.036,.2),mainM,[0,-.14,0]);
  const h=new THREE.Group();h.position.y=-.29;e.add(h);
  const hm=(K==='leader'||K==='civ')?skin:glove;
  put(h,BX(.08,.095,.035),hm,[0,-.045,0]);if(!low)put(h,CAP(.012,.04),hm,[s*.045,-.035,.02],[1,1,1],[.4,0,s*.3]);
  if(K==='soldier'){put(e,BX(.08,.13,.06),M.armor,[0,-.14,.005]);put(g,SP(1,8,6),M.armor,[0,.0,0],[.085,.05,.095]);}}
 // legs
 const hip={},kn={};
 if(K!=='leader'){for(const s of[-1,1]){const k=s>0?'L':'R';const g=new THREE.Group();g.position.set(s*.09,-.02,0);hips.add(g);hip[k]=g;
  put(g,CAP(.065,.36),uni,[0,-.22,0]);
  const kg=new THREE.Group();kg.position.y=-.44;g.add(kg);kn[k]=kg;
  put(kg,CAP(.05,.34),uni,[0,-.22,0]);
  const f=new THREE.Group();f.position.y=-.44;kg.add(f);
  put(f,BX(.095,.075,.26),boot,[0,-.04,.05]);
  if(K==='soldier')put(kg,BX(.1,.09,.06),M.armor,[0,0,.05]);}}
 let skirt=null;
 if(K==='leader'){skirt=put(hips,new THREE.LatheGeometry([[.17,.03],[.22,-.2],[.31,-.55],[.37,-.92],[.38,-.95]].map(p=>V2(p[0],p[1])),16),mainM);skirt.material=mainM;mainM.side=THREE.DoubleSide;
  put(spine,SP(1,10,8),M.goldS,[.07,.42,.126],[.03,.03,.008]);}
 // role gear
 if(K==='soldier'){
  put(spine,BX(.36,.32,.1),M.armor,[0,.34,.075]);put(spine,BX(.34,.3,.08),M.armor,[0,.34,-.075]);
  put(spine,CY(.168,.168,.045,14),M.armor,[0,.02,0]);
  for(const s of[-1,1])put(spine,BX(.07,.09,.05),M.armor,[s*.12,.03,.17]);
  const rf=new THREE.Group();rf.position.set(0,.27,.27);spine.add(rf);
  put(rf,BX(.06,.09,.78),new THREE.MeshStandardMaterial({color:0x1b1c1f,metalness:.6,roughness:.4}),[0,0,.05]);
  put(rf,CY(.012,.012,.3,6),boot,[0,.01,.52],[1,1,1],[PI/2,0,0]);put(rf,BX(.04,.05,.18),boot,[0,.07,.0]);put(rf,BX(.05,.12,.2),boot,[0,-.03,-.34]);
 }
 if(K==='commander'){
  put(spine,BX(.3,.22,.05),M.armor,[0,.36,.115]);
  put(spine,CY(.025,.025,.006,12),M.goldS,[.07,.4,.142],[1,1,1],[PI/2,0,0]);
  for(const s of[-1,1]){put(spine,BX(.1,.02,.1),M.goldS,[s*.2,.57,0],[1,1,1],[0,0,s*-.3]);}
  put(spine,CY(.16,.17,.05,14),M.goldS,[0,.02,0]);put(spine,BX(.04,.04,.01),M.goldS,[0,.02,.17]);
  put(spine,new THREE.LatheGeometry([[.15,.06],[.2,-.1],[.24,-.3],[.26,-.42]].map(p=>V2(p[0],p[1])),16),uni,[0,0,0]);
 }
 const A={sh,el,hip,kn};
 function pose(mode='idle',t=0,x={}){
  const ph=seed*1.7;
  hips.position.set(0,.95,0);hips.rotation.set(0,0,0);spine.rotation.set(0,0,0);head.rotation.set(0,0,0);
  for(const k of['L','R']){sh[k].rotation.set(0,0,k==='L'?.1:-.1);el[k].rotation.set(-.2,0,0);if(hip[k]){hip[k].rotation.set(0,0,0);kn[k].rotation.set(0,0,0);}}
  spine.rotation.x=S(t*1.8+ph)*.012;
  if(mode==='idle'){hips.rotation.z=.015*S(t*.45+ph);head.rotation.y=.12*S(t*.31+ph);}
  else if(mode==='walk'||mode==='walkRifle'){const sp=x.speed||1,p=t*5.2*sp+ph;
   hips.position.y=.92+.03*Math.abs(C(p));hips.rotation.y=.06*S(p);spine.rotation.y=-.08*S(p);
   if(hip.L){hip.L.rotation.x=-S(p)*.55;hip.R.rotation.x=S(p)*.55;kn.L.rotation.x=Math.max(0,C(p))*.85;kn.R.rotation.x=Math.max(0,-C(p))*.85;}
   if(mode==='walk'){sh.L.rotation.x=S(p)*.35;sh.R.rotation.x=-S(p)*.35;}
   else{sh.L.rotation.set(-1.25,0,-.15);el.L.rotation.x=-.5;sh.R.rotation.set(-.95,0,.1);el.R.rotation.x=-1.15;spine.rotation.x=.06;}}
  else if(mode==='crouch'){hips.position.y=.5;hips.position.z=-.05;spine.rotation.x=.3;head.rotation.x=-.25;
   if(hip.L){hip.L.rotation.x=-1.3;hip.R.rotation.x=-1.3;kn.L.rotation.x=2.2;kn.R.rotation.x=2.2;}
   sh.L.rotation.set(-1.0,0,-.15);el.L.rotation.x=-.5;sh.R.rotation.set(-.9,0,.1);el.R.rotation.x=-1.1;
   if(x.check){const w=S(t*2.2+ph)*.12;sh.L.rotation.x=-1.1;el.L.rotation.x=-1.6+w;sh.R.rotation.x=-1.0;el.R.rotation.x=-1.7-w;head.rotation.x=.35;}}
  else if(mode==='sit'){hips.position.y=.52;spine.rotation.x=-.04;
   if(hip.L){hip.L.rotation.x=-1.55;hip.R.rotation.x=-1.55;kn.L.rotation.x=1.5;kn.R.rotation.x=1.5;}
   sh.L.rotation.set(-.7,0,-.05);el.L.rotation.x=-1.2;sh.R.rotation.set(-.7,0,.05);el.R.rotation.x=-1.2;head.rotation.y=(x.yaw||0)+.1*S(t*.3+ph);
   if(x.talk){sh.R.rotation.set(-1.1,0,.2);el.R.rotation.x=-.9+.3*S(t*2.4);}}
  else if(mode==='press'){sh.R.rotation.set(-1.2+.05*S(t*6),0,.05);el.R.rotation.x=-.45;spine.rotation.x=.12;head.rotation.x=.18;}
  else if(mode==='study'){sh.R.rotation.set(-1.1,0,.2);el.R.rotation.x=-2.0;head.rotation.x=.12;head.rotation.y=.1*S(t*.4);sh.L.rotation.set(-.2,0,.2);el.L.rotation.x=-.9;}
  else if(mode==='cancel'){const g=S(clamp01(x.g||0)*PI);sh.R.rotation.set(-1.3*g,0,-.1-.3*g);el.R.rotation.x=-.9*g;head.rotation.x=.05*g;}
  if(x.yaw!==undefined&&mode!=='sit')head.rotation.y+=x.yaw;if(x.pitch)head.rotation.x+=x.pitch;
  const bl=((t*.37+seed*.13)%1)<.04?.1:1;eyes.forEach(e=>{e.scale.y=bl;e.rotation.y=(x.yaw||0)*-.3;});
  if(skirt)skirt.scale.y=hips.position.y/.95;
 }
 const clamp01=v=>Math.min(1,Math.max(0,v));
 pose('idle',0);
 return{g:root,pose,hips,A};
}

// ---- Spacing Guild Navigator: elongated, spice-mutated, pale, blue-in-blue eyes ----
export function navigator(M){
 const g=new THREE.Group(),body=new THREE.Group();g.add(body);
 const skin=M.navSkin;
 const tors=[[.02,-.45],[.1,-.4],[.16,-.2],[.19,0],[.17,.3],[.2,.6],[.22,.85],[.17,1.1],[.1,1.3],[.07,1.45]];
 put(body,new THREE.LatheGeometry(tors.map(p=>V2(p[0],p[1])),20),skin);
 for(let y=.5;y<1.05;y+=.085)put(body,new THREE.TorusGeometry(.2,.007,6,20),skin,[0,y,0],[1,1,.72],[PI/2,0,0]);
 for(let y=-.1;y<1.35;y+=.1)put(body,SP(.016,6,5),skin,[0,y,-.17+(y>.5?-.02:0)]);
 put(body,CY(.055,.07,.34,10),skin,[0,1.58,0]);
 const slit=new THREE.MeshBasicMaterial({color:0x303848});
 for(let i=0;i<4;i++)for(const s of[-1,1])put(body,BX(.03,.004,.012),slit,[s*.045,1.48+i*.05,.05]);
 // head
 const head=new THREE.Group();head.position.set(0,1.95,0);head.rotation.x=.12;body.add(head);
 put(head,SP(1,24,16),skin,[0,.1,-.02],[.165,.31,.2]);
 put(head,SP(1,16,12),skin,[0,-.1,.05],[.1,.1,.12]);
 const dk=new THREE.MeshStandardMaterial({color:0x151a22,roughness:.9});
 const eyeM=new THREE.MeshBasicMaterial({map:M.eyeTex,toneMapped:false});
 const eyes=[];
 for(const s of[-1,1]){put(head,SP(.062,14,10),dk,[s*.085,.07,.15],[1,1,.55]);
  const e=put(head,SP(.05,18,14),eyeM,[s*.085,.07,.162]);e.rotation.y=-PI/2;eyes.push(e);
  put(head,new THREE.TorusGeometry(.058,.009,6,18),skin,[s*.085,.07,.17]);
  put(head,BX(.012,.05,.006),dk,[s*.014,-.05,.196]);}
 put(head,BX(.1,.006,.012),dk,[0,-.13,.168]);
 // arms
 const arms=[];
 for(const s of[-1,1]){const a=new THREE.Group();a.position.set(s*.24,1.3,0);body.add(a);arms.push(a);
  a.rotation.set(-.15,0,s*.35);put(a,CAP(.028,.5),skin,[0,-.28,0]);
  const f=new THREE.Group();f.position.y=-.56;f.rotation.x=-.9;a.add(f);put(f,CAP(.022,.5),skin,[0,-.28,0]);
  const h=new THREE.Group();h.position.y=-.58;f.add(h);put(h,BX(.05,.07,.015),skin,[0,-.03,0]);
  for(let i=0;i<5;i++){const fg=put(h,CAP(.007,.2),skin,[(i-2)*.012,-.14,0]);fg.rotation.z=(i-2)*.14;}}
 // withered legs, curled
 for(const s of[-1,1]){const l=new THREE.Group();l.position.set(s*.08,-.4,0);body.add(l);l.rotation.set(.25,0,s*.12);put(l,CAP(.035,.4),skin,[0,-.25,0]);
  const k=new THREE.Group();k.position.y=-.5;k.rotation.x=-.6;l.add(k);put(k,CAP(.025,.34),skin,[0,-.2,0]);}
 put(body,new THREE.LatheGeometry([[.2,.05],[.26,-.2],[.3,-.55]].map(p=>V2(p[0],p[1])),14),new THREE.MeshStandardMaterial({color:0xcfc8bd,roughness:.8,transparent:true,opacity:.8,side:THREE.DoubleSide}),[0,-.3,0]);
 // eye glow
 const gp=new THREE.BufferGeometry();gp.setAttribute('position',new THREE.Float32BufferAttribute([-.085,.07,.2,.085,.07,.2],3));gp.setAttribute('aCol',new THREE.Float32BufferAttribute([.2,.55,1,.2,.55,1],3));gp.setAttribute('aSize',new THREE.Float32BufferAttribute([.3,.3],1));
 const glow=new THREE.Points(gp,glowMat);glow.frustumCulled=false;head.add(glow);
 g.userData.update=(t,k=0)=>{
  body.position.y=Math.sin(t*.5)*.08;body.rotation.y=Math.sin(t*.23)*.12;head.rotation.x=.12+Math.sin(t*.4)*.02;head.rotation.y=Math.sin(t*.17)*.06;
  arms[0].rotation.z=.35+Math.sin(t*.6)*.04;arms[1].rotation.z=-.35-Math.sin(t*.6+1)*.04;
  eyes.forEach((e,i)=>{e.rotation.x=Math.sin(t*.35+i)*.05;});
  eyeM.color.setScalar(.8+k*2.2);const a=gp.attributes.aSize;a.array[0]=a.array[1]=.2+k*.7;a.needsUpdate=true;};
 g.userData.eyeWorldY=1.95+.07;
 return g;
}
