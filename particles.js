let particles = [];
const numParticles = 200;
const waveSpeed = 0.01;
const particleSize = 5;
const baseHue = 200;

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 1);

  for (let i = 0; i < numParticles; i++) {
    particles.push({
      x: random(width),
      y: random(height),
      z: random(TWO_PI),
      hue: baseHue + random(-20, 20)
    });
  }
}

function draw() {
  background(220,0,10);
  noStroke();

  for (let i = 0; i < numParticles; i++) {
    let p = particles[i];

    let angle = p.z + frameCount * waveSpeed;
    let displacement = map(sin(angle), -1, 1, -20, 20);
    let yOffset = map(noise(p.x * 0.01, p.y * 0.01, frameCount * 0.005), 0, 1, -50, 50);

    let particleY = p.y + displacement + yOffset;

    let distance = dist(mouseX, mouseY, p.x, particleY);
    if (distance < 50) {
      let angleToMouse = atan2(particleY - mouseY, p.x - mouseX);
      p.x += cos(angleToMouse) * 2;
      p.y += sin(angleToMouse) * 2;

      p.x = constrain(p.x, 0, width);
      p.y = constrain(p.y, 0, height);
    }

    fill(p.hue, 80, 80, 0.7);
    ellipse(p.x, particleY, particleSize, particleSize);

    p.z += 0.02;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
} 