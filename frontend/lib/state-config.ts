export interface AppStateConfig {
  serverStateStrategy: 'ReactServerComponents' | 'SWR';
  clientStateStrategy: 'Zustand' | 'Context';
}

export const defaultStateConfig: AppStateConfig = {
  serverStateStrategy: 'ReactServerComponents',
  clientStateStrategy: 'Context',
};
