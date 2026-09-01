import * as fs from "fs";

const dictPath = "generated_dict.json";
const outDictPath = "generated_dict.json";
const dict = JSON.parse(fs.readFileSync(dictPath, "utf-8"));

async function translateText(text: string): Promise<string> {
  if (!text || text.trim() === "") return text;
  
  if (!/[ぁ-んァ-ヶｱ-ﾝﾞﾟ一-龠]/.test(text)) {
    return text;
  }

  let protectedText = text;
  const placeholders: string[] = [];
  protectedText = protectedText.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, p1) => {
    placeholders.push(match);
    return `__PH${placeholders.length - 1}__`;
  });

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=en&dt=t&q=${encodeURIComponent(protectedText)}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    let translated = "";
    if (data && data[0]) {
      data[0].forEach((item: any) => {
        if (item[0]) translated += item[0];
      });
    }

    translated = translated.replace(/__PH(\d+)__/g, (match, p1) => {
      return placeholders[parseInt(p1)];
    });
    translated = translated.replace(/\{\s+([a-zA-Z0-9_]+)\s+\}/g, "{$1}");

    translated = translated.replace(/Integrated Edition/gi, "Bedrock Edition");
    translated = translated.replace(/Bedrock version/gi, "Bedrock Edition");
    translated = translated.replace(/Integration Edition/gi, "Bedrock Edition");
    translated = translated.replace(/Java Edition/gi, "Java Edition");
    translated = translated.replace(/Java version/gi, "Java Edition");
    translated = translated.replace(/Addon|Add on|Add -on/gi, "Add-on");
    translated = translated.replace(/\bMod\b/gi, "Mod");
    translated = translated.replace(/\bMods\b/gi, "Mods");
    translated = translated.replace(/World \(World\)/gi, "World");
    translated = translated.replace(/CUBIC ENGINE/gi, "CUBIC ENGINE");

    return translated;
  } catch (e) {
    return text;
  }
}

async function main() {
  const keys = Object.keys(dict).filter(k => {
    const entry = dict[k];
    return !(entry.en && entry.en !== entry.ja && !/[ぁ-んァ-ヶｱ-ﾝﾞﾟ一-龠]/.test(entry.en)) && /[ぁ-んァ-ヶｱ-ﾝﾞﾟ一-龠]/.test(entry.ja);
  });

  let count = 0;
  const concurrency = 30; // 30並列

  for (let i = 0; i < keys.length; i += concurrency) {
    const chunk = keys.slice(i, i + concurrency);
    await Promise.all(chunk.map(async (key) => {
      const entry = dict[key];
      const translated = await translateText(entry.ja);
      entry.en = translated;
      count++;
    }));
    console.log(`Translated ${count}/${keys.length}`);
    fs.writeFileSync(outDictPath, JSON.stringify(dict, null, 2), "utf-8");
  }

  // 日本語を含まないキーはそのままコピー
  for (const key of Object.keys(dict)) {
    const entry = dict[key];
    if (!/[ぁ-んァ-ヶｱ-ﾝﾞﾟ一-龠]/.test(entry.ja) && !entry.en) {
      entry.en = entry.ja;
    }
  }

  fs.writeFileSync(outDictPath, JSON.stringify(dict, null, 2), "utf-8");
  console.log("Translation complete!");
}

main();
