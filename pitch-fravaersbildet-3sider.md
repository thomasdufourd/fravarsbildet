# Fraværsbildet

**Internt notat til teamet.** Spekulativt arbeid, ikke et oppdrag. Tenkt eier: NAV. Brukere: arbeidsgivere i små og mellomstore virksomheter.

## Problemet

En arbeidsgiver med økende sykefravær googler «hva gjør vi med sykefraværet» og drukner. Det skyldes ikke mangel på informasjon — Arbeidsmiljøportalen, Arbeidstilsynet og Idébanken er fulle av god kunnskap. Det skyldes at ingen kobler *hennes* tall til *hvilket* råd som gjelder henne.

Sykefravær er ikke ett fenomen. Samme prosent kan skjule langtidsfravær med årsak utenfor jobben, gjentakende korttidsfravær hos to personer, en klynge på ett skiftlag, eller lav bruk av gradert sykmelding. Tiltakene er helt forskjellige. Alt rådgivningsinnhold er skrevet for «sykefravær» generelt.

## Innsikten

**NAV har tallene. Arbeidsgiveren har konteksten. Ingen setter dem sammen.**

NAV vet hvem som er sykmeldt, hvor lenge og med hvilken grad. De vet ikke om fraværet ligger på ett skiftlag, om det er de samme to personene hver gang, eller om det finnes andre oppgaver å tilrettelegge med. Det er der produktet bor — og det er noe bare NAV kan bygge.

## Veiledning er ikke en tilleggstjeneste

NAV har allerede en alminnelig veiledningsplikt etter forvaltningsloven overfor dem som henvender seg. IA-avtalen 2025–2028 forsterker dette: partene har forpliktet seg til å bidra til forsterket innsats på den enkelte arbeidsplass gjennom økt informasjons- og opplæringsaktivitet rettet mot virksomhetene, og til å øke kunnskapen om sykefravær og virkningsfulle tiltak.

Dette er ikke et nytt mål. Det er en operasjonalisering av forpliktelser som allerede er signert, i den perioden avtalen setter av til å iverksette nye tiltak.

**Læring er et biprodukt, ikke et formål.** Ingen arbeidsgiver etterspør opplæring. De etterspør et svar på ett spørsmål, akkurat nå, midt i en travel uke. Forståelse bygges av å få gode, begrunnede svar gjentatte ganger — ikke av en kursmodul. Derfor er den viktigste læringsmekanismen ikke veiledningsteksten, men at hver anbefaling alltid kommer med en begrunnelse.

**Hva NAV kan og ikke kan svare på.** Grensen må være eksplisitt i produktet, ikke bare i vilkårene, fordi et svar fra NAV er kvasi-autoritativt:

| Kategori | Eksempel | Håndtering |
|---|---|---|
| Kan besvares | Frister, regelverk, hvilke ordninger som finnes, hva forskningen sier | Godkjent svar med kilde |
| Krever et menneske | Sammensatte forhold i egen virksomhet | Rutes til Arbeidsgivertelefonen eller Arbeidslivssenteret |
| Skal aldri besvares | Oppsigelse, diagnoser, navngitte ansatte, erstatningskrav | Rutes videre, med tilbud om det tilstøtende NAV faktisk kan svare på |

Den tredje kategorien er viktigst. At tjenesten sier tydelig fra om hva den ikke vurderer, er det som gjør at de to første kan stoles på.

## To PoC-er

**PoC 1 — regelmotoren.** Fra tall til mønster til én handling. Ingen KI.

**PoC 2 — KI som forstår spørsmålet.** Klassifisering, matching og omformulering mot et godkjent korpus. Modellen skriver aldri svaret.

De kan leveres uavhengig. PoC 1 har verdi alene.

---

## PoC 1 — Regelmotoren

**Mål:** vise at få tall fra arbeidsgiveren kan gi ett begrunnet, etterprøvbart mønster — og at verktøyet holder kjeft når grunnlaget er for tynt.

