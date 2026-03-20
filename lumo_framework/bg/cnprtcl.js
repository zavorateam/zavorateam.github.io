(function () {
  window.LumoBackgrounds = window.LumoBackgrounds || {};

  // Вспомогательная функция для конвертации HEX в RGB
  function hexToRgb(hex) {
    if (!hex) return '0,0,0';
    hex = hex.trim();
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}` : '0,0,0';
  }

  class CnprtclBG {
    constructor(canvasOrDiv, opts = {}) {
      this.opts = opts || {};
      this.containerId = 'lumo-particles-' + Math.floor(Math.random() * 1000000);
      
      this.canvas = document.createElement('canvas');
      this.canvas.id = this.containerId;
      this.canvas.style.position = 'fixed';
      this.canvas.style.inset = '0';
      this.canvas.style.zIndex = '-1';
      this.canvas.style.pointerEvents = 'none';
      
      document.body.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');

      this.config = {
        particleCount: 70,
        connectionDistance: 120,
        mouseDistance: 150,
        baseSpeed: 0.6
      };

      this.particles = [];
      this.mouse = { x: null, y: null };
      this.resizeTimeout = null;

      this._onResize = this._onResize.bind(this);
      this._onMouseMove = this._onMouseMove.bind(this);
      this._onMouseLeave = this._onMouseLeave.bind(this);

      this._init();
    }

    _init() {
      this._setDimensions();
      this._createParticles();
      this._addListeners();
      this._loop();
    }

    _setDimensions() {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }

    _createParticles() {
      this.particles = [];
      for (let i = 0; i < this.config.particleCount; i++) {
        this.particles.push({
          x: Math.random() * this.canvas.width,
          y: Math.random() * this.canvas.height,
          vx: (Math.random() - 0.5) * this.config.baseSpeed * 2,
          vy: (Math.random() - 0.5) * this.config.baseSpeed * 2,
          size: 2 + Math.random(),
          // 0 - будет Зеленый, 1 - будет Контрастный
          variant: Math.random() < 0.5 ? 0 : 1 
        });
      }
    }

    _addListeners() {
      window.addEventListener('resize', this._onResize);
      window.addEventListener('mousemove', this._onMouseMove);
      window.addEventListener('mouseout', this._onMouseLeave);
    }

    _onResize() {
      if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => {
        this._setDimensions();
        if (this.particles.length === 0) this._createParticles();
      }, 100);
    }

    _onMouseMove(e) {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    }

    _onMouseLeave() {
      this.mouse.x = null;
      this.mouse.y = null;
    }
    
    _themePalette() {
        const theme = (document.body && document.body.dataset && document.body.dataset.theme) || (document.documentElement.classList.contains('lumo-dark') ? 'dark' : 'light');
        const doc = getComputedStyle(document.documentElement);
        const topVar = doc.getPropertyValue('--cubic-top').trim();
        const frontVar = doc.getPropertyValue('--cubic-front').trim();
        const sideVar = doc.getPropertyValue('--cubic-side').trim();

        // Определяем цвета. frontColor - это обычно цвет текста, 
        // поэтому он всегда контрастен к bg (цвету фона)
        if (topVar || frontVar || sideVar) {
            return {
                frontColor: frontVar || (theme==='dark'?'rgb(200,200,210)':'rgb(70,70,80)'),
                bg: theme==='dark' ? '#2f2f2f' : '#dcd7e6'
            };
        }
        if (theme === 'dark') {
            return {
                frontColor: `rgb(200,200,210)`, // Светлый для темной темы
                bg: '#2f2f2f'
            };
        } else {
            return {
                frontColor: `rgb(70,70,80)`,   // Темный для светлой темы
                bg: '#dcd7e6'
            };
        }
    }

    _loop() {
      if (!this.ctx || !this.canvas.parentNode) return;

      const w = this.canvas.width;
      const h = this.canvas.height;
      
      const pal = this._themePalette();
      
      // ЗАЛИВАЕМ ФОН ЦВЕТОМ ТЕМЫ
      this.ctx.fillStyle = pal.bg;
      this.ctx.fillRect(0, 0, w, h);

      // ОПРЕДЕЛЯЕМ ЦВЕТА ЧАСТИЦ:
      // 0 -> Ярко-зеленый
      // 1 -> Цвет переднего плана (противоположный фону)
      const particleColors = [
          '#00ff00',      // Green
          pal.frontColor  // Contrast Color
      ];

      for (let i = 0; i < this.particles.length; i++) {
        let p = this.particles[i];

        // Movement
        p.x += p.vx;
        p.y += p.vy;

        // Wall bouncing
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        // Mouse Repulse
        if (this.mouse.x != null) {
          let dx = p.x - this.mouse.x;
          let dy = p.y - this.mouse.y;
          let distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < this.config.mouseDistance) {
            const forceDirectionX = dx / distance;
            const forceDirectionY = dy / distance;
            const force = (this.config.mouseDistance - distance) / this.config.mouseDistance;
            const repulsionStrength = 3; 
            p.x += forceDirectionX * force * repulsionStrength;
            p.y += forceDirectionY * force * repulsionStrength;
          }
        }

        // Текущий цвет (зеленый или контрастный)
        const currentColor = particleColors[p.variant];

        // Draw Particle
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.ctx.fillStyle = currentColor;
        this.ctx.globalAlpha = 0.7;
        this.ctx.fill();

        // Draw Connections
        for (let j = i + 1; j < this.particles.length; j++) {
          let p2 = this.particles[j];
          let dx = p.x - p2.x;
          let dy = p.y - p2.y;
          let dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < this.config.connectionDistance) {
            this.ctx.beginPath();
            let opacity = 1 - (dist / this.config.connectionDistance);
            this.ctx.strokeStyle = currentColor; 
            this.ctx.lineWidth = 0.8;
            this.ctx.globalAlpha = opacity * 0.25;
            this.ctx.moveTo(p.x, p.y);
            this.ctx.lineTo(p2.x, p2.y);
            this.ctx.stroke();
          }
        }
      }
      
      this.ctx.globalAlpha = 1;
      this._raf = requestAnimationFrame(() => this._loop());
    }

    destroy() {
      if (this._raf) cancelAnimationFrame(this._raf);
      window.removeEventListener('resize', this._onResize);
      window.removeEventListener('mousemove', this._onMouseMove);
      window.removeEventListener('mouseout', this._onMouseLeave);
      
      if (this.canvas && this.canvas.parentNode) {
        this.canvas.parentNode.removeChild(this.canvas);
      }
      this.ctx = null;
      this.particles = [];
      return Promise.resolve();
    }
  }

  window.LumoBackgrounds['cnprtcl'] = CnprtclBG;
})();