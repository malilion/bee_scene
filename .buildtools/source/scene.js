
    import * as THREE from 'three';
    import { PETAL_ATLAS_DATA, MATERIAL_ATLAS_DATA } from '@scene-textures';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
    import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
    import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
    import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
    import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
    import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';

    // ==========================================
    // 1. 場景、PBR 環境反射 (PMREM) 與 UnrealBloomPass
    // ==========================================
    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x88c9e8);
    scene.fog = new THREE.FogExp2(0xc9d5c0, 0.0075);

    const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.05, 220);
    camera.position.set(11.5, 8.2, 14.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // 建立程序化真實自然環境反射貼圖 (PMREM Environment Map)，提升幾丁質、複眼、露珠與翅膀的寫實度
    function buildNaturalEnvMap() {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      const envScene = new THREE.Scene();
      const skyGeo = new THREE.SphereGeometry(50, 32, 16);
      const pos = skyGeo.attributes.position;
      const colors = new Float32Array(pos.count * 3);
      const cTop = new THREE.Color(0x5da9e9);
      const cHorizon = new THREE.Color(0xfff5d6);
      const cGround = new THREE.Color(0x2d5a27);
      const tmp = new THREE.Color();

      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i) / 50;
        if (y >= 0) {
          tmp.lerpColors(cHorizon, cTop, Math.pow(y, 0.55));
        } else {
          tmp.lerpColors(cHorizon, cGround, Math.min(1, -y * 2.2));
        }
        colors[i * 3] = tmp.r;
        colors[i * 3 + 1] = tmp.g;
        colors[i * 3 + 2] = tmp.b;
      }
      skyGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
      envScene.add(new THREE.Mesh(skyGeo, skyMat));

      const sunSpot = new THREE.Mesh(
        new THREE.SphereGeometry(4, 16, 16),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.5, 4) })
      );
      sunSpot.position.set(20, 28, 15);
      envScene.add(sunSpot);

      const envRT = pmremGenerator.fromScene(envScene, 0.03);
      pmremGenerator.dispose();
      return envRT.texture;
    }
    scene.environment = buildNaturalEnvMap();
    scene.environmentIntensity = 0.48;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.08,
      0.25,
      1.25
    );
    composer.addPass(bloomPass);
    bloomPass.enabled = false;
    const bokehPass = new BokehPass(scene, camera, { focus: 4, aperture: 0.0017, maxblur: 0.012 });
    bokehPass.enabled = false;
    // Invisible overlays and wing membranes must not write opaque macro depth.
    const renderBokeh = bokehPass.render.bind(bokehPass);
    bokehPass.render = (...args) => {
      const hidden = [];
      scene.traverse(object => {
        if (!object.visible || !object.material) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        if (materials.some(material => material.transparent)) { hidden.push(object); object.visible = false; }
      });
      try { renderBokeh(...args); } finally { hidden.forEach(object => { object.visible = true; }); }
    };
    composer.addPass(bokehPass);
    composer.addPass(new OutputPass());
    let bloomEnabled = false;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 3.3, 0);
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = 0.16; // 允許超近距離微距觀察蜜蜂與花蕊
    controls.maxDistance = 45;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.19);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xfffbe6, 0x2f5e2e, 0.62);
    hemiLight.position.set(0, 35, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff4d6, 2.2);
    sunLight.position.set(16, 26, 14);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 75;
    const shadowBound = 18;
    sunLight.shadow.camera.left = -shadowBound;
    sunLight.shadow.camera.right = shadowBound;
    sunLight.shadow.camera.top = shadowBound;
    sunLight.shadow.camera.bottom = -shadowBound;
    sunLight.shadow.bias = -0.00008;
    sunLight.shadow.normalBias = 0.004;
    sunLight.shadow.radius = 3;
    scene.add(sunLight);

    // A small physical shadow frustum resolves tarsi and floret contact at bee scale.
    const contactLight=new THREE.DirectionalLight(0xffedd0,0.55);
    contactLight.castShadow=true;
    contactLight.shadow.mapSize.set(2048,2048);
    Object.assign(contactLight.shadow.camera,{left:-1.1,right:1.1,top:1.1,bottom:-1.1,near:0.1,far:5});
    contactLight.shadow.bias=-0.00006;contactLight.shadow.normalBias=0.0005;
    scene.add(contactLight,contactLight.target);
    function updateContactLighting(position) {
      contactLight.target.position.copy(position);
      contactLight.position.copy(position).addScaledVector(sunLight.position.clone().normalize(),2.5);
      contactLight.color.copy(sunLight.color);
    }

    const sunOrb = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff59d })
    );
    scene.add(sunOrb);

    // ==========================================
    // 2. 高精細寫實程序化貼圖庫 (Photorealistic Procedural Maps)
    // ==========================================
    // Generated photographic material atlases are embedded for offline use.
    let loadedAtlasCount = 0;
    function prepareAtlas(data) {
      const image = new Image(), callbacks = [];
      image.onload = () => {
        callbacks.splice(0).forEach(fn => fn());
        loadedAtlasCount++;
        if (loadedAtlasCount === 2) document.documentElement.dataset.materialsReady = 'true';
      };
      image.onerror = () => { document.documentElement.dataset.materialsReady = 'fallback'; };
      image.src = data;
      return { image, callbacks };
    }
    const petalAtlas = prepareAtlas(PETAL_ATLAS_DATA), materialAtlas = prepareAtlas(MATERIAL_ATLAS_DATA);
    function applyAtlasTile(atlas, tile, map, bumpMap = null, decorate = null) {
      const apply = () => {
        const image = atlas.image, size = 512;
        const col = tile % 3, row = Math.floor(tile / 3);
        const canvas = map.image; canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(image, col * image.width / 3, row * image.height / 2, image.width / 3, image.height / 2, 0, 0, size, size);
        if (decorate) decorate(ctx, size);
        map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); map.needsUpdate = true;
        if (bumpMap) {
          const bc = bumpMap.image; bc.width = bc.height = size;
          const bctx = bc.getContext('2d'); const pixels = ctx.getImageData(0,0,size,size);
          for (let i = 0; i < pixels.data.length; i += 4) {
            const v = 100 + (pixels.data[i] * 0.2126 + pixels.data[i+1] * 0.7152 + pixels.data[i+2] * 0.0722) * 0.21;
            pixels.data[i] = pixels.data[i+1] = pixels.data[i+2] = v;
          }
          bctx.putImageData(pixels,0,0); bumpMap.needsUpdate = true;
        }
      };
      if (atlas.image.complete && atlas.image.naturalWidth > 0) apply(); else atlas.callbacks.push(apply);
    }
    const materialMaps = Array.from({length:6}, (_,tile) => {
      const canvas = document.createElement('canvas'), bumpCanvas = document.createElement('canvas');
      canvas.width = canvas.height = bumpCanvas.width = bumpCanvas.height = 512;
      canvas.getContext('2d').fillStyle = '#827355'; canvas.getContext('2d').fillRect(0,0,512,512);
      const colorMap = new THREE.CanvasTexture(canvas), bumpMap = new THREE.CanvasTexture(bumpCanvas);
      colorMap.colorSpace = THREE.SRGBColorSpace;
      applyAtlasTile(materialAtlas,tile,colorMap,bumpMap);return {colorMap,bumpMap};
    });

    // (a) 柔和花粉微粒貼圖
    function createGlowTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      const grad = ctx.createRadialGradient(32, 32, 1, 32, 32, 30);
      grad.addColorStop(0, 'rgba(255, 255, 240, 1)');
      grad.addColorStop(0.35, 'rgba(255, 215, 65, 0.9)');
      grad.addColorStop(1, 'rgba(255, 160, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(canvas);
    }

    // (b) 寫實西方蜜蜂 (Apis mellifera) 腹部背板 (Tergites) 色彩紋理與絨毛凹凸貼圖
    function createRealisticAbdomenTextures() {
      const w = 512, h = 512;
      const colCanvas = document.createElement('canvas');
      colCanvas.width = w; colCanvas.height = h;
      const ctx = colCanvas.getContext('2d');

      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = w; bumpCanvas.height = h;
      const bCtx = bumpCanvas.getContext('2d');
      bCtx.fillStyle = '#707070';
      bCtx.fillRect(0, 0, w, h);

      // V 從 0 (腹部前端接胸處) 到 1 (腹部末端尖端)
      // 真實西方蜜蜂腹部背板：琥珀蜜金橙色基底 + 深褐黑後緣環帶 + 背板交界細微絨毛帶
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0.00, '#1f140d'); // 第一節前端深色凹槽
      grad.addColorStop(0.06, '#91612f'); // T1 琥珀金橙
      grad.addColorStop(0.18, '#b58044');
      grad.addColorStop(0.22, '#1e130b'); // T1 後緣深褐黑帶
      grad.addColorStop(0.27, '#ba8549'); // T2 寬亮金琥珀色帶
      grad.addColorStop(0.41, '#936134');
      grad.addColorStop(0.45, '#170f09'); // T2 後緣深黑褐帶
      grad.addColorStop(0.51, '#1c120b');
      grad.addColorStop(0.54, '#a4773c'); // T3 琥珀金帶
      grad.addColorStop(0.65, '#805730');
      grad.addColorStop(0.69, '#150d08'); // T3 後緣黑褐帶
      grad.addColorStop(0.75, '#a68c59'); // T4 淺金絨毛帶
      grad.addColorStop(0.81, '#160e09'); // T4-T6 尾端深黑褐錐體
      grad.addColorStop(1.00, '#0f0a07');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Smooth chitin plates carry microscopic pores; hair is actual geometry.
      const bounds=[0,0.14,0.31,0.52,0.70,0.86,1];
      bounds.slice(0,-1).forEach((a,i)=>{
        const b=bounds[i+1],plate=ctx.createLinearGradient(0,a*h,0,b*h);
        plate.addColorStop(0,i<4?'#9c713f':'#51402c');
        plate.addColorStop(0.60,i<4?'#b38a54':'#62513a');
        plate.addColorStop(0.78,'#55402a');plate.addColorStop(1,'#251d17');
        ctx.fillStyle=plate;ctx.fillRect(0,a*h,w,(b-a)*h+1);
      });
      for(let i=0;i<18000;i++) {
        const x=Math.random()*w,y=Math.random()*h;
        ctx.fillStyle='rgba(30,22,15,0.065)';ctx.fillRect(x,y,0.65,0.65);
        bCtx.fillStyle=Math.random()<0.5?'#797979':'#858585';bCtx.fillRect(x,y,0.8,0.8);
      }

      const colorMap = new THREE.CanvasTexture(colCanvas);
      colorMap.colorSpace = THREE.SRGBColorSpace;
      const bumpMap = new THREE.CanvasTexture(bumpCanvas);
      return { colorMap, bumpMap };
    }

    // (c) 複眼六角形小眼面凹凸貼圖 (Compound Eye Ommatidia Hex Grid)
    function createOmmatidiaBumpTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#303030';
      ctx.fillRect(0, 0, 256, 256);

      const r = 6;
      const dx = r * 1.732;
      const dy = r * 1.5;
      for (let row = 0; row < 48; row++) {
        for (let col = 0; col < 36; col++) {
          const cx = col * dx + (row % 2 ? dx * 0.5 : 0);
          const cy = row * dy;
          const g = ctx.createRadialGradient(cx, cy, 0.5, cx, cy, r * 0.95);
          g.addColorStop(0, '#ffffff');
          g.addColorStop(0.7, '#aaaaaa');
          g.addColorStop(1, '#222222');
          ctx.fillStyle = g;
          ctx.beginPath();
          for(let k=0;k<6;k++){const a=k*Math.PI/3;const x=cx+Math.cos(a)*r*0.91,y=cy+Math.sin(a)*r*0.91;if(k===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
          ctx.closePath();
          ctx.fill();
        }
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1.6, 1.6);
      return tex;
    }

    // (d) 寫實昆蟲翅脈與薄膜紋理 (Realistic Apis mellifera Wing Venation)
    function createRealisticWingTexture() {
      const w = 512, h = 256;
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');

      // 微琥珀煙色透明翅膜基底
      const membraneGrad = ctx.createLinearGradient(0, 0, w, h);
      membraneGrad.addColorStop(0, 'rgba(188, 159, 110, 0.62)');
      membraneGrad.addColorStop(0.5, 'rgba(199, 193, 165, 0.40)');
      membraneGrad.addColorStop(1, 'rgba(166, 151, 119, 0.32)');
      ctx.fillStyle = membraneGrad;
      ctx.fillRect(0, 0, w, h);

      // 前緣深褐色翅痣 (Pterostigma) 與主翅脈 (Costa, Subcosta, Radius, Media, Cubitus)
      ctx.strokeStyle = 'rgba(72, 42, 16, 0.92)';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // 前緣粗脈 (Costal Margin)
      ctx.lineWidth = 5.5;
      ctx.beginPath();
      ctx.moveTo(8, 52);
      ctx.quadraticCurveTo(220, 16, 470, 58);
      ctx.stroke();

      // 翅痣 (Pterostigma)
      ctx.fillStyle = 'rgba(65, 35, 12, 0.9)';
      ctx.beginPath();
      ctx.ellipse(295, 32, 26, 6, 0.05, 0, Math.PI * 2);
      ctx.fill();

      // 徑脈與邊緣室 (Marginal Cell & Submarginal Cells)
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      // 主中脈幹
      ctx.moveTo(12, 65);
      ctx.bezierCurveTo(140, 62, 260, 55, 455, 88);
      // 肘脈幹
      ctx.moveTo(15, 82);
      ctx.bezierCurveTo(130, 115, 260, 138, 415, 165);
      // 臀脈
      ctx.moveTo(18, 98);
      ctx.quadraticCurveTo(140, 175, 290, 210);
      ctx.stroke();

      // 橫脈與三個亞緣室、盤室網格 (Cross-veins)
      ctx.lineWidth = 2.2;
      const crossVeins = [
        [[155, 45], [175, 108]],
        [[235, 38], [250, 95]],
        [[305, 35], [335, 82]],
        [[335, 82], [395, 72]],
        [[250, 95], [225, 148]],
        [[325, 82], [315, 152]],
        [[175, 108], [165, 168]],
        [[225, 148], [285, 198]]
      ];
      crossVeins.forEach(([p0, p1]) => {
        ctx.beginPath();
        ctx.moveTo(p0[0], p0[1]);
        ctx. quadraticCurveTo((p0[0] + p1[0]) * 0.5 + 8, (p0[1] + p1[1]) * 0.5, p1[0], p1[1]);
        ctx.stroke();
      });

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }

    // (e) 植物學花瓣絲絨脈絡與漸層貼圖生成器 (Botanical Petal Vein & Nectar Guide Generator)
    function createPetalTexture(baseHex, tipHex, throatHex, hasSpots = false, atlasTile = 0) {
      const w = 256, h = 512;
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');

      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = w; bumpCanvas.height = h;
      const bCtx = bumpCanvas.getContext('2d');
      bCtx.fillStyle = '#808080';
      bCtx.fillRect(0, 0, w, h);

      // 縱向漸層（基部蜜導 -> 花瓣中段 -> 瓣尖）
      const grad = ctx.createLinearGradient(0, h, 0, 0);
      grad.addColorStop(0.0, throatHex);
      grad.addColorStop(0.22, baseHex);
      grad.addColorStop(0.78, baseHex);
      grad.addColorStop(1.0, tipHex);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 18000; i++) {
        const x = Math.random() * w, y = Math.random() * h;
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,242,0.035)' : 'rgba(45,24,18,0.025)';
        ctx.fillRect(x, y, 0.5 + Math.random(), 1 + Math.random() * 2);
        bCtx.fillStyle = Math.random() > 0.5 ? '#858585' : '#7a7a7a'; bCtx.fillRect(x, y, 1, 1);
      }

      // 繪製放射狀細膩花瓣維管束脈絡 (Longitudinal Striations / Veins)
      for (let i = 0; i < 23; i++) {
        const t = (i + Math.random()*0.5) / 23;
        const startX = w * (0.32 + t * 0.36);
        const endX = w * (0.04 + t * 0.92);

        ctx.strokeStyle = i % 3 === 0 ? 'rgba(100,65,12,0.09)' : 'rgba(255,255,230,0.06)';
        ctx.lineWidth = i % 3 === 0 ? 2.0 : 1.1;
        ctx.beginPath();
        ctx.moveTo(startX, h);
        ctx.quadraticCurveTo((startX + endX) * 0.5, h * 0.45, endX, 0);
        ctx.stroke();

        bCtx.strokeStyle = i % 2 === 0 ? '#898989' : '#777777';
        bCtx.lineWidth = 2.2;
        bCtx.beginPath();
        bCtx.moveTo(startX, h);
        bCtx.quadraticCurveTo((startX + endX) * 0.5, h * 0.45, endX, 0);
        bCtx.stroke();
      }

      // 若為百合/鬱金香等具蜜導斑點的品種，加入基部深色斑點
      if (hasSpots) {
        ctx.fillStyle = 'rgba(90, 15, 35, 0.55)';
        for (let i = 0; i < 38; i++) {
          const sx = w * (0.22 + Math.random() * 0.56);
          const sy = h * (0.45 + Math.random() * 0.48);
          ctx.beginPath();
          ctx.ellipse(sx, sy, 2.5 + Math.random() * 2, 4.5 + Math.random() * 3, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const map = new THREE.CanvasTexture(canvas);
      map.colorSpace = THREE.SRGBColorSpace;
      const bumpMap = new THREE.CanvasTexture(bumpCanvas);
      map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      return { map, bumpMap };
    }

    // (f) 葉片真實葉脈紋理
    function createLeafTexture() {
      const w = 256, h = 512;
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      const grad = ctx.createLinearGradient(0, h, 0, 0);
      grad.addColorStop(0, '#2e6b22');
      grad.addColorStop(0.5, '#3d852e');
      grad.addColorStop(1, '#52a33d');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // 主葉脈與羽狀側脈
      ctx.strokeStyle = 'rgba(165, 225, 115, 0.55)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(w / 2, h);
      ctx.lineTo(w / 2, 10);
      ctx.stroke();

      ctx.lineWidth = 2;
      for (let i = 1; i <= 9; i++) {
        const y = h - i * 48;
        ctx.beginPath();
        ctx.moveTo(w / 2, y);
        ctx.quadraticCurveTo(w * 0.25, y - 18, 12, y - 42);
        ctx.moveTo(w / 2, y);
        ctx.quadraticCurveTo(w * 0.75, y - 18, w - 12, y - 42);
        ctx.stroke();
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }

    const glowTex = createGlowTexture();
    const abdomenTex = createRealisticAbdomenTextures();
    // Plate margins align with the geometry; actual setae supply the fine hair fringe.
    const tergiteBounds = [0.14, 0.31, 0.52, 0.70, 0.86];
    const ommatidiaTex = createOmmatidiaBumpTexture();
    const wingTex = createRealisticWingTexture();
    const leafTex = createLeafTexture();
    applyAtlasTile(materialAtlas, 2, leafTex);
    [abdomenTex.colorMap, abdomenTex.bumpMap, wingTex, leafTex].forEach(tex => { tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); });

    // ==========================================
    // 3. 環境日夜光影系統 (06:00 - 18:00 一天時間軸)
    // ==========================================
    let currentTimeOfDay = 8.5;

    const timeKeyframes = [
      {
        hour: 6.0,
        label: '日出晨曦',
        sky: new THREE.Color(0xfba979),
        fog: new THREE.Color(0xfcd5b5),
        sunColor: new THREE.Color(0xff8a50),
        sunIntensity: 1.5,
        hemiSky: new THREE.Color(0xffccbc),
        hemiGround: new THREE.Color(0x2e4c2d),
        exposure: 0.92
      },
      {
        hour: 8.5,
        label: '晨間朝陽',
        sky: new THREE.Color(0x88c9e8),
        fog: new THREE.Color(0xd6eef8),
        sunColor: new THREE.Color(0xfff1c1),
        sunIntensity: 2.15,
        hemiSky: new THREE.Color(0xfffbe6),
        hemiGround: new THREE.Color(0x2f5e2e),
        exposure: 1.02
      },
      {
        hour: 12.0,
        label: '正午豔陽',
        sky: new THREE.Color(0x5ebbf0),
        fog: new THREE.Color(0xd4f0ff),
        sunColor: new THREE.Color(0xffffff),
        sunIntensity: 2.5,
        hemiSky: new THREE.Color(0xffffff),
        hemiGround: new THREE.Color(0x3b7a3e),
        exposure: 1.1
      },
      {
        hour: 15.5,
        label: '午後暖陽',
        sky: new THREE.Color(0x81c9eb),
        fog: new THREE.Color(0xffecc4),
        sunColor: new THREE.Color(0xffe099),
        sunIntensity: 2.0,
        hemiSky: new THREE.Color(0xfff3cd),
        hemiGround: new THREE.Color(0x3d6e38),
        exposure: 1.0
      },
      {
        hour: 18.0,
        label: '黃昏夕照',
        sky: new THREE.Color(0xd96b6b),
        fog: new THREE.Color(0xf59e7a),
        sunColor: new THREE.Color(0xff6f43),
        sunIntensity: 1.4,
        hemiSky: new THREE.Color(0xffab91),
        hemiGround: new THREE.Color(0x28362b),
        exposure: 0.88
      }
    ];

    function updateEnvironmentByTime(hour) {
      currentTimeOfDay = THREE.MathUtils.clamp(hour, 6.0, 18.0);
      const norm = (currentTimeOfDay - 6.0) / 12.0;
      const sunAngle = norm * Math.PI;
      const radius = 32;
      const sunX = Math.cos(sunAngle) * radius;
      const sunY = Math.max(4.5, Math.sin(sunAngle) * 28);
      const sunZ = 10 + Math.sin(sunAngle * 0.5) * 6;

      sunLight.position.set(sunX, sunY, sunZ);
      sunOrb.position.set(sunX * 1.4, sunY * 1.4, sunZ * 1.4 - 18);

      let k0 = timeKeyframes[0];
      let k1 = timeKeyframes[timeKeyframes.length - 1];
      for (let i = 0; i < timeKeyframes.length - 1; i++) {
        if (currentTimeOfDay >= timeKeyframes[i].hour && currentTimeOfDay <= timeKeyframes[i + 1].hour) {
          k0 = timeKeyframes[i];
          k1 = timeKeyframes[i + 1];
          break;
        }
      }
      const span = Math.max(0.001, k1.hour - k0.hour);
      const t = (currentTimeOfDay - k0.hour) / span;

      scene.background.lerpColors(k0.sky, k1.sky, t);
      scene.fog.color.lerpColors(k0.fog, k1.fog, t);
      sunLight.color.lerpColors(k0.sunColor, k1.sunColor, t);
      sunOrb.material.color.copy(sunLight.color);
      sunLight.intensity = THREE.MathUtils.lerp(k0.sunIntensity, k1.sunIntensity, t);
      hemiLight.color.lerpColors(k0.hemiSky, k1.hemiSky, t);
      hemiLight.groundColor.lerpColors(k0.hemiGround, k1.hemiGround, t);
      renderer.toneMappingExposure = THREE.MathUtils.lerp(k0.exposure, k1.exposure, t);

      const hrs = Math.floor(currentTimeOfDay);
      const mins = Math.floor((currentTimeOfDay - hrs) * 60);
      const timeStr = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
      const periodLabel = t < 0.5 ? k0.label : k1.label;
      document.getElementById('time-display').textContent = `${timeStr} (${periodLabel})`;
    }

    // ==========================================
    // 4. 寫實微觀草地、彎曲草葉與晶瑩晨露
    // ==========================================
    function createCurvedBladeGeometry() {
      const geo = new THREE.PlaneGeometry(0.11, 0.95, 2, 8);
      geo.translate(0, 0.475, 0);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const ny = y / 0.95;
        // 葉尖自然收細並向前彎曲弧度
        const widthScale = Math.pow(Math.max(0,1-ny),0.8);
        pos.setX(i, pos.getX(i) * widthScale);
        pos.setZ(i, Math.pow(ny, 2.1) * 0.42);
      }
      geo.computeVertexNormals();
      return geo;
    }

    function createMeadow() {
      const meadow = new THREE.Group();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#4c5034'; ctx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 24000; i++) {
        const c = 35 + Math.random() * 65; ctx.fillStyle = 'rgba(' + c + ',' + c*1.08 + ',' + c*0.67 + ',0.3)';
        ctx.fillRect(Math.random()*512,Math.random()*512,1+Math.random()*5,1+Math.random()*4);
      }
      const map = new THREE.CanvasTexture(canvas); map.colorSpace=THREE.SRGBColorSpace;
      // Broad irregular soil/moss patches break the repeat of small surface grains.
      for (let i=0;i<190;i++) {
        const x=Math.random()*512,y=Math.random()*512,r=8+Math.random()*70;
        const patch=ctx.createRadialGradient(x,y,0,x,y,r);
        patch.addColorStop(0,i%3===0?'rgba(30,47,17,0.45)':'rgba(99,77,43,0.28)');
        patch.addColorStop(1,'rgba(50,55,28,0)');ctx.fillStyle=patch;ctx.fillRect(x-r,y-r,r*2,r*2);
      }
      map.needsUpdate=true;
      map.wrapS=map.wrapT=THREE.RepeatWrapping; map.repeat.set(3,3);
      const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({map,bumpMap:map,bumpScale:0.018,roughness:1}));
      ground.rotation.x=-Math.PI/2; ground.position.y=-0.035; ground.receiveShadow=true; meadow.add(ground);
      const geo=createCurvedBladeGeometry(), pos=geo.attributes.position, colors=[];
      for(let i=0;i<pos.count;i++) {
        const c=new THREE.Color().lerpColors(new THREE.Color(0x263a18),new THREE.Color(0x849454),Math.max(0,pos.getY(i)/0.95));
        colors.push(c.r,c.g,c.b);
      }
      geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
      const grass=new THREE.InstancedMesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.92,side:THREE.DoubleSide}),36000);
      const dummy=new THREE.Object3D(), col=new THREE.Color();
      for(let i=0;i<grass.count;i++) {
        const tuft=Math.floor(i/(3+(Math.floor(i/211)%6))),hash=n=>{const q=Math.sin(n*127.1+tuft*311.7)*43758.5453;return q-Math.floor(q);};
        const radius=Math.sqrt(hash(1))*(i<26000?15:47),theta=hash(2)*Math.PI*2,h=0.10+Math.pow(Math.random(),1.7)*0.85;
        dummy.position.set(Math.cos(theta)*radius+(Math.random()-0.5)*0.30,-0.045,Math.sin(theta)*radius+(Math.random()-0.5)*0.30);
        dummy.scale.set(0.28+Math.random()*0.48,h*(0.65+Math.random()*0.6),h);dummy.rotation.set((Math.random()-0.5)*0.3,Math.random()*Math.PI*2,(Math.random()-0.5)*0.65);
        dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);
        col.setHSL(0.16+Math.random()*0.10,0.10+Math.random()*0.24,0.30+Math.random()*0.27);grass.setColorAt(i,col);
      }
      grass.castShadow=true;grass.receiveShadow=true;meadow.add(grass);
      const trees = [new THREE.Vector3(-8.5,7,-7.3),new THREE.Vector3(-18,9,-18),new THREE.Vector3(12,8,-16),new THREE.Vector3(19,10,-24),new THREE.Vector3(-9,11,-25),new THREE.Vector3(5,9,22)];
      const bark = new THREE.MeshStandardMaterial({color:0x4c4433,roughness:0.98,bumpMap:abdomenTex.bumpMap,bumpScale:0.025});
      trees.forEach(p=>{
        const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.32,p.y,12),bark);
        trunk.position.set(p.x,p.y/2,p.z);trunk.castShadow=true;meadow.add(trunk);
        for(let k=0;k<4;k++) {
          const a=k*2.4,from=new THREE.Vector3(p.x,p.y*0.62,p.z),to=p.clone().add(new THREE.Vector3(Math.cos(a)*1.7,-0.8,Math.sin(a)*1.7));
          const branch=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.09,from.distanceTo(to),7),bark);
          branch.position.copy(from).lerp(to,0.5);branch.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),to.sub(from).normalize());meadow.add(branch);
        }
      });
      const canopyLeaf = new THREE.BufferGeometry();
      canopyLeaf.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,0.16,0.025,0.07,0.36,0,0,0.16,0.025,-0.07],3));
      canopyLeaf.setIndex([0,1,3,1,2,3]);canopyLeaf.computeVertexNormals();
      const treeLeaves = new THREE.InstancedMesh(canopyLeaf,new THREE.MeshStandardMaterial({color:0x77825a,roughness:0.9,side:THREE.DoubleSide}),18000);
      trees.forEach((p,t)=>{for(let i=0;i<3000;i++) {
        const y=Math.random()*2-1,a=Math.random()*Math.PI*2,r=Math.pow(Math.random(),0.333)*3.6,radial=Math.sqrt(1-y*y);
        dummy.position.set(p.x+Math.cos(a)*radial*r,p.y+y*r*0.8,p.z+Math.sin(a)*radial*r);
        dummy.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI*2,Math.random()*Math.PI);dummy.scale.setScalar(0.65+Math.random()*0.7);
        dummy.updateMatrix();treeLeaves.setMatrixAt(t*3000+i,dummy.matrix);
        col.setHSL(0.20+Math.random()*0.08,0.28+Math.random()*0.25,0.32+Math.random()*0.24);treeLeaves.setColorAt(t*3000+i,col);
      }});meadow.add(treeLeaves);scene.add(meadow);
    }

    

    // ==========================================
    // 5. 寫實野生蜂脾結構 (Natural Wax Honeycomb) 與圍觀工蜂
    // ==========================================
    const interactableTargets = [];
    const hiveState = {
      group: null,
      danceCenterWorld: new THREE.Vector3(),
      danceNormalWorld: new THREE.Vector3(),
      danceRightWorld: new THREE.Vector3(),
      danceUpWorld: new THREE.Vector3(),
      storageCells: [],
      filledCount: 0,
      maxCount: 12,
      harvestBatches: 0,
      hoverRing: null,
      waggleTrailLine: null,
      waggleSignalRings: [],
      companionBees: []
    };

    // 建立真實六角蜂房幾何（中空薄壁六角柱 + 圓潤蜂蠟邊緣）
    function createHexCellWallGeometry(radius, depth) {
      const shape = new THREE.Shape();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const x = Math.cos(a) * radius;
        const y = Math.sin(a) * radius;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      }
      shape.closePath();

      const hole = new THREE.Path();
      const innerR = radius * 0.84;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        // 蜂房內緣帶自然圓角六邊形
        const hexFactor = 0.94 + 0.06 * Math.cos(6 * a);
        const x = Math.cos(a) * innerR * hexFactor;
        const y = Math.sin(a) * innerR * hexFactor;
        if (i === 0) hole.moveTo(x, y);
        else hole.lineTo(x, y);
      }
      hole.closePath();
      shape.holes.push(hole);

      const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
        depth: depth,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.025,
        bevelThickness: 0.03
      });
      extrudeGeo.translate(0, 0, -depth * 0.5);
      return extrudeGeo;
    }

    function createHoneycombStructure() {
      const hiveGroup = new THREE.Group();
      hiveGroup.position.set(-7.5, 4.9, -6.2);
      hiveGroup.scale.setScalar(0.25);
      hiveGroup.rotation.y = Math.PI / 4.8;
      hiveState.group = hiveGroup;

      const hexRadius = 0.62;
      const dx = hexRadius * Math.sqrt(3);
      const dy = hexRadius * 1.5;

      const cellWallGeo = createHexCellWallGeometry(hexRadius * 0.99, 0.72);
      const innerHoneyGeo = new THREE.CylinderGeometry(hexRadius * 0.82, hexRadius * 0.82, 0.68, 12);
      innerHoneyGeo.rotateX(Math.PI / 2);

      // 寫實半透明蜂蠟材質 (Subsurface Wax PBR)
      const waxNaturalMat = new THREE.MeshPhysicalMaterial({
        color: 0xe8a328,
        roughness: 0.34,
        metalness: 0.02,
        transmission: 0.25,
        thickness: 0.5,
        clearcoat: 0.35
      });
      const waxAgedMat = new THREE.MeshPhysicalMaterial({
        color: 0xc97b16,
        roughness: 0.42,
        metalness: 0.04,
        transmission: 0.18,
        thickness: 0.6,
        clearcoat: 0.25
      });
      const honeyLiquidMat = new THREE.MeshPhysicalMaterial({
        color: 0xff9d00,
        emissive: 0x6e3200,
        emissiveIntensity: 0.38,
        roughness: 0.06,
        transmission: 0.65,
        ior: 1.49, // 真實蜂蜜折射率 ~1.49
        thickness: 0.8,
        clearcoat: 1.0
      });
      const holeDarkMat = new THREE.MeshStandardMaterial({
        color: 0x261203,
        roughness: 0.9
      });

      const candidateCells = [];

      for (let r = -3; r <= 3; r++) {
        for (let c = -3; c <= 3; c++) {
          if (Math.abs(r) + Math.abs(c) > 4.5) continue;

          const x = c * dx + (Math.abs(r) % 2 === 1 ? dx / 2 : 0);
          const y = r * dy;
          const distFromCenter = Math.hypot(x, y);
          const depthOffset = distFromCenter < 2.2 ? 0 : (Math.random() - 0.5) * 0.16;

          const cellGroup = new THREE.Group();
          cellGroup.position.set(x, y, depthOffset);

          const wallMesh = new THREE.Mesh(
            cellWallGeo,
            distFromCenter < 2.1 ? waxNaturalMat : waxAgedMat
          );
          wallMesh.castShadow = true;
          wallMesh.receiveShadow = true;
          cellGroup.add(wallMesh);

          const centerMesh = new THREE.Mesh(innerHoneyGeo, holeDarkMat.clone());
          centerMesh.position.z = -0.06;
          cellGroup.add(centerMesh);

          wallMesh.userData = { type: 'hive' };
          centerMesh.userData = { type: 'hive' };
          interactableTargets.push(wallMesh, centerMesh);

          hiveGroup.add(cellGroup);
          candidateCells.push({
            cellGroup,
            centerMesh,
            distFromCenter,
            filled: false,
            emptyMat: holeDarkMat,
            honeyMat: honeyLiquidMat.clone()
          });
        }
      }

      candidateCells.sort((a, b) => a.distFromCenter - b.distFromCenter);
      candidateCells.forEach((cell, idx) => {
        if (idx < hiveState.maxCount) {
          hiveState.storageCells.push(cell);
        } else if (idx % 2 === 0) {
          cell.centerMesh.material = honeyLiquidMat;
          cell.centerMesh.position.z = 0.04;
        }
      });

      // 寫實粗糙樹幹支撐（完全銜接地面與蜂巢背面，不穿模）
      const branchCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.2, -5.8, -1.2),
        new THREE.Vector3(-0.5, -2.5, -0.95),
        new THREE.Vector3(0.0, 0.2, -0.82),
        new THREE.Vector3(0.6, 2.4, -0.75)
      ]);
      const branchGeo = new THREE.TubeGeometry(branchCurve, 24, 0.52, 12, false);
      const branchMat = new THREE.MeshStandardMaterial({
        color: 0x4e3426,
        roughness: 0.92,
        bumpMap: abdomenTex.bumpMap,
        bumpScale: 0.04
      });
      const branchMesh = new THREE.Mesh(branchGeo, branchMat);
      branchMesh.castShadow = true;
      branchMesh.receiveShadow = true;
      hiveGroup.add(branchMesh);

      // 八字舞 8 字形發光軌跡線
      const eightPoints = [];
      const waggleScale = 1.35;
      for (let i = 0; i <= 120; i++) {
        const t = (i / 120) * Math.PI * 2;
        const lx = Math.sin(t) * waggleScale;
        const ly = Math.sin(t) * Math.cos(t) * waggleScale * 1.15;
        eightPoints.push(new THREE.Vector3(lx, ly, 0.48));
      }
      const eightGeo = new THREE.BufferGeometry().setFromPoints(eightPoints);
      const eightMat = new THREE.LineBasicMaterial({
        color: 0xffea00,
        transparent: true,
        opacity: 0.0
      });
      const waggleTrailLine = new THREE.Line(eightGeo, eightMat);
      hiveGroup.add(waggleTrailLine);
      hiveState.waggleTrailLine = waggleTrailLine;

      for (let i = 0; i < 3; i++) {
        const sRingGeo = new THREE.RingGeometry(0.3, 0.38, 32);
        const sRingMat = new THREE.MeshBasicMaterial({
          color: 0xffee58,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.0
        });
        const sRing = new THREE.Mesh(sRingGeo, sRingMat);
        sRing.position.set(0, 0, 0.45);
        hiveGroup.add(sRing);
        hiveState.waggleSignalRings.push({ mesh: sRing, phase: i / 3 });
      }

      const ringGeo = new THREE.RingGeometry(2.65, 2.88, 36);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xffd54f,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.0
      });
      const hoverRing = new THREE.Mesh(ringGeo, ringMat);
      hoverRing.position.set(0, 0, 0.48);
      hiveGroup.add(hoverRing);
      hiveState.hoverRing = hoverRing;

      scene.add(hiveGroup);
      hiveGroup.updateMatrixWorld(true);

      // 八字舞中心點設於蜂巢表面前方 z = 0.72，確保蜜蜂六足貼合蜂巢表面而不陷入蜂房
      const centerLocal = new THREE.Vector3(0, 0, 1.6);
      const normalLocal = new THREE.Vector3(0, 0, 2.6);
      const rightLocal = new THREE.Vector3(1, 0, 1.6);
      const upLocal = new THREE.Vector3(0, 1, 1.6);

      hiveGroup.localToWorld(centerLocal);
      hiveGroup.localToWorld(normalLocal);
      hiveGroup.localToWorld(rightLocal);
      hiveGroup.localToWorld(upLocal);

      hiveState.danceCenterWorld.copy(centerLocal);
      hiveState.danceNormalWorld.copy(normalLocal).sub(centerLocal).normalize();
      hiveState.danceRightWorld.copy(rightLocal).sub(centerLocal).normalize();
      hiveState.danceUpWorld.copy(upLocal).sub(centerLocal).normalize();
    }

    // ==========================================
    // 6. 寫實派植物學花朵建模 (Botanical Flowers with Fibonacci Phyllotaxis & Curved Veined Petals)
    // ==========================================
    const flowersList = [];

    // 建立真實植物學彎曲花瓣幾何（具基部收窄、縱向中肋凹槽、橫向弧度與瓣尖微捲）
    function createBotanicalPetalGeometry(length, width, archCurve = 0.25, cupDepth = 0.08, tipPointiness = 0.5, species = '') {
      const rows = 72, cols = 32, positions = [], uv = [], indices = [];
      for (let i = 0; i <= rows; i++) {
        const u = i / rows;
        for (let j = 0; j <= cols; j++) {
          const v = j / cols * 2 - 1;
          let envelope = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.72)), tipPointiness);
          envelope = Math.max(0.002, envelope);
          if (species === 'sunflower') envelope=Math.max(0.002,Math.sin(Math.PI*Math.pow(u,0.9))**0.48);
          if (species === 'lily') envelope = Math.max(0.002, Math.pow(Math.sin(Math.PI * Math.pow(u, 0.77)), 0.54));
          if (species === 'cosmos') envelope = Math.max(0.003, Math.sin(Math.PI * Math.pow(u, 1.55)) ** 0.32);
          const notch = species === 'cosmos' ? Math.pow(u, 12) * (0.032 + 0.026 * Math.cos(v * Math.PI * 4)) : 0;
          const x = length * u - notch - (species==='sunflower'?Math.pow(u,16)*0.028*(0.5+0.5*Math.cos(v*Math.PI*3)):0);
          const z = v * width * 0.5 * envelope;
          const midrib = -0.008 * (1 - Math.abs(v)) * Math.sin(u * Math.PI);
          const y = (species === 'lily' ? lilyPetalHeight(length, u) : Math.sin(u * Math.PI * 0.9) * archCurve - u ** 3 * archCurve * 0.65)
            + v * v * cupDepth * Math.sin(u * Math.PI) + midrib
            + Math.sin(u * 18 + v * 3) * v * v * 0.009
            + (species==='sunflower'?Math.cos(v*18+u*1.5)*0.002*Math.sin(u*Math.PI):0);
          positions.push(x, y, z); uv.push(j / cols, u);
          if (i < rows && j < cols) {
            const a = i * (cols + 1) + j, b = a + cols + 1;
            indices.push(a, b, a + 1, b, b + 1, a + 1);
          }
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(indices); geo.computeVertexNormals(); return geo;
    }

    // Species-specific silhouettes share one leaf shader.
    

    function createBotanicalLeafGeometry(length = 1.4, width = 0.65, species = 'daisy') {
      const geo = new THREE.PlaneGeometry(width, length, 8, 14);
      geo.rotateX(-Math.PI / 2);
      geo.rotateY(-Math.PI / 2);
      geo.translate(length * 0.5, 0, 0);

      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const u = THREE.MathUtils.clamp(x / length, 0, 1);
        const v = z / (width * 0.5);

        // 葉片心形基部至尖端包絡 + 邊緣微鋸齒
        const serration = 1.0 + Math.sin(u * Math.PI * 14) * 0.04 * (1 - u);
        const shapePower = species === 'sunflower' ? 0.50 : species === 'lily' ? 0.95 : 0.75;
        const env = Math.sin(Math.pow(u, shapePower) * Math.PI) * (species === 'lily' ? 1 : serration);
        const newZ = z * env;
        // V型中肋折角與葉尖自然下垂
        const midribV = Math.abs(v) * 0.07 * Math.sin(u * Math.PI);
        const droopY = Math.sin(u * Math.PI * 0.65) * 0.14 - Math.pow(u, 2.3) * 0.32;

        pos.setX(i, x);
        pos.setY(i, midribV + droopY);
        pos.setZ(i, newZ);
      }
      geo.computeVertexNormals();
      return geo;
    }

    const sharedLeafGeo = createBotanicalLeafGeometry(1.35, 0.62);
    const sharedLeafMat = new THREE.MeshStandardMaterial({
      map: materialMaps[2].colorMap,
      bumpMap: materialMaps[2].bumpMap,
      bumpScale: 0.001,
      roughness: 0.76,
      metalness: 0,
      side: THREE.DoubleSide
    });

    function discHeight(radius, height, distance, species) {
      const t = THREE.MathUtils.clamp(distance / radius, 0, 1);
      return species === 'echinacea'
        ? height * Math.pow(Math.max(0, 1 - Math.pow(t, 1.35)), 0.8)
        : height * Math.sqrt(Math.max(0, 1 - t * t));
    }

    function lilyPetalHeight(length, u) {
      return length * (0.52 * Math.sin(u * Math.PI * 0.95) - 0.24 * u * u * u);
    }

    function nearestSupportFloret(flower,x,z) {
      const support=flower.headGroup?.userData.floretSupport;
      if(!support)return null;
      const {cells,cellSize}=support,ix=Math.floor(x/cellSize),iz=Math.floor(z/cellSize);
      let nearest=null,distance=Infinity;
      for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++) {
        for(const floret of cells.get((ix+dx)+','+(iz+dz))||[]) {
          const d=(x-floret.x)**2+(z-floret.z)**2;
          if(d<distance){nearest=floret;distance=d;}
        }
      }
      return distance<cellSize*cellSize?nearest:null;
    }

    function flowerSurfaceHeight(flower, x, z) {
      const r = Math.hypot(x, z);
      if(flower.species==='sunflower' && flower.headGroup?.userData.floretSupport) {
        const nearest=nearestSupportFloret(flower,x,z);
        if(nearest) return nearest.y;
        return discHeight(flower.coreRadius,flower.coreHeight,r,flower.species)+0.012*flower.scale;
      }
      if (flower.species !== 'lily') return discHeight(flower.coreRadius, flower.coreHeight, r, flower.species) + 0.03 * flower.scale;
      // The landing patch lies on the inner face of the +X tepal.
      const length = 1.45 * flower.scale, pitch = 0.16;
      const radial = Math.max(0, r - 0.12 * flower.scale);
      let lo = 0, hi = 1;
      for (let i = 0; i < 10; i++) {
        const u = (lo + hi) / 2;
        const horizontal = length * u * Math.cos(pitch) - lilyPetalHeight(length, u) * Math.sin(pitch);
        if (horizontal < radial) lo = u; else hi = u;
      }
      const u = (lo + hi) / 2;
      return length * u * Math.sin(pitch) + lilyPetalHeight(length, u) * Math.cos(pitch) + 0.01 * flower.scale;
    }

    function createFlower(spec, index) {
      const {
        x,
        z,
        height,
        petalBaseHex,
        petalTipHex,
        throatHex,
        centerColor,
        petalCount = 16,
        scale = 1,
        species = 'daisy', // 'sunflower' | 'echinacea' | 'lily' | 'daisy'
        name
      } = spec;

      const flowerGroup = new THREE.Group();
      flowerGroup.position.set(x, 0, z);

      const bendGroup = new THREE.Group();
      flowerGroup.add(bendGroup);

      // 1. 自然微彎有機花莖 (TubeGeometry 沿平滑曲線生長)
      const curveBendX = (Math.random() - 0.5) * 0.35;
      const curveBendZ = (Math.random() - 0.5) * 0.35;
      const stemCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.05, 0),
        new THREE.Vector3(curveBendX * 0.5, height * 0.35, curveBendZ * 0.5),
        new THREE.Vector3(curveBendX, height * 0.72, curveBendZ),
        new THREE.Vector3(0, height, 0)
      ]);
      const stemGeo = new THREE.TubeGeometry(stemCurve, 28, (species === 'sunflower' ? 0.065 : species === 'lily' ? 0.044 : 0.026) * scale, 10, false);
      const stemMat = new THREE.MeshStandardMaterial({
        color: 0x77865a,
        map: materialMaps[3].colorMap,
        roughness: 0.68,
        bumpMap: abdomenTex.bumpMap,
        bumpScale: 0.01
      });
      const stemMesh = new THREE.Mesh(stemGeo, stemMat);
      stemMesh.castShadow = true;
      stemMesh.receiveShadow = true;
      bendGroup.add(stemMesh);

      // Leaves emerge from their own petiole at the actual stem position.
      const leafCount = species === 'lily' ? 9 : species === 'cosmos' ? 5 : 6;
      const leafLength = (species === 'sunflower' ? 1.85 : species === 'lily' ? 1.35 : 1.28) * scale;
      const leafWidth = (species === 'sunflower' ? 0.88 : species === 'lily' ? 0.14 : 0.28) * scale;
      const speciesLeafGeo = createBotanicalLeafGeometry(leafLength, leafWidth, species);
      const speciesLeafMat = sharedLeafMat.clone();
      if (species === 'lily' || species === 'cosmos') {
        speciesLeafMat.map = materialMaps[3].colorMap; speciesLeafMat.bumpMap = materialMaps[3].bumpMap;
      }
      for (let i = 0; i < leafCount; i++) {
        const tStem = 0.17 + i / leafCount * 0.65;
        const leafNode = new THREE.Group();
        leafNode.position.copy(stemCurve.getPointAt(tStem));
        leafNode.rotation.y = i * 2.39996 + index * 0.6;
        leafNode.rotation.z = 0.2;
        if (species === 'cosmos') {
          const axis = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.01, 0.9, 5), stemMat);
          axis.rotation.z = -Math.PI / 2; axis.position.x = 0.45; leafNode.add(axis);
          const leafletGeo = createBotanicalLeafGeometry(0.30, 0.025, 'lily');
          for (let k = 0; k < 6; k++) for (const side of [-1, 1]) {
            const leaflet = new THREE.Mesh(leafletGeo, speciesLeafMat);
            leaflet.position.x = 0.12 + k * 0.12; leaflet.rotation.y = side * (0.65 + k * 0.07);
            leafNode.add(leaflet);
          }
        } else {
          const petioleLength = species === 'sunflower' ? 0.18 : 0.05;
          const petiole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, petioleLength, 6), stemMat);
          petiole.rotation.z = -Math.PI / 2; petiole.position.x = petioleLength / 2;
          const leaf = new THREE.Mesh(speciesLeafGeo, speciesLeafMat);
          leaf.position.x = petioleLength; leaf.scale.setScalar(1 - i / leafCount * 0.28);
          leaf.castShadow = true; leaf.receiveShadow = true; leafNode.add(petiole, leaf);
        }
        bendGroup.add(leafNode);
      }



          // 3. 花頭容器与雙層綠色總苞片 (Phyllaries / Sepals)
      const headGroup = new THREE.Group();
      headGroup.position.set(0, height, 0);
      headGroup.rotation.set(
        [0.13,-0.24,0.31,-0.19,0.25,-0.12][index],
        index*1.173, [0.09,0.18,-0.15,0.25,-0.26,0.18][index]);
      bendGroup.add(headGroup);

      const receptacleGeo = new THREE.CylinderGeometry((species === 'lily' ? 0.11 : 0.40) * scale, 0.10 * scale, (species === 'lily' ? 0.12 : 0.20) * scale, 20);
      const receptacleMesh = new THREE.Mesh(receptacleGeo, stemMat);
      receptacleMesh.position.y = -0.16 * scale;
      headGroup.add(receptacleMesh);

      // 總苞片 (Sepals)
      const sepalGeo = createBotanicalPetalGeometry(0.52 * scale, 0.22 * scale, -0.08, 0.04, 0.35);
      for (let i = 0; i < (species === 'lily' ? 0 : 12); i++) {
        const sepal = new THREE.Mesh(sepalGeo, stemMat);
        sepal.position.y = -0.08 * scale;
        sepal.rotation.y = (i / 12) * Math.PI * 2;
        sepal.rotation.z = -0.35;
        headGroup.add(sepal);
      }

      // 4. 花盤中心與費馬螺線管狀小花群 (Fibonacci Phyllotaxis Disc Florets)
      const isSunflower = species === 'sunflower';
      const isConeflower = species === 'echinacea';
      const isLily = species === 'lily';
      const isCosmos = species === 'cosmos';
      const coreRadius = (isSunflower ? 0.78 : isLily ? 0.22 : isCosmos ? 0.30 : 0.52) * scale;
      const coreHeight = (isConeflower ? 0.48 : isSunflower ? 0.18 : isLily ? 0.09 : isCosmos ? 0.065 : 0.13) * scale;

      const coreGeo = new THREE.SphereGeometry(coreRadius, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2);
      const coreVertices = coreGeo.attributes.position;
      for (let v = 0; v < coreVertices.count; v++) {
        coreVertices.setY(v, discHeight(coreRadius, coreHeight, Math.hypot(coreVertices.getX(v), coreVertices.getZ(v)), species));
      }
      coreGeo.computeVertexNormals();
      const coreMat = new THREE.MeshStandardMaterial({
        color: centerColor,
        map: materialMaps[5].bumpMap,
        roughness: 0.94,
        bumpMap: abdomenTex.bumpMap,
        bumpScale: 0.009
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.visible = !isLily;
      coreMesh.castShadow = true;
      coreMesh.receiveShadow = true;
      headGroup.add(coreMesh);

      const stamenGroup = new THREE.Group();
      const stamenTipMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: materialMaps[5].bumpMap,
        bumpMap: materialMaps[5].bumpMap,
        bumpScale: 0.004,
        roughness: 0.88
      });

      if (isLily) {
        // 百合/鬱金香型：中央青綠三裂柱頭雌蕊 (Pistil) + 6 支長花絲與 T 字形擺動花藥 (Versatile Anthers)
        const styleGeo = new THREE.CylinderGeometry(0.019 * scale, 0.027 * scale, 0.78 * scale, 12);
        styleGeo.translate(0, 0.39 * scale, 0);
        const pistilMat = new THREE.MeshStandardMaterial({ color: 0x94a575, roughness: 0.67 });
        const styleMesh = new THREE.Mesh(styleGeo, pistilMat);
        stamenGroup.add(styleMesh);

        for (let k = 0; k < 3; k++) {
          const lobe = new THREE.Mesh(new THREE.CapsuleGeometry(0.032 * scale, 0.08 * scale, 6, 8), pistilMat);
          lobe.position.set(Math.cos((k * Math.PI * 2) / 3) * 0.04 * scale, 0.78 * scale, Math.sin((k * Math.PI * 2) / 3) * 0.04 * scale);
          lobe.rotation.z = 0.6;
          lobe.rotation.y = -(k * Math.PI * 2) / 3;
          stamenGroup.add(lobe);
        }

        const filamentMat = new THREE.MeshStandardMaterial({ color: 0xf1f8e9, roughness: 0.4 });
        const antherMat = new THREE.MeshStandardMaterial({
          color: 0x80502a,
          map: materialMaps[5].colorMap,
          roughness: 0.85,
          bumpMap: abdomenTex.bumpMap,
          bumpScale: 0.02
        });

        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2;
          const filCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(Math.cos(ang) * 0.08 * scale, 0.05 * scale, Math.sin(ang) * 0.08 * scale),
            new THREE.Vector3(Math.cos(ang) * 0.22 * scale, 0.38 * scale, Math.sin(ang) * 0.22 * scale),
            new THREE.Vector3(Math.cos(ang) * 0.28 * scale, 0.68 * scale, Math.sin(ang) * 0.28 * scale)
          ]);
          const filMesh = new THREE.Mesh(new THREE.TubeGeometry(filCurve, 10, 0.016 * scale, 6, false), filamentMat);
          const antherMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.028 * scale, 0.19 * scale, 8, 12), antherMat);
          antherMesh.position.set(Math.cos(ang) * 0.28 * scale, 0.7 * scale, Math.sin(ang) * 0.28 * scale);
          antherMesh.rotation.z = Math.PI / 2 + 0.2;
          antherMesh.rotation.y = -ang;
          stamenGroup.add(filMesh, antherMesh);
        }
      } else if (isSunflower) {
        // Closed immature buds, densely packed between the open five-lobed florets.
        function tubularFloret(open) {
          if (!open) {
            const profile=[new THREE.Vector2(0.004,0),new THREE.Vector2(0.005,0.004),new THREE.Vector2(0.0052,0.007),new THREE.Vector2(0.0038,0.010),new THREE.Vector2(0.0008,0.011)];
            const g=new THREE.LatheGeometry(profile,8);g.scale(scale,scale,scale);return g;
          }
          const vertices=[],indices=[],radial=15;
          for(let row=0;row<4;row++) for(let j=0;j<=radial;j++) {
            const a=j/radial*Math.PI*2,lobe=Math.cos(a*5);
            const radius=[0.005,0.004,0.007,0.0095*(0.86+0.14*lobe)][row]*scale;
            vertices.push(Math.cos(a)*radius,([0,0.008,0.012,0.015+0.002*lobe][row])*scale,Math.sin(a)*radius);
            if(row<3&&j<radial){const k=row*(radial+1)+j;indices.push(k,k+1,k+radial+1,k+1,k+radial+2,k+radial+1);}
          }
          const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
          g.setIndex(indices);g.computeVertexNormals();return g;
        }
        const total=11500,buds=7800;
        const mat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.91,side:THREE.DoubleSide});
        const unopened=new THREE.InstancedMesh(tubularFloret(false),mat,buds);
        const flowering=new THREE.InstancedMesh(tubularFloret(true),mat,total-buds);
        const dummy=new THREE.Object3D(),color=new THREE.Color();
        const supportCells=new Map(),cellSize=0.028*scale;
        headGroup.userData.floretSupport={cells:supportCells,cellSize};
        for(let i=0;i<total;i++) {
          const t=(i+0.5)/total,r=Math.sqrt(t)*coreRadius*(0.978+(Math.random()-0.5)*0.003);
          const theta=i*2.3999632297+(Math.random()-0.5)*0.002;
          dummy.position.set(Math.cos(theta)*r,discHeight(coreRadius,coreHeight,r,species)+0.002*scale,Math.sin(theta)*r);
          dummy.rotation.set((Math.random()-0.5)*0.2,theta,(Math.random()-0.5)*0.2);
          dummy.scale.set(0.85+Math.random()*0.22,0.8+Math.random()*0.35,0.85+Math.random()*0.22);
          dummy.updateMatrix();
          const mesh=i<buds?unopened:flowering,k=i<buds?i:i-buds;
          if(i<buds) dummy.scale.y*=0.65+Math.random()*0.40;
          else dummy.scale.y*=0.50+Math.random()*0.48;
          dummy.updateMatrix();
          mesh.setMatrixAt(k,dummy.matrix);
          if(i<buds) {
            color.lerpColors(new THREE.Color(0x35251b),new THREE.Color(0x8c7133),Math.pow(t/(buds/total),1.25));
            const key=Math.floor(dummy.position.x/cellSize)+','+Math.floor(dummy.position.z/cellSize);
            if(!supportCells.has(key))supportCells.set(key,[]);
            supportCells.get(key).push({x:dummy.position.x,z:dummy.position.z,y:dummy.position.y+0.011*scale*dummy.scale.y,
              rx:0.005*scale*dummy.scale.x,rz:0.005*scale*dummy.scale.z,ry:0.007*scale*dummy.scale.y});
          } else color.lerpColors(new THREE.Color(0x806330),new THREE.Color(0xc7a044),Math.min(1,(t-buds/total)/(1-buds/total)*0.65+Math.random()*0.35));
          color.multiplyScalar(0.82+Math.random()*0.32);mesh.setColorAt(k,color);
        }
        // Anther columns and granular pollen emerge only from the flowering annulus.
        const anthers=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0025*scale,0.0032*scale,0.008*scale,5),new THREE.MeshStandardMaterial({color:0x7c3e12,roughness:0.9}),total-buds);
        const pollen=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.0028*scale,0),new THREE.MeshStandardMaterial({color:0xf3b827,roughness:1}),total-buds);
        for(let k=0;k<total-buds;k++) {
          flowering.getMatrixAt(k,dummy.matrix);dummy.matrix.decompose(dummy.position,dummy.quaternion,dummy.scale);
          dummy.position.y+=0.017*scale;dummy.updateMatrix();anthers.setMatrixAt(k,dummy.matrix);
          dummy.position.y+=0.004*scale;dummy.updateMatrix();pollen.setMatrixAt(k,dummy.matrix);
        }
        stamenGroup.add(anthers,pollen);
        for(const mesh of [unopened,flowering]) {
          mesh.castShadow=true;mesh.receiveShadow=true;
          mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;stamenGroup.add(mesh);
        }
      } else {
        // 菊科花盤以黃金角排列不同密度的花蕾與小花 (Disc Florets)
        const floretCount = isSunflower ? 2400 : isConeflower ? 1700 : isCosmos ? 440 : 900;
        const floretRadius = (isSunflower ? 0.0125 : isConeflower ? 0.017 : 0.012) * scale;
        const floretGeo = isConeflower ? new THREE.ConeGeometry(floretRadius,0.07 * scale,8) : new THREE.SphereGeometry(floretRadius,12,10);
        floretGeo.scale(1, isConeflower ? 1 : 1.4, 1);
        floretGeo.translate(0, 0.012 * scale, 0);
        const floretInst = new THREE.InstancedMesh(floretGeo, stamenTipMat, floretCount);
        floretInst.castShadow = true;
        floretInst.receiveShadow = true;

        const dummy = new THREE.Object3D();
        const col = new THREE.Color();
        const goldenAngle = 137.507764 * (Math.PI / 180);

        for (let i = 0; i < floretCount; i++) {
          const ratio = i / floretCount;
          const r = Math.sqrt(ratio) * coreRadius * (0.965 + (Math.random() - 0.5) * 0.014);
          const theta = i * goldenAngle + (Math.random() - 0.5) * 0.016;
          const xFloret = Math.cos(theta) * r;
          const zFloret = Math.sin(theta) * r;
          // 球面或圓錐面高度映射
          const yDome = discHeight(coreRadius, coreHeight, r, species);

          dummy.position.set(xFloret, yDome, zFloret);
          // 朝法線方向自然外傾
          const tilt = (r / coreRadius) * 0.45;
          dummy.rotation.set(Math.sin(theta) * tilt, 0, -Math.cos(theta) * tilt);
          const sFloret = 0.8 + Math.sin(ratio * Math.PI) * 0.15 + Math.random() * 0.2;
          dummy.scale.set(sFloret*(0.85+Math.random()*0.25),sFloret*(0.75+Math.random()*0.5),sFloret*(0.85+Math.random()*0.25));
          dummy.updateMatrix();
          floretInst.setMatrixAt(i, dummy.matrix);

          if (isSunflower) {
            col.setHex(ratio < 0.50 ? 0x42371f : ratio < 0.78 ? 0x977a32 : 0xc4a149);
          } else if (isConeflower) {
            col.setHex(ratio < 0.3 ? 0x6f4425 : ratio < 0.8 ? 0xa45b24 : 0xc28237);
          } else {
            col.setHex(ratio < 0.25 ? 0xb59a32 : ratio < 0.8 ? 0xe6b936 : 0xcc9227);
          }
          col.multiplyScalar(0.82 + Math.random() * 0.3);


              floretInst.setColorAt(i, col);
        }
        floretInst.instanceMatrix.needsUpdate = true;
        if (floretInst.instanceColor) floretInst.instanceColor.needsUpdate = true;
        stamenGroup.add(floretInst);
        // Open five-lobed disc florets form a flowering ring outside the buds.
        if (!isConeflower) {
          const verts=[],uvs=[],indices=[],radial=20;
          for(let row=0;row<3;row++)for(let j=0;j<=radial;j++) {
            const a=j/radial*Math.PI*2,lobe=Math.cos(a*5),radius=(row===0?0.006:row===1?0.01:0.019*(0.9+0.12*lobe))*scale;
            verts.push(Math.cos(a)*radius,(row===0?0:row===1?0.019:0.033+0.005*lobe)*scale,Math.sin(a)*radius);
            uvs.push(j/radial,row/2);
            if(row<2&&j<radial){const k=row*(radial+1)+j;indices.push(k,k+radial+1,k+1,k+1,k+radial+1,k+radial+2);}
          }
          const corollaGeo=new THREE.BufferGeometry();corollaGeo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));corollaGeo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));corollaGeo.setIndex(indices);corollaGeo.computeVertexNormals();
          const openCount=Math.floor(floretCount*0.38),corollas=new THREE.InstancedMesh(corollaGeo,new THREE.MeshStandardMaterial({color:isSunflower?0xc9a43c:0xe1b640,roughness:0.82,side:THREE.DoubleSide}),openCount);
          for(let i=0;i<openCount;i++) {
            const ratio=0.59+i/openCount*0.39,r=Math.sqrt(ratio)*coreRadius*0.94,theta=(i+Math.floor(floretCount*0.7))*goldenAngle;
            dummy.position.set(Math.cos(theta)*r,discHeight(coreRadius,coreHeight,r,species)+0.012*scale,Math.sin(theta)*r);
            dummy.rotation.set(0,theta,0);dummy.scale.setScalar(0.8+Math.random()*0.35);dummy.updateMatrix();corollas.setMatrixAt(i,dummy.matrix);
          }
          corollas.castShadow=true;corollas.receiveShadow=true;stamenGroup.add(corollas);
        }
      }
      headGroup.add(stamenGroup);

      // 5. 寫實彎曲葉脈花瓣階層 (Botanical Ray Florets / Tepals)
      const pTex = createPetalTexture(petalBaseHex, petalTipHex, throatHex, isLily, index);
      const petalMat = new THREE.MeshPhysicalMaterial({
        map: pTex.map,
        bumpMap: pTex.bumpMap,
        bumpScale: 0.00065,
        roughness: 0.78,
        metalness: 0,
        transmission: 0.12,
        thickness: 0.002,
        ior: 1.36,
        sheen: 0.08, // 真實花瓣絲絨細胞漫射光澤
        sheenRoughness: 0.4,
        sheenColor: new THREE.Color(petalTipHex),
        clearcoat: 0,
        side: THREE.DoubleSide
      });

      const pLen = (isSunflower ? 1.18 : isLily ? 1.45 : isConeflower ? 1.15 : 1.05) * scale;
      const pWid = (isSunflower ? 0.43 : isLily ? 0.88 : isCosmos ? 0.72 : isConeflower ? 0.25 : 0.23) * scale;
      const pArch = isLily ? 0.36 * scale : isConeflower ? -0.24 * scale : 0.11 * scale;
      const pCup = isLily ? 0.11 * scale : 0.045 * scale;
      const pTip = isSunflower ? 0.72 : isLily ? 0.65 : 0.4;

      const petalGeo = createBotanicalPetalGeometry(pLen, pWid, pArch, pCup, pTip, species);
      const layers = isLily || isSunflower ? 2 : 1;
      const perLayer = isLily ? 3 : petalCount;

      for (let layer = 0; layer < layers; layer++) {
        for (let i = 0; i < perLayer; i++) {
          const angle =
            (i / perLayer) * Math.PI * 2 +
            layer * (Math.PI / perLayer) +
            (Math.random() - 0.5) * 0.10;

          const petalPivot = new THREE.Group();
          petalPivot.rotation.y = angle;

          const variedGeo=petalGeo.clone(),vp=variedGeo.attributes.position;
          const curl=(Math.random()-0.5)*0.35*scale,skew=(Math.random()-0.5)*0.25;
          const twist=(Math.random()-0.5)*0.55,tipWidth=0.7+Math.random()*0.55;
          const cropX=Math.random()*0.06,cropY=Math.random()*0.05;
          for(let v=0;v<vp.count;v++) {
            const u=vp.getX(v)/pLen,z=vp.getZ(v);
            vp.setY(v,vp.getY(v)+curl*u*u+twist*z*u+Math.sin(u*16+i*1.7)*z*z/pWid*0.20);
            vp.setZ(v,z*(1+(tipWidth-1)*u)+skew*pLen*u*u);
            variedGeo.attributes.uv.setXY(v,variedGeo.attributes.uv.getX(v)*0.94+cropX,variedGeo.attributes.uv.getY(v)*0.95+cropY);
          }
          variedGeo.computeVertexNormals();
          const variedMat=petalMat.clone();variedMat.color.setHSL(0.105+Math.random()*0.025,0.12+Math.random()*0.13,0.77+Math.random()*0.16);
          const petal = new THREE.Mesh(variedGeo, variedMat);
          petal.scale.set((layer&&isSunflower?0.86:1)*(0.80+Math.random()*0.30),0.8+Math.random()*0.4,0.80+Math.random()*0.32);
          const attachR = isLily ? 0.12 * scale : coreRadius * 0.85;
          petal.position.set(attachR, -layer * 0.045 * scale, 0);
          // 紫錐菊花瓣自然下垂，百合花瓣向上展開呈喇叭杯狀，向日葵與法國菊自然平展微仰
          const basePitch = isLily
            ? 0.16 - layer * 0.035
            : isConeflower
            ? -0.28
            : 0.12 - layer * 0.08;
          petal.rotation.z = basePitch + (Math.random() - 0.5) * 0.15;
          petal.rotation.x = (Math.random() - 0.5) * 0.16;

          petal.castShadow = true;
          petal.receiveShadow = true;
          petal.userData = { type: 'flower', flowerIndex: index };
          interactableTargets.push(petal);

          petalPivot.add(petal);
          headGroup.add(petalPivot);
        }
      }

      coreMesh.userData = { type: 'flower', flowerIndex: index };
      interactableTargets.push(coreMesh);

      const ringGeo = new THREE.RingGeometry(1.25 * scale, 1.4 * scale, 36);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xffe082,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.0
      });
      const hoverRing = new THREE.Mesh(ringGeo, ringMat);
      hoverRing.position.y = 0.12 * scale;
      headGroup.add(hoverRing);

      scene.add(flowerGroup);
      flowerGroup.updateMatrixWorld(true);

      // 精準計算花盤頂端表面世界座標（供蜜蜂六足精確踏在花蕊上採蜜，不浮空也不穿模）
      const landingX = isLily ? 0.44 * scale : 0;
      const topSurfaceY = isLily
        ? flowerSurfaceHeight({ species, scale }, landingX, 0)
        : coreHeight + 0.03 * scale;
      const coreWorldPos = new THREE.Vector3(landingX, topSurfaceY, 0);
      const nectarPos = new THREE.Vector3(landingX, topSurfaceY + 0.185, 0); // 蜜蜂降落時身體中心高度（剛好讓長度 ~0.34 的六足踏在花蕊頂面）
      headGroup.localToWorld(coreWorldPos);
      headGroup.localToWorld(nectarPos);

      flowersList.push({
        index,
        name: name || `花朵 #${index + 1}`,
        group: flowerGroup,
        bendGroup,
        headGroup,
        coreMesh,
        coreMat,
        stamenGroup,
        stamenTipMat,
        hoverRing,
        scale,
        species,
        coreHeight,
        coreRadius,
        surfaceLocal: new THREE.Vector3(landingX, topSurfaceY, 0),
        phase: Math.random() * Math.PI * 2,
        nectar: 1.0,
        regenCooldown: 0,
        pressAmount: 0,
        nectarPos,
        coreWorldPos,
        baseCenterColor: new THREE.Color(centerColor),
        depletedColor: new THREE.Color(0x5d482c)
      });
    }

    // ==========================================
    // 7. 寫實派西方蜜蜂建模 (Anatomically Accurate Apis mellifera)
    // ==========================================
    // (a) 解剖學流線型腹部幾何 (Metasoma Lathe + 腹面微扁平化)
    function createAnatomicalAbdomenGeometry() {
      // 從腹柄 (Petiole) 到尾端第 6 節背板 (T6) 的真實蜜蜂腹部輪廓曲線
      const profilePts = [
        new THREE.Vector2(0.001, 0.00), // 腹柄起點
        new THREE.Vector2(0.14, 0.04),
        new THREE.Vector2(0.31, 0.12),  // T1 前緣迅速飽滿
        new THREE.Vector2(0.39, 0.24),  // T2 最寬處
        new THREE.Vector2(0.41, 0.38),
        new THREE.Vector2(0.39, 0.52),  // T3
        new THREE.Vector2(0.33, 0.67),  // T4
        new THREE.Vector2(0.24, 0.81),  // T5
        new THREE.Vector2(0.12, 0.93),  // T6 尾錐
        new THREE.Vector2(0.001, 1.00)  // 尾針出口尖端
      ];
      const profile = new THREE.SplineCurve(profilePts).getPoints(90);
      const geo = new THREE.LatheGeometry(profile, 64);
      // 旋轉使長度沿 -Z 軸延伸 (0 -> -0.92)
      geo.rotateX(-Math.PI / 2);
      geo.scale(0.84, 0.76, 1.0); // slender, tapering worker gaster rather than a round ball

      // 真實蜜蜂腹部：背面 (Dorsal Tergites) 圓拱飽滿、腹面 (Ventral Sternites) 略扁並自然微向下彎曲
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i);
        let y = pos.getY(i);
        let z = pos.getZ(i); // 0 ~ -0.92
        const t = Math.abs(z);
        if (y < 0) {
          y *= 0.72; // 腹面扁平化
        }
        // Overlapping tergites: each plate swells toward its posterior lip and the next
        // starts tucked beneath it. Boundaries follow the hair fringes in the atlas tile.
        let segStart = 0, segEnd = 1;
        for (const bound of [0.14, 0.31, 0.52, 0.70, 0.86]) { if (t < bound) { segEnd = bound; break; } segStart = bound; }
        const plateT=(t-segStart)/(segEnd-segStart);
        const lip = 0.982 + 0.018*Math.sin(plateT*Math.PI) - 0.009*Math.pow(plateT,8);
        x *= lip; y *= lip;
        y -= Math.pow(t, 1.8) * 0.11; // 自然微垂曲線
        pos.setXYZ(i, x, y, z);
        geo.attributes.uv.setY(i, 1 - t);
      }
      geo.computeVertexNormals();
      return geo;
    }

    // (b) 解剖學心形微扁平昆蟲頭殼幾何 (Anatomical Bee Head Capsule)
    function createAnatomicalHeadGeometry() {
      const geo = new THREE.SphereGeometry(0.26, 24, 20);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i);
        let y = pos.getY(i);
        let z = pos.getZ(i);
        // 蜜蜂頭部前後較扁 (Z軸)，下方口器區收窄呈倒三角心形
        z *= 0.85;
        if (y < 0) {
          const narrow = 1.0 - Math.min(0.68, Math.abs(y) * 2.7);
          x *= narrow;
          z *= 0.88;
        } else {
          x *= 1.05 - 0.22*Math.pow(y/0.26,3);
        }
        pos.setXYZ(i, x, y, z);
      }
      geo.computeVertexNormals();
      return geo;
    }

    // (c) 真實蜜蜂前翅與後翅輪廓幾何 (Anatomical Forewing & Hindwing Shape)
    function createAnatomicalWingGeometry(isForewing = true, side = 1) {
      const len = isForewing ? 1.18 : 0.78;
      const wid = isForewing ? 0.42 : 0.28;
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      // 前緣脈 (Costal margin) 平直微拱
      shape.bezierCurveTo(len * 0.35, wid * 0.22, len * 0.78, wid * 0.28, len, wid * 0.06);
      // 翅尖至外緣 (Apical & Outer margin) 圓弧收回
      shape.bezierCurveTo(len * 1.02, -wid * 0.28, len * 0.65, -wid * 0.78, len * 0.28, -wid * 0.68);
      // 臀區內緣 (Anal margin) 收回翅基
      shape.quadraticCurveTo(len * 0.1, -wid * 0.35, 0, 0);

      const outlineGeo=new THREE.ShapeGeometry(shape,16),triangles=outlineGeo.toNonIndexed(),vertices=[];
      // Subdivide the actual membrane so its camber also exists between veins.
      function subdivide(a,b,c,depth) {
        if(!depth){vertices.push(...a.toArray(),...b.toArray(),...c.toArray());return;}
        const ab=a.clone().lerp(b,0.5),bc=b.clone().lerp(c,0.5),ca=c.clone().lerp(a,0.5);
        subdivide(a,ab,ca,depth-1);subdivide(ab,b,bc,depth-1);
        subdivide(ca,bc,c,depth-1);subdivide(ab,bc,ca,depth-1);
      }
      for(let i=0;i<triangles.attributes.position.count;i+=3)subdivide(
        new THREE.Vector3().fromBufferAttribute(triangles.attributes.position,i),
        new THREE.Vector3().fromBufferAttribute(triangles.attributes.position,i+1),
        new THREE.Vector3().fromBufferAttribute(triangles.attributes.position,i+2),1);
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
      outlineGeo.dispose();triangles.dispose();
      // 計算精確對齊翅脈貼圖的 UV (0~1)
      const pos = geo.attributes.position;
      const uvs = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) {
        const px = pos.getX(i);
        const py = pos.getY(i);
        const u = THREE.MathUtils.clamp(px / len, 0, 1);
        const v = THREE.MathUtils.clamp(1.0 - (wid * 0.28 - py) / (wid * 1.08), 0, 1);
        uvs[i * 2] = u;
        uvs[i * 2 + 1] = v;

        // 賦予翅面極細微的空氣動力學拱度 (Camber)
        const camberZ = Math.sin(u * Math.PI) * 0.022;
        pos.setXYZ(i, px * side, camberZ, -py);
      }
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geo.computeVertexNormals();
      geo.userData.wingOutline=shape.getPoints(48).map(p=>new THREE.Vector3(p.x*side,Math.sin(p.x/len*Math.PI)*0.022+0.0015,-p.y));
      return geo;
    }

    const sharedAbdomenGeo = createAnatomicalAbdomenGeometry();
    const sharedHeadGeo = createAnatomicalHeadGeometry();

    function createBee(isCompanion = false) {
      const beeRoot = new THREE.Group();
      const beeModel = new THREE.Group();
      beeRoot.add(beeModel);
      beeRoot.scale.setScalar(0.28);

      // 寫實 PBR 幾丁質與絲絨毛皮材質
      const thoraxVelvetMat = new THREE.MeshPhysicalMaterial({
        color: 0x392b1e,
        roughness: 0.86,
        metalness: 0.04,
        sheen: 0.38,
        sheenRoughness: 0.8,
        sheenColor: new THREE.Color(0xf5c36c)
      });
      const headChitinMat = new THREE.MeshPhysicalMaterial({
        color: 0x251b13,
        roughness: 0.7,
        metalness: 0,
        bumpMap: abdomenTex.bumpMap,
        bumpScale: 0.004,
        sheen: 0.25,
        sheenRoughness: 0.5,
        sheenColor: new THREE.Color(0xc99342)
      });
      const legChitinMat = new THREE.MeshPhysicalMaterial({
        color: 0x24160c,
        roughness: 0.49,
        metalness: 0,
        clearcoat: 0.18,
        clearcoatRoughness: 0.25,
        sheen: 0.5,
        sheenColor: new THREE.Color(0xb87d2e)
      });
      const abdomenMat = new THREE.MeshPhysicalMaterial({
        map: abdomenTex.colorMap,
        bumpMap: abdomenTex.bumpMap,
        bumpScale: 0.006,
        roughness: 0.58,
        metalness: 0,
        clearcoat: 0.1, // 幾丁質背板微亮角質層
        clearcoatRoughness: 0.32,
        sheen: 0.12,
        sheenRoughness: 0.7,
        sheenColor: new THREE.Color(0xd9a960)
      });
      // Compound eyes are dull grey-brown, faceted and finely hairy rather than glassy.
      const compoundEyeMat = new THREE.MeshPhysicalMaterial({
        color: 0x191b18,
        roughness: 0.38,
        metalness: 0,
        map: null,
        bumpMap: ommatidiaTex,
        bumpScale: 0.0024, // Resolved compound-eye facets at macro scale
        clearcoat: 0.3,
        clearcoatRoughness: 0.4,
        sheen: 0.35,
        sheenRoughness: 0.55,
        sheenColor: new THREE.Color(0x7d7468)
      });
      const ocellusMat = new THREE.MeshPhysicalMaterial({
        color: 0x2a2018, roughness: 0.35, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.2
      });
      const pollenPelletMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: materialMaps[5].colorMap,
        roughness: 0.78,
        bumpMap: materialMaps[5].bumpMap,
        bumpScale: 0.004
      });

      // 1. 頭部關節階層 (Head Capsule, Compound Eyes, 3 Ocelli, Mandibles, Proboscis, Geniculate Antennae)
      const headGroup = new THREE.Group();
      headGroup.position.set(0, 0.015, 0.49);
      headGroup.scale.set(0.89,0.89,0.88);
      beeModel.add(headGroup);

      const headMesh = new THREE.Mesh(sharedHeadGeo, headChitinMat);
      headMesh.castShadow = true;
      headGroup.add(headMesh);

      // 兩側大型腎形/長橢圓複眼 (Compound Eyes)
      const eyeGeo = new THREE.SphereGeometry(0.135, 28, 20);
      eyeGeo.scale(0.68, 1.35, 0.97);
      // Flatten the inner face so each kidney-shaped eye sits into the head capsule.
      const eyePos = eyeGeo.attributes.position;
      for (let i = 0; i < eyePos.count; i++) if (eyePos.getX(i) < 0) eyePos.setX(i, eyePos.getX(i) * 0.35);
      eyeGeo.computeVertexNormals();
      const compoundEyes = [];
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(eyeGeo, compoundEyeMat);
        eye.position.set(side * 0.184, 0.031, 0.065);
        eye.scale.x = side;
        eye.rotation.z = -side * 0.18;
        eye.rotation.y = side * 0.3;
        headGroup.add(eye);
        compoundEyes.push(eye);
      }

      // 頭頂倒三角形排列的 3 顆晶瑩單眼 (Ocelli)
      const ocellusGeo = new THREE.SphereGeometry(0.015, 10, 10);
      const ocelliCoords = [
        [0, 0.225, 0.093],
        [-0.044, 0.198, 0.119],
        [0.044, 0.198, 0.119]
      ];
      ocelliCoords.forEach(([ox, oy, oz]) => {
        const oc = new THREE.Mesh(ocellusGeo, ocellusMat);
        oc.position.set(ox, oy, oz);
        headGroup.add(oc);
      });

      // Flattened trapezoidal clypeus below the antennal sockets, continuous with the face.
      const clypeusGeo=new THREE.SphereGeometry(1,18,12);
      clypeusGeo.scale(0.082,0.078,0.030);clypeusGeo.translate(0,-0.095,0.132);
      headGroup.add(new THREE.Mesh(clypeusGeo,headChitinMat));

      // 一對上顎 (Mandibles) 與可伸展長喙口器 (Proboscis: Galea + Labial Palps + Glossa)
      for (const side of [-1, 1]) {
        // Small mandibles tucked against the face so they do not read as leg stubs.
        const mandible = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.065, 8), legChitinMat);
        mandible.position.set(side * 0.041, -0.185, 0.073);
        mandible.rotation.z = -side * 0.35;
        mandible.rotation.x = 0.35;
        headGroup.add(mandible);
      }

      const proboscisPivot = new THREE.Group();
      proboscisPivot.position.set(0, -0.19, 0.075);
      proboscisPivot.rotation.x = 0.62; // Feeding glossa reaches down into the florets below the head.
      // A tapered, slightly curved amber glossa, sheathed at its base by the paired galeae.
      const glossaSegments = 24;
      const glossaCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.008, 0.15), new THREE.Vector3(0, -0.022, 0.29)]);
      const glossaGeo = new THREE.TubeGeometry(glossaCurve, glossaSegments, 0.005, 8, false);
      const glossaPos = glossaGeo.attributes.position, ringCenter = new THREE.Vector3(), glossaPoint = new THREE.Vector3();
      for (let i = 0; i < glossaPos.count; i++) {
        const ring = Math.floor(i / 9);
        glossaCurve.getPointAt(ring / glossaSegments, ringCenter);
        glossaPoint.fromBufferAttribute(glossaPos, i).sub(ringCenter).multiplyScalar(1 - 0.62 * ring / glossaSegments).add(ringCenter);
        glossaPos.setXYZ(i, glossaPoint.x, glossaPoint.y, glossaPoint.z);
      }
      glossaGeo.computeVertexNormals();
      const glossaMat = new THREE.MeshStandardMaterial({ color: 0x6e4a26, roughness: 0.6, metalness: 0 });
      const glossaMesh = new THREE.Mesh(glossaGeo, glossaMat);
      proboscisPivot.add(glossaMesh);
      for (const side of [-1, 1]) {
        const galeaGeo = new THREE.CylinderGeometry(0.003, 0.008, 0.15, 8);
        galeaGeo.rotateX(Math.PI / 2);
        galeaGeo.scale(1, 0.55, 1);
        galeaGeo.translate(side * 0.008, -0.003, 0.075);
        proboscisPivot.add(new THREE.Mesh(galeaGeo, legChitinMat));
      }
      proboscisPivot.scale.set(1, 1, 0.01);
      headGroup.add(proboscisPivot);

      // 屈膝式觸角 (Geniculate Antennae)：臉部觸角窩 + 細長柄節 + 梗節 + 10 節漸細下垂的鞭節
      const antennaMat = new THREE.MeshPhysicalMaterial({
        color: 0x2a1c12, roughness: 0.62, metalness: 0, sheen: 0.25, sheenRoughness: 0.6, sheenColor: new THREE.Color(0x8a6a44)
      });
      const antennaeList = [];
      for (const side of [-1, 1]) {
        const scapePivot = new THREE.Group();
        scapePivot.position.set(side * 0.072, -0.006, 0.174);
        scapePivot.rotation.set(-0.25, side * 0.38, -side * 0.18);
        scapePivot.add(new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), antennaMat)); // torulus socket

        const scapeGeo = new THREE.CylinderGeometry(0.0125, 0.016, 0.2, 10);
        scapeGeo.translate(0, 0.1, 0);
        const scapeMesh = new THREE.Mesh(scapeGeo, antennaMat);

        const flagellumPivot = new THREE.Group();
        flagellumPivot.position.y = 0.2;
        flagellumPivot.rotation.x = 0.95; // 真實蜜蜂觸角明顯的屈膝折角
        flagellumPivot.add(new THREE.Mesh(new THREE.SphereGeometry(0.0165, 10, 8), antennaMat)); // pedicel
        let joint = flagellumPivot, offset = 0.012;
        for (let s = 0; s < 10; s++) {
          const length = s === 0 ? 0.036 : 0.032, radius = 0.0122 - s * 0.00025;
          const segment = new THREE.Group();
          segment.position.y = offset;
          segment.rotation.x = s === 0 ? 0 : 0.035;
          segment.rotation.z = s === 0 ? 0 : -side * 0.03; // flagellum arcs forward and outward, clear of the face
          const segmentGeo = new THREE.CylinderGeometry(radius * 0.93, radius, length * 0.92, 8);
          segmentGeo.translate(0, length * 0.46, 0);
          segment.add(new THREE.Mesh(segmentGeo, antennaMat));
          joint.add(segment); joint = segment; offset = length;
        }
        const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.0095, 8, 6), antennaMat);
        antennaTip.position.y = offset * 0.92;
        joint.add(antennaTip);

        scapeMesh.add(flagellumPivot);
        scapePivot.add(scapeMesh);
        headGroup.add(scapePivot);
        antennaeList.push({ group: scapePivot, flagellum: flagellumPivot, baseRotX: -0.25, side });
      }

      // 2. 胸部與細密分枝絨毛 (Mesosoma + 3D Instanced Fur Coat)
      const thoraxGroup = new THREE.Group();
      thoraxGroup.position.set(0, 0.04, 0.12);
      beeModel.add(thoraxGroup);

      const thoraxGeo = new THREE.SphereGeometry(0.36, 28, 22);
      thoraxGeo.scale(0.80, 0.79, 1.12);
      const tp=thoraxGeo.attributes.position;
      for(let i=0;i<tp.count;i++) {
        const z=tp.getZ(i),waist=1-0.13*Math.exp(-(((z+0.24)/0.10)**2));
        tp.setXYZ(i,tp.getX(i)*waist,tp.getY(i)*(z<0?0.90:1),z);
      }
      thoraxGeo.computeVertexNormals();
      const thoraxMesh = new THREE.Mesh(thoraxGeo, thoraxVelvetMat);
      thoraxMesh.castShadow = true;
      thoraxGroup.add(thoraxMesh);

      // Fine branched setae use buffers instead of thick cone spikes.
      function addSetae(parent, radii, count, length, tint) {
        const vertices = [], colors = [], base = new THREE.Color(tint);
        const normal = new THREE.Vector3(), start = new THREE.Vector3(), end = new THREE.Vector3();
        const surface=parent===headGroup?sharedHeadGeo:parent===thoraxGroup?thoraxGeo:null;
        const triangles=[],cumulative=[];let totalArea=0;
        if(surface) {
          const pos=surface.attributes.position,idx=surface.index;
          const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
          for(let k=0;k<(idx?idx.count:pos.count);k+=3) {
            const ids=[0,1,2].map(j=>idx?idx.getX(k+j):k+j);
            a.fromBufferAttribute(pos,ids[0]);b.fromBufferAttribute(pos,ids[1]);c.fromBufferAttribute(pos,ids[2]);
            totalArea+=b.sub(a).cross(c.sub(a)).length()*0.5;
            triangles.push(ids);cumulative.push(totalArea);
          }
        }
        function segment(a, b, brightness) {
          const lateral=new THREE.Vector3().subVectors(b,a).cross(normal).normalize().multiplyScalar(0.00065);
          vertices.push(a.x-lateral.x,a.y-lateral.y,a.z-lateral.z,a.x+lateral.x,a.y+lateral.y,a.z+lateral.z,b.x,b.y,b.z);
          for(const shade of [brightness,brightness,brightness*0.65])colors.push(base.r*shade,base.g*shade,base.b*shade);
        }
        for (let i = 0; i < count; i++) {
          const y = 1 - 2 * Math.random(), r = Math.sqrt(1 - y * y), a = Math.random()*Math.PI*2;
          normal.set(Math.cos(a) * r, y, Math.sin(a) * r);
          start.set(normal.x * radii.x, normal.y * radii.y, normal.z * radii.z);
          if(surface) {
            const area=Math.random()*totalArea;let lo=0,hi=cumulative.length-1;
            while(lo<hi){const mid=(lo+hi)>>1;if(cumulative[mid]<area)lo=mid+1;else hi=mid;}
            const ids=triangles[lo],u=Math.sqrt(Math.random()),v=Math.random(),weights=[1-u,u*(1-v),u*v];
            start.set(0,0,0);normal.set(0,0,0);
            ids.forEach((id,j)=>{
              start.addScaledVector(new THREE.Vector3().fromBufferAttribute(surface.attributes.position,id),weights[j]);
              normal.addScaledVector(new THREE.Vector3().fromBufferAttribute(surface.attributes.normal,id),weights[j]);
            });normal.normalize();start.addScaledVector(normal,0.0008);
          }
          const patch=0.52+0.48*Math.sin(a*4+y*7)**2;
          const len = length*(0.5+Math.random()*0.65)*(0.8+patch*0.2);
          const tangent=new THREE.Vector3(Math.random()-0.5,Math.random()-0.5,Math.random()-0.5).projectOnPlane(normal);
          const sweep=normal.clone().multiplyScalar(0.85).addScaledVector(tangent,0.40).add(new THREE.Vector3(0,0.02,-0.20)).normalize();
          const middle=start.clone().addScaledVector(normal,len*0.3).addScaledVector(sweep,len*0.32);
          end.copy(start).addScaledVector(sweep,len).addScaledVector(tangent,len*0.2);
          const shade=0.62+Math.max(0,normal.y*0.5+normal.x*0.2)*0.22+Math.random()*0.16;
          segment(start,middle,shade);segment(middle,end,shade*1.05);
          if (i % 3 === 0) {
            const mid = start.clone().lerp(end, 0.6);
            const branch = mid.clone().addScaledVector(sweep, len * 0.28).add(new THREE.Vector3(len * 0.18, len * 0.1, 0));
            segment(mid, branch, shade);
          }
        }
        const g = new THREE.BufferGeometry();g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        g.computeVertexNormals();
        const fur = new THREE.Mesh(g, new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide}));
        fur.userData.isSetae=true;
        parent.add(fur);
      }
      addSetae(thoraxGroup, new THREE.Vector3(0.288, 0.302, 0.403), isCompanion ? 1600 : 32000, 0.039, 0x9a8056);
      addSetae(headGroup, new THREE.Vector3(0.235, 0.248, 0.12), isCompanion ? 250 : 3800, 0.018, 0x87765b);
      if (!isCompanion) compoundEyes.forEach(eye => addSetae(eye, new THREE.Vector3(0.0675, 0.1755, 0.108), 260, 0.009, 0x8a8172));



          // 3. 腹部關節階層 (Metasoma with Petiole & 6 Tergites)
      // Narrow petiole (waist) between the propodeum and the first tergite.
      const petiole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.11, 12), legChitinMat);
      petiole.rotation.x = Math.PI / 2;
      petiole.position.set(0, -0.005, -0.285);
      beeModel.add(petiole);
      const abdomenGroup = new THREE.Group();
      abdomenGroup.position.set(0, 0.01, -0.31);
      abdomenGroup.scale.set(0.93,0.94,1.10);
      abdomenGroup.rotation.x = -0.06;
      beeModel.add(abdomenGroup);

      const abdomenMesh = new THREE.Mesh(sharedAbdomenGeo, abdomenMat);
      abdomenMesh.castShadow = true;
      abdomenMesh.receiveShadow = true;
      abdomenGroup.add(abdomenMesh);
      const abdominalHair = [], abdominalColors = [];
      for (let i = 0; i < (isCompanion ? 800 : 6000); i++) {
        const t = Math.random() * 0.82 + 0.08, angle = Math.random() * Math.PI * 2;
        const sample = sharedAbdomenGeo.attributes.position;
        const row = Math.min(89, Math.floor(t * 90)), col = Math.min(63, Math.floor(angle / (Math.PI * 2) * 64));
        // Scatter roots inside a lattice cell instead of on its vertices, so the hair has no grid.
        const v = col * 91 + row, wu = Math.random(), wv = Math.random() * (1 - wu);
        const p = new THREE.Vector3().fromBufferAttribute(sample, v).multiplyScalar(1 - wu - wv)
          .add(new THREE.Vector3().fromBufferAttribute(sample, v + 91).multiplyScalar(wu))
          .add(new THREE.Vector3().fromBufferAttribute(sample, v + 1).multiplyScalar(wv));
        const outward = new THREE.Vector3(p.x, p.y + t*t*0.11, 0).normalize();
        const fringe=tergiteBounds.some(b=>t>b&&t<b+0.035);
        if(!fringe&&Math.random()<0.80)continue;
        const len = fringe?0.009+Math.random()*0.010:0.003+Math.random()*0.006;
        const q = p.clone().addScaledVector(outward, len).add(new THREE.Vector3(0, 0, -len * 0.5));
        abdominalHair.push(p.x,p.y,p.z,q.x,q.y,q.z);
        const c = new THREE.Color(0xa59470).multiplyScalar(0.45 + Math.max(0,outward.y)*0.5 + Math.random()*0.18);
        abdominalColors.push(c.r,c.g,c.b,c.r,c.g,c.b);
      }
      const abHairGeo = new THREE.BufferGeometry();
      abHairGeo.setAttribute('position', new THREE.Float32BufferAttribute(abdominalHair,3));
      abHairGeo.setAttribute('color', new THREE.Float32BufferAttribute(abdominalColors,3));
      abdomenGroup.add(new THREE.LineSegments(abHairGeo,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:0.28})));

      const stingerGeo = new THREE.ConeGeometry(0.022, 0.12, 8);
      stingerGeo.rotateX(-Math.PI / 2);
      const stingerMesh = new THREE.Mesh(stingerGeo, legChitinMat);
      stingerMesh.position.set(0, -0.1, -1.02);
      // A worker keeps its sting retracted during ordinary foraging.
      stingerMesh.visible = false;
      abdomenGroup.add(stingerMesh);

      // 4. 六足真實解剖關節 (Coxa -> Femur -> Tibia -> Basitarsus -> Tarsal Claws + Corbicula 花粉籃)
      const legJoints = [];
      const pollenBaskets = [];
      const legSpecs = [
        { z: 0.28, x: 0.22, yaw: 0.52, femurLen: 0.21, tibiaLen: 0.20 },  // 前足 (Prothoracic)
        { z: 0.08, x: 0.26, yaw: 0.05, femurLen: 0.23, tibiaLen: 0.23 },  // 中足 (Mesothoracic)
        { z: -0.17, x: 0.25, yaw: -0.28, femurLen: 0.33, tibiaLen: 0.31 } // 後足 (Metathoracic - 具寬扁脛節花粉籃)
      ];

      legSpecs.forEach((spec, idx) => {
        for (const side of [-1, 1]) {
          const coxaPivot = new THREE.Group();
          coxaPivot.position.set(side * spec.x, -0.16, spec.z);
          coxaPivot.rotation.y = -side * spec.yaw;
          coxaPivot.rotation.z = side * 0.58;

          // 基節 (Coxa) fixed to the thorax underside, then a small trochanter at the femur root.
          const innerRoot=new THREE.Vector3(side*(idx===2?0.105:0.16),-0.085,spec.z+(idx===2?0.09:0.015));
          const outerRoot=coxaPivot.position.clone();
          const basalCurve=new THREE.CatmullRomCurve3([innerRoot,innerRoot.clone().lerp(outerRoot,0.52).add(new THREE.Vector3(0,-0.012,0)),outerRoot]);
          const coxaMesh=new THREE.Mesh(new THREE.TubeGeometry(basalCurve,8,0.024,10,false),legChitinMat);
          coxaMesh.castShadow=true;beeModel.add(coxaMesh);
          const socket=new THREE.Mesh(new THREE.SphereGeometry(0.027,12,8),thoraxVelvetMat);
          socket.scale.set(1,0.7,1.25);socket.position.copy(innerRoot);beeModel.add(socket);

          // 腿節 (Femur)：spindle-shaped, narrow at the trochanter, swelling, then tapering into the knee.
          const femurGeo = new THREE.LatheGeometry([
            new THREE.Vector2(0.001, 0), new THREE.Vector2(0.019, 0.012), new THREE.Vector2(0.024, spec.femurLen * 0.3),
            new THREE.Vector2(0.019, spec.femurLen * 0.7), new THREE.Vector2(0.017, spec.femurLen * 0.97), new THREE.Vector2(0.001, spec.femurLen)
          ], 10);
          femurGeo.rotateX(Math.PI); // lathe grows along +Y; the femur hangs along -Y
          const femurMesh = new THREE.Mesh(femurGeo, legChitinMat);
          femurMesh.castShadow = true;
          const trochanter = new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 8), legChitinMat);
          trochanter.position.y = -0.014;
          femurMesh.add(trochanter);
          const femurBristles = [];
          for (let j = 0; j < 48; j++) {
            const along = 0.2 + Math.random() * 0.7, a = Math.random() * Math.PI * 2, r = 0.024;
            const bx = Math.cos(a) * r, bz = Math.sin(a) * r, by = -along * spec.femurLen;
            femurBristles.push(bx, by, bz, bx * 1.6, by - 0.012 - Math.random() * 0.01, bz * 1.6);
          }
          const femurBristleGeo = new THREE.BufferGeometry();
          femurBristleGeo.setAttribute('position', new THREE.Float32BufferAttribute(femurBristles, 3));
          femurMesh.add(new THREE.LineSegments(femurBristleGeo, new THREE.LineBasicMaterial({ color: 0x8c6e40, transparent: true, opacity: 0.55 })));

          // 脛節樞紐 (Tibia Pivot)
          const tibiaPivot = new THREE.Group();
          tibiaPivot.position.y = -spec.femurLen;
          tibiaPivot.rotation.z = -side * 0.78;

          // 後足脛節 (Corbicula) 明顯寬扁呈三角形凹面，前中足為修長圓柱
          const tibiaGeo = new THREE.CylinderGeometry(
            idx === 2 ? 0.024 : 0.019,
            idx === 2 ? 0.043 : 0.012,
            spec.tibiaLen, 10, 3
          );
          if (idx === 2) tibiaGeo.scale(0.65, 1.0, 1.35);
          tibiaGeo.translate(0, -spec.tibiaLen * 0.5, 0);
          const tibiaMesh = new THREE.Mesh(tibiaGeo, legChitinMat);
          tibiaMesh.castShadow = true;

          // 跗節 (Basitarsus & Tarsomeres) + 末端雙爪 (Tarsal Claws)
          const tarsusPivot = new THREE.Group();
          tarsusPivot.position.y = -spec.tibiaLen;
          tarsusPivot.rotation.z = side * 0.35;

          const basitarsusMesh=new THREE.Group();
          let jointY=0;
          for(let segment=0;segment<5;segment++) {
            const length=segment===0?0.075:0.019;
            const radius=(idx===2?0.017:0.012)*(1-segment*0.14);
            const g=new THREE.CylinderGeometry(radius,radius*0.72,length*1.04,8);
            if(idx===2&&segment===0)g.scale(1.55,1,0.7); // broad, flattened hind basitarsus (pollen brush)
            const part=new THREE.Mesh(g,legChitinMat);part.position.y=-jointY-length/2;
            basitarsusMesh.add(part);
            for(let j=0;j<5;j++) {
              const a=j*Math.PI*0.4,root=new THREE.Vector3(Math.cos(a)*radius,-jointY-length*0.65,Math.sin(a)*radius);
              const g=new THREE.BufferGeometry().setFromPoints([root,root.clone().add(new THREE.Vector3(Math.cos(a)*0.009,-0.012,Math.sin(a)*0.009))]);
              basitarsusMesh.add(new THREE.Line(g,new THREE.LineBasicMaterial({color:0x9a7848,transparent:true,opacity:0.7})));
            }
            jointY+=length;
          }
          for(const cSide of [-1,1]) {
            const curve=new THREE.CatmullRomCurve3([
              new THREE.Vector3(0,-0.148,cSide*0.005),
              new THREE.Vector3(side*0.009,-0.161,cSide*0.012),
              new THREE.Vector3(side*0.005,-0.1685,cSide*0.016)]);
            basitarsusMesh.add(new THREE.Mesh(new THREE.TubeGeometry(curve,6,0.0032,5,false),legChitinMat));
          }
          tarsusPivot.add(basitarsusMesh);
          const knee=new THREE.Mesh(new THREE.SphereGeometry(idx===2?0.012:0.011,10,8),legChitinMat);
          tibiaPivot.add(knee);
          const bristles=[];
          for(let j=0;j<65;j++) {
            const t=Math.random(),a=Math.random()*Math.PI*2,r=idx===2?0.029:0.014;
            const x=Math.cos(a)*r,z=Math.sin(a)*r,y=-t*spec.tibiaLen;
            bristles.push(x,y,z,x*1.5,y-0.015-Math.random()*0.012,z*1.5);
          }
          const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.Float32BufferAttribute(bristles,3));
          tibiaMesh.add(new THREE.LineSegments(bg,new THREE.LineBasicMaterial({color:0x8c6e40,transparent:true,opacity:0.6})));
          const footTip = new THREE.Object3D(); footTip.position.y = -0.1685;
          tarsusPivot.add(footTip);
          tibiaMesh.add(tarsusPivot);

          // 後足脛節外側附著真實顆粒感金橙色花粉團 (Pollen Pellet in Corbicula)
          if (idx === 2 && !isCompanion) {
            const basketGroup = new THREE.Group();
            basketGroup.position.set(side * 0.021, -spec.tibiaLen * (side<0?0.58:0.50), 0);

            const pelletGeo = new THREE.SphereGeometry(0.092, 16, 14);
            const pelletVertices = pelletGeo.attributes.position;
            for (let v=0;v<pelletVertices.count;v++) {
              const p=new THREE.Vector3().fromBufferAttribute(pelletVertices,v);
              const rough=0.0035*Math.sin(p.x*71+p.y*47)*Math.cos(p.z*63+p.x*31);
              p.addScaledVector(p.clone().normalize(),rough);pelletVertices.setXYZ(v,p.x,p.y,p.z);
            }
            pelletGeo.scale(side<0?0.39:0.46, side<0?1.05:0.86, 0.56);pelletGeo.computeVertexNormals();
            const pelletMesh = new THREE.Mesh(pelletGeo, pollenPelletMat);
            pelletMesh.castShadow = true;

            basketGroup.add(pelletMesh);
            basketGroup.scale.setScalar(0.001);
            tibiaMesh.add(basketGroup);
            pollenBaskets.push(basketGroup);
          }

          tibiaPivot.add(tibiaMesh);
          femurMesh.add(tibiaPivot);
          coxaPivot.add(femurMesh);
          beeModel.add(coxaPivot);

          legJoints.push({
            coxa: coxaPivot,
            tibia: tibiaPivot,
            foot: footTip,
            femurLength: spec.femurLen,
            tibiaLength: spec.tibiaLen,
            tarsalAngle: tarsusPivot.rotation.z,
            side,
            index: idx,
            baseYaw: coxaPivot.rotation.y,
            baseCoxaZ: coxaPivot.rotation.z,
            baseTibiaZ: tibiaPivot.rotation.z
          });
        }
      });

      // 5. 寫實前翅與後翅 (Anatomical Forewings & Hindwings with Venation & Iridescence)
      const wingMat = new THREE.MeshPhysicalMaterial({
        // Geometry supplies venation without a second misaligned texture overlay.
        map: null,
        color: 0xffffff,
        transparent: true,
        opacity: 0.23,
        roughness: 0.19,
        metalness: 0,
        transmission: 0.86,
        thickness: 0.0008,
        ior: 1.36,
        envMapIntensity: 0.28,
        iridescence: 0.08,
        iridescenceIOR: 1.38,
        iridescenceThicknessRange: [120, 420],
        side: THREE.DoubleSide,
        depthWrite: false
      });

      const leftWingPivot = new THREE.Group();
      leftWingPivot.position.set(0.17, 0.28, 0.18);

      const rightWingPivot = new THREE.Group();
      rightWingPivot.position.set(-0.17, 0.28, 0.18);

      const veinMat=new THREE.MeshStandardMaterial({color:0x685a42,roughness:0.7,transparent:true,opacity:0.78});
      function addWingVeins(mesh,side,fore) {
        const len=fore?1.18:0.78,wid=fore?0.42:0.28;
        function vein(points,radius) {
          const curve=new THREE.CatmullRomCurve3(points);
          const tube=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(8,points.length*4),radius,5,false),veinMat);
          tube.userData.isWingVein=true;mesh.add(tube);
        }
        vein(mesh.geometry.userData.wingOutline,0.0011);
        // Connected longitudinal veins and cross-veins share exact graph nodes.
        const paths=[
          [[0,0],[0.30,-0.10],[0.65,-0.10],[0.94,-0.01]],
          [[0,0],[0.30,0.18],[0.62,0.28],[0.90,0.19]],
          [[0,0],[0.25,0.38],[0.52,0.47],[0.73,0.37]],
          [[0.30,-0.10],[0.34,0.07],[0.30,0.18]],
          [[0.65,-0.10],[0.65,0.09],[0.62,0.28]],
          [[0.30,0.18],[0.28,0.28],[0.25,0.38]],
          [[0.62,0.28],[0.57,0.38],[0.52,0.47]]
        ];
        paths.forEach((path,i)=>vein(path.map(([u,q])=>new THREE.Vector3(
          side*u*len,Math.sin(u*Math.PI)*0.022+0.0025,q*wid)),i<3?0.00165:0.0010));
      }

      function buildRealisticWingPair(side) {
        const pairGroup = new THREE.Group();
        const foreGeo = createAnatomicalWingGeometry(true, side);
        const foreMesh = new THREE.Mesh(foreGeo, wingMat);
        addWingVeins(foreMesh,side,true);
        foreMesh.rotation.y = -side * 0.28;

        const hindGeo = createAnatomicalWingGeometry(false, side);
        const hindMesh = new THREE.Mesh(hindGeo, wingMat);
        addWingVeins(hindMesh,side,false);
        hindMesh.position.set(side*0.012, -0.016, -0.085);
        hindMesh.rotation.y = -side * 1.05;

        const hinge=new THREE.Mesh(new THREE.SphereGeometry(0.025,12,8),legChitinMat);
        hinge.scale.set(1,0.55,1.4);hinge.position.set(0,-0.007,-0.015);
        const hindBase=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.016,0.09,10),legChitinMat);
        hindBase.position.set(side*0.006,-0.012,-0.043);hindBase.rotation.x=Math.PI/2;
        pairGroup.add(foreMesh, hindMesh,hinge,hindBase);
        pairGroup.scale.set(0.86,1,0.94);
        return pairGroup;
      }

      const wingBlur = [];
      if (!isCompanion) for (const side of [-1,1]) for (let sample=0;sample<3;sample++) {
        const blur = buildRealisticWingPair(side);
        const blurMat = wingMat.clone();blurMat.opacity = 0.055;blurMat.transmission = 0;
        blur.traverse(part=>{if(part.isMesh)part.material=blurMat;});
        blur.position.set(side*0.17,0.28,0.18);blur.visible=false;
        beeModel.add(blur);wingBlur.push({group:blur,side,phase:sample*1.1});
      }
      leftWingPivot.add(buildRealisticWingPair(1));
      rightWingPivot.add(buildRealisticWingPair(-1));
      beeModel.add(leftWingPivot, rightWingPivot);

      if (!isCompanion) {
        scene.add(beeRoot);
      }

      return {
        root: beeRoot,
        landingAnchor: new THREE.Vector3(),
        model: beeModel,
        head: headGroup,
        abdomen: abdomenGroup,
        proboscis: proboscisPivot,
        antennae: antennaeList,
        pollenBaskets,
        wingMaterial: wingMat,
        wingBlur,
        leftWing: leftWingPivot,
        rightWing: rightWingPivot,
        legs: legJoints
      };
    }

    // ==========================================
    // Leg targets are intersected with the moving flower in the leg's hinge plane.
    const legYAxis = new THREE.Vector3(0, 1, 0);
    // Soft contact occlusion under each planted tarsus makes support readable at macro scale.
    const footShadowTexture = (() => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
      const ctx = canvas.getContext('2d'), gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, 'rgba(14,9,3,0.9)'); gradient.addColorStop(0.5, 'rgba(14,9,3,0.5)'); gradient.addColorStop(1, 'rgba(18,12,4,0)');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
    })();
    const footShadowMat = new THREE.MeshBasicMaterial({ map: footShadowTexture, transparent: true, opacity:0.48, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false });
    const footShadowNormal = new THREE.Vector3(0, 0, 1);
    const footShadows = Array.from({ length: 6 }, () => {
      const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.012, 24), footShadowMat);
      shadow.userData.keepMaterial = true; shadow.renderOrder = 2; shadow.visible = false; shadow.raycast = () => {};
      scene.add(shadow); return shadow;
    });
    function poseBeeOnFlower(subject, flower, time = 0, walking = false) {
      flower.headGroup.updateWorldMatrix(true, false);
      const support = flower.headGroup.worldToLocal(subject.landingAnchor.clone());
      const e = 0.004 * flower.scale;
      // Body orientation follows the receptacle; feet resolve the individual bud surfaces.
      const orientHeight=(x,z)=>flower.species==='sunflower'
        ?discHeight(flower.coreRadius,flower.coreHeight,Math.hypot(x,z),flower.species):flowerSurfaceHeight(flower,x,z);
      const dx = (orientHeight(support.x+e,support.z)-orientHeight(support.x-e,support.z))/(2*e);
      const dz = (orientHeight(support.x,support.z+e)-orientHeight(support.x,support.z-e))/(2*e);
      const localNormal = new THREE.Vector3(-dx,1,-dz).normalize();
      const up = localNormal.clone().transformDirection(flower.headGroup.matrixWorld);
      const forward = new THREE.Vector3(0,0,1).applyQuaternion(subject.root.quaternion).projectOnPlane(up);
      if(forward.lengthSq()<0.0001)forward.set(1,0,0).projectOnPlane(up);
      forward.normalize();const right = new THREE.Vector3().crossVectors(up,forward).normalize();
      const clearance = flower.species === 'lily' ? 0.14 : 0.12;
      support.y=flowerSurfaceHeight(flower,support.x,support.z);
      subject.root.position.copy(flower.headGroup.localToWorld(support)).addScaledVector(up,clearance);
      subject.root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,forward));
      subject.model.rotation.set(0,0,0);
      subject.root.updateMatrixWorld(true);
      const modelToFlower = flower.headGroup.matrixWorld.clone().invert().multiply(subject.model.matrixWorld);
      // Disc florets carry a wide, splayed stance so each tarsus lands outside the
      // body silhouette; lily tepals keep the narrow stance their cupped surface allows.
      const splayed = flower.species !== 'lily';
      const footLimit = splayed ? flower.coreRadius * 0.9 : Infinity;
      let legSlot = 0;
      for (const leg of subject.legs) {
        leg.coxa.rotation.y = (leg.baseYaw + leg.side*0.045*Math.sin(leg.index*2+leg.side)) * (splayed ? [1.38, 1, 0.65][leg.index] : 1);
        const phase = time * 2.1 + (leg.index + (leg.side < 0 ? 1 : 0)) * Math.PI;
        const lift = walking ? Math.pow(Math.max(0, Math.sin(phase)), 8) * 0.006 : 0;
        const a = leg.femurLength;
        const distalX = Math.sin(leg.tarsalAngle) * 0.1685;
        const distalY = leg.tibiaLength + Math.cos(leg.tarsalAngle) * 0.1685;
        const b = Math.hypot(distalX,distalY), offset = Math.atan2(distalX,distalY);
        let reach = flower.species === 'echinacea' && leg.index === 0 ? 0.075
          : (splayed ? [0.34,0.43,0.59] : [0.23,0.27,0.24])[leg.index];
        reach*=1+0.045*Math.sin(leg.index*2.3+leg.side);
        if(!walking&&flower.species==='sunflower') {
          // A resting claw targets a specific bud crown, rather than the gap between buds.
          const tentative=new THREE.Vector3(leg.side*reach,-0.45,0)
            .applyAxisAngle(legYAxis,leg.coxa.rotation.y).add(leg.coxa.position).applyMatrix4(modelToFlower);
          const crown=nearestSupportFloret(flower,tentative.x,tentative.z);
          if(crown) {
            const target=new THREE.Vector3(crown.x,crown.y,crown.z)
              .applyMatrix4(modelToFlower.clone().invert()).sub(leg.coxa.position);
            leg.coxa.rotation.y=Math.atan2(-leg.side*target.z,leg.side*target.x);
            reach=Math.hypot(target.x,target.z);
          }
        }
        let x = 0, y = 0, cosine = 0, foot = null;
        // Pull a foot back toward the body until it stays on the disc and within leg length.
        for (let attempt = 0; attempt < 6; attempt++) {
          x = leg.side * (reach + (walking ? Math.cos(phase) * 0.012 : 0));
          const footAt = height => new THREE.Vector3(x,height,0).applyAxisAngle(legYAxis,leg.coxa.rotation.y).add(leg.coxa.position).applyMatrix4(modelToFlower);
          const sample = height => { const point = footAt(height); return point.y - flowerSurfaceHeight(flower,point.x,point.z) - 0.0005*flower.scale - lift; };
          let lo = -0.9, hi = -0.12;
          // A tepal curling up beside the body can rise above the hinge; widen the bracket so the foot rests on it.
          while (hi < 0.2 && sample(hi) < 0) hi += 0.08;
          for (let i = 0; i < 13; i++) { const mid=(lo+hi)/2; if(sample(mid)>0)hi=mid;else lo=mid; }
          y = (lo+hi)/2;
          cosine = (x*x+y*y-a*a-b*b)/(2*a*b);
          foot = footAt(y);
          if ((cosine < 0.995 && Math.hypot(foot.x, foot.z) <= footLimit) || reach <= 0.2) break;
          reach = Math.max(0.2, reach * 0.88);
        }
        const bend = -leg.side * Math.acos(THREE.MathUtils.clamp(cosine,-0.9999,0.9999));
        leg.coxa.rotation.z = Math.atan2(x,-y) - Math.atan2(b*Math.sin(bend),a+b*Math.cos(bend));
        leg.tibia.rotation.z = bend - offset;
        if (subject === bee) {
          const shadow = footShadows[legSlot];
          foot.y = flowerSurfaceHeight(flower, foot.x, foot.z);
          shadow.position.copy(flower.headGroup.localToWorld(foot)).addScaledVector(up, 0.003);
          shadow.quaternion.setFromUnitVectors(footShadowNormal, up);
          shadow.visible = true;
        }
        legSlot++;
      }
      subject.root.updateMatrixWorld(true);
      if(subject===bee)updateContactLighting(subject.root.position);
    }

    function flowerFootContacts(subject, flower) {
      subject.root.updateMatrixWorld(true); flower.headGroup.updateWorldMatrix(true,false);
      return subject.legs.map(leg=>{
        const p=leg.foot.getWorldPosition(new THREE.Vector3());flower.headGroup.worldToLocal(p);
        return {side:leg.side,index:leg.index,clearance:p.y-flowerSurfaceHeight(flower,p.x,p.z),radial:Math.hypot(p.x,p.z)/flower.coreRadius};
      });
    }

    // 8. 粒子特效系統：環境飄浮花粉 + 採蜜粒子流 + 採蜜花粉爆發 (Burst Points)
    // ==========================================
    function createAmbientPollen() {
      const particleCount = 65;
      const positions = new Float32Array(particleCount * 3);
      const phases = new Float32Array(particleCount);

      for (let i = 0; i < particleCount; i++) {
        const r = Math.sqrt(Math.random()) * 15.0;
        const theta = Math.random() * Math.PI * 2;
        positions[i * 3] = Math.cos(theta) * r;
        positions[i * 3 + 1] = 0.4 + Math.random() * 8.5;
        positions[i * 3 + 2] = Math.sin(theta) * r;
        phases[i] = Math.random() * Math.PI * 2;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

      const mat = new THREE.PointsMaterial({
        size: 0.012,
        map: glowTex,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });

      const points = new THREE.Points(geo, mat);
      scene.add(points);
      return { points, geo };
    }

    function createStreamParticles() {
      const count = 48;
      const positions = new Float32Array(count * 3);
      const offsets = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        offsets[i] = i / count;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({
        size: 0.24,
        map: glowTex,
        color: 0xffee58,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const points = new THREE.Points(geo, mat);
      scene.add(points);
      return { points, geo, mat, offsets, count };
    }

    const burstPool = [];
    function createBurstPool() {
      const count = 140;
      const positions = new Float32Array(count * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({
        size: 0.008,
        map: glowTex,
        color: 0xffe57f,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const points = new THREE.Points(geo, mat);
      scene.add(points);

      for (let i = 0; i < count; i++) {
        burstPool.push({
          pos: new THREE.Vector3(0, -999, 0),
          vel: new THREE.Vector3(),
          life: 0
        });
      }
      return { points, geo, mat };
    }

    function triggerPollenBurst(origin, amount = 38, colorHex = 0xffe57f) {
      burstSystem.mat.color.setHex(colorHex);
      let spawned = 0;
      for (let i = 0; i < burstPool.length && spawned < amount; i++) {
        const p = burstPool[i];
        if (p.life <= 0) {
          p.pos.copy(origin);
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.random() * Math.PI * 0.7;
          const speed = 1.4 + Math.random() * 3.0;
          p.vel.set(
            Math.sin(phi) * Math.cos(theta) * speed,
            Math.abs(Math.cos(phi)) * speed + 1.2,
            Math.sin(phi) * Math.sin(theta) * speed
          );
          p.life = 0.65 + Math.random() * 0.55;
          spawned++;
        }
      }
    }

    function depositOneHoneyCell() {
      if (hiveState.filledCount < hiveState.maxCount) {
        const cell = hiveState.storageCells[hiveState.filledCount];
        cell.filled = true;
        cell.centerMesh.material = cell.honeyMat;
        hiveState.filledCount++;

        const cellWorldPos = new THREE.Vector3();
        cell.centerMesh.getWorldPosition(cellWorldPos);
        triggerPollenBurst(cellWorldPos, 22, 0xffca28);
      }
    }

    // ==========================================
    // 9. 建立場景實體與行為狀態機 (Behavior State Machine)
    // ==========================================
    createMeadow();
    createHoneycombStructure();

    // 在蜂巢外圍配置 3 隻同樣具備寫實解剖結構的同伴工蜂
    const companionOffsets = [
      new THREE.Vector3(-1.95, 1.1, 1.6),
      new THREE.Vector3(1.95, 0.9, 1.6),
      new THREE.Vector3(0.2, -1.95, 1.6)
    ];
    companionOffsets.forEach((pos, idx) => {
      const comp = createBee(true);
      comp.root.scale.setScalar(1.12);
      comp.root.position.copy(pos);
      comp.root.up.set(0, 0, 1);
      comp.root.lookAt(new THREE.Vector3(0, 0, 1.6));
      hiveState.group.add(comp.root);
      hiveState.companionBees.push({ ...comp, basePos: pos.clone(), phase: idx * 2.1 });
    });

    // 建立 6 朵具真實植物學特徵與費馬螺線花盤的寫實花朵
    const flowerSpecs = [
      {
        name: '向日葵 (Helianthus annuus)',
        species: 'sunflower',
        x: -1.2,
        z: -1.8,
        height: 4.4,
        petalBaseHex: '#e5b831',
        petalTipHex: '#eaca53',
        throatHex: '#b88a2e',
        centerColor: 0x3e2723,
        petalCount: 24,
        scale: 1.25
      },
      {
        name: '紫錐菊 (Echinacea purpurea)',
        species: 'echinacea',
        x: 0.15,
        z: 2.6,
        height: 3.5,
        petalBaseHex: '#c2185b',
        petalTipHex: '#f48fb1',
        throatHex: '#6a1b4d',
        centerColor: 0x6c442a,
        petalCount: 18,
        scale: 1.15
      },
      {
        name: '觀星者百合 (Lilium Stargazer)',
        species: 'lily',
        x: 4.4,
        z: 0.9,
        height: 4.1,
        petalBaseHex: '#d81b60',
        petalTipHex: '#fce4ec',
        throatHex: '#7cb342',
        centerColor: 0x558b2f,
        petalCount: 6,
        scale: 1.18
      },
      {
        name: '法國濱菊 (Leucanthemum)',
        species: 'daisy',
        x: 3.4,
        z: -3.9,
        height: 3.8,
        petalBaseHex: '#f5f5f5',
        petalTipHex: '#ffffff',
        throatHex: '#dce775',
        centerColor: 0xffb300,
        petalCount: 22,
        scale: 1.1
      },
      {
        name: '山百合 (Lilium auratum)',
        species: 'lily',
        x: -3.3,
        z: 3.4,
        height: 3.3,
        petalBaseHex: '#f2ecdb',
        petalTipHex: '#fff9ed',
        throatHex: '#c9aa46',
        centerColor: 0x689f38,
        petalCount: 6,
        scale: 1.08
      },
      {
        name: '粉紅波斯菊 (Cosmos bipinnatus)',
        species: 'cosmos',
        x: 5.9,
        z: 4.0,
        height: 3.1,
        petalBaseHex: '#bc527e',
        petalTipHex: '#e2a8bc',
        throatHex: '#ad1457',
        centerColor: 0xffca28,
        petalCount: 8,
        scale: 0.85
      }
    ];
    flowerSpecs.forEach((spec, idx) => createFlower(spec, idx));

    const bee = createBee(false);
    const ambientPollen = createAmbientPollen();
    const streamSystem = createStreamParticles();
    const burstSystem = createBurstPool();
    updateEnvironmentByTime(8.5);

    const curveGeo = new THREE.BufferGeometry();
    const curveMat = new THREE.LineDashedMaterial({
      color: 0xfff176,
      dashSize: 0.35,
      gapSize: 0.18,
      transparent: true,
      opacity: 0.78
    });
    const curveLine = new THREE.Line(curveGeo, curveMat);
    curveLine.visible = false;
    scene.add(curveLine);

    const beeState = {
      mode: 'MORNING_SORTIE',
      autoCycle: true,
      pollenLoad: 0.0,
      maxPollenLoad: 3.0,
      targetFlowerIdx: 0,
      bestFlowerIdx: 0,
      flightCurve: null,
      curveLength: 10,
      curveProgress: 0,
      actionTimer: 0,
      proboscisExt: 0,
      waggleAngle: 0,
      forwardDir: new THREE.Vector3(0, 0, 1)
    };

    const stateBadge = document.getElementById('state-badge');
    const telemetryInfo = document.getElementById('telemetry-info');
    const btnStageSortie = document.getElementById('btn-stage-sortie');
    const btnStageForage = document.getElementById('btn-stage-forage');
    const btnStageWaggle = document.getElementById('btn-stage-waggle');

    function setStageHighlight(activeStage) {
      btnStageSortie.classList.toggle('active', activeStage === 'SORTIE');
      btnStageForage.classList.toggle('active', activeStage === 'FORAGE');
      btnStageWaggle.classList.toggle('active', activeStage === 'WAGGLE');
    }

    function updateCurveVisual(curve, samples = 140) {
      const pts = curve.getPoints(samples);
      curveGeo.setFromPoints(pts);
      curveLine.computeLineDistances();
    }

    function startMorningSortie(fromHive = false) {
      beeState.mode = 'MORNING_SORTIE';
      beeState.actionTimer = 0;

      const startPt = fromHive
        ? hiveState.danceCenterWorld.clone().addScaledVector(hiveState.danceNormalWorld, 0.45)
        : bee.root.position.clone();

      const patrolWaypoints = [
        startPt,
        hiveState.danceCenterWorld.clone().add(new THREE.Vector3(2.8, 1.8, 3.0)),
        flowersList[0].nectarPos.clone().add(new THREE.Vector3(0, 1.2, 0)),
        flowersList[3].nectarPos.clone().add(new THREE.Vector3(0, 1.3, 0)),
        flowersList[2].nectarPos.clone().add(new THREE.Vector3(0, 1.2, 0)),
        flowersList[5].nectarPos.clone().add(new THREE.Vector3(0, 1.3, 0)),
        flowersList[1].nectarPos.clone().add(new THREE.Vector3(0, 1.1, 0)),
        flowersList[4].nectarPos.clone().add(new THREE.Vector3(0, 1.2, 0))
      ];

      const curve = new THREE.CatmullRomCurve3(patrolWaypoints, false, 'catmullrom', 0.5);
      beeState.flightCurve = curve;
      beeState.curveLength = curve.getLength();
      beeState.curveProgress = 0;
      updateCurveVisual(curve, 180);

      setStageHighlight('SORTIE');
      stateBadge.textContent = '晨間出擊';
      telemetryInfo.innerHTML =
        '🌅 <b>[晨間出擊]</b>：從蜂巢起飛，沿平滑 3D 曲線在草地與花叢上空巡航偵察花源。';
    }

    function pickBestFlower(excludeIdx = -1) {
      let bestIdx = 0;
      let bestScore = -999;
      flowersList.forEach((f, idx) => {
        if (idx === excludeIdx) return;
        const score = f.nectar * 3.0 + Math.random() * 0.6;
        if (score > bestScore) {
          bestScore = score;
          bestIdx = idx;
        }
      });
      return bestIdx;
    }

    function startForageFlight(flowerIdx = null) {
      const targetIdx = flowerIdx !== null ? flowerIdx : pickBestFlower(beeState.targetFlowerIdx);
      beeState.targetFlowerIdx = targetIdx;
      beeState.bestFlowerIdx = targetIdx;
      beeState.mode = 'FLYING_TO_FLOWER';
      beeState.actionTimer = 0;

      const startPos = bee.root.position.clone();
      const endPos = flowersList[targetIdx].nectarPos.clone();
      const dist = startPos.distanceTo(endPos);

      const p1 = startPos.clone().addScaledVector(beeState.forwardDir, Math.min(Math.max(dist * 0.25, 0.9), 2.8));
      p1.y = Math.max(p1.y + 0.5, 2.5);
      const mid = startPos.clone().lerp(endPos, 0.55);
      mid.y = Math.max(startPos.y, endPos.y) + Math.min(dist * 0.22, 1.8);
      const p3 = endPos.clone().add(new THREE.Vector3(0, 0.75, 0));

      const curve = new THREE.CatmullRomCurve3([startPos, p1, mid, p3, endPos], false, 'catmullrom', 0.5);
      beeState.flightCurve = curve;
      beeState.curveLength = Math.max(curve.getLength(), 0.5);
      beeState.curveProgress = 0;
      updateCurveVisual(curve, 100);

      setStageHighlight('FORAGE');
      const f = flowersList[targetIdx];
      stateBadge.textContent = '飛往花蕊';
      telemetryInfo.innerHTML =
        `🌼 <b>[採集花蜜]</b>：鎖定「${f.name}」，沿進場曲線準備精準降落於花蕊中心。`;
    }

    function startReturnForWaggleDance() {
      beeState.mode = 'FLYING_TO_HIVE';
      beeState.actionTimer = 0;

      const startPos = bee.root.position.clone();
      const endPos = hiveState.danceCenterWorld.clone();
      const dist = startPos.distanceTo(endPos);

      const p1 = startPos.clone().addScaledVector(beeState.forwardDir, Math.min(Math.max(dist * 0.25, 1.0), 3.0));
      p1.y = Math.max(p1.y + 0.6, 3.0);
      const mid = startPos.clone().lerp(endPos, 0.5);
      mid.y = Math.max(startPos.y, endPos.y) + 1.5;
      const p3 = endPos.clone().addScaledVector(hiveState.danceNormalWorld, 1.8);

      const curve = new THREE.CatmullRomCurve3([startPos, p1, mid, p3, endPos], false, 'catmullrom', 0.5);
      beeState.flightCurve = curve;
      beeState.curveLength = Math.max(curve.getLength(), 0.5);
      beeState.curveProgress = 0;
      updateCurveVisual(curve, 100);

      setStageHighlight('WAGGLE');
      stateBadge.textContent = '返巢報訊中';
      const targetFlower = flowersList[beeState.bestFlowerIdx];
      telemetryInfo.innerHTML =
        `♾️ <b>[八字舞準備]</b>：攜帶「${targetFlower.name}」花蜜與座標返航蜂巢表面。`;
    }

    bee.root.position.copy(flowersList[0].nectarPos);
    bee.landingAnchor.copy(bee.root.position);
    beeState.mode = 'FORAGING';
    setStageHighlight('FORAGE');
    stateBadge.textContent = '向日葵採蜜';
    telemetryInfo.textContent = '微距觀察：蜜蜂在花盤小花間移動，採蜜時翅膀收合。';
    camera.position.copy(bee.root.position).add(new THREE.Vector3(1.2, 0.7, 1.6));
    controls.target.copy(bee.root.position);
    controls.enabled = false;
    bokehPass.enabled = true;

    // ==========================================
    // 10. HUD UI 互動控制與三種鏡頭模式
    // ==========================================
    let currentFlowerFrame = null;
    let cameraMode = 'macro'; // 'free' | 'chase' | 'fpv' | 'diagnostic'
    let flightSpeed = 1.0;
    let scenePaused = false;
    let autoTimeEnabled = false;

    const timeSlider = document.getElementById('time-slider');
    const autoTimeCheck = document.getElementById('auto-time');
    const toggleBloomCheck = document.getElementById('toggle-bloom');
    const autoCycleCheck = document.getElementById('auto-cycle');

    const pollenText = document.getElementById('pollen-text');
    const pollenBar = document.getElementById('pollen-bar');
    const hiveText = document.getElementById('hive-text');
    const hiveBar = document.getElementById('hive-bar');
    const harvestCountEl = document.getElementById('harvest-count');

    const camFreeBtn = document.getElementById('cam-free');
    const camChaseBtn = document.getElementById('cam-chase');
    const camFpvBtn = document.getElementById('cam-fpv');
    const speedSlider = document.getElementById('speed-slider');
    const speedVal = document.getElementById('speed-val');
    const toggleCurve = document.getElementById('toggle-curve');
    const cameraHint = document.getElementById('camera-hint');
    const hoverTooltip = document.getElementById('hover-tooltip');

    function updateStatsUI() {
      const ratio = Math.min(beeState.pollenLoad / beeState.maxPollenLoad, 1.0);
      const pct = Math.round(ratio * 100);
      pollenText.textContent = `${pct}% (${beeState.pollenLoad.toFixed(1)}/${beeState.maxPollenLoad})`;
      pollenBar.style.width = `${pct}%`;

      const hiveRatio = hiveState.filledCount / hiveState.maxCount;
      hiveText.textContent = `${hiveState.filledCount} / ${hiveState.maxCount} 格`;
      hiveBar.style.width = `${Math.round(hiveRatio * 100)}%`;

      if (hiveState.harvestBatches > 0) {
        harvestCountEl.textContent = `(已豐收 ${hiveState.harvestBatches} 輪)`;
      }
    }

    timeSlider.addEventListener('input', (e) => {
      updateEnvironmentByTime(parseFloat(e.target.value));
    });
    autoTimeCheck.addEventListener('change', (e) => {
      autoTimeEnabled = e.target.checked;
    });
    toggleBloomCheck.addEventListener('change', (e) => {
      bloomEnabled = e.target.checked;
    });
    autoCycleCheck.addEventListener('change', (e) => {
      beeState.autoCycle = e.target.checked;
    });

    btnStageSortie.addEventListener('click', () => startMorningSortie(false));
    btnStageForage.addEventListener('click', () => startForageFlight());
    btnStageWaggle.addEventListener('click', () => startReturnForWaggleDance());

    function frameFlowerForCamera(flower) {
      flower.headGroup.updateWorldMatrix(true,true);
      const points=[],bounds=new THREE.Box3(),point=new THREE.Vector3();
      flower.headGroup.traverse(part=>{
        if(!part.isMesh||part.isInstancedMesh||!part.visible||part.material.opacity<0.01)return;
        const positions=part.geometry.attributes.position;
        for(let i=0;i<positions.count;i++) {
          point.fromBufferAttribute(positions,i).applyMatrix4(part.matrixWorld);
          bounds.expandByPoint(point);points.push(point.clone());
        }
      });
      const center=bounds.getCenter(new THREE.Vector3()),direction=new THREE.Vector3(1.7,1.8,2.3).normalize();
      const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize();
      const vertical=new THREE.Vector3().crossVectors(direction,right).normalize();
      const tanV=Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*0.80;
      const tanH=Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect*0.90;
      let distance=0;
      points.forEach(p=>{
        const offset=p.clone().sub(center),depth=offset.dot(direction);
        distance=Math.max(distance,Math.abs(offset.dot(right))/tanH+depth,Math.abs(offset.dot(vertical))/tanV+depth);
      });
      camera.up.set(0,1,0);controls.target.copy(center);
      camera.position.copy(center).addScaledVector(direction,distance*1.04);camera.lookAt(center);camera.updateMatrixWorld(true);
      const projected=new THREE.Box3();points.forEach(p=>projected.expandByPoint(p.project(camera)));
      currentFlowerFrame={flowerIndex:flower.index,min:projected.min.toArray(),max:projected.max.toArray()};
      bokehPass.uniforms.focus.value=camera.position.distanceTo(center);
      return center;
    }

    function setCameraMode(mode) {
      setSceneWireframe(false);
      cameraMode = mode;
      currentFlowerFrame = null;
      bokehPass.enabled = mode === 'macro';
      bokehPass.uniforms.aperture.value = 0.0017;
      bokehPass.uniforms.maxblur.value = 0.018;
      document.getElementById('cam-macro').classList.toggle('active', mode === 'macro');
      camFreeBtn.classList.toggle('active', mode === 'free');
      camChaseBtn.classList.toggle('active', mode === 'chase');
      camFpvBtn.classList.toggle('active', mode === 'fpv');
      controls.enabled = mode === 'free';

      if (mode === 'macro') {
        camera.up.set(0, 1, 0);
        cameraHint.textContent = '微距鏡頭隨蜜蜂移動。觀察收合的雙對翅、細毛與足部；切換自由環繞可自行拉近花瓣。';
      } else if (mode === 'free') {
        camera.up.set(0, 1, 0);
        controls.target.copy(bee.root.position);
        cameraHint.innerHTML =
          '💡 <b>自由環繞模式</b>：左鍵拖曳旋轉、右鍵平移、滾輪縮放；點擊花朵或蜂巢可直接指揮蜜蜂。';
      } else if (mode === 'chase') {
        camera.up.set(0, 1, 0);
        cameraHint.innerHTML =
          '🎥 <b>追尾跟隨模式</b>：自動跟隨蜜蜂飛行，並在採蜜與跳八字舞時平滑切換至最佳微距特寫視角。';
      } else if (mode === 'fpv') {
        cameraHint.innerHTML =
          '🐝 <b>蜜蜂第一人稱視角 (Bee POV)</b>：位於蜜蜂頭部複眼位置，同步感受飛行俯仰、降落花蕊與八字舞擺動！';
      }
    }

    document.getElementById('cam-macro').addEventListener('click', () => setCameraMode('macro'));
    camFreeBtn.addEventListener('click', () => setCameraMode('free'));
    camChaseBtn.addEventListener('click', () => setCameraMode('chase'));
    camFpvBtn.addEventListener('click', () => setCameraMode('fpv'));

    speedSlider.addEventListener('input', (e) => {
      flightSpeed = parseFloat(e.target.value);
      speedVal.textContent = `${flightSpeed.toFixed(1)}x`;
    });

    toggleCurve.addEventListener('change', (e) => {
      curveLine.visible = e.target.checked;
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };
    let hoveredTarget = null;

    window.addEventListener('pointermove', (e) => {
      if (e.target.closest('#hud-panel')) {
        hoverTooltip.style.opacity = '0';
        document.body.style.cursor = 'default';
        hoveredTarget = null;
        return;
      }

      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const intersects = raycaster.intersectObjects(interactableTargets, false);
      if (intersects.length > 0) {
        const data = intersects[0].object.userData;
        hoveredTarget = data;
        document.body.style.cursor = 'pointer';
        hoverTooltip.style.left = `${e.clientX}px`;
        hoverTooltip.style.top = `${e.clientY}px`;
        hoverTooltip.style.opacity = '1';

        if (data.type === 'flower') {
          const f = flowersList[data.flowerIndex];
          const nectarPct = Math.round(f.nectar * 100);
          hoverTooltip.textContent = `🌼 ${f.name} (花蜜 ${nectarPct}%) - 點擊立即降落採蜜`;
        } else if (data.type === 'hive') {
          hoverTooltip.textContent = `♾️ 蜂巢 (${hiveState.filledCount}/${hiveState.maxCount} 格) - 點擊立即返巢跳八字舞`;
        }
      } else {
        hoveredTarget = null;
        document.body.style.cursor = 'default';
        hoverTooltip.style.opacity = '0';
      }
    });

    window.addEventListener('pointerdown', (e) => {
      pointerDownPos.x = e.clientX;
      pointerDownPos.y = e.clientY;
    });

    window.addEventListener('pointerup', (e) => {
      if (e.target.closest('#hud-panel')) return;
      const moveDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (moveDist > 6 || !hoveredTarget) return;

      if (hoveredTarget.type === 'flower') {
        startForageFlight(hoveredTarget.flowerIndex);
      } else if (hoveredTarget.type === 'hive') {
        startReturnForWaggleDance();
      }
    });

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
      if(currentFlowerFrame)frameFlowerForCamera(flowersList[currentFlowerFrame.flowerIndex]);
    });

    // ==========================================
    // 11. 微距、花種與幾何檢視
    // ==========================================
    const diagnosticMaterials=[],diagnosticEdges=[];
    function setSceneWireframe(enabled) {
      // Retain all solid geometry and use depth-tested surface edges so rear
      // triangles, florets and distant vegetation cannot flood the inspection.
      diagnosticEdges.splice(0).forEach(edge=>{
        edge.removeFromParent();edge.geometry.dispose();edge.material.dispose();
      });
      diagnosticMaterials.splice(0).forEach(({object,original,temporary})=>{
        object.material=original;temporary.forEach(material=>material.dispose());
      });
      if(!enabled)return;
      const beeParts=new Set();bee.model.traverse(object=>beeParts.add(object));
      const objects=[];scene.traverse(object=>{
        if((object.isMesh||(object.isLineSegments&&beeParts.has(object)))&&object.material&&!object.userData.keepMaterial)objects.push(object);
      });
      for(const object of objects) {
        const onBee=beeParts.has(object),original=object.material;
        const materials=Array.isArray(original)?original:[original];
        const temporary=materials.map(material=>{
          const m=material.clone();
          // Preserve invisible interaction overlays and all transparency modes.
          if(material.opacity<0.01)return m;
          m.map=null;m.bumpMap=null;m.normalMap=null;m.wireframe=false;
          if(m.color)m.color.setHex(onBee?0x68777d:0x586353);
          if(object.isLineSegments)m.opacity*=0.35;
          if(m.emissive){m.emissive.setHex(onBee?0x0b1013:0x20251c);m.emissiveIntensity=0.65;}
          if('roughness' in m)m.roughness=0.95;
          if('envMapIntensity' in m)m.envMapIntensity=0.12;
          if('metalness' in m)m.metalness=0;
          m.polygonOffset=true;m.polygonOffsetFactor=1;m.polygonOffsetUnits=1;
          return m;
        });
        diagnosticMaterials.push({object,original,temporary});
        object.material=Array.isArray(original)?temporary:temporary[0];
        const flowerSurface=object.userData.type==='flower'||flowersList.some(f=>object===f.coreMesh||object.parent===f.stamenGroup);
        // Keep the complete opaque floret surfaces as contact context. Thousands of
        // superimposed tiny triangle edges obscure claw intersections; the bee retains its mesh overlay.
        if(flowerSurface&&object.isInstancedMesh)temporary.forEach(m=>{m.wireframe=false;m.color.setHex(0x8b927d);});
        if(object.isMesh&&(onBee||flowerSurface)&&!object.isInstancedMesh&&!object.userData.isSetae&&!object.userData.isWingVein&&materials.some(m=>m.opacity>=0.01)) {
          const edge=new THREE.LineSegments(object.userData.isWingVein?new THREE.EdgesGeometry(object.geometry,25):new THREE.WireframeGeometry(object.geometry),
            new THREE.LineBasicMaterial({color:onBee?0xb4dbe2:0x82927d,transparent:true,
              opacity:object.userData.isSetae?0.05:object.userData.isWingVein?0.12:onBee?(object.geometry.attributes.position.count>1000?0.11:0.44):0.10,depthWrite:false}));
          edge.raycast=()=>{};object.add(edge);diagnosticEdges.push(edge);
        }
      }
    }

    // 供自動化檢驗腳本或控制台呼叫：設定 4 種標準檢驗視角 ('top_down' | 'macro_closeup' | 'low_angle_anti_clip' | 'wireframe')
    window.setDiagnosticView = function (viewType, flowerIndex = 0) {
      cameraMode = 'diagnostic';
      currentFlowerFrame = null;
      controls.enabled = false;
      setSceneWireframe(false);
      bloomEnabled = false;
      bokehPass.enabled = viewType === 'macro_closeup' || viewType === 'flower_portrait';
      bokehPass.uniforms.aperture.value = viewType === 'flower_portrait' ? 0.00065 : 0.00012;
      bokehPass.uniforms.maxblur.value = viewType === 'flower_portrait' ? 0.007 : 0.002;

      // 將蜜蜂精準置於向日葵 (flower #0) 花蕊頂端進行採蜜姿態，且花粉籃飽滿，方便特寫與防穿模檢驗
      const f0 = flowersList[THREE.MathUtils.clamp(flowerIndex, 0, flowersList.length - 1)];
      document.getElementById('flower-select').value = String(f0.index);
      f0.pressAmount = 0.08;
      f0.bendGroup.rotation.set(0, 0, 0);
      f0.group.rotation.set(0, 0, 0);
      f0.group.updateMatrixWorld(true);

      const topSurfaceY = f0.surfaceLocal.y;
      const exactCoreTop = f0.surfaceLocal.clone();
      f0.headGroup.localToWorld(exactCoreTop);

      beeState.mode = 'FORAGING';
      beeState.targetFlowerIdx = f0.index;
      beeState.pollenLoad = 2.6;
      beeState.proboscisExt = 0.3;
      updateStatsUI();

      // 先給定降落參考點，再由花面法線與足部求解器調整實際姿態。
      bee.root.position.set(exactCoreTop.x - 0.12, exactCoreTop.y + 0.185, exactCoreTop.z + 0.05);
      bee.root.up.set(0, 1, 0);
      bee.root.lookAt(exactCoreTop.x + 0.5, exactCoreTop.y + 0.18, exactCoreTop.z - 0.2);
      bee.model.rotation.set(0.14, 0, 0);
      bee.proboscis.scale.z = 0.3;
      bee.wingBlur.forEach(sample=>{sample.group.visible=false;});
      bee.wingMaterial.opacity=0.23;
      bee.leftWing.rotation.set(0.02, 1.22, 0.15);
      bee.rightWing.rotation.set(0.02, -1.22, -0.15);
      bee.pollenBaskets.forEach((b) => b.scale.setScalar(1.05));
      bee.landingAnchor.copy(bee.root.position);
      poseBeeOnFlower(bee,f0);
      const inspectionUp=new THREE.Vector3(0,1,0).applyQuaternion(bee.root.quaternion);
      const inspectionRight=new THREE.Vector3(1,0,0).applyQuaternion(bee.root.quaternion);
      const inspectionForward=new THREE.Vector3(0,0,1).applyQuaternion(bee.root.quaternion);
      function inspectBee(right,up,forward,targetHeight=-0.045) {
        camera.up.copy(inspectionUp);
        camera.position.copy(bee.root.position).addScaledVector(inspectionRight,right)
          .addScaledVector(inspectionUp,up).addScaledVector(inspectionForward,forward);
        camera.lookAt(bee.root.position.clone().addScaledVector(inspectionUp,targetHeight).addScaledVector(inspectionForward,-0.04));
      }

      if (viewType === 'flower_portrait') {
        frameFlowerForCamera(f0);
      } else if (viewType === 'top_down') {
        // 1. 俯視圖：檢視場景整體佈局、向日葵與菊科費馬螺線花盤、3D 飛行路線
        camera.up.set(0, 0, -1);
        camera.position.copy(f0.coreWorldPos).add(new THREE.Vector3(0,7.4,0.06));
        camera.lookAt(f0.coreWorldPos);
      } else if (viewType === 'macro_closeup') {
        // 2. 微距特寫：近距離檢視西方蜜蜂複眼六角小眼面、胸部 3D 絨毛、解剖學腹部背板條紋、翅脈、花粉籃與向日葵費馬螺線小花
        inspectBee(0.76,0.52,0.34,-0.025);
      } else if (viewType === 'low_angle_anti_clip') {
        // 3. 低角度防穿模視角：自正前方略高處俯視花盤，前、中足伸出身體輪廓並以跗節、爪與接觸陰影踏在小花頂端，兩側後足花粉籃可見
        inspectBee(0.16,0.23,0.88,-0.075);
      } else if (viewType === 'wireframe') {
        // 4. 線框拓樸圖：自左前上方檢視（與右側的特寫互補），左側三足由胸部至跗節完整可見，並檢視花瓣網格與費馬螺線小花
        setSceneWireframe(true);
        bloomEnabled = false;
        inspectBee(-0.73,0.27,0.56,-0.065);
      }

      if (viewType !== 'flower_portrait') bokehPass.uniforms.focus.value = camera.position.distanceTo(bee.root.position);
      bloomPass.enabled = bloomEnabled;
      composer.render();
    };

    // ==========================================
    // 12. 主動畫迴圈
    // ==========================================
    const clock = new THREE.Clock();
    const currentPos = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    const nextTangent = new THREE.Vector3();
    const lookTarget = new THREE.Vector3();
    const camTargetPos = new THREE.Vector3();
    const camLookAtPos = bee.root.position.clone();

    function animate() {
      requestAnimationFrame(animate);

      if (cameraMode === 'diagnostic') {
        bloomPass.enabled = bloomEnabled;
        composer.render();
        return;
      }

      const rawDelta = Math.min(clock.getDelta(), 0.1);
      if (scenePaused) { if (cameraMode === 'free') controls.update(); composer.render(); return; }
      const dt = rawDelta * flightSpeed;
      const elapsed = clock.getElapsedTime();

      if (autoTimeEnabled) {
        let nextTime = currentTimeOfDay + rawDelta * 0.28;
        if (nextTime > 18.0) nextTime = 6.0;
        timeSlider.value = nextTime.toFixed(2);
        updateEnvironmentByTime(nextTime);
      }

      // A. 更新花朵物理彈性、花蜜自然再生與懸停光環
      flowersList.forEach((f, idx) => {
        const isBeingForaged =
          beeState.mode === 'FORAGING' && beeState.targetFlowerIdx === idx;

        if (!isBeingForaged) {
          if (f.regenCooldown > 0) {
            f.regenCooldown = Math.max(0, f.regenCooldown - rawDelta);
          } else if (f.nectar < 1.0) {
            f.nectar = Math.min(1.0, f.nectar + rawDelta * 0.08);
          }
          f.pressAmount = THREE.MathUtils.lerp(f.pressAmount, 0, 0.08);
        } else {
          const targetPress = 0.006 + Math.sin(elapsed * 5) * 0.002;
          f.pressAmount = THREE.MathUtils.lerp(f.pressAmount, targetPress, 0.14);
        }

        // Nectar is internal; floral pigmentation does not change as a bee drinks.
        f.coreMat.emissiveIntensity = 0;
        f.stamenTipMat.emissiveIntensity = 0;

        f.group.rotation.z = Math.sin(elapsed * 1.4 + f.phase) * 0.025;
        f.group.rotation.x = Math.cos(elapsed * 1.1 + f.phase) * 0.02;
        f.bendGroup.rotation.x = f.pressAmount;
        f.bendGroup.rotation.z = f.pressAmount * 0.3;
        f.headGroup.updateWorldMatrix(true, false);
        f.coreWorldPos.copy(f.surfaceLocal).applyMatrix4(f.headGroup.matrixWorld);
        f.nectarPos.copy(f.coreWorldPos).add(new THREE.Vector3(0, 0.185, 0));

        const isHovered =
          hoveredTarget && hoveredTarget.type === 'flower' && hoveredTarget.flowerIndex === idx;
        f.hoverRing.material.opacity = THREE.MathUtils.lerp(
          f.hoverRing.material.opacity,
          isHovered ? 0.85 : 0.0,
          0.15
        );
      });

      const isHiveHovered = hoveredTarget && hoveredTarget.type === 'hive';
      hiveState.hoverRing.material.opacity = THREE.MathUtils.lerp(
        hiveState.hoverRing.material.opacity,
        isHiveHovered ? 0.85 : 0.0,
        0.15
      );
      hiveState.storageCells.forEach((cell) => {
        const targetZ = cell.filled ? 0.04 : -0.06;
        cell.centerMesh.position.z = THREE.MathUtils.lerp(cell.centerMesh.position.z, targetZ, 0.1);
      });

      // B. 行為狀態機
      let isHighFreq = false;
      let waggleAbdomenYaw = 0;
      let streamActive = false;
      let streamStart = new THREE.Vector3();
      let streamEnd = new THREE.Vector3();

      if (
        beeState.mode === 'MORNING_SORTIE' ||
        beeState.mode === 'FLYING_TO_FLOWER' ||
        beeState.mode === 'FLYING_TO_HIVE'
      ) {
        const baseSpeed = beeState.mode === 'MORNING_SORTIE' ? 5.2 : 4.8;
        const easeFactor =
          beeState.mode !== 'MORNING_SORTIE' && beeState.curveProgress > 0.78
            ? THREE.MathUtils.mapLinear(beeState.curveProgress, 0.78, 1.0, 1.0, 0.35)
            : 1.0;

        beeState.curveProgress += (dt * baseSpeed * easeFactor) / beeState.curveLength;

        if (
          beeState.mode === 'MORNING_SORTIE' &&
          beeState.autoCycle &&
          beeState.curveProgress >= 0.48
        ) {
          startForageFlight();
        } else if (beeState.curveProgress >= 1.0) {
          if (beeState.mode === 'MORNING_SORTIE') {
            if (beeState.autoCycle) startForageFlight();
            else startMorningSortie(false);
          } else if (beeState.mode === 'FLYING_TO_FLOWER') {
            beeState.mode = 'FORAGING';
            bee.landingAnchor.copy(bee.root.position);
            beeState.actionTimer = 0;
            const flower = flowersList[beeState.targetFlowerIdx];
            triggerPollenBurst(flower.coreWorldPos, 5, 0xd0ac57);
            stateBadge.textContent = `採集中：${flower.name}`;
            telemetryInfo.innerHTML =
              `🌼 <b>[採集花蜜]</b>：精準降落於「${flower.name}」花盤！收合翅膀，伸出口器探入小花，花粉隨足部梳理聚集於後足花粉籃。`;
          } else if (beeState.mode === 'FLYING_TO_HIVE') {
            beeState.mode = 'WAGGLE_DANCE';
            beeState.actionTimer = 0;
            beeState.waggleAngle = 0;
            stateBadge.textContent = '跳八字舞中';

            const targetFlower = flowersList[beeState.bestFlowerIdx];
            const dx = targetFlower.coreWorldPos.x - hiveState.danceCenterWorld.x;
            const dz = targetFlower.coreWorldPos.z - hiveState.danceCenterWorld.z;
            const azimuthDeg = Math.round(((Math.atan2(dx, dz) * 180) / Math.PI + 360) % 360);
            const distMeters = targetFlower.coreWorldPos.distanceTo(hiveState.danceCenterWorld).toFixed(1);
            telemetryInfo.innerHTML =
              `♾️ <b>[八字舞 Waggle Dance]</b>：於蜂脾表面進行 8 字形高頻擺尾，向同伴工蜂傳遞「${targetFlower.name}」座標（方位角 ${azimuthDeg}° / 距離 ${distMeters}m）！`;
          }
        }

        const clampedP = Math.min(beeState.curveProgress, 1.0);
        beeState.flightCurve.getPointAt(clampedP, currentPos);
        beeState.flightCurve.getTangentAt(clampedP, tangent).normalize();
        beeState.forwardDir.copy(tangent);

        const nextP = Math.min(clampedP + 0.02, 1.0);
        beeState.flightCurve.getTangentAt(nextP, nextTangent).normalize();
        const turnCrossY = tangent.x * nextTangent.z - tangent.z * nextTangent.x;

        const hoverBob = Math.sin(elapsed * 8.5) * 0.05;
        bee.root.position.copy(currentPos);
        bee.root.position.y += hoverBob;
        bee.root.up.set(0, 1, 0);

        lookTarget.copy(bee.root.position).add(tangent);
        bee.root.lookAt(lookTarget);

        const bankAngle = THREE.MathUtils.clamp(turnCrossY * 9, -0.55, 0.55);
        bee.model.rotation.z = THREE.MathUtils.lerp(
          bee.model.rotation.z,
          bankAngle + Math.sin(elapsed * 6) * 0.05,
          0.14
        );
        bee.model.rotation.x = THREE.MathUtils.lerp(
          bee.model.rotation.x,
          Math.sin(elapsed * 7) * 0.05,
          0.14
        );
        beeState.proboscisExt = THREE.MathUtils.lerp(beeState.proboscisExt, 0.01, 0.16);
      } else if (beeState.mode === 'FORAGING') {
        isHighFreq = true;
        const flower = flowersList[beeState.targetFlowerIdx];
        beeState.actionTimer += dt;

        // 追蹤搖動花頭；本幀結束前再依表面坡度求解各足位置。
        flower.headGroup.updateMatrixWorld(true);
        const liveLandingPos = flower.nectarPos.clone();
        const liveCorePos = flower.coreWorldPos.clone();
        // Landing positions are refreshed from the moving flower transform.

        const walkOffset = new THREE.Vector3(
          Math.cos(elapsed * 0.7) * 0.09,
          0,
          Math.sin(elapsed * 0.7) * 0.09
        );
        bee.landingAnchor.lerp(liveLandingPos.add(walkOffset), 1-Math.exp(-rawDelta*12));
        bee.root.position.copy(bee.landingAnchor);
        bee.root.up.set(0, 1, 0);

        lookTarget.copy(liveCorePos).add(
          new THREE.Vector3(Math.sin(elapsed * 1.8) * 0.35, 0.15, Math.cos(elapsed * 1.8) * 0.35)
        );
        bee.root.lookAt(lookTarget);
        bee.model.rotation.z = THREE.MathUtils.lerp(bee.model.rotation.z, 0, 0.18);
        bee.model.rotation.x = THREE.MathUtils.lerp(bee.model.rotation.x, 0.16, 0.18);

        beeState.proboscisExt = THREE.MathUtils.lerp(beeState.proboscisExt, 0.3, 0.18);

        if (Math.random() < 0.035) {
          triggerPollenBurst(liveCorePos, 1, 0xc4a75c);
        }

        const harvestRate = 0.115 * dt;
        const actualTaken = Math.min(flower.nectar, harvestRate);
        if (actualTaken > 0) {
          flower.nectar -= actualTaken;
          beeState.pollenLoad = Math.min(
            beeState.maxPollenLoad,
            beeState.pollenLoad + actualTaken
          );
          updateStatsUI();

          streamActive = false;
          streamStart.copy(liveCorePos);
          streamEnd.copy(bee.root.position);
        }

        if (flower.nectar <= 0.02) {
          flower.nectar = 0;
          flower.regenCooldown = 4.0;
        }

        if (
          beeState.actionTimer >= 8.5 ||
          flower.nectar <= 0.01 ||
          beeState.pollenLoad >= beeState.maxPollenLoad - 0.02
        ) {
          if (beeState.pollenLoad >= beeState.maxPollenLoad - 0.05) {
            beeState.pollenLoad = beeState.maxPollenLoad;
            updateStatsUI();
            if (beeState.autoCycle) startReturnForWaggleDance();
            else startForageFlight();
          } else {
            startForageFlight();
          }
        }
      } else if (beeState.mode === 'WAGGLE_DANCE') {
        isHighFreq = true;
        beeState.actionTimer += dt;
        beeState.waggleAngle += dt * 3.1;

        const t = beeState.waggleAngle;
        const nextT = t + 0.06;
        const scale = 0.3375;

        const lx = Math.sin(t) * scale;
        const ly = Math.sin(t) * Math.cos(t) * scale * 1.15;
        const nlx = Math.sin(nextT) * scale;
        const nly = Math.sin(nextT) * Math.cos(nextT) * scale * 1.15;

        const dancePos = hiveState.danceCenterWorld
          .clone()
          .addScaledVector(hiveState.danceRightWorld, lx)
          .addScaledVector(hiveState.danceUpWorld, ly);

        const nextDancePos = hiveState.danceCenterWorld
          .clone()
          .addScaledVector(hiveState.danceRightWorld, nlx)
          .addScaledVector(hiveState.danceUpWorld, nly);

        bee.root.position.lerp(dancePos, 0.35);
        bee.root.up.copy(hiveState.danceNormalWorld);
        bee.root.lookAt(nextDancePos);

        const moveDir = nextDancePos.clone().sub(dancePos).normalize();
        beeState.forwardDir.copy(moveDir);

        const isWaggleRun = Math.abs(Math.sin(t)) < 0.68;
        if (isWaggleRun) {
          waggleAbdomenYaw = Math.sin(elapsed * 55) * 0.42;
          bee.model.rotation.z = Math.sin(elapsed * 55) * 0.2;
        } else {
          waggleAbdomenYaw = Math.sin(elapsed * 20) * 0.1;
          bee.model.rotation.z = THREE.MathUtils.lerp(bee.model.rotation.z, 0, 0.2);
        }
        bee.model.rotation.x = THREE.MathUtils.lerp(bee.model.rotation.x, 0, 0.2);
        beeState.proboscisExt = THREE.MathUtils.lerp(beeState.proboscisExt, 0.01, 0.2);

        if (beeState.pollenLoad > 0) {
          streamActive = true;
          streamStart.copy(bee.root.position);
          const targetCell =
            hiveState.storageCells[Math.min(hiveState.filledCount, hiveState.maxCount - 1)];
          targetCell.centerMesh.getWorldPosition(streamEnd);

          const prevInt = Math.ceil(beeState.pollenLoad);
          beeState.pollenLoad = Math.max(0, beeState.pollenLoad - dt * 0.65);
          const newInt = Math.ceil(beeState.pollenLoad);

          if (newInt < prevInt) {
            depositOneHoneyCell();
          }
          updateStatsUI();
        }

        if (hiveState.filledCount >= hiveState.maxCount && beeState.actionTimer > 4.2) {
          hiveState.harvestBatches++;
          triggerPollenBurst(hiveState.danceCenterWorld, 65, 0xffee58);
          hiveState.filledCount = 0;
          hiveState.storageCells.forEach((cell) => {
            cell.filled = false;
            cell.centerMesh.material = cell.emptyMat;
          });
          updateStatsUI();
        }

        if (beeState.actionTimer >= 5.2 && beeState.autoCycle) {
          beeState.pollenLoad = 0;
          updateStatsUI();
          startMorningSortie(true);
        }
      }

      // C. 更新蜂巢八字舞軌跡與圍觀工蜂
      const isDancing = beeState.mode === 'WAGGLE_DANCE';
      hiveState.waggleTrailLine.material.opacity = THREE.MathUtils.lerp(
        hiveState.waggleTrailLine.material.opacity,
        isDancing && curveLine.visible ? 0.9 : 0.0,
        0.12
      );

      hiveState.waggleSignalRings.forEach((sr) => {
        if (isDancing) {
          const p = (elapsed * 0.85 + sr.phase) % 1.0;
          const s = 0.6 + p * 6.5;
          sr.mesh.scale.setScalar(s);
          sr.mesh.material.opacity = curveLine.visible ? (1.0 - p) * 0.3 : 0;
        } else {
          sr.mesh.material.opacity = THREE.MathUtils.lerp(sr.mesh.material.opacity, 0, 0.15);
        }
      });

      hiveState.companionBees.forEach((comp) => {
        const compFlap = Math.sin(elapsed * (isDancing ? 75 : 22) + comp.phase) * 0.55 + 0.2;
        comp.leftWing.rotation.set(0, 1.48, 0.05);
        comp.rightWing.rotation.set(0, -1.48, -0.05);
        if (isDancing) {
          comp.root.position.x = comp.basePos.x + Math.sin(elapsed * 18 + comp.phase) * 0.04;
          comp.root.position.y = comp.basePos.y + Math.cos(elapsed * 18 + comp.phase) * 0.04;
        }
      });

      // D. 更新主角蜜蜂解剖關節動畫
      bee.proboscis.scale.z = Math.max(0.01, beeState.proboscisExt);

      const targetBasketScale =
        0.001 + (beeState.pollenLoad / beeState.maxPollenLoad) * 1.15;
      bee.pollenBaskets.forEach((basket) => {
        const s = THREE.MathUtils.lerp(basket.scale.x, targetBasketScale, 0.12);
        basket.scale.setScalar(s);
      });

      const flying = ['MORNING_SORTIE', 'FLYING_TO_FLOWER', 'FLYING_TO_HIVE'].includes(beeState.mode);
      const strokePhase = elapsed * Math.PI * 2 * 200;
      const flapAngle = Math.sin(strokePhase) * 0.88 + 0.1;
      bee.wingMaterial.opacity = flying ? 0.15 : 0.23;
      bee.wingBlur.forEach(sample=>{
        sample.group.visible=flying;
        sample.group.rotation.set(Math.cos(strokePhase+sample.phase)*0.12,sample.side*0.15,sample.side*(Math.sin(strokePhase+sample.phase)*0.88+0.1));
      });
      bee.leftWing.rotation.y = THREE.MathUtils.lerp(bee.leftWing.rotation.y, flying ? 0.15 : 1.22, 0.12);
      bee.rightWing.rotation.y = -bee.leftWing.rotation.y;
      bee.leftWing.rotation.z = flying ? flapAngle : 0.15;
      bee.rightWing.rotation.z = flying ? -flapAngle : -0.15;
      bee.leftWing.rotation.x = flying ? Math.cos(strokePhase) * 0.12 : 0.02;
      bee.rightWing.rotation.x = bee.leftWing.rotation.x;



          const breathFreq = isHighFreq ? 16 : 6;
      const breathAmp = isHighFreq ? 0.012 : 0.006;
      bee.abdomen.scale.set(1, 1, 1.0 + Math.sin(elapsed * breathFreq) * breathAmp);
      bee.abdomen.rotation.y = THREE.MathUtils.lerp(bee.abdomen.rotation.y, waggleAbdomenYaw, 0.45);

      bee.antennae.forEach((ant) => {
        ant.group.rotation.x =
          ant.baseRotX + Math.sin(elapsed * (isHighFreq ? 18 : 8) + ant.side) * 0.1;
        ant.flagellum.rotation.x = 0.95 + Math.cos(elapsed * 12 + ant.side) * 0.08;
      });

      bee.legs.forEach((leg) => {
        if (flying) {
          const alpha = 1-Math.exp(-rawDelta*12);
          const approach = beeState.mode === 'FLYING_TO_FLOWER' ? THREE.MathUtils.smoothstep(beeState.curveProgress,0.80,0.99) : 0;
          leg.coxa.rotation.y=THREE.MathUtils.lerp(leg.coxa.rotation.y,THREE.MathUtils.lerp(leg.side*0.65,leg.baseYaw,approach),alpha);
          leg.coxa.rotation.z=THREE.MathUtils.lerp(leg.coxa.rotation.z,THREE.MathUtils.lerp(leg.side*1.05,leg.baseCoxaZ,approach),alpha);
          leg.tibia.rotation.z=THREE.MathUtils.lerp(leg.tibia.rotation.z,THREE.MathUtils.lerp(-leg.side*1.8,leg.baseTibiaZ,approach),alpha);
          return;
        }
        leg.coxa.rotation.y=leg.baseYaw;
        const walkSpeed = isDancing ? 24 : 10;
        const swing = Math.sin(elapsed * walkSpeed + leg.index * 1.5) * (isDancing ? 0.14 : 0.07);
        leg.coxa.rotation.z = leg.baseCoxaZ + swing * leg.side;
        leg.tibia.rotation.z = leg.baseTibiaZ - swing * 0.8 * leg.side;
      });
      if (beeState.mode === 'FORAGING') poseBeeOnFlower(bee,flowersList[beeState.targetFlowerIdx],elapsed,true);
      else footShadows.forEach(shadow => { shadow.visible = false; });

      // E. 粒子更新
      const posAttr = ambientPollen.geo.attributes.position;
      const phaseAttr = ambientPollen.geo.attributes.aPhase;
      for (let i = 0; i < posAttr.count; i++) {
        const phase = phaseAttr.getX(i);
        let y = posAttr.getY(i) + Math.sin(elapsed * 1.2 + phase) * 0.004 + 0.003;
        if (y > 9.0) y = 0.4;
        posAttr.setY(i, y);
        posAttr.setX(i, posAttr.getX(i) + Math.cos(elapsed * 0.8 + phase) * 0.003);
      }
      posAttr.needsUpdate = true;

      if (streamActive) {
        streamSystem.mat.opacity = 0;
        const sPos = streamSystem.geo.attributes.position;
        for (let i = 0; i < streamSystem.count; i++) {
          const t = (streamSystem.offsets[i] + elapsed * 1.8) % 1.0;
          const x = THREE.MathUtils.lerp(streamStart.x, streamEnd.x, t) + Math.sin(t * 10 + i) * 0.12;
          const y = THREE.MathUtils.lerp(streamStart.y, streamEnd.y, t) + Math.sin(t * Math.PI) * 0.22;
          const z = THREE.MathUtils.lerp(streamStart.z, streamEnd.z, t) + Math.cos(t * 10 + i) * 0.12;
          sPos.setXYZ(i, x, y, z);
        }
        sPos.needsUpdate = true;
      } else {
        streamSystem.mat.opacity = THREE.MathUtils.lerp(streamSystem.mat.opacity, 0, 0.2);
      }

      const bPos = burstSystem.geo.attributes.position;
      for (let i = 0; i < burstPool.length; i++) {
        const p = burstPool[i];
        if (p.life > 0) {
          p.life -= rawDelta;
          p.pos.addScaledVector(p.vel, rawDelta);
          p.vel.y -= 2.4 * rawDelta;
          bPos.setXYZ(i, p.pos.x, p.pos.y, p.pos.z);
        } else {
          bPos.setXYZ(i, 0, -999, 0);
        }
      }
      bPos.needsUpdate = true;

      // F. 鏡頭更新
      if (cameraMode === 'macro') {
        camera.up.set(0, 1, 0);
        const offset = new THREE.Vector3(0.80, 0.46, 0.90).applyQuaternion(bee.root.quaternion);
        camTargetPos.copy(bee.root.position).add(offset);
        camera.position.lerp(camTargetPos, 1 - Math.exp(-rawDelta * 4));
        camLookAtPos.copy(bee.root.position);
        camera.lookAt(camLookAtPos);
        bokehPass.uniforms.focus.value = camera.position.distanceTo(camLookAtPos);
      } else if (cameraMode === 'chase') {
        camera.up.set(0, 1, 0);
        if (beeState.mode === 'WAGGLE_DANCE') {
          camTargetPos
            .copy(hiveState.danceCenterWorld)
            .addScaledVector(hiveState.danceNormalWorld, 4.2)
            .add(new THREE.Vector3(0, 0.5, 0));
          camera.position.lerp(camTargetPos, 0.08);
          camLookAtPos.lerp(hiveState.danceCenterWorld, 0.12);
          camera.lookAt(camLookAtPos);
        } else if (beeState.mode === 'FORAGING') {
          const macroOffset = new THREE.Vector3(0.8, 0.42, 0.88);
          macroOffset.applyQuaternion(bee.root.quaternion);
          camTargetPos.copy(bee.root.position).add(macroOffset);
          camera.position.lerp(camTargetPos, 0.08);
          camLookAtPos.lerp(bee.root.position, 0.14);
          camera.lookAt(camLookAtPos);
        } else {
          const chaseOffset = new THREE.Vector3(0, 0.85, -2.35);
          chaseOffset.applyQuaternion(bee.root.quaternion);
          camTargetPos.copy(bee.root.position).add(chaseOffset);
          camera.position.lerp(camTargetPos, 0.12);

          const aheadPt = bee.root.position.clone().addScaledVector(beeState.forwardDir, 2.2);
          camLookAtPos.lerp(aheadPt, 0.18);
          camera.lookAt(camLookAtPos);
        }
      } else if (cameraMode === 'fpv') {
        const fpvOffset = new THREE.Vector3(0, 0.05, 0.22);
        fpvOffset.applyQuaternion(bee.root.quaternion);
        camTargetPos.copy(bee.root.position).add(fpvOffset);
        camera.position.lerp(camTargetPos, 0.35);

        const localForward = new THREE.Vector3(0, -0.08, 3.2);
        localForward.applyQuaternion(bee.root.quaternion);
        const targetLook = bee.root.position.clone().add(localForward);
        camLookAtPos.lerp(targetLook, 0.32);

        const beeUp = new THREE.Vector3(0, 1, 0).applyQuaternion(bee.root.quaternion);
        camera.up.lerp(beeUp, 0.25);
        camera.lookAt(camLookAtPos);
      } else {
        controls.update();
        if (bokehPass.enabled) bokehPass.uniforms.focus.value = camera.position.distanceTo(controls.target);
      }

      updateContactLighting(bee.root.position);
      bloomPass.enabled = bloomEnabled;
      composer.render();
    }

    animate();

    // 支援 URL Query Parameter (?view=top_down | macro_closeup | low_angle_anti_clip | wireframe) 自動切換診斷視角供無頭瀏覽器截圖
    const urlParams = new URLSearchParams(window.location.search);
    window.getSceneDiagnostics = () => ({
      mode: beeState.mode, camera: cameraMode, paused: scenePaused, targetFlower: beeState.targetFlowerIdx,
      pollenLoad: beeState.pollenLoad, hiveFilled: hiveState.filledCount,
      beeScale: bee.root.scale.x, legs: bee.legs.length, antennae: bee.antennae.length,
      flowers: flowersList.map(f=>({name:f.name,species:f.species,nectar:f.nectar,emissive:f.coreMat.emissiveIntensity,
        position:f.coreWorldPos.toArray()})),
      position:bee.root.position.toArray(), wingAngles:[bee.leftWing.rotation.y,bee.rightWing.rotation.y],
      wingBlurVisible:bee.wingBlur.filter(sample=>sample.group.visible).length,
      footContacts:beeState.mode === 'FORAGING' ? flowerFootContacts(bee,flowersList[beeState.targetFlowerIdx]) : [],
      materialsReady:document.documentElement.dataset.materialsReady,
      framedFlower:currentFlowerFrame,
      beeScreenPosition:(camera.updateMatrixWorld(true),bee.root.position.clone().project(camera).toArray()),
      cameraAspect:camera.aspect
    });
    document.getElementById('panel-toggle').addEventListener('click', (event) => {
      const panel = document.getElementById('hud-panel'); panel.hidden = !panel.hidden;
      event.currentTarget.setAttribute('aria-expanded', String(!panel.hidden));
    });
    document.getElementById('pause-scene').addEventListener('click', (event) => {
      scenePaused = !scenePaused;
      event.currentTarget.textContent = scenePaused ? '繼續' : '暫停';
      event.currentTarget.setAttribute('aria-pressed', String(scenePaused));
    });
    const selectedFlowerIndex = () => Number(document.getElementById('flower-select').value);
    document.getElementById('observe-bee').addEventListener('click', () => {
      scenePaused = false; document.getElementById('pause-scene').textContent = '暫停';
      document.getElementById('pause-scene').setAttribute('aria-pressed', 'false');
      setCameraMode('macro'); startForageFlight(selectedFlowerIndex());
    });
    document.getElementById('observe-flower').addEventListener('click', () => {
      setCameraMode('free'); bokehPass.enabled = true;
      bokehPass.uniforms.aperture.value = 0.00065; bokehPass.uniforms.maxblur.value = 0.012;
      const f = flowersList[selectedFlowerIndex()];
      frameFlowerForCamera(f); controls.update();
    });
    const initialDiagView = urlParams.get('view');
    if (initialDiagView) {
      window.setDiagnosticView(initialDiagView, Number(urlParams.get('flower') || 0));
    }
  