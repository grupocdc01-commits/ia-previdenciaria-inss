import { createContext, useContext, useState, type ReactNode } from "react";
import { emptyAnswers, type Answers } from "./case-model";
import { findDemo } from "./demo-cases";

// Estado apenas em memória. Nada é salvo em localStorage (dados sensíveis).
interface Store {
  caseId: string;
  answers: Answers;
  setAnswers: (fn: (a: Answers) => Answers) => void;
  loadDemo: (id: string) => void;
  reset: () => void;
}

const Ctx = createContext<Store | null>(null);

export function CaseProvider({ children }: { children: ReactNode }) {
  const [caseId, setCaseId] = useState("meu-caso-demo");
  const [answers, set] = useState<Answers>(emptyAnswers);
  return (
    <Ctx.Provider
      value={{
        caseId,
        answers,
        setAnswers: (fn) => set((a) => fn(a)),
        loadDemo: (id) => {
          const d = findDemo(id);
          if (d) {
            setCaseId(d.id);
            set(structuredClone(d.answers));
          }
        },
        reset: () => {
          setCaseId("meu-caso-demo");
          set(emptyAnswers());
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useCase() {
  const c = useContext(Ctx);
  if (!c) throw new Error("CaseProvider ausente");
  return c;
}
