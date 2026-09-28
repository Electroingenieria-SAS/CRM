import { useMemo, useState } from 'react';
import type {
  FreightCarrier,
  FreightDestination,
} from '@/modules/freight/application/freight-catalog.schemas';
import type { FreightPredictionInput } from '@/modules/freight/application/freight-prediction.schemas';
import {
  normalizeFreightCity,
  normalizeFreightDepartment,
} from '@/modules/freight/domain/location-normalizer';
import styles from './freight-ui.module.css';

interface FreightQuoteFormProps {
  carriers: readonly FreightCarrier[];
  destinations: readonly FreightDestination[];
  disabled?: boolean;
  onPredict(input: FreightPredictionInput): Promise<void>;
}

function optionalNumber(value: string) {
  return value.trim() === '' ? undefined : Number(value);
}

export function FreightQuoteForm({
  carriers,
  destinations,
  disabled,
  onPredict,
}: FreightQuoteFormProps) {
  const [search, setSearch] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [routeCode, setRouteCode] = useState<FreightPredictionInput['routeCode']>(
    'NATIONAL_DISPATCH',
  );
  const [carrierId, setCarrierId] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [packageCount, setPackageCount] = useState('');
  const [volumeM3, setVolumeM3] = useState('');

  const filteredDestinations = useMemo(() => {
    const queryCity = normalizeFreightCity(search);
    const queryDepartment = normalizeFreightDepartment(search);
    if (!queryCity && !queryDepartment) return destinations;

    return destinations.filter((destination) => {
      const city = normalizeFreightCity(destination.city);
      const department = normalizeFreightDepartment(destination.department);
      return city.includes(queryCity) || department.includes(queryDepartment);
    });
  }, [destinations, search]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!destinationId) return;

    await onPredict({
      destinationId,
      routeCode,
      carrierId: carrierId || undefined,
      weightKg: optionalNumber(weightKg),
      packageCount: optionalNumber(packageCount),
      volumeM3: optionalNumber(volumeM3),
    });
  }

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      <div className={styles.field}>
        <label htmlFor="freight-destination-search">Buscar destino</label>
        <input
          id="freight-destination-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Ej. Armenia"
          autoComplete="off"
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="freight-destination">Destino</label>
        <select
          id="freight-destination"
          value={destinationId}
          onChange={(event) => setDestinationId(event.target.value)}
          required
        >
          <option value="">Selecciona ciudad</option>
          {filteredDestinations.map((destination) => (
            <option value={destination.id} key={destination.id}>
              {destination.city} — {destination.department}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label htmlFor="freight-route">Modalidad</label>
        <select
          id="freight-route"
          value={routeCode}
          onChange={(event) =>
            setRouteCode(event.target.value as FreightPredictionInput['routeCode'])
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
          value={carrierId}
          onChange={(event) => setCarrierId(event.target.value)}
        >
          <option value="">Comparar todas</option>
          {carriers.map((carrier) => (
            <option value={carrier.id} key={carrier.id}>
              {carrier.name}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.numericGrid}>
        <div className={styles.field}>
          <label htmlFor="freight-weight">Peso (kg)</label>
          <input
            id="freight-weight"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={weightKg}
            onChange={(event) => setWeightKg(event.target.value)}
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
            value={packageCount}
            onChange={(event) => setPackageCount(event.target.value)}
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
            value={volumeM3}
            onChange={(event) => setVolumeM3(event.target.value)}
          />
        </div>
      </div>

      <p className={styles.helper}>
        Peso, bultos y volumen solo refinan la estimación cuando existe evidencia suficiente.
      </p>

      <div className={styles.actions}>
        <button className="primary-button" type="submit" disabled={disabled || !destinationId}>
          Estimar flete
        </button>
      </div>
    </form>
  );
}
