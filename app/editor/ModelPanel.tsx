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
function ThreeViewport({paintMode, setPaintMode, mode = "blocks"}: {paintMode: boolean; setPaintMode: (v: boolean) => void; mode?: "blocks" | "items"}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef  = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef     = useRef<THREE.Scene | null>(null);
  const cameraRef    = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef  = useRef<OrbitControls | null>(null);
  const meshMapRef   = useRef<Map<string, THREE.Mesh>>(new Map());
  const gridRef      = useRef<THREE.GridHelper | null>(null);
  const frameRef     = useRef<number>(0);
  const [ready, setReady] = useState(false);

  const blocks         = useEditorStore((s) => s.blocks);
  const items          = useEditorStore((s) => s.items);
  const showGrid       = useEditorStore((s) => s.showGrid);
  const showWireframe  = useEditorStore((s) => s.showWireframe);
  const selectedBlockIds = useEditorStore((s) => s.selectedBlockIds);
  const selectedItemIds = useEditorStore((s) => s.selectedItemIds);
  const selectBlock    = useEditorStore((s) => s.selectBlock);
  const selectItem    = useEditorStore((s) => s.selectItem);
  const updateBlock    = useEditorStore((s) => s.updateBlock);
  const updateItem    = useEditorStore((s) => s.updateItem);
  const [selectedFace, setSelectedFace] = useState<{blockId: string; faceIndex: number} | null>(null);

  // Use appropriate data and methods based on mode
  const workingData = mode === "items" ? items : blocks;
  const selectedIds = mode === "items" ? selectedItemIds : selectedBlockIds;
  const selectFn = mode === "items" ? selectItem : selectBlock;
  const updateFn = mode === "items" ? updateItem : updateBlock;

  /* ── Init ── */
  useEffect(() => {
    if (!containerRef.current || rendererRef.current) return;
    const el = containerRef.current;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
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

    // 3D Voxel Axes（立体感のあるボクセル風の軸）
    const axes = new THREE.Group();
    const createVoxelAxis = (dir: "x" | "y" | "z", color: number) => {
      const group = new THREE.Group();
      let rodGeo: THREE.BoxGeometry;
      let rodPos: [number, number, number];

      if (dir === "x") {
        rodGeo = new THREE.BoxGeometry(2, 0.04, 0.04);
        rodPos = [1, 0, 0];
      } else if (dir === "y") {
        rodGeo = new THREE.BoxGeometry(0.04, 2, 0.04);
        rodPos = [0, 1, 0];
      } else {
        rodGeo = new THREE.BoxGeometry(0.04, 0.04, 2);
        rodPos = [0, 0, 1];
      }

      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.25,
        roughness: 0.7,
        metalness: 0.1
      });

      const rod = new THREE.Mesh(rodGeo, mat);
      rod.position.set(...rodPos);
      rod.castShadow = true;
      rod.receiveShadow = true;
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
            if (paintMode && hit.face) {
              setSelectedFace({blockId: id, faceIndex: hit.face.materialIndex});
            } else {
              selectFn(id, e.ctrlKey || e.metaKey);
            }
            return;
          }
        }
      }
    }
    el.addEventListener("click", onClick);

    // display:none で初期化されると canvas が 0×0 になるため
    // animate ループ内でコンテナサイズを毎フレーム検出して自動修正する
    let _prevW = 0, _prevH = 0;
    function animate() {
      frameRef.current = requestAnimationFrame(animate);
      const w = el.clientWidth, h = el.clientHeight;
      if (w > 0 && h > 0 && (w !== _prevW || h !== _prevH)) {
        _prevW = w; _prevH = h;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
      controls.update();
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
    setReady(true);

    return () => {
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
  }, [selectFn]);

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
  }, [workingData, showWireframe, selectedIds, ready]);

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
function PropertiesPanel({ mode = "blocks" }: { mode?: "blocks" | "items" }) {
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

  // Mode-based data
  const workingBlocks = mode === "items" ? items : blocks;
  const selectedIds = mode === "items" ? selectedItemIds : selectedBlockIds;
  const updateFn = mode === "items" ? updateItem : updateBlock;
  const removeFn = mode === "items" ? removeItem : removeBlock;
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
  const Vec3Editor = ({ label, values, onChange, step = 0.1, colors = ["text-rose-300","text-emerald-300","text-blue-300"], snap = false }: {
    label: string;
    values: [number, number, number];
    onChange: (v: [number, number, number]) => void;
    step?: number;
    colors?: string[];
    snap?: boolean;
  }) => (
    <div>
      <label className="text-[11px] text-foreground/90 block mb-1">{label}</label>
      <div className="flex gap-1">
        {(["X","Y","Z"] as const).map((ax, i) => (
          <div key={ax} className="flex-1">
            <span className={`text-[10px] font-mono ${colors[i]}`}>{ax}</span>
            <input type="number" value={values[i]} step={step}
              onChange={(e) => {
                const next = [...values] as [number, number, number];
                let val = parseFloat(e.target.value) || 0;
                if (snap) val = snapValue(val);
                next[i] = val;
                onChange(next);
              }}
              className="w-full px-1.5 py-1 rounded-none bg-surface border border-border text-xs font-mono text-foreground/80 focus:outline-none focus:border-accent/50"
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
      className="w-80 border-l border-border bg-surface mc-panel p-3 pb-16 flex flex-col gap-4 overflow-y-auto text-sm z-10"
      style={{
        transform: `translateY(${bounceY}px)`,
        transition: bounceY === 0 ? "transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)" : "none"
      }}
    >

      {/* ── グループ管理 ── */}
      {selectedIds.length > 0 && (
        <div>
          <div className="text-[11px] font-bold text-[#fbbf24] font-pixel uppercase tracking-wider mb-2">グループ</div>
          <button
            onClick={() => {
              const name = prompt("グループ名を入力:");
              if (name) {
                const groupId = createGroup(name);
                assignToGroup(selectedIds, groupId);
              }
            }}
            className="mc-btn mc-btn--sm w-full mb-2"
          >
            新しいグループ作成
          </button>
          {sel?.groupId && (
            <div className="px-2 py-1.5 rounded-lg bg-surface/50 border border-border/50 text-[11px] text-foreground/70">
              グループ: <span className="text-accent font-semibold">{groups[sel.groupId]?.name || "？"}</span>
            </div>
          )}
        </div>
      )}

      {/* ── 選択中ブロック ── */}
      <div>
        <div className="text-[11px] font-bold text-[#fbbf24] font-pixel uppercase tracking-wider mb-2">プロパティ</div>
        {sel ? (
          <div className="space-y-3">
            {/* 名前 */}
            <div>
              <label className="text-[11px] text-foreground/90 block mb-1">名前</label>
              <input value={sel.name}
                onChange={(e) => updateFn(sel.id, { name: e.target.value })}
                className="w-full px-2 py-1.5 rounded-none bg-surface border border-border text-xs font-mono text-foreground/80 focus:outline-none focus:border-accent/50"
              />
            </div>

            {/* グリッドスナップ */}
            <div>
              <label className="text-[11px] text-foreground/90 block mb-1">グリッドスナップ</label>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-foreground/70">
                  <input type="checkbox" checked={gridSnapEnabled} onChange={(e) => setGridSnap(e.target.checked, gridSnapSize)} className="rounded-none cursor-pointer accent-accent" />
                  有効にする
                </label>
              </div>
              {gridSnapEnabled && (
                <select value={gridSnapSize} onChange={(e) => setGridSnap(true, parseFloat(e.target.value))}
                  className="w-full px-2 py-1 rounded-none bg-surface border border-border text-xs text-foreground/80 focus:outline-none focus:border-accent/50">
                  <option value={0.5}>0.5</option>
                  <option value={1}>1.0</option>
                  <option value={2}>2.0</option>
                  <option value={5}>5.0</option>
                </select>
              )}
            </div>

            {/* 位置 */}
            <Vec3Editor label="位置 (X / Y / Z)" values={sel.position}
              onChange={(v) => updateFn(sel.id, { position: v })} snap={gridSnapEnabled} />

            {/* スケール */}
            <Vec3Editor label="大きさ (X / Y / Z)" values={sel.scale ?? [1,1,1]}
              onChange={(v) => updateFn(sel.id, { scale: v })} step={0.1} />

            {/* 回転 */}
            <Vec3Editor label="回転 (度)" values={sel.rotation ?? [0,0,0]}
              onChange={(v) => updateFn(sel.id, { rotation: v })} step={5}
              colors={["text-orange-400","text-yellow-400","text-pink-400"]} />

            {/* 面カラー */}
            <div>
              <label className="text-[11px] text-foreground/90 block mb-1">面の色</label>
              <div className="grid grid-cols-3 gap-1">
                {(["top","bottom","front","back","left","right"] as const).map((face) => (
                  <div key={face} className="flex flex-col items-center gap-0.5">
                    <span className="text-[9px] text-foreground/70">{face}</span>
                    <input type="color" value={sel.faces[face].color}
                      onChange={(e) => updateFn(sel.id, {
                        faces: { ...sel.faces, [face]: { ...sel.faces[face], color: e.target.value } }
                      })}
                      className="w-full h-6 rounded-none cursor-pointer border border-border"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* テクスチャアップロード */}
            <div>
              <label className="text-[11px] text-foreground/90 block mb-2">テクスチャ（PNG）</label>
              <div className="grid grid-cols-3 gap-1">
                {(["top","bottom","front","back","left","right"] as const).map((face) => (
                  <div key={face} className="flex flex-col items-center gap-1">
                    <span className="text-[9px] text-foreground/70">{face}</span>
                    <label className="w-full cursor-pointer">
                      <div className="w-full h-6 rounded-none border border-border bg-surface/50 hover:bg-surface flex items-center justify-center text-[9px] text-foreground/50">
                        {sel.faces[face].texture ? "✓" : "📤"}
                      </div>
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
                        className="hidden"
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* 削除ボタン */}
            <button
              onClick={() => removeFn(sel.id)}
              className="mc-btn mc-btn--sm mc-btn--danger w-full"
            >
              🗑️ このブロックを削除
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted/50 italic">ブロックを選択してください</p>
        )}
      </div>

      {/* ── テクスチャプリセット ── */}
      <div>
        <div className="text-[11px] font-bold text-[#fbbf24] font-pixel uppercase tracking-wider mb-2">
          テクスチャプリセット
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((p) => (
            <button key={p.name} onClick={() => applyPreset(p)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-none bg-surface-active border border-border hover:brightness-105 active:translate-y-[1px] text-left"
            >
              <div className="w-5 h-5 rounded-none border border-white/10 shrink-0"
                style={{ background: `linear-gradient(135deg,${p.top},${p.side},${p.bottom})` }} />
              <span className="text-[11px] text-foreground/80 truncate font-pixel">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── 表示設定 ── */}
      <div>
        <div className="text-[11px] font-bold text-[#fbbf24] font-pixel uppercase tracking-wider mb-2">表示設定</div>
        {[
          { label: "グリッド",         val: showGrid,      set: setShowGrid },
          { label: "ワイヤーフレーム", val: showWireframe, set: setShowWireframe },
        ].map(({ label, val, set }) => (
          <label key={label} className="flex items-center justify-between cursor-pointer mb-2">
            <span className="text-xs text-foreground/70">{label}</span>
            <input
              type="checkbox"
              checked={val}
              onChange={() => set(!val)}
              className="w-4 h-4 rounded-none cursor-pointer accent-accent"
            />
          </label>
        ))}
      </div>

      {/* ── 最下部の岩盤（スクロール終端の遊び心） ── */}
      <div className="mt-4 pt-4 border-t border-dashed border-border/40 flex flex-col items-center justify-center opacity-35 select-none shrink-0 pb-4">
        <div className="w-8 h-8 bg-[#1e1d1a] mc-bevel-inset flex items-center justify-center text-sm filter grayscale">
          🧱
        </div>
        <span className="text-[9px] font-pixel mt-1.5 tracking-widest text-[#9c9890]">
          --- BEDROCK (岩盤) ---
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   ツールサイドバー（立方体追加・削除）
   ═══════════════════════════════════════════ */
function ToolSidebar({paintMode, setPaintMode, mode = "blocks"}: {paintMode: boolean; setPaintMode: (v: boolean) => void; mode?: "blocks" | "items"}) {
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

  const tools = [
    { icon: "⊞", tip: "選択", action: undefined },
    { icon: paintMode ? "✎✓" : "✎", tip: paintMode ? "ペイント中（Esc で終了）" : "ペイント", action: () => setPaintMode(!paintMode) },
    { icon: "＋", tip: "立方体を追加", action: handleAdd },
    { icon: "◷", tip: "複製 (Ctrl+D)", action: selectedIds.length > 0 ? handleDuplicate : undefined },
    { icon: "🗑", tip: "選択を削除", action: selectedIds.length > 0 ? () => selectedIds.forEach((id) => removeFn(id)) : undefined },
  ];

  return (
    <div className="w-12 border-r border-border bg-surface mc-panel flex flex-col items-center py-3 gap-2 z-10">
      {tools.map((t, i) => (
        <button key={i} title={t.tip} onClick={t.action}
          disabled={!t.action}
          className={`w-8 h-8 flex items-center justify-center text-base font-pixel
            ${t.action ? "mc-btn mc-btn--sm" : "mc-btn mc-btn--sm disabled opacity-40 cursor-default"}`}
          style={{ width: 34, height: 34 }}
        >
          {t.icon}
        </button>
      ))}
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
      {/* Mode toggle */}
      <div className="flex gap-2 px-3 py-2 bg-panel border-b-2 border-border z-10">
        <McButton
          size="sm"
          onClick={() => setMode("blocks")}
          active={mode === "blocks"}
          variant={mode === "blocks" ? "primary" : "default"}
        >
          ⊞ ブロック
        </McButton>
        <McButton
          size="sm"
          onClick={() => setMode("items")}
          active={mode === "items"}
          variant={mode === "items" ? "primary" : "default"}
        >
          ✨ アイテム
        </McButton>
      </div>

      <div className="flex h-full flex-1">
        <ToolSidebar paintMode={paintMode} setPaintMode={setPaintMode} mode={mode} />
        <div className="flex-1 relative">
          <ThreeViewport paintMode={paintMode} setPaintMode={setPaintMode} mode={mode} />
          <div className="absolute top-3 left-3 px-3 py-1.5 mc-panel bg-panel text-[10px] text-foreground/85 font-pixel pointer-events-none">
            [ Perspective View ] — {paintMode ? "PAINT MODE" : "SELECT MODE"}
          </div>

          {/* 操作ガイドボタン */}
          <button
            onClick={() => setShowHelp(true)}
            className="absolute top-3 right-3 mc-btn mc-btn--sm z-20"
            style={{ padding: "6px 10px" }}
          >
            ❓ 操作ガイド
          </button>

          <div className="absolute bottom-4 left-4 flex items-center gap-2 pointer-events-none">
            <div className="w-8 h-8 flex items-center justify-center bg-[#1e1d1a] mc-bevel-inset text-xs font-pixel text-rose-500 font-bold" style={{ textShadow: "1px 1px 0px #5f131a" }}>
              X
            </div>
            <div className="w-8 h-8 flex items-center justify-center bg-[#1e1d1a] mc-bevel-inset text-xs font-pixel text-emerald-500 font-bold" style={{ textShadow: "1px 1px 0px #064e3b" }}>
              Y
            </div>
            <div className="w-8 h-8 flex items-center justify-center bg-[#1e1d1a] mc-bevel-inset text-xs font-pixel text-blue-500 font-bold" style={{ textShadow: "1px 1px 0px #1e3a8a" }}>
              Z
            </div>
          </div>

          {/* マイクラ風ヘルプモーダル */}
          {showHelp && (
            <div className="absolute inset-0 bg-black/65 z-30 flex items-center justify-center p-6 animate-fade-in-up">
              <div className="w-full max-w-xl mc-panel bg-surface flex flex-col max-h-[85%] relative">
                <div className="mc-panel__title flex justify-between items-center bg-panel">
                  <span className="font-pixel text-[10px] text-[#fbbf24] flex items-center gap-1.5">
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
                
                <div className="mc-panel__body overflow-y-auto p-4 space-y-4 text-xs font-sans text-foreground/90 scrollbar-thin">
                  {/* カメラ操作 */}
                  <div className="space-y-1.5">
                    <div className="font-bold text-[#fbbf24] font-pixel border-b border-border/40 pb-1">
                      🖱️ 視点・カメラ操作
                    </div>
                    <ul className="list-disc pl-4 space-y-1">
                      <li><strong className="text-foreground">回転:</strong> 画面を左クリックしながらドラッグ</li>
                      <li><strong className="text-foreground">平行移動:</strong> 右クリックしながらドラッグ、または <kbd className="px-1 bg-surface border border-border text-[10px]">Ctrl</kbd> + 左ドラッグ</li>
                      <li><strong className="text-foreground">ズーム:</strong> マウスホイールのスクロール</li>
                    </ul>
                  </div>

                  {/* ツール操作 */}
                  <div className="space-y-1.5">
                    <div className="font-bold text-[#fbbf24] font-pixel border-b border-border/40 pb-1">
                      🧱 ブロックの組み立て
                    </div>
                    <ul className="list-disc pl-4 space-y-1">
                      <li><strong className="text-foreground">追加:</strong> 左側ツールの <span className="font-pixel font-extrabold text-[#10b981]">＋</span> ボタンをクリックします。</li>
                      <li><strong className="text-foreground">複製:</strong> ブロックを選んで <kbd className="px-1 bg-surface border border-border text-[10px]">Ctrl</kbd> + <kbd className="px-1 bg-surface border border-border text-[10px]">D</kbd>（または左ツールの <span className="font-pixel text-[#f59e0b]">◷</span> ボタン）</li>
                      <li><strong className="text-foreground">削除:</strong> 右パネル最下部の「このブロックを削除」ボタン（または左ツールの <span className="text-rose-500">🗑</span> ボタン）</li>
                      <li><strong className="text-foreground">複数選択:</strong> <kbd className="px-1 bg-surface border border-border text-[10px]">Ctrl</kbd> キーを押しながら複数のブロックをクリック</li>
                    </ul>
                  </div>

                  {/* ペイントモード */}
                  <div className="space-y-1.5">
                    <div className="font-bold text-[#fbbf24] font-pixel border-b border-border/40 pb-1">
                      🎨 色付けとペイント
                    </div>
                    <ul className="list-disc pl-4 space-y-1">
                      <li><strong className="text-foreground">直感ペイント:</strong> 左側ツールの <span className="text-rose-400">✎</span> ボタンでペイントモードへ切り替え。右パネルで色やテクスチャを選び、3Dモデルの面を直接クリックするとペイントできます。</li>
                      <li><strong className="text-foreground">モード解除:</strong> もう一度 <span className="text-rose-400">✎</span> ボタンを押すか、<kbd className="px-1 bg-surface border border-border text-[10px]">Esc</kbd> キーで選択モードに戻ります。</li>
                      <li><strong className="text-foreground">プリセット:</strong> 「草」や「石」のボタンで、マイクラ定番カラーをワンクリックで適用可能！</li>
                    </ul>
                  </div>

                  {/* グリッドスナップ */}
                  <div className="space-y-1.5">
                    <div className="font-bold text-[#fbbf24] font-pixel border-b border-border/40 pb-1">
                      📐 配置 of コツ
                    </div>
                    <p className="pl-1 leading-relaxed">
                      右パネルの「<strong className="text-foreground">グリッドスナップ有効</strong>」にチェックを入れると、パーツを <span className="text-accent font-semibold">0.5</span> や <span className="text-accent font-semibold">1.0</span> 単位でカチカチと規則正しく吸着配置できるようになり、モデル構築がとてもスムーズになります！
                    </p>
                  </div>
                </div>

                <div className="p-3 border-t border-border flex justify-end bg-panel">
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
        <PropertiesPanel mode={mode} />
      </div>
    </div>
  );
}
