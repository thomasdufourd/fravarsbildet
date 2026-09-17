import { useState, useMemo } from "react";

/* ============================================================================
   MOTOREN
   Rene funksjoner. Ingen React, ingen tekst. Flyttes til motor/ når
   prosjektet settes opp for alvor.
   ========================================================================= */

export const TILSTAND = {
  SLAR_UT: "SLAR_UT",
  SLAR_IKKE_UT: "SLAR_IKKE_UT",
  IKKE_NOK_DATA: "IKKE_NOK_DATA",
  TRENGER_SVAR: "TRENGER_SVAR",
};

export const STANDARDTERSKLER = {
  klyngeMinAarsverk: 20,
  gjentakScreeningFaktor: 1.5,
  graderingFaktor: 0.6,
  langtidAvvikPp: 10,
  godSikkerhetMinDagsverk: 2000,
  dagsverkPerAarsverk: 230,
};

export function avled(d, T) {
  return {
    aarsverk: d.muligeDagsverk / T.dagsverkPerAarsverk,
    egenKorttid: 100 - d.egenLangtidsandel,
    bransjeKorttid: 100 - d.bransjeLangtidsandel,
  };
}

const p1 = (x) => `${x.toFixed(1).replace(".", ",")} %`;
const p0 = (x) => `${Math.round(x)} %`;

export const REGLER = [
  {
    id: "klynge",
    navn: "Klynge i én del av virksomheten",
    prioritet: 1,
    grunnlag: "egenvurdering",
    vurder(d, a, T) {
      if (a.aarsverk < T.klyngeMinAarsverk)
        return [
          TILSTAND.IKKE_NOK_DATA,
          `Tilsvarer ${a.aarsverk.toFixed(0)} årsverk, under kravet på ${T.klyngeMinAarsverk}.`,
        ];
      if (d.klyngeSvar === "ubesvart")
        return [TILSTAND.TRENGER_SVAR, "Kan ikke avgjøres uten svar fra arbeidsgiver."];
      if (d.klyngeSvar === "vetIkke")
        return [TILSTAND.IKKE_NOK_DATA, "Arbeidsgiver svarte «vet ikke». Det er ikke et nei."];
      if (d.klyngeSvar === "ja")
        return [TILSTAND.SLAR_UT, "Arbeidsgiver oppgir at fraværet er samlet i én del."];
      return [TILSTAND.SLAR_IKKE_UT, "Arbeidsgiver oppgir at fraværet ikke er samlet i én del."];
    },
  },
  {
    id: "gjentakende",
    navn: "Gjentakende korte fravær",
    prioritet: 2,
    grunnlag: "hybrid",
    vurder(d, a, T) {
      const grense = T.gjentakScreeningFaktor * a.bransjeKorttid;
      if (a.egenKorttid < grense)
        return [
          TILSTAND.SLAR_IKKE_UT,
          `Korte legemeldte fravær utgjør ${p0(a.egenKorttid)} av dagsverkene, under screeningen på ${p0(grense)}.`,
        ];
      if (d.gjentakelseSvar === "ubesvart")
        return [
          TILSTAND.TRENGER_SVAR,
          `Screeningen traff: ${p0(a.egenKorttid)} mot ${p0(a.bransjeKorttid)} i bransjen. Trenger bekreftelse.`,
        ];
      if (d.gjentakelseSvar === "vetIkke")
        return [TILSTAND.IKKE_NOK_DATA, "Arbeidsgiver svarte «vet ikke». Det er ikke et nei."];
      if (d.gjentakelseSvar === "ja")
        return [
          TILSTAND.SLAR_UT,
          `${p0(a.egenKorttid)} av dagsverkene er korte fravær, mot ${p0(a.bransjeKorttid)} i bransjen, og arbeidsgiver bekrefter gjentakelse.`,
        ];
      return [TILSTAND.SLAR_IKKE_UT, "Arbeidsgiver oppgir at det ikke er noen få som går igjen."];
    },
  },
  {
    id: "gradering",
    navn: "Lav gradering",
    prioritet: 3,
    grunnlag: "navtall",
    vurder(d, a, T) {
      if (d.bransjeGradering <= 0)
        return [TILSTAND.IKKE_NOK_DATA, "Mangler bransjetall for gradering."];
      const grense = T.graderingFaktor * d.bransjeGradering;
      if (d.egenGradering <= grense)
        return [
          TILSTAND.SLAR_UT,
          `${p0(d.egenGradering)} av dagsverkene delvis arbeidet, mot ${p0(d.bransjeGradering)} i bransjen. Grensen er ${p0(grense)}.`,
        ];
      return [
        TILSTAND.SLAR_IKKE_UT,
        `${p0(d.egenGradering)} delvis arbeidet ligger ikke under ${p0(grense)}.`,
      ];
    },
  },
  {
    id: "langtid",
    navn: "Langtid dominerer bildet",
    prioritet: 4,
    grunnlag: "navtall",
    vurder(d, a, T) {
      const grense = d.bransjeLangtidsandel + T.langtidAvvikPp;
      if (d.egenLangtidsandel >= grense)
        return [
          TILSTAND.SLAR_UT,
          `${p0(d.egenLangtidsandel)} av dagsverkene er fravær over 16 dager, mot ${p0(d.bransjeLangtidsandel)} i bransjen. Grensen er ${p0(grense)}.`,
        ];
      return [
        TILSTAND.SLAR_IKKE_UT,
        `${p0(d.egenLangtidsandel)} langtid ligger ikke ${T.langtidAvvikPp} prosentpoeng over bransjen.`,
      ];
    },
  },
];

