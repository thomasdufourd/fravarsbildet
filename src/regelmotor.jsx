import { useState, useMemo } from "react";

/* ============================================================================
   MOTOREN
   Alt mellom denne kommentaren og «SLUTT MOTOR» er rene funksjoner uten
   React-avhengigheter. Denne blokken kan klippes ut og legges i src/motor/
   uten endringer. Tekst finnes ikke her — motoren returnerer struktur.
   ========================================================================= */

const TILSTAND = {
  SLAR_UT: "SLAR_UT",
  SLAR_IKKE_UT: "SLAR_IKKE_UT",
  IKKE_NOK_DATA: "IKKE_NOK_DATA",
};

const STANDARDTERSKLER = {
  // Visningsterskel — kan vi vise tall?
  visningMinAnsatte: 5,
  visningMinTilfeller: 5,
  visningMinNevner: 5,
  // Mønsterterskel — ett beviskrav per regel
  enhetMinAnsatte: 20,
  gjentakMinKorttid: 6,
  gjentakAndelAvKorttid: 0.6,
  gjentakMaksAndelAnsatte: 0.25,
  graderingMinNevner: 5,
  graderingAvvikProsentpoeng: 20,
  langtidMinTilfeller: 4,
  langtidMinAndel: 0.5,
};

function avled(i) {
  const korttidstilfeller = Math.max(0, i.tilfellerTotalt - i.tilfellerLangtid);
  return {
    korttidstilfeller,
    andelFraGjentakere:
      korttidstilfeller > 0 ? i.tilfellerFraGjentakere / korttidstilfeller : 0,
    gjentakereAvAnsatte:
      i.ansatte > 0 ? i.personerMedGjentakelse / i.ansatte : 0,
    graderingsandel:
      i.sykmeldtePersoner > 0
        ? (i.graderteSykmeldte / i.sykmeldtePersoner) * 100
        : 0,
    langtidsandel:
      i.tilfellerTotalt > 0 ? i.tilfellerLangtid / i.tilfellerTotalt : 0,
  };
}

