"use client";

/* ══════════════════════════════════════════════════════════
   カード図鑑 (DexClient) — app/editor/dex/DexClient.tsx
   
   CUBIC ENGINE の全カード(132種)を明るく美しいトランプ・TCG調の
   アルバム風に一覧できるクライアントコンポーネント。
   
   仕様:
     - localStorage のキー "mmc-dex-seen" (string[] JSON) を読み込み
     - 取得済カードは明るいTCGスタイルのカードで表示
     - 未取得カードはシルエット＆はてな表示で神秘的に
     - 検証用に「テスト用: 全開放／リセット」およびクリック開閉機能搭載
   ══════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import * as LucideIcons from "lucide-react";
import { TEMPLATES } from "../../../data/templates";
import { CAT } from "../../../data/categories";
import type { Category, Tmpl } from "../_types";
import { t } from "@/lib/i18n";
import { useEditorStore } from "@/app/editor/store";

/** アイコン描画ヘルパー */
function Icon({ name, size = 18, color = "#334155" }: { name: string; size?: number; color?: string }) {
  const C = (LucideIcons as unknown as Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>>)[name]
    ?? LucideIcons.HelpCircle;
  return <C size={size} color={color} strokeWidth={2.4} />;
}

const CATEGORY_ORDER: Category[] = [
  "trigger", "action", "ifelse", "value", "loop", "calc", "variable", "ui"
];

const LS_KEY = "mmc-dex-seen";

