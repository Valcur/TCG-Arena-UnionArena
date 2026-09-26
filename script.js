#!/usr/bin/env node
/**
 * generate-cards.js — Union Arena (EN) → cards.json (format TCG Arena)
 *
 * Lit db.json (export brut Union Arena, à côté du script)
 * et écrit cards.json au même endroit.
 *
 * Usage : node generate-cards.js
 */

const fs = require("fs");
const path = require("path");

const INPUT = path.join(__dirname, "db.json");
const OUTPUT = path.join(__dirname, "cards.json");

/* ------------------------------------------------------------------------ */
/* Helpers                                                                  */
/* ------------------------------------------------------------------------ */

/** "UE01BT/BLC-1-001-ALT1" → "UE01BT_BLC-1-001-ALT1" (même forme que le nom d'image) */
const toId = (cardNo) => cardNo.replace(/\//g, "_");

/** "-", "", null, undefined → null */
const clean = (v) => (v === undefined || v === null || v === "-" || v === "" ? null : v);

/** Type du trigger à partir de l'icône : "COLOR" → "Color", "FINAL" → "Final"… */
function triggerType(html) {
  const m = clean(html) && /alt="([^"]+)"/.exec(html);
  if (!m) return null;
  const t = m[1].replace(/\s*Trigger$/i, "").trim();
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

/** "Order of the Black Knights／KMF" → ["Order of the Black Knights", "KMF"] */
function splitTraits(attribute) {
  const v = clean(attribute);
  if (v === null) return [];
  return v
    .split(/[／\/]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/* ------------------------------------------------------------------------ */
/* Conversion                                                               */
/* ------------------------------------------------------------------------ */

function convertCard(c) {
  const cost = c.cost ?? 0;

  return {
    id: toId(c.cardNo),
    face: {
      front: {
        name: c.name,
        type: c.type,
        cost,
        image: c.image || c.imageFallback,
      },
    },
    name: c.name,
    type: c.type,
    cost,
    rarity: clean(c.rarity),
    color: clean(c.color),
    power: clean(c.power), // BP
    ap: clean(c.ap), // coût en AP
    generatedEnergy: clean(c.generatedEnergy),
    traits: splitTraits(c.attribute),
    triggerType: triggerType(c.trigger && c.trigger.text),
  };
}

function main() {
  if (!fs.existsSync(INPUT)) {
    console.error(`❌ Fichier introuvable : ${INPUT}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(INPUT, "utf8"));
  const list = Array.isArray(raw) ? raw : raw.data;
  if (!Array.isArray(list)) {
    console.error("❌ Format inattendu : tableau `data` absent.");
    process.exit(1);
  }

  const out = {};
  let skipped = 0;

  for (const c of list) {
    if (!c || !c.cardNo || c.published === false) {
      skipped++;
      continue;
    }
    const card = convertCard(c);
    if (out[card.id]) console.warn(`⚠️  id en double, écrasé : ${card.id}`);
    out[card.id] = card;
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(out, null, 2));

  const byType = {};
  for (const c of Object.values(out)) byType[c.type] = (byType[c.type] || 0) + 1;

  console.log(`✅ ${Object.keys(out).length} cartes écrites dans ${OUTPUT}`);
  console.log("   Par type :", byType);
  if (skipped) console.log(`   ${skipped} entrée(s) ignorée(s)`);
}

main();