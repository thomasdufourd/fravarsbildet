# Fraværsbildet

Installér med

```pnpm install```

Start applikasjonen med 

```pnpm dev```

Åpne [http://localhost:5173](http://localhost:5173) i nettleseren din.

## Bruk av Claude code i en sandboks

Install `claude code` with brew (CLI for Claude code)
```brew install --cask claude-code```

Install `sbx` with brew (+ krever en konto hos docker-hub hvor du bare aktiverer en kode)
```brew install sbx```

Kjør ```sbx run claude```

## Kjøre applikasjon fra en sandboks
Bare engang: 
Fra host (dvs utenfor sandboksen) kjør ```publish-port.sh``` for å publisere porten til sandboksen. Dette gjør at du kan få tilgang til applikasjonen fra nettleseren din.

Build i sandboksen med ```pnpm install``` og ```pnpm build```.

Kjør ```start.sh``` fra sandboksen for å starte applikasjonen. Dette vil starte en lokal server som du kan få tilgang til via nettleseren din.

