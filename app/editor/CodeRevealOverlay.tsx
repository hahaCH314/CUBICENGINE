import React, { useState, useEffect, useRef } from "react";

interface CodeRevealOverlayProps {
  revealCode: string;
  onClose: () => void;
  theme?: "workshop" | "cyber";
  // 文言のトーン: kid=SPROUT(やさしい) / adult=GROVE(大人・プロ向け)
  tone?: "kid" | "adult";
}

export function CodeRevealOverlay({ revealCode, onClose, theme = "workshop", tone = "kid" }: CodeRevealOverlayProps) {
  const adult = tone === "adult";
  const lines = revealCode.split("\n");
  const [revShown, setRevShown] = useState(0);
  const [finished, setFinished] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);

  // ✍️「自分で書いてみる」写経モード（お手本を見ながら打つ練習。書き出しは常に正しい生成コードを使うので壊れない）
  const [mode, setMode] = useState<"reveal" | "practice">("reveal");
  const [typed, setTyped] = useState("");
  const norm = (s: string) => s.trim(); // インデントは大目に見る（子ども向け）
  const typedLines = typed.split("\n");
  const matched = lines.map((ml, i) => norm(typedLines[i] ?? "") === norm(ml));
  const totalCount = lines.filter((ml) => norm(ml) !== "").length;
  const doneCount = lines.filter((ml, i) => norm(ml) !== "" && matched[i]).length;
  const pct = totalCount === 0 ? 100 : Math.round((doneCount / totalCount) * 100);
  const allDone = totalCount > 0 && doneCount === totalCount;
  const nextLineIdx = lines.findIndex((ml, i) => norm(ml) !== "" && !matched[i]);

  // テーマ別配色
  const isWorkshop = theme === "workshop";
  const accentColor = isWorkshop ? "#ffab4d" : "#00ff66";
  const bgAccent = isWorkshop ? "rgba(255, 171, 77, 0.12)" : "rgba(0, 255, 102, 0.12)";
  const textColor = isWorkshop ? "#ffe2b0" : "#d0ffd6";
  const codeBorder = isWorkshop ? "rgba(255, 171, 77, 0.25)" : "rgba(0, 255, 102, 0.25)";
  const buttonBg = isWorkshop ? "linear-gradient(135deg, #f0b25a, #b8742a)" : "linear-gradient(135deg, #5fe0b8, #1b8a5a)";
  const buttonText = isWorkshop ? "#3a2405" : "#022c19";
  const buttonGlow = isWorkshop ? "rgba(240, 178, 90, 0.4)" : "rgba(95, 224, 184, 0.4)";

  // トーン別の文言（kid=SPROUT やさしい / adult=GROVE 大人・プロ向け）
  const T = {
    revealTitle: adult
      ? "⟨ SOURCE GENERATED ⟩　あなたのコード"
      : `✨ ${isWorkshop ? "あなたが書いたコードが生まれた" : "電脳に放つコードの具現化"}`,
    practiceTitle: adult
      ? "✍️ お手本を見ながら書き写す"
      : "✍️ おてほんを見ながら書いてみよう（まちがえてもOK）",
    modelLabel: adult ? "お手本（生成コード）" : "👀 おてほん",
    inputLabel: adult ? "ここに書き写す" : "✍️ ここに打ってみよう",
    placeholder: adult
      ? "お手本を見ながら、同じコードを書き写してください。"
      : "おてほんを見ながら、同じコードを打ってみよう。まちがえても大丈夫！",
    progressDone: adult ? "✓ 完全一致" : "🎉 かんぺき！",
    progressUnit: adult ? "% 一致" : "% 書けた",
    practiceRelease: adult ? "✓ 完了して閉じる" : "🚀 マイクラへ放つ",
    practiceLocked: adult ? "全行一致で完了" : "ぜんぶ書けたら放てる",
    back: adult ? "← 戻る" : "← もどる",
    inviteBtn: adult ? "✍️ 自分で書いて確かめる" : "✍️ コード書く練習してみる？",
    releaseBtn: adult ? "とじる" : "マイクラへ放つ",
  };

  // タイピング進行処理
  useEffect(() => {
    let i = 0;
    const speed = Math.max(15, Math.min(60, Math.floor(2000 / lines.length))); // コード量によって適切な流れるスピードに自動調整
    const intervalId = setInterval(() => {
      i++;
      setRevShown(i);
      if (i >= lines.length) {
        clearInterval(intervalId);
        setFinished(true);
      }
    }, speed);
    return () => clearInterval(intervalId);
  }, [revealCode]);

  // スクロール追従
  useEffect(() => {
    if (preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [revShown]);

  return (
    <div style={{
      position: "absolute",
      inset: 0,
      zIndex: 500,
      background: isWorkshop 
        ? "radial-gradient(120% 100% at 50% 25%, #1f140d 0%, #080503 100%)"
        : "radial-gradient(120% 100% at 50% 25%, #021a0c 0%, #000402 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      overflow: "hidden",
      userSelect: "none",
    }}>
      {/* CSS Keyframes */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes magic-rotate-clockwise {
          0% { transform: translate(-50%, -50%) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes magic-rotate-counter {
          0% { transform: translate(-50%, -50%) rotate(360deg); }
          100% { transform: translate(-50%, -50%) rotate(0deg); }
        }
        @keyframes reveal-sparkle {
          0% { transform: translate(0, 0) scale(0.3) rotate(0deg); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(1.1) rotate(var(--rot)); opacity: 0; }
        }
        @keyframes neon-glowing {
          0%, 100% { text-shadow: 0 0 10px ${accentColor}, 0 0 20px ${accentColor}; }
          50% { text-shadow: 0 0 16px ${accentColor}, 0 0 32px ${accentColor}, 0 0 4px #fff; }
        }
        @keyframes pop-bounce {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.15); opacity: 0.9; }
          80% { transform: scale(0.95); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes typing-cursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}} />

      {/* 背景の魔方陣サークル（奥行きのある魔法空間の演出） */}
      <div style={{
        position: "absolute",
        top: "40%",
        left: "50%",
        width: 620,
        height: 620,
        pointerEvents: "none",
        zIndex: 1,
        opacity: finished ? 0.22 : 0.12,
        transition: "opacity 1.5s ease",
      }}>
        {/* 外側サークル */}
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 200 200"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            animation: "magic-rotate-clockwise 32s linear infinite",
          }}
        >
          <circle cx="100" cy="100" r="95" fill="none" stroke={accentColor} strokeWidth="0.8" strokeDasharray="3 4 8 4" />
          <polygon points="100,5 182,150 18,150" fill="none" stroke={accentColor} strokeWidth="0.4" opacity="0.6" />
          <polygon points="100,195 18,50 182,50" fill="none" stroke={accentColor} strokeWidth="0.4" opacity="0.6" />
        </svg>

        {/* 内側サークル */}
        <svg
          width="75%"
          height="75%"
          viewBox="0 0 200 200"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            animation: "magic-rotate-counter 22s linear infinite",
          }}
        >
          <circle cx="100" cy="100" r="90" fill="none" stroke={accentColor} strokeWidth="0.6" strokeDasharray="15 5" />
          <circle cx="100" cy="100" r="70" fill="none" stroke={accentColor} strokeWidth="0.4" />
          <polygon points="100,20 180,100 100,180 20,100" fill="none" stroke={accentColor} strokeWidth="0.4" opacity="0.5" />
          <circle cx="100" cy="100" r="20" fill="none" stroke={accentColor} strokeWidth="0.8" strokeDasharray="4 2" />
        </svg>
      </div>

      {/* 1. タイトルヘッダー */}
      <div style={{
        fontSize: 14,
        fontWeight: 900,
        letterSpacing: "0.25em",
        color: accentColor,
        marginBottom: 16,
        animation: "neon-glowing 3s ease-in-out infinite alternate",
        zIndex: 10,
        textTransform: "uppercase",
        textAlign: "center",
      }}>
        {mode === "practice" ? T.practiceTitle : T.revealTitle}
      </div>

      {/* 2. コード表示（reveal=タイピング演出 / practice=お手本を見て自分で書く） */}
      {mode === "reveal" && (
        <pre
          ref={preRef}
          style={{
            fontFamily: "'DotGothic16', monospace",
            fontSize: 12.5,
            lineHeight: 1.75,
            color: textColor,
            background: "rgba(0, 0, 0, 0.75)",
            border: `1.8px solid ${codeBorder}`,
            borderRadius: 14,
            padding: "20px 24px",
            maxWidth: 750,
            width: "100%",
            overflowY: "auto",
            maxHeight: "56%",
            margin: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            boxShadow: `0 0 35px ${bgAccent}, inset 0 2px 8px rgba(0,0,0,0.8)`,
            zIndex: 10,
            position: "relative",
            scrollbarWidth: "thin",
            scrollbarColor: `${accentColor}22 rgba(0,0,0,0.3)`
          }}
        >
          {lines.slice(0, revShown).join("\n")}
          {revShown < lines.length && (
            <span style={{
              marginLeft: 2,
              color: accentColor,
              fontWeight: "bold",
              animation: "typing-cursor 0.7s infinite"
            }}>▋</span>
          )}
        </pre>
      )}

      {/* 写経モード：お手本を見ながら自分で打つ（打った文字は出力に使わない＝一致しても出るのは正しい生成コード） */}
      {mode === "practice" && (
        <div style={{ width: "100%", maxWidth: 880, zIndex: 10, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "stretch", flexWrap: "wrap" }}>
            {/* お手本（打てた行が✓＆光る／次に打つ行に▶） */}
            <div style={{ flex: "1 1 360px", minWidth: 0, display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 11, color: accentColor, marginBottom: 4, fontWeight: 700, letterSpacing: "0.05em" }}>{T.modelLabel}</div>
              <div style={{
                fontFamily: "'DotGothic16', monospace",
                fontSize: 12,
                lineHeight: 1.7,
                background: "rgba(0,0,0,0.75)",
                border: `1.8px solid ${codeBorder}`,
                borderRadius: 14,
                padding: "12px 10px",
                height: 300,
                overflowY: "auto",
                whiteSpace: "pre",
                boxShadow: "inset 0 2px 8px rgba(0,0,0,0.8)",
                scrollbarWidth: "thin",
              }}>
                {lines.map((ml, i) => {
                  const isNext = i === nextLineIdx;
                  const done = matched[i];
                  const empty = norm(ml) === "";
                  return (
                    <div key={i} style={{
                      color: done ? accentColor : (isNext ? "#ffffff" : textColor),
                      opacity: empty ? 0.3 : (done ? 1 : (isNext ? 1 : 0.6)),
                      background: isNext ? bgAccent : "transparent",
                      borderRadius: 4,
                      padding: "0 4px",
                    }}>
                      <span style={{ display: "inline-block", width: 14, opacity: 0.75 }}>{empty ? "" : (done ? "✓" : (isNext ? "▶" : "・"))}</span>
                      {ml || " "}
                    </div>
                  );
                })}
              </div>
            </div>
            {/* 入力欄 */}
            <div style={{ flex: "1 1 360px", minWidth: 0, display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 11, color: accentColor, marginBottom: 4, fontWeight: 700, letterSpacing: "0.05em" }}>{T.inputLabel}</div>
              <textarea
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                spellCheck={false}
                autoFocus
                placeholder={T.placeholder}
                style={{
                  height: 300,
                  resize: "none",
                  fontFamily: "'DotGothic16', monospace",
                  fontSize: 12,
                  lineHeight: 1.7,
                  color: "#ffffff",
                  background: "rgba(0,0,0,0.88)",
                  border: `1.8px solid ${allDone ? accentColor : codeBorder}`,
                  borderRadius: 14,
                  padding: "12px 14px",
                  outline: "none",
                  userSelect: "text",
                  whiteSpace: "pre",
                  overflow: "auto",
                  boxShadow: allDone ? `0 0 20px ${bgAccent}` : "inset 0 2px 8px rgba(0,0,0,0.8)",
                }}
              />
            </div>
          </div>

          {/* 進捗バー */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, height: 10, background: "rgba(255,255,255,0.1)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: buttonBg, transition: "width 0.3s ease", boxShadow: `0 0 8px ${accentColor}` }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 900, color: allDone ? accentColor : textColor, minWidth: 96, textAlign: "right" }}>
              {allDone ? T.progressDone : `${pct}${T.progressUnit}`}
            </span>
          </div>

          {/* ボタン（もどる／全部一致で放てる。出るのはカードで作った正しいコード） */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 2 }}>
            <button
              type="button"
              onClick={() => setMode("reveal")}
              style={{
                border: `1.5px solid ${codeBorder}`,
                cursor: "pointer",
                background: "transparent",
                color: textColor,
                fontWeight: 800,
                fontSize: 12.5,
                padding: "9px 20px",
                borderRadius: 12,
                letterSpacing: "0.1em",
              }}
            >
              {T.back}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={!allDone}
              style={{
                border: "none",
                cursor: allDone ? "pointer" : "default",
                background: buttonBg,
                color: buttonText,
                fontWeight: 900,
                fontSize: 13.5,
                padding: "9px 26px",
                borderRadius: 12,
                opacity: allDone ? 1 : 0.45,
                boxShadow: allDone ? `0 5px 20px ${buttonGlow}, inset 0 1px 0 rgba(255,255,255,0.4)` : "none",
                letterSpacing: "0.12em",
                transition: "opacity 0.2s",
              }}
            >
              {allDone ? T.practiceRelease : T.practiceLocked}
            </button>
          </div>
        </div>
      )}

      {/* 3. reveal完了時のお祝いPayoffとボタン */}
      {mode === "reveal" && finished && (
        <div style={{
          marginTop: 22,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          zIndex: 15,
          animation: "pop-bounce 0.65s cubic-bezier(0.2, 0.8, 0.2, 1.15) forwards"
        }}>
          {/* 金または緑のネオンメッセージ */}
          <div style={{
            fontSize: 18,
            fontWeight: 900,
            color: "#ffffff",
            textAlign: "center",
            textShadow: `0 0 12px ${accentColor}, 0 0 24px ${accentColor}`,
            letterSpacing: "0.05em",
          }}>
            {adult ? (
              <>🟢 これがあなたのコード。<span style={{ color: isWorkshop ? "#ffe9c4" : "#adffd0", textDecoration: "underline", textUnderlineOffset: "4px" }}>Minecraftで動きます</span>。</>
            ) : (
              <>🟢 マイクラで動く — これ、<span style={{ color: isWorkshop ? "#ffe9c4" : "#adffd0", textDecoration: "underline", textUnderlineOffset: "4px" }}>あなたが創った</span>。</>
            )}
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            {/* 軽いノリの誘い：カードで作ってもOK・もう一歩やりたい子だけ */}
            <button
              type="button"
              onClick={() => { setTyped(""); setMode("practice"); }}
              style={{
                border: `1.5px solid ${accentColor}`,
                cursor: "pointer",
                background: bgAccent,
                color: isWorkshop ? "#ffe9c4" : "#adffd0",
                fontWeight: 900,
                fontSize: 13,
                padding: "10px 22px",
                borderRadius: 12,
                letterSpacing: "0.08em",
                transition: "transform 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.05) translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}
            >
              {T.inviteBtn}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                border: "none",
                cursor: "pointer",
                background: buttonBg,
                color: buttonText,
                fontWeight: 900,
                fontSize: 13.5,
                padding: "10px 28px",
                borderRadius: 12,
                boxShadow: `0 5px 20px ${buttonGlow}, inset 0 1px 0 rgba(255,255,255,0.4)`,
                transition: "transform 0.15s, box-shadow 0.15s",
                letterSpacing: "0.15em",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "scale(1.05) translateY(-2px)";
                e.currentTarget.style.boxShadow = `0 8px 24px ${buttonGlow}, inset 0 1px 0 rgba(255,255,255,0.5)`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "none";
                e.currentTarget.style.boxShadow = `0 5px 20px ${buttonGlow}, inset 0 1px 0 rgba(255,255,255,0.4)`;
              }}
            >
              {T.releaseBtn}
            </button>
          </div>
        </div>
      )}

      {/* 4. スパークル粒子（お祝いパーティクル：reveal完了 or 写経コンプリート時） */}
      {((mode === "reveal" && finished) || (mode === "practice" && allDone)) && (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5 }}>
          {Array.from({ length: 42 }).map((_, i) => {
            const angle = (i / 42) * 360 + (i * 23) % 45;
            const distance = 80 + (i % 6) * 45;
            const size = 5 + (i % 4) * 3;
            const rotation = (i * 85) % 360;
            const duration = 0.8 + (i % 5) * 0.14;
            const colors = isWorkshop 
              ? ["#ffab4d", "#ffd9a0", "#ffffff", "#b8742a", "#f0b25a"]
              : ["#00ff66", "#d0ffd6", "#ffffff", "#1b8a5a", "#5fe0b8"];
            const col = colors[i % colors.length];
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: size,
                  height: size,
                  background: col,
                  borderRadius: i % 2 ? "50%" : "20% 80%", // 丸と菱形
                  // @ts-ignore
                  "--dx": `${Math.cos(angle * Math.PI / 180) * distance}px`,
                  // @ts-ignore
                  "--dy": `${Math.sin(angle * Math.PI / 180) * distance}px`,
                  // @ts-ignore
                  "--rot": `${rotation}deg`,
                  animation: `reveal-sparkle ${duration}s cubic-bezier(0.1, 0.7, 0.2, 1) forwards`,
                  boxShadow: `0 0 6px ${col}`,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
