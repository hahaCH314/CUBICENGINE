"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { useEditorStore } from "./store";
import type { VoxelBlock } from "./store";
import { McButton } from "../_mc";

/* ═══════════════════════════════════════════
   Three.js Viewport
   ═══════════════════════════════════════════ */
function ThreeViewport({paintMode, setPaintMode, mode = "blocks", simple = true, activeTool = "select"}: {
  paintMode: boolean;
  setPaintMode: (v: boolean) => void;
  mode?: "blocks" | "items";
  simple?: boolean;
  activeTool?: "select" | "add" | "paint" | "delete";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef  = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef     = useRef<THREE.Scene | null>(null);
  const cameraRef    = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef  = useRef<OrbitControls | null>(null);
  const meshMapRef   = useRef<Map<string, THREE.Mesh>>(new Map());
  const gridRef      = useRef<THREE.GridHelper | null>(null);
  const frameRef     = useRef<number>(0);
  const [ready, setReady] = useState(false);
  const [glError, setGlError] = useState(false); // WebGL(3D)が使えない環境用のフォールバック

  // 3大エフェクト管理用 refs
  const effectsRef   = useRef<Array<{ mesh: THREE.Object3D; update: (delta: number) => boolean }>>([]);
  const prevIdsRef   = useRef<Set<string>>(new Set());
  const prevPosRef   = useRef<Map<string, [number, number, number]>>(new Map());
  const prevModeRef  = useRef(mode);

  const addBlock = useEditorStore((s) => s.addBlock);
  const addItem = useEditorStore((s) => s.addItem);
  const removeBlock = useEditorStore((s) => s.removeBlock);
  const removeItem = useEditorStore((s) => s.removeItem);
  const selectBlock = useEditorStore((s) => s.selectBlock);
  const selectItem = useEditorStore((s) => s.selectItem);

  const paintModeRef = useRef(paintMode);
  useEffect(() => {
    paintModeRef.current = paintMode;
  }, [paintMode]);

  const activeToolRef = useRef(activeTool);
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  // controls の Pan（平行移動）許可を simple に応じて同期する
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.enablePan = !simple;
      if (simple) {
        controlsRef.current.target.set(0, 0.5, 0);
        controlsRef.current.update();
      }
    }
  }, [simple]);

  // 3大エフェクト生成ヘルパー
  const spawnShockwave = useCallback((x: number, z: number, colorHex: number = 0xfb7185) => {
    const scene = sceneRef.current;
    if (!scene) return;
    const geo = new THREE.RingGeometry(0.1, 0.2, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.02, z);
    scene.add(ring);

    let age = 0;
    const duration = 0.5;
    const maxRadius = 2.0;

    effectsRef.current.push({
      mesh: ring,
      update: (delta: number) => {
        age += delta;
        if (age >= duration) {
          scene.remove(ring);
          geo.dispose();
          mat.dispose();
          return false;
        }
        const progress = age / duration;
        const easeOut = 1 - Math.pow(1 - progress, 2);
        const currentRadius = 0.1 + easeOut * (maxRadius - 0.1);
        const scale = currentRadius / 0.2;
        ring.scale.set(scale, scale, 1);
        mat.opacity = 0.8 * (1 - easeOut);
        return true;
      }
    });
  }, []);

  const spawnSnapGlow = useCallback((x: number, y: number, z: number) => {
    const scene = sceneRef.current;
    if (!scene) return;

    const group = new THREE.Group();
    group.position.set(x, y, z);
    scene.add(group);

    const size = 0.12;
    const length = 0.6;
    const geoH = new THREE.BoxGeometry(length, size, size);
    const geoV = new THREE.BoxGeometry(size, length, size);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xfb7185,
      emissive: 0xfb7185,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.9,
    });

    const meshH = new THREE.Mesh(geoH, mat);
    const meshV = new THREE.Mesh(geoV, mat);
    group.add(meshH, meshV);

    let age = 0;
    const duration = 0.4;

    effectsRef.current.push({
      mesh: group,
      update: (delta: number) => {
        age += delta;
        if (age >= duration) {
          scene.remove(group);
          geoH.dispose();
          geoV.dispose();
          mat.dispose();
          return false;
        }
        const progress = age / duration;
        const scale = 1 - progress;
        group.scale.set(scale, scale, scale);
        group.rotation.y += delta * 4;
        mat.opacity = 0.9 * (1 - progress);
        return true;
      }
    });
  }, []);

  const spawnPaintSplash = useCallback((posVec: THREE.Vector3, colorHex: number) => {
    const scene = sceneRef.current;
    if (!scene) return;

    const group = new THREE.Group();
    scene.add(group);

    const particles: Array<{ mesh: THREE.Mesh; vel: THREE.Vector3 }> = [];
    const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    const mat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.6,
    });

    for (let i = 0; i < 3; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(posVec);
      group.add(mesh);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 1.5,
        1.5 + Math.random() * 2.0,
        (Math.random() - 0.5) * 1.5
      );
      particles.push({ mesh, vel });
    }

    let age = 0;
    const duration = 0.6;
    const gravity = 9.8;

    effectsRef.current.push({
      mesh: group,
      update: (delta: number) => {
        age += delta;
        if (age >= duration) {
          scene.remove(group);
          geo.dispose();
          mat.dispose();
          return false;
        }

        const progress = age / duration;
        particles.forEach((p) => {
          p.mesh.position.x += p.vel.x * delta;
          p.mesh.position.y += p.vel.y * delta - 0.5 * gravity * delta * delta;
          p.mesh.position.z += p.vel.z * delta;
          p.vel.y -= gravity * delta;
          p.mesh.rotation.x += delta * 5;
          p.mesh.rotation.y += delta * 5;
          const s = 1 - progress;
          p.mesh.scale.set(s, s, s);
        });

        return true;
      }
    });
  }, []);

  const blocks         = useEditorStore((s) => s.blocks);
  const items          = useEditorStore((s) => s.items);
  const showGrid       = useEditorStore((s) => s.showGrid);
  const showWireframe  = useEditorStore((s) => s.showWireframe);
  const selectedBlockIds = useEditorStore((s) => s.selectedBlockIds);
  const selectedItemIds = useEditorStore((s) => s.selectedItemIds);
  const updateBlock    = useEditorStore((s) => s.updateBlock);
  const updateItem    = useEditorStore((s) => s.updateItem);
  const [selectedFace, setSelectedFace] = useState<{blockId: string; faceIndex: number} | null>(null);

  // Use appropriate data and methods based on mode
  const workingData = mode === "items" ? items : blocks;
  const workingDataRef = useRef(workingData);
  useEffect(() => {
    workingDataRef.current = workingData;
  }, [workingData]);

  const selectedIds = mode === "items" ? selectedItemIds : selectedBlockIds;
  const selectFn = mode === "items" ? selectItem : selectBlock;
  const selectFnRef = useRef(selectFn);
  useEffect(() => {
    selectFnRef.current = selectFn;
  }, [selectFn]);

  const updateFn = mode === "items" ? updateItem : updateBlock;

  /* ── Init ── */
  useEffect(() => {
    if (!containerRef.current || rendererRef.current) return;
    const el = containerRef.current;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch (err) {
      // WebGL無効環境(サンドボックス/HWアクセラ無効 等)では落とさず案内表示に切替
      console.warn("[CUBICENGINE] WebGL を初期化できませんでした:", err);
      setGlError(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.setClearColor(0x23211e, 1); // コブルストーン背景の深い石グレー
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoftShadowMap is deprecated
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    el.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x23211e, 0.035); // 深い石グレーで遠景にフェード
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 0.1, 100);
    camera.position.set(3, 2.5, 3);
    camera.lookAt(0, 0.5, 0);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0.5, 0);
    controls.minDistance = 1;
    controls.maxDistance = 30;
    controls.maxPolarAngle = Math.PI * 0.85;
    controls.enablePan = !simple;
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 0.55)); // 環境光を調整
    scene.add(new THREE.HemisphereLight(0x2d2d2d, 0x141414, 0.7)); // ダークテーマ用にHemisphereLightを調整
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(4, 6, 3);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    scene.add(dir);
    const rim = new THREE.DirectionalLight(0xfb7185, 0.55); // ポーションピンクのリムライトを少し強めに
    rim.position.set(-3, 2, -3);
    scene.add(rim);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.22 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // メイン線=濃ポーションピンク(中央十字)、サブ=タウペ(マス目)
    const grid = new THREE.GridHelper(16, 16, 0xbe123c, 0xa89878);
    (grid.material as THREE.Material).opacity = 0.7;
    (grid.material as THREE.Material).transparent = true;
    scene.add(grid);
    gridRef.current = grid;

    // 3D Voxel Axes（極限までシンプルに馴染ませた、双方向の極細光ライン）
    const axes = new THREE.Group();
    // 地面（Y=0）との重なり（Z-fighting）を防ぐために、グループ全体をわずかに上に浮かせる
    axes.position.y = 0.015;

    const createVoxelAxis = (dir: "x" | "y" | "z", axisColor: number) => {
      const group = new THREE.Group();
      
      const rodLength = 16.0; // グリッドの全幅に合わせた長さ
      const rodThickness = 0.02; // 邪魔にならない極細仕様
      let rodGeo: THREE.BoxGeometry;
      let rodPos: [number, number, number] = [0, 0, 0]; // 原点中心

      if (dir === "x") {
        rodGeo = new THREE.BoxGeometry(rodLength, rodThickness, rodThickness);
      } else if (dir === "y") {
        rodGeo = new THREE.BoxGeometry(rodThickness, rodLength, rodThickness);
      } else {
        rodGeo = new THREE.BoxGeometry(rodThickness, rodThickness, rodLength);
      }

      const rodMat = new THREE.MeshStandardMaterial({
        color: axisColor,
        emissive: axisColor,
        emissiveIntensity: 0.35, // 優しく上品に発光
        transparent: true,
        opacity: 0.65, // 半透明にして背景やモデルに馴染ませる
        roughness: 0.5,
        metalness: 0.1
      });

      const rod = new THREE.Mesh(rodGeo, rodMat);
      rod.position.set(...rodPos);
      group.add(rod);

      return group;
    };

    axes.add(createVoxelAxis("x", 0xf43f5e)); // X 明るいローズ/赤
    axes.add(createVoxelAxis("y", 0x10b981)); // Y 明るいエメラルド/緑
    axes.add(createVoxelAxis("z", 0x3b82f6)); // Z 明るいブルー/青
    scene.add(axes);

    // Raycasting for block selection and face picking for painting
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    function onClick(e: MouseEvent) {
      const rect = el.getBoundingClientRect();
      mouse.set(
        ((e.clientX - rect.left) / el.clientWidth) * 2 - 1,
        -((e.clientY - rect.top) / el.clientHeight) * 2 + 1
      );
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects([...meshMapRef.current.values()]);
      if (hits.length > 0) {
        const hit = hits[0];
        const hitMesh = hit.object as THREE.Mesh;
        for (const [id, m] of meshMapRef.current) {
          if (m === hitMesh) {
            // おく（設置）
            if (activeToolRef.current === "add" && hit.face) {
              try {
                const normal = hit.face.normal.clone();
                normal.applyEuler(hitMesh.rotation);
                const rx = Math.round(normal.x);
                const ry = Math.round(normal.y);
                const rz = Math.round(normal.z);
                
                const nextPos: [number, number, number] = [
                  hitMesh.position.x + rx,
                  hitMesh.position.y + ry,
                  hitMesh.position.z + rz
                ];

                const nextId = mode === "items" ? `item-${Date.now()}` : `block-${Date.now()}`;
                const block = workingDataRef.current.find((b) => b.id === id);
                const col = block?.faces.top?.color || "#fb7185";
                
                const newBlockData = {
                  id: nextId,
                  name: mode === "items" ? `item_${Date.now().toString().slice(-4)}` : `block_${Date.now().toString().slice(-4)}`,
                  position: nextPos,
                  scale: (block?.scale ? [...block.scale] : (mode === "items" ? [0.5,0.5,0.5] : [1,1,1])) as [number, number, number],
                  rotation: [0, 0, 0] as [number, number, number],
                  faces: block ? JSON.parse(JSON.stringify(block.faces)) : {
                    top: { color: col }, bottom: { color: col },
                    front: { color: col }, back: { color: col },
                    left: { color: col }, right: { color: col },
                  }
                };

                if (mode === "items") {
                  addItem(newBlockData);
                  selectItem(nextId);
                } else {
                  addBlock(newBlockData);
                  selectBlock(nextId);
                }
              } catch (err) {
                console.error("Failed to add block on face click:", err);
              }
            }
            // こわす（消去）
            else if (activeToolRef.current === "delete") {
              if (mode === "items") {
                removeItem(id);
              } else {
                removeBlock(id);
              }
            }
            // ぬる（ペイント）
            else if ((activeToolRef.current === "paint" || paintModeRef.current) && hit.face) {
              try {
                setSelectedFace({blockId: id, faceIndex: hit.face.materialIndex});
                // ペイントエフェクトトリガー
                const facesKeys = ["right", "left", "top", "bottom", "front", "back"] as const;
                const faceIndex = hit.face.materialIndex;
                if (faceIndex >= 0 && faceIndex < facesKeys.length) {
                  const faceKey = facesKeys[faceIndex];
                  const block = workingDataRef.current.find((b) => b.id === id);
                  const colorHexStr = block?.faces[faceKey]?.color || "#fb7185";
                  const colorHex = parseInt(colorHexStr.replace("#", "0x"), 16);
                  spawnPaintSplash(hit.point, colorHex);
                }
              } catch (err) {
                console.error("Paint splash spawn failed:", err);
              }
            }
            // えらぶ（選択）
            else {
              selectFnRef.current(id, e.ctrlKey || e.metaKey);
            }
            return;
          }
        }
      }
    }
    el.addEventListener("click", onClick);

    // display:none で初期化されると canvas が 0×0 になるため
    // animate ループ内でコンテナサイズを毎フレーム検出して自動修正する
    let lastTime = performance.now();
    let _prevW = 0, _prevH = 0;
    function animate() {
      frameRef.current = requestAnimationFrame(animate);
      const currentTime = performance.now();
      const delta = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      const w = el.clientWidth, h = el.clientHeight;
      if (w > 0 && h > 0 && (w !== _prevW || h !== _prevH)) {
        _prevW = w; _prevH = h;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
      controls.update();

      // エフェクトの更新 (例外で描画ループが止まらないよう保護)
      effectsRef.current = effectsRef.current.filter((effect) => {
        try {
          return effect.update(delta);
        } catch (err) {
          console.error("Effect update failed, removing effect:", err);
          try {
            if (effect.mesh.parent) {
              effect.mesh.parent.remove(effect.mesh);
            }
          } catch (_) {}
          return false;
        }
      });

      renderer.render(scene, camera);
    }
    animate();

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(el);
    const handleResetCamera = () => {
      camera.position.set(3, 2.5, 3);
      controls.target.set(0, 0.5, 0);
      controls.update();
    };
    window.addEventListener("mmc-reset-camera", handleResetCamera);

    // ★ 初期化完了マーク。これが無いと同期useEffect(if(!scene||!ready)return)が
    //   永久に走らず、ブロックのメッシュがsceneに追加されない＝描画されない。
    setReady(true);

    return () => {
      window.removeEventListener("mmc-reset-camera", handleResetCamera);
      cancelAnimationFrame(frameRef.current);
      ro.disconnect();
      el.removeEventListener("click", onClick);
      controls.dispose();
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      rendererRef.current = null;
      sceneRef.current = null;
      setReady(false);
    };
  }, []);

  /* ── Grid ── */
  useEffect(() => {
    if (gridRef.current) gridRef.current.visible = showGrid;
  }, [showGrid]);

  /* ── Sync blocks/items ── */
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !ready) return;
    const meshMap = meshMapRef.current;
    const currentIds = new Set(workingData.map((b) => b.id));

    // モード切り替えを検知（切り替え時のエフェクト大暴発を防止）
    const isModeChanged = prevModeRef.current !== mode;
    if (isModeChanged) {
      prevModeRef.current = mode;
      prevIdsRef.current = new Set(workingData.map((b) => b.id));
      prevPosRef.current = new Map(workingData.map((b) => [b.id, [...(b.position ?? [0, 0.5, 0])]]));
    }

    // 初回ロード時または ready 遷移時の初期化（最初からあるブロックに対してエフェクトを出さないため）
    if (prevIdsRef.current.size === 0 && workingData.length > 0) {
      prevIdsRef.current = new Set(workingData.map((b) => b.id));
      prevPosRef.current = new Map(workingData.map((b) => [b.id, [...(b.position ?? [0, 0.5, 0])]]));
    }

    // 新規追加の検知
    if (!isModeChanged) {
      for (const block of workingData) {
        if (!prevIdsRef.current.has(block.id)) {
          const x = block.position?.[0] ?? 0;
          const z = block.position?.[2] ?? 0;
          const topColStr = block.faces.top?.color || "#fb7185";
          const colorHex = parseInt(topColStr.replace("#", "0x"), 16);
          spawnShockwave(x, z, colorHex);
        }
      }

      // 座標移動の検知
      for (const block of workingData) {
        const prevPos = prevPosRef.current.get(block.id);
        if (prevPos) {
          const [px, py, pz] = prevPos;
          const [cx, cy, cz] = block.position ?? [0, 0.5, 0];
          if (px !== cx || py !== cy || pz !== cz) {
            spawnSnapGlow(cx, cy, cz);
          }
        }
      }
    }

    // 次回比較用に保存
    prevIdsRef.current = new Set(workingData.map((b) => b.id));
    prevPosRef.current = new Map(workingData.map((b) => [b.id, [...(b.position ?? [0, 0.5, 0])]]));

    // Remove deleted
    for (const [id, mesh] of meshMap) {
      if (!currentIds.has(id)) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m: THREE.Material) => m.dispose());
        meshMap.delete(id);
      }
    }

    // Add / update
    for (const block of workingData) {
      let mesh = meshMap.get(block.id);
      if (!mesh) {
        mesh = createBlockMesh(block);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        meshMap.set(block.id, mesh);
      }

      mesh.position.set(...(block.position ?? [0, 0.5, 0]));
      mesh.scale.set(...(block.scale ?? [1, 1, 1]));
      mesh.rotation.set(
        (block.rotation?.[0] ?? 0) * Math.PI / 180,
        (block.rotation?.[1] ?? 0) * Math.PI / 180,
        (block.rotation?.[2] ?? 0) * Math.PI / 180
      );
      updateBlockColors(mesh, block);
      (mesh.material as THREE.MeshStandardMaterial[]).forEach((m) => { m.wireframe = showWireframe; });

      // Selection outline (カラーもポーションピンクの 0xfb7185 に統一)
      const outline = mesh.children.find((c) => c.userData.isOutline);
      const isSelected = selectedIds.includes(block.id);
      if (isSelected && !outline) {
        const ol = new THREE.LineSegments(
          new THREE.EdgesGeometry(mesh.geometry),
          new THREE.LineBasicMaterial({ color: 0xfb7185, linewidth: 2 })
        );
        ol.userData.isOutline = true;
        mesh.add(ol);
      } else if (!isSelected && outline) {
        mesh.remove(outline);
      }
    }
  }, [workingData, showWireframe, selectedIds, ready, mode]);

  if (glError) {
    return (
      <div className="w-full h-full flex items-center justify-center text-center p-6" style={{ background: "#23211e" }}>
        <div className="max-w-sm">
          <div className="text-3xl mb-3">🧊</div>
          <p className="text-sm font-bold text-white mb-2">3Dビューを表示できません</p>
          <p className="text-xs text-[#9aa0a6] leading-relaxed">
            この環境では WebGL（3D描画）が無効です。<br />
            ブラウザのハードウェアアクセラレーションを有効にするか、別のブラウザ/PCでお試しください。<br />
            <span className="text-[#a3e635]">他の機能（ロジック・書き出し等）はそのまま使えます。</span>
          </p>
        </div>
      </div>
    );
  }
  return <div ref={containerRef} className="w-full h-full" />;
}

