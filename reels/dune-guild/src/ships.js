import {THREE,Builder,Glow,rng,P} from './lib.js';
const PI=Math.PI,V2=(a,b)=>new THREE.Vector2(a,b);
const Q=(ax,a)=>new THREE.Quaternion().setFromAxisAngle(ax,a);

export function container(B,p,s,c,rot=0){
 const q=Q(new THREE.Vector3(0,1,0),rot);
 const T=(dx,dy,dz)=>{const v=new THREE.Vector3(dx,dy,dz).applyQuaternion(q);return[p[0]+v.x,p[1]+v.y,p[2]+v.z];};
 B.add(new THREE.BoxGeometry(s[0],s[1],s[2]),'hull',{p,q,c,uv:s[2]/3});
 const d=new THREE.Color(c).multiplyScalar(.75).getHex(),n=Math.floor(s[2]/.5);
 for(let i=0;i<n;i++){const z=-s[2]/2+.25+i*.5;for(const sx of[-1,1])B.add(new THREE.BoxGeometry(.07,s[1]*.92,.16),'dark',{p:T(sx*(s[0]/2+.02),0,z),q,c:d,uv:.3});}
 for(const sx of[-1,1])for(const sy of[-1,1])B.add(new THREE.BoxGeometry(.18,.18,s[2]+.1),'dark',{p:T(sx*s[0]/2,sy*s[1]/2,0),q,c:0x25221f,uv:.3});
}