function sikkerhet(valgt, d, T) {
  if (!valgt) return null;
  if (valgt.grunnlag !== "navtall") return "Middels";
  return d.muligeDagsverk >= T.godSikkerhetMinDagsverk ? "God" : "Middels";
}

export function kjorMotor(data, terskler) {
  const T = { ...STANDARDTERSKLER, ...terskler };
  const a = avled(data, T);

  if (data.maskert) {
    return {
      maskert: true,
      monster: "beredskap",
      sikkerhet: null,
      begrunnelse: [],
      ogsaaUtslag: [],
      utelukket: [],
      ikkeVurdert: REGLER.map((r) => r.id),
      sporsmaal: null,
      tiltak: "tiltak_beredskap",
      _vurderinger: REGLER.map((r) => ({
        ...r,
        tilstand: TILSTAND.IKKE_NOK_DATA,
        forklaring: "Nav publiserer ikke tall for denne virksomheten.",
      })),
      _avledet: a,
    };
  }

  const vurderinger = REGLER.map((r) => {
    const [tilstand, forklaring] = r.vurder(data, a, T);
    return { ...r, tilstand, forklaring };
  });

  const etter = (t) =>
    vurderinger.filter((v) => v.tilstand === t).sort((x, y) => x.prioritet - y.prioritet);

  const utslag = etter(TILSTAND.SLAR_UT);
  const valgt = utslag[0] || null;

  // Fase 2: still bare spørsmål som kan endre det som vises.
  const spm = etter(TILSTAND.TRENGER_SVAR).find(
    (r) => !valgt || r.prioritet < valgt.prioritet
  );

  return {
    maskert: false,
    monster: valgt ? valgt.id : "ingen_utslag",
    sikkerhet: sikkerhet(valgt, data, T),
    begrunnelse: valgt ? [valgt.forklaring] : [],
    ogsaaUtslag: utslag.slice(1).map((v) => v.id),
    utelukket: etter(TILSTAND.SLAR_IKKE_UT).map((v) => v.id),
    ikkeVurdert: etter(TILSTAND.IKKE_NOK_DATA).map((v) => v.id),
    sporsmaal: spm ? spm.id : null,
    tiltak: valgt ? `tiltak_${valgt.id}` : "tiltak_beredskap",
    _vurderinger: vurderinger,
    _avledet: a,
  };
}

/* ============================================================================
   SLUTT MOTOR
   ========================================================================= */

/* Tekst som data. Flyttes til innhold/tekster.nb.json. */

