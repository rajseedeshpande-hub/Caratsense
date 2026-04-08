import React, { useEffect, useRef, useState } from 'react';
import './index.css';

// ── Gem SVG mark ──────────────────────────────────────────────
const GemMark = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className="gem-icon-svg">
    <polygon points="16,2 28,10 28,22 16,30 4,22 4,10" fill="none" stroke="#D4AF37" strokeWidth="1.5" />
    <polygon points="16,2 28,10 16,14 4,10" fill="rgba(212,175,55,0.18)" stroke="#D4AF37" strokeWidth="0.75" />
    <polygon points="16,14 28,10 28,22 16,30" fill="rgba(212,175,55,0.08)" stroke="#D4AF37" strokeWidth="0.75" />
    <polygon points="16,14 4,10 4,22 16,30" fill="rgba(212,175,55,0.12)" stroke="#D4AF37" strokeWidth="0.75" />
    <line x1="16" y1="2" x2="16" y2="14" stroke="#D4AF37" strokeWidth="0.5" strokeDasharray="2,2" />
  </svg>
);

const BASE_ICONS = [
  "n8n", "python", "openai", "supabase", "claude", "databricks", "zendesk",
  "gmail", "amazonaws", "salesforce", "quickbooks", "slack", "robotframework",
  "googlesheets", "jira", "elasticsearch", "react", "nodedotjs", "docker",
  "kubernetes", "postgresql", "redis", "mongodb", "stripe", "github", "googlecloud"
];
// Allow repetitions: explicitly add popular ones or just duplicate the array
const ICONS = [
  ...BASE_ICONS,
  "openai", "salesforce", "python", "slack", "postgresql", "react", "github", "docker"
];

const TechEcosystemBg = () => {
  const nodeRefs = useRef([]);
  const stateRef = useRef({ mouse: { x: -9999, y: -9999 }, raf: null });

  useEffect(() => {
    // Initialize node state separate from react state for speed
    // We add a unique ref id to handle duplicated tech IDs in physics mapping
    // Grid-based initial placement so nodes start evenly spread
    const cols = Math.ceil(Math.sqrt(ICONS.length * (window.innerWidth / window.innerHeight)));
    const rows = Math.ceil(ICONS.length / cols);
    const cellW = window.innerWidth / cols;
    const cellH = window.innerHeight / rows;
    let nodes = ICONS.map((id, index) => ({
      id,
      refId: `${id}_${index}`,
      x: (index % cols) * cellW + cellW * 0.2 + Math.random() * cellW * 0.6,
      y: Math.floor(index / cols) * cellH + cellH * 0.2 + Math.random() * cellH * 0.6,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
    }));

    const init = () => {}; // Placeholder if you still want a resize listener logic
    window.addEventListener('resize', init);

    const onMouse = e => { stateRef.current.mouse = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('mousemove', onMouse);

    const draw = () => {
      const W = window.innerWidth, H = window.innerHeight;
      const { mouse } = stateRef.current;

      const svgEl = window.__ACTIVE_WORKFLOW_SVG_ID ? document.getElementById(window.__ACTIVE_WORKFLOW_SVG_ID) : null;
      let structuredMode = false;
      let targetMap = {};
      // rect/scale exposed so locked nodes can recompute position every frame
      let svgRect = null, scaleX = 1, scaleY = 1;

      if (svgEl) {
        svgRect = svgEl.getBoundingClientRect();
        scaleX = svgRect.width / 1000;
        scaleY = svgRect.height / 340;
        // Trigger convergence as soon as workflow comes into view
        if (svgRect.top < H * 0.9) {
          stateRef.current.hasTriggeredWorkflow = true;
        }
        // Only release when user scrolls fully back to the very top
        if (svgRect.top > H * 1.1) {
          stateRef.current.hasTriggeredWorkflow = false;
        }
        if (stateRef.current.hasTriggeredWorkflow) {
          structuredMode = true;
          const activeNodes = window.__ACTIVE_SCENARIO_NODES || [];
          activeNodes.forEach(sn => {
            const tId = sn.iconUrl.split('/').pop().replace('.svg', '');
            targetMap[tId] = {
              // Screen coords for this frame (used during approach lerp)
              x: svgRect.left + sn.x * scaleX,
              y: svgRect.top + sn.y * scaleY - 3,
              // SVG-space coords stored so locked nodes recompute from rect every frame
              svgX: sn.x,
              svgY: sn.y,
              label: sn.label,
              assigned: false
            };
          });
        }
      }

      nodes.forEach((n, i) => {
         let target = null;
         if (structuredMode && targetMap[n.id] && !targetMap[n.id].assigned) {
             target = targetMap[n.id];
             targetMap[n.id].assigned = true;
         }

         // If node is locked to a slot, recompute its position directly from the
         // current SVG rect every frame — moves perfectly with the workflow on scroll.
         // If svgRect is temporarily null (e.g. carousel transition), freeze in place.
         if (n.locked) {
             if (svgRect) {
               n.x = svgRect.left + n.targetSvgX * scaleX;
               n.y = svgRect.top  + n.targetSvgY * scaleY - 3;
             }
             // Always zero velocity — never let a locked node drift
             n.vx = 0;
             n.vy = 0;
         } else if (structuredMode && target) {
             const el = nodeRefs.current[i];
             const dx = target.x - n.x;
             const dy = target.y - n.y;
             const dist = Math.sqrt(dx * dx + dy * dy);

             if (dist < 6) {
                 // Lock: store SVG-space offset so future frames derive position from rect
                 n.locked = true;
                 n.targetSvgX = target.svgX;
                 n.targetSvgY = target.svgY;
                 n.x = target.x;
                 n.y = target.y;
                 n.vx = 0;
                 n.vy = 0;
                 if (el) {
                   // Kill CSS transitions while locked — prevents width/shape animation on scroll
                   el.style.transition = 'none';
                   if (!el.classList.contains('structured')) {
                     const lbl = el.querySelector('.tech-node-label');
                     if (lbl) lbl.textContent = target.label;
                     el.classList.remove('floating');
                     el.classList.add('structured');
                   }
                 }
             } else {
                 // Fast lerp approach — no velocity accumulation, no overshoot
                 const LERP = 0.22;
                 n.x += dx * LERP;
                 n.y += dy * LERP;
                 n.vx = 0;
                 n.vy = 0;
             }
         } else {
           // Normal Brownian floating for ALL unassigned nodes regardless of structuredMode
           n.vx += (Math.random() - 0.5) * 0.04;
           n.vy += (Math.random() - 0.5) * 0.04;

           // Node-to-node repulsion — keeps nodes from overlapping or clustering
           const MIN_DIST = 140;
           nodes.forEach((other, j) => {
             if (j === i) return;
             const rdx = n.x - other.x;
             const rdy = n.y - other.y;
             const rd = Math.sqrt(rdx * rdx + rdy * rdy);
             if (rd < MIN_DIST && rd > 0) {
               const rf = (1 - rd / MIN_DIST) * 0.6;
               n.vx += (rdx / rd) * rf;
               n.vy += (rdy / rd) * rf;
             }
           });

           // Cursor repel
           const mdx = n.x - mouse.x;
           const mdy = n.y - mouse.y;
           const md = Math.sqrt(mdx*mdx + mdy*mdy);
           if (md < 250 && md > 0) {
             const f = Math.pow(1 - md/250, 1.5) * 2.0;
             n.vx += (mdx/md) * f;
             n.vy += (mdy/md) * f;
           }

           const WALL = 40;
           if (n.x < WALL) n.vx += (WALL - n.x) * 0.02;
           if (n.x > W - WALL) n.vx -= (n.x - (W - WALL)) * 0.02;
           if (n.y < WALL) n.vy += (WALL - n.y) * 0.02;
           if (n.y > H - WALL) n.vy -= (n.y - (H - WALL)) * 0.02;

           const spd = Math.sqrt(n.vx*n.vx + n.vy*n.vy);
           if (spd > 1.5) { n.vx = (n.vx/spd)*1.5; n.vy = (n.vy/spd)*1.5; }
           n.vx *= 0.98; n.vy *= 0.98;
         }
         
         n.x += n.vx;
         n.y += n.vy;
         
         // Direct DOM mutation for absolute scale performance
         const el = nodeRefs.current[i];
         if (el) {
           el.style.transform = `translate3d(${n.x}px, ${n.y}px, 0) translate(-50%, -50%)`;
           
           if (!structuredMode && el.classList.contains('structured')) {
             n.locked = false;
             // Restore transitions before animating back to floating circle
             el.style.transition = '';
             el.classList.add('floating');
             el.classList.remove('structured');
           }
           
           // Opacity handling
           const currentOpStr = el.style.opacity || "1";
           let targetOp = 1;
           // The user specifically requested unassigned nodes to vanish after you scroll past the hero
           // to keep the rest of the website layout completely clean!
           if (structuredMode && !target) {
               targetOp = 0.0;
           } else if (!structuredMode) {
               // When at the top / hero, let them float visibly!
               targetOp = 0.8;
           }
           const newOp = parseFloat(currentOpStr) * 0.9 + targetOp * 0.1;
           el.style.opacity = newOp.toFixed(3);
         }
      });

      // Raise ecosystem above page-content when converging into workflow,
      // drop back behind it when floating freely in the hero
      const bgEl = document.getElementById('ecosystem-bg');
      if (bgEl) {
        bgEl.style.zIndex = structuredMode ? '2' : '0';
      }

      stateRef.current.raf = requestAnimationFrame(draw);
    };

    stateRef.current.raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(stateRef.current.raf);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('resize', init);
    };
  }, []);

  return (
    <div id="ecosystem-bg" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>
      {/* Hardware-accelerated DOM layer for independent flying icon nodes */}
      {ICONS.map((id, i) => (
        <div key={`${id}_${i}`} ref={el => nodeRefs.current[i] = el} className="tech-node floating" style={{ opacity: 0 }}>
          <div className="tech-node-icon">
            <img className="tech-node-logo" src={`https://cdn.jsdelivr.net/npm/simple-icons@11.4.0/icons/${id}.svg`} alt="" />
          </div>
          <div className="tech-node-label"></div>
        </div>
      ))}
    </div>
  );
};

