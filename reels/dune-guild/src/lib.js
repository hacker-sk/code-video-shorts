import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
export {THREE};
const PI=Math.PI;
export const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
export const lerp=(a,b,t)=>a+(b-a)*t;
export const sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
export const E={lin:t=>t,in:t=>t*t,out:t=>1-(1-t)*(1-t),smooth:t=>t*t*(3-2*t),inOut:t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2};
export function rng(seed){let s=seed>>>0;return()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
export const P=(an,rad,tan,z)=>[Math.cos(an)*rad-Math.sin(an)*tan,Math.sin(an)*rad+Math.cos(an)*tan,z];
export const hex=v=>'#'+new THREE.Color(v).getHexString();
export function tex(w,h,draw,rep=[1,1],srgb=true){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rep[0],rep[1]);if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;}

// ---------- merged-geometry builder: many parts -> few draw calls ----------
export class Builder{
 constructor(){this.b={};}
 add(g,key,o={}){
  g=g.index?g.toNonIndexed():g.clone();
  for(const k of Object.keys(g.attributes))if(k!=='position'&&k!=='normal'&&k!=='uv')g.deleteAttribute(k);
  if(o.uv){const a=g.attributes.uv.array;for(let i=0;i<a.length;i++)a[i]*=o.uv;}
  const q=o.q||new THREE.Quaternion().setFromEuler(new THREE.Euler(...(o.r||[0,0,0])));
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...(o.p||[0,0,0])),q,new THREE.Vector3(...(o.s||[1,1,1]))));
  const c=new THREE.Color(o.c===undefined?0xffffff:o.c),k=o.k||1,n=g.attributes.position.count,arr=new Float32Array(n*3);
  for(let i=0;i<n;i++){arr[i*3]=c.r*k;arr[i*3+1]=c.g*k;arr[i*3+2]=c.b*k;}
  g.setAttribute('color',new THREE.BufferAttribute(arr,3));
  (this.b[key]=this.b[key]||[]).push(g);return this;}
 box(p,s,key,c,o={}){return this.add(new THREE.BoxGeometry(s[0],s[1],s[2]),key,{p,c,uv:o.uv===undefined?Math.max(s[0],s[1],s[2])/4:o.uv,r:o.r,q:o.q,k:o.k});}
 beam(a,b,r,key,c,o={}){const A=new THREE.Vector3(...a),Bv=new THREE.Vector3(...b),d=Bv.clone().sub(A),len=d.length()||.001;
  const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
  return this.add(new THREE.CylinderGeometry(r,r,len,o.seg||6,1),key,{p:A.clone().add(Bv).multiplyScalar(.5).toArray(),q,c,uv:o.uv===undefined?Math.max(len,1)/5:o.uv,k:o.k});}
 geometry(key){return this.b[key]?mergeGeometries(this.b[key]):null;}
 build(M){const grp=new THREE.Group();for(const k in this.b){const geo=mergeGeometries(this.b[k]);if(geo)grp.add(new THREE.Mesh(geo,M[k]));}return grp;}
}

// ---------- soft additive glow points (fake bloom) ----------
export const glowMat=new THREE.ShaderMaterial({uniforms:{uScale:{value:1000}},
 vertexShader:'attribute float aSize;attribute vec3 aCol;varying vec3 vC;uniform float uScale;void main(){vC=aCol;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(aSize*uScale/max(-mv.z,.01),0.,700.);gl_Position=projectionMatrix*mv;}',
 fragmentShader:'varying vec3 vC;void main(){vec2 p=gl_PointCoord-.5;float r=length(p)*2.;if(r>1.)discard;float a=pow(1.-r,2.4);gl_FragColor=vec4(vC*a,a);}',
 transparent:true,blending:THREE.AdditiveBlending,depthWrite:false});
export const smokeMat=new THREE.ShaderMaterial({uniforms:{uScale:{value:1000}},
 vertexShader:'attribute float aSize;attribute vec3 aCol;attribute float aA;varying vec3 vC;varying float vA;uniform float uScale;void main(){vC=aCol;vA=aA;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(aSize*uScale/max(-mv.z,.01),0.,900.);gl_Position=projectionMatrix*mv;}',
 fragmentShader:'varying vec3 vC;varying float vA;void main(){vec2 p=gl_PointCoord-.5;float r=length(p)*2.;if(r>1.)discard;float a=smoothstep(1.,.0,r)*vA;gl_FragColor=vec4(vC,a);}',
 transparent:true,depthWrite:false});
