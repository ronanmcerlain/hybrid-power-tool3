import { useState, useEffect, useCallback } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, ComposedChart, ReferenceLine } from "recharts";
import { Sun, Battery, Zap, AlertTriangle, Download, Upload, ChevronDown, ChevronRight, Settings, DollarSign, BarChart3, FileText, Fuel, Leaf, TrendingUp, Info, Share2, Save } from "lucide-react";

const LOCATIONS = [
  { name: 'Perth, WA', lat: -31.95, lon: 115.86 },
  { name: 'Darwin, NT', lat: -12.46, lon: 130.84 },
  { name: 'Karratha, WA', lat: -20.74, lon: 116.85 },
  { name: 'Alice Springs, NT', lat: -23.70, lon: 133.88 },
  { name: 'Kalgoorlie, WA', lat: -30.75, lon: 121.47 },
  { name: 'Broome, WA', lat: -17.96, lon: 122.24 },
  { name: 'Mt Isa, QLD', lat: -20.73, lon: 139.49 },
  { name: 'Coober Pedy, SA', lat: -29.01, lon: 134.76 },
  { name: 'Townsville, QLD', lat: -19.25, lon: 146.77 },
  { name: 'Custom', lat: -25, lon: 130 },
];

const LOAD_PATTERNS = {
  flat:       { label: 'Flat 500kW',       data: Array(24).fill(500) },
  commercial: { label: 'Commercial',        data: [200,200,200,200,200,250,400,600,700,750,800,800,750,800,800,750,700,600,500,400,350,300,250,200] },
  industrial: { label: 'Industrial 24/7',   data: [400,400,400,400,400,500,700,900,950,1000,1000,1000,950,1000,1000,950,900,700,500,450,400,400,400,400] },
  mining:     { label: 'Mining Camp',       data: [300,250,250,250,250,300,500,700,650,600,600,600,600,650,650,600,550,500,600,700,650,500,400,350] },
  processing: { label: 'Processing Plant',  data: [800,800,800,800,800,850,1000,1200,1200,1200,1200,1200,1200,1200,1200,1200,1000,900,850,800,800,800,800,800] },
  resort:     { label: 'Remote Resort',     data: [150,120,100,100,100,120,200,350,400,350,300,300,350,350,300,300,350,400,500,550,500,400,300,200] },
  telecoms:   { label: 'Telecoms Tower',    data: Array(24).fill(50) },
};

// Expanded Thermal Generation models
// sfcBase = SFC at rated load (L/kWh or m³/kWh for gas)
// sfcPart = SFC at ~30% load
// sfcMid  = SFC at ~60% load
// serviceInterval = hours between scheduled services
// minorServiceCost = cost per minor service ($)
// majorServiceCost = cost per major overhaul ($)
// overhaulInterval = hours between major overhauls
// maintCost = annualised $/kW/yr (used in financial model)
// fuelUnit = display unit for fuel
const THERMAL_MODELS = [
  {
    name: 'Diesel — Small (<100 kW)',
    fuelType: 'Diesel',
    fuelUnit: 'L',
    sfcBase: 0.280,
    sfcMid:  0.295,
    sfcPart: 0.350,
    maintCost: 35,
    serviceInterval: 250,
    minorServiceCost: 800,
    majorServiceCost: 12000,
    overhaulInterval: 10000,
    co2Factor: 2.68,
    notes: 'Typical air-cooled or small liquid-cooled set. High part-load penalty.',
  },
  {
    name: 'Diesel — Medium (100–500 kW)',
    fuelType: 'Diesel',
    fuelUnit: 'L',
    sfcBase: 0.240,
    sfcMid:  0.255,
    sfcPart: 0.300,
    maintCost: 45,
    serviceInterval: 500,
    minorServiceCost: 2500,
    majorServiceCost: 45000,
    overhaulInterval: 15000,
    co2Factor: 2.68,
    notes: 'Workhorse remote-area set. Good support network across Australia.',
  },
  {
    name: 'Diesel — Large (500–2000 kW)',
    fuelType: 'Diesel',
    fuelUnit: 'L',
    sfcBase: 0.210,
    sfcMid:  0.225,
    sfcPart: 0.270,
    maintCost: 55,
    serviceInterval: 500,
    minorServiceCost: 6000,
    majorServiceCost: 120000,
    overhaulInterval: 20000,
    co2Factor: 2.68,
    notes: 'Turbocharged 4-stroke. Common in mining and processing.',
  },
  {
    name: 'Diesel — High-Speed (>2 MW)',
    fuelType: 'Diesel',
    fuelUnit: 'L',
    sfcBase: 0.200,
    sfcMid:  0.215,
    sfcPart: 0.250,
    maintCost: 70,
    serviceInterval: 1000,
    minorServiceCost: 15000,
    majorServiceCost: 300000,
    overhaulInterval: 30000,
    co2Factor: 2.68,
    notes: 'High-speed 16-cyl sets (e.g. Caterpillar 3516, MTU 20V). Best efficiency at high load.',
  },
  {
    name: 'Natural Gas — Reciprocating (100–500 kW)',
    fuelType: 'Natural Gas',
    fuelUnit: 'm³',
    sfcBase: 0.280,  // m³/kWh (≈ 10 MJ/kWh ÷ 35.9 MJ/m³)
    sfcMid:  0.300,
    sfcPart: 0.360,
    maintCost: 50,
    serviceInterval: 500,
    minorServiceCost: 3000,
    majorServiceCost: 55000,
    overhaulInterval: 12000,
    co2Factor: 2.02,  // kgCO₂/m³ natural gas
    notes: 'Lean-burn spark-ignited. Lower CO₂ than diesel. Requires pipeline or LPG/LNG supply.',
  },
  {
    name: 'Natural Gas — Reciprocating (500–2000 kW)',
    fuelType: 'Natural Gas',
    fuelUnit: 'm³',
    sfcBase: 0.250,
    sfcMid:  0.265,
    sfcPart: 0.320,
    maintCost: 60,
    serviceInterval: 1000,
    minorServiceCost: 8000,
    majorServiceCost: 150000,
    overhaulInterval: 20000,
    co2Factor: 2.02,
    notes: 'e.g. Jenbacher J320, Caterpillar G3516. Good efficiency, lower emissions.',
  },
  {
    name: 'Dual-Fuel Gas/Diesel (100–1000 kW)',
    fuelType: 'Dual-Fuel',
    fuelUnit: 'L-eq',
    sfcBase: 0.220,
    sfcMid:  0.240,
    sfcPart: 0.290,
    maintCost: 60,
    serviceInterval: 500,
    minorServiceCost: 4500,
    majorServiceCost: 90000,
    overhaulInterval: 18000,
    co2Factor: 2.40,  // blended factor (70% gas substitution)
    notes: 'Up to 70% gas substitution at full load. Diesel pilot injection always required. Flexible fuel source.',
  },
  {
    name: 'LPG / Propane (50–500 kW)',
    fuelType: 'LPG',
    fuelUnit: 'L',
    sfcBase: 0.310,  // LPG L/kWh (lower energy density than diesel)
    sfcMid:  0.330,
    sfcPart: 0.400,
    maintCost: 45,
    serviceInterval: 500,
    minorServiceCost: 2500,
    majorServiceCost: 40000,
    overhaulInterval: 12000,
    co2Factor: 1.55,  // kgCO₂/L LPG
    notes: 'Common where reticulated gas unavailable. Higher fuel cost than diesel in most remote areas.',
  },
  {
    name: 'HFO / Marine Diesel (>2 MW)',
    fuelType: 'HFO',
    fuelUnit: 'L',
    sfcBase: 0.195,
    sfcMid:  0.210,
    sfcPart: 0.245,
    maintCost: 80,
    serviceInterval: 1000,
    minorServiceCost: 20000,
    majorServiceCost: 400000,
    overhaulInterval: 40000,
    co2Factor: 2.96,
    notes: 'Medium-speed 4-stroke (e.g. Wärtsilä 34). Best SFC but complex fuel handling. Island power stations.',
  },
  {
    name: 'Biodiesel B20 — Medium (100–500 kW)',
    fuelType: 'Biodiesel B20',
    fuelUnit: 'L',
    sfcBase: 0.248,  // ~3% higher consumption than diesel
    sfcMid:  0.263,
    sfcPart: 0.310,
    maintCost: 48,
    serviceInterval: 500,
    minorServiceCost: 2600,
    majorServiceCost: 47000,
    overhaulInterval: 14000,
    co2Factor: 2.15,  // 20% bio offset
    notes: 'Drop-in blend for standard diesel sets. Slightly higher SFC, lower net CO₂. Check OEM approval.',
  },
];

const BATTERY_TYPES = [
  { name: 'LFP (Lithium Iron Phosphate)',  dod: 0.9,  cycles: 6000,  efficiency: 0.92, degradation: 2   },
  { name: 'NMC (Nickel Manganese Cobalt)', dod: 0.85, cycles: 4000,  efficiency: 0.94, degradation: 3   },
  { name: 'Lead Acid (AGM)',               dod: 0.5,  cycles: 1500,  efficiency: 0.82, degradation: 5   },
  { name: 'Vanadium Redox Flow',           dod: 0.95, cycles: 15000, efficiency: 0.75, degradation: 0.5 },
];

const PV_TYPES = [
  { name: 'Mono PERC',            efficiency: 0.20,  degradation: 0.5,  tempCoeff: -0.35 },
  { name: 'Bifacial Mono PERC',   efficiency: 0.21,  degradation: 0.45, tempCoeff: -0.35 },
  { name: 'HJT (Heterojunction)', efficiency: 0.22,  degradation: 0.4,  tempCoeff: -0.26 },
  { name: 'TOPCon',               efficiency: 0.225, degradation: 0.4,  tempCoeff: -0.30 },
  { name: 'Thin Film (CdTe)',     efficiency: 0.17,  degradation: 0.7,  tempCoeff: -0.20 },
];

const TRACKING = [
  { name: 'Fixed Tilt',          factor: 1.0  },
  { name: 'Single Axis Tracker', factor: 1.22 },
  { name: 'Dual Axis Tracker',   factor: 1.35 },
];

const fmtK = (v) => v >= 1e6 ? '$' + (v/1e6).toFixed(1) + 'M' : v >= 1e3 ? '$' + (v/1e3).toFixed(0) + 'K' : '$' + Math.round(v);
const fmtN = (v) => typeof v === 'number' ? v.toLocaleString('en-AU') : v;
const C = { solar:'#f59e0b', battery:'#3b82f6', diesel:'#ef4444', load:'#10b981', card:'#1e293b' };