// ── Starfield ──────────────────────────────────────────────────
const Starfield = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.2 + 0.2,
      alpha: Math.random() * 0.6 + 0.1,
      flicker: Math.random() * Math.PI * 2,
      flickerSpeed: Math.random() * 0.02 + 0.005,
    }));

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach(s => {
        s.flicker += s.flickerSpeed;
        const alpha = s.alpha * (0.7 + 0.3 * Math.sin(s.flicker));
        ctx.beginPath();
        ctx.arc(s.x * canvas.width, s.y * canvas.height, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fill();
      });
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="particles-canvas starfield" />;
};

// ── Neural Network Canvas ──────────────────────────────────────
// An interactive, multi-layer neural network that pulses with the
// cursor. Nodes activate on hover; signals propagate layer-by-layer.
const NeuralNetworkCanvas = () => {
  const canvasRef = useRef(null);
  const stateRef  = useRef({ mouse: { x: -9999, y: -9999 }, raf: null });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // ── Network architecture: [input, h1, h2, h3, output] ──────
    const ARCH         = [6, 9, 9, 7, 3];
    const NODE_R       = 7;
    const PAD_X        = 100;  // left/right padding
    const PAD_Y        = 48;   // top/bottom padding

    // Per-layer colors [r,g,b]
    const LAYER_COL = [
      [212, 175,  55],  // gold  — Input
      [160, 120, 230],  // purple
      [ 80, 150, 230],  // blue
      [ 40, 200, 190],  // teal
      [  0, 229, 180],  // mint  — Output
    ];

    let nodes = [];
    let edges = [];
    let nextSpike = Date.now() + 400;

    // ── Build node + edge arrays ──────────────────────────────
    const build = () => {
      const W = canvas.width  = canvas.offsetWidth;
      const H = canvas.height = canvas.offsetHeight;
      nodes = []; edges = [];

      const layerX = ARCH.map((_, li) =>
        PAD_X + (li / (ARCH.length - 1)) * (W - PAD_X * 2));

      ARCH.forEach((count, li) => {
        const x = layerX[li];
        for (let ni = 0; ni < count; ni++) {
          const y = count === 1
            ? H / 2
            : PAD_Y + (ni / (count - 1)) * (H - PAD_Y * 2);
          nodes.push({ x, y, layer: li, activity: 0, glow: 0 });
        }
      });

      // Full connections between adjacent layers
      for (let li = 0; li < ARCH.length - 1; li++) {
        const from = nodes.filter(n => n.layer === li);
        const to   = nodes.filter(n => n.layer === li + 1);
        from.forEach(f => to.forEach(t =>
          edges.push({ from: f, to: t, pulses: [] })
        ));
      }
    };

    build();

    const onResize = () => build();
    window.addEventListener('resize', onResize);

    // ── Mouse tracking (relative to canvas) ──────────────────
    const onMouse = e => {
      const r = canvas.getBoundingClientRect();
      stateRef.current.mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    window.addEventListener('mousemove', onMouse);

    // ── Trigger a node: set activity + spawn pulses ───────────
    const fire = (node, strength = 1) => {
      node.activity = Math.min(1, node.activity + strength);
      node.glow     = Math.min(1, node.glow     + strength);
      edges
        .filter(e => e.from === node)
        .forEach(e => e.pulses.push({
          t: 0,
          speed: 0.007 + Math.random() * 0.007,
          col: LAYER_COL[node.layer],
          str: strength,
        }));
    };

    // ── Main draw loop ─────────────────────────────────────────
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const { mouse } = stateRef.current;
      const now = Date.now();

      // Random input spike to keep animation alive
      if (now > nextSpike) {
        const inputs = nodes.filter(n => n.layer === 0);
        fire(inputs[Math.floor(Math.random() * inputs.length)],
             0.6 + Math.random() * 0.4);
        nextSpike = now + 500 + Math.random() * 700;
      }

      // Cursor proximity on input + first hidden layer
      nodes.forEach(n => {
        if (n.layer > 1) return;
        const dx = n.x - mouse.x, dy = n.y - mouse.y;
        const d  = Math.sqrt(dx*dx + dy*dy);
        if (d < 90) {
          const s = (1 - d / 90) * 0.35;
          n.activity = Math.min(1, n.activity + s);
          n.glow     = Math.min(1, n.glow     + s * 0.9);
          if (Math.random() < 0.07) fire(n, s * 2.5);
        }
      });

      // Decay node states
      nodes.forEach(n => { n.activity *= 0.91; n.glow *= 0.87; });

      // ── Draw edges + advance pulses ─────────────────────────
      edges.forEach(({ from, to, pulses }) => {
        const act = Math.max(from.activity, to.activity);

        // Edge line
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x,   to.y);
        ctx.strokeStyle = `rgba(100,140,200,${0.06 + act * 0.16})`;
        ctx.lineWidth   = 0.7 + act * 1.2;
        ctx.stroke();

        // Pulses
        for (let i = pulses.length - 1; i >= 0; i--) {
          const p = pulses[i];
          p.t += p.speed;

          if (p.t >= 1) {
            // Arrived — activate destination
            to.activity = Math.min(1, to.activity + p.str * 0.6);
            to.glow     = Math.min(1, to.glow     + p.str * 0.75);
            // Propagate to next layer (probabilistic)
            if (to.layer < ARCH.length - 1) {
              edges
                .filter(e => e.from === to && Math.random() < 0.65)
                .forEach(e => e.pulses.push({
                  t: 0,
                  speed: 0.006 + Math.random() * 0.008,
                  col: LAYER_COL[to.layer],
                  str: p.str * 0.78,
                }));
            }
            pulses.splice(i, 1);
            continue;
          }

          // Draw pulse glow orb
          const px = from.x + (to.x - from.x) * p.t;
          const py = from.y + (to.y - from.y) * p.t;
          const [r, g, b] = p.col;
          const alpha = Math.sin(p.t * Math.PI) * p.str;

          const g1 = ctx.createRadialGradient(px, py, 0, px, py, 14);
          g1.addColorStop(0, `rgba(${r},${g},${b},${alpha * 0.85})`);
          g1.addColorStop(1, `rgba(${r},${g},${b},0)`);
          ctx.beginPath(); ctx.arc(px, py, 14, 0, Math.PI * 2);
          ctx.fillStyle = g1; ctx.fill();

          ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(1, alpha * 2.2)})`;
          ctx.fill();
        }
      });

      // ── Draw nodes ─────────────────────────────────────────
      nodes.forEach(n => {
        const [r, g, b] = LAYER_COL[n.layer];
        const { activity: act, glow } = n;

        // Outer glow
        if (glow > 0.04) {
          const gr = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, NODE_R * 5 + glow * 22);
          gr.addColorStop(0, `rgba(${r},${g},${b},${glow * 0.45})`);
          gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
          ctx.beginPath(); ctx.arc(n.x, n.y, NODE_R * 5 + glow * 22, 0, Math.PI * 2);
          ctx.fillStyle = gr; ctx.fill();
        }

        // Node body gradient
        const nb = ctx.createRadialGradient(n.x - 2, n.y - 2, 1, n.x, n.y, NODE_R);
        nb.addColorStop(0, `rgba(${r},${g},${b},${0.35 + act * 0.65})`);
        nb.addColorStop(1, `rgba(${r},${g},${b},${0.08 + act * 0.25})`);
        ctx.beginPath(); ctx.arc(n.x, n.y, NODE_R, 0, Math.PI * 2);
        ctx.fillStyle = nb; ctx.fill();

        // Ring
        ctx.beginPath(); ctx.arc(n.x, n.y, NODE_R, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${r},${g},${b},${0.3 + act * 0.65})`;
        ctx.lineWidth   = 1 + act * 1.5;
        ctx.stroke();
      });

      stateRef.current.raf = requestAnimationFrame(draw);
    };

    // Only animate when the canvas is on screen
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        if (!stateRef.current.raf) draw();
      } else {
        cancelAnimationFrame(stateRef.current.raf);
        stateRef.current.raf = null;
      }
    }, { threshold: 0.05 });
    obs.observe(canvas);
    draw();

    return () => {
      cancelAnimationFrame(stateRef.current.raf);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('resize', onResize);
      obs.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
};

