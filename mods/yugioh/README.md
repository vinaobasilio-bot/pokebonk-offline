# PokéBonk Offline com Yu-Gi-Oh! — teste

A Liga inclui 138 monstros jogáveis de Yu-Gi-Oh!. A preparação baixa os 120 modelos e retratos adicionais do Yuginimo e guarda os arquivos em cache. Os modelos usam movimento procedural por família, incluindo movimento de asas nos modelos com rig compatível. Ataques, mapas e atributos usam o PokéBonk.

Com Node.js 24.12+ e pnpm 10.33.2, na pasta do projeto:

```sh
pnpm install --frozen-lockfile
pnpm prepare:game
pnpm preview
```

Abra http://127.0.0.1:8098. Este teste é local e usa o snapshot offline do projeto.

As Poké Balls pagas, gratuitas e amaldiçoadas do campo usam o Pote da Ganância. Modelo texturizado de Yu-Gi-Oh! Master Duel, fornecido para este teste e ajustado à escala do campo.
