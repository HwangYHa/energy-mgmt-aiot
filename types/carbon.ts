// types/carbon.ts
export interface CarbonEmission {
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
  unit: 'tCO2';
}