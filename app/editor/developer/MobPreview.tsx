"use client";

/**
 * 取り込んだモデルを実際に見る画面。
 *
 * 数字（ボーン数・立方体数）だけだと、形が合っているか分からない。
 * マイクラに入れるまで気づけないのが一番つらいので、その場で確かめられるようにする。
 *
 * 表示は出力と同じ IR から作る（lib/devtab/toThree.ts）。
 * 見えているものと書き出されるものがズレないようにするため。
 */

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildPreviewGroup, fitDistance } from "../../../lib/devtab/toThree";
import type { MobIR } from "../../../lib/devtab/ir";
import { t } from "@/lib/i18n";
import { useEditorStore } from "@/app/editor/store";

export default function MobPreview({ ir }: { ir: MobIR }) {
    const locale = useEditorStore((s) => s.locale);
  const hostRef = useRef<HTMLDivElement>(null);
  const [spin, setSpin] = useState(true);
  // 自動回転の ON/OFF を毎回のフレームで読むための箱。
  // state を直接見ると、切り替えるたびにシーンを作り直すことになる
  const spinRef = useRef(spin);
  spinRef.current = spin;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x14131a);

    const { center, distance } = fitDistance(ir);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
    camera.position.set(distance * 0.6, center.y + distance * 0.35, distance * 0.8);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      // WebGL が使えない環境（古い端末・GPU無効）。落とさずに諦める
      host.textContent = t(locale, "editor_8ec8c3");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);

    // 真横から当てると片面が真っ黒になるので、環境光を厚めに入れる
    scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const dir = new THREE.DirectionalLight(0xffffff, 1.1);
    dir.position.set(1, 2, 1.5);
    scene.add(dir);

    const { group, dispose } = buildPreviewGroup(ir, () => renderer.render(scene, camera));
    scene.add(group);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(center);
    controls.enableDamping = true;
    controls.update();

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (spinRef.current) group.rotation.y += 0.01;
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      dispose();
      renderer.dispose();
      // WebGL のコンテキストには上限がある。取り込み直すたびに残すと
      // 数回で新しい表示が作れなくなる
      renderer.forceContextLoss();
      host.removeChild(renderer.domElement);
    };
  }, [ir]);

  return (
    <div className="relative">
      <div
        ref={hostRef}
        className="w-full rounded-lg overflow-hidden"
        style={{ height: 260, background: "#14131a", border: "1px solid rgba(255,255,255,0.1)" }}
      />
      <button
        onClick={() => setSpin(v => !v)}
        className="absolute top-2 right-2 text-[10px] px-2 py-1 rounded"
        style={{ background: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.8)" }}
      >
        {spin ? t(locale, "editor_b1adbd") : t(locale, "editor_5d020e")}
      </button>
      <p className="text-[10px] text-muted/50 mt-1">
        {t(locale, "editor_71588a")}</p>
    </div>
  );
}