const REGLER = [
  {
    id: "enhetsklynge",
    navn: "Klynge i én enhet",
    prioritet: 1,
    vurder(i, a, T) {
      if (i.ansatte < T.enhetMinAnsatte)
        return {
          tilstand: TILSTAND.IKKE_NOK_DATA,
          forklaring: `${i.ansatte} ansatte er under kravet på ${T.enhetMinAnsatte}. Det finnes ikke enheter å sammenligne.`,
        };
      if (i.enhetskonsentrasjon === "vetIkke")
        return {
          tilstand: TILSTAND.IKKE_NOK_DATA,
          forklaring: "Arbeidsgiver svarte «vet ikke». Det er ikke et nei.",
        };
      if (i.enhetskonsentrasjon === "ja")
        return {
          tilstand: TILSTAND.SLAR_UT,
          forklaring: "Arbeidsgiver oppgir at fraværet er samlet i én enhet.",
        };
      return {
        tilstand: TILSTAND.SLAR_IKKE_UT,
        forklaring: "Arbeidsgiver oppgir at fraværet ikke er samlet i én enhet.",
      };
    },
  },
  {
    id: "gjentakendeKorttid",
    navn: "Gjentakende korttid hos få personer",
    prioritet: 2,
    vurder(i, a, T) {
      if (a.korttidstilfeller < T.gjentakMinKorttid)
        return {
          tilstand: TILSTAND.IKKE_NOK_DATA,
          forklaring: `${a.korttidstilfeller} korttidstilfeller er under kravet på ${T.gjentakMinKorttid}.`,
        };
      const andelOk = a.andelFraGjentakere >= T.gjentakAndelAvKorttid;
      const fåOk = a.gjentakereAvAnsatte <= T.gjentakMaksAndelAnsatte;
      if (i.personerMedGjentakelse === 0)
        return {
          tilstand: TILSTAND.SLAR_IKKE_UT,
          forklaring: "Ingen har fire eller flere korttidsfravær.",
        };
      if (andelOk && fåOk)
        return {
          tilstand: TILSTAND.SLAR_UT,
          forklaring: `${i.personerMedGjentakelse} personer står bak ${pst(
            a.andelFraGjentakere
          )} av korttidstilfellene, og utgjør ${pst(
            a.gjentakereAvAnsatte
          )} av de ansatte.`,
        };
      return {
        tilstand: TILSTAND.SLAR_IKKE_UT,
        forklaring: !andelOk
          ? `Gjentakerne står for ${pst(a.andelFraGjentakere)} av korttidstilfellene. Kravet er ${pst(T.gjentakAndelAvKorttid)}.`
          : `Gjentakerne utgjør ${pst(a.gjentakereAvAnsatte)} av de ansatte. Det er for stor del av bedriften til å kalles «få personer».`,
      };
    },
  },
  {
    id: "lavGradering",
    navn: "Lav gradering",
    prioritet: 3,
    vurder(i, a, T) {
      if (i.sykmeldtePersoner < T.graderingMinNevner)
        return {
          tilstand: TILSTAND.IKKE_NOK_DATA,
          forklaring: `${i.sykmeldtePersoner} sykmeldte er under nevnerkravet på ${T.graderingMinNevner}. Andel kan ikke beregnes.`,
        };
      const grense = i.bransjeGradering - T.graderingAvvikProsentpoeng;
      if (a.graderingsandel <= grense)
        return {
          tilstand: TILSTAND.SLAR_UT,
          forklaring: `${Math.round(a.graderingsandel)} % delvis sykmeldte mot ${i.bransjeGradering} % i bransjen. Grensen er ${Math.round(grense)} %.`,
        };
      return {
        tilstand: TILSTAND.SLAR_IKKE_UT,
        forklaring: `${Math.round(a.graderingsandel)} % delvis sykmeldte ligger ikke ${T.graderingAvvikProsentpoeng} prosentpoeng under bransjen.`,
      };
    },
  },
  {
    id: "langtidUtenforJobb",
    navn: "Langtid dominerer bildet",
    prioritet: 4,
    vurder(i, a, T) {
      if (i.tilfellerTotalt < T.langtidMinTilfeller)
        return {
          tilstand: TILSTAND.IKKE_NOK_DATA,
          forklaring: `${i.tilfellerTotalt} tilfeller er under kravet på ${T.langtidMinTilfeller}.`,
        };
      if (i.tilfellerLangtid >= 1 && a.langtidsandel >= T.langtidMinAndel)
        return {
          tilstand: TILSTAND.SLAR_UT,
          forklaring: `${pst(a.langtidsandel)} av tilfellene varte lenger enn 16 dager.`,
        };
      return {
        tilstand: TILSTAND.SLAR_IKKE_UT,
        forklaring: `${pst(a.langtidsandel)} av tilfellene er langtid. Kravet er ${pst(T.langtidMinAndel)}.`,
      };
    },
  },
];

function pst(x) {
  return `${Math.round(x * 100)} %`;
}

function beregnSikkerhet(i, ikkeVurdertAntall) {
  let nivå = 0;
  if (i.tilfellerTotalt >= 8) nivå = 1;
  if (i.ansatte >= 20 && i.tilfellerTotalt >= 15) nivå = 2;
  if (ikkeVurdertAntall >= 3) nivå = Math.max(0, nivå - 1);
  return ["lav", "middels", "god"][nivå];
}

function kjørMotor(input, terskler) {
  const T = { ...STANDARDTERSKLER, ...terskler };
  const a = avled(input);

  const vurderinger = REGLER.map((r) => {
    const res = r.vurder(input, a, T);
    return { id: r.id, navn: r.navn, prioritet: r.prioritet, ...res };
  });

  const utslag = vurderinger
    .filter((v) => v.tilstand === TILSTAND.SLAR_UT)
    .sort((x, y) => x.prioritet - y.prioritet);

  const ikkeVurdert = vurderinger.filter(
    (v) => v.tilstand === TILSTAND.IKKE_NOK_DATA
  );
  const valgt = utslag[0] || null;

  // Bare regler i tilstand SLAR_IKKE_UT kan brukes til å utelukke noe.
  const utelukket = vurderinger.filter(
    (v) => v.tilstand === TILSTAND.SLAR_IKKE_UT
  );

  const visningsmodus =
    input.ansatte >= T.visningMinAnsatte &&
    input.tilfellerTotalt >= T.visningMinTilfeller
      ? "tall"
      : "ord";

  return {
    mønster: valgt ? valgt.id : "utilstrekkelig_data",
    sikkerhet: valgt ? beregnSikkerhet(input, ikkeVurdert.length) : null,
    begrunnelse: valgt ? [valgt.forklaring] : [],
    ogsåUtslag: utslag.slice(1).map((v) => v.id),
    utelukket: utelukket.map((v) => v.id),
    ikkeVurdert: ikkeVurdert.map((v) => v.id),
    visningsmodus,
    tiltak: valgt ? `tiltak_${valgt.id}` : "tiltak_beredskap",
    _vurderinger: vurderinger,
    _avledet: a,
  };
}