function createBlockMesh(block: VoxelBlock): THREE.Mesh {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const f = block.faces;
  const textureLoader = new THREE.TextureLoader();

  const createMaterial = (face: typeof f.right) => {
    const mat = new THREE.MeshStandardMaterial({
      color: face.color,
      roughness: 0.7,
      metalness: 0.1
    });
    if (face.texture) {
      try {
        const texture = textureLoader.load(face.texture);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        mat.map = texture;
        mat.color.set(0xffffff);
      } catch (e) {
        console.error("Failed to load texture:", e);
      }
    }
    return mat;
  };

  return new THREE.Mesh(geo, [
    createMaterial(f.right),
    createMaterial(f.left),
    createMaterial(f.top),
    createMaterial(f.bottom),
    createMaterial(f.front),
    createMaterial(f.back),
  ]);
}

function updateBlockColors(mesh: THREE.Mesh, block: VoxelBlock) {
  const mats = mesh.material as THREE.MeshStandardMaterial[];
  const f = block.faces;
  const textureLoader = new THREE.TextureLoader();

  const faces = [f.right, f.left, f.top, f.bottom, f.front, f.back];
  faces.forEach((face, idx) => {
    const mat = mats[idx];
    if (face.texture) {
      try {
        const texture = textureLoader.load(face.texture);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        mat.map = texture;
        mat.color.set(0xffffff);
      } catch (e) {
        console.error("Failed to load texture:", e);
        mat.color.set(face.color);
        mat.map = null;
      }
    } else {
      mat.color.set(face.color);
      mat.map = null;
    }
    mat.needsUpdate = true;
  });
}

