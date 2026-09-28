interface CatalogOption {
  code: string;
  name: string;
}

interface OrderBasicsFieldsProps {
  orderTypes: CatalogOption[];
  paymentConditions: CatalogOption[];
  deliveryRoutes: CatalogOption[];
}

export function OrderBasicsFields({
  orderTypes,
  paymentConditions,
  deliveryRoutes,
}: OrderBasicsFieldsProps) {
  return (
    <>
      <label>
        <span>Número de pedido *</span>
        <input name="orderNumber" required maxLength={120} autoFocus />
      </label>
      <label>
        <span>Cliente *</span>
        <input name="clientName" required maxLength={240} />
      </label>
      <label>
        <span>NIT o documento</span>
        <input name="clientDocument" maxLength={80} />
      </label>
      <label>
        <span>Tipo *</span>
        <select name="orderType" required>
          {orderTypes.map((item) => (
            <option key={item.code} value={item.code}>{item.name}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Condición de pago *</span>
        <select name="paymentCondition" required>
          {paymentConditions.map((item) => (
            <option key={item.code} value={item.code}>{item.name}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Modalidad de entrega *</span>
        <select name="deliveryRoute" required>
          {deliveryRoutes.map((item) => (
            <option key={item.code} value={item.code}>{item.name}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Departamento</span>
        <input name="clientDepartment" maxLength={120} />
      </label>
      <label>
        <span>Ciudad *</span>
        <input name="clientCity" required maxLength={120} />
      </label>
      <label>
        <span>Dirección de entrega *</span>
        <input name="clientAddress" required minLength={5} maxLength={500} />
      </label>
      <label>
        <span>Teléfono</span>
        <input name="clientPhone" type="tel" inputMode="tel" maxLength={60} />
      </label>
      <label>
        <input name="requiresPurchase" type="checkbox" />
        <span>Requiere compra o abastecimiento</span>
      </label>
    </>
  );
}

export type { CatalogOption };