/* ============================================================================
   SLUTT MOTOR
   ========================================================================= */

/* Tekst som data. I et ekte prosjekt: innhold/tekster.nb.json */
const TEKST = {
  mønster: {
    enhetsklynge: {
      tittel: "Fraværet er samlet i én del av bedriften",
      brødtekst:
        "Når fraværet klumper seg i én avdeling eller ett skiftlag, handler det oftest om arbeidsbelastning, bemanning eller nærmeste leder — ikke om de enkelte ansatte.",
    },
    gjentakendeKorttid: {
      tittel: "Gjentakende korttidsfravær hos få personer",
      brødtekst:
        "Noen få personer står bak en stor del av korttidsfraværet. Det peker mot oppfølging og dialog, ikke mot brede arbeidsmiljøtiltak.",
    },
    lavGradering: {
      tittel: "Få er delvis sykmeldt",
      brødtekst:
        "Dere bruker gradert sykmelding mindre enn andre i bransjen. Delvis nærvær er ett av de få tiltakene med god dokumentert effekt.",
    },
    langtidUtenforJobb: {
      tittel: "Langvarige fravær dominerer bildet",
      brødtekst:
        "Det meste av fraværet er langvarig. Årsaken ligger ofte utenfor det arbeidsplassen kan påvirke, men tilbakeføringen ligger godt innenfor.",
    },
    utilstrekkelig_data: {
      tittel: "For lite data til å se et mønster",
      brødtekst:
        "Med så få ansatte og fraværstilfeller er svingningene tilfeldige. Ett langvarig fravær flytter fraværsprosenten kraftig uten at noe har endret seg hos dere.",
    },
  },
  utelukket: {
    enhetsklynge:
      "Du oppgir at fraværet ikke er samlet i én avdeling, rolle eller skiftlag.",
    gjentakendeKorttid:
      "Det er ikke noen få personer som står bak størstedelen av korttidsfraværet.",
    lavGradering:
      "Bruken av delvis sykmelding ligger ikke lavere enn i bransjen ellers.",
    langtidUtenforJobb: "Fraværet er ikke dominert av langvarige tilfeller.",
  },
  tiltak: {
    tiltak_enhetsklynge: {
      tittel: "Kartlegg arbeidsbelastningen i den ene enheten",
      hvorfor:
        "Start med å snakke med enheten samlet, sammen med verneombudet. Arbeidsmiljøhjelpen har et opplegg tilpasset bransjen din.",
      tid: ["20 min nå", "45 min om to uker", "15 min i uke 10"],
    },
    tiltak_gjentakendeKorttid: {
      tittel: "Ta en samtale med hver av dem",
      hvorfor:
        "Ikke om fraværet i seg selv, men om hva som gjør det vanskelig å stå i jobben. Du får forslag til åpningsspørsmål og en oversikt over hva du ikke har lov til å spørre om.",
      tid: ["10 min nå", "15 min om to uker", "5 min i uke 8"],
    },
    tiltak_lavGradering: {
      tittel: "Se på hva folk kan gjøre, ikke hva de ikke kan",
      hvorfor:
        "Neste gang noen sykmeldes: kartlegg arbeidsoppgavene som fortsatt går an. Nav kan dekke tilrettelegging gjennom tilretteleggingstilskudd.",
      tid: ["15 min nå", "10 min per ny sykmelding"],
    },
    tiltak_langtidUtenforJobb: {
      tittel: "Hold kontakten mens de er borte",
      hvorfor:
        "Jevn, lav kontakt gjør tilbakeføringen kortere. Du trenger ikke vite hva de feiler for å planlegge hva de skal komme tilbake til.",
      tid: ["10 min nå", "10 min hver tredje uke"],
    },
    tiltak_beredskap: {
      tittel: "Gjør deg klar til neste sykmelding",
      hvorfor:
        "Det mest lønnsomme du kan gjøre nå er å slå på varsler, slik at du får beskjed om oppfølgingsplan og dialogmøte når det først skjer noe.",
      tid: ["5 min nå", "Så ingenting før det trengs"],
    },
  },
};