const TEKST = {
  monster: {
    klynge: {
      tittel: "Fraværet er samlet i én del av virksomheten",
      brod: (d, a) =>
        "Du oppgir at fraværet i hovedsak ligger i én rolle eller ett skiftlag. Når fraværet klumper seg slik, handler det oftere om arbeidsbelastning, bemanning eller nærmeste leder enn om de enkelte ansatte.",
      tall: null,
    },
    gjentakende: {
      tittel: "Mye av fraværet er korte fravær",
      brod: (d, a) =>
        `${p0(a.egenKorttid)} av fraværsdagene deres kom fra fravær under 16 dager, mot ${p0(a.bransjeKorttid)} i bransjen. Du bekrefter at det er noen få som går igjen. Det peker mot oppfølging og dialog med dem det gjelder, ikke mot brede arbeidsmiljøtiltak.`,
      tall: (d, a) => [
        ["Korte fravær hos dere", p0(a.egenKorttid)],
        ["I bransjen", p0(a.bransjeKorttid)],
        ["Delvis arbeidet", p0(d.egenGradering)],
      ],
    },
    gradering: {
      tittel: "Lite av fraværet deres blir delvis arbeidet",
      brod: (d) =>
        `${p0(d.egenGradering)} av fraværsdagene deres ble delvis arbeidet, mot ${p0(d.bransjeGradering)} i bransjen. Gradert sykmelding er ett av de få virkemidlene der forskningen peker i samme retning: folk kommer i gjennomsnitt raskere tilbake i full jobb.`,
      tall: (d) => [
        ["Delvis arbeidet", p0(d.egenGradering)],
        ["I bransjen", p0(d.bransjeGradering)],
        ["Fraværsdager i alt", Math.round(d.tapteDagsverk).toLocaleString("nb-NO")],
      ],
    },
    langtid: {
      tittel: "Langvarige fravær dominerer bildet",
      brod: (d) =>
        `${p0(d.egenLangtidsandel)} av fraværsdagene deres kom fra fravær som varte lenger enn 16 dager, mot ${p0(d.bransjeLangtidsandel)} i bransjen. Årsaken til langvarig fravær ligger ofte utenfor det arbeidsplassen kan påvirke — men tilbakeføringen ligger godt innenfor.`,
      tall: (d) => [
        ["Over 16 dager", p0(d.egenLangtidsandel)],
        ["I bransjen", p0(d.bransjeLangtidsandel)],
        ["Delvis arbeidet", p0(d.egenGradering)],
      ],
    },
    ingen_utslag: {
      tittel: "Vi ser ingen tydelige mønstre i tallene deres",
      brod: (d) =>
        `Sykefraværet deres er ${p1(d.egenFravaersprosent)}, mot ${p1(d.bransjeFravaersprosent)} i bransjen. Fordelingen mellom korte og lange fravær, og hvor mye som blir delvis arbeidet, ligger nær bransjen ellers.`,
      tall: (d) => [
        ["Sykefravær hos dere", p1(d.egenFravaersprosent)],
        ["I bransjen", p1(d.bransjeFravaersprosent)],
        ["Fraværsdager i alt", Math.round(d.tapteDagsverk).toLocaleString("nb-NO")],
      ],
    },
    beredskap: {
      tittel: "Vi kan ikke vise tall for denne virksomheten",
      brod: () =>
        "Nav viser ikke sykefraværstall for virksomheter med få personer, fordi tallene da kan si noe om enkeltpersoner. Med så få ansatte er svingningene dessuten tilfeldige — ett langvarig fravær flytter fraværsprosenten kraftig uten at noe har endret seg hos dere.",
      tall: null,
    },
  },

  utelukket: {
    klynge: "Du oppgir at fraværet ikke er samlet i én rolle eller ett skiftlag.",
    gjentakende:
      "Korte legemeldte fravær utgjør ikke en større del av fraværet deres enn i bransjen.",
    gradering: "Andelen av fraværet som blir delvis arbeidet ligger ikke lavere enn i bransjen.",
    langtid: "Langvarige fravær utgjør ikke en større del av fraværet deres enn i bransjen.",
  },

  sporsmaal: {
    klynge: {
      tekst: "Er fraværet samlet i én rolle eller ett skiftlag?",
      hvorfor:
        "Nav har bare tall for virksomheten samlet, og kan ikke se hvordan fraværet fordeler seg inne i den. Svaret ditt er det eneste grunnlaget vi kan ha for dette.",
    },
    gjentakende: {
      tekst: "Er det noen få som går igjen med korte fravær?",
      hvorfor:
        "Nav ser ikke egenmeldt fravær. Hvis dere har mange korte fravær som ikke er sykmeldt, er det bare du som vet det.",
    },
  },

  tiltak: {
    tiltak_klynge: {
      tittel: "Snakk med den delen det gjelder, samlet",
      hvorfor:
        "Ta det med gruppen og verneombudet i samme rom, ikke én og én. Arbeidsmiljøhjelpen har et opplegg tilpasset bransjen deres.",
      tid: ["20 min nå", "45 min om to uker", "15 min i uke 10"],
      knapp: "Forbered møtet",
    },
    tiltak_gjentakende: {
      tittel: "Ta en samtale med hver av dem det gjelder",
      hvorfor:
        "Ikke om fraværet i seg selv, men om hva som gjør det vanskelig å stå i jobben. Du får forslag til åpningsspørsmål og en oversikt over hva du ikke har lov til å spørre om.",
      tid: ["10 min nå", "15 min om to uker", "5 min i uke 8"],
      knapp: "Forbered samtalen",
    },
    tiltak_gradering: {
      tittel: "Se på hva folk kan gjøre, ikke hva de ikke kan",
      hvorfor:
        "Neste gang noen sykmeldes: kartlegg arbeidsoppgavene som fortsatt går an. Nav kan dekke tilrettelegging gjennom tilretteleggingstilskudd.",
      tid: ["15 min nå", "10 min per ny sykmelding"],
      knapp: "Sett i gang",
    },
    tiltak_langtid: {
      tittel: "Hold kontakten mens de er borte",
      hvorfor:
        "Jevn, lav kontakt gjør tilbakeføringen kortere. Du trenger ikke vite hva de feiler for å planlegge hva de skal komme tilbake til.",
      tid: ["10 min nå", "10 min hver tredje uke"],
      knapp: "Sett i gang",
    },
    tiltak_beredskap: {
      tittel: "Gjør deg klar til neste sykmelding",
      hvorfor:
        "Det mest lønnsomme du kan gjøre nå er å slå på varsler. Da får du beskjed om fristene når det først skjer noe, i stedet for å måtte finne ut av reglene midt i en travel uke.",
      tid: ["5 min nå", "Så ingenting før det trengs"],
      knapp: "Slå på varsler",
      frister: [
        ["4 uker", "Oppfølgingsplan skal være klar og sendt til den som har sykmeldt"],
        ["7 uker", "Du skal kalle inn til dialogmøte"],
        ["26 uker", "Nav kaller inn til dialogmøte 2"],
      ],
    },
  },
};