export class Glow{
 constructor(){this.p=[];this.c=[];this.s=[];}
 add(p,c,s){const k=new THREE.Color(c);this.p.push(p[0],p[1],p[2]);this.c.push(k.r,k.g,k.b);this.s.push(s);return this;}
 build(){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3));g.setAttribute('aCol',new THREE.Float32BufferAttribute(this.c,3));g.setAttribute('aSize',new THREE.Float32BufferAttribute(this.s,1));const m=new THREE.Points(g,glowMat);m.frustumCulled=false;return m;}
}
export function setSizes(pts,fn){const a=pts.geometry.attributes.aSize;for(let i=0;i<a.count;i++)a.array[i]=fn(i);a.needsUpdate=true;}
export function setPos(pts,fn){const a=pts.geometry.attributes.position;for(let i=0;i<a.count;i++){const v=fn(i);a.setXYZ(i,v[0],v[1],v[2]);}a.needsUpdate=true;}

export function starDome(seed,n=2600){const r=rng(seed),pos=[],col=[];for(let i=0;i<n;i++){const u=r()*2-1,a=r()*PI*2,s=Math.sqrt(1-u*u),R=6000;pos.push(Math.cos(a)*s*R,u*R,Math.sin(a)*s*R);const k=.35+r()*.65,w=r();col.push(k*(.8+.2*w),k*.9,k*(1-.2*w+.1));}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
 const p=new THREE.Points(g,new THREE.PointsMaterial({size:2.2,sizeAttenuation:false,vertexColors:true,fog:false,depthWrite:false}));p.frustumCulled=false;return p;}

