import { CBlock } from '../app/editor/_types';

function escStr(s:string){return s.replace(/\\/g,"\\\\").replace(/"/g,'\\"').replace(/`/g,"\\`").replace(/\$/g,"\\$").replace(/\n/g,"\\n");}
function escId(s:string){return s.replace(/[^a-z0-9_.:/-]/gi,"");}
/** Minecraft ID を正規化：名前空間が無ければ minecraft: を付与。二重付与は防ぐ */
function nsId(s:string,fb="minecraft:air"):string{const v=escId(s)||fb;return v.includes(":")?v:"minecraft:"+v;}
function gf(b:CBlock,id:string,fb=""):string{return b.fields.find(f=>f.id===id)?.value??fb;}
/** 変数名を安全なJS識別子に変換（先頭が数字なら _ を付加） */
function sanitizeVarName(s:string):string{
  const clean=s.replace(/\s+/g,"_").replace(/[^a-zA-Z0-9_]/g,"");
  return(/^\d/.test(clean)?"_":"")+clean||"myVar";
}

// ★ ct_wait のある位置でチェーンを「分割」してrunTimeoutに包む
function genChain(id:string|null, blocks:CBlock[], indent:string):string{
  if(!id)return"";
  const b=blocks.find(b=>b.id===id);
  if(!b)return"";

  // wait ブロックは残りのチェーンを runTimeout の中に入れる
  if(b.type==="ct_wait"){
    const ticks=Math.round(parseFloat(gf(b,"s","1"))*20);
    const rest=genChain(b.nextId,blocks,indent+"  ");
    return`${indent}system.runTimeout(()=>{\n${rest||`${indent}  // まつ`}\n${indent}},${ticks});`;
  }

  return genBlock(b,blocks,indent)+"\n"+genChain(b.nextId,blocks,indent);
}

function genBlock(b:CBlock,blocks:CBlock[],indent:string):string{
  const f=(id:string,fb="")=>gf(b,id,fb);
  const I=indent;
  switch(b.type){
    // ★ await を全て除去 — subscribe コールバックは同期でなければならない
    case"ac_msg":
      // world.sendMessage は古いAPIバージョンで存在しないためループで代替
      return f("target","@a")==="@a"
        ? `${I}for (const _tp of world.getPlayers()) _tp.sendMessage("${escStr(f("msg","こんにちは"))}");`
        : `${I}player.sendMessage("${escStr(f("msg","こんにちは"))}");`;
    case"ac_give":   return`${I}player.runCommandAsync("give @s ${escId(f("item","minecraft:diamond"))} ${f("count","1")}");`;
    case"ac_tp":     return`${I}player.teleport({x:${f("x","0")},y:${f("y","64")},z:${f("z","0")}});`;
    case"ac_cmd":    return`${I}player.runCommandAsync("${escStr(f("cmd","say hi"))}");`;
    case"ac_sound":  return`${I}player.runCommandAsync("playsound ${escId(f("snd","random.orb"))} @s ~ ~ ~ ${f("vol","1")}");`;
    case"ac_title":  return[
      `${I}player.runCommandAsync(\`titleraw @s title {"rawtext":[{"text":"${escStr(f("title",""))}"}]}\`);`,
      `${I}player.runCommandAsync(\`titleraw @s subtitle {"rawtext":[{"text":"${escStr(f("sub",""))}"}]}\`);`,
    ].join("\n");
    case"ac_effect": return`${I}player.runCommandAsync("effect @s ${escId(f("eff","speed"))} ${f("dur","10")} 0");`;
    case"ac_score":{
      const ops:Record<string,string>={"加算":"add","減算":"remove","セット":"set","リセット":"set"};
      const cmd=ops[f("op","加算")]??"add";
      const val=f("op","加算")==="リセット"?"0":f("val","1");
      return`${I}player.runCommandAsync("scoreboard players ${cmd} @s ${escId(f("obj","points"))} ${val}");`;
    }
    case"ac_tag":
      return f("op","追加")==="追加"
        ? `${I}player.addTag("${escId(f("tag","vip"))}");`
        : `${I}player.removeTag("${escId(f("tag","vip"))}");`;
    case"ac_kick":
      return`${I}player.runCommandAsync(\`kick \${player.name} ${escStr(f("msg","ルール違反"))}\`);`;
    // 演算ブロックをアクションとして単体実行（ログ出力付き）
    case"ca_add":case"ca_sub":case"ca_mul":case"ca_div":case"ca_mod":case"ca_pow":
    case"ca_abs":case"ca_floor":case"ca_ceil":case"ca_round":case"ca_sqrt":
    case"ca_min":case"ca_max":case"ca_clamp":case"ca_sin":case"ca_cos":case"ca_pi":
    case"ca_gt":case"ca_lt":case"ca_gte":case"ca_lte":case"ca_eq":case"ca_neq":
    case"ca_concat":case"ca_strlen":case"ca_numstr":case"ca_strnum":
    case"ca_substr":case"ca_replace":case"ca_upper":case"ca_lower":case"ca_contains":
      return`${I}console.log("[CUBICENGINE演算]", ${genExpr(b.id,blocks)});`;
    // 制御
    case"ct_rep":{
      const body=genChain(b.thenId,blocks,I+"  ");
      return`${I}for (let _ri = 0; _ri < ${f("n","3")}; _ri++) {\n${body}\n${I}}`;
    }
    case"ct_log":{
      const _e=genExpr(b.innerId,blocks)||`"${escStr(f("v","ログ"))}"`;
      return`${I}console.log("[CUBICENGINEログ] " + ${_e});`;
    }
    // 変数
    case"vv_set":    return`${I}_v_${sanitizeVarName(f("name","score"))} = ${genExpr(b.innerId,blocks)||`Number(${f("val","0")})`};`;
    case"vv_add":    return`${I}_v_${sanitizeVarName(f("name","score"))} += ${genExpr(b.innerId,blocks)||`Number(${f("val","1")})`};`;
    case"vv_sub":    return`${I}_v_${sanitizeVarName(f("name","score"))} -= ${genExpr(b.innerId,blocks)||`Number(${f("val","1")})`};`;
    case"vv_mul":    return`${I}_v_${sanitizeVarName(f("name","score"))} *= ${genExpr(b.innerId,blocks)||`Number(${f("val","2")})`};`;
    case"vv_div":    return`${I}_v_${sanitizeVarName(f("name","score"))} /= ${genExpr(b.innerId,blocks)||`Number(${f("val","2")})`};`;
    case"vv_inc":    return`${I}_v_${sanitizeVarName(f("name","score"))}++;`;
    case"vv_dec":    return`${I}_v_${sanitizeVarName(f("name","score"))}--;`;
    case"vv_reset":  return`${I}_v_${sanitizeVarName(f("name","score"))} = 0;`;
    case"vv_msg":    return`${I}player.sendMessage("${escStr(f("prefix","スコア:"))}" + _v_${sanitizeVarName(f("name","score"))});`;
    case"vv_concat": return`${I}_v_${sanitizeVarName(f("name","score"))} += String(${genExpr(b.innerId,blocks)||`"${escStr(f("val",""))}"`});`;
    // UI作成
    case"ui_action":{
      const title=f("title","メニュー"), bodyText=f("body","選んでください");
      const b1=f("btn1","はい"), b2=f("btn2","いいえ"), b3=f("btn3","");
      const m1=f("msg1"), m2=f("msg2"), m3=f("msg3");
      return[
        `${I}const _form = new ActionFormData().title("${escStr(title)}").body("${escStr(bodyText)}");`,
        `${I}_form.button("${escStr(b1)}");`,
        `${I}_form.button("${escStr(b2)}");`,
        ...(b3?[`${I}_form.button("${escStr(b3)}");`]:[]),
        `${I}_form.show(player).then((res) => {`,
        `${I}  if (res.canceled) return;`,
        `${I}  if (res.selection === 0) { ${m1?`player.sendMessage("${escStr(m1)}");`:""} }`,
        `${I}  else if (res.selection === 1) { ${m2?`player.sendMessage("${escStr(m2)}");`:""} }`,
        ...(b3?[`${I}  else if (res.selection === 2) { ${m3?`player.sendMessage("${escStr(m3)}");`:""} }`]:[]),
        `${I}});`,
      ].join("\n");
    }
    case"ui_message":{
      const title=f("title","確認"), bodyText=f("body","よろしいですか？");
      const b1=f("btn1","はい"), b2=f("btn2","いいえ");
      const m1=f("msg1"), m2=f("msg2");
      return[
        `${I}const _form = new MessageFormData().title("${escStr(title)}").body("${escStr(bodyText)}").button1("${escStr(b1)}").button2("${escStr(b2)}");`,
        `${I}_form.show(player).then((res) => {`,
        `${I}  if (res.canceled) return;`,
        `${I}  if (res.selection === 1) { ${m1?`player.sendMessage("${escStr(m1)}");`:""} }`,
        `${I}  else if (res.selection === 0) { ${m2?`player.sendMessage("${escStr(m2)}");`:""} }`,
        `${I}});`,
      ].join("\n");
    }
    case"ui_textinput":{
      const title=f("title","入力フォーム"), l1=f("label1","名前"), h1=f("hint1",""), d1=f("default1","");
      const l2=f("label2",""), h2=f("hint2",""), d2=f("default2","");
      const result=f("result","入力:{0}");
      return[
        `${I}const _form = new ModalFormData().title("${escStr(title)}");`,
        `${I}_form.textField("${escStr(l1)}", "${escStr(h1)}", "${escStr(d1)}");`,
        ...(l2?[`${I}_form.textField("${escStr(l2)}", "${escStr(h2)}", "${escStr(d2)}");`]:[]),
        `${I}_form.show(player).then((res) => {`,
        `${I}  if (res.canceled || !res.formValues) return;`,
        `${I}  const _v0 = String(res.formValues[0]);`,
        `${I}  const _v1 = ${l2?"String(res.formValues[1])":'""'};`,
        `${I}  player.sendMessage(\`${escStr(result).replace(/\{0\}/g,"${_v0}").replace(/\{1\}/g,"${_v1}")}\`);`,
        `${I}});`,
      ].join("\n");
    }
    case"ui_toggle":{
      const title=f("title","設定"), label=f("label","トグル"), def=f("default","ON")==="ON";
      const mon=f("msgon"), moff=f("msgoff");
      return[
        `${I}const _form = new ModalFormData().title("${escStr(title)}").toggle("${escStr(label)}", ${def});`,
        `${I}_form.show(player).then((res) => {`,
        `${I}  if (res.canceled || !res.formValues) return;`,
        `${I}  if (res.formValues[0] === true) { ${mon?`player.sendMessage("${escStr(mon)}");`:""} }`,
        `${I}  else { ${moff?`player.sendMessage("${escStr(moff)}");`:""} }`,
        `${I}});`,
      ].join("\n");
    }
    case"ui_slider":{
      const title=f("title","数値入力"), label=f("label","値");
      const min=f("min","0"), max=f("max","100"), step=f("step","1"), def=f("default","50");
      const result=f("result","値:{0}");
      return[
        `${I}const _form = new ModalFormData().title("${escStr(title)}").slider("${escStr(label)}", ${min}, ${max}, ${step}, ${def});`,
        `${I}_form.show(player).then((res) => {`,
        `${I}  if (res.canceled || !res.formValues) return;`,
        `${I}  const _val = res.formValues[0];`,
        `${I}  player.sendMessage(\`${escStr(result).replace(/\{0\}/g,"${_val}")}\`);`,
        `${I}});`,
      ].join("\n");
    }
    case"ui_dropdown":{
      const title=f("title","選択"), label=f("label","項目");
      const items=f("items","A,B").split(",").map(s=>s.trim()).filter(Boolean);
      const defIdx=f("default","0");
      const result=f("result","選択:{0}");
      return[
        `${I}const _form = new ModalFormData().title("${escStr(title)}").dropdown("${escStr(label)}", [${items.map(s=>`"${escStr(s)}"`).join(",")}], ${defIdx});`,
        `${I}_form.show(player).then((res) => {`,
        `${I}  if (res.canceled || !res.formValues) return;`,
        `${I}  const _idx = Number(res.formValues[0]);`,
        `${I}  const _items = [${items.map(s=>`"${escStr(s)}"`).join(",")}];`,
        `${I}  const _val = _items[_idx];`,
        `${I}  player.sendMessage(\`${escStr(result).replace(/\{0\}/g,"${_val}")}\`);`,
        `${I}});`,
      ].join("\n");
    }
    case"ui_mixed":{
      const title=f("title","設定フォーム");
      const el1=f("el1","text"), lbl1=f("lbl1","名前"), val1=f("val1","");
      const el2=f("el2","toggle"), lbl2=f("lbl2","通知"), val2=f("val2","true");
      const el3=f("el3","slider"), lbl3=f("lbl3","音量"), val3=f("val3","50");
      const result=f("result","{0}/{1}/{2}");
      return[
        `${I}const _form = new ModalFormData().title("${escStr(title)}");`,
        el1==="text"?`${I}_form.textField("${escStr(lbl1)}", "", "${escStr(val1)}");`:el1==="toggle"?`${I}_form.toggle("${escStr(lbl1)}", ${val1==="true"});`:`${I}_form.slider("${escStr(lbl1)}", 0, 100, 1, ${val1});`,
        el2==="text"?`${I}_form.textField("${escStr(lbl2)}", "", "${escStr(val2)}");`:el2==="toggle"?`${I}_form.toggle("${escStr(lbl2)}", ${val2==="true"});`:`${I}_form.slider("${escStr(lbl2)}", 0, 100, 1, ${val2});`,
        el3==="text"?`${I}_form.textField("${escStr(lbl3)}", "", "${escStr(val3)}");`:el3==="toggle"?`${I}_form.toggle("${escStr(lbl3)}", ${val3==="true"});`:`${I}_form.slider("${escStr(lbl3)}", 0, 100, 1, ${val3});`,
        `${I}_form.show(player).then((res) => {`,
        `${I}  if (res.canceled || !res.formValues) return;`,
        `${I}  const _v0 = res.formValues[0];`,
        `${I}  const _v1 = res.formValues[1];`,
        `${I}  const _v2 = res.formValues[2];`,
        `${I}  player.sendMessage(\`${escStr(result).replace(/\{0\}/g,"${_v0}").replace(/\{1\}/g,"${_v1}").replace(/\{2\}/g,"${_v2}")}\`);`,
        `${I}});`,
      ].join("\n");
    }
    case"co_if":{
      const cond=genCond(b.innerId,blocks);
      const bodyThen=genChain(b.thenId,blocks,I+"  ");
      const bodyElse=genChain(b.elseId,blocks,I+"  ");
      return[
        `${I}if (${cond}) {`,
        bodyThen||`${I}  // 何もしない`,
        ...(bodyElse?[`${I}} else {`,bodyElse]:[]),
        `${I}}`,
      ].join("\n");
    }
    default: return"";
  }
}

function genExpr(id:string|null, blocks:CBlock[]):string{
  if(!id)return"";
  const b=blocks.find(b=>b.id===id);
  if(!b)return"";
  const f=(fid:string,fb="")=>gf(b,fid,fb);
  switch(b.type){
    case"va_name":  return"player.name";
    case"va_rand":  return`(Math.floor(Math.random()*(Number(${f("max","100")})-Number(${f("min","0")})+1))+Number(${f("min","0")}))`;
    case"va_str":   return`"${escStr(f("v",""))}"`;
    case"va_num":   return`Number(${f("v","0")})`;
    case"va_hp":    return`(player.getComponent("minecraft:health")?.currentValue??20)`;
    case"va_pos":   return`Math.round(player.location.${f("axis","Y").toLowerCase()})`;
    case"va_score": return`(()=>{try{return world.scoreboard.getObjective("${escId(f("obj","points"))}")?.getScore(player.scoreboardIdentity)??0;}catch(_e){return 0;}})()`;
    case"ca_add":   return`(${genExpr(b.fields[0]?.id,blocks)||f("a","0")}) + (${genExpr(b.fields[1]?.id,blocks)||f("b","0")})`;
    case"ca_sub":   return`(${genExpr(b.fields[0]?.id,blocks)||f("a","0")}) - (${genExpr(b.fields[1]?.id,blocks)||f("b","0")})`;
    case"ca_mul":   return`(${genExpr(b.fields[0]?.id,blocks)||f("a","1")}) * (${genExpr(b.fields[1]?.id,blocks)||f("b","1")})`;
    case"ca_div":   return`(${genExpr(b.fields[0]?.id,blocks)||f("a","0")}) / (${genExpr(b.fields[1]?.id,blocks)||f("b","1")})`;
    case"ca_mod":   return`(${genExpr(b.fields[0]?.id,blocks)||f("a","10")}) % (${genExpr(b.fields[1]?.id,blocks)||f("b","3")})`;
    case"ca_pow":   return`Math.pow(${genExpr(b.fields[0]?.id,blocks)||f("a","2")}, ${genExpr(b.fields[1]?.id,blocks)||f("b","8")})`;
    case"ca_abs":   return`Math.abs(${genExpr(b.fields[0]?.id,blocks)||f("a","-5")})`;
    case"ca_floor": return`Math.floor(${genExpr(b.fields[0]?.id,blocks)||f("a","3.7")})`;
    case"ca_ceil":  return`Math.ceil(${genExpr(b.fields[0]?.id,blocks)||f("a","3.2")})`;
    case"ca_round": return`Math.round(${genExpr(b.fields[0]?.id,blocks)||f("a","3.5")})`;
    case"ca_sqrt":  return`Math.sqrt(${genExpr(b.fields[0]?.id,blocks)||f("a","9")})`;
    case"ca_min":   return`Math.min(${genExpr(b.fields[0]?.id,blocks)||f("a","3")}, ${genExpr(b.fields[1]?.id,blocks)||f("b","7")})`;
    case"ca_max":   return`Math.max(${genExpr(b.fields[0]?.id,blocks)||f("a","3")}, ${genExpr(b.fields[1]?.id,blocks)||f("b","7")})`;
    case"ca_clamp": return`Math.min(Math.max(${genExpr(b.fields[0]?.id,blocks)||f("val","50")}, ${genExpr(b.fields[1]?.id,blocks)||f("min","0")}), ${genExpr(b.fields[2]?.id,blocks)||f("max","100")})`;
    case"ca_sin":   return`Math.sin(${genExpr(b.fields[0]?.id,blocks)||f("a","0")})`;
    case"ca_cos":   return`Math.cos(${genExpr(b.fields[0]?.id,blocks)||f("a","0")})`;
    case"ca_pi":    return`Math.PI`;
    case"ca_gt":    return`(${genExpr(b.fields[0]?.id,blocks)||f("a","5")} > ${genExpr(b.fields[1]?.id,blocks)||f("b","3")})`;
    case"ca_lt":    return`(${genExpr(b.fields[0]?.id,blocks)||f("a","3")} < ${genExpr(b.fields[1]?.id,blocks)||f("b","5")})`;
    case"ca_gte":   return`(${genExpr(b.fields[0]?.id,blocks)||f("a","5")} >= ${genExpr(b.fields[1]?.id,blocks)||f("b","5")})`;
    case"ca_lte":   return`(${genExpr(b.fields[0]?.id,blocks)||f("a","3")} <= ${genExpr(b.fields[1]?.id,blocks)||f("b","5")})`;
    case"ca_eq":    return`(${genExpr(b.fields[0]?.id,blocks)||f("a","1")} === ${genExpr(b.fields[1]?.id,blocks)||f("b","1")})`;
    case"ca_neq":   return`(${genExpr(b.fields[0]?.id,blocks)||f("a","1")} !== ${genExpr(b.fields[1]?.id,blocks)||f("b","2")})`;
    case"ca_concat":return`(${genExpr(b.fields[0]?.id,blocks)||`"${escStr(f("a",""))}"`}) + (${genExpr(b.fields[1]?.id,blocks)||`"${escStr(f("b",""))}"`})`;
    case"ca_strlen":return`String(${genExpr(b.fields[0]?.id,blocks)||`"${escStr(f("str",""))}"`}).length`;
    case"ca_numstr":return`String(${genExpr(b.fields[0]?.id,blocks)||f("num","42")})`;
    case"ca_strnum":return`Number(${genExpr(b.fields[0]?.id,blocks)||`"${escStr(f("str","0"))}"`})`;
    case"ca_substr":return`String(${genExpr(b.fields[0]?.id,blocks)||`"${escStr(f("str",""))}"`}).substring(${f("start","0")}, ${f("start","0")} + ${f("len","3")})`;
    case"ca_replace":return`String(${genExpr(b.fields[0]?.id,blocks)||`"${escStr(f("str",""))}"`}).replace("${escStr(f("from",""))}", "${escStr(f("to",""))}")`;
    case"ca_upper":  return`String(${genExpr(b.fields[0]?.id,blocks)||`"${escStr(f("str",""))}"`}).toUpperCase()`;
    case"ca_lower":  return`String(${genExpr(b.fields[0]?.id,blocks)||`"${escStr(f("str",""))}"`}).toLowerCase()`;
    case"ca_contains":return`String(${genExpr(b.fields[0]?.id,blocks)||`"${escStr(f("str",""))}"`}).includes("${escStr(f("search",""))}")`;
    case"ca_id_gem":   return`"${escId(f("id","diamond"))}"`;
    case"ca_id_block": return`"${escId(f("id","stone"))}"`;
    case"ca_id_tool":  return`"${escId(f("id","diamond_sword"))}"`;
    case"ca_id_armor": return`"${escId(f("id","diamond_chestplate"))}"`;
    case"ca_id_food":  return`"${escId(f("id","bread"))}"`;
    case"ca_id_misc":  return`"${escId(f("id","ender_pearl"))}"`;
    case"ca_id_mob":   return`"${escId(f("id","zombie"))}"`;
    case"ca_id_effect":return`"${escId(f("id","speed"))}"`;
    case"ca_rand_int":  return`(Math.floor(Math.random()*(Number(${f("max","6")})-Number(${f("min","1")})+1))+Number(${f("min","1")}))`;
    case"ca_rand_float":return`Math.random()`;
    case"ca_rand_bool": return`(Math.random()<0.5)`;
    case"ca_rand_range":return`(Math.random()*(Number(${f("max","1.0")})-Number(${f("min","0.0")}))+Number(${f("min","0.0")}))`;
    case"ca_rand_pct":  return`(Math.random()*100<Number(${f("pct","30")}))`;
    case"ca_rand_sign": return`(Math.random()<0.5?1:-1)`;
    case"ca_rand_gauss":{
      return`(()=>{const _u=1-Math.random(),_v=Math.random();const _n=Math.sqrt(-2*Math.log(_u))*Math.cos(2*Math.PI*_v);return Math.round(_n*Number(${f("sd","15")})+Number(${f("mean","50")}));})()`;
    }
    case"ca_rand_pick":{
      const items=f("items","A,B,C").split(",").map(s=>s.trim()).filter(Boolean);
      return`[${items.map(i=>`"${escStr(i)}"`).join(",")}][Math.floor(Math.random()*${items.length})]`;
    }
    case"ca_rand_shuffle":
      return`(()=>{const _a=Array.from({length:Number(${f("n","5")})},(_, i)=>i+1);for(let _i=_a.length-1;_i>0;_i--){const _j=Math.floor(Math.random()*(_i+1));[_a[_i],_a[_j]]=[_a[_j],_a[_i]];}return _a;})()`;
    case"ca_rand_seed":{
      const seed=f("seed","42");
      return`(()=>{let _s=${seed}|0;_s|=0;_s=_s+0x6D2B79F5|0;let _t=Math.imul(_s^(_s>>>15),1|_s);_t^=_t+Math.imul(_t^(_t>>>7),61|_t);const _r=((_t^(_t>>>14))>>>0)/4294967296;return Math.floor(_r*(Number(${f("max","100")})-Number(${f("min","0")})+1)+Number(${f("min","0")}));})()`;
    }
    case"vv_get":   return`_v_${sanitizeVarName(f("name","score"))}`;
    case"vv_eq":    return`(_v_${sanitizeVarName(f("name","score"))}===${f("val","0")})`;
    case"vv_gt":    return`(_v_${sanitizeVarName(f("name","score"))}>${f("val","0")})`;
    case"vv_lt":    return`(_v_${sanitizeVarName(f("name","score"))}<${f("val","100")})`;
    case"co_tag":     return`player.hasTag("${escId(f("tag",""))}")`;
    case"co_sneak":   return"player.isSneaking";
    case"co_hp":      return`((player.getComponent("minecraft:health")?.currentValue??20)<=Number(${f("threshold","10")}))`;
    case"co_night":   return"(world.getTimeOfDay()>=13000&&world.getTimeOfDay()<23000)";
    case"co_rain":    return`(world.getDimension("overworld").weather?.precipitation==="rain"||world.getDimension("overworld").weather?.precipitation==="thunder")`;
    case"co_item":    return`(()=>{const _c=player.getComponent("minecraft:inventory")?.container;if(!_c)return false;for(let _i=0;_i<_c.size;_i++)if(_c.getItem(_i)?.typeId==="${nsId(f("item","minecraft:diamond"))}")return true;return false;})()`;
    case"co_and":     return`((${genExpr(b.innerId,blocks)||"true"})&&(${genExpr(b.thenId,blocks)||"true"}))`;
    case"co_or":      return`((${genExpr(b.innerId,blocks)||"false"})||(${genExpr(b.thenId,blocks)||"false"}))`;
    case"co_not":     return`(!(${genExpr(b.innerId,blocks)||"false"}))`;
    default: return"0";
  }
}

function genCond(id:string|null, blocks:CBlock[]):string{
  if(!id)return"true";
  const expr=genExpr(id,blocks);
  return(expr==="0"||expr==="")?"true":expr;
}

function genTrigger(b:CBlock,blocks:CBlock[]):string{
  const f=(id:string,fb="")=>gf(b,id,fb);
  const body=genChain(b.nextId,blocks,"  ")||"  // なにもしない";
  switch(b.type){
    case"ev_join":
      return[
        `// 👋 プレイヤーが参加したとき`,
        `world.afterEvents.playerJoin.subscribe((event) => {`,
        `  const _joinName = event.playerName;`,
        `  system.runTimeout(() => {`,
        `    const player = world.getPlayers().find(p => p.name === _joinName);`,
        `    if (!player) return;`,
        body.split("\n").map((l:string)=>"    "+l).join("\n"),
        `  }, 40);`,
        `});`,
      ].join("\n");
    case"ev_break":
      return[
        `// ⛏️ ブロックをこわしたとき (${f("block","minecraft:stone")})`,
        `world.afterEvents.playerBreakBlock.subscribe((event) => {`,
        `  if (event.brokenBlockPermutation.type.id !== "${nsId(f("block","minecraft:stone"))}") return;`,
        `  const player = event.player;`,
        `  if (!player) return;`,
        body,
        `});`,
      ].join("\n");
    case"ev_item":
      return[
        `// 🔮 アイテムをつかったとき (${f("item","minecraft:diamond")})`,
        `world.afterEvents.itemUse.subscribe((event) => {`,
        `  if (event.itemStack.typeId !== "${nsId(f("item","minecraft:diamond"))}") return;`,
        `  const player = event.source;`,
        `  if (!player) return;`,
        body,
        `});`,
      ].join("\n");
    case"ev_tick":
      return[
        `// ⏰ 毎ティック`,
        `system.runInterval(() => {`,
        `  for (const player of world.getPlayers()) {`,
        body.split("\n").map((l:string)=>"    "+l).join("\n"),
        `  }`,
        `}, 1);`,
      ].join("\n");
    case"ev_chat":
      return[
        `// 💬 チャットしたとき ("${f("pat","!hi")}")`,
        `world.beforeEvents.chatSend.subscribe((event) => {`,
        `  if (event.message !== "${escStr(f("pat","!hi"))}") return;`,
        `  event.cancel = true;`,
        `  const player = event.sender;`,
        `  if (!player) return;`,
        body,
        `});`,
      ].join("\n");
    case"ev_hurt":
      return[
        `// 💥 ダメージをうけたとき`,
        `world.afterEvents.entityHurt.subscribe((event) => {`,
        `  if (event.hurtEntity?.typeId !== "minecraft:player") return;`,
        `  const player = event.hurtEntity;`,
        body,
        `});`,
      ].join("\n");
    case"ev_place":
      return[
        `// 🧱 ブロックをおいたとき`,
        `world.afterEvents.playerPlaceBlock.subscribe((event) => {`,
        `  const player = event.player;`,
        `  if (!player) return;`,
        body,
        `});`,
      ].join("\n");
    default:
      return `// ⚠️ 不明なきっかけ: ${b.type}`;
  }
}

export { escStr, escId, gf, sanitizeVarName, genChain, genBlock, genExpr, genCond, genTrigger };
