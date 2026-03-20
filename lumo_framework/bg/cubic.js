(function () {
  window.LumoBackgrounds = window.LumoBackgrounds || {};

  function hash(x, y) {
    let h = x * 374761393 + y * 668265263;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) >>> 0) / 4294967295;
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(t) { return t * t * (3 - 2 * t); }
  function noise2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const v00 = hash(xi, yi), v10 = hash(xi + 1, yi), v01 = hash(xi, yi + 1), v11 = hash(xi + 1, yi + 1);
    const u = smoothstep(xf), v = smoothstep(yf);
    const a = lerp(v00, v10, u);
    const b = lerp(v01, v11, u);
    return lerp(a, b, v);
  }

  class CubicBG {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.opts = opts;
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.canvas.width = this.width; this.canvas.height = this.height;
      this.bsize = (this._isMobile() ? 60 : 40);
      this.cols = Math.ceil(this.width / this.bsize) + 2;
      this.rows = Math.ceil(this.height / this.bsize) + 2;
      this.noff = 0;
      this.boxHeights = new Float32Array(this.cols * this.rows);
      this.raf = null;
      this.mouse = { x: this.width / 2, y: this.height / 2, present: false };
      this._onResize = this._onResize.bind(this);
      this._onMouse = this._onMouse.bind(this);
      window.addEventListener('resize', this._onResize);
      window.addEventListener('mousemove', this._onMouse); // only real mouse
      this._initHeights();
      this._loop();
    }

    _isMobile() {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    }

    _initHeights() {
      const max = 400;
      for (let i = 0; i < this.boxHeights.length; i++) this.boxHeights[i] = max;
    }

    _onResize() {
      this.width = window.innerWidth; this.height = window.innerHeight;
      this.canvas.width = this.width; this.canvas.height = this.height;
      this.bsize = (this._isMobile() ? 60 : 40);
      this.cols = Math.ceil(this.width / this.bsize) + 2;
      this.rows = Math.ceil(this.height / this.bsize) + 2;
      this.boxHeights = new Float32Array(this.cols * this.rows);
      this._initHeights();
    }

    _onMouse(e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      const rect = document.documentElement.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
      this.mouse.present = true;
    }

    _themePalette() {
        const theme = (document.body && document.body.dataset && document.body.dataset.theme) || (document.documentElement.classList.contains('lumo-dark') ? 'dark' : 'light');
        const doc = getComputedStyle(document.documentElement);
        const topVar = doc.getPropertyValue('--cubic-top').trim();
        const frontVar = doc.getPropertyValue('--cubic-front').trim();
        const sideVar = doc.getPropertyValue('--cubic-side').trim();
        if (topVar || frontVar || sideVar) {
            return {
            topColor: (alpha=1)=> topVar ? `rgba(${hexToRgb(topVar)},${alpha})` : (theme==='dark'?`rgba(120,120,130,${alpha})`:`rgba(220,220,230,${alpha})`),
            frontColor: frontVar || (theme==='dark'?'rgb(70,70,80)':'rgb(200,200,210)'),
            sideColor: sideVar || (theme==='dark'?'rgb(45,45,50)':'rgb(170,170,180)'),
            bg: theme==='dark' ? '#2f2f2f' : '#dcd7e6'
            };
        }
        if (theme === 'dark') {
            return {
            topColor: (alpha=1) => `rgba(120,120,130,${alpha})`,
            frontColor: `rgb(70,70,80)`,
            sideColor: `rgb(45,45,50)`,
            bg: '#2f2f2f'
        };
        } else {
            return {
            topColor: (alpha=1) => `rgba(220,220,230,${alpha})`,
            frontColor: `rgb(200,200,210)`,
            sideColor: `rgb(170,170,180)`,
            bg: '#dcd7e6'
            };
        }
    }

    _loop() {
      const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
      const pal = this._themePalette();
      ctx.fillStyle = pal.bg;
      ctx.fillRect(0, 0, w, h);

      this.noff += 0.01;

      const baseX = -Math.floor((this.bsize) / 2);
      const baseY = -Math.floor((this.bsize) / 2);

      // compute bump index (nearest cell) — only one
      let bumpIdx = -1;
      if (this.mouse.present) {
        const mx = this.mouse.x - baseX;
        const my = this.mouse.y - baseY;
        const gx = Math.floor(mx / this.bsize);
        const gy = Math.floor(my / this.bsize);
        const gxc = Math.max(0, Math.min(this.cols - 1, gx));
        const gyc = Math.max(0, Math.min(this.rows - 1, gy));
        bumpIdx = gxc + gyc * this.cols;
      }

      for (let gx = 0; gx < this.cols; gx++) {
        for (let gy = 0; gy < this.rows; gy++) {
          const x = gx * this.bsize + baseX;
          const y = gy * this.bsize + baseY;
          const nx = (gx / this.cols) * 5;
          const ny = (gy / this.rows) * 5;
          const desired = 20 + noise2(nx + this.noff, ny) * 600;
          const idx = gx + gy * this.cols;
          const cur = this.boxHeights[idx] || 0;
          const k = cur < desired ? 0.35 : 0.04;
          this.boxHeights[idx] = cur + (desired - cur) * k;

          if (idx === bumpIdx) {
            this.boxHeights[idx] += 160; // bump only one cell (nearest)
          }

          const hval = this.boxHeights[idx];
          this._drawBox(ctx, x, y, this.bsize, hval, pal);
        }
      }

      this.raf = requestAnimationFrame(() => this._loop());
    }

    _drawBox(ctx, x, y, size, hval, pal) {
      const maxH = 700;
      const z = Math.min(maxH, Math.max(8, hval));
      const topColor = pal.topColor(1.0);
      const frontColor = pal.frontColor;
      const sideColor = pal.sideColor;

      const px = x;
      const py = y;
      ctx.fillStyle = topColor;
      ctx.fillRect(px, py - z * 0.12, size - 2, size - 2);
      ctx.fillStyle = frontColor;
      ctx.fillRect(px, py - z * 0.12 + (size - 2), size - 2, z * 0.12);
      ctx.fillStyle = sideColor;
      ctx.fillRect(px + (size - 2), py - z * 0.12, z * 0.12, size - 2 + z * 0.12);
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(px, py - z * 0.12, size - 2, size - 2 + z * 0.12);
    }

    destroy() {
      if (this.raf) cancelAnimationFrame(this.raf);
      window.removeEventListener('resize', this._onResize);
      window.removeEventListener('mousemove', this._onMouse);
      try { this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); } catch (e) {}
      return Promise.resolve();
    }
  }

  window.LumoBackgrounds['cubic'] = CubicBG;
})();