export function heighliner(M){
 const B=new Builder(),G=new Glow(),R=rng(5);
 const prof=[[0,-450],[24,-447],[48,-432],[60,-405],[56,-370],[64,-340],[64,-120],[70,-95],[70,180],[78,215],[78,300],[66,330],[68,395],[48,432],[22,447],[0,450]];
 const rAt=z=>{for(let i=1;i<prof.length;i++){if(z<=prof[i][1]){const a=prof[i-1],b=prof[i];return a[0]+(b[0]-a[0])*(z-a[1])/(b[1]-a[1]||1);}}return 0;};
 B.add(new THREE.LatheGeometry(prof.map(p=>V2(p[0],p[1])),64),'hull',{r:[PI/2,0,0],c:0xb5aa98,uv:10});
 for(let z=-330;z<=330;z+=22)B.add(new THREE.TorusGeometry(rAt(z)+4,2.2,6,32),'dark',{p:[0,0,z],c:0x8d8577,uv:8});
 for(let a=0;a<8;a++){const an=a*PI/4+PI/8;for(let z=-330;z<330;z+=55){const zc=z+27.5,rr=rAt(zc)+6;B.box([Math.cos(an)*rr,Math.sin(an)*rr,zc],[5,3,55],'dark',0x9a917f,{r:[0,0,an]});}}
 // cargo bays with glowing frames
 for(let a=0;a<4;a++){const an=a*PI/2;for(const zc of[-260,-130,10,150,270]){const rr=rAt(zc)+1.5;
  B.box(P(an,rr,0,zc),[4,30,22],'dark',0x2a2723,{r:[0,0,an]});
  for(const t of[-15,15])B.box(P(an,rr+2.2,t,zc),[1,1,22],'emit',0xffa03a,{k:2.4,r:[0,0,an]});
  for(const z of[-11,11])B.box(P(an,rr+2.2,0,zc+z),[1,30,1],'emit',0xffa03a,{k:2.4,r:[0,0,an]});
  G.add(P(an,rr+6,0,zc),0xff9a40,16);}}
 for(let i=0;i<520;i++){const z=-380+R()*760,an=R()*PI*2,rr=rAt(z)+.8;B.box(P(an,rr,0,z),[.7,1.3,2.6],'emit',R()<.2?0xffffff:0xffd29a,{k:R()<.3?2.2:1,r:[0,0,an]});}
 // fins
 const fin=(zc,len,h,k,th)=>{const s=new THREE.Shape();s.moveTo(zc-len/2,0);s.lineTo(zc-len*.25,h);s.lineTo(zc+len*.3,h*.82);s.lineTo(zc+len/2,0);s.lineTo(zc-len/2,0);
  const g=new THREE.ExtrudeGeometry(s,{depth:th,bevelEnabled:true,bevelSize:.6,bevelThickness:.6,bevelSegments:1});g.translate(0,0,-th/2);
  const q=Q(new THREE.Vector3(0,0,1),k*PI/2).multiply(Q(new THREE.Vector3(0,1,0),-PI/2));B.add(g,'hull',{q,c:0xa69b88,uv:.12});};
 fin(-60,260,170,0,5);fin(-60,260,170,2,5);fin(120,180,130,1,4);fin(120,180,130,3,4);
 for(let i=0;i<6;i++){const z=-150+i*50;B.beam([0,rAt(z),z],[0,150-i*8,z],.8,'dark',0x8d8577);B.beam([0,-rAt(z),z],[0,-(150-i*8),z],.8,'dark',0x8d8577);}
 // stern fold ring
 B.add(new THREE.TorusGeometry(112,7,10,64),'hull',{p:[0,0,440],c:0xb8ac98,uv:8});
 B.add(new THREE.TorusGeometry(104,1.6,6,64),'emit',{p:[0,0,440],c:0x66ccff,k:2.5});
 for(let a=0;a<12;a++){const an=a*PI/6;B.beam([Math.cos(an)*104,Math.sin(an)*104,440],[Math.cos(an)*62,Math.sin(an)*62,418],2,'dark',0x8d8577);G.add([Math.cos(an)*104,Math.sin(an)*104,440],0x66ccff,26);}
 // bow docking collar
 B.add(new THREE.TorusGeometry(52,4,8,48),'hull',{p:[0,0,-436],c:0xb8ac98,uv:6});
 for(let a=0;a<6;a++){const an=a*PI/3;B.beam([Math.cos(an)*50,Math.sin(an)*50,-436],[Math.cos(an)*34,Math.sin(an)*34,-480],1.6,'dark',0x8d8577);B.box([Math.cos(an)*34,Math.sin(an)*34,-481],[2,2,2],'emit',0xff5a3a,{k:2});}
 // dorsal spires
 for(let i=0;i<9;i++){const z=-300+i*70,r0=rAt(z)+4;B.beam([0,r0,z],[0,r0+40+R()*30,z],1.2,'dark',0x8d8577);B.box([0,r0+60,z],[1.4,1.4,1.4],'emit',0xff4a30,{k:2});}
 // big docking bay on +X flank
 const dz=-100,dr=rAt(dz)+2;
 B.box([dr,0,dz],[6,60,70],'dark',0x1f1d1a);
 for(const t of[-30,30])B.box([dr+3.5,t,dz],[1.4,1.6,70],'emit',0xffb45a,{k:2.6});
 for(const z of[-35,35])B.box([dr+3.5,0,dz+z],[1.4,60,1.6],'emit',0xffb45a,{k:2.6});
 for(let i=0;i<8;i++){G.add([dr+10+i*26,0,dz],0xffb060,10);B.box([dr+10+i*26,0,dz],[1.2,1.2,1.2],'emit',0xffd090,{k:2.5});}
 for(const s of[-1,1])B.beam([dr,s*36,dz+s*30],[dr+44,s*36,dz+s*30],1.4,'hull',0xa69b88);
 const g=new THREE.Group();g.add(B.build(M),G.build());g.userData.dock=[dr,0,dz];return g;
}

export function foldFx(){
 const g=new THREE.Group(),mats=[];
 for(let i=0;i<6;i++){const m=new THREE.MeshBasicMaterial({color:i%2?0x88ddff:0xffb060,transparent:true,opacity:.4,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});mats.push(m);g.add(new THREE.Mesh(new THREE.TorusGeometry(100,2.5,8,64),m));}
 g.userData.update=(t,a=1)=>{g.children.forEach((c,i)=>{const s=(t*.25+i/6)%1;c.scale.setScalar(.2+s*2.4);c.position.z=s*260;mats[i].opacity=(1-s)*(s<.1?s*10:1)*.55*a;});};
 return g;
}

