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
import {
  FreightDestinationFields,
  FreightRouteCarrierFields,
  FreightVariableFields,
} from './freight-quote-fields';
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

export function FreightQuoteForm(props: FreightQuoteFormProps) {
  const [search, setSearch] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [routeCode, setRouteCode] =
    useState<FreightPredictionInput['routeCode']>('NATIONAL_DISPATCH');
  const [carrierId, setCarrierId] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [packageCount, setPackageCount] = useState('');
  const [volumeM3, setVolumeM3] = useState('');

  const destinations = useMemo(() => {
    const cityQuery = normalizeFreightCity(search);
    const departmentQuery = normalizeFreightDepartment(search);
    if (!cityQuery && !departmentQuery) return props.destinations;

    return props.destinations.filter((destination) => {
      const city = normalizeFreightCity(destination.city);
      const department = normalizeFreightDepartment(destination.department);
      return city.includes(cityQuery) || department.includes(departmentQuery);
    });
  }, [props.destinations, search]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!destinationId) return;
    await props.onPredict({
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
      <FreightDestinationFields
        search={search}
        destinationId={destinationId}
        destinations={destinations}
        onSearch={setSearch}
        onDestination={setDestinationId}
      />
      <FreightRouteCarrierFields
        routeCode={routeCode}
        carrierId={carrierId}
        carriers={props.carriers}
        onRoute={setRouteCode}
        onCarrier={setCarrierId}
      />
      <FreightVariableFields
        weightKg={weightKg}
        packageCount={packageCount}
        volumeM3={volumeM3}
        onWeight={setWeightKg}
        onPackages={setPackageCount}
        onVolume={setVolumeM3}
      />
      <p className={styles.helper}>
        Peso, bultos y volumen solo refinan la estimación cuando existe evidencia suficiente.
      </p>
      <div className={styles.actions}>
        <button
          className="primary-button"
          type="submit"
          disabled={props.disabled || !destinationId}
        >
          Estimar flete
        </button>
      </div>
    </form>
  );
}
