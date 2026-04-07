// Using flagcdn.com for country flags
export function getFlagUrl(code: string): string {
  const map: Record<string, string> = {
    BRA: "br", ARG: "ar", URU: "uy", COL: "co", ECU: "ec", PAR: "py",
    PER: "pe", CHI: "cl", BOL: "bo", VEN: "ve", MEX: "mx", USA: "us",
    CAN: "ca", CRC: "cr", PAN: "pa", HON: "hn", SLV: "sv", JAM: "jm", HAI: "ht", CUR: "cw",
    GER: "de", FRA: "fr", ESP: "es", ENG: "gb-eng", ITA: "it", POR: "pt",
    NED: "nl", BEL: "be", CRO: "hr", SRB: "rs", SUI: "ch", DEN: "dk",
    POL: "pl", AUT: "at", WAL: "gb-wls", SCO: "gb-sct", CZE: "cz",
    UKR: "ua", SWE: "se", NOR: "no", TUR: "tr", GRE: "gr", ROM: "ro",
    HUN: "hu", SVK: "sk", SVN: "si", BIH: "ba", MNE: "me", ALB: "al",
    FIN: "fi", ISL: "is", IRL: "ie", GEO: "ge",
    JPN: "jp", KOR: "kr", AUS: "au", IRN: "ir", KSA: "sa", QAT: "qa",
    UAE: "ae", IRQ: "iq", UZB: "uz", CHN: "cn", IND: "in", IDN: "id",
    THA: "th", VIE: "vn", MYS: "my", BHR: "bh", OMA: "om", JOR: "jo",
    SYR: "sy", PAL: "ps", KUW: "kw",
    MAR: "ma", SEN: "sn", NGA: "ng", GHA: "gh", CMR: "cm", EGY: "eg",
    ALG: "dz", TUN: "tn", CIV: "ci", MLI: "ml", RSA: "za", COD: "cd",
    GUI: "gn", BFA: "bf", GAB: "ga", MOZ: "mz", CPV: "cv", MAD: "mg",
    UGA: "ug", KEN: "ke", TAN: "tz", ZAM: "zm", ZIM: "zw", ANG: "ao",
    NZL: "nz",
    // Club teams (using country flags as fallback)
    BAR: "es", DOR: "de", INT: "it", BAY: "de",
  };
  const iso = map[code.toUpperCase()] || code.toLowerCase();
  return `https://flagcdn.com/w80/${iso}.png`;
}