export function station(M){
 const B=new Builder(),G=new Glow(),R=rng(9);
 B.add(new THREE.TorusGeometry(90,5,8,56),'hull',{c:0xaaa090,uv:6});
 B.add(new THREE.TorusGeometry(70,2.5,6,48),'dark',{c:0x8d8577,uv:4});
 B.add(new THREE.SphereGeometry(16,20,14),'hull',{c:0xb0a592,uv:3});
 for(let a=0;a<8;a++){const an=a*PI/4;B.beam([Math.cos(an)*14,Math.sin(an)*14,0],[Math.cos(an)*88,Math.sin(an)*88,0],1.6,'dark',0x8d8577);}
 B.beam([0,0,-70],[0,0,70],3,'hull',0xa69b88);
 for(let i=0;i<80;i++){const an=R()*PI*2;B.box([Math.cos(an)*90,Math.sin(an)*90,(R()-.5)*8],[1.6,1.6,2],'emit',0xffc880,{k:2});}
 for(let a=0;a<4;a++){const an=a*PI/2+.4;G.add([Math.cos(an)*90,Math.sin(an)*90,0],0xffb060,22);}
 const g=new THREE.Group();g.add(B.build(M),G.build());g.rotation.x=1.2;return g;
}

const slab=(pts,depth,sc=1)=>{const s=new THREE.Shape(pts.map(p=>V2(p[0]*sc,p[1]*sc)));const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSize:.4,bevelThickness:.4,bevelSegments:1});g.rotateX(PI/2);return g;};

export function transport(M,o={}){
 const B=new Builder(),G=new Glow(),R=rng(o.seed||3),c=o.c||0x6b717a,gs=o.gs||1;
 const prof=[[0,-9],[2,-9],[2.6,-7],[2.9,-2],[2.7,3],[2.1,7],[1.2,9.5],[0,10.4]];
 B.add(new THREE.LatheGeometry(prof.map(p=>V2(p[0],p[1])),20),'hull',{r:[PI/2,0,0],s:[1,1,.72],c,uv:.35});
 const wing=sg=>{const pts=[[0,3],[8,-3],[8,-6],[0,-5.5]].map(p=>V2(p[0]*sg,p[1]));const g=new THREE.ExtrudeGeometry(new THREE.Shape(pts),{depth:.4,bevelEnabled:true,bevelSize:.12,bevelThickness:.1,bevelSegments:1});g.rotateX(PI/2);return g;};
 B.add(wing(1),'hull',{p:[2,-.4,0],c,uv:.3});B.add(wing(-1),'hull',{p:[-2,-.4,0],c,uv:.3});
 for(const sx of[-1,1]){B.add(new THREE.CylinderGeometry(.85,1,5.5,10),'dark',{p:[sx*4.6,-.3,-5.2],r:[PI/2,0,0],c:0x3c4048,uv:.3});
  B.add(new THREE.ConeGeometry(.85,1.6,10),'hull',{p:[sx*4.6,-.3,-1.6],r:[PI/2,0,0],c,uv:.3});
  B.add(new THREE.CircleGeometry(.8,12),'emit',{p:[sx*4.6,-.3,-8.02],r:[0,PI,0],c:0x9fd8ff,k:2.4});G.add([sx*4.6,-.3,-8.6],0x7fc8ff,6*gs);
  B.box([sx*1.9,-1.9,0],[2.2,1.3,6],'dark',0x4a4f57,{uv:.4});B.box([sx*8,-.5,-4.5],[.4,.4,.4],'emit',sx>0?0x30ff60:0xff3030,{k:3});G.add([sx*8,-.5,-4.5],sx>0?0x30ff60:0xff3030,2*gs);}
 B.box([0,2.4,-7],[.25,2.8,2.4],'hull',c,{uv:.4});
 B.add(new THREE.SphereGeometry(1.1,12,8),'emit',{p:[0,.9,6.6],s:[1,.7,1.5],c:0x9fd4ff,k:.8});
 B.box([0,1.95,1],[.5,.08,10],'gold',o.stripe||0xc8a24a);
 for(let i=0;i<16;i++){const top=R()<.6;B.box([(R()-.5)*3,top?1.9:-1.5,(R()-.5)*14],[.4+R()*.6,.2,.4+R()*.8],'dark',0x5b6068,{uv:.3});}
 const g=new THREE.Group();g.add(B.build(M),G.build());return g;
}

