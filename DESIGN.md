# Guia de Estilo — Chocolate & Creme

Referência portátil de **cores e formatos** para reproduzir este visual em outros projetos. Base: design system Organic, paleta chocolate-e-creme.

## Cores

### Base
| Papel | Hex | Uso |
| --- | --- | --- |
| Creme (fundo) | `#f5ead8` | Fundo da página e cartões claros |
| Superfície | `#fffaf1` | Cartões sobre o creme |
| Texto | `#201e1d` | Texto principal |

### Chocolate (neutro escuro)
| Papel | Hex | Uso |
| --- | --- | --- |
| Chocolate 800 | `#3a2318` | Cabeçalhos escuros, áreas de destaque |
| Chocolate 700 | `#54372a` | Trilhas / divisores sobre chocolate |
| Chocolate 600 | `#5f3d28` | Ícones de "concluído", rótulos |

### Creme sobre chocolate (texto/rótulos em áreas escuras)
| Papel | Hex |
| --- | --- |
| Creme claro | `#e2cba7` |
| Creme médio | `#c9ad84` |
| Creme escuro | `#a9855c` |

### Acento — Terracota (ramp)
| Passo | Hex | Uso |
| --- | --- | --- |
| 100 | `#f3e0d1` | Preenchimento tênue |
| 300 | `#e2b58f` | Bordas suaves |
| 500 (base) | `#c67139` | Acento principal, barras de progresso, avatares |
| 700 | `#8f4e26` | Texto sobre preenchimento tênue |
| 900 | `#5a3117` | Texto de ênfase |

> Regra de contraste: para texto pequeno na cor de acento, use o passo 700; reserve o 500 para chrome, ícones e texto grande.

## Formatos (raios e sombras)

Estética "super arredondada" — nenhum canto reto.

| Elemento | Raio |
| --- | --- |
| Botões, checkboxes, barras de progresso, tags | `999px` (pílula/círculo) |
| Cartões | `22px` |
| Painel / folha (topo) | `34px 34px 0 0` |
| Moldura de dispositivo / containers grandes | `46px` |

Sombras (calibradas para o fundo creme):
- `sm`: `0 1px 2px rgba(58,35,24,.06)`
- `md`: `0 4px 14px rgba(58,35,24,.10)`
- `lg`: `0 12px 32px rgba(58,35,24,.14)`

## Tipografia

- **Títulos / números grandes:** Caprasimo (display)
- **Corpo / rótulos:** Figtree

Escala de referência: número grande 76px · título 22px · título de item 15px (peso 600–700) · meta/rótulo 12px. Rótulos de seção em maiúsculas com `letter-spacing: .06em`.

## Princípios de layout

- Alinhado à esquerda, assimétrico; conteúdo encosta à esquerda com respiro à direita.
- Formas macias (círculos, blobs) como decoração.
- Áreas escuras em chocolate; conteúdo em folhas creme com cantos arredondados que sobrepõem levemente o cabeçalho.
- Espaçamento generoso — as formas arredondadas precisam de ar.

## Tokens CSS (copiar e colar)

```css
:root {
  /* base */
  --color-bg: #f5ead8;
  --color-surface: #fffaf1;
  --color-text: #201e1d;

  /* chocolate */
  --choc-800: #3a2318;
  --choc-700: #54372a;
  --choc-600: #5f3d28;

  /* creme sobre chocolate */
  --cream-1: #e2cba7;
  --cream-2: #c9ad84;
  --cream-3: #a9855c;

  /* acento terracota */
  --color-accent-100: #f3e0d1;
  --color-accent-300: #e2b58f;
  --color-accent:     #c67139;
  --color-accent-700: #8f4e26;
  --color-accent-900: #5a3117;

  /* formatos */
  --radius-card: 22px;
  --radius-sheet: 34px;
  --radius-frame: 46px;
  --radius-pill: 999px;

  /* sombras */
  --shadow-sm: 0 1px 2px rgba(58,35,24,.06);
  --shadow-md: 0 4px 14px rgba(58,35,24,.10);
  --shadow-lg: 0 12px 32px rgba(58,35,24,.14);

  /* fontes */
  --font-heading: 'Caprasimo', serif;
  --font-body: 'Figtree', sans-serif;
}
```

```html
<link href="https://fonts.googleapis.com/css2?family=Caprasimo&family=Figtree:wght@400;500;600;700&display=swap" rel="stylesheet">
```
