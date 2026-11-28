import {THREE,Builder,Glow,rng,E,clamp,lerp,sstep,starDome,planet,tex,setSizes,setPos,glowMat} from './lib.js';
import {heighliner,foldFx,station,transport,warship,barge,container} from './ships.js';
import {human} from './chars.js';
const PI=Math.PI;

// time that freezes after scene 5 (the Guild stops transporting)
export function orbitTime(c){const t0=c.S[4],D=(c.S[5]-c.S[4])*.6;if(c.t<=t0)return c.t;const x=Math.min(1,(c.t-t0)/D);return t0+D/2*(2*x-x*x);}
const mesh=(geo,mat,p,par)=>{const m=new THREE.Mesh(geo,mat);m.position.set(p[0],p[1],p[2]);par.add(m);return m;};

// ===== ENV: deep space, Heighliner megastructure, planet, orbital station, traffic =====
export function space(M){
 const g=new THREE.Group(),dome=starDome(3);g.add(dome);
 const pl=planet(2200,{seed:2,c:[0x5a4030,0xa8794a,0x2f2420],atm:0xffa868});pl.position.set(-1500,-1300,-5200);g.add(pl);
 const st=station(M);st.position.set(950,380,-2400);g.add(st);
 const H=heighliner(M);g.add(H);
 [[-900,260,-3300,.6,1],[1300,-200,-5200,-.9,1],[-2600,600,-9000,.2,1.7],[700,420,-7200,1.2,1.2]].forEach(([x,y,z,r,s])=>{const h=H.clone();h.position.set(x,y,z);h.rotation.y=r;h.scale.setScalar(s);g.add(h);});
 const fold=foldFx();fold.position.set(0,0,440);H.add(fold);
 const d=H.userData.dock;
 const bl=new Glow().add([d[0]+150,0,d[2]],0xff2a1a,40).build();bl.visible=false;H.add(bl);
 const ships=[];
 for(let i=0;i<8;i++){const t=i%4,s=t===0?warship(M,{gs:3,seed:i}):t===3?barge(M,{gs:3,seed:i}):transport(M,{gs:3,seed:i});s.scale.setScalar(3);ships.push(s);g.add(s);}
 const hs=transport(M,{gs:3,c:0x40444c,stripe:0xd8b24a});hs.scale.setScalar(3);g.add(hs);
 const tr=transport(M,{gs:3});tr.scale.setScalar(3);g.add(tr);
 hs.visible=tr.visible=false;
 return{g,update(c){
  dome.position.copy(c.cam.position);
  H.rotation.y=Math.sin(c.t*.05)*.03;
  fold.userData.update(c.t,c.scene===12?1:c.scene===3?.6:c.scene>=5?.15:.3);
  const ot=orbitTime(c);
  ships.forEach((s,k)=>{const f=a=>[Math.sin(a)*(170+k*45)*1.3,30+((k%3)-1)*55+Math.sin(a*1.7)*12,Math.cos(a)*(170+k*45)*2.4];const a=ot*(.04+.006*k)+k*1.9,A=f(a),Bn=f(a+.02);s.position.set(A[0],A[1],A[2]);s.lookAt(Bn[0],Bn[1],Bn[2]);});
  tr.visible=c.scene===2&&c.shot===0;
  if(tr.visible){const e=E.inOut(c.sp);tr.position.set(lerp(520,150,e),lerp(25,2,e),d[2]+lerp(80,0,e));tr.lookAt(d[0]+60,0,d[2]);}
  hs.visible=c.scene===6&&c.shot===0;bl.visible=hs.visible;
  if(hs.visible){const e=E.out(clamp(c.sp/.55)),back=sstep(.6,1,c.sp)*60;hs.position.set(lerp(520,260,e)+back,lerp(40,5,e),d[2]+lerp(120,10,e));hs.lookAt(d[0]+40,0,d[2]);setSizes(bl,()=>40+30*Math.sin(c.t*9));}
 }};
}