export function warship(M,o={}){
 const B=new Builder(),G=new Glow(),R=rng(o.seed||4),c=o.c||0x444a53,gs=o.gs||1;
 const out=[[0,40],[5,32],[9,14],[14,-10],[13,-30],[8,-36],[-8,-36],[-13,-30],[-14,-10],[-9,14],[-5,32]];
 B.add(slab(out,6),'hull',{p:[0,3,0],c,uv:.12});
 B.add(slab(out,4,.62),'dark',{p:[0,7,-2],c:0x383d45,uv:.12});
 B.box([0,9.5,-14],[10,4,12],'hull',c);B.box([0,13.5,-14],[6,4,8],'hull',c);B.box([0,17.5,-14],[3,4,4],'hull',c);
 B.beam([0,19,-14],[0,30,-14],.25,'dark',0x888888);B.box([0,30.5,-14],[.8,.8,.8],'emit',0xff3030,{k:3});
 for(const sx of[-1,1]){B.box([sx*8,7,8],[3,5,10],'hull',c);B.box([sx*10.5,4,0],[2,3,30],'dark',0x30343a);
  B.add(new THREE.CylinderGeometry(1.8,2,2,10),'dark',{p:[sx*5,9.5,16],c:0x30343a});B.beam([sx*5,10.5,16],[sx*5,10.5,25],.35,'dark',0x30343a);
  for(const z of[-6,8,20])B.box([sx*12.6,3,z],[.4,3,6],'dark',0x15161a);
  for(const z of[-6,8,20]){B.box([sx*12.9,1.2,z],[.3,.3,6.4],'emit',0xffb45a,{k:2});B.box([sx*12.9,4.8,z],[.3,.3,6.4],'emit',0xffb45a,{k:2});}
  B.box([sx*13,5.2,-20],[.3,.4,26],'gold',0xc8a24a);}
 for(let i=0;i<5;i++){const x=-8+i*4;B.add(new THREE.CylinderGeometry(1.4,1.7,3,10),'dark',{p:[x,3,-37.5],r:[PI/2,0,0],c:0x2c2f35});B.add(new THREE.CircleGeometry(1.3,12),'emit',{p:[x,3,-39.05],r:[0,PI,0],c:0x9fd8ff,k:2.6});G.add([x,3,-41],0x7fc8ff,14*gs);}
 for(let i=0;i<220;i++){const z=-34+R()*60,x=(R()<.5?-1:1)*(4+R()*5);B.box([x,7.3,z],[.5,.15,.9],'emit',0xffd8a0,{k:R()<.3?2.5:1});}
 for(let i=0;i<10;i++)B.box([(R()-.5)*18,9.1,-26+R()*50],[1+R()*2,.8,1+R()*2],'dark',0x2e3238,{uv:.3});
 const g=new THREE.Group();g.add(B.build(M),G.build());return g;
}

export function barge(M,o={}){
 const B=new Builder(),G=new Glow(),R=rng(o.seed||6),gs=o.gs||1;
 B.box([0,0,0],[3,3,50],'hull',0x6f7480);B.add(new THREE.CylinderGeometry(4,5,10,12),'dark',{p:[0,0,-28],r:[PI/2,0,0],c:0x3a3e45});
 B.add(new THREE.CircleGeometry(3.6,12),'emit',{p:[0,0,-33.05],r:[0,PI,0],c:0x9fd8ff,k:2.6});G.add([0,0,-35],0x7fc8ff,16*gs);
 const cols=[0x7a3b28,0x3b4a5a,0x8a6d2a,0x4a5a3a];
 for(let i=0;i<5;i++){const z=-16+i*9;for(const a of[0,PI/2,PI,PI*1.5]){const x=Math.cos(a)*5.5,y=Math.sin(a)*5.5;container(B,[x,y,z],[3.6,3.2,8],cols[(R()*4)|0]);}}
 B.box([0,0,27],[5,5,6],'hull',0x7f8490);B.box([0,2.8,27],[1.4,.7,3],'emit',0xff3a30,{k:2});
 const g=new THREE.Group();g.add(B.build(M),G.build());return g;
}