// ── Mock UI Components (Interactive) ──────────────────────────


const GEM_ITEMS = [
  {
    icon: '💎', name: 'Round Brilliant', sub: '1.42ct · VVS1 · D', val: '$14,200',
    color: '#e8f0fe',
    detail: {
      cert: 'GIA 2206543210',
      cut: 'Excellent',
      polish: 'Excellent',
      symmetry: 'Excellent',
      fluorescence: 'None',
      confidence: 98.4,
      comps: [{ label: 'Antwerp ↗', price: '$13,900' }, { label: 'NY Exchange ↗', price: '$14,600' }],
    },
  },
  {
    icon: '🔷', name: 'Sapphire Cabochon', sub: '3.10ct · Blue · Kashmir', val: '$8,750',
    color: '#e8eaff',
    detail: {
      cert: 'GRS 2025-088412',
      origin: 'Kashmir, India',
      treatment: 'No Heat',
      transparency: 'Translucent',
      fluorescence: 'Inert',
      confidence: 94.1,
      comps: [{ label: 'HK Exchange ↗', price: '$8,200' }, { label: "Sotheby's ↗", price: '$9,100' }],
    },
  },
  {
    icon: '🔴', name: 'Ruby Oval Cut', sub: '2.04ct · Vivid Red · Burma', val: '$22,100',
    color: '#fce8e8',
    detail: {
      cert: 'GIA 5282019034',
      origin: 'Mogok, Myanmar',
      treatment: 'Heat (minor)',
      saturation: 'Vivid',
      fluorescence: 'Strong Red',
      confidence: 96.7,
      comps: [{ label: "Christie's ↗", price: '$21,500' }, { label: 'Antwerp ↗', price: '$22,800' }],
    },
  },
];