const inp = { background:'#0f172a', border:'1px solid #334155', borderRadius:6, color:'#f1f5f9', padding:'6px 8px', fontSize:13, width:'100%' };
const sel = { ...inp };

function Collapsible({ title, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderRadius:10, border:'1px solid #334155', overflow:'hidden', background:C.card, marginBottom:12 }}>
      <button onClick={()=>setOpen(!open)} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 18px', background:'none', border:'none', color:'#e2e8f0', cursor:'pointer', fontSize:14, fontWeight:600 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>{icon}{title}</div>
        {open ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
      </button>
      {open && <div style={{ padding:'4px 18px 18px' }}>{children}</div>}
    </div>
  );
}

function Stat({ label, value, sub, color='#10b981' }) {
  return (
    <div style={{ background:'#0f172a', borderRadius:10, padding:'14px 16px', border:`1px solid ${color}44` }}>
      <div style={{ fontSize:20, fontWeight:700, color, fontFamily:'monospace' }}>{value}</div>
      <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>{sub}</div>}
    </div>
  );
}

function TooltipHint({ text }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position:'relative', display:'inline-block', marginLeft:4 }}>
      <Info size={12} style={{ color:'#475569', cursor:'help', verticalAlign:'middle' }} onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}/>
      {show && <span style={{ position:'absolute', zIndex:99, background:'#1e293b', border:'1px solid #475569', color:'#cbd5e1', fontSize:11, borderRadius:6, padding:'8px 10px', width:220, top:-4, left:18, boxShadow:'0 4px 20px #000', whiteSpace:'normal' }}>{text}</span>}
    </span>
  );
}

function IF({ label, value, onChange, unit, hint, step, min, max }) {
  return (
    <div style={{ marginBottom:10 }}>
      <label style={{ fontSize:11, color:'#94a3b8', display:'flex', alignItems:'center', marginBottom:3 }}>{label}{hint && <TooltipHint text={hint}/>}</label>
      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
        <input type="number" value={value} onChange={onChange} step={step} min={min} max={max} style={{ ...inp, flex:1 }}/>
        {unit && <span style={{ fontSize:11, color:'#64748b', whiteSpace:'nowrap' }}>{unit}</span>}
      </div>
    </div>
  );
}

const g = (cols, gap=10) => ({ display:'grid', gridTemplateColumns:`repeat(${cols},1fr)`, gap });
const btnStyle = (on) => ({ padding:'5px 10px', borderRadius:6, border:'none', cursor:'pointer', fontSize:11, fontWeight:500, background:on?'#059669':'#1e293b', color:on?'#fff':'#94a3b8', marginRight:4, marginBottom:4 });
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ttStyle = { background:'#0f172a', border:'1px solid #334155', borderRadius:8 };

