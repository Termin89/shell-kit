// Структурная валидация плагин-манифестов и скилов (шаг CI).
// Полная проверка — `zai plugin validate .` локально; этот скрипт
// проверяет обязательные ключи и frontmatter без внешних зависимостей.
import { readFileSync, readdirSync, statSync } from "node:fs";

const plugin = JSON.parse(readFileSync(".claude-plugin/plugin.json", "utf8"));
const market = JSON.parse(readFileSync(".claude-plugin/marketplace.json", "utf8"));

for (const key of ["name", "version", "description"]) {
  if (!plugin[key]) throw new Error(`plugin.json: нет ключа ${key}`);
}
if (!market.name || !Array.isArray(market.plugins) || market.plugins.length === 0) {
  throw new Error("marketplace.json: ожидается name + непустой plugins[]");
}
const entry = market.plugins[0];
for (const key of ["name", "source", "version"]) {
  if (!entry[key]) throw new Error(`marketplace.json plugins[0]: нет ключа ${key}`);
}
if (entry.version !== plugin.version) {
  throw new Error(`version расходится: plugin ${plugin.version} vs marketplace ${entry.version}`);
}

const skills = readdirSync("skills").filter((d) => statSync(`skills/${d}`).isDirectory());
for (const skill of skills) {
  const text = readFileSync(`skills/${skill}/SKILL.md`, "utf8");
  if (!text.startsWith("---")) throw new Error(`${skill}: SKILL.md без frontmatter`);
  const fm = text.slice(3, text.indexOf("---", 3));
  if (!/^name:\s*\S+/m.test(fm)) throw new Error(`${skill}: frontmatter без name`);
  if (!/^description:[\s\S]*\S/m.test(fm)) throw new Error(`${skill}: frontmatter без description`);
}
console.log(`OK: манифесты валидны (v${plugin.version}), скилов ${skills.length}, все с frontmatter name+description`);