// ===== ENV: coalition and attacker fleets =====
export function fleet(M){
 const g=new THREE.Group(),dome=starDome(8);g.add(dome);
 const pl=planet(1500,{seed:5,c:[0x30475c,0x6f8fa3,0x20303a],atm:0x7fb8ff});pl.position.set(900,-1000,-4200);g.add(pl);
 const st=station(M);st.scale.setScalar(2.4);st.position.set(-250,-40,-1500);g.add(st);
 const R=rng(33),ships=[];
 const centers=[[-420,60,-1400],[380,-30,-1700],[0,150,-2300],[-160,-90,-900],[600,110,-900]];
 let idx=0;
 centers.forEach((cn,f)=>{const n=f===2?7:4+((f*2)%3);for(let j=0;j<n;j++){const sc=j===0?5:3+R()*1.5,t=(idx++)%4;
  const s=t===0?warship(M,{gs:sc,seed:idx,c:[0x3b4048,0x4a3c33,0x2f3a48,0x45403a][f%4]}):t===3?barge(M,{gs:sc,seed:idx}):transport(M,{gs:sc,seed:idx,c:[0x555b64,0x6a5a48,0x4a5a64][f%3]});
  s.scale.setScalar(sc);const b=[cn[0]+(R()-.5)*300,cn[1]+(R()-.5)*110,cn[2]+(R()-.5)*420];s.position.set(b[0],b[1],b[2]);s.lookAt(b[0]*.2,b[1]*.2,b[2]+500);ships.push({s,b});g.add(s);}});
 const att=warship(M,{gs:5,c:0x4a2f2a});att.scale.setScalar(5);att.position.set(-85,-30,170);att.lookAt(-60,-20,-2000);g.add(att);
 return{g,update(c){dome.position.copy(c.cam.position);const mv=c.scene===7?c.u*300+c.dt*14:0;ships.forEach(({s,b})=>s.position.set(b[0],b[1],b[2]+mv));}};
}

