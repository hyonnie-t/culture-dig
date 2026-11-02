// tools/export_puzzles.mjs — data.js의 유물·퍼즐을 교사용 표(마크다운)로 뽑는다. 라포라포에 붙여 넣는 표와 웹앱이 같은 원본을 쓰게 하려는 도구.
// 사용: node tools/export_puzzles.mjs > 산출.md
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(here, "..", "data.js"), "utf8") +
  "\nthis.ERAS=ERAS;this.LAYERS=LAYERS;this.ARTIFACTS=ARTIFACTS;this.ROOMS=ROOMS;this.VAULT=VAULT;", ctx);
vm.runInContext(fs.readFileSync(path.join(here, "..", "logic.js"), "utf8"), ctx);
const { ERAS, LAYERS, ARTIFACTS, ROOMS, VAULT, Logic } = ctx;

const circled = ["①", "②", "③", "④", "⑤"], kor = ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ"];
const out = [];

out.push("## 유물 목록 (발굴 1차시)\n");
for (const l of LAYERS) {
  out.push(`### ${l.title}${l.flexOnly ? " (유연 모듈)" : ""} — ${l.sub}\n`);
  out.push("| 순서 | 유물 | 쪽수 | 발굴 단서 | 배경 질문 → 정답 | 노트 한 줄 |");
  out.push("|---|---|---|---|---|---|");
  Logic.artifactsOf(l.id, ARTIFACTS).forEach((a, i) => {
    if (a.intruder) {
      out.push(`| ${i + 1} | ${a.emoji} ${a.name} (흘러든 유물) | ${a.page} | ${a.clue} | 이 층의 시대일까? → 아니, **${ERAS[a.trueEra].name}** | ${a.note} |`);
    } else {
      out.push(`| ${i + 1} | ${a.emoji} ${a.name} | ${a.page} | ${a.clue} | ${a.bg.q} → **${a.bg.options[a.bg.answer]}** | ${a.note} |`);
    }
  });
  out.push("");
}

out.push("## 방탈출 퍼즐 표 (2차시) — 라포라포·웹앱 공용\n");
out.push("퍼즐 = 문항 + 정답 + 힌트. 라포라포에 만들 때는 방마다 퍼즐 순서대로 넣고, 마지막 «열쇠» 퍼즐의 숫자가 그 방의 열쇠 숫자다.\n");
for (const r of ROOMS) {
  out.push(`### ${r.emoji} ${r.title}${r.flexOnly ? " (유연 모듈)" : ""} — ${r.sub}\n`);
  out.push("| 번호 | 유형 | 문항 | 정답 | 힌트 | 쪽수 |");
  out.push("|---|---|---|---|---|---|");
  for (const p of r.puzzles) {
    let q = p.q, ans = "";
    if (p.type === "match") {
      // 왼쪽은 ①②③④, 오른쪽은 섞어서 ㄱㄴㄷㄹ로 보여 주고 정답은 ①ㄷ 식으로
      const rnd = Logic.seeded(p.id);
      const rights = Logic.shuffle(p.pairs.map((x, i) => i), rnd);
      q += " " + p.pairs.map((x, i) => `${circled[i]} ${x[0]}`).join(" / ") + " ‖ " + rights.map((ri, k) => `${kor[k]} ${p.pairs[ri][1]}`).join(" / ");
      ans = p.pairs.map((x, i) => `${circled[i]}${kor[rights.indexOf(i)]}`).join(" ");
    } else if (p.type === "order") {
      const rnd = Logic.seeded(p.id);
      const shown = Logic.shuffle(p.items.map((x, i) => i), rnd);
      q += " " + shown.map((ii, k) => `${circled[k]} ${p.items[ii]}`).join(" / ");
      ans = p.items.map((x, i) => circled[shown.indexOf(i)]).join("→");
    } else if (p.type === "choice") {
      q += " " + p.options.map((o, i) => `${circled[i]} ${o}`).join(" / ");
      ans = `${circled[p.answer]} ${p.options[p.answer]}`;
    } else if (p.type === "key") {
      ans = String(p.answer);
    }
    const typeName = { match: "짝 맞추기", order: "순서 정렬", choice: "사료·4지선다", key: "열쇠 숫자" }[p.type];
    out.push(`| ${p.id} | ${typeName} | ${q} | ${ans} | ${p.hint} | ${p.page} |`);
  }
  out.push("");
}
out.push("### 🔐 금고\n");
out.push(`- 금고 번호: 공통(4실) **${Logic.vaultCode(Logic.roomsFor("basic", ROOMS))}** / 유연(5실) **${Logic.vaultCode(Logic.roomsFor("flex", ROOMS))}** (전시실 순서대로 열쇠 숫자를 이어 붙임)`);
out.push(`- 통합 문항(${VAULT.final.page}): ${VAULT.final.q} 정답 순서: ${VAULT.final.items.join(" → ")} / 유연: ${VAULT.final.flexItems.join(" → ")}`);
out.push(`- 힌트: ${VAULT.final.hint}`);
process.stdout.write(out.join("\n") + "\n");
