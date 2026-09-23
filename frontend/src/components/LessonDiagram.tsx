export type DiagramKind = 'network' | 'cluster' | 'matrix' | 'validation' | 'cycle' | 'neural' | 'timeline' | 'flow';

type DiagramStep = { label: string; role?: 'input' | 'process' | 'decision' | 'output' };
type Props = { kind: DiagramKind; steps: DiagramStep[]; active: number; onSelect: (index: number) => void };

const roleColor = { input: '#b79755', process: '#6f8c63', decision: '#bd775f', output: '#47796e' };

function words(label: string, max = 17) {
  const parts = label.split(/\s+/); const lines: string[] = []; let line = '';
  for (const part of parts) {
    if (`${line} ${part}`.trim().length > max && line) { lines.push(line); line = part; }
    else line = `${line} ${part}`.trim();
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function Connector({ x1, y1, x2, y2, dashed = false }: { x1: number; y1: number; x2: number; y2: number; dashed?: boolean }) {
  return <line className="diagram-connector" x1={x1} y1={y1} x2={x2} y2={y2} strokeDasharray={dashed ? '7 7' : undefined} markerEnd="url(#diagram-arrow)"/>;
}

function Node({ x, y, width = 116, height = 68, index, steps, active, onSelect, compact = false }: {
  x: number; y: number; width?: number; height?: number; index: number; steps: DiagramStep[]; active: number;
  onSelect: (index: number) => void; compact?: boolean;
}) {
  const step = steps[Math.min(index, steps.length - 1)];
  if (!step) return null;
  const lines = words(step.label, compact ? 13 : 17);
  const role = step.role || 'process';
  return <g className={`diagram-node-svg ${active === index ? 'active' : ''} ${index < active ? 'visited' : ''}`} role="button" tabIndex={0}
    aria-label={`Step ${index + 1}: ${step.label}`} onClick={() => onSelect(index)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') onSelect(index); }}>
    <rect x={x} y={y} width={width} height={height} rx="13" fill="white" stroke={roleColor[role]}/>
    <circle cx={x + 17} cy={y + 17} r="10" fill={roleColor[role]}/><text className="diagram-step-number" x={x + 17} y={y + 20}>{index + 1}</text>
    <text className="diagram-node-label" x={x + width / 2} y={y + (lines.length === 1 ? 43 : 36)}>
      {lines.map((line, lineIndex) => <tspan key={line} x={x + width / 2} dy={lineIndex ? 14 : 0}>{line}</tspan>)}
    </text>
  </g>;
}

function DiagramDefs() {
  return <defs>
    <marker id="diagram-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 Z" fill="#9bad92"/></marker>
    <linearGradient id="diagram-sea" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#eef4e8"/><stop offset="1" stopColor="#f9f2df"/></linearGradient>
    <filter id="diagram-shadow"><feDropShadow dx="0" dy="5" stdDeviation="6" floodColor="#284c39" floodOpacity=".12"/></filter>
  </defs>;
}

function FlowDiagram(props: Props) {
  const count = props.steps.length; const gap = count > 5 ? 17 : 28; const width = count > 5 ? 116 : 130;
  const total = count * width + (count - 1) * gap; const start = (900 - total) / 2;
  return <>{props.steps.map((_, index) => {
    const x = start + index * (width + gap);
    return <g key={index}>{index < count - 1 && <Connector x1={x + width} y1={160} x2={x + width + gap - 4} y2={160}/>}<Node x={x} y={124} width={width} height={72} index={index} {...props}/></g>;
  })}</>;
}

function CycleDiagram(props: Props) {
  const positions = [[392,8],[690,82],[690,238],[392,304],[94,238],[94,82]];
  return <>
    <circle cx="450" cy="190" r="114" className="diagram-cycle-ring"/>
    <circle cx="450" cy="190" r="61" className="diagram-core"/><text className="diagram-core-title" x="450" y="184">LEARN</text><text className="diagram-core-sub" x="450" y="204">measure · improve</text>
    {props.steps.map((_, index) => { const [x, y] = positions[index % positions.length]; const next = positions[(index + 1) % positions.length]; return <g key={index}><Connector x1={x + 58} y1={y + 34} x2={next[0] + 58} y2={next[1] + 34} dashed={index === props.steps.length - 1}/><Node x={x} y={y} index={index} width={116} height={68} compact {...props}/></g>; })}
  </>;
}

function NetworkDiagram(props: Props) {
  const positions = [[42,126],[188,55],[348,55],[348,205],[518,126],[713,126]];
  return <>
    <rect x="166" y="29" width="520" height="252" rx="26" className="diagram-boundary"/><text x="190" y="51" className="diagram-boundary-label">TRUSTED CLOUD / SYSTEM BOUNDARY</text>
    <rect x="325" y="44" width="164" height="231" rx="19" className="diagram-zone"/><text x="407" y="263" className="diagram-zone-label">POLICY + PROCESSING</text>
    <path d="M100 118 q-23-26-46 0 q-26 1-26 23 q0 22 28 22 h76 q25 0 25-22 q0-21-24-22 q-10-26-33-1z" className="diagram-cloud"/>
    {positions.slice(0, props.steps.length).map(([x,y], index) => <g key={index}>{index < Math.min(props.steps.length, positions.length) - 1 && <Connector x1={x + 116} y1={y + 34} x2={positions[index + 1][0] - 4} y2={positions[index + 1][1] + 34}/>}<Node x={x} y={y} index={index} width={116} height={68} compact {...props}/></g>)}
    <path d="M745 101 h92 l18 18 v91 h-110z" className="diagram-resource"/><path d="M837 101 v19 h18" className="diagram-resource-fold"/>
  </>;
}

function ClusterDiagram(props: Props) {
  const raw = [[78,91],[112,119],[73,151],[133,177],[100,208],[150,135],[62,219],[132,76]];
  const groups = [
    { color:'#b79755', points:[[486,88],[514,109],[474,131],[523,150],[490,170]] },
    { color:'#bd775f', points:[[605,174],[640,190],[586,216],[626,231],[662,210]] },
    { color:'#47796e', points:[[700,71],[741,91],[687,111],[724,134],[758,119]] },
  ];
  return <>
    <g className={props.active <= 1 ? 'diagram-emphasis' : ''} onClick={() => props.onSelect(0)}>{raw.map(([x,y],i)=><circle key={i} cx={x} cy={y} r="8" className="diagram-raw-dot"/>)}<text x="105" y="256" className="diagram-caption">UNLABELLED OBSERVATIONS</text></g>
    <Connector x1={177} y1={160} x2={282} y2={160}/><Node x={286} y={126} index={Math.min(2,props.steps.length-1)} width={134} height={72} {...props}/><Connector x1={420} y1={160} x2={465} y2={160}/>
    <g className={props.active >= 3 ? 'diagram-emphasis' : ''} onClick={() => props.onSelect(Math.min(4,props.steps.length-1))}>{groups.map((group,index)=><g key={index}><ellipse cx={index===0?499:index===1?626:722} cy={index===0?128:index===1?207:105} rx="62" ry="54" fill={group.color} opacity=".08" stroke={group.color} strokeDasharray="5 5"/>{group.points.map(([x,y],i)=><circle key={i} cx={x} cy={y} r="8" fill={group.color}/>)}</g>)}<text x="633" y="278" className="diagram-caption">DISCOVERED STRUCTURE → MEANING</text></g>
  </>;
}

function MatrixDiagram(props: Props) {
  const activeMatrix = props.active >= 2 && props.active <= 3;
  return <>
    <Node x={38} y={126} index={0} width={125} height={72} {...props}/><Connector x1={163} y1={162} x2={225} y2={162}/><Node x={229} y={126} index={1} width={125} height={72} {...props}/><Connector x1={354} y1={162} x2={400} y2={162}/>
    <g className={activeMatrix ? 'diagram-matrix active' : 'diagram-matrix'} onClick={() => props.onSelect(Math.min(2,props.steps.length-1))}>
      <text x="527" y="39" className="diagram-caption">PREDICTED</text><text x="386" y="161" className="diagram-caption" transform="rotate(-90 386 161)">ACTUAL</text>
      <rect x="420" y="55" width="102" height="82" rx="9" className="matrix-good"/><rect x="526" y="55" width="102" height="82" rx="9" className="matrix-risk"/><rect x="420" y="141" width="102" height="82" rx="9" className="matrix-risk"/><rect x="526" y="141" width="102" height="82" rx="9" className="matrix-good"/>
      <text x="471" y="91" className="matrix-code">TP</text><text x="471" y="111" className="matrix-label">right alert</text><text x="577" y="91" className="matrix-code">FP</text><text x="577" y="111" className="matrix-label">false alarm</text><text x="471" y="177" className="matrix-code">FN</text><text x="471" y="197" className="matrix-label">missed case</text><text x="577" y="177" className="matrix-code">TN</text><text x="577" y="197" className="matrix-label">right clear</text>
    </g>
    <Connector x1={630} y1={162} x2={676} y2={162}/><Node x={680} y={75} index={Math.min(4,props.steps.length-1)} width={174} height={68} {...props}/><Node x={680} y={172} index={Math.min(5,props.steps.length-1)} width={174} height={68} {...props}/>
  </>;
}

function ValidationDiagram(props: Props) {
  const round = Math.min(Math.max(props.active - 1, 0), 4);
  return <>
    <Node x={28} y={126} index={0} width={130} height={72} {...props}/><Connector x1={158} y1={162} x2={216} y2={162}/>
    <g onClick={() => props.onSelect(Math.min(2 + round, props.steps.length - 1))}>
      <text x="460" y="56" className="diagram-caption">FIVE ROUNDS — EACH FOLD VALIDATES ONCE</text>
      {[0,1,2,3,4].map(row=><g key={row}>{[0,1,2,3,4].map(col=><rect key={col} x={225+col*84} y={72+row*36} width="75" height="27" rx="5" className={col===row?'fold-valid':'fold-train'}/>) }<text x="666" y={90+row*36} className="fold-label">round {row+1}</text></g>)}
      <text x="225" y="270" className="diagram-caption">GREEN = TRAIN</text><text x="344" y="270" className="diagram-caption coral">CORAL = VALIDATE</text>
    </g><Connector x1={672} y1={162} x2={722} y2={162}/><Node x={726} y={126} index={props.steps.length-1} width={145} height={72} {...props}/>
  </>;
}

function NeuralDiagram(props: Props) {
  const layers: Array<[number, number[]]> = [[154,[90,130,170,210]],[390,[74,112,150,188,226]],[626,[110,160,210]]];
  const layerSteps = [0,Math.min(2,props.steps.length-1),Math.min(4,props.steps.length-1)];
  return <>
    {layers.slice(0,-1).map(([,ys],li)=>ys.flatMap((y,i)=>layers[li+1][1].map((ny,j)=><line key={`${li}-${i}-${j}`} x1={layers[li][0]} y1={y} x2={layers[li+1][0]} y2={ny} className="neural-link"/>)))}
    {layers.map(([x,ys],li)=><g key={x} className={props.active >= layerSteps[li] ? 'neural-layer active' : 'neural-layer'} onClick={()=>props.onSelect(layerSteps[li])}>{ys.map((y,i)=><circle key={i} cx={x} cy={y} r="14"/>)}<text x={x} y="267" className="diagram-caption">{['INPUT FEATURES','LEARNED REPRESENTATION','OUTPUT'][li]}</text></g>)}
    <path d="M650 241 C790 282 800 54 655 73" className="diagram-feedback" markerEnd="url(#diagram-arrow)"/><text x="762" y="160" className="diagram-caption" transform="rotate(-90 762 160)">LOSS FEEDBACK</text>
    <Node x={785} y={126} index={props.steps.length-1} width={94} height={72} compact {...props}/>
  </>;
}

function TimelineDiagram(props: Props) {
  const points = [[52,211],[130,183],[207,199],[285,135],[363,156],[441,94],[519,121],[597,73],[675,105],[753,55],[836,74]];
  return <>
    <line x1="45" y1="241" x2="856" y2="241" className="timeline-axis"/><line x1="45" y1="42" x2="45" y2="241" className="timeline-axis"/>
    <polyline points={points.slice(0,7).map(p=>p.join(',')).join(' ')} className="timeline-history"/><polyline points={points.slice(6).map(p=>p.join(',')).join(' ')} className="timeline-forecast"/>
    {points.map(([x,y],i)=><circle key={i} cx={x} cy={y} r={i===6?8:5} className={i<=6?'history-dot':'forecast-dot'}/>) }
    <line x1="519" y1="42" x2="519" y2="241" className="timeline-now"/><text x="519" y="263" className="diagram-caption">NOW</text><text x="249" y="288" className="diagram-caption">HISTORICAL PATTERN</text><text x="695" y="288" className="diagram-caption coral">FORECAST + UNCERTAINTY</text>
    <g className="timeline-hotspots"><circle cx="130" cy="183" r="25" onClick={()=>props.onSelect(0)}/><circle cx="441" cy="94" r="25" onClick={()=>props.onSelect(Math.min(2,props.steps.length-1))}/><circle cx="753" cy="55" r="25" onClick={()=>props.onSelect(props.steps.length-1)}/></g>
  </>;
}

export function LessonDiagram(props: Props) {
  const height = props.kind === 'cycle' ? 380 : 320;
  return <div className="concept-diagram">
    <svg viewBox={`0 0 900 ${height}`} role="img" aria-label="Interactive lesson diagram" preserveAspectRatio="xMidYMid meet">
      <DiagramDefs/>
      <rect x="1" y="1" width="898" height={height - 2} rx="18" fill="url(#diagram-sea)" className="diagram-canvas"/>
      {props.kind === 'network' ? <NetworkDiagram {...props}/> : props.kind === 'cluster' ? <ClusterDiagram {...props}/> : props.kind === 'matrix' ? <MatrixDiagram {...props}/> : props.kind === 'validation' ? <ValidationDiagram {...props}/> : props.kind === 'cycle' ? <CycleDiagram {...props}/> : props.kind === 'neural' ? <NeuralDiagram {...props}/> : props.kind === 'timeline' ? <TimelineDiagram {...props}/> : <FlowDiagram {...props}/>} 
    </svg>
    <div className="diagram-legend"><span><i className="input"/>Input</span><span><i className="process"/>Process</span><span><i className="decision"/>Decision</span><span><i className="output"/>Outcome</span><small>Click any shape to explain it</small></div>
  </div>;
}
