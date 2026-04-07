# Sesión Ricard — 2026-04-04

> Nuevas funcionalidades y ajustes de flujo extraídos de la videollamada.
> Fuente: `mrxv/transcriptions/sesion-ricard-hoy-2026-04-04/transcripcion-completa.txt`
> Complementa `CLAUDE.md` (reglas de negocio validadas) y `docs/flujos_trabajo_validacion.html`.

---

## 1. Bot de respuesta a leads (coches.net) — supervisado primero

- Cuando entre un mensaje de un lead, la app debe mostrar:
  - Datos del lead + mensaje recibido
  - **Respuesta sugerida estilo Ricard**, generada a partir del histórico de mails/conversaciones (Ricard pasará el corpus).
- **Modo supervisado** al inicio: Ricard valida cada respuesta antes de enviar.
- Cuando las respuestas sean consistentemente correctas → modo automático.
- **Detección de "lead para llamar"**: si el mensaje pide claramente llamada ("llámame", urgencia, etc.), el sistema:
  - Marca el lead como *"requiere llamada"*.
  - Envía **push al móvil** de Ricard.
  - Manda al cliente un mensaje tipo: *"Hola {nombre}, soy Ricard de CodinaCars. He visto tu interés en {vehículo}. Te llamo en breve, ¿a qué hora te va bien?"*
- Mensaje siempre **personalizado con nombre del cliente**.
- **Selector de horario**: pasarle un link estilo Calendly con huecos disponibles (2 semanas vista, slots de 2h). Alternativa simple: preguntar "¿martes a qué hora?".

## 2. Vista de Stock — rediseño

- **Quitar foto grande** como elemento principal. La foto no aporta info a Ricard.
  - Opcional: thumbnail pequeño (la foto sirve a clientes/teléfono).
- Cada tarjeta/fila debe mostrar **qué le falta al coche** de un vistazo:
  - Fotos OK / faltan
  - Ficha técnica, permiso circulación, ITV, factura compra
  - Mecánica, plancha, limpieza
  - **Seguro** (si aplica — ver §4)
- Indicador tipo **mapa de calor**: rojo (motor sin arreglar), amarillo (falta seguro), verde (OK).
- **Ordenación por defecto**: días en stock (más antiguos primero), calculado desde fecha factura compra.
  - Configurable: por más leads, más margen, más nuevos, etc. (1 click).
- Vista pensada para mostrar **~100 coches** sin scroll excesivo.

## 3. Reparaciones — entrada por autocompletado

- La tabla actual de inspector es demasiado granular. Sustituir por:
  - **Input con autocompletado**: Ricard escribe `Ale` → sugerencias `Aleta izquierda`, `Aleta derecha`, etc.
  - Categorías: Exterior, Interior, Mecánica.
- **Versión alternativa (futura)**: dibujo de coche clickable (piezas seleccionables con ratón/táctil).
- **Versión móvil táctil** prevista (no bloqueante).
- **Orden de trabajo estándar**: Mecánica → Plancha → Limpieza (limpieza **siempre la última**, salvo excepciones).

## 4. Seguro por días — integración

- Ricard contrata seguros por días, los activa según necesidad (visita / entrega / mover al taller).
- La app debe:
  - **Avisar** si se programa una visita/entrega/movimiento al taller y el coche **no tiene seguro activo**.
  - Mostrar el estado de seguro como otro indicador en stock.
- **Integración con web de seguros por días**: contratar póliza con 1 click (la app ya tiene matrícula, bastidor, km). Investigar API de proveedor.

## 5. Financiación — formulario digital de documentos

### Particular
- DNI
- Última nómina
- Certificado titularidad bancaria **o** recibo domiciliado
- Vida laboral (**<15 días de antigüedad**)

### Autónomo
- DNI
- Último recibo de autónomos
- Últimos modelos 303 (IVA)
- Última declaración de la renta
- Número de cuenta

### Empresa (~5% de las ventas, baja prioridad)
- NIF empresa + DNI apoderado
- Balance, renta… (BBVA y Santander **no aceptan empresa** según la financiera de Ricard — confirmar caso por caso).

### Cómo se pide
- **Mini formulario** que la app envía al cliente:
  - Upload de cada documento desde móvil/PC.
  - Verificación automática (foto DNI por ambas caras, OCR para validar).
- **Tutorial integrado** para cómo descargar la vida laboral (web/app de la Seguridad Social).

## 6. Hoja de reserva — digitalizar

- Ricard ya tiene una hoja de reserva en papel.
- Convertir a documento generado por la app (ya contemplado en `CLAUDE.md` como "Contrato de reserva").
- Confirmar: usar la plantilla actual de Ricard, no inventar una nueva.

## 6.bis Clientes — empadronamiento

- Cuando un lead se convierte en cliente: **DNI** (siempre) + número de cuenta solo si hay financiación (sino, transferencia directa).
- **Caso conflictivo**: cuando el DNI no coincide con el certificado de empadronamiento → la app debe alertar/permitir adjuntar el certificado adicional.

## 6.ter Vista de leads — filtros pendientes

- **Filtro lateral "leads no contestados"**: barra izquierda para ver de un vistazo los pendientes.
- **Filtro "leads con más mensajes"**: priorizar los más activos.
- Ricard no lo tiene claro aún cómo plantearlo — definir en próximas sesiones.

## 6.quater Canal de respuestas automáticas

- **No limitar a chat de coches.net**: el canal preferido es **WhatsApp muy currado** estilo Ricard.
- Mensaje tipo: *"Hola Javier, soy Ricard de CodinaCars. He visto que te has interesado en este vehículo. En cuanto pueda me pongo en contacto contigo, ¿a qué hora te va bien que te llame?"*
- Importante: **repetir el nombre del cliente** (toque personal).
- Permitido **inventar contexto/excusa** ("estoy en una entrega", etc.) si suena natural.
- El mensaje debe parecer 100% escrito por Ricard, no automático.

## 7. Recordatorios

- Pestaña actual de "Recordatorios" probablemente se elimina.
- Los recordatorios deben ser **inline en el stock** (icono/comment por coche que necesita acción).
- Pendiente de revisar — Ricard no lo tenía claro.

## 8. Pendientes / decisiones futuras

- **Mostrar coches a medio arreglar**: Ricard prefiere no enseñar coches con plancha/motor pendientes (visita perdida + clientes exigentes después). Javi sugiere registrar los casos para analizarlos en 1 año.
- **Pago de 50€ por reservar visita** (idea futura, no ahora).
- **Acceso web vs app**: la web (codinacars.com/.es) será accesible más adelante; ahora todo el desarrollo es la app.
- **Dominios kudinacasa.com / .es**: pendiente confirmar si están comprados.
- **Compras / proveedores**: la pantalla actual está bien — Ricard no la consulta directamente, solo se usa al asignar factura desde el coche. **No rediseñar**, solo embellecer.
- **Pago de 200€ por probar coche premium** (Ferrari, etc.) — visión a largo plazo, descartado por ahora.

---

## Confirmaciones (refuerzo de lo ya validado el 2026-04-03)

- **40 fotos mínimo** por vehículo: confirmado.
- Estados de lead **compra / no compra**: confirmado.
- Ricard nunca usa "se podría / sería posible" → **se hace, no hay imposible** (filosofía de trabajo).
