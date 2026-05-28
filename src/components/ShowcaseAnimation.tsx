import React, { useEffect, useRef, useState } from 'react';
import { createNoise2D, createNoise3D } from 'simplex-noise';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

declare var VideoEncoder: any;

declare var VideoFrame: any;

const LOGO_SVG = `<svg viewBox="0 0 100 150" fill="rgba(255, 255, 255, 0.3)" xmlns="http://www.w3.org/2000/svg">
  <polygon points="12,20 88,20 50,60" />
  <rect x="20" y="70" width="6" height="60" />
  <rect x="34" y="70" width="6" height="20" />
  <rect x="34" y="105" width="6" height="25" />
  <rect x="47" y="70" width="6" height="15" />
  <rect x="47" y="95" width="6" height="25" />
  <rect x="47" y="130" width="6" height="20" />
  <rect x="60" y="70" width="6" height="42" />
  <rect x="60" y="122" width="6" height="8" />
  <rect x="74" y="70" width="6" height="60" />
  <rect x="34" y="90" width="16" height="5" />
  <rect x="47" y="112" width="16" height="5" />
</svg>`;

const logoImg = new Image();
logoImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(LOGO_SVG);

export default function ShowcaseAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const rawCodeRef = useRef(`// Loading code...`);
  const exportRef = useRef<() => void>();

  useEffect(() => {
    fetch('/src/components/ProcessingAnimation.tsx')
      .then(r => r.text())
      .then(text => { rawCodeRef.current = text; })
      .catch(e => { rawCodeRef.current = '// Error loading code: ' + e.message; });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let canvasW = container.clientWidth || window.innerWidth || 1200;
    let canvasH = container.clientHeight || window.innerHeight || 900;
    canvas.width = canvasW;
    canvas.height = canvasH;

    let width = canvasW;
    let height = canvasH;

    const noise2D = createNoise2D();
    const noise3D = createNoise3D();

    let animationFrameId: number;
    let time = 0;

    // --- State ---
    const flowers: Flower[] = [];
    const particles: Particle[] = [];
    const stars: Star[] = [];
    const precipitations: Precipitation[] = [];
    const splashes: Splash[] = [];
    const fallingPetals: FallingPetal[] = [];
    let globalSnowAccum = 0;

    // --- Initialization ---
    const init = (forceW?: number | Event, forceH?: number) => {
      const explicitW = typeof forceW === 'number' ? forceW : undefined;
      const explicitH = typeof forceH === 'number' ? forceH : undefined;
      if (!containerRef.current && !explicitW) return;
      canvasW = explicitW || containerRef.current?.clientWidth || window.innerWidth || 1200;
      canvasH = explicitH || containerRef.current?.clientHeight || window.innerHeight || 900;
      if (canvasRef.current) {
         canvasRef.current.width = canvasW;
         canvasRef.current.height = canvasH;
      }

      width = canvasW;
      height = canvasH;

      flowers.length = 0;
      const numFlowers = Math.floor(width / 30) + 10;
      for (let i = 0; i < numFlowers; i++) {
        flowers.push(new Flower(
          Math.random() * width,
          height + Math.random() * 20,
          height * 0.3 + Math.random() * (height * 0.4)
        ));
      }

      flowers.sort((a, b) => a.height - b.height);

      particles.length = 0;
      for (let i = 0; i < 150; i++) {
        particles.push(new Particle(Math.random() * width, Math.random() * height));
      }

      stars.length = 0;
      for (let i = 0; i < 150; i++) {
        stars.push(new Star(Math.random() * width, Math.random() * height * 0.7));
      }

      precipitations.length = 0;
      for (let i = 0; i < 300; i++) {
        const p = new Precipitation(Math.random() * width, Math.random() * height);
        p.type = 'NONE';
        precipitations.push(p);
      }

      splashes.length = 0;
      fallingPetals.length = 0;
      globalSnowAccum = 0;
    };

    // --- Classes ---
    class Precipitation {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      type: 'RAIN' | 'SNOW' | 'STORM' | 'NONE';

      constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        this.type = 'NONE';
        this.vx = 0;
        this.vy = 0;
        this.size = 1;
      }

      reset(type: 'RAIN' | 'SNOW' | 'STORM', width: number, yOffset: number = -20) {
        this.type = type;
        this.x = Math.random() * (width + 200) - 100;
        this.y = yOffset;
        this.size = type === 'SNOW' ? (Math.random() * 2 + 1) : (Math.random() * 1.5 + 0.5);
        if (type === 'SNOW') {
          this.vy = Math.random() * 1 + 0.5;
        } else {
          this.vy = Math.random() * 15 + 10;
        }
      }

      update(windStrength: number, timeStr: number, width: number, height: number, activeType: 'RAIN' | 'SNOW' | 'STORM' | 'NONE', onGroundHit?: (x: number, vx: number) => void, flowers?: Flower[], onFlowerHit?: (x: number, y: number, vx: number) => void) {
        if (this.type === 'NONE' || (this.type !== activeType && activeType !== 'NONE' && this.y > height)) {
            if (activeType !== 'NONE') {
                this.reset(activeType, width);
            } else {
                this.type = 'NONE';
            }
        }
        
        if (this.type === 'NONE') return;

        if (this.type === 'SNOW') {
          this.vx = Math.sin(timeStr * 2 + this.y * 0.05) * 0.5 + windStrength * 2;
        } else {
          this.vx = windStrength * (this.type === 'STORM' ? 8 : 3);
        }
        this.x += this.vx;
        this.y += this.vy;

        if ((activeType === 'RAIN' || activeType === 'STORM') && flowers && onFlowerHit) {
            for (let i = 0; i < flowers.length; i++) {
                const f = flowers[i];
                if (f.topY !== 0 && this.y >= f.topY - 30 * f.scale && this.y <= f.topY + 30 * f.scale) {
                    if (Math.abs(this.x - f.topX) < 40 * f.scale * (f.openness + 0.3)) {
                        f.vibration += this.vy * 0.15;
                        onFlowerHit(this.x, this.y, this.vx);
                        this.reset(activeType, width);
                        return;
                    }
                }
            }
        }

        if (this.y > height || this.x < -100 || this.x > width + 100) {
          if (this.y > height && this.type !== 'SNOW' && onGroundHit) {
             onGroundHit(this.x, this.vx);
          }
          if (activeType !== 'NONE') {
             this.reset(activeType, width);
          } else {
             this.type = 'NONE';
          }
        }
      }

      draw(ctx: CanvasRenderingContext2D, alpha: number) {
        if (this.type === 'NONE') return;
        ctx.fillStyle = this.type === 'SNOW' ? `rgba(255, 255, 255, ${alpha * 0.8})` : `rgba(180, 200, 255, ${alpha * 0.5})`;
        ctx.beginPath();
        if (this.type === 'SNOW') {
          ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const streakLength = this.vy * (this.type === 'STORM' ? 1.0 : 0.6);
          ctx.strokeStyle = ctx.fillStyle;
          ctx.lineWidth = this.size;
          ctx.beginPath();
          ctx.moveTo(this.x - this.vx * 0.2, this.y - streakLength);
          ctx.lineTo(this.x, this.y);
          ctx.stroke();
        }
      }
    }

    class Splash {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
      isBounce: boolean;

      constructor(x: number, y: number, vx: number, isBounce: boolean = false) {
        this.x = x;
        this.y = y;
        this.vx = vx * 0.3 + (Math.random() - 0.5) * (isBounce ? 4 : 2);
        this.vy = -Math.random() * (isBounce ? 4 : 2) - (isBounce ? 2 : 1);
        this.maxLife = Math.random() * 15 + (isBounce ? 15 : 10);
        this.life = this.maxLife;
        this.isBounce = isBounce;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.4; // gravity
        this.life--;
      }

      draw(ctx: CanvasRenderingContext2D, alpha: number) {
        if (this.life <= 0) return;
        const fade = this.life / this.maxLife;
        if (this.isBounce) {
           ctx.strokeStyle = `rgba(180, 200, 255, ${alpha * fade * 0.8})`;
           ctx.lineWidth = 1.5;
           ctx.beginPath();
           ctx.moveTo(this.x - this.vx, this.y - this.vy);
           ctx.lineTo(this.x, this.y);
           ctx.stroke();
        } else {
           ctx.fillStyle = `rgba(200, 220, 255, ${alpha * fade * 0.6})`;
           ctx.beginPath();
           ctx.arc(this.x, this.y, 1.5, 0, Math.PI * 2);
           ctx.fill();
        }
      }
    }

    class FallingPetal {
      x: number;
      y: number;
      vx: number;
      vy: number;
      angle: number;
      spin: number;
      color: string;
      scale: number;
      openness: number;

      constructor(x: number, y: number, color: string, scale: number, openness: number) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = Math.random() * 2 + 1;
        this.angle = Math.random() * Math.PI * 2;
        this.spin = (Math.random() - 0.5) * 0.1;
        this.color = color;
        this.scale = scale;
        this.openness = openness;
      }

      update(windStrength: number) {
        this.x += this.vx + windStrength * 3;
        this.y += this.vy;
        this.angle += this.spin;
      }

      draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.scale(this.scale, this.scale);

        const pLength = 35 + this.openness * 15;
        const pWidth = 15 + this.openness * 20;

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-pWidth, -pLength * 0.3, -pWidth, -pLength * 0.9, 0, -pLength);
        ctx.bezierCurveTo(pWidth, -pLength * 0.9, pWidth, -pLength * 0.3, 0, 0);
        ctx.fill();

        ctx.strokeStyle = `rgba(255,255,255,0.2)`;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
      }
    }

    class Star {
      x: number;
      y: number;
      size: number;
      phase: number;
      speed: number;

      constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 1.5 + 0.5;
        this.phase = Math.random() * Math.PI * 2;
        this.speed = 0.01 + Math.random() * 0.02;
      }

      draw(ctx: CanvasRenderingContext2D, nightFactor: number) {
        if (nightFactor < 0.1) return;
        this.phase += this.speed;
        const twinkle = (Math.sin(this.phase) + 1) / 2;
        ctx.fillStyle = `rgba(255, 255, 255, ${twinkle * nightFactor * 0.8})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      life: number;
      maxLife: number;
      hueOffset: number;

      constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.size = Math.random() * 2 + 0.5;
        this.maxLife = Math.random() * 200 + 100;
        this.life = Math.random() * this.maxLife;
        this.hueOffset = Math.random() * 30 - 15;
      }

      update(timeStr: number, windStrength: number) {
        const angle = noise3D(this.x * 0.005, this.y * 0.005, timeStr * 0.5) * Math.PI * 2;
        const force = windStrength * 0.5;
        this.vx += Math.cos(angle) * force;
        this.vx += windStrength * 0.2;
        this.vy += Math.sin(angle) * force;
        this.vx *= 0.95;
        this.vy *= 0.95;
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 1;

        if (this.life <= 0 || this.x < 0 || this.x > width || this.y < 0 || this.y > height) {
          this.x = Math.random() * width * 0.5;
          if (windStrength < 0) this.x = width;
          this.y = Math.random() * height;
          this.life = this.maxLife;
          this.vx = 0;
          this.vy = 0;
        }
      }

      draw(ctx: CanvasRenderingContext2D, phase: number, opennessFactor: number) {
        const alpha = Math.max(0, Math.sin((this.life / this.maxLife) * Math.PI));
        const l = Math.floor(lerp(80, 50, opennessFactor));
        const h = Math.round(50 + this.hueOffset);
        
        ctx.fillStyle = `hsla(${h}, 100%, ${l}%, ${alpha * 0.4})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size + opennessFactor*1.5, 0, Math.PI * 2);
        ctx.fill();

        if (opennessFactor > 0.5) {
          ctx.fillStyle = `hsla(${h}, 100%, 70%, ${alpha * 0.1})`;
          ctx.beginPath();
          ctx.arc(this.x, this.y, (this.size + opennessFactor*1.5) * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    class Flower {
      baseX: number;
      baseY: number;
      height: number;
      noiseId: number;
      openness: number;
      scale: number;
      stemH: number;
      stemS: number;
      stemL: number;
      petalColor: string;
      centerColor: string;
      petalsVisible: number;
      vibration: number;
      topX: number;
      topY: number;
      maxOpenness: number;
      bloomSpeed: number;
      phaseOffset: number;

      constructor(x: number, y: number, height: number) {
        this.baseX = x;
        this.baseY = y;
        this.height = height;
        this.noiseId = Math.random() * 1000;
        this.openness = 0;
        this.scale = 0.5 + Math.random() * 0.5;
        
        const hOffset = Math.random() * 20 - 10;
        this.stemH = Math.round(110 + hOffset);
        this.stemS = Math.round(40 + Math.random()*20);
        this.stemL = Math.round(30 + Math.random()*15);

        const petalH = Math.round(320 + hOffset);
        const petalS = Math.round(70 + Math.random()*20);
        const petalL = Math.round(65 + Math.random()*20);
        this.petalColor = `hsl(${petalH}, ${petalS}%, ${petalL}%)`;
        
        const centerH = Math.round(50 + hOffset);
        this.centerColor = `hsl(${centerH}, 90%, 60%)`;
        this.petalsVisible = 4;
        this.vibration = 0;
        this.topX = x;
        this.topY = y - height;
        this.maxOpenness = 0.7 + Math.random() * 0.5;
        this.bloomSpeed = 0.005 + Math.random() * 0.015;
        this.phaseOffset = (Math.random() - 0.5) * 0.15;
      }

      update(globalDayCycle: number, weatherMod: number, stormInt: number, snowAccum: number, fallingPetals: FallingPetal[], topX: number, topY: number) {
        if (snowAccum > 0.05 && this.petalsVisible > 0 && Math.random() < snowAccum * 0.05) {
          this.petalsVisible--;
          fallingPetals.push(new FallingPetal(topX, topY, this.petalColor, this.scale, this.openness));
        } else if (snowAccum === 0 && stormInt === 0 && this.petalsVisible < 4 && Math.random() < 0.01) {
          this.petalsVisible++;
        }

        const localDayCycle = (globalDayCycle + this.phaseOffset + 1.0) % 1.0;
        let myTargetOpenness = 0;
        if (localDayCycle >= 0.45 && localDayCycle <= 0.95) {
           myTargetOpenness = Math.sin((localDayCycle - 0.45) / 0.5 * Math.PI);
        }
        myTargetOpenness *= weatherMod;

        const adjustedTarget = myTargetOpenness * (1 - stormInt * 0.8) * (this.petalsVisible / 4) * this.maxOpenness;
        const diff = adjustedTarget - this.openness;
        this.openness += diff * (stormInt > 0 ? 0.05 : this.bloomSpeed);
      }

      draw(ctx: CanvasRenderingContext2D, timeCount: number, windStrength: number, globalDayCycle: number, weatherMod: number, stormInt: number, snowAccum: number, fallingPetals: FallingPetal[]) {
        const sway = noise2D(this.noiseId, timeCount * 0.8) * windStrength * this.height * 0.8;
        
        const vibSway = Math.sin(timeCount * 50 + this.noiseId) * this.vibration * 0.5;
        const totalSway = sway + vibSway;
        
        const topX = this.baseX + totalSway;
        const topY = this.baseY - this.height;
        
        this.topX = topX;
        this.topY = topY;
        this.vibration *= 0.85;
        
        const ctrl1X = this.baseX + totalSway * 0.2;
        const ctrl1Y = this.baseY - this.height * 0.3;
        const ctrl2X = this.baseX + totalSway * 0.7;
        const ctrl2Y = this.baseY - this.height * 0.8;

        this.update(globalDayCycle, weatherMod, stormInt, snowAccum, fallingPetals, topX, topY);
        
        const currentStemH = this.stemH * (1 - snowAccum) + 40 * snowAccum;
        const currentStemS = this.stemS * (1 - snowAccum) + 20 * snowAccum;
        const currentStemL = this.stemL * (1 - snowAccum) + 40 * snowAccum;
        const currentStemColor = `hsl(${currentStemH}, ${currentStemS}%, ${currentStemL}%)`;

        ctx.strokeStyle = currentStemColor;
        ctx.lineWidth = 3 * this.scale;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(this.baseX, this.baseY);
        ctx.bezierCurveTo(ctrl1X, ctrl1Y, ctrl2X, ctrl2Y, topX, topY);
        ctx.stroke();

        if (snowAccum > 0.01) {
           ctx.strokeStyle = `rgba(255, 255, 255, ${snowAccum * 0.8})`;
           ctx.lineWidth = 2 * this.scale;
           ctx.beginPath();
           ctx.moveTo(this.baseX + 1, this.baseY);
           ctx.bezierCurveTo(ctrl1X + 1, ctrl1Y, ctrl2X + 1, ctrl2Y, topX + 1, topY);
           ctx.stroke();
        }

        const angle = Math.atan2(topY - ctrl2Y, topX - ctrl2X) + Math.PI / 2;

        ctx.save();
        ctx.translate(topX, topY);
        ctx.rotate(angle);
        ctx.scale(this.scale, this.scale);

        ctx.fillStyle = currentStemColor;
        ctx.beginPath();
        ctx.ellipse(0, 5, 8, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = this.petalColor;

        const numPetals = this.petalsVisible;
        const layoutPetals = 4;
        let drawn = 0;
        for (let i = 0; i < layoutPetals; i++) {
          if (drawn >= numPetals) break;
          drawn++;
          
          ctx.save();
          let spreadAngle;
          if (layoutPetals === 4) {
             const baseAngles = [-0.8, -0.25, 0.25, 0.8]; 
             spreadAngle = baseAngles[i] * this.openness * 1.5;
          } else {
             spreadAngle = (i - (layoutPetals - 1) / 2) * 0.4 * this.openness;
          }

          ctx.rotate(spreadAngle);

          const shrink = 1;
          const pLength = (35 + this.openness * 15) * shrink;
          const pWidth = (15 + this.openness * 20) * shrink;

          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.bezierCurveTo(-pWidth, -pLength * 0.3, -pWidth, -pLength * 0.9, 0, -pLength);
          ctx.bezierCurveTo(pWidth, -pLength * 0.9, pWidth, -pLength * 0.3, 0, 0);
          ctx.fill();
          
          if (snowAccum > 0) {
             ctx.fillStyle = `rgba(255, 255, 255, ${snowAccum * 0.6})`;
             ctx.fill();
             
             ctx.fillStyle = `rgba(255, 255, 255, ${snowAccum * 0.9})`;
             ctx.beginPath();
             ctx.moveTo(-pWidth * 0.4, -pLength * 0.6);
             ctx.bezierCurveTo(-pWidth * 0.2, -pLength * 1.0, pWidth * 0.2, -pLength * 1.0, pWidth * 0.4, -pLength * 0.6);
             ctx.bezierCurveTo(pWidth * 0.1, -pLength * 0.8, -pWidth * 0.1, -pLength * 0.8, -pWidth * 0.4, -pLength * 0.6);
             ctx.fill();
          }

          ctx.strokeStyle = `rgba(255,255,255,0.2)`;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();
        }

        if (this.openness > 0.2) {
           ctx.fillStyle = this.centerColor;
           for(let i=0; i<4; i++) {
              ctx.save();
              ctx.rotate((i - 1.5) * 0.5 * this.openness);
              ctx.beginPath();
              ctx.moveTo(0,0);
              ctx.lineTo(0, -15 * this.openness);
              ctx.strokeStyle = this.centerColor;
              ctx.lineWidth = 2;
              ctx.stroke();
              
              ctx.beginPath();
              ctx.arc(0, -15 * this.openness, 3, 0, Math.PI*2);
              ctx.fill();
              ctx.restore();
           }
        }

        ctx.restore();
      }
    }

    function lerp(a: number, b: number, t: number) {
      return a + (b - a) * t;
    }

    const skyStops = [
      { p: 0.0,  c: [255, 180, 140] },
      { p: 0.1,  c: [135, 206, 235] },
      { p: 0.4,  c: [135, 206, 235] },
      { p: 0.5,  c: [255, 127, 80] }, 
      { p: 0.55, c: [72, 61, 139] },  
      { p: 0.75, c: [10, 15, 35] },   
      { p: 0.95, c: [72, 61, 139] },  
      { p: 1.0,  c: [255, 180, 140] },
    ];

    function getSkyColor(phase: number) {
      let pPhase = phase % 1.0;
      if (pPhase < 0) pPhase += 1.0;

      for (let i = 0; i < skyStops.length - 1; i++) {
        if (pPhase >= skyStops[i].p && pPhase < skyStops[i + 1].p) {
          const t = (pPhase - skyStops[i].p) / (skyStops[i + 1].p - skyStops[i].p);
          const r = Math.round(lerp(skyStops[i].c[0], skyStops[i + 1].c[0], t));
          const g = Math.round(lerp(skyStops[i].c[1], skyStops[i + 1].c[1], t));
          const b = Math.round(lerp(skyStops[i].c[2], skyStops[i + 1].c[2], t));
          return `rgb(${r},${g},${b})`;
        }
      }
      return `rgb(0,0,0)`;
    }

    init();

    window.addEventListener('resize', init as any);

    let lightningFlash = 0;
    const WEATHERS: ('CLEAR' | 'RAIN' | 'CLEAR' | 'SNOW' | 'STORM')[] = ['CLEAR', 'RAIN', 'CLEAR', 'SNOW', 'STORM'];
    let currentBolts: [number, number][][] = [];

    const stepFrame = (targetCtx: CanvasRenderingContext2D, cachedCodeLines?: string[]) => {
      const codeLines = cachedCodeLines || rawCodeRef.current.split('\n');
      time += 0.002;
      
      targetCtx.save();

      const weatherTime = time * 0.3;
      const wIdx = Math.floor(weatherTime) % WEATHERS.length;
      const wNextIdx = (Math.floor(weatherTime) + 1) % WEATHERS.length;
      const currentWeather = WEATHERS[wIdx];
      const nextWeather = WEATHERS[wNextIdx];
      const wBlend = weatherTime - Math.floor(weatherTime);
      const smoothBlend = wBlend * wBlend * (3 - 2 * wBlend);

      let rainInt = 0, snowInt = 0, stormInt = 0;
      if (currentWeather === 'RAIN') rainInt = 1 - smoothBlend;
      if (currentWeather === 'SNOW') snowInt = 1 - smoothBlend;
      if (currentWeather === 'STORM') stormInt = 1 - smoothBlend;
      if (nextWeather === 'RAIN') rainInt += smoothBlend;
      if (nextWeather === 'SNOW') snowInt += smoothBlend;
      if (nextWeather === 'STORM') stormInt += smoothBlend;

      const cloudInt = Math.min(1, rainInt * 0.8 + stormInt * 1.0 + snowInt * 0.6);

      if (snowInt > 0) {
        globalSnowAccum = Math.min(1.0, globalSnowAccum + snowInt * 0.002);
      } else {
        globalSnowAccum = Math.max(0, globalSnowAccum - (rainInt * 0.01 + 0.001));
      }

      const dayCycle = (time * 0.18) % 1.0;
      let weatherMod = (1 - snowInt) * (1 - rainInt * 0.3);
      
      let targetOpenness = 0;
      if (dayCycle >= 0.45 && dayCycle <= 0.95) {
         targetOpenness = 1.0;
      } 
      
      targetOpenness *= weatherMod;

      let windStrength = noise2D(time * 0.1, 0) + 0.5;
      windStrength += stormInt * (noise2D(time * 0.5, 100) * 2 + 1.5);
      windStrength += rainInt * 0.3 + snowInt * 0.1;

      const skyBase = getSkyColor(dayCycle);
      targetCtx.fillStyle = skyBase;
      targetCtx.fillRect(0, 0, width, height);

      if (cloudInt > 0) {
        targetCtx.fillStyle = `rgba(50, 60, 70, ${cloudInt * 0.85})`;
        if (snowInt > 0 && stormInt === 0 && rainInt === 0) {
          targetCtx.fillStyle = `rgba(180, 190, 200, ${cloudInt * 0.6})`;
        }
        targetCtx.fillRect(0, 0, width, height);
      }

      let nightFactor = 0;
      if (dayCycle > 0.5 && dayCycle < 0.9) nightFactor = 1;
      else if (dayCycle >= 0.4 && dayCycle <= 0.5) nightFactor = (dayCycle - 0.4) / 0.1;
      else if (dayCycle >= 0.9 && dayCycle <= 1.0) nightFactor = 1 - (dayCycle - 0.9) / 0.1;

      stars.forEach(star => star.draw(targetCtx, nightFactor * (1 - cloudInt)));

      const orbitRadius = Math.min(width, height) * 0.6;
      const cx = width * 0.5;
      const cy = height * 0.9;
      const sunAngle = -Math.PI + dayCycle * Math.PI * 2;
      const sx = cx + Math.cos(sunAngle) * orbitRadius;
      const sy = cy + Math.sin(sunAngle) * orbitRadius;

      if (sy < height + 50) {
        targetCtx.globalAlpha = Math.max(0, 1 - cloudInt * 0.9);
        const sunRadius = 60;
        const sunGradient = targetCtx.createRadialGradient(sx, sy, 0, sx, sy, sunRadius * 3);
        sunGradient.addColorStop(0, 'rgba(255, 230, 150, 1)');
        sunGradient.addColorStop(0.2, 'rgba(255, 180, 50, 0.8)');
        sunGradient.addColorStop(1, 'rgba(255, 100, 0, 0)');
        targetCtx.fillStyle = sunGradient;
        targetCtx.beginPath();
        targetCtx.arc(sx, sy, sunRadius * 3, 0, Math.PI * 2);
        targetCtx.fill();

        targetCtx.fillStyle = '#FFF5CC';
        targetCtx.beginPath();
        targetCtx.arc(sx, sy, sunRadius, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.globalAlpha = 1.0;
      }

      const moonAngle = sunAngle + Math.PI;
      const mx = cx + Math.cos(moonAngle) * orbitRadius;
      const my = cy + Math.sin(moonAngle) * orbitRadius;

      if (my < height + 50) {
        targetCtx.globalAlpha = Math.max(0, 1 - cloudInt * 0.9);
        const moonRadius = 40;
        const moonGradient = targetCtx.createRadialGradient(mx, my, 0, mx, my, moonRadius * 4);
        moonGradient.addColorStop(0, 'rgba(200, 220, 255, 0.6)');
        moonGradient.addColorStop(1, 'rgba(100, 150, 255, 0)');
        targetCtx.fillStyle = moonGradient;
        targetCtx.beginPath();
        targetCtx.arc(mx, my, moonRadius * 4, 0, Math.PI * 2);
        targetCtx.fill();

        targetCtx.fillStyle = '#E6E6FA';
        targetCtx.beginPath();
        targetCtx.arc(mx, my, moonRadius, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.globalAlpha = 1.0;
      }

      if (stormInt > 0.5 && Math.random() < 0.02) {
         lightningFlash = 1.0;
         currentBolts = [];
         for(let b = 0; b < Math.random() * 2 + 1; b++) {
            let lx = Math.random() * width;
            let ly = 0;
            let path: [number, number][] = [[lx, ly]];
            for(let i=0; i<30; i++) {
                lx += (Math.random() - 0.5) * 150;
                ly += Math.random() * 40 + 20;
                path.push([lx, ly]);
                if (ly > height) break;
            }
            currentBolts.push(path);
         }
      }

      if (lightningFlash > 0.01) {
         targetCtx.fillStyle = `rgba(255, 255, 255, ${lightningFlash * 0.8})`;
         targetCtx.fillRect(0, 0, width, height);

         targetCtx.lineWidth = 3;
         targetCtx.strokeStyle = `rgba(255, 255, 255, ${lightningFlash})`;
         currentBolts.forEach(bolt => {
            targetCtx.beginPath();
            targetCtx.moveTo(bolt[0][0], bolt[0][1]);
            for(let i=1; i<bolt.length; i++) {
               targetCtx.lineTo(bolt[i][0], bolt[i][1]);
            }
            targetCtx.stroke();
         });

         lightningFlash *= 0.85;
      }

      const avgOpenness = flowers.length > 0 ? flowers.reduce((acc, f) => acc + f.openness, 0) / flowers.length : targetOpenness;
      
      particles.forEach(p => {
        p.update(time, windStrength);
        p.draw(targetCtx, time, avgOpenness * (1 - cloudInt * 0.8));
      });

      let activePrecType: 'NONE' | 'RAIN' | 'SNOW' | 'STORM' = 'NONE';
      let precAlpha = 0;
      if (stormInt > 0) { activePrecType = 'STORM'; precAlpha = stormInt; }
      else if (rainInt > 0) { activePrecType = 'RAIN'; precAlpha = rainInt; }
      else if (snowInt > 0) { activePrecType = 'SNOW'; precAlpha = snowInt; }

      const activeCount = Math.floor(precipitations.length * precAlpha);
      for(let i=0; i<precipitations.length; i++) {
         const p = precipitations[i];
         if (i < activeCount || p.type !== 'NONE') {
             const targetType = i < activeCount ? activePrecType : 'NONE';
             p.update(windStrength, time, width, height, targetType, (hx, hvx) => {
                 if (Math.random() < 0.3) {
                     for (let k = 0; k < 2; k++) {
                         splashes.push(new Splash(hx, height, hvx, false));
                     }
                 }
             }, flowers, (fx, fy, fvx) => {
                 if (Math.random() < 0.8) {
                     for (let k = 0; k < 2; k++) {
                         splashes.push(new Splash(fx, fy, fvx, false));
                     }
                     splashes.push(new Splash(fx, fy, fvx, true));
                 }
             });
             p.draw(targetCtx, precAlpha);
         }
      }

      for (let i = splashes.length - 1; i >= 0; i--) {
          const sp = splashes[i];
          sp.update();
          sp.draw(targetCtx, precAlpha);
          if (sp.life <= 0) splashes.splice(i, 1);
      }

      flowers.forEach(flower => {
        flower.draw(targetCtx, time, windStrength, dayCycle, weatherMod, stormInt, globalSnowAccum, fallingPetals);
      });

      for (let i = fallingPetals.length - 1; i >= 0; i--) {
          const fp = fallingPetals[i];
          fp.update(windStrength);
          fp.draw(targetCtx);
          if (fp.y > height + 50) fallingPetals.splice(i, 1);
      }

      if (globalSnowAccum > 0.01) {
         targetCtx.fillStyle = `rgba(255, 255, 255, ${globalSnowAccum})`;
         targetCtx.beginPath();
         targetCtx.moveTo(0, height);
         for(let i = 0; i <= width + 50; i += 50) {
             const hOffset = Math.sin(i * 0.02) * 15 * globalSnowAccum;
             targetCtx.lineTo(i, height - 25 * globalSnowAccum + hOffset);
         }
         targetCtx.lineTo(width, height);
         targetCtx.fill();
      }

      if (logoImg.complete) {
        const logoTargetW = width * 0.06;
        const logoTargetH = logoTargetW * 1.5;
        targetCtx.drawImage(logoImg, width / 2 - logoTargetW / 2, height - logoTargetH - height * 0.04, logoTargetW, logoTargetH);
      }

      // -- Render left gradient mask --
      const gradientW = width * 0.45; // gradient covering 45% of width
      const gradient = targetCtx.createLinearGradient(0, 0, gradientW, 0);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0.9)');
      gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.6)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      targetCtx.fillStyle = gradient;
      targetCtx.fillRect(0, 0, gradientW, height);

      // -- Render code semi-transparently --
      targetCtx.save();
      targetCtx.beginPath();
      targetCtx.rect(0, 0, gradientW, height);
      targetCtx.clip();
      
      const fontSize = Math.max(14, height * 0.015);
      const lineHeight = Math.max(20, height * 0.022);
      targetCtx.font = `${fontSize}px 'JetBrains Mono', ui-monospace, monospace`;
      
      const totalContentHeight = codeLines.length * lineHeight;
      const loopTime = 8333 * 0.002; 
      const progress = (time % loopTime) / loopTime;
      
      targetCtx.globalAlpha = 0.5; // Make the code semi-transparent
      
      const scrollY = progress * totalContentHeight;
      
      for (let j = 0; j < 2; j++) {
         const yOffset = -scrollY + j * totalContentHeight;
         for(let i = 0; i < codeLines.length; i++) {
             const y = yOffset + i * lineHeight;
             if (y > -lineHeight && y < height + lineHeight) {
                 const line = codeLines[i];
                 targetCtx.fillStyle = '#a8b2d1';
                 if (line.includes('class ') || line.includes('function ')) targetCtx.fillStyle = '#c678dd';
                 else if (line.trim().startsWith('//')) targetCtx.fillStyle = '#5c6370';
                 else if (line.includes('=')) targetCtx.fillStyle = '#61afef';
                 
                 targetCtx.fillText(line, 40, y);
             }
         }
      }
      
      targetCtx.restore(); // restore clip
      
      targetCtx.restore(); 
    };

    const render = () => {
      stepFrame(ctx);
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    exportRef.current = async () => {
      const canvasE = canvasRef.current;
      if (!canvasE) return;
      setIsExporting(true);
      setExportProgress(0);
      cancelAnimationFrame(animationFrameId);

      const oldCW = canvasW;
      const oldCH = canvasH;
      const oldTime = time;

      // Ensure 4K resolution at 4:3 aspect ratio => 2880x2160 (or standard 4K 16:9 3840x2160, but user said 4:3)
      canvasW = 2880;
      canvasH = 2160;
      time = 0;

      init(2880, 2160); 

      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = canvasW;
      offscreenCanvas.height = canvasH;
      const offCtx = offscreenCanvas.getContext('2d', { alpha: false });

      if (!offCtx) {
         setIsExporting(false);
         return;
      }

      try {
        const muxer = new Muxer({
          target: new ArrayBufferTarget(),
          video: { codec: 'avc', width: canvasW, height: canvasH },
          fastStart: 'in-memory'
        });

        const videoEncoder = new VideoEncoder({
          output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
          error: (e: any) => console.error('VideoEncoder error:', e)
        });

        videoEncoder.configure({
          codec: 'avc1.640034',
          width: canvasW,
          height: canvasH,
          bitrate: 35_000_000,
          framerate: 60,
          hardwareAcceleration: 'prefer-software',
        });

        const totalFrames = 8333;
        const cachedCodeLines = rawCodeRef.current.split('\n');

        for (let i = 0; i <= totalFrames; i++) {
          stepFrame(offCtx, cachedCodeLines);

          const bmp = await createImageBitmap(offscreenCanvas);
          const videoFrame = new VideoFrame(bmp, { timestamp: i * 1e6 / 60 });
          videoEncoder.encode(videoFrame);
          videoFrame.close();
          bmp.close();

          while (videoEncoder.encodeQueueSize >= 5) {
            await new Promise(r => setTimeout(r, 10));
          }

          if (i % 60 === 0) {
            setExportProgress(i / totalFrames);
            await new Promise(r => setTimeout(r, 0));
          }
        }

        await videoEncoder.flush();
        muxer.finalize();

        const buffer = muxer.target.buffer;
        const blob = new Blob([buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'showcase_animation_loop_4k_4_3.mp4';
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        console.error("Export failed:", e);
        alert("Video export failed or not supported in this browser.");
      }

      canvasW = oldCW;
      canvasH = oldCH;
      time = oldTime;
      init();
      render();
      setIsExporting(false);
      setExportProgress(0);
    };

    return () => {
      window.removeEventListener('resize', init as any);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const isTD = new URLSearchParams(window.location.search).get('td') === '1';

  return (
    <div className={`fixed inset-0 overflow-hidden bg-neutral-950 selection:bg-transparent flex flex-col items-center justify-center ${isTD ? 'p-0 m-0 bg-black' : 'p-4 sm:p-8'}`}>
      <div 
        ref={containerRef} 
        style={isTD ? { width: '100%', height: '100%' } : {
          width: '100%',
          maxWidth: 'calc((100vh - 8rem) * 1.3333)',
          aspectRatio: '4 / 3'
        }}
        className={`relative bg-[#0b0b0f] shadow-2xl overflow-hidden shrink-0 ${isTD ? 'w-full h-full' : 'rounded-lg sm:rounded-2xl border border-neutral-800'}`}
      >
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>

      {!isTD && (
        <div className="mt-8">
          <button
            onClick={() => exportRef.current?.()}
            disabled={isExporting}
            className="relative px-6 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium rounded-full border border-neutral-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group overflow-hidden"
          >
            {isExporting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Exporting 4K 4:3 Showcase MP4 ({Math.round(exportProgress * 100)}%)
              </span>
            ) : (
              <span>Export 4K Showcase</span>
            )}
            {isExporting && (
               <div 
                 className="absolute bottom-0 left-0 h-0.5 bg-indigo-500 transition-all duration-300"
                 style={{ width: `${exportProgress * 100}%` }}
               />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
