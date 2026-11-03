// tools/export_puzzles.mjs — data.js의 유물·퍼즐·사진 출처를 교사용 표(마크다운)로 뽑는다. 라포라포에 붙여 넣는 표와 웹앱이 같은 원본을 쓰게 하려는 도구.
// 사용: node tools/export_puzzles.mjs > 산출.md
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(here, "..", "data.js"), "utf8") +
  "\nthis.ERAS=ERAS;this.LAYERS=LAYERS;this.ARTIFACTS=ARTIFACTS;this.ROOMS=ROOMS;this.VAULT=VAULT;this.TEAMS=TEAMS;this.QUIZ=QUIZ;", ctx);
vm.runInContext(fs.readFileSync(path.join(here, "..", "logic.js"), "utf8"), ctx);
const { ERAS, LAYERS, ARTIFACTS, ROOMS, VAULT, TEAMS, QUIZ, Logic } = ctx;

const MANIFEST = (() => { try { return JSON.parse(fs.readFileSync(path.join(here, "..", "img", "manifest.json"), "utf8")); } catch (e) { return []; } })();
const circled = ["①", "②", "③", "④", "⑤"], kor = ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ"];
const out = [];

out.push("## 팀 배정 — 발굴단 성향 테스트 (1차시 첫 2분) + 대시보드 «🏺 문화사 팀» 탭에서 팀 뽑기\n");
out.push("| 팀 | 도구 | 성향(학생 화면) |");
out.push("|---|---|---|");
for (const t of TEAMS) out.push(`| ${t.emoji} ${t.id} 발굴단 | ${t.tool} | ${t.type} — ${t.trait} |`);
out.push("");
out.push("문항 4개, 보기마다 팀이 하나씩 적혀 있다(학생 화면에는 팀 이름이 안 보이고 순서도 학생마다 다르다). 많이 고른 순서가 1~4지망(동점은 학번 시드로 섞음). 팀은 history26 교사 대시보드 «🏺 문화사 팀» 탭이 인원 차이 최대 1명으로 나누며 1지망을 최대한 살린다. 학생에게는 팀 이름이 아니라 성향(섬세형·끈기형·탐구형·이끄는형)만 보인다.\n");
QUIZ.forEach((q, i) => {
  out.push(`${i + 1}. ${q.q}`);
  q.options.forEach((o) => out.push(`   - ${o.text} → ${o.t}`));
});
out.push("");

out.push("## 유물 목록 (발굴 1차시)\n");
for (const l of LAYERS) {
  out.push(`### ${l.title}${l.flexOnly ? " (유연 모듈)" : ""} — ${l.sub} · 블록 ${l.blockName}\n`);
  out.push("| 유물 | 쪽수 | 발굴 단서 | 배경 질문 → 정답 | 노트 한 줄 |");
  out.push("|---|---|---|---|---|");
  Logic.artifactsOf(l.id, ARTIFACTS).forEach((a) => {
    if (a.intruder) {
      out.push(`| ${a.emoji} ${a.name} (흘러든 유물) | ${a.page} | ${a.clue} | 이 층의 시대일까? → 아니, **${ERAS[a.trueEra].name}** | ${a.note} |`);
    } else {
      out.push(`| ${a.emoji} ${a.name} | ${a.page} | ${a.clue} | ${a.bg.q} → **${a.bg.options[a.bg.answer]}** | ${a.note} |`);
    }
  });
  out.push("");
}
out.push("블록 자리는 학번마다 다르고(시드), 층마다 10칸 중 7칸에 유물·3칸은 «돌멩이뿐». 층에서 먼저 캔 2개는 2지선다, 그다음부터 4지선다.\n");

out.push("## 유물 사진 출처 (공공누리 제1유형만, 레포 img/)\n");
out.push("| 유물 | 사진 | 출처(소장·제공) | 라이선스 | 화면 비고 | 근거(manifest: 항목 페이지·확인한 문구·세부) |");
out.push("|---|---|---|---|---|---|");
for (const a of ARTIFACTS) {
  const mf = MANIFEST.find((x) => x.id === a.id) || {};
  if (a.photo && a.photo.src) out.push(`| ${a.name} | ${a.photo.src} | ${a.photo.credit} · ${a.photo.source} | ${a.photo.license} | ${a.photo.note || ""} | ${mf.url || ""} · «${mf.licenseSeen || ""}» · ${mf.note || ""} |`);
  else out.push(`| ${a.name} | (없음 → 도트 아이콘) | — | — | — | **확인 필요**: ${mf.reason || "공공누리 1유형 사진을 못 찾음"} |`);
}
out.push("");

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
out.push("### 🚪 수장고 문(금고)\n");
const B = Logic.roomsFor("basic", ROOMS), F = Logic.roomsFor("flex", ROOMS);
out.push("- 번호는 **팀마다 전시실 순서가 다르다**(다른 팀 번호를 받아 적어도 안 열리게). 개인용(?solo=1)은 1실부터.\n");
out.push("| 팀 | 공통(4실) 순서 → 번호 | 유연(5실) 순서 → 번호 |");
out.push("|---|---|---|");
TEAMS.forEach((tm, i) => {
  const ob = Logic.vaultOrder(i, B.length), of = Logic.vaultOrder(i, F.length);
  out.push(`| ${tm.emoji} ${tm.id} | ${ob.map((k) => k + 1 + "실").join("→")} → **${Logic.vaultCode(B, ob)}** | ${of.map((k) => k + 1 + "실").join("→")} → **${Logic.vaultCode(F, of)}** |`);
});
out.push(`| 개인용 | 1→2→3→4실 → **${Logic.vaultCode(B)}** | 1→…→5실 → **${Logic.vaultCode(F)}** |`);
out.push("");
out.push(`- 통합 문항(${VAULT.final.page}): ${VAULT.final.q} 정답 순서: ${VAULT.final.items.join(" → ")} / 유연: ${VAULT.final.flexItems.join(" → ")}`);
out.push(`- 힌트: ${VAULT.final.hint}`);
process.stdout.write(out.join("\n") + "\n");
