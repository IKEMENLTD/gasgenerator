'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export default function ThreeBackground() {
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!containerRef.current) return

        // --- SETUP ---
        const scene = new THREE.Scene()

        // ライトテーマ用フォグ
        scene.fog = new THREE.FogExp2(0xf8faf9, 0.002)

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
        camera.position.z = 50

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
        renderer.setSize(window.innerWidth, window.innerHeight)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        containerRef.current.appendChild(renderer.domElement)

        // --- PARTICLES ---
        const count = 3000
        const geometry = new THREE.BufferGeometry()
        const positions = new Float32Array(count * 3)
        const randoms = new Float32Array(count)

        for (let i = 0; i < count; i++) {
            // Base sphere distribution
            const r = 40 * Math.cbrt(Math.random())
            const theta = Math.random() * Math.PI * 2
            const phi = Math.acos(2 * Math.random() - 1)

            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
            positions[i * 3 + 2] = r * Math.cos(phi)

            randoms[i] = Math.random()
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1))

        // Formations (phases) logic mirroring the original script
        // Note: In React, we need to pass these as uniforms or attributes if we want GPU transition
        // The original script used a massive vertex shader with hardcoded formations.
        // We will replicate that ShaderMaterial here.

        const vertexShader = `
        uniform float time;
        uniform float scrollProg;
        attribute float aRandom;
        varying vec3 vColor;
        varying float vAlpha;

        // ... (Include all the helper functions from original script: hash, snoise, formations) ...
        // To keep this file concise, I'll simplify or condense the shader logic if possible, 
        // but for exact reproduction, I'll paste the core logic.

        // Simplex noise function
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
        float snoise(vec3 v) {
            const vec2 C = vec2(1.0/6.0, 1.0/3.0);
            const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
            vec3 i  = floor(v + dot(v, C.yyy) );
            vec3 x0 = v - i + dot(i, C.xxx) ;
            vec3 g = step(x0.yzx, x0.xyz);
            vec3 l = 1.0 - g;
            vec3 i1 = min( g.xyz, l.zxy );
            vec3 i2 = max( g.xyz, l.zxy );
            vec3 x1 = x0 - i1 + C.xxx;
            vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
            vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y
            i = mod289(i);
            vec4 p = permute( permute( permute(
                        i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                    + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                    + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
            float n_ = 0.142857142857;
            vec3  ns = n_ * D.wyz - D.xzx;
            vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
            vec4 x_ = floor(j * ns.z);
            vec4 y_ = floor(j - 7.0 * x_ );
            vec4 x = x_ *ns.x + ns.yyyy;
            vec4 y = y_ *ns.x + ns.yyyy;
            vec4 h = 1.0 - abs(x) - abs(y);
            vec4 b0 = vec4( x.xy, y.xy );
            vec4 b1 = vec4( x.zw, y.zw );
            vec4 s0 = floor(b0)*2.0 + 1.0;
            vec4 s1 = floor(b1)*2.0 + 1.0;
            vec4 sh = -step(h, vec4(0.0));
            vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
            vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
            vec3 p0 = vec3(a0.xy,h.x);
            vec3 p1 = vec3(a0.zw,h.y);
            vec3 p2 = vec3(a1.xy,h.z);
            vec3 p3 = vec3(a1.zw,h.w);
            vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
            p0 *= norm.x;
            p1 *= norm.y;
            p2 *= norm.z;
            p3 *= norm.w;
            vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
            m = m * m;
            return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
        }
        float hash(float n) { return fract(sin(n) * 43758.5453123); }

        void main() {
            vec3 pos = position;
            float n = snoise(pos * 0.05 + time * 0.2);
            float p = scrollProg;

            // Phase definitions
            float ph0  = 1.0 - smoothstep(0.00, 0.05, p);           
            float ph1  = smoothstep(0.02, 0.06, p) * (1.0 - smoothstep(0.12, 0.16, p)); 
            float ph2  = smoothstep(0.13, 0.15, p) * (1.0 - smoothstep(0.19, 0.22, p)); 
            float ph3  = smoothstep(0.18, 0.21, p) * (1.0 - smoothstep(0.27, 0.30, p));
            float ph4  = smoothstep(0.26, 0.29, p) * (1.0 - smoothstep(0.37, 0.40, p));
            float ph5  = smoothstep(0.36, 0.39, p) * (1.0 - smoothstep(0.47, 0.50, p));
            float ph6  = smoothstep(0.46, 0.49, p) * (1.0 - smoothstep(0.57, 0.60, p));
            float ph7  = smoothstep(0.56, 0.59, p) * (1.0 - smoothstep(0.67, 0.70, p));
            float ph8  = smoothstep(0.66, 0.69, p) * (1.0 - smoothstep(0.77, 0.80, p));
            float ph9  = smoothstep(0.77, 0.81, p) * (1.0 - smoothstep(0.88, 0.92, p));
            float ph10 = smoothstep(0.87, 0.91, p);

            // Formations
            vec3 nebula = pos + vec3(n * 5.0, n * 5.0, n * 5.0);
            vec3 rain = vec3(pos.x, pos.y * 3.0 + time * 10.0, pos.z); 
            rain.y = mod(rain.y + 50.0, 100.0) - 50.0;
            vec3 explode = pos * (1.0 + sin(time * 2.0 + aRandom * 10.0) * 0.5);
            vec3 converge = pos * (2.0 - p * 3.0);
            
            float gx = floor(pos.x / 5.0) * 5.0;
            float gy = floor(pos.y / 5.0) * 5.0;
            vec3 grid = vec3(gx, gy, pos.z + sin(time + gx)*2.0);

            float hAngle = pos.y * 0.1 + time;
            float hR = 15.0;
            vec3 helix = vec3(cos(hAngle)*hR, pos.y, sin(hAngle)*hR);

            float wY = pos.y;
            float wX = pos.x;
            float wZ = sin(wX * 0.1 + time) * 10.0;
            vec3 wave = vec3(wX, wY, wZ);

            float vAngle = aRandom * 6.28 + time;
            float vR = pos.x * 0.5; // shrink
            vec3 vortex = vec3(cos(vAngle)*vR, pos.y * 2.0, sin(vAngle)*vR);

            vec3 pillars = vec3(floor(pos.x/10.0)*10.0, pos.y * 2.0, floor(pos.z/10.0)*10.0);

            float pulseR = 25.0 + sin(time * 2.0) * 10.0;
            vec3 pulseDir = normalize(pos + 0.001);
            vec3 pulse = pulseDir * pulseR + pulseDir * sin(time * 3.0 + aRandom * 12.0) * 5.0;

            float tunnelAngle = atan(pos.y, pos.x);
            float tunnelR = 18.0 + sin(tunnelAngle * 6.0 + time) * 3.0;
            float tunnelZ = mod(pos.z - time * 30.0, 200.0) - 100.0;
            vec3 tunnel = vec3(cos(tunnelAngle)*tunnelR, sin(tunnelAngle)*tunnelR, tunnelZ);

            // Blending
            vec3 basePos = pos + n * 1.5;
            vec3 finalPos = basePos;
            float totalPhase = ph0 + ph1 + ph2 + ph3 + ph4 + ph5 + ph6 + ph7 + ph8 + ph9 + ph10;
            float defaultWeight = max(0.0, 1.0 - totalPhase);

            finalPos = basePos * defaultWeight
                     + nebula * ph0
                     + rain * ph1
                     + explode * ph2
                     + converge * ph3
                     + grid * ph4
                     + helix * ph5
                     + wave * ph6
                     + vortex * ph7
                     + pillars * ph8
                     + pulse * ph9
                     + tunnel * ph10;

            finalPos += vec3(
                sin(time * 2.0 + finalPos.y * 0.1) * 0.3,
                cos(time * 1.5 + finalPos.x * 0.1) * 0.3,
                sin(time * 1.8 + finalPos.z * 0.1) * 0.3
            ) * (1.0 - ph4 * 0.8);

            vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);

            // Size
            float baseSize = 2.0 + aRandom * 2.0;
            baseSize *= (1.0 + ph2 * 1.2);
            baseSize *= (1.0 - ph4 * 0.4);
            baseSize *= (1.0 + ph9 * 0.6);
            baseSize *= (1.0 + ph1 * 0.25);

            gl_PointSize = baseSize * (40.0 / -mvPosition.z);
            gl_PointSize = max(gl_PointSize, 0.8);
            gl_Position = projectionMatrix * mvPosition;

            // Color
            vec3 cMint    = vec3(0.45, 0.78, 0.65);
            vec3 cEmerald = vec3(0.18, 0.62, 0.45);
            vec3 cSage    = vec3(0.52, 0.72, 0.58);
            vec3 cTeal    = vec3(0.25, 0.68, 0.58);
            vec3 cForest  = vec3(0.15, 0.55, 0.38);
            vec3 cAqua    = vec3(0.38, 0.75, 0.72);
            vec3 cJade    = vec3(0.30, 0.65, 0.50);
            vec3 cSoft    = vec3(0.55, 0.80, 0.68);

            vec3 color = cMint;
            color = mix(color, cEmerald, ph1);
            color = mix(color, cSage,    ph2);
            color = mix(color, cForest,  ph3);
            color = mix(color, cTeal,    ph4);
            color = mix(color, cAqua,    ph5);
            color = mix(color, cJade,    ph6);
            color = mix(color, cEmerald, ph7);
            color = mix(color, cTeal,    ph8);
            color = mix(color, cForest,  ph9);
            color = mix(color, cSoft,    ph10);

            float sparkle = step(0.985, hash(aRandom * 1000.0 + floor(time * 3.0)));
            color = mix(color, vec3(0.3, 0.55, 0.42), sparkle * 0.3);

            vColor = color;
            vAlpha = 0.7 + n * 0.1 + sparkle * 0.15;
            vAlpha *= (1.0 + ph2 * 0.2);
            vAlpha *= (1.0 - ph3 * 0.15);
        }
    `

        const fragmentShader = `
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
            float dist = length(gl_PointCoord - vec2(0.5));
            if (dist > 0.5) discard;
            float soft = 1.0 - smoothstep(0.3, 0.5, dist);
            gl_FragColor = vec4(vColor, vAlpha * soft);
        }
    `

        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0.0 },
                scrollProg: { value: 0.0 }
            },
            vertexShader,
            fragmentShader,
            transparent: true,
            depthWrite: false,
            blending: THREE.NormalBlending
        })

        const points = new THREE.Points(geometry, material)
        scene.add(points)

        // --- ANIMATION LOOP ---
        // Camera keys from original script
        const camKeys = [
            [0, 0, 60, 0, 0, 0],
            [5, 10, 55, 0.05, 0, 0],
            [0, 0, 70, 0, 0, 0],
            [0, 0, 30, 0, 0, 0],
            [10, 15, 50, 0.15, 0.1, 0],
            [0, 25, 40, 0.3, 0, 0],
            [0, 30, 45, 0.35, 0, 0],
            [0, 5, 35, 0, 0, 0.1],
            [0, 0, 55, 0, 0, 0],
            [0, 0, 45, 0, 0, 0],
            [0, 0, 20, 0, 0, 0]
        ]
        const fogKeys = [0.015, 0.008, 0.005, 0.03, 0.02, 0.012, 0.01, 0.018, 0.015, 0.01, 0.025]
        const phaseStarts = [0.0, 0.06, 0.14, 0.20, 0.28, 0.38, 0.48, 0.58, 0.68, 0.78, 0.88]

        function getPhaseIndex(prog: number) {
            for (let i = phaseStarts.length - 1; i >= 0; i--) {
                if (prog >= phaseStarts[i]) return i
            }
            return 0
        }

        function lerpVal(a: number, b: number, t: number) { return a + (b - a) * t }

        function getCameraAndFog(prog: number) {
            const idx = getPhaseIndex(prog)
            const nextIdx = Math.min(idx + 1, phaseStarts.length - 1)
            const start = phaseStarts[idx]
            const end = nextIdx < phaseStarts.length ? phaseStarts[nextIdx] : 1.0
            const range = end - start
            const localT = range > 0 ? Math.min((prog - start) / range, 1.0) : 0
            const t = localT * localT * (3 - 2 * localT)

            const camA = camKeys[idx]
            const camB = camKeys[nextIdx]
            const fogA = fogKeys[idx]
            const fogB = fogKeys[nextIdx]

            return {
                cx: lerpVal(camA[0], camB[0], t),
                cy: lerpVal(camA[1], camB[1], t),
                cz: lerpVal(camA[2], camB[2], t),
                rx: lerpVal(camA[3], camB[3], t),
                ry: lerpVal(camA[4], camB[4], t),
                rz: lerpVal(camA[5], camB[5], t),
                fog: lerpVal(fogA, fogB, t)
            }
        }

        let scrollTarget = 0
        let scrollCurrent = 0
        let animationFrameId: number

        const handleScroll = () => {
            const totalHeight = document.documentElement.scrollHeight - window.innerHeight
            scrollTarget = totalHeight > 0 ? window.scrollY / totalHeight : 0
        }
        window.addEventListener('scroll', handleScroll, { passive: true })

        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight
            camera.updateProjectionMatrix()
            renderer.setSize(window.innerWidth, window.innerHeight)
        }
        window.addEventListener('resize', handleResize)

        const animate = () => {
            animationFrameId = requestAnimationFrame(animate)

            scrollCurrent += (scrollTarget - scrollCurrent) * 0.06
            const t = performance.now() * 0.0005
            material.uniforms.time.value = t
            material.uniforms.scrollProg.value = scrollCurrent

            const cf = getCameraAndFog(scrollCurrent)
            camera.position.set(cf.cx, cf.cy, cf.cz)
            camera.rotation.set(cf.rx, cf.ry, cf.rz + Math.sin(t * 0.3) * 0.02)
            scene.fog.density = cf.fog

            points.rotation.y = t * 0.05
            renderer.render(scene, camera)
        }
        animate()

        // Cleanup
        return () => {
            window.removeEventListener('scroll', handleScroll)
            window.removeEventListener('resize', handleResize)
            cancelAnimationFrame(animationFrameId)
            if (containerRef.current) containerRef.current.removeChild(renderer.domElement)
            geometry.dispose()
            material.dispose()
        }
    }, [])

    return (
        <div
            ref={containerRef}
            id="canvas-container"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 0,
                pointerEvents: 'none'
            }}
        />
    )
}
