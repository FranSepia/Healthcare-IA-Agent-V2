import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import {feature} from 'https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/+esm';
import world from 'https://esm.sh/@d3-maps/atlas@1.0.0/world/countries/countries-110m';

const activity = [
  {name:'Kenya', lon:37.9, lat:.2, detail:'9 active opportunities · 93% highest fit'},
  {name:'Rwanda', lon:29.9, lat:-1.9, detail:'6 active opportunities · 90% highest fit'},
  {name:'Ghana', lon:-1, lat:7.9, detail:'8 active opportunities · 88% highest fit'},
  {name:'Guatemala', lon:-90.2, lat:15.8, detail:'5 active opportunities · 80% highest fit'},
  {name:'Indonesia', lon:117.3, lat:-2.2, detail:'7 active opportunities · 74% highest fit'},
  {name:'Vietnam', lon:108.3, lat:14.1, detail:'4 active opportunities · 85% highest fit'}
];
const countries = feature(world, world.objects.features).features;
const initialized = new WeakSet();

function mount(container){
  if(!container || initialized.has(container)) return;
  initialized.add(container);
  const svg=d3.select(container.querySelector('svg'));
  let rotation=[-18,-8,0], dragging=false, lastInteraction=Date.now(), selected='Kenya';

  function draw(){
    if(!container.isConnected) return;
    const size=container.clientWidth;
    const projection=d3.geoOrthographic().translate([size/2,size/2]).scale(size*.455).rotate(rotation).clipAngle(90).precision(.5);
    const path=d3.geoPath(projection);
    svg.attr('viewBox',`0 0 ${size} ${size}`).selectAll('*').remove();
    svg.append('path').datum({type:'Sphere'}).attr('class','globe-sphere').attr('d',path);
    svg.append('path').datum(d3.geoGraticule10()).attr('class','globe-grid').attr('d',path);
    svg.append('g').selectAll('path').data(countries).join('path').attr('class','globe-land').attr('d',path);
    svg.append('path').datum({type:'Sphere'}).attr('class','globe-edge').attr('d',path);
    const visible=activity.filter(d=>d3.geoDistance([-rotation[0],-rotation[1]],[d.lon,d.lat])<Math.PI/2);
    const points=svg.append('g').selectAll('g').data(visible,d=>d.name).join('g').attr('transform',d=>`translate(${projection([d.lon,d.lat])})`);
    points.append('circle').attr('class','globe-halo').attr('r',11);
    points.append('circle').attr('class',d=>`globe-point${d.name===selected?' selected':''}`).attr('r',5).attr('role','button').attr('aria-label',d=>`${d.name}: ${d.detail}`).on('click',(event,d)=>select(d));
  }

  function select(d){
    selected=d.name;lastInteraction=Date.now();
    const card=container.closest('.dashboard-world')?.querySelector('.globe-selection');
    if(card){card.querySelector('b').textContent=d.name;card.querySelector('span').textContent=d.detail}
    draw();
  }

  svg.call(d3.drag().on('start',()=>{dragging=true;lastInteraction=Date.now()}).on('drag',event=>{rotation[0]+=event.dx*.38;rotation[1]=Math.max(-75,Math.min(75,rotation[1]-event.dy*.38));draw()}).on('end',()=>{dragging=false;lastInteraction=Date.now()}));
  new ResizeObserver(draw).observe(container);
  d3.timer(()=>{if(!container.isConnected)return true;if(!dragging&&Date.now()-lastInteraction>1800){rotation[0]+=.035;draw()}return false});
  draw();
}

function mountAll(){document.querySelectorAll('[data-interactive-globe]').forEach(mount)}
document.addEventListener('aceso:dashboard-ready',mountAll);
new MutationObserver(mountAll).observe(document.body,{childList:true,subtree:true});
mountAll();