**Inndata: åtte tall.** Ansatte, fraværstilfeller siste 12 måneder, hvor mange av dem som varte over 16 dager, antall sykmeldte personer, hvor mange av disse som var delvis sykmeldt, personer med fire eller flere korttidsfravær, korttidstilfeller hos disse, og om fraværet er samlet i én avdeling, rolle eller skift (ja / nei / vet ikke). I produksjon forhåndsutfylles det NAV allerede har.

**Utdata: fem mulige mønstre.** Klynge i én enhet, gjentakende korttid hos få personer, lav gradering, langtid dominerer bildet, eller for lite data til å se et mønster.

**Tre designbeslutninger som er hele poenget:**

1. **Ordnet regelliste, ikke scoringsmodell.** En vektet score er umulig å forklare til en arbeidsgiver som spør hvorfor. En prioritert regelliste gir en begrunnelse som allerede er en setning.
2. **Tre tilstander per regel:** slår ut, slår ikke ut, mangler datagrunnlag. Bare den midterste gir lov til å påstå at noe *ikke* er tilfelle. «Vet ikke» fra arbeidsgiveren mapper til manglende datagrunnlag, aldri til nei.
3. **To uavhengige terskler.** Mønsterterskelen avgjør om vi kan påstå noe — og hver regel har sitt eget beviskrav. Visningsterskelen avgjør om vi kan vise et tall: totaler for egen virksomhet alltid, nedbrytninger og andeler krever minst fem i gruppen, diagnose aldri. Under terskelen byttes tall mot setninger, med en forklaring på hvorfor.

**Datakontrakt.** Motoren returnerer struktur, ikke tekst: mønster, sikkerhet, begrunnelse, utelukket, ikkeVurdert, visningsmodus, tiltak. Tekst genereres fra kontrakten og ligger i egne filer, slik at klarspråk og nynorsk kan endres uten å røre logikk.

**Teknologi.** Vite, React, TypeScript og Aksel. Motoren er rene funksjoner uten UI-avhengigheter, med tabelldrevne tester. Ingen backend, ingen innlogging, ingen NAV-API-er. Tre scenariofiler: bedrift med 9, 30 og 200 ansatte.

**Skisse av grensesnittet** (erstatt med skjermbilde fra den kjørende versjonen):

```
 INSTRUMENTPANEL              DET ARBEIDSGIVEREN SER
 ─────────────────            ────────────────────────────────
 Inndata                      Bakeriet AS · 9 ansatte
  Ansatte          [==o--] 9
  Tilfeller        [===o-] 19 Fraværsbildet ditt
  Over 16 dager    [o----]  2 GJENTAKENDE KORTTIDSFRAVÆR
  Sykmeldte        [o----]  3 HOS FÅ PERSONER
  4+ korttid       [o----]  2 To personer står bak 14 av 19
  Tilfeller hos disse [==o] 14 fraværstilfeller det siste året.
  Samlet i én enhet?    Nei
                              Tilfeller  Konsentr.  Sikkerhet
 Terskler                        19        2 av 9    Middels
  Vise tall: min.   [o----]  5
  Enhet: min.       [==o--] 20 Tallene er hentet fra sykmeld-
  Andel av korttid  [===o-] 60% ingene NAV allerede har.
 ─────────────────
 Regeltilstander              ── ÉN TING NÅ ──────────────────
  1 Klynge i enhet   IKKE NOK  Ta en samtale med hver av de to
  2 Gjentakende      SLÅR UT   Ikke om fraværet, men om hva som
  3 Lav gradering    IKKE NOK  gjør det vanskelig å stå i jobben.
  4 Langtid          SLÅR IKKE
                              [10 min nå] [15 min om to uker]
 Datakontrakt (JSON)
  { mønster, sikkerhet, ... } [ Sett i gang ]
```

Venstre side er utviklerverktøy, høyre side er tjenesten. At de samme dataene vises to ganger er med vilje: det gjør at vi kan peke på hvorfor teksten sier det den sier, og justere en terskel live i et møte.

---

## PoC 2 — KI som forstår spørsmålet

**Mål:** vise at arbeidsgiverspørsmål kan rutes til godkjent innhold med målbar treffsikkerhet, uten at en modell noen gang formulerer svaret.