const SCENARIER = {
  bakeriet: {
    navn: "Bakeriet AS",
    data: {
      maskert: false,
      egenFravaersprosent: 7.4,
      bransjeFravaersprosent: 6.1,
      egenLangtidsandel: 78,
      bransjeLangtidsandel: 88,
      egenGradering: 21,
      bransjeGradering: 24,
      tapteDagsverk: 310,
      muligeDagsverk: 4200,
      klyngeSvar: "ubesvart",
      gjentakelseSvar: "ubesvart",
    },
  },
  fjordbo: {
    navn: "Fjordbo Omsorg AS",
    data: {
      maskert: false,
      egenFravaersprosent: 9.2,
      bransjeFravaersprosent: 8.1,
      egenLangtidsandel: 72,
      bransjeLangtidsandel: 68,
      egenGradering: 9,
      bransjeGradering: 24,
      tapteDagsverk: 1180,
      muligeDagsverk: 12800,
      klyngeSvar: "ubesvart",
      gjentakelseSvar: "ubesvart",
    },
  },
  solsiden: {
    navn: "Solsiden barnehage",
    data: {
      maskert: false,
      egenFravaersprosent: 7.2,
      bransjeFravaersprosent: 6.4,
      egenLangtidsandel: 81,
      bransjeLangtidsandel: 68,
      egenGradering: 22,
      bransjeGradering: 24,
      tapteDagsverk: 640,
      muligeDagsverk: 6900,
      klyngeSvar: "ubesvart",
      gjentakelseSvar: "ubesvart",
    },
  },
  nordvik: {
    navn: "Nordvik Rør AS",
    data: {
      maskert: true,
      egenFravaersprosent: 0,
      bransjeFravaersprosent: 5.4,
      egenLangtidsandel: 0,
      bransjeLangtidsandel: 74,
      egenGradering: 0,
      bransjeGradering: 28,
      tapteDagsverk: 0,
      muligeDagsverk: 1380,
      klyngeSvar: "ubesvart",
      gjentakelseSvar: "ubesvart",
    },
  },
};

/* ---------------------------- Delkomponenter ----------------------------- */