// ===== ENV: Heighliner docking bay (hangar) =====
export function dock(M){
 const g=new THREE.Group(),B=new Builder(),G=new Glow(),R=rng(21);
 g.add(starDome(5));
 const pl=planet(800,{seed:6,c:[0x4a4a58,0x8a8aa0,0x2a2a38],atm:0x88aaff});pl.position.set(-250,120,2600);g.add(pl);
 B.box([0,-.5,0],[72,1,176],'grate',0x8a8f96,{uv:60});
 for(const x of[-10,10])B.box([x,.02,10],[.35,.03,46],'emit',0xe0a820,{k:.8});
 B.box([0,.02,-14],[20,.03,.35],'emit',0xe0a820,{k:.8});B.box([0,.02,34],[20,.03,.35],'emit',0xe0a820,{k:.8});
 for(let z=-76;z<=88;z+=12){
  for(const x of[-34,34])B.box([x,20,z],[1.4,40,1.8],'hull',0x8e8a80);
  B.box([0,39.2,z],[70,1.6,1.8],'hull',0x8e8a80);
  for(const sx of[-1,1]){B.beam([sx*34,2,z],[sx*20,38.5,z],.35,'dark',0x6e6a62);B.beam([sx*34,38,z],[sx*22,20,z],.3,'dark',0x6e6a62);}
  if(z<80)for(const x of[-12,12]){B.box([x,37.6,z+6],[3,.25,6],'emit',0xfff1d8,{k:3.2});G.add([x,37,z+6],0xffe2b0,16);}
 }
 for(const sx of[-1,1]){B.box([sx*35.3,20,0],[1,40,176],'dark',0x5b5851,{uv:30});
  for(const y of[4,7.5,31])B.beam([sx*32,y,-86],[sx*32,y,86],.6,'dark',0x77736a);
  B.box([sx*31,16,0],[4,.4,176],'grate',0x777a80,{uv:40});B.beam([sx*29.2,17.2,-86],[sx*29.2,17.2,86],.07,'gold',0xb89448);
  for(let z=-86;z<=86;z+=4)B.box([sx*29.2,16.7,z],[.1,1,.1],'dark',0x888888);
  for(let z=-80;z<=80;z+=12)B.box([sx*34.7,22,z+6],[.3,26,.3],'emit',0xffd9a0,{k:1.6});}
 B.box([0,40.8,0],[72,1,176],'dark',0x4a4741,{uv:30});
 B.box([0,20,-88],[72,40,1.5],'dark',0x5b5851,{uv:20});
 B.add(new THREE.TorusGeometry(13,.8,8,40),'emit',{p:[0,18,-87],c:0xffb45a,k:1.6});
 B.box([0,18,-87.2],[22,22,.3],'dark',0x2b2925);
 for(const x of[-22,0,22])B.box([x,38.2,0],[1.2,1.2,176],'hull',0x77736a);
 for(const x of[-9,9]){B.beam([x,38,-60],[x,30,-60],.1,'dark',0x333333);B.box([x,29.5,-60],[1.2,1.6,1.2],'dark',0x55524c);}
 const cols=[0x7a3b28,0x3b4a5a,0x8a6d2a,0x4a5a3a,0x5a4a5a];
 for(const x of[-27,-23.5,24,27.5])for(let z=-72;z<=64;z+=13.5){if(R()<.18)continue;const h=1+(R()*3|0);for(let k=0;k<h;k++)container(B,[x,1.3+k*2.65,z],[2.7,2.6,12],cols[(R()*5)|0]);}
 container(B,[-16,1.3,-4],[2.7,2.6,12],0x4a5a3a);
 g.add(B.build(M),G.build());
 const ff=new THREE.Mesh(new THREE.PlaneGeometry(70,40),new THREE.MeshBasicMaterial({color:0x3377ff,transparent:true,opacity:.07,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));ff.position.set(0,20,86);g.add(ff);
 const tr=transport(M,{gs:1.4});tr.scale.setScalar(1.4);g.add(tr);
 [[-22,2.2,-50,.3],[18,2.2,-30,-.4],[26,2.2,40,.2]].forEach(([x,y,z,r])=>{const p=transport(M,{gs:1.4,seed:Math.abs(x)});p.scale.setScalar(1.4);p.position.set(x,y,z);p.rotation.y=r;g.add(p);});
 const arms=[];const armM=M.solid(0x6a6e74,.7,.5);
 for(const s of[-1,1]){const a=new THREE.Group();a.position.set(s*9.5,0,14);a.userData.s=s;mesh(new THREE.BoxGeometry(1.2,6,2.4),armM,[0,3,0],a);mesh(new THREE.BoxGeometry(3,1,2.4),armM,[-s*1.5,6,0],a);mesh(new THREE.BoxGeometry(.5,.5,2.6),new THREE.MeshBasicMaterial({color:0xffb040}),[-s*2.8,6,0],a);g.add(a);arms.push(a);}
 const door=new THREE.Group();door.position.set(-14.7,1.4,2.05);mesh(new THREE.BoxGeometry(2.5,2.4,.12),M.solid(0x3c4a30,.5,.6),[-1.25,0,0],door);g.add(door);
 const sold=[0,1,2].map(k=>{const h=human(M,{kind:'soldier',seed:k+3,low:true});g.add(h.g);return h;});
 return{g,update(c){
  tr.position.set(0,3.4,lerp(84,14,E.smooth(clamp(c.sp/.55))));
  const eng=sstep(.4,.6,c.sp);arms.forEach(a=>{a.rotation.z=-a.userData.s*1.1*(1-eng);});
  door.rotation.y=sstep(.5,.65,c.sp)*1.6;
  const m=E.smooth(sstep(.58,1,c.sp));
  sold.forEach((h,k)=>{h.g.position.set(-16+k*1.3-m*(k-1)*.6,0,lerp(-7-k*1.3,13-k*1.6,m));h.pose('walkRifle',c.t,{speed:.85});});
 }};
}

// ===== ENV: concealed cargo hold of the House transport =====
export function hold(M){
 const g=new THREE.Group(),B=new Builder(),G=new Glow(),R=rng(31);
 B.box([0,-.15,0],[6.4,.3,15],'grate',0x8a8f96,{uv:6});
 for(const sx of[-1,1])B.box([sx*3.2,1.75,0],[.3,3.5,15],'dark',0x4c4a46,{uv:4});
 B.box([0,3.65,0],[6.4,.3,15],'dark',0x45433f,{uv:4});B.box([0,1.75,-7.6],[6.4,3.5,.3],'dark',0x45433f,{uv:3});B.box([0,1.75,7.6],[6.4,3.5,.3],'hull',0x6a6862,{uv:3});
 for(let z=-7;z<=7;z+=1.2){B.box([0,3.4,z],[6.4,.18,.14],'hull',0x7a766e);for(const sx of[-1,1]){B.box([sx*3.05,1.7,z],[.16,3.4,.14],'hull',0x7a766e);B.beam([sx*3.05,.2,z],[sx*2.5,.9,z],.04,'dark',0x555555);}}
 for(const [x,y] of[[-2.6,3.0],[2.6,3.0],[0,3.25]])B.beam([x,y,-7.4],[x,y,7.4],.08,'dark',0x6a6862);
 for(let z=-6;z<=6;z+=2.4){B.box([0,3.48,z],[.2,.06,.7],'emit',0xff4a28,{k:2.2});G.add([0,3.3,z],0xff4a28,1.6);}
 G.add([0,2.6,0],0xffb060,2.4);
 const cols=[0x7a3b28,0x3b4a5a,0x8a6d2a,0x4a5a3a];
 for(const sx of[-1,1])for(let z=-6;z<=6;z+=2.3){if(R()<.15)continue;const h=1+(R()*2|0);for(let k=0;k<h;k++)container(B,[sx*2.4,.65+k*1.32,z],[1.5,1.3,2.0],cols[(R()*4)|0]);}
 g.add(B.build(M),G.build());
 const spots=[[-1.55,-3,0],[1.4,-1.2,0],[-1.45,1.2,0],[1.5,2.8,0]],sold=[];
 spots.forEach((p,k)=>{const h=human(M,{kind:'soldier',seed:k+9});h.g.position.set(p[0],0,p[1]);h.g.rotation.y=p[0]<0?.4:-.4;g.add(h.g);sold.push(h);});
 const chk=human(M,{kind:'soldier',seed:21});chk.g.position.set(.8,0,-2.4);g.add(chk.g);
 return{g,update(c){
  sold.forEach((h,k)=>h.pose('crouch',c.t+k,{}));chk.pose('crouch',c.t,{check:1});
  const f=.75+.25*Math.sin(c.t*23)*Math.sin(c.t*7);c.L.p1.intensity*=f;
 }};
}

// ===== ENV: Heighliner industrial corridor =====
export function corridor(M){
 const g=new THREE.Group(),B=new Builder(),G=new Glow(),R=rng(17);
 B.box([0,-.15,62],[6,.3,140],'grate',0x8a8f96,{uv:40});
 B.box([0,.02,62],[.3,.03,140],'emit',0xd9a21a,{k:.6});
 for(const sx of[-1,1]){B.box([sx*3.1,2.8,62],[.2,5.6,140],'dark',0x57534c,{uv:30});
  for(let z=0;z<=130;z+=3){B.box([sx*3.05,2.8,z+1.5],[.12,4.6,2.6],'hull',R()<.5?0x7a766c:0x6a665e,{uv:2});B.box([sx*2.92,1.6,z+1.5],[.06,.8,2.2],'dark',0x2b2925);}
  for(const z of[20,41,62,83,104])if(sx<0){B.box([-2.95,1.7,z],[.3,3.4,2.2],'dark',0x2a2724);B.box([-2.78,1.7,z-1.15],[.1,3.4,.1],'emit',0xcfe8ff,{k:2});B.box([-2.78,1.7,z+1.15],[.1,3.4,.1],'emit',0xcfe8ff,{k:2});}}
 for(let z=0;z<=130;z+=3){B.box([0,5.6,z],[6.4,.25,.35],'hull',0x8e8a80);for(const sx of[-1,1]){B.box([sx*3,2.8,z],[.3,5.6,.35],'hull',0x8e8a80);B.beam([sx*3,.4,z],[sx*2.2,.4,z],.05,'dark',0x555555);B.beam([sx*3,4.2,z],[sx*2.2,5.5,z],.08,'dark',0x6a665e);}}
 for(const [x,y,r] of[[-2.2,5.0,.18],[-1.2,5.1,.12],[1.8,5.0,.25],[2.4,4.3,.1]])B.beam([x,y,0],[x,y,132],r,'dark',0x6a665e,{seg:8});
 for(let z=0;z<=130;z+=6){B.box([0,5.35,z+1.5],[1.2,.1,.5],'emit',0xfff1d8,{k:3});G.add([0,5.1,z+1.5],0xffe2b0,3.2);}
 for(let i=0;i<14;i++){const z=6+i*9;B.beam([-1.5+R()*3,5.4,z],[-1.5+R()*3,3.6+R(),z+1.5],.03,'dark',0x333333);}
 B.box([0,2.6,131],[6,5.4,.5],'dark',0x5a564e);B.box([0,2.6,130.7],[4,4.6,.3],'emit',0xffffff,{k:2.4});G.add([0,2.8,130],0xdfeaff,34);
 g.add(B.build(M),G.build());
 const steam=new Glow();for(let i=0;i<80;i++)steam.add([0,0,0],0x8a8a8a,.5);const sp=steam.build();g.add(sp);
 const offs=[[-.8,0],[.9,-1.3],[-.6,-2.7],[.8,-4],[-.9,-5.2],[.3,-6.4]];
 const sol=offs.map((o,i)=>{const h=human(M,{kind:'soldier',seed:i+1,low:i>2});g.add(h.g);return h;});
 const vents=[[-2.8,.2,18],[2.8,.2,34],[-2.8,.2,55],[2.8,.2,70]];
 return{g,update(c){
  const z0=6+1.8*c.dt;
  sol.forEach((h,i)=>{h.g.position.set(offs[i][0],0,z0+offs[i][1]);h.pose('walkRifle',c.t+i*.37,{speed:.9});});
  c.L.p1.position.set(0,3.6,z0+4);c.L.p2.position.set(0,3.2,z0+22);
  setPos(sp,i=>{const v=vents[i%4],f=((c.t*.35+i/80*3.7)%1);return[v[0]*(1-f*.3)+Math.sin(i*7)*.2,v[1]+f*3,v[2]+Math.cos(i*3)*.3+f*(i%3-1)];});
 }};
}

// ===== ENV: Heighliner bridge / control room =====
export function control(M){
 const g=new THREE.Group(),B=new Builder(),G=new Glow(),R=rng(27);
 g.add(starDome(7));
 const pl=planet(110,{seed:9,c:[0x40526a,0x7f9bb8,0x2a3a4c],atm:0x88bbff});pl.position.set(-55,14,-150);g.add(pl);
 G.add([48,26,-170],0xffe0b0,150);
 B.add(new THREE.CylinderGeometry(13,13,.5,48),'floor',{p:[0,-.25,0],uv:8});
 B.add(new THREE.CylinderGeometry(13,13,9,48,1,true,PI+.8,2*PI-1.6),'inner',{p:[0,4.5,0],c:0x4a4742,uv:8});
 B.add(new THREE.CylinderGeometry(4,4.4,.4,32),'floor',{p:[0,.2,0],uv:4});
 const mx=[-9,-6,-3,0,3,6,9],zz=x=>-Math.sqrt(169-x*x);
 mx.forEach((x,i)=>{B.box([x,4.5,zz(x)],[.5,9,.5],'hull',0x9a968c);if(i<6){const x2=mx[i+1];B.beam([x,9,zz(x)],[x2,9,zz(x2)],.3,'hull',0x9a968c);B.beam([x,.3,zz(x)],[x2,.3,zz(x2)],.3,'hull',0x9a968c);B.beam([x,5,zz(x)],[x2,5,zz(x2)],.1,'dark',0x77736a);}});
 B.add(new THREE.RingGeometry(8,9.4,48,1,PI/2-1.05,2.1),'dark',{r:[-PI/2,0,0],p:[0,1.12,0],c:0x3a3834});
 B.add(new THREE.CylinderGeometry(8,8,1.1,48,1,true,PI-1.05,2.1),'inner',{p:[0,.55,0],c:0x2e2c29});
 B.add(new THREE.CylinderGeometry(9.4,9.4,1.1,48,1,true,PI-1.05,2.1),'inner',{p:[0,.55,0],c:0x2e2c29});
 for(let i=0;i<14;i++){const a=PI-.95+i*.14;B.box([Math.sin(a)*8.7,1.15,Math.cos(a)*8.7],[.5,.05,.3],'emit',i%2?0xffa040:0x80c0ff,{k:2,r:[0,a,0]});}
 for(let i=0;i<5;i++){const a=-.9+i*.45,x=Math.sin(a)*5,z=Math.cos(a)*5+2;B.add(new THREE.CylinderGeometry(.3,.4,.5,10),'dark',{p:[x,.25,z],c:0x2a2a2a});B.box([x,.9,z],[.9,.18,.9],'dark',0x3a3a40,{r:[0,a,0]});B.box([x,1.5,z-.4],[.9,1.2,.14],'dark',0x3a3a40,{r:[0,a,0]});}
 B.add(new THREE.TorusGeometry(7,.3,8,40),'hull',{p:[0,8,0],r:[PI/2,0,0],c:0x8e8a80});
 for(let a=0;a<8;a++){const an=a*PI/4;B.beam([Math.cos(an)*7,8,Math.sin(an)*7],[Math.cos(an)*12,9,Math.sin(an)*12],.12,'dark',0x6a665e);B.box([Math.cos(an)*7,7.8,Math.sin(an)*7],[.8,.1,.8],'emit',0xfff1d8,{k:3});G.add([Math.cos(an)*7,7.6,Math.sin(an)*7],0xffe2b0,5);}
 g.add(B.build(M),G.build());
 const scrT=tex(512,256,(c2,w,h)=>{c2.fillStyle='#000';c2.fillRect(0,0,w,h);c2.strokeStyle='#fff';c2.lineWidth=1.5;const r=rng(4),pts=[];for(let i=0;i<14;i++)pts.push([r()*w,r()*h]);
  pts.forEach((a,i)=>{pts.forEach((b,j)=>{if(j>i&&r()<.24){c2.beginPath();c2.moveTo(a[0],a[1]);c2.lineTo(b[0],b[1]);c2.stroke();}});c2.fillStyle='#fff';c2.beginPath();c2.arc(a[0],a[1],4,0,7);c2.fill();});
  for(let i=0;i<40;i++)c2.fillRect(r()*w,r()*h,30+r()*50,3);},[3,1]);
 const scr=[];
 [[9.4,1.4,2,1.8],[10.2,2.6,4.6,2.6]].forEach(([rad,h,y,arc])=>{const m=new THREE.MeshBasicMaterial({map:scrT,side:THREE.DoubleSide,toneMapped:false});scr.push(m);const s=new THREE.Mesh(new THREE.CylinderGeometry(rad,rad,h,40,1,true,PI-arc/2,arc),m);s.position.y=y;g.add(s);});
 const amber=new THREE.Color(1,.55,.15),green=new THREE.Color(.25,1,.4);
 const s1=human(M,{kind:'soldier',seed:2});s1.g.position.set(0,0,-7.1);s1.g.rotation.y=PI;g.add(s1.g);
 const s2=human(M,{kind:'soldier',seed:4});s2.g.position.set(-3.4,0,-6);s2.g.rotation.y=PI+.25;g.add(s2.g);
 const s3=human(M,{kind:'soldier',seed:6});s3.g.position.set(3.2,0,-5.2);s3.g.rotation.y=PI-.3;g.add(s3.g);
 const s4=human(M,{kind:'soldier',seed:8,low:true});s4.g.position.set(-1.2,0,-1.6);s4.g.rotation.y=PI+.1;g.add(s4.g);
 return{g,update(c){
  const k=c.scene===3&&c.shot===0?sstep(.35,.5,c.sp):(c.scene===3?1:0);
  scr.forEach(m=>m.color.copy(amber).lerp(green,k).multiplyScalar(.85+.3*Math.sin(c.t*3)));
  s1.pose('press',c.t,{});s2.pose('idle',c.t,{});s3.pose('idle',c.t+1,{});s4.pose('idle',c.t+2,{});
  c.L.p1.color.copy(amber).lerp(green,k);
 }};
}
