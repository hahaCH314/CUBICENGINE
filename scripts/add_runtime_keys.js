const fs = require('fs');
const dict = JSON.parse(fs.readFileSync('generated_dict.json', 'utf-8'));

const newKeys = {
  'editor_confirm_replace_template': { 
    ja: '今おいてあるカードは消えて、「{name}」に入れかわります。いい？', 
    en: 'Your current cards will be replaced with "{name}". Are you sure?' 
  },
  'editor_confirm_open_work': { 
    ja: 'いま作っているカードは消えます。{who}作品をひらく？', 
    en: 'Your current cards will be lost. Open {who}work?' 
  },
  'editor_installed_jar': { 
    ja: 'を mods に導入しました！Forge 1.20.1 で起動して確認してね。', 
    en: 'has been installed to mods! Launch with Forge 1.20.1 to verify.' 
  },
  'editor_writing_scripts': { 
    ja: 'scripts/main.js を書き出し ({count} blocks) …', 
    en: 'Writing scripts/main.js ({count} blocks) ...' 
  },
  'editor_link_note': { 
    ja: 'この作品はリンクの中（{len} 文字）に入っています。サーバーには何も送られません。', 
    en: 'This work is stored in the link ({len} characters). Nothing is sent to any server.' 
  },
  'editor_add_to_drops': {
    ja: 'を落とすものに足す',
    en: 'add to drops'
  },
};

let added = 0;
for (const [k, v] of Object.entries(newKeys)) {
  if (!dict[k]) { dict[k] = v; added++; }
}
fs.writeFileSync('generated_dict.json', JSON.stringify(dict, null, 2));
console.log('Added ' + added + ' keys');