export function planet(R,o){const r=rng(o.seed||1);
 const t=tex(1024,512,(g,w,h)=>{g.fillStyle=hex(o.c[0]);g.fillRect(0,0,w,h);for(let i=0;i<300;i++){g.fillStyle=hex(o.c[1+(r()*2|0)]);g.globalAlpha=.06+r()*.22;g.beginPath();g.ellipse(r()*w,r()*h,20+r()*130,5+r()*28,0,0,7);g.fill();}g.globalAlpha=1;});
 const grp=new THREE.Group();grp.add(new THREE.Mesh(new THREE.SphereGeometry(R,64,40),new THREE.MeshStandardMaterial({map:t,roughness:.9,metalness:0})));
 const am=new THREE.ShaderMaterial({uniforms:{uC:{value:new THREE.Color(o.atm||0x88aaff)}},vertexShader:'varying vec3 vN;void main(){vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'uniform vec3 uC;varying vec3 vN;void main(){float f=pow(clamp(.62-dot(vN,vec3(0.,0.,1.)),0.,1.),3.5)*1.5;gl_FragColor=vec4(uC*f,f);}',transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.BackSide});
 grp.add(new THREE.Mesh(new THREE.SphereGeometry(R*1.06,48,32),am));return grp;}

// translucent 'vision' material (fresnel, additive)
export function ghostMat(c){return new THREE.ShaderMaterial({uniforms:{uC:{value:new THREE.Color(c)},uA:{value:1}},
 vertexShader:'varying vec3 vN;varying vec3 vV;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=-mv.xyz;gl_Position=projectionMatrix*mv;}',
 fragmentShader:'uniform vec3 uC;uniform float uA;varying vec3 vN;varying vec3 vV;void main(){float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),2.);float a=(.08+f)*uA;gl_FragColor=vec4(uC*(.25+f*1.4)*uA,a);}',
 transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});}
export function ghostify(obj,mat){obj.traverse(o=>{if(o.isMesh)o.material=mat;});return obj;}

// ---------- materials & procedural textures ----------
export function makeMats(){
 const R=rng(11);
 const metal=tex(512,512,(g,w,h)=>{g.fillStyle='#9a9ca0';g.fillRect(0,0,w,h);
  for(let i=0;i<220;i++){const x=R()*w,y=R()*h,a=18+R()*80,b=10+R()*50,v=110+R()*90|0;g.fillStyle=`rgba(${v},${v},${v},.28)`;g.fillRect(x,y,a,b);g.strokeStyle='rgba(20,20,22,.6)';g.lineWidth=1.4;g.strokeRect(x,y,a,b);}
  for(let i=0;i<420;i++){g.fillStyle='rgba(30,30,30,.55)';g.fillRect(R()*w,R()*h,2,2);}
  for(let i=0;i<60;i++){g.strokeStyle='rgba(255,255,255,.1)';g.beginPath();const x=R()*w,y=R()*h;g.moveTo(x,y);g.lineTo(x+R()*60-30,y+R()*8-4);g.stroke();}});
 const stoneT=tex(512,512,(g,w,h)=>{g.fillStyle='#8c857a';g.fillRect(0,0,w,h);for(let y=0;y<8;y++)for(let x=0;x<5;x++){const v=95+R()*70|0;g.fillStyle=`rgb(${v},${v-6},${v-14})`;g.fillRect(x*128+(y%2)*64-64,y*64,126,62);}
  for(let i=0;i<700;i++){g.fillStyle=`rgba(0,0,0,${R()*.25})`;g.fillRect(R()*w,R()*h,1+R()*3,1+R()*3);}});
 const floorT=tex(512,512,(g,w,h)=>{g.fillStyle='#16141a';g.fillRect(0,0,w,h);for(let y=0;y<4;y++)for(let x=0;x<4;x++){const v=18+R()*16|0;g.fillStyle=`rgb(${v},${v-2},${v+4})`;g.fillRect(x*128+3,y*128+3,122,122);}
  g.strokeStyle='#b89448';g.lineWidth=3;for(let i=0;i<=4;i++){g.beginPath();g.moveTo(i*128,0);g.lineTo(i*128,h);g.moveTo(0,i*128);g.lineTo(w,i*128);g.stroke();}});
 const grateT=tex(512,512,(g,w,h)=>{g.fillStyle='#4a4d52';g.fillRect(0,0,w,h);for(let y=0;y<16;y++)for(let x=0;x<16;x++){g.fillStyle='#0b0c0e';g.fillRect(x*32+5,y*32+5,22,22);}
  for(let i=0;i<200;i++){g.fillStyle='rgba(255,255,255,.06)';g.fillRect(R()*w,R()*h,6,1);}});
 const weave=tex(128,128,(g,w,h)=>{g.fillStyle='#808080';g.fillRect(0,0,w,h);for(let i=0;i<w;i+=4){g.fillStyle=(i/4)%2?'#aaa':'#555';g.fillRect(i,0,2,h);g.fillStyle=(i/4)%2?'#555':'#aaa';g.fillRect(0,i,w,2);}},[6,6],false);
 const eye=tex(256,256,(g,w,h)=>{g.fillStyle='#061a5a';g.fillRect(0,0,w,h);const gr=g.createRadialGradient(128,128,0,128,128,128);gr.addColorStop(0,'#000');gr.addColorStop(.13,'#000');gr.addColorStop(.15,'#c8f0ff');gr.addColorStop(.32,'#3a9cff');gr.addColorStop(.7,'#0b3fb8');gr.addColorStop(1,'#041a60');g.fillStyle=gr;g.fillRect(0,0,w,h);
  g.strokeStyle='rgba(180,230,255,.35)';for(let i=0;i<60;i++){const a=i/60*PI*2;g.beginPath();g.moveTo(128+Math.cos(a)*40,128+Math.sin(a)*40);g.lineTo(128+Math.cos(a)*100,128+Math.sin(a)*100);g.stroke();}});
 const std=o=>new THREE.MeshStandardMaterial(o);
 const D=THREE.DoubleSide;
 const fabric=std({color:0x22252b,roughness:.9,metalness:0,bumpMap:weave,bumpScale:1.4});
 return{
  hull:std({map:metal,bumpMap:metal,bumpScale:2,roughness:.5,metalness:.75,vertexColors:true}),
  dark:std({map:metal,bumpMap:metal,bumpScale:2,roughness:.75,metalness:.5,vertexColors:true}),
  inner:std({map:metal,bumpMap:metal,bumpScale:2,roughness:.75,metalness:.5,vertexColors:true,side:D}),
  gold:std({roughness:.32,metalness:1,vertexColors:true}),
  stone:std({map:stoneT,bumpMap:stoneT,bumpScale:3,roughness:.88,metalness:.05,vertexColors:true}),
  innerS:std({map:stoneT,bumpMap:stoneT,bumpScale:3,roughness:.88,metalness:.05,vertexColors:true,side:D}),
  floor:std({map:floorT,bumpMap:floorT,bumpScale:1,roughness:.3,metalness:.35,vertexColors:true}),
  grate:std({map:grateT,bumpMap:grateT,bumpScale:3,roughness:.6,metalness:.7,vertexColors:true}),
  emit:new THREE.MeshBasicMaterial({vertexColors:true,toneMapped:false}),
  glass:std({roughness:.05,metalness:.1,transparent:true,opacity:.2,depthWrite:false,side:D,vertexColors:true}),
  fabric,weave,eyeTex:eye,
  armor:std({color:0x30343a,metalness:.8,roughness:.38}),
  goldS:std({color:0xc8a24a,metalness:1,roughness:.3}),
  navSkin:new THREE.MeshPhysicalMaterial({color:0xe6e4e2,roughness:.38,metalness:0,sheen:1,sheenColor:new THREE.Color(0xa8c8ff),emissive:0x203040,emissiveIntensity:.35,clearcoat:.3}),
  solid:(c,m=.3,r=.6)=>std({color:c,metalness:m,roughness:r}),
  fabricColor:c=>{const m=fabric.clone();m.color.set(c);return m;}
 };
}