**Premisset, som ikke er forhandlingsbart:** NAV er et forvaltningsorgan. Et svar fra NAV leses som autoritativt, og en arbeidsgiver som handler på det kan komme i juridisk og økonomisk klemme. Derfor kan ikke en språkmodell generere svar direkte til arbeidsgiveren, slik en vanlig chatbot gjør. Alle svar er skrevet og godkjent av fagfolk på forhånd og leveres ordrett.

**Modellens jobb er å finne riktig svar, ikke å skrive det.** Tre oppgaver, alle av typen «forstå spørsmålet»:

- **Omformulering** — utvid spørsmålet før søk. «Kan jeg kreve legeerklæring på dag 2» må finne oppslaget om egenmelding. Folkelige ord til fagtermer, forkortelser, vanlige feilstavinger.
- **Klassifisering** — hvilket tema, og treffer det sperrelisten etter omformulering.
- **Matching** — mot korpuset, med en likhetsterskel som avgjør treff eller ikke treff.

**Sperrelisten er regler og kjører før modellen ser spørsmålet.** Oppsigelse, diagnose, navngitte personer, erstatningskrav rutes videre uansett hvor godt et treff korpuset måtte ha. En modellbasert klassifisering kan ligge som ekstra nett bak reglene, men reglene bestemmer.

**Inngang i grensesnittet.** Ikke en chatboble nederst til høyre. Spørsmålet stilles fra skjermen brukeren står på, og systemet vet hva den handler om. De predefinerte forslagene genereres fra regelmotorens tilstand — de fire eller fem spørsmålene arbeidsgivere i akkurat den situasjonen faktisk stiller. Fritekstfeltet er sikkerhetsventilen; anslagsvis 70–80 prosent av bruken vil gå gjennom forslagene, fordi de fleste ikke vet hva de skal spørre om.

**Korpuset.** 25–40 oppslag, hvert med kanonisk spørsmål, godkjent svar, kilde, sikkerhetsgrad (regelverk / forskning / erfaring), tema, og hvilke mønstre fra PoC 1 det er relevant for. Alt som JSON.

**Datakontrakt.** Samme prinsipp som i regelmotoren: `{ kategori, sperret, treffId, likhet, handling }`, der handling er *svar*, *rute videre* eller *be om presisering*.

**Leveransen er en måling, ikke en fungerende chat.** Ingen blir overbevist av at en modell svarte fint på tre spørsmål i et møterom. 60–80 realistiske spørsmål skrevet som arbeidsgivere faktisk skriver dem, med håndmerket forventet utfall, gir tre tall som betyr noe:

1. **Sperre-recall må være 100 prosent.** Et sperret tema som slipper gjennom er den eneste virkelig uakseptable feilen.
2. **Treffpresisjon** blant de vi svarte på. Et selvsikkert feil svar er verre enn ingen svar.
3. **Rutingandel.** Høy andel er ærlig, men et produkt som ruter 60 prosent videre er ikke ferdig.

Tersklene settes slik at feil treff er sjeldnere enn ingen treff. Samme filosofi som i regelmotoren: standardtilstanden er taushet, og hvert svar må fortjene å bli sagt. «Ingen treff» er da ikke en feil, men produktets viktigste signal — hvert ubesvart spørsmål er en bestilling på innhold NAV mangler.

**Demoen** er to visninger: spørsmålsflyten med likhetsscoren synlig, og en evalueringstabell over hele settet. Den andre er den vi viser NAV.

## Rammer og risiko

Tidsboks: to uker, én dag i uka. Vi har ikke mandat fra NAV, og det skal koste lite nok at det er greit om det ikke går videre.

Uansett utfall sitter vi igjen med en demonstrasjon av en arkitektur der alt som må kunne forsvares ligger i eksplisitte regler, og modellen bare gjør den delen der en feil er billig. Det mønsteret kan gjenbrukes i alle offentlige oppdrag der KI skal inn.

**Det jeg ikke har løst:** partssamarbeidet. Verneombud og tillitsvalgte er ikke i designet. IA-avtalen vektlegger nettopp samarbeidet mellom leder, verneombud og tillitsvalgte, så det er et hull noen kommer til å peke på. Vi bør ta det opp selv før de gjør det.