function Skyv({ etikett, verdi, min, max, steg = 1, suffiks = "", onChange }) {
  return (
    <div className="skyv">
      <div className="skyv__rad">
        <span className="skyv__etikett">{etikett}</span>
        <span className="skyv__verdi">
          {verdi}
          {suffiks}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={steg}
        value={verdi}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function Svarvalg({ etikett, verdi, onChange }) {
  const valg = [
    ["ubesvart", "Ubesvart"],
    ["ja", "Ja"],
    ["nei", "Nei"],
    ["vetIkke", "Vet ikke"],
  ];
  return (
    <div className="skyv">
      <div className="skyv__rad">
        <span className="skyv__etikett">{etikett}</span>
      </div>
      <div className="valg">
        {valg.map(([v, l]) => (
          <button
            key={v}
            className={"valg__knapp" + (verdi === v ? " valg__knapp--valgt" : "")}
            onClick={() => onChange(v)}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function Merke({ tilstand }) {
  const tekst = {
    SLAR_UT: "SLÅR UT",
    SLAR_IKKE_UT: "SLÅR IKKE UT",
    IKKE_NOK_DATA: "IKKE NOK DATA",
    TRENGER_SVAR: "TRENGER SVAR",
  }[tilstand];
  return <span className={`merke merke--${tilstand}`}>{tekst}</span>;
}

function Tiltakskort({ tiltak, ingentingHaster, onSvar }) {
  return (
    <div className="kort kort--tiltak">
      <span className="tagg tagg--aksent">
        {ingentingHaster ? "Ingenting haster" : "Én ting nå"}
      </span>
      <p className="tiltak__tittel">{tiltak.tittel}</p>
      <p className="brodtekst">{tiltak.hvorfor}</p>

      {tiltak.frister && (
        <div className="liste">
          {tiltak.frister.map(([naar, hva]) => (
            <p className="liste__rad" key={naar}>
              <strong>{naar}</strong> · {hva}
            </p>
          ))}
        </div>
      )}

      <div className="tid" style={{ marginTop: tiltak.frister ? 16 : 0 }}>
        {tiltak.tid.map((t) => (
          <span className="tid__brikke" key={t}>
            {t}
          </span>
        ))}
      </div>

      <div className="knapper">
        <button className="knapp">{tiltak.knapp}</button>
        <button className="knapp knapp--sekundar" onClick={onSvar}>
          Hvorfor akkurat dette?
        </button>
      </div>
      <p className="fotnote">Vi ser på dette igjen når neste kvartal er publisert.</p>
    </div>
  );
}

function Skjerm({ navn, data, ut, onSvar }) {
  const m = TEKST.monster[ut.monster];
  const tiltak = TEKST.tiltak[ut.tiltak];
  const a = ut._avledet;

  // Maks én utelukkingssetning, og aldri fra mønsteret som vises.
  const negId = ut.utelukket.filter((id) => id !== ut.monster)[0];
  const neg = negId ? TEKST.utelukket[negId] : null;

  const tall = m.tall ? m.tall(data, a) : null;
  const spm = ut.sporsmaal ? TEKST.sporsmaal[ut.sporsmaal] : null;

  return (
    <div>
      <div className="kort">
        <div className="kort__hode">
          <span>{navn}</span>
          <span>Til og med 2. kvartal</span>
        </div>

        {ut.sikkerhet && <span className="tagg">Treffsikkerhet: {ut.sikkerhet}</span>}

        <p className="etikett">Fraværsbildet ditt</p>
        <h2 className="overskrift">{m.tittel}</h2>
        <p className={"brodtekst" + (neg ? "" : " brodtekst--sist")}>{m.brod(data, a)}</p>
        {neg && <p className="brodtekst brodtekst--sist">{neg}</p>}

        {ut.maskert && (
          <p className="brodtekst brodtekst--sist" style={{ marginTop: 10 }}>
            Det betyr ikke at det ikke er noe å gjøre. Det betyr at analyse ikke er det som
            hjelper dere.
          </p>
        )}

        {tall && (
          <div className="tall">
            {tall.map(([etikett, verdi]) => (
              <div className="tall__kort" key={etikett}>
                <p className="tall__etikett">{etikett}</p>
                <p className="tall__verdi">{verdi}</p>
              </div>
            ))}
          </div>
        )}

        {ut.monster === "klynge" && (
          <div className="boks">
            <p className="etikett" style={{ marginBottom: 6 }}>
              Grunnlag
            </p>
            <p className="boks__tekst">
              Dette mønsteret bygger på din egen vurdering, ikke på tall fra Nav. Derfor er
              treffsikkerheten aldri høyere enn middels.
            </p>
            <p className="hjelpetekst">
              Bakgrunn: sykefraværet samlet er {p1(data.egenFravaersprosent)}, mot{" "}
              {p1(data.bransjeFravaersprosent)} i bransjen.
            </p>
          </div>
        )}

        {spm && (
          <div className="boks">
            <p className="etikett" style={{ marginBottom: 6 }}>
              Ett spørsmål til deg
            </p>
            <p className="boks__tekst" style={{ marginBottom: 10 }}>
              {spm.tekst}
            </p>
            <p className="hjelpetekst" style={{ margin: "0 0 12px" }}>
              {spm.hvorfor}
            </p>
            <div className="knapper">
              <button className="knapp" onClick={() => onSvar(ut.sporsmaal, "ja")}>
                Ja
              </button>
              <button className="knapp knapp--sekundar" onClick={() => onSvar(ut.sporsmaal, "nei")}>
                Nei
              </button>
              <button
                className="knapp knapp--sekundar"
                onClick={() => onSvar(ut.sporsmaal, "vetIkke")}
              >
                Vet ikke
              </button>
            </div>
          </div>
        )}
      </div>

      <Tiltakskort
        tiltak={tiltak}
        ingentingHaster={ut.monster === "beredskap" || ut.monster === "ingen_utslag"}
        onSvar={() => {}}
      />

      {ut.ogsaaUtslag.length > 0 && (
        <p className="hjelpetekst">
          Skjult av prioritetsrekkefølgen:{" "}
          {ut.ogsaaUtslag.map((id) => TEKST.monster[id].tittel.toLowerCase()).join(", ")}.
        </p>
      )}
    </div>
  );
}

/* --------------------------------- App ----------------------------------- */

export default function Regelmotor() {
  const [scenario, setScenario] = useState("fjordbo");
  const [data, setData] = useState(SCENARIER.fjordbo.data);
  const [T, setT] = useState(STANDARDTERSKLER);
  const [visTerskler, setVisTerskler] = useState(false);

  const ut = useMemo(() => kjorMotor(data, T), [data, T]);

  const bytt = (k) => {
    setScenario(k);
    setData({ ...SCENARIER[k].data });
  };
  const endre = (felt) => (v) => setData((p) => ({ ...p, [felt]: v }));
  const svar = (regelId, verdi) =>
    setData((p) => ({
      ...p,
      [regelId === "klynge" ? "klyngeSvar" : "gjentakelseSvar"]: verdi,
    }));

  return (
    <div className="app">
      <div className="app__topp">
        <h1 className="app__tittel">Fraværsbildet — regelmotor</h1>
        <p className="app__ingress">
          Reglene kjører på Navs egne tall. Arbeidsgiveren svarer på maks ett spørsmål, og bare
          når svaret kan endre utfallet.
        </p>
        <div className="scenarier">
          {Object.entries(SCENARIER).map(([k, s]) => (
            <button
              key={k}
              className={"scenario" + (scenario === k ? " scenario--valgt" : "")}
              onClick={() => bytt(k)}
            >
              {s.navn}
            </button>
          ))}
        </div>
      </div>

      <div className="app__grid">
        <div className="konsoll">
          <div className="konsoll__bolk konsoll__bolk--forst">DATA FRA NAV</div>
          <Skyv
            etikett="Maskert (for få personer)"
            verdi={data.maskert ? 1 : 0}
            min={0}
            max={1}
            onChange={(v) => endre("maskert")(v === 1)}
          />
          <Skyv
            etikett="Sykefravær, egen"
            verdi={data.egenFravaersprosent}
            min={0}
            max={25}
            steg={0.1}
            suffiks=" %"
            onChange={endre("egenFravaersprosent")}
          />
          <Skyv
            etikett="Sykefravær, bransje"
            verdi={data.bransjeFravaersprosent}
            min={0}
            max={25}
            steg={0.1}
            suffiks=" %"
            onChange={endre("bransjeFravaersprosent")}
          />
          <Skyv
            etikett="Langtidsandel, egen"
            verdi={data.egenLangtidsandel}
            min={0}
            max={100}
            suffiks=" %"
            onChange={endre("egenLangtidsandel")}
          />
          <Skyv
            etikett="Langtidsandel, bransje"
            verdi={data.bransjeLangtidsandel}
            min={0}
            max={100}
            suffiks=" %"
            onChange={endre("bransjeLangtidsandel")}
          />
          <Skyv
            etikett="Gradering, egen"
            verdi={data.egenGradering}
            min={0}
            max={100}
            suffiks=" %"
            onChange={endre("egenGradering")}
          />
          <Skyv
            etikett="Gradering, bransje"
            verdi={data.bransjeGradering}
            min={0}
            max={100}
            suffiks=" %"
            onChange={endre("bransjeGradering")}
          />
          <Skyv
            etikett="Tapte dagsverk"
            verdi={data.tapteDagsverk}
            min={0}
            max={5000}
            steg={10}
            onChange={endre("tapteDagsverk")}
          />
          <Skyv
            etikett="Mulige dagsverk"
            verdi={data.muligeDagsverk}
            min={200}
            max={60000}
            steg={100}
            onChange={endre("muligeDagsverk")}
          />

          <div className="konsoll__bolk">
            SVAR FRA ARBEIDSGIVER · {ut._avledet.aarsverk.toFixed(0)} ÅRSVERK
          </div>
          <Svarvalg
            etikett="Samlet i én rolle eller skift?"
            verdi={data.klyngeSvar}
            onChange={endre("klyngeSvar")}
          />
          <Svarvalg
            etikett="Noen få som går igjen?"
            verdi={data.gjentakelseSvar}
            onChange={endre("gjentakelseSvar")}
          />

          <button className="konsoll__knapp" onClick={() => setVisTerskler(!visTerskler)}>
            {visTerskler ? "▾" : "▸"} TERSKLER
          </button>
          {visTerskler && (
            <div>
              <Skyv
                etikett="Klynge: min. årsverk"
                verdi={T.klyngeMinAarsverk}
                min={2}
                max={100}
                onChange={(v) => setT({ ...T, klyngeMinAarsverk: v })}
              />
              <Skyv
                etikett="Gjentakelse: screeningfaktor"
                verdi={T.gjentakScreeningFaktor}
                min={1}
                max={4}
                steg={0.1}
                suffiks="×"
                onChange={(v) => setT({ ...T, gjentakScreeningFaktor: v })}
              />
              <Skyv
                etikett="Gradering: andel av bransje"
                verdi={Math.round(T.graderingFaktor * 100)}
                min={10}
                max={100}
                suffiks=" %"
                onChange={(v) => setT({ ...T, graderingFaktor: v / 100 })}
              />
              <Skyv
                etikett="Langtid: avvik fra bransje"
                verdi={T.langtidAvvikPp}
                min={1}
                max={40}
                suffiks=" pp"
                onChange={(v) => setT({ ...T, langtidAvvikPp: v })}
              />
              <Skyv
                etikett="God sikkerhet: min. dagsverk"
                verdi={T.godSikkerhetMinDagsverk}
                min={100}
                max={10000}
                steg={100}
                onChange={(v) => setT({ ...T, godSikkerhetMinDagsverk: v })}
              />
            </div>
          )}

          <div className="konsoll__bolk">REGELTILSTANDER</div>
          {ut._vurderinger.map((v) => (
            <div className={`regel regel--${v.tilstand}`} key={v.id}>
              <div className="regel__topp">
                <span className="regel__navn">
                  {v.prioritet}. {v.navn}
                </span>
                <Merke tilstand={v.tilstand} />
              </div>
              <p className="regel__forklaring">{v.forklaring}</p>
            </div>
          ))}

          <div className="konsoll__bolk">DATAKONTRAKT</div>
          <pre className="kontrakt">
            {JSON.stringify(
              {
                monster: ut.monster,
                sikkerhet: ut.sikkerhet,
                ogsaaUtslag: ut.ogsaaUtslag,
                utelukket: ut.utelukket,
                ikkeVurdert: ut.ikkeVurdert,
                sporsmaal: ut.sporsmaal,
                tiltak: ut.tiltak,
              },
              null,
              2
            )}
          </pre>
        </div>

        <div>
          <p className="skjerm__merkelapp">DET ARBEIDSGIVEREN SER</p>
          <Skjerm navn={SCENARIER[scenario].navn} data={data} ut={ut} onSvar={svar} />
          <p className="hjelpetekst">
            Skjermen er generert fra datakontrakten. All tekst ligger i et eget objekt, ikke i
            motoren.
          </p>
        </div>
      </div>
    </div>
  );
}
