# ADR-0003 · Customer Intelligence determinístico y explicable

Fecha: 2026-09-28  
Estado: Aceptado

## Contexto

El negocio define únicamente dos factores para clasificar clientes:

1. cantidad de pedidos válidos;
2. valor efectivamente pagado.

El CRM legado V11.39.x ya combinaba frecuencia y valor con ponderación 50/50 mediante ranking relativo, pero usaba factura como respaldo cuando no encontraba otra evidencia financiera. La regla aclarada para la reconstrucción es más precisa: **la factura registrada es la evidencia de cuánto se pagó**.

También existe una semántica histórica de segmentos donde la banda superior se denomina URGENT.

## Decisión

La versión 1.0.0 usa:

- 50 % percentil por cantidad de pedidos;
- 50 % percentil por valor pagado;
- score de 0 a 100;
- BASIC: score < 30;
- NORMAL: 30 ≤ score < 70;
- PREMIUM: 70 ≤ score < 90;
- URGENT: score ≥ 90.

Los umbrales y pesos viven en customer_intelligence_algorithm_versions; no son constantes ocultas de UI.

URGENT significa **banda comercial/operativa superior derivada exclusivamente de pedidos + pago**. No significa que un vendedor marcó manualmente una urgencia.

La fuente económica es:

REGISTERED = amount  
PARTIALLY_REVERSED = amount - reversed_amount  
REVERSED = 0  
VOID = 0

No se usan opinión del vendedor, ciudad, antigüedad, margen, notas, rol, tamaño del cliente, valores pendientes, cotizaciones ni prioridad manual.

## Identidad del cliente

Documento normalizado cuando existe. Un pedido sin documento recibe identidad provisional propia del pedido; nunca se fusiona únicamente por nombre textual.

## Soporte estadístico

El motor siempre produce señal útil. No responde “histórico insuficiente”.

- Sin identidad/histórico: NORMAL, provisional, soporte LOW.
- Datos escasos: calcula score, pero marca provisional=true.
- La confianza se expresa como soporte LOW/MEDIUM/HIGH; no se presenta como probabilidad ni “IA”.

## Consecuencias

- Resultado determinístico, reproducible y auditable.
- Outliers se controlan con percentiles en vez de sumar escalas incompatibles.
- Los empates reciben el mismo percentil base.
- Cambios futuros del algoritmo requieren nueva versión.
- Orders puede consumir erp_x_customer_priority_signal sin conocer tablas internas.
