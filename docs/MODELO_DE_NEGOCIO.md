# Modelo de negocio vigente (migración 009)

**Modalidad:** préstamo de campaña con financiamiento **todo o nada**.

| Etapa | Qué pasa con el dinero |
|---|---|
| Captación (hasta `funding_deadline`, 30 días por defecto) | Cada aporte sale del saldo libre del inversionista y queda **reservado**. El agricultor aún no recibe nada y AgerVest no cobra. |
| Meta completada | Desembolso **único**: AgerVest cobra 6% de la recaudación bruta; el agricultor recibe 94%. Los pagos se programan a `duration_months` desde el desembolso. |
| Plazo vencido sin meta | Campaña `cancelled`. Reembolso del 100% de cada aporte, sin comisión ni deuda para el agricultor. |
| Cierre de campaña | El agricultor paga capital × (1 + tasa de la campaña). Si no tiene saldo, la obligación queda pendiente y visible (mora). |

**Tasa:** `expected_return_pct` es la tasa **del período completo**, no una TEA. La interfaz muestra además el equivalente anual referencial: (1 + tasa)^(12/meses) − 1.

## Caso S/100.000 con S/20.000 reunidos
- Al vencer el plazo: se devuelven los S/20.000 a sus aportantes. El agricultor recibe S/0, no debe nada y AgerVest no cobra.
- Si se hubiera completado: el agricultor recibe S/94.000, AgerVest S/6.000; con una tasa de campaña de 12% el agricultor devuelve S/112.000 al cierre.
- Para recibir un neto N, la meta bruta debe ser N / 0,94 (ej. neto S/50.000 → meta S/53.191,49).

## Controles
- Sin sobre-financiamiento: el aporte se rechaza si excede lo que falta (con bloqueo de fila).
- Idempotencia: aportes y depósitos aceptan `idempotencyKey`; repetir la misma clave no duplica movimientos.
- Titularidad: un agricultor solo puede pagar sus propias obligaciones (`fn_pay_return_as`).
- Privacidad: `GET /api/investors/:id` exige sesión y solo devuelve el propio perfil (o admin).
- Verificación: la ruta heredada `/api/auth/investor/verify` responde 410; solo el administrador aprueba.
- Inversiones previas a la migración conservan sus condiciones (ya desembolsadas).

## Pendiente / supuestos
- 6% y 30 días son hipótesis no validadas con costos reales.
- Score de riesgo heurístico: no estima probabilidad de impago.
- Seguros, garantías, reprogramación y reparto de recuperaciones parciales no están implementados.
- Dinero simulado: no hay integración bancaria real.
- La app en memoria de la raíz (`src/`, `npm start` de la raíz) es heredada; la canónica es `backend/` (la que usa Render).