const SCENARIER = {
  bakeriet: {
    navn: "Bakeriet AS",
    input: {
      ansatte: 9,
      tilfellerTotalt: 19,
      tilfellerLangtid: 2,
      sykmeldtePersoner: 3,
      personerMedGjentakelse: 2,
      tilfellerFraGjentakere: 14,
      graderteSykmeldte: 0,
      enhetskonsentrasjon: "nei",
      bransjeGradering: 55,
    },
  },
  nordvik: {
    navn: "Nordvik Rør AS",
    input: {
      ansatte: 6,
      tilfellerTotalt: 3,
      tilfellerLangtid: 1,
      sykmeldtePersoner: 2,
      personerMedGjentakelse: 0,
      tilfellerFraGjentakere: 0,
      graderteSykmeldte: 0,
      enhetskonsentrasjon: "vetIkke",
      bransjeGradering: 60,
    },
  },
  industri: {
    navn: "Vestland Industri AS",
    input: {
      ansatte: 200,
      tilfellerTotalt: 140,
      tilfellerLangtid: 34,
      sykmeldtePersoner: 48,
      personerMedGjentakelse: 9,
      tilfellerFraGjentakere: 30,
      graderteSykmeldte: 12,
      enhetskonsentrasjon: "ja",
      bransjeGradering: 62,
    },
  },
};

/* ------------------------------- Farger ---------------------------------- */
const C = {
  blå: "#0067C5",
  blåMørk: "#00459E",
  blåLys: "#E6F0FF",
  blekk: "#23262A",
  grå: "#5B6270",
  kantLys: "#DDE1E6",
  flate: "#FFFFFF",
  side: "#F4F5F6",
  konsoll: "#16181D",
  konsollFlate: "#1F232A",
  konsollKant: "#2E343D",
  konsollTekst: "#C7CDD6",
  konsollDempet: "#7C8492",
  utslag: "#4FD48A",
  ikkeUtslag: "#8891A0",
  mangler: "#FFB35C",
};

const SANS = '"Source Sans 3","Source Sans Pro",system-ui,sans-serif';
const MONO = 'ui-monospace,SFMono-Regular,"IBM Plex Mono",Menlo,monospace';

/* ------------------------------ Konsoll ---------------------------------- */

function Skyv({ etikett, verdi, min, max, steg = 1, onChange, suffiks }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between items-baseline mb-1">
        <span style={{ color: C.konsollTekst, fontSize: 12 }}>{etikett}</span>
        <span style={{ color: C.utslag, fontFamily: MONO, fontSize: 12 }}>
          {verdi}
          {suffiks || ""}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={steg}
        value={verdi}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: C.blå }}
      />
    </div>
  );
}

function TilstandsMerke({ tilstand }) {
  const kart = {
    SLAR_UT: { t: "SLÅR UT", f: C.utslag },
    SLAR_IKKE_UT: { t: "SLÅR IKKE UT", f: C.ikkeUtslag },
    IKKE_NOK_DATA: { t: "IKKE NOK DATA", f: C.mangler },
  };
  const k = kart[tilstand];
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 10,
        letterSpacing: "0.06em",
        color: k.f,
        border: `1px solid ${k.f}`,
        borderRadius: 3,
        padding: "2px 6px",
        whiteSpace: "nowrap",
      }}
    >
      {k.t}
    </span>
  );
}

/* --------------------------- Tjenesteskjerm ------------------------------ */

function Nøkkeltall({ etikett, verdi }) {
  return (
    <div
      className="p-4"
      style={{ background: C.side, borderRadius: 6, minWidth: 0 }}
    >
      <div style={{ fontSize: 13, color: C.grå, marginBottom: 4 }}>
        {etikett}
      </div>
      <div style={{ fontSize: 24, fontWeight: 600, color: C.blekk }}>
        {verdi}
      </div>
    </div>
  );
}