export default function DexClient() {
    const locale = useEditorStore((s) => s.locale);
  const [seen, setSeen] = useState<string[]>([]);
  const [filter, setFilter] = useState<"all" | "seen" | "unseen">("all");
  const [selectedCategory, setSelectedCategory] = useState<Category | "all">("all");
  const [loaded, setLoaded] = useState(false);

  // 初回ハイドレーション時の localStorage 読み取り
  useEffect(() => {
    try {
      const data = localStorage.getItem(LS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          setSeen(parsed);
        }
      } else {
        // 初期検証用: 楽しんでもらえるよう少しだけサンプルで開放しておく
        const sampleSeen = ["ev_join", "ev_break", "ac_msg", "ac_summon", "co_rain", "va_pos", "ct_rep", "ca_add"];
        setSeen(sampleSeen);
        localStorage.setItem(LS_KEY, JSON.stringify(sampleSeen));
      }
    } catch (e) {
      console.error("DexClient: mmc-dex-seen 読み込みエラー", e);
    } finally {
      setLoaded(true);
    }
  }, []);

  // localStorage への書き込みと更新
  const updateSeen = (nextSeen: string[]) => {
    setSeen(nextSeen);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(nextSeen));
    } catch (e) {
      console.error("DexClient: mmc-dex-seen 保存エラー", e);
    }
  };

  // 個別カードクリック時の反転切り替え（子どもや開発者がシルエットを確かめやすいように）
  const toggleCardSeen = (type: string) => {
    if (seen.includes(type)) {
      updateSeen(seen.filter(t => t !== type));
    } else {
      updateSeen([...seen, type]);
    }
  };

  // テスト用: 全開放と全リセット
  const unlockAll = () => updateSeen(TEMPLATES.map(t => t.type));
  const resetAll = () => updateSeen([]);

  const totalCards = TEMPLATES.length;
  const seenCount = seen.filter(t => TEMPLATES.some(tmpl => tmpl.type === t)).length;
  const progressRatio = Math.round((seenCount / totalCards) * 100);

  if (!loaded) {
    return <div style={{ padding: "40px", textAlign: "center", color: "#64748b", fontWeight: 700 }}>{t(locale, "editor_7e1756")}</div>;
  }

  return (
    <div style={{ fontFamily: '"Inter", "Hiragino Sans", "Meiryo", sans-serif' }}>
      {/* ─── アルバムトップのステータスボード ─── */}
      <div style={{
        background: "linear-gradient(135deg, #ffffff 0%, #fef9c3 100%)",
        borderRadius: 16,
        border: "2px solid #eab308",
        padding: "20px 24px",
        boxShadow: "0 4px 12px rgba(202, 138, 4, 0.15)",
        marginBottom: 24,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16
      }}>
        <div style={{ minWidth: 280, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 800, color: "#854d0e" }}>
            <Icon name="Award" size={20} color="#ca8a04" />
            <span>{t(locale, "editor_1e1117")}</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
            <span style={{ fontSize: 32, fontWeight: 900, color: "#451a03", letterSpacing: "0.02em" }}>
              {seenCount} / {totalCards}
            </span>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#a16207" }}>
              ({progressRatio}{t(locale, "editor_921ce4")}</span>
          </div>
          {/* プログレスバー */}
          <div style={{ height: 14, width: "100%", background: "#fef08a", borderRadius: 9999, overflow: "hidden", marginTop: 10, border: "1px solid #eab308" }}>
            <div style={{
              width: `${progressRatio}%`,
              height: "100%",
              background: "linear-gradient(90deg, #f59e0b 0%, #d97706 100%)",
              borderRadius: 9999,
              transition: "width 0.4s ease"
            }} />
          </div>
        </div>

        {/* テスト用コントロールパネル */}
        <div style={{
          background: "#fffbeb",
          border: "1px dashed #d97706",
          borderRadius: 12,
          padding: "12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 8
        }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#9a3412" }}>
            {t(locale, "editor_d4d3fa")}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={unlockAll}
              style={{
                cursor: "pointer", background: "#f59e0b", color: "#ffffff",
                border: "none", borderRadius: 8, padding: "7px 12px",
                fontSize: 12, fontWeight: 800, boxShadow: "0 2px 4px rgba(245, 158, 11, 0.3)",
                transition: "transform 0.1s"
              }}
            >
              {t(locale, "editor_e47923")}</button>
            <button
              onClick={resetAll}
              style={{
                cursor: "pointer", background: "#ffffff", color: "#64748b",
                border: "1px solid #cbd5e1", borderRadius: 8, padding: "7px 12px",
                fontSize: 12, fontWeight: 800
              }}
            >
              {t(locale, "editor_eae4bd")}</button>
          </div>
        </div>
      </div>

      {/* ─── フィルター・カテゴリ選択バー ─── */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 24, background: "#ffffff", padding: "14px 18px", borderRadius: 14, boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)", border: "1px solid #e2e8f0" }}>
        {/* カテゴリ切り替えタブ */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <button
            onClick={() => setSelectedCategory("all")}
            style={{
              cursor: "pointer", padding: "6px 14px", borderRadius: 9999,
              fontSize: 13, fontWeight: 800,
              background: selectedCategory === "all" ? "#0f172a" : "#f1f5f9",
              color: selectedCategory === "all" ? "#ffffff" : "#475569",
              border: "none"
            }}
          >
            {t(locale, "editor_623363")}</button>
          {CATEGORY_ORDER.map(cat => {
            const def = CAT[cat];
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  cursor: "pointer", padding: "6px 12px", borderRadius: 9999,
                  fontSize: 12.5, fontWeight: 800, display: "flex", alignItems: "center", gap: 5,
                  background: active ? def.bg : "#f8fafc",
                  color: active ? (cat === "variable" ? "#ffffff" : def.text) : "#64748b",
                  border: `2px solid ${active ? def.side : "#e2e8f0"}`,
                  boxShadow: active ? "0 2px 5px rgba(0,0,0,0.1)" : "none"
                }}
              >
                <Icon name={def.icon} size={14} color={active ? (cat === "variable" ? "#ffffff" : def.text) : "#64748b"} />
                <span>{def.label}</span>
              </button>
            );
          })}
        </div>

        {/* 取得状況フィルタ */}
        <div style={{ display: "flex", gap: 4, background: "#f1f5f9", padding: 4, borderRadius: 10 }}>
          {([
            { key: "all", label: t(locale, "editor_dbe747") },
            { key: "seen", label: t(locale, "editor_91b2de") },
            { key: "unseen", label: t(locale, "editor_512810") }
          ] as const).map(item => (
            <button
              key={item.key}
              onClick={() => setFilter(item.key)}
              style={{
                cursor: "pointer", border: "none", borderRadius: 8, padding: "5px 12px",
                fontSize: 12, fontWeight: 800,
                background: filter === item.key ? "#ffffff" : "transparent",
                color: filter === item.key ? "#0f172a" : "#64748b",
                boxShadow: filter === item.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none"
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── 図鑑カードグリッド（カテゴリ別展示） ─── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
        {CATEGORY_ORDER.filter(cat => selectedCategory === "all" || selectedCategory === cat).map(cat => {
          const catDef = CAT[cat];
          const catTemplates = TEMPLATES.filter(t => t.category === cat).filter(t => {
            const isSeen = seen.includes(t.type);
            if (filter === "seen") return isSeen;
            if (filter === "unseen") return !isSeen;
            return true;
          });

          if (catTemplates.length === 0) return null;

          const seenInCat = TEMPLATES.filter(t => t.category === cat && seen.includes(t.type)).length;
          const totalInCat = TEMPLATES.filter(t => t.category === cat).length;

          return (
            <section key={cat} style={{ background: "#ffffff", borderRadius: 20, padding: "24px 28px", border: "2px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
              {/* カテゴリのタイトルバー */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `3px solid ${catDef.side}`, paddingBottom: 12, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: catDef.bg, border: `2px solid ${catDef.side}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon name={catDef.icon} size={20} color={cat === "variable" ? "#ffffff" : catDef.text} />
                  </div>
                  <h2 style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", margin: 0 }}>
                    {catDef.label} <span style={{ fontSize: 14, color: "#64748b", fontWeight: 700 }}>({cat})</span>
                  </h2>
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#475569", background: "#f1f5f9", padding: "4px 12px", borderRadius: 9999 }}>
                  {t(locale, "editor_cc8015")}{seenInCat} / {totalInCat}
                </div>
              </div>

              {/* カードグリッド */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: 20
              }}>
                {catTemplates.map(tmpl => {
                  const isSeen = seen.includes(tmpl.type);
                  return (
                    <CardItem
                      key={tmpl.type}
                      tmpl={tmpl}
                      isSeen={isSeen}
                      catDef={catDef}
                      onClick={() => toggleCardSeen(tmpl.type)}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** 個々のTCG調の図鑑カードコンポーネント */
function CardItem({ tmpl, isSeen, catDef, onClick }: {
  tmpl: Tmpl;
  isSeen: boolean;
  catDef: (typeof CAT)[Category];
  onClick: () => void;
}) {
    const locale = useEditorStore((s) => s.locale);
  const isDarkText = tmpl.category !== "variable";

  if (!isSeen) {
    // ─── 未獲得のシルエットカード ───
    return (
      <div
        onClick={onClick}
        title={t(locale, "editor_5dc525")}
        style={{
          cursor: "pointer",
          borderRadius: 16,
          border: "3px dashed #cbd5e1",
          background: "linear-gradient(145deg, #f1f5f9 0%, #e2e8f0 100%)",
          padding: 16,
          height: 220,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.04)",
          transition: "transform 0.15s, border-color 0.15s",
          position: "relative",
          overflow: "hidden"
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = "#94a3b8")}
        onMouseLeave={e => (e.currentTarget.style.borderColor = "#cbd5e1")}
      >
        {/* トップバー */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 0.6 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b", background: "#e2e8f0", padding: "3px 8px", borderRadius: 6 }}>
            {catDef.label}
          </span>
          <Icon name="Lock" size={16} color="#94a3b8" />
        </div>

        {/* 中央ミステリーアイコン */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, marginTop: "auto", marginBottom: "auto", opacity: 0.5 }}>
          <div style={{ width: 54, height: 54, borderRadius: "50%", background: "#cbd5e1", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.1)" }}>
            <Icon name="HelpCircle" size={30} color="#475569" />
          </div>
          <span style={{ fontSize: 16, fontWeight: 900, color: "#475569", letterSpacing: "0.05em" }}>
            ？？？？？？
          </span>
        </div>

        {/* 謎のフレーバーテキストボックス */}
        <div style={{ background: "#f8fafc", borderRadius: 10, padding: "8px 10px", textAlign: "center", border: "1px solid #e2e8f0", opacity: 0.7 }}>
          <span style={{ fontSize: 11.5, color: "#64748b", fontWeight: 700, fontStyle: "italic" }}>
            {t(locale, "editor_5f8ddd")}</span>
        </div>
      </div>
    );
  }

  // ─── 獲得済の華やかなTCGカード ───
  return (
    <div
      onClick={onClick}
      title={t(locale, "editor_d8ddf1")}
      style={{
        cursor: "pointer",
        borderRadius: 16,
        border: `3px solid ${catDef.side}`,
        background: "linear-gradient(150deg, #ffffff 0%, #fdfbf7 100%)",
        padding: 16,
        height: 220,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxShadow: "0 6px 12px -2px rgba(0, 0, 0, 0.08), 0 3px 6px -3px rgba(0, 0, 0, 0.04)",
        transition: "transform 0.15s, box-shadow 0.15s",
        position: "relative",
        overflow: "hidden"
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = "0 12px 20px -4px rgba(0, 0, 0, 0.15)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 6px 12px -2px rgba(0, 0, 0, 0.08)";
      }}
    >
      {/* ── カードヘッダー ── */}
      <div>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: catDef.bg,
          padding: "5px 10px",
          borderRadius: 8,
          borderBottom: `2px solid ${catDef.side}`,
          marginBottom: 10
        }}>
          <span style={{ fontSize: 11.5, fontWeight: 900, color: isDarkText ? catDef.text : "#ffffff", letterSpacing: "0.03em" }}>
            ★ {catDef.label}
          </span>
          <Icon name={tmpl.emoji} size={16} color={isDarkText ? catDef.text : "#ffffff"} />
        </div>

        {/* ── カード名とイラストボタン ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "2px 4px" }}>
          <div style={{
            width: 46,
            height: 46,
            borderRadius: 12,
            background: `radial-gradient(circle, ${catDef.top} 0%, ${catDef.bg} 100%)`,
            border: `2px solid ${catDef.side}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 5px rgba(0,0,0,0.08)",
            flexShrink: 0
          }}>
            <Icon name={tmpl.emoji} size={24} color={isDarkText ? catDef.text : "#ffffff"} />
          </div>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", margin: 0, lineHeight: 1.3 }}>
              {tmpl.label}
            </h3>
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700, display: "inline-block", marginTop: 2 }}>
              ID: {tmpl.type}
            </span>
          </div>
        </div>
      </div>

      {/* ── フレーバーテキスト（ポケカ風の魅力あふれる引用枠） ── */}
      <div>
        <div style={{
          background: "#fefce8",
          border: "1px solid #fef08a",
          borderLeft: `4px solid ${catDef.side}`,
          borderRadius: 8,
          padding: "8px 10px",
          marginTop: 8,
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.02)"
        }}>
          <p style={{ fontSize: 12, color: "#334155", fontWeight: 800, margin: 0, lineHeight: 1.4 }}>
            「{tmpl.sublabel}」
          </p>
        </div>

        {/* ── フィールドタグ提示 ── */}
        {tmpl.fields.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
            {tmpl.fields.map(f => (
              <span key={f.id} style={{ fontSize: 10, fontWeight: 800, color: "#475569", background: "#f1f5f9", padding: "2px 6px", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                🏷️ {f.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
