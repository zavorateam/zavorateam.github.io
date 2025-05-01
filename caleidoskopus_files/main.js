const downloadSVG = (polyJS) => {
  function Polygon() {
    var pointList = [];

    this.node = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');

    function build(arg) {
      var res = [];
      for (var i = 0, l = arg.length; i < l; i++) {
          res.push(arg[i].join(','));
      }
      return res.join(' ');
    }

    this.attribute = function (key, val) {
      if (val === undefined) return this.node.getAttribute(key);
      this.node.setAttribute(key, val);
    };

    this.getPoint = function (i) {
      return pointList[i]
    };

    this.setPoint = function (i, x, y) {
      pointList[i] = [x, y];
      this.attribute('points', build(pointList));
    };

    this.points = function () {
      for (var i = 0, l = arguments.length; i < l; i += 2) {
        pointList.push([arguments[i], arguments[i + 1]]);
      }
      this.attribute('points', build(pointList));
    };

    this.points.apply(this, arguments);
  }

  polyj = polyJS

  all = []

  var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.innerHTML = `<style> .p1 { stroke-width: 0.5px; stroke-linecap: round; } .p2 {fill: none; stroke-width: 2px;} .p3 {stroke-linecap: round; stroke-width: 5px; fill: none;}</style>`
  polyj.scene.forEach((scene, sceneIndex) => {

    const sceneS = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const scale = (sceneIndex + 1) / (polyj.scene.length) * 0.65

    sceneS.setAttribute('transform', `translate(${(polyj.appDimension/2)*(1-scale)} ${(polyj.appDimension/2)*(1-scale)}) scale(${scale}) rotate(${Math.ceil(scene.rotation * (180 / Math.PI))} ${polyj.appDimension / 2} ${polyj.appDimension / 2})`)

    if (scene.poly.length > 0) {
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      for (const poly of scene.poly) {
        var polygon = new Polygon(poly[1][0], poly[1][1], poly[1][2], poly[1][3], poly[1][4], poly[1][5], poly[1][6], poly[1][7]);
        polygon.attribute('style', `fill: rgb(${poly[0][0]},${poly[0][1]},${poly[0][2]}); transform-origin: ${poly[1][0]}px ${poly[1][0]}px; stroke: rgb(${poly[0][0]},${poly[0][1]},${poly[0][2]});`);
        polygon.node.classList.add('p1')
        group.appendChild(polygon.node);
      }
      sceneS.appendChild(group);
    }

    if (scene.triangles.length > 0) {
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      for (const tri of scene.triangles) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

        path.setAttribute('d', `M ${tri[1][0][0]} ${tri[1][0][1]} L ${tri[1][0][0] - tri[1][1]} ${tri[1][0][1]} L ${tri[1][0][0]} ${tri[1][0][1] - tri[1][2]} L ${tri[1][0][0] + tri[1][1]} ${tri[1][0][1]} L ${tri[1][0][0]} ${tri[1][0][1]}`)
        path.setAttribute('style', `stroke: rgb(${tri[0][0]},${tri[0][1]},${tri[0][2]});`)
        path.classList.add('p2')
        group.appendChild(path);
      }
      sceneS.appendChild(group);
    }

    if (scene.lines.length > 0) {
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      for (const line of scene.lines) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${line[1][1][0]} ${line[1][1][1]} L ${line[1][0][0]} ${line[1][0][1]}`)

        path.setAttribute('style', `stroke: rgb(${line[0][0]},${line[0][1]},${line[0][2]});`)
        path.classList.add('p3')
        group.appendChild(path);
      }
      sceneS.appendChild(group)
    }

    all.push(sceneS)
  })

  all.reverse()
  all.forEach(sceneS => svg.appendChild(sceneS))

  svg.setAttribute('width', polyj.appDimension)
  svg.setAttribute('height', polyj.appDimension)

  svg.setAttribute('viewBox', `0 0 ${polyj.appDimension} ${polyj.appDimension}`)
  
  var blob = new Blob([svg.outerHTML], {type: "image/svg+xml;charset=utf-8"});
  saveAs(blob, "draw.svg");
}

(() => {

  var rotationSpeed = 100
  var dbArrayMaxLength = 30
  var hueArrayMaxLength = 40
  var dotsArrayMaxLength = 625 * 2
  var brushSize = Math.floor(Math.max(Math.min(window.innerWidth, window.innerHeight) / 250, 2))
  var brushAlpha = .65
  var mode = 'poly' // triangle or dots

  window.asc = () => {}

  let appDimension = Math.min(
    window.innerWidth  * window.devicePixelRatio,
    window.innerHeight * window.devicePixelRatio
  )

  let appCenterPoint = new PIXI.Point(
    appDimension / 2,
    appDimension / 2
  )

  var triangleSize = 400 * (appDimension / 2400);
  var triangleSizeSe = Math.sqrt(Math.pow(triangleSize, 2) - Math.pow(triangleSize / 2, 2))

  var app = new PIXI.Application({
    antialias: true,
    autoResize: true,
    backgroundColor: 0x000000,
    width: appDimension,
    height: appDimension,
  })

  app.renderer.view
    .classList
    .add('view')

  app.renderer.view
    .style
    .width = `${appDimension / window.devicePixelRatio}px`

  app.renderer.view
    .style
    .height = `${appDimension / window.devicePixelRatio}px`


  window.addEventListener('resize', () => {
    cre = Math.min(
      window.innerWidth  * window.devicePixelRatio,
      window.innerHeight * window.devicePixelRatio
    )

    app.renderer.view
      .style
      .width = `${cre / window.devicePixelRatio}px`

    app.renderer.view
      .style
      .height = `${cre / window.devicePixelRatio}px`
  })

  document
    .querySelector('.app_')
    .appendChild(app.view)

  window.app = app

  let isPaused = false
  let appstarted = false

  document.querySelector('.controls-drawing_pause').addEventListener('click', () => {
    isPaused = !isPaused
    if (isPaused) {
      playcontrol.classList.remove('paused')
      playcontrol.classList.add('playing')
    }
    else {
      playcontrol.classList.add('paused')
      playcontrol.classList.remove('playing')
    }
  })

  var scene = new PIXI.Container()
  scene.pivot = appCenterPoint
  scene.position = appCenterPoint
  scene.sortableChildren = true;

  scene.zIndex = 0

  /* Элементы */
  var containerRotation = 0
  var container = new PIXI.Container()

  container.pivot = appCenterPoint
  container.position = appCenterPoint
  container.width  = appDimension
  container.height = appDimension
  container.sortableChildren = true;

  container.zIndex = -5

  var staticContainer = new PIXI.Container()

  staticContainer.pivot = appCenterPoint
  staticContainer.position = appCenterPoint
  staticContainer.width = appDimension
  staticContainer.height = appDimension

  staticContainer.zIndex = -5


  var brush = new PIXI.Graphics()

  brush.beginFill(0xff0000, 0)
  brush.drawCircle(appDimension / 2, appDimension / 2, brushSize)
  brush.endFill()

  staticContainer.addChild(brush)
  scene.addChild(staticContainer)
  scene.addChild(container)

  var dots = []
  var dbArray = []
  var hueArray = []

  var oldDotPos = [
    appDimension / 2,
    appDimension / 2
  ]

  var trueDB = 0

  const calculateColor = (freqIndex) => {

    var trueHue = freqIndex
    hueArray.push(freqIndex)

    if (hueArray.length > hueArrayMaxLength) {
      hueArray.shift()
    }

    trueHue = 0

    hueArray.map( (hueValue, hueIndex) => {
      trueHue += hueValue / (hueArray.length - Math.pow(hueIndex, 2/3))
    })

    trueHue *= 1

    var rgb = hsl2rgb(trueHue, 1, .5)
    return [rgb2hex(rgb), rgb]
  }

  const calculateTrueDB = (db) => {
    dbArray.push(db)

    if ( dbArray.length > dbArrayMaxLength ) {
      dbArray.shift()
    }

    var trueDB = 0

    dbArray.map((dbValue, dbIndex) => {
      trueDB += dbValue / (dbArray.length - Math.pow(dbIndex, 2/3))
    })

    trueDB *= 1

    return trueDB
  }

  const rotateContainer = () => {
    // console.log(containerRotation)
    containerRotation++
    if ( containerRotation >= 360 * rotationSpeed ) containerRotation %= 360 * rotationSpeed
  }

  var wasRound = false
  var rounds = 0

  var staticScenes = []
  window.ddd = {scene: [{poly: [], triangles: [], lines: [], rotation: 0, scale: 1}], appDimension}

  /* Анимация звука */
  var s = new Sound((frequencyDataArray, timeDomainDataArray) => {

    if (!isPaused) {
      const db = getDB(timeDomainDataArray)
      const freqIndex = getFreqIndex(frequencyDataArray) / frequencyDataArray.length * 3

      const color = calculateColor(freqIndex)[0]
      const color_rgb = calculateColor(freqIndex)[1]
      const trueDB = calculateTrueDB(db)

      rotateContainer()

      brush.position.y = - appDimension / 2 * trueDB / 128

      // clone brush
      const angle = (containerRotation) / rotationSpeed + Math.PI
      const radius = Math.sqrt(Math.pow(brush.position.x, 2) + Math.pow(brush.position.y, 2))
      const rotateDeg = Math.ceil(((container.rotation) * 180 / Math.PI) - (360 * rounds))

      var newDot = new PIXI.Graphics()

      var newDotPos = [
        appDimension / 2 + radius * Math.sin(angle),
        appDimension / 2 + radius * Math.cos(angle)
      ]

      if (mode == 'poly') {

        newDot.beginFill(color, 1)

        newDot.drawPolygon([
          appDimension / 2,
          appDimension / 2,
          newDotPos[0],
          newDotPos[1],
          oldDotPos[0],
          oldDotPos[1],
          appDimension / 2,
          appDimension / 2
        ])
        newDot.endFill()

        window.ddd.scene[window.ddd.scene.length - 1].poly.push([color_rgb, [
          appDimension / 2,
          appDimension / 2,
          newDotPos[0],
          newDotPos[1],
          oldDotPos[0],
          oldDotPos[1],
          appDimension / 2,
          appDimension / 2
        ]])
      }

      else if (mode == 'dots') {

        newDot.beginFill(color, brushAlpha)

        newDot.drawCircle(
          newDotPos[0],
          newDotPos[1],
          brushSize
        )
        newDot.endFill()
      }

      else if (mode == 'triangles') {
        newDot.lineStyle(2, color, 1, 0.5, false)
        newDot.moveTo(newDotPos[0], newDotPos[1])
        newDot.lineTo(newDotPos[0] - (triangleSize / 2), newDotPos[1])
        newDot.lineTo(newDotPos[0], newDotPos[1] - triangleSizeSe)
        newDot.lineTo(newDotPos[0] + (triangleSize / 2), newDotPos[1])
        newDot.lineTo(newDotPos[0], newDotPos[1])

        window.ddd.scene[window.ddd.scene.length - 1].triangles.push(
          [color_rgb, [newDotPos, triangleSize / 2, triangleSizeSe]]
        )
      }

      else if (mode == 'lines') {
        newDot.lineStyle(5, color, 1, 0.5, false)
        newDot.moveTo(oldDotPos[0], oldDotPos[1])
        newDot.lineTo(newDotPos[0], newDotPos[1])

        window.ddd.scene[window.ddd.scene.length - 1].lines.push(
          [color_rgb, [newDotPos, oldDotPos]]
        )
        // newDot.lineTo(newDotPos[0] + 20, newDotPos[1] + 20)
      }


      container.addChild(newDot)
      dots.push(newDot)
      oldDotPos = newDotPos

      if (dotsArrayMaxLength && dots.length > dotsArrayMaxLength) {
        var oldDot = dots.shift()
        container.removeChild(oldDot)
      }

      container.rotation = containerRotation / rotationSpeed
      window.ddd.scene[window.ddd.scene.length - 1].rotation = container.rotation

      staticScenes.forEach((static, index) => {
        // static.rotation += 0.01 * (index + 1)
        static.rotation += 0.008 * ((index + 1) / staticScenes.length)

        window.ddd.scene[index].rotation = static.rotation

        // console.log(index, static.rotation, 'roror')
      })
      // if (Math.ceil(container.rotation * 180 / Math.PI) == 360) {
      //   console.log('split')
      // }
      // console.log(Math.ceil(container.rotation * 180 / Math.PI))

      // console.log(rotateDeg)

      window.s = staticScenes

      if (rotateDeg == 360) {
        if (!wasRound) {
          brush.destroy()
          container.cacheAsBitmap = true
          staticScenes.push(container)

          console.log(staticScenes[0])

          if (staticScenes.length > 6) {
            staticScenes[0].destroy()
            staticScenes.shift()

            window.ddd.scene.shift()
          }

          container = new PIXI.Container()

          container.zIndex = -50

          container.pivot = appCenterPoint
          container.position = appCenterPoint
          container.width  = appDimension
          container.height = appDimension
          container.sortableChildren = true;

          staticContainer = new PIXI.Container()

          staticContainer.zIndex = -50

          staticContainer.pivot = appCenterPoint
          staticContainer.position = appCenterPoint
          staticContainer.width = appDimension
          staticContainer.height = appDimension


          brush = new PIXI.Graphics()

          brush.beginFill(0xff0000, 0)
          brush.drawCircle(appDimension / 2, appDimension / 2, brushSize)
          brush.endFill()

          staticContainer.addChild(brush)
          scene.addChild(staticContainer)
          scene.addChild(container)
          // scene.addChild(f)

          staticScenes.forEach(static => {
            // console.log(static.scale)

            // static.scale.x *= 0.65
            // static.scale.y *= 0.65
            static.zIndex += 1
          })
          staticScenes.forEach((static, staticIndex) => {

            let inter = false
            let r = static.scale.x
            let s = static.scale.x * 0.35
            let timer = 0

            const easeInOutQuint = (t) => { return t<.5 ? 16*t*t*t*t*t : 1+16*(--t)*t*t*t*t }

            inter = setInterval(() => {
              conf = timer / 400

              static.scale.x = r - (s * easeInOutQuint(conf))
              static.scale.y = r - (s * easeInOutQuint(conf))

              // static.scale.x -= 0.005
              // static.scale.y -= 0.005

              // if (static.scale.x <= s) {
              //   clearInterval(inter)
              // }

              ++timer

              if (timer == 400) {
                clearInterval(inter)
              }
            }, 2 * staticIndex)
          })
          window.ddd.scene.push({poly: [], triangles: [], lines: [], rotation: 0, scale: 1})
          ++rounds
        }
        wasRound = true
      } else {
        wasRound = false
      }

      // staticScenes.forEach(scene_ => app.renderer.render(scene_))

      // console.log(rotateDeg == 360 && !wasRound)

      // window.app = app

      // console.log(staticScenes, scene)

      if (rotateDeg == 360 && !wasRound) {
        
      }
    }

    app.renderer.render(scene)

  }, 32)

  const refresh = () => {
    window.ddd = {scene: [{poly: [], triangles: [], lines: [], rotation: 0, scale: 1}], appDimension}
    staticScenes = []
    scene = new PIXI.Container()
    scene.pivot = appCenterPoint
    scene.position = appCenterPoint
    scene.sortableChildren = true;

    scene.zIndex = 0
    container = new PIXI.Container()

    container.zIndex = -50

    container.pivot = appCenterPoint
    container.position = appCenterPoint
    container.width  = appDimension
    container.height = appDimension
    container.sortableChildren = true;

    staticContainer = new PIXI.Container()

    staticContainer.zIndex = -50

    staticContainer.pivot = appCenterPoint
    staticContainer.position = appCenterPoint
    staticContainer.width = appDimension
    staticContainer.height = appDimension


    brush = new PIXI.Graphics()

    brush.beginFill(0xff0000, 0)
    brush.drawCircle(appDimension / 2, appDimension / 2, brushSize)
    brush.endFill()

    scene.addChild(staticContainer)
    scene.addChild(container)

    isPaused = false
    playcontrol.classList.add('paused')
    playcontrol.classList.remove('playing')
  }

  document.querySelector('.controls-drawing_refresh').addEventListener('click', refresh)
  startBtn = document.querySelector('.start_btn')
  const playcontrol = document.querySelector('.controls-drawing_pause')
  document.addEventListener('keydown', (e) => {
    if (e.key == "r") {
      refresh()
    } else if (e.code == "Space") {

      if (appstarted) {
        isPaused = !isPaused

        if (isPaused) {
          playcontrol.classList.remove('paused')
          playcontrol.classList.add('playing')
        }
        else {
          playcontrol.classList.add('paused')
          playcontrol.classList.remove('playing')
        }
      } else {
        startBtn.classList.add('hidden')
        s.play()
        appstarted = true
        document.querySelector('.controls-drawing').classList.add('show')
      }
    }
  })

  document.querySelector('.download_svg').addEventListener('click', () => {
    downloadSVG(window.ddd)
  })

  document.querySelector('.download_png').addEventListener('click', () => {
    downloadAsPNG(app.renderer, scene, "draw.png")
  })

  startBtn.addEventListener('click', () => {
    startBtn.classList.add('hidden')
    s.play()
    appstarted = true
    document.querySelector('.controls-drawing').classList.add('show')
  })

  document.querySelectorAll('.changemode').forEach(modebtn => {
    modebtn.addEventListener('click', () => {
      mode = modebtn.attributes['data-mode'].value

      document.querySelectorAll('.changemode').forEach(mbtn => {
        mbtn.classList.remove('active')
      })

      modebtn.classList.add('active')
    })
  })

})()