function TjenesteSkjerm({ input, ut, virksomhet }) {
  const m = TEKST.mønster[ut.mønster];
  const tiltak = TEKST.tiltak[ut.tiltak];
  const a = ut._avledet;

  const utelukketSetninger = ut.utelukket
    .filter((id) => id !== ut.mønster)
    .map((id) => TEKST.utelukket[id]);

  return (
    <div
      style={{
        background: C.flate,
        border: `1px solid ${C.kantLys}`,
        borderRadius: 8,
        fontFamily: SANS,
        color: C.blekk,
      }}
      className="p-5"
    >
      <div className="flex justify-between items-baseline mb-4 flex-wrap gap-2">
        <span style={{ fontSize: 13, color: C.grå }}>
          {virksomhet} · {input.ansatte} ansatte
        </span>
        <span style={{ fontSize: 13, color: C.grå }}>Oppdatert i dag</span>
      </div>

      <div
        className="p-5 mb-3"
        style={{ background: C.flate, border: `1px solid ${C.kantLys}`, borderRadius: 8 }}
      >
        <div style={{ fontSize: 13, color: C.grå, marginBottom: 6 }}>
          Fraværsbildet ditt
        </div>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 600,
            lineHeight: 1.3,
            margin: "0 0 8px",
          }}
        >
          {m.tittel}
        </h2>
        <p style={{ fontSize: 15, color: C.grå, lineHeight: 1.6, margin: 0 }}>
          {m.brødtekst}
        </p>

        {utelukketSetninger.length > 0 && (
          <p
            style={{
              fontSize: 15,
              color: C.grå,
              lineHeight: 1.6,
              margin: "10px 0 0",
            }}
          >
            {utelukketSetninger.join(" ")}
          </p>
        )}

        {ut.visningsmodus === "tall" ? (
          <div className="grid grid-cols-3 gap-3 mt-5">
            <Nøkkeltall etikett="Fraværstilfeller" verdi={input.tilfellerTotalt} />
            <Nøkkeltall
              etikett="Konsentrasjon"
              verdi={`${input.personerMedGjentakelse} av ${input.ansatte}`}
            />
            <Nøkkeltall
              etikett="Sikkerhet"
              verdi={
                ut.sikkerhet
                  ? ut.sikkerhet[0].toUpperCase() + ut.sikkerhet.slice(1)
                  : "—"
              }
            />
          </div>
        ) : (
          <div className="mt-5">
            <div style={{ fontSize: 13, color: C.grå, marginBottom: 4 }}>
              Det vi ser
            </div>
            <div style={{ borderTop: `1px solid ${C.kantLys}` }}>
              {[
                `${input.tilfellerTotalt} fraværstilfeller det siste året`,
                input.tilfellerLangtid === 1
                  ? "Ett av dem varte lenger enn 16 dager"
                  : `${input.tilfellerLangtid} av dem varte lenger enn 16 dager`,
                input.enhetskonsentrasjon === "ja"
                  ? "Du oppgir at fraværet er samlet i én del av bedriften"
                  : "Ingen rolle eller del av bedriften peker seg ut",
              ].map((s, k) => (
                <p
                  key={k}
                  style={{
                    fontSize: 15,
                    margin: 0,
                    padding: "10px 0",
                    borderBottom: `1px solid ${C.kantLys}`,
                    lineHeight: 1.5,
                  }}
                >
                  {s}
                </p>
              ))}
            </div>
            <p
              style={{
                fontSize: 13,
                color: C.grå,
                margin: "14px 0 0",
                lineHeight: 1.6,
              }}
            >
              Vi viser ikke prosent eller bransjesammenligning her. Med så få
              tilfeller ville tallene sagt mer om tilfeldigheter enn om
              bedriften din.
            </p>
          </div>
        )}

        <p
          style={{
            fontSize: 13,
            color: C.grå,
            margin: "14px 0 0",
            lineHeight: 1.6,
          }}
        >
          Tallene er hentet fra sykmeldingene Nav allerede har. Ingenting du
          legger inn her deles med saksbehandler.
        </p>
      </div>

      <div
        className="p-5"
        style={{ border: `2px solid ${C.blå}`, borderRadius: 8 }}
      >
        <span
          style={{
            display: "inline-block",
            background: C.blåLys,
            color: C.blåMørk,
            fontSize: 12,
            padding: "4px 12px",
            borderRadius: 4,
            marginBottom: 10,
          }}
        >
          {ut.mønster === "utilstrekkelig_data" ? "Ingenting haster" : "Én ting nå"}
        </span>
        <h3 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 6px" }}>
          {tiltak.tittel}
        </h3>
        <p
          style={{
            fontSize: 15,
            color: C.grå,
            lineHeight: 1.6,
            margin: "0 0 16px",
          }}
        >
          {tiltak.hvorfor}
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          {tiltak.tid.map((t) => (
            <span
              key={t}
              style={{
                fontSize: 13,
                border: `1px solid ${C.kantLys}`,
                borderRadius: 4,
                padding: "5px 10px",
                color: C.grå,
              }}
            >
              {t}
            </span>
          ))}
        </div>
        <button
          style={{
            background: C.blå,
            color: "#fff",
            border: "none",
            borderRadius: 4,
            padding: "8px 16px",
            fontSize: 15,
            fontFamily: SANS,
            cursor: "pointer",
          }}
        >
          {ut.mønster === "utilstrekkelig_data" ? "Slå på varsler" : "Sett i gang"}
        </button>
      </div>
    </div>
  );
}

