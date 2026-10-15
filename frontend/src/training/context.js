import { createContext, useContext } from 'react';

export const TrainingContext = createContext(null);

export const useTrainingContext = () => {
  const context = useContext(TrainingContext);
  if (!context) throw new Error('useTrainingContext must be used inside TrainingApp');
  return context;
};
