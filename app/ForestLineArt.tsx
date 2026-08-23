"use client";

import React from "react";

export default function ForestLineArt() {
  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden mix-blend-screen opacity-40">
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1440 800"
        preserveAspectRatio="xMidYMax slice"
        xmlns="http://www.w3.org/2000/svg"
        style={{ color: "#10b981" }} // エメラルドグリーン
      >
        <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          
          {/* 左側の大きな木 */}
          <g transform="translate(100, 850)">
            {/* 幹と主な枝 */}
            <path d="M0,0 C-20,-200 50,-400 150,-600 C200,-700 150,-750 250,-850" strokeWidth="2.5" />
            <path d="M30,-300 C150,-350 200,-450 350,-500" strokeWidth="1.8" />
            <path d="M120,-500 C250,-550 300,-650 450,-700" strokeWidth="1.5" />
            <path d="M-5,-150 C-100,-250 -150,-300 -250,-350" strokeWidth="1.8" />
            
            {/* 葉っぱや細かいツル */}
            <path d="M150,-600 C100,-620 80,-650 50,-600 C80,-580 100,-580 150,-600 Z" />
            <path d="M350,-500 C320,-520 300,-550 280,-500 C300,-480 320,-480 350,-500 Z" />
            <path d="M450,-700 C420,-720 400,-750 380,-700 C400,-680 420,-680 450,-700 Z" />
            <path d="M-250,-350 C-220,-370 -200,-400 -180,-350 C-200,-330 -220,-330 -250,-350 Z" />
          </g>

          {/* 右側のしなやかなツルと花 */}
          <g transform="translate(1300, 850)">
            {/* メインのツル */}
            <path d="M0,0 C-100,-200 50,-400 -100,-600 C-150,-700 -50,-800 -200,-900" strokeWidth="2" />
            <path d="M-50,-300 C-200,-350 -250,-450 -400,-500" strokeWidth="1.5" />
            <path d="M-80,-500 C-200,-550 -250,-650 -400,-700" strokeWidth="1.2" />

            {/* 花 1 */}
            <g transform="translate(-400, -500) scale(1.5)">
              <circle cx="0" cy="0" r="4" />
              <path d="M0,-4 C10,-20 -10,-20 0,-4 Z" />
              <path d="M4,-1 C20,10 15,-10 4,-1 Z" />
              <path d="M1,4 C10,20 -10,20 1,4 Z" />
              <path d="M-4,1 C-20,10 -15,-10 -4,1 Z" />
            </g>

            {/* 花 2 */}
            <g transform="translate(-400, -700) scale(1.2)">
              <circle cx="0" cy="0" r="4" />
              <path d="M0,-4 C10,-20 -10,-20 0,-4 Z" />
              <path d="M4,-1 C20,10 15,-10 4,-1 Z" />
              <path d="M1,4 C10,20 -10,20 1,4 Z" />
              <path d="M-4,1 C-20,10 -15,-10 -4,1 Z" />
            </g>

            {/* ツルの葉っぱ */}
            <path d="M-100,-600 C-70,-620 -50,-650 -20,-600 C-50,-580 -70,-580 -100,-600 Z" />
            <path d="M-200,-350 C-170,-370 -150,-400 -120,-350 C-150,-330 -170,-330 -200,-350 Z" />
          </g>

          {/* 中央下の小さな草花（シダ植物のようなもの） */}
          <g transform="translate(600, 850)">
            <path d="M0,0 C-50,-100 -20,-200 -80,-300" />
            <path d="M-20,-100 C-60,-120 -80,-150 -100,-120" />
            <path d="M-40,-180 C-80,-200 -100,-230 -120,-200" />

            <path d="M100,0 C150,-80 120,-180 180,-250" />
            <path d="M120,-80 C160,-100 180,-130 200,-100" />
          </g>
          
          <g transform="translate(850, 850)">
            <path d="M0,0 C20,-150 -20,-250 50,-350" />
            <path d="M10,-150 C50,-170 70,-200 90,-170" />
            
            {/* 蕾（つぼみ） */}
            <path d="M50,-350 C60,-370 40,-370 50,-350 Z" />
          </g>

          {/* キラキラとした装飾の線（星や光の粒） */}
          <path d="M300,200 L300,210 M295,205 L305,205" />
          <path d="M800,150 L800,160 M795,155 L805,155" />
          <path d="M1050,300 L1050,310 M1045,305 L1055,305" />
          <path d="M150,500 L150,510 M145,505 L155,505" />
          <path d="M500,600 L500,610 M495,605 L505,605" />
          <path d="M1200,600 L1200,610 M1195,605 L1205,605" />

        </g>
      </svg>
    </div>
  );
}
