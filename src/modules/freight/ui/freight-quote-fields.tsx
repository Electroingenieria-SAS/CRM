import type {
  FreightCarrier,
  FreightDestination,
} from '@/modules/freight/application/freight-catalog.schemas';
import type { FreightPredictionInput } from '@/modules/freight/application/freight-prediction.schemas';
import styles from './freight-ui.module.css';

interface DestinationFieldsProps {
  search: string;
  destinationId: string;
  destinations: readonly FreightDestination[];
  onSearch(value: string): void;
  onDestination(value: string): void;
}

export function FreightDestinationFields(props: DestinationFieldsProps) {
  return (
    <>
      <div className={styles.field}>
        <label htmlFor="freight-destination-search">Buscar destino</label>
        <input
          id="freight-destination-search"
          value={props.search}
          onChange={(event) => props.onSearch(event.target.value)}
          placeholder="Ej. Armenia"
          autoComplete="off"
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="freight-destination">Destino</label>
        <select
          id="freight-destination"
          value={props.destinationId}
          onChange={(event) => props.onDestination(event.target.value)}
          required
        >
          <option value="">Selecciona ciudad</option>
          {props.destinations.map((destination) => (
            <option value={destination.id} key={destination.id}>
              {destination.city} — {destination.department}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

interface RouteCarrierFieldsProps {
  routeCode: FreightPredictionInput['routeCode'];
  carrierId: string;
  carriers: readonly FreightCarrier[];
  onRoute(value: FreightPredictionInput['routeCode']): void;
  onCarrier(value: string): void;
}

export function FreightRouteCarrierFields(props: RouteCarrierFieldsProps) {
  return (
    <>
      <div className={styles.field}>
        <label htmlFor="freight-route">Modalidad</label>
        <select
          id="freight-route"
          value={props.routeCode}
          onChange={(event) =>
            props.onRoute(event.target.value as FreightPredictionInput['routeCode'])
          }
        >
          <option value="NATIONAL_DISPATCH">Despacho nacional</option>
          <option value="LOCAL_DISPATCH">Despacho local</option>
          <option value="CLIENT_PICKUP">Cliente recoge</option>
          <option value="CLIENT_POINT">Entrega en punto</option>
        </select>
      </div>
      <div className={styles.field}>
        <label htmlFor="freight-carrier">Transportadora</label>
        <select
          id="freight-carrier"
          value={props.carrierId}
          onChange={(event) => props.onCarrier(event.target.value)}
        >
          <option value="">Comparar todas</option>
          {props.carriers.map((carrier) => (
            <option value={carrier.id} key={carrier.id}>
              {carrier.name}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

interface VariableFieldsProps {
  weightKg: string;
  packageCount: string;
  volumeM3: string;
  onWeight(value: string): void;
  onPackages(value: string): void;
  onVolume(value: string): void;
}

export function FreightVariableFields(props: VariableFieldsProps) {
  return (
    <div className={styles.numericGrid}>
      <div className={styles.field}>
        <label htmlFor="freight-weight">Peso (kg)</label>
        <input
          id="freight-weight"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={props.weightKg}
          onChange={(event) => props.onWeight(event.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="freight-packages">Bultos</label>
        <input
          id="freight-packages"
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          value={props.packageCount}
          onChange={(event) => props.onPackages(event.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="freight-volume">Volumen (m³)</label>
        <input
          id="freight-volume"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.001"
          value={props.volumeM3}
          onChange={(event) => props.onVolume(event.target.value)}
        />
      </div>
    </div>
  );
}
