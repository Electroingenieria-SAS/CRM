import type {
  FreightPredictionInput,
  FreightPredictionResponse,
} from '@/modules/freight/application/freight-prediction.schemas';

export interface FreightQuotePort {
  quote(input: FreightPredictionInput): Promise<FreightPredictionResponse>;
}