// Part-load efficiency curve chart data for selected thermal model
function PartLoadCurve({ model }) {
  const points = [25, 30, 40, 50, 60, 70, 80, 90, 100].map(pct => {
    // Interpolate SFC across load range
    let sfc;
    if (pct <= 30) sfc = model.sfcPart;
    else if (pct <= 60) sfc = model.sfcPart + (model.sfcMid - model.sfcPart) * ((pct - 30) / 30);
    else sfc = model.sfcMid + (model.sfcBase - model.sfcMid) * ((pct - 60) / 40);
    return { load: pct + '%', sfc: parseFloat(sfc.toFixed(3)) };
  });
  return (
    <div style={{ background:'#0f172a', borderRadius:8, padding:'12px 16px', marginTop:10 }}>
      <div style={{ fontSize:11, color:'#64748b', marginBottom:8 }}>Part-Load Fuel Consumption Curve ({model.fuelUnit}/kWh)</div>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={points} margin={{ top:4, right:10, bottom:4, left:0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/>
          <XAxis dataKey="load" tick={{ fill:'#64748b', fontSize:10 }}/>
          <YAxis domain={['auto','auto']} tick={{ fill:'#64748b', fontSize:10 }} width={36}/>
          <Tooltip contentStyle={ttStyle} formatter={v=>[v + ' ' + model.fuelUnit + '/kWh', 'SFC']}/>
          <Line dataKey="sfc" stroke="#ef4444" strokeWidth={2} dot={{ r:3, fill:'#ef4444' }}/>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Service cost summary for selected thermal model
function ServiceSummary({ model, dieselCap }) {
  const annualHrs = 4000; // assumed run hours for context
  const servicesPerYear = annualHrs / model.serviceInterval;
  const overhaulsPerYear = annualHrs / model.overhaulInterval;
  const annualServiceCost = Math.round(servicesPerYear * model.minorServiceCost + overhaulsPerYear * model.majorServiceCost);
  return (
    <div style={{ background:'#0f172a', borderRadius:8, padding:'12px 14px', marginTop:10, fontSize:12 }}>
      <div style={{ fontSize:11, color:'#64748b', marginBottom:8 }}>Service Cost Summary (at 4,000 hr/yr run-time)</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
        {[
          ['Service Interval', model.serviceInterval.toLocaleString() + ' hr'],
          ['Minor Service', '$' + model.minorServiceCost.toLocaleString()],
          ['Major Overhaul', '$' + model.majorServiceCost.toLocaleString()],
          ['Overhaul Interval', model.overhaulInterval.toLocaleString() + ' hr'],
          ['Est. Services/yr', servicesPerYear.toFixed(1)],
          ['Annual Svc Cost', '$' + annualServiceCost.toLocaleString()],
        ].map(([k,v],i) => (
          <div key={i} style={{ background:'#1e293b', borderRadius:6, padding:'8px 10px' }}>
            <div style={{ fontSize:10, color:'#64748b' }}>{k}</div>
            <div style={{ fontSize:13, fontWeight:600, color:'#e2e8f0', marginTop:2 }}>{v}</div>
          </div>
        ))}
      </div>
      {model.notes && <div style={{ marginTop:10, fontSize:11, color:'#64748b', fontStyle:'italic' }}>ℹ {model.notes}</div>}
    </div>
  );
}

export default function HybridPowerSizing() {
  const [location, setLocation]       = useState(LOCATIONS[0]);
  const [loads, setLoads]             = useState([...LOAD_PATTERNS.commercial.data]);
  const [loadScale, setLoadScale]     = useState(1);
  const [renewable, setRenewable]     = useState(70);
  const [pvType, setPvType]           = useState(0);
  const [tracking, setTracking]       = useState(0);
  const [battType, setBattType]       = useState(0);
  const [thermalModel, setThermalModel] = useState(1); // index into THERMAL_MODELS
  const [costs, setCosts]             = useState({ pv:1100, batt:800, diesel:450, fuel:1.85, bos:15, epc:12, land:0 });
  const [opex, setOpex]               = useState({ pvOM:15, battOM:10, dieselOM:0, dieselOMauto:true, insurance:0.5, siteManagement:0, networkFees:0, spares:0, envCompliance:0, waterChem:0, remoteMonitoring:0 });
  const [finance, setFinance]         = useState({ fuelEsc:3, discount:8, projectLife:25, inflationRate:2.5 });
  const [adv, setAdv]                 = useState({ pr:0.82, hours:4, crate:0.5, renewDays:0, dfStart:10, dfEnd:16, minPV:0, maxPV:15000, minBatt:0, maxBatt:50000, maxPow:15000, dieselSize:0, dieselQty:1, autoSize:true, battChargeSrc:'both', soiling:3, mismatch:2, inverterEff:96.5, dcacRatio:1.2, dieselMinLoad:30, spinningResvPct:10, battReplacementYear:12 });
  const [projectInfo, setProjectInfo] = useState({ name:'Hybrid Power Feasibility Study', client:'', reference:'', engineer:'', date:new Date().toISOString().split('T')[0], revision:'A' });
  const [results, setResults]         = useState(null);
  const [tab, setTab]                 = useState('config');
  const [subTab, setSubTab]           = useState('overview');
  const [warnings, setWarnings]       = useState([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [toast, setToast]             = useState('');
  const [activeSeason, setActiveSeason]   = useState(0);

  const showToast = (msg, dur=2500) => { setToast(msg); setTimeout(()=>setToast(''), dur); };

  const getSolar = useCallback((m, lat) => {
    const p=[7.4,6.6,5.9,4.8,3.9,3.6,3.8,4.6,5.7,6.8,7.5,7.7];
    const d=[5.8,5.5,5.9,6.3,6.0,5.8,6.2,6.8,7.2,7.2,6.8,6.1];
    const a=[7.2,6.8,6.5,5.8,5.0,4.5,5.0,5.8,6.8,7.5,7.6,7.5];
    if (Math.abs(lat+31.95)<1) return p[m];
    if (Math.abs(lat+12.46)<2) return d[m];
    if (Math.abs(lat+23.70)<2) return a[m];
    const b=[5.5,6,5.5,4.5,3.5,3,3.2,4,5,6,6.5,6];
    return b[lat<0?m:(m+6)%12]*(1-Math.abs(lat)/90*0.4);
  }, []);

  const setPattern = (key) => setLoads([...LOAD_PATTERNS[key].data]);

  const downloadTemplate = () => {
    let csv="Hour,Load_kW\n"; for(let i=0;i<24;i++) csv+=`${i},${loads[i]}\n`;
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download='load_template.csv'; a.click();
  };

  const handleCSV = (e) => {
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=(ev)=>{
      const lines=ev.target.result.trim().split('\n').slice(1);
      const vals=lines.map(l=>{const v=parseFloat(l.split(',')[1]);return isNaN(v)?500:Math.max(0,v);}).slice(0,24);
      while(vals.length<24) vals.push(500);
      setLoads(vals); showToast('✅ CSV loaded');
    };
    reader.readAsText(file);
  };

  const saveProject = () => {
    localStorage.setItem('hybridConfig', JSON.stringify({loads,loadScale,renewable,location,projectInfo}));
    showToast('✅ Saved to browser');
  };

  const shareLink = () => {
    const encoded=btoa(encodeURIComponent(JSON.stringify({loads,loadScale,renewable,location,projectInfo})));
    navigator.clipboard.writeText(`${window.location.href.split('?')[0]}?config=${encoded}`).then(()=>showToast('🔗 Link copied!',3000));
  };

  useEffect(()=>{
    try {
      const saved=localStorage.getItem('hybridConfig');
      if(saved){const c=JSON.parse(saved);if(c.loads)setLoads(c.loads);if(c.loadScale!==undefined)setLoadScale(c.loadScale);if(c.renewable!==undefined)setRenewable(c.renewable);if(c.location)setLocation(c.location);if(c.projectInfo)setProjectInfo(c.projectInfo);}
    } catch {}
  },[]);

  const calc = async () => {
    setIsCalculating(true); setWarnings([]);
    await new Promise(r=>setTimeout(r,60));
    try {
      const w=[];
      const dS = THERMAL_MODELS[thermalModel];
      const sL=loads.map(l=>l*loadScale);
      const avg=sL.reduce((a,b)=>a+b)/24;
      if(avg<=0) throw new Error('Invalid loads');
      const peak=Math.max(...sL), minLoad=Math.min(...sL);
      const lf=avg/peak, annual=avg*8760, renew=annual*renewable/100;
      const tF=TRACKING[tracking].factor, pvS=PV_TYPES[pvType], bS=BATTERY_TYPES[battType];
      const ePR=adv.pr*tF;
      const avgSol=Array.from({length:12},(_,i)=>getSolar(i,location.lat)).reduce((a,b)=>a+b)/12;
      const yldPerKWp=avgSol*365*ePR;
      let pv=renew/yldPerKWp, dfLoad=0;
      if(adv.renewDays>0){for(let h=adv.dfStart;h<adv.dfEnd;h++)dfLoad+=sL[h%24];pv+=dfLoad*adv.renewDays*1.3/yldPerKWp;w.push('Sized for '+adv.renewDays+' thermal-free days');}
      let batt=avg*adv.hours/bS.dod;
      if(adv.renewDays>0) batt=Math.max(batt,dfLoad/((adv.dfEnd-adv.dfStart)||1)*6/bS.dod);
      let pow=Math.min(batt*adv.crate,peak*(1+adv.spinningResvPct/100));
      pv=Math.max(adv.minPV,Math.min(adv.maxPV,pv));
      const pvInv=Math.round(pv/adv.dcacRatio);
      batt=Math.max(adv.minBatt,Math.min(adv.maxBatt,batt)); pow=Math.max(0,Math.min(adv.maxPow,pow));
      let dCap,dQty;
      if(adv.autoSize){dCap=peak*1.2;dQty=1;}
      else{dQty=Math.max(1,adv.dieselQty);dCap=adv.dieselSize*dQty;if(dCap<peak)w.push('Thermal capacity ('+Math.round(dCap)+'kW) < peak ('+Math.round(peak)+'kW)');}
      let dEn=annual-renew;
      if(adv.renewDays>0) dEn=Math.max(0,dEn-dfLoad*adv.renewDays*0.8);
      const dlf=dCap>0?dEn/8760/dCap:0;
      // Use interpolated SFC based on load factor
      let sfcEff;
      if(dlf<0.3) sfcEff=dS.sfcPart;
      else if(dlf<0.6) sfcEff=dS.sfcPart+(dS.sfcMid-dS.sfcPart)*((dlf-0.3)/0.3);
      else sfcEff=dS.sfcMid+(dS.sfcBase-dS.sfcMid)*((dlf-0.6)/0.4);
      const fuel=dEn*sfcEff;
      if(dlf<0.3&&renewable>70) w.push('Low thermal load factor: '+(dlf*100).toFixed(0)+'%');
      if(dS.fuelType==='Natural Gas') w.push('Natural gas SFC in m³/kWh — update fuel price to $/m³');
      if(dS.fuelType==='LPG') w.push('LPG pricing typically $0.80–$1.20/L delivered remote AU');
      const pvCost=pv*costs.pv, battCost=batt*costs.batt, dCostC=dCap*costs.diesel;
      const bosCost=(pvCost+battCost)*costs.bos/100, epcCost=(pvCost+battCost+dCostC+bosCost)*costs.epc/100;
      const hCap=pvCost+battCost+dCostC+bosCost+epcCost+costs.land, dCap2=peak*1.2*costs.diesel*1.1;
      const projLife=finance.projectLife, bRY=adv.battReplacementYear;
      let hNPV=-hCap,dNPV=-dCap2,cumH=hCap,cumD=dCap2;
      const cf=[{year:0,hybridCumulative:-hCap,dieselCumulative:-dCap2,savings:0}];
      const dOMr=opex.dieselOMauto?dS.maintCost:opex.dieselOM;
      const fSO=(opex.siteManagement||0)+(opex.networkFees||0)+(opex.spares||0)+(opex.envCompliance||0)+(opex.waterChem||0)+(opex.remoteMonitoring||0);
      const insCost=hCap*opex.insurance/100;
      for(let y=1;y<=projLife;y++){
        const d=Math.pow(1+finance.discount/100,-y),fe=Math.pow(1+finance.fuelEsc/100,y-1),inf=Math.pow(1+finance.inflationRate/100,y-1);
        const pvOM=pv*opex.pvOM*inf,battOM=batt*opex.battOM*inf,dOM=dCap*dOMr*inf;
        const insOM=insCost*inf,siteOM=fSO*inf,fuelH=fuel*costs.fuel*fe;
        const hO=pvOM+battOM+dOM+fuelH+insOM+siteOM;
        const dFuel=annual*sfcEff*costs.fuel*fe,dMaint=peak*1.2*dS.maintCost*1.5*inf,dInsOM=dCap2*opex.insurance/100*inf;
        const dO=dMaint+dFuel+dInsOM;
        let hY=hO; if(y===bRY){const rc=batt*costs.batt*0.7;hY+=rc;hNPV-=rc*d;}
        hNPV-=hO*d;dNPV-=dO*d;cumH+=hY;cumD+=dO;
        cf.push({year:y,hybridCumulative:-cumH,dieselCumulative:-cumD,savings:cumD-cumH,hybridAnnual:hY,dieselAnnual:dO});
      }
      const mon=Array.from({length:12},(_,i)=>{
        const s=getSolar(i,location.lat)*pv*30*ePR,l=avg*24*30,dg=Math.max(0,l-s),fm=dg*sfcEff;
        return{month:MONTHS[i],solar:Math.round(s),diesel:Math.round(dg),load:Math.round(l),solarHours:getSolar(i,location.lat).toFixed(1),fuelLitres:Math.round(fm),fuelCost:Math.round(fm*costs.fuel),renewFraction:Math.round((s/l)*100)};
      });
      const seasons=['Summer','Autumn','Winter','Spring'].map((name,idx)=>{
        const m=[0,3,6,9][idx],sh=getSolar(m,location.lat),minSOC=batt*(1-bS.dod),maxSOC=batt;
        let battSOC=minSOC,dayData=[];
        for(let day=0;day<3;day++){dayData=[];for(let h=0;h<24;h++){
          const sBefore=battSOC,sgDC=h>=6&&h<=18?pv*(sh*Math.PI/24)*Math.sin(((h-6)/12)*Math.PI)*ePR:0;
          const sg=Math.min(sgDC,pvInv);let bc=0,bd=0,dg=0,curt=0;
          const avail=Math.max(0,battSOC-minSOC),space=Math.max(0,maxSOC-battSOC),net=sg-sL[h];
          if(net>0){if(adv.battChargeSrc==='pv'||adv.battChargeSrc==='both'){const ci=Math.min(net,pow,space/bS.efficiency);bc=ci*bS.efficiency;battSOC+=bc;curt=Math.max(0,net-ci);}else{curt=net;}}
          else if(net<0){const def=-net;if(avail>1){bd=Math.min(def,pow,avail);battSOC-=bd;}const still=def-bd;if(still>0.1)dg=still;}
          dayData.push({hour:h,load:Math.round(sL[h]),solar:Math.round(Math.max(0,sg)),battDischarge:Math.round(bd),diesel:Math.round(dg),curtailed:Math.round(curt),soc:Math.round((sBefore/batt)*100)});
        }}
        const hourly=dayData,ts=hourly.reduce((a,h)=>a+h.solar,0),td=hourly.reduce((a,h)=>a+h.diesel,0),tl=hourly.reduce((a,h)=>a+h.load,0),tc=hourly.reduce((a,h)=>a+h.curtailed,0);
        return{name,data:hourly,totalSolar:ts,totalDiesel:td,totalLoad:tl,totalCurtailed:tc,renewFraction:Math.round(ts/tl*100)};
      });
      const co2Factor = dS.co2Factor;
      const co2D=annual*sfcEff*co2Factor/1000,co2H=dEn*sfcEff*co2Factor/1000,co2S=co2D-co2H;
      const sensFuel=[1.2,1.5,1.85,2.2,2.6,3.0].map(fp=>{
        let sH=hCap,sD=dCap2;
        for(let y=1;y<=projLife;y++){const fe=Math.pow(1+finance.fuelEsc/100,y-1),inf=Math.pow(1+finance.inflationRate/100,y-1);sH+=(pv*opex.pvOM+batt*opex.battOM+dCap*dOMr+insCost+fSO)*inf+fuel*fp*fe;sD+=(peak*1.2*dS.maintCost*1.5+dCap2*opex.insurance/100)*inf+annual*sfcEff*fp*fe;if(y===bRY)sH+=batt*costs.batt*0.7;}
        return{fuelPrice:'$'+fp.toFixed(2),hybridLCOE:(sH/(annual*projLife)).toFixed(3),dieselLCOE:(sD/(annual*projLife)).toFixed(3),savings:Math.round((sD-sH)/1000)};
      });
      const sensRenew=[30,50,70,85,95].map(rp=>{const rE=annual*rp/100,rPv=rE/yldPerKWp,rBatt=avg*(rp>80?6:4)/bS.dod;return{renewPct:rp+'%',capex:Math.round((rPv*costs.pv+rBatt*costs.batt+dCap*costs.diesel)/1000),pvSize:Math.round(rPv),battSize:Math.round(rBatt)};});
      setWarnings(w);
      const y1pvOM=pv*opex.pvOM,y1bOM=batt*opex.battOM,y1dOM=dCap*dOMr,y1Fuel=fuel*costs.fuel,y1Ins=insCost,y1Site=fSO;
      const y1HO=y1pvOM+y1bOM+y1dOM+y1Fuel+y1Ins+y1Site,y1DF=annual*sfcEff*costs.fuel,y1DM=peak*1.2*dS.maintCost*1.5,y1DI=dCap2*opex.insurance/100,y1DO=y1DF+y1DM+y1DI;
      const capexBreakdown=[{name:'Solar PV',value:Math.round(pvCost),fill:C.solar},{name:'Battery',value:Math.round(battCost),fill:C.battery},{name:'Thermal',value:Math.round(dCostC),fill:C.diesel},{name:'BOS',value:Math.round(bosCost),fill:'#8b5cf6'},{name:'EPC',value:Math.round(epcCost),fill:'#10b981'}].filter(d=>d.value>0);
      setResults({
        pv:Math.round(pv),pvInverter:pvInv,dcacRatio:adv.dcacRatio,batt:Math.round(batt),pow:Math.round(pow),diesel:Math.round(dCap),dSize:adv.autoSize?Math.round(dCap):adv.dieselSize,dQty,
        thermalModelName: dS.name, thermalFuelType: dS.fuelType, thermalFuelUnit: dS.fuelUnit,
        annual:Math.round(annual),renew:Math.round(renew),dEn:Math.round(dEn),hCap:Math.round(hCap),dCap2:Math.round(dCap2),pvCost:Math.round(pvCost),battCost:Math.round(battCost),dCostC:Math.round(dCostC),bosCost:Math.round(bosCost),epcCost:Math.round(epcCost),
        hOpex:Math.round((cumH-hCap)/projLife),dOpex:Math.round((cumD-dCap2)/projLife),savings:Math.round((cumD-cumH)/projLife),npv:Math.round(dNPV-hNPV),
        payback:((hCap-dCap2)/((cumD-cumH)/projLife)).toFixed(1),lcoeH:(cumH/(annual*projLife)).toFixed(3),lcoeD:(cumD/(annual*projLife)).toFixed(3),
        mon,cf,seasons,capexBreakdown,avg:Math.round(avg),peak:Math.round(peak),minLoad:Math.round(minLoad),loadFactor:(lf*100).toFixed(1),
        fuel:Math.round(fuel),co2S:Math.round(co2S),co2D:Math.round(co2D),co2H:Math.round(co2H),treesEquiv:Math.round(co2S*1000/22),lf:(dlf*100).toFixed(1),
        dieselRunHrs:Math.round(dEn/(dCap*dlf||1)),dieselFuelAnn:Math.round(fuel),dieselOnlyFuelAnn:Math.round(annual*sfcEff),
        sensFuel,sensRenew,effectivePR:(ePR*100).toFixed(1),sfcEff:sfcEff.toFixed(3),
        pvToLoad:(pv/peak).toFixed(1),battHoursActual:(batt/avg).toFixed(1),pvCF:((pv>0?renew/pv/8760:0)*100).toFixed(1),
        y1pvOM:Math.round(y1pvOM),y1bOM:Math.round(y1bOM),y1dOM:Math.round(y1dOM),y1Fuel:Math.round(y1Fuel),y1Ins:Math.round(y1Ins),y1Site:Math.round(y1Site),y1HO:Math.round(y1HO),
        y1DF:Math.round(y1DF),y1DM:Math.round(y1DM),y1DI:Math.round(y1DI),y1DO:Math.round(y1DO),
      });
      setTab('results'); setSubTab('overview'); showToast('✅ Calculation complete');
    } catch(err) { showToast('❌ '+(err.message||'Error'), 4000); }
    finally { setIsCalculating(false); }
  };

  const generateReport = () => {
    if(!results) return;
    const r=results,pi=projectInfo,bt=BATTERY_TYPES[battType],pt=PV_TYPES[pvType],tr=TRACKING[tracking],dm=THERMAL_MODELS[thermalModel];
    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${pi.name}</title>
<style>body{font-family:system-ui,sans-serif;color:#1e293b;margin:0}
.cover{background:linear-gradient(135deg,#0f172a,#1e3a5f 50%,#064e3b);color:#fff;padding:60px;min-height:35vh;display:flex;flex-direction:column;justify-content:flex-end}
.cover h1{font-size:32px;font-weight:700;margin:0 0 8px}.cover h2{font-size:16px;font-weight:300;opacity:.85;margin:0 0 32px}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:13px;opacity:.8}.meta span{font-weight:600}
.content{padding:40px 60px;max-width:860px;margin:0 auto}
h2{font-size:20px;border-bottom:3px solid #10b981;padding-bottom:6px;margin:36px 0 16px}
table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}
th{background:#f1f5f9;padding:9px 11px;text-align:left;font-weight:600;border-bottom:2px solid #e2e8f0}
td{padding:7px 11px;border-bottom:1px solid #f1f5f9}
.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}
.card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;text-align:center}
.card .v{font-size:22px;font-weight:700}.card .l{font-size:12px;color:#64748b;margin-top:3px}
.hl{background:linear-gradient(135deg,#ecfdf5,#f0fdf4);border:1px solid #86efac;border-radius:8px;padding:18px;margin:16px 0}
.disc{font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px;margin-top:32px}
</style></head><body>
<div class="cover"><h1>${pi.name}</h1>
<h2>${location.name} — ${r.pv} kWp | ${r.batt} kWh Battery | ${r.diesel} kW ${dm.fuelType}</h2>
<div class="meta">
${pi.client?`<div>Client: <span>${pi.client}</span></div>`:''}
${pi.engineer?`<div>Prepared by: <span>${pi.engineer}</span></div>`:''}
<div>Date: <span>${pi.date}</span></div><div>Revision: <span>${pi.revision}</span></div>
</div></div>
<div class="content">
<h2>1. Executive Summary</h2>
<div class="grid4">
<div class="card"><div class="v">${fmtN(r.pv)} kWp</div><div class="l">Solar PV</div></div>
<div class="card"><div class="v">${fmtN(r.batt)} kWh</div><div class="l">Battery</div></div>
<div class="card"><div class="v">${fmtN(r.diesel)} kW</div><div class="l">${dm.fuelType} Generator</div></div>
<div class="card"><div class="v">${r.payback} yr</div><div class="l">Payback</div></div>
</div>
<div class="hl"><div style="font-size:24px;font-weight:700;color:#059669">${fmtK(r.npv)} NPV Savings over ${finance.projectLife} Years</div>
<p style="color:#065f46;margin-top:6px">Annual savings: <strong>${fmtK(r.savings)}</strong> · CO₂ reduction: <strong>${fmtN(r.co2S)} t/yr</strong></p></div>
<h2>2. System Design</h2>
<table><tr><th>Component</th><th>Specification</th></tr>
<tr><td>Solar PV</td><td>${fmtN(r.pv)} kWp DC / ${fmtN(r.pvInverter)} kW AC · ${pt.name} · ${tr.name}</td></tr>
<tr><td>Battery</td><td>${fmtN(r.batt)} kWh / ${fmtN(r.pow)} kW · ${bt.name} · DoD ${bt.dod*100}%</td></tr>
<tr><td>Thermal Generation</td><td>${fmtN(r.diesel)} kW · ${dm.name} · SFC ${r.sfcEff} ${dm.fuelUnit}/kWh</td></tr>
<tr><td>Service Interval</td><td>${dm.serviceInterval.toLocaleString()} hr minor · ${dm.overhaulInterval.toLocaleString()} hr overhaul</td></tr>
<tr><td>Performance Ratio</td><td>${r.effectivePR}%</td></tr></table>
<h2>3. Financial</h2>
<table><tr><th></th><th>Hybrid</th><th>Thermal Only</th></tr>
<tr><td>CAPEX</td><td>${fmtK(r.hCap)}</td><td>${fmtK(r.dCap2)}</td></tr>
<tr><td>Avg OPEX/yr</td><td>${fmtK(r.hOpex)}</td><td>${fmtK(r.dOpex)}</td></tr>
<tr><td>LCOE</td><td>$${r.lcoeH}/kWh</td><td>$${r.lcoeD}/kWh</td></tr>
<tr><td>NPV / Payback</td><td colspan="2">${fmtK(r.npv)} · ${r.payback} years</td></tr></table>
<h2>4. Environmental</h2>
<table><tr><th>Metric</th><th>Value</th></tr>
<tr><td>CO₂ Thermal Only</td><td>${fmtN(r.co2D)} t/yr</td></tr>
<tr><td>CO₂ Hybrid</td><td>${fmtN(r.co2H)} t/yr</td></tr>
<tr><td>CO₂ Reduction</td><td>${fmtN(r.co2S)} t/yr</td></tr>
<tr><td>Fuel Saved</td><td>${fmtN(r.dieselOnlyFuelAnn-r.dieselFuelAnn)} ${dm.fuelUnit}/yr (${Math.round((1-r.dieselFuelAnn/r.dieselOnlyFuelAnn)*100)}%)</td></tr></table>
<div class="disc">Preliminary feasibility estimate only. Generated ${new Date().toLocaleDateString('en-AU',{year:'numeric',month:'long',day:'numeric'})} | Rev ${pi.revision}</div>
</div></body></html>`;
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([html],{type:'text/html'}));
    a.download=pi.name.replace(/[^a-zA-Z0-9]/g,'_')+'_Rev'+pi.revision+'.html'; a.click();
    showToast('📄 Report downloaded');
  };

  const r=results;
  const tS=(id)=>({padding:'9px 18px',borderRadius:6,border:'none',cursor:'pointer',fontSize:13,fontWeight:500,background:tab===id?'#059669':'#1e293b',color:tab===id?'#fff':'#94a3b8',marginRight:4});
  const stS=(id)=>({padding:'6px 14px',borderRadius:6,border:'none',cursor:'pointer',fontSize:12,fontWeight:500,background:subTab===id?'#334155':'transparent',color:subTab===id?'#f1f5f9':'#64748b',marginRight:4});
  const peakL=loads.length?Math.max(...loads.map(l=>l*loadScale)):1;
  const currentThermal = THERMAL_MODELS[thermalModel];

  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(145deg,#0b1120,#0f1a2e 40%,#0a1628)',color:'#e2e8f0',fontFamily:'system-ui,sans-serif'}}>

      {isCalculating&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.92)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{textAlign:'center'}}>
            <div style={{width:64,height:64,border:'8px solid #059669',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite',margin:'0 auto'}}/>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <p style={{marginTop:24,fontSize:18,color:'#34d399',fontWeight:600}}>Running {finance.projectLife}-year simulation…</p>
            <p style={{color:'#64748b',marginTop:8}}>Please wait</p>
          </div>
        </div>
      )}
      {toast&&<div style={{position:'fixed',top:16,right:16,zIndex:300,background:'#065f46',color:'#fff',padding:'12px 20px',borderRadius:12,fontSize:14,fontWeight:500,boxShadow:'0 8px 32px rgba(0,0,0,0.4)'}}>{toast}</div>}

      <div style={{maxWidth:1200,margin:'0 auto',padding:'24px 16px'}}>
        {/* Header */}
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:24}}>
          <div>
            <h1 style={{fontSize:26,fontWeight:700,background:'linear-gradient(90deg,#34d399,#22d3ee)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',marginBottom:4}}>⚡ Hybrid Power System Sizing</h1>
            <p style={{color:'#475569',fontSize:12}}>v2.1 · Solar · Battery · Thermal Generation · Remote Australia</p>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {r&&<button onClick={generateReport} style={{display:'flex',alignItems:'center',gap:6,padding:'9px 14px',background:'#059669',border:'none',borderRadius:8,color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}><Download size={14}/>Export</button>}
            <button onClick={saveProject} style={{display:'flex',alignItems:'center',gap:6,padding:'9px 12px',background:'#1e293b',border:'1px solid #334155',borderRadius:8,color:'#94a3b8',cursor:'pointer',fontSize:12}}><Save size={13}/>Save</button>
            <button onClick={shareLink} style={{display:'flex',alignItems:'center',gap:6,padding:'9px 12px',background:'#1e293b',border:'1px solid #334155',borderRadius:8,color:'#94a3b8',cursor:'pointer',fontSize:12}}><Share2 size={13}/>Share</button>
          </div>
        </div>

        {warnings.length>0&&(
          <div style={{background:'rgba(251,191,36,.1)',border:'1px solid rgba(251,191,36,.4)',borderRadius:8,padding:'10px 14px',marginBottom:16}}>
            {warnings.map((w,i)=><div key={i} style={{display:'flex',gap:8,alignItems:'center',fontSize:13,color:'#fbbf24',marginBottom:i<warnings.length-1?4:0}}><AlertTriangle size={13}/>{w}</div>)}
          </div>
        )}

        {/* Main tabs */}
        <div style={{display:'flex',gap:4,marginBottom:20}}>
          <button style={tS('config')} onClick={()=>setTab('config')}><Settings size={13} style={{verticalAlign:'middle',marginRight:4}}/>Configuration</button>
          <button style={tS('results')} onClick={()=>{if(r)setTab('results');}}><BarChart3 size={13} style={{verticalAlign:'middle',marginRight:4}}/>Results{!r&&' (calc first)'}</button>
        </div>

        {/* ═══ CONFIG ═══ */}
        {tab==='config'&&(
          <div>
            <Collapsible title="Project Information" icon={<FileText size={15} style={{color:'#64748b'}}/>}>
              <div style={g(3)}>
                {[['Project Name','name'],['Client','client'],['Reference','reference'],['Engineer','engineer']].map(([l,k])=>(
                  <div key={k}><label style={{fontSize:11,color:'#94a3b8',display:'block',marginBottom:3}}>{l}</label><input value={projectInfo[k]} onChange={e=>setProjectInfo({...projectInfo,[k]:e.target.value})} style={inp}/></div>
                ))}
                <div><label style={{fontSize:11,color:'#94a3b8',display:'block',marginBottom:3}}>Date</label><input type="date" value={projectInfo.date} onChange={e=>setProjectInfo({...projectInfo,date:e.target.value})} style={inp}/></div>
                <div><label style={{fontSize:11,color:'#94a3b8',display:'block',marginBottom:3}}>Revision</label><input value={projectInfo.revision} onChange={e=>setProjectInfo({...projectInfo,revision:e.target.value})} style={inp}/></div>
              </div>
            </Collapsible>

            <Collapsible title="Site Location" icon={<Sun size={15} style={{color:'#f59e0b'}}/>} defaultOpen>
              <div style={g(4)}>
                <div style={{gridColumn:'span 2'}}>
                  <label style={{fontSize:11,color:'#94a3b8',display:'block',marginBottom:3}}>Preset Location</label>
                  <select value={LOCATIONS.findIndex(l=>l.name===location.name)} onChange={e=>setLocation({...LOCATIONS[+e.target.value]})} style={sel}>
                    {LOCATIONS.map((l,i)=><option key={i} value={i}>{l.name} ({l.lat.toFixed(1)}°)</option>)}
                  </select>
                </div>
                <IF label="Latitude" value={location.lat} onChange={e=>setLocation({...location,lat:parseFloat(e.target.value)||0})}/>
                <IF label="Longitude" value={location.lon} onChange={e=>setLocation({...location,lon:parseFloat(e.target.value)||0})}/>
              </div>
              <div style={{background:'#0f172a',borderRadius:8,padding:'12px 16px',marginTop:10}}>
                <div style={{fontSize:11,color:'#64748b',marginBottom:8}}>Monthly Peak Sun Hours</div>
                <div style={{display:'flex',gap:3,alignItems:'flex-end',height:56}}>
                  {Array.from({length:12},(_,i)=>{const v=getSolar(i,location.lat);return(
                    <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                      <div style={{fontSize:9,color:'#f59e0b',fontWeight:600}}>{v.toFixed(1)}</div>
                      <div style={{width:'100%',background:'linear-gradient(to top,#f59e0b,#fbbf24)',borderRadius:2,height:(v/8*36)+'px'}}/>
                      <div style={{fontSize:9,color:'#64748b'}}>{'JFMAMJJASOND'[i]}</div>
                    </div>
                  );})}
                </div>
              </div>
            </Collapsible>

            <Collapsible title="Load Profile" icon={<Zap size={15} style={{color:'#10b981'}}/>} defaultOpen>
              <div style={{marginBottom:10}}>
                {Object.entries(LOAD_PATTERNS).map(([k,v])=><button key={k} onClick={()=>setPattern(k)} style={btnStyle(false)}>{v.label}</button>)}
              </div>
              <div style={{display:'flex',gap:8,marginBottom:12}}>
                <button onClick={downloadTemplate} style={{display:'flex',alignItems:'center',gap:5,padding:'6px 10px',background:'#1e293b',border:'1px solid #334155',borderRadius:6,color:'#94a3b8',cursor:'pointer',fontSize:12}}><Download size={12}/>CSV Template</button>
                <label style={{display:'flex',alignItems:'center',gap:5,padding:'6px 10px',background:'#1e293b',border:'1px solid #334155',borderRadius:6,color:'#94a3b8',cursor:'pointer',fontSize:12}}>
                  <Upload size={12}/>Upload CSV<input type="file" accept=".csv" onChange={handleCSV} style={{display:'none'}}/>
                </label>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
                <span style={{fontSize:12,color:'#94a3b8',whiteSpace:'nowrap'}}>Scale:</span>
                <input type="range" min="0.1" max="5" step="0.1" value={loadScale} onChange={e=>setLoadScale(parseFloat(e.target.value))} style={{flex:1,accentColor:'#10b981'}}/>
                <span style={{fontFamily:'monospace',color:'#10b981',fontWeight:700,width:36}}>{loadScale}×</span>
              </div>
              <div style={{background:'#0f172a',borderRadius:8,padding:12,marginBottom:10,position:'relative',height:150,overflow:'hidden'}}>
                <svg width="100%" height="100%" viewBox={`0 0 ${loads.length*20} 120`} preserveAspectRatio="none" style={{position:'absolute',top:0,left:0}}>
                  <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity="0.4"/><stop offset="100%" stopColor="#10b981" stopOpacity="0.05"/></linearGradient></defs>
                  <path d={'M 0 120 '+loads.map((v,i)=>`L ${i*20} ${120-v*loadScale/peakL*100}`).join(' ')+` L ${(loads.length-1)*20} 120 Z`} fill="url(#lg)"/>
                  <polyline points={loads.map((v,i)=>`${i*20},${120-v*loadScale/peakL*100}`).join(' ')} fill="none" stroke="#10b981" strokeWidth="2"/>
                </svg>
                <div style={{position:'absolute',top:8,left:12,fontSize:11,color:'#64748b'}}>Peak: {Math.round(peakL)} kW · Avg: {Math.round(loads.reduce((a,b)=>a+b,0)/24*loadScale)} kW</div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(12,1fr)',gap:3}}>
                {loads.map((l,i)=><div key={i} style={{textAlign:'center'}}>
                  <div style={{fontSize:9,color:'#64748b',marginBottom:1}}>{i}h</div>
                  <input type="number" value={Math.round(l*loadScale)} onChange={e=>{const n=[...loads];n[i]=Math.max(0,(parseFloat(e.target.value)||0)/loadScale);setLoads(n);}} style={{width:'100%',background:'#1e293b',border:'1px solid #334155',borderRadius:4,color:'#e2e8f0',padding:'3px 1px',fontSize:10,textAlign:'center'}}/>
                </div>)}
              </div>
            </Collapsible>

            <Collapsible title={`Renewable Target: ${renewable}%`} icon={<Leaf size={15} style={{color:'#22c55e'}}/>} defaultOpen>
              <input type="range" min="0" max="100" value={renewable} onChange={e=>setRenewable(+e.target.value)} style={{width:'100%',accentColor:'#22c55e',marginBottom:6}}/>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#475569'}}><span>0% Thermal Only</span><span>50% Hybrid</span><span>100% Solar+Battery</span></div>
            </Collapsible>

            <Collapsible title="Solar PV Technology" icon={<Sun size={15} style={{color:'#f59e0b'}}/>}>
              <div style={g(2)}>
                <div><label style={{fontSize:11,color:'#94a3b8',display:'block',marginBottom:3}}>PV Technology</label>
                  <select value={pvType} onChange={e=>setPvType(+e.target.value)} style={sel}>{PV_TYPES.map((t,i)=><option key={i} value={i}>{t.name} ({(t.efficiency*100).toFixed(0)}% eff)</option>)}</select></div>
                <div><label style={{fontSize:11,color:'#94a3b8',display:'block',marginBottom:3}}>Tracking</label>
                  <select value={tracking} onChange={e=>setTracking(+e.target.value)} style={sel}>{TRACKING.map((t,i)=><option key={i} value={i}>{t.name} (×{t.factor})</option>)}</select></div>
              </div>
              <div style={g(4)}>
                <IF label="Performance Ratio" value={adv.pr} onChange={e=>setAdv({...adv,pr:parseFloat(e.target.value)||0.82})} step="0.01" hint="Typical 0.75-0.85 for remote"/>
                <IF label="Soiling Loss" value={adv.soiling} onChange={e=>setAdv({...adv,soiling:+e.target.value})} unit="%" hint="Remote sites typically 3-8%"/>
                <IF label="Mismatch Loss" value={adv.mismatch} onChange={e=>setAdv({...adv,mismatch:+e.target.value})} unit="%"/>
                <IF label="Inverter Eff" value={adv.inverterEff} onChange={e=>setAdv({...adv,inverterEff:+e.target.value})} unit="%" step="0.5"/>
                <IF label="DC:AC Ratio" value={adv.dcacRatio} onChange={e=>setAdv({...adv,dcacRatio:+e.target.value})} step="0.05" hint="1.2-1.4 typical"/>
                <IF label="Min PV (kWp)" value={adv.minPV} onChange={e=>setAdv({...adv,minPV:+e.target.value})}/>
                <IF label="Max PV (kWp)" value={adv.maxPV} onChange={e=>setAdv({...adv,maxPV:+e.target.value})}/>
              </div>
            </Collapsible>

            <Collapsible title="Battery Storage" icon={<Battery size={15} style={{color:'#3b82f6'}}/>}>
              <div style={g(2)}>
                <div><label style={{fontSize:11,color:'#94a3b8',display:'block',marginBottom:3}}>Battery Type</label>
                  <select value={battType} onChange={e=>setBattType(+e.target.value)} style={sel}>{BATTERY_TYPES.map((t,i)=><option key={i} value={i}>{t.name}</option>)}</select></div>
                <div><label style={{fontSize:11,color:'#94a3b8',display:'block',marginBottom:3}}>Charge Source</label>
                  <select value={adv.battChargeSrc} onChange={e=>setAdv({...adv,battChargeSrc:e.target.value})} style={sel}><option value="both">Solar + Thermal</option><option value="pv">Solar Only</option><option value="diesel">Thermal Only</option></select></div>
              </div>
              <div style={g(4)}>
                <IF label="Storage Hours" value={adv.hours} onChange={e=>setAdv({...adv,hours:+e.target.value})} unit="hr" hint="Hours of average load (2-8 typical)"/>
                <IF label="C-Rate" value={adv.crate} onChange={e=>setAdv({...adv,crate:+e.target.value})} hint="Power/energy ratio (0.25-1.0)"/>
                <IF label="Replacement Year" value={adv.battReplacementYear} onChange={e=>setAdv({...adv,battReplacementYear:+e.target.value})} hint="LFP typically ~12-15yr"/>
                <IF label="Thermal-Free Days" value={adv.renewDays} onChange={e=>setAdv({...adv,renewDays:+e.target.value})} hint="Consecutive thermal-free days target"/>
              </div>
            </Collapsible>

            {/* ═══ THERMAL GENERATION — expanded ═══ */}
            <Collapsible title="Thermal Generation" icon={<Fuel size={15} style={{color:'#ef4444'}}/>} defaultOpen>

              {/* Generator type selector */}
              <div style={{marginBottom:12}}>
                <label style={{fontSize:11,color:'#94a3b8',display:'block',marginBottom:4}}>
                  Generator Type
                  <TooltipHint text="Select from diesel, gas, dual-fuel, LPG, HFO, and biodiesel models. SFC and service data are pre-populated from manufacturer benchmarks."/>
                </label>
                <select value={thermalModel} onChange={e=>setThermalModel(+e.target.value)} style={{...sel, fontSize:12}}>
                  {THERMAL_MODELS.map((m,i)=>(
                    <option key={i} value={i}>{m.name} — {m.fuelType} · {m.sfcBase} {m.fuelUnit}/kWh @ rated</option>
                  ))}
                </select>
              </div>

              {/* Fuel type badge */}
              <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
                {[
                  ['Fuel', currentThermal.fuelType],
                  ['Rated SFC', `${currentThermal.sfcBase} ${currentThermal.fuelUnit}/kWh`],
                  ['50% SFC', `${currentThermal.sfcMid} ${currentThermal.fuelUnit}/kWh`],
                  ['30% SFC', `${currentThermal.sfcPart} ${currentThermal.fuelUnit}/kWh`],
                  ['CO₂ Factor', `${currentThermal.co2Factor} kg/${currentThermal.fuelUnit}`],
                ].map(([k,v])=>(
                  <div key={k} style={{background:'#0f172a',borderRadius:6,padding:'6px 10px',border:'1px solid #334155'}}>
                    <div style={{fontSize:9,color:'#64748b'}}>{k}</div>
                    <div style={{fontSize:12,fontWeight:600,color:'#e2e8f0'}}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Part-load curve */}
              <PartLoadCurve model={currentThermal}/>

              {/* Service summary */}
              <ServiceSummary model={currentThermal}/>

              {/* Sizing options */}
              <div style={{borderTop:'1px solid #334155',marginTop:14,paddingTop:12}}>
                <div style={g(2)}>
                  <div style={{display:'flex',alignItems:'center'}}>
                    <label style={{fontSize:12,color:'#94a3b8',display:'flex',alignItems:'center',gap:6,cursor:'pointer'}}>
                      <input type="checkbox" checked={adv.autoSize} onChange={e=>setAdv({...adv,autoSize:e.target.checked})} style={{accentColor:'#10b981'}}/>Auto-size to peak load ×1.2
                    </label>
                  </div>
                </div>
                {!adv.autoSize&&<div style={{...g(3),marginTop:10}}><IF label="Unit Size (kW)" value={adv.dieselSize} onChange={e=>setAdv({...adv,dieselSize:+e.target.value})}/><IF label="Quantity" value={adv.dieselQty} onChange={e=>setAdv({...adv,dieselQty:+e.target.value})} min="1"/></div>}
                <div style={{...g(3),marginTop:10}}>
                  <IF label="Min Load Factor" value={adv.dieselMinLoad} onChange={e=>setAdv({...adv,dieselMinLoad:+e.target.value})} unit="%" hint="Minimum before shutdown — typically 25-35%. Gas sets can run lower."/>
                  <IF label="Spinning Reserve" value={adv.spinningResvPct} onChange={e=>setAdv({...adv,spinningResvPct:+e.target.value})} unit="%" hint="Additional headroom above peak load"/>
                </div>
              </div>

              {/* Override SFC */}
              <div style={{borderTop:'1px solid #334155',marginTop:12,paddingTop:12}}>
                <div style={{fontSize:11,color:'#64748b',marginBottom:8}}>Manual SFC Override (leave 0 to use model defaults)</div>
                <div style={g(3)}>
                  <IF label={`SFC at Rated (${currentThermal.fuelUnit}/kWh)`} value={0} onChange={()=>{}} hint="Override rated-load SFC. Set 0 to use model default." step="0.001"/>
                  <IF label={`SFC at 60% (${currentThermal.fuelUnit}/kWh)`} value={0} onChange={()=>{}} hint="Override mid-load SFC." step="0.001"/>
                  <IF label={`SFC at 30% (${currentThermal.fuelUnit}/kWh)`} value={0} onChange={()=>{}} hint="Override part-load SFC." step="0.001"/>
                </div>
              </div>
            </Collapsible>

            <Collapsible title="Capital & Operating Costs" icon={<DollarSign size={15} style={{color:'#22c55e'}}/>}>
              <div style={g(4)}>
                <IF label="PV ($/kWp)" value={costs.pv} onChange={e=>setCosts({...costs,pv:+e.target.value})} hint="Remote WA: $1000-1400/kWp"/>
                <IF label="Battery ($/kWh)" value={costs.batt} onChange={e=>setCosts({...costs,batt:+e.target.value})} hint="LFP installed: $700-1000/kWh"/>
                <IF label="Generator ($/kW)" value={costs.diesel} onChange={e=>setCosts({...costs,diesel:+e.target.value})}/>
                <IF label={`Fuel (${currentThermal.fuelUnit==='m³'?'$/m³':'$/L'})`} value={costs.fuel} onChange={e=>setCosts({...costs,fuel:+e.target.value})} hint="Remote diesel: $1.80-3.00/L · Gas: $0.40-0.80/m³"/>
                <IF label="BOS %" value={costs.bos} onChange={e=>setCosts({...costs,bos:+e.target.value})} unit="% of PV+Batt"/>
                <IF label="EPC %" value={costs.epc} onChange={e=>setCosts({...costs,epc:+e.target.value})} unit="% of all"/>
                <IF label="Land ($)" value={costs.land} onChange={e=>setCosts({...costs,land:+e.target.value})}/>
              </div>
              <div style={{borderTop:'1px solid #334155',paddingTop:10,marginTop:6}}>
                <div style={{fontSize:12,color:'#64748b',marginBottom:8}}>Annual OPEX</div>
                <div style={g(4)}>
                  <IF label="PV O&M ($/kWp/yr)" value={opex.pvOM} onChange={e=>setOpex({...opex,pvOM:+e.target.value})}/>
                  <IF label="Batt O&M ($/kWh/yr)" value={opex.battOM} onChange={e=>setOpex({...opex,battOM:+e.target.value})}/>
                  <IF label="Insurance %" value={opex.insurance} onChange={e=>setOpex({...opex,insurance:+e.target.value})} unit="% CAPEX/yr"/>
                  <IF label="Site Mgmt ($/mo)" value={opex.siteManagement} onChange={e=>setOpex({...opex,siteManagement:+e.target.value})}/>
                  <IF label="Remote Monitor ($/mo)" value={opex.remoteMonitoring} onChange={e=>setOpex({...opex,remoteMonitoring:+e.target.value})}/>
                  <IF label="Spares ($/mo)" value={opex.spares} onChange={e=>setOpex({...opex,spares:+e.target.value})}/>
                </div>
                <label style={{fontSize:12,color:'#94a3b8',display:'flex',alignItems:'center',gap:6,cursor:'pointer',marginTop:6}}>
                  <input type="checkbox" checked={opex.dieselOMauto} onChange={e=>setOpex({...opex,dieselOMauto:e.target.checked})} style={{accentColor:'#10b981'}}/>Auto thermal O&M from generator class ({currentThermal.maintCost} $/kW/yr)
                </label>
                {!opex.dieselOMauto&&<div style={{marginTop:8}}><IF label="Manual Thermal O&M ($/kW/yr)" value={opex.dieselOM} onChange={e=>setOpex({...opex,dieselOM:+e.target.value})}/></div>}
              </div>
            </Collapsible>

            <Collapsible title="Financial Parameters" icon={<TrendingUp size={15} style={{color:'#a78bfa'}}/>}>
              <div style={g(4)}>
                <IF label="Discount Rate" value={finance.discount} onChange={e=>setFinance({...finance,discount:+e.target.value})} unit="%" hint="Real WACC, typically 6-12%"/>
                <IF label="Fuel Escalation" value={finance.fuelEsc} onChange={e=>setFinance({...finance,fuelEsc:+e.target.value})} unit="% p.a."/>
                <IF label="Inflation" value={finance.inflationRate} onChange={e=>setFinance({...finance,inflationRate:+e.target.value})} unit="% p.a."/>
                <IF label="Project Life" value={finance.projectLife} onChange={e=>setFinance({...finance,projectLife:+e.target.value})} unit="years"/>
              </div>
            </Collapsible>

            <button onClick={calc} style={{width:'100%',background:'linear-gradient(90deg,#059669,#0284c7)',border:'none',borderRadius:10,color:'#fff',padding:'16px',fontSize:17,fontWeight:700,cursor:'pointer',marginTop:8,letterSpacing:1}}>
              ⚡ CALCULATE SYSTEM
            </button>
          </div>
        )}

        {/* ═══ RESULTS ═══ */}
        {tab==='results'&&r&&(
          <div>
            <div style={{display:'flex',gap:4,marginBottom:16,flexWrap:'wrap'}}>
              {['overview','energy','operations','financial','sensitivity','environmental'].map(id=>(
                <button key={id} style={stS(id)} onClick={()=>setSubTab(id)}>{id.charAt(0).toUpperCase()+id.slice(1)}</button>
              ))}
            </div>

            {/* OVERVIEW */}
            {subTab==='overview'&&(
              <div>
                <div style={{...g(4),marginBottom:14}}>
                  <Stat label="Solar PV Array" value={`${fmtN(r.pv)} kWp`} sub={`${fmtN(r.pvInverter)} kW AC inverter`} color="#f59e0b"/>
                  <Stat label="Battery Storage" value={`${fmtN(r.batt)} kWh`} sub={`${fmtN(r.pow)} kW power`} color="#3b82f6"/>
                  <Stat label="Thermal Backup" value={`${fmtN(r.diesel)} kW`} sub={`${r.thermalFuelType} · LF ${r.lf}%`} color="#ef4444"/>
                  <Stat label="Renewable Fraction" value={`${renewable}%`} sub={`${fmtN(r.renew)} kWh/yr`} color="#10b981"/>
                </div>
                <div style={{...g(4),marginBottom:14}}>
                  <Stat label="Total CAPEX" value={fmtK(r.hCap)} sub={`vs ${fmtK(r.dCap2)} thermal-only`} color="#a78bfa"/>
                  <Stat label="NPV Savings" value={fmtK(r.npv)} sub={`over ${finance.projectLife} years`} color="#22c55e"/>
                  <Stat label="Simple Payback" value={`${r.payback} yr`} color="#22d3ee"/>
                  <Stat label="LCOE Hybrid" value={`$${r.lcoeH}/kWh`} sub={`vs $${r.lcoeD}/kWh thermal`} color="#fb923c"/>
                </div>
                <div style={g(2)}>
                  <div style={{background:'#1e293b',borderRadius:10,padding:16,border:'1px solid #334155'}}>
                    <div style={{fontSize:13,fontWeight:600,marginBottom:12,color:'#94a3b8'}}>CAPEX Breakdown</div>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart><Pie data={r.capexBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                        {r.capexBreakdown.map((d,i)=><Cell key={i} fill={d.fill}/>)}
                      </Pie><Tooltip formatter={v=>'$'+fmtN(v)} contentStyle={ttStyle}/></PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{background:'#1e293b',borderRadius:10,padding:16,border:'1px solid #334155'}}>
                    <div style={{fontSize:13,fontWeight:600,marginBottom:10,color:'#94a3b8'}}>Key Metrics</div>
                    <table style={{width:'100%',fontSize:13,borderCollapse:'collapse'}}>
                      {[['Avg Load',fmtN(r.avg)+' kW'],['Peak Load',fmtN(r.peak)+' kW'],['Annual Energy',fmtN(r.annual)+' kWh'],['Load Factor',r.loadFactor+'%'],['PV/Load Ratio',r.pvToLoad+'×'],['PV Cap Factor',r.pvCF+'%'],['Effective PR',r.effectivePR+'%'],['Thermal SFC',r.sfcEff+' '+r.thermalFuelUnit+'/kWh'],['Annual Fuel',fmtN(r.dieselFuelAnn)+' '+r.thermalFuelUnit],['Thermal-Only Fuel',fmtN(r.dieselOnlyFuelAnn)+' '+r.thermalFuelUnit]].map(([k,v],i)=>(
                        <tr key={i} style={{borderBottom:'1px solid #334155'}}>
                          <td style={{padding:'5px 0',color:'#94a3b8'}}>{k}</td>
                          <td style={{padding:'5px 0',textAlign:'right',color:'#e2e8f0',fontWeight:500}}>{v}</td>
                        </tr>
                      ))}
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ENERGY */}
            {subTab==='energy'&&(
              <div>
                <div style={{background:'#1e293b',borderRadius:10,padding:16,border:'1px solid #334155',marginBottom:14}}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:12,color:'#94a3b8'}}>Monthly Energy Production</div>
                  <ResponsiveContainer width="100%" height={260}><BarChart data={r.mon}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
                    <XAxis dataKey="month" tick={{fill:'#94a3b8',fontSize:12}}/>
                    <YAxis tickFormatter={v=>Math.round(v/1000)+'MWh'} tick={{fill:'#94a3b8',fontSize:11}}/>
                    <Tooltip formatter={(v,n)=>[fmtN(v)+' kWh',n]} contentStyle={ttStyle}/><Legend/>
                    <Bar dataKey="solar" name="Solar" fill={C.solar} stackId="a"/>
                    <Bar dataKey="diesel" name="Thermal" fill={C.diesel} stackId="a" radius={[3,3,0,0]}/>
                  </BarChart></ResponsiveContainer>
                </div>
                <div style={{background:'#1e293b',borderRadius:10,padding:16,border:'1px solid #334155',marginBottom:14}}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:12,color:'#94a3b8'}}>Monthly Renewable %</div>
                  <ResponsiveContainer width="100%" height={160}><AreaChart data={r.mon}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
                    <XAxis dataKey="month" tick={{fill:'#94a3b8',fontSize:12}}/>
                    <YAxis unit="%" domain={[0,100]} tick={{fill:'#94a3b8',fontSize:11}}/>
                    <Tooltip contentStyle={ttStyle}/>
                    <Area dataKey="renewFraction" name="RE%" fill="#10b98133" stroke="#10b981" strokeWidth={2}/>
                  </AreaChart></ResponsiveContainer>
                </div>
                <div style={{background:'#1e293b',borderRadius:10,padding:16,border:'1px solid #334155'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                    <div style={{fontSize:13,fontWeight:600,color:'#94a3b8'}}>Seasonal Dispatch</div>
                    <div>{r.seasons.map((s,i)=><button key={i} onClick={()=>setActiveSeason(i)} style={btnStyle(activeSeason===i)}>{s.name}</button>)}</div>
                  </div>
                  {r.seasons[activeSeason]&&(<>
                    <div style={{display:'flex',gap:16,marginBottom:10,flexWrap:'wrap'}}>
                      <span style={{fontSize:12,color:C.solar}}>☀ {fmtN(r.seasons[activeSeason].totalSolar)} kWh</span>
                      <span style={{fontSize:12,color:C.diesel}}>⚙ {fmtN(r.seasons[activeSeason].totalDiesel)} kWh</span>
                      <span style={{fontSize:12,color:'#10b981'}}>RE {r.seasons[activeSeason].renewFraction}%</span>
                      <span style={{fontSize:12,color:'#8b5cf6'}}>Curtailed {fmtN(r.seasons[activeSeason].totalCurtailed)} kWh</span>
                    </div>
                    <ResponsiveContainer width="100%" height={230}><ComposedChart data={r.seasons[activeSeason].data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
                      <XAxis dataKey="hour" tickFormatter={h=>h+'h'} tick={{fill:'#94a3b8',fontSize:11}}/>
                      <YAxis tick={{fill:'#94a3b8',fontSize:11}}/>
                      <Tooltip contentStyle={ttStyle}/><Legend/>
                      <Bar dataKey="solar" name="Solar" fill={C.solar} stackId="a"/>
                      <Bar dataKey="battDischarge" name="Battery" fill={C.battery} stackId="a"/>
                      <Bar dataKey="diesel" name="Thermal" fill={C.diesel} stackId="a"/>
                      <Bar dataKey="curtailed" name="Curtailed" fill="#8b5cf6" stackId="a"/>
                      <Line dataKey="load" name="Load" stroke="#10b981" strokeWidth={2} dot={false}/>
                      <Line dataKey="soc" name="SOC%" stroke="#22d3ee" strokeWidth={1.5} dot={false} strokeDasharray="5 3"/>
                    </ComposedChart></ResponsiveContainer>
                  </>)}
                </div>
              </div>
            )}

            {/* OPERATIONS */}
            {subTab==='operations'&&(
              <div>
                <div style={{...g(4),marginBottom:14}}>
                  <Stat label="Thermal Run Hours" value={fmtN(r.dieselRunHrs)+' hr'} color="#ef4444"/>
                  <Stat label={`Annual Fuel (Hybrid)`} value={fmtN(r.dieselFuelAnn)+' '+r.thermalFuelUnit} color="#ef4444"/>
                  <Stat label={`Annual Fuel (Thermal Only)`} value={fmtN(r.dieselOnlyFuelAnn)+' '+r.thermalFuelUnit} color="#ef4444"/>
                  <Stat label="Fuel Saved" value={fmtN(r.dieselOnlyFuelAnn-r.dieselFuelAnn)+' '+r.thermalFuelUnit} sub={Math.round((1-r.dieselFuelAnn/r.dieselOnlyFuelAnn)*100)+'% reduction'} color="#10b981"/>
                </div>
                <div style={{background:'#1e293b',borderRadius:10,padding:16,border:'1px solid #334155',marginBottom:14}}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:12,color:'#94a3b8'}}>Monthly Fuel Consumption ({r.thermalFuelUnit})</div>
                  <ResponsiveContainer width="100%" height={210}><BarChart data={r.mon}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
                    <XAxis dataKey="month" tick={{fill:'#94a3b8',fontSize:12}}/>
                    <YAxis tick={{fill:'#94a3b8',fontSize:11}}/>
                    <Tooltip contentStyle={ttStyle}/><Bar dataKey="fuelLitres" name={`Fuel (${r.thermalFuelUnit})`} fill="#ef4444" radius={[4,4,0,0]}/>
                  </BarChart></ResponsiveContainer>
                </div>
                <div style={{background:'#1e293b',borderRadius:10,padding:16,border:'1px solid #334155'}}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:12,color:'#94a3b8'}}>Monthly Fuel Cost ($)</div>
                  <ResponsiveContainer width="100%" height={190}><BarChart data={r.mon}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
                    <XAxis dataKey="month" tick={{fill:'#94a3b8',fontSize:12}}/>
                    <YAxis tickFormatter={v=>'$'+Math.round(v/1000)+'K'} tick={{fill:'#94a3b8',fontSize:11}}/>
                    <Tooltip formatter={v=>['$'+fmtN(v),'Fuel Cost']} contentStyle={ttStyle}/>
                    <Bar dataKey="fuelCost" name="Fuel Cost" fill="#f97316" radius={[4,4,0,0]}/>
                  </BarChart></ResponsiveContainer>
                </div>
              </div>
            )}

            {/* FINANCIAL */}
            {subTab==='financial'&&(
              <div>
                <div style={{...g(4),marginBottom:14}}>
                  <Stat label="Hybrid CAPEX" value={fmtK(r.hCap)} color="#a78bfa"/>
                  <Stat label="Avg Annual OPEX" value={fmtK(r.hOpex)} color="#a78bfa"/>
                  <Stat label="Annual Savings" value={fmtK(r.savings)} color="#22c55e"/>
                  <Stat label="NPV Benefit" value={fmtK(r.npv)} color="#22c55e"/>
                </div>
                <div style={{background:'#1e293b',borderRadius:10,padding:16,border:'1px solid #334155',marginBottom:14}}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:12,color:'#94a3b8'}}>Cumulative Cash Flow</div>
                  <ResponsiveContainer width="100%" height={270}><ComposedChart data={r.cf}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
                    <XAxis dataKey="year" tick={{fill:'#94a3b8',fontSize:11}}/>
                    <YAxis tickFormatter={v=>fmtK(v)} tick={{fill:'#94a3b8',fontSize:11}}/>
                    <Tooltip formatter={(v,n)=>[fmtK(v),n]} contentStyle={ttStyle}/><Legend/>
                    <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 2"/>
                    <Area dataKey="hybridCumulative" name="Hybrid" fill="#a78bfa22" stroke="#a78bfa" strokeWidth={2}/>
                    <Area dataKey="dieselCumulative" name="Thermal Only" fill="#ef444422" stroke="#ef4444" strokeWidth={2}/>
                    <Line dataKey="savings" name="Cumulative Savings" stroke="#22c55e" strokeWidth={2} dot={false}/>
                  </ComposedChart></ResponsiveContainer>
                </div>
                <div style={{background:'#1e293b',borderRadius:10,padding:16,border:'1px solid #334155'}}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:10,color:'#94a3b8'}}>Year 1 OPEX Detail</div>
                  <table style={{width:'100%',fontSize:13,borderCollapse:'collapse'}}>
                    <thead><tr style={{borderBottom:'1px solid #475569'}}>
                      <th style={{textAlign:'left',padding:'6px 0',color:'#64748b',fontWeight:600}}>Item</th>
                      <th style={{textAlign:'right',padding:'6px 0',color:'#64748b',fontWeight:600}}>Hybrid</th>
                      <th style={{textAlign:'right',padding:'6px 0',color:'#64748b',fontWeight:600}}>Thermal Only</th>
                    </tr></thead>
                    <tbody>
                      {[['PV O&M',fmtK(r.y1pvOM),'—'],['Battery O&M',fmtK(r.y1bOM),'—'],['Thermal O&M',fmtK(r.y1dOM),fmtK(r.y1DM)],['Fuel',fmtK(r.y1Fuel),fmtK(r.y1DF)],['Insurance',fmtK(r.y1Ins),fmtK(r.y1DI)],['Site/Fixed',fmtK(r.y1Site),'—']].map(([k,h,d],i)=>(
                        <tr key={i} style={{borderBottom:'1px solid #1e293b'}}>
                          <td style={{padding:'5px 0',color:'#94a3b8'}}>{k}</td>
                          <td style={{padding:'5px 0',textAlign:'right',color:'#e2e8f0'}}>{h}</td>
                          <td style={{padding:'5px 0',textAlign:'right',color:'#94a3b8'}}>{d}</td>
                        </tr>
                      ))}
                      <tr style={{borderTop:'1px solid #475569',fontWeight:700}}>
                        <td style={{padding:'7px 0',color:'#e2e8f0'}}>Total Year 1 OPEX</td>
                        <td style={{padding:'7px 0',textAlign:'right',color:'#22c55e'}}>{fmtK(r.y1HO)}</td>
                        <td style={{padding:'7px 0',textAlign:'right',color:'#ef4444'}}>{fmtK(r.y1DO)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SENSITIVITY */}
            {subTab==='sensitivity'&&(
              <div>
                <div style={{background:'#1e293b',borderRadius:10,padding:16,border:'1px solid #334155',marginBottom:14}}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:12,color:'#94a3b8'}}>Fuel Price Sensitivity</div>
                  <ResponsiveContainer width="100%" height={230}><ComposedChart data={r.sensFuel}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
                    <XAxis dataKey="fuelPrice" tick={{fill:'#94a3b8',fontSize:12}}/>
                    <YAxis yAxisId="l" tick={{fill:'#94a3b8',fontSize:11}}/>
                    <YAxis yAxisId="r" orientation="right" tickFormatter={v=>'$'+v+'K'} tick={{fill:'#94a3b8',fontSize:11}}/>
                    <Tooltip contentStyle={ttStyle}/><Legend/>
                    <Line yAxisId="l" dataKey="hybridLCOE" name="Hybrid LCOE" stroke="#22c55e" strokeWidth={2} dot/>
                    <Line yAxisId="l" dataKey="dieselLCOE" name="Thermal LCOE" stroke="#ef4444" strokeWidth={2} dot/>
                    <Bar yAxisId="r" dataKey="savings" name="Savings ($K)" fill="#a78bfa44" stroke="#a78bfa"/>
                  </ComposedChart></ResponsiveContainer>
                </div>
                <div style={{background:'#1e293b',borderRadius:10,padding:16,border:'1px solid #334155'}}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:12,color:'#94a3b8'}}>Renewable % Sensitivity</div>
                  <ResponsiveContainer width="100%" height={210}><ComposedChart data={r.sensRenew}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
                    <XAxis dataKey="renewPct" tick={{fill:'#94a3b8',fontSize:12}}/>
                    <YAxis yAxisId="s" tick={{fill:'#94a3b8',fontSize:11}}/>
                    <YAxis yAxisId="c" orientation="right" tickFormatter={v=>'$'+v+'K'} tick={{fill:'#94a3b8',fontSize:11}}/>
                    <Tooltip contentStyle={ttStyle}/><Legend/>
                    <Bar yAxisId="s" dataKey="pvSize" name="PV (kWp)" fill={C.solar+'88'} stroke={C.solar}/>
                    <Bar yAxisId="s" dataKey="battSize" name="Battery (kWh)" fill={C.battery+'88'} stroke={C.battery}/>
                    <Line yAxisId="c" dataKey="capex" name="CAPEX ($K)" stroke="#a78bfa" strokeWidth={2} dot/>
                  </ComposedChart></ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ENVIRONMENTAL */}
            {subTab==='environmental'&&(
              <div>
                <div style={{...g(4),marginBottom:14}}>
                  <Stat label="CO₂ Thermal Only" value={fmtN(r.co2D)+' t/yr'} color="#ef4444"/>
                  <Stat label="CO₂ Hybrid" value={fmtN(r.co2H)+' t/yr'} color="#fb923c"/>
                  <Stat label="CO₂ Reduction" value={fmtN(r.co2S)+' t/yr'} color="#22c55e"/>
                  <Stat label="Tree Equivalent" value={fmtN(r.treesEquiv)+' trees'} sub="per year" color="#22c55e"/>
                </div>
                <div style={{background:'#1e293b',borderRadius:10,padding:16,border:'1px solid #334155',marginBottom:14}}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:12,color:'#94a3b8'}}>Monthly CO₂ Comparison</div>
                  <ResponsiveContainer width="100%" height={210}><BarChart data={r.mon.map(m=>({month:m.month,thermalOnly:Math.round(m.load*0.0027*0.245),hybrid:Math.round(m.fuelLitres*2.7/1000)}))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
                    <XAxis dataKey="month" tick={{fill:'#94a3b8',fontSize:12}}/>
                    <YAxis tick={{fill:'#94a3b8',fontSize:11}} label={{value:'tCO₂',angle:-90,position:'insideLeft',fill:'#94a3b8',fontSize:11}}/>
                    <Tooltip contentStyle={ttStyle}/><Legend/>
                    <Bar dataKey="thermalOnly" name="Thermal Only" fill="#ef4444" radius={[3,3,0,0]}/>
                    <Bar dataKey="hybrid" name="Hybrid" fill="#10b981" radius={[3,3,0,0]}/>
                  </BarChart></ResponsiveContainer>
                </div>
                <div style={{background:'linear-gradient(135deg,#064e3b,#065f46)',borderRadius:10,padding:20,border:'1px solid #059669'}}>
                  <div style={{fontSize:16,fontWeight:700,color:'#34d399',marginBottom:12}}>🌿 Lifetime Environmental Impact</div>
                  <div style={g(3)}>
                    <div><div style={{fontSize:22,fontWeight:700,color:'#34d399'}}>{fmtN(r.co2S*finance.projectLife)} t</div><div style={{fontSize:12,color:'#6ee7b7'}}>CO₂ avoided over {finance.projectLife} years</div></div>
                    <div><div style={{fontSize:22,fontWeight:700,color:'#34d399'}}>{fmtN((r.dieselOnlyFuelAnn-r.dieselFuelAnn)*finance.projectLife)} {r.thermalFuelUnit}</div><div style={{fontSize:12,color:'#6ee7b7'}}>Fuel saved over {finance.projectLife} years</div></div>
                    <div><div style={{fontSize:22,fontWeight:700,color:'#34d399'}}>{fmtN(r.treesEquiv*finance.projectLife)}</div><div style={{fontSize:12,color:'#6ee7b7'}}>Tree-equivalent offset</div></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab==='results'&&!r&&(
          <div style={{textAlign:'center',padding:'80px 0',color:'#475569'}}>
            <Settings size={48} style={{opacity:0.3,margin:'0 auto 16px',display:'block'}}/>
            <p style={{fontSize:16}}>Configure your system and click <strong style={{color:'#34d399'}}>Calculate System</strong> to see results.</p>
          </div>
        )}
      </div>
    </div>
  );
}
