(function () {
  'use strict';

  if (typeof THREE === 'undefined') return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ──부드러운 대기권 빛무리를 위한 텍스처 ────────────────────────
  function createGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.4)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(canvas);
  }
  const glowTexture = createGlowTexture();

  // ── Vertex Shader ─────────────────────────────────────────
  const vertexShader = `
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = position; 
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  // ── Fragment Shader (3D 노이즈 및 외곽 투명도 적용) ────────────────
  const fragmentShader = `
    uniform float time;
    uniform vec3 colorA;
    uniform vec3 colorB;
    uniform vec3 colorC;
    varying vec3 vNormal;
    varying vec3 vPosition;

    float hash(float n) { return fract(sin(n) * 1e4); }
    float noise(vec3 x) {
      const vec3 step = vec3(110.0, 241.0, 171.0);
      vec3 i = floor(x);
      vec3 f = fract(x);
      float n = dot(i, step);
      vec3 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix( hash(n + dot(step, vec3(0, 0, 0))), hash(n + dot(step, vec3(1, 0, 0))), u.x),
                     mix( hash(n + dot(step, vec3(0, 1, 0))), hash(n + dot(step, vec3(1, 1, 0))), u.x), u.y),
                 mix(mix( hash(n + dot(step, vec3(0, 0, 1))), hash(n + dot(step, vec3(1, 0, 1))), u.x),
                     mix( hash(n + dot(step, vec3(0, 1, 1))), hash(n + dot(step, vec3(1, 1, 1))), u.x), u.y), u.z);
    }
    float fbm(vec3 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 5; ++i) {
        v += a * noise(p);
        p = p * 2.0;
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec3 p = normalize(vPosition);
      
      vec3 q = vec3(0.0);
      q.x = fbm(p * 3.5 + vec3(time * 0.015, 0.0, 0.0));
      q.y = fbm(p * 3.5 + vec3(0.0, time * 0.015, 0.0));
      q.z = fbm(p * 3.5 + vec3(0.0, 0.0, time * 0.015));

      vec3 r = vec3(0.0);
      r.x = fbm(p * 7.0 + q + vec3(time * 0.02, 0.0, 0.0));
      r.y = fbm(p * 7.0 + q + vec3(0.0, time * 0.02, 0.0));
      r.z = fbm(p * 7.0 + q + vec3(0.0, 0.0, time * 0.02));

      float n = fbm(p * 4.0 + r);

      vec3 col = mix(colorA, colorB, n);
      col = mix(col, colorC, q.y * 0.7);

      vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
      float shadow = smoothstep(-0.3, 0.5, dot(vNormal, lightDir));
      col = col * (shadow * 0.8 + 0.2);

      float viewAngle = max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0);
      float alpha = smoothstep(0.0, 0.45, viewAngle);

      float rim = smoothstep(0.3, 1.0, 1.0 - viewAngle);
      vec3 rimColor = mix(colorB, colorC, 0.6) * rim * 1.5;

      gl_FragColor = vec4(col + rimColor, alpha * 0.95);
    }
  `;

  // ── 행성 렌더링 함수 ────────────────────────────────────────────────
  function createSolidPlanet(canvas, opts) {
    const {
      colorA       = '#1e1b4b',
      colorB       = '#3b82f6',
      colorC       = '#c084fc',
      rotSpeedY    = 0.0015,
      rotSpeedX    = 0.0004,
      canvasSize   = 600
    } = opts;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: false });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvasSize, canvasSize, false);

    const scene  = new THREE.Scene();
    
    const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
    camera.position.z = 4.5;

    const group = new THREE.Group();
    scene.add(group);

    // ── 행성 본체 ──
    const planetGeo = new THREE.SphereGeometry(1.0, 64, 64);
    const planetMat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        time: { value: 0.0 },
        colorA: { value: new THREE.Color(colorA) },
        colorB: { value: new THREE.Color(colorB) },
        colorC: { value: new THREE.Color(colorC) }
      },
      transparent: true,
      depthWrite: false
    });
    const planet = new THREE.Mesh(planetGeo, planetMat);
    group.add(planet);

    // ── 대기권 발광 효과 (Sprite Glow) ──
    const glowSprite1 = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture,
      color: new THREE.Color(colorB),
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: 0.3
    }));
    glowSprite1.scale.set(2.4, 2.4, 1.0);
    group.add(glowSprite1);

    const glowSprite2 = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture,
      color: new THREE.Color(colorC),
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: 0.15
    }));
    glowSprite2.scale.set(3.2, 3.2, 1.0);
    group.add(glowSprite2);

    const clock = new THREE.Clock();
    function animate() {
      requestAnimationFrame(animate);
      const delta = clock.getDelta();
      
      if (!prefersReduced) {
        group.rotation.y += rotSpeedY;
        group.rotation.x += rotSpeedX;
        planetMat.uniforms.time.value += delta;
      }
      renderer.render(scene, camera);
    }
    animate();
  }

  // ── 큰 행성 (우측 상단) ──────────────
  const largePlanet = document.getElementById('planet-large-canvas');
  if (largePlanet) {
    createSolidPlanet(largePlanet, {
      colorA:        '#0f172a', // 아주 깊은 다크 블루/슬레이트
      colorB:        '#38bdf8', // 네온 스카이 블루
      colorC:        '#8b5cf6', // 신비로운 퍼플
      rotSpeedY:     0.001,
      rotSpeedX:     0.0003,
      canvasSize:    800
    });
  }

  // ── 작은 행성 (좌측 하단) ─────────────
  const smallPlanet = document.getElementById('planet-small-canvas');
  if (smallPlanet) {
    createSolidPlanet(smallPlanet, {
      colorA:        '#1e1b4b', // 딥 인디고
      colorB:        '#818cf8', // 부드러운 블루
      colorC:        '#d946ef', // 네온 핑크퍼플
      rotSpeedY:     0.002,
      rotSpeedX:     0.0006,
      canvasSize:    400
    });
  }
})();