const EstimationUI = () => {
  const [active, setActive] = useState(null);

  return (
    <div className="mock-ui" style={{ gap: 10, overflow: 'auto' }}>
      <div className="mock-scan-bar" />
      <div className="mock-header">
        <span className="mock-title">AI Analysis</span>
        <span className="mock-badge">Live</span>
      </div>

      {GEM_ITEMS.map((item, i) => (
        <div key={i}>
          <div
            className="mock-item"
            onClick={() => setActive(active === i ? null : i)}
            style={{
              cursor: 'pointer',
              border: active === i ? '1.5px solid #D4AF37' : undefined,
              background: active === i ? 'rgba(212,175,55,0.07)' : undefined,
              transition: 'all 0.2s',
            }}
          >
            <div className="mock-gem-icon" style={{ background: item.color }}>
              <span style={{ fontSize: 18 }}>{item.icon}</span>
            </div>
            <div className="mock-item-info">
              <div className="mock-item-name">{item.name}</div>
              <div className="mock-item-sub">{item.sub}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="mock-item-val">{item.val}</div>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                style={{ transform: active === i ? 'rotate(180deg)' : 'none', transition: '0.2s', opacity: 0.4 }}>
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          {/* Expanded detail panel */}
          {active === i && (
            <div style={{
              background: 'rgba(212,175,55,0.05)',
              border: '1px solid rgba(212,175,55,0.2)',
              borderTop: 'none',
              borderRadius: '0 0 12px 12px',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              animation: 'slide-down 0.2s ease',
            }}>
              {/* Confidence bar */}
              <div style={{ marginBottom: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 10, color: '#9aa0a6', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>AI Confidence</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#D4AF37' }}>{item.detail.confidence}%</span>
                </div>
                <div style={{ height: 4, background: 'rgba(0,0,0,0.08)', borderRadius: 99 }}>
                  <div style={{ height: '100%', width: `${item.detail.confidence}%`, background: '#D4AF37', borderRadius: 99, transition: 'width 0.5s ease' }} />
                </div>
              </div>
              {/* Spec grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
                {Object.entries(item.detail)
                  .filter(([k]) => !['confidence', 'comps'].includes(k))
                  .map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 3, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                      <span style={{ fontSize: 10, color: '#9aa0a6', textTransform: 'capitalize', fontWeight: 500 }}>{k}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: '#0d0d0d', textAlign: 'right' }}>{v}</span>
                    </div>
                  ))}
              </div>
              {/* Market comps */}
              <div>
                <div style={{ fontSize: 10, color: '#9aa0a6', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>Market Comps</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {item.detail.comps.map((c, j) => (
                    <div key={j} style={{ flex: 1, background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 8, padding: '6px 10px' }}>
                      <div style={{ fontSize: 9, color: '#9aa0a6', marginBottom: 2 }}>{c.label}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0d0d0d' }}>{c.price}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const BREAKDOWN_ITEMS = [
  { label: 'Stone Value', val: '$14,200', note: 'D/VVS1 · 1.42ct · Round Brilliant', gold: true },
  { label: 'Setting', val: '$1,830', note: 'Platinum 950 · 4-prong solitaire', gold: false },
  { label: 'Labor', val: '$420', note: 'Hand-set · Polished finish', gold: false },
  { label: 'Market Index', val: '↑ 4.2%', note: 'vs 30-day avg · Antwerp benchmark', gold: true },
];

const BreakdownUI = () => {
  const [hovered, setHovered] = useState(null);
  const [chartHovered, setChartHovered] = useState(null);
  const bars = [40, 55, 35, 60, 45, 70, 55, 80, 65, 90, 75, 100];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="mock-ui dark">
      <div className="mock-header">
        <span className="mock-title light">Itemized Breakdown</span>
        <span className="mock-badge">Certified</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {BREAKDOWN_ITEMS.map((s, i) => (
          <div
            key={i}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: hovered === i ? 'rgba(212,175,55,0.1)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${hovered === i ? 'rgba(212,175,55,0.3)' : 'rgba(255,255,255,0.07)'}`,
              borderRadius: 10,
              padding: '10px 14px',
              cursor: 'default',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 500, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
              {hovered === i
                ? <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>{s.note}</div>
                : null
              }
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: s.gold ? '#D4AF37' : '#fff', whiteSpace: 'nowrap' }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Chart with hover tooltip */}
      <div style={{ marginTop: 'auto', paddingTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div className="mock-stat-label">30-day Price Trend</div>
          {chartHovered !== null && (
            <span style={{ fontSize: 10, fontWeight: 600, color: '#D4AF37' }}>
              {months[chartHovered]}: ${(9000 + bars[chartHovered] * 55).toLocaleString()}
            </span>
          )}
        </div>
        <div className="mock-chart" style={{ position: 'relative' }}>
          {bars.map((h, i) => (
            <div
              key={i}
              onMouseEnter={() => setChartHovered(i)}
              onMouseLeave={() => setChartHovered(null)}
              className={`mock-bar dark${i >= 9 ? ' active' : ''}`}
              style={{
                height: `${h}%`,
                background: chartHovered === i ? '#fff' : (i >= 9 ? '#D4AF37' : 'rgba(255,255,255,0.12)'),
                cursor: 'crosshair',
                transform: chartHovered === i ? 'scaleY(1.08)' : 'none',
                transformOrigin: 'bottom',
                transition: 'all 0.1s',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const MARKET_ROWS = [
  {
    label: 'D/VVS1 1ct Round', bid: '$9,200', ask: '$9,800', delta: '+2.1%', up: true,
    detail: { exchange: 'Antwerp Diamond Bourse', volume: '234 trades/day', spread: '$600', lastSale: '$9,480', change7d: '+4.8%' }
  },
  {
    label: 'Ruby Vivid 2ct Oval', bid: '$21,500', ask: '$23,000', delta: '+5.4%', up: true,
    detail: { exchange: 'HK Jewellery Exchange', volume: '48 trades/day', spread: '$1,500', lastSale: '$22,100', change7d: '+9.1%' }
  },
  {
    label: 'Kashmir Sapphire 3ct', bid: '$7,100', ask: '$7,900', delta: '-1.2%', up: false,
    detail: { exchange: 'CIBJO Geneva', volume: '31 trades/day', spread: '$800', lastSale: '$7,450', change7d: '-0.6%' }
  },
];

const MarketUI = () => {
  const [active, setActive] = useState(null);

  return (
    <div className="mock-ui">
      <div className="mock-header">
        <span className="mock-title">Market Intelligence</span>
        <span className="mock-badge">Real-time</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {MARKET_ROWS.map((m, i) => (
          <div key={i}>
            <div
              onClick={() => setActive(active === i ? null : i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: active === i ? 'rgba(0,0,0,0.07)' : 'rgba(0,0,0,0.04)',
                borderRadius: active === i ? '10px 10px 0 0' : 10,
                padding: '10px 14px',
                border: `1px solid ${active === i ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.06)'}`,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#0d0d0d', marginBottom: 2 }}>{m.label}</div>
                <div style={{ fontSize: 11, color: '#9aa0a6' }}>Bid {m.bid} · Ask {m.ask}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: m.up ? '#1e8e3e' : '#ea4335' }}>{m.delta}</span>
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ transform: active === i ? 'rotate(180deg)' : 'none', transition: '0.2s', opacity: 0.35 }}>
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>

            {active === i && (
              <div style={{
                background: 'rgba(0,0,0,0.03)',
                border: '1px solid rgba(0,0,0,0.08)',
                borderTop: 'none',
                borderRadius: '0 0 10px 10px',
                padding: '10px 14px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '6px 16px',
                animation: 'slide-down 0.2s ease',
              }}>
                {Object.entries(m.detail).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px solid rgba(0,0,0,0.04)', paddingTop: 5 }}>
                    <span style={{ fontSize: 10, color: '#9aa0a6', textTransform: 'capitalize', fontWeight: 500 }}>
                      {k.replace(/([A-Z])/g, ' $1')}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#0d0d0d' }}>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mock-stat-grid" style={{ marginTop: 'auto' }}>
        <div className="mock-stat">
          <div className="mock-stat-label">Queries/day</div>
          <div className="mock-stat-val" style={{ fontSize: 22 }}>42K</div>
        </div>
        <div className="mock-stat">
          <div className="mock-stat-label">Accuracy</div>
          <div className="mock-stat-val gold" style={{ fontSize: 22 }}>99.4%</div>
        </div>
      </div>
    </div>
  );
};

// ── FAB Icon SVGs ──────────────────────────────────────────────
const SunIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="4"/>
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
      stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
  </svg>
);
const MoonIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
  </svg>
);
const InvertIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 3v18"/>
    <path d="M12 3a9 9 0 010 18" fill="currentColor" stroke="none"/>
  </svg>
);
const ChevronUpIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M18 15l-6-6-6 6"/>
  </svg>
);

// ── Floating Action Buttons ───────────────────────────────────
const THEMES = ['light', 'dark', 'invert'];

const FloatingButtons = ({ theme, setTheme }) => {
  const [scrollPct, setScrollPct] = useState(0);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      const pct  = docH > 0 ? window.scrollY / docH : 0;
      setScrollPct(pct);
      setShowTop(pct > 0.15);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const cycleTheme = () => {
    setTheme(t => THEMES[(THEMES.indexOf(t) + 1) % THEMES.length]);
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  // Button colours adapt: light bg → dark FAB; dark/invert bg → light FAB
  const fabBg    = theme === 'light' ? '#0d0d0d' : '#f0f2f5';
  const fabColor = theme === 'light' ? '#f0f2f5' : '#0d0d0d';
  const fabShadow = theme === 'light'
    ? '0 4px 24px rgba(0,0,0,0.22)'
    : '0 4px 24px rgba(0,0,0,0.55)';

  const fabBase = {
    position: 'fixed', width: 48, height: 48, borderRadius: '50%',
    background: fabBg, color: fabColor,
    border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999, boxShadow: fabShadow,
    transition: 'all 0.25s cubic-bezier(0.2,0,0,1)',
    outline: 'none',
  };

  const THEME_LABEL = { light: 'Dark mode', dark: 'Invert mode', invert: 'Light mode' };

  return (
    <>
      {/* Theme toggle — bottom left */}
      <button
        id="fab-theme"
        onClick={cycleTheme}
        title={THEME_LABEL[theme]}
        style={{ ...fabBase, bottom: 24, left: 24 }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px) scale(1.06)'; e.currentTarget.style.boxShadow = fabShadow.replace('0.22','0.35'); }}
        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = fabShadow; }}
      >
        {theme === 'light'  && <SunIcon />}
        {theme === 'dark'   && <MoonIcon />}
        {theme === 'invert' && <InvertIcon />}
      </button>

      {/* Scroll to top — bottom right */}
      <button
        id="fab-top"
        onClick={scrollToTop}
        title="Back to top"
        style={{
          ...fabBase, bottom: 24, right: 24,
          opacity: showTop ? 1 : 0,
          pointerEvents: showTop ? 'auto' : 'none',
          transform: showTop ? 'translateY(0)' : 'translateY(10px)',
        }}
        onMouseEnter={e => { if (showTop) { e.currentTarget.style.transform = 'translateY(-2px) scale(1.06)'; }}}
        onMouseLeave={e => { if (showTop) { e.currentTarget.style.transform = 'translateY(0)'; }}}
      >
        <ChevronUpIcon />
      </button>
    </>
  );
};

// ── Nav ─────────────────────────────────────────────────────────────────────────
const Nav = () => {
  const navRef = useRef(null);
  useEffect(() => {
    const handler = () => {
      if (navRef.current) {
        navRef.current.classList.toggle('scrolled', window.scrollY > 20);
      }
    };
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <nav className="nav" ref={navRef}>
      <a href="#" className="nav-logo">
        <img src="/logo.jpg" alt="CaratSense" className="nav-logo-img" />
        Caratsense
      </a>
      <div className="nav-links">
        {['What We Build', 'Industries', 'Engagements', 'Insights'].map(l => (
          <a key={l} href={`#${l.toLowerCase().replace(/\s+/g,'')}`} className="nav-link">{l}</a>
        ))}
      </div>
      <div className="nav-actions">
        <a href="#whatwebuild" className="btn btn-ghost">See Our Work</a>
        <a href="#engagements" className="btn btn-dark">
          <svg viewBox="0 0 16 16" fill="currentColor"><path d="M3 8a5 5 0 1 1 10 0A5 5 0 0 1 3 8zm5-3.5a.5.5 0 0 0-1 0V8a.5.5 0 0 0 .146.354l2 2a.5.5 0 0 0 .708-.708L8 8.293V4.5z"/></svg>
          Work With Us
        </a>
      </div>
    </nav>
  );
};

// ── Workflow Showcase ──────────────────────────────────────────
// ── Workflow Showcase ──────────────────────────────────────────
const SCENARIOS = [
  {
    id: "scen-1",
    label: "Tally / Busy Executive Dashboard",
    description: "Live P&L, sales, and inventory data pulled from Tally or Busy into a real-time owner dashboard.",
    nodes: [
      { id: "n1", label: "Client App", iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons/icons/n8n.svg", x: 120, y: 170 },
      { id: "n2", label: "Router", iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons/icons/python.svg", x: 300, y: 170 },
      { id: "n3", label: "Embedding", iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons/icons/openai.svg", x: 480, y: 80 },
      { id: "n4", label: "Vector DB", iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons/icons/supabase.svg", x: 660, y: 80 },
      { id: "n5", label: "LLM Core", iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons/icons/claude.svg", x: 480, y: 260 },
      { id: "n6", label: "Analytics", iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons/icons/databricks.svg", x: 860, y: 80 },
      { id: "n7", label: "Zendesk", iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons/icons/zendesk.svg", x: 860, y: 260 }
    ],
    paths: [
      { id: "p1", d: "M 190 170 L 230 170", type: "solid" },
      { id: "p2", d: "M 370 170 C 410 170, 410 80, 410 80", type: "solid" },
      { id: "p3", d: "M 370 170 C 410 170, 410 260, 410 260", type: "solid" },
      { id: "p4", d: "M 550 80 L 590 80", type: "solid" },
      { id: "p5", d: "M 730 80 C 780 80, 780 260, 550 260", type: "dash" }, /* Context injection */
      { id: "p6", d: "M 730 80 L 790 80", type: "solid" },
      { id: "p7", d: "M 550 260 C 700 260, 700 80, 790 80", type: "dash" }, /* Telemetry */
      { id: "p8", d: "M 550 260 L 790 260", type: "solid" }
    ],
    signals: [
      { pathId: "p1", delay: 0, dur: 1.0, color: "#00e5ff", type: "dot" },
      { pathId: "p2", delay: 1.0, dur: 1.0, color: "#a078e6", type: "dot" },
      { pathId: "p3", delay: 1.0, dur: 1.0, color: "#a078e6", type: "dot" },
      { pathId: "p4", delay: 2.0, dur: 1.0, color: "#00e5ff", type: "dot" },
      { pathId: "p5", delay: 2.5, dur: 2.0, color: "#d4af37", type: "stream" },
      { pathId: "p6", delay: 3.5, dur: 1.5, color: "#ffffff", type: "dot" },
      { pathId: "p7", delay: 3.0, dur: 1.5, color: "#ffffff", type: "dot" },
      { pathId: "p8", delay: 4.5, dur: 1.5, color: "#00e5ff", type: "stream" }
    ]
  },
  {
    id: "scen-2",
    label: "WhatsApp CRM & Order Bot",
    description: "Automated lead capture, follow-up sequences, and order management — all running on WhatsApp.",
    nodes: [
      { id: "n1", label: "Intake", iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons/icons/gmail.svg", x: 120, y: 170 },
      { id: "n2", label: "Document AI", iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons/icons/amazonaws.svg", x: 300, y: 170 },
      { id: "n3", label: "Validation", iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons/icons/python.svg", x: 480, y: 170 },
      { id: "n4", label: "Salesforce", iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons/icons/salesforce.svg", x: 660, y: 80 },
      { id: "n5", label: "Quickbooks", iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons/icons/quickbooks.svg", x: 660, y: 260 },
      { id: "n6", label: "Alerting", iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons/icons/slack.svg", x: 860, y: 170 }
    ],
    paths: [
      { id: "p1", d: "M 190 170 L 230 170", type: "solid" },
      { id: "p2", d: "M 370 170 L 410 170", type: "solid" },
      { id: "p3", d: "M 550 170 C 590 170, 590 80, 590 80", type: "solid" },
      { id: "p4", d: "M 550 170 C 590 170, 590 260, 590 260", type: "solid" },
      { id: "p5", d: "M 730 80 C 780 80, 780 170, 790 170", type: "dash" },
      { id: "p6", d: "M 730 260 C 780 260, 780 170, 790 170", type: "dash" }
    ],
    signals: [
      { pathId: "p1", delay: 0, dur: 1.0, color: "#d4af37", type: "dot" },
      { pathId: "p2", delay: 1.0, dur: 1.5, color: "#00e5ff", type: "dot" },
      { pathId: "p3", delay: 2.5, dur: 1.0, color: "#a078e6", type: "stream" },
      { pathId: "p4", delay: 2.5, dur: 1.0, color: "#a078e6", type: "stream" },
      { pathId: "p5", delay: 3.5, dur: 1.5, color: "#ffffff", type: "dot" },
      { pathId: "p6", delay: 3.5, dur: 1.5, color: "#ffffff", type: "dot" }
    ]
  },
  {
    id: "scen-3",
    label: "Inventory Intelligence Pipeline",
    description: "ML-based aging detection and demand forecasting for jewellery, textiles, and building materials.",
    nodes: [
      { id: "n1", label: "Scheduler", iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons/icons/n8n.svg", x: 120, y: 170 },
      { id: "n2", label: "Agent LLM", iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons/icons/claude.svg", x: 300, y: 170 },
      { id: "n3", label: "Scraper", iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons/icons/robotframework.svg", x: 480, y: 80 },
      { id: "n4", label: "Processing", iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons/icons/python.svg", x: 480, y: 260 },
      { id: "n5", label: "Data Sink", iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons/icons/googlesheets.svg", x: 660, y: 80 },
      { id: "n6", label: "Ticketing", iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons/icons/jira.svg", x: 660, y: 260 },
      { id: "n7", label: "Reporting", iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons/icons/slack.svg", x: 860, y: 170 }
    ],
    paths: [
      { id: "p1", d: "M 190 170 L 230 170", type: "solid" },
      { id: "p2", d: "M 370 170 C 410 170, 410 80, 410 80", type: "solid" },
      { id: "p3", d: "M 550 80 C 600 80, 600 260, 410 260", type: "dash" },
      { id: "p4", d: "M 550 80 L 590 80", type: "solid" },
      { id: "p5", d: "M 550 260 L 590 260", type: "solid" },
      { id: "p6", d: "M 730 80 C 780 80, 780 170, 790 170", type: "dash" },
      { id: "p7", d: "M 730 260 C 780 260, 780 170, 790 170", type: "dash" }
    ],
    signals: [
      { pathId: "p1", delay: 0, dur: 1.0, color: "#d4af37", type: "dot" },
      { pathId: "p2", delay: 1.0, dur: 1.0, color: "#00e5ff", type: "dot" },
      { pathId: "p3", delay: 2.0, dur: 1.5, color: "#a078e6", type: "stream" },
      { pathId: "p4", delay: 2.0, dur: 1.0, color: "#00e5ff", type: "stream" },
      { pathId: "p5", delay: 3.5, dur: 1.0, color: "#ffffff", type: "dot" },
      { pathId: "p6", delay: 3.0, dur: 1.5, color: "#d4af37", type: "dot" },
      { pathId: "p7", delay: 4.5, dur: 1.5, color: "#d4af37", type: "dot" }
    ]
  }
];

const WorkflowShowcase = () => {
  const [activeIdx, setActiveIdx] = useState(0);

  const prev = () => setActiveIdx((i) => (i === 0 ? SCENARIOS.length - 1 : i - 1));
  const next = () => setActiveIdx((i) => (i === SCENARIOS.length - 1 ? 0 : i + 1));

  const scen = SCENARIOS[activeIdx];
  const svgRef = useRef(null);

  useEffect(() => {
    // Notify the global physics orchestrator about the active workflow graph
    window.__ACTIVE_SCENARIO_NODES = scen.nodes;
    if (svgRef.current) {
      const activeId = `workflow-svg-${scen.id}`;
      svgRef.current.id = activeId;
      window.__ACTIVE_WORKFLOW_SVG_ID = activeId;
    }
  }, [scen, activeIdx]);

  // Clean up global target when component unmounts
  useEffect(() => {
    return () => {
      window.__ACTIVE_SCENARIO_NODES = null;
      window.__ACTIVE_WORKFLOW_SVG_ID = null;
    };
  }, []);

  return (
    <section className="workflows-section" id="workflows">
       <div className="workflow-animated-container fade-in">
         <div className="section-header" style={{ textAlign: 'center', marginBottom: 40, marginTop: 40 }}>
           <p className="section-label">How We Build It</p>
           <h2 className="section-title">Real systems. Real integrations.</h2>
         </div>
         
         <div className="workflow-carousel-wrap">
           <button className="carousel-btn left" onClick={prev}>
             <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none"><polyline points="15 18 9 12 15 6"></polyline></svg>
           </button>

           <div className="workflow-card">
             <div className="workflow-card-header" key={`h-${scen.id}`}>
               <h3 className="workflow-card-title">{scen.label}</h3>
               <p className="workflow-card-desc">{scen.description}</p>
             </div>
             
             <div className="workflow-canvas-wrap">
               <svg ref={svgRef} viewBox="0 0 1000 340" className="workflow-svg" key={`svg-${scen.id}`}>
                 <defs>
                   <filter id={`glow-sig-${scen.id}`} x="-50%" y="-50%" width="200%" height="200%">
                     <feGaussianBlur stdDeviation="4" result="blur" />
                     <feComposite in="SourceGraphic" in2="blur" operator="over" />
                   </filter>
                 </defs>
                 
                 {scen.paths.map(p => (
                   <path 
                     key={p.id} 
                     id={`${scen.id}-${p.id}`}
                     d={p.d} 
                     className={`workflow-path workflow-path-${p.type}`}
                     stroke={p.type === 'dash' ? "rgba(180, 190, 220, 0.6)" : "rgba(150, 160, 180, 0.4)"} 
                     strokeWidth="2"
                     fill="none"
                   />
                 ))}

                 {scen.signals.map((sig, i) => {
                    const renderCircle = (offsetDelay, idxKey, sizeMultiplier) => (
                      <circle key={`sig-${i}-${idxKey}`} r={4.5 * sizeMultiplier} fill={sig.color} filter={`url(#glow-sig-${scen.id})`}>
                        <animateMotion 
                          dur={`${sig.dur}s`} 
                          repeatCount="indefinite"
                          begin={`${sig.delay + offsetDelay}s`}
                        >
                          <mpath href={`#${scen.id}-${sig.pathId}`} />
                        </animateMotion>
                      </circle>
                    );

                    if (sig.type === 'stream') {
                      return (
                        <g key={`stream-${i}`}>
                          {renderCircle(0, 0, 0.8)}
                          {renderCircle(0.15, 1, 0.8)}
                          {renderCircle(0.30, 2, 0.8)}
                        </g>
                      );
                    }
                    if (sig.type === 'dot') {
                       return renderCircle(0, 0, 1.0);
                    }
                    return null;
                 })}
                 
                 {/* foreignObjects are intentionally removed. The TechEcosystemBg automatically drops nodes perfectly onto these coordinates in structured mode! */}
               </svg>
             </div>
           </div>

           <button className="carousel-btn right" onClick={next}>
             <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none"><polyline points="9 18 15 12 9 6"></polyline></svg>
           </button>
         </div>

         <div className="carousel-dots">
           {SCENARIOS.map((_, i) => (
             <span key={i} className={`carousel-dot ${i === activeIdx ? 'active' : ''}`} onClick={() => setActiveIdx(i)} />
           ))}
         </div>
       </div>
    </section>
  );
};


// ── DNN Visualization ──────────────────────────────────────────────────────

const DNN_CANVAS_H = 560;
const DNN_NODE_R   = 24;   // icon circle radius (px)
const DNN_LAYER_X  = [0.10, 0.35, 0.65, 0.90]; // x as fraction of canvas width
const DNN_ROW_GAP  = 86;   // vertical spacing between nodes in same layer

const DNN_CFG = [
  { id: 0, sublabel: 'Input Layer',   label: 'Data Sources',  color: '#a78bfa',
    nodes: [
      { icon: 'postgresql',    label: 'PostgreSQL' },
      { icon: 'mongodb',       label: 'MongoDB'    },
      { icon: 'elasticsearch', label: 'Elastic'    },
      { icon: 'redis',         label: 'Redis'      },
      { icon: 'amazonaws',     label: 'S3 / DWH'  },
    ]},
  { id: 1, sublabel: 'Processing',    label: 'ETL & Compute', color: '#818cf8',
    nodes: [
      { icon: 'python',      label: 'Python'     },
      { icon: 'docker',      label: 'Docker'     },
      { icon: 'kubernetes',  label: 'K8s'        },
      { icon: 'databricks',  label: 'Databricks' },
      { icon: 'n8n',         label: 'Pipelines'  },
    ]},
  { id: 2, sublabel: 'Intelligence',  label: 'AI / GNN Core', color: '#d4af37',
    nodes: [
      { icon: 'openai',      label: 'OpenAI'    },
      { icon: 'claude',      label: 'Claude'    },
      { icon: 'supabase',    label: 'Vector DB' },
      { icon: 'googlecloud', label: 'GCP ML'    },
      { icon: 'nodedotjs',   label: 'Runtime'   },
    ]},
  { id: 3, sublabel: 'Output Layer',  label: 'Delivery',      color: '#34d399',
    nodes: [
      { icon: 'react',        label: 'Dashboard' },
      { icon: 'slack',        label: 'Alerts'    },
      { icon: 'github',       label: 'Pipelines' },
      { icon: 'stripe',       label: 'Payments'  },
      { icon: 'googlesheets', label: 'Reports'   },
    ]},
];

// Build flat node list
const DNN_NODES = DNN_CFG.flatMap(layer =>
  layer.nodes.map((n, row) => ({
    id: `dnn-${layer.id}-${row}`,
    layer: layer.id, row,
    icon: n.icon, label: n.label, color: layer.color,
  }))
);
const DNN_NODE_MAP = Object.fromEntries(DNN_NODES.map(n => [n.id, n]));

// Build connections: each node → 2-3 nodes in next layer, spread by proximity
const DNN_CONNS = (() => {
  const byLayer = {};
  DNN_NODES.forEach(n => { (byLayer[n.layer] = byLayer[n.layer] || []).push(n); });
  const conns = [], seen = new Set();
  [0, 1, 2].forEach(li => {
    const from = byLayer[li] || [], to = byLayer[li + 1] || [];
    if (!to.length) return;
    from.forEach((f, fi) => {
      const ratio = from.length > 1 ? fi / (from.length - 1) : 0.5;
      const base  = Math.round(ratio * (to.length - 1));
      const idxs  = new Set([
        Math.max(0, base - 1), base, Math.min(to.length - 1, base + 1),
        // one extra "long-range" link for the dense neural look
        Math.floor(Math.random() * to.length),
      ]);
      idxs.forEach(ti => {
        const key = `${f.id}>${to[ti].id}`;
        if (!seen.has(key)) { seen.add(key); conns.push({ from: f.id, to: to[ti].id, color: f.color }); }
      });
    });
  });
  return conns;
})();

const dnnPos = (node, cw) => {
  const count  = DNN_CFG[node.layer].nodes.length;
  const totalH = (count - 1) * DNN_ROW_GAP;
  const startY = (DNN_CANVAS_H - totalH) / 2;
  return {
    x: Math.round(cw * DNN_LAYER_X[node.layer]),
    y: Math.round(startY + node.row * DNN_ROW_GAP),
  };
};

const rgb = hex => `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;

const DNNSection = () => {
  const sectionRef  = useRef(null);
  const canvasRef   = useRef(null);
  const nodeEls     = useRef({});
  const anim        = useRef({
    triggered: false, elapsed: 0, lastTime: null, raf: null,
    skeletonProg: 0,
    nodeProgs: Object.fromEntries(DNN_NODES.map(n => [n.id, 0])),
    scatter:    Object.fromEntries(DNN_NODES.map(n => [n.id, {
      dx: (Math.random() - 0.5) * 680,
      dy: (Math.random() - 0.5) * 460,
    }])),
    pulses: [],
  });

  // IntersectionObserver: fire animation once on enter
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !anim.current.triggered) {
        anim.current.triggered = true;
        anim.current.lastTime  = null;
      }
    }, { threshold: 0.15 });
    if (sectionRef.current) obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  // Main animation loop
  useEffect(() => {
    const loop = ts => {
      const s = anim.current;
      s.raf = requestAnimationFrame(loop);
      if (!s.triggered) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      // Delta time
      const dt = s.lastTime ? Math.min((ts - s.lastTime) / 1000, 0.05) : 0;
      s.lastTime = ts;
      s.elapsed += dt;

      // Sync canvas resolution to CSS size
      const cw = canvas.offsetWidth  || 1000;
      const ch = canvas.offsetHeight || DNN_CANVAS_H;
      if (canvas.width !== cw)  canvas.width  = cw;
      if (canvas.height !== ch) canvas.height = ch;

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, cw, ch);

      // ── Progress ────────────────────────────────────────────────
      s.skeletonProg = Math.min(1, s.elapsed / 1.0); // skeleton draws in over 1 s

      DNN_NODES.forEach(node => {
        const start = 0.38 + node.layer * 0.22 + node.row * 0.045;
        s.nodeProgs[node.id] = Math.min(1, Math.max(0, (s.elapsed - start) / 0.65));
      });

      // ── Pulses ──────────────────────────────────────────────────
      if (s.elapsed > 1.1) {
        s.pulses = s.pulses.filter(p => p.t <= 1.0);
        s.pulses.forEach(p => { p.t += dt * p.speed; });
        if (s.pulses.length < 20 && Math.random() < 0.25) {
          const c = DNN_CONNS[Math.floor(Math.random() * DNN_CONNS.length)];
          s.pulses.push({ from: c.from, to: c.to, color: c.color, t: 0, speed: 0.3 + Math.random() * 0.4 });
        }
      }

      // ── Draw connections ────────────────────────────────────────
      DNN_CONNS.forEach(conn => {
        const f  = dnnPos(DNN_NODE_MAP[conn.from], cw);
        const t  = dnnPos(DNN_NODE_MAP[conn.to],   cw);
        const cx = (f.x + t.x) / 2;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(f.x, f.y);
        ctx.bezierCurveTo(cx, f.y, cx, t.y, t.x, t.y);
        ctx.strokeStyle = `rgba(${rgb(conn.color)},${(s.skeletonProg * 0.22).toFixed(3)})`;
        ctx.lineWidth   = 1;
        ctx.shadowBlur  = 5;
        ctx.shadowColor = `rgba(${rgb(conn.color)},0.4)`;
        ctx.stroke();
        ctx.restore();
      });

      // ── Draw skeleton node circles (fade out as real icons arrive) ──
      DNN_NODES.forEach(node => {
        const pos   = dnnPos(node, cw);
        const alpha = s.skeletonProg * Math.max(0, 1 - s.nodeProgs[node.id] * 2) * 0.45;
        if (alpha < 0.01) return;
        ctx.save();
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, DNN_NODE_R, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${rgb(node.color)},${alpha.toFixed(3)})`;
        ctx.lineWidth   = 1.5;
        ctx.shadowBlur  = 10;
        ctx.shadowColor = `rgba(${rgb(node.color)},${(alpha * 0.6).toFixed(3)})`;
        ctx.stroke();
        ctx.restore();
      });

      // ── Draw pulses ─────────────────────────────────────────────
      s.pulses.forEach(p => {
        const f  = dnnPos(DNN_NODE_MAP[p.from], cw);
        const t  = dnnPos(DNN_NODE_MAP[p.to],   cw);
        const cx = (f.x + t.x) / 2, mt = 1 - p.t;
        const px = mt*mt*mt*f.x + 3*mt*mt*p.t*cx + 3*mt*p.t*p.t*cx + p.t*p.t*p.t*t.x;
        const py = mt*mt*mt*f.y + 3*mt*mt*p.t*f.y + 3*mt*p.t*p.t*t.y + p.t*p.t*p.t*t.y;
        const op = Math.sin(Math.PI * p.t);
        ctx.save();
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fillStyle  = `rgba(${rgb(p.color)},${(op * 0.9).toFixed(3)})`;
        ctx.shadowBlur = 14;
        ctx.shadowColor = `rgba(${rgb(p.color)},${op.toFixed(3)})`;
        ctx.fill();
        ctx.restore();
      });

      // ── Animate DOM nodes ────────────────────────────────────────
      DNN_NODES.forEach(node => {
        const el = nodeEls.current[node.id];
        if (!el) return;
        const prog   = s.nodeProgs[node.id];
        const eased  = 1 - Math.pow(1 - prog, 3);
        const target = dnnPos(node, cw);
        const sc     = s.scatter[node.id];
        el.style.transform = `translate(${target.x + sc.dx * (1 - eased) - DNN_NODE_R}px,${target.y + sc.dy * (1 - eased) - DNN_NODE_R}px)`;
        el.style.opacity   = eased.toFixed(3);
      });
    };

    anim.current.raf = requestAnimationFrame(loop);
    return () => { if (anim.current.raf) cancelAnimationFrame(anim.current.raf); };
  }, []);

  return (
    <section className="dnn-section" ref={sectionRef} id="intelligence">
      <div className="section-inner">
        <div className="section-header fade-in" style={{ textAlign: 'center', marginBottom: 28 }}>
          <p className="section-label">Intelligence Pipeline</p>
          <h2 className="section-title">How your data becomes a decision</h2>
          <p className="section-desc">Every node a transformation. Every edge a signal. Powered by our multi-layer AI architecture.</p>
        </div>

        <div style={{ position: 'relative', maxWidth: 1100, margin: '0 auto' }}>
          {/* Layer labels */}
          <div style={{ position: 'relative', height: 42, marginBottom: 4 }}>
            {DNN_CFG.map((layer, i) => (
              <div key={layer.id} className="dnn-layer-label" style={{ left: `${DNN_LAYER_X[i] * 100}%` }}>
                <span style={{ color: layer.color }}>{layer.sublabel}</span>
                <span>{layer.label}</span>
              </div>
            ))}
          </div>

          {/* Canvas + DOM nodes */}
          <div className="dnn-canvas-wrap">
            <canvas ref={canvasRef} className="dnn-canvas" />
            {DNN_NODES.map(node => (
              <div
                key={node.id}
                ref={el => { nodeEls.current[node.id] = el; }}
                className="dnn-node"
                data-layer={node.layer}
                style={{ position: 'absolute', top: 0, left: 0, opacity: 0, willChange: 'transform, opacity' }}
              >
                <div className="dnn-node-ring">
                  <img
                    src={`https://cdn.jsdelivr.net/npm/simple-icons@11.4.0/icons/${node.icon}.svg`}
                    alt={node.label}
                    className="dnn-node-img"
                    width="22" height="22"
                  />
                </div>
                <span className="dnn-node-label">{node.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// ── Scroll-fade hook ───────────────────────────────────────────
const useFadeIn = () => {
  useEffect(() => {
    const els = document.querySelectorAll('.fade-in');
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.12 }
    );
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);
};

// ── App ────────────────────────────────────────────────────────
export default function App() {
  useFadeIn();
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <>
      <TechEcosystemBg />
      <FloatingButtons theme={theme} setTheme={setTheme} />

      {/* All page content — CSS inverts this in 'invert' theme */}
      <div id="page-content" style={{ position: 'relative', zIndex: 1 }}>
      <Nav />

      {/* ── HERO ── */}
      <section className="hero" id="product">
        <div className="hero-content">
          <div className="hero-badge fade-in">
            <span className="dot" />
            Turning your data into decision-making tools.
          </div>
          <h1 className="hero-title fade-in fade-in-delay-1">
            We accelerate your<br />
            <em>business towards</em><br />
            growth
          </h1>
          <p className="hero-subtitle fade-in fade-in-delay-2">
            CaratSense is a consultative AI and software studio. We go deep into your operations, find where things are breaking down, and build tailored tech to fix it — dashboards, CRMs, bots, and intelligent automation.
          </p>
          <div className="hero-actions fade-in fade-in-delay-3">
            <a href="#engagements" className="btn btn-dark">
              <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16"><path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1zm0 1a6 6 0 1 0 0 12A6 6 0 0 0 8 2zm-.5 4a.5.5 0 0 1 1 0v3.293l1.854 1.853a.5.5 0 0 1-.708.708L7.5 9.707V6z"/></svg>
              Book a Discovery Call
            </a>
            <a href="#whatwebuild" className="btn btn-ghost">See what we build</a>
          </div>
        </div>
        <div className="scroll-indicator" aria-hidden="true">
          <div className="scroll-line" />
        </div>
      </section>
      
      {/* ── WORKFLOWS ── */}
      <WorkflowShowcase />

      {/* ── DNN INTELLIGENCE PIPELINE ── */}
      <DNNSection />

      {/* ── LOGOS ── */}
      <div className="logos">
        <div className="logos-inner">
          <p className="logos-label">Built for businesses across every industry</p>
          <div className="logos-grid">
            {['Retail', 'Manufacturing', 'Finance', 'Healthcare', 'Logistics', 'Technology'].map(l => (
              <span key={l} className="logo-item">{l}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── STATEMENT ── */}
      <section className="statement">
        <div className="statement-inner">
          <p className="statement-label">Our Mission</p>
          <p className="statement-text">
            We turn your <strong>data into decision-making tools</strong> — built around<br />
            how your business actually runs, not how software thinks it should.
          </p>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="section" id="whatwebuild">
        <div className="section-inner">
          <div className="section-header fade-in">
            <p className="section-label">What We Build</p>
            <h2 className="section-title">Tailored systems for the way your business actually runs</h2>
            <p className="section-desc">Every engagement starts with understanding your operations — then we build exactly what's needed. No generic software, no bloated platforms.</p>
          </div>

          {/* Feature 1 */}
          <div className="feature-row fade-in">
            <div className="feature-text">
              <span className="feature-tag">Executive Dashboards</span>
              <h3 className="feature-heading">Real-time visibility into your business</h3>
              <p className="feature-body">
                We integrate directly with Tally, Busy, and other accounting systems used across India — pulling live data into clean dashboards so owners and executives stop relying on end-of-day reports and start making decisions in real time.
              </p>
              <a href="#" className="feature-link">
                See how it works
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
              </a>
            </div>
            <div className="feature-preview">
              <EstimationUI />
            </div>
          </div>

          {/* Feature 2 */}
          <div className="feature-row reverse fade-in">
            <div className="feature-text">
              <span className="feature-tag">CRM &amp; WhatsApp Integration</span>
              <h3 className="feature-heading">Your entire lead pipeline on WhatsApp</h3>
              <p className="feature-body">
                WhatsApp is how Indian B2B runs. We build CRM systems and lead management tools with WhatsApp at the centre — automated follow-ups, order bots, and broadcast sequences so your team never drops a lead again.
              </p>
              <a href="#" className="feature-link">
                Explore CRM features
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
              </a>
            </div>
            <div className="feature-preview dark">
              <BreakdownUI />
            </div>
          </div>

          {/* Feature 3 */}
          <div className="feature-row fade-in">
            <div className="feature-text">
              <span className="feature-tag">Inventory Intelligence</span>
              <h3 className="feature-heading">Know what's aging before it costs you</h3>
              <p className="feature-body">
                ML-powered aging alerts flag slow-moving stock before it becomes dead inventory. Demand forecasting tells you what to reorder and when — built specifically for jewellery, textiles, and building materials where working capital is everything.
              </p>
              <a href="#" className="feature-link">
                Explore inventory tools
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
              </a>
            </div>
            <div className="feature-preview">
              <MarketUI />
            </div>
          </div>

          {/* Feature 4 — full width statement row */}
          <div className="feature-row fade-in" style={{ gridTemplateColumns: '1fr', textAlign: 'center', padding: '80px 0 40px' }}>
            <div className="feature-text" style={{ maxWidth: 580, margin: '0 auto' }}>
              <span className="feature-tag">Delegation-Ready Systems</span>
              <h3 className="feature-heading">Built so the business runs without you</h3>
              <p className="feature-body">
                Most Indian family-run businesses are owner-dependent by design — and it's a bottleneck. We build systems that put the right information in front of the right people, so delegation becomes possible and the owner can finally step back.
              </p>
              <a href="#engagements" className="btn btn-dark" style={{ marginTop: 8, display: 'inline-flex' }}>
                Start a conversation
              </a>
            </div>
          </div>
        </div>
      </section>


      {/* ── TRUST ── */}
      <section className="trust">
        <div className="trust-inner">
          <div className="fade-in">
            <p className="trust-label">How We Work</p>
            <h2 className="trust-title">From raw data to decisions that move your business forward</h2>
            <p className="trust-body">
              We follow a clear pipeline for every engagement: research the business, identify where operations are breaking down, brainstorm the right solution, then build a pitch package — scope doc, demo dashboard with your real data, architecture flowchart, and sprint timeline.
            </p>
            <a href="#engagements" className="btn btn-gold">Start your engagement</a>
          </div>
          <div className="fade-in fade-in-delay-1">
            <div className="trust-stats" style={{ marginBottom: 36 }}>
              {[
                { val: 'FastAPI', label: 'Backend engineering on a proven stack' },
                { val: 'React', label: 'Clean dashboards your team will actually use' },
                { val: 'ML + LLM', label: 'AI layers applied where they genuinely add value' },
                { val: 'WhatsApp', label: 'The default B2B channel in India, fully integrated' },
              ].map((s, i) => (
                <div key={i} className="trust-stat">
                  <div className="trust-stat-val">{s.val}</div>
                  <div className="trust-stat-label">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="trust-visual">
              {[
                { icon: '🔍', title: 'Research-First', sub: 'We study your business before writing a line of code' },
                { icon: '📦', title: 'Pitch Package Included', sub: 'Scope doc, demo dashboard, architecture & sprint plan' },
                { icon: '🌐', title: 'Industry-Agnostic', sub: 'Retail, finance, logistics, healthcare — we build for any domain' },
              ].map((c, i) => (
                <div key={i} className="trust-card">
                  <div className="trust-card-icon">{c.icon}</div>
                  <div className="trust-card-text">
                    <div className="trust-card-title">{c.title}</div>
                    <div className="trust-card-sub">{c.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="pricing" id="engagements">
        <div className="pricing-inner">
          <div className="pricing-header fade-in">
            <p className="section-label">Engagements</p>
            <h2 className="section-title" style={{ textAlign: 'center' }}>Start with a sprint.<br />Scale when it works.</h2>
          </div>
          <div className="pricing-grid fade-in fade-in-delay-1">
            {/* Discovery Sprint */}
            <div className="pricing-card">
              <div className="pricing-plan">Discovery Sprint</div>
              <div className="pricing-headline">Understand before you build.</div>
              <div className="pricing-tagline">For businesses unsure where to start.</div>
              <ul className="pricing-features">
                {[
                  'Deep-dive research into your operations',
                  'Bottleneck identification workshop',
                  'Solution architecture & recommendations',
                  'Demo dashboard built on your real data',
                  'Scope doc + sprint timeline',
                  'Architecture flowchart included',
                ].map((f, i) => (
                  <li key={i} className="pricing-feature">
                    <span className="pricing-feature-check">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a href="#" className="btn btn-dark">Book a discovery call</a>
            </div>
            {/* Build Engagement */}
            <div className="pricing-card featured">
              <div className="pricing-plan">Full Build Engagement</div>
              <div className="pricing-headline" style={{ color: '#fff' }}>Custom-built for you.</div>
              <div className="pricing-tagline">For businesses ready to move.</div>
              <ul className="pricing-features">
                {[
                  'Everything in Discovery Sprint',
                  'Full product build in focused sprints',
                  'Tally / Busy / WhatsApp integration',
                  'ML & LLM layers where they add value',
                  'Team training & handover documentation',
                  'Post-launch support & iteration',
                  'Direct access to your build team',
                ].map((f, i) => (
                  <li key={i} className="pricing-feature">
                    <span className="pricing-feature-check">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a href="#" className="btn btn-gold">Start the conversation</a>
            </div>
          </div>
        </div>
      </section>

      {/* ── BLOGS ── */}
      <section className="blogs" id="insights">
        <div className="blogs-inner">
          <div className="blogs-header">
            <h2 className="section-title fade-in">From the field</h2>
            <a href="#" className="btn btn-ghost fade-in">View all case studies</a>
          </div>
          <div className="blogs-grid">
            {[
              {
                tag: 'Case Study',
                title: 'How a jewellery wholesaler cut owner-dependency by 60% with a WhatsApp CRM',
                gradient: 'linear-gradient(135deg, #0a0a14, #111128)',
                accent: '#2563eb',
              },
              {
                tag: 'Industry Insight',
                title: 'Why Tally-integrated dashboards are replacing spreadsheet reporting in Indian SMBs',
                gradient: 'linear-gradient(135deg, #140a0a, #281111)',
                accent: '#dc2626',
              },
              {
                tag: 'Product',
                title: 'Building an inventory aging alert system for a textile distributor — from research to sprint',
                gradient: 'linear-gradient(135deg, #0a1209, #111f0e)',
                accent: '#D4AF37',
              },
            ].map((b, i) => (
              <div key={i} className={`blog-card fade-in fade-in-delay-${i}`}>
                <div className="blog-card-bg">
                  <div className="blog-gem-visual" style={{ background: b.gradient, position: 'relative', overflow: 'hidden', width: '100%', height: '100%' }}>
                    {/* Abstract gem dots */}
                    {Array.from({ length: 30 }).map((_, j) => (
                      <div key={j} style={{
                        position: 'absolute',
                        width: Math.random() * 4 + 1,
                        height: Math.random() * 4 + 1,
                        borderRadius: '50%',
                        background: b.accent,
                        opacity: Math.random() * 0.5 + 0.1,
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
                      }} />
                    ))}
                    <GemMark size={64} />
                  </div>
                </div>
                <div className="blog-card-overlay" />
                <div className="blog-card-content">
                  <div className="blog-card-tag">{b.tag}</div>
                  <div className="blog-card-title">{b.title}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER CTA ── */}
      <div className="footer-cta">
        <Starfield />
        <div className="footer-cta-inner">
          <div className="footer-cta-logo">
            <img src="/logo.jpg" alt="CaratSense" className="footer-cta-logo-img" />
            Caratsense
          </div>
          <h2 className="footer-cta-title">Ready to fix your bottleneck?</h2>
          <p className="footer-cta-sub">
            Tell us where your business is breaking down. We'll research it, map it, and build the right solution — starting with a discovery sprint.
          </p>
          <div className="footer-cta-actions">
            <a href="#" className="btn btn-gold">Book a Discovery Call</a>
            <a href="#" className="btn btn-outline-dark">See What We Build</a>
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer>
        <div className="footer-inner">
          <div className="footer-top">
            <div>
              <div className="footer-brand-logo">
                <GemMark size={22} />
                Caratsense
              </div>
              <p className="footer-brand-desc">
                Turning your data into decision-making tools — for any business, any industry.
              </p>
              <div className="footer-socials">
                {['𝕏', 'in', 'gh', '▷'].map((s, i) => (
                  <a key={i} href="#" className="footer-social-link">{s}</a>
                ))}
              </div>
            </div>
            {[
              { title: 'What We Build', links: ['Executive Dashboards', 'WhatsApp CRM', 'Inventory Intelligence', 'Order Bots', 'AI Chatbots'] },
              { title: 'Industries', links: ['Jewellery', 'Textiles', 'Building Materials', 'Manufacturing', 'Retail'] },
              { title: 'Resources', links: ['Blog', 'Case Studies', 'How We Work', 'Press', 'Brand Kit'] },
              { title: 'Company', links: ['About', 'Careers', 'Contact', 'Privacy', 'Terms'] },
            ].map(col => (
              <div key={col.title}>
                <div className="footer-col-title">{col.title}</div>
                <ul className="footer-links">
                  {col.links.map(l => (
                    <li key={l}><a href="#">{l}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="footer-bottom">
            <span className="footer-copyright">© 2025 CaratSense. All rights reserved.</span>
            <div className="footer-legal">
              <a href="#">Privacy</a>
              <a href="#">Terms</a>
              <a href="#">Brand Guidelines</a>
            </div>
          </div>
        </div>
      </footer>
      </div>{/* end #page-content */}
    </>
  );
}
