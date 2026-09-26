#!/usr/bin/env node
/**
 * generate-cards.js — Union Arena (EN) → cards.json (format TCG Arena)
 *
 * Lit db.json (export brut Union Arena, à côté du script)
 * et écrit cards.json au même endroit.
 *
 * Groupement en skins : le moteur regroupe les cartes de même nom comme
 * skins alternatifs. Donc :
 *  - toutes les impressions d'une même carte (ALT, promos UEPR…) partagent
 *    la même `sharedKey` et gardent le même nom → groupées en skins ;
 *  - si plusieurs cartes différentes (sharedKey distinctes) portent le même
 *    nom, on suffixe avec le numéro de carte : "Yhwach - BLC-1-021".
 *    C'est aussi l'unité de la règle des 4 exemplaires (partie après le "/").
 *  - les cartes AP ne sont jamais suffixées (identiques en jeu → une seule
 *    carte par licence avec toutes ses illustrations en skins).
 *
 * Les stats sont prises sur la version primaire de chaque carte, pour que
 * tous les skins d'un groupe soient identiques (certaines promos ont des
 * valeurs manquantes dans la base).
 *
 * Usage : node generate-cards.js
 */

const fs = require("fs");
const path = require("path");

const INPUT = path.join(__dirname, "db.json");
const OUTPUT = path.join(__dirname, "cards.json");

const NO_SUFFIX_TYPES = new Set(["AP"]);

/* ------------------------------------------------------------------------ */
/* Helpers                                                                  */
/* ------------------------------------------------------------------------ */

/** "UE01BT/BLC-1-001-ALT1" → "UE01BT_BLC-1-001-ALT1" (même forme que le nom d'image) */
const toId = (cardNo) => cardNo.replace(/\//g, "_");

/** "-", "", null, undefined → null */
const clean = (v) => (v === undefined || v === null || v === "-" || v === "" ? null : v);

/** Clé de la "vraie" carte, commune à toutes ses impressions */
const cardKey = (c) => c.sharedKey || c.cardNo.replace(/-ALT\d+$/i, "");

/** "UE01BT/BLC-1-021" → "BLC-1-021" */
const cardNumber = (key) => key.split("/").pop();

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
/* Groupement                                                               */
/* ------------------------------------------------------------------------ */

/**
 * Retourne :
 *  - primaries : cardKey → carte primaire (source des stats)
 *  - names     : cardKey → nom final (suffixé si homonymes)
 */
function buildGroups(list) {
  const byKey = new Map();
  for (const c of list) {
    const k = cardKey(c);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(c);
  }

  const primaries = new Map();
  for (const [k, arr] of byKey) {
    primaries.set(k, arr.find((c) => c.isPrimary) || arr[0]);
  }

  // nom → ensemble des cardKey distinctes qui le portent
  const keysByName = new Map();
  for (const [k, p] of primaries) {
    if (NO_SUFFIX_TYPES.has(p.type)) continue;
    if (!keysByName.has(p.name)) keysByName.set(p.name, new Set());
    keysByName.get(p.name).add(k);
  }

  const names = new Map();
  for (const [k, p] of primaries) {
    const homonyms = keysByName.get(p.name);
    names.set(k, homonyms && homonyms.size > 1 ? `${p.name} - ${cardNumber(k)}` : p.name);
  }

  return { primaries, names };
}

/* ------------------------------------------------------------------------ */
/* Conversion                                                               */
/* ------------------------------------------------------------------------ */

function convertCard(c, primary, name) {
  const cost = primary.cost ?? 0;

  return {
    id: toId(c.cardNo),
    face: {
      front: {
        name,
        type: primary.type,
        cost,
        image: c.image || c.imageFallback,
      },
    },
    name,
    type: primary.type,
    cost,
    rarity: clean(c.rarity), // propre à l'impression (★, ★★…)
    color: clean(primary.color),
    power: clean(primary.power), // BP
    ap: clean(primary.ap), // coût en AP
    generatedEnergy: clean(primary.generatedEnergy),
    traits: splitTraits(primary.attribute),
    triggerType: triggerType(primary.trigger && primary.trigger.text),
  };
}

function main() {
  if (!fs.existsSync(INPUT)) {
    console.error(`❌ Fichier introuvable : ${INPUT}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(INPUT, "utf8"));
  const all = Array.isArray(raw) ? raw : raw.data;
  if (!Array.isArray(all)) {
    console.error("❌ Format inattendu : tableau `data` absent.");
    process.exit(1);
  }

  const list = all.filter((c) => c && c.cardNo && c.published !== false);
  const skipped = all.length - list.length;
  const { primaries, names } = buildGroups(list);

  const out = {};
  for (const c of list) {
    const k = cardKey(c);
    const card = convertCard(c, primaries.get(k), names.get(k));
    if (out[card.id]) console.warn(`⚠️  id en double, écrasé : ${card.id}`);
    out[card.id] = card;
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(out, null, 2));

  const byType = {};
  for (const c of Object.values(out)) byType[c.type] = (byType[c.type] || 0) + 1;
  const suffixed = [...names.entries()].filter(([k, n]) => n !== primaries.get(k).name).length;

  console.log(`✅ ${Object.keys(out).length} cartes écrites dans ${OUTPUT}`);
  console.log("   Par type :", byType);
  console.log(`   ${new Set(names.values()).size} noms distincts (${suffixed} cartes suffixées par leur numéro)`);
  if (skipped) console.log(`   ${skipped} entrée(s) ignorée(s)`);
}

main();