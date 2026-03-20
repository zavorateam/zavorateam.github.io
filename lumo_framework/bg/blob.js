(function () {
  window.LumoBackgrounds = window.LumoBackgrounds || {};

  function rand(min, max) { return Math.random() * (max - min) + min; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  class BlobEntity {
    constructor(x, y, vx, vy, hue, ctx, w, h) {
      this.ctx = ctx;
      this.x = x; this.y = y;
      this.vx = vx; this.vy = vy;
      this.hue = hue;
      this.size = rand(40, 120);
      this.targetSize = this.size;
      this.rotation = 0;
      this.wobble = 0;
      this.life = rand(0, Math.PI * 2);
      this.width = w; this.height = h;
    }

    update(width, height) {
      this.width = width; this.height = height;
      this.x += this.vx;
      this.y += this.vy;

      // bounce
      if (this.x - this.size < 0 || this.x + this.size > width) {
        this.vx *= -1; this.x = clamp(this.x, this.size, width - this.size);
      }
      if (this.y - this.size < 0 || this.y + this.size > height) {
        this.vy *= -1; this.y = clamp(this.y, this.size, height - this.size);
      }

      this.targetSize = 40 + 40 * Math.sin(this.life);
      this.size += (this.targetSize - this.size) * 0.1;
      this.wobble = Math.sin(this.life * 0.5) * 0.3;
      this.rotation += 0.02;
      this.life += 0.03;
    }

    draw() {
      const ctx = this.ctx;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);

      const sides = 6;
      const points = [];
      for (let i = 0; i < sides; i++) {
        const angle = (Math.PI * 2 / sides) * i;
        const rad = this.size * (1 + this.wobble * Math.sin(this.life + i));
        points.push({ x: Math.cos(angle) * rad, y: Math.sin(angle) * rad });
      }

      // center gradient
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size * 1.1);
      g.addColorStop(0, `hsla(${this.hue},70%,85%,0.95)`);
      g.addColorStop(1, `hsla(${this.hue},60%,40%,0.25)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let p of points) ctx.lineTo(p.x, p.y);
      ctx.closePath();
      ctx.fill();

      // edge glow
      ctx.strokeStyle = `hsla(${this.hue},100%,60%,0.45)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let p of points) ctx.lineTo(p.x, p.y);
      ctx.closePath();
      ctx.stroke();

      ctx.restore();
    }

    interact(mx, my) {
      if (mx == null || my == null) return;
      const dx = this.x - mx, dy = this.y - my;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 150) {
        const angle = Math.atan2(this.y - my, this.x - mx);
        const strength = (1 - (d / 150)) * 5;
        this.vx += Math.cos(angle) * strength * 0.3;
        this.vy += Math.sin(angle) * strength * 0.3;
        this.targetSize += strength;
      }
    }
  }

  class BlobBG {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: true });
      this.opts = opts || {};
      this.raf = null;
      this.blobs = [];
      this.MAX_BLOBS = 22;
      this.MIN_BLOBS = 2;
      this.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
      this._onResize = this._onResize.bind(this);
      this._onPointer = this._onPointer.bind(this);
      this._onDown = this._onDown.bind(this);
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.canvas.width = this.width;
      this.canvas.height = this.height;
      this.mouse = { x: null, y: null, down: false };

      // initial count
      const num = this.isTouch ? 3 : 6;
      for (let i = 0; i < num; i++) this._addBlob(rand(0, this.width), rand(0, this.height));

      window.addEventListener('resize', this._onResize);
      this.canvas.addEventListener('pointermove', this._onPointer);
      this.canvas.addEventListener('pointerdown', this._onDown);
      this.canvas.addEventListener('pointerup', () => { this.mouse.down = false; });
      // context menu disable is handled globally by framework if requested

      this._loop();
    }

    _onResize() {
      this.width = window.innerWidth; this.height = window.innerHeight;
      this.canvas.width = this.width; this.canvas.height = this.height;
    }

    _onPointer(e) {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
    }

    _onDown(e) {
      this.mouse.down = true;
      // left click add blob, right click remove (if pointerType supports)
      if (e.button === 0) {
        this._addBlob(this.mouse.x || this.width / 2, this.mouse.y || this.height / 2);
      } else if (e.button === 2) {
        this._removeRandomBlob();
      }
    }

    _addBlob(x, y) {
      if (this.blobs.length >= this.MAX_BLOBS) return;
      const b = new BlobEntity(
        x || rand(0, this.width),
        y || rand(0, this.height),
        rand(-1.8, 1.8),
        rand(-1.8, 1.8),
        Math.floor(rand(0, 360)),
        this.ctx,
        this.width, this.height
      );
      this.blobs.push(b);
    }

    _removeRandomBlob() {
      if (this.blobs.length <= this.MIN_BLOBS) return;
      const idx = Math.floor(rand(0, this.blobs.length));
      this.blobs.splice(idx, 1);
    }

    _drawLinks() {
      const ctx = this.ctx;
      ctx.save();
      for (let i = 0; i < this.blobs.length; i++) {
        for (let j = i + 1; j < this.blobs.length; j++) {
          const b1 = this.blobs[i], b2 = this.blobs[j];
          const midX = (b1.x + b2.x) / 2, midY = (b1.y + b2.y) / 2;
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = `hsla(${b1.hue},60%,70%,0.35)`;
          ctx.beginPath(); ctx.moveTo(b1.x, b1.y); ctx.lineTo(midX, midY); ctx.stroke();
          ctx.strokeStyle = `hsla(${b2.hue},60%,70%,0.35)`;
          ctx.beginPath(); ctx.moveTo(midX, midY); ctx.lineTo(b2.x, b2.y); ctx.stroke();
        }
      }
      ctx.restore();
    }

    _loop() {
      const ctx = this.ctx;
      const w = this.canvas.width, h = this.canvas.height;
      ctx.clearRect(0, 0, w, h);
      // dark reddish background as in your sample
      ctx.fillStyle = 'rgb(24,12,16)'; // slightly modified very dark red
      ctx.fillRect(0, 0, w, h);

      for (let b of this.blobs) {
        b.update(w, h);
        b.interact(this.mouse.x, this.mouse.y);
        b.draw();
      }
      this._drawLinks();

      this.raf = requestAnimationFrame(() => this._loop());
    }

    destroy() {
      // stop loop
      if (this.raf) cancelAnimationFrame(this.raf);
      window.removeEventListener('resize', this._onResize);
      this.canvas.removeEventListener('pointermove', this._onPointer);
      this.canvas.removeEventListener('pointerdown', this._onDown);
      // try to clear canvas
      try { this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); } catch (e) {}
      return Promise.resolve();
    }

    _mousePressed() {
    if (mouseButton === LEFT) {
      _addBlob(mouseX, mouseY);
      return false;
    } else if (mouseButton === RIGHT) {
      _removeRandomBlob();
      return false;
    }
  }
  }

  window.LumoBackgrounds['blob'] = BlobBG;
})();