/* ═══════════════════════════════════════════
   テクスチャプリセット
   ═══════════════════════════════════════════ */
const PRESETS = [
  { name: "草",       top: "#4ade80", side: "#8B6914", bottom: "#6B4E12" },
  { name: "石",       top: "#9ca3af", side: "#78716c", bottom: "#57534e" },
  { name: "ダイヤ",   top: "#67e8f9", side: "#22d3ee", bottom: "#0891b2" },
  { name: "金",       top: "#fde047", side: "#eab308", bottom: "#a16207" },
  { name: "レッドスト",top: "#f87171", side: "#dc2626", bottom: "#991b1b" },
  { name: "ラピス",   top: "#60a5fa", side: "#2563eb", bottom: "#1e3a8a" },
  { name: "黒曜石",   top: "#3f3f46", side: "#27272a", bottom: "#18181b" },
  { name: "アメシスト",top: "#c084fc", side: "#9333ea", bottom: "#6b21a8" },
];

/* ═══════════════════════════════════════════
   プロパティパネル（変形・色）
   ═══════════════════════════════════════════ */
function PropertiesPanel({ mode = "blocks", simple = false }: { mode?: "blocks" | "items"; simple?: boolean }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [bounceY, setBounceY] = useState(0);

  // ホイールによるバウンス効果（びよんびよーん）
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = panelRef.current;
    if (!el) return;

    const isAtTop = el.scrollTop === 0;
    const isAtBottom = Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight;

    if (isAtTop && e.deltaY < 0) {
      setBounceY((prev) => Math.min(prev - e.deltaY * 0.12, 35));
    } else if (isAtBottom && e.deltaY > 0) {
      setBounceY((prev) => Math.max(prev - e.deltaY * 0.12, -35));
    }
  };

  useEffect(() => {
    if (bounceY !== 0) {
      let active = true;
      const decay = () => {
        if (!active) return;
        setBounceY((prev) => {
          const next = prev * 0.8; // 減衰率
          if (Math.abs(next) < 0.2) {
            return 0;
          }
          requestAnimationFrame(decay);
          return next;
        });
      };
      requestAnimationFrame(decay);
      return () => { active = false; };
    }
  }, [bounceY]);

  const blocks        = useEditorStore((s) => s.blocks);
  const items         = useEditorStore((s) => s.items);
  const selectedBlockIds   = useEditorStore((s) => s.selectedBlockIds);
  const selectedItemIds   = useEditorStore((s) => s.selectedItemIds);
  const updateBlock   = useEditorStore((s) => s.updateBlock);
  const updateItem   = useEditorStore((s) => s.updateItem);
  const removeBlock   = useEditorStore((s) => s.removeBlock);
  const removeItem   = useEditorStore((s) => s.removeItem);
  const addBlock      = useEditorStore((s) => s.addBlock);
  const addItem       = useEditorStore((s) => s.addItem);
  const selectBlock   = useEditorStore((s) => s.selectBlock);
  const selectItem    = useEditorStore((s) => s.selectItem);
  const duplicateBlock = useEditorStore((s) => s.duplicateBlock);
  const duplicateItem  = useEditorStore((s) => s.duplicateItem);

  // Mode-based data
  const workingBlocks = mode === "items" ? items : blocks;
  const selectedIds = mode === "items" ? selectedItemIds : selectedBlockIds;
  const updateFn = mode === "items" ? updateItem : updateBlock;
  const removeFn = mode === "items" ? removeItem : removeBlock;
  const addFn = mode === "items" ? addItem : addBlock;
  const selectFn = mode === "items" ? selectItem : selectBlock;
  const duplicateFn = mode === "items" ? duplicateItem : duplicateBlock;

  // 新しいブロック/アイテムを作る（一覧の「＋」用）
  const handleAddNew = useCallback(() => {
    const id = mode === "items" ? `item-${Date.now()}` : `block-${Date.now()}`;
    const idx = workingBlocks.length;
    const x = (idx % 5) - 2;
    const z = Math.floor(idx / 5) - 2;
    const sc: [number, number, number] = mode === "items" ? [0.5, 0.5, 0.5] : [1, 1, 1];
    const col = mode === "items"
      ? { top: "#fbbf24", bottom: "#f59e0b", side: "#fcd34d" }
      : { top: "#7dd3fc", bottom: "#0284c7", side: "#38bdf8" };
    addFn({
      id, name: mode === "items" ? `item_${idx + 1}` : `block_${idx + 1}`,
      position: [x, sc[1] / 2, z], scale: sc, rotation: [0, 0, 0],
      faces: {
        top: { color: col.top }, bottom: { color: col.bottom },
        front: { color: col.side }, back: { color: col.side },
        left: { color: col.bottom }, right: { color: col.bottom },
      },
    });
    selectFn(id);
  }, [mode, workingBlocks.length, addFn, selectFn]);
  const showGrid      = useEditorStore((s) => s.showGrid);
  const setShowGrid   = useEditorStore((s) => s.setShowGrid);
  const showWireframe = useEditorStore((s) => s.showWireframe);
  const setShowWireframe = useEditorStore((s) => s.setShowWireframe);
  const gridSnapEnabled = useEditorStore((s) => s.gridSnapEnabled);
  const gridSnapSize = useEditorStore((s) => s.gridSnapSize);
  const setGridSnap = useEditorStore((s) => s.setGridSnap);
  const createGroup = useEditorStore((s) => s.createGroup);
  const assignToGroup = useEditorStore((s) => s.assignToGroup);
  const groups = useEditorStore((s) => s.groups);
  const projectName = useEditorStore((s) => s.projectName);
  const nsSlug = (projectName || "my_addon").replace(/\s+/g, "_").toLowerCase().replace(/[^a-z0-9_]/g, "") || "my_addon";

  const sel = workingBlocks.find((b) => b.id === selectedIds[0]);

  const snapValue = (val: number) => {
    if (!gridSnapEnabled) return val;
    return Math.round(val / gridSnapSize) * gridSnapSize;
  };

  const applyPreset = useCallback((p: typeof PRESETS[0]) => {
    if (!sel) return;
    updateFn(sel.id, {
      faces: {
        top: { color: p.top }, bottom: { color: p.bottom },
        front: { color: p.side }, back: { color: p.side },
        left: { color: p.side }, right: { color: p.side },
      },
    });
  }, [sel, updateBlock]);

  // Numeric triplet editor helper
  const Vec3Editor = ({ label, values, onChange, step = 0.1, colors = ["text-rose-400 font-bold","text-emerald-400 font-bold","text-blue-400 font-bold"], snap = false }: {
    label: string;
    values: [number, number, number];
    onChange: (v: [number, number, number]) => void;
    step?: number;
    colors?: string[];
    snap?: boolean;
  }) => (
    <div>
      <label className="text-[11px] text-foreground/90 font-pixel block mb-1">{label}</label>
      <div className="flex gap-1.5">
        {(["X","Y","Z"] as const).map((ax, i) => (
          <div key={ax} className="flex-1">
            <span className={`text-[10px] font-mono ${colors[i]} block mb-0.5`}>{ax}</span>
            <input type="number" value={values[i]} step={step}
              onChange={(e) => {
                const next = [...values] as [number, number, number];
                let val = parseFloat(e.target.value) || 0;
                if (snap) val = snapValue(val);
                next[i] = val;
                onChange(next);
              }}
              className="w-full px-2 py-1 bg-[#1a1916] border-2 border-[#2c2c2c] mc-bevel-inset text-xs font-mono text-foreground/90 focus:outline-none focus:border-accent/40"
              style={{ borderRadius: "4px" }}
            />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div
      ref={panelRef}
      onWheel={handleWheel}
      className="w-80 border-l-3 border-[#1f1e1a] bg-panel p-3 pb-16 flex flex-col gap-4 overflow-y-auto text-sm z-10"
      style={{
        transform: `translateY(${bounceY}px)`,
        transition: bounceY === 0 ? "transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)" : "none",
        boxShadow: "inset 2px 0 0 rgba(255,255,255,0.06), inset -6px 0 12px rgba(0,0,0,0.15)",
        backgroundImage: "radial-gradient(circle at center, rgba(255,255,255,0.015) 0%, transparent 80%), repeating-linear-gradient(0deg, rgba(255,255,255,0.006) 0px, rgba(255,255,255,0.006) 1px, transparent 1px, transparent 12px)"
      }}
    >

      {/* ── ブロック一覧（何個でも作れる） ── */}
      <div>
        <div className="text-[11px] font-bold text-[#fbbf24] font-pixel uppercase tracking-wider mb-2">
          🧱 {mode === "items" ? "アイテム" : "ブロック"}一覧 ({workingBlocks.length})
        </div>
        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-0.5 bg-[#151411] border-2 border-[#1f1e1a] mc-bevel-inset p-1" style={{ borderRadius: "6px" }}>
          {workingBlocks.map((b) => {
            const isSel = selectedIds.includes(b.id);
            const sw = b.faces.front?.color || b.faces.top?.color || "#888";
            return (
              <div 
                key={b.id} 
                onClick={() => selectFn(b.id)}
                className={`flex items-center gap-2 px-2 py-1 cursor-pointer transition-colors border-2 ${
                  isSel 
                    ? "bg-[#fb7185]/20 border-[#fb7185]" 
                    : "bg-[#2a2924]/60 border-transparent hover:bg-[#3a3833]/80 hover:border-[#4a4842]"
                }`}
                style={{ borderRadius: "4px" }}
              >
                <span className="w-4 h-4 rounded-sm border-2 border-[#1f1e1a] shrink-0" style={{ background: sw, boxShadow: "inset 1px 1px 0 rgba(255,255,255,0.2)" }} />
                <input 
                  value={b.name} 
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateFn(b.id, { name: e.target.value })}
                  className="flex-1 min-w-0 bg-transparent text-xs text-foreground/85 font-mono focus:outline-none focus:bg-[#1a1916] px-1.5 py-0.5 rounded border border-transparent focus:border-[#4a4842]" 
                />
                <button 
                  onClick={(e) => { e.stopPropagation(); duplicateFn(b.id); }} 
                  title="複製"
                  className="text-[11px] text-muted hover:text-accent shrink-0 cursor-pointer p-0.5"
                >⧉</button>
                <button 
                  onClick={(e) => { e.stopPropagation(); removeFn(b.id); }} 
                  title="削除"
                  className="text-[11px] text-muted hover:text-rose-400 shrink-0 cursor-pointer p-0.5"
                >🗑️</button>
              </div>
            );
          })}
        </div>
        <button 
          onClick={handleAddNew}
          className="mt-2.5 w-full mc-btn mc-btn--sm mc-btn--primary"
        >
          ＋ 新しい{mode === "items" ? "アイテム" : "ブロック"}
        </button>
      </div>

      {/* ── 本物のマイクラブロックにする ── */}
      {sel && mode !== "items" && (
        <div className="border-t border-border/40 pt-3">
          <div className="text-[11px] font-bold text-[#fbbf24] font-pixel uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>🧱 本物のブロックにする</span>
            <button 
              onClick={() => updateFn(sel.id, { registered: !sel.registered })}
              className={`font-pixel text-[10px] px-2.5 py-1 border-2 border-[#1f1e1a] rounded transition-all cursor-pointer ${
                sel.registered 
                  ? "bg-[#10b981] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]" 
                  : "bg-surface-active text-muted hover:text-foreground/70"
              }`}
            >
              {sel.registered ? "ON" : "OFF"}
            </button>
          </div>
          {sel.registered ? (
            <div className="space-y-3 bg-[#151411] rounded-lg p-2.5 border-2 border-[#1f1e1a] mc-bevel-inset">
              <div>
                <label className="text-[10px] text-muted font-bold block mb-1">識別子 (ID)</label>
                <div className="text-[11px] font-mono text-cyan-300 px-2.5 py-1.5 bg-[#1a1916] border border-[#2c2c2c] rounded truncate shadow-inner">
                  {nsSlug}:{sel.name}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-foreground/80 font-bold block mb-1">表示名（ゲーム内）</label>
                <input 
                  value={sel.displayName ?? ""} 
                  placeholder={sel.name}
                  onChange={(e) => updateFn(sel.id, { displayName: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-[#1a1916] border-2 border-[#2c2c2c] mc-bevel-inset text-xs text-foreground/85 focus:outline-none focus:border-accent/40"
                  style={{ borderRadius: "4px" }} 
                />
              </div>
              <div>
                <label className="text-[10px] text-foreground/80 font-bold block mb-1">かたさ（壊れにくさ）</label>
                <select 
                  value={sel.hardness ?? 1.5} 
                  title="かたさ" 
                  onChange={(e) => updateFn(sel.id, { hardness: parseFloat(e.target.value) })}
                  className="w-full px-2 py-1 bg-[#1a1916] border-2 border-[#2c2c2c] mc-bevel-inset text-xs text-foreground/85 focus:outline-none focus:border-accent/40"
                  style={{ borderRadius: "4px" }}
                >
                  <option value={0}>やわらかい（0・葉っぱ）</option>
                  <option value={0.5}>土レベル（0.5）</option>
                  <option value={1.5}>石レベル（1.5）</option>
                  <option value={3}>鉄レベル（3）</option>
                  <option value={5}>ダイヤレベル（5）</option>
                  <option value={50}>オブシディアン級（50）</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-foreground/80 font-bold block mb-1">光レベル（0〜15）</label>
                <select 
                  value={sel.lightLevel ?? 0} 
                  title="光レベル" 
                  onChange={(e) => updateFn(sel.id, { lightLevel: parseInt(e.target.value) })}
                  className="w-full px-2 py-1 bg-[#1a1916] border-2 border-[#2c2c2c] mc-bevel-inset text-xs text-foreground/85 focus:outline-none"
                  style={{ borderRadius: "4px" }}
                >
                  {Array.from({ length: 16 }, (_, i) => i).map(n => (
                    <option key={n} value={n}>
                      {n}{n === 0 ? "（光らない）" : n === 15 ? "（最大）" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <p className="text-[10px] text-muted/65 italic leading-relaxed">
              ONにすると、ID・表示名・かたさ・光を設定して「本物のブロック」として書き出せます
            </p>
          )}
        </div>
      )}

      {/* ── グループ管理 ── */}
      {selectedIds.length > 0 && (
        <div className="border-t border-border/40 pt-3">
          <div className="text-[11px] font-bold text-[#fbbf24] font-pixel uppercase tracking-wider mb-2">グループ</div>
          <button
            onClick={() => {
              const name = prompt("グループ名を入力:");
              if (name) {
                const groupId = createGroup(name);
                assignToGroup(selectedIds, groupId);
              }
            }}
            className="mc-btn mc-btn--sm w-full mb-2.5"
          >
            新しいグループ作成
          </button>
          {sel?.groupId && (
            <div className="px-2.5 py-1.5 bg-[#151411] border-2 border-[#1f1e1a] mc-bevel-inset text-[11px] text-foreground/80" style={{ borderRadius: "4px" }}>
              グループ: <span className="text-accent font-bold">{groups[sel.groupId]?.name || "？"}</span>
            </div>
          )}
        </div>
      )}

      {/* ── 選択中ブロック ── */}
      <div>
        <div className="text-[11px] font-bold text-[#fbbf24] font-pixel uppercase tracking-wider mb-2">プロパティ</div>
        {sel ? (
          <div className="space-y-4">
            {/* 名前 */}
            <div>
              <label className="text-[11px] text-foreground/90 font-pixel block mb-1">名前</label>
              <input value={sel.name}
                onChange={(e) => updateFn(sel.id, { name: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-[#1a1916] border-2 border-[#2c2c2c] mc-bevel-inset text-xs font-mono text-foreground/90 focus:outline-none focus:border-accent/40"
                style={{ borderRadius: "4px" }}
              />
            </div>

            {/* ── かんたんモード: 直感コントロール ── */}
            {simple && (
              <div className="space-y-4">
                {/* 📏 おおきさ */}
                <div>
                  <label className="text-[11px] text-foreground/90 font-pixel block mb-1.5 font-bold">📏 おおきさ</label>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex gap-1.5">
                      <button onClick={() => updateFn(sel.id, { scale: [0.5, 0.5, 0.5] })}
                        className="flex-1 py-1 mc-btn mc-btn--sm text-xs font-bold">S (小)</button>
                      <button onClick={() => updateFn(sel.id, { scale: [1, 1, 1] })}
                        className="flex-1 py-1 mc-btn mc-btn--sm mc-btn--info text-xs font-bold">M (中)</button>
                      <button onClick={() => updateFn(sel.id, { scale: [2, 2, 2] })}
                        className="flex-1 py-1 mc-btn mc-btn--sm mc-btn--grape text-xs font-bold">L (大)</button>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => {
                        const s = sel.scale ?? [1, 1, 1];
                        const nx = Math.max(0.1, s[0] - 0.1);
                        const ny = Math.max(0.1, s[1] - 0.1);
                        const nz = Math.max(0.1, s[2] - 0.1);
                        updateFn(sel.id, { scale: [nx, ny, nz] });
                      }} className="flex-1 py-1 mc-btn mc-btn--sm text-xs">ー ちいさく</button>
                      <button onClick={() => {
                        const s = sel.scale ?? [1, 1, 1];
                        updateFn(sel.id, { scale: [s[0] + 0.1, s[1] + 0.1, s[2] + 0.1] });
                      }} className="flex-1 py-1 mc-btn mc-btn--sm text-xs">＋ でかく</button>
                    </div>
                  </div>
                </div>

                {/* 🔄 むき (まわす) */}
                <div>
                  <label className="text-[11px] text-foreground/90 font-pixel block mb-1.5 font-bold">🔄 むき (まわす)</label>
                  <div className="flex gap-1.5">
                    <button onClick={() => { const r = sel.rotation ?? [0, 0, 0]; updateFn(sel.id, { rotation: [r[0], r[1] - 90, r[2]] }); }}
                      className="flex-1 py-1.5 mc-btn mc-btn--sm text-xs font-bold">左にまわす ↺</button>
                    <button onClick={() => { const r = sel.rotation ?? [0, 0, 0]; updateFn(sel.id, { rotation: [r[0], r[1] + 90, r[2]] }); }}
                      className="flex-1 py-1.5 mc-btn mc-btn--sm text-xs font-bold">右にまわす ↻</button>
                    <button onClick={() => { const r = sel.rotation ?? [0, 0, 0]; updateFn(sel.id, { rotation: [r[0] + 90, r[1], r[2]] }); }}
                      className="flex-1 py-1.5 mc-btn mc-btn--sm text-xs font-bold">たおす ⤼</button>
                  </div>
                </div>

                {/* 📍 うごかす */}
                <div>
                  <label className="text-[11px] text-foreground/90 font-pixel block mb-1.5 font-bold">📍 うごかす (コントローラー)</label>
                  <div className="flex gap-3 items-center">
                    {/* 十字キー (平面X-Z) */}
                    <div className="grid grid-cols-3 grid-rows-3 gap-1 w-[96px] h-[96px] bg-[#151411] border-2 border-[#1f1e1a] rounded p-1 mc-bevel-inset relative shrink-0">
                      <div />
                      <button onClick={() => { const p = [...sel.position] as [number, number, number]; p[2] += 1; updateFn(sel.id, { position: p }); }} title="まえ" className="mc-btn mc-btn--sm p-0 flex items-center justify-center font-bold text-xs">▲</button>
                      <div />

                      <button onClick={() => { const p = [...sel.position] as [number, number, number]; p[0] -= 1; updateFn(sel.id, { position: p }); }} title="ひだり" className="mc-btn mc-btn--sm p-0 flex items-center justify-center font-bold text-xs">◀</button>
                      <div className="bg-[#2a2924] border border-black/20 rounded-sm" />
                      <button onClick={() => { const p = [...sel.position] as [number, number, number]; p[0] += 1; updateFn(sel.id, { position: p }); }} title="みぎ" className="mc-btn mc-btn--sm p-0 flex items-center justify-center font-bold text-xs">▶</button>

                      <div />
                      <button onClick={() => { const p = [...sel.position] as [number, number, number]; p[2] -= 1; updateFn(sel.id, { position: p }); }} title="おく" className="mc-btn mc-btn--sm p-0 flex items-center justify-center font-bold text-xs">▼</button>
                      <div />
                    </div>

                    {/* 高さボタン (Y) */}
                    <div className="flex flex-col gap-1.5 flex-1">
                      <button onClick={() => { const p = [...sel.position] as [number, number, number]; p[1] += 1; updateFn(sel.id, { position: p }); }} className="py-2 mc-btn mc-btn--sm mc-btn--primary text-xs font-bold flex items-center justify-center gap-1">
                        ▲ うえにいく
                      </button>
                      <button onClick={() => { const p = [...sel.position] as [number, number, number]; p[1] -= 1; updateFn(sel.id, { position: p }); }} className="py-2 mc-btn mc-btn--sm mc-btn--danger text-xs font-bold flex items-center justify-center gap-1">
                        ▼ したにいく
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── プロモード: 数値トランスフォーム等 ── */}
            {!simple && (<>
            {/* グリッドスナップ */}
            <div>
              <label className="text-[11px] text-foreground/90 font-pixel block mb-1">グリッドスナップ</label>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-foreground/75 font-pixel">
                  <input type="checkbox" checked={gridSnapEnabled} onChange={(e) => setGridSnap(e.target.checked, gridSnapSize)} className="cursor-pointer" />
                  有効にする
                </label>
              </div>
              {gridSnapEnabled && (
                <select value={gridSnapSize} onChange={(e) => setGridSnap(true, parseFloat(e.target.value))}
                  className="w-full px-2 py-1.5 bg-[#1a1916] border-2 border-[#2c2c2c] mc-bevel-inset text-xs text-foreground/90 focus:outline-none focus:border-accent/40"
                  style={{ borderRadius: "4px" }}
                >
                  <option value={0.5}>0.5</option>
                  <option value={1}>1.0</option>
                  <option value={2}>2.0</option>
                  <option value={5}>5.0</option>
                </select>
              )}
            </div>

            {/* 位置 */}
            <Vec3Editor label="📍 場所 (横 / 縦 / 奥)" values={sel.position}
              onChange={(v) => updateFn(sel.id, { position: v })} snap={gridSnapEnabled} />

            {/* スケール */}
            <Vec3Editor label="📏 大きさ (横 / 縦 / 奥)" values={sel.scale ?? [1,1,1]}
              onChange={(v) => updateFn(sel.id, { scale: v })} step={0.1} />

            {/* 回転 */}
            <Vec3Editor label="🔄 向き (傾き・度)" values={sel.rotation ?? [0,0,0]}
              onChange={(v) => updateFn(sel.id, { rotation: v })} step={5}
              colors={["text-orange-400 font-bold","text-yellow-400 font-bold","text-pink-400 font-bold"]} />

            {/* 面カラー - インベントリスロット風 */}
            <div>
              <label className="text-[11px] text-[#fbbf24] font-pixel block mb-2">🎨 面の色 (クリックで変更)</label>
              <div className="grid grid-cols-3 gap-2">
                {(["top","bottom","front","back","left","right"] as const).map((face) => (
                  <div key={face} className="flex flex-col items-center gap-1">
                    <span className="text-[9px] font-pixel text-foreground/60">{face}</span>
                    <div className="w-10 h-10 bg-[#151411] border-2 border-[#1f1e1a] mc-bevel-inset relative flex items-center justify-center cursor-pointer group" style={{ borderRadius: "5px" }}>
                      <div className="w-6 h-6 border border-black/40" style={{ background: sel.faces[face].color, boxShadow: "inset 1px 1px 0 rgba(255,255,255,0.2)" }} />
                      <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" style={{ borderRadius: "3px" }} />
                      <input type="color" value={sel.faces[face].color}
                        onChange={(e) => updateFn(sel.id, {
                          faces: { ...sel.faces, [face]: { ...sel.faces[face], color: e.target.value } }
                        })}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* テクスチャアップロード - インベントリスロット風 */}
            <div>
              <label className="text-[11px] text-[#fbbf24] font-pixel block mb-2">📤 テクスチャ (PNG画像ドロップ)</label>
              <div className="grid grid-cols-3 gap-2">
                {(["top","bottom","front","back","left","right"] as const).map((face) => {
                  const tex = sel.faces[face].texture;
                  return (
                    <div key={face} className="flex flex-col items-center gap-1">
                      <span className="text-[9px] font-pixel text-foreground/60">{face}</span>
                      <label className="w-10 h-10 bg-[#151411] border-2 border-[#1f1e1a] mc-bevel-inset relative flex items-center justify-center cursor-pointer group" style={{ borderRadius: "5px" }}>
                        {tex ? (
                          <img src={tex} alt={face} className="w-7 h-7 object-contain" style={{ imageRendering: "pixelated" }} />
                        ) : (
                          <span className="text-[10px] text-foreground/30 font-bold font-pixel">📤</span>
                        )}
                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" style={{ borderRadius: "3px" }} />
                        <input
                          type="file"
                          accept="image/png"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                const dataUrl = ev.target?.result as string;
                                updateFn(sel.id, {
                                    faces: { ...sel.faces, [face]: { ...sel.faces[face], texture: dataUrl } }
                                });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            </>)}

            {/* 削除ボタン */}
            <button
              onClick={() => removeFn(sel.id)}
              className="mt-2 mc-btn mc-btn--sm mc-btn--danger w-full"
            >
              🗑️ このブロックを削除
            </button>
          </div>
        ) : workingBlocks.length === 0 ? (
          <div className="text-center py-6 bg-[#151411] border-2 border-[#1f1e1a] mc-bevel-inset rounded-lg p-3 my-2">
            <p className="text-xs text-[#fbbf24] font-pixel mb-1.5">🧱 パーツがありません</p>
            <p className="text-[10px] text-muted font-pixel leading-relaxed">
              「＋ 新しいブロック」ボタンを押すか、プレビュー画面のボタンから最初のパーツを追加してみよう！
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted/50 italic leading-relaxed text-center font-pixel py-4">ブロックを選択してください</p>
        )}
      </div>

      {/* ── テクスチャプリセット ── */}
      <div className="border-t border-border/40 pt-3">
        <div className="text-[11px] font-bold text-[#fbbf24] font-pixel uppercase tracking-wider mb-2">
          🎨 色・柄 (ワンタッチ)
        </div>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((p) => (
            <button 
              key={p.name} 
              onClick={() => applyPreset(p)}
              className="mc-btn mc-btn--sm"
              style={{ justifyContent: "flex-start", padding: "6px 8px" }}
            >
              <div 
                className="w-4 h-4 rounded-none border border-black/40 shrink-0"
                style={{ 
                  background: `linear-gradient(135deg,${p.top},${p.side},${p.bottom})`,
                  boxShadow: "inset 1px 1px 0 rgba(255,255,255,0.2)"
                }} 
              />
              <span className="text-[11px] truncate font-pixel">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── 表示設定（プロのみ） ── */}
      {!simple && (
        <div className="border-t border-border/40 pt-3">
          <div className="text-[11px] font-bold text-[#fbbf24] font-pixel uppercase tracking-wider mb-2">表示設定</div>
          {[
            { label: "グリッド表示",         val: showGrid,      set: setShowGrid },
            { label: "ワイヤーフレーム", val: showWireframe, set: setShowWireframe },
          ].map(({ label, val, set }) => (
            <label key={label} className="flex items-center justify-between cursor-pointer mb-2 font-pixel text-xs text-foreground/75">
              <span>{label}</span>
              <input
                type="checkbox"
                checked={val}
                onChange={() => set(!val)}
                className="w-4 h-4 cursor-pointer"
              />
            </label>
          ))}
        </div>
      )}

      {/* ── 最下部の岩盤（スクロール終端の遊び心） ── */}
      <div className="mt-4 pt-4 border-t border-dashed border-[#1f1e1a] flex flex-col items-center justify-center opacity-40 select-none shrink-0 pb-2">
        <div className="w-8 h-8 bg-[#151411] border-2 border-[#1f1e1a] mc-bevel-inset flex items-center justify-center text-sm filter grayscale" style={{ borderRadius: "4px" }}>
          🧱
        </div>
        <span className="text-[9px] font-pixel mt-1.5 tracking-widest text-muted">
          --- BEDROCK (岩盤) ---
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   ツールサイドバー（立方体追加・削除）
   ═══════════════════════════════════════════ */
function ToolSidebar({
  paintMode, 
  setPaintMode, 
  mode = "blocks", 
  simple = true, 
  activeTool = "select", 
  setActiveTool
}: {
  paintMode: boolean; 
  setPaintMode: (v: boolean) => void; 
  mode?: "blocks" | "items";
  simple?: boolean;
  activeTool?: "select" | "add" | "paint" | "delete";
  setActiveTool: (t: "select" | "add" | "paint" | "delete") => void;
}) {
  const blocks        = useEditorStore((s) => s.blocks);
  const items         = useEditorStore((s) => s.items);
  const selectedBlockIds   = useEditorStore((s) => s.selectedBlockIds);
  const selectedItemIds   = useEditorStore((s) => s.selectedItemIds);
  const addBlock      = useEditorStore((s) => s.addBlock);
  const addItem      = useEditorStore((s) => s.addItem);
  const removeBlock   = useEditorStore((s) => s.removeBlock);
  const removeItem   = useEditorStore((s) => s.removeItem);
  const selectBlock   = useEditorStore((s) => s.selectBlock);
  const selectItem   = useEditorStore((s) => s.selectItem);
  const duplicateBlock = useEditorStore((s) => s.duplicateBlock);
  const duplicateItem = useEditorStore((s) => s.duplicateItem);

  // Mode-based data
  const workingBlocks = mode === "items" ? items : blocks;
  const selectedIds = mode === "items" ? selectedItemIds : selectedBlockIds;
  const addFn = mode === "items" ? addItem : addBlock;
  const removeFn = mode === "items" ? removeItem : removeBlock;
  const selectFn = mode === "items" ? selectItem : selectBlock;
  const duplicateFn = mode === "items" ? duplicateItem : duplicateBlock;

  const handleAdd = useCallback(() => {
    const id = mode === "items" ? `item-${Date.now()}` : `block-${Date.now()}`;
    const x = (workingBlocks.length % 5) - 2;
    const z = Math.floor(workingBlocks.length / 5) - 2;
    const defaultScale: [number, number, number] = mode === "items" ? [0.5, 0.5, 0.5] : [1, 1, 1];
    const defaultColors = mode === "items"
      ? { top: "#fbbf24", bottom: "#f59e0b", side: "#fcd34d" }
      : { top: "#4ade80", bottom: "#16a34a", side: "#22c55e" };
    const name = mode === "items" ? `item_${workingBlocks.length + 1}` : `cube_${workingBlocks.length + 1}`;
    addFn({
      id, name,
      position: [x, defaultScale[1] / 2, z],
      scale: defaultScale,
      rotation: [0, 0, 0],
      faces: {
        top:    { color: defaultColors.top },
        bottom: { color: defaultColors.bottom },
        front:  { color: defaultColors.side },
        back:   { color: defaultColors.side },
        left:   { color: defaultColors.bottom },
        right:  { color: defaultColors.bottom },
      },
    });
    selectFn(id);
  }, [workingBlocks, addFn, selectFn]);

  const handleDuplicate = useCallback(() => {
    selectedIds.forEach((id) => duplicateFn(id));
  }, [selectedIds, duplicateFn]);

  // かんたんモード用のツールセット（４大おもちゃツール）
  const simpleTools = [
    {
      icon: "👆",
      tip: "えらぶ (選択)",
      action: () => { setActiveTool("select"); setPaintMode(false); },
      active: activeTool === "select"
    },
    {
      icon: "🧱",
      tip: "おく (クリックで隣に置く)",
      action: () => { setActiveTool("add"); setPaintMode(false); },
      active: activeTool === "add"
    },
    {
      icon: "🎨",
      tip: "ぬる (クリックでぬる)",
      action: () => { setActiveTool("paint"); setPaintMode(true); },
      active: activeTool === "paint"
    },
    {
      icon: "💥",
      tip: "こわす (クリックで壊す)",
      action: () => { setActiveTool("delete"); setPaintMode(false); },
      active: activeTool === "delete"
    }
  ];

  // プロモード用のツールセット
  const proTools = [
    { 
      icon: "⊞", 
      tip: "選択モード", 
      action: paintMode ? () => { setPaintMode(false); setActiveTool("select"); } : undefined, 
      active: !paintMode 
    },
    { 
      icon: "✎", 
      tip: paintMode ? "ペイント中（Esc で終了）" : "ペイントモード", 
      action: () => { setPaintMode(!paintMode); setActiveTool(!paintMode ? "paint" : "select"); }, 
      active: paintMode 
    },
    { icon: "＋", tip: "立方体を追加", action: handleAdd, active: false },
    { icon: "⧉", tip: "複製 (Ctrl+D)", action: selectedIds.length > 0 ? handleDuplicate : undefined, active: false },
    { icon: "🗑", tip: "選択を削除", action: selectedIds.length > 0 ? () => selectedIds.forEach((id) => removeFn(id)) : undefined, active: false },
  ];

  const tools = simple ? simpleTools : proTools;

  return (
    <div className="w-14 border-r-3 border-[#1f1e1a] bg-panel flex flex-col items-center py-4 gap-3 z-10" style={{ boxShadow: "inset -2px 0 0 rgba(0,0,0,0.15)" }}>
      {tools.map((t, i) => {
        const isInteractive = t.action !== undefined;
        const btnClass = t.active
          ? "mc-bevel-inset bg-[#151411] border-2 border-[#1f1e1a] text-accent ring-2 ring-[#fb7185]/50 cursor-pointer"
          : isInteractive
            ? "mc-btn mc-btn--sm"
            : "mc-btn mc-btn--sm disabled opacity-30 cursor-default";

        return (
          <button 
            key={i} 
            title={t.tip} 
            onClick={t.action}
            disabled={!isInteractive}
            className={`flex items-center justify-center font-pixel ${btnClass}`}
            style={{ 
              width: 36, 
              height: 36, 
              fontSize: 14, 
              borderRadius: t.active ? 6 : undefined,
              boxShadow: t.active 
                ? "inset 2px 2px 2px rgba(0,0,0,0.4), 0 0 8px rgba(251,113,133,0.3)" 
                : undefined,
              transform: t.active ? "translateY(1px)" : undefined
            }}
          >
            {t.icon}
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════
   ModelPanel
   ═══════════════════════════════════════════ */
export default function ModelPanel() {
  const [paintMode, setPaintMode] = useState(false);
  const [mode, setMode] = useState<"blocks" | "items">("blocks");
  const [showHelp, setShowHelp] = useState(false);
  const [simple, setSimple] = useState(true); // かんたん(true) / プロ(false)

  const blocks        = useEditorStore((s) => s.blocks);
  const items         = useEditorStore((s) => s.items);
  const addBlock      = useEditorStore((s) => s.addBlock);
  const addItem       = useEditorStore((s) => s.addItem);
  const selectBlock   = useEditorStore((s) => s.selectBlock);
  const selectItem    = useEditorStore((s) => s.selectItem);

  const workingBlocks = mode === "items" ? items : blocks;

  useEffect(() => {
    const s = localStorage.getItem("mmc-model-mode");
    if (s === "simple" || s === "pro") setSimple(s === "simple");
  }, []);
  const [activeTool, setActiveTool] = useState<"select" | "add" | "paint" | "delete">("select");

  const switchSimple = (v: boolean) => {
    setSimple(v);
    localStorage.setItem("mmc-model-mode", v ? "simple" : "pro");
    setActiveTool("select");
    setPaintMode(false);
  };

  const handleAddNewFirst = useCallback(() => {
    const id = mode === "items" ? `item-${Date.now()}` : `block-${Date.now()}`;
    const sc: [number, number, number] = mode === "items" ? [0.5, 0.5, 0.5] : [1, 1, 1];
    const col = mode === "items"
      ? { top: "#fbbf24", bottom: "#f59e0b", side: "#fcd34d" }
      : { top: "#7dd3fc", bottom: "#0284c7", side: "#38bdf8" };
    
    const blockData = {
      id, name: mode === "items" ? "item_1" : "block_1",
      position: [0, sc[1] / 2, 0] as [number, number, number],
      scale: sc, rotation: [0, 0, 0] as [number, number, number],
      faces: {
        top: { color: col.top }, bottom: { color: col.bottom },
        front: { color: col.side }, back: { color: col.side },
        left: { color: col.bottom }, right: { color: col.bottom },
      },
    };

    if (mode === "items") {
      addItem(blockData);
      selectItem(id);
    } else {
      addBlock(blockData);
      selectBlock(id);
    }
  }, [mode, addBlock, addItem, selectBlock, selectItem]);

  // Escキーでヘルプモーダルを閉じる処理
  useEffect(() => {
    if (!showHelp) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowHelp(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showHelp]);

  return (
    <div className="flex h-full flex-col">
      {/* Mode toggle - インベントリのタブ風ヘッダー */}
      <div className="flex items-end px-4 pt-3 bg-panel border-b-3 border-[#1f1e1a] z-10 gap-1" style={{ minHeight: "48px" }}>
        <button
          onClick={() => setMode("blocks")}
          className="font-pixel text-xs px-4 py-2 border-3 border-[#1f1e1a] transition-all cursor-pointer relative"
          style={{
            borderBottom: mode === "blocks" ? "3px solid var(--surface)" : "3px solid #1f1e1a",
            background: mode === "blocks" ? "var(--surface)" : "#5a574e",
            color: mode === "blocks" ? "#fbbf24" : "var(--foreground)",
            borderRadius: "6px 6px 0 0",
            marginBottom: "-3px",
            zIndex: mode === "blocks" ? 12 : 10,
            transform: mode === "blocks" ? "translateY(0)" : "translateY(2px)",
            boxShadow: mode === "blocks"
              ? "inset 2px 2px 0 rgba(255,255,255,0.2)"
              : "inset 2px 2px 0 rgba(255,255,255,0.1), inset -2px 0 0 rgba(0,0,0,0.15)",
            textShadow: mode === "blocks" ? "1.5px 1.5px 0px rgba(0,0,0,0.6)" : "none",
          }}
        >
          ⊞ ブロック
        </button>
        <button
          onClick={() => setMode("items")}
          className="font-pixel text-xs px-4 py-2 border-3 border-[#1f1e1a] transition-all cursor-pointer relative"
          style={{
            borderBottom: mode === "items" ? "3px solid var(--surface)" : "3px solid #1f1e1a",
            background: mode === "items" ? "var(--surface)" : "#5a574e",
            color: mode === "items" ? "#fbbf24" : "var(--foreground)",
            borderRadius: "6px 6px 0 0",
            marginBottom: "-3px",
            zIndex: mode === "items" ? 12 : 10,
            transform: mode === "items" ? "translateY(0)" : "translateY(2px)",
            boxShadow: mode === "items"
              ? "inset 2px 2px 0 rgba(255,255,255,0.2)"
              : "inset 2px 2px 0 rgba(255,255,255,0.1), inset -2px 0 0 rgba(0,0,0,0.15)",
            textShadow: mode === "items" ? "1.5px 1.5px 0px rgba(0,0,0,0.6)" : "none",
          }}
        >
          ✨ アイテム
        </button>

        {/* かんたん / プロ 切替 - 立体スライドスイッチ風 */}
        <div className="ml-auto mb-1.5 inline-flex items-center bg-[#151411] border-2 border-[#1f1e1a] mc-bevel-inset p-0.5 text-xs font-bold" style={{ borderRadius: "6px" }}>
          <button onClick={() => switchSimple(true)}
            className={`px-3 py-1 font-pixel text-[11px] rounded transition-all cursor-pointer ${simple ? "bg-[#10b981] text-white shadow-[0_2px_0_#064e3b,inset_0_1px_0_rgba(255,255,255,0.3)]" : "text-muted hover:text-foreground/70"}`}
            style={{ textShadow: simple ? "1px 1px 0px #064e3b" : "none" }}>🟢 SPROUT</button>
          <button onClick={() => switchSimple(false)}
            className={`px-3 py-1 font-pixel text-[11px] rounded transition-all cursor-pointer ${!simple ? "bg-gradient-to-r from-cyan-500 to-violet-500 text-white shadow-[0_2px_0_#3b0764,inset_0_1px_0_rgba(255,255,255,0.3)]" : "text-muted hover:text-foreground/70"}`}
            style={{ textShadow: !simple ? "1px 1px 0px #3b0764" : "none" }}>⚡ GROVE</button>
        </div>
      </div>

      <div className="flex h-full flex-1">
        <ToolSidebar paintMode={paintMode} setPaintMode={setPaintMode} mode={mode} simple={simple} activeTool={activeTool} setActiveTool={setActiveTool} />
        <div className="flex-1 relative overflow-hidden bg-[#23211e]">
          <ThreeViewport paintMode={paintMode} setPaintMode={setPaintMode} mode={mode} simple={simple} activeTool={activeTool} />
          
          {/* 初回ブロックがないときのお助けチュートリアルダイアログ */}
          {workingBlocks.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20">
              <div className="bg-[#1f1e1a]/95 border-3 border-[#121210] p-4 text-center select-none max-w-xs shadow-2xl rounded-lg pointer-events-auto" style={{ boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)" }}>
                <p className="font-pixel text-[13px] text-[#fbbf24] mb-1.5" style={{ textShadow: "1.5px 1.5px 0 rgba(0,0,0,0.8)" }}>
                  🧱 何も置かれていません
                </p>
                <p className="font-pixel text-[10px] text-foreground/85 leading-relaxed mb-3">
                  「最初のパーツを追加する」ボタンを押すと、3D空間の中心にパーツが置かれます！
                </p>
                <button
                  onClick={handleAddNewFirst}
                  className="mc-btn mc-btn--primary mc-btn--sm w-full py-2 font-bold text-xs"
                >
                  最初のパーツを追加する
                </button>
              </div>
            </div>
          )}
          
          {/* ビューポート前面のインナービネットシャドウ（映画風・奥行き感） */}
          <div className="absolute inset-0 pointer-events-none z-10 shadow-[inset_0_0_80px_rgba(0,0,0,0.65)]" />

          {/* 四隅のHUDブラケット (L字型の角装飾) */}
          <div className="absolute top-4 left-4 w-4 h-4 border-t-3 border-l-3 border-[#fb7185]/55 pointer-events-none z-10" />
          <div className="absolute top-4 right-4 w-4 h-4 border-t-3 border-r-3 border-[#fb7185]/55 pointer-events-none z-10" />
          <div className="absolute bottom-4 left-4 w-4 h-4 border-b-3 border-l-3 border-[#fb7185]/55 pointer-events-none z-10" />
          <div className="absolute bottom-4 right-4 w-4 h-4 border-b-3 border-r-3 border-[#fb7185]/55 pointer-events-none z-10" />

          <div className="absolute top-3 left-3 px-3 py-1.5 border-2 border-[#1f1e1a] bg-panel text-[10px] text-foreground/85 font-pixel pointer-events-none shadow-lg z-20" style={{ borderRadius: "5px" }}>
            🧊 3Dプレビュー ・ {paintMode ? "🎨 ぬりモード" : "👆 えらぶモード"} (ドラッグでまわす)
          </div>

          {/* カメラの視点リセットボタン */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("mmc-reset-camera"))}
            className="absolute bottom-3 right-3 mc-btn mc-btn--sm z-20 flex items-center gap-1 font-pixel"
            style={{ padding: "6px 10px" }}
            title="カメラの向きを正面に戻す"
          >
            🏠 視点リセット
          </button>

          {/* 操作ガイドボタン */}
          <button
            onClick={() => setShowHelp(true)}
            className="absolute top-3 right-3 mc-btn mc-btn--sm z-20"
            style={{ padding: "6px 10px" }}
          >
            ❓ 操作ガイド
          </button>

          <div className={`absolute bottom-4 left-4 flex items-center gap-2 pointer-events-none ${simple ? "hidden" : ""}`}>
            <div className="w-8 h-8 flex items-center justify-center bg-[#151411] border-2 border-[#1f1e1a] mc-bevel-inset text-xs font-pixel text-[#fb7185] font-bold shadow-[0_0_8px_rgba(251,113,133,0.4)]" style={{ textShadow: "1px 1px 0px #5f131a", borderRadius: "4px" }}>
              X
            </div>
            <div className="w-8 h-8 flex items-center justify-center bg-[#151411] border-2 border-[#1f1e1a] mc-bevel-inset text-xs font-pixel text-[#10b981] font-bold shadow-[0_0_8px_rgba(16,185,129,0.4)]" style={{ textShadow: "1px 1px 0px #064e3b", borderRadius: "4px" }}>
              Y
            </div>
            <div className="w-8 h-8 flex items-center justify-center bg-[#151411] border-2 border-[#1f1e1a] mc-bevel-inset text-xs font-pixel text-[#3b82f6] font-bold shadow-[0_0_8px_rgba(59,130,246,0.4)]" style={{ textShadow: "1px 1px 0px #1e3a8a", borderRadius: "4px" }}>
              Z
            </div>
          </div>

          {/* マイクラ風ヘルプモーダル */}
          {showHelp && (
            <div className="absolute inset-0 bg-black/70 z-30 flex items-center justify-center p-6 animate-fade-in-up">
              <div className="w-full max-w-xl border-3 border-[#1f1e1a] bg-panel flex flex-col max-h-[85%] relative shadow-[0_12px_24px_rgba(0,0,0,0.6)]" style={{ borderRadius: "8px" }}>
                <div className="mc-panel__title flex justify-between items-center bg-[#1f1e1a] border-b-2 border-[#1f1e1a]">
                  <span className="font-pixel text-[11px] text-[#fbbf24] flex items-center gap-1.5" style={{ textShadow: "1px 1px 0px rgba(0,0,0,0.7)" }}>
                    ❓ 3Dモデルエディタ操作ガイド
                  </span>
                  <button
                    onClick={() => setShowHelp(false)}
                    className="mc-btn mc-btn--sm px-2 py-0.5"
                    style={{ minWidth: "24px", height: "24px", padding: 0 }}
                  >
                    ✕
                  </button>
                </div>
                
                <div className="overflow-y-auto p-4 space-y-4 text-xs font-sans text-foreground/90 scrollbar-thin bg-surface" style={{ borderBottom: "2px solid #1f1e1a" }}>
                  {/* カメラ操作 */}
                  <div className="space-y-1.5">
                    <div className="font-bold text-[#fbbf24] font-pixel border-b border-border/40 pb-1 flex items-center gap-1">
                      🖱️ 視点・カメラ操作
                    </div>
                    <ul className="list-disc pl-4 space-y-1 font-pixel text-[11px]">
                      <li><strong className="text-foreground">回転:</strong> 画面を左クリックしながらドラッグ</li>
                      <li><strong className="text-foreground">平行移動:</strong> 右クリックしながらドラッグ、または <kbd className="px-1.5 py-0.5 bg-[#8c8779] border-2 border-[#1f1e1a] mc-bevel text-white text-[9px] shadow-inner" style={{ borderRadius: "4px" }}>Ctrl</kbd> + 左ドラッグ</li>
                      <li><strong className="text-foreground">ズーム:</strong> マウスホイールのスクロール</li>
                    </ul>
                  </div>
 
                  {/* ツール操作 */}
                  <div className="space-y-1.5">
                    <div className="font-bold text-[#fbbf24] font-pixel border-b border-border/40 pb-1 flex items-center gap-1">
                      🧱 ブロックの組み立て
                    </div>
                    <ul className="list-disc pl-4 space-y-1 font-pixel text-[11px]">
                      <li><strong className="text-foreground">追加:</strong> 左側ツールの <span className="font-extrabold text-[#10b981]">＋</span> ボタンをクリックします。</li>
                      <li><strong className="text-foreground">複製:</strong> ブロックを選んで <kbd className="px-1.5 py-0.5 bg-[#8c8779] border-2 border-[#1f1e1a] mc-bevel text-white text-[9px] shadow-inner" style={{ borderRadius: "4px" }}>Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-[#8c8779] border-2 border-[#1f1e1a] mc-bevel text-white text-[9px] shadow-inner" style={{ borderRadius: "4px" }}>D</kbd>（または左ツールの <span className="text-[#f59e0b]">⧉</span> ボタン）</li>
                      <li><strong className="text-foreground">削除:</strong> 右パネル最下部の「このブロックを削除」ボタン（または左ツールの <span className="text-rose-500">🗑</span> ボタン）</li>
                      <li><strong className="text-foreground">複数選択:</strong> <kbd className="px-1.5 py-0.5 bg-[#8c8779] border-2 border-[#1f1e1a] mc-bevel text-white text-[9px] shadow-inner" style={{ borderRadius: "4px" }}>Ctrl</kbd> キーを押しながら複数のブロックをクリック</li>
                    </ul>
                  </div>
 
                  {/* ペイントモード */}
                  <div className="space-y-1.5">
                    <div className="font-bold text-[#fbbf24] font-pixel border-b border-border/40 pb-1 flex items-center gap-1">
                      🎨 色付けとペイント
                    </div>
                    <ul className="list-disc pl-4 space-y-1 font-pixel text-[11px]">
                      <li><strong className="text-foreground">直感ペイント:</strong> 左側ツールの <span className="text-rose-400">✎</span> ボタンでペイントモードへ切り替え。右パネルで色やテクスチャを選び、3Dモデルの面を直接クリックするとペイントできます。</li>
                      <li><strong className="text-foreground">モード解除:</strong> もう一度 <span className="text-rose-400">✎</span> ボタンを押すか、<kbd className="px-1.5 py-0.5 bg-[#8c8779] border-2 border-[#1f1e1a] mc-bevel text-white text-[9px] shadow-inner" style={{ borderRadius: "4px" }}>Esc</kbd> キーで選択モードに戻ります。</li>
                      <li><strong className="text-foreground">プリセット:</strong> 「草」や「石」のボタンで、マイクラ定番カラーをワンクリックで適用可能！</li>
                    </ul>
                  </div>
 
                  {/* グリッドスナップ */}
                  <div className="space-y-1.5">
                    <div className="font-bold text-[#fbbf24] font-pixel border-b border-border/40 pb-1 flex items-center gap-1">
                      📐 配置のコツ
                    </div>
                    <p className="pl-1 leading-relaxed font-pixel text-[11px]">
                      右パネルの「<strong className="text-foreground">グリッドスナップ有効</strong>」にチェックを入れると、パーツを <span className="text-[#fb7185] font-bold">0.5</span> や <span className="text-[#fb7185] font-bold">1.0</span> 単位でカチカチと規則正しく吸着配置できるようになり、モデル構築がとてもスムーズになります！
                    </p>
                  </div>
                </div>
 
                <div className="p-3 flex justify-end bg-[#1f1e1a] rounded-b-lg">
                  <button
                    onClick={() => setShowHelp(false)}
                    className="mc-btn mc-btn--primary mc-btn--sm"
                  >
                    閉じる (Esc)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        <PropertiesPanel mode={mode} simple={simple} />
      </div>
    </div>
  );
}
