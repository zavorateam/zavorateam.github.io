export class LumoBackground {
  constructor(type) {
    this.type = type;
    this.canvas = null;
    this.isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ) || window.innerWidth <= 768;
  }

  mount(container) {
    this.container = container;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "lumo-bg-canvas";
    this.container.appendChild(this.canvas);

    this.resize();
    window.addEventListener("resize", () => this.resize());

    // ✅ Иначе — обычные режимы
    if (this.type === "blocks") this.initBlocks();
    else if (this.type === "dots") this.initDots();
    else if (this.type === "gradiento" || this.type === "gradient") this.initGradient();
    else this.setSolidColor(root.getPropertyValue("--bg-color").trim());
  }

  setSolidColor(color) {
    const ctx = this.canvas.getContext("2d");
    ctx.fillStyle = this.parseColor(color);
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  resize() {
    this.canvas.width = this.container.clientWidth;
    this.canvas.height = this.container.clientHeight;
  }

  // Безопасная обработка цвета
  parseColor(color) {
    if (!color) return "#ffffff"; // fallback
    color = color.trim();
    // короткий hex в полный
    if (/^#([0-9a-f]{3})$/i.test(color)) {
      color =
        "#" +
        color[1] +
        color[1] +
        color[2] +
        color[2] +
        color[3] +
        color[3];
    }
    // проверка валидности через canvas
    const test = document.createElement("canvas").getContext("2d");
    test.fillStyle = color;
    if (test.fillStyle === "") return "#ffffff";
    return test.fillStyle;
  }

  adjustBrightness(hex, amount) {
    let usePound = false;
    if (hex[0] === "#") {
      hex = hex.slice(1);
      usePound = true;
    }
    const num = parseInt(hex, 16);
    let r = (num >> 16) + amount;
    let g = ((num >> 8) & 0x00ff) + amount;
    let b = (num & 0x0000ff) + amount;
    r = Math.min(Math.max(0, r), 255);
    g = Math.min(Math.max(0, g), 255);
    b = Math.min(Math.max(0, b), 255);
    return (
      (usePound ? "#" : "") +
      (b | (g << 8) | (r << 16)).toString(16).padStart(6, "0")
    );
  }

  mixColors(c1, c2, t) {
    const p = parseInt;
    const toRGB = (c) =>
      c.length === 4 ? "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c;
    c1 = this.parseColor(toRGB(c1));
    c2 = this.parseColor(toRGB(c2));
    const r1 = p(c1.substr(1, 2), 16),
      g1 = p(c1.substr(3, 2), 16),
      b1 = p(c1.substr(5, 2), 16);
    const r2 = p(c2.substr(1, 2), 16),
      g2 = p(c2.substr(3, 2), 16),
      b2 = p(c2.substr(5, 2), 16);
    const r = Math.round(r1 + (r2 - r1) * t),
      g = Math.round(g1 + (g2 - g1) * t),
      b = Math.round(b1 + (b2 - b1) * t);
    return `rgb(${r},${g},${b})`;
  }

initGradient() {
  const ctx = this.canvas.getContext("2d");
  const root = getComputedStyle(document.documentElement);

  let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  let prev = { ...mouse };
  let speed = 0;

  window.addEventListener("mousemove", e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  const mixColors = (c1, c2, t) => {
    const p = parseInt;
    const toRGB = c => {
      if (c.startsWith("rgb")) return c.match(/\d+/g).map(Number);
      if (c.startsWith("#")) {
        if (c.length === 4) c = "#" + c[1]+c[1]+c[2]+c[2]+c[3]+c[3];
        return [p(c.substr(1,2),16), p(c.substr(3,2),16), p(c.substr(5,2),16)];
      }
      return [0,0,0]; // fallback
    };
    const [r1,g1,b1] = toRGB(c1);
    const [r2,g2,b2] = toRGB(c2);
    const r = Math.round(r1 + (r2-r1)*t);
    const g = Math.round(g1 + (g2-g1)*t);
    const b = Math.round(b1 + (b2-b1)*t);
    return `rgb(${r},${g},${b})`;
  };

  const adjustBrightness = (hex, amount) => {
    if (!hex.startsWith("#")) return hex;
    let c = hex.slice(1);
    if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
    let num = parseInt(c,16);
    let r = Math.min(255, Math.max(0, (num >> 16)+amount));
    let g = Math.min(255, Math.max(0, ((num>>8)&0xff)+amount));
    let b = Math.min(255, Math.max(0, (num & 0xff)+amount));
    return "#" + ((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
  };

  const loop = () => {
    const theme = document.body.dataset.theme || localStorage.getItem("lumo-theme") || "light";
    const bg1 = root.getPropertyValue("--bg-color").trim();
    const bg2 = adjustBrightness(bg1, theme==="dark" ? -30 : 30);

    // скорость мыши
    const dx = mouse.x - prev.x;
    const dy = mouse.y - prev.y;
    const v = Math.sqrt(dx*dx + dy*dy);
    speed += (v - speed)*0.1;
    prev = {...mouse};

    const radius = 120 + Math.min(speed*4, 250);

    // --- Плавный линейный градиент с 5 слоями ---
    const grad = ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
    grad.addColorStop(0, bg1);
    grad.addColorStop(0.25, mixColors(bg1,bg2,0.25));
    grad.addColorStop(0.5, mixColors(bg1,bg2,0.5));
    grad.addColorStop(0.75, mixColors(bg1,bg2,0.75));
    grad.addColorStop(1, bg2);
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,this.canvas.width,this.canvas.height);

    // --- Эффект стеклянного круга под мышью ---
    const radial = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, radius);
    const accent = theme==="dark" ? mixColors(bg1,"#000000",0.5) : mixColors(bg1,"#ffffff",0.5);
    radial.addColorStop(0, accent);
    radial.addColorStop(0.6, mixColors(accent,bg2,0.3));
    radial.addColorStop(1, "transparent");
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = radial;
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, radius, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;

    requestAnimationFrame(loop);
  };

  loop();
}


  initBlocks() {
    if (typeof p5 === "undefined")
      return console.warn("p5.js required for blocks background");
    new p5((p) => {
      let boxes = [],
        bsize,
        amx,
        amy;
      p.setup = () => {
        bsize = this.isMobile ? 60 : 40;
        amx = Math.ceil(p.windowWidth / bsize) + 1;
        amy = Math.ceil(p.windowHeight / bsize) + 1;
        boxes = new Array(amx * amy).fill(400);
        p.createCanvas(p.windowWidth, p.windowHeight, p.WEBGL).parent(
          this.container
        );
        p.rectMode(p.CENTER);
        p.ortho(
          -p.width / 2,
          p.width / 2,
          -p.height / 2,
          p.height / 2,
          10,
          2000
        );
      };
      p.draw = () => {
        p.background(100);
        p.directionalLight(255, 255, 255, -p.PI * 0.3, p.PI * 0.3, -p.PI * 0.6);
        p.translate(0, -10, 250);
        p.rotateX(-0.2);
        p.rotateY(0.2);
        for (let x = 0; x < p.width; x += bsize) {
          for (let y = 0; y < p.height; y += bsize) {
            let h =
              p.noise(p.frameCount * 0.01, (x / p.width) * 10, (y / p.height) * 10) *
              250;
            p.push();
            p.translate(-p.width / 2 + x, -p.height / 2 + y);
            p.box(bsize, bsize, h);
            p.pop();
          }
        }
      };
      p.windowResized = () =>
        p.resizeCanvas(p.windowWidth, p.windowHeight);
    });
  }

  initDots() {
    if (typeof p5 === "undefined")
      return console.warn("p5.js required for dots background");
    new p5((p) => {
      let particles = [],
        numParticles,
        baseHue = 200;
      p.setup = () => {
        p.createCanvas(p.windowWidth, p.windowHeight).parent(this.container);
        p.colorMode(p.HSB, 360, 100, 100, 1);
        numParticles = this.isMobile ? 50 : 200;
        for (let i = 0; i < numParticles; i++) {
          particles.push({
            x: p.random(p.width),
            y: p.random(p.height),
            z: p.random(p.TWO_PI),
            hue: baseHue + p.random(-20, 20),
          });
        }
      };
      p.draw = () => {
        p.background(220, 0, 10);
        p.noStroke();
        particles.forEach((particle) => {
          let angle = particle.z + p.frameCount * 0.01;
          let displacement = p.map(Math.sin(angle), -1, 1, -20, 20);
          let yOffset = p.map(
            p.noise(
              particle.x * 0.01,
              particle.y * 0.01,
              p.frameCount * 0.005
            ),
            0,
            1,
            -50,
            50
          );
          particle.y += displacement + yOffset;
          p.fill(particle.hue, 80, 80, 0.7);
          p.ellipse(particle.x, particle.y, 5, 5);
          particle.z += 0.02;
        });
      };
      p.windowResized = () =>
        p.resizeCanvas(p.windowWidth, p.windowHeight);
    });
  }
}
