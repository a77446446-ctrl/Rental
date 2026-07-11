const canvas = document.getElementById("scene");
if (canvas) {
  const ctx = canvas.getContext("2d");

  let DPR = Math.min(window.devicePixelRatio || 1, 2);
  let W = 280;
  let H = 280;

  const TOTAL = 7600;
  const HOLD = 1300;
  let start = performance.now();

  function resize(){
    const rect = canvas.getBoundingClientRect();
    W = Math.round(rect.width * DPR);
    H = Math.round(rect.height * DPR);
    canvas.width = W;
    canvas.height = H;
    ctx.setTransform(1,0,0,1,0,0);
  }
  resize();
  window.addEventListener("resize", resize);

  function mulberry32(a){
    return function(){
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
  }
  const rnd = mulberry32(52);

  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
  function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }
  function easeInOutSine(t){ return -(Math.cos(Math.PI * t) - 1) / 2; }
  function easeOutBack(t){
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function qPoint(p0, p1, p2, t){
    const mt = 1 - t;
    return {
      x: mt*mt*p0.x + 2*mt*t*p1.x + t*t*p2.x,
      y: mt*mt*p0.y + 2*mt*t*p1.y + t*t*p2.y
    };
  }

  function drawPartialQuadratic(p0, p1, p2, progress){
    const segs = Math.max(8, Math.floor(32 * progress));
    ctx.beginPath();
    const first = qPoint(p0, p1, p2, 0);
    ctx.moveTo(first.x, first.y);
    for(let i=1;i<=segs;i++){
      const tt = progress * (i / segs);
      const p = qPoint(p0, p1, p2, tt);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  const branches = [];
  const leaves = [];
  const canopyPuffs = [];

  const trunkPath = {
    p0:{x:0, y:0},
    p1:{x:-4, y:-70},
    p2:{x:5, y:-150}
  };

  function trunkPoint(t){
    return qPoint(trunkPath.p0, trunkPath.p1, trunkPath.p2, t);
  }

  function trunkWidthAt(t){
    return 23 - 12.5 * Math.pow(t, 0.78);
  }

  function addBranchFromTrunk(tOnTrunk, angle, len, width, startAt, depth=1){
    const p = trunkPoint(tOnTrunk);
    const sideOffset = Math.sign(Math.cos(angle)) * trunkWidthAt(tOnTrunk) * 0.22;
    buildBranch(p.x + sideOffset, p.y, angle, len, depth, width, startAt);
  }

  function buildBranch(x, y, angle, len, depth, width, startAt){
    const normalX = Math.cos(angle + Math.PI / 2);
    const normalY = Math.sin(angle + Math.PI / 2);
    const bend = (rnd() - 0.5) * len * (depth < 2 ? 0.08 : 0.16);

    const mx = x + Math.cos(angle) * len * 0.52 + normalX * bend;
    const my = y + Math.sin(angle) * len * 0.52 + normalY * bend;
    const ex = x + Math.cos(angle) * len;
    const ey = y + Math.sin(angle) * len;

    const duration = Math.max(240, 710 - depth * 78 + len * 0.11);

    branches.push({
      x, y, mx, my, ex, ey,
      depth, width, len, startAt, duration,
      color: depth <= 1 ? [95, 64, 41] : [88, 59, 38],
      highlight: [170, 128, 86]
    });

    const finish = startAt + duration;

    if (depth >= 4 || len < 34){
      const clusterCount = 8 + Math.floor(rnd() * 5);
      for(let i=0;i<clusterCount;i++){
        const localAngle = angle + (rnd() - 0.5) * 1.0;
        const petiole = 4 + rnd() * 6;
        const spread = 1.5 + rnd() * 6;
        const ax = ex + Math.cos(localAngle) * petiole;
        const ay = ey + Math.sin(localAngle) * petiole;
        const lx = ax + Math.cos(localAngle) * spread + (rnd() - 0.5) * 3.5;
        const ly = ay + Math.sin(localAngle) * spread * 0.72 + (rnd() - 0.5) * 3.5;
        const size = 7.8 + rnd() * 5.5;
        const rot = localAngle + (rnd() - 0.5) * 0.7;
        const appear = finish + 60 + i * 26 + rnd() * 90;
        const palette = [
          [110, 160, 68],
          [126, 178, 77],
          [93, 143, 57],
          [145, 192, 88]
        ];
        const c = palette[Math.floor(rnd() * palette.length)];

        leaves.push({
          x: lx, y: ly, size, rot, appear,
          duration: 520 + rnd() * 210,
          color: c,
          vein: [232, 247, 220],
          stemFromX: ex,
          stemFromY: ey,
          stemToX: ax,
          stemToY: ay
        });

        canopyPuffs.push({
          x: lx, y: ly,
          r: size * (1.45 + rnd() * 1.35),
          appear
        });
      }
      return;
    }

    const childCount = depth <= 1 ? 2 : (rnd() > 0.62 ? 3 : 2);
    const spreadBase = depth === 1 ? 0.38 : depth === 2 ? 0.50 : 0.62;

    for(let i=0;i<childCount;i++){
      const dir = childCount === 2 ? (i === 0 ? -1 : 1) : (i - 1);
      const newAngle =
        angle +
        dir * spreadBase * (0.70 + rnd() * 0.24) +
        (rnd() - 0.5) * 0.05;

      const newLen = len * (depth < 2 ? (0.72 + rnd() * 0.06) : (0.64 + rnd() * 0.07));
      const newWidth = Math.max(2.1, width * (depth < 2 ? 0.76 : 0.69));
      const newStart = finish - duration * 0.12 + i * (42 + rnd() * 28);
      buildBranch(ex, ey, newAngle, newLen, depth + 1, newWidth, newStart);
    }

    if (depth >= 2 && rnd() > 0.30){
      const twigDir = rnd() > 0.5 ? 1 : -1;
      const twigAngle = angle + twigDir * (0.16 + rnd() * 0.14);
      buildBranch(
        ex - Math.cos(angle) * len * 0.025,
        ey - Math.sin(angle) * len * 0.025,
        twigAngle,
        len * (0.28 + rnd() * 0.12),
        depth + 1,
        Math.max(1.8, width * 0.44),
        finish - 10 + rnd() * 42
      );
    }
  }

  addBranchFromTrunk(0.58, -2.23, 82, 10.4, 1000, 1);
  addBranchFromTrunk(0.60, -0.90, 84, 10.4, 1070, 1);
  addBranchFromTrunk(0.77, -1.92, 58, 8.0, 1320, 2);
  addBranchFromTrunk(0.79, -1.18, 58, 8.0, 1390, 2);
  addBranchFromTrunk(0.91, -1.70, 42, 6.0, 1620, 3);
  addBranchFromTrunk(0.92, -1.40, 42, 6.0, 1680, 3);

  const crownCenter = {x:2, y:-218};
  for(let i=0;i<112;i++){
    const a = rnd() * Math.PI * 2;
    const ring = Math.sqrt(rnd());
    const rx = 125;
    const ry = 78;
    const x = crownCenter.x + Math.cos(a) * rx * ring;
    let y = crownCenter.y + Math.sin(a) * ry * ring;
    if (y < crownCenter.y - 58) {
      y = crownCenter.y - 58 + (y - (crownCenter.y - 58)) * 0.35;
    }
    const size = 7.2 + rnd() * 6.0;
    const rot = a + Math.PI/2 + (rnd() - 0.5) * 0.9;
    const appear = 3000 + i * 27 + rnd() * 460;
    const palette = [
      [112, 162, 69],
      [130, 181, 80],
      [95, 146, 58],
      [148, 195, 91],
      [104, 154, 64]
    ];
    const c = palette[Math.floor(rnd() * palette.length)];
    leaves.push({
      x, y, size, rot, appear,
      duration: 650 + rnd() * 260,
      color: c,
      vein: [232, 247, 220],
      stemFromX: x - Math.cos(rot) * 7,
      stemFromY: y - Math.sin(rot) * 7,
      stemToX: x - Math.cos(rot) * 2,
      stemToY: y - Math.sin(rot) * 2,
      cloudLeaf: true
    });
    canopyPuffs.push({
      x, y,
      r: size * (1.7 + rnd() * 1.3),
      appear
    });
  }

  for(let i=0;i<42;i++){
    const row = i / 41;
    const a = rnd() * Math.PI * 2;
    const x = crownCenter.x + (rnd() - 0.5) * (95 - row * 24);
    const y = crownCenter.y - 42 + row * 68 + Math.sin(a) * 10;
    const size = 7.5 + rnd() * 5.2;
    const rot = a + Math.PI/2 + (rnd() - 0.5) * 0.85;
    const appear = 3350 + i * 38 + rnd() * 360;
    const palette = [
      [112, 162, 69],
      [130, 181, 80],
      [95, 146, 58],
      [148, 195, 91],
      [104, 154, 64]
    ];
    const c = palette[Math.floor(rnd() * palette.length)];

    leaves.push({
      x, y, size, rot, appear,
      duration: 620 + rnd() * 240,
      color: c,
      vein: [232, 247, 220],
      stemFromX: x - Math.cos(rot) * 7,
      stemFromY: y - Math.sin(rot) * 7,
      stemToX: x - Math.cos(rot) * 2,
      stemToY: y - Math.sin(rot) * 2,
      cloudLeaf: true
    });

    canopyPuffs.push({
      x, y,
      r: size * (1.65 + rnd() * 1.15),
      appear
    });
  }

  function drawLeaf(leaf, t){
    const p = clamp((t - leaf.appear) / leaf.duration, 0, 1);
    if (p <= 0) return;
    const s = easeOutBack(p);

    if (!leaf.cloudLeaf) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, p * 1.7);
      ctx.strokeStyle = "rgba(92,123,55,.78)";
      ctx.lineWidth = 1.35;
      ctx.beginPath();
      ctx.moveTo(leaf.stemFromX, leaf.stemFromY);
      ctx.quadraticCurveTo(
        (leaf.stemFromX + leaf.stemToX) * 0.5,
        (leaf.stemFromY + leaf.stemToY) * 0.5,
        leaf.stemToX,
        leaf.stemToY
      );
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(leaf.x, leaf.y);
    ctx.rotate(leaf.rot);
    ctx.scale(s, s);

    const size = leaf.size;
    const grad = ctx.createLinearGradient(-size*0.5, -size, size*0.8, size);
    grad.addColorStop(0, `rgb(${Math.min(255, leaf.color[0]+28)}, ${Math.min(255, leaf.color[1]+26)}, ${Math.min(255, leaf.color[2]+18)})`);
    grad.addColorStop(.58, `rgb(${leaf.color[0]}, ${leaf.color[1]}, ${leaf.color[2]})`);
    grad.addColorStop(1, `rgb(${Math.max(0, leaf.color[0]-18)}, ${Math.max(0, leaf.color[1]-18)}, ${Math.max(0, leaf.color[2]-10)})`);

    ctx.shadowColor = "rgba(40,88,28,.16)";
    ctx.shadowBlur = 8 * DPR;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.bezierCurveTo(size*0.92, -size*0.54, size*1.02, size*0.45, 0, size*1.15);
    ctx.bezierCurveTo(-size*1.02, size*0.45, -size*0.92, -size*0.54, 0, -size);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(${leaf.vein[0]},${leaf.vein[1]},${leaf.vein[2]},.68)`;
    ctx.lineWidth = Math.max(0.75, size * 0.10);
    ctx.beginPath();
    ctx.moveTo(0, -size*.78);
    ctx.lineTo(0, size*.84);
    ctx.stroke();

    ctx.restore();
  }

  function drawSmoothTrunk(progress){
    if (progress <= 0) return;
    const p = easeOutCubic(progress);

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = "rgba(28,18,8,.16)";
    ctx.shadowBlur = 8 * DPR;

    const steps = 30;
    for(let i=0;i<=steps*p;i++){
      const t = i / steps;
      const pt = trunkPoint(t);
      const w = trunkWidthAt(t);
      const grad = ctx.createRadialGradient(pt.x - w*.28, pt.y - w*.25, 1, pt.x, pt.y, w*.92);
      grad.addColorStop(0, "rgb(145,101,66)");
      grad.addColorStop(0.36, "rgb(103,69,44)");
      grad.addColorStop(1, "rgb(75,49,31)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(pt.x, pt.y, w * .56, w * .64, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const topT = p;
    const topPt = trunkPoint(topT);
    const topW = trunkWidthAt(topT);
    const baseW = trunkWidthAt(0);

    const leftBase = {x:trunkPath.p0.x - baseW*.52, y:trunkPath.p0.y};
    const rightBase = {x:trunkPath.p0.x + baseW*.52, y:trunkPath.p0.y};
    const leftTop = {x:topPt.x - topW*.46, y:topPt.y};
    const rightTop = {x:topPt.x + topW*.46, y:topPt.y};

    const bodyGrad = ctx.createLinearGradient(-18, topPt.y, 18, 0);
    bodyGrad.addColorStop(0, "rgb(125,84,54)");
    bodyGrad.addColorStop(.35, "rgb(96,64,41)");
    bodyGrad.addColorStop(.75, "rgb(79,52,33)");
    bodyGrad.addColorStop(1, "rgb(112,76,49)");

    ctx.shadowBlur = 7 * DPR;
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(leftBase.x, leftBase.y);
    ctx.bezierCurveTo(-20, -45*p, -14, -104*p, leftTop.x, leftTop.y);
    ctx.lineTo(rightTop.x, rightTop.y);
    ctx.bezierCurveTo(15, -104*p, 19, -45*p, rightBase.x, rightBase.y);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;

    ctx.strokeStyle = "rgba(190,145,92,.28)";
    ctx.lineWidth = 1.4;
    for(let s=-0.32; s<=0.32; s+=0.32){
      ctx.beginPath();
      const startT = 0.07;
      const endT = Math.max(startT, p - 0.04);
      const startPt = trunkPoint(startT);
      ctx.moveTo(startPt.x + trunkWidthAt(startT)*s, startPt.y);
      for(let i=1;i<=16;i++){
        const tt = startT + (endT-startT)*(i/16);
        const pt = trunkPoint(tt);
        ctx.lineTo(pt.x + trunkWidthAt(tt)*s + Math.sin(tt*9+s*4)*1.2, pt.y);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawBranchBlendSockets(t){
    const sockets = [
      {t:.58, r:10, at:1000},
      {t:.60, r:10, at:1070},
      {t:.77, r:7.5, at:1320},
      {t:.79, r:7.5, at:1390},
      {t:.91, r:5.4, at:1620},
      {t:.92, r:5.4, at:1680}
    ];
    for(const s of sockets){
      const p = clamp((t - s.at) / 340, 0, 1);
      if(p <= 0) continue;
      const pt = trunkPoint(s.t);
      const g = ctx.createRadialGradient(pt.x, pt.y, 1, pt.x, pt.y, s.r * 1.6);
      g.addColorStop(0, `rgba(98,64,40,${0.88*p})`);
      g.addColorStop(1, "rgba(98,64,40,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, s.r * (0.7 + 0.6*p), 0, Math.PI*2);
      ctx.fill();
    }
  }

  function drawScene(t){
    ctx.clearRect(0, 0, W, H);

    const refW = 380;
    const baseScale = Math.min(W, H) / refW;

    const baseX = W * 0.5;
    const baseY = H * 0.85;
    const scale = baseScale * (0.84 + 0.08 * easeInOutSine(clamp(t / (TOTAL * 0.78), 0, 1)));

    ctx.save();
    ctx.translate(baseX, baseY);
    ctx.scale(scale, scale);

    const shadowAlpha = 0.10 + 0.15 * easeInOutSine(clamp(t / TOTAL, 0, 1));
    const shadow = ctx.createRadialGradient(0, 14, 18, 0, 14, 110);
    shadow.addColorStop(0, `rgba(40,30,18,${shadowAlpha})`);
    shadow.addColorStop(1, "rgba(40,30,18,0)");
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.ellipse(0, 16, 86, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    const canopyP = clamp((t - 2600) / 2900, 0, 1);
    if (canopyP > 0){
      ctx.save();
      ctx.translate(baseX, baseY);
      ctx.scale(scale, scale);
      ctx.globalAlpha = 0.20 * canopyP;
      const center = crownCenter;
      const bigGlow = ctx.createRadialGradient(center.x, center.y + 4, 24, center.x, center.y + 4, 134);
      bigGlow.addColorStop(0, "rgba(124,178,76,.58)");
      bigGlow.addColorStop(.62, "rgba(112,168,68,.30)");
      bigGlow.addColorStop(1, "rgba(112,168,68,0)");
      ctx.fillStyle = bigGlow;
      ctx.beginPath();
      ctx.ellipse(center.x, center.y + 4, 132 * canopyP, 92 * canopyP, 0, 0, Math.PI*2);
      ctx.fill();

      for(const puff of canopyPuffs){
        const pr = clamp((t - puff.appear) / 620, 0, 1);
        if (pr <= 0) continue;
        const r = puff.r * (0.9 + pr * 0.24);
        const pg = ctx.createRadialGradient(puff.x, puff.y, 0, puff.x, puff.y, r);
        pg.addColorStop(0, "rgba(112,168,68,.24)");
        pg.addColorStop(1, "rgba(112,168,68,0)");
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.arc(puff.x, puff.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(baseX, baseY);
    ctx.scale(scale, scale);

    drawSmoothTrunk(clamp(t / 1180, 0, 1));

    const ordered = [...branches].sort((a,b) => a.depth - b.depth);
    for(const b of ordered){
      const p = clamp((t - b.startAt) / b.duration, 0, 1);
      if (p <= 0) continue;
      const ep = easeOutCubic(p);

      const p0 = {x:b.x, y:b.y};
      const p1 = {x:b.mx, y:b.my};
      const p2 = {x:b.ex, y:b.ey};

      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = "rgba(28,18,8,.14)";
      ctx.shadowBlur = Math.max(2.4, b.width * 0.54) * DPR;
      ctx.strokeStyle = `rgb(${b.color[0]},${b.color[1]},${b.color[2]})`;
      ctx.lineWidth = b.width;
      drawPartialQuadratic(p0, p1, p2, ep);

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = `rgb(${b.highlight[0]},${b.highlight[1]},${b.highlight[2]})`;
      ctx.lineWidth = Math.max(0.85, b.width * 0.18);
      drawPartialQuadratic(p0, p1, p2, Math.max(0, ep - 0.02));
      ctx.globalAlpha = 1;
    }

    drawBranchBlendSockets(t);

    const leavesOrdered = [...leaves].sort((a,b) => a.y - b.y);
    for(const leaf of leavesOrdered){
      drawLeaf(leaf, t);
    }

    ctx.restore();
  }

  function animate(now){
    const appLoading = document.getElementById('app-loading');
    if (appLoading && appLoading.classList.contains('is-hidden')) {
      return; // Останавливаем анимацию, чтобы не нагружать процессор и не вызывать лаги скролла
    }

    const cycle = TOTAL + HOLD;
    let elapsed = now - start;
    if (elapsed > cycle){
      start = now;
      elapsed = 0;
    }
    drawScene(Math.min(elapsed, TOTAL));
    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}
