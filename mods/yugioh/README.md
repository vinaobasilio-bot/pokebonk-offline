# PokéBonk Offline com Yu-Gi-Oh! — teste

Na Liga, escolha Dragão Supremo de Olhos Azuis no antigo slot do Charmander. O modelo 3D do Yugibonk aparece na partida desde o início e nas duas evoluções. A preparação baixa o modelo uma vez por build. Se o download falhar, o jogo usa o sprite. Mapas, atributos e ataques vêm do PokéBonk.

Com Node.js 24.12+ e pnpm 10.33.2, na pasta do projeto:

```sh
pnpm install --frozen-lockfile
pnpm prepare:game
pnpm preview
```

Abra http://127.0.0.1:8098. Este teste é local e usa o snapshot offline do projeto.