---

## Vedlegg — regelspesifikasjon

Til utviklerne. Alle tall er startverdier, ikke sannheter, og bør kalibreres mot NAVs faktiske data. De ligger samlet i ett terskelobjekt og kan endres uten å røre logikken.

Beviskravet vurderes alltid før betingelsene. En regel som ikke innfrir beviskravet står i tilstanden *ikke nok data* — den kan verken slå ut eller brukes til å utelukke noe.

### 01 — Klynge i én enhet

| | Betingelse | Merknad |
|---|---|---|
| Beviskrav | `ansatte >= 20` | under dette finnes ingen enheter å sammenligne |
| Beviskrav | `svar != "vetIkke"` | «vet ikke» er ikke et nei |
| Slår ut | `svar == "ja"` | arbeidsgiver oppgir at fraværet er samlet |
| Slår ikke ut | `svar == "nei"` | |

### 02 — Gjentakende korttid hos få personer

Avledet: `korttid = tilfeller - langtid`

| | Betingelse | Merknad |
|---|---|---|
| Beviskrav | `korttid >= 6` | for få hendelser til å se konsentrasjon |
| Slår ut | `gjentakere >= 1` | personer med fire eller flere korttidsfravær |
| og | `tilfellerHosGjentakere / korttid >= 0.60` | de står bak nok av fraværet |
| og | `gjentakere / ansatte <= 0.25` | ellers er det ikke «få personer» |
| Slår ikke ut | én av de tre bryter | |

De to siste betingelsene trekker med vilje i motsatt retning: andelen av fraværet skal være høy, andelen av de ansatte skal være lav. Uten den siste ville en bedrift på fire ansatte alltid slått ut, siden to personer nødvendigvis står bak det meste.

### 03 — Lav gradering

| | Betingelse | Merknad |
|---|---|---|
| Beviskrav | `sykmeldtePersoner >= 5` | nevnerregelen: andel kan ikke beregnes under dette |
| Slår ut | `egenAndel <= bransjesnitt - 20` | prosentpoeng; delvis sykmeldte i prosent av sykmeldte |
| Slår ikke ut | andelen ligger nærmere bransjen | |

### 04 — Langtid dominerer bildet

| | Betingelse | Merknad |
|---|---|---|
| Beviskrav | `tilfeller >= 4` | under dette er fordelingen støy |
| Slår ut | `langtid >= 1` | minst ett tilfelle over 16 dager |
| og | `langtid / tilfeller >= 0.50` | langtid dominerer bildet |
| Slår ikke ut | langtidsandelen er lavere | |

### Etter reglene

**Valg av mønster.** Laveste prioritetsnummer blant reglene som slår ut. Rekkefølgen er satt etter hva arbeidsgiveren kan påvirke, ikke etter signalstyrke — det er en policybeslutning som bør eies av partene, ikke av utviklerne. Slår ingen regel ut, er utfallet «for lite data». Taushet er standardtilstanden.

**Visningsterskelen er uavhengig av reglene.** `ansatte >= 5 && tilfeller >= 5` gir tallvisning, ellers setninger med en forklaring på hvorfor tall er utelatt. Andeler krever nevner på minst fem. Diagnose vises aldri, uansett størrelse.

**Sikkerhet.** `tilfeller >= 8` gir middels. `ansatte >= 20 && tilfeller >= 15` gir god. Tre eller flere regler uten datagrunnlag trekker ett hakk ned.

**Datakontrakt.** Motoren returnerer `{ mønster, sikkerhet, begrunnelse, ogsåUtslag, utelukket, ikkeVurdert, visningsmodus, tiltak }`. Ingen tekst. `utelukket` inneholder kun regler i tilstanden *slår ikke ut* — aldri regler uten datagrunnlag.

**Åpen designbeslutning.** Ved to samtidige utslag legges nummer to i `ogsåUtslag` og vises ikke. For en virksomhet med 200 ansatte er det trolig feil, men å vise to tiltak bryter med prinsippet om én handling om gangen. Grensen mellom målgruppene må avklares.
