class Sound {
  constructor(animationFunction, fftSize) {
    this.context = new (window.AudioContext || window.webkitAudioContext)();
    this.fftSize = fftSize || 1024;
    this.nodes = {};
    this.isPlaying = false;
    this.animationFunction = animationFunction;
  }

  play() {
    if( !this.isPlaying ) {
      this.buildNodes();
      this.nodes.oscillator.start();
      this.isPlaying = true;
      this.draw();
    }
  }
}

Sound.prototype.buildNodes = function () {
  this.nodes.analyser = this.context.createAnalyser();
  this.nodes.analyser.fftSize = this.fftSize;
  this.nodes.analyser.bufferLength = this.nodes.analyser.fftSize;
  this.timeDomainDataArray = new Uint8Array(this.nodes.analyser.bufferLength);
  this.frequencyDataArray = new Uint8Array(this.nodes.analyser.bufferLength);
  this.nodes.oscillator = this.context.createOscillator();

  // Mic & Splitter & Gain
  if ( navigator.mediaDevices ) {
    console.log("Mic accepted")
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then( stream => {
        this.nodes.mic = this.context.createMediaStreamSource(stream);
        this.nodes.micGain = this.context.createGain();
        this.nodes.micGain.gain.setValueAtTime(7, this.context.currentTime);
        this.nodes.mic.connect(this.nodes.micGain);
        this.nodes.micGain.connect(this.nodes.analyser);

      })
      .catch( function(err) {
        console.log('The following gUM error occured: ' + err);
      });
  }
  else {
    console.log("Mic error")
  }
}

Sound.prototype.draw = function() {
  if (!this.isPlaying) return false;
  this.animationFrame = requestAnimationFrame(this.draw.bind(this));
  this.nodes.analyser.getByteTimeDomainData(this.timeDomainDataArray);
  this.nodes.analyser.getByteFrequencyData(this.frequencyDataArray);
  this.animationFunction(this.frequencyDataArray, this.timeDomainDataArray);
}
