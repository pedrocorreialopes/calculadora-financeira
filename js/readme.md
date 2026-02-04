# RPN Financial Calculator (estilo 12C Platinum)

Simulador **frontend-only** (HTML/CSS/JS) de uma calculadora financeira **RPN**, inspirado na experiência de uso da **HP 12C Platinum** (**sem afiliação** e sem uso de marca/arte proprietária).

> Observação importante: este projeto busca equivalência funcional/experiência, mas **não replica firmware** nem garante 1:1 com todos os detalhes proprietários.

## Objetivos
- Interface estilo calculadora, **dark mode** nativo
- Motor RPN com pilha **T/Z/Y/X**
- Funções financeiras (TVM, Cash Flow, NPV/IRR, AMORT etc.) — em evolução
- Persistência local e modo offline (PWA simples)

## Funcionalidades concluídas (até agora)
- UI responsiva (mobile-first) com HTML5 semântico e acessibilidade básica
- Display com pilha T/Z/Y/X e indicadores de modo (BEGIN/END, 12×/1×, day count)
- Entrada numérica, ponto decimal, CHS, ENTER (empilha), CLx, CLEAR (reset total)
- Operações básicas: `+`, `−`, `×`, `÷`, `√`, `y^x`, `%` (percentual simples)
- SHIFT **f**/**g** (parcial):
  - `f ENTER` = LASTx (parcial)
  - `g ENTER` = R↓ (roll down)
  - `f -` = Σ+ (estatística simples)
  - `f +` = média (x̄)
  - `g +` = desvio padrão amostral (s)
  - `g ×` = Δ% (variação percentual)
  - `f Σ` = CLΣ
- Persistência **LocalStorage** do estado
- Service Worker para **offline** (cache-first)

## Rotas/URIs de entrada
- **`/index.html`**: aplicativo
- **`/sw.js`**: service worker
- **`/manifest.webmanifest`**: manifesto PWA

## Atalhos de teclado
- Dígitos `0-9`
- `.` ou `,` → ponto decimal
- `Enter` → ENTER
- `Backspace` → CLx
- `Esc` → CLEAR (reset)
- `+ - * /` → operações
- `F` / `G` → shifts
- `Q` → √
- `^` → y^x
- `S` → STO (placeholder)
- `R` → RCL (placeholder)

## Persistência / Modelo de dados
Armazenado em `localStorage` na chave: `rpn12c_state_v1`

Estrutura (resumo):
- `x,y,z,t,lastX`: números
- `entry, entering`: controle de entrada
- `shift`: `"f" | "g" | null`
- `begin, is12x, dayCount`: modos
- `regs`: array de 10 registros
- `tvm`: `{n,i,pv,pmt,fv}`
- `cf`: `{c0, cfs[], njs[]}`
- `stats`: `{n,sumX,sumX2}`

## Não implementado ainda (planejado)
- Mapeamento completo de **todas** as teclas Platinum (f/g) com fidelidade de sequência
- STO/RCL com seleção de registrador por dígito e operações em registradores
- TVM completo (resolver variável), BEGIN/END influenciando PMT
- Cash Flow completo: CF0/CFj/Nj + NPV/IRR
- AMORT/BAL
- Datas: DATE/DAYS com 30/360 e ACT/ACT
- Estatística completa (Σ+, Σ-, regressão, etc.) com histórico
- Programação/execução (BST/GTO/R/S), se necessário

## Próximos passos recomendados
1. Você fornecer **casos de teste** (sequência de teclas → resultado) para validar a fidelidade
2. Implementar STO/RCL e registradores
3. Implementar TVM (n, i, PV, PMT, FV) e regras 12×/1× + BEGIN/END
4. Implementar Cash Flow + NPV/IRR
5. Implementar AMORT/BAL + datas

## URLs públicas
- Produção: (use a aba **Publish** para publicar)
- APIs externas: não usadas

---

### Publicação
Para colocar o site no ar, use a aba **Publish**. Ela gera a URL do site automaticamente.