/* --------------------------------- App ----------------------------------- */

export default function Regelmotor() {
  const [scenario, setScenario] = useState("bakeriet");
  const [input, setInput] = useState(SCENARIER.bakeriet.input);
  const [T, setT] = useState(STANDARDTERSKLER);
  const [visTerskler, setVisTerskler] = useState(false);
  const [visRegeltilstander, setVisRegeltilstander] = useState(false);
  const [visDatakontrakt, setVisDatakontrakt] = useState(false);

  const ut = useMemo(() => kjørMotor(input, T), [input, T]);

  const settScenario = (k) => {
    setScenario(k);
    setInput(SCENARIER[k].input);
  };
  const endre = (felt) => (v) => setInput((p) => ({ ...p, [felt]: v }));

  return (
    <div
      style={{ fontFamily: SANS, background: C.side, minHeight: "100%" }}
      className="p-4"
    >
      <div className="mb-4">
        <h1
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: C.blekk,
            margin: "0 0 4px",
          }}
        >
          Regelmotor — fase 1
        </h1>
        <p style={{ fontSize: 14, color: C.grå, margin: "0 0 12px" }}>
          Åtte tall inn, fire regler med tre tilstander hver, ett mønster ut.
          Ingen KI.
        </p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(SCENARIER).map(([k, s]) => (
            <button
              key={k}
              onClick={() => settScenario(k)}
              style={{
                fontSize: 14,
                padding: "6px 14px",
                borderRadius: 4,
                cursor: "pointer",
                fontFamily: SANS,
                border: `1px solid ${scenario === k ? C.blå : C.kantLys}`,
                background: scenario === k ? C.blå : C.flate,
                color: scenario === k ? "#fff" : C.blekk,
              }}
            >
              {s.navn}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Konsoll */}
        <div
          className="lg:col-span-2 p-4"
          style={{ background: C.konsoll, borderRadius: 8 }}
        >
          <div
            style={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: "0.08em",
              color: C.konsollDempet,
              marginBottom: 14,
            }}
          >
            INNDATA FRA ARBEIDSGIVER
          </div>

          <Skyv etikett="Ansatte" verdi={input.ansatte} min={1} max={300} onChange={endre("ansatte")} />
          <Skyv etikett="Fraværstilfeller siste 12 mnd" verdi={input.tilfellerTotalt} min={0} max={200} onChange={endre("tilfellerTotalt")} />
          <Skyv etikett="Av disse over 16 dager" verdi={input.tilfellerLangtid} min={0} max={Math.max(1, input.tilfellerTotalt)} onChange={endre("tilfellerLangtid")} />
          <Skyv etikett="Personer med legemeldt fravær" verdi={input.sykmeldtePersoner} min={0} max={Math.max(1, input.ansatte)} onChange={endre("sykmeldtePersoner")} />
          <Skyv etikett="Av disse delvis sykmeldt" verdi={input.graderteSykmeldte} min={0} max={Math.max(1, input.sykmeldtePersoner)} onChange={endre("graderteSykmeldte")} />
          <Skyv etikett="Personer med 4+ korttidsfravær" verdi={input.personerMedGjentakelse} min={0} max={Math.max(1, input.ansatte)} onChange={endre("personerMedGjentakelse")} />
          <Skyv etikett="Korttidstilfeller hos disse" verdi={input.tilfellerFraGjentakere} min={0} max={Math.max(1, input.tilfellerTotalt)} onChange={endre("tilfellerFraGjentakere")} />

          <div className="mb-3">
            <div style={{ color: C.konsollTekst, fontSize: 12, marginBottom: 6 }}>
              Samlet i én avdeling, rolle eller skift?
            </div>
            <div className="flex gap-2">
              {[
                ["ja", "Ja"],
                ["nei", "Nei"],
                ["vetIkke", "Vet ikke"],
              ].map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => endre("enhetskonsentrasjon")(v)}
                  style={{
                    fontFamily: MONO,
                    fontSize: 11,
                    padding: "4px 10px",
                    borderRadius: 3,
                    cursor: "pointer",
                    border: `1px solid ${input.enhetskonsentrasjon === v ? C.utslag : C.konsollKant}`,
                    background: "transparent",
                    color: input.enhetskonsentrasjon === v ? C.utslag : C.konsollDempet,
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: "0.08em",
              color: C.konsollDempet,
              margin: "20px 0 10px",
              paddingTop: 14,
              borderTop: `1px solid ${C.konsollKant}`,
            }}
          >
            NAV-DATA
          </div>
          <Skyv etikett="Graderingsandel i bransjen" verdi={input.bransjeGradering} min={0} max={100} suffiks=" %" onChange={endre("bransjeGradering")} />

          <button
            onClick={() => setVisTerskler(!visTerskler)}
            style={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: "0.08em",
              color: C.konsollDempet,
              background: "transparent",
              border: "none",
              padding: "14px 0 10px",
              cursor: "pointer",
              borderTop: `1px solid ${C.konsollKant}`,
              width: "100%",
              textAlign: "left",
              marginTop: 20,
            }}
          >
            {visTerskler ? "▾" : "▸"} TERSKLER
          </button>

          {visTerskler && (
            <div>
              <div style={{ color: C.mangler, fontFamily: MONO, fontSize: 10, marginBottom: 8 }}>
                VISNINGSTERSKEL
              </div>
              <Skyv etikett="Min. ansatte for å vise tall" verdi={T.visningMinAnsatte} min={1} max={30} onChange={(v) => setT({ ...T, visningMinAnsatte: v })} />
              <Skyv etikett="Min. tilfeller for å vise tall" verdi={T.visningMinTilfeller} min={1} max={30} onChange={(v) => setT({ ...T, visningMinTilfeller: v })} />
              <div style={{ color: C.mangler, fontFamily: MONO, fontSize: 10, margin: "14px 0 8px" }}>
                MØNSTERTERSKLER
              </div>
              <Skyv etikett="Enhetsklynge: min. ansatte" verdi={T.enhetMinAnsatte} min={2} max={100} onChange={(v) => setT({ ...T, enhetMinAnsatte: v })} />
              <Skyv etikett="Gjentakelse: min. korttidstilfeller" verdi={T.gjentakMinKorttid} min={1} max={40} onChange={(v) => setT({ ...T, gjentakMinKorttid: v })} />
              <Skyv etikett="Gjentakelse: andel av korttid" verdi={Math.round(T.gjentakAndelAvKorttid * 100)} min={10} max={100} suffiks=" %" onChange={(v) => setT({ ...T, gjentakAndelAvKorttid: v / 100 })} />
              <Skyv etikett="Gjentakelse: maks andel av ansatte" verdi={Math.round(T.gjentakMaksAndelAnsatte * 100)} min={5} max={100} suffiks=" %" onChange={(v) => setT({ ...T, gjentakMaksAndelAnsatte: v / 100 })} />
              <Skyv etikett="Gradering: min. nevner" verdi={T.graderingMinNevner} min={1} max={30} onChange={(v) => setT({ ...T, graderingMinNevner: v })} />
              <Skyv etikett="Gradering: avvik fra bransje" verdi={T.graderingAvvikProsentpoeng} min={1} max={60} suffiks=" pp" onChange={(v) => setT({ ...T, graderingAvvikProsentpoeng: v })} />
              <Skyv etikett="Langtid: min. tilfeller" verdi={T.langtidMinTilfeller} min={1} max={30} onChange={(v) => setT({ ...T, langtidMinTilfeller: v })} />
              <Skyv etikett="Langtid: min. andel av tilfeller" verdi={Math.round(T.langtidMinAndel * 100)} min={10} max={100} suffiks=" %" onChange={(v) => setT({ ...T, langtidMinAndel: v / 100 })} />
              <button
                onClick={() => setT(STANDARDTERSKLER)}
                style={{
                  fontFamily: MONO,
                  fontSize: 11,
                  color: C.konsollDempet,
                  background: "transparent",
                  border: `1px solid ${C.konsollKant}`,
                  borderRadius: 3,
                  padding: "5px 10px",
                  cursor: "pointer",
                  marginTop: 6,
                }}
              >
                Tilbakestill
              </button>
            </div>
          )}

          <button
            onClick={() => setVisRegeltilstander(!visRegeltilstander)}
            style={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: "0.08em",
              color: C.konsollDempet,
              background: "transparent",
              border: "none",
              padding: "14px 0 10px",
              cursor: "pointer",
              borderTop: `1px solid ${C.konsollKant}`,
              width: "100%",
              textAlign: "left",
              marginTop: 20,
            }}
          >
            {visRegeltilstander ? "▾" : "▸"} REGELTILSTANDER
          </button>

          {visRegeltilstander && (
            <div>
              {ut._vurderinger.map((v) => (
                <div
                  key={v.id}
                  className="p-3 mb-2"
                  style={{
                    background: C.konsollFlate,
                    borderRadius: 4,
                    borderLeft: `2px solid ${
                      v.tilstand === "SLAR_UT"
                        ? C.utslag
                        : v.tilstand === "IKKE_NOK_DATA"
                        ? C.mangler
                        : C.konsollKant
                    }`,
                  }}
                >
                  <div className="flex justify-between items-start gap-2 mb-1 flex-wrap">
                    <span style={{ fontSize: 13, color: C.konsollTekst, fontWeight: 600 }}>
                      {v.prioritet}. {v.navn}
                    </span>
                    <TilstandsMerke tilstand={v.tilstand} />
                  </div>
                  <p
                    style={{
                      fontFamily: MONO,
                      fontSize: 11,
                      color: C.konsollDempet,
                      margin: 0,
                      lineHeight: 1.6,
                    }}
                  >
                    {v.forklaring}
                  </p>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => setVisDatakontrakt(!visDatakontrakt)}
            style={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: "0.08em",
              color: C.konsollDempet,
              background: "transparent",
              border: "none",
              padding: "14px 0 10px",
              cursor: "pointer",
              borderTop: `1px solid ${C.konsollKant}`,
              width: "100%",
              textAlign: "left",
              marginTop: 20,
            }}
          >
            {visDatakontrakt ? "▾" : "▸"} DATAKONTRAKT
          </button>

          {visDatakontrakt && (
            <pre
              style={{
                fontFamily: MONO,
                fontSize: 11,
                color: C.utslag,
                background: C.konsollFlate,
                padding: 12,
                borderRadius: 4,
                overflowX: "auto",
                margin: 0,
                lineHeight: 1.6,
              }}
            >
{JSON.stringify(
  {
    mønster: ut.mønster,
    sikkerhet: ut.sikkerhet,
    ogsåUtslag: ut.ogsåUtslag,
    utelukket: ut.utelukket,
    ikkeVurdert: ut.ikkeVurdert,
    visningsmodus: ut.visningsmodus,
    tiltak: ut.tiltak,
  },
  null,
  2
)}
            </pre>
          )}
        </div>

        {/* Tjenesteskjerm */}
        <div className="lg:col-span-3">
          <div
            style={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: "0.08em",
              color: C.grå,
              marginBottom: 10,
            }}
          >
            DET ARBEIDSGIVEREN SER
          </div>
          <TjenesteSkjerm
            input={input}
            ut={ut}
            virksomhet={SCENARIER[scenario].navn}
          />
          <p style={{ fontSize: 13, color: C.grå, marginTop: 12, lineHeight: 1.6 }}>
            Skjermen til høyre er generert fra datakontrakten til venstre. All
            tekst ligger i et separat objekt, ikke i motoren.
          </p>
        </div>
      </div>
    </div>
  );
}
