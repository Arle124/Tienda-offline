# Flujos de Trabajo de la Tienda (Experiencia de Usuario)

Este documento detalla los 5 momentos clave del día a día de la tendera y cómo la aplicación se amolda a su ritmo de trabajo físico en el mostrador.

---

## 1. Venta Rápida al Contado (Efectivo)
- **Contexto:** Clientes apurados, compra de 1 a 3 artículos, a menudo sin código de barras (pan, huevos, queso).
- **Acción:**
  1. Toca botones grandes de favoritos o ingresa valor libre en teclado numérico (`3500` -> `+ Varios`).
  2. La pantalla muestra el total en números grandes.
  3. Botones rápidos de pago: `[Exacto]`, `[$10.000]`, `[$20.000]`, `[$50.000]`.
  4. Muestra el cambio a devolver.
  5. Toca `Cobrar`. Sonido sutil de caja registradora + vibración háptica.
  6. Guarda en base de datos local en < 50ms y limpia la pantalla.

## 2. Venta a Crédito ("El Fiado")
- **Contexto:** Vecinos de confianza que pagan semanal o quincenalmente.
- **Acción:**
  1. Carga los productos al total de la cuenta.
  2. Pulsa el botón amarillo destacado: `Fiar`.
  3. Lista de clientes ordenada por frecuencia reciente o barra de búsqueda por apodo/nombre.
  4. Muestra saldo acumulado: *Deuda anterior ($25.000) + Nueva compra ($14.200) = Nuevo saldo ($39.200)*.
  5. Confirma con un toque. No requiere datos burocráticos como cédula o dirección.

## 3. Abono o Pago de Deuda
- **Contexto:** El cliente llega exclusivamente a pagar parte o el total de su saldo pendiente.
- **Acción:**
  1. Abre la pestaña fija `Deudores`.
  2. Toca al cliente (ej. *"Don Pedro - Debe $65.000"*).
  3. Toca `Registrar Abono`.
  4. Digita el monto recibido (ej. `20000`).
  5. Visualiza la resta automática: *Saldo restante: $45.000*.
  6. Confirma. Opción de enviar comprobante preformateado por WhatsApp con un toque.

## 4. Facturas de Proveedores (Cuentas por Pagar)
- **Contexto:** Llega el camión distribuidor en plena atención al público.
- **Acción:**
  1. Abre `Proveedores` -> `+ Factura Rápida`.
  2. Toma foto a la factura física con la cámara.
  3. Escribe Proveedor, Monto y Fecha límite de pago.
  4. Marca si se pagó con dinero de caja o queda pendiente.
  5. Se archiva en la lista de vencimientos sin necesidad de transcribir 20 ítems a mano.

## 5. Control de Existencias sin Estrés ("El Semáforo")
- **Contexto:** Preparar el pedido de reposición para el día siguiente.
- **Acción:**
  1. Cada venta descuenta stock automáticamente.
  2. Pestaña `¿Qué se está acabando?`:
     - 🔴 **Rojo (0 unidades o agotado):** Productos críticos.
     - 🟡 **Amarillo (Stock por debajo del umbral mínimo):** Reposición recomendada.
     - 🟢 **Verde:** Stock suficiente.
  3. Genera la lista de compras sin tener que hacer conteos a ojo en las repisas.
