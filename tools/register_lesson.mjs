// tools/register_lesson.mjs — 포털 커리큘럼에 «문화사_발굴방탈출» 차시(활동 2개)를 비공개로 등록한다.
// 토큰은 history26_backend(비공개 레포)의 00_core.gs TEACHER_TOKENS에서 읽는다. 값은 출력·커밋하지 않는다.
// 사용: node tools/register_lesson.mjs [--dry]   (먼저 ?mode=curriculum으로 중복을 확인하고, 있으면 등록하지 않는다)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const URL_ = "https://script.google.com/macros/s/AKfycbyXSjCfWY_HiZFqW_OBR-FQDoIfF1z_STqyKWUI31MacHeY3u7hbirFSFDvW-5yuUHaJQ/exec";
const BASE = "https://hyonnie-t.github.io/culture-dig/";
const LESSON = {
  grade: "3", id: "문화사_발굴방탈출", title: "고려·조선 전기 문화 — 유물 발굴 → 박물관 방탈출",
  desc: "지층을 아래부터 파며 유물이 왜 그 시대에 나왔는지 알아내고, 모둠이 전시실 퍼즐을 풀어 박물관을 탈출한다.",
  activities: [
    { id: "문화사_유물발굴", title: "1차시 · 유물 발굴", desc: "", type: "module", url: BASE + "?screen=dig" },
    { id: "문화사_박물관방탈출", title: "2차시 · 박물관 방탈출", desc: "", type: "module", url: BASE + "?screen=escape" }
  ],
  sequential: false, owner: "효니", public: false
};
const dry = process.argv.includes("--dry");

const cur = await (await fetch(URL_ + "?mode=curriculum")).json();
const lessons = cur.grades["3"].lessons;
const dup = lessons.find((l) => l.id === LESSON.id || (l.activities || []).some((a) => LESSON.activities.some((b) => b.id === a.id)));
if (dup) { console.log("이미 등록돼 있어 등록하지 않음:", dup.id); process.exit(0); }
console.log("중복 없음. 등록할 차시:", JSON.stringify({ ...LESSON, token: "(생략)" }, null, 1));
if (dry) process.exit(0);

const core = fs.readFileSync(path.join(here, "..", "..", "history26_backend", "00_core.gs"), "utf8");
const m = core.match(/TEACHER_TOKENS\s*=\s*\{[\s\S]*?['"]([^'"]+)['"]\s*:\s*['"]효니['"]/);
if (!m) { console.error("토큰을 못 찾음"); process.exit(1); }
const res = await fetch(URL_, { method: "POST", body: JSON.stringify({ action: "addLesson", token: m[1], ...LESSON }) });
const json = await res.json();
console.log("응답:", JSON.stringify(json));
