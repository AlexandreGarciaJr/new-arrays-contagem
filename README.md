# new Arrays | Contagem regressiva

Página temporária que fica no ar em `newarrays.com` até o lançamento do novo site, na **quarta-feira, 07/10/2026, às 10h (horário de Brasília)**.

Feita em HTML, CSS e JS puro. Não tem build, PHP nem banco de dados. Funciona em qualquer hospedagem Apache, como a HostGator.

## Como publicar (HostGator)
1. Abra o cPanel, entre no **Gerenciador de Arquivos** e vá até `public_html/`.
2. Envie **todo o conteúdo** desta pasta, incluindo o `.htaccess`. Ele é um arquivo oculto: ative "Mostrar arquivos ocultos".
3. Acesse `https://newarrays.com` e confira.
4. No lançamento, troque os arquivos pelos do site. O `.htaccess` manda o navegador não guardar o HTML em cache, então quem recarregar a página já vê o site novo.
   - Obs.: o site principal tem o seu próprio `.htaccess`, ou nenhum. Não deixe o desta página lá, porque ele redireciona para a raiz qualquer endereço que não existe.

## Como a hora funciona (`assets/js/contagem.js`, objeto `CFG`)
- **Alvo fixo:** `2026-10-07T10:00:00-03:00`. Quem estiver em outro fuso vê o mesmo tempo restante.
- **Correção do relógio:** a página faz um `HEAD` no próprio servidor e lê o cabeçalho `Date`, que o Apache envia em toda resposta.
  - Se o relógio do aparelho estiver errado em mais de 2 s, a página usa a hora do servidor.
  - Sem resposta do servidor, usa o relógio do navegador.
- **Barra de progresso:** vai de `CFG.inicio` (28/09) até o alvo.
- **No zero:** o relógio para em 00, aparece "Em instantes estaremos no ar." e o status muda para "Deploy".

## Parâmetros de teste
| URL | Efeito |
|---|---|
| `?simular=2026-10-07T09:59:50-03:00` | Finge que "agora" é esse instante. Serve para ver a chegada ao zero. |
| `?simular=...&congelar=1` | Para o relógio no instante simulado. Foi usado para gerar a `og-contagem.png`. |
| `?campo=forcar` | Liga o WebGL mesmo em GPU por software (ambientes de teste). |

## Arquivos
- `index.html`: conteúdo, SEO (title, description, canonical, Open Graph, Twitter e JSON-LD da Organization).
- `assets/css/contagem.css`: identidade do Manual NA 2026 (tokens iguais aos do site).
- `assets/js/contagem.js`: relógio de 7 segmentos, hora, som (Web Audio, desligado por padrão) e textos para leitor de tela.
- `assets/js/campo.js`: shader WebGL. É uma grade de pontos que o cursor amplia como lente, com rastro e mira HUD. A cada segundo sai um pulso do relógio e o clique ou o toque solta outro. Os parâmetros ficam no `CFG`.
- `assets/img/og-contagem.png`: prévia de compartilhamento, 1200×630.
- `.htaccess`, `robots.txt`, `sitemap.xml` e `site.webmanifest`.

## Acessibilidade e desempenho
- O relógio visual fica escondido do leitor de tela. Um texto `role="timer"` diz o tempo restante, atualizado a cada minuto.
- Com movimento reduzido: sem animações, o shader fica num quadro parado e o relógio continua contando.
- Sem WebGL ou em GPU fraca: fica o gradiente do CSS.
- Sem JavaScript: aparece a data do lançamento em texto.
- O shader roda em 1 passe, com o DPR limitado a 1,5, e pausa quando a aba está oculta